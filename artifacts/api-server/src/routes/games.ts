import { Router, type IRouter } from "express";
import { db, usersTable, transactionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { gameOverrides, casinoOpenRounds, casinoLastSettled, getOrOpenRound } from "./admin";

const router: IRouter = Router();

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

/* ──────────────── DRAGON TIGER (round-based) ──────────────── */
// Round-based flow:
// 1. POST /games/dragon-tiger queues the bet into the current open round.
//    Stake is deducted immediately so users can't double-spend.
// 2. Admin sees live bets per side in the admin panel and chooses the result
//    via POST /admin/casino-rounds/dragon-tiger/settle.
// 3. Client polls GET /games/dragon-tiger/round/:roundId for the result and
//    shows cards/animation when the round becomes "settled".
router.post("/games/dragon-tiger", requireAuth, async (req, res): Promise<void> => {
  const { stake, selection } = req.body;
  if (typeof stake !== "number" || stake <= 0) { res.status(400).json({ error: "Stake must be a positive number" }); return; }
  if (!["dragon", "tiger", "tie"].includes(selection)) { res.status(400).json({ error: "Selection must be dragon, tiger, or tie" }); return; }

  const userId = req.session.userId!;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  const balance = parseFloat(user.balance);
  if (balance < stake) { res.status(400).json({ error: "Insufficient balance" }); return; }

  // Deduct stake immediately and record bet_placed.
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
    description: `Dragon Tiger — bet ${selection} (round pending)`,
  });

  // Add to current open round.
  const round = getOrOpenRound("dragon-tiger");
  round.bets.push({
    userId,
    username: user.username,
    selection,
    stake,
    placedAt: new Date().toISOString(),
  });

  res.json({
    status: "pending",
    roundId: round.id,
    selection,
    stake,
    newBalance,
    message: "Bet placed. Waiting for the round to be settled.",
  });
});

