import { useState } from "react";
import { useLocation } from "wouter";
import { useGetLiveEvents, getGetLiveEventsQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth-context";
import { Activity, Zap, ArrowRight, Users, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { CASINO_SPORTS } from "@/lib/casino-config";

const CATEGORIES = ["All", "Table Games", "Teen Patti", "Slot Games", "Casino", "Real Cash"];

const BASE_URL = import.meta.env.BASE_URL;

const CASINO_GAMES = [
  // Table Games
  {
    slug: "teen-patti",   label: "Teen Patti",     emoji: "👑", players: "12.4K",
    category: "Teen Patti",  tag: "HOTTEST", tagColor: "#ef4444",
    bg: "linear-gradient(135deg,#1a0830 0%,#4a1060 50%,#7c2d9a 100%)",
    accent: "#c084fc", featured: true,
    desc: "Player • Banker • Pair",
    thumbnail: `${BASE_URL}teen-patti-banner.jpg`,
  },
  {
    slug: "dragon-tiger", label: "Dragon Tiger",   emoji: "🐉", players: "8.2K",
    category: "Table Games", tag: "TRENDING", tagColor: "#f97316",
    bg: "linear-gradient(135deg,#1c0a00 0%,#7c1d00 50%,#c2410c 100%)",
    accent: "#fb923c",
    desc: "Dragon • Tiger • Tie",
    thumbnail: `${BASE_URL}dragon-tiger-banner.jpg`,
  },
  {
    slug: "andar-bahar",  label: "Andar Bahar",    emoji: "🃏", players: "6.5K",
    category: "Table Games", tag: "HOT", tagColor: "#ef4444",
    bg: "linear-gradient(135deg,#030f1c 0%,#0c2d5e 50%,#1d4ed8 100%)",
    accent: "#60a5fa",
    desc: "Andar • Bahar"
  },
  {
    slug: "roulette",     label: "Roulette",       emoji: "🎡", players: "5.2K",
    category: "Table Games", tag: "NEW", tagColor: "#22c55e",
    bg: "linear-gradient(135deg,#0c0000 0%,#4a0000 50%,#991b1b 100%)",
    accent: "#f87171",
    desc: "Red • Black • Green 14×"
  },
  // Teen Patti
  {
    slug: "joker",        label: "Joker Joker",    emoji: "🤡", players: "4.0K",
    category: "Teen Patti", tag: "WILD", tagColor: "#a855f7",
    bg: "linear-gradient(135deg,#0d0020 0%,#3b0764 50%,#6d28d9 100%)",
    accent: "#a78bfa",
    desc: "Player • Banker • Joker 9×",
    thumbnail: `${BASE_URL}joker-logo.jpg`,
  },
  {
    slug: "ten-cards",    label: "10 Cards",       emoji: "🔟", players: "2.8K",
    category: "Teen Patti",
    bg: "linear-gradient(135deg,#00061a 0%,#0a1a5c 50%,#0c1a3d 100%)",
    accent: "#60a5fa",
    desc: "Player • Banker",
    thumbnail: `${BASE_URL}ten-cards-logo.svg`,
  },
  {
    slug: "muflis",       label: "Muflis",         emoji: "♟️", players: "2.5K",
    category: "Teen Patti",
    bg: "linear-gradient(135deg,#0a0e1a 0%,#1e3a5f 50%,#1e40af 100%)",
    accent: "#93c5fd",
    desc: "Lowest Hand Wins!"
  },
  // Slots
  {
    slug: "bingo-777",    label: "777 Bingo",      emoji: "🎰", players: "3.2K",
    category: "Slot Games", tag: "JACKPOT", tagColor: "#f5c542",
    bg: "linear-gradient(135deg,#0a0500 0%,#451a00 50%,#b45309 100%)",
    accent: "#fbbf24",
    desc: "Triple 7 (20×) • BAR • Cherry"
  },
  {
    slug: "fruit-line",   label: "Fruit Line",     emoji: "🍉", players: "2.0K",
    category: "Slot Games",
    bg: "linear-gradient(135deg,#002208 0%,#065f32 50%,#15803d 100%)",
    accent: "#4ade80",
    desc: "Jackpot (10×) • Mix • Single"
  },
  {
    slug: "sweet-bonanza", label: "Sweet Bonanza", emoji: "🍭", players: "3.0K",
    category: "Slot Games", tag: "SWEET", tagColor: "#ec4899",
    bg: "linear-gradient(135deg,#1f0020 0%,#6b1070 50%,#be185d 100%)",
    accent: "#f472b6",
    desc: "Bonanza (8×) • Scatter • Base"
  },
  {
    slug: "crash",        label: "Crash",          emoji: "🚀", players: "3.8K",
    category: "Slot Games", tag: "HOT", tagColor: "#ef4444",
    bg: "linear-gradient(135deg,#0a0000 0%,#450a00 50%,#b91c1c 100%)",
    accent: "#f87171",
    desc: "Cash at 2× • 5× • 10×"
  },
  // Casino
  {
    slug: "blackjack",    label: "Blackjack",      emoji: "♠️", players: "5.8K",
    category: "Casino", tag: "NEW", tagColor: "#22c55e",
    bg: "linear-gradient(135deg,#020c02 0%,#0a2e0a 50%,#166534 100%)",
    accent: "#4ade80",
    desc: "Player • Dealer • Tie 8×"
  },
  {
    slug: "car-roulette", label: "Car Roulette",   emoji: "🏎️", players: "2.2K",
    category: "Casino",
    bg: "linear-gradient(135deg,#0d0600 0%,#431407 50%,#c2410c 100%)",
    accent: "#fb923c",
    desc: "Car 1 • Car 2 • Car 3 (5×)"
  },
  {
    slug: "god-of-fortune", label: "God of Fortune", emoji: "🐲", players: "3.5K",
    category: "Casino", tag: "GRAND", tagColor: "#f5c542",
    bg: "linear-gradient(135deg,#1a0500 0%,#7c1a00 50%,#dc2626 100%)",
    accent: "#f5c542",
    desc: "Fortune • Grand (5×) • Supreme (10×)"
  },
  // Real Cash
  {
    slug: "rummy",        label: "Rummy",          emoji: "🀄", players: "1.8K",
    category: "Real Cash",
    bg: "linear-gradient(135deg,#100005 0%,#4a0015 50%,#9f1239 100%)",
    accent: "#fb7185",
    desc: "Player • House"
  },
  // Other
  {
    slug: "lucky-7",      label: "Lucky 7",        emoji: "🎲", players: "5.1K",
    category: "Table Games",
    bg: "linear-gradient(135deg,#0a0800 0%,#3d2e00 50%,#a16207 100%)",
    accent: "#fbbf24",
    desc: "Under 7 • Seven (5×) • Over 7"
  },
  {
    slug: "jhandi-munda", label: "Jhandi Munda",   emoji: "🎴", players: "4.3K",
    category: "Table Games", tag: "DESI", tagColor: "#06b6d4",
    bg: "linear-gradient(135deg,#001a1a 0%,#005a5a 50%,#0e7490 100%)",
    accent: "#22d3ee",
    desc: "6 Dice • 6 Symbols (6×)"
  },
  {
    slug: "coin-flip",    label: "Coin Flip",      emoji: "🪙", players: "1.9K",
    category: "Casino",
    bg: "linear-gradient(135deg,#0a0800 0%,#3d2e00 50%,#92400e 100%)",
    accent: "#f59e0b",
    desc: "Heads • Tails (1.95×)"
  },
  {
    slug: "dice-roll",    label: "Dice Roll",      emoji: "🎲", players: "1.4K",
    category: "Casino",
    bg: "linear-gradient(135deg,#00021a 0%,#05156b 50%,#1d4ed8 100%)",
    accent: "#818cf8",
    desc: "High • Low • Seven (5×)"
  },
  {
    slug: "rang",         label: "Rang",           emoji: "♠️", players: "1.6K",
    category: "Real Cash",
    bg: "linear-gradient(135deg,#010a01 0%,#032b03 50%,#14532d 100%)",
    accent: "#86efac",
    desc: "Strategic Trump Game"
  },
  {
    slug: "court-piece",  label: "Court Piece",    emoji: "🂡", players: "1.2K",
    category: "Real Cash",
    bg: "linear-gradient(135deg,#0d0020 0%,#2d0060 50%,#4c1d95 100%)",
    accent: "#c4b5fd",
    desc: "Partnership Card Battle"
  },
];

function GameCard({ game, onClick }: { game: typeof CASINO_GAMES[0]; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative rounded-2xl overflow-hidden cursor-pointer flex-shrink-0 transition-all duration-300 select-none"
      style={{
        width: 148,
        height: 196,
        background: game.bg,
        border: `1.5px solid ${hovered ? game.accent : "rgba(255,255,255,0.08)"}`,
        boxShadow: hovered ? `0 8px 32px ${game.accent}55` : "0 2px 8px rgba(0,0,0,0.5)",
        transform: hovered ? "translateY(-4px) scale(1.03)" : "none",
      }}
    >
      {/* Badge */}
      {game.tag && (
        <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider"
          style={{ background: game.tagColor, color: "#fff", boxShadow: `0 0 8px ${game.tagColor}88` }}>
          {game.tag}
        </div>
      )}

      {/* Players badge */}
      <div className="absolute top-2 right-2 flex items-center gap-0.5 px-1.5 py-0.5 rounded-md"
        style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}>
        <Users size={9} style={{ color: game.accent }} />
        <span className="text-[9px] font-bold" style={{ color: game.accent }}>{game.players}</span>
      </div>

      {/* Thumbnail image (if provided) or big emoji */}
      {'thumbnail' in game && game.thumbnail ? (
        <div className="absolute inset-0">
          <img
            src={game.thumbnail as string}
            alt={game.label}
            style={{ width: "100%", height: "72%", objectFit: "cover", objectPosition: "center 25%", display: "block" }}
          />
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "72%", background: "linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.7) 100%)" }} />
          <div className="absolute bottom-10 left-0 right-0 text-center px-2">
            <div className="text-white font-black text-sm leading-tight">{game.label}</div>
            <div className="text-[10px] mt-0.5 leading-tight" style={{ color: `${game.accent}cc` }}>{game.desc}</div>
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 pt-2">
          <div className="text-5xl mb-1" style={{ filter: `drop-shadow(0 4px 8px ${game.accent}88)` }}>
            {game.emoji}
          </div>
          <div className="text-center px-2">
            <div className="text-white font-black text-sm leading-tight">{game.label}</div>
            <div className="text-[10px] mt-0.5 leading-tight" style={{ color: `${game.accent}cc` }}>{game.desc}</div>
          </div>
        </div>
      )}

      {/* Play button overlay */}
      <div className="absolute inset-x-3 bottom-3">
        <div className="w-full py-1.5 rounded-xl text-center text-[11px] font-black uppercase tracking-wider transition-all duration-200"
          style={{
            background: hovered ? game.accent : "rgba(255,255,255,0.12)",
            color: hovered ? "#000" : game.accent,
            boxShadow: hovered ? `0 0 12px ${game.accent}88` : "none",
          }}>
          {hovered ? "▶ PLAY NOW" : "Play"}
        </div>
      </div>

      {/* Decorative glow at bottom */}
      <div className="absolute inset-x-0 bottom-0 h-16 pointer-events-none"
        style={{ background: `linear-gradient(transparent, ${game.accent}22)` }} />
    </div>
  );
}

