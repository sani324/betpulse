import { useParams } from "wouter";
import { useGetEvent, getGetEventQueryKey } from "@workspace/api-client-react";
import { formatDateTime, formatPercentage } from "@/lib/utils";
import { useBetSlip } from "@/lib/bet-slip-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, ArrowLeft, Clock, PlayCircle, ShieldCheck, Trophy } from "lucide-react";
import { Link } from "wouter";
import { CasinoGameDetail } from "./CasinoGameDetail";
import { CASINO_SPORTS } from "@/lib/casino-config";

export default function EventDetail() {
  const { eventId } = useParams();
  const id = Number(eventId);
  const { addItem, removeItem, items } = useBetSlip();

  const { data: event, isLoading } = useGetEvent(id, {
    query: {
      enabled: !!id,
      queryKey: getGetEventQueryKey(id)
    }
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center space-y-4">
        <Trophy className="h-12 w-12 text-muted-foreground opacity-20" />
        <h2 className="text-2xl font-bold">Event not found</h2>
        <Link href="/">
          <Button variant="outline">Back to Home</Button>
        </Link>
      </div>
    );
  }

  if (CASINO_SPORTS.includes(event.sport)) {
    return <CasinoGameDetail event={event} />;
  }

  const isLive = event.status === "live";

  const isSelected = (selection: "home" | "draw" | "away") =>
    items.some(item => item.eventId === event.id && item.selection === selection);

  const handleToggleBet = (selection: "home" | "draw" | "away", odds: number) => {
    const id = `${event.id}-${selection}`;
    if (isSelected(selection)) {
      removeItem(id);
    } else {
      addItem({
        eventId: event.id,
        homeTeam: event.homeTeam,
        awayTeam: event.awayTeam,
        selection,
        odds,
      });
    }
  };

  return (
    <div className="space-y-6">
      <Link href="/" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to events
      </Link>

      {/* Main Match Card */}
      <Card className="overflow-hidden border-primary/20 bg-card/60 backdrop-blur">
        <div className="bg-gradient-to-r from-primary/10 via-background to-primary/5 p-6 border-b border-border/50">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <Badge className="font-mono">{event.sport}</Badge>
              {event.league && <span className="text-sm font-medium text-muted-foreground">{event.league}</span>}
            </div>
            {isLive ? (
              <Badge variant="destructive" className="animate-pulse shadow-[0_0_10px_rgba(220,38,38,0.5)]">
                <PlayCircle className="mr-1 h-3 w-3" />
                LIVE
              </Badge>
            ) : (
              <div className="flex items-center text-sm font-medium text-muted-foreground">
                <Clock className="mr-2 h-4 w-4 text-primary" />
                {formatDateTime(event.startTime)}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-center px-4 md:px-12">
            <div className="flex-1">
              <h2 className="text-2xl md:text-4xl font-bold tracking-tight">{event.homeTeam}</h2>
            </div>
            <div className="flex-shrink-0 px-4 md:px-12">
              {isLive ? (
                <div className="text-3xl md:text-5xl font-black tabular-nums text-primary tracking-tighter">
                  {event.homeScore} <span className="text-muted-foreground/30">-</span> {event.awayScore}
                </div>
              ) : (
                <div className="text-2xl font-bold text-muted-foreground/40 font-mono">VS</div>
              )}
            </div>
            <div className="flex-1">
              <h2 className="text-2xl md:text-4xl font-bold tracking-tight">{event.awayTeam}</h2>
            </div>
          </div>
        </div>
        
        <CardContent className="p-6 md:p-8">
          <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">Match Result</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              variant={isSelected("home") ? "default" : "outline"}
              className="flex h-auto py-4 flex-col gap-2 border-border hover:border-primary"
              onClick={() => handleToggleBet("home", event.oddsHome)}
              data-testid="detail-bet-home"
            >
              <span className="text-sm text-muted-foreground">{event.homeTeam}</span>
              <span className="text-2xl font-bold font-mono">{event.oddsHome.toFixed(2)}</span>
            </Button>
            <Button
              variant={isSelected("draw") ? "default" : "outline"}
              className="flex h-auto py-4 flex-col gap-2 border-border hover:border-primary"
              onClick={() => handleToggleBet("draw", event.oddsDraw)}
              data-testid="detail-bet-draw"
            >
              <span className="text-sm text-muted-foreground">Draw</span>
              <span className="text-2xl font-bold font-mono">{event.oddsDraw.toFixed(2)}</span>
            </Button>
            <Button
              variant={isSelected("away") ? "default" : "outline"}
              className="flex h-auto py-4 flex-col gap-2 border-border hover:border-primary"
              onClick={() => handleToggleBet("away", event.oddsAway)}
              data-testid="detail-bet-away"
            >
              <span className="text-sm text-muted-foreground">{event.awayTeam}</span>
              <span className="text-2xl font-bold font-mono">{event.oddsAway.toFixed(2)}</span>
            </Button>
          </div>
          
          <div className="mt-6 flex justify-end">
            <div className="inline-flex items-center rounded-full bg-secondary/50 px-3 py-1 text-xs font-medium text-muted-foreground">
              <ShieldCheck className="mr-1 h-3 w-3" />
              House Margin: {formatPercentage(event.overround / 100)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats - Fake stats for aesthetic purposes since we don't have real ones */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-card/40 border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Implied Probability</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{event.homeTeam}</span>
                <span className="font-mono">{formatPercentage(event.homeImplied)}</span>
              </div>
              <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${event.homeImplied * 100}%` }}></div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Draw</span>
                <span className="font-mono">{formatPercentage(event.drawImplied)}</span>
              </div>
              <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-muted-foreground" style={{ width: `${event.drawImplied * 100}%` }}></div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{event.awayTeam}</span>
                <span className="font-mono">{formatPercentage(event.awayImplied)}</span>
              </div>
              <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-destructive" style={{ width: `${event.awayImplied * 100}%` }}></div>
              </div>
            </div>
          </CardContent>
        </Card>

        {isLive && (
          <Card className="bg-card/40 border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Live Match Center</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-border bg-card/20 text-muted-foreground">
                <div className="flex flex-col items-center gap-2">
                  <Activity className="h-8 w-8 text-primary animate-pulse" />
                  <span>Match in progress...</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
