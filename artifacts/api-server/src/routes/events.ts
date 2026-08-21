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

const DEFAULT_MATCHES = [
  { sport: "Cricket", league: "T20 World Cup 2026", homeTeam: "Pakistan", awayTeam: "India", oddsHome: "1.95", oddsDraw: "4.50", oddsAway: "1.85", status: "live", homeScore: "168/4", awayScore: "142/3" },
  { sport: "Cricket", league: "PSL 2026", homeTeam: "Lahore Qalandars", awayTeam: "Karachi Kings", oddsHome: "1.80", oddsDraw: "4.20", oddsAway: "2.05", status: "live", homeScore: "185/5", awayScore: "110/4" },
  { sport: "Cricket", league: "PSL 2026", homeTeam: "Multan Sultans", awayTeam: "Islamabad United", oddsHome: "1.75", oddsDraw: "4.50", oddsAway: "2.15", status: "upcoming", homeScore: null, awayScore: null },
  { sport: "Cricket", league: "Ashes T20", homeTeam: "Australia", awayTeam: "England", oddsHome: "1.70", oddsDraw: "4.80", oddsAway: "2.20", status: "upcoming", homeScore: null, awayScore: null },
  { sport: "Cricket", league: "IPL 2026", homeTeam: "Chennai Super Kings", awayTeam: "Mumbai Indians", oddsHome: "1.85", oddsDraw: "4.10", oddsAway: "1.95", status: "upcoming", homeScore: null, awayScore: null },
  { sport: "Cricket", league: "PSL 2026", homeTeam: "Peshawar Zalmi", awayTeam: "Quetta Gladiators", oddsHome: "1.90", oddsDraw: "4.30", oddsAway: "1.90", status: "upcoming", homeScore: null, awayScore: null },
  { sport: "Football", league: "El Clasico 2026", homeTeam: "Real Madrid", awayTeam: "Barcelona", oddsHome: "2.10", oddsDraw: "3.40", oddsAway: "3.10", status: "live", homeScore: "2", awayScore: "1" },
  { sport: "Football", league: "Premier League", homeTeam: "Manchester City", awayTeam: "Liverpool", oddsHome: "1.95", oddsDraw: "3.60", oddsAway: "3.40", status: "upcoming", homeScore: null, awayScore: null },
  { sport: "Basketball", league: "NBA 2026", homeTeam: "LA Lakers", awayTeam: "Golden State Warriors", oddsHome: "1.85", oddsDraw: "12.00", oddsAway: "1.95", status: "live", homeScore: "98", awayScore: "94" },
];

async function autoEnsureSportsEvents() {
  try {
    const existing = await db.select().from(eventsTable);
    if (existing.length < 4) {
      const now = new Date();
      for (let i = 0; i < DEFAULT_MATCHES.length; i++) {
        const m = DEFAULT_MATCHES[i];
        const startTime = new Date(now.getTime() + (i - 2) * 2 * 60 * 60 * 1000);
        await db.insert(eventsTable).values({
          sport: m.sport,
          league: m.league,
          homeTeam: m.homeTeam,
          awayTeam: m.awayTeam,
          startTime,
          status: m.status,
          oddsHome: m.oddsHome,
          oddsDraw: m.oddsDraw,
          oddsAway: m.oddsAway,
          homeScore: m.homeScore,
          awayScore: m.awayScore,
        });
      }
    }
  } catch (_) {}
}

router.get("/events", async (req, res): Promise<void> => {
  await autoEnsureSportsEvents();
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
  const rawId = req.params.eventId;
  const idStr = Array.isArray(rawId) ? rawId[0] : rawId;
  const eventId = parseInt(idStr, 10);
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
