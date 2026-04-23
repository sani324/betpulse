import { Router, type IRouter } from "express";
import { db, pool, betsTable, eventsTable, usersTable, transactionsTable, withdrawalRequestsTable, depositRequestsTable, paymentSettingsTable } from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import {
  GetAdminBetsQueryParams,
  SettleEventParams,
  SettleEventBody,
} from "@workspace/api-zod";
import { requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

// Ensure platform_settings table exists using the same pool as all other DB operations
pool.query(`
  CREATE TABLE IF NOT EXISTS "platform_settings" (
    "key" varchar(100) PRIMARY KEY,
    "value" text NOT NULL
  );
  INSERT INTO "platform_settings" ("key", "value")
  VALUES ('signup_bonus', '50000')
  ON CONFLICT ("key") DO NOTHING;
`).catch(() => {});

router.get("/admin/dashboard", requireAdmin, async (req, res): Promise<void> => {
  const [stats] = await db
    .select({
      totalBets: sql<number>`count(*)`,
      totalStaked: sql<string>`coalesce(sum(${betsTable.stake}), 0)`,
      totalPaidOut: sql<string>`coalesce(sum(case when ${betsTable.status} = 'won' then ${betsTable.potentialWin} else 0 end), 0)`,
      pendingLiability: sql<string>`coalesce(sum(case when ${betsTable.status} = 'pending' then ${betsTable.potentialWin} else 0 end), 0)`,
    })
    .from(betsTable);

  const [userCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(usersTable);

  const [todayStats] = await db
    .select({
      todayStaked: sql<string>`coalesce(sum(${betsTable.stake}), 0)`,
      todayPaidOut: sql<string>`coalesce(sum(case when ${betsTable.status} = 'won' then ${betsTable.potentialWin} else 0 end), 0)`,
    })
    .from(betsTable)
    .where(sql`${betsTable.createdAt} >= now() - interval '1 day'`);

  const [weekStats] = await db
    .select({
      weekStaked: sql<string>`coalesce(sum(${betsTable.stake}), 0)`,
      weekPaidOut: sql<string>`coalesce(sum(case when ${betsTable.status} = 'won' then ${betsTable.potentialWin} else 0 end), 0)`,
    })
    .from(betsTable)
    .where(sql`${betsTable.createdAt} >= now() - interval '7 days'`);

  const topEvents = await db
    .select({
      eventId: betsTable.eventId,
      totalStaked: sql<string>`sum(${betsTable.stake})`,
    })
    .from(betsTable)
    .groupBy(betsTable.eventId)
    .orderBy(sql`sum(${betsTable.stake}) desc`)
    .limit(5);

  const eventIds = topEvents.map((e) => e.eventId);
  const eventsData =
    eventIds.length > 0
      ? await db
          .select()
          .from(eventsTable)
          .where(sql`${eventsTable.id} = ANY(${sql.raw(`ARRAY[${eventIds.join(",")}]`)})`)
      : [];
  const eventsMap = new Map(eventsData.map((e) => [e.id, e]));

  const totalStaked = parseFloat(stats.totalStaked ?? "0");
  const totalPaidOut = parseFloat(stats.totalPaidOut ?? "0");
  const grossProfit = totalStaked - totalPaidOut;
  const profitMargin = totalStaked > 0 ? (grossProfit / totalStaked) * 100 : 0;

  const todayStaked = parseFloat(todayStats.todayStaked ?? "0");
  const todayPaidOut = parseFloat(todayStats.todayPaidOut ?? "0");
  const weekStaked = parseFloat(weekStats.weekStaked ?? "0");
  const weekPaidOut = parseFloat(weekStats.weekPaidOut ?? "0");

  res.json({
    totalUsers: Number(userCount.count),
    totalBets: Number(stats.totalBets),
    totalStaked,
    totalPaidOut,
    grossProfit,
    profitMargin: Math.round(profitMargin * 100) / 100,
    pendingLiability: parseFloat(stats.pendingLiability ?? "0"),
    todayProfit: todayStaked - todayPaidOut,
    weeklyProfit: weekStaked - weekPaidOut,
    topEvents: topEvents.map((e) => {
      const event = eventsMap.get(e.eventId);
      return {
        eventId: e.eventId,
        eventName: event ? `${event.homeTeam} vs ${event.awayTeam}` : `Event ${e.eventId}`,
        totalStaked: parseFloat(e.totalStaked ?? "0"),
      };
    }),
  });
});

router.get("/admin/bets", requireAdmin, async (req, res): Promise<void> => {
  const params = GetAdminBetsQueryParams.safeParse(req.query);
  const status = params.success ? params.data.status : undefined;
  const limit = params.success ? (params.data.limit ?? 50) : 50;

  const conditions = [];
  if (status) {
    conditions.push(eq(betsTable.status, status));
  }

  const bets = await db
    .select({
      bet: betsTable,
      username: usersTable.username,
    })
    .from(betsTable)
    .leftJoin(usersTable, eq(betsTable.userId, usersTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(sql`${betsTable.createdAt} desc`)
    .limit(limit);

  const eventIds = [...new Set(bets.map((b) => b.bet.eventId))];
  const events =
    eventIds.length > 0
      ? await db
          .select()
          .from(eventsTable)
          .where(sql`${eventsTable.id} = ANY(${sql.raw(`ARRAY[${eventIds.join(",")}]`)})`)
      : [];
  const eventsMap = new Map(events.map((e) => [e.id, e]));

  res.json(
    bets.map(({ bet, username }) => {
      const event = eventsMap.get(bet.eventId);
      const stake = parseFloat(bet.stake);
      const paidOut =
        bet.status === "won" ? parseFloat(bet.potentialWin) : 0;
      return {
        id: bet.id,
        eventId: bet.eventId,
        homeTeam: event?.homeTeam ?? "",
        awayTeam: event?.awayTeam ?? "",
        sport: event?.sport ?? "",
        selection: bet.selection,
        stake,
        odds: parseFloat(bet.odds),
        potentialWin: parseFloat(bet.potentialWin),
        status: bet.status,
        createdAt: bet.createdAt.toISOString(),
        settledAt: bet.settledAt ? bet.settledAt.toISOString() : undefined,
        username: username ?? "",
        profit: bet.status === "pending" ? 0 : stake - paidOut,
      };
    }),
  );
});

router.get("/admin/users", requireAdmin, async (req, res): Promise<void> => {
  const users = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      email: usersTable.email,
      role: usersTable.role,
      balance: usersTable.balance,
      totalDeposited: usersTable.totalDeposited,
      totalWagered: usersTable.totalWagered,
      totalWon: usersTable.totalWon,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .orderBy(sql`${usersTable.createdAt} desc`);

  res.json(users.map(u => ({
    id: u.id,
    username: u.username,
    email: u.email,
    role: u.role,
    balance: parseFloat(u.balance),
    totalDeposited: parseFloat(u.totalDeposited ?? "0"),
    totalWagered: parseFloat(u.totalWagered ?? "0"),
    totalWon: parseFloat(u.totalWon ?? "0"),
    isBlocked: u.isBlocked,
    isFlagged: u.isFlagged,
    createdAt: u.createdAt.toISOString(),
  })));
});

router.post("/admin/users/:userId/adjust", requireAdmin, async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId, 10);
  const { amount, note } = req.body;
  if (!amount || isNaN(Number(amount))) {
    res.status(400).json({ error: "Invalid amount" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const adj = parseFloat(amount);
  const newBalance = Math.max(0, parseFloat(user.balance) + adj);

  await db.update(usersTable).set({ balance: String(newBalance) }).where(eq(usersTable.id, userId));
  await db.insert(transactionsTable).values({
    userId,
    type: adj >= 0 ? "deposit" : "withdrawal",
    amount: String(Math.abs(adj)),
    balanceAfter: String(newBalance),
    description: note || (adj >= 0 ? "Admin credit" : "Admin debit"),
  });

  res.json({ message: "Balance adjusted", newBalance });
});

router.post("/admin/settle/:eventId", requireAdmin, async (req, res): Promise<void> => {
  const params = SettleEventParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid event id" });
    return;
  }

  const parsed = SettleEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { eventId } = params.data;
  const { result } = parsed.data;

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId));
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  await db
    .update(eventsTable)
    .set({ status: "finished", result })
    .where(eq(eventsTable.id, eventId));

  const pendingBets = await db
    .select()
    .from(betsTable)
    .where(and(eq(betsTable.eventId, eventId), eq(betsTable.status, "pending")));

  let totalPaidOut = 0;
  let settledCount = 0;

  for (const bet of pendingBets) {
    const isWinner = bet.selection === result;
    const newStatus = isWinner ? "won" : "lost";
    const payout = isWinner ? parseFloat(bet.potentialWin) : 0;

    await db
      .update(betsTable)
      .set({ status: newStatus, settledAt: new Date() })
      .where(eq(betsTable.id, bet.id));

    if (isWinner && payout > 0) {
      const [user] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, bet.userId));
      if (user) {
        const newBalance = Math.round((parseFloat(user.balance) + payout) * 100) / 100;
        const newTotalWon =
          Math.round((parseFloat(user.totalWon) + payout) * 100) / 100;

        await db
          .update(usersTable)
          .set({ balance: String(newBalance), totalWon: String(newTotalWon) })
          .where(eq(usersTable.id, bet.userId));

        await db.insert(transactionsTable).values({
          userId: bet.userId,
          type: "bet_won",
          amount: String(payout),
          balanceAfter: String(newBalance),
          description: `Won: ${event.homeTeam} vs ${event.awayTeam} — ${result} (x${bet.odds})`,
        });
      }
      totalPaidOut += payout;
    }

    settledCount++;
  }

  const totalStaked = pendingBets.reduce((sum, b) => sum + parseFloat(b.stake), 0);
  const platformProfit = totalStaked - totalPaidOut;

  res.json({
    settledBets: settledCount,
    totalPaidOut,
    platformProfit,
  });
});

