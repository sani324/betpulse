import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey, getGetBalanceQueryKey } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";
import diceRollLogo from "@assets/WhatsApp_Image_2026-04-24_at_5.15.42_PM_1777034496585.jpeg";

type DiceSel = "low" | "seven" | "high";
type Phase = "betting" | "rolling" | "landing" | "result";
const CHIP_AMOUNTS = [100, 500, 1000, 5000];

/* ─── dot positions for each face (% x, % y) ────────────────────────────── */
const DOTS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 22], [72, 22], [28, 50], [72, 50], [28, 78], [72, 78]],
};

/*
  Final rotations so each face comes to front.
  My cube layout:
    face 1 → Front  (rotateX 0  rotateY 0  )
    face 6 → Back   (rotateX 0  rotateY 180)
    face 2 → Right  (rotateX 0  rotateY -90)
    face 5 → Left   (rotateX 0  rotateY 90 )
    face 3 → Top    (rotateX 90 rotateY 0  )
    face 4 → Bottom (rotateX-90 rotateY 0  )
*/
const FACE_ROT: Record<number, { x: number; y: number }> = {
  1: { x: 0,    y: 0   },
  2: { x: 0,    y: -90 },
  3: { x: 90,   y: 0   },
  4: { x: -90,  y: 0   },
  5: { x: 0,    y: 90  },
  6: { x: 0,    y: 180 },
};

const SIDE = 100; // cube side length in px
const HALF = SIDE / 2;

const STYLES = `
@keyframes diceResultDrop {
  0%  { transform: translateY(-18px) scale(0.82); opacity: 0; }
  60% { transform: translateY(4px)   scale(1.06); opacity: 1; }
  100%{ transform: translateY(0)     scale(1);    opacity: 1; }
}
@keyframes sumPop {
  0%  { transform: scale(0) rotate(-14deg); opacity: 0; }
  55% { transform: scale(1.3) rotate(3deg); opacity: 1; }
  80% { transform: scale(0.94) rotate(-1deg); }
  100%{ transform: scale(1) rotate(0deg); opacity: 1; }
}
@keyframes drPulse { 0%,100%{ opacity:1; } 50%{ opacity:0.45; } }
@keyframes winRing {
  0%  { transform: translate(-50%,-50%) scale(0); opacity: 1; }
  100%{ transform: translate(-50%,-50%) scale(3); opacity: 0; }
}
@keyframes diceFaceGlow {
  0%,100%{ box-shadow: inset 0 0 14px rgba(74,222,128,.4), 0 0 24px rgba(34,197,94,.8); }
  50%    { box-shadow: inset 0 0 28px rgba(74,222,128,.8), 0 0 50px rgba(34,197,94,1); }
}
`;

/* ─── a single 3-D dice cube ─────────────────────────────────────────────── */
interface DiceProps {
  faceValue: number;
  phase: Phase;
  rollSpeedX: number;
  rollSpeedY: number;
  rollSpeedZ: number;
  onSettled?: () => void;
}

