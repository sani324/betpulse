import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db, pool, usersTable, transactionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  RegisterBody,
  LoginBody,
  GetMeResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { username, email, password } = parsed.data;

  const existing = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email));
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
    // bonusBalance = same as bonus so user cannot withdraw it; only winnings on top are withdrawable
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
