import { useState, useCallback, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey, getGetBalanceQueryKey } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Wallet } from "lucide-react";

const CHIP_AMOUNTS = [100, 500, 1000, 5000, 10000];
const API = import.meta.env.BASE_URL.replace(/\/$/, "");
type Selection = "under7" | "seven" | "over7";
type Phase = "betting" | "rolling" | "settling" | "result";

// Pip layout for each face (9 positions in a 3×3 grid, reading order)
const PIP_MAP: Record<number, number[]> = {
  1: [0,0,0, 0,1,0, 0,0,0],
  2: [0,0,1, 0,0,0, 1,0,0],
  3: [0,0,1, 0,1,0, 1,0,0],
  4: [1,0,1, 0,0,0, 1,0,1],
  5: [1,0,1, 0,1,0, 1,0,1],
  6: [1,0,1, 1,0,1, 1,0,1],
};

function mkCtx() { return new ((window as any).AudioContext || (window as any).webkitAudioContext)(); }
function playDiceRoll() {
  try {
    const c = mkCtx();
    [180, 220, 200].forEach((freq, i) => {
      const o = c.createOscillator(); const g = c.createGain();
      o.connect(g); g.connect(c.destination); o.type = "square"; o.frequency.value = freq;
      const t = c.currentTime + i * 0.06;
      g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
      o.start(t); o.stop(t + 0.07);
    });
    setTimeout(() => c.close(), 500);
  } catch (_) {}
}
function playSettle() {
  try {
    const c = mkCtx();
    const o = c.createOscillator(); const g = c.createGain();
    o.connect(g); g.connect(c.destination); o.type = "sine"; o.frequency.value = 660;
    g.gain.setValueAtTime(0.18, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.18);
    o.start(c.currentTime); o.stop(c.currentTime + 0.18);
    setTimeout(() => c.close(), 400);
  } catch (_) {}
}
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

