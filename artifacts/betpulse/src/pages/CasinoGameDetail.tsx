import { Link, useLocation } from "wouter";
import { useBetSlip } from "@/lib/bet-slip-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, PlayCircle, Clock, CheckCircle2, Gamepad2 } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import type { Event } from "@workspace/api-client-react/src/generated/api.schemas";

interface GameStyle {
  homeColor: string;
  awayColor: string;
  homeIcon: string;
  awayIcon: string;
  tableBg: string;
  tieColor: string;
}

const GAME_STYLES: Record<string, GameStyle> = {
  "Dragon Tiger": {
    homeColor: "from-red-950 via-red-900/80 to-red-950 border-red-500/60 text-red-100",
    awayColor: "from-blue-950 via-blue-900/80 to-blue-950 border-blue-500/60 text-blue-100",
    homeIcon: "🐉",
    awayIcon: "🐯",
    tableBg: "from-green-950 via-green-900/40 to-green-950",
    tieColor: "from-yellow-900/60 to-yellow-800/40 border-yellow-500/50 text-yellow-100",
  },
  "Teen Patti": {
    homeColor: "from-green-950 via-green-900/80 to-green-950 border-green-400/60 text-green-100",
    awayColor: "from-red-950 via-red-900/80 to-red-950 border-red-500/60 text-red-100",
    homeIcon: "🃏",
    awayIcon: "🏦",
    tableBg: "from-emerald-950 via-emerald-900/40 to-emerald-950",
    tieColor: "from-yellow-900/60 to-yellow-800/40 border-yellow-500/50 text-yellow-100",
  },
  "Andar Bahar": {
    homeColor: "from-orange-950 via-orange-900/80 to-orange-950 border-orange-500/60 text-orange-100",
    awayColor: "from-purple-950 via-purple-900/80 to-purple-950 border-purple-500/60 text-purple-100",
    homeIcon: "🎴",
    awayIcon: "🎴",
    tableBg: "from-teal-950 via-teal-900/40 to-teal-950",
    tieColor: "from-yellow-900/60 to-yellow-800/40 border-yellow-500/50 text-yellow-100",
  },
  "Rang": {
    homeColor: "from-emerald-950 via-emerald-900/80 to-emerald-950 border-emerald-400/60 text-emerald-100",
    awayColor: "from-rose-950 via-rose-900/80 to-rose-950 border-rose-500/60 text-rose-100",
    homeIcon: "♠️",
    awayIcon: "♥️",
    tableBg: "from-green-950 via-green-900/40 to-green-950",
    tieColor: "from-yellow-900/60 to-yellow-800/40 border-yellow-500/50 text-yellow-100",
  },
  "Piec": {
    homeColor: "from-cyan-950 via-cyan-900/80 to-cyan-950 border-cyan-400/60 text-cyan-100",
    awayColor: "from-amber-950 via-amber-900/80 to-amber-950 border-amber-500/60 text-amber-100",
    homeIcon: "🂡",
    awayIcon: "🂱",
    tableBg: "from-green-950 via-green-900/40 to-green-950",
    tieColor: "from-yellow-900/60 to-yellow-800/40 border-yellow-500/50 text-yellow-100",
  },
};

const DEFAULT_STYLE: GameStyle = {
  homeColor: "from-slate-900 via-slate-800 to-slate-900 border-slate-500/60 text-slate-100",
  awayColor: "from-zinc-900 via-zinc-800 to-zinc-900 border-zinc-500/60 text-zinc-100",
  homeIcon: "🃏",
  awayIcon: "🃏",
  tableBg: "from-green-950 via-green-900/40 to-green-950",
  tieColor: "from-yellow-900/60 to-yellow-800/40 border-yellow-500/50 text-yellow-100",
};

function CardBack({ color }: { color: "red" | "blue" | "green" | "gold" }) {
  const colors: Record<string, string> = {
    red: "from-red-800 to-red-950 border-red-400",
    blue: "from-blue-800 to-blue-950 border-blue-400",
    green: "from-emerald-800 to-emerald-950 border-emerald-400",
    gold: "from-yellow-700 to-yellow-900 border-yellow-400",
  };
  return (
    <div className={`relative w-16 h-24 rounded-lg border-2 bg-gradient-to-br ${colors[color]} shadow-xl flex items-center justify-center`}>
      <div className="absolute inset-1 rounded border border-white/20 flex items-center justify-center">
        <div className="grid grid-cols-3 gap-0.5 opacity-30">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-white" />
          ))}
        </div>
      </div>
    </div>
  );
}

