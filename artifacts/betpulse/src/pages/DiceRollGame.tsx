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

const STYLES = `
/* Die thrown from upper-left, tumbles down with 3-D feel */
@keyframes diceThrow {
  0%   { transform: perspective(700px) translate(-160px,-200px) rotateX(720deg) rotateY(540deg) rotateZ(360deg) scale(0.3); opacity:0; }
  15%  { opacity:1; }
  55%  { transform: perspective(700px) translate(12px, 14px)  rotateX(-18deg) rotateY(8deg)  rotateZ(-4deg)  scale(1.1); }
  70%  { transform: perspective(700px) translate(-5px,-8px)   rotateX(6deg)  rotateY(-4deg) rotateZ(2deg)   scale(0.97); }
  82%  { transform: perspective(700px) translate(3px, 4px)    rotateX(-3deg) rotateY(2deg)  rotateZ(-1deg)  scale(1.02); }
  91%  { transform: perspective(700px) translate(-1px,-2px)   rotateX(1deg)  rotateY(-1deg) rotateZ(0deg)   scale(0.99); }
  100% { transform: perspective(700px) translate(0,0)         rotateX(0deg)  rotateY(0deg)  rotateZ(0deg)   scale(1);    opacity:1; }
}
/* Second die arrives from upper-right */
@keyframes diceThrow2 {
  0%   { transform: perspective(700px) translate(160px,-200px) rotateX(-540deg) rotateY(-720deg) rotateZ(-270deg) scale(0.3); opacity:0; }
  15%  { opacity:1; }
  55%  { transform: perspective(700px) translate(-12px, 14px)  rotateX(18deg)  rotateY(-8deg)  rotateZ(4deg)  scale(1.1); }
  70%  { transform: perspective(700px) translate(5px, -8px)    rotateX(-6deg)  rotateY(4deg)  rotateZ(-2deg) scale(0.97); }
  82%  { transform: perspective(700px) translate(-3px,4px)     rotateX(3deg)   rotateY(-2deg) rotateZ(1deg)  scale(1.02); }
  91%  { transform: perspective(700px) translate(1px,-2px)     rotateX(-1deg)  rotateY(1deg)  rotateZ(0deg)  scale(0.99); }
  100% { transform: perspective(700px) translate(0,0)          rotateX(0deg)   rotateY(0deg)  rotateZ(0deg)  scale(1);    opacity:1; }
}
@keyframes diceRolling {
  0%  { transform: perspective(700px) rotateX(0deg)   rotateY(0deg)   rotateZ(0deg); }
  25% { transform: perspective(700px) rotateX(-180deg) rotateY(90deg)  rotateZ(60deg); }
  50% { transform: perspective(700px) rotateX(-360deg) rotateY(180deg) rotateZ(180deg); }
  75% { transform: perspective(700px) rotateX(-540deg) rotateY(270deg) rotateZ(240deg); }
  100%{ transform: perspective(700px) rotateX(-720deg) rotateY(360deg) rotateZ(360deg); }
}
@keyframes diceWinPulse {
  0%,100%{ transform: perspective(700px) scale(1);    box-shadow: 0 0 30px rgba(34,197,94,0.7), 0 0 60px rgba(34,197,94,0.3); }
  50%    { transform: perspective(700px) scale(1.08); box-shadow: 0 0 55px rgba(34,197,94,1),   0 0 100px rgba(34,197,94,0.5); }
}
@keyframes shadowAppear {
  0%  { width:20px; opacity:0; }
  100%{ width:90px; opacity:0.5; }
}
@keyframes resultDrop {
  0%  { transform: translateY(-20px) scale(0.85); opacity:0; }
  60% { transform: translateY(5px) scale(1.05); opacity:1; }
  100%{ transform: translateY(0) scale(1); opacity:1; }
}
@keyframes sumPop {
  0%  { transform: scale(0) rotate(-12deg); opacity:0; }
  55% { transform: scale(1.25) rotate(3deg); opacity:1; }
  75% { transform: scale(0.95) rotate(-1deg); opacity:1; }
  100%{ transform: scale(1) rotate(0deg); opacity:1; }
}
@keyframes drPulse { 0%,100%{ opacity:1; } 50%{ opacity:0.55; } }
@keyframes starBurst {
  0%  { transform: translate(-50%,-50%) scale(0); opacity:1; }
  100%{ transform: translate(-50%,-50%) scale(2.5); opacity:0; }
}
`;