function Die({ value, rolling, settled }: { value?: number; rolling?: boolean; settled?: boolean }) {
  const pips = value ? PIP_MAP[value] : Array(9).fill(0);
  const dotColor = settled ? "#c0392b" : "#1c1c1c";
  return (
    <div style={{
      width: 110, height: 110, flexShrink: 0,
      background: settled
        ? "linear-gradient(145deg, #fffde7 0%, #fff8c4 60%, #ffe97a 100%)"
        : rolling
        ? "linear-gradient(145deg, #ffffff 0%, #f5f5f5 100%)"
        : "linear-gradient(145deg, #f0f0f0 0%, #e0e0e0 100%)",
      borderRadius: 20,
      border: `4px solid ${settled ? "#f5c542" : rolling ? "#aaa" : "#bbb"}`,
      boxShadow: settled
        ? "0 10px 36px rgba(245,197,66,0.55), inset 0 2px 0 rgba(255,255,255,0.9), 0 0 0 2px rgba(245,197,66,0.4)"
        : rolling
        ? "0 6px 24px rgba(0,0,0,0.5), inset 0 2px 0 rgba(255,255,255,0.7)"
        : "0 4px 16px rgba(0,0,0,0.45), inset 0 2px 0 rgba(255,255,255,0.6)",
      padding: 12,
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gridTemplateRows: "repeat(3, 1fr)",
      gap: 4,
      animation: rolling && !settled ? "die-roll 0.12s linear infinite" : settled ? "dieSettle 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards" : "none",
      transition: "border-color 0.3s, box-shadow 0.3s",
    }}>
      {pips.map((filled, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          {filled ? (
            <div style={{
              width: "78%", height: "78%", borderRadius: "50%",
              background: dotColor,
              boxShadow: `inset 0 1px 3px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.15)`,
            }} />
          ) : null}
        </div>
      ))}
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
  const [phase, setPhase] = useState<Phase>("betting");
  const [result, setResult] = useState<any>(null);
  const [balance, setBalance] = useState<number>(parseFloat(String(user?.balance || "0")));
  const [isPlacing, setIsPlacing] = useState(false);

  // Rolling animation state
  const [rollVal1, setRollVal1] = useState<number | undefined>();
  const [rollVal2, setRollVal2] = useState<number | undefined>();
  const [die1Settled, setDie1Settled] = useState(false);
  const [die2Settled, setDie2Settled] = useState(false);
  const rollIvRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingResultRef = useRef<any>(null);

  useEffect(() => { setBalance(parseFloat(String(user?.balance || "0"))); }, [user?.balance]);

  // Rapid cycling while rolling
  useEffect(() => {
    if (phase !== "rolling") return;
    setDie1Settled(false); setDie2Settled(false);
    rollIvRef.current = setInterval(() => {
      setRollVal1(Math.ceil(Math.random() * 6));
      setRollVal2(Math.ceil(Math.random() * 6));
    }, 80);
    return () => { if (rollIvRef.current) clearInterval(rollIvRef.current); };
  }, [phase]);

  // When settling: stop cycling and lock each die to actual value
  useEffect(() => {
    if (phase !== "settling" || !pendingResultRef.current) return;
    if (rollIvRef.current) { clearInterval(rollIvRef.current); rollIvRef.current = null; }
    const data = pendingResultRef.current;
    const d1 = data.details?.dice1;
    const d2 = data.details?.dice2;
    // Settle die 1 first
    setTimeout(() => {
      setRollVal1(d1);
      setDie1Settled(true);
      playSettle();
    }, 200);
    // Settle die 2
    setTimeout(() => {
      setRollVal2(d2);
      setDie2Settled(true);
      playSettle();
    }, 700);
    // Show result
    setTimeout(() => {
      setPhase("result");
    }, 1400);
  }, [phase]);

  const pollRound = useCallback(async (rId: string, sel: string) => {
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      if (attempts > 240) { clearInterval(interval); setPhase("betting"); return; }
      try {
        const r = await fetch(`${API}/api/games/casino-round/lucky-7/${rId}`, { credentials: "include" });
        const data = await r.json();
        if (data.status === "settled") {
          clearInterval(interval);
          setResult(data);
          pendingResultRef.current = data;
          const won = data.result === sel;
          if (won) playWin(); else playLose();
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetBalanceQueryKey() });
          setPhase("settling");
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
      setResult(null); pendingResultRef.current = null;
      setDie1Settled(false); setDie2Settled(false);
      setPhase("rolling");
      pollRound(data.roundId, selection);
      toast({ title: `Bet on ${selection}!`, description: "Rolling the dice..." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
      setPhase("betting");
    } finally {
      setIsPlacing(false);
    }
  };

  const reset = () => {
    setPhase("betting"); setResult(null); setSelection(null);
    setDie1Settled(false); setDie2Settled(false);
    pendingResultRef.current = null;
  };

  const won = result?.result === selection;
  const d1 = result?.details?.dice1;
  const d2 = result?.details?.dice2;
  const sum = result?.details?.sum;
  const isPlaying = phase === "rolling" || phase === "settling";

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(180deg,#0a2414 0%,#081c0e 100%)" }}>
      <style>{`
        @keyframes die-roll {
          0%  { transform: rotate(-12deg) scale(0.93) translateY(0px); }
          25% { transform: rotate(10deg)  scale(1.07) translateY(-8px); }
          50% { transform: rotate(-8deg)  scale(0.95) translateY(2px); }
          75% { transform: rotate(12deg)  scale(1.05) translateY(-5px); }
          100%{ transform: rotate(-12deg) scale(0.93) translateY(0px); }
        }
        @keyframes dieSettle {
          0%  { transform: scale(0.85) rotate(-6deg); }
          55% { transform: scale(1.18) rotate(3deg); }
          75% { transform: scale(0.96) rotate(-1deg); }
          100%{ transform: scale(1.08) rotate(0deg); }
        }
        @keyframes sumPop {
          0%  { transform: scale(0.5); opacity: 0; }
          70% { transform: scale(1.15); opacity: 1; }
          100%{ transform: scale(1);   opacity: 1; }
        }
      `}</style>
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
        <div className="w-full rounded-3xl relative overflow-hidden flex flex-col items-center justify-center py-12 gap-6"
          style={{ background: "linear-gradient(135deg,#0d3320,#072010)", border: "2px solid rgba(245,197,66,0.2)", minHeight: 280 }}>
          <div className="pointer-events-none absolute inset-0 select-none opacity-[0.04] flex flex-wrap gap-6 p-4 text-5xl">
            {[...Array(12)].map((_,i) => <span key={i}>🎲</span>)}
          </div>

          {phase === "betting" && (
            <div className="relative z-10 flex flex-col items-center gap-5">
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "rgba(245,197,66,0.6)" }}>Roll two dice!</p>
              <div className="flex gap-8 items-center" style={{ opacity: 0.65 }}>
                <Die value={4} />
                <div className="text-4xl font-black" style={{ color: "rgba(255,255,255,0.5)" }}>+</div>
                <Die value={3} />
              </div>
              <p className="text-sm font-semibold" style={{ color: "rgba(245,197,66,0.55)", letterSpacing: 1 }}>Will the sum be under 7, exactly 7, or over 7?</p>
            </div>
          )}

          {(phase === "rolling" || phase === "settling") && (
            <div className="relative z-10 flex flex-col items-center gap-5">
              <p className="text-xs font-bold uppercase tracking-wider animate-pulse" style={{ color: "#f5c542" }}>
                {phase === "rolling" ? "🎲 Rolling..." : "Settling..."}
              </p>
              <div className="flex gap-8 items-center">
                <Die value={rollVal1} rolling={phase === "rolling" || !die1Settled} settled={die1Settled} />
                <div className="text-4xl font-black" style={{ color: die1Settled && die2Settled ? "#f5c542" : "rgba(255,255,255,0.4)" }}>+</div>
                <Die value={rollVal2} rolling={phase === "rolling" || !die2Settled} settled={die2Settled} />
              </div>
              {(die1Settled || die2Settled) && (
                <div className="text-3xl font-black" style={{ color: "#f5c542", animation: die1Settled && die2Settled ? "sumPop 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards" : "none", textShadow: "0 0 20px rgba(245,197,66,0.7)" }}>
                  {die1Settled && die2Settled ? `= ${(rollVal1 ?? 0) + (rollVal2 ?? 0)}` : die1Settled ? `${rollVal1} + ?` : "? + ?"}
                </div>
              )}
            </div>
          )}

          {phase === "result" && (
            <div className="relative z-10 flex flex-col items-center gap-5">
              <div className={`text-center px-6 py-2 rounded-2xl font-bold text-lg ${won ? "text-yellow-400" : "text-red-400"}`}
                style={{ background: won ? "rgba(245,197,66,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${won ? "rgba(245,197,66,0.3)" : "rgba(239,68,68,0.3)"}` }}>
                {won ? "🏆 You Won!" : "😔 You Lost"} · Sum: {sum}
              </div>
              <div className="flex gap-8 items-center">
                <Die value={d1} settled />
                <div className="text-4xl font-black" style={{ color: "#f5c542" }}>+</div>
                <Die value={d2} settled />
              </div>
              <div className="text-2xl font-black text-white">= {sum} → <span style={{ color: "#f5c542" }} className="capitalize">{result?.result?.replace("7","7 🍀")}</span></div>
            </div>
          )}
        </div>

        {/* Controls */}
        {!isPlaying && (
          <div className="w-full space-y-4">
            {phase === "result" ? (
              <button onClick={reset} className="w-full py-4 rounded-2xl font-bold text-base transition-all hover:scale-105"
                style={{ background: "linear-gradient(135deg,#d4a017,#f5c542)", color: "#081c0e", boxShadow: "0 0 20px rgba(245,197,66,0.35)" }}>
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
                      PKR {amt >= 1000 ? `${amt/1000}K` : amt}
                    </button>
                  ))}
                </div>
                <button onClick={placeBet} disabled={isPlacing || !selection}
                  className="w-full py-4 rounded-2xl font-bold text-base transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: "linear-gradient(135deg,#d4a017,#f5c542)", color: "#081c0e", boxShadow: "0 0 20px rgba(245,197,66,0.35)" }}>
                  {isPlacing ? "Rolling..." : `Roll Dice · ${formatCurrency(stake)}`}
                </button>
              </>
            )}
          </div>
        )}

        {isPlaying && (
          <div className="text-center text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
            {formatCurrency(stake)} bet on <strong style={{ color: "#f5c542" }}>{selection}</strong>
            {phase === "rolling" && " · Dice rolling..."}
            {phase === "settling" && " · Dice landing..."}
          </div>
        )}
      </div>
    </div>
  );
}
