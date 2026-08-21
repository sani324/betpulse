import { useState, useEffect } from "react";
import { useGetBets, getGetBetsQueryKey } from "@workspace/api-client-react";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Ticket, CheckCircle2, XCircle, Clock, Dices } from "lucide-react";

type CasinoBet = {
  id: number;
  type: "casino";
  game: string;
  gameName: string;
  roundId: string;
  selection: string;
  stake: number;
  payout: number | null;
  status: string;
  result: string | null;
  createdAt: string;
  settledAt: string | null;
};

export default function MyBets() {
  const [status, setStatus] = useState<string>("all");
  const [casinoBets, setCasinoBets] = useState<CasinoBet[]>([]);
  const [casinoLoading, setCasinoLoading] = useState(true);

  const { data: sportsBets, isLoading: sportsLoading } = useGetBets(
    {},
    { query: { queryKey: getGetBetsQueryKey({}) } }
  );

  useEffect(() => {
    fetch("/api/bets/casino", { credentials: "include" })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setCasinoBets(data); })
      .catch(() => {})
      .finally(() => setCasinoLoading(false));
  }, []);

  const isLoading = sportsLoading || casinoLoading;

  const allBets = [
    ...(casinoBets.map(b => ({ ...b, _kind: "casino" as const }))),
    ...((sportsBets ?? []).map(b => ({ ...b, _kind: "sports" as const }))),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const filtered = allBets.filter(bet => {
    if (status === "all") return true;
    if (status === "won") return bet.status === "won";
    if (status === "lost") return bet.status === "lost";
    if (status === "pending") return bet.status === "pending";
    return true;
  });

  const counts = {
    all: allBets.length,
    pending: allBets.filter(b => b.status === "pending").length,
    won: allBets.filter(b => b.status === "won").length,
    lost: allBets.filter(b => b.status === "lost").length,
  };

  const getStatusIcon = (s: string) => {
    if (s === "won") return <CheckCircle2 className="h-3.5 w-3.5" />;
    if (s === "lost") return <XCircle className="h-3.5 w-3.5" />;
    return <Clock className="h-3.5 w-3.5" />;
  };

  const getStatusStyle = (s: string) => {
    if (s === "won") return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    if (s === "lost") return "bg-red-500/20 text-red-400 border-red-500/30";
    return "bg-blue-500/20 text-blue-400 border-blue-500/30";
  };

  const capitalize = (str: string) =>
    str.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => window.history.length > 1 ? window.history.back() : (window.location.href = "/")}
            className="flex items-center gap-1.5 text-slate-300 hover:text-white font-bold text-sm bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700 transition"
          >
            <span>← Back</span>
          </button>
          <Ticket className="h-7 w-7 text-yellow-400" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">My Bets</h1>
            <p className="text-sm text-muted-foreground">{counts.all} total · {counts.pending} pending · {counts.won} won · {counts.lost} lost</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="all" value={status} onValueChange={setStatus}>
        <TabsList className="bg-card/50 border border-border/30 p-1 mb-6 w-full sm:w-auto">
          <TabsTrigger value="all" className="gap-1.5">All <span className="text-[11px] tabular-nums opacity-60">({counts.all})</span></TabsTrigger>
          <TabsTrigger value="pending" className="gap-1.5">Pending <span className="text-[11px] tabular-nums opacity-60">({counts.pending})</span></TabsTrigger>
          <TabsTrigger value="won" className="gap-1.5">Won <span className="text-[11px] tabular-nums opacity-60">({counts.won})</span></TabsTrigger>
          <TabsTrigger value="lost" className="gap-1.5">Lost <span className="text-[11px] tabular-nums opacity-60">({counts.lost})</span></TabsTrigger>
        </TabsList>

        <div className="space-y-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))
          ) : filtered.length === 0 ? (
            <Card className="border-dashed bg-card/20">
              <CardContent className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                <Ticket className="mb-4 h-12 w-12 opacity-20" />
                <p className="text-lg font-medium">No bets found</p>
                <p className="text-sm">You haven't placed any {status !== "all" ? status : ""} bets yet.</p>
              </CardContent>
            </Card>
          ) : (
            filtered.map(bet => {
              const isCasino = bet._kind === "casino";
              const cb = isCasino ? (bet as typeof bet & CasinoBet) : null;
              const sb = !isCasino ? (bet as typeof bet & { homeTeam: string; awayTeam: string; sport: string; odds: number; potentialWin: number; selection: string }) : null;

              return (
                <Card key={`${bet._kind}-${bet.id}`} className="overflow-hidden border-border/40 bg-card/40 hover:bg-card/60 transition-colors">
                  <div className="flex flex-col sm:flex-row">
                    <div className="flex-1 p-4 border-b sm:border-b-0 sm:border-r border-border/30">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          {isCasino ? (
                            <Badge variant="outline" className="text-[10px] uppercase bg-yellow-500/10 text-yellow-400 border-yellow-500/30 gap-1">
                              <Dices className="h-2.5 w-2.5" />
                              Casino
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] uppercase bg-background/50">
                              {sb?.sport || "Sport"}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">{formatDateTime(bet.createdAt)}</span>
                        </div>
                        <Badge className={`text-[10px] font-bold tracking-wider gap-1 flex-shrink-0 ${getStatusStyle(bet.status)}`}>
                          {getStatusIcon(bet.status)}
                          {bet.status.toUpperCase()}
                        </Badge>
                      </div>

                      <div className="font-bold text-base mb-2">
                        {isCasino ? cb!.gameName : `${sb!.homeTeam} vs ${sb!.awayTeam}`}
                      </div>

                      <div className="bg-background/40 rounded-lg px-3 py-2 border border-border/30 inline-flex flex-col min-w-[180px]">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">Your Pick</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-yellow-400">
                            {isCasino
                              ? capitalize(cb!.selection)
                              : (sb!.selection === "home" ? sb!.homeTeam : sb!.selection === "away" ? sb!.awayTeam : "Draw")}
                          </span>
                          {!isCasino && sb?.odds && (
                            <span className="text-sm font-mono text-muted-foreground">@{sb.odds.toFixed(2)}</span>
                          )}
                        </div>
                        {isCasino && cb!.result && (
                          <span className="text-[10px] text-muted-foreground mt-0.5">
                            Result: <span className={`font-bold ${cb!.result === cb!.selection ? "text-emerald-400" : "text-red-400"}`}>{capitalize(cb!.result)}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="w-full sm:w-52 bg-background/20 p-4 flex flex-col justify-center">
                      <div className="space-y-2.5">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">Stake</span>
                          <span className="font-mono font-semibold">PKR {bet.stake.toFixed(2)}</span>
                        </div>
                        {isCasino ? (
                          <>
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-muted-foreground">Round</span>
                              <span className="font-mono text-xs text-muted-foreground">#{cb!.roundId.slice(-6)}</span>
                            </div>
                            <div className="pt-2 border-t border-border/30 flex justify-between items-center">
                              <span className="text-sm font-bold">Return</span>
                              <span className={`font-mono font-bold text-lg ${bet.status === "won" ? "text-emerald-400" : bet.status === "lost" ? "text-red-400/60" : "text-foreground"}`}>
                                {bet.status === "won" ? `PKR ${(cb!.payout ?? 0).toFixed(2)}` : bet.status === "lost" ? "PKR 0" : "—"}
                              </span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-muted-foreground">To Win</span>
                              <span className="font-mono font-semibold">PKR {(sb?.potentialWin ?? 0).toFixed(2)}</span>
                            </div>
                            <div className="pt-2 border-t border-border/30 flex justify-between items-center">
                              <span className="text-sm font-bold">Return</span>
                              <span className={`font-mono font-bold text-lg ${bet.status === "won" ? "text-emerald-400" : bet.status === "lost" ? "text-red-400/60" : "text-foreground"}`}>
                                {bet.status === "won" ? `PKR ${(sb?.potentialWin ?? 0).toFixed(2)}` : bet.status === "lost" ? "PKR 0" : "—"}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </Tabs>
    </div>
  );
}