router.get("/admin/event-exposure", requireAdmin, async (req, res): Promise<void> => {
  const activeEvents = await db
    .select()
    .from(eventsTable)
    .where(sql`${eventsTable.status} != 'finished'`);

  const results = await Promise.all(
    activeEvents.map(async (event) => {
      const bets = await db
        .select({
          selection: betsTable.selection,
          totalStaked: sql<string>`coalesce(sum(${betsTable.stake}), 0)`,
          totalLiability: sql<string>`coalesce(sum(${betsTable.potentialWin}), 0)`,
          betCount: sql<number>`count(*)`,
        })
        .from(betsTable)
        .where(and(eq(betsTable.eventId, event.id), eq(betsTable.status, "pending")))
        .groupBy(betsTable.selection);

      const bySelection: Record<string, { staked: number; liability: number; count: number }> = {
        home: { staked: 0, liability: 0, count: 0 },
        draw: { staked: 0, liability: 0, count: 0 },
        away: { staked: 0, liability: 0, count: 0 },
      };

      for (const b of bets) {
        if (b.selection in bySelection) {
          bySelection[b.selection] = {
            staked: parseFloat(b.totalStaked),
            liability: parseFloat(b.totalLiability),
            count: Number(b.betCount),
          };
        }
      }

      const totalStaked = bySelection.home.staked + bySelection.draw.staked + bySelection.away.staked;
      const maxLiability = Math.max(
        bySelection.home.liability,
        bySelection.draw.liability,
        bySelection.away.liability,
      );

      return {
        eventId: event.id,
        homeTeam: event.homeTeam,
        awayTeam: event.awayTeam,
        sport: event.sport,
        status: event.status,
        oddsHome: parseFloat(String(event.oddsHome)),
        oddsDraw: parseFloat(String(event.oddsDraw ?? "0")),
        oddsAway: parseFloat(String(event.oddsAway)),
        home: bySelection.home,
        draw: bySelection.draw,
        away: bySelection.away,
        totalStaked,
        maxLiability,
      };
    }),
  );

  results.sort((a, b) => b.totalStaked - a.totalStaked);
  res.json(results);
});

