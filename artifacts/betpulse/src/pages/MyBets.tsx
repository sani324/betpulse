import { useState } from "react";
import { useGetBets, getGetBetsQueryKey } from "@workspace/api-client-react";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Ticket, CheckCircle2, XCircle, Clock } from "lucide-react";

export default function MyBets() {
  const [status, setStatus] = useState<string>("all");

  const { data: bets, isLoading } = useGetBets(
    {}, // API doesn't support string status directly in types easily without casting
    { query: { queryKey: getGetBetsQueryKey({}) } }
  );

  const filteredBets = bets?.filter(bet => status === "all" || bet.status === status) || [];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "won": return <CheckCircle2 className="h-4 w-4 text-primary" />;
      case "lost": return <XCircle className="h-4 w-4 text-destructive" />;
      case "pending": return <Clock className="h-4 w-4 text-blue-500" />;
      default: return <Ticket className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "won": return "bg-primary/20 text-primary border-primary/30";
      case "lost": return "bg-destructive/20 text-destructive border-destructive/30";
      case "pending": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      default: return "bg-secondary text-secondary-foreground";
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Ticket className="h-8 w-8 text-primary" />
          My Bets
        </h1>
      </div>

      <Tabs defaultValue="all" value={status} onValueChange={setStatus}>
        <TabsList className="bg-card/50 p-1 mb-6">
          <TabsTrigger value="all" data-testid="tab-bets-all">All</TabsTrigger>
          <TabsTrigger value="pending" data-testid="tab-bets-pending">Pending</TabsTrigger>
          <TabsTrigger value="won" data-testid="tab-bets-won">Won</TabsTrigger>
          <TabsTrigger value="lost" data-testid="tab-bets-lost">Lost</TabsTrigger>
        </TabsList>

        <div className="space-y-4">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))
          ) : filteredBets.length === 0 ? (
            <Card className="border-dashed bg-card/20">
              <CardContent className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                <Ticket className="mb-4 h-12 w-12 opacity-20" />
                <p className="text-lg font-medium">No bets found</p>
                <p className="text-sm">You haven't placed any {status !== 'all' ? status : ''} bets yet.</p>
              </CardContent>
            </Card>
          ) : (
            filteredBets.map((bet) => (
              <Card key={bet.id} className="overflow-hidden border-border/50 bg-card/40 transition-colors hover:bg-card/60">
                <div className="flex flex-col md:flex-row">
                  <div className="flex-1 p-5 border-b md:border-b-0 md:border-r border-border/30">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs uppercase bg-background/50">
                            {bet.sport || 'SPORT'}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{formatDateTime(bet.createdAt)}</span>
                        </div>
                        <h3 className="font-bold text-lg leading-tight mt-2">
                          {bet.homeTeam} vs {bet.awayTeam}
                        </h3>
                      </div>
                      <Badge className={`uppercase text-[10px] font-bold tracking-wider gap-1 ${getStatusColor(bet.status)}`}>
                        {getStatusIcon(bet.status)}
                        {bet.status}
                      </Badge>
                    </div>

                    <div className="bg-background/40 rounded-md p-3 border border-border/30 inline-block min-w-[200px]">
                      <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Your Pick</div>
                      <div className="flex items-end gap-3">
                        <span className="text-primary font-bold uppercase tracking-wider">
                          {bet.selection === 'home' ? bet.homeTeam : bet.selection === 'away' ? bet.awayTeam : 'Draw'}
                        </span>
                        <span className="text-xl font-mono font-bold leading-none">@{bet.odds.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="w-full md:w-64 bg-background/20 p-5 flex flex-col justify-center">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Stake</span>
                        <span className="font-mono font-medium">{formatCurrency(bet.stake)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">To Win</span>
                        <span className="font-mono font-medium">{formatCurrency(bet.potentialWin)}</span>
                      </div>
                      <div className="pt-3 border-t border-border/30 flex justify-between items-center">
                        <span className="text-sm font-bold">Return</span>
                        <span className={`font-mono font-bold text-lg ${bet.status === 'won' ? 'text-primary' : bet.status === 'lost' ? 'text-muted-foreground opacity-50' : 'text-foreground'}`}>
                          {bet.status === 'won' ? formatCurrency(bet.potentialWin) : bet.status === 'lost' ? 'PKR 0' : '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </Tabs>
    </div>
  );
}
