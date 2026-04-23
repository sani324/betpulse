import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey, getGetBalanceQueryKey } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";

type Side = "heads" | "tails";
type Phase = "betting" | "flipping" | "result";
const CHIP_AMOUNTS = [100, 500, 1000, 5000, 10000];

const STYLES = `
@keyframes cfSpin { 0%{transform:rotateY(0)} 100%{transform:rotateY(3600deg)} }
@keyframes cfWinGlow { 0%,100%{filter:drop-shadow(0 0 20px #fbbf24)} 50%{filter:drop-shadow(0 0 60px #f59e0b) drop-shadow(0 0 100px rgba(245,158,11,.5))} }
@keyframes cfBob { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-14px) scale(1.04)} }
@keyframes cfResultPop { 0%{transform:translate(-50%,-50%) scale(0) rotate(-15deg);opacity:0} 55%{transform:translate(-50%,-50%) scale(1.3) rotate(4deg);opacity:1} 100%{transform:translate(-50%,-50%) scale(1.05) rotate(-1deg);opacity:1} }
@keyframes cfRoadIn { 0%{transform:scale(0);opacity:0} 100%{transform:scale(1);opacity:1} }
@keyframes cfPulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.12)} }
@keyframes cfStarBurst { 0%{transform:translate(-50%,-50%) scale(0) rotate(0);opacity:1} 100%{transform:translate(-50%,-50%) scale(2.5) rotate(45deg);opacity:0} }
`;

function mkCtx() { return new ((window as any).AudioContext || (window as any).webkitAudioContext)(); }
function playFlip() {
  try {
    const c = mkCtx();
    for (let i = 0; i < 10; i++) {
      const o = c.createOscillator(); const g = c.createGain();
      o.connect(g); g.connect(c.destination); o.type = "triangle";
      o.frequency.value = 600 + i * 120;
      const t = c.currentTime + i * 0.1;
      g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      o.start(t); o.stop(t + 0.09);
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

function CoinParticles({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const particles = useRef<any[]>([]);
  useEffect(() => {
    if (!active) { particles.current = []; return; }
    const cv = canvasRef.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    cv.width = cv.offsetWidth; cv.height = cv.offsetHeight;
    const COLS = ["#fbbf24", "#f59e0b", "#fde68a", "#fff", "#a78bfa", "#34d399"];
    particles.current = Array.from({ length: 90 }, () => ({
      x: Math.random() * cv.width, y: -20,
      vx: (Math.random() - 0.5) * 5, vy: Math.random() * 3 + 2,
      r: Math.random() * 11 + 4, color: COLS[Math.floor(Math.random() * COLS.length)],
      life: 0, maxLife: 90 + Math.random() * 70, rot: 0, vrot: (Math.random() - 0.5) * 0.35,
    }));
    const loop = () => {
      ctx.clearRect(0, 0, cv.width, cv.height);
      particles.current = particles.current.filter(p => p.life < p.maxLife);
      particles.current.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.13; p.rot += p.vrot; p.life++;
        ctx.save(); ctx.globalAlpha = 1 - p.life / p.maxLife;
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * 0.5, 0, 0, Math.PI * 2);
        ctx.fillStyle = p.color; ctx.fill();
        ctx.restore();
      });
      if (particles.current.length > 0) animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [active]);
  return <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 50 }} />;
}

function Countdown({ seconds }: { seconds: number }) {
  const r = 22; const circ = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: 56, height: 56 }}>
      <svg width={56} height={56} style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
        <circle cx={28} cy={28} r={r} stroke="rgba(255,255,255,.1)" strokeWidth={3.5} fill="none" />
        <circle cx={28} cy={28} r={r} stroke={seconds <= 3 ? "#ef4444" : "#fbbf24"} strokeWidth={3.5} fill="none"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - seconds / 10)} style={{ transition: "stroke-dashoffset .9s linear,stroke .3s" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 900, color: seconds <= 3 ? "#ef4444" : "white", animation: seconds <= 3 ? "cfPulse .5s ease-in-out infinite" : undefined }}>{seconds}</div>
    </div>
  );
}

