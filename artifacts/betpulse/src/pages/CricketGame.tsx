import { useState, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey, getGetBalanceQueryKey } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Wallet, ShieldCheck, Flame } from "lucide-react";

const CHIP_AMOUNTS = [100, 500, 1000, 5000, 10000];
const API = import.meta.env.BASE_URL.replace(/\/$/, "");

function mkCtx() { return new ((window as any).AudioContext || (window as any).webkitAudioContext)(); }
function playWin() {
  try {
    const c = mkCtx();
    [523, 659, 784, 1047, 1319].forEach((freq, i) => {
      const o = c.createOscillator(); const g = c.createGain();
      o.connect(g); g.connect(c.destination); o.type = "triangle"; o.frequency.value = freq;
      const t = c.currentTime + i * 0.12;
      g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      o.start(t); o.stop(t + 0.45);
    });
    setTimeout(() => c.close(), 2500);
  } catch (_) {}
}
function playLose() {
  try {
    const c = mkCtx();
    [330, 280, 230].forEach((freq, i) => {
      const o = c.createOscillator(); const g = c.createGain();
      o.connect(g); g.connect(c.destination); o.type = "sawtooth"; o.frequency.value = freq;
      const t = c.currentTime + i * 0.22;
      g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      o.start(t); o.stop(t + 0.3);
    });
    setTimeout(() => c.close(), 2000);
  } catch (_) {}
}

