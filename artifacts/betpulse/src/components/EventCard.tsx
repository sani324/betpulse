import { Link } from "wouter";
import { formatDateTime, formatPercentage } from "@/lib/utils";
import { useBetSlip } from "@/lib/bet-slip-context";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, Clock, PlayCircle } from "lucide-react";
import type { Event } from "@workspace/api-client-react";

interface EventCardProps {
  event: Event;
}

export function EventCard({ event }: EventCardProps) {
  const { addItem, removeItem, items } = useBetSlip();

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
    <Card className="overflow-hidden border-border/50 bg-card/40 transition-all hover:bg-card/60">
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs uppercase tracking-wider">
              {event.sport}
            </Badge>
            {event.league && (
              <span className="text-xs text-muted-foreground">{event.league}</span>
            )}
          </div>
          {isLive ? (
            <Badge variant="destructive" className="animate-pulse shadow-[0_0_10px_rgba(220,38,38,0.5)]">
              <PlayCircle className="mr-1 h-3 w-3" />
              LIVE
            </Badge>
          ) : (
            <div className="flex items-center text-xs text-muted-foreground">
              <Clock className="mr-1 h-3 w-3" />
              {formatDateTime(event.startTime)}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <Link href={`/events/${event.id}`}>
          <div className="group cursor-pointer">
            <div className="flex items-center justify-between py-2">
              <span className="font-bold text-lg group-hover:text-primary transition-colors">
                {event.homeTeam}
              </span>
              {isLive && event.homeScore !== undefined && (
                <span className="text-xl font-bold tabular-nums text-primary">{event.homeScore}</span>
              )}
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="font-bold text-lg group-hover:text-primary transition-colors">
                {event.awayTeam}
              </span>
              {isLive && event.awayScore !== undefined && (
                <span className="text-xl font-bold tabular-nums text-primary">{event.awayScore}</span>
              )}
            </div>
          </div>
        </Link>
      </CardContent>
      <CardFooter className="flex flex-col gap-3 p-4 pt-0">
        <div className="grid grid-cols-3 gap-2 w-full">
          <Button
            variant={isSelected("home") ? "default" : "outline"}
            className="flex flex-col h-auto py-2 border-border/50 hover:border-primary/50"
            onClick={() => handleToggleBet("home", event.oddsHome)}
            data-testid={`bet-home-${event.id}`}
          >
            <span className="text-xs text-muted-foreground mb-1">1</span>
            <span className="font-bold font-mono">{event.oddsHome.toFixed(2)}</span>
          </Button>
          <Button
            variant={isSelected("draw") ? "default" : "outline"}
            className="flex flex-col h-auto py-2 border-border/50 hover:border-primary/50"
            onClick={() => handleToggleBet("draw", event.oddsDraw)}
            data-testid={`bet-draw-${event.id}`}
          >
            <span className="text-xs text-muted-foreground mb-1">X</span>
            <span className="font-bold font-mono">{event.oddsDraw.toFixed(2)}</span>
          </Button>
          <Button
            variant={isSelected("away") ? "default" : "outline"}
            className="flex flex-col h-auto py-2 border-border/50 hover:border-primary/50"
            onClick={() => handleToggleBet("away", event.oddsAway)}
            data-testid={`bet-away-${event.id}`}
          >
            <span className="text-xs text-muted-foreground mb-1">2</span>
            <span className="font-bold font-mono">{event.oddsAway.toFixed(2)}</span>
          </Button>
        </div>
        <div className="flex w-full justify-end">
          <span className="text-[10px] text-muted-foreground/60 flex items-center">
            margin: {formatPercentage(event.overround / 100)}
          </span>
        </div>
      </CardFooter>
    </Card>
  );
}