function BigCoin({ spinning, result }: { spinning: boolean; result: Side | null }) {
  const won = !spinning && result !== null;
  const isHeads = result === "heads" || (!result && true);
  return (
    <div style={{ width: 180, height: 180, perspective: 900, margin: "0 auto", position: "relative" }}>
      <div style={{
        width: "100%", height: "100%", position: "relative", transformStyle: "preserve-3d",
        animation: spinning ? "cfSpin 2s cubic-bezier(.25,.1,.25,1) forwards" : won ? "cfBob 2.2s ease-in-out infinite" : undefined,
        borderRadius: "50%",
      }}>
        {/* Heads face */}
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
          background: "radial-gradient(circle at 38% 35%, #fde68a, #f59e0b 50%, #92400e)",
          border: "7px solid #d97706",
          boxShadow: "inset -8px -8px 24px rgba(0,0,0,.35), inset 5px 5px 16px rgba(255,255,255,.22)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          animation: won && result === "heads" ? "cfWinGlow .9s ease-in-out infinite" : undefined,
        }}>
          <div style={{ fontSize: 64, filter: "drop-shadow(0 3px 6px rgba(0,0,0,.5))" }}>👑</div>
          <div style={{ fontSize: 14, fontWeight: 900, color: "#78350f", letterSpacing: 4, marginTop: -4 }}>HEADS</div>
        </div>
        {/* Tails face */}
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
          transform: "rotateY(180deg)",
          background: "radial-gradient(circle at 38% 35%, #c4b5fd, #7c3aed 50%, #3b0764)",
          border: "7px solid #6d28d9",
          boxShadow: "inset -8px -8px 24px rgba(0,0,0,.35), inset 5px 5px 16px rgba(255,255,255,.15)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          animation: won && result === "tails" ? "cfWinGlow .9s ease-in-out infinite" : undefined,
        }}>
          <div style={{ fontSize: 64, filter: "drop-shadow(0 3px 6px rgba(0,0,0,.5))" }}>⭐</div>
          <div style={{ fontSize: 14, fontWeight: 900, color: "#c4b5fd", letterSpacing: 4, marginTop: -4 }}>TAILS</div>
        </div>
      </div>
    </div>
  );
}