router.get("/admin/deposits", requireAdmin, async (req, res): Promise<void> => {
  const requests = await db
    .select({
      dr: depositRequestsTable,
      username: usersTable.username,
      email: usersTable.email,
    })
    .from(depositRequestsTable)
    .leftJoin(usersTable, eq(depositRequestsTable.userId, usersTable.id))
    .orderBy(sql`${depositRequestsTable.createdAt} desc`);

  res.json(
    requests.map(({ dr, username, email }) => ({
      id: dr.id,
      userId: dr.userId,
      username: username ?? "",
      email: email ?? "",
      amount: parseFloat(dr.amount),
      paymentMethod: dr.paymentMethod,
      transactionRef: dr.transactionRef,
      status: dr.status,
      adminNote: dr.adminNote,
      createdAt: dr.createdAt.toISOString(),
    })),
  );
});

router.post("/admin/deposits/:id/approve", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { adminNote } = req.body;

  const [dr] = await db.select().from(depositRequestsTable).where(eq(depositRequestsTable.id, id));
  if (!dr) {
    res.status(404).json({ error: "Deposit request not found" });
    return;
  }
  if (dr.status !== "pending") {
    res.status(400).json({ error: "Request is not pending" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, dr.userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const amount = parseFloat(dr.amount);
  const newBalance = Math.round((parseFloat(user.balance) + amount) * 100) / 100;
  const newDeposited = Math.round((parseFloat(user.totalDeposited) + amount) * 100) / 100;

  await db.update(usersTable)
    .set({ balance: String(newBalance), totalDeposited: String(newDeposited) })
    .where(eq(usersTable.id, dr.userId));

  await db.insert(transactionsTable).values({
    userId: dr.userId,
    type: "deposit",
    amount: String(amount),
    balanceAfter: String(newBalance),
    description: `Deposit via ${dr.paymentMethod.replace(/_/g, " ").toUpperCase()} — Ref: ${dr.transactionRef}`,
  });

  await db
    .update(depositRequestsTable)
    .set({ status: "approved", adminNote: adminNote || "Deposit approved", updatedAt: new Date() })
    .where(eq(depositRequestsTable.id, id));

  res.json({ message: "Deposit approved and balance credited", newBalance });
});

router.post("/admin/deposits/:id/deny", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { adminNote } = req.body;

  const [dr] = await db.select().from(depositRequestsTable).where(eq(depositRequestsTable.id, id));
  if (!dr) {
    res.status(404).json({ error: "Deposit request not found" });
    return;
  }
  if (dr.status !== "pending") {
    res.status(400).json({ error: "Request is not pending" });
    return;
  }

  await db
    .update(depositRequestsTable)
    .set({ status: "denied", adminNote: adminNote || "Deposit denied", updatedAt: new Date() })
    .where(eq(depositRequestsTable.id, id));

  res.json({ message: "Deposit request denied" });
});

router.get("/admin/withdrawals", requireAdmin, async (req, res): Promise<void> => {
  const requests = await db
    .select({
      wr: withdrawalRequestsTable,
      username: usersTable.username,
      email: usersTable.email,
    })
    .from(withdrawalRequestsTable)
    .leftJoin(usersTable, eq(withdrawalRequestsTable.userId, usersTable.id))
    .orderBy(sql`${withdrawalRequestsTable.createdAt} desc`);

  res.json(
    requests.map(({ wr, username, email }) => ({
      id: wr.id,
      userId: wr.userId,
      username: username ?? "",
      email: email ?? "",
      amount: parseFloat(wr.amount),
      paymentMethod: wr.paymentMethod,
      accountDetails: wr.accountDetails,
      status: wr.status,
      adminNote: wr.adminNote,
      createdAt: wr.createdAt.toISOString(),
    })),
  );
});

router.post("/admin/withdrawals/:id/approve", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { adminNote } = req.body;

  const [wr] = await db.select().from(withdrawalRequestsTable).where(eq(withdrawalRequestsTable.id, id));
  if (!wr) {
    res.status(404).json({ error: "Withdrawal request not found" });
    return;
  }
  if (wr.status !== "pending") {
    res.status(400).json({ error: "Request is not pending" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, wr.userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const amount = parseFloat(wr.amount);
  const currentBalance = parseFloat(user.balance);
  if (currentBalance < amount) {
    res.status(400).json({ error: "User has insufficient balance" });
    return;
  }

  const newBalance = Math.round((currentBalance - amount) * 100) / 100;

  await db.update(usersTable).set({ balance: String(newBalance) }).where(eq(usersTable.id, wr.userId));

  await db.insert(transactionsTable).values({
    userId: wr.userId,
    type: "withdrawal",
    amount: String(amount),
    balanceAfter: String(newBalance),
    description: `Withdrawal via ${wr.paymentMethod.replace("_", " ").toUpperCase()} - ${wr.accountDetails}`,
  });

  await db
    .update(withdrawalRequestsTable)
    .set({ status: "approved", adminNote: adminNote || "Approved by admin", updatedAt: new Date() })
    .where(eq(withdrawalRequestsTable.id, id));

  res.json({ message: "Withdrawal approved and balance deducted", newBalance });
});

router.post("/admin/users/:userId/block", requireAdmin, async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid user id" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  if (user.role === "admin") { res.status(400).json({ error: "Cannot block an admin account" }); return; }

  const newValue = !user.isBlocked;
  await db.update(usersTable).set({ isBlocked: newValue }).where(eq(usersTable.id, userId));
  res.json({ message: newValue ? "User blocked" : "User unblocked", isBlocked: newValue });
});

router.post("/admin/users/:userId/flag", requireAdmin, async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid user id" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const newValue = !user.isFlagged;
  await db.update(usersTable).set({ isFlagged: newValue }).where(eq(usersTable.id, userId));
  res.json({ message: newValue ? "User flagged for fraud review" : "Fraud flag removed", isFlagged: newValue });
});

router.post("/admin/users/:userId/reset-password", requireAdmin, async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid user id" }); return; }

  const { newPassword } = req.body;
  if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
    res.status(400).json({ error: "New password must be at least 6 characters" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, userId));
  res.json({ message: "Password reset successfully" });
});