function Dice3D({ faceValue, phase, rollSpeedX, rollSpeedY, rollSpeedZ }: DiceProps) {
  const cubeRef = useRef<HTMLDivElement>(null);
  const rotRef  = useRef({ x: 20, y: -30, z: 0 });
  const rafRef  = useRef(0);
  const settledRef = useRef(false);

  /* start rolling */
  useEffect(() => {
    if (phase !== "rolling") return;
    settledRef.current = false;
    const el = cubeRef.current;
    if (!el) return;
    el.style.transition = "none";

    const tick = () => {
      rotRef.current.x += rollSpeedX;
      rotRef.current.y += rollSpeedY;
      rotRef.current.z += rollSpeedZ;
      el.style.transform =
        `rotateX(${rotRef.current.x}deg) rotateY(${rotRef.current.y}deg) rotateZ(${rotRef.current.z}deg)`;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase]);

  /* settle on landing */
  useEffect(() => {
    if (phase !== "landing") return;
    cancelAnimationFrame(rafRef.current);
    const el = cubeRef.current;
    if (!el) return;

    const target = FACE_ROT[faceValue] || { x: 0, y: 0 };

    /* snap current accumulated rotation to nearest multiple of 360 + target */
    const snapX = Math.round(rotRef.current.x / 360) * 360 + target.x;
    const snapY = Math.round(rotRef.current.y / 360) * 360 + target.y;

    el.style.transition = "transform 1.15s cubic-bezier(0.22,1,0.36,1)";
    el.style.transform  = `rotateX(${snapX}deg) rotateY(${snapY}deg) rotateZ(0deg)`;
    rotRef.current = { x: snapX, y: snapY, z: 0 };
  }, [phase, faceValue]);

  /* reset for next round */
  useEffect(() => {
    if (phase !== "betting") return;
    const el = cubeRef.current;
    if (!el) return;
    el.style.transition = "none";
    el.style.transform  = `rotateX(20deg) rotateY(-30deg) rotateZ(0deg)`;
    rotRef.current = { x: 20, y: -30, z: 0 };
  }, [phase]);

  const isResult = phase === "result";

  const faceStyle = (face: number, transform: string): React.CSSProperties => {
    const isTop = isResult && face === faceValue;
    return {
      position: "absolute",
      width: SIDE, height: SIDE,
      transform,
      backfaceVisibility: "hidden",
      WebkitBackfaceVisibility: "hidden",
      background: isTop
        ? "linear-gradient(135deg,#0d3320,#166534)"
        : "linear-gradient(135deg,#1e1e3a,#0d0d22)",
      border: `2.5px solid ${isTop ? "rgba(74,222,128,.9)" : "rgba(255,255,255,.18)"}`,
      borderRadius: 14,
      boxSizing: "border-box",
      animation: isTop ? "diceFaceGlow .85s ease-in-out infinite" : undefined,
    };
  };

  const dot = (color: string, glow: string) =>
    (x: number, y: number, i: number) => (
      <div key={i} style={{
        position: "absolute",
        width: 16, height: 16, borderRadius: "50%",
        background: color,
        boxShadow: glow,
        left: `${x}%`, top: `${y}%`,
        transform: "translate(-50%,-50%)",
      }} />
    );

  const topDot  = dot("#4ade80", "0 0 10px rgba(74,222,128,1), 0 0 22px rgba(34,197,94,.7)");
  const normDot = dot("#ffffff", "0 2px 6px rgba(0,0,0,.7)");

  const renderFace = (num: number) => {
    const positions = DOTS[num] || [];
    const isTop = isResult && num === faceValue;
    return positions.map(([x, y], i) => (isTop ? topDot : normDot)(x, y, i));
  };

  return (
    /* perspective wrapper */
    <div style={{ perspective: 500, width: SIDE, height: SIDE }}>
      {/* scene — cube rotates here */}
      <div ref={cubeRef} style={{
        width: SIDE, height: SIDE,
        position: "relative",
        transformStyle: "preserve-3d",
        transform: "rotateX(20deg) rotateY(-30deg)",
      }}>
        {/* Front  — face 1 */}
        <div style={faceStyle(1, `translateZ(${HALF}px)`)}>
          {renderFace(1)}
        </div>
        {/* Back   — face 6 */}
        <div style={faceStyle(6, `rotateY(180deg) translateZ(${HALF}px)`)}>
          {renderFace(6)}
        </div>
        {/* Right  — face 2 */}
        <div style={faceStyle(2, `rotateY(90deg) translateZ(${HALF}px)`)}>
          {renderFace(2)}
        </div>
        {/* Left   — face 5 */}
        <div style={faceStyle(5, `rotateY(-90deg) translateZ(${HALF}px)`)}>
          {renderFace(5)}
        </div>
        {/* Top    — face 3 */}
        <div style={faceStyle(3, `rotateX(90deg) translateZ(${HALF}px)`)}>
          {renderFace(3)}
        </div>
        {/* Bottom — face 4 */}
        <div style={faceStyle(4, `rotateX(-90deg) translateZ(${HALF}px)`)}>
          {renderFace(4)}
        </div>
      </div>
    </div>
  );
}

/* ─── audio ─────────────────────────────────────────────────────────────── */
function playDiceSound() {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    for (let i = 0; i < 12; i++) {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.07, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let j = 0; j < d.length; j++) d[j] = (Math.random() * 2 - 1) * (1 - j / d.length);
      const s = ctx.createBufferSource(); const g = ctx.createGain();
      s.buffer = buf; s.connect(g); g.connect(ctx.destination);
      const t = ctx.currentTime + i * 0.1;
      g.gain.setValueAtTime(0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
      s.start(t);
    }
    setTimeout(() => ctx.close(), 3000);
  } catch (_) {}
}
function playLandSound() {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    [220, 180, 140].forEach((f, i) => {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let j = 0; j < d.length; j++) d[j] = (Math.random() * 2 - 1) * Math.exp(-j / (d.length * 0.25));
      const s = ctx.createBufferSource(); const g = ctx.createGain();
      s.buffer = buf; s.connect(g); g.connect(ctx.destination);
      const t = ctx.currentTime + i * 0.07;
      g.gain.setValueAtTime(0.45, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      s.start(t);
    });
    setTimeout(() => ctx.close(), 1000);
  } catch (_) {}
}
function playWin() {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    [523, 659, 784, 1047, 1319].forEach((f, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination); o.type = "triangle"; o.frequency.value = f;
      const t = ctx.currentTime + i * 0.13;
      g.gain.setValueAtTime(0.22, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.44);
      o.start(t); o.stop(t + 0.44);
    });
    setTimeout(() => ctx.close(), 2000);
  } catch (_) {}
}
function playLose() {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    [350, 300, 250].forEach((f, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination); o.type = "sawtooth"; o.frequency.value = f;
      const t = ctx.currentTime + i * 0.22;
      g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      o.start(t); o.stop(t + 0.25);
    });
    setTimeout(() => ctx.close(), 2000);
  } catch (_) {}
}

