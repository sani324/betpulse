import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey, getGetBalanceQueryKey } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Wallet, RefreshCw } from "lucide-react";

const CHIP_AMOUNTS = [100, 500, 1000, 5000, 10000];
const API = import.meta.env.BASE_URL.replace(/\/$/, "");

const SYMBOLS: { key: string; icon: string; label: string; color: string }[] = [
  { key: "spade",   icon: "♠", label: "Hukum",   color: "#94a3b8" },
  { key: "heart",   icon: "♥", label: "Paan",     color: "#ef4444" },
  { key: "diamond", icon: "♦", label: "Iit",      color: "#f97316" },
  { key: "club",    icon: "♣", label: "Chidi",    color: "#22c55e" },
  { key: "star",    icon: "★", label: "Flag",     color: "#f5c542" },
  { key: "moon",    icon: "☽", label: "Crown",    color: "#a855f7" },
];

function mkCtx() { return new ((window as any).AudioContext || (window as any).webkitAudioContext)(); }
function playWin() {
  try {
    const c = mkCtx();
    [523, 659, 784, 1047].forEach((freq, i) => {
      const o = c.createOscillator(); const g = c.createGain();
      o.connect(g); g.connect(c.destination); o.type = "triangle"; o.frequency.value = freq;
      const t = c.currentTime + i * 0.12;
      g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      o.start(t); o.stop(t + 0.4);
    });
    setTimeout(() => c.close(), 2500);
  } catch (_) {}
}
function playLose() {
  try {
    const c = mkCtx();
    [300, 250].forEach((freq, i) => {
      const o = c.createOscillator(); const g = c.createGain();
      o.connect(g); g.connect(c.destination); o.type = "sawtooth"; o.frequency.value = freq;
      const t = c.currentTime + i * 0.2;
      g.gain.setValueAtTime(0.1, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      o.start(t); o.stop(t + 0.25);
    });
    setTimeout(() => c.close(), 2000);
  } catch (_) {}
}

export default function JhandiMundaGame() {
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

  const pollRound = useCallback(async (rId: string, sel: string) => {
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      if (attempts > 120) { clearInterval(interval); setPhase("betting"); return; }
      try {
        const r = await fetch(`${API}/api/games/casino-round/jhandi-munda/${rId}`, { credentials: "include" });
        const data = await r.json();
        if (data.status === "settled") {
          clearInterval(interval);
          setResult(data);
          setPhase("result");
          if (data.result === sel) playWin(); else playLose();
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetBalanceQueryKey() });
        }
      } catch (_) {}
    }, 2000);
  }, [queryClient]);

  const placeBet = async () => {
    if (!isAuthenticated) { setLocation("/login"); return; }
    if (!selection) { toast({ title: "Pick a symbol!", variant: "destructive" }); return; }
    if (balance < stake) { toast({ title: "Insufficient balance", variant: "destructive" }); return; }
    setIsPlacing(true);
    try {
      const r = await fetch(`${API}/api/games/jhandi-munda`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stake, selection }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Failed");
      setBalance(data.newBalance);
      setPhase("waiting");
      pollRound(data.roundId, selection);
      const sym = SYMBOLS.find(s => s.key === selection);
      toast({ title: `Bet on ${sym?.icon} ${sym?.label}!`, description: "Waiting for dice roll..." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsPlacing(false);
    }
  };

  const reset = () => { setPhase("betting"); setResult(null); setSelection(null); };
  const won = result?.result === selection;
  const resultSym = SYMBOLS.find(s => s.key === result?.result);
  const selSym = SYMBOLS.find(s => s.key === selection);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(180deg,#0a2414 0%,#081c0e 100%)" }}>
      <header className="flex items-center justify-between px-4 py-3" style={{ background: "rgba(13,43,26,0.8)", borderBottom: "1px solid rgba(245,197,66,0.12)" }}>
        <button onClick={() => setLocation("/")} className="flex items-center gap-2 text-sm font-medium" style={{ color: "rgba(255,255,255,0.6)" }}>
          <ArrowLeft size={18} /> Back
        </button>
        <span className="font-black text-xl" style={{ background: "linear-gradient(90deg,#f5c542,#ffeba1)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Jhandi Munda 🎴</span>
        <div className="flex items-center gap-1.5 text-sm font-bold" style={{ color: "#f5c542" }}>
          <Wallet size={14} /> {formatCurrency(balance)}
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center p-4 gap-6 max-w-lg mx-auto w-full">

        {/* Dice area */}
        <div className="w-full rounded-3xl relative overflow-hidden flex flex-col items-center justify-center py-8 gap-5"
          style={{ background: "linear-gradient(135deg,#0d3320,#072010)", border: "2px solid rgba(245,197,66,0.2)", minHeight: 220 }}>

          {phase === "betting" && (
            <div className="flex flex-col items-center gap-3">
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "rgba(245,197,66,0.6)" }}>6 Dice · Pick your symbol</p>
              <div className="flex gap-2 flex-wrap justify-center">
                {SYMBOLS.map(s => (
                  <div key={s.key} className="w-12 h-12 rounded-xl flex items-center justify-center text-3xl" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)" }}>{s.icon}</div>
                ))}
              </div>
              <p className="text-sm text-center px-6" style={{ color: "rgba(255,255,255,0.3)" }}>Roll 6 dice · If your symbol appears, you win!</p>
            </div>
          )}

          {phase === "waiting" && (
            <div className="flex flex-col items-center gap-4">
              <div className="flex gap-2 flex-wrap justify-center">
                {SYMBOLS.map(s => (
                  <div key={s.key} className="w-12 h-12 rounded-xl flex items-center justify-center text-3xl animate-bounce" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)", animationDelay: `${Math.random() * 0.5}s` }}>{s.icon}</div>
                ))}
              </div>
              <div className="flex items-center gap-2 text-white font-bold">
                <RefreshCw size={16} className="animate-spin" style={{ color: "#f5c542" }} /> Rolling 6 dice...
              </div>
            </div>
          )}

          {phase === "result" && (
            <div className="flex flex-col items-center gap-4">
              <div className={`text-center px-6 py-2 rounded-2xl font-bold ${won ? "text-yellow-400" : "text-red-400"}`} style={{ background: won ? "rgba(245,197,66,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${won ? "rgba(245,197,66,0.3)" : "rgba(239,68,68,0.3)"}` }}>
                {won ? "🏆 You Won!" : "😔 You Lost"}
              </div>
              <div className="flex gap-2 flex-wrap justify-center">
                {(result?.details?.dice || SYMBOLS.map(s => s.key)).map((sym: string, i: number) => {
                  const s = SYMBOLS.find(x => x.key === sym);
                  const isSelected = sym === selection;
                  return (
                    <div key={i} className="w-12 h-12 rounded-xl flex items-center justify-center text-3xl transition-all" style={{ background: isSelected ? "rgba(245,197,66,0.2)" : "rgba(0,0,0,0.3)", border: isSelected ? "2px solid rgba(245,197,66,0.6)" : "1px solid rgba(255,255,255,0.08)", boxShadow: isSelected ? "0 0 12px rgba(245,197,66,0.4)" : "none" }}>
                      {s?.icon}
                    </div>
                  );
                })}
              </div>
              <div className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.6)" }}>
                Result: <span style={{ color: resultSym?.color, fontSize: 20 }}>{resultSym?.icon}</span> <span style={{ color: "#f5c542" }}>{resultSym?.label}</span>
              </div>
            </div>
          )}
        </div>

        {phase !== "waiting" && (
          <div className="w-full space-y-4">
            {phase === "result" ? (
              <button onClick={reset} className="w-full py-4 rounded-2xl font-bold text-base transition-all hover:scale-105" style={{ background: "linear-gradient(135deg,#d4a017,#f5c542)", color: "#081c0e" }}>
                Play Again
              </button>
            ) : (
              <>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-3 text-center" style={{ color: "rgba(255,255,255,0.4)" }}>Pick your symbol · 6× payout</p>
                  <div className="grid grid-cols-3 gap-3">
                    {SYMBOLS.map(sym => (
                      <button key={sym.key} onClick={() => setSelection(sym.key)}
                        className="py-4 rounded-2xl flex flex-col items-center gap-1 transition-all hover:scale-105"
                        style={{ background: selection === sym.key ? `${sym.color}22` : "rgba(13,43,26,0.6)", border: `2px solid ${selection === sym.key ? sym.color : "rgba(255,255,255,0.08)"}`, boxShadow: selection === sym.key ? `0 0 20px ${sym.color}44` : "none" }}>
                        <span className="text-3xl" style={{ color: sym.color }}>{sym.icon}</span>
                        <span className="text-xs font-bold text-white">{sym.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap justify-center">
                  {CHIP_AMOUNTS.map(amt => (
                    <button key={amt} onClick={() => setStake(amt)}
                      className="px-4 py-2 rounded-xl text-sm font-bold transition-all hover:scale-105"
                      style={{ background: stake === amt ? "linear-gradient(135deg,#d4a017,#f5c542)" : "rgba(13,43,26,0.6)", color: stake === amt ? "#081c0e" : "rgba(255,255,255,0.6)", border: `1px solid ${stake === amt ? "transparent" : "rgba(255,255,255,0.1)"}` }}>
                      ₹{amt >= 1000 ? `${amt/1000}K` : amt}
                    </button>
                  ))}
                </div>

                <button onClick={placeBet} disabled={isPlacing || !selection}
                  className="w-full py-4 rounded-2xl font-bold text-base transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: "linear-gradient(135deg,#d4a017,#f5c542)", color: "#081c0e", boxShadow: "0 0 20px rgba(245,197,66,0.35)" }}>
                  {isPlacing ? "Placing..." : `Bet ${formatCurrency(stake)} on ${selSym ? selSym.icon + " " + selSym.label : "..."}`}
                </button>
              </>
            )}
          </div>
        )}

        {phase === "waiting" && (
          <div className="text-center text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
            Bet of {formatCurrency(stake)} on <strong style={{ color: selSym?.color }}>{selSym?.icon} {selSym?.label}</strong> placed. Rolling dice...
          </div>
        )}
      </div>
    </div>
  );
}
