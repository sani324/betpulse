import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey, getGetBalanceQueryKey } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";

type BetType = "small" | "big" | "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";
type Phase = "betting" | "revealing" | "result";
const CHIP_AMOUNTS = [100, 500, 1000, 5000, 10000];

// Number colors (like WinGo style)
const NUM_COLORS: Record<number, { primary: string; secondary: string; textColor: string; colorName: string }> = {
  0: { primary: "#ef4444", secondary: "#7c3aed", textColor: "white",  colorName: "Red+Violet" },
  1: { primary: "#22c55e", secondary: "#16a34a", textColor: "white",  colorName: "Green" },
  2: { primary: "#ef4444", secondary: "#dc2626", textColor: "white",  colorName: "Red" },
  3: { primary: "#22c55e", secondary: "#16a34a", textColor: "white",  colorName: "Green" },
  4: { primary: "#ef4444", secondary: "#dc2626", textColor: "white",  colorName: "Red" },
  5: { primary: "#22c55e", secondary: "#7c3aed", textColor: "white",  colorName: "Green+Violet" },
  6: { primary: "#ef4444", secondary: "#dc2626", textColor: "white",  colorName: "Red" },
  7: { primary: "#22c55e", secondary: "#16a34a", textColor: "white",  colorName: "Green" },
  8: { primary: "#ef4444", secondary: "#dc2626", textColor: "white",  colorName: "Red" },
  9: { primary: "#22c55e", secondary: "#16a34a", textColor: "white",  colorName: "Green" },
};

const STYLES = `
@keyframes drumRoll {
  0%{transform:translateY(0)} 25%{transform:translateY(-8px)} 50%{transform:translateY(4px)} 75%{transform:translateY(-5px)} 100%{transform:translateY(0)}
}
@keyframes numReveal {
  0%{transform:scale(0) rotate(-180deg);opacity:0}
  60%{transform:scale(1.25) rotate(10deg);opacity:1}
  80%{transform:scale(.95) rotate(-5deg)}
  100%{transform:scale(1) rotate(0deg);opacity:1}
}
@keyframes numFloat { 0%,100%{transform:scale(1) rotate(-2deg)} 50%{transform:scale(1.06) rotate(2deg)} }
@keyframes winPop { 0%{transform:translate(-50%,-50%) scale(0) rotate(-12deg);opacity:0} 55%{transform:translate(-50%,-50%) scale(1.35) rotate(4deg);opacity:1} 100%{transform:translate(-50%,-50%) scale(1.05) rotate(-1deg);opacity:1} }
@keyframes glowPulse { 0%,100%{opacity:.5;transform:scale(1)} 50%{opacity:1;transform:scale(1.15)} }
@keyframes roadIn { 0%{transform:scale(0);opacity:0} 100%{transform:scale(1);opacity:1} }
@keyframes countPulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.15)} }
@keyframes tickerScroll {
  0%{transform:translateY(0)} 10%{transform:translateY(-40px)} 20%{transform:translateY(-80px)} 30%{transform:translateY(-120px)} 40%{transform:translateY(-160px)} 50%{transform:translateY(-200px)} 60%{transform:translateY(-240px)} 70%{transform:translateY(-280px)} 80%{transform:translateY(-320px)} 90%{transform:translateY(-360px)} 100%{transform:translateY(-360px)}
}
`;

