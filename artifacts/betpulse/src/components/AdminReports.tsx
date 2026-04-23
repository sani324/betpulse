import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Trophy, Flame, Users, Dice5, ArrowUpRight, ArrowDownRight } from "lucide-react";

type Period = "daily" | "weekly" | "monthly";

interface ReportSummary {
  total_bets: number;
  total_staked: string;
  player_gross_losses: string;   // sum of all losing stakes (what losers forfeited)
  player_net_winnings: string;   // payout − stake for winning bets (actual profit to winners)
  house_earnings: string;        // player_gross_losses − player_net_winnings
  winning_bets: number;
  losing_bets: number;
  unique_players: number;
}

interface GameRow {
  gameName: string;
  totalBets: number;
  totalStaked: string;
  totalPaidOut: string;
  houseEarnings: string;
  winningBets: number;
  losingBets: number;
}

interface PlayerRow {
  username: string;
  totalBets: number;
  totalStaked: string;
  totalLost: string;
  netWinnings: string;
  netProfit?: string;
  netLoss?: string;
}

interface ReportData {
  period: Period;
  summary: ReportSummary;
  gameBreakdown: GameRow[];
  topWinners: PlayerRow[];
  topLosers: PlayerRow[];
  timeline: { bucket: string; staked: string; paidOut: string; houseEarnings: string; bets: number }[];
}

function fmt(val: string | number | undefined) {
  const n = parseFloat(String(val ?? 0));
  if (isNaN(n)) return "₨ 0";
  return "₨ " + Math.abs(n).toLocaleString("en-PK", { maximumFractionDigits: 0 });
}

function fmtSigned(val: string | number | undefined) {
  const n = parseFloat(String(val ?? 0));
  if (isNaN(n)) return "₨ 0";
  const prefix = n >= 0 ? "+" : "−";
  return prefix + " ₨ " + Math.abs(n).toLocaleString("en-PK", { maximumFractionDigits: 0 });
}

function pct(won: number, total: number) {
  if (!total) return "0%";
  return ((won / total) * 100).toFixed(1) + "%";
}

function houseEdgePct(staked: string, paid: string) {
  const s = parseFloat(staked);
  const p = parseFloat(paid);
  if (!s) return "0%";
  return (((s - p) / s) * 100).toFixed(1) + "%";
}

