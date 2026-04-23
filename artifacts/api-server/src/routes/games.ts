import { Router, type IRouter } from "express";
import { db, usersTable, transactionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { gameOverrides, casinoOpenRounds, casinoLastSettled, getOrOpenRound } from "./admin";
void gameOverrides; // legacy override map kept for non-round games (none currently)

const router: IRouter = Router();

/* ─── Round-based bet placement ──────────────────────────────────────
   All casino games share the same round-based flow:
   1. POST /games/<game> { stake, selection } → queue bet, deduct stake.
   2. Admin settles via POST /admin/casino-rounds/<game>/settle { result }.
   3. Client polls GET /games/casino-round/<game>/<roundId> until status === "settled".
*/
async function queueRoundBet(
  req: import("express").Request,
  res: import("express").Response,
  game: string,
  validSelections: readonly string[],
): Promise<void> {
  const { stake, selection } = req.body ?? {};
  if (typeof stake !== "number" || stake <= 0) { res.status(400).json({ error: "Stake must be a positive number" }); return; }
  if (typeof selection !== "string" || !validSelections.includes(selection)) {
    res.status(400).json({ error: `Selection must be one of: ${validSelections.join(", ")}` }); return;
  }

  const userId = req.session.userId!;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  const balance = parseFloat(user.balance);
  if (balance < stake) { res.status(400).json({ error: "Insufficient balance" }); return; }

  const newBalance = Math.round((balance - stake) * 100) / 100;
  await db.update(usersTable).set({
    balance: String(newBalance),
    totalWagered: String(Math.round((parseFloat(user.totalWagered) + stake) * 100) / 100),
  }).where(eq(usersTable.id, userId));
  await db.insert(transactionsTable).values({
    userId,
    type: "bet_placed",
    amount: String(stake),
    balanceAfter: String(newBalance),
    description: `${game} — bet ${selection} (round pending)`,
  });

  const round = getOrOpenRound(game);
  round.bets.push({
    userId,
    username: user.username,
    selection,
    stake,
    placedAt: new Date().toISOString(),
  });

  res.json({ status: "pending", roundId: round.id, selection, stake, newBalance });
}

// Generic poll endpoint used by all casino games.
router.get("/games/casino-round/:game/:roundId", requireAuth, (req, res): void => {
  const { game, roundId } = req.params;
  const open = casinoOpenRounds.get(game);
  if (open && open.id === roundId) {
    res.json({ status: "pending", roundId });
    return;
  }
  const last = casinoLastSettled.get(game);
  if (last && last.id === roundId) {
    res.json({
      status: "settled",
      roundId: last.id,
      result: last.result,
      details: last.details ?? null,
      settledAt: last.settledAt,
    });
    return;
  }
  res.status(404).json({ error: "Round not found (server may have restarted)" });
});

/* ─── Helpers ─── */
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const RANK_VALUES: Record<string, number> = {
  A: 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7,
  "8": 8, "9": 9, "10": 10, J: 11, Q: 12, K: 13,
};
const SUITS = ["♠", "♥", "♦", "♣"];

function dealCard() {
  const rank = RANKS[Math.floor(Math.random() * RANKS.length)];
  const suit = SUITS[Math.floor(Math.random() * SUITS.length)];
  return { rank, suit, value: RANK_VALUES[rank] };
}
function dealCardWithMinValue(min: number) {
  const eligible = RANKS.filter(r => RANK_VALUES[r] >= min);
  const rank = eligible[Math.floor(Math.random() * eligible.length)];
  const suit = SUITS[Math.floor(Math.random() * SUITS.length)];
  return { rank, suit, value: RANK_VALUES[rank] };
}
function dealCardWithMaxValue(max: number) {
  const eligible = RANKS.filter(r => RANK_VALUES[r] <= max);
  const rank = eligible[Math.floor(Math.random() * eligible.length)];
  const suit = SUITS[Math.floor(Math.random() * SUITS.length)];
  return { rank, suit, value: RANK_VALUES[rank] };
}

async function deductAndRecord(userId: number, stake: number, won: boolean, winAmount: number, description: string) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) return null;
  const balance = parseFloat(user.balance);
  if (balance < stake) return null;
  const netChange = winAmount - stake;
  const newBalance = Math.round((balance + netChange) * 100) / 100;
  await db.update(usersTable).set({
    balance: String(newBalance),
    totalWagered: String(Math.round((parseFloat(user.totalWagered) + stake) * 100) / 100),
  }).where(eq(usersTable.id, userId));
  await db.insert(transactionsTable).values({
    userId,
    type: won ? "bet_won" : "bet_placed",
    amount: String(Math.abs(netChange)),
    balanceAfter: String(newBalance),
    description,
  });
  return { balance, newBalance, netChange, winAmount };
}


/* ──────────────── ROUND-BASED CASINO GAMES ────────────────
   All game POSTs queue a bet into the current open round and return
   { roundId }. The client polls /games/casino-round/:game/:roundId.
   Admin settles via /admin/casino-rounds/:game/settle which generates
   game-specific details (cards/dice/hands) consistent with the chosen
   result and pays out winners. */

router.post("/games/dragon-tiger",  requireAuth, (req, res) => queueRoundBet(req, res, "dragon-tiger",  ["dragon", "tiger", "tie"]));
router.post("/games/coin-flip",     requireAuth, (req, res) => queueRoundBet(req, res, "coin-flip",     ["heads", "tails"]));
router.post("/games/dice-roll",     requireAuth, (req, res) => queueRoundBet(req, res, "dice-roll",     ["high", "low", "seven"]));
router.post("/games/rang",          requireAuth, (req, res) => queueRoundBet(req, res, "rang",          ["player", "house"]));
router.post("/games/court-piece",   requireAuth, (req, res) => queueRoundBet(req, res, "court-piece",   ["player", "house"]));
// New games
router.post("/games/teen-patti",    requireAuth, (req, res) => queueRoundBet(req, res, "teen-patti",    ["player", "banker", "pair"]));
router.post("/games/lucky-7",       requireAuth, (req, res) => queueRoundBet(req, res, "lucky-7",       ["under7", "seven", "over7"]));
router.post("/games/jhandi-munda",  requireAuth, (req, res) => queueRoundBet(req, res, "jhandi-munda",  ["spade", "heart", "diamond", "club", "star", "moon"]));

export default router;