const DOT_POS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[27, 27], [73, 73]],
  3: [[27, 27], [50, 50], [73, 73]],
  4: [[27, 27], [73, 27], [27, 73], [73, 73]],
  5: [[27, 27], [73, 27], [50, 50], [27, 73], [73, 73]],
  6: [[27, 25], [73, 25], [27, 50], [73, 50], [27, 75], [73, 75]],
};

function Die({
  value, phase, delay = 0, anim2 = false,
}: {
  value: number; phase: Phase; delay?: number; anim2?: boolean;
}) {
  const rolling  = phase === "rolling";
  const landing  = phase === "landing";
  const settled  = phase === "result";

  const bg = settled
    ? "linear-gradient(145deg, #0d3320 0%, #166534 50%, #14532d 100%)"
    : rolling
    ? "linear-gradient(145deg, #2d1b69 0%, #1a1040 50%, #3b1f8c 100%)"
    : "linear-gradient(145deg, #1a1a2e 0%, #0d0d1a 50%, #1a1a38 100%)";

  const borderColor = settled ? "rgba(74,222,128,.85)" : rolling ? "rgba(192,132,252,.85)" : "rgba(255,255,255,.25)";

  const dotColor = settled ? "#4ade80" : rolling ? "#e9d5ff" : "#ffffff";
  const dotGlow  = settled
    ? "0 0 12px rgba(74,222,128,1), 0 0 24px rgba(34,197,94,.7)"
    : rolling
    ? "0 0 8px rgba(216,180,254,.9), 0 0 18px rgba(192,132,252,.5)"
    : "0 2px 6px rgba(0,0,0,.7), inset 0 1px 0 rgba(255,255,255,.2)";

  const animation =
    rolling  ? `diceRolling .38s linear infinite`
    : landing ? `${anim2 ? "diceThrow2" : "diceThrow"} 1.05s cubic-bezier(.22,1,.36,1) ${delay}s both`
    : settled  ? "diceWinPulse .85s ease-in-out infinite"
    : undefined;

  const boxShadow = settled
    ? "0 0 32px rgba(34,197,94,.7), 0 0 64px rgba(34,197,94,.25), inset 0 0 20px rgba(74,222,128,.1)"
    : rolling
    ? "0 0 32px rgba(168,85,247,.7), 0 0 64px rgba(139,92,246,.2), inset 0 0 18px rgba(192,132,252,.08)"
    : "0 10px 32px rgba(0,0,0,.8), inset 0 1px 0 rgba(255,255,255,.06)";

  const DSIZE = 124;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <div style={{
        width: DSIZE, height: DSIZE,
        borderRadius: 22,
        position: "relative",
        background: bg,
        border: `4px solid ${borderColor}`,
        animation,
        boxShadow,
        transition: "background .35s, border-color .35s",
      }}>
        {(DOT_POS[value] || []).map(([x, y], i) => (
          <div key={i} style={{
            position: "absolute",
            width: 20, height: 20,
            borderRadius: "50%",
            background: dotColor,
            left: `${x}%`, top: `${y}%`,
            transform: "translate(-50%,-50%)",
            boxShadow: dotGlow,
            transition: "background .2s, box-shadow .2s",
          }} />
        ))}
      </div>
      {/* Landing shadow */}
      {landing && (
        <div style={{
          height: 10, borderRadius: "50%",
          background: "rgba(0,0,0,.5)",
          filter: "blur(5px)",
          animation: `shadowAppear 1.05s cubic-bezier(.22,1,.36,1) ${delay}s both`,
          marginTop: -4,
        }} />
      )}
    </div>
  );
}

function WinBurst() {
  return (
    <div style={{ position: "absolute", top: "45%", left: "50%", pointerEvents: "none", zIndex: 10 }}>
      {[0, 0.25, 0.5].map(d => (
        <div key={d} style={{
          position: "absolute",
          width: 200, height: 200,
          borderRadius: "50%",
          border: "2px solid rgba(74,222,128,.6)",
          animation: `starBurst 1s ease-out ${d}s both`,
        }} />
      ))}
    </div>
  );
}