function Road({ history }: { history: Side[] }) {
  return (
    <div style={{ display: "flex", gap: 5, justifyContent: "center", flexWrap: "wrap", marginBottom: 14, minHeight: 28 }}>
      {history.slice(-24).map((r, i) => (
        <div key={i} style={{
          width: 24, height: 24, borderRadius: "50%",
          background: r === "heads" ? "linear-gradient(135deg,#f59e0b,#d97706)" : "linear-gradient(135deg,#7c3aed,#4f46e5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 10, fontWeight: 900, color: "white",
          border: "1.5px solid rgba(255,255,255,.3)",
          boxShadow: "0 2px 8px rgba(0,0,0,.4)",
          animation: "cfRoadIn .3s ease-out backwards", animationDelay: `${Math.min(i * 0.03, 0.3)}s`,
        }}>
          {r === "heads" ? "H" : "T"}
        </div>
      ))}
      {history.length === 0 && <span style={{ color: "rgba(255,255,255,.22)", fontSize: 12 }}>Round history will appear here</span>}
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
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [showWin, setShowWin] = useState(false);
  const [showCoins, setShowCoins] = useState(false);
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
    cdRef.current = setInterval(() => setCountdown(c => { if (c <= 1) { return 10; } return c - 1; }), 1000);
    return () => { if (cdRef.current) clearInterval(cdRef.current); };
  }, [phase]);
  useEffect(() => () => { clearTimers(); if (cdRef.current) clearInterval(cdRef.current); }, []);

  const handleFlip = async () => {
    if (!selection || stake <= 0) { toast({ title: "Pick a side and enter a stake", variant: "destructive" }); return; }
    if (!isAuthenticated) { setLocation("/login"); return; }
    if (cdRef.current) clearInterval(cdRef.current);
    clearTimers(); setSpinning(true); setPhase("flipping"); setCoinResult(null); setResult(null); setShowWin(false); setShowCoins(false);
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
        setPhase("betting"); setSpinning(false); return;
      }
      const placed = await resp.json();
      const roundId = placed.roundId as string;
      const myStake = stake, mySel = selection;
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetBalanceQueryKey() });
      toast({ title: "Bet placed", description: "Waiting for the round to be settled..." });
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
            setSpinning(false); setCoinResult(settled);
            setResult({ result: settled, won, winAmount, netChange: winAmount - myStake, newBalance: 0 });
            setPhase("result"); setHistory(h => [...h, settled]);
            queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetBalanceQueryKey() });
            if (won) { playWin(); setTimeout(() => { setShowWin(true); setShowCoins(true); }, 200); setTimeout(() => setShowCoins(false), 3500); }
            else playLose();
          }, 800);
        } catch {}
      }, 500);
    } catch { toast({ title: "Network Error", variant: "destructive" }); setPhase("betting"); setSpinning(false); }
  };

  const handleAgain = () => {
    clearTimers(); setPhase("betting"); setSelection(null); setStake(0); setCustomStake(""); setCoinResult(null); setSpinning(false); setResult(null); setShowWin(false); setShowCoins(false);
  };

  const balance = user?.balance ?? 0;
  const canFlip = selection !== null && stake > 0 && stake <= balance && !spinning;

  if (isLoading) return <div className="flex h-screen items-center justify-center" style={{ background: "#050510" }}><div className="h-12 w-12 animate-spin rounded-full border-4 border-yellow-500 border-t-transparent" /></div>;

  return (
    <div className="min-h-screen" style={{ background: "radial-gradient(ellipse at top, #1a0e2e 0%, #050510 60%, #1a0e2e 100%)" }}>
      <style>{STYLES}</style>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,.08)", background: "rgba(0,0,0,.4)", backdropFilter: "blur(10px)" }}>
        <button onClick={() => setLocation("/")} style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,.5)", cursor: "pointer", background: "none", border: "none" }}>
          <ArrowLeft size={18} /><span style={{ fontSize: 13 }}>Back</span>
        </button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: 4, color: "white", fontFamily: "Georgia,serif" }}>🪙 COIN FLIP</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,.4)", letterSpacing: 2 }}>HEADS OR TAILS · 1.95×</div>
        </div>
        <div style={{ textAlign: "right" }}>
          {isAuthenticated
            ? <><div style={{ fontSize: 10, color: "rgba(255,255,255,.4)" }}>BALANCE</div><div style={{ fontWeight: 900, color: "#4ade80", fontFamily: "monospace", fontSize: 15 }}>{formatCurrency(result?.newBalance ?? balance)}</div></>
            : <button onClick={() => setLocation("/login")} style={{ color: "#60a5fa", fontSize: 13, background: "none", border: "none", cursor: "pointer" }}>Login</button>}
        </div>
      </div>

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "16px 12px" }}>
        <Road history={history} />

        {/* Arena */}
        <div style={{
          position: "relative", overflow: "hidden",
          background: "radial-gradient(ellipse at center, #1e1030 0%, #0d0618 100%)",
          border: "4px solid rgba(168,85,247,.45)", borderRadius: 24, padding: "36px 20px 24px",
          boxShadow: "inset 0 0 80px rgba(124,58,237,.12), 0 0 60px rgba(0,0,0,.8)",
        }}>
          <CoinParticles active={showCoins} />
          {phase === "betting" && <div style={{ position: "absolute", top: 14, right: 14 }}><Countdown seconds={countdown} /></div>}

          <BigCoin spinning={spinning} result={coinResult} />

          {/* Status messages */}
          <div style={{ textAlign: "center", marginTop: 20, minHeight: 80, position: "relative" }}>
            {phase === "betting" && <p style={{ color: "rgba(255,255,255,.35)", fontSize: 14, letterSpacing: 1 }}>Pick a side and flip!</p>}
            {phase === "flipping" && <p style={{ color: "#c084fc", fontSize: 18, fontWeight: 900, letterSpacing: 4, animation: "cfPulse .6s ease-in-out infinite" }}>FLIPPING...</p>}
            {phase === "result" && result && (
              <>
                {showWin && (
                  <div style={{ position: "absolute", top: "50%", left: "50%", animation: "cfResultPop .55s cubic-bezier(.36,.07,.19,.97) forwards", textAlign: "center", zIndex: 20 }}>
                    <div style={{ fontSize: 40, fontWeight: 900, color: "#fbbf24", textShadow: "0 0 30px #f59e0b", fontFamily: "Georgia,serif" }}>+{formatCurrency(result.winAmount)}</div>
                    <div style={{ fontSize: 14, color: "#4ade80", letterSpacing: 3 }}>YOU WIN! 🎉</div>
                  </div>
                )}
                {!result.won && (
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: coinResult === "heads" ? "#fbbf24" : "#a78bfa", fontFamily: "Georgia,serif", letterSpacing: 3 }}>{coinResult === "heads" ? "👑 HEADS" : "⭐ TAILS"}</div>
                    <div style={{ fontSize: 14, color: "#f87171", marginTop: 4 }}>-{formatCurrency(stake)} · Better luck next time!</div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Controls */}
        <div style={{ marginTop: 14, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 18, padding: 18 }}>
          {phase === "result" ? (
            <button onClick={handleAgain} style={{ width: "100%", padding: "14px 0", borderRadius: 12, background: "linear-gradient(135deg,#7c3aed,#4f46e5)", color: "white", fontWeight: 900, fontSize: 16, border: "none", cursor: "pointer", letterSpacing: 2 }}>▶ FLIP AGAIN</button>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                {([{ id: "heads", emoji: "👑", label: "HEADS", color: "#f59e0b" }, { id: "tails", emoji: "⭐", label: "TAILS", color: "#7c3aed" }] as { id: Side; emoji: string; label: string; color: string }[]).map(opt => (
                  <button key={opt.id} onClick={() => phase === "betting" && setSelection(opt.id)} disabled={phase !== "betting"}
                    style={{
                      padding: "16px 8px", borderRadius: 12, textAlign: "center",
                      border: `2px solid ${selection === opt.id ? opt.color : "rgba(255,255,255,.1)"}`,
                      background: selection === opt.id ? `linear-gradient(135deg,${opt.color}40,${opt.color}18)` : "rgba(255,255,255,.04)",
                      color: selection === opt.id ? "white" : "rgba(255,255,255,.4)", fontWeight: 900,
                      cursor: phase === "betting" ? "pointer" : "not-allowed", transition: "all .2s",
                      boxShadow: selection === opt.id ? `0 0 20px ${opt.color}50` : "none",
                    }}>
                    <div style={{ fontSize: 28 }}>{opt.emoji}</div>
                    <div style={{ fontSize: 13, letterSpacing: 2, marginTop: 4 }}>{opt.label}</div>
                    <div style={{ fontSize: 10, opacity: .55, marginTop: 2 }}>1.95×</div>
                  </button>
                ))}
              </div>
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
                    WIN: {formatCurrency(Math.round(stake * 1.95))}
                  </div>
                )}
              </div>
              {!isAuthenticated ? (
                <button onClick={() => setLocation("/login")} style={{ width: "100%", padding: 14, borderRadius: 12, background: "linear-gradient(135deg,#7c3aed,#4f46e5)", color: "white", fontWeight: 900, fontSize: 16, border: "none", cursor: "pointer" }}>LOG IN TO PLAY</button>
              ) : (
                <>
                  <button onClick={handleFlip} disabled={!canFlip} style={{
                    width: "100%", padding: 14, borderRadius: 12, fontWeight: 900, fontSize: 17, letterSpacing: 3,
                    background: canFlip ? "linear-gradient(135deg,#f59e0b,#d97706,#92400e)" : "rgba(255,255,255,.07)",
                    color: canFlip ? "white" : "rgba(255,255,255,.25)",
                    border: `2px solid ${canFlip ? "rgba(245,158,11,.7)" : "rgba(255,255,255,.08)"}`,
                    cursor: canFlip ? "pointer" : "not-allowed",
                    boxShadow: canFlip ? "0 4px 24px rgba(245,158,11,.5)" : "none", transition: "all .2s",
                  }}>{spinning ? "🪙 FLIPPING..." : !selection ? "← PICK A SIDE" : stake <= 0 ? "ENTER STAKE" : "🪙 FLIP COIN"}</button>
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
