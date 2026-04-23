import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db, pool, usersTable, transactionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { promises as dns } from "dns";
import {
  RegisterBody,
  LoginBody,
  GetMeResponse,
} from "@workspace/api-zod";
import { z } from "zod";

const router: IRouter = Router();

// ── In-memory OTP store: phone → { otp, expires, email } ──
const otpStore = new Map<string, { otp: string; expires: number; email: string }>();
// ── Verified phone tokens: token → { phone, expires } ──
const verifiedTokens = new Map<string, { phone: string; expires: number }>();

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function isEmailDomainValid(email: string): Promise<boolean> {
  try {
    const domain = email.split("@")[1];
    if (!domain) return false;
    const mx = await dns.resolveMx(domain);
    return mx.length > 0;
  } catch {
    return false;
  }
}

async function sendOtpSms(phone: string, otp: string): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) {
    // Twilio not configured — log OTP for testing
    console.log(`[OTP] Phone: ${phone}  Code: ${otp}`);
    return;
  }
  const twilio = (await import("twilio")).default;
  const client = twilio(sid, token);
  await client.messages.create({
    body: `Your BetPulse verification code is: ${otp}. Valid for 5 minutes. Do not share this code with anyone.`,
    from,
    to: phone,
  });
}

// ─── POST /auth/send-otp ───────────────────────────────────────────────────
router.post("/auth/send-otp", async (req, res): Promise<void> => {
  const parsed = z.object({
    phone: z.string().min(10, "Invalid phone number"),
    email: z.string().email("Invalid email"),
  }).safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const { phone, email } = parsed.data;

  // Validate email domain via DNS MX lookup
  const domainOk = await isEmailDomainValid(email);
  if (!domainOk) {
    res.status(400).json({ error: "This email address does not look real. Please use a valid email (Gmail, Yahoo, Hotmail, etc.)." });
    return;
  }

  // Check email not already registered
  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing.length > 0) {
    res.status(400).json({ error: "This email is already registered. Please log in instead." });
    return;
  }

  // Rate limit: prevent spamming OTP to same phone
  const prev = otpStore.get(phone);
  if (prev && prev.expires > Date.now() + 4 * 60 * 1000) {
    res.status(429).json({ error: "OTP already sent. Please wait before requesting a new one." });
    return;
  }

  const otp = generateOtp();
  otpStore.set(phone, { otp, expires: Date.now() + 5 * 60 * 1000, email });

  try {
    await sendOtpSms(phone, otp);
    res.json({ message: "OTP sent to your phone number." });
  } catch (err: any) {
    console.error("SMS send failed:", err.message);
    res.status(500).json({ error: "Failed to send OTP. Please check the phone number and try again." });
  }
});

// ─── POST /auth/verify-otp ────────────────────────────────────────────────
router.post("/auth/verify-otp", async (req, res): Promise<void> => {
  const parsed = z.object({
    phone: z.string().min(10),
    otp: z.string().length(6, "OTP must be 6 digits"),
  }).safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const { phone, otp } = parsed.data;
  const stored = otpStore.get(phone);

  if (!stored) {
    res.status(400).json({ error: "No OTP found for this number. Please request a new one." });
    return;
  }
  if (Date.now() > stored.expires) {
    otpStore.delete(phone);
    res.status(400).json({ error: "OTP has expired. Please request a new code." });
    return;
  }
  if (stored.otp !== otp) {
    res.status(400).json({ error: "Incorrect OTP code. Please check and try again." });
    return;
  }

  // OTP valid — issue a short-lived verification token
  const token = crypto.randomUUID();
  verifiedTokens.set(token, { phone, expires: Date.now() + 10 * 60 * 1000 });
  otpStore.delete(phone);

  res.json({ verified: true, token });
});

// ─── POST /auth/register ──────────────────────────────────────────────────
router.post("/auth/register", async (req, res): Promise<void> => {
  const BodySchema = z.object({
    username: z.string().min(3, "Username must be at least 3 characters"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    phone: z.string().optional(),
    verificationToken: z.string().optional(),
  });

  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const { username, email, password, phone, verificationToken } = parsed.data;

  // If a verification token is provided, validate it
  let verifiedPhone: string | undefined;
  if (verificationToken) {
    const vtData = verifiedTokens.get(verificationToken);
    if (!vtData || Date.now() > vtData.expires) {
      res.status(400).json({ error: "Phone verification expired. Please verify your phone again." });
      return;
    }
    verifiedPhone = vtData.phone;
    verifiedTokens.delete(verificationToken);
  }

  // Email domain check (even if no OTP, always validate the domain)
  const domainOk = await isEmailDomainValid(email);
  if (!domainOk) {
    res.status(400).json({ error: "This email address does not look real. Please use a valid email." });
    return;
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing.length > 0) {
    res.status(400).json({ error: "Email already registered" });
    return;
  }

  // Read signup bonus from platform settings (default 50000 if not set)
  const bonusResult = await pool.query("SELECT value FROM platform_settings WHERE key = $1", ["signup_bonus"]);
  const signupBonus = Math.max(0, Math.round(parseFloat(bonusResult.rows[0]?.value ?? "50000")));
  const bonusStr = signupBonus.toFixed(2);

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db
    .insert(usersTable)
    .values({
      username,
      email,
      passwordHash,
      role: "user",
      ...(verifiedPhone ? { phone: verifiedPhone, phoneVerified: true } : phone ? { phone } : {}),
    })
    .returning();

  if (signupBonus > 0) {
    await db.insert(transactionsTable).values({
      userId: user.id,
      type: "deposit",
      amount: bonusStr,
      balanceAfter: bonusStr,
      description: "Welcome bonus — signup reward (play-only, not withdrawable)",
    });
    await db.update(usersTable).set({ balance: bonusStr, bonusBalance: bonusStr }).where(eq(usersTable.id, user.id));
  }

  req.session.userId = user.id;

  res.status(201).json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      balance: parseFloat(user.balance),
      createdAt: user.createdAt.toISOString(),
    },
  });
});

// ─── POST /auth/login ─────────────────────────────────────────────────────
router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email));

  if (!user) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  if (user.isBlocked) {
    res.status(403).json({ error: "Your account has been blocked. Please contact support." });
    return;
  }

  req.session.userId = user.id;

  res.json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      balance: parseFloat(user.balance),
      createdAt: user.createdAt.toISOString(),
    },
  });
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  req.session.destroy(() => {
    res.json({ message: "Logged out" });
  });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.session.userId));

  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  const result = GetMeResponse.parse({
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    balance: parseFloat(user.balance),
    createdAt: user.createdAt.toISOString(),
  });

  res.json(result);
});

export default router;
