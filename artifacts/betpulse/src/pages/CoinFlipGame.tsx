import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey, getGetBalanceQueryKey } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";
import coinFlipLogo from "@assets/WhatsApp_Image_2026-04-24_at_5.14.29_PM_1777034496584.jpeg";

type Side = "heads" | "tails";
type Phase = "betting" | "flipping" | "result";
const CHIP_AMOUNTS = [100, 500, 1000, 5000, 10000];

const STYLES = `
@keyframes cfSpin3D {
  0%   { transform: perspective(900px) rotateY(0deg) scaleX(1); }
  10%  { transform: perspective(900px) rotateY(90deg) scaleX(0.05); }
  20%  { transform: perspective(900px) rotateY(180deg) scaleX(1); }
  30%  { transform: perspective(900px) rotateY(270deg) scaleX(0.05); }
  40%  { transform: perspective(900px) rotateY(360deg) scaleX(1); }
  50%  { transform: perspective(900px) rotateY(450deg) scaleX(0.05); }
  60%  { transform: perspective(900px) rotateY(540deg) scaleX(1); }
  70%  { transform: perspective(900px) rotateY(630deg) scaleX(0.05); }
  80%  { transform: perspective(900px) rotateY(720deg) scaleX(1); }
  90%  { transform: perspective(900px) rotateY(810deg) scaleX(0.05); }
  100% { transform: perspective(900px) rotateY(900deg) scaleX(1); }
}
@keyframes cfLand {
  0%   { transform: translateY(-280px) scale(0.5) rotateY(1800deg); opacity:0; }
  40%  { opacity: 1; }
  70%  { transform: translateY(16px) scale(1.06) rotateY(15deg); }
  82%  { transform: translateY(-8px) scale(0.97) rotateY(-6deg); }
  91%  { transform: translateY(4px) scale(1.01) rotateY(2deg); }
  100% { transform: translateY(0) scale(1) rotateY(0deg); opacity:1; }
}
@keyframes cfWinGlow {
  0%,100%{ filter: drop-shadow(0 0 18px #fbbf24) drop-shadow(0 0 40px #f59e0b80); }
  50%    { filter: drop-shadow(0 0 50px #fbbf24) drop-shadow(0 0 90px #f59e0b); }
}
@keyframes cfBob {
  0%,100%{ transform: translateY(0) scale(1) rotate(-1deg); }
  50%    { transform: translateY(-16px) scale(1.05) rotate(1deg); }
}
@keyframes cfResultIn {
  0%  { transform: translateY(20px) scale(0.8); opacity:0; }
  60% { transform: translateY(-5px) scale(1.05); opacity:1; }
  100%{ transform: translateY(0) scale(1); opacity:1; }
}
@keyframes cfPulse { 0%,100%{ transform:scale(1); } 50%{ transform:scale(1.1); } }
@keyframes cfRoadIn { 0%{ transform:scale(0); opacity:0; } 100%{ transform:scale(1); opacity:1; } }
@keyframes cfStarRing {
  0%  { transform:translate(-50%,-50%) scale(0); opacity:1; }
  100%{ transform:translate(-50%,-50%) scale(3); opacity:0; }
}
@keyframes cfEdgeSpin {
  0%   { transform: rotateY(0deg) scaleX(0.08); }
  100% { transform: rotateY(360deg) scaleX(0.08); }
}
@keyframes cfShimmer {
  0%  { background-position: -200% center; }
  100%{ background-position: 200% center; }
}
@keyframes float1 {
  0%,100%{transform:translateY(0) rotate(0deg);} 50%{transform:translateY(-8px) rotate(5deg);}
}
`;

function mkCtx() { return new ((window as any).AudioContext || (window as any).webkitAudioContext)(); }
function playFlip() {
  try {
    const c = mkCtx();
    for (let i = 0; i < 14; i++) {
      const o = c.createOscillator(); const g = c.createGain();
      o.connect(g); g.connect(c.destination); o.type = "triangle";
      o.frequency.value = 500 + i * 100;
      const t = c.currentTime + i * 0.08;
      g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
      o.start(t); o.stop(t + 0.07);
    }
    setTimeout(() => c.close(), 2000);
  } catch (_) {}
}
function playWin() {
  try {
    const c = mkCtx();
    [523, 659, 784, 1047, 1319].forEach((f, i) => {
      const o = c.createOscillator(); const g = c.createGain();
      o.connect(g); g.connect(c.destination); o.type = "triangle"; o.frequency.value = f;
      const t = c.currentTime + i * 0.13;
      g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      o.start(t); o.stop(t + 0.45);
    });
    setTimeout(() => c.close(), 2500);
  } catch (_) {}
}
function playLose() {
  try {
    const c = mkCtx();
    [350, 295, 240].forEach((f, i) => {
      const o = c.createOscillator(); const g = c.createGain();
      o.connect(g); g.connect(c.destination); o.type = "sawtooth"; o.frequency.value = f;
      const t = c.currentTime + i * 0.22;
      g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      o.start(t); o.stop(t + 0.25);
    });
    setTimeout(() => c.close(), 2000);
  } catch (_) {}
}

