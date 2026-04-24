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

const OPTIONS = [
  { key: "x2",  label: "Cash at 2×",  sub: "2×",  color: "#22c55e", mult: 2 },
  { key: "x5",  label: "Cash at 5×",  sub: "5×",  color: "#f97316", mult: 5 },
  { key: "x10", label: "Cash at 10×", sub: "10×", color: "#ef4444", mult: 10 },
];

// SVG viewBox: 0 0 320 210
const VW = 320, VH = 210;
const ORIGIN_X = 28, ORIGIN_Y = 190; // graph origin

function multToPoint(m: number): [number, number] {
  const t = Math.min((m - 1) / 10, 1);          // 1× = 0, 11× = 1
  const x = ORIGIN_X + t * (VW - ORIGIN_X - 16);
  const y = ORIGIN_Y - Math.pow(t, 0.65) * (VH - 24); // exponential-ish rise
  return [x, y];
}

function angleForPoints(prev: [number, number], curr: [number, number]): number {
  const dx = curr[0] - prev[0];
  const dy = curr[1] - prev[1];
  return Math.atan2(-dy, dx) * (180 / Math.PI);
}

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

// Flying plane SVG element
function PlaneSVG({ x, y, angle, crashed, cashedOut }: { x: number; y: number; angle: number; crashed: boolean; cashedOut: boolean }) {
  if (crashed) {
    return <text x={x - 14} y={y + 12} fontSize="26">💥</text>;
  }
  if (cashedOut) {
    return (
      <>
        <text x={x - 14} y={y + 12} fontSize="22"
          style={{ transformOrigin: `${x}px ${y}px`, transform: `rotate(${-angle}deg)` }}>✈️</text>
        <text x={x + 4} y={y - 8} fontSize="14">💰</text>
      </>
    );
  }
  return (
    <g transform={`translate(${x},${y}) rotate(${-angle})`}>
      <text x="-14" y="12" fontSize="22">✈️</text>
    </g>
  );
}

// Confetti burst for win
function Confetti() {
  const items = ["💰", "⭐", "✨", "🏆", "🎊", "💎", "🌟", "🎉"];
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {[...Array(14)].map((_, i) => (
        <div key={i} className="absolute text-xl animate-bounce"
          style={{ left: `${8 + (i * 7) % 88}%`, top: `${10 + (i * 13) % 70}%`,
            animationDelay: `${(i * 0.07) % 0.6}s`, animationDuration: `${0.4 + (i % 3) * 0.15}s` }}>
          {items[i % items.length]}
        </div>
      ))}
    </div>
  );
}

type AnimPhase = "idle" | "flying" | "ending" | "done";