function mkCtx() { return new ((window as any).AudioContext || (window as any).webkitAudioContext)(); }
function playDrum() {
  try {
    const c = mkCtx();
    for (let i = 0; i < 12; i++) {
      const buf = c.createBuffer(1, c.sampleRate * 0.05, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let j = 0; j < d.length; j++) d[j] = (Math.random() * 2 - 1) * (1 - j / d.length) * 0.8;
      const src = c.createBufferSource(); const g = c.createGain();
      src.buffer = buf; src.connect(g); g.connect(c.destination);
      const t = c.currentTime + i * 0.15;
      g.gain.setValueAtTime(0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      src.start(t);
    }
    setTimeout(() => c.close(), 3000);
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

function CoinParticles({ active }: { active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const anim = useRef<number>(0);
  const parts = useRef<any[]>([]);
  useEffect(() => {
    if (!active) { parts.current = []; return; }
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    cv.width = cv.offsetWidth; cv.height = cv.offsetHeight;
    const COLS = ["#fbbf24", "#f59e0b", "#22c55e", "#fff", "#ef4444", "#a855f7"];
    parts.current = Array.from({ length: 90 }, () => ({
      x: Math.random() * cv.width, y: -20,
      vx: (Math.random() - 0.5) * 5, vy: Math.random() * 3 + 2,
      r: Math.random() * 10 + 4, color: COLS[Math.floor(Math.random() * COLS.length)],
      life: 0, maxLife: 100 + Math.random() * 60, rot: 0, vrot: (Math.random() - 0.5) * 0.35,
    }));
    const loop = () => {
      ctx.clearRect(0, 0, cv.width, cv.height);
      parts.current = parts.current.filter(p => p.life < p.maxLife);
      parts.current.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.13; p.rot += p.vrot; p.life++;
        ctx.save(); ctx.globalAlpha = 1 - p.life / p.maxLife;
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * 0.5, 0, 0, Math.PI * 2);
        ctx.fillStyle = p.color; ctx.fill(); ctx.restore();
      });
      if (parts.current.length > 0) anim.current = requestAnimationFrame(loop);
    };
    anim.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(anim.current);
  }, [active]);
  return <canvas ref={ref} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 50 }} />;
}

