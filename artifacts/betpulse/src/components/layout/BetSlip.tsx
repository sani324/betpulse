import { useState } from "react";
import { useBetSlip } from "@/lib/bet-slip-context";
import { useAuth } from "@/lib/auth-context";
import { usePlaceBet, getGetMeQueryKey, getGetBetsQueryKey, getGetBalanceQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Trash2, Trophy } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export function BetSlip() {
  const { items, removeItem, updateStake, clearSlip } = useBetSlip();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const placeBetMutation = usePlaceBet();

  const totalStake = items.reduce((sum, item) => sum + (Number(item.stake) || 0), 0);
  const potentialWin = items.reduce((sum, item) => sum + (Number(item.stake) || 0) * item.odds, 0);

  const handlePlaceBets = async () => {
    if (!isAuthenticated) {
      toast({
        title: "Login Required",
        description: "Please login to place bets.",
        variant: "destructive",
      });
      return;
    }

    if (totalStake > (user?.balance || 0)) {
      toast({
        title: "Insufficient Balance",
        description: "You do not have enough balance for these bets.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Place bets sequentially to avoid potential race conditions on the server balance
      for (const item of items) {
        if (item.stake > 0) {
          await placeBetMutation.mutateAsync({
            data: {
              eventId: item.eventId,
              selection: item.selection,
              stake: item.stake,
            }
          });
        }
      }
      
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetBalanceQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetBetsQueryKey() });
      
      toast({
        title: "Bets Placed",
        description: "Your bets have been placed successfully.",
      });
      
      clearSlip();
    } catch (error: any) {
      const status = error.response?.status;
      if (status === 401) {
        // Session expired — refresh auth state so UI updates
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        toast({
          title: "Session Expired",
          description: "You have been logged out. Please log in again to place bets.",
          variant: "destructive",
        });
      } else if (status === 400) {
        const msg = error.response?.data?.error || "Invalid bet request.";
        toast({
          title: "Bet Rejected",
          description: msg,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error Placing Bets",
          description: error.response?.data?.error || "Something went wrong. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-full flex-col bg-card/30 backdrop-blur supports-[backdrop-filter]:bg-card/10">
      <div className="flex items-center justify-between p-4 border-b border-border/40">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          Bet Slip
          {items.length > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {items.length}
            </span>
          )}
        </h2>
        {items.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearSlip} className="h-8 text-muted-foreground hover:text-foreground">
            Clear all
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1 p-4">
        {items.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center text-center text-muted-foreground">
            <Trophy className="mb-2 h-8 w-8 opacity-20" />
            <p>Your bet slip is empty</p>
            <p className="text-sm">Click odds to add selections</p>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <Card key={item.id} className="relative overflow-hidden border-border/50 bg-background/50">
                <div className="absolute left-0 top-0 h-full w-1 bg-primary"></div>
                <CardHeader className="p-3 pb-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-primary">
                        {item.selection}
                      </span>
                      <CardTitle className="text-sm font-medium mt-1 leading-tight">
                        {item.homeTeam} vs {item.awayTeam}
                      </CardTitle>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 -mr-2 -mt-2 text-muted-foreground hover:text-destructive"
                      onClick={() => removeItem(item.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-3 pt-2 space-y-2">
                  {/* Odds row */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Odds</span>
                    <span className="text-lg font-bold tabular-nums text-primary">
                      {item.odds.toFixed(2)}x
                    </span>
                  </div>

                  {/* Quick-pick buttons */}
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider">Quick Stake (PKR)</p>
                    <div className="grid grid-cols-4 gap-1">
                      {[100, 500, 1000, 5000].map((amount) => (
                        <button
                          key={amount}
                          onClick={() => updateStake(item.id, amount)}
                          className={`rounded text-xs py-1 font-bold border transition-colors ${
                            item.stake === amount
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-card border-border/50 text-muted-foreground hover:border-primary/50 hover:text-foreground"
                          }`}
                        >
                          {amount >= 1000 ? `${amount/1000}K` : amount}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom amount input */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground shrink-0">Custom:</span>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="Enter amount..."
                      className="h-8 text-right font-mono text-sm flex-1"
                      value={item.stake || ""}
                      onChange={(e) => updateStake(item.id, parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  {/* To win */}
                  {item.stake > 0 ? (
                    <div className="flex justify-between items-center rounded-lg bg-primary/10 border border-primary/20 px-3 py-1.5">
                      <span className="text-xs text-muted-foreground">You win if correct:</span>
                      <span className="font-bold text-sm text-primary font-mono">
                        {formatCurrency(item.stake * item.odds)}
                      </span>
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground text-center py-1">
                      ☝️ Pick an amount above to continue
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>

      <div className="p-4 bg-card border-t border-border/40">
        <div className="space-y-2 mb-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total Stake:</span>
            <span className="font-mono font-medium">{formatCurrency(totalStake)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold">
            <span>Potential Payout:</span>
            <span className="font-mono text-primary">{formatCurrency(potentialWin)}</span>
          </div>
        </div>
        <Button 
          className="w-full font-bold shadow-lg shadow-primary/20" 
          size="lg"
          disabled={items.length === 0 || totalStake === 0 || placeBetMutation.isPending}
          onClick={handlePlaceBets}
        >
          {placeBetMutation.isPending ? "Placing Bets..." : "Place Bets"}
        </Button>
      </div>
    </div>
  );
}
