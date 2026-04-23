import { useState } from "react";
import { useLocation } from "wouter";
import { useGetEvents, useGetLiveEvents, getGetEventsQueryKey, getGetLiveEventsQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth-context";
import { EventCard } from "@/components/EventCard";
import { CasinoCard } from "@/components/CasinoCard";
import { Activity, CalendarDays, Gem, Trophy, Zap, Users, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { CASINO_SPORTS, CASINO_ICONS, CASINO_DESC } from "@/lib/casino-config";

const SPORTS = ["All", "Football", "Basketball", "Tennis", "Cricket"];

const SPORT_ICONS: Record<string, string> = {
  All: "🌐",
  Football: "⚽",
  Basketball: "🏀",
  Tennis: "🎾",
  Cricket: "🏏",
  Casino: "🎰",
};

const QUICK_STATS = [
  { icon: <Zap className="h-4 w-4" />, value: "12", label: "Live Now" },
  { icon: <TrendingUp className="h-4 w-4" />, value: "PKR 2Cr+", label: "Paid Out" },
  { icon: <Users className="h-4 w-4" />, value: "50K+", label: "Players" },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState("All");
  const [selectedCasinoGame, setSelectedCasinoGame] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();

  const isCasino = activeTab === "Casino";
  const sportParam = activeTab === "All" || isCasino ? undefined : activeTab;

  const { data: events, isLoading: isLoadingEvents } = useGetEvents(
    { sport: sportParam, status: "upcoming" },
    { query: { queryKey: getGetEventsQueryKey({ sport: sportParam, status: "upcoming" }) } }
  );

  const { data: liveEvents, isLoading: isLoadingLive } = useGetLiveEvents(
    { query: { queryKey: getGetLiveEventsQueryKey() } }
  );

  const filteredUpcoming = isCasino
    ? (events?.filter(e =>
        CASINO_SPORTS.includes(e.sport) &&
        (selectedCasinoGame === null || e.sport === selectedCasinoGame)
      ) || [])
    : (events || []);

  const filteredLive = liveEvents?.filter(e => {
    if (activeTab === "All") return true;
    if (isCasino) {
      const isCasinoSport = CASINO_SPORTS.includes(e.sport);
      if (!isCasinoSport) return false;
      return selectedCasinoGame === null || e.sport === selectedCasinoGame;
    }
    return e.sport === activeTab;
  }) || [];

  const handleTabChange = (v: string) => {
    setActiveTab(v);
    setSelectedCasinoGame(null);
  };

  const toggleCasinoGame = (game: string) => {
    setSelectedCasinoGame(prev => (prev === game ? null : game));
  };

  return (
    <div className="space-y-6">

      {/* ── HERO BANNER ── */}
      <section
        className="relative overflow-hidden rounded-2xl"
        style={{
          background: "linear-gradient(135deg, #064e3b 0%, #0a6b52 30%, #1a3a5c 65%, #1e1b4b 100%)",
          minHeight: 180,
        }}
      >
        {/* Decorative circles */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-12 -right-12 h-56 w-56 rounded-full" style={{ background: "rgba(16,185,129,0.15)" }} />
          <div className="absolute -bottom-16 -left-8 h-48 w-48 rounded-full" style={{ background: "rgba(99,102,241,0.12)" }} />
        </div>

        <div className="relative z-10 flex flex-col gap-4 p-5 sm:p-7 md:flex-row md:items-center md:justify-between">
          {/* Left: Headline */}
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-green-400/30 bg-green-400/10 px-3 py-1 text-xs font-semibold text-green-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
              LIVE BETTING OPEN
            </div>
            <h1 className="text-2xl font-extrabold text-white sm:text-3xl">
              Win Big on <span style={{ color: "#34d399" }}>Every Match</span>
            </h1>
            <p className="mt-1 text-sm text-white/60">Cricket · Football · Casino · PKR Payouts</p>

            {/* Quick stats row */}
            <div className="mt-4 flex flex-wrap gap-5">
              {QUICK_STATS.map(s => (
                <div key={s.label} className="flex items-center gap-2">
                  <span className="text-green-400">{s.icon}</span>
                  <div>
                    <div className="text-sm font-bold text-white">{s.value}</div>
                    <div className="text-[10px] text-white/50">{s.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Quick play casino games */}
          <div className="flex flex-wrap gap-2 md:flex-col md:items-end">
            {[
              { href: "/play/dragon-tiger", label: "Dragon Tiger", emoji: "🐲", color: "linear-gradient(135deg,#7f1d1d,#991b1b)", badge: "Cards" },
              { href: "/play/coin-flip",    label: "Coin Flip",    emoji: "🪙", color: "linear-gradient(135deg,#92400e,#b45309)", badge: "1.95×" },
              { href: "/play/dice-roll",    label: "Dice Roll",    emoji: "🎲", color: "linear-gradient(135deg,#1e3a8a,#1d4ed8)", badge: "Lucky 7" },
              { href: "/play/andar-bahar",  label: "Andar Bahar",  emoji: "🃏", color: "linear-gradient(135deg,#064e3b,#065f46)", badge: "Cards" },
              { href: "/play/rang",         label: "Rang",         emoji: "🃏", color: "linear-gradient(135deg,#78350f,#b45309)", badge: "Trump" },
              { href: "/play/court-piece",  label: "Court Piece",  emoji: "🃏", color: "linear-gradient(135deg,#064e3b,#0f766e)", badge: "Cards" },
            ].map(g => (
              <button
                key={g.href}
                onClick={() => setLocation(g.href)}
                className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition-all hover:scale-105 active:scale-95"
                style={{ background: g.color, boxShadow: "0 2px 12px rgba(0,0,0,0.3)" }}
              >
                {g.emoji} {g.label}
                <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[9px]">{g.badge}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── SPORT TABS ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            {isCasino ? <><Gem className="h-5 w-5 text-purple-500" /> Casino Games</> : <><Trophy className="h-5 w-5 text-primary" /> Sports Betting</>}
          </h2>
        </div>

        {/* Scrollable pill tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide" style={{ scrollbarWidth: "none" }}>
          {SPORTS.map((sport) => (
            <button
              key={sport}
              onClick={() => handleTabChange(sport)}
              data-testid={`tab-sport-${sport}`}
              className="flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-all"
              style={{
                background: activeTab === sport
                  ? "linear-gradient(135deg, #059669, #065f46)"
                  : "rgba(255,255,255,0.06)",
                color: activeTab === sport ? "white" : "rgba(255,255,255,0.55)",
                border: activeTab === sport ? "none" : "1px solid rgba(255,255,255,0.1)",
                boxShadow: activeTab === sport ? "0 2px 12px rgba(5,150,105,0.35)" : "none",
              }}
            >
              <span>{SPORT_ICONS[sport]}</span>
              {sport}
            </button>
          ))}
          <button
            onClick={() => handleTabChange("Casino")}
            data-testid="tab-sport-Casino"
            className="flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-all"
            style={{
              background: activeTab === "Casino"
                ? "linear-gradient(135deg, #7c3aed, #4f46e5)"
                : "rgba(255,255,255,0.06)",
              color: activeTab === "Casino" ? "white" : "rgba(255,255,255,0.55)",
              border: activeTab === "Casino" ? "none" : "1px solid rgba(255,255,255,0.1)",
              boxShadow: activeTab === "Casino" ? "0 2px 12px rgba(124,58,237,0.35)" : "none",
            }}
          >
            🎰 Casino
          </button>
        </div>
      </section>

      {/* ── CASINO GAME PICKER ── */}
      {isCasino && (
        <section>
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {selectedCasinoGame
              ? `${CASINO_ICONS[selectedCasinoGame]} ${selectedCasinoGame} — tap again to show all`
              : "Pick a game to filter:"}
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {CASINO_SPORTS.map(game => {
              const isActive = selectedCasinoGame === game;
              return (
                <button
                  key={game}
                  onClick={() => toggleCasinoGame(game)}
                  className="rounded-xl border-2 p-3 text-center transition-all hover:scale-105 active:scale-95"
                  style={{
                    borderColor: isActive ? "#a855f7" : "rgba(168,85,247,0.25)",
                    background: isActive ? "rgba(168,85,247,0.25)" : "rgba(168,85,247,0.07)",
                    boxShadow: isActive ? "0 0 16px rgba(168,85,247,0.3)" : "none",
                    transform: isActive ? "scale(1.05)" : "scale(1)",
                  }}
                >
                  <div className="text-2xl mb-1">{CASINO_ICONS[game]}</div>
                  <div className="text-[11px] font-bold text-foreground leading-tight">{game}</div>
                  {isActive && <div className="mt-1 text-[9px] font-bold text-purple-400">● ON</div>}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ── PROMOTIONAL BANNER ── */}
      {!isAuthenticated && (
        <section
          className="flex flex-col items-center justify-between gap-4 rounded-xl p-5 sm:flex-row"
          style={{
            background: "linear-gradient(135deg, rgba(245,158,11,0.12), rgba(234,88,12,0.10))",
            border: "1px solid rgba(245,158,11,0.25)",
          }}
        >
          <div>
            <div className="text-base font-bold text-amber-400">🎁 Welcome Bonus — PKR 50,000 Free Credits!</div>
            <div className="mt-0.5 text-xs text-muted-foreground">Create a free account and start betting with bonus balance today.</div>
          </div>
          <button
            onClick={() => setLocation("/register")}
            className="shrink-0 rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-all hover:scale-105"
            style={{ background: "linear-gradient(135deg, #d97706, #b45309)", boxShadow: "0 4px 12px rgba(217,119,6,0.35)" }}
          >
            Claim Bonus →
          </button>
        </section>
      )}

      {/* ── LIVE EVENTS ── */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
          <h2 className="text-lg font-bold text-red-500 flex items-center gap-2">
            <Activity className="h-5 w-5" />
            {isCasino ? "Live Rounds" : "Live Now"}
          </h2>
          {filteredLive.length > 0 && (
            <span className="rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-bold text-red-400 border border-red-500/20">
              {filteredLive.length}
            </span>
          )}
        </div>

        {isLoadingLive ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2].map(i => <Skeleton key={i} className="h-48 w-full rounded-xl bg-card/40" />)}
          </div>
        ) : filteredLive.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredLive.map(event =>
              isCasino
                ? <CasinoCard key={event.id} event={event} />
                : <EventCard key={event.id} event={event} />
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center rounded-xl border border-border/30 bg-card/20 p-8 text-center text-muted-foreground">
            <Activity className="mb-2 h-8 w-8 opacity-20" />
            <p className="text-sm">No live {isCasino ? "rounds" : "events"} right now</p>
          </div>
        )}
      </section>

      {/* ── UPCOMING ── */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            {isCasino
              ? selectedCasinoGame
                ? `${CASINO_ICONS[selectedCasinoGame]} ${selectedCasinoGame} Rounds`
                : "Open Rounds"
              : "Upcoming Matches"}
          </h2>
          {filteredUpcoming.length > 0 && (
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary border border-primary/20">
              {filteredUpcoming.length}
            </span>
          )}
        </div>

        {isLoadingEvents ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 w-full rounded-xl bg-card/40" />)}
          </div>
        ) : filteredUpcoming.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredUpcoming.map(event =>
              isCasino
                ? <CasinoCard key={event.id} event={event} />
                : <EventCard key={event.id} event={event} />
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center rounded-xl border border-border/30 bg-card/20 p-8 text-center text-muted-foreground">
            <CalendarDays className="mb-2 h-8 w-8 opacity-20" />
            <p className="text-sm">
              {isCasino && selectedCasinoGame
                ? `No open ${selectedCasinoGame} rounds right now.`
                : isCasino
                ? "No open casino rounds right now."
                : `No upcoming ${activeTab === "All" ? "" : activeTab + " "}events.`}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