function Confetti({ active }: { active: boolean }) {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const ptRef = useRef<any[]>([]);
  useEffect(() => {
    if (!active) { ptRef.current = []; return; }
    const cv = cvRef.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    cv.width = cv.offsetWidth; cv.height = cv.offsetHeight;
    const COLS = ["#fbbf24","#f59e0b","#fde68a","#fff","#a78bfa","#34d399","#f472b6","#60a5fa"];
    ptRef.current = Array.from({ length: 120 }, (_, i) => ({
      x: cv.width / 2 + (Math.random() - 0.5) * 80,
      y: cv.height / 2,
      vx: (Math.random() - 0.5) * 9,
      vy: -(Math.random() * 7 + 3),
      r: Math.random() * 8 + 3,
      color: COLS[i % COLS.length],
      life: 0, maxLife: 80 + Math.random() * 60,
      rot: 0, vrot: (Math.random() - 0.5) * 0.4,
      shape: Math.random() > 0.5 ? "rect" : "circle",
    }));
    const loop = () => {
      ctx.clearRect(0, 0, cv.width, cv.height);
      ptRef.current = ptRef.current.filter(p => p.life < p.maxLife);
      ptRef.current.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.18; p.rot += p.vrot; p.life++;
        ctx.save(); ctx.globalAlpha = Math.max(0, 1 - p.life / p.maxLife);
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.shape === "rect") {
          ctx.fillRect(-p.r, -p.r * 0.5, p.r * 2, p.r);
        } else {
          ctx.beginPath(); ctx.arc(0, 0, p.r, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      });
      if (ptRef.current.length > 0) rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active]);
  return <canvas ref={cvRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 50 }} />;
}

function WinRing() {
  return (
    <div style={{ position: "absolute", top: "50%", left: "50%", zIndex: 10, pointerEvents: "none" }}>
      {[0, 1].map(i => (
        <div key={i} style={{
          position: "absolute",
          width: 240, height: 240,
          borderRadius: "50%",
          border: "3px solid rgba(251,191,36,0.7)",
          transform: "translate(-50%,-50%) scale(0)",
          animation: `cfStarRing 1s ease-out ${i * 0.3}s forwards`,
        }} />
      ))}
    </div>
  );
}

function Road({ history }: { history: Side[] }) {
  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap", marginBottom: 16, minHeight: 30 }}>
      {history.slice(-20).map((r, i) => (
        <div key={i} style={{
          width: 26, height: 26, borderRadius: "50%",
          background: r === "heads"
            ? "radial-gradient(circle at 40% 35%, #fde68a, #d97706)"
            : "radial-gradient(circle at 40% 35%, #c4b5fd, #6d28d9)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 10, fontWeight: 900, color: "white",
          border: `1.5px solid ${r === "heads" ? "rgba(251,191,36,.5)" : "rgba(167,139,250,.5)"}`,
          boxShadow: `0 2px 8px ${r === "heads" ? "rgba(245,158,11,.4)" : "rgba(109,40,217,.4)"}`,
          animation: "cfRoadIn .3s ease-out backwards",
          animationDelay: `${Math.min(i * 0.04, 0.4)}s`,
        }}>{r === "heads" ? "H" : "T"}</div>
      ))}
      {history.length === 0 && (
        <span style={{ color: "rgba(255,255,255,.2)", fontSize: 12, fontStyle: "italic" }}>Result history will appear here</span>
      )}
    </div>
  );
}

