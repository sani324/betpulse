export interface GameOption {
  key: string;
  label: string;
  sub: string;
  color: string;
  icon: string;
}

export interface GameConfig {
  slug: string;
  name: string;
  emoji: string;
  desc: string;
  bgEmoji: string;
  category: string;
  options: GameOption[];
  cols?: number;
}

export const GAME_CATALOG: GameConfig[] = [
  {
    slug: "andar-bahar",
    name: "Andar Bahar",
    emoji: "🃏",
    desc: "Classic Indian card game · pick Andar or Bahar",
    bgEmoji: "🃏",
    category: "Table Games",
    cols: 2,
    options: [
      { key: "andar", label: "Andar", sub: "1.95×", color: "#3b82f6", icon: "⬅️" },
      { key: "bahar", label: "Bahar", sub: "1.95×", color: "#ef4444", icon: "➡️" },
    ],
  },
  {
    slug: "roulette",
    name: "Roulette",
    emoji: "🎡",
    desc: "Spin the wheel · Red / Black / Green",
    bgEmoji: "🎡",
    category: "Table Games",
    cols: 3,
    options: [
      { key: "red",   label: "Red",   sub: "1.95×", color: "#ef4444", icon: "🔴" },
      { key: "black", label: "Black", sub: "1.95×", color: "#6b7280", icon: "⚫" },
      { key: "green", label: "Green", sub: "14×",   color: "#22c55e", icon: "🟢" },
    ],
  },
  {
    slug: "bingo-777",
    name: "777 Bingo",
    emoji: "🎰",
    desc: "Spin the slots · Triple 7 jackpot",
    bgEmoji: "7️⃣",
    category: "Slot Games",
    cols: 3,
    options: [
      { key: "triple7", label: "Triple 7",  sub: "20×", color: "#f5c542", icon: "7️⃣" },
      { key: "bar",     label: "BAR",       sub: "5×",  color: "#a855f7", icon: "🟥" },
      { key: "cherry",  label: "Cherry",    sub: "2×",  color: "#ef4444", icon: "🍒" },
    ],
  },
  {
    slug: "fruit-line",
    name: "Fruit Line",
    emoji: "🍉",
    desc: "Match the fruits · Jackpot wins big",
    bgEmoji: "🍊",
    category: "Slot Games",
    cols: 3,
    options: [
      { key: "jackpot", label: "Jackpot", sub: "10×",  color: "#f5c542", icon: "🍇" },
      { key: "mix",     label: "Mix Win", sub: "3×",   color: "#22c55e", icon: "🍉" },
      { key: "plain",   label: "Single",  sub: "1.95×",color: "#3b82f6", icon: "🍋" },
    ],
  },
  {
    slug: "sweet-bonanza",
    name: "Sweet Bonanza",
    emoji: "🍭",
    desc: "Sweet wins await · Bonanza payout",
    bgEmoji: "🍬",
    category: "Slot Games",
    cols: 3,
    options: [
      { key: "bonanza", label: "Bonanza",  sub: "8×",  color: "#ec4899", icon: "🍭" },
      { key: "scatter", label: "Scatter",  sub: "3×",  color: "#f97316", icon: "⭐" },
      { key: "base",    label: "Base Win", sub: "1.95×",color: "#3b82f6", icon: "🍬" },
    ],
  },
  {
    slug: "crash",
    name: "Crash",
    emoji: "🚀",
    desc: "Bet your cashout multiplier · Higher = bigger risk",
    bgEmoji: "📈",
    category: "Slot Games",
    cols: 3,
    options: [
      { key: "x2",  label: "Cash at 2×",  sub: "2×",  color: "#22c55e", icon: "💚" },
      { key: "x5",  label: "Cash at 5×",  sub: "5×",  color: "#f97316", icon: "🧡" },
      { key: "x10", label: "Cash at 10×", sub: "10×", color: "#ef4444", icon: "🔴" },
    ],
  },
  {
    slug: "joker",
    name: "Joker",
    emoji: "🃏",
    desc: "Teen Patti with Joker wild card",
    bgEmoji: "🃏",
    category: "Teen Patti Games",
    cols: 3,
    options: [
      { key: "player", label: "Player", sub: "1.95×", color: "#3b82f6", icon: "👤" },
      { key: "banker", label: "Banker", sub: "1.95×", color: "#ef4444", icon: "🏦" },
      { key: "joker",  label: "Joker",  sub: "9×",   color: "#f5c542", icon: "🤡" },
    ],
  },
  {
    slug: "ten-cards",
    name: "10 Cards",
    emoji: "🔟",
    desc: "10-card Teen Patti variant",
    bgEmoji: "🃏",
    category: "Teen Patti Games",
    cols: 2,
    options: [
      { key: "player", label: "Player", sub: "1.95×", color: "#3b82f6", icon: "👤" },
      { key: "banker", label: "Banker", sub: "1.95×", color: "#ef4444", icon: "🏦" },
    ],
  },
  {
    slug: "muflis",
    name: "Muflis",
    emoji: "♟️",
    desc: "Reverse Teen Patti · Lowest hand wins",
    bgEmoji: "♟️",
    category: "Teen Patti Games",
    cols: 2,
    options: [
      { key: "player", label: "Player", sub: "1.95×", color: "#3b82f6", icon: "👤" },
      { key: "banker", label: "Banker", sub: "1.95×", color: "#ef4444", icon: "🏦" },
    ],
  },
  {
    slug: "blackjack",
    name: "Blackjack",
    emoji: "♠️",
    desc: "21 · Beat the dealer",
    bgEmoji: "♠️",
    category: "Casino Games",
    cols: 3,
    options: [
      { key: "player", label: "Player", sub: "1.95×", color: "#22c55e", icon: "🤚" },
      { key: "dealer", label: "Dealer", sub: "1.95×", color: "#ef4444", icon: "🏠" },
      { key: "tie",    label: "Tie",    sub: "8×",   color: "#f5c542", icon: "🤝" },
    ],
  },
  {
    slug: "car-roulette",
    name: "Car Roulette",
    emoji: "🏎️",
    desc: "Pick the winning car · Fast & furious",
    bgEmoji: "🚗",
    category: "Casino Games",
    cols: 3,
    options: [
      { key: "car1", label: "Car 1 🔴", sub: "1.95×", color: "#ef4444", icon: "🔴" },
      { key: "car2", label: "Car 2 🔵", sub: "1.95×", color: "#3b82f6", icon: "🔵" },
      { key: "car3", label: "Car 3 🟡", sub: "5×",   color: "#f5c542", icon: "🟡" },
    ],
  },
  {
    slug: "god-of-fortune",
    name: "God of Fortune",
    emoji: "🐉",
    desc: "Fortune favours the brave · Spin for glory",
    bgEmoji: "🐉",
    category: "Casino Games",
    cols: 3,
    options: [
      { key: "fortune", label: "Fortune", sub: "1.95×", color: "#22c55e", icon: "🍀" },
      { key: "grand",   label: "Grand",   sub: "5×",   color: "#f97316", icon: "🔥" },
      { key: "supreme", label: "Supreme", sub: "10×",  color: "#f5c542", icon: "👑" },
    ],
  },
  {
    slug: "rummy",
    name: "Rummy",
    emoji: "🀄",
    desc: "Classic card game · Player vs House",
    bgEmoji: "🀄",
    category: "Real Cash Games",
    cols: 2,
    options: [
      { key: "player", label: "Player", sub: "1.95×", color: "#22c55e", icon: "👤" },
      { key: "house",  label: "House",  sub: "1.95×", color: "#ef4444", icon: "🏠" },
    ],
  },
];

export function findGame(slug: string): GameConfig | undefined {
  return GAME_CATALOG.find(g => g.slug === slug);
}