export default function CrashGame() {
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

  // Animation state
  const [animPhase, setAnimPhase] = useState<AnimPhase>("idle");
  const [displayMult, setDisplayMult] = useState(1.00);
  const [pathPoints, setPathPoints] = useState<[number, number][]>([[ORIGIN_X, ORIGIN_Y]]);
  const [planeAngle, setPlaneAngle] = useState(25);
  const [crashed, setCrashed] = useState(false);
  const [cashedOut, setCashedOut] = useState(false);

  const animRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);
  const resultRef = useRef<any>(null);
  const selectionRef = useRef<string | null>(null);

  useEffect(() => { setBalance(parseFloat(user?.balance || "0")); }, [user?.balance]);

  // Store result in ref so animation loop can read it
  useEffect(() => { resultRef.current = result; }, [result]);
  useEffect(() => { selectionRef.current = selection; }, [selection]);

  // ── Animation tick ──────────────────────────────────────────────────────────
  const stopAnim = useCallback(() => {
    if (animRef.current) { clearInterval(animRef.current); animRef.current = null; }
  }, []);

  const startFlyingAnim = useCallback(() => {
    stopAnim();
    startTimeRef.current = Date.now();
    setDisplayMult(1.00);
    setPathPoints([[ORIGIN_X, ORIGIN_Y]]);
    setCrashed(false);
    setCashedOut(false);
    setAnimPhase("flying");

    animRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const currentResult = resultRef.current;
      const sel = selectionRef.current;

      if (currentResult && animRef.current) {
        // Result known — race toward target or crash over 2s
        const won = currentResult.result === sel;
        const opt = OPTIONS.find(o => o.key === currentResult.result);
        const targetMult = won ? (OPTIONS.find(o => o.key === sel)?.mult ?? 2) : (opt?.mult ?? 2);
        const endElapsed = (Date.now() - startTimeRef.current) / 1000;
        // Spend 1.8s rising to target
        const progress = Math.min(endElapsed / 2.0, 1);
        const m = 1 + (targetMult - 1) * Math.pow(progress, 0.6);

        setDisplayMult(m);
        const pt = multToPoint(m);
        setPathPoints(prev => {
          const last = prev[prev.length - 1];
          const ang = angleForPoints(last, pt);
          setPlaneAngle(ang);
          return [...prev, pt];
        });

        if (progress >= 1) {
          stopAnim();
          setAnimPhase("done");
          if (won) setCashedOut(true); else setCrashed(true);
        }
        return;
      }

      // No result yet — fly at increasing speed
      const m = 1 + elapsed * 0.7 + elapsed * elapsed * 0.15;
      setDisplayMult(Math.min(m, 12));
      const pt = multToPoint(Math.min(m, 12));
      setPathPoints(prev => {
        const last = prev[prev.length - 1];
        const ang = angleForPoints(last, pt);
        setPlaneAngle(ang);
        return [...prev, pt];
      });
    }, 40);
  }, [stopAnim]);

  // Reset animation when back to betting
  useEffect(() => {
    if (phase === "betting") {
      stopAnim();
      setAnimPhase("idle");
      setDisplayMult(1.00);
      setPathPoints([[ORIGIN_X, ORIGIN_Y]]);
      setCrashed(false);
      setCashedOut(false);
      setPlaneAngle(25);
    } else if (phase === "waiting") {
      startFlyingAnim();
    }
  }, [phase, startFlyingAnim, stopAnim]);

  // Clean up on unmount
  useEffect(() => stopAnim, [stopAnim]);

  // ── Polling ─────────────────────────────────────────────────────────────────
  const pollRound = useCallback(async (rId: string, sel: string) => {
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      if (attempts > 240) { clearInterval(interval); setPhase("betting"); return; }
      try {
        const r = await fetch(`${API}/api/games/casino-round/crash/${rId}`, { credentials: "include" });
        const data = await r.json();
        if (data.status === "settled") {
          clearInterval(interval);
          setResult(data);
          // 2s dramatic animation then reveal
          setTimeout(() => {
            setPhase("result");
            if (data.result === sel) playWin(); else playLose();
            queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetBalanceQueryKey() });
          }, 2000);
        }
      } catch (_) {}
    }, 500);
  }, [queryClient]);

  // ── Place Bet ───────────────────────────────────────────────────────────────
  const placeBet = async () => {
    if (!isAuthenticated) { setLocation("/login"); return; }
    if (!selection) { toast({ title: "Pick a cashout target first!", variant: "destructive" }); return; }
    if (balance < stake) { toast({ title: "Insufficient balance!", variant: "destructive" }); return; }
    setIsPlacing(true);
    try {
      const r = await fetch(`${API}/api/games/crash`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stake, selection }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Failed to place bet");
      setBalance(data.newBalance);
      setResult(null);
      setPhase("waiting");
      pollRound(data.roundId, selection);
      const opt = OPTIONS.find(o => o.key === selection);
      toast({ title: "🚀 Bet Placed!", description: `₹${stake.toLocaleString()} — cashing out at ${opt?.sub}` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsPlacing(false);
    }
  };

  const reset = () => { setPhase("betting"); setResult(null); setSelection(null); };

  const won = result?.result === selection;
  const selectedOpt = OPTIONS.find(o => o.key === selection);
  const resultOpt = OPTIONS.find(o => o.key === result?.result);
  const currentPt = pathPoints[pathPoints.length - 1] ?? [ORIGIN_X, ORIGIN_Y];

  // Multiplier color
  const multColor = displayMult < 2 ? "#22c55e" : displayMult < 5 ? "#f97316" : "#ef4444";

  // Gradient stop for path (changes as mult rises)
  const pathColor = displayMult < 2 ? "#22c55e" : displayMult < 5 ? "#f97316" : "#ef4444";

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(180deg,#040e08 0%,#080f0a 100%)" }}>

      {/* ── HEADER ── */}
      <header className="flex items-center justify-between px-4 py-3 sticky top-0 z-50"
        style={{ background: "rgba(4,14,8,0.95)", borderBottom: "1px solid rgba(245,197,66,0.12)", backdropFilter: "blur(12px)" }}>
        <button onClick={() => setLocation("/")} className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold"
          style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.65)" }}>
          <ArrowLeft size={16} /> Back
        </button>
        <div className="flex items-center gap-2">
          <span className="text-2xl">🚀</span>
          <span className="font-black text-lg" style={{ background: "linear-gradient(90deg,#f5c542,#ffeba1)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Crash
          </span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold"
          style={{ background: "rgba(245,197,66,0.1)", border: "1px solid rgba(245,197,66,0.2)", color: "#f5c542" }}>
          <Wallet size={13} /> {formatCurrency(balance)}
        </div>
      </header>

      <div className="flex-1 flex flex-col max-w-lg mx-auto w-full px-4 pt-4 pb-6 gap-4">

        {/* ── FLIGHT GRAPH ── */}
        <div className="relative rounded-3xl overflow-hidden"
          style={{ background: "#050d07", border: "2px solid rgba(245,197,66,0.18)", minHeight: 260,
            boxShadow: "0 8px 48px rgba(0,0,0,0.7), inset 0 1px 0 rgba(245,197,66,0.08)" }}>

          {/* Stars background */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(30)].map((_, i) => (
              <div key={i} className="absolute rounded-full bg-white"
                style={{ width: i % 4 === 0 ? 2 : 1, height: i % 4 === 0 ? 2 : 1,
                  left: `${(i * 37 + 11) % 95}%`, top: `${(i * 29 + 7) % 88}%`, opacity: 0.2 + (i % 4) * 0.1 }} />
            ))}
          </div>

          {/* Win confetti */}
          {phase === "result" && won && <Confetti />}

          {/* Result overlay */}
          {phase === "result" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-20 gap-3">
              <div className={`text-6xl ${won ? "animate-bounce" : ""}`} style={{ filter: `drop-shadow(0 8px 24px ${won ? "#f5c54288" : "#ef444488"})` }}>
                {won ? "🏆" : "💥"}
              </div>
              <div className="px-8 py-4 rounded-2xl text-center"
                style={{ background: won ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.12)",
                  border: `1.5px solid ${won ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.3)"}`,
                  backdropFilter: "blur(8px)" }}>
                <div className="text-2xl font-black mb-1" style={{ color: won ? "#4ade80" : "#f87171" }}>
                  {won ? `CASHED OUT AT ${selectedOpt?.sub}!` : `CRASHED AT ${resultOpt?.sub}!`}
                </div>
                {won && (
                  <div className="text-lg font-black" style={{ color: "#f5c542" }}>
                    +{formatCurrency(stake * (selectedOpt?.mult ?? 2) - stake)}
                  </div>
                )}
                {!won && (
                  <div className="text-sm font-medium mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>
                    Your cashout at {selectedOpt?.sub} was too high
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Flight SVG */}
          <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full h-full" style={{ minHeight: 210 }} preserveAspectRatio="none">
            {/* Horizontal grid lines */}
            {[25, 50, 75, 100, 125, 150, 175].map(y => (
              <line key={y} x1={ORIGIN_X} y1={y} x2={VW} y2={y}
                stroke="rgba(255,255,255,0.04)" strokeWidth="1" strokeDasharray="4,8" />
            ))}
            {/* Vertical grid lines */}
            {[70, 120, 170, 220, 270].map(x => (
              <line key={x} x1={x} y1="0" x2={x} y2={ORIGIN_Y}
                stroke="rgba(255,255,255,0.04)" strokeWidth="1" strokeDasharray="4,8" />
            ))}
            {/* Axes */}
            <line x1={ORIGIN_X} y1="0" x2={ORIGIN_X} y2={ORIGIN_Y} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
            <line x1={ORIGIN_X} y1={ORIGIN_Y} x2={VW} y2={ORIGIN_Y} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />

            {/* Y-axis labels */}
            <text x="4" y="28" fill="rgba(255,255,255,0.2)" fontSize="7">10×</text>
            <text x="6" y="80" fill="rgba(255,255,255,0.2)" fontSize="7">5×</text>
            <text x="6" y="145" fill="rgba(255,255,255,0.2)" fontSize="7">2×</text>
            <text x="4" y={ORIGIN_Y - 3} fill="rgba(255,255,255,0.2)" fontSize="7">1×</text>

            {/* Flight path trail */}
            {pathPoints.length > 1 && (
              <>
                {/* Glow under curve */}
                <polyline
                  points={[...pathPoints, [currentPt[0], ORIGIN_Y], [ORIGIN_X, ORIGIN_Y]].map(p => p.join(",")).join(" ")}
                  fill={`${pathColor}18`} stroke="none" />
                {/* Main curve */}
                <polyline
                  points={pathPoints.map(p => p.join(",")).join(" ")}
                  fill="none" stroke={pathColor} strokeWidth="2.5"
                  strokeLinecap="round" strokeLinejoin="round"
                  style={{ filter: `drop-shadow(0 0 4px ${pathColor}80)` }} />
              </>
            )}

            {/* Plane */}
            {phase !== "betting" && (
              <PlaneSVG x={currentPt[0]} y={currentPt[1]} angle={planeAngle}
                crashed={crashed} cashedOut={cashedOut} />
            )}

            {/* Starting rocket for idle */}
            {phase === "betting" && (
              <text x={ORIGIN_X - 8} y={ORIGIN_Y + 5} fontSize="22">🚀</text>
            )}
          </svg>

          {/* Multiplier counter overlay */}
          {(phase === "waiting") && (
            <div className="absolute top-3 left-0 right-0 flex justify-center pointer-events-none">
              <div className="px-5 py-2 rounded-2xl text-center"
                style={{ background: "rgba(0,0,0,0.6)", border: `1px solid ${multColor}40`, backdropFilter: "blur(8px)" }}>
                <div className="text-3xl font-black tabular-nums" style={{ color: multColor, textShadow: `0 0 20px ${multColor}60` }}>
                  {displayMult.toFixed(2)}×
                </div>
                <div className="text-[10px] font-bold uppercase tracking-widest mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                  {result ? "Settling..." : "Flying..."}
                </div>
              </div>
            </div>
          )}

          {/* Idle overlay */}
          {phase === "betting" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
              <div className="text-center">
                <div className="text-[11px] font-black uppercase tracking-widest mb-1" style={{ color: "rgba(245,197,66,0.5)" }}>
                  Crash Game
                </div>
                <div className="text-white font-bold text-lg">Bet your cashout · Fly to win</div>
                <div className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Higher multiplier = bigger risk
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── CONTROLS ── */}
        {phase === "result" ? (
          <button onClick={reset} className="w-full py-4 rounded-2xl font-black text-base tracking-wider transition-all hover:scale-105 active:scale-95"
            style={{ background: "linear-gradient(135deg,#d4a017,#f5c542)", color: "#040e08", boxShadow: "0 0 24px rgba(245,197,66,0.4)" }}>
            🚀 Play Again
          </button>
        ) : phase === "waiting" ? (
          <div className="py-4 rounded-2xl text-center text-sm font-bold"
            style={{ background: "rgba(245,197,66,0.06)", border: "1px solid rgba(245,197,66,0.15)", color: "rgba(255,255,255,0.5)" }}>
            ✈️ Auto-Decider running — your ₹{stake.toLocaleString()} bet is live on {selectedOpt?.sub}
          </div>
        ) : (
          <>
            {/* Cashout target */}
            <div>
              <p className="text-xs font-black uppercase tracking-widest mb-3 text-center" style={{ color: "rgba(255,255,255,0.3)" }}>
                Choose Cashout Target
              </p>
              <div className="grid grid-cols-3 gap-3">
                {OPTIONS.map(opt => {
                  const isSelected = selection === opt.key;
                  return (
                    <button key={opt.key} onClick={() => setSelection(opt.key)}
                      className="py-4 rounded-2xl flex flex-col items-center gap-1.5 transition-all duration-200 hover:scale-105 active:scale-95"
                      style={{ background: isSelected ? `${opt.color}20` : "rgba(255,255,255,0.04)",
                        border: `2px solid ${isSelected ? opt.color : "rgba(255,255,255,0.07)"}`,
                        boxShadow: isSelected ? `0 0 24px ${opt.color}55, inset 0 0 12px ${opt.color}15` : "none" }}>
                      <span className="text-3xl">{opt.mult === 2 ? "💚" : opt.mult === 5 ? "🧡" : "🔴"}</span>
                      <span className="text-sm font-black text-white">{opt.label}</span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: `${opt.color}22`, color: opt.color }}>{opt.sub}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Stake */}
            <div>
              <p className="text-xs font-black uppercase tracking-widest mb-2.5 text-center" style={{ color: "rgba(255,255,255,0.3)" }}>Bet Amount</p>
              <div className="flex gap-2 justify-center flex-wrap">
                {CHIP_AMOUNTS.map(amt => {
                  const active = stake === amt;
                  return (
                    <button key={amt} onClick={() => setStake(amt)}
                      className="px-4 py-2 rounded-xl text-sm font-black transition-all hover:scale-105"
                      style={{ background: active ? "linear-gradient(135deg,#d4a017,#f5c542)" : "rgba(255,255,255,0.05)",
                        color: active ? "#040e08" : "rgba(255,255,255,0.55)",
                        border: `1px solid ${active ? "transparent" : "rgba(255,255,255,0.08)"}`,
                        boxShadow: active ? "0 0 12px rgba(245,197,66,0.4)" : "none" }}>
                      ₹{amt >= 1000 ? `${amt / 1000}K` : amt}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Place Bet */}
            {selection ? (
              <button onClick={placeBet} disabled={isPlacing}
                className="w-full py-4 rounded-2xl font-black text-base tracking-wider transition-all hover:scale-105 active:scale-95 disabled:opacity-60"
                style={{ background: "linear-gradient(135deg,#d4a017,#f5c542)", color: "#040e08", boxShadow: "0 0 24px rgba(245,197,66,0.4)" }}>
                {isPlacing ? "Placing Bet..." : `🚀 Place Bet · ${formatCurrency(stake)}`}
              </button>
            ) : (
              <div className="w-full py-4 rounded-2xl text-center font-bold text-sm"
                style={{ background: "rgba(255,255,255,0.03)", border: "2px dashed rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.25)" }}>
                ↑ Pick a cashout target to continue
              </div>
            )}
          </>
        )}

        {/* Payout guide */}
        <div className="rounded-2xl p-4 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.3)" }}>How to Win</div>
          <p className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.4)" }}>The plane flies up. If it passes your cashout point before crashing, you win!</p>
          <div className="flex gap-2 justify-center flex-wrap">
            {OPTIONS.map(opt => (
              <div key={opt.key} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
                style={{ background: `${opt.color}15`, border: `1px solid ${opt.color}30` }}>
                <span className="text-xs font-bold text-white">{opt.label}</span>
                <span className="text-xs font-black" style={{ color: opt.color }}>{opt.sub}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