// Rolling ticker that shows scrolling numbers then stops on result
function NumberTicker({ revealing, finalNum }: { revealing: boolean; finalNum: number | null }) {
  const NUM_STYLE = (n: number, big?: boolean) => ({
    width: big ? 140 : 120, height: big ? 140 : 120, borderRadius: "50%",
    background: `radial-gradient(circle at 38% 38%, ${NUM_COLORS[n].primary}, ${NUM_COLORS[n].secondary})`,
    border: "5px solid rgba(255,255,255,.25)",
    display: "flex", alignItems: "center", justifyContent: "center",
    flexDirection: "column" as const,
    boxShadow: big
      ? `0 0 40px ${NUM_COLORS[n].primary}80, inset 0 3px 0 rgba(255,255,255,.2)`
      : `0 4px 20px rgba(0,0,0,.5), inset 0 2px 0 rgba(255,255,255,.15)`,
    color: "white", fontWeight: 900, fontSize: big ? 64 : 48, lineHeight: 1,
    fontFamily: "Georgia,serif",
    animation: big ? "numFloat 2s ease-in-out infinite" : undefined,
  });

  if (revealing) {
    // Scrolling ticker
    return (
      <div style={{ width: 120, height: 120, borderRadius: "50%", overflow: "hidden", margin: "0 auto", position: "relative", background: "#111", border: "4px solid rgba(255,255,255,.15)", boxShadow: "0 0 30px rgba(168,85,247,.4)" }}>
        <div style={{ display: "flex", flexDirection: "column", animation: "tickerScroll 2s ease-in-out forwards" }}>
          {[0,1,2,3,4,5,6,7,8,9,0].map((n, i) => (
            <div key={i} style={{
              width: 112, height: 40, background: `linear-gradient(135deg,${NUM_COLORS[n].primary},${NUM_COLORS[n].secondary})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, fontWeight: 900, color: "white",
            }}>{n}</div>
          ))}
        </div>
      </div>
    );
  }

  if (finalNum !== null) {
    return (
      <div style={{ margin: "0 auto", animation: "numReveal .6s cubic-bezier(.36,.07,.19,.97) forwards" }}>
        <div style={NUM_STYLE(finalNum, true) as any}>
          <div>{finalNum}</div>
          <div style={{ fontSize: 11, fontWeight: 600, opacity: .7, letterSpacing: 1 }}>
            {finalNum < 5 ? "SMALL" : "BIG"}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: 140, height: 140, borderRadius: "50%", margin: "0 auto", background: "rgba(255,255,255,.05)", border: "4px solid rgba(255,255,255,.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontSize: 48, opacity: .3 }}>?</div>
    </div>
  );
}

function Road({ history }: { history: number[] }) {
  return (
    <div style={{ display: "flex", gap: 5, justifyContent: "center", flexWrap: "wrap", marginBottom: 14, minHeight: 28 }}>
      {history.slice(-24).map((n, i) => (
        <div key={i} style={{
          width: 26, height: 26, borderRadius: "50%",
          background: `radial-gradient(circle,${NUM_COLORS[n].primary},${NUM_COLORS[n].secondary})`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 900, color: "white",
          border: "1.5px solid rgba(255,255,255,.3)",
          boxShadow: "0 2px 8px rgba(0,0,0,.4)",
          animation: "roadIn .3s ease-out backwards", animationDelay: `${Math.min(i * 0.03, 0.3)}s`,
        }}>{n}</div>
      ))}
      {history.length === 0 && <span style={{ color: "rgba(255,255,255,.22)", fontSize: 12 }}>Round history will appear here</span>}
    </div>
  );
}

function Countdown({ seconds }: { seconds: number }) {
  const r = 22; const circ = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: 54, height: 54 }}>
      <svg width={54} height={54} style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
        <circle cx={27} cy={27} r={r} stroke="rgba(255,255,255,.1)" strokeWidth={3.5} fill="none" />
        <circle cx={27} cy={27} r={r} stroke={seconds <= 3 ? "#ef4444" : "#22c55e"} strokeWidth={3.5} fill="none"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - seconds / 10)} style={{ transition: "stroke-dashoffset .9s linear,stroke .3s" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 900, color: seconds <= 3 ? "#ef4444" : "white", animation: seconds <= 3 ? "countPulse .5s ease-in-out infinite" : undefined }}>{seconds}</div>
    </div>
  );
}

export default function CodePieceGame() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState<Phase>("betting");
  const [selection, setSelection] = useState<BetType | null>(null);
  const [stake, setStake] = useState(0);
  const [customStake, setCustomStake] = useState("");
  const [result, setResult] = useState<{ number: number; isSmall: boolean; isBig: boolean; won: boolean; winAmount: number; netChange: number; newBalance: number } | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [finalNum, setFinalNum] = useState<number | null>(null);
  const [showWin, setShowWin] = useState(false);
  const [showCoins, setShowCoins] = useState(false);
  const [history, setHistory] = useState<number[]>([]);
  const [countdown, setCountdown] = useState(10);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const cdRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const addTimer = (fn: () => void, ms: number) => { const t = setTimeout(fn, ms); timers.current.push(t); return t; };

  useEffect(() => {
    setCountdown(10);
    if (cdRef.current) clearInterval(cdRef.current);
    if (phase !== "betting") return;
    cdRef.current = setInterval(() => setCountdown(c => { if (c <= 1) { clearInterval(cdRef.current!); return 0; } return c - 1; }), 1000);
    return () => { if (cdRef.current) clearInterval(cdRef.current); };
  }, [phase]);
  useEffect(() => () => { clearTimers(); if (cdRef.current) clearInterval(cdRef.current); }, []);

  const handleReveal = async () => {
    if (!selection || stake <= 0) { toast({ title: "Pick a bet and enter a stake", variant: "destructive" }); return; }
    if (!isAuthenticated) { setLocation("/login"); return; }
    if (cdRef.current) clearInterval(cdRef.current);
    clearTimers(); setRevealing(true); setPhase("revealing"); setResult(null); setFinalNum(null); setShowWin(false); setShowCoins(false);
    playDrum();
    try {
      const resp = await fetch("/api/games/code-piece", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ stake, selection }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        toast({ title: resp.status === 401 ? "Session Expired" : "Bet Failed", description: err.error || "Try again.", variant: "destructive" });
        if (resp.status === 401) queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        setPhase("betting"); setRevealing(false); return;
      }
      const placed = await resp.json();
      const roundId = placed.roundId as string;
      const myStake = stake, mySel = selection;
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetBalanceQueryKey() });
      toast({ title: "Bet placed", description: "⚡ Auto-Decider is running..." });
      const startedAt = Date.now();
      const pollId: ReturnType<typeof setInterval> = setInterval(async () => {
        if (Date.now() - startedAt > 10 * 60 * 1000) { clearInterval(pollId); return; }
        try {
          const r = await fetch(`/api/games/casino-round/code-piece/${encodeURIComponent(roundId)}`, { credentials: "include" });
          if (!r.ok) return;
          const dd = await r.json();
          if (dd.status !== "settled") return;
          clearInterval(pollId);
          const det = dd.details as { number: number; isSmall: boolean; isBig: boolean };
          let won = false; let mult = 0;
          if (mySel === "small") { won = det.isSmall; mult = 1.95; }
          else if (mySel === "big") { won = det.isBig; mult = 1.95; }
          else { won = String(det.number) === mySel; mult = 9; }
          const winAmount = won ? Math.round(myStake * mult * 100) / 100 : 0;
          addTimer(() => {
            setRevealing(false); setFinalNum(det.number);
            setResult({ number: det.number, isSmall: det.isSmall, isBig: det.isBig, won, winAmount, netChange: winAmount - myStake, newBalance: 0 });
            setPhase("result"); setHistory(h => [...h, det.number]);
            queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetBalanceQueryKey() });
            if (won) { playWin(); setTimeout(() => { setShowWin(true); setShowCoins(true); }, 200); setTimeout(() => setShowCoins(false), 3500); }
            else playLose();
          }, 800);
        } catch {}
      }, 500);
    } catch { toast({ title: "Network Error", variant: "destructive" }); setPhase("betting"); setRevealing(false); }
  };

  const handleAgain = () => {
    clearTimers(); setPhase("betting"); setSelection(null); setStake(0); setCustomStake("");
    setResult(null); setRevealing(false); setFinalNum(null); setShowWin(false); setShowCoins(false);
  };

  const balance = user?.balance ?? 0;
  const canReveal = selection !== null && stake > 0 && stake <= balance && !revealing;

  if (isLoading) return <div className="flex h-screen items-center justify-center" style={{ background: "#050510" }}><div className="h-12 w-12 animate-spin rounded-full border-4 border-green-500 border-t-transparent" /></div>;

  return (
    <div className="min-h-screen" style={{ background: "radial-gradient(ellipse at top, #0a1a10 0%, #050510 60%, #1a0a10 100%)" }}>
      <style>{STYLES}</style>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,.08)", background: "rgba(0,0,0,.4)", backdropFilter: "blur(10px)" }}>
        <button onClick={() => setLocation("/")} style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,.5)", cursor: "pointer", background: "none", border: "none" }}>
          <ArrowLeft size={18} /><span style={{ fontSize: 13 }}>Back</span>
        </button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: 4, color: "white", fontFamily: "Georgia,serif" }}>🎯 CODE PIECE</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,.4)", letterSpacing: 2 }}>NUMBER GAME · 0–9</div>
        </div>
        <div style={{ textAlign: "right" }}>
          {isAuthenticated
            ? <><div style={{ fontSize: 10, color: "rgba(255,255,255,.4)" }}>BALANCE</div><div style={{ fontWeight: 900, color: "#4ade80", fontFamily: "monospace", fontSize: 15 }}>{formatCurrency(result?.newBalance ?? balance)}</div></>
            : <button onClick={() => setLocation("/login")} style={{ color: "#22c55e", fontSize: 13, background: "none", border: "none", cursor: "pointer" }}>Login</button>}
        </div>
      </div>

      <div style={{ maxWidth: 560, margin: "0 auto", padding: "16px 12px" }}>
        <Road history={history} />

        {/* Arena */}
        <div style={{
          position: "relative", overflow: "hidden",
          background: "radial-gradient(ellipse at center, #0c1f10 0%, #060e08 100%)",
          border: "4px solid rgba(34,197,94,.4)", borderRadius: 24, padding: "28px 16px 22px",
          boxShadow: "inset 0 0 80px rgba(34,197,94,.08), 0 0 60px rgba(0,0,0,.8)",
        }}>
          <CoinParticles active={showCoins} />
          {phase === "betting" && <div style={{ position: "absolute", top: 14, right: 14 }}><Countdown seconds={countdown} /></div>}

          {/* Number display */}
          <div style={{ position: "relative", minHeight: 160, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <NumberTicker revealing={revealing} finalNum={finalNum} />
            {showWin && result && (
              <div style={{ position: "absolute", top: "50%", left: "50%", animation: "winPop .55s cubic-bezier(.36,.07,.19,.97) forwards", textAlign: "center", zIndex: 20 }}>
                <div style={{ fontSize: 40, fontWeight: 900, color: "#fbbf24", textShadow: "0 0 30px #f59e0b", fontFamily: "Georgia,serif" }}>+{formatCurrency(result.winAmount)}</div>
                <div style={{ fontSize: 14, color: "#4ade80", letterSpacing: 3 }}>YOU WIN! 🎉</div>
              </div>
            )}
          </div>

          {/* Number color bar (0-9 legend) */}
          <div style={{ display: "flex", gap: 4, justifyContent: "center", marginTop: 16, flexWrap: "wrap" }}>
            {[0,1,2,3,4,5,6,7,8,9].map(n => (
              <div key={n} style={{
                width: 32, height: 32, borderRadius: 8,
                background: `radial-gradient(circle,${NUM_COLORS[n].primary},${NUM_COLORS[n].secondary})`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, fontWeight: 900, color: "white",
                border: finalNum === n ? "2px solid #fbbf24" : "1px solid rgba(255,255,255,.15)",
                boxShadow: finalNum === n ? "0 0 16px rgba(251,191,36,.7)" : "none",
                transition: "all .3s",
              }}>{n}</div>
            ))}
          </div>

          {/* Result */}
          {phase === "result" && result && !showWin && (
            <div style={{ marginTop: 14, textAlign: "center", padding: "10px 16px", borderRadius: 14, background: result.won ? "rgba(34,197,94,.15)" : "rgba(239,68,68,.15)", border: `1px solid ${result.won ? "rgba(34,197,94,.4)" : "rgba(239,68,68,.3)"}` }}>
              <p style={{ fontWeight: 900, fontSize: 18, color: result.won ? "#4ade80" : "#f87171", letterSpacing: 3, fontFamily: "Georgia,serif" }}>
                {result.number} · {result.isSmall ? "SMALL" : "BIG"} · {NUM_COLORS[result.number].colorName}
              </p>
              {!result.won && <p style={{ color: "#f87171", fontSize: 13, marginTop: 4 }}>-{formatCurrency(stake)} · Better luck next time!</p>}
            </div>
          )}
          {phase === "revealing" && <p style={{ textAlign: "center", color: "#4ade80", fontSize: 18, fontWeight: 900, letterSpacing: 4, marginTop: 14, animation: "drumRoll .3s ease-in-out infinite" }}>REVEALING...</p>}
          {phase === "betting" && !finalNum && <p style={{ textAlign: "center", color: "rgba(255,255,255,.3)", fontSize: 14, marginTop: 14 }}>Pick a number or Small / Big!</p>}
        </div>

        {/* Controls */}
        <div style={{ marginTop: 14, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 18, padding: 18 }}>
          {phase === "result" ? (
            <button onClick={handleAgain} style={{ width: "100%", padding: "14px 0", borderRadius: 12, background: "linear-gradient(135deg,#7c3aed,#4f46e5)", color: "white", fontWeight: 900, fontSize: 16, border: "none", cursor: "pointer", letterSpacing: 2 }}>▶ PLAY AGAIN</button>
          ) : (
            <>
              {/* Small / Big */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                {([{ id: "small", label: "⬇ SMALL", sub: "0–4  |  1.9×", color: "#3b82f6" }, { id: "big", label: "⬆ BIG", sub: "5–9  |  1.9×", color: "#ef4444" }] as { id: BetType; label: string; sub: string; color: string }[]).map(opt => (
                  <button key={opt.id} onClick={() => phase === "betting" && setSelection(opt.id)} disabled={phase !== "betting"}
                    style={{
                      padding: "14px 8px", borderRadius: 12, textAlign: "center",
                      border: `2px solid ${selection === opt.id ? opt.color : "rgba(255,255,255,.1)"}`,
                      background: selection === opt.id ? `linear-gradient(135deg,${opt.color}40,${opt.color}20)` : "rgba(255,255,255,.04)",
                      color: selection === opt.id ? "white" : "rgba(255,255,255,.4)", fontWeight: 900,
                      cursor: phase === "betting" ? "pointer" : "not-allowed", transition: "all .2s",
                      boxShadow: selection === opt.id ? `0 0 20px ${opt.color}55` : "none",
                    }}>
                    <div style={{ fontSize: 16 }}>{opt.label}</div>
                    <div style={{ fontSize: 11, opacity: .6, marginTop: 2 }}>{opt.sub}</div>
                  </button>
                ))}
              </div>
              {/* Exact number buttons 0-9 */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 7, marginBottom: 14 }}>
                {[0,1,2,3,4,5,6,7,8,9].map(n => {
                  const sel = String(n) as BetType;
                  const active = selection === sel;
                  return (
                    <button key={n} onClick={() => phase === "betting" && setSelection(sel)} disabled={phase !== "betting"}
                      style={{
                        height: 52, borderRadius: 10,
                        background: active ? `radial-gradient(circle,${NUM_COLORS[n].primary},${NUM_COLORS[n].secondary})` : "rgba(255,255,255,.05)",
                        border: `2px solid ${active ? NUM_COLORS[n].primary : "rgba(255,255,255,.1)"}`,
                        color: active ? "white" : "rgba(255,255,255,.5)",
                        fontSize: 20, fontWeight: 900, fontFamily: "Georgia,serif",
                        cursor: phase === "betting" ? "pointer" : "not-allowed", transition: "all .2s",
                        boxShadow: active ? `0 0 18px ${NUM_COLORS[n].primary}60` : "none",
                      }}>
                      {n}
                    </button>
                  );
                })}
              </div>
              {selection && !["small","big"].includes(selection) && (
                <div style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,.4)", marginBottom: 10 }}>
                  Exact match pays <span style={{ color: "#fbbf24", fontWeight: 900 }}>8.5×</span>
                </div>
              )}
              {/* Chips */}
              <div style={{ display: "flex", gap: 8, marginBottom: 12, overflowX: "auto" }}>
                {CHIP_AMOUNTS.map(amt => (
                  <button key={amt} onClick={() => phase === "betting" && setStake(amt)} disabled={phase !== "betting"}
                    style={{
                      flexShrink: 0, width: 56, height: 56, borderRadius: "50%",
                      border: `3px solid ${stake === amt ? "#a855f7" : "rgba(255,255,255,.2)"}`,
                      background: stake === amt ? "radial-gradient(circle at 40% 40%,#c084fc,#7c3aed)" : "radial-gradient(circle at 40% 40%,#374151,#1f2937)",
                      color: stake === amt ? "white" : "rgba(255,255,255,.5)", fontWeight: 900, fontSize: 12,
                      cursor: phase === "betting" ? "pointer" : "not-allowed",
                      boxShadow: stake === amt ? "0 0 20px rgba(168,85,247,.6),inset 0 2px 0 rgba(255,255,255,.2)" : "inset 0 2px 0 rgba(255,255,255,.08)", transition: "all .2s",
                    }}>{amt >= 1000 ? `${amt / 1000}K` : amt}</button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <input type="number" min="0" placeholder="Custom stake..." value={customStake} disabled={phase !== "betting"}
                  onChange={e => { setCustomStake(e.target.value); const p = parseFloat(e.target.value); setStake(isNaN(p) ? 0 : p); }}
                  style={{ flex: 1, padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.15)", color: "white", fontSize: 14, outline: "none" }} />
                {stake > 0 && selection && (
                  <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(251,191,36,.12)", border: "1px solid rgba(251,191,36,.3)", color: "#fbbf24", fontSize: 13, fontWeight: 900, display: "flex", alignItems: "center", whiteSpace: "nowrap" }}>
                    WIN: {formatCurrency(Math.round(stake * (["small","big"].includes(selection) ? 1.9 : 8.5)))}
                  </div>
                )}
              </div>
              {!isAuthenticated ? (
                <button onClick={() => setLocation("/login")} style={{ width: "100%", padding: 14, borderRadius: 12, background: "linear-gradient(135deg,#7c3aed,#4f46e5)", color: "white", fontWeight: 900, fontSize: 16, border: "none", cursor: "pointer" }}>LOG IN TO PLAY</button>
              ) : (
                <>
                  <button onClick={handleReveal} disabled={!canReveal} style={{
                    width: "100%", padding: 14, borderRadius: 12, fontWeight: 900, fontSize: 17, letterSpacing: 3,
                    background: canReveal ? "linear-gradient(135deg,#22c55e,#16a34a,#14532d)" : "rgba(255,255,255,.07)",
                    color: canReveal ? "white" : "rgba(255,255,255,.25)",
                    border: `2px solid ${canReveal ? "rgba(34,197,94,.7)" : "rgba(255,255,255,.08)"}`,
                    cursor: canReveal ? "pointer" : "not-allowed",
                    boxShadow: canReveal ? "0 4px 24px rgba(34,197,94,.5)" : "none", transition: "all .2s",
                  }}>{revealing ? "🎯 REVEALING..." : !selection ? "← PICK A BET" : stake <= 0 ? "ENTER STAKE" : "🎯 REVEAL NUMBER"}</button>
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