export default function CricketGame() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [stake, setStake] = useState(500);
  const [selection, setSelection] = useState<string | null>(null);
  const [phase, setPhase] = useState<"betting" | "waiting" | "result">("betting");
  const [result, setResult] = useState<any>(null);
  const [balance, setBalance] = useState<number>(parseFloat(user?.balance || "0"));
  const [isPlacing, setIsPlacing] = useState(false);
  const [ballAnimation, setBallAnimation] = useState(false);

  useEffect(() => { setBalance(parseFloat(user?.balance || "0")); }, [user?.balance]);

  const pollRound = useCallback(async (rId: string, sel: string) => {
    let attempts = 0;
    setBallAnimation(true);
    const interval = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(`${API}/api/games/casino-round/cricket/${rId}`, {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === "settled") {
          clearInterval(interval);
          setBallAnimation(false);
          setResult(data);
          setPhase("result");

          const isWin = data.result === sel;
          if (isWin) {
            playWin();
            const mult = sel === "tie" ? 8 : 1.95;
            const wonAmount = Math.round(stake * mult);
            setBalance(b => b + wonAmount);
            toast({
              title: "🏏 SIX! Match Won!",
              description: `Congratulations! You won ${formatCurrency(wonAmount)}`,
              variant: "default",
            });
          } else {
            playLose();
            toast({
              title: "❌ Wicket! Match Lost",
              description: `Winning side was ${data.result === "team-a" ? "Team A (Batting)" : data.result === "team-b" ? "Team B (Bowling)" : "Super Over (Tie)"}`,
              variant: "destructive",
            });
          }
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetBalanceQueryKey() });
        }
      } catch (_) {}
      if (attempts > 30) {
        clearInterval(interval);
        setBallAnimation(false);
        setPhase("betting");
        toast({ title: "Timeout", description: "Round polling timed out.", variant: "destructive" });
      }
    }, 800);
  }, [stake, queryClient, toast]);

  const handlePlaceBet = async () => {
    if (!isAuthenticated) { setLocation("/login"); return; }
    if (!selection) { toast({ title: "Select a side", description: "Choose Team A, Team B, or Super Over", variant: "destructive" }); return; }
    if (balance < stake) { toast({ title: "Insufficient balance", variant: "destructive" }); return; }

    setIsPlacing(true);
    try {
      const res = await fetch(`${API}/api/games/cricket`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stake, selection }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Bet failed", description: data.error || "Something went wrong", variant: "destructive" });
        setIsPlacing(false);
        return;
      }

      setBalance(data.newBalance);
      setPhase("waiting");
      setIsPlacing(false);
      pollRound(data.roundId, selection);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
      setIsPlacing(false);
    }
  };

  const resetGame = () => {
    setPhase("betting");
    setResult(null);
    setSelection(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-between pb-8">
      {/* Header */}
      <div className="w-full max-w-2xl px-4 py-4 flex items-center justify-between border-b border-slate-800 bg-slate-900/60 backdrop-blur">
        <button onClick={() => setLocation("/")} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition">
          <ArrowLeft className="w-5 h-5 text-slate-300" />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-2xl">🏏</span>
          <h1 className="font-bold text-xl text-yellow-400">Cricket League</h1>
        </div>
        <div className="flex items-center gap-2 bg-emerald-950/80 border border-emerald-500/30 px-3 py-1.5 rounded-full">
          <Wallet className="w-4 h-4 text-emerald-400" />
          <span className="font-semibold text-emerald-400 text-sm">{formatCurrency(balance)}</span>
        </div>
      </div>

      {/* Main Stadium Court */}
      <div className="w-full max-w-2xl px-4 my-auto flex flex-col items-center">
        <div className="w-full relative bg-gradient-to-b from-emerald-900 via-green-800 to-emerald-950 rounded-3xl p-6 border-2 border-emerald-500/40 shadow-2xl shadow-emerald-900/40 overflow-hidden flex flex-col items-center text-center">
          
          {/* Decorative Stadium Elements */}
          <div className="absolute top-2 left-4 text-xs font-semibold text-emerald-300/60 tracking-widest uppercase">
            Stadium Pitch · Live Over
          </div>
          <div className="absolute top-2 right-4 flex items-center gap-1 text-xs text-yellow-400 font-bold bg-yellow-950/60 px-2 py-0.5 rounded border border-yellow-500/30">
            <Flame className="w-3.5 h-3.5 text-yellow-400" /> HOUSE PROTECTED
          </div>

          {/* Cricket Pitch Graphic */}
          <div className="w-48 h-32 my-6 bg-amber-900/40 border-2 border-amber-500/30 rounded-xl relative flex items-center justify-center shadow-inner">
            <div className="w-full h-0.5 bg-amber-200/40 absolute top-4" />
            <div className="w-full h-0.5 bg-amber-200/40 absolute bottom-4" />
            <div className="w-0.5 h-full bg-amber-200/20 absolute left-8" />
            <div className="w-0.5 h-full bg-amber-200/20 absolute right-8" />

            {/* Wickets Graphic */}
            <div className="absolute left-3 flex gap-1">
              <div className="w-1 h-8 bg-yellow-200 rounded-t" />
              <div className="w-1 h-8 bg-yellow-200 rounded-t" />
              <div className="w-1 h-8 bg-yellow-200 rounded-t" />
            </div>
            <div className="absolute right-3 flex gap-1">
              <div className="w-1 h-8 bg-yellow-200 rounded-t" />
              <div className="w-1 h-8 bg-yellow-200 rounded-t" />
              <div className="w-1 h-8 bg-yellow-200 rounded-t" />
            </div>

            {ballAnimation && (
              <div className="absolute w-5 h-5 bg-red-600 rounded-full shadow-lg border border-red-300 animate-ping" />
            )}
            {!ballAnimation && (
              <div className="text-4xl">🏏</div>
            )}
          </div>

          {/* Match Status / Result Banner */}
          {phase === "waiting" && (
            <div className="animate-pulse flex flex-col items-center">
              <div className="text-xl font-bold text-yellow-400">Bowler Running In...</div>
              <div className="text-xs text-emerald-200 mt-1">Analyzing pitch & ball trajectory</div>
            </div>
          )}

          {phase === "result" && result && (
            <div className="flex flex-col items-center space-y-2 animate-fade-in">
              <div className="text-3xl font-extrabold text-white tracking-wide">
                {result.result === "team-a" ? "🏏 Team A (Batting) Won!" : result.result === "team-b" ? "⚾ Team B (Bowling) Won!" : "🤝 Super Over (Tie)!"}
              </div>
              <div className={`px-4 py-1.5 rounded-full text-sm font-bold border ${result.result === selection ? "bg-emerald-500/20 border-emerald-400 text-emerald-300" : "bg-red-500/20 border-red-400 text-red-300"}`}>
                {result.result === selection ? "YOU WON!" : "HOUSE WINS"}
              </div>
            </div>
          )}

          {phase === "betting" && (
            <div className="text-sm font-medium text-emerald-200">
              Select your winning side & place your stake to play!
            </div>
          )}
        </div>

        {/* Betting Selection Cards */}
        <div className="w-full grid grid-cols-3 gap-3 my-6">
          <button
            disabled={phase !== "betting"}
            onClick={() => setSelection("team-a")}
            className={`p-4 rounded-2xl border-2 transition flex flex-col items-center justify-center gap-1 ${
              selection === "team-a"
                ? "bg-emerald-600/30 border-emerald-400 shadow-lg shadow-emerald-600/20 scale-105"
                : "bg-slate-900 border-slate-800 hover:border-slate-700"
            }`}
          >
            <span className="text-3xl">🏏</span>
            <span className="font-bold text-white text-sm">Team A (Batting)</span>
            <span className="text-xs font-semibold text-emerald-400">1.95× Payout</span>
          </button>

          <button
            disabled={phase !== "betting"}
            onClick={() => setSelection("team-b")}
            className={`p-4 rounded-2xl border-2 transition flex flex-col items-center justify-center gap-1 ${
              selection === "team-b"
                ? "bg-blue-600/30 border-blue-400 shadow-lg shadow-blue-600/20 scale-105"
                : "bg-slate-900 border-slate-800 hover:border-slate-700"
            }`}
          >
            <span className="text-3xl">⚾</span>
            <span className="font-bold text-white text-sm">Team B (Bowling)</span>
            <span className="text-xs font-semibold text-blue-400">1.95× Payout</span>
          </button>

          <button
            disabled={phase !== "betting"}
            onClick={() => setSelection("tie")}
            className={`p-4 rounded-2xl border-2 transition flex flex-col items-center justify-center gap-1 ${
              selection === "tie"
                ? "bg-yellow-600/30 border-yellow-400 shadow-lg shadow-yellow-600/20 scale-105"
                : "bg-slate-900 border-slate-800 hover:border-slate-700"
            }`}
          >
            <span className="text-3xl">🤝</span>
            <span className="font-bold text-white text-sm">Super Over</span>
            <span className="text-xs font-semibold text-yellow-400">8.00× Payout</span>
          </button>
        </div>

        {/* Stake Selector & Action Button */}
        {phase === "betting" ? (
          <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Select Stake</span>
              <span className="text-sm font-bold text-yellow-400">{formatCurrency(stake)}</span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {CHIP_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  onClick={() => setStake(amt)}
                  className={`py-2 rounded-xl font-bold text-xs transition border ${
                    stake === amt
                      ? "bg-yellow-400 text-slate-950 border-yellow-300"
                      : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
                  }`}
                >
                  {amt >= 1000 ? `${amt / 1000}k` : amt}
                </button>
              ))}
            </div>

            <button
              disabled={isPlacing || !selection}
              onClick={handlePlaceBet}
              className="w-full py-3.5 rounded-xl font-bold text-base bg-gradient-to-r from-yellow-400 to-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 hover:brightness-110 active:scale-[0.99] transition disabled:opacity-50"
            >
              {isPlacing ? "Placing Bet..." : `Place Bet · ${formatCurrency(stake)}`}
            </button>
          </div>
        ) : phase === "result" ? (
          <button
            onClick={resetGame}
            className="w-full max-w-xs py-3.5 rounded-xl font-bold text-base bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition"
          >
            Play Next Over 🏏
          </button>
        ) : null}
      </div>

      {/* Footer Info */}
      <div className="text-xs text-slate-500 flex items-center gap-1">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Provably Fair House Risk Algorithm Active
      </div>
    </div>
  );
}