// Polled by the user's game client to learn when a round has been settled and
// what the result is. Returns either { status: "pending" } or
// { status: "settled", result, dragonCard?, tigerCard? }.
router.get("/games/dragon-tiger/round/:roundId", requireAuth, (req, res): void => {
  const { roundId } = req.params;
  const open = casinoOpenRounds.get("dragon-tiger");
  if (open && open.id === roundId) {
    res.json({ status: "pending", roundId });
    return;
  }
  const last = casinoLastSettled.get("dragon-tiger");
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

/* ──────────────── COIN FLIP ──────────────── */
router.post("/games/coin-flip", requireAuth, async (req, res): Promise<void> => {
  const { stake, selection } = req.body;
  if (typeof stake !== "number" || stake <= 0) { res.status(400).json({ error: "Stake must be a positive number" }); return; }
  if (!["heads", "tails"].includes(selection)) { res.status(400).json({ error: "Selection must be heads or tails" }); return; }

  const userId = req.session.userId!;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  if (parseFloat(user.balance) < stake) { res.status(400).json({ error: "Insufficient balance" }); return; }

  const override = gameOverrides.get("coin-flip") as "heads" | "tails" | undefined;
  const result = override ?? (Math.random() < 0.5 ? "heads" : "tails");
  const won = result === selection;
  const winAmount = won ? Math.round(stake * 1.95 * 100) / 100 : 0;

  const record = await deductAndRecord(userId, stake, won, winAmount,
    `Coin Flip — bet ${selection}, result ${result}${override ? " [admin]" : ""}`);
  if (!record) { res.status(400).json({ error: "Insufficient balance" }); return; }
  res.json({ result, selection, stake, winAmount, netChange: record.netChange, newBalance: record.newBalance, won });
});

/* ──────────────── DICE ROLL ──────────────── */
router.post("/games/dice-roll", requireAuth, async (req, res): Promise<void> => {
  const { stake, selection } = req.body;
  if (typeof stake !== "number" || stake <= 0) { res.status(400).json({ error: "Stake must be a positive number" }); return; }
  if (!["high", "low", "seven"].includes(selection)) { res.status(400).json({ error: "Selection must be high, low, or seven" }); return; }

  const userId = req.session.userId!;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  if (parseFloat(user.balance) < stake) { res.status(400).json({ error: "Insufficient balance" }); return; }

  const override = gameOverrides.get("dice-roll") as "low" | "high" | "seven" | undefined;
  let dice1: number, dice2: number;
  if (override === "seven") {
    const combos = [[1,6],[2,5],[3,4],[4,3],[5,2],[6,1]];
    [dice1, dice2] = combos[Math.floor(Math.random() * combos.length)];
  } else if (override === "high") {
    // sum > 7: min combo is (2,6)=8
    const highCombos: [number,number][] = [];
    for (let a=1;a<=6;a++) for (let b=1;b<=6;b++) if (a+b>7) highCombos.push([a,b]);
    [dice1, dice2] = highCombos[Math.floor(Math.random() * highCombos.length)];
  } else if (override === "low") {
    const lowCombos: [number,number][] = [];
    for (let a=1;a<=6;a++) for (let b=1;b<=6;b++) if (a+b<7) lowCombos.push([a,b]);
    [dice1, dice2] = lowCombos[Math.floor(Math.random() * lowCombos.length)];
  } else {
    dice1 = Math.floor(Math.random() * 6) + 1;
    dice2 = Math.floor(Math.random() * 6) + 1;
  }
  const sum = dice1 + dice2;
  const result = sum < 7 ? "low" : sum > 7 ? "high" : "seven";

  const won = result === selection;
  const multiplier = selection === "seven" ? 5 : 1.9;
  const winAmount = won ? Math.round(stake * multiplier * 100) / 100 : 0;

  const record = await deductAndRecord(userId, stake, won, winAmount,
    `Dice Roll — bet ${selection}, rolled ${dice1}+${dice2}=${sum} (${result})${override ? " [admin]" : ""}`);
  if (!record) { res.status(400).json({ error: "Insufficient balance" }); return; }
  res.json({ dice1, dice2, sum, result, selection, stake, winAmount, netChange: record.netChange, newBalance: record.newBalance, won });
});

/* ──────────────── ANDAR BAHAR ──────────────── */
router.post("/games/andar-bahar", requireAuth, async (req, res): Promise<void> => {
  const { stake, selection } = req.body;
  if (typeof stake !== "number" || stake <= 0) { res.status(400).json({ error: "Stake must be a positive number" }); return; }
  if (!["andar", "bahar"].includes(selection)) { res.status(400).json({ error: "Selection must be andar or bahar" }); return; }

  const userId = req.session.userId!;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  if (parseFloat(user.balance) < stake) { res.status(400).json({ error: "Insufficient balance" }); return; }

  const override = gameOverrides.get("andar-bahar") as "andar" | "bahar" | undefined;
  const joker = dealCard();
  const dealtCards: Array<{ card: typeof joker; side: "andar" | "bahar"; isMatch: boolean }> = [];
  let result: "andar" | "bahar" = "andar";
  let found = false;

  if (override) {
    // Deal some non-matching cards first, then force match on the override side
    const steps = Math.floor(Math.random() * 6) + 2; // 2-7 steps before match
    for (let i = 0; i < steps; i++) {
      const side: "andar" | "bahar" = i % 2 === 0 ? "andar" : "bahar";
      dealtCards.push({ card: dealCard(), side, isMatch: false });
    }
    // Final match card on override side
    const matchCard = { ...joker, suit: SUITS[Math.floor(Math.random() * SUITS.length)] };
    const lastSide = steps % 2 === 0 ? "andar" : "bahar";
    // keep dealing until we're on the right side
    if (lastSide !== override) {
      dealtCards.push({ card: dealCard(), side: lastSide, isMatch: false });
    }
    const forceSide: "andar" | "bahar" = override;
    dealtCards.push({ card: matchCard, side: forceSide, isMatch: true });
    result = override;
  } else {
    for (let i = 0; i < 52 && !found; i++) {
      const card = dealCard();
      const side: "andar" | "bahar" = i % 2 === 0 ? "andar" : "bahar";
      const isMatch = card.rank === joker.rank;
      dealtCards.push({ card, side, isMatch });
      if (isMatch) { result = side; found = true; }
    }
  }

  const won = result === selection;
  const multiplier = result === "bahar" ? 2.0 : 1.9;
  const winAmount = won ? Math.round(stake * multiplier * 100) / 100 : 0;

  const record = await deductAndRecord(userId, stake, won, winAmount,
    `Andar Bahar — joker ${joker.rank}${joker.suit}, bet ${selection}, result ${result}${override ? " [admin]" : ""}`);
  if (!record) { res.status(400).json({ error: "Insufficient balance" }); return; }
  res.json({ joker, dealtCards, result, selection, stake, winAmount, netChange: record.netChange, newBalance: record.newBalance, won });
});

/* ──────────────── RANG / RUNG (Trump Card Game) ──────────────── */
// Traditional South Asian trick-taking game.  "Rang" = trump suit.
// A trump card is revealed; its suit becomes the Rang (trump).
// 5 cards each to player and house.  5 tricks played positionally.
// Trump beats non-trump; higher value wins within same trump/non-trump tier.
// 3+ tricks wins the hand.  Bet on "player" or "house".  Payout 1.9×.
const ALL_RANKS_RANG = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
const CARD_VAL_RANG: Record<string, number> = {
  "2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"10":10,J:11,Q:12,K:13,A:14,
};

function buildRangDeck() {
  const deck: { rank: string; suit: string; value: number }[] = [];
  for (const suit of SUITS) {
    for (const rank of ALL_RANKS_RANG) {
      deck.push({ rank, suit, value: CARD_VAL_RANG[rank] });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

router.post("/games/rang", requireAuth, async (req, res): Promise<void> => {
  const { stake, selection } = req.body;
  if (typeof stake !== "number" || stake <= 0) { res.status(400).json({ error: "Stake must be positive" }); return; }
  if (!["player", "house"].includes(selection)) { res.status(400).json({ error: "Selection must be player or house" }); return; }

  const userId = req.session.userId!;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  if (parseFloat(user.balance) < stake) { res.status(400).json({ error: "Insufficient balance" }); return; }

  const override = gameOverrides.get("rang") as "player" | "house" | undefined;

  const deck = buildRangDeck();
  // First card determines trump suit (the "Rang")
  const trumpCard = deck[0];
  const trumpSuit = trumpCard.suit;

  // Deal 5 to player (positions 1-10 alternating), 5 to house
  const playerHand = [deck[1], deck[3], deck[5], deck[7], deck[9]].map(c => ({
    ...c, isTrump: c.suit === trumpSuit,
  }));
  const houseHand  = [deck[2], deck[4], deck[6], deck[8], deck[10]].map(c => ({
    ...c, isTrump: c.suit === trumpSuit,
  }));

  // Simulate 5 tricks positionally: compare card[i] vs card[i]
  // Trump card beats non-trump; within same type, higher value wins
  const tricks: { playerCard: any; houseCard: any; winner: "player" | "house" | "draw" }[] = [];
  let playerTricks = 0;
  let houseTricks  = 0;

  for (let i = 0; i < 5; i++) {
    const pc = playerHand[i];
    const hc = houseHand[i];
    let winner: "player" | "house" | "draw";

    if (pc.isTrump && !hc.isTrump)       { winner = "player"; }
    else if (!pc.isTrump && hc.isTrump)  { winner = "house"; }
    else if (pc.value > hc.value)        { winner = "player"; }
    else if (hc.value > pc.value)        { winner = "house"; }
    else                                 { winner = "draw"; }

    if (winner === "player") playerTricks++;
    else if (winner === "house") houseTricks++;

    tricks.push({ playerCard: pc, houseCard: hc, winner });
  }

  // Natural winner: 3+ tricks (draw remaining → player wins as "andar" advantage)
  let naturalWinner: "player" | "house";
  if (playerTricks >= houseTricks) naturalWinner = "player";
  else naturalWinner = "house";

  const winner = override ?? naturalWinner;
  const won = winner === selection;
  const winAmount = won ? Math.round(stake * 1.9 * 100) / 100 : 0;

  const playerTrumpCount = playerHand.filter(c => c.isTrump).length;
  const houseTrumpCount  = houseHand.filter(c => c.isTrump).length;

  const record = await deductAndRecord(userId, stake, won, winAmount,
    `Rang — trump ${trumpSuit}, bet ${selection}, winner ${winner} (P:${playerTricks} vs H:${houseTricks} tricks)${override ? " [admin]" : ""}`);
  if (!record) { res.status(400).json({ error: "Insufficient balance" }); return; }
  res.json({ trumpSuit, trumpCard, playerHand, houseHand, tricks, playerTricks, houseTricks, playerTrumpCount, houseTrumpCount, winner, selection, stake, won, winAmount, netChange: record.netChange, newBalance: record.newBalance });
});

/* ──────────────── COURT PIECE (Card Game) ──────────────── */
// 52-card deck.  Deal 5 cards each to Player and House.
// Court cards = J, Q, K, A.  Most court cards wins.  Tie → higher total value wins.
// Selection: "player" | "house"  Payout: 1.9×
const COURT_RANKS = ["J", "Q", "K", "A"];
const ALL_RANKS   = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
const CARD_VAL: Record<string, number> = {
  "2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"10":10,J:11,Q:12,K:13,A:14,
};

function buildDeck() {
  const deck: { rank: string; suit: string; value: number }[] = [];
  for (const suit of SUITS) {
    for (const rank of ALL_RANKS) {
      deck.push({ rank, suit, value: CARD_VAL[rank] });
    }
  }
  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

router.post("/games/court-piece", requireAuth, async (req, res): Promise<void> => {
  const { stake, selection } = req.body;
  if (typeof stake !== "number" || stake <= 0) { res.status(400).json({ error: "Stake must be positive" }); return; }
  if (!["player", "house"].includes(selection)) { res.status(400).json({ error: "Selection must be player or house" }); return; }

  const userId = req.session.userId!;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  if (parseFloat(user.balance) < stake) { res.status(400).json({ error: "Insufficient balance" }); return; }

  const override = gameOverrides.get("court-piece") as "player" | "house" | undefined;

  const deck = buildDeck();
  // Alternate deal: cards 0,2,4,6,8 → player; 1,3,5,7,9 → house
  const playerHand = [deck[0], deck[2], deck[4], deck[6], deck[8]];
  const houseHand  = [deck[1], deck[3], deck[5], deck[7], deck[9]];

  const playerCourt = playerHand.filter(c => COURT_RANKS.includes(c.rank)).length;
  const houseCourt  = houseHand.filter(c => COURT_RANKS.includes(c.rank)).length;
  const playerTotal = playerHand.reduce((s, c) => s + c.value, 0);
  const houseTotal  = houseHand.reduce((s, c) => s + c.value, 0);

  let naturalWinner: "player" | "house";
  if (playerCourt > houseCourt) naturalWinner = "player";
  else if (houseCourt > playerCourt) naturalWinner = "house";
  else naturalWinner = playerTotal >= houseTotal ? "player" : "house"; // tiebreak by value

  const winner = override ?? naturalWinner;
  const won = winner === selection;
  const winAmount = won ? Math.round(stake * 1.9 * 100) / 100 : 0;

  const record = await deductAndRecord(userId, stake, won, winAmount,
    `Court Piece — bet ${selection}, winner ${winner} (P:${playerCourt} courts vs H:${houseCourt} courts)${override ? " [admin]" : ""}`);
  if (!record) { res.status(400).json({ error: "Insufficient balance" }); return; }
  res.json({ playerHand, houseHand, playerCourt, houseCourt, playerTotal, houseTotal, winner, selection, stake, won, winAmount, netChange: record.netChange, newBalance: record.newBalance });
});

export default router;
