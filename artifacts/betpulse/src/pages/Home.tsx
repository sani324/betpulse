import { useLocation } from "wouter";
import { useGetLiveEvents, getGetLiveEventsQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth-context";
import { CasinoCard } from "@/components/CasinoCard";
import { Activity, Crown, Flame, Gamepad2, Sparkles, ArrowRight, Users, Zap, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { CASINO_SPORTS } from "@/lib/casino-config";

const CASINO_GAMES = [
  { slug: "teen-patti",    label: "Teen Patti",       emoji: "👑", desc: "Classic 3-card Indian poker",          tag: "HOTTEST",  tagColor: "#ef4444", players: "12.4K", featured: true },
  { slug: "dragon-tiger",  label: "Dragon Tiger",     emoji: "🔥", desc: "Fast 2-card draw · Dragon vs Tiger",   tag: "TRENDING", tagColor: "#f97316", players: "8.2K"  },
  { slug: "andar-bahar",   label: "Andar Bahar",      emoji: "🃏", desc: "Classic Indian card prediction game",  tag: "HOT",      tagColor: "#ef4444", players: "6.5K"  },
  { slug: "blackjack",     label: "Blackjack",        emoji: "♠️", desc: "Beat the dealer · 21",                tag: "NEW",      tagColor: "#22c55e", players: "5.8K"  },
  { slug: "roulette",      label: "Roulette",         emoji: "🎡", desc: "Spin the wheel · Red / Black / Green", tag: "NEW",      tagColor: "#22c55e", players: "5.2K"  },
  { slug: "lucky-7",       label: "Lucky 7",          emoji: "🎲", desc: "Sum the dice · Under / 7 / Over",                                          players: "5.1K"  },
  { slug: "jhandi-munda",  label: "Jhandi Munda",     emoji: "🎴", desc: "6 dice · 6 symbols · Indian classic",                                      players: "4.3K"  },
  { slug: "joker",         label: "Joker",            emoji: "🃏", desc: "Teen Patti with Joker wild card",                                          players: "4.0K"  },
  { slug: "crash",         label: "Crash",            emoji: "🚀", desc: "Bet your cashout · Higher = bigger win",tag: "HOT",     tagColor: "#ef4444", players: "3.8K"  },
  { slug: "god-of-fortune",label: "God of Fortune",   emoji: "🐉", desc: "Fortune favours the brave",                                               players: "3.5K"  },
  { slug: "bingo-777",     label: "777 Bingo",        emoji: "🎰", desc: "Spin the slots · Triple 7 jackpot",                                       players: "3.2K"  },
  { slug: "sweet-bonanza",  label: "Sweet Bonanza",   emoji: "🍭", desc: "Sweet wins · Bonanza payout",                                             players: "3.0K"  },
  { slug: "ten-cards",     label: "10 Cards",         emoji: "🔟", desc: "10-card Teen Patti variant",                                               players: "2.8K"  },
  { slug: "muflis",        label: "Muflis",           emoji: "♟️", desc: "Reverse Teen Patti · Lowest wins",                                        players: "2.5K"  },
  { slug: "car-roulette",  label: "Car Roulette",     emoji: "🏎️", desc: "Pick the winning car · Fast & furious",                                   players: "2.2K"  },
  { slug: "fruit-line",    label: "Fruit Line",       emoji: "🍉", desc: "Match the fruits · Jackpot wins big",                                      players: "2.0K"  },
  { slug: "coin-flip",     label: "Coin Flip",        emoji: "🪙", desc: "Heads or Tails · 1.95× payout",                                           players: "1.9K"  },
  { slug: "rummy",         label: "Rummy",            emoji: "🀄", desc: "Classic card game · Player vs House",                                      players: "1.8K"  },
  { slug: "rang",          label: "Rang",             emoji: "♠️", desc: "Strategic trick-taking card game",                                         players: "1.6K"  },
  { slug: "dice-roll",     label: "Dice Roll",        emoji: "🎲", desc: "High / Low / Lucky 7",                                                     players: "1.4K"  },
  { slug: "court-piece",   label: "Court Piece",      emoji: "🂡", desc: "Partnership card battle",                                                  players: "1.2K"  },
];

export default function Home() {
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();

  const { data: liveEvents, isLoading: isLoadingLive } = useGetLiveEvents(
    { query: { queryKey: getGetLiveEventsQueryKey() } }
  );

  const casinoLive = liveEvents?.filter(e => CASINO_SPORTS.includes(e.sport)) || [];

  return (
    <div className="space-y-8 pb-10">

      {/* ── HERO BANNER ── */}
      <section
        className="relative overflow-hidden rounded-3xl"
        style={{ minHeight: 220, background: "linear-gradient(135deg, #0d2b1a 0%, #113a21 50%, #0a2414 100%)", border: "1px solid rgba(245,197,66,0.2)" }}
      >
        {/* Background card suits pattern */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden select-none" style={{ opacity: 0.04 }}>
          <div className="flex flex-wrap gap-6 p-4 text-7xl leading-tight">
            {[...Array(40)].map((_, i) => <span key={i}>{["♠", "♥", "♣", "♦"][i % 4]}</span>)}
          </div>
        </div>

        {/* Gold ambient glow */}
        <div className="pointer-events-none absolute -top-20 -right-20 w-80 h-80 rounded-full" style={{ background: "rgba(245,197,66,0.07)", filter: "blur(80px)" }} />

        {/* Decorative playing cards */}
        <div className="pointer-events-none absolute right-6 bottom-0 hidden md:flex items-end gap-2" style={{ height: "100%" }}>
          {[
            { r: "A", s: "♥", c: "text-red-600", rot: "-rotate-12" },
            { r: "A", s: "♠", c: "text-gray-900", rot: "translate-y-[-16px]" },
            { r: "A", s: "♦", c: "text-red-600", rot: "rotate-12" },
          ].map((card, i) => (
            <div key={i} className={`w-20 h-28 rounded-xl shadow-2xl flex flex-col items-center justify-center ${card.rot}`} style={{ background: "white", border: "2px solid #e5e7eb" }}>
              <span className={`text-3xl font-black ${card.c}`}>{card.r}</span>
              <span className={`text-2xl ${card.c}`}>{card.s}</span>
            </div>
          ))}
        </div>

        <div className="relative z-10 p-6 sm:p-8 md:pr-64">
          <div className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider mb-4" style={{ background: "rgba(245,197,66,0.12)", border: "1px solid rgba(245,197,66,0.3)", color: "#f5c542" }}>
            <Sparkles size={12} /> Premium Indian Casino
          </div>
          <h1 className="text-3xl font-black text-white leading-tight mb-2 sm:text-4xl">
            Welcome to{" "}
            <span style={{ background: "linear-gradient(90deg,#f5c542,#ffeba1)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              BetPulse
            </span>
          </h1>
          <p className="text-sm mb-6 max-w-md" style={{ color: "rgba(255,255,255,0.6)" }}>
            Teen Patti · Dragon Tiger · Lucky 7 · Jhandi Munda · Rang
          </p>

          <div className="flex flex-wrap gap-5 mb-6">
            {[
              { icon: <Zap size={14} />, value: "Live", label: "Games Now" },
              { icon: <TrendingUp size={14} />, value: "₹2Cr+", label: "Paid Out" },
              { icon: <Users size={14} />, value: "50K+", label: "Players" },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-2">
                <span style={{ color: "#f5c542" }}>{s.icon}</span>
                <div>
                  <div className="text-sm font-bold text-white">{s.value}</div>
                  <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.45)" }}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          {!isAuthenticated && (
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={() => setLocation("/register")}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-105 active:scale-95"
                style={{ background: "linear-gradient(135deg,#d4a017,#f5c542)", color: "#081c0e", boxShadow: "0 0 20px rgba(245,197,66,0.35)" }}
              >
                Claim ₹500 Bonus <ArrowRight size={16} />
              </button>
              <button
                onClick={() => setLocation("/login")}
                className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:bg-white/10"
                style={{ background: "rgba(255,255,255,0.08)", color: "white", border: "1px solid rgba(255,255,255,0.2)" }}
              >
                Login
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ── LIVE ROUNDS ── */}
      {casinoLive.length > 0 && (
        <section>
          <div className="mb-4 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: "#f87171" }}>
              <Activity size={18} /> Live Rounds
            </h2>
            <span className="rounded-full px-2.5 py-0.5 text-xs font-bold" style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.25)" }}>
              {casinoLive.length}
            </span>
          </div>
          {isLoadingLive ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2].map(i => <Skeleton key={i} className="h-48 w-full rounded-2xl" style={{ background: "rgba(20,61,35,0.4)" }} />)}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {casinoLive.map(event => <CasinoCard key={event.id} event={event} />)}
            </div>
          )}
        </section>
      )}

      {/* ── ALL GAMES ── */}
      <section>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Crown size={20} style={{ color: "#f5c542" }} />
            <span>All Casino Games</span>
          </h2>
          <span className="text-xs font-semibold" style={{ color: "rgba(245,197,66,0.55)" }}>
            {CASINO_GAMES.length} games
          </span>
        </div>

        {/* Featured Hero Card — Teen Patti */}
        <div
          className="relative overflow-hidden rounded-3xl mb-5 cursor-pointer group"
          onClick={() => setLocation("/play/teen-patti")}
          style={{ minHeight: 200, background: "linear-gradient(135deg,#0d2b1a,#1a4a2b,#0a2414)", border: "1px solid rgba(245,197,66,0.35)" }}
        >
          <div className="pointer-events-none absolute -right-10 -top-10 w-64 h-64 rounded-full" style={{ background: "rgba(245,197,66,0.06)", filter: "blur(60px)" }} />
          <div className="pointer-events-none absolute inset-0 select-none flex flex-wrap gap-4 p-4 text-5xl" style={{ opacity: 0.03 }}>
            {["♠","♥","♣","♦","♠","♥","♣","♦"].map((s, i) => <span key={i}>{s}</span>)}
          </div>

          {/* Decorative cards */}
          <div className="pointer-events-none absolute right-6 bottom-0 hidden sm:flex items-end gap-1">
            {[
              { r: "A", s: "♥", c: "text-red-600", cls: "-rotate-12" },
              { r: "K", s: "♠", c: "text-gray-900", cls: "translate-y-[-16px] z-10" },
              { r: "Q", s: "♦", c: "text-red-600", cls: "rotate-12" },
            ].map((c, i) => (
              <div key={i} className={`w-16 rounded-xl flex flex-col items-center justify-center transition-transform group-hover:scale-105 ${c.cls}`} style={{ height: 88, background: "white", border: "2px solid #e5e7eb" }}>
                <span className={`text-2xl font-black ${c.c}`}>{c.r}</span>
                <span className={`text-xl ${c.c}`}>{c.s}</span>
              </div>
            ))}
          </div>

          <div className="relative z-10 p-7">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider mb-3" style={{ background: "rgba(239,68,68,0.2)", border: "1px solid rgba(239,68,68,0.35)", color: "#f87171" }}>
              <Flame size={11} /> Hottest Game
            </div>
            <h3 className="text-4xl font-black text-white mb-2 tracking-tight">Teen Patti</h3>
            <p className="text-sm mb-5" style={{ color: "rgba(255,255,255,0.55)" }}>The legendary 3-card Indian poker · Real players · High stakes</p>
            <div className="flex items-center gap-4">
              <button
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all hover:scale-105 active:scale-95"
                style={{ background: "linear-gradient(135deg,#d4a017,#f5c542)", color: "#081c0e", boxShadow: "0 0 20px rgba(245,197,66,0.4)" }}
              >
                Play Now <Gamepad2 size={16} />
              </button>
              <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "rgba(255,255,255,0.45)" }}>
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> 12,450 Playing
              </div>
            </div>
          </div>
        </div>

        {/* Rest of games grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {CASINO_GAMES.filter(g => g.slug !== "teen-patti").map(game => (
            <button
              key={game.slug}
              onClick={() => setLocation(`/play/${game.slug}`)}
              className="relative group rounded-2xl p-4 flex flex-col text-left transition-all hover:scale-[1.03] hover:-translate-y-1 active:scale-95"
              style={{ background: "linear-gradient(135deg,#113a21,#0a2414)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              {/* Hover glow overlay */}
              <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" style={{ background: "linear-gradient(135deg,rgba(245,197,66,0.05),transparent)", border: "1px solid rgba(245,197,66,0.25)" }} />

              <div className="relative flex justify-between items-start mb-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ background: "rgba(10,36,20,0.9)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  {game.emoji}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1 text-[9px] font-bold rounded-full px-1.5 py-0.5" style={{ background: "rgba(0,0,0,0.4)", color: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> {game.players}
                  </div>
                  {game.tag && (
                    <div className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${game.tagColor}22`, color: game.tagColor, border: `1px solid ${game.tagColor}44` }}>
                      {game.tag}
                    </div>
                  )}
                </div>
              </div>

              <div className="relative mt-auto">
                <h4 className="text-sm font-bold leading-tight group-hover:text-yellow-400 transition-colors" style={{ color: "white" }}>{game.label}</h4>
                <p className="text-[10px] mt-0.5 line-clamp-1" style={{ color: "rgba(255,255,255,0.38)" }}>{game.desc}</p>
              </div>

              {/* Play button overlay on hover */}
              <div className="absolute inset-0 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all pointer-events-none" style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)" }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg" style={{ background: "linear-gradient(135deg,#d4a017,#f5c542)" }}>
                  <Gamepad2 size={18} style={{ color: "#081c0e" }} />
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