interface Props {
  event: Event;
}

export function CasinoGameDetail({ event }: Props) {
  const { addItem, removeItem, items } = useBetSlip();
  const [, setLocation] = useLocation();
  const style = GAME_STYLES[event.sport] ?? DEFAULT_STYLE;
  const isLive = event.status === "live";
  const isFinished = event.status === "finished";
  const hasTie = event.oddsDraw > 0;

  const isSelected = (s: "home" | "draw" | "away") =>
    items.some(i => i.eventId === event.id && i.selection === s);

  const handleToggle = (s: "home" | "draw" | "away", odds: number) => {
    if (isFinished) return;
    const id = `${event.id}-${s}`;
    if (isSelected(s)) {
      removeItem(id);
    } else {
      addItem({ eventId: event.id, homeTeam: event.homeTeam, awayTeam: event.awayTeam, selection: s, odds });
    }
  };

  const cardColorHome = event.sport === "Dragon Tiger" ? "red"
    : event.sport === "Rang" ? "green"
    : event.sport === "Andar Bahar" ? "red"
    : "green";

  const cardColorAway = event.sport === "Dragon Tiger" ? "blue"
    : event.sport === "Rang" ? "red"
    : event.sport === "Andar Bahar" ? "blue"
    : "blue";

  return (
    <div className="space-y-4">
      <Link href="/" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Casino
      </Link>

      {/* Dragon Tiger: Play Now banner */}
      {event.sport === "Dragon Tiger" && (
        <button
          onClick={() => setLocation("/play/dragon-tiger")}
          className="w-full flex items-center justify-between rounded-xl px-5 py-4 transition-all hover:opacity-90 active:scale-[0.99]"
          style={{
            background: "linear-gradient(135deg, #7f1d1d 0%, #991b1b 40%, #1e3a5f 100%)",
            border: "1px solid rgba(220,38,38,0.5)",
          }}
        >
          <div className="flex items-center gap-3">
            <span style={{ fontSize: 28 }}>🐉🐯</span>
            <div className="text-left">
              <p className="font-bold text-white text-sm">Play Dragon Tiger — Live Game</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>Real animated cards • Instant results • Win up to 9x</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-white font-bold text-sm border border-white/30 rounded-lg px-3 py-1.5" style={{ background: "rgba(255,255,255,0.1)" }}>
            <Gamepad2 className="h-4 w-4" />
            Play Now
          </div>
        </button>
      )}

      {/* Table header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge className="font-mono uppercase tracking-wider bg-purple-600 text-white border-none">
            {event.sport}
          </Badge>
          {event.league && <span className="text-sm text-muted-foreground">{event.league}</span>}
        </div>
        {isLive ? (
          <Badge variant="destructive" className="animate-pulse shadow-[0_0_12px_rgba(220,38,38,0.6)]">
            <PlayCircle className="mr-1 h-3 w-3" /> LIVE
          </Badge>
        ) : isFinished ? (
          <Badge variant="outline" className="text-muted-foreground">
            <CheckCircle2 className="mr-1 h-3 w-3" /> FINISHED
          </Badge>
        ) : (
          <div className="flex items-center text-sm text-muted-foreground">
            <Clock className="mr-1.5 h-4 w-4 text-primary" />
            {formatDateTime(event.startTime)}
          </div>
        )}
      </div>

      {/* Casino Table */}
      <div className={`rounded-2xl bg-gradient-to-br ${style.tableBg} border border-green-700/30 p-6 shadow-2xl`}>
        {/* Felt ring decoration */}
        <div className="rounded-xl border border-white/5 p-4">

          {/* Card reveal area */}
          <div className="flex items-center justify-center gap-6 mb-8">
            <div className="flex flex-col items-center gap-2">
              <CardBack color={cardColorHome as any} />
              {isFinished && event.result === "home" && (
                <span className="text-xs font-bold text-green-400 animate-bounce">WINNER ✓</span>
              )}
            </div>

            <div className="text-center px-4">
              {isLive ? (
                <div className="flex flex-col items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xs text-green-300/60 font-mono">DEALING...</span>
                </div>
              ) : isFinished ? (
                <span className="text-lg font-black text-white/30">END</span>
              ) : (
                <span className="text-lg font-black text-white/20">VS</span>
              )}
            </div>

            <div className="flex flex-col items-center gap-2">
              <CardBack color={cardColorAway as any} />
              {isFinished && event.result === "away" && (
                <span className="text-xs font-bold text-green-400 animate-bounce">WINNER ✓</span>
              )}
            </div>
          </div>

          {/* Result banner when finished */}
          {isFinished && event.result && (
            <div className="mb-6 rounded-lg bg-green-500/10 border border-green-500/30 p-3 text-center">
              <p className="text-green-400 font-bold text-lg">
                {event.result === "home" ? `🏆 ${event.homeTeam} Wins!`
                  : event.result === "away" ? `🏆 ${event.awayTeam} Wins!`
                  : "🤝 It's a Tie!"}
              </p>
            </div>
          )}

          {/* Bet panels */}
          <div className={`grid gap-4 ${hasTie ? "grid-cols-3" : "grid-cols-2"}`}>
            {/* Home side */}
            <button
              onClick={() => handleToggle("home", event.oddsHome)}
              disabled={isFinished}
              className={`relative rounded-xl border-2 bg-gradient-to-br ${style.homeColor} p-4 text-center transition-all hover:scale-105 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 ${isSelected("home") ? "ring-2 ring-white ring-offset-1 ring-offset-transparent scale-105" : ""}`}
            >
              {isSelected("home") && (
                <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                  <CheckCircle2 className="w-3 h-3 text-white" />
                </div>
              )}
              <div className="text-3xl mb-2">{style.homeIcon}</div>
              <div className="font-black text-lg tracking-wide">{event.homeTeam}</div>
              <div className="mt-2 text-2xl font-black font-mono opacity-90">{event.oddsHome.toFixed(2)}x</div>
              <div className="mt-1 text-xs opacity-60">
                {isSelected("home") ? "✓ Selected" : "Click to bet"}
              </div>
            </button>

            {/* Tie */}
            {hasTie && (
              <button
                onClick={() => handleToggle("draw", event.oddsDraw)}
                disabled={isFinished}
                className={`relative rounded-xl border-2 bg-gradient-to-br ${style.tieColor} p-4 text-center transition-all hover:scale-105 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 ${isSelected("draw") ? "ring-2 ring-white ring-offset-1 ring-offset-transparent scale-105" : ""}`}
              >
                {isSelected("draw") && (
                  <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                    <CheckCircle2 className="w-3 h-3 text-white" />
                  </div>
                )}
                <div className="text-3xl mb-2">🤝</div>
                <div className="font-black text-lg tracking-wide">TIE</div>
                <div className="mt-2 text-2xl font-black font-mono opacity-90">{event.oddsDraw.toFixed(2)}x</div>
                <div className="mt-1 text-xs opacity-60">
                  {isSelected("draw") ? "✓ Selected" : "Highest payout"}
                </div>
              </button>
            )}

            {/* Away side */}
            <button
              onClick={() => handleToggle("away", event.oddsAway)}
              disabled={isFinished}
              className={`relative rounded-xl border-2 bg-gradient-to-br ${style.awayColor} p-4 text-center transition-all hover:scale-105 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 ${isSelected("away") ? "ring-2 ring-white ring-offset-1 ring-offset-transparent scale-105" : ""}`}
            >
              {isSelected("away") && (
                <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                  <CheckCircle2 className="w-3 h-3 text-white" />
                </div>
              )}
              <div className="text-3xl mb-2">{style.awayIcon}</div>
              <div className="font-black text-lg tracking-wide">{event.awayTeam}</div>
              <div className="mt-2 text-2xl font-black font-mono opacity-90">{event.oddsAway.toFixed(2)}x</div>
              <div className="mt-1 text-xs opacity-60">
                {isSelected("away") ? "✓ Selected" : "Click to bet"}
              </div>
            </button>
          </div>

          {/* Info strip */}
          <div className="mt-4 flex items-center justify-between text-xs text-green-300/40 font-mono">
            <span>ROUND #{event.id}</span>
            {isFinished ? (
              <span>CLOSED</span>
            ) : (
              <span>{isLive ? "🟢 ACCEPTING BETS" : "⏳ OPEN FOR BETS"}</span>
            )}
            <span>HOUSE CONTROLLED</span>
          </div>
        </div>
      </div>

      {/* How to play tip */}
      {!isFinished && (
        <div className="rounded-xl border border-border/30 bg-card/30 p-4">
          <p className="text-sm text-muted-foreground">
            <span className="font-bold text-foreground">How to play: </span>
            Pick your side above → it gets added to your Bet Slip on the right → enter your stake amount → click <strong>Place Bet</strong>.
            {hasTie && <> Tie pays <strong>{event.oddsDraw.toFixed(2)}x</strong> — highest reward but rarest outcome.</>}
          </p>
        </div>
      )}
    </div>
  );
}
