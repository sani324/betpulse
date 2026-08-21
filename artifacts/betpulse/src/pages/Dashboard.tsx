import { useGetDashboardStats, getGetDashboardStatsQueryKey } from "@workspace/api-client-react";
import { formatCurrency, formatPercentage } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Target, Trophy, TrendingUp, Flame, Wallet, Coins } from "lucide-react";
import { InstallAppModal } from "@/components/InstallAppModal";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";

export default function Dashboard() {
  const { data: stats, isLoading } = useGetDashboardStats({
    query: { queryKey: getGetDashboardStatsQueryKey() }
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  const safeStats = stats || {
    totalBets: 0,
    wonBets: 0,
    lostBets: 0,
    pendingBets: 0,
    winRate: 0,
    totalWon: 0,
    totalStaked: 0,
    biggestWin: 0,
  };

  const winLossData = [
    { name: "Won", value: safeStats.wonBets },
    { name: "Lost", value: safeStats.lostBets },
    { name: "Pending", value: safeStats.pendingBets },
  ];

  const COLORS = ["hsl(var(--primary))", "hsl(var(--destructive))", "hsl(var(--muted-foreground))"];

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => window.history.length > 1 ? window.history.back() : (window.location.href = "/")}
            className="flex items-center gap-1.5 text-slate-300 hover:text-white font-bold text-sm bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700 transition"
          >
            <span>← Back</span>
          </button>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Target className="h-8 w-8 text-primary" />
            Performance Dashboard
          </h1>
        </div>
        <InstallAppModal />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card/40 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Win Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPercentage(safeStats.winRate / 100)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Based on {safeStats.wonBets + safeStats.lostBets} settled bets
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Won</CardTitle>
            <Trophy className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{formatCurrency(safeStats.totalWon)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              From {safeStats.wonBets} winning bets
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Staked</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(safeStats.totalStaked)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across {safeStats.totalBets} total bets
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Biggest Win</CardTitle>
            <Flame className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(safeStats.biggestWin)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Record payout
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-1 md:col-span-1 bg-card/40 border-border/50">
          <CardHeader>
            <CardTitle>Bet Status Distribution</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center h-[300px]">
            {safeStats.totalBets > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={winLossData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {winLossData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => [`${value} bets`, '']}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center text-muted-foreground h-full">
                <Target className="h-8 w-8 mb-2 opacity-20" />
                <p>No bets placed yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-1 md:col-span-2 bg-card/40 border-border/50 flex items-center justify-center min-h-[350px]">
           <div className="text-center text-muted-foreground">
             <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-20" />
             <h3 className="text-lg font-medium">Profit Trend Analysis</h3>
             <p className="text-sm">Place more bets to unlock historical trend charts.</p>
           </div>
        </Card>
      </div>
    </div>
  );
}
