import { Router, type IRouter } from "express";
import { db, pool, betsTable, eventsTable, usersTable, transactionsTable, casinoBetsTable, withdrawalRequestsTable, depositRequestsTable, paymentSettingsTable } from "@workspace/db";
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

/* ──────────── CASINO ROUNDS (round-based games) ──────────── */
// In-memory rounds. One open round per game key. Bets accumulate until admin
// settles the round by picking a result, at which point all bets pay out
// together and a fresh round opens.
export type CasinoBet = {
  userId: number;
  username: string;
  selection: string;
  stake: number;
  placedAt: string;
  casinoBetId?: number;
};
export type CasinoRound = {
  id: string;
  game: string;            // game key, e.g. "dragon-tiger"
  openedAt: string;
  status: "open" | "settled";
  bets: CasinoBet[];
  result?: string;
  details?: Record<string, unknown>; // e.g. cards drawn
  settledAt?: string;
};

export const casinoOpenRounds: Map<string, CasinoRound> = new Map();
// Keep last settled round per game so user clients can fetch their result.
export const casinoLastSettled: Map<string, CasinoRound> = new Map();

let _roundSeq = 1;
function nextRoundId(game: string) {
  return `${game}-${Date.now()}-${_roundSeq++}`;
}

export function getOrOpenRound(game: string): CasinoRound {
  let r = casinoOpenRounds.get(game);
  if (!r) {
    r = { id: nextRoundId(game), game, openedAt: new Date().toISOString(), status: "open", bets: [] };
    casinoOpenRounds.set(game, r);
  }
  return r;
}

// List all open rounds with bets aggregated per side. Used by the admin UI.
router.get("/admin/casino-rounds", requireAdmin, (_req, res) => {
  const out = Array.from(casinoOpenRounds.values()).map((r) => {
    const sides: Record<string, { selection: string; betCount: number; totalStaked: number; users: { username: string; stake: number }[] }> = {};
    for (const b of r.bets) {
      if (!sides[b.selection]) sides[b.selection] = { selection: b.selection, betCount: 0, totalStaked: 0, users: [] };
      sides[b.selection].betCount += 1;
      sides[b.selection].totalStaked += b.stake;
      sides[b.selection].users.push({ username: b.username, stake: b.stake });
    }
    return {
      id: r.id,
      game: r.game,
      openedAt: r.openedAt,
      totalBets: r.bets.length,
      totalStaked: r.bets.reduce((s, b) => s + b.stake, 0),
      sides: Object.values(sides).sort((a, b) => b.totalStaked - a.totalStaked || b.betCount - a.betCount),
    };
  });
  res.json({ rounds: out });
});

// Settle the current open round of a game with a chosen result.
// Pays out winners (stake * payout multiplier) by updating balances and
// inserting bet_won transactions. Then opens a fresh round.
router.post("/admin/casino-rounds/:game/settle", requireAdmin, async (req, res): Promise<void> => {
  const game = req.params.game;
  const { result } = req.body ?? {};
  if (!result || typeof result !== "string") { res.status(400).json({ error: "result is required" }); return; }

  const round = casinoOpenRounds.get(game);
  if (!round || round.bets.length === 0) {
    // Nothing to settle — but we still record an empty settled round so admin sees feedback.
    const empty: CasinoRound = {
      id: round?.id ?? nextRoundId(game),
      game,
      openedAt: round?.openedAt ?? new Date().toISOString(),
      status: "settled",
      bets: round?.bets ?? [],
      result,
      settledAt: new Date().toISOString(),
    };
    casinoOpenRounds.delete(game);
    casinoLastSettled.set(game, empty);
    getOrOpenRound(game); // open a fresh round
    res.json({ message: "Round settled (no bets)", round: empty });
    return;
  }

  // Determine payout multiplier per game.
  function payoutMultiplier(g: string, sel: string, res2: string): number {
    if (sel !== res2) return 0;
    if (g === "dragon-tiger") return sel === "tie" ? 9 : 2;
    if (g === "coin-flip") return 1.95;
    if (g === "dice-roll") return sel === "seven" ? 5 : 1.9;
    if (g === "rang" || g === "court-piece") return 1.95;
    if (g === "teen-patti") return sel === "pair" ? 11 : 1.95;
    if (g === "lucky-7")    return sel === "seven" ? 5 : 1.95;
    if (g === "jhandi-munda") return 6;
    if (g === "andar-bahar")  return 1.95;
    if (g === "roulette")     return sel === "green" ? 14 : 1.95;
    if (g === "bingo-777")    return sel === "triple7" ? 20 : sel === "bar" ? 5 : 2;
    if (g === "fruit-line")   return sel === "jackpot" ? 10 : sel === "mix" ? 3 : 1.95;
    if (g === "sweet-bonanza") return sel === "bonanza" ? 8 : sel === "scatter" ? 3 : 1.95;
    if (g === "crash")        return sel === "x10" ? 10 : sel === "x5" ? 5 : 2;
    if (g === "joker")        return sel === "joker" ? 9 : 1.95;
    if (g === "ten-cards" || g === "muflis") return 1.95;
    if (g === "blackjack")    return sel === "tie" ? 8 : 1.95;
    if (g === "car-roulette") return sel === "car3" ? 5 : 1.95;
    if (g === "god-of-fortune") return sel === "supreme" ? 10 : sel === "grand" ? 5 : 1.95;
    if (g === "rummy")        return 1.95;
    return 2;
  }

  // Settle each bet: stake was already deducted at bet placement.
  for (const bet of round.bets) {
    const mult = payoutMultiplier(game, bet.selection, result);
    const winAmount = mult > 0 ? Math.round(bet.stake * mult * 100) / 100 : 0;
    if (winAmount <= 0) continue;
    const [u] = await db.select().from(usersTable).where(eq(usersTable.id, bet.userId));
    if (!u) continue;
    const newBal = Math.round((parseFloat(u.balance) + winAmount) * 100) / 100;
    await db.update(usersTable).set({ balance: String(newBal) }).where(eq(usersTable.id, bet.userId));
    await db.insert(transactionsTable).values({
      userId: bet.userId,
      type: "bet_won",
      amount: String(winAmount),
      balanceAfter: String(newBal),
      description: `${prettyGame(game)} round settled — bet ${bet.selection}, result ${result}. Win ₹${winAmount}.`,
    });
  }

  round.status = "settled";
  round.result = result;
  round.settledAt = new Date().toISOString();
  round.details = generateRoundDetails(game, result);
  casinoOpenRounds.delete(game);
  casinoLastSettled.set(game, round);
  getOrOpenRound(game); // open a fresh round immediately
  res.json({ message: "Round settled", round });
});