function playDiceSound() {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    for (let i = 0; i < 10; i++) {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.07, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let j = 0; j < data.length; j++) data[j] = (Math.random() * 2 - 1) * (1 - j / data.length);
      const src = ctx.createBufferSource(); const g = ctx.createGain();
      src.buffer = buf; src.connect(g); g.connect(ctx.destination);
      const t = ctx.currentTime + i * 0.12;
      g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
      src.start(t);
    }
    setTimeout(() => ctx.close(), 2500);
  } catch (_) {}
}
function playLandSound() {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    [200, 160, 130].forEach((freq, i) => {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.14, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let j = 0; j < data.length; j++) data[j] = (Math.random() * 2 - 1) * Math.exp(-j / (data.length * 0.25));
      const src = ctx.createBufferSource(); const g = ctx.createGain();
      src.buffer = buf; src.connect(g); g.connect(ctx.destination);
      const t = ctx.currentTime + i * 0.06;
      g.gain.setValueAtTime(0.4, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      src.start(t);
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
      g.gain.setValueAtTime(0.22, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
      o.start(t); o.stop(t + 0.42);
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
      const t = ctx.currentTime + i * 0.21;
      g.gain.setValueAtTime(0.1, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
      o.start(t); o.stop(t + 0.24);
    });
    setTimeout(() => ctx.close(), 2000);
  } catch (_) {}
}

export default function DiceRollGame() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState<Phase>("betting");
  const [selection, setSelection] = useState<DiceSel | null>(null);
  const [stake, setStake] = useState(0);
  const [customStake, setCustomStake] = useState("");
  const [dice1, setDice1] = useState(3);
  const [dice2, setDice2] = useState(4);
  const [showWinBurst, setShowWinBurst] = useState(false);
  const [result, setResult] = useState<{
    dice1: number; dice2: number; sum: number;
    result: DiceSel; won: boolean; winAmount: number; netChange: number; newBalance: number;
  } | null>(null);

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const rollInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout); timersRef.current = [];
    if (rollInterval.current) { clearInterval(rollInterval.current); rollInterval.current = null; }
  };
  const addTimer = (fn: () => void, delay: number) => {
    const t = setTimeout(fn, delay); timersRef.current.push(t); return t;
  };
  useEffect(() => () => clearTimers(), []);

  const handleRoll = async () => {
    if (!selection || stake <= 0) { toast({ title: "Pick a bet and enter a stake", variant: "destructive" }); return; }
    if (!isAuthenticated) { setLocation("/login"); return; }
    clearTimers();
    setResult(null); setShowWinBurst(false); setPhase("rolling");
    rollInterval.current = setInterval(() => {
      setDice1(Math.ceil(Math.random() * 6));
      setDice2(Math.ceil(Math.random() * 6));
    }, 55);
    playDiceSound();

    try {
      const resp = await fetch("/api/games/dice-roll", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ stake, selection }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        if (resp.status === 401) { queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() }); toast({ title: "Session Expired", variant: "destructive" }); }
        else toast({ title: "Bet Failed", description: err.error || "Something went wrong.", variant: "destructive" });
        clearTimers(); setPhase("betting"); return;
      }
      const placed = await resp.json();
      const balanceAfterBet = placed.newBalance as number;
      const roundId = placed.roundId as string;
      const myStake = stake, mySel = selection;
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetBalanceQueryKey() });

      const startedAt = Date.now();
      const pollId: ReturnType<typeof setInterval> = setInterval(async () => {
        if (Date.now() - startedAt > 10 * 60 * 1000) { clearInterval(pollId); if (rollInterval.current) clearInterval(rollInterval.current); return; }
        try {
          const r = await fetch(`/api/games/casino-round/dice-roll/${encodeURIComponent(roundId)}`, { credentials: "include" });
          if (!r.ok) return;
          const d = await r.json();
          if (d.status !== "settled") return;
          clearInterval(pollId);
          const det = d.details as { dice1: number; dice2: number; sum: number };
          const settled = d.result as DiceSel;
          const won = settled === mySel;
          const mult = mySel === "seven" ? 5 : 1.9;
          const winAmount = won ? Math.round(myStake * mult * 100) / 100 : 0;
          addTimer(() => {
            if (rollInterval.current) { clearInterval(rollInterval.current); rollInterval.current = null; }
            setDice1(det.dice1); setDice2(det.dice2);
            setPhase("landing");
            playLandSound();
            addTimer(() => {
              const res = { ...det, result: settled, won, winAmount, netChange: winAmount - myStake, newBalance: balanceAfterBet + winAmount };
              setResult(res);
              setPhase("result");
              queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
              queryClient.invalidateQueries({ queryKey: getGetBalanceQueryKey() });
              if (won) {
                playWin();
                addTimer(() => setShowWinBurst(true), 200);
                addTimer(() => setShowWinBurst(false), 2200);
              } else { playLose(); }
            }, 1100);
          }, 150);
        } catch {}
      }, 500);
    } catch {
      clearTimers();
      toast({ title: "Network Error", variant: "destructive" });
      setPhase("betting");
    }
  };

  const handlePlayAgain = () => {
    clearTimers();
    setPhase("betting"); setSelection(null); setStake(0); setCustomStake("");
    setResult(null); setDice1(3); setDice2(4); setShowWinBurst(false);
  };

  const balance = user?.balance ?? 0;
  const canRoll = selection !== null && stake > 0 && stake <= balance && phase === "betting";

  const BETS = [
    { id: "low"   as DiceSel, label: "LOW",     sub: "Sum 2–6",  payout: "1.9×", color: "#3b82f6", bg: "rgba(59,130,246,.18)",  emoji: "⬇️" },
    { id: "seven" as DiceSel, label: "LUCKY 7", sub: "Exactly 7",payout: "5×",   color: "#eab308", bg: "rgba(234,179,8,.18)",   emoji: "7️⃣" },
    { id: "high"  as DiceSel, label: "HIGH",    sub: "Sum 8–12", payout: "1.9×", color: "#ef4444", bg: "rgba(239,68,68,.18)",   emoji: "⬆️" },
  ];

  if (isLoading) return (
    <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", background: "#07060f" }}>
      <div style={{ width: 48, height: 48, borderRadius: "50%", border: "4px solid #ef4444", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(ellipse at 50% 0%, #12071e 0%, #060610 60%, #12071e 100%)" }}>
      <style>{STYLES}</style>

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 18px",
        background: "rgba(0,0,0,.55)", backdropFilter: "blur(14px)",
        borderBottom: "1px solid rgba(255,255,255,.07)",
      }}>
        <button onClick={() => setLocation("/")} style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,.45)", background: "none", border: "none", cursor: "pointer", fontSize: 13 }}>
          <ArrowLeft size={17} /> Back
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src={diceRollLogo} alt="Dice Roll" style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover" }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: 4, color: "white", fontFamily: "Georgia,serif" }}>DICE ROLL</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,.35)", letterSpacing: 2 }}>HIGH · LOW · LUCKY 7</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          {isAuthenticated
            ? <><div style={{ fontSize: 10, color: "rgba(255,255,255,.35)", letterSpacing: 1 }}>BALANCE</div>
               <div style={{ fontWeight: 900, color: "#4ade80", fontFamily: "monospace", fontSize: 14 }}>{formatCurrency(result?.newBalance ?? balance)}</div></>
            : <button onClick={() => setLocation("/login")} style={{ color: "#60a5fa", fontSize: 13, background: "none", border: "none", cursor: "pointer" }}>Login</button>}
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "16px 12px" }}>

        {/* Dice Stage */}
        <div style={{
          position: "relative",
          background: "radial-gradient(ellipse at 50% 25%, #1a0b30 0%, #080614 100%)",
          border: "2px solid rgba(168,85,247,.22)",
          borderRadius: 28,
          padding: "44px 24px 36px",
          boxShadow: "inset 0 0 90px rgba(139,92,246,.05), 0 8px 50px rgba(0,0,0,.85)",
          overflow: "hidden",
          minHeight: 240,
        }}>
          {/* Ambient glow */}
          <div style={{ position: "absolute", top: 0, left: "30%", width: 180, height: 120, background: "rgba(139,92,246,.08)", filter: "blur(50px)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: 0, right: "30%", width: 180, height: 120, background: "rgba(239,68,68,.05)", filter: "blur(50px)", pointerEvents: "none" }} />

          {showWinBurst && <WinBurst />}

          {/* Dice row */}
          <div style={{
            display: "flex", alignItems: "flex-end", justifyContent: "center",
            gap: 32, marginBottom: 24,
          }}>
            <Die value={dice1} phase={phase} delay={0} anim2={false} />
            <div style={{
              fontSize: 36, fontWeight: 900, color: "#fbbf24",
              fontFamily: "Georgia,serif",
              paddingBottom: 14,
              textShadow: "0 0 20px rgba(251,191,36,.5)",
            }}>+</div>
            <Die value={dice2} phase={phase} delay={0.06} anim2={true} />
          </div>

          {/* Sum display */}
          {phase === "result" && result && (
            <div style={{ textAlign: "center", animation: "sumPop .6s cubic-bezier(.22,1,.36,1) both" }}>
              <div style={{
                fontSize: 52, fontWeight: 900, color: "#fbbf24",
                fontFamily: "Georgia,serif",
                textShadow: "0 0 30px rgba(251,191,36,.7), 0 0 60px rgba(245,158,11,.4)",
                lineHeight: 1,
              }}>= {result.sum}</div>
            </div>
          )}

          {/* Status text */}
          {phase === "betting" && (
            <div style={{ textAlign: "center", color: "rgba(255,255,255,.28)", fontSize: 13, letterSpacing: 2 }}>PICK A BET AND ROLL THE DICE</div>
          )}
          {phase === "rolling" && (
            <div style={{ textAlign: "center", color: "#c084fc", fontSize: 18, fontWeight: 900, letterSpacing: 5, animation: "drPulse .5s ease-in-out infinite" }}>ROLLING...</div>
          )}
          {phase === "landing" && (
            <div style={{ textAlign: "center", color: "#fbbf24", fontSize: 22, fontWeight: 900, letterSpacing: 4 }}>...</div>
          )}
        </div>

        {/* Result panel */}
        {phase === "result" && result && (
          <div style={{
            marginTop: 12,
            borderRadius: 20,
            padding: "16px 20px",
            background: result.won ? "rgba(34,197,94,.1)" : "rgba(239,68,68,.09)",
            border: `1.5px solid ${result.won ? "rgba(34,197,94,.4)" : "rgba(239,68,68,.35)"}`,
            animation: "resultDrop .5s cubic-bezier(.22,1,.36,1) both",
            textAlign: "center",
          }}>
            <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: 3, fontFamily: "Georgia,serif",
              color: result.won ? "#4ade80" : "#f87171",
            }}>
              {result.result === "seven" ? "🎯 LUCKY 7!" : result.result === "high" ? "⬆️ HIGH" : "⬇️ LOW"}
            </div>
            {result.won ? (
              <div style={{ fontSize: 34, fontWeight: 900, color: "#fbbf24", fontFamily: "Georgia,serif",
                textShadow: "0 0 20px rgba(251,191,36,.6)", marginTop: 4,
              }}>+{formatCurrency(result.winAmount)} 🎉</div>
            ) : (
              <div style={{ fontSize: 15, color: "#f87171", marginTop: 6 }}>−{formatCurrency(stake)} · Better luck next time!</div>
            )}
          </div>
        )}

        {/* Controls */}
        <div style={{ marginTop: 12, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 20, padding: 18 }}>
          {phase === "result" ? (
            <button onClick={handlePlayAgain} style={{
              width: "100%", padding: "15px 0", borderRadius: 14,
              background: "linear-gradient(135deg,#7c3aed,#4f46e5)",
              color: "white", fontWeight: 900, fontSize: 16, border: "none", cursor: "pointer", letterSpacing: 3,
              boxShadow: "0 4px 20px rgba(124,58,237,.5)",
            }}>▶ ROLL AGAIN</button>
          ) : (
            <>
              <p style={{ color: "rgba(255,255,255,.4)", fontSize: 10, letterSpacing: 2, marginBottom: 10, textTransform: "uppercase" }}>Pick your bet</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
                {BETS.map(opt => (
                  <button key={opt.id}
                    onClick={() => phase === "betting" && setSelection(opt.id)}
                    disabled={phase !== "betting"}
                    style={{
                      padding: "14px 6px", borderRadius: 13, textAlign: "center",
                      border: `2px solid ${selection === opt.id ? opt.color : "rgba(255,255,255,.09)"}`,
                      background: selection === opt.id ? opt.bg : "rgba(255,255,255,.04)",
                      color: selection === opt.id ? "white" : "rgba(255,255,255,.4)",
                      fontWeight: 900, cursor: phase === "betting" ? "pointer" : "not-allowed",
                      boxShadow: selection === opt.id ? `0 0 22px ${opt.color}55` : "none",
                      transition: "all .2s",
                    }}>
                    <div style={{ fontSize: 22 }}>{opt.emoji}</div>
                    <div style={{ fontSize: 12, marginTop: 4, letterSpacing: 1 }}>{opt.label}</div>
                    <div style={{ fontSize: 10, opacity: .65, marginTop: 1 }}>{opt.sub}</div>
                    <div style={{ fontSize: 12, color: opt.color, fontWeight: 900, marginTop: 3 }}>{opt.payout}</div>
                  </button>
                ))}
              </div>

              <p style={{ color: "rgba(255,255,255,.4)", fontSize: 10, letterSpacing: 2, marginBottom: 9, textTransform: "uppercase" }}>Stake (PKR)</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 7, marginBottom: 10 }}>
                {CHIP_AMOUNTS.map(amt => (
                  <button key={amt}
                    onClick={() => phase === "betting" && setStake(amt)}
                    disabled={phase !== "betting"}
                    style={{
                      padding: "10px 0", borderRadius: 10, fontSize: 14, fontWeight: 900,
                      border: `2px solid ${stake === amt ? "#a855f7" : "rgba(255,255,255,.1)"}`,
                      background: stake === amt ? "rgba(168,85,247,.25)" : "rgba(255,255,255,.05)",
                      color: stake === amt ? "#c084fc" : "rgba(255,255,255,.45)",
                      cursor: phase === "betting" ? "pointer" : "not-allowed", transition: "all .2s",
                    }}>
                    {amt >= 1000 ? `${amt / 1000}K` : amt}
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <input type="number" min="0" placeholder="Custom amount..." value={customStake} disabled={phase !== "betting"}
                  onChange={e => { setCustomStake(e.target.value); const p = parseFloat(e.target.value); setStake(isNaN(p) ? 0 : p); }}
                  style={{ flex: 1, padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", color: "white", fontSize: 14, outline: "none" }} />
                {stake > 0 && selection && (
                  <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(34,197,94,.1)", border: "1px solid rgba(34,197,94,.28)", color: "#4ade80", fontSize: 13, fontWeight: 900, display: "flex", alignItems: "center", whiteSpace: "nowrap" }}>
                    Win: {formatCurrency(Math.round(stake * (selection === "seven" ? 5 : 1.9)))}
                  </div>
                )}
              </div>

              {!isAuthenticated ? (
                <button onClick={() => setLocation("/login")} style={{ width: "100%", padding: 14, borderRadius: 12, background: "linear-gradient(135deg,#7c3aed,#4f46e5)", color: "white", fontWeight: 900, fontSize: 16, border: "none", cursor: "pointer" }}>
                  LOG IN TO PLAY
                </button>
              ) : (
                <>
                  <button onClick={handleRoll} disabled={!canRoll} style={{
                    width: "100%", padding: 15, borderRadius: 13, fontWeight: 900, fontSize: 17, letterSpacing: 3,
                    background: canRoll ? "linear-gradient(135deg,#ef4444,#b91c1c)" : "rgba(255,255,255,.06)",
                    color: canRoll ? "white" : "rgba(255,255,255,.22)",
                    border: `2px solid ${canRoll ? "rgba(239,68,68,.6)" : "rgba(255,255,255,.06)"}`,
                    cursor: canRoll ? "pointer" : "not-allowed",
                    boxShadow: canRoll ? "0 4px 28px rgba(239,68,68,.5)" : "none",
                    transition: "all .2s",
                  }}>
                    {phase === "rolling" ? "🎲 ROLLING..." : phase === "landing" ? "🎲 LANDING..." : !selection ? "PICK A BET FIRST" : stake <= 0 ? "ENTER STAKE" : "🎲 ROLL DICE"}
                  </button>
                  {isAuthenticated && stake > balance && (
                    <p style={{ color: "#f87171", fontSize: 12, textAlign: "center", marginTop: 8 }}>Insufficient balance — max: {formatCurrency(balance)}</p>
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
