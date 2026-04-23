import { Router, type IRouter } from "express";
import { db, betsTable, eventsTable, usersTable, transactionsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import {
  GetBetsQueryParams,
  PlaceBetBody,
  GetBetParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

function formatBet(
  b: typeof betsTable.$inferSelect,
  event?: typeof eventsTable.$inferSelect | null,
) {
  return {
    id: b.id,
    eventId: b.eventId,
    homeTeam: event?.homeTeam ?? "",
    awayTeam: event?.awayTeam ?? "",
    sport: event?.sport ?? "",
    selection: b.selection,
    stake: parseFloat(b.stake),
    odds: parseFloat(b.odds),
    potentialWin: parseFloat(b.potentialWin),
    status: b.status,
    createdAt: b.createdAt.toISOString(),
    settledAt: b.settledAt ? b.settledAt.toISOString() : undefined,
  };
}

router.get("/bets", requireAuth, async (req, res): Promise<void> => {
  const params = GetBetsQueryParams.safeParse(req.query);
  const status = params.success ? params.data.status : undefined;
  const limit = params.success ? (params.data.limit ?? 20) : 20;
  const userId = req.session.userId!;

  const conditions = [eq(betsTable.userId, userId)];
  if (status) {
    conditions.push(eq(betsTable.status, status));
  }

  const bets = await db
    .select()
    .from(betsTable)
    .where(and(...conditions))
    .orderBy(sql`${betsTable.createdAt} desc`)
    .limit(limit);

  const eventIds = [...new Set(bets.map((b) => b.eventId))];
  const events =
    eventIds.length > 0
      ? await db
          .select()
          .from(eventsTable)
          .where(sql`${eventsTable.id} = ANY(${sql.raw(`ARRAY[${eventIds.join(",")}]`)})`)
      : [];
  const eventsMap = new Map(events.map((e) => [e.id, e]));

  res.json(bets.map((b) => formatBet(b, eventsMap.get(b.eventId))));
});

router.post("/bets", requireAuth, async (req, res): Promise<void> => {
  const parsed = PlaceBetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { eventId, selection, stake } = parsed.data;
  const userId = req.session.userId!;

  if (stake <= 0) {
    res.status(400).json({ error: "Stake must be greater than 0" });
    return;
  }

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId));
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  if (event.status !== "upcoming" && event.status !== "live") {
    res.status(400).json({ error: "Event is not open for betting" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const balance = parseFloat(user.balance);
  if (balance < stake) {
    res.status(400).json({ error: "Insufficient balance" });
    return;
  }

  let odds: number;
  if (selection === "home") odds = parseFloat(event.oddsHome);
  else if (selection === "draw") odds = parseFloat(event.oddsDraw);
  else odds = parseFloat(event.oddsAway);

  const potentialWin = Math.round(stake * odds * 100) / 100;
  const newBalance = Math.round((balance - stake) * 100) / 100;

  await db
    .update(usersTable)
    .set({
      balance: String(newBalance),
      totalWagered: String(
        Math.round((parseFloat(user.totalWagered) + stake) * 100) / 100,
      ),
    })
    .where(eq(usersTable.id, userId));

  const [bet] = await db
    .insert(betsTable)
    .values({
      userId,
      eventId,
      selection,
      stake: String(stake),
      odds: String(odds),
      potentialWin: String(potentialWin),
    })
    .returning();

  await db.insert(transactionsTable).values({
    userId,
    type: "bet_placed",
    amount: String(-stake),
    balanceAfter: String(newBalance),
    description: `Bet on ${event.homeTeam} vs ${event.awayTeam} — ${selection}`,
  });

  res.status(201).json(formatBet(bet, event));
});

router.get("/bets/:betId", requireAuth, async (req, res): Promise<void> => {
  const params = GetBetParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid bet id" });
    return;
  }

  const userId = req.session.userId!;
  const [bet] = await db
    .select()
    .from(betsTable)
    .where(and(eq(betsTable.id, params.data.betId), eq(betsTable.userId, userId)));

  if (!bet) {
    res.status(404).json({ error: "Bet not found" });
    return;
  }

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, bet.eventId));
  res.json(formatBet(bet, event));
});

export default router;