/* ──────────────────────────────────────────────────────────────
   AUTO-SETTLE MODE — global ON/OFF toggle
   When ON, a server-side interval fires every autoSettleIntervalMs
   and auto-settles every open round that has at least one bet.
   When OFF, only manual settlement works.
────────────────────────────────────────────────────────────── */
let autoSettleModeOn = false;
let autoSettleIntervalMs = 10_000; // 10 seconds default
let autoSettleTimer: ReturnType<typeof setInterval> | null = null;

async function runAutoSettleAll() {
  const games = Array.from(casinoOpenRounds.keys());
  for (const game of games) {
    const round = casinoOpenRounds.get(game);
    if (!round || round.bets.length === 0) continue; // skip empty rounds
    const validOptions = GAME_OPTIONS[game];
    if (!validOptions) continue;
    const betCounts: Record<string, number> = {};
    const betStaked: Record<string, number> = {};
    for (const opt of validOptions) { betCounts[opt] = 0; betStaked[opt] = 0; }
    for (const bet of round.bets) {
      betCounts[bet.selection] = (betCounts[bet.selection] ?? 0) + 1;
      betStaked[bet.selection] = (betStaked[bet.selection] ?? 0) + bet.stake;
    }
    const minCount = Math.min(...validOptions.map(o => betCounts[o]));
    const candidates = validOptions.filter(o => betCounts[o] === minCount);
    const minStaked = Math.min(...candidates.map(o => betStaked[o]));
    const finalCandidates = candidates.filter(o => betStaked[o] === minStaked);
    const result = finalCandidates[Math.floor(Math.random() * finalCandidates.length)];
    try { await settleRoundWith(game, result); } catch (_) {}
  }
}

function startAutoTimer() {
  if (autoSettleTimer) clearInterval(autoSettleTimer);
  autoSettleTimer = setInterval(() => { runAutoSettleAll().catch(() => {}); }, autoSettleIntervalMs);
}

function stopAutoTimer() {
  if (autoSettleTimer) { clearInterval(autoSettleTimer); autoSettleTimer = null; }
}

// GET current auto-settle mode status
router.get("/admin/auto-settle-mode", requireAdmin, (_req, res) => {
  res.json({ enabled: autoSettleModeOn, intervalMs: autoSettleIntervalMs, intervalSec: Math.round(autoSettleIntervalMs / 1000) });
});

// POST to toggle auto-settle mode on or off
router.post("/admin/auto-settle-mode", requireAdmin, (req, res) => {
  const { enabled, intervalSec } = req.body ?? {};
  if (typeof enabled !== "boolean") { res.status(400).json({ error: "enabled (boolean) is required" }); return; }
  if (typeof intervalSec === "number" && intervalSec >= 5) {
    autoSettleIntervalMs = intervalSec * 1000;
  }
  autoSettleModeOn = enabled;
  if (enabled) startAutoTimer(); else stopAutoTimer();
  res.json({ enabled: autoSettleModeOn, intervalMs: autoSettleIntervalMs, intervalSec: Math.round(autoSettleIntervalMs / 1000) });
});

