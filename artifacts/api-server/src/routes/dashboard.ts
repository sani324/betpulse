import { Router, type IRouter } from "express";
import { db, betsTable, eventsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { calcOverround, calcImplied } from "../lib/overround";

const router: IRouter = Router();

router.get("/dashboard/stats", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;

  const [stats] = await db
    .select({
      totalBets: sql<number>`count(*)`,
      pendingBets: sql<number>`count(*) filter (where ${betsTable.status} = 'pending')`,
      wonBets: sql<number>`count(*) filter (where ${betsTable.status} = 'won')`,
      lostBets: sql<number>`count(*) filter (where ${betsTable.status} = 'lost')`,
      totalStaked: sql<string>`coalesce(sum(${betsTable.stake}), 0)`,
      totalWon: sql<string>`coalesce(sum(case when ${betsTable.status} = 'won' then ${betsTable.potentialWin} else 0 end), 0)`,
      biggestWin: sql<string>`coalesce(max(case when ${betsTable.status} = 'won' then ${betsTable.potentialWin} else 0 end), 0)`,
    })
    .from(betsTable)
    .where(eq(betsTable.userId, userId));

  const totalBets = Number(stats.totalBets);
  const wonBets = Number(stats.wonBets);
  const lostBets = Number(stats.lostBets);
  const settledBets = wonBets + lostBets;
  const winRate = settledBets > 0 ? (wonBets / settledBets) * 100 : 0;

  res.json({
    totalBets,
    pendingBets: Number(stats.pendingBets),
    wonBets,
    lostBets,
    totalStaked: parseFloat(stats.totalStaked ?? "0"),
    totalWon: parseFloat(stats.totalWon ?? "0"),
    winRate: Math.round(winRate * 100) / 100,
    biggestWin: parseFloat(stats.biggestWin ?? "0"),
  });
});

router.get("/dashboard/live-events", async (req, res): Promise<void> => {
  const liveAndUpcoming = await db
    .select()
    .from(eventsTable)
    .where(sql`${eventsTable.status} in ('live', 'upcoming')`)
    .orderBy(eventsTable.startTime)
    .limit(20);

  const eventIds = liveAndUpcoming.map((e) => e.id);
  const betsAgg =
    eventIds.length > 0
      ? await db
          .select({
            eventId: betsTable.eventId,
            betsCount: sql<number>`count(*)`,
            totalStaked: sql<string>`sum(${betsTable.stake})`,
          })
          .from(betsTable)
          .where(sql`${betsTable.eventId} = ANY(${sql.raw(`ARRAY[${eventIds.join(",")}]`)})`)
          .groupBy(betsTable.eventId)
      : [];

  const betsMap = new Map(betsAgg.map((b) => [b.eventId, b]));

  res.json(
    liveAndUpcoming.map((e) => {
      const agg = betsMap.get(e.id);
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
        betsCount: Number(agg?.betsCount ?? 0),
        totalStaked: parseFloat(agg?.totalStaked ?? "0"),
      };
    }),
  );
});

export default router;