export default function AdminReports() {
  const [period, setPeriod] = useState<Period>("daily");
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (p: Period) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/reports?period=${p}`, { credentials: "include" });
      if (r.ok) {
        const json = await r.json() as ReportData;
        setData(json);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(period); }, [period, load]);

  const periods: { key: Period; label: string; sub: string }[] = [
    { key: "daily",   label: "Today",      sub: "Last 24 hours" },
    { key: "weekly",  label: "This Week",  sub: "Last 7 days"   },
    { key: "monthly", label: "This Month", sub: "Last 30 days"  },
  ];

  const s = data?.summary;

  // For reconciliation check: house_earnings = player_gross_losses - player_net_winnings
  const houseCheck = parseFloat(s?.player_gross_losses ?? "0") - parseFloat(s?.player_net_winnings ?? "0");
  const houseActual = parseFloat(s?.house_earnings ?? "0");
  const reconciled = Math.abs(houseCheck - houseActual) < 1; // within ₨1 rounding

  return (
    <div className="space-y-6">

      {/* Period Selector */}
      <div className="flex gap-3">
        {periods.map(p => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`flex-1 rounded-xl border px-4 py-3 text-left transition-all ${
              period === p.key
                ? "bg-amber-500 border-amber-400 text-black shadow-lg shadow-amber-900/40"
                : "bg-[#0d1f14] border-[#1a3a22] text-white/70 hover:border-amber-700/50 hover:text-white"
            }`}
          >
            <div className="font-bold text-sm">{p.label}</div>
            <div className={`text-xs mt-0.5 ${period === p.key ? "text-black/60" : "text-white/40"}`}>{p.sub}</div>
          </button>
        ))}
      </div>

      {/* Hero Stats */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

          {/* House Earnings */}
          <Card className="bg-gradient-to-br from-emerald-900/60 to-[#0d1f14] border-emerald-700/40 rounded-xl">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/20">
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                </div>
                <span className="text-xs font-semibold text-emerald-300/70 uppercase tracking-wider">House Earnings</span>
              </div>
              <div className={`text-2xl font-black ${houseActual >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                {houseActual >= 0 ? "" : "−"}{fmt(s?.house_earnings)}
              </div>
              <div className="text-xs text-emerald-400/60 mt-1">
                Net profit after all payouts
              </div>
            </CardContent>
          </Card>

          {/* Player Gross Losses */}
          <Card className="bg-gradient-to-br from-red-900/50 to-[#0d1f14] border-red-700/40 rounded-xl">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-red-500/20">
                  <TrendingDown className="h-4 w-4 text-red-400" />
                </div>
                <span className="text-xs font-semibold text-red-300/70 uppercase tracking-wider">Player Losses</span>
              </div>
              <div className="text-2xl font-black text-red-300">{fmt(s?.player_gross_losses)}</div>
              <div className="text-xs text-red-400/60 mt-1">
                Stakes forfeited on {s?.losing_bets ?? 0} lost bets
              </div>
            </CardContent>
          </Card>

          {/* Player Net Winnings */}
          <Card className="bg-gradient-to-br from-yellow-900/50 to-[#0d1f14] border-yellow-700/40 rounded-xl">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-yellow-500/20">
                  <Trophy className="h-4 w-4 text-yellow-400" />
                </div>
                <span className="text-xs font-semibold text-yellow-300/70 uppercase tracking-wider">Player Winnings</span>
              </div>
              <div className="text-2xl font-black text-yellow-300">{fmt(s?.player_net_winnings)}</div>
              <div className="text-xs text-yellow-400/60 mt-1">
                Net profit on {s?.winning_bets ?? 0} winning bets
              </div>
            </CardContent>
          </Card>

          {/* Activity */}
          <Card className="bg-gradient-to-br from-sky-900/50 to-[#0d1f14] border-sky-700/40 rounded-xl">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-sky-500/20">
                  <Users className="h-4 w-4 text-sky-400" />
                </div>
                <span className="text-xs font-semibold text-sky-300/70 uppercase tracking-wider">Activity</span>
              </div>
              <div className="text-2xl font-black text-sky-300">{(s?.total_bets ?? 0).toLocaleString()}</div>
              <div className="text-xs text-sky-400/60 mt-1">
                {s?.unique_players ?? 0} unique players
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Reconciliation Banner */}
      {!loading && s && (
        <div className="rounded-xl bg-[#0d1f14] border border-[#1a3a22] px-5 py-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span className="text-white/40 text-xs uppercase tracking-wider font-semibold">Formula</span>
            <span className="font-mono text-emerald-300 font-bold">{fmt(s.house_earnings)}</span>
            <span className="text-white/30">=</span>
            <span className="text-red-300 font-semibold">{fmt(s.player_gross_losses)}</span>
            <span className="text-white/30 font-bold">−</span>
            <span className="text-yellow-300 font-semibold">{fmt(s.player_net_winnings)}</span>
            <span className="text-white/20 mx-1">|</span>
            <span className="text-white/40 text-xs">Total wagered:</span>
            <span className="font-bold text-white">{fmt(s.total_staked)}</span>
            <span className="text-white/20 mx-1">|</span>
            <span className="text-white/40 text-xs">Win rate:</span>
            <span className="text-white/70">{pct(s.winning_bets, s.total_bets)}</span>
            {reconciled && (
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-700/40 text-[10px] ml-auto" variant="outline">
                ✓ Verified
              </Badge>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Per-Game Breakdown */}
        <Card className="bg-[#0d1f14] border-[#1a3a22] rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Dice5 className="h-4 w-4 text-amber-400" />
              Game Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : !data?.gameBreakdown?.length ? (
              <div className="text-center py-8 text-white/30 text-sm">No game data for this period</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-[#1a3a22] hover:bg-transparent">
                    <TableHead className="text-white/40 text-xs">Game</TableHead>
                    <TableHead className="text-white/40 text-xs text-right">Bets</TableHead>
                    <TableHead className="text-white/40 text-xs text-right">Wagered</TableHead>
                    <TableHead className="text-white/40 text-xs text-right">House Profit</TableHead>
                    <TableHead className="text-white/40 text-xs text-right">Edge</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.gameBreakdown.map((g, i) => {
                    const profit = parseFloat(g.houseEarnings);
                    return (
                      <TableRow key={i} className="border-[#1a3a22] hover:bg-white/5">
                        <TableCell className="font-medium text-white text-sm py-2.5">{g.gameName}</TableCell>
                        <TableCell className="text-right text-white/60 text-xs">{g.totalBets}</TableCell>
                        <TableCell className="text-right text-white/60 text-xs">{fmt(g.totalStaked)}</TableCell>
                        <TableCell className="text-right">
                          <span className={`font-bold text-sm ${profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {profit >= 0 ? "+" : "−"}{fmt(g.houseEarnings)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            className={`text-[10px] font-bold ${profit >= 0 ? "bg-emerald-500/20 text-emerald-300 border-emerald-700/40" : "bg-red-500/20 text-red-300 border-red-700/40"}`}
                            variant="outline"
                          >
                            {houseEdgePct(g.totalStaked, g.totalPaidOut)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Timeline Chart */}
        <Card className="bg-[#0d1f14] border-[#1a3a22] rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Flame className="h-4 w-4 text-amber-400" />
              {period === "daily" ? "Hourly" : "Daily"} House Earnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
            ) : !Array.isArray(data?.timeline) || !data.timeline.length ? (
              <div className="text-center py-8 text-white/30 text-sm">No timeline data</div>
            ) : (() => {
              const vals = data.timeline.map(t => parseFloat(t.houseEarnings));
              const max = Math.max(...vals.map(Math.abs), 1);
              return (
                <div className="space-y-1.5">
                  {data.timeline.map((t, i) => {
                    const val = parseFloat(t.houseEarnings);
                    const w = Math.max((Math.abs(val) / max) * 100, 2);
                    const label = period === "daily"
                      ? new Date(t.bucket).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" })
                      : new Date(t.bucket).toLocaleDateString("en-PK", { weekday: "short", day: "numeric" });
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-[10px] text-white/30 w-14 shrink-0 text-right">{label}</span>
                        <div className="flex-1 h-5 bg-white/5 rounded-md overflow-hidden">
                          <div
                            className={`h-full rounded-md transition-all ${val >= 0 ? "bg-emerald-500/60" : "bg-red-500/60"}`}
                            style={{ width: `${w}%` }}
                          />
                        </div>
                        <span className={`text-[10px] font-bold w-24 text-right shrink-0 ${val >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {fmtSigned(val)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      {/* Top Winners & Losers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Top Winners */}
        <Card className="bg-[#0d1f14] border-[#1a3a22] rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowUpRight className="h-4 w-4 text-yellow-400" />
              Top 10 Winners
              <span className="text-xs text-white/30 font-normal ml-1">(net profit)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : !data?.topWinners?.length ? (
              <div className="text-center py-10 text-white/30 text-sm">
                <Trophy className="h-8 w-8 mx-auto mb-2 opacity-20" />
                No net winners this period — house took it all
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-[#1a3a22] hover:bg-transparent">
                    <TableHead className="text-white/40 text-xs w-6">#</TableHead>
                    <TableHead className="text-white/40 text-xs">Player</TableHead>
                    <TableHead className="text-white/40 text-xs text-right">Bets</TableHead>
                    <TableHead className="text-white/40 text-xs text-right">Wagered</TableHead>
                    <TableHead className="text-white/40 text-xs text-right">Net P&amp;L</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.topWinners.map((p, i) => {
                    const net = parseFloat(p.netProfit ?? "0");
                    return (
                      <TableRow key={i} className="border-[#1a3a22] hover:bg-white/5">
                        <TableCell className="text-white/30 text-xs py-2.5">{i + 1}</TableCell>
                        <TableCell className="font-bold text-white text-sm py-2.5">{p.username}</TableCell>
                        <TableCell className="text-right text-white/50 text-xs">{p.totalBets}</TableCell>
                        <TableCell className="text-right text-white/50 text-xs">{fmt(p.totalStaked)}</TableCell>
                        <TableCell className="text-right">
                          <span className={`font-bold text-sm ${net >= 0 ? "text-yellow-400" : "text-red-400"}`}>
                            {fmtSigned(net)}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Top Losers */}
        <Card className="bg-[#0d1f14] border-[#1a3a22] rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowDownRight className="h-4 w-4 text-red-400" />
              Top 10 Losers
              <span className="text-xs text-white/30 font-normal ml-1">(net loss)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : !data?.topLosers?.length ? (
              <div className="text-center py-10 text-white/30 text-sm">
                <ArrowDownRight className="h-8 w-8 mx-auto mb-2 opacity-20" />
                No net losers this period
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-[#1a3a22] hover:bg-transparent">
                    <TableHead className="text-white/40 text-xs w-6">#</TableHead>
                    <TableHead className="text-white/40 text-xs">Player</TableHead>
                    <TableHead className="text-white/40 text-xs text-right">Bets</TableHead>
                    <TableHead className="text-white/40 text-xs text-right">Wagered</TableHead>
                    <TableHead className="text-white/40 text-xs text-right">Net Loss</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.topLosers.map((p, i) => {
                    const net = parseFloat(p.netLoss ?? "0");
                    return (
                      <TableRow key={i} className="border-[#1a3a22] hover:bg-white/5">
                        <TableCell className="text-white/30 text-xs py-2.5">{i + 1}</TableCell>
                        <TableCell className="font-bold text-white text-sm py-2.5">{p.username}</TableCell>
                        <TableCell className="text-right text-white/50 text-xs">{p.totalBets}</TableCell>
                        <TableCell className="text-right text-white/50 text-xs">{fmt(p.totalStaked)}</TableCell>
                        <TableCell className="text-right">
                          <span className="font-bold text-sm text-red-400">−{fmt(net)}</span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