// All valid options per game — used by auto-settle
const GAME_OPTIONS: Record<string, string[]> = {
  "dragon-tiger":   ["dragon", "tiger", "tie"],
  "coin-flip":      ["heads", "tails"],
  "dice-roll":      ["high", "low", "seven"],
  "rang":           ["player", "house"],
  "court-piece":    ["player", "house"],
  "teen-patti":     ["player", "banker", "pair"],
  "lucky-7":        ["under7", "seven", "over7"],
  "jhandi-munda":   ["spade", "heart", "diamond", "club", "star", "moon"],
  "andar-bahar":    ["andar", "bahar"],
  "roulette":       ["red", "black", "green"],
  "bingo-777":      ["triple7", "bar", "cherry"],
  "fruit-line":     ["jackpot", "mix", "plain"],
  "sweet-bonanza":  ["bonanza", "scatter", "base"],
  "crash":          ["x2", "x5", "x10"],
  "joker":          ["player", "banker", "joker"],
  "ten-cards":      ["player", "banker"],
  "muflis":         ["player", "banker"],
  "blackjack":      ["player", "dealer", "tie"],
  "car-roulette":   ["car1", "car2", "car3"],
  "god-of-fortune": ["fortune", "grand", "supreme"],
  "rummy":          ["player", "house"],
};

// Shared settle helper — used by both manual and auto settle.
async function settleRoundWith(game: string, result: string): Promise<{ message: string; round: CasinoRound; autoResult?: string }> {
  function payoutMultiplier(g: string, sel: string, res2: string): number {
    if (sel !== res2) return 0;
    if (g === "dragon-tiger") return sel === "tie" ? 9 : 2;
    if (g === "coin-flip") return 1.95;
    if (g === "dice-roll") return sel === "seven" ? 5 : 1.9;
    if (g === "rang" || g === "court-piece") return 1.95;
    if (g === "teen-patti") return sel === "pair" ? 11 : 1.95;
    if (g === "lucky-7")    return sel === "seven" ? 5 : 1.95;
    if (g === "jhandi-munda") return 6;
    if (g === "andar-bahar")  return 1.95;
    if (g === "roulette")     return sel === "green" ? 14 : 1.95;
    if (g === "bingo-777")    return sel === "triple7" ? 20 : sel === "bar" ? 5 : 2;
    if (g === "fruit-line")   return sel === "jackpot" ? 10 : sel === "mix" ? 3 : 1.95;
    if (g === "sweet-bonanza") return sel === "bonanza" ? 8 : sel === "scatter" ? 3 : 1.95;
    if (g === "crash")        return sel === "x10" ? 10 : sel === "x5" ? 5 : 2;
    if (g === "joker")        return sel === "joker" ? 9 : 1.95;
    if (g === "ten-cards" || g === "muflis") return 1.95;
    if (g === "blackjack")    return sel === "tie" ? 8 : 1.95;
    if (g === "car-roulette") return sel === "car3" ? 5 : 1.95;
    if (g === "god-of-fortune") return sel === "supreme" ? 10 : sel === "grand" ? 5 : 1.95;
    if (g === "rummy")        return 1.95;
    return 2;
  }

  const round = casinoOpenRounds.get(game);
  if (!round || round.bets.length === 0) {
    const empty: CasinoRound = {
      id: round?.id ?? nextRoundId(game),
      game,
      openedAt: round?.openedAt ?? new Date().toISOString(),
      status: "settled",
      bets: round?.bets ?? [],
      result,
      settledAt: new Date().toISOString(),
    };
    casinoOpenRounds.delete(game);
    casinoLastSettled.set(game, empty);
    getOrOpenRound(game);
    return { message: "Round settled (no bets)", round: empty };
  }

  const settledAt = new Date();
  for (const bet of round.bets) {
    const mult = payoutMultiplier(game, bet.selection, result);
    const winAmount = mult > 0 ? Math.round(bet.stake * mult * 100) / 100 : 0;
    const isWon = winAmount > 0;

    // Update casino_bets record with final outcome
    if (bet.casinoBetId) {
      await db.update(casinoBetsTable).set({
        status: isWon ? "won" : "lost",
        result,
        payout: String(isWon ? winAmount : 0),
        settledAt,
      }).where(eq(casinoBetsTable.id, bet.casinoBetId));
    }

    if (!isWon) continue;
    const [u] = await db.select().from(usersTable).where(eq(usersTable.id, bet.userId));
    if (!u) continue;
    const newBal = Math.round((parseFloat(u.balance) + winAmount) * 100) / 100;
    await db.update(usersTable).set({ balance: String(newBal) }).where(eq(usersTable.id, bet.userId));
    await db.insert(transactionsTable).values({
      userId: bet.userId,
      type: "bet_won",
      amount: String(winAmount),
      balanceAfter: String(newBal),
      description: `${prettyGame(game)} round settled — bet ${bet.selection}, result ${result}. Win ₹${winAmount}.`,
    });
  }

  round.status = "settled";
  round.result = result;
  round.settledAt = settledAt.toISOString();
  round.details = generateRoundDetails(game, result);
  casinoOpenRounds.delete(game);
  casinoLastSettled.set(game, round);
  getOrOpenRound(game);
  return { message: "Round settled", round };
}

