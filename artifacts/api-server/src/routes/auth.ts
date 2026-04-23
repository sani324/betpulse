import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db, pool, usersTable, transactionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { promises as dns } from "dns";
import nodemailer from "nodemailer";
import {
  LoginBody,
  GetMeResponse,
} from "@workspace/api-zod";
import { z } from "zod";

const router: IRouter = Router();

// ── In-memory OTP store: email → { otp, expires } ──
const otpStore = new Map<string, { otp: string; expires: number }>();
// ── Verified email tokens issued after successful OTP ──
const verifiedTokens = new Map<string, { email: string; expires: number }>();

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

function buildOtpEmailHtml(otp: string): string {
  return `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;background:#f8fafc;padding:32px;border-radius:16px">
      <div style="text-align:center;margin-bottom:24px">
        <div style="font-size:40px;margin-bottom:8px">🎯</div>
        <h2 style="color:#0f172a;margin:0;font-size:22px">BetPulse Verification</h2>
      </div>
      <p style="color:#475569;font-size:15px;line-height:1.6;margin-bottom:24px">
        Use the code below to verify your email and complete your registration.
      </p>
      <div style="background:#0a2414;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
        <div style="color:#94a3b8;font-size:12px;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px">Your Verification Code</div>
        <div style="color:#f5c542;font-size:42px;font-weight:900;letter-spacing:8px">${otp}</div>
        <div style="color:#64748b;font-size:12px;margin-top:8px">Valid for 5 minutes</div>
      </div>
      <p style="color:#94a3b8;font-size:12px;text-align:center;line-height:1.5">
        If you did not request this, you can safely ignore this email.<br/>
        Do not share this code with anyone.
      </p>
    </div>
  `;
}

async function sendOtpEmail(email: string, otp: string): Promise<void> {
  const subject = `${otp} is your BetPulse verification code`;
  const html = buildOtpEmailHtml(otp);
  const fromAddress = process.env.EMAIL_FROM ?? "BetPulse <noreply@betpulse.com>";

  // 1. Try Resend API (preferred — free tier, reliable)
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: fromAddress, to: [email], subject, html }),
    });
    if (!r.ok) {
      const err = await r.json() as { message?: string };
      throw new Error(`Resend error: ${err.message ?? r.statusText}`);
    }
    console.log(`[Email] Sent via Resend to ${email}`);
    return;
  }

  // 2. Try SMTP (Gmail, Outlook, any provider)
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  if (smtpHost && smtpUser && smtpPass) {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(process.env.SMTP_PORT ?? "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: { user: smtpUser, pass: smtpPass },
    });
    await transporter.sendMail({ from: fromAddress, to: email, subject, html });
    console.log(`[Email] Sent via SMTP to ${email}`);
    return;
  }

  // No email service configured
  throw new Error("No email service configured");
}

// ─── POST /auth/send-otp ───────────────────────────────────────────────────
router.post("/auth/send-otp", async (req, res): Promise<void> => {
  const parsed = z.object({
    email: z.string().email("Invalid email address"),
  }).safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const { email } = parsed.data;

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

  // Rate limit: one OTP per 60 seconds per email
  const prev = otpStore.get(email);
  if (prev && prev.expires > Date.now() + 4 * 60 * 1000) {
    res.status(429).json({ error: "OTP already sent. Please check your inbox or wait 60 seconds to request a new one." });
    return;
  }

  const otp = generateOtp();
  otpStore.set(email, { otp, expires: Date.now() + 5 * 60 * 1000 });

  try {
    await sendOtpEmail(email, otp);
    res.json({ message: "Verification code sent to your email." });
  } catch {
    // Dev mode: no SMTP configured, return OTP directly
    const isDev = process.env.NODE_ENV !== "production";
    if (isDev) {
      res.json({ message: "OTP sent (dev mode).", devOtp: otp });
    } else {
      res.status(500).json({ error: "Failed to send verification email. Please try again." });
    }
  }
});

// ─── POST /auth/verify-otp ────────────────────────────────────────────────
router.post("/auth/verify-otp", async (req, res): Promise<void> => {
  const parsed = z.object({
    email: z.string().email(),
    otp: z.string().length(6, "OTP must be 6 digits"),
  }).safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const { email, otp } = parsed.data;
  const stored = otpStore.get(email);

  if (!stored) {
    res.status(400).json({ error: "No OTP found for this email. Please request a new one." });
    return;
  }
  if (Date.now() > stored.expires) {
    otpStore.delete(email);
    res.status(400).json({ error: "OTP has expired. Please request a new code." });
    return;
  }
  if (stored.otp !== otp) {
    res.status(400).json({ error: "Incorrect code. Please check your email and try again." });
    return;
  }

  // OTP valid — issue a short-lived verification token
  const token = crypto.randomUUID();
  verifiedTokens.set(token, { email, expires: Date.now() + 10 * 60 * 1000 });
  otpStore.delete(email);

  res.json({ verified: true, token });
});

// ─── POST /auth/register ──────────────────────────────────────────────────
router.post("/auth/register", async (req, res): Promise<void> => {
  const BodySchema = z.object({
    username: z.string().min(3, "Username must be at least 3 characters"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    verificationToken: z.string().optional(),
  });

  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const { username, email, password, verificationToken } = parsed.data;

  // Validate verification token if provided
  if (verificationToken) {
    const vtData = verifiedTokens.get(verificationToken);
    if (!vtData || Date.now() > vtData.expires || vtData.email !== email) {
      res.status(400).json({ error: "Email verification expired. Please verify your email again." });
      return;
    }
    verifiedTokens.delete(verificationToken);
  }

  // Always validate email domain
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

  const bonusResult = await pool.query("SELECT value FROM platform_settings WHERE key = $1", ["signup_bonus"]);
  const signupBonus = Math.max(0, Math.round(parseFloat(bonusResult.rows[0]?.value ?? "50000")));
  const bonusStr = signupBonus.toFixed(2);

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db
    .insert(usersTable)
    .values({ username, email, passwordHash, role: "user" })
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
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));

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

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId));

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
