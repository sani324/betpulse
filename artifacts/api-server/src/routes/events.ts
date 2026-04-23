import { Router, type IRouter } from "express";
import { db, eventsTable, betsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import {
  GetEventsQueryParams,
  CreateEventBody,
  GetEventParams,
  UpdateEventParams,
  UpdateEventBody,
  UpdateOddsParams,
  UpdateOddsBody,
} from "@workspace/api-zod";
import { requireAdmin } from "../middlewares/auth";
import { calcOverround, calcImplied } from "../lib/overround";

const router: IRouter = Router();

function formatEvent(e: typeof eventsTable.$inferSelect) {
  const oddsHome = parseFloat(e.oddsHome);
  const oddsDraw = parseFloat(e.oddsDraw);
  const oddsAway = parseFloat(e.oddsAway);
  return {
    id: e.id,
    sport: e.sport,
    league: e.league ?? "",
    homeTeam: e.homeTeam,
    awayTeam: e.awayTeam,
    startTime: e.startTime.toISOString(),
    status: e.status,
    oddsHome,
    oddsDraw,
    oddsAway,
    homeImplied: calcImplied(oddsHome),
    drawImplied: calcImplied(oddsDraw),
    awayImplied: calcImplied(oddsAway),
    overround: calcOverround(oddsHome, oddsDraw, oddsAway),
    homeScore: e.homeScore,
    awayScore: e.awayScore,
    result: e.result,
  };
}

router.get("/events", async (req, res): Promise<void> => {
  const params = GetEventsQueryParams.safeParse(req.query);
  const sport = params.success ? params.data.sport : undefined;
  const status = params.success ? params.data.status : undefined;
  const limit = params.success ? (params.data.limit ?? 20) : 20;

  let query = db.select().from(eventsTable).$dynamic();

  if (sport) {
    query = query.where(eq(eventsTable.sport, sport));
  }
  if (status) {
    query = query.where(eq(eventsTable.status, status));
  }

  const events = await query.limit(limit).orderBy(eventsTable.startTime);
  res.json(events.map(formatEvent));
});

router.post("/events", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { sport, league, homeTeam, awayTeam, startTime, oddsHome, oddsDraw, oddsAway } = parsed.data;

  const [event] = await db
    .insert(eventsTable)
    .values({
      sport,
      league: league ?? null,
      homeTeam,
      awayTeam,
      startTime: new Date(startTime),
      oddsHome: String(oddsHome),
      oddsDraw: String(oddsDraw),
      oddsAway: String(oddsAway),
    })
    .returning();

  res.status(201).json(formatEvent(event));
});

router.get("/events/:eventId", async (req, res): Promise<void> => {
  const params = GetEventParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid event id" });
    return;
  }

  const [event] = await db
    .select()
    .from(eventsTable)
    .where(eq(eventsTable.id, params.data.eventId));

  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const betsAgg = await db
    .select({
      selection: betsTable.selection,
      totalStake: sql<string>`sum(${betsTable.stake})`,
    })
    .from(betsTable)
    .where(eq(betsTable.eventId, params.data.eventId))
    .groupBy(betsTable.selection);

  let totalBetsHome = 0;
  let totalBetsAway = 0;
  let totalBetsDraw = 0;

  for (const row of betsAgg) {
    const amount = parseFloat(row.totalStake ?? "0");
    if (row.selection === "home") totalBetsHome = amount;
    if (row.selection === "away") totalBetsAway = amount;
    if (row.selection === "draw") totalBetsDraw = amount;
  }

  const oddsHome = parseFloat(event.oddsHome);
  const oddsDraw = parseFloat(event.oddsDraw);
  const oddsAway = parseFloat(event.oddsAway);

  const totalLiability =
    totalBetsHome * oddsHome + totalBetsDraw * oddsDraw + totalBetsAway * oddsAway;

  res.json({
    ...formatEvent(event),
    totalBetsHome,
    totalBetsAway,
    totalBetsDraw,
    totalLiability,
  });
});

router.patch("/events/:eventId", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateEventParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid event id" });
    return;
  }

  const parsed = UpdateEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Partial<typeof eventsTable.$inferInsert> = {};
  if (parsed.data.status) updateData.status = parsed.data.status;
  if (parsed.data.homeScore != null) updateData.homeScore = parsed.data.homeScore;
  if (parsed.data.awayScore != null) updateData.awayScore = parsed.data.awayScore;
  if (parsed.data.result) updateData.result = parsed.data.result;

  const [event] = await db
    .update(eventsTable)
    .set(updateData)
    .where(eq(eventsTable.id, params.data.eventId))
    .returning();

  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  res.json(formatEvent(event));
});

router.delete("/events/:eventId/delete", requireAdmin, async (req, res): Promise<void> => {
  const eventId = parseInt(req.params.eventId, 10);
  if (isNaN(eventId)) {
    res.status(400).json({ error: "Invalid event id" });
    return;
  }

  const pendingBetsCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(betsTable)
    .where(eq(betsTable.eventId, eventId));

  if (Number(pendingBetsCount[0]?.count) > 0) {
    res.status(400).json({ error: "Cannot delete event with existing bets" });
    return;
  }

  const [deleted] = await db.delete(eventsTable).where(eq(eventsTable.id, eventId)).returning();

  if (!deleted) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  res.json({ message: "Event deleted successfully" });
});

router.patch("/events/:eventId/odds", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateOddsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid event id" });
    return;
  }

  const parsed = UpdateOddsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [event] = await db
    .update(eventsTable)
    .set({
      oddsHome: String(parsed.data.oddsHome),
      oddsDraw: String(parsed.data.oddsDraw),
      oddsAway: String(parsed.data.oddsAway),
    })
    .where(eq(eventsTable.id, params.data.eventId))
    .returning();

  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  res.json(formatEvent(event));
});

export default router;