// AUTO-SETTLE: picks the option with the fewest total bets (house-edge logic).
// If multiple options tie for fewest, picks the one with lowest total staked.
// If nobody has bet on any option, picks a random option from the zeroes.
router.post("/admin/casino-rounds/:game/auto-settle", requireAdmin, async (req, res): Promise<void> => {
  const game = req.params.game;
  const validOptions = GAME_OPTIONS[game];
  if (!validOptions) { res.status(400).json({ error: `Unknown game: ${game}` }); return; }

  const round = casinoOpenRounds.get(game);

  // Count bets & staked per option
  const betCounts: Record<string, number> = {};
  const betStaked: Record<string, number> = {};
  for (const opt of validOptions) { betCounts[opt] = 0; betStaked[opt] = 0; }
  for (const bet of (round?.bets ?? [])) {
    betCounts[bet.selection] = (betCounts[bet.selection] ?? 0) + 1;
    betStaked[bet.selection] = (betStaked[bet.selection] ?? 0) + bet.stake;
  }

  // Find the min bet count
  const minCount = Math.min(...validOptions.map(o => betCounts[o]));
  const candidates = validOptions.filter(o => betCounts[o] === minCount);

  // Among ties, pick the one with least staked; if still tied, pick randomly
  const minStaked = Math.min(...candidates.map(o => betStaked[o]));
  const finalCandidates = candidates.filter(o => betStaked[o] === minStaked);
  const result = finalCandidates[Math.floor(Math.random() * finalCandidates.length)];

  const reason = `Auto: "${result}" had fewest bets (${betCounts[result]}) & lowest staked (₹${betStaked[result].toFixed(0)})`;
  try {
    const out = await settleRoundWith(game, result);
    res.json({ ...out, autoResult: result, reason });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// AUTO-SETTLE ALL: settles every open game in one click.
router.post("/admin/casino-rounds/auto-settle-all", requireAdmin, async (req, res): Promise<void> => {
  const results: { game: string; result: string; reason: string }[] = [];
  const games = Array.from(casinoOpenRounds.keys());
  for (const game of games) {
    const validOptions = GAME_OPTIONS[game];
    if (!validOptions) continue;
    const round = casinoOpenRounds.get(game);
    const betCounts: Record<string, number> = {};
    const betStaked: Record<string, number> = {};
    for (const opt of validOptions) { betCounts[opt] = 0; betStaked[opt] = 0; }
    for (const bet of (round?.bets ?? [])) {
      betCounts[bet.selection] = (betCounts[bet.selection] ?? 0) + 1;
      betStaked[bet.selection] = (betStaked[bet.selection] ?? 0) + bet.stake;
    }
    const minCount = Math.min(...validOptions.map(o => betCounts[o]));
    const candidates = validOptions.filter(o => betCounts[o] === minCount);
    const minStaked = Math.min(...candidates.map(o => betStaked[o]));
    const finalCandidates = candidates.filter(o => betStaked[o] === minStaked);
    const result = finalCandidates[Math.floor(Math.random() * finalCandidates.length)];
    const reason = `${betCounts[result]} bets, ₹${betStaked[result].toFixed(0)} staked`;
    try {
      await settleRoundWith(game, result);
      results.push({ game, result, reason });
    } catch (_) {}
  }
  res.json({ message: `Auto-settled ${results.length} game(s)`, results });
});

// Build game-specific presentation details (cards, dice, etc.) consistent with
// the chosen result, so the user-facing UI can render a believable outcome.
function generateRoundDetails(game: string, result: string): Record<string, unknown> {
  const RANKS = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
  const RANK_VALUES: Record<string, number> = { A:1,"2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"10":10,J:11,Q:12,K:13 };
  const SUITS = ["♠","♥","♦","♣"];
  const card = (r: string, s: string) => ({ rank: r, suit: s, value: RANK_VALUES[r] });
  const randCard = () => { const r = RANKS[Math.floor(Math.random()*RANKS.length)]; return card(r, SUITS[Math.floor(Math.random()*SUITS.length)]); };
  const cardWithMin = (min: number) => { const elig = RANKS.filter(r => RANK_VALUES[r] >= min); const r = elig[Math.floor(Math.random()*elig.length)]; return card(r, SUITS[Math.floor(Math.random()*SUITS.length)]); };
  const cardWithMax = (max: number) => { const elig = RANKS.filter(r => RANK_VALUES[r] <= max); const r = elig[Math.floor(Math.random()*elig.length)]; return card(r, SUITS[Math.floor(Math.random()*SUITS.length)]); };

  if (game === "dragon-tiger") {
    if (result === "dragon") {
      const d = cardWithMin(8);
      const t = cardWithMax(d.value - 1);
      return { dragonCard: d, tigerCard: t };
    }
    if (result === "tiger") {
      const t = cardWithMin(8);
      const d = cardWithMax(t.value - 1);
      return { dragonCard: d, tigerCard: t };
    }
    if (result === "tie") {
      const r = RANKS[Math.floor(Math.random()*RANKS.length)];
      const suits = [...SUITS].sort(() => Math.random() - 0.5);
      return { dragonCard: card(r, suits[0]), tigerCard: card(r, suits[1]) };
    }
  }
  if (game === "coin-flip") return { coin: result };
  if (game === "dice-roll") {
    if (result === "seven") {
      const combos = [[1,6],[2,5],[3,4],[4,3],[5,2],[6,1]];
      const [a,b] = combos[Math.floor(Math.random()*combos.length)];
      return { dice1: a, dice2: b, sum: a+b };
    }
    if (result === "high") {
      const c: [number,number][] = [];
      for (let a=1;a<=6;a++) for (let b=1;b<=6;b++) if (a+b>7) c.push([a,b]);
      const [a,b] = c[Math.floor(Math.random()*c.length)]; return { dice1:a, dice2:b, sum:a+b };
    }
    if (result === "low") {
      const c: [number,number][] = [];
      for (let a=1;a<=6;a++) for (let b=1;b<=6;b++) if (a+b<7) c.push([a,b]);
      const [a,b] = c[Math.floor(Math.random()*c.length)]; return { dice1:a, dice2:b, sum:a+b };
    }
  }
  if (game === "andar-bahar") {
    const joker = randCard();
    const winner = result === "andar" ? "andar" : "bahar";
    const dealtCards: { card: { rank: string; suit: string; value: number }; side: "andar" | "bahar"; isMatch: boolean }[] = [];
    const steps = Math.floor(Math.random() * 5) + 2;
    for (let i = 0; i < steps; i++) {
      const side = (i % 2 === 0 ? "andar" : "bahar") as "andar" | "bahar";
      let c = randCard();
      while (c.rank === joker.rank) c = randCard();
      dealtCards.push({ card: c, side, isMatch: false });
    }
    let lastSide = (steps % 2 === 0 ? "andar" : "bahar") as "andar" | "bahar";
    if (lastSide !== winner) {
      let c = randCard();
      while (c.rank === joker.rank) c = randCard();
      dealtCards.push({ card: c, side: lastSide, isMatch: false });
      lastSide = lastSide === "andar" ? "bahar" : "andar";
    }
    const matchSuit = SUITS[Math.floor(Math.random() * SUITS.length)];
    dealtCards.push({ card: card(joker.rank, matchSuit), side: winner, isMatch: true });
    return { joker, dealtCards, winner };
  }
  if (game === "rang" || game === "court-piece") {
    // Build a random deck and deal until natural winner matches the chosen result.
    const RR = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
    const VV: Record<string, number> = { "2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"10":10,J:11,Q:12,K:13,A:14 };
    function buildDeck() {
      const d: { rank: string; suit: string; value: number }[] = [];
      for (const s of SUITS) for (const r of RR) d.push({ rank: r, suit: s, value: VV[r] });
      for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
      return d;
    }
    const COURT_R = ["J", "Q", "K", "A"];
    for (let attempt = 0; attempt < 200; attempt++) {
      const d = buildDeck();
      if (game === "rang") {
        const trumpCard = d[0];
        const trumpSuit = trumpCard.suit;
        const playerHand = [d[1], d[3], d[5], d[7], d[9]].map(c => ({ ...c, isTrump: c.suit === trumpSuit }));
        const houseHand  = [d[2], d[4], d[6], d[8], d[10]].map(c => ({ ...c, isTrump: c.suit === trumpSuit }));
        const tricks: { playerCard: typeof playerHand[0]; houseCard: typeof houseHand[0]; winner: "player" | "house" | "draw" }[] = [];
        let pT = 0, hT = 0;
        for (let i = 0; i < 5; i++) {
          const pc = playerHand[i], hc = houseHand[i];
          let w: "player" | "house" | "draw";
          if (pc.isTrump && !hc.isTrump) w = "player";
          else if (!pc.isTrump && hc.isTrump) w = "house";
          else if (pc.value > hc.value) w = "player";
          else if (hc.value > pc.value) w = "house";
          else w = "draw";
          if (w === "player") pT++; else if (w === "house") hT++;
          tricks.push({ playerCard: pc, houseCard: hc, winner: w });
        }
        const natural = pT >= hT ? "player" : "house";
        if (natural === result) {
          return { trumpSuit, trumpCard, playerHand, houseHand, tricks, playerTricks: pT, houseTricks: hT, winner: result };
        }
      } else {
        const playerHand = [d[0], d[2], d[4], d[6], d[8]];
        const houseHand  = [d[1], d[3], d[5], d[7], d[9]];
        const playerCourt = playerHand.filter(c => COURT_R.includes(c.rank)).length;
        const houseCourt  = houseHand.filter(c => COURT_R.includes(c.rank)).length;
        const playerTotal = playerHand.reduce((s, c) => s + c.value, 0);
        const houseTotal  = houseHand.reduce((s, c) => s + c.value, 0);
        let natural: "player" | "house";
        if (playerCourt > houseCourt) natural = "player";
        else if (houseCourt > playerCourt) natural = "house";
        else natural = playerTotal >= houseTotal ? "player" : "house";
        if (natural === result) {
          return { playerHand, houseHand, playerCourt, houseCourt, playerTotal, houseTotal, winner: result };
        }
      }
    }
    return { winner: result };
  }
  if (game === "code-piece") {
    let n: number;
    if (result === "small") n = Math.floor(Math.random() * 5);
    else if (result === "big") n = 5 + Math.floor(Math.random() * 5);
    else { const d = parseInt(result, 10); n = isNaN(d) ? 0 : d; }
    return { number: n, isSmall: n < 5, isBig: n >= 5 };
  }
  if (game === "teen-patti") {
    // Deal 3 cards to player and banker; adjust so the chosen side has higher value hand
    function hand3() { return [randCard(), randCard(), randCard()]; }
    function handValue(h: ReturnType<typeof hand3>) { return h.reduce((s, c) => s + c.value, 0); }
    if (result === "pair") {
      const rank = RANKS[Math.floor(Math.random() * RANKS.length)];
      const s1 = SUITS[Math.floor(Math.random() * SUITS.length)];
      const s2 = SUITS.filter(s => s !== s1)[Math.floor(Math.random() * 3)];
      const playerCards = [card(rank, s1), card(rank, s2), randCard()];
      const bankerCards = [randCard(), randCard(), randCard()];
      return { playerCards, bankerCards, result: "pair", winner: "pair" };
    }
    for (let attempt = 0; attempt < 100; attempt++) {
      const pCards = hand3(); const bCards = hand3();
      const pVal = handValue(pCards); const bVal = handValue(bCards);
      if (result === "player" && pVal > bVal) return { playerCards: pCards, bankerCards: bCards, playerValue: pVal, bankerValue: bVal, winner: "player" };
      if (result === "banker" && bVal > pVal) return { playerCards: pCards, bankerCards: bCards, playerValue: pVal, bankerValue: bVal, winner: "banker" };
    }
    const pCards = hand3(); const bCards = hand3();
    return { playerCards: pCards, bankerCards: bCards, winner: result };
  }
  if (game === "lucky-7") {
    if (result === "seven") {
      const combos: [number,number][] = [[1,6],[2,5],[3,4],[4,3],[5,2],[6,1]];
      const [a,b] = combos[Math.floor(Math.random()*combos.length)];
      return { dice1: a, dice2: b, sum: 7, result: "seven" };
    }
    if (result === "over7") {
      const c: [number,number][] = [];
      for (let a=1;a<=6;a++) for (let b=1;b<=6;b++) if (a+b>7) c.push([a,b]);
      const [a,b] = c[Math.floor(Math.random()*c.length)];
      return { dice1: a, dice2: b, sum: a+b, result: "over7" };
    }
    if (result === "under7") {
      const c: [number,number][] = [];
      for (let a=1;a<=6;a++) for (let b=1;b<=6;b++) if (a+b<7) c.push([a,b]);
      const [a,b] = c[Math.floor(Math.random()*c.length)];
      return { dice1: a, dice2: b, sum: a+b, result: "under7" };
    }
  }
  if (game === "jhandi-munda") {
    const symbols = ["spade","heart","diamond","club","star","moon"];
    // Roll 6 dice, with the result symbol guaranteed to appear at least once
    const dice: string[] = [result]; // guarantee one
    for (let i = 1; i < 6; i++) dice.push(symbols[Math.floor(Math.random() * symbols.length)]);
    // Shuffle
    for (let i = dice.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i+1)); [dice[i], dice[j]] = [dice[j], dice[i]]; }
    const counts: Record<string, number> = {};
    for (const s of dice) counts[s] = (counts[s] || 0) + 1;
    return { dice, counts, result };
  }
  return { result };
}

function prettyGame(key: string): string {
  return ({
    "dragon-tiger":  "Dragon Tiger",
    "coin-flip":     "Coin Flip",
    "dice-roll":     "Dice Roll",
    "rang":           "Rang",
    "court-piece":    "Court Piece",
    "teen-patti":     "Teen Patti",
    "lucky-7":        "Lucky 7",
    "jhandi-munda":   "Jhandi Munda",
    "andar-bahar":    "Andar Bahar",
    "roulette":       "Roulette",
    "bingo-777":      "Bingo 777",
    "fruit-line":     "Fruit Line",
    "sweet-bonanza":  "Sweet Bonanza",
    "crash":          "Crash",
    "joker":          "Joker",
    "ten-cards":      "10 Cards",
    "muflis":         "Muflis",
    "blackjack":      "Blackjack",
    "car-roulette":   "Car Roulette",
    "god-of-fortune": "God of Fortune",
    "rummy":          "Rummy",
  } as Record<string, string>)[key] ?? key;
}

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

/* ──────────── CASINO LIVE BET STATS ──────────── */
// Aggregates recent casino game bets per game per side by parsing transactions.
// Lets the admin see in real time how many users have wagered on each side
// (e.g. Tiger vs Dragon) so they can decide whether to set a game override.
router.get("/admin/casino-stats", requireAdmin, async (req, res): Promise<void> => {
  const minutes = Math.max(1, Math.min(1440, parseInt(String(req.query.minutes ?? "60"), 10) || 60));
  const since = new Date(Date.now() - minutes * 60 * 1000);

  // Pull recent casino transactions (bet_placed / bet_won where description contains "—")
  const rows = await db
    .select({
      id: transactionsTable.id,
      userId: transactionsTable.userId,
      username: usersTable.username,
      type: transactionsTable.type,
      amount: transactionsTable.amount,
      description: transactionsTable.description,
      createdAt: transactionsTable.createdAt,
    })
    .from(transactionsTable)
    .leftJoin(usersTable, eq(transactionsTable.userId, usersTable.id))
    .where(
      and(
        sql`${transactionsTable.createdAt} >= ${since}`,
        sql`${transactionsTable.description} ~ '^(Dragon Tiger|Coin Flip|Dice Roll|Rang|Court Piece|Teen Patti|Lucky 7|Jhandi Munda|Andar Bahar|Roulette|Bingo 777|Fruit Line|Sweet Bonanza|Crash|Joker|10 Cards|Muflis|Blackjack|Car Roulette|God of Fortune|Rummy) '`,
      ),
    );

  type Side = { selection: string; betCount: number; totalStaked: number; users: { username: string; stake: number; result: string; when: string }[] };
  type Game = { game: string; key: string; sides: Record<string, Side>; totalBets: number; totalStaked: number; override: string | null };

  const games: Record<string, Game> = {};
  const KEY_BY_NAME: Record<string, string> = {
    "Dragon Tiger": "dragon-tiger",
    "Coin Flip": "coin-flip",
    "Dice Roll": "dice-roll",
    "Rang": "rang",
    "Court Piece": "court-piece",
    "Andar Bahar": "andar-bahar",
    "Roulette": "roulette",
    "Bingo 777": "bingo-777",
    "Fruit Line": "fruit-line",
    "Sweet Bonanza": "sweet-bonanza",
    "Crash": "crash",
    "Joker": "joker",
    "10 Cards": "ten-cards",
    "Muflis": "muflis",
    "Blackjack": "blackjack",
    "Car Roulette": "car-roulette",
    "God of Fortune": "god-of-fortune",
    "Rummy": "rummy",
  };

  for (const r of rows) {
    // Description format: "<Game> — bet <selection>, ...". Estimate stake from
    // amount: bet_placed amount = stake; bet_won amount = net win, so stake is unknown
    // here — we still count the bet, and approximate stake as the amount for placed bets.
    const m = r.description.match(/^(Dragon Tiger|Coin Flip|Dice Roll|Rang|Court Piece|Teen Patti|Lucky 7|Jhandi Munda|Andar Bahar|Roulette|Bingo 777|Fruit Line|Sweet Bonanza|Crash|Joker|10 Cards|Muflis|Blackjack|Car Roulette|God of Fortune|Rummy)\s+—\s+bet\s+([a-zA-Z0-9_-]+)(?:,\s+result\s+([a-zA-Z0-9_-]+))?/);
    if (!m) continue;
    const gameName = m[1];
    const selection = m[2];
    const result = m[3] ?? "";
    const key = KEY_BY_NAME[gameName];
    if (!games[gameName]) {
      games[gameName] = {
        game: gameName,
        key,
        sides: {},
        totalBets: 0,
        totalStaked: 0,
        override: gameOverrides.get(key) ?? null,
      };
    }
    const g = games[gameName];
    if (!g.sides[selection]) g.sides[selection] = { selection, betCount: 0, totalStaked: 0, users: [] };
    const side = g.sides[selection];
    const stake = r.type === "bet_placed" ? parseFloat(r.amount) : 0;
    side.betCount += 1;
    side.totalStaked += stake;
    g.totalBets += 1;
    g.totalStaked += stake;
    if (side.users.length < 8) {
      side.users.push({
        username: r.username ?? `user#${r.userId}`,
        stake,
        result,
        when: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
      });
    }
  }

  const out = Object.values(games)
    .map((g) => ({
      ...g,
      sides: Object.values(g.sides).sort((a, b) => b.totalStaked - a.totalStaked || b.betCount - a.betCount),
    }))
    .sort((a, b) => b.totalStaked - a.totalStaked || b.totalBets - a.totalBets);

  res.json({ minutes, since: since.toISOString(), games: out });
});

/* ──────────── PLATFORM SETTINGS ──────────── */

// Get a platform setting by key (direct pg pool)
router.get("/admin/platform-settings/:key", requireAdmin, async (req, res): Promise<void> => {
  const { key } = req.params;
  const result = await pool.query("SELECT key, value FROM platform_settings WHERE key = $1", [key]);
  if (result.rows.length === 0) { res.status(404).json({ error: "Setting not found" }); return; }
  res.json(result.rows[0]);
});

// ─── GET /admin/reports ───────────────────────────────────────────────────────
router.get("/admin/reports", requireAdmin, async (req, res): Promise<void> => {
  const period = String(req.query.period ?? "daily");
  const intervalMap: Record<string, string> = { daily: "1 day", weekly: "7 days", monthly: "30 days" };
  const interval = intervalMap[period] ?? "1 day";

  // Overall summary
  const summaryRes = await pool.query(`
    SELECT
      COUNT(*)::int                                                                              AS total_bets,
      COALESCE(SUM(stake), 0)::numeric                                                           AS total_staked,
      COALESCE(SUM(CASE WHEN status='won' THEN payout ELSE 0 END), 0)::numeric                   AS total_paid_out,
      COALESCE(SUM(CASE WHEN status='lost' THEN stake ELSE 0 END), 0)::numeric                   AS player_losses,
      COALESCE(SUM(stake) - SUM(CASE WHEN status='won' THEN payout ELSE 0 END), 0)::numeric      AS house_earnings,
      COUNT(CASE WHEN status='won' THEN 1 END)::int                                              AS winning_bets,
      COUNT(CASE WHEN status='lost' THEN 1 END)::int                                             AS losing_bets,
      COUNT(DISTINCT user_id)::int                                                               AS unique_players
    FROM casino_bets
    WHERE status != 'pending'
      AND created_at >= NOW() - INTERVAL '${interval}'
  `);

  // Per-game breakdown
  const gameRes = await pool.query(`
    SELECT
      game_name                                                                                   AS "gameName",
      COUNT(*)::int                                                                              AS "totalBets",
      COALESCE(SUM(stake), 0)::numeric                                                           AS "totalStaked",
      COALESCE(SUM(CASE WHEN status='won' THEN payout ELSE 0 END), 0)::numeric                   AS "totalPaidOut",
      COALESCE(SUM(stake) - SUM(CASE WHEN status='won' THEN payout ELSE 0 END), 0)::numeric      AS "houseEarnings",
      COUNT(CASE WHEN status='won' THEN 1 END)::int                                              AS "winningBets",
      COUNT(CASE WHEN status='lost' THEN 1 END)::int                                             AS "losingBets"
    FROM casino_bets
    WHERE status != 'pending'
      AND created_at >= NOW() - INTERVAL '${interval}'
    GROUP BY game_name
    ORDER BY "houseEarnings" DESC
  `);

  // Top 10 winners (players with highest net profit)
  const topWinnersRes = await pool.query(`
    SELECT
      u.username,
      COUNT(cb.id)::int                                                                          AS "totalBets",
      COALESCE(SUM(cb.stake), 0)::numeric                                                        AS "totalStaked",
      COALESCE(SUM(CASE WHEN cb.status='won' THEN cb.payout ELSE 0 END), 0)::numeric             AS "totalWon",
      COALESCE(SUM(CASE WHEN cb.status='lost' THEN cb.stake ELSE 0 END), 0)::numeric             AS "totalLost",
      COALESCE(SUM(CASE WHEN cb.status='won' THEN cb.payout ELSE 0 END) - SUM(cb.stake), 0)::numeric AS "netProfit"
    FROM casino_bets cb
    JOIN users u ON cb.user_id = u.id
    WHERE cb.status != 'pending'
      AND cb.created_at >= NOW() - INTERVAL '${interval}'
    GROUP BY u.id, u.username
    ORDER BY "netProfit" DESC
    LIMIT 10
  `);

  // Top 10 losers (players with highest net loss)
  const topLosersRes = await pool.query(`
    SELECT
      u.username,
      COUNT(cb.id)::int                                                                          AS "totalBets",
      COALESCE(SUM(cb.stake), 0)::numeric                                                        AS "totalStaked",
      COALESCE(SUM(CASE WHEN cb.status='won' THEN cb.payout ELSE 0 END), 0)::numeric             AS "totalWon",
      COALESCE(SUM(CASE WHEN cb.status='lost' THEN cb.stake ELSE 0 END), 0)::numeric             AS "totalLost",
      COALESCE(SUM(cb.stake) - SUM(CASE WHEN cb.status='won' THEN cb.payout ELSE 0 END), 0)::numeric AS "netLoss"
    FROM casino_bets cb
    JOIN users u ON cb.user_id = u.id
    WHERE cb.status != 'pending'
      AND cb.created_at >= NOW() - INTERVAL '${interval}'
    GROUP BY u.id, u.username
    ORDER BY "netLoss" DESC
    LIMIT 10
  `);

  // Day-by-day breakdown (for chart)
  const buckets = period === "daily" ? 24 : period === "weekly" ? 7 : 30;
  const bucketInterval = period === "daily" ? "1 hour" : "1 day";
  const dailyRes = await pool.query(`
    SELECT
      date_trunc('${period === "daily" ? "hour" : "day"}', created_at)  AS "bucket",
      COALESCE(SUM(stake), 0)::numeric                                   AS "staked",
      COALESCE(SUM(CASE WHEN status='won' THEN payout ELSE 0 END), 0)::numeric AS "paidOut",
      COALESCE(SUM(stake) - SUM(CASE WHEN status='won' THEN payout ELSE 0 END), 0)::numeric AS "houseEarnings",
      COUNT(*)::int                                                      AS "bets"
    FROM casino_bets
    WHERE status != 'pending'
      AND created_at >= NOW() - INTERVAL '${interval}'
    GROUP BY 1
    ORDER BY 1
  `);

  res.json({
    period,
    summary: summaryRes.rows[0] ?? {},
    gameBreakdown: gameRes.rows,
    topWinners: topWinnersRes.rows,
    topLosers: topLosersRes.rows,
    timeline: dailyRes.rows,
  });
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