function CategoryRow({ title, icon, games, onPlay }: {
  title: string; icon: string;
  games: typeof CASINO_GAMES;
  onPlay: (slug: string) => void;
}) {
  if (games.length === 0) return null;
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3 px-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          <span className="text-base font-black text-white">{title}</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: "rgba(245,197,66,0.15)", color: "#f5c542" }}>{games.length}</span>
        </div>
        <button className="text-xs font-semibold flex items-center gap-1" style={{ color: "rgba(245,197,66,0.7)" }}>
          See all <ArrowRight size={12} />
        </button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 px-4 scrollbar-none" style={{ scrollbarWidth: "none" }}>
        {games.map(g => <GameCard key={g.slug} game={g} onClick={() => onPlay(g.slug)} />)}
      </div>
    </div>
  );
}

export default function Home() {
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const [activeCategory, setActiveCategory] = useState("All");

  const { data: liveEvents, isLoading: isLoadingLive } = useGetLiveEvents(
    { query: { queryKey: getGetLiveEventsQueryKey() } }
  );

  const casinoLive = liveEvents?.filter(e => CASINO_SPORTS.includes(e.sport)) || [];

  const filteredGames = activeCategory === "All"
    ? CASINO_GAMES
    : CASINO_GAMES.filter(g => g.category === activeCategory);

  const handlePlay = (slug: string) => {
    if (!isAuthenticated) { setLocation("/login"); return; }
    setLocation(`/play/${slug}`);
  };

  const CATEGORY_ICONS: Record<string, string> = {
    "All": "🎮",
    "Table Games": "🃏",
    "Teen Patti": "👑",
    "Slot Games": "🎰",
    "Casino": "♠️",
    "Real Cash": "💰",
  };

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(180deg,#0a1f0e 0%,#061209 100%)" }}>

      {/* ─── HERO BANNER ─── */}
      <div className="relative overflow-hidden mx-3 mt-3 rounded-2xl mb-4" style={{
        background: "linear-gradient(135deg,#0d3b22 0%,#193d15 50%,#0a2414 100%)",
        border: "1.5px solid rgba(245,197,66,0.25)",
        minHeight: 160,
      }}>
        <div className="absolute inset-0 pointer-events-none opacity-[0.06]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Ctext x='10' y='40' font-size='36' fill='%23f5c542'%3E♠%3C/text%3E%3C/svg%3E\")", backgroundSize: "60px" }} />
        <div className="relative z-10 flex items-center justify-between h-full px-5 py-5">
          <div className="flex-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full mb-3 text-[10px] font-black uppercase tracking-widest"
              style={{ background: "rgba(245,197,66,0.15)", border: "1px solid rgba(245,197,66,0.3)", color: "#f5c542" }}>
              <Zap size={10} fill="#f5c542" /> Premium Casino
            </div>
            <h1 className="text-2xl font-black leading-tight mb-1.5">
              <span className="text-white">Bet</span>
              <span style={{ background: "linear-gradient(90deg,#f5c542,#ffeba1)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Pulse</span>
            </h1>
            <p className="text-xs mb-4" style={{ color: "rgba(255,255,255,0.55)" }}>
              Teen Patti · Roulette · Slots · Crash
            </p>
            <div className="flex items-center gap-4 mb-4">
              {[
                { icon: <Activity size={11} style={{ color: "#f5c542" }} />, val: "Live", sub: "Now" },
                { icon: <TrendingUp size={11} style={{ color: "#4ade80" }} />, val: "₹2Cr+", sub: "Paid" },
                { icon: <Users size={11} style={{ color: "#60a5fa" }} />, val: "50K+", sub: "Players" },
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-1">
                  {s.icon}
                  <div>
                    <div className="text-[11px] font-black text-white leading-none">{s.val}</div>
                    <div className="text-[9px] leading-none" style={{ color: "rgba(255,255,255,0.4)" }}>{s.sub}</div>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setLocation(isAuthenticated ? "/" : "/register")}
              className="px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all hover:scale-105"
              style={{ background: "linear-gradient(135deg,#d4a017,#f5c542)", color: "#061209", boxShadow: "0 0 20px rgba(245,197,66,0.4)" }}>
              {isAuthenticated ? "🎮 Play Now" : "🎁 Claim ₹500 Bonus"}
            </button>
          </div>
          {/* Decorative cards */}
          <div className="relative w-28 h-28 flex-shrink-0">
            {[
              { top: "0px", right: "0px", rotate: "15deg", bg: "white", rank: "A", suit: "♠", red: false },
              { top: "12px", right: "18px", rotate: "-5deg", bg: "white", rank: "K", suit: "♥", red: true },
              { top: "24px", right: "36px", rotate: "-20deg", bg: "white", rank: "Q", suit: "♦", red: true },
            ].map((c, i) => (
              <div key={i} className="absolute rounded-xl flex flex-col items-center justify-center shadow-2xl"
                style={{ width: 52, height: 70, background: c.bg, border: "2px solid #e5e7eb", top: c.top, right: c.right, transform: `rotate(${c.rotate})`, boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
                <span className="text-xl font-black leading-none" style={{ color: c.red ? "#dc2626" : "#111" }}>{c.rank}</span>
                <span className="text-xl leading-none" style={{ color: c.red ? "#dc2626" : "#111" }}>{c.suit}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── LIVE ROUNDS STRIP ─── */}
      {casinoLive.length > 0 && (
        <div className="mb-4 px-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-black text-white uppercase tracking-wider">Live Rounds</span>
            <span className="text-xs px-1.5 py-0.5 rounded-full font-bold" style={{ background: "rgba(239,68,68,0.2)", color: "#f87171" }}>{casinoLive.length}</span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none" style={{ scrollbarWidth: "none" }}>
            {isLoadingLive ? (
              [1,2].map(i => <Skeleton key={i} className="h-24 w-48 rounded-xl flex-shrink-0" />)
            ) : casinoLive.map(ev => {
              const opts = ev.options as any[];
              return (
                <div key={ev.id}
                  onClick={() => handlePlay(ev.sport?.toLowerCase().replace(/ /g, "-") || "")}
                  className="flex-shrink-0 rounded-xl cursor-pointer hover:scale-[1.02] transition-all p-3"
                  style={{ width: 220, background: "rgba(13,43,26,0.8)", border: "1.5px solid rgba(245,197,66,0.2)", backdropFilter: "blur(8px)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: "rgba(239,68,68,0.2)", color: "#f87171" }}>🔴 LIVE</span>
                    <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>{ev.sport}</span>
                  </div>
                  <div className="flex gap-1.5">
                    {opts?.slice(0, 3).map((o: any, i: number) => (
                      <div key={i} className="flex-1 rounded-lg p-1.5 text-center" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.07)" }}>
                        <div className="text-[9px] font-semibold mb-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>{o.name}</div>
                        <div className="text-xs font-black text-white">{Number(o.odds).toFixed(2)}×</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── CATEGORY TABS ─── */}
      <div className="flex gap-2 overflow-x-auto px-4 pb-3 mb-4" style={{ scrollbarWidth: "none" }}>
        {CATEGORIES.map(cat => (
          <button key={cat}
            onClick={() => setActiveCategory(cat)}
            className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider transition-all duration-200"
            style={{
              background: activeCategory === cat ? "linear-gradient(135deg,#d4a017,#f5c542)" : "rgba(255,255,255,0.06)",
              color: activeCategory === cat ? "#061209" : "rgba(255,255,255,0.55)",
              border: `1.5px solid ${activeCategory === cat ? "transparent" : "rgba(255,255,255,0.08)"}`,
              boxShadow: activeCategory === cat ? "0 0 16px rgba(245,197,66,0.4)" : "none",
            }}>
            <span>{CATEGORY_ICONS[cat] ?? "🎮"}</span>
            {cat}
          </button>
        ))}
      </div>

      {/* ─── GAMES SECTION ─── */}
      {activeCategory === "All" ? (
        <>
          <CategoryRow title="Table Games" icon="🃏" onPlay={handlePlay}
            games={CASINO_GAMES.filter(g => g.category === "Table Games")} />
          <CategoryRow title="Teen Patti Games" icon="👑" onPlay={handlePlay}
            games={CASINO_GAMES.filter(g => g.category === "Teen Patti")} />
          <CategoryRow title="Slot Games" icon="🎰" onPlay={handlePlay}
            games={CASINO_GAMES.filter(g => g.category === "Slot Games")} />
          <CategoryRow title="Casino Games" icon="♠️" onPlay={handlePlay}
            games={CASINO_GAMES.filter(g => g.category === "Casino")} />
          <CategoryRow title="Real Cash Games" icon="💰" onPlay={handlePlay}
            games={CASINO_GAMES.filter(g => g.category === "Real Cash")} />
        </>
      ) : (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3 px-4">
            <span className="text-xl">{CATEGORY_ICONS[activeCategory] ?? "🎮"}</span>
            <span className="text-base font-black text-white">{activeCategory}</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: "rgba(245,197,66,0.15)", color: "#f5c542" }}>{filteredGames.length}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 px-4 sm:grid-cols-3">
            {filteredGames.map(g => (
              <div key={g.slug} className="flex justify-center">
                <GameCard game={g} onClick={() => handlePlay(g.slug)} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="h-8" />
    </div>
  );
}