router.post("/admin/withdrawals/:id/deny", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { adminNote } = req.body;

  const [wr] = await db.select().from(withdrawalRequestsTable).where(eq(withdrawalRequestsTable.id, id));
  if (!wr) {
    res.status(404).json({ error: "Withdrawal request not found" });
    return;
  }
  if (wr.status !== "pending") {
    res.status(400).json({ error: "Request is not pending" });
    return;
  }

  await db
    .update(withdrawalRequestsTable)
    .set({ status: "denied", adminNote: adminNote || "Denied by admin", updatedAt: new Date() })
    .where(eq(withdrawalRequestsTable.id, id));

  res.json({ message: "Withdrawal request denied" });
});

/* ──────────── PAYMENT SETTINGS ──────────── */
const DEFAULT_METHODS = [
  { method: "jazzcash",      label: "JazzCash" },
  { method: "easypaisa",     label: "EasyPaisa" },
  { method: "nayapay",       label: "NayaPay" },
  { method: "bank_transfer", label: "Bank Transfer" },
];

async function ensurePaymentDefaults() {
  for (const m of DEFAULT_METHODS) {
    await db.insert(paymentSettingsTable).values({ method: m.method, label: m.label }).onConflictDoNothing();
  }
}
ensurePaymentDefaults().catch(() => {});

