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
type Selection = "under7" | "seven" | "over7";

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
    [300, 250, 200].forEach((freq, i) => {
      const o = c.createOscillator(); const g = c.createGain();
      o.connect(g); g.connect(c.destination); o.type = "sawtooth"; o.frequency.value = freq;
      const t = c.currentTime + i * 0.2;
      g.gain.setValueAtTime(0.1, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      o.start(t); o.stop(t + 0.25);
    });
    setTimeout(() => c.close(), 2000);
  } catch (_) {}
}

const DICE_FACES: Record<number, string> = { 1: "⚀", 2: "⚁", 3: "⚂", 4: "⚃", 5: "⚄", 6: "⚅" };

function DiceFace({ value, rolling }: { value?: number; rolling?: boolean }) {
  return (
    <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-5xl shadow-2xl transition-all ${rolling ? "animate-bounce" : ""}`}
      style={{ background: "white", border: "3px solid #e5e7eb", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
      {value ? DICE_FACES[value] : <span className="text-gray-300">?</span>}
    </div>
  );
}

export default function Lucky7Game() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [stake, setStake] = useState(500);
  const [selection, setSelection] = useState<Selection | null>(null);
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
        const r = await fetch(`${API}/api/games/casino-round/lucky-7/${rId}`, { credentials: "include" });
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
    }, 500);
  }, [queryClient]);

  const placeBet = async () => {
    if (!isAuthenticated) { setLocation("/login"); return; }
    if (!selection) { toast({ title: "Pick a side first!", variant: "destructive" }); return; }
    if (balance < stake) { toast({ title: "Insufficient balance", variant: "destructive" }); return; }
    setIsPlacing(true);
    try {
      const r = await fetch(`${API}/api/games/lucky-7`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stake, selection }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Failed");
      setBalance(data.newBalance);
      setPhase("waiting");
      pollRound(data.roundId, selection);
      toast({ title: `Bet placed on ${selection}!`, description: "⚡ Auto-Decider is running..." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsPlacing(false);
    }
  };

  const reset = () => { setPhase("betting"); setResult(null); setSelection(null); };

  const won = result?.result === selection;
  const d1 = result?.details?.dice1;
  const d2 = result?.details?.dice2;
  const sum = result?.details?.sum;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(180deg,#0a2414 0%,#081c0e 100%)" }}>
      <header className="flex items-center justify-between px-4 py-3" style={{ background: "rgba(13,43,26,0.8)", borderBottom: "1px solid rgba(245,197,66,0.12)" }}>
        <button onClick={() => setLocation("/")} className="flex items-center gap-2 text-sm font-medium" style={{ color: "rgba(255,255,255,0.6)" }}>
          <ArrowLeft size={18} /> Back
        </button>
        <span className="font-black text-xl" style={{ background: "linear-gradient(90deg,#f5c542,#ffeba1)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Lucky 7 🎲</span>
        <div className="flex items-center gap-1.5 text-sm font-bold" style={{ color: "#f5c542" }}>
          <Wallet size={14} /> {formatCurrency(balance)}
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center p-4 gap-6 max-w-lg mx-auto w-full">

        {/* Dice area */}
        <div className="w-full rounded-3xl relative overflow-hidden flex flex-col items-center justify-center py-12 gap-6" style={{ background: "linear-gradient(135deg,#0d3320,#072010)", border: "2px solid rgba(245,197,66,0.2)", minHeight: 260 }}>
          <div className="pointer-events-none absolute inset-0 select-none opacity-[0.03] flex flex-wrap gap-6 p-4 text-6xl">
            {[...Array(12)].map((_,i) => <span key={i}>⚄</span>)}
          </div>

          {phase === "betting" && (
            <div className="relative z-10 flex flex-col items-center gap-4">
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "rgba(245,197,66,0.6)" }}>Roll the dice!</p>
              <div className="flex gap-6">
                <DiceFace />
                <div className="flex items-center text-3xl font-black text-white">+</div>
                <DiceFace />
              </div>
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>Will the sum be under 7, exactly 7, or over 7?</p>
            </div>
          )}

          {phase === "waiting" && (
            <div className="relative z-10 flex flex-col items-center gap-4">
              <div className="flex gap-6">
                <DiceFace rolling />
                <div className="flex items-center text-3xl font-black text-white">+</div>
                <DiceFace rolling />
              </div>
              <div className="flex items-center gap-2 text-white font-bold">
                <RefreshCw size={16} className="animate-spin" style={{ color: "#f5c542" }} /> Auto-Decider running...
              </div>
            </div>
          )}

          {phase === "result" && (
            <div className="relative z-10 flex flex-col items-center gap-4">
              <div className={`text-center px-6 py-2 rounded-2xl font-bold ${won ? "text-yellow-400" : "text-red-400"}`} style={{ background: won ? "rgba(245,197,66,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${won ? "rgba(245,197,66,0.3)" : "rgba(239,68,68,0.3)"}` }}>
                {won ? "🏆 You Won!" : "😔 You Lost"} · Sum: {sum}
              </div>
              <div className="flex gap-6">
                <DiceFace value={d1} />
                <div className="flex items-center text-3xl font-black" style={{ color: "#f5c542" }}>+</div>
                <DiceFace value={d2} />
              </div>
              <div className="text-lg font-black text-white">= {sum} → <span style={{ color: "#f5c542" }} className="capitalize">{result?.result}</span></div>
            </div>
          )}
        </div>

        {phase !== "waiting" && (
          <div className="w-full space-y-4">
            {phase === "result" ? (
              <button onClick={reset} className="w-full py-4 rounded-2xl font-bold text-base transition-all hover:scale-105" style={{ background: "linear-gradient(135deg,#d4a017,#f5c542)", color: "#081c0e", boxShadow: "0 0 20px rgba(245,197,66,0.35)" }}>
                Roll Again
              </button>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3">
                  {([
                    { key: "under7" as Selection, label: "Under 7", sub: "1.95×", color: "#3b82f6", icon: "📉" },
                    { key: "seven"  as Selection, label: "Lucky 7", sub: "5×",    color: "#f5c542", icon: "7️⃣" },
                    { key: "over7"  as Selection, label: "Over 7",  sub: "1.95×", color: "#ef4444", icon: "📈" },
                  ]).map(opt => (
                    <button key={opt.key} onClick={() => setSelection(opt.key)}
                      className="py-4 rounded-2xl flex flex-col items-center gap-1 transition-all hover:scale-105"
                      style={{ background: selection === opt.key ? `${opt.color}22` : "rgba(13,43,26,0.6)", border: `2px solid ${selection === opt.key ? opt.color : "rgba(255,255,255,0.08)"}`, boxShadow: selection === opt.key ? `0 0 20px ${opt.color}44` : "none" }}>
                      <span className="text-2xl">{opt.icon}</span>
                      <span className="text-sm font-bold text-white">{opt.label}</span>
                      <span className="text-xs font-semibold" style={{ color: opt.color }}>{opt.sub}</span>
                    </button>
                  ))}
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
                  {isPlacing ? "Placing..." : `Bet ${formatCurrency(stake)}`}
                </button>
              </>
            )}
          </div>
        )}

        {phase === "waiting" && (
          <div className="text-center text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
            Bet of {formatCurrency(stake)} on <strong style={{ color: "#f5c542" }}>{selection}</strong> placed. Waiting for roll...
          </div>
        )}
      </div>
    </div>
  );
}
