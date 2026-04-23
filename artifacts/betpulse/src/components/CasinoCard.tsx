import { Link } from "wouter";
import { useBetSlip } from "@/lib/bet-slip-context";
import { Badge } from "@/components/ui/badge";
import { PlayCircle, Clock, CheckCircle2 } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import type { Event } from "@workspace/api-client-react/src/generated/api.schemas";
import { CASINO_ICONS } from "@/lib/casino-config";

const SIDE_COLORS: Record<string, { home: string; away: string; tie: string }> = {
  "Dragon Tiger": {
    home: "bg-red-900/40 border-red-500/40 hover:bg-red-800/50 text-red-100",
    away: "bg-blue-900/40 border-blue-500/40 hover:bg-blue-800/50 text-blue-100",
    tie: "bg-yellow-900/40 border-yellow-500/40 hover:bg-yellow-800/50 text-yellow-100",
  },
  "Teen Patti": {
    home: "bg-green-900/40 border-green-500/40 hover:bg-green-800/50 text-green-100",
    away: "bg-red-900/40 border-red-500/40 hover:bg-red-800/50 text-red-100",
    tie: "bg-yellow-900/40 border-yellow-500/40 hover:bg-yellow-800/50 text-yellow-100",
  },
  "Andar Bahar": {
    home: "bg-orange-900/40 border-orange-500/40 hover:bg-orange-800/50 text-orange-100",
    away: "bg-purple-900/40 border-purple-500/40 hover:bg-purple-800/50 text-purple-100",
    tie: "bg-yellow-900/40 border-yellow-500/40 hover:bg-yellow-800/50 text-yellow-100",
  },
  "Rang": {
    home: "bg-emerald-900/40 border-emerald-500/40 hover:bg-emerald-800/50 text-emerald-100",
    away: "bg-rose-900/40 border-rose-500/40 hover:bg-rose-800/50 text-rose-100",
    tie: "bg-yellow-900/40 border-yellow-500/40 hover:bg-yellow-800/50 text-yellow-100",
  },
  "Piec": {
    home: "bg-cyan-900/40 border-cyan-500/40 hover:bg-cyan-800/50 text-cyan-100",
    away: "bg-amber-900/40 border-amber-500/40 hover:bg-amber-800/50 text-amber-100",
    tie: "bg-yellow-900/40 border-yellow-500/40 hover:bg-yellow-800/50 text-yellow-100",
  },
};

const DEFAULT_COLORS = {
  home: "bg-slate-800/40 border-slate-500/40 hover:bg-slate-700/50 text-slate-100",
  away: "bg-zinc-800/40 border-zinc-500/40 hover:bg-zinc-700/50 text-zinc-100",
  tie: "bg-yellow-900/40 border-yellow-500/40 hover:bg-yellow-800/50 text-yellow-100",
};

export function CasinoCard({ event }: { event: Event }) {
  const { addItem, removeItem, items } = useBetSlip();
  const colors = SIDE_COLORS[event.sport] ?? DEFAULT_COLORS;
  const icon = CASINO_ICONS[event.sport] ?? "🃏";
  const isLive = event.status === "live";
  const isFinished = event.status === "finished";
  const hasTie = event.oddsDraw > 0;

  const isSelected = (s: "home" | "draw" | "away") =>
    items.some(i => i.eventId === event.id && i.selection === s);

  const handleToggle = (s: "home" | "draw" | "away", odds: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isFinished) return;
    const id = `${event.id}-${s}`;
    if (isSelected(s)) {
      removeItem(id);
    } else {
      addItem({ eventId: event.id, homeTeam: event.homeTeam, awayTeam: event.awayTeam, selection: s, odds });
    }
  };

  return (
    <Link href={`/events/${event.id}`}>
      <div className="rounded-xl border border-purple-500/20 bg-gradient-to-br from-purple-950/30 to-card/60 overflow-hidden cursor-pointer transition-all hover:border-purple-400/40 hover:shadow-[0_0_20px_rgba(147,51,234,0.15)]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">{icon}</span>
            <Badge className="text-[10px] bg-purple-600/80 text-white border-none uppercase tracking-wider font-mono">
              {event.sport}
            </Badge>
            {event.league && (
              <span className="text-[10px] text-muted-foreground">{event.league}</span>
            )}
          </div>
          {isLive ? (
            <Badge variant="destructive" className="text-[10px] animate-pulse">
              <PlayCircle className="mr-0.5 h-2.5 w-2.5" /> LIVE
            </Badge>
          ) : isFinished ? (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">ENDED</Badge>
          ) : (
            <div className="flex items-center text-[10px] text-muted-foreground">
              <Clock className="mr-1 h-3 w-3" />
              {formatDateTime(event.startTime)}
            </div>
          )}
        </div>

        {/* Finished result banner */}
        {isFinished && event.result && (
          <div className="mx-3 mb-2 rounded-lg bg-green-500/10 border border-green-500/20 py-1 text-center">
            <span className="text-xs font-bold text-green-400">
              {event.result === "home" ? `🏆 ${event.homeTeam} Won`
                : event.result === "away" ? `🏆 ${event.awayTeam} Won`
                : "🤝 Tie"}
            </span>
          </div>
        )}

        {/* Bet buttons */}
        <div className={`grid gap-2 px-3 pb-3 ${hasTie ? "grid-cols-3" : "grid-cols-2"}`}>
          {/* Home */}
          <button
            onClick={(e) => handleToggle("home", event.oddsHome, e)}
            disabled={isFinished}
            className={`relative rounded-lg border p-2.5 text-center transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${colors.home} ${isSelected("home") ? "ring-2 ring-white/60 ring-offset-1 ring-offset-transparent" : ""}`}
          >
            {isSelected("home") && (
              <CheckCircle2 className="absolute top-1 right-1 h-3 w-3 text-green-400" />
            )}
            <div className="text-xs font-bold truncate">{event.homeTeam}</div>
            <div className="text-base font-black font-mono mt-0.5">{event.oddsHome.toFixed(2)}x</div>
          </button>

          {/* Tie */}
          {hasTie && (
            <button
              onClick={(e) => handleToggle("draw", event.oddsDraw, e)}
              disabled={isFinished}
              className={`relative rounded-lg border p-2.5 text-center transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${colors.tie} ${isSelected("draw") ? "ring-2 ring-white/60 ring-offset-1 ring-offset-transparent" : ""}`}
            >
              {isSelected("draw") && (
                <CheckCircle2 className="absolute top-1 right-1 h-3 w-3 text-green-400" />
              )}
              <div className="text-xs font-bold">TIE</div>
              <div className="text-base font-black font-mono mt-0.5">{event.oddsDraw.toFixed(2)}x</div>
            </button>
          )}

          {/* Away */}
          <button
            onClick={(e) => handleToggle("away", event.oddsAway, e)}
            disabled={isFinished}
            className={`relative rounded-lg border p-2.5 text-center transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${colors.away} ${isSelected("away") ? "ring-2 ring-white/60 ring-offset-1 ring-offset-transparent" : ""}`}
          >
            {isSelected("away") && (
              <CheckCircle2 className="absolute top-1 right-1 h-3 w-3 text-green-400" />
            )}
            <div className="text-xs font-bold truncate">{event.awayTeam}</div>
            <div className="text-base font-black font-mono mt-0.5">{event.oddsAway.toFixed(2)}x</div>
          </button>
        </div>

        <div className="px-4 pb-2 text-[10px] text-muted-foreground/40 font-mono text-right">
          tap card for details →
        </div>
      </div>
    </Link>
  );
}