// Public: anyone can fetch payment details to know where to send money
router.get("/payment-settings", async (_req, res): Promise<void> => {
  const rows = await db.select().from(paymentSettingsTable);
  res.json(rows);
});

// Admin: create or update a payment method's account details
router.put("/admin/payment-settings/:method", requireAdmin, async (req, res): Promise<void> => {
  const { method } = req.params;
  const { label, accountName, accountNumber, instructions, isActive } = req.body;
  const resolvedLabel = label ?? DEFAULT_METHODS.find(m => m.method === method)?.label ?? method;
  await db.insert(paymentSettingsTable)
    .values({ method, label: resolvedLabel, accountName: accountName ?? "", accountNumber: accountNumber ?? "", instructions: instructions ?? "", isActive: isActive ?? true })
    .onConflictDoUpdate({
      target: paymentSettingsTable.method,
      set: { label: resolvedLabel, accountName, accountNumber, instructions, isActive, updatedAt: new Date() },
    });
  res.json({ message: "Payment settings updated" });
});

// Admin: permanently delete any payment method
router.delete("/admin/payment-settings/:method", requireAdmin, async (req, res): Promise<void> => {
  const { method } = req.params;
  await db.delete(paymentSettingsTable).where(eq(paymentSettingsTable.method, method));
  res.json({ message: "Payment method deleted" });
});

/* ──────────── GAME OVERRIDE CONTROLS ──────────── */
// In-memory store — shared via module singleton
export const gameOverrides: Map<string, string> = new Map();

router.get("/admin/game-overrides", requireAdmin, (_req, res) => {
  res.json(Object.fromEntries(gameOverrides));
});

router.post("/admin/game-overrides", requireAdmin, (req, res) => {
  const { game, result } = req.body;
  if (!game || !result) { res.status(400).json({ error: "game and result required" }); return; }
  gameOverrides.set(game, result);
  res.json({ message: `Override set: ${game} → ${result}`, overrides: Object.fromEntries(gameOverrides) });
});

router.delete("/admin/game-overrides/:game", requireAdmin, (req, res) => {
  gameOverrides.delete(req.params.game);
  res.json({ message: `Override cleared for ${req.params.game}`, overrides: Object.fromEntries(gameOverrides) });
});

/* ──────────── PLATFORM SETTINGS ──────────── */

// Get a platform setting by key (direct pg pool)
router.get("/admin/platform-settings/:key", requireAdmin, async (req, res): Promise<void> => {
  const { key } = req.params;
  const result = await pool.query("SELECT key, value FROM platform_settings WHERE key = $1", [key]);
  if (result.rows.length === 0) { res.status(404).json({ error: "Setting not found" }); return; }
  res.json(result.rows[0]);
});

// Get all platform settings
router.get("/admin/platform-settings", requireAdmin, async (_req, res): Promise<void> => {
  const result = await pool.query("SELECT key, value FROM platform_settings");
  res.json(result.rows);
});

// Upsert a platform setting (direct pg pool)
router.put("/admin/platform-settings/:key", requireAdmin, async (req, res): Promise<void> => {
  const { key } = req.params;
  const { value } = req.body;
  if (value === undefined || value === null) { res.status(400).json({ error: "value is required" }); return; }
  const v = String(value);
  await pool.query(
    "INSERT INTO platform_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $3",
    [key, v, v]
  );
  res.json({ key, value: v });
});

export default router;