function BigCoin({ phase, result }: { phase: Phase; result: Side | null }) {
  const spinning = phase === "flipping";
  const landed   = phase === "result";
  const isHeads  = result === "heads";
  const isTails  = result === "tails";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
      <div style={{ position: "relative", width: 210, height: 210, margin: "0 auto" }}>

        {/* Shadow beneath coin */}
        <div style={{
          position: "absolute",
          bottom: -12, left: "50%", transform: "translateX(-50%)",
          width: spinning ? 80 : 160, height: 18, borderRadius: "50%",
          background: "rgba(0,0,0,0.5)",
          filter: "blur(8px)",
          transition: "width 0.4s ease",
        }} />

        {/* Coin wrapper */}
        <div style={{
          width: 210, height: 210,
          position: "relative",
          animation: spinning
            ? "cfSpin3D 2s cubic-bezier(.45,.05,.55,.95) infinite"
            : landed
            ? "cfLand 1.1s cubic-bezier(.22,1,.36,1) both, cfBob 2.4s ease-in-out 1.2s infinite"
            : "cfBob 3s ease-in-out infinite",
        }}>

          {/* HEADS face */}
          <div style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            background: "radial-gradient(circle at 35% 32%, #fef3c7, #fbbf24 40%, #d97706 72%, #92400e)",
            border: "8px solid #b45309",
            boxShadow: [
              "inset -10px -10px 28px rgba(0,0,0,.35)",
              "inset 8px 8px 20px rgba(255,255,255,.28)",
              landed && isHeads ? "0 0 60px #fbbf24, 0 0 120px rgba(245,158,11,.5)" : "0 6px 28px rgba(0,0,0,.8)",
            ].filter(Boolean).join(","),
            animation: landed && isHeads ? "cfWinGlow 1s ease-in-out infinite" : undefined,
            opacity: !landed || isHeads ? 1 : 0,
            transition: "opacity 0.15s",
          }}>
            {/* Coin rim grooves */}
            <div style={{
              position: "absolute", inset: 6, borderRadius: "50%",
              border: "2px dashed rgba(180,83,9,.4)",
            }} />
            <div style={{ fontSize: 72, filter: "drop-shadow(0 4px 8px rgba(0,0,0,.6))", lineHeight: 1 }}>👑</div>
            <div style={{
              fontSize: 13, fontWeight: 900, letterSpacing: 6, color: "#78350f",
              textShadow: "0 1px 2px rgba(255,255,255,.3)",
              marginTop: 4,
            }}>HEADS</div>
          </div>

          {/* TAILS face */}
          <div style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            background: "radial-gradient(circle at 35% 32%, #ede9fe, #8b5cf6 40%, #5b21b6 72%, #2e1065)",
            border: "8px solid #4c1d95",
            boxShadow: [
              "inset -10px -10px 28px rgba(0,0,0,.35)",
              "inset 8px 8px 20px rgba(255,255,255,.18)",
              landed && isTails ? "0 0 60px #a78bfa, 0 0 120px rgba(139,92,246,.5)" : "0 6px 28px rgba(0,0,0,.8)",
            ].filter(Boolean).join(","),
            animation: landed && isTails ? "cfWinGlow 1s ease-in-out infinite" : undefined,
            opacity: landed && isTails ? 1 : 0,
            transition: "opacity 0.15s",
          }}>
            <div style={{ position: "absolute", inset: 6, borderRadius: "50%", border: "2px dashed rgba(109,40,217,.4)" }} />
            <div style={{ fontSize: 72, filter: "drop-shadow(0 4px 8px rgba(0,0,0,.6))", lineHeight: 1 }}>⭐</div>
            <div style={{
              fontSize: 13, fontWeight: 900, letterSpacing: 6, color: "#ddd6fe",
              textShadow: "0 1px 3px rgba(0,0,0,.6)",
              marginTop: 4,
            }}>TAILS</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Countdown({ seconds }: { seconds: number }) {
  const r = 20; const circ = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: 52, height: 52 }}>
      <svg width={52} height={52} style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
        <circle cx={26} cy={26} r={r} stroke="rgba(255,255,255,.08)" strokeWidth={3} fill="none" />
        <circle cx={26} cy={26} r={r}
          stroke={seconds <= 3 ? "#ef4444" : "#fbbf24"} strokeWidth={3} fill="none"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - seconds / 10)}
          style={{ transition: "stroke-dashoffset 0.9s linear, stroke 0.3s" }} />
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 16, fontWeight: 900,
        color: seconds <= 3 ? "#ef4444" : "white",
        animation: seconds <= 3 ? "cfPulse .5s ease-in-out infinite" : undefined,
      }}>{seconds}</div>
    </div>
  );
}