/* ─── main game component ────────────────────────────────────────────────── */
export default function DiceRollGame() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [phase, setPhase]       = useState<Phase>("betting");
  const [selection, setSelection] = useState<DiceSel | null>(null);
  const [stake, setStake]       = useState(0);
  const [customStake, setCustomStake] = useState("");
  const [dice1, setDice1]       = useState(1);
  const [dice2, setDice2]       = useState(6);
  const [showWinRing, setShowWinRing] = useState(false);
  const [result, setResult]     = useState<{
    dice1: number; dice2: number; sum: number;
    result: DiceSel; won: boolean; winAmount: number; netChange: number; newBalance: number;
  } | null>(null);

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout); timersRef.current = [];
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };
  const addTimer = (fn: () => void, delay: number) => {
    const t = setTimeout(fn, delay); timersRef.current.push(t); return t;
  };
  useEffect(() => () => clearTimers(), []);

  const handleRoll = async () => {
    if (!selection || stake <= 0) { toast({ title: "Pick a bet and enter a stake", variant: "destructive" }); return; }
    if (!isAuthenticated) { setLocation("/login"); return; }
    clearTimers();
    setResult(null); setShowWinRing(false);
    setPhase("rolling");
    playDiceSound();

    try {
      const resp = await fetch("/api/games/dice-roll", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ stake, selection }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        if (resp.status === 401) queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        toast({ title: resp.status === 401 ? "Session Expired" : "Bet Failed", description: err.error || "Something went wrong.", variant: "destructive" });
        clearTimers(); setPhase("betting"); return;
      }
      const placed = await resp.json();
      const balanceAfterBet = placed.newBalance as number;
      const roundId = placed.roundId as string;
      const myStake = stake, mySel = selection;
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetBalanceQueryKey() });

      const startedAt = Date.now();
      pollRef.current = setInterval(async () => {
        if (Date.now() - startedAt > 10 * 60 * 1000) { clearInterval(pollRef.current!); return; }
        try {
          const r = await fetch(`/api/games/casino-round/dice-roll/${encodeURIComponent(roundId)}`, { credentials: "include" });
          if (!r.ok) return;
          const d = await r.json();
          if (d.status !== "settled") return;
          clearInterval(pollRef.current!);
          const det = d.details as { dice1: number; dice2: number; sum: number };
          const settled = d.result as DiceSel;
          const won = settled === mySel;
          const mult = mySel === "seven" ? 5 : 1.9;
          const winAmount = won ? Math.round(myStake * mult * 100) / 100 : 0;
          addTimer(() => {
            setDice1(det.dice1); setDice2(det.dice2);
            setPhase("landing");
            playLandSound();
            addTimer(() => {
              const res = { ...det, result: settled, won, winAmount, netChange: winAmount - myStake, newBalance: balanceAfterBet + winAmount };
              setResult(res); setPhase("result");
              queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
              queryClient.invalidateQueries({ queryKey: getGetBalanceQueryKey() });
              if (won) {
                playWin();
                addTimer(() => setShowWinRing(true), 200);
                addTimer(() => setShowWinRing(false), 2400);
              } else { playLose(); }
            }, 1200);
          }, 120);
        } catch {}
      }, 500);
    } catch {
      clearTimers(); toast({ title: "Network Error", variant: "destructive" }); setPhase("betting");
    }
  };

  const handlePlayAgain = () => {
    clearTimers();
    setPhase("betting"); setSelection(null); setStake(0); setCustomStake("");
    setResult(null); setDice1(1); setDice2(6); setShowWinRing(false);
  };

  const balance = user?.balance ?? 0;
  const canRoll = selection !== null && stake > 0 && stake <= balance && phase === "betting";

  const BETS = [
    { id: "low"   as DiceSel, label: "LOW",     sub: "Sum 2–6",  payout: "1.9×", color: "#3b82f6", bg: "rgba(59,130,246,.18)",  emoji: "⬇️" },
    { id: "seven" as DiceSel, label: "LUCKY 7", sub: "Exactly 7",payout: "5×",   color: "#eab308", bg: "rgba(234,179,8,.18)",   emoji: "7️⃣" },
    { id: "high"  as DiceSel, label: "HIGH",    sub: "Sum 8–12", payout: "1.9×", color: "#ef4444", bg: "rgba(239,68,68,.18)",   emoji: "⬆️" },
  ];

  if (isLoading) return (
    <div style={{ display:"flex", height:"100vh", alignItems:"center", justifyContent:"center", background:"#07060f" }}>
      <div style={{ width:48, height:48, borderRadius:"50%", border:"4px solid #ef4444", borderTopColor:"transparent", animation:"spin .8s linear infinite" }} />
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"radial-gradient(ellipse at 50% 0%,#12071e 0%,#060610 60%,#12071e 100%)" }}>
      <style>{STYLES}</style>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 18px", background:"rgba(0,0,0,.55)", backdropFilter:"blur(14px)", borderBottom:"1px solid rgba(255,255,255,.07)" }}>
        <button onClick={() => setLocation("/")} style={{ display:"flex", alignItems:"center", gap:6, color:"rgba(255,255,255,.45)", background:"none", border:"none", cursor:"pointer", fontSize:13 }}>
          <ArrowLeft size={17} /> Back
        </button>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <img src={diceRollLogo} alt="Dice Roll" style={{ width:36, height:36, borderRadius:8, objectFit:"cover" }} />
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:16, fontWeight:900, letterSpacing:4, color:"white", fontFamily:"Georgia,serif" }}>DICE ROLL</div>
            <div style={{ fontSize:10, color:"rgba(255,255,255,.35)", letterSpacing:2 }}>HIGH · LOW · LUCKY 7</div>
          </div>
        </div>
        <div style={{ textAlign:"right" }}>
          {isAuthenticated
            ? <><div style={{ fontSize:10, color:"rgba(255,255,255,.35)", letterSpacing:1 }}>BALANCE</div>
               <div style={{ fontWeight:900, color:"#4ade80", fontFamily:"monospace", fontSize:14 }}>{formatCurrency(result?.newBalance ?? balance)}</div></>
            : <button onClick={() => setLocation("/login")} style={{ color:"#60a5fa", fontSize:13, background:"none", border:"none", cursor:"pointer" }}>Login</button>}
        </div>
      </div>

      <div style={{ maxWidth:480, margin:"0 auto", padding:"16px 12px" }}>

        {/* ── Dice Stage ── */}
        <div style={{
          position:"relative",
          background:"radial-gradient(ellipse at 50% 30%,#1a0b30 0%,#080614 100%)",
          border:"2px solid rgba(168,85,247,.22)",
          borderRadius:28,
          padding:"50px 24px 40px",
          boxShadow:"inset 0 0 90px rgba(139,92,246,.06), 0 8px 50px rgba(0,0,0,.85)",
          overflow:"hidden",
          minHeight:250,
        }}>
          {/* ambient glow */}
          <div style={{ position:"absolute", top:0, left:"25%", width:200, height:130, background:"rgba(139,92,246,.09)", filter:"blur(55px)", pointerEvents:"none" }} />
          <div style={{ position:"absolute", bottom:0, right:"25%", width:200, height:130, background:"rgba(239,68,68,.05)", filter:"blur(55px)", pointerEvents:"none" }} />

          {/* win rings */}
          {showWinRing && (
            <div style={{ position:"absolute", top:"40%", left:"50%", pointerEvents:"none", zIndex:20 }}>
              {[0, 0.3, 0.6].map(d => (
                <div key={d} style={{ position:"absolute", width:240, height:240, borderRadius:"50%", border:"2px solid rgba(74,222,128,.65)", animation:`winRing 1s ease-out ${d}s both` }} />
              ))}
            </div>
          )}

          {/* ── 3-D Dice Row ── */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:40, marginBottom:28 }}>

            {/* Dice 1 */}
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:10 }}>
              <Dice3D
                faceValue={dice1} phase={phase}
                rollSpeedX={4.2} rollSpeedY={5.7} rollSpeedZ={1.8}
              />
              {(phase === "result" || phase === "landing") && (
                <div style={{
                  width:36, height:10, borderRadius:"50%",
                  background:"rgba(0,0,0,.5)", filter:"blur(4px)",
                  marginTop:-4,
                }} />
              )}
            </div>

            {/* Plus */}
            <div style={{ fontSize:32, fontWeight:900, color:"#fbbf24", fontFamily:"Georgia,serif", textShadow:"0 0 18px rgba(251,191,36,.5)" }}>+</div>

            {/* Dice 2 */}
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:10 }}>
              <Dice3D
                faceValue={dice2} phase={phase}
                rollSpeedX={-3.9} rollSpeedY={6.3} rollSpeedZ={-2.1}
              />
              {(phase === "result" || phase === "landing") && (
                <div style={{
                  width:36, height:10, borderRadius:"50%",
                  background:"rgba(0,0,0,.5)", filter:"blur(4px)",
                  marginTop:-4,
                }} />
              )}
            </div>
          </div>

          {/* Sum */}
          {phase === "result" && result && (
            <div style={{ textAlign:"center", animation:"sumPop .6s cubic-bezier(.22,1,.36,1) both" }}>
              <div style={{ fontSize:52, fontWeight:900, color:"#fbbf24", fontFamily:"Georgia,serif", textShadow:"0 0 30px rgba(251,191,36,.7), 0 0 60px rgba(245,158,11,.4)", lineHeight:1 }}>
                = {result.sum}
              </div>
            </div>
          )}

          {/* Status */}
          {phase === "betting" && (
            <div style={{ textAlign:"center", color:"rgba(255,255,255,.28)", fontSize:13, letterSpacing:2 }}>PICK A BET AND ROLL THE DICE</div>
          )}
          {phase === "rolling" && (
            <div style={{ textAlign:"center", color:"#c084fc", fontSize:18, fontWeight:900, letterSpacing:5, animation:"drPulse .5s ease-in-out infinite" }}>ROLLING...</div>
          )}
          {phase === "landing" && (
            <div style={{ textAlign:"center", color:"#fbbf24", fontSize:20, fontWeight:900, letterSpacing:4 }}>...</div>
          )}
        </div>

        {/* Result card */}
        {phase === "result" && result && (
          <div style={{
            marginTop:12, borderRadius:20, padding:"16px 20px", textAlign:"center",
            background: result.won ? "rgba(34,197,94,.1)" : "rgba(239,68,68,.09)",
            border:`1.5px solid ${result.won ? "rgba(34,197,94,.4)" : "rgba(239,68,68,.35)"}`,
            animation:"diceResultDrop .5s cubic-bezier(.22,1,.36,1) both",
          }}>
            <div style={{ fontSize:24, fontWeight:900, letterSpacing:3, fontFamily:"Georgia,serif", color: result.won ? "#4ade80" : "#f87171" }}>
              {result.result === "seven" ? "🎯 LUCKY 7!" : result.result === "high" ? "⬆️ HIGH" : "⬇️ LOW"}
            </div>
            {result.won
              ? <div style={{ fontSize:34, fontWeight:900, color:"#fbbf24", fontFamily:"Georgia,serif", textShadow:"0 0 20px rgba(251,191,36,.6)", marginTop:4 }}>+{formatCurrency(result.winAmount)} 🎉</div>
              : <div style={{ fontSize:15, color:"#f87171", marginTop:6 }}>−{formatCurrency(stake)} · Better luck next time!</div>}
          </div>
        )}

        {/* Controls */}
        <div style={{ marginTop:12, background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.08)", borderRadius:20, padding:18 }}>
          {phase === "result" ? (
            <button onClick={handlePlayAgain} style={{ width:"100%", padding:"15px 0", borderRadius:14, background:"linear-gradient(135deg,#7c3aed,#4f46e5)", color:"white", fontWeight:900, fontSize:16, border:"none", cursor:"pointer", letterSpacing:3, boxShadow:"0 4px 20px rgba(124,58,237,.5)" }}>
              ▶ ROLL AGAIN
            </button>
          ) : (
            <>
              <p style={{ color:"rgba(255,255,255,.4)", fontSize:10, letterSpacing:2, marginBottom:10, textTransform:"uppercase" }}>Pick your bet</p>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:14 }}>
                {BETS.map(opt => (
                  <button key={opt.id}
                    onClick={() => phase === "betting" && setSelection(opt.id)}
                    disabled={phase !== "betting"}
                    style={{
                      padding:"14px 6px", borderRadius:13, textAlign:"center",
                      border:`2px solid ${selection === opt.id ? opt.color : "rgba(255,255,255,.09)"}`,
                      background: selection === opt.id ? opt.bg : "rgba(255,255,255,.04)",
                      color: selection === opt.id ? "white" : "rgba(255,255,255,.4)",
                      fontWeight:900, cursor: phase === "betting" ? "pointer" : "not-allowed",
                      boxShadow: selection === opt.id ? `0 0 22px ${opt.color}55` : "none",
                      transition:"all .2s",
                    }}>
                    <div style={{ fontSize:22 }}>{opt.emoji}</div>
                    <div style={{ fontSize:12, marginTop:4, letterSpacing:1 }}>{opt.label}</div>
                    <div style={{ fontSize:10, opacity:.65, marginTop:1 }}>{opt.sub}</div>
                    <div style={{ fontSize:12, color:opt.color, fontWeight:900, marginTop:3 }}>{opt.payout}</div>
                  </button>
                ))}
              </div>

              <p style={{ color:"rgba(255,255,255,.4)", fontSize:10, letterSpacing:2, marginBottom:9, textTransform:"uppercase" }}>Stake (PKR)</p>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:7, marginBottom:10 }}>
                {CHIP_AMOUNTS.map(amt => (
                  <button key={amt}
                    onClick={() => phase === "betting" && setStake(amt)}
                    disabled={phase !== "betting"}
                    style={{
                      padding:"10px 0", borderRadius:10, fontSize:14, fontWeight:900,
                      border:`2px solid ${stake === amt ? "#a855f7" : "rgba(255,255,255,.1)"}`,
                      background: stake === amt ? "rgba(168,85,247,.25)" : "rgba(255,255,255,.05)",
                      color: stake === amt ? "#c084fc" : "rgba(255,255,255,.45)",
                      cursor: phase === "betting" ? "pointer" : "not-allowed", transition:"all .2s",
                    }}>
                    {amt >= 1000 ? `${amt / 1000}K` : amt}
                  </button>
                ))}
              </div>

              <div style={{ display:"flex", gap:8, marginBottom:14 }}>
                <input type="number" min="0" placeholder="Custom amount..." value={customStake} disabled={phase !== "betting"}
                  onChange={e => { setCustomStake(e.target.value); const p = parseFloat(e.target.value); setStake(isNaN(p) ? 0 : p); }}
                  style={{ flex:1, padding:"10px 14px", borderRadius:10, background:"rgba(255,255,255,.07)", border:"1px solid rgba(255,255,255,.12)", color:"white", fontSize:14, outline:"none" }} />
                {stake > 0 && selection && (
                  <div style={{ padding:"10px 14px", borderRadius:10, background:"rgba(34,197,94,.1)", border:"1px solid rgba(34,197,94,.28)", color:"#4ade80", fontSize:13, fontWeight:900, display:"flex", alignItems:"center", whiteSpace:"nowrap" }}>
                    Win: {formatCurrency(Math.round(stake * (selection === "seven" ? 5 : 1.9)))}
                  </div>
                )}
              </div>

              {!isAuthenticated ? (
                <button onClick={() => setLocation("/login")} style={{ width:"100%", padding:14, borderRadius:12, background:"linear-gradient(135deg,#7c3aed,#4f46e5)", color:"white", fontWeight:900, fontSize:16, border:"none", cursor:"pointer" }}>
                  LOG IN TO PLAY
                </button>
              ) : (
                <>
                  <button onClick={handleRoll} disabled={!canRoll} style={{
                    width:"100%", padding:15, borderRadius:13, fontWeight:900, fontSize:17, letterSpacing:3,
                    background: canRoll ? "linear-gradient(135deg,#ef4444,#b91c1c)" : "rgba(255,255,255,.06)",
                    color: canRoll ? "white" : "rgba(255,255,255,.22)",
                    border:`2px solid ${canRoll ? "rgba(239,68,68,.6)" : "rgba(255,255,255,.06)"}`,
                    cursor: canRoll ? "pointer" : "not-allowed",
                    boxShadow: canRoll ? "0 4px 28px rgba(239,68,68,.5)" : "none",
                    transition:"all .2s",
                  }}>
                    {phase === "rolling" ? "🎲 ROLLING..." : phase === "landing" ? "🎲 LANDING..." : !selection ? "PICK A BET FIRST" : stake <= 0 ? "ENTER STAKE" : "🎲 ROLL DICE"}
                  </button>
                  {stake > balance && (
                    <p style={{ color:"#f87171", fontSize:12, textAlign:"center", marginTop:8 }}>Insufficient balance — max: {formatCurrency(balance)}</p>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