export default function CoinFlipGame() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState<Phase>("betting");
  const [selection, setSelection] = useState<Side | null>(null);
  const [stake, setStake] = useState(0);
  const [customStake, setCustomStake] = useState("");
  const [coinResult, setCoinResult] = useState<Side | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showWinRing, setShowWinRing] = useState(false);
  const [history, setHistory] = useState<Side[]>([]);
  const [countdown, setCountdown] = useState(10);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const cdRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const addTimer = (fn: () => void, ms: number) => { const t = setTimeout(fn, ms); timers.current.push(t); return t; };

  useEffect(() => {
    setCountdown(10);
    if (cdRef.current) clearInterval(cdRef.current);
    if (phase !== "betting") return;
    cdRef.current = setInterval(() => setCountdown(c => c <= 1 ? 10 : c - 1), 1000);
    return () => { if (cdRef.current) clearInterval(cdRef.current); };
  }, [phase]);
  useEffect(() => () => { clearTimers(); if (cdRef.current) clearInterval(cdRef.current); }, []);

  const handleFlip = async () => {
    if (!selection || stake <= 0) { toast({ title: "Pick a side and enter a stake", variant: "destructive" }); return; }
    if (!isAuthenticated) { setLocation("/login"); return; }
    if (cdRef.current) clearInterval(cdRef.current);
    clearTimers();
    setPhase("flipping"); setCoinResult(null); setResult(null); setShowConfetti(false); setShowWinRing(false);
    playFlip();
    try {
      const resp = await fetch("/api/games/coin-flip", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ stake, selection }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        toast({ title: resp.status === 401 ? "Session Expired" : "Bet Failed", description: err.error || "Try again.", variant: "destructive" });
        if (resp.status === 401) queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        setPhase("betting"); return;
      }
      const placed = await resp.json();
      const balanceAfterBet = placed.newBalance as number;
      const roundId = placed.roundId as string;
      const myStake = stake, mySel = selection;
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetBalanceQueryKey() });
      const startedAt = Date.now();
      const pollId: ReturnType<typeof setInterval> = setInterval(async () => {
        if (Date.now() - startedAt > 10 * 60 * 1000) { clearInterval(pollId); return; }
        try {
          const r = await fetch(`/api/games/casino-round/coin-flip/${encodeURIComponent(roundId)}`, { credentials: "include" });
          if (!r.ok) return;
          const d = await r.json();
          if (d.status !== "settled") return;
          clearInterval(pollId);
          const settled = d.result as "heads" | "tails";
          const won = settled === mySel;
          const winAmount = won ? Math.round(myStake * 1.95 * 100) / 100 : 0;
          addTimer(() => {
            setCoinResult(settled);
            setResult({ result: settled, won, winAmount, netChange: winAmount - myStake, newBalance: balanceAfterBet + winAmount });
            setPhase("result");
            setHistory(h => [...h, settled]);
            queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetBalanceQueryKey() });
            if (won) {
              playWin();
              addTimer(() => { setShowConfetti(true); setShowWinRing(true); }, 400);
              addTimer(() => { setShowConfetti(false); setShowWinRing(false); }, 3800);
            } else { playLose(); }
          }, 600);
        } catch {}
      }, 500);
    } catch { toast({ title: "Network Error", variant: "destructive" }); setPhase("betting"); }
  };

  const handleAgain = () => {
    clearTimers(); setPhase("betting"); setSelection(null); setStake(0); setCustomStake("");
    setCoinResult(null); setResult(null); setShowConfetti(false); setShowWinRing(false);
  };

  const balance = user?.balance ?? 0;
  const canFlip = selection !== null && stake > 0 && stake <= balance && phase === "betting";

  if (isLoading) return (
    <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", background: "#060412" }}>
      <div style={{ width: 48, height: 48, borderRadius: "50%", border: "4px solid #fbbf24", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(ellipse at 50% 0%, #1a0e2e 0%, #06030f 55%, #0d0520 100%)" }}>
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
          <img src={coinFlipLogo} alt="Coin Flip" style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover" }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: 4, color: "white", fontFamily: "Georgia,serif" }}>COIN FLIP</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,.35)", letterSpacing: 2 }}>HEADS OR TAILS · 1.95×</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          {isAuthenticated
            ? <><div style={{ fontSize: 10, color: "rgba(255,255,255,.35)", letterSpacing: 1 }}>BALANCE</div>
               <div style={{ fontWeight: 900, color: "#4ade80", fontFamily: "monospace", fontSize: 14 }}>{formatCurrency(result?.newBalance ?? balance)}</div></>
            : <button onClick={() => setLocation("/login")} style={{ color: "#60a5fa", fontSize: 13, background: "none", border: "none", cursor: "pointer" }}>Login</button>}
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "14px 12px" }}>
        <Road history={history} />

        {/* Arena */}
        <div style={{
          position: "relative", overflow: "hidden",
          background: "radial-gradient(ellipse at 50% 40%, #1e1040 0%, #0a051a 100%)",
          border: "2px solid rgba(168,85,247,.3)",
          borderRadius: 28, padding: "40px 24px 30px",
          boxShadow: "inset 0 0 100px rgba(120,58,237,.08), 0 0 60px rgba(0,0,0,.9)",
          minHeight: 300,
        }}>
          <Confetti active={showConfetti} />
          {showWinRing && <WinRing />}

          {/* Ambient glow orbs */}
          <div style={{ position: "absolute", top: -40, left: "20%", width: 160, height: 160, borderRadius: "50%", background: "rgba(245,158,11,.06)", filter: "blur(40px)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", top: -40, right: "20%", width: 160, height: 160, borderRadius: "50%", background: "rgba(139,92,246,.07)", filter: "blur(40px)", pointerEvents: "none" }} />

          {phase === "betting" && (
            <div style={{ position: "absolute", top: 14, right: 14 }}><Countdown seconds={countdown} /></div>
          )}

          <BigCoin phase={phase} result={coinResult} />

          {/* Status */}
          <div style={{ textAlign: "center", marginTop: 24, minHeight: 76 }}>
            {phase === "betting" && (
              <p style={{ color: "rgba(255,255,255,.3)", fontSize: 13, letterSpacing: 2 }}>PICK A SIDE AND FLIP</p>
            )}
            {phase === "flipping" && (
              <div>
                <p style={{ color: "#c084fc", fontSize: 20, fontWeight: 900, letterSpacing: 5, animation: "cfPulse .5s ease-in-out infinite" }}>FLIPPING...</p>
                <p style={{ color: "rgba(255,255,255,.3)", fontSize: 12, marginTop: 6 }}>⚡ Auto-Decider is running</p>
              </div>
            )}
            {phase === "result" && result && (
              <div style={{ animation: "cfResultIn .5s cubic-bezier(.22,1,.36,1) both" }}>
                {result.won ? (
                  <>
                    <div style={{ fontSize: 15, color: "#fbbf24", letterSpacing: 3, fontWeight: 700 }}>
                      {coinResult === "heads" ? "👑 HEADS" : "⭐ TAILS"}
                    </div>
                    <div style={{ fontSize: 38, fontWeight: 900, color: "#fbbf24", fontFamily: "Georgia,serif", textShadow: "0 0 30px #f59e0b", lineHeight: 1.2 }}>
                      +{formatCurrency(result.winAmount)}
                    </div>
                    <div style={{ fontSize: 13, color: "#4ade80", letterSpacing: 3, marginTop: 4 }}>YOU WIN! 🎉</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 18, color: coinResult === "heads" ? "#fbbf24" : "#a78bfa", fontWeight: 900, letterSpacing: 4 }}>
                      {coinResult === "heads" ? "👑 HEADS" : "⭐ TAILS"}
                    </div>
                    <div style={{ fontSize: 15, color: "#f87171", marginTop: 6 }}>−{formatCurrency(stake)} · Better luck next time!</div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Controls panel */}
        <div style={{ marginTop: 14, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.09)", borderRadius: 20, padding: 18 }}>
          {phase === "result" ? (
            <button onClick={handleAgain} style={{
              width: "100%", padding: "15px 0", borderRadius: 14,
              background: "linear-gradient(135deg,#7c3aed,#4f46e5)",
              color: "white", fontWeight: 900, fontSize: 16, border: "none", cursor: "pointer", letterSpacing: 3,
              boxShadow: "0 4px 20px rgba(124,58,237,.5)",
            }}>▶ FLIP AGAIN</button>
          ) : (
            <>
              {/* Side picker */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                {([
                  { id: "heads" as Side, emoji: "👑", label: "HEADS", payout: "1.95×", color: "#f59e0b", glow: "rgba(245,158,11,.4)" },
                  { id: "tails" as Side, emoji: "⭐", label: "TAILS", payout: "1.95×", color: "#8b5cf6", glow: "rgba(139,92,246,.4)" },
                ]).map(opt => (
                  <button key={opt.id}
                    onClick={() => phase === "betting" && setSelection(opt.id)}
                    disabled={phase !== "betting"}
                    style={{
                      padding: "16px 8px", borderRadius: 14, textAlign: "center",
                      border: `2px solid ${selection === opt.id ? opt.color : "rgba(255,255,255,.09)"}`,
                      background: selection === opt.id
                        ? `radial-gradient(ellipse at center, ${opt.color}30, ${opt.color}12)`
                        : "rgba(255,255,255,.04)",
                      color: selection === opt.id ? "white" : "rgba(255,255,255,.38)",
                      fontWeight: 900, cursor: phase === "betting" ? "pointer" : "not-allowed",
                      boxShadow: selection === opt.id ? `0 0 24px ${opt.glow}` : "none",
                      transition: "all .2s",
                    }}>
                    <div style={{ fontSize: 34 }}>{opt.emoji}</div>
                    <div style={{ fontSize: 13, letterSpacing: 2, marginTop: 5 }}>{opt.label}</div>
                    <div style={{ fontSize: 11, opacity: .5, marginTop: 2 }}>{opt.payout}</div>
                  </button>
                ))}
              </div>

              {/* Chips */}
              <div style={{ display: "flex", gap: 8, marginBottom: 12, overflowX: "auto", paddingBottom: 2 }}>
                {CHIP_AMOUNTS.map(amt => (
                  <button key={amt} onClick={() => phase === "betting" && setStake(amt)} disabled={phase !== "betting"}
                    style={{
                      flexShrink: 0, width: 54, height: 54, borderRadius: "50%",
                      border: `3px solid ${stake === amt ? "#a855f7" : "rgba(255,255,255,.18)"}`,
                      background: stake === amt
                        ? "radial-gradient(circle at 38% 35%, #c084fc, #7c3aed)"
                        : "radial-gradient(circle at 38% 35%, #374151, #1f2937)",
                      color: stake === amt ? "white" : "rgba(255,255,255,.45)",
                      fontWeight: 900, fontSize: 12,
                      cursor: phase === "betting" ? "pointer" : "not-allowed",
                      boxShadow: stake === amt ? "0 0 18px rgba(168,85,247,.6), inset 0 2px 0 rgba(255,255,255,.18)" : "inset 0 2px 0 rgba(255,255,255,.06)",
                      transition: "all .2s",
                    }}>{amt >= 1000 ? `${amt / 1000}K` : amt}</button>
                ))}
              </div>

              {/* Custom input */}
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <input type="number" min="0" placeholder="Custom stake..." value={customStake} disabled={phase !== "betting"}
                  onChange={e => { setCustomStake(e.target.value); const p = parseFloat(e.target.value); setStake(isNaN(p) ? 0 : p); }}
                  style={{ flex: 1, padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.13)", color: "white", fontSize: 14, outline: "none" }} />
                {stake > 0 && selection && (
                  <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(251,191,36,.1)", border: "1px solid rgba(251,191,36,.28)", color: "#fbbf24", fontSize: 13, fontWeight: 900, display: "flex", alignItems: "center", whiteSpace: "nowrap" }}>
                    WIN: {formatCurrency(Math.round(stake * 1.95))}
                  </div>
                )}
              </div>

              {!isAuthenticated ? (
                <button onClick={() => setLocation("/login")} style={{ width: "100%", padding: 14, borderRadius: 12, background: "linear-gradient(135deg,#7c3aed,#4f46e5)", color: "white", fontWeight: 900, fontSize: 16, border: "none", cursor: "pointer" }}>
                  LOG IN TO PLAY
                </button>
              ) : (
                <>
                  <button onClick={handleFlip} disabled={!canFlip} style={{
                    width: "100%", padding: 15, borderRadius: 13, fontWeight: 900, fontSize: 17, letterSpacing: 3,
                    background: canFlip ? "linear-gradient(135deg,#f59e0b,#d97706,#b45309)" : "rgba(255,255,255,.06)",
                    color: canFlip ? "white" : "rgba(255,255,255,.22)",
                    border: `2px solid ${canFlip ? "rgba(245,158,11,.6)" : "rgba(255,255,255,.06)"}`,
                    cursor: canFlip ? "pointer" : "not-allowed",
                    boxShadow: canFlip ? "0 4px 28px rgba(245,158,11,.5)" : "none",
                    transition: "all .2s",
                  }}>
                    {phase === "flipping" ? "🪙 FLIPPING..." : !selection ? "← PICK A SIDE" : stake <= 0 ? "ENTER STAKE" : "🪙 FLIP COIN"}
                  </button>
                  {stake > balance && <p style={{ color: "#f87171", fontSize: 12, textAlign: "center", marginTop: 8 }}>Insufficient balance (max {formatCurrency(balance)})</p>}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
