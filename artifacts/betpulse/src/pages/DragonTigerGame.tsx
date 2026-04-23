import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey, getGetBalanceQueryKey } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";

type CardData = { rank: string; suit: string; value: number };
type Selection = "dragon" | "tiger" | "tie";
type Phase = "betting" | "dealing" | "result";

const CHIP_AMOUNTS = [100, 500, 1000, 5000, 10000];

// ─── Audio ────────────────────────────────────────────────────────────
function mkCtx() { return new ((window as any).AudioContext || (window as any).webkitAudioContext)(); }
function playDragonRoar() {
  try {
    const c = mkCtx(); const now = c.currentTime;
    [[110, 42, "sawtooth", 0.45, 1.8], [900, 220, "sawtooth", 0.18, 0.4]].forEach(([f, f2, t, g, dur]: any) => {
      const o = c.createOscillator(); const gn = c.createGain();
      o.connect(gn); gn.connect(c.destination); o.type = t;
      o.frequency.setValueAtTime(f, now); o.frequency.exponentialRampToValueAtTime(f2, now + dur);
      gn.gain.setValueAtTime(g, now); gn.gain.exponentialRampToValueAtTime(0.001, now + dur);
      o.start(now); o.stop(now + dur);
    });
    setTimeout(() => c.close(), 3000);
  } catch (_) {}
}
function playTigerRoar() {
  try {
    const c = mkCtx(); const now = c.currentTime;
    const o = c.createOscillator(); const lfo = c.createOscillator();
    const lg = c.createGain(); const g = c.createGain();
    lfo.connect(lg); lg.connect(o.frequency); o.connect(g); g.connect(c.destination);
    o.type = "sawtooth"; o.frequency.setValueAtTime(200, now); o.frequency.exponentialRampToValueAtTime(95, now + 1); o.frequency.exponentialRampToValueAtTime(180, now + 1.4);
    lfo.type = "sine"; lfo.frequency.value = 7; lg.gain.value = 35;
    g.gain.setValueAtTime(0.38, now); g.gain.exponentialRampToValueAtTime(0.001, now + 1.6);
    lfo.start(now); o.start(now); lfo.stop(now + 1.6); o.stop(now + 1.6);
    setTimeout(() => c.close(), 3000);
  } catch (_) {}
}
function playWin() {
  try {
    const c = mkCtx();
    [523, 659, 784, 1047, 1319].forEach((freq, i) => {
      const o = c.createOscillator(); const g = c.createGain();
      o.connect(g); g.connect(c.destination); o.type = "triangle"; o.frequency.value = freq;
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
    [380, 330, 285, 240].forEach((freq, i) => {
      const o = c.createOscillator(); const g = c.createGain();
      o.connect(g); g.connect(c.destination); o.type = "sawtooth"; o.frequency.value = freq;
      const t = c.currentTime + i * 0.19;
      g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      o.start(t); o.stop(t + 0.28);
    });
    setTimeout(() => c.close(), 2000);
  } catch (_) {}
}
function playCardFlip() {
  try {
    const c = mkCtx(); const now = c.currentTime;
    const o = c.createOscillator(); const g = c.createGain();
    o.connect(g); g.connect(c.destination); o.type = "sine";
    o.frequency.setValueAtTime(1200, now); o.frequency.exponentialRampToValueAtTime(400, now + 0.12);
    g.gain.setValueAtTime(0.09, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    o.start(now); o.stop(now + 0.12); setTimeout(() => c.close(), 500);
  } catch (_) {}
}

// ─── Canvas Coin Particles ────────────────────────────────────────────
function CoinParticles({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const particles = useRef<{ x: number; y: number; vx: number; vy: number; r: number; color: string; life: number; maxLife: number; rot: number; vrot: number }[]>([]);

  useEffect(() => {
    if (!active) { particles.current = []; return; }
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight;
    const COLORS = ["#fbbf24", "#f59e0b", "#fde68a", "#fff", "#a78bfa", "#34d399", "#f87171"];
    particles.current = Array.from({ length: 80 }, () => ({
      x: Math.random() * canvas.width, y: -20,
      vx: (Math.random() - 0.5) * 4, vy: Math.random() * 3 + 2,
      r: Math.random() * 10 + 5, color: COLORS[Math.floor(Math.random() * COLORS.length)],
      life: 0, maxLife: 90 + Math.random() * 60, rot: 0, vrot: (Math.random() - 0.5) * 0.3,
    }));
    const loop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.current = particles.current.filter(p => p.life < p.maxLife);
      particles.current.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.rot += p.vrot; p.life++;
        const alpha = 1 - p.life / p.maxLife;
        ctx.save(); ctx.globalAlpha = alpha; ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * 0.5, 0, 0, Math.PI * 2);
        ctx.fillStyle = p.color; ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.3)"; ctx.lineWidth = 1; ctx.stroke();
        ctx.restore();
      });
      if (particles.current.length > 0) animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [active]);

  return (
    <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 50 }} />
  );
}

// ─── Dragon character ─────────────────────────────────────────────────
const STYLES = `
@keyframes dragonHover { 0%,100%{transform:translateY(0) scale(1) rotate(-2deg)} 50%{transform:translateY(-16px) scale(1.06) rotate(2deg)} }
@keyframes tigerHover  { 0%,100%{transform:translateX(0) scale(1) rotate(3deg)} 50%{transform:translateX(-10px) scale(1.07) rotate(-3deg)} }
@keyframes dragonWin   { 0%{transform:scale(1)} 15%{transform:scale(1.5) rotate(-10deg)} 30%{transform:scale(1.4) rotate(10deg)} 50%{transform:scale(1.45)} 100%{transform:scale(1.3)} }
@keyframes tigerWin    { 0%{transform:scale(1)} 15%{transform:scale(1.5) rotate(10deg)} 30%{transform:scale(1.4) rotate(-10deg)} 50%{transform:scale(1.45)} 100%{transform:scale(1.3)} }
@keyframes loseFade    { to{transform:scale(0.55) rotate(8deg);opacity:0.2;filter:grayscale(1)} }
@keyframes auraGlow    { 0%,100%{opacity:.4;transform:scale(1)} 50%{opacity:1;transform:scale(1.2)} }
@keyframes firePart    { 0%{transform:translateY(0) scale(1);opacity:.9} 100%{transform:translateY(-55px) scale(.1);opacity:0} }
@keyframes frostPart   { 0%{transform:translateY(0) scale(1);opacity:.8} 100%{transform:translateY(-50px) scale(.1);opacity:0} }
@keyframes roarText    { 0%{transform:translate(-50%,-50%) scale(0) rotate(-20deg);opacity:0} 55%{transform:translate(-50%,-50%) scale(1.35) rotate(5deg);opacity:1} 100%{transform:translate(-50%,-50%) scale(1.1) rotate(-2deg);opacity:1} }
@keyframes cardFlip    { 0%{transform:rotateY(0)} 100%{transform:rotateY(180deg)} }
@keyframes winNumPop   { 0%{transform:translate(-50%,-50%) scale(0);opacity:0} 50%{transform:translate(-50%,-50%) scale(1.3);opacity:1} 100%{transform:translate(-50%,-50%) scale(1.05);opacity:1} }
@keyframes countdownPulse { 0%{transform:scale(1)} 50%{transform:scale(1.15)} 100%{transform:scale(1)} }
@keyframes roadEntry   { 0%{transform:scale(0) rotate(180deg);opacity:0} 100%{transform:scale(1) rotate(0deg);opacity:1} }
@keyframes tableShine  { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
`;

function DragonChar({ state }: { state: "idle" | "win" | "lose" }) {
  const flames = [
    { l: -24, w: 12, h: 32, d: 0, hue: 190 },
    { l: -10, w: 15, h: 42, d: 0.1, hue: 200 },
    { l: 4, w: 18, h: 50, d: 0.05, hue: 210 },
    { l: 18, w: 14, h: 38, d: 0.15, hue: 185 },
    { l: 30, w: 11, h: 28, d: 0.08, hue: 205 },
  ];
  return (
    <div style={{ position: "relative", width: 160, height: 160, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {/* Aura */}
      <div style={{
        position: "absolute", inset: -28, borderRadius: "50%",
        background: state === "win"
          ? "radial-gradient(circle, rgba(96,165,250,0.7) 0%, rgba(59,130,246,0.4) 40%, transparent 70%)"
          : "radial-gradient(circle, rgba(96,165,250,0.25) 0%, transparent 70%)",
        animation: "auraGlow 0.5s ease-in-out infinite alternate",
        transition: "background 0.4s",
      }} />
      {/* Frost sparks */}
      {state !== "lose" && flames.map((f, i) => (
        <div key={i} style={{
          position: "absolute", bottom: 8, left: `calc(50% + ${f.l}px)`,
          width: f.w, height: f.h, borderRadius: "50% 50% 30% 30%",
          background: `linear-gradient(to top, hsl(${f.hue},90%,60%), hsl(${f.hue + 15},80%,80%), transparent)`,
          animation: `frostPart ${0.65 + i * 0.1}s ease-out ${f.d}s infinite`,
          opacity: 0.85,
        }} />
      ))}
      {/* Character */}
      <div style={{
        fontSize: 110, lineHeight: 1, display: "inline-block", transformOrigin: "center bottom",
        animation: state === "idle" ? "dragonHover 2.8s ease-in-out infinite" : state === "win" ? "dragonWin 0.65s cubic-bezier(.36,.07,.19,.97) forwards" : "loseFade .55s ease-out forwards",
        filter: state === "win" ? "drop-shadow(0 0 28px rgba(96,165,250,1)) drop-shadow(0 0 60px rgba(59,130,246,0.6))" : state === "lose" ? "grayscale(1) brightness(0.4)" : "drop-shadow(0 0 18px rgba(96,165,250,0.6))",
        cursor: "default", userSelect: "none",
      }}>🐲</div>
      {state === "win" && (
        <div style={{
          position: "absolute", top: "35%", left: "50%",
          fontSize: 22, fontWeight: 900, color: "#93c5fd",
          animation: "roarText .5s cubic-bezier(.36,.07,.19,.97) forwards",
          whiteSpace: "nowrap", textShadow: "0 0 30px rgba(59,130,246,1)", pointerEvents: "none", zIndex: 10,
          fontFamily: "Georgia,serif", letterSpacing: 5,
        }}>ROAR!</div>
      )}
    </div>
  );
}

function TigerChar({ state }: { state: "idle" | "win" | "lose" }) {
  const flames = [
    { l: -24, w: 11, h: 28, d: 0, hue: 20 },
    { l: -10, w: 14, h: 38, d: 0.12, hue: 30 },
    { l: 4, w: 16, h: 46, d: 0.05, hue: 15 },
    { l: 18, w: 13, h: 34, d: 0.18, hue: 40 },
    { l: 30, w: 10, h: 26, d: 0.09, hue: 25 },
  ];
  return (
    <div style={{ position: "relative", width: 160, height: 160, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{
        position: "absolute", inset: -28, borderRadius: "50%",
        background: state === "win"
          ? "radial-gradient(circle, rgba(251,146,60,0.7) 0%, rgba(249,115,22,0.4) 40%, transparent 70%)"
          : "radial-gradient(circle, rgba(251,146,60,0.25) 0%, transparent 70%)",
        animation: "auraGlow 0.5s ease-in-out infinite alternate",
        transition: "background 0.4s",
      }} />
      {state !== "lose" && flames.map((f, i) => (
        <div key={i} style={{
          position: "absolute", bottom: 8, left: `calc(50% + ${f.l}px)`,
          width: f.w, height: f.h, borderRadius: "50% 50% 30% 30%",
          background: `linear-gradient(to top, hsl(${f.hue},100%,50%), hsl(${f.hue + 20},100%,65%), transparent)`,
          animation: `firePart ${0.65 + i * 0.1}s ease-out ${f.d}s infinite`,
          opacity: 0.9,
        }} />
      ))}
      <div style={{
        fontSize: 110, lineHeight: 1, display: "inline-block", transformOrigin: "center bottom",
        animation: state === "idle" ? "tigerHover 2.4s ease-in-out infinite" : state === "win" ? "tigerWin 0.65s cubic-bezier(.36,.07,.19,.97) forwards" : "loseFade .55s ease-out forwards",
        filter: state === "win" ? "drop-shadow(0 0 28px rgba(251,146,60,1)) drop-shadow(0 0 60px rgba(249,115,22,0.6))" : state === "lose" ? "grayscale(1) brightness(0.4)" : "drop-shadow(0 0 18px rgba(251,146,60,0.6))",
        cursor: "default", userSelect: "none",
      }}>🐯</div>
      {state === "win" && (
        <div style={{
          position: "absolute", top: "35%", left: "50%",
          fontSize: 22, fontWeight: 900, color: "#fb923c",
          animation: "roarText .5s cubic-bezier(.36,.07,.19,.97) forwards",
          whiteSpace: "nowrap", textShadow: "0 0 30px rgba(249,115,22,1)", pointerEvents: "none", zIndex: 10,
          fontFamily: "Georgia,serif", letterSpacing: 5,
        }}>ROAR!</div>
      )}
    </div>
  );
}

// ─── Playing Card ─────────────────────────────────────────────────────
function PlayingCard({ card, flipped, glow }: { card: CardData | null; flipped: boolean; glow?: "win" | "lose" | null }) {
  const isRed = card && (card.suit === "♥" || card.suit === "♦");
  return (
    <div style={{ width: 90, height: 130, perspective: 700, flexShrink: 0 }}>
      <div style={{
        width: "100%", height: "100%", position: "relative", transformStyle: "preserve-3d",
        transition: "transform .8s cubic-bezier(.4,0,.2,1)", transform: flipped ? "rotateY(180deg)" : "rotateY(0)",
        borderRadius: 10,
        boxShadow: glow === "win" ? "0 0 30px 8px #22c55e, 0 0 70px 20px rgba(34,197,94,.35)" : glow === "lose" ? "0 0 10px rgba(239,68,68,.25)" : "0 4px 20px rgba(0,0,0,.6)",
      }}>
        {/* Back */}
        <div style={{
          position: "absolute", inset: 0, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
          borderRadius: 10, border: "2px solid rgba(255,255,255,.2)",
          background: "linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#1e1b4b 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{ width: 60, height: 88, borderRadius: 6, border: "1.5px solid rgba(255,255,255,.12)", background: "repeating-linear-gradient(45deg,rgba(255,255,255,.04) 0px,rgba(255,255,255,.04) 2px,transparent 2px,transparent 8px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 22, opacity: .35 }}>🂠</span>
          </div>
        </div>
        {/* Front */}
        <div style={{
          position: "absolute", inset: 0, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
          transform: "rotateY(180deg)", borderRadius: 10, background: "white",
          border: "2px solid #e5e7eb", color: isRed ? "#dc2626" : "#111827",
          display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column",
          fontFamily: "Georgia,serif", fontWeight: "bold", overflow: "hidden",
        }}>
          {card && (
            <>
              <div style={{ position: "absolute", top: 6, left: 8, lineHeight: 1.1 }}>
                <div style={{ fontSize: 16, fontWeight: 900 }}>{card.rank}</div>
                <div style={{ fontSize: 14 }}>{card.suit}</div>
              </div>
              <div style={{ fontSize: 42, lineHeight: 1 }}>{card.suit}</div>
              <div style={{ position: "absolute", bottom: 6, right: 8, lineHeight: 1.1, transform: "rotate(180deg)" }}>
                <div style={{ fontSize: 16, fontWeight: 900 }}>{card.rank}</div>
                <div style={{ fontSize: 14 }}>{card.suit}</div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Road (History) ───────────────────────────────────────────────────
function Road({ history }: { history: Selection[] }) {
  return (
    <div style={{ display: "flex", gap: 5, justifyContent: "center", flexWrap: "wrap", marginBottom: 12, minHeight: 28 }}>
      {history.slice(-20).map((r, i) => (
        <div key={i} style={{
          width: 24, height: 24, borderRadius: "50%",
          background: r === "dragon" ? "linear-gradient(135deg,#3b82f6,#1d4ed8)" : r === "tiger" ? "linear-gradient(135deg,#f97316,#c2410c)" : "linear-gradient(135deg,#10b981,#047857)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 10, fontWeight: 900, color: "white",
          border: "1.5px solid rgba(255,255,255,.3)",
          boxShadow: "0 2px 8px rgba(0,0,0,.4)",
          animation: "roadEntry .35s cubic-bezier(.36,.07,.19,.97) backwards",
          animationDelay: `${Math.min(i * 0.03, 0.3)}s`,
        }}>
          {r === "dragon" ? "D" : r === "tiger" ? "T" : "T"}
        </div>
      ))}
      {history.length === 0 && <span style={{ color: "rgba(255,255,255,.25)", fontSize: 12 }}>Round history will appear here</span>}
    </div>
  );
}

// ─── Countdown ────────────────────────────────────────────────────────
function Countdown({ seconds }: { seconds: number }) {
  const pct = seconds / 10;
  const r = 24; const circ = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: 60, height: 60, flexShrink: 0 }}>
      <svg width={60} height={60} style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
        <circle cx={30} cy={30} r={r} stroke="rgba(255,255,255,.1)" strokeWidth={4} fill="none" />
        <circle cx={30} cy={30} r={r} stroke={seconds <= 3 ? "#ef4444" : "#22c55e"} strokeWidth={4} fill="none"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} style={{ transition: "stroke-dashoffset .9s linear, stroke .3s" }} />
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 20, fontWeight: 900, color: seconds <= 3 ? "#ef4444" : "white",
        fontFamily: "Georgia,serif",
        animation: seconds <= 3 ? "countdownPulse .5s ease-in-out infinite" : undefined,
      }}>{seconds}</div>
    </div>
  );
}

// ─── Main Game ────────────────────────────────────────────────────────
export default function DragonTigerGame() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState<Phase>("betting");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [stake, setStake] = useState(0);
  const [customStake, setCustomStake] = useState("");
  const [dragonCard, setDragonCard] = useState<CardData | null>(null);
  const [tigerCard, setTigerCard] = useState<CardData | null>(null);
  const [dragonFlipped, setDragonFlipped] = useState(false);
  const [tigerFlipped, setTigerFlipped] = useState(false);
  const [result, setResult] = useState<{ result: Selection; won: boolean; winAmount: number; netChange: number; newBalance: number } | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [showWinNum, setShowWinNum] = useState(false);
  const [showCoins, setShowCoins] = useState(false);
  const [history, setHistory] = useState<Selection[]>([]);
  const [countdown, setCountdown] = useState(10);
  const [isDealing, setIsDealing] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const addTimer = (fn: () => void, delay: number) => { const t = setTimeout(fn, delay); timers.current.push(t); return t; };
  useEffect(() => () => { clearTimers(); if (countdownRef.current) clearInterval(countdownRef.current); }, []);

  // Countdown timer
  const startCountdown = useCallback(() => {
    setCountdown(10);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { return 10; }
        return c - 1;
      });
    }, 1000);
  }, []);
  useEffect(() => { if (phase === "betting") startCountdown(); }, [phase]);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopPolling = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  useEffect(() => () => stopPolling(), []);

  const handleDeal = async () => {
    if (!selection || stake <= 0) { toast({ title: "Pick a side and enter a stake", variant: "destructive" }); return; }
    if (!isAuthenticated) { setLocation("/login"); return; }
    if (countdownRef.current) clearInterval(countdownRef.current);
    clearTimers(); stopPolling();
    setIsDealing(true); setPhase("dealing");
    setDragonFlipped(false); setTigerFlipped(false);
    setShowResult(false); setShowWinNum(false); setShowCoins(false);
    setDragonCard(null); setTigerCard(null); setResult(null);
    const mySelection = selection;
    const myStake = stake;
    try {
      const resp = await fetch("/api/games/dragon-tiger", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ stake: myStake, selection: mySelection }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        if (resp.status === 401) queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        toast({ title: resp.status === 401 ? "Session Expired" : "Bet Failed", description: err.error || "Try again.", variant: "destructive" });
        setPhase("betting"); setIsDealing(false); return;
      }
      const placed = await resp.json();
      // Stake was deducted server-side; refresh balance.
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetBalanceQueryKey() });
      toast({ title: "Bet placed", description: "⚡ Auto-Decider is running..." });

      // Poll the round until it's settled by the admin.
      const roundId = placed.roundId as string;
      const startedAt = Date.now();
      pollRef.current = setInterval(async () => {
        if (Date.now() - startedAt > 10 * 60 * 1000) { stopPolling(); return; } // give up after 10min
        try {
          const r = await fetch(`/api/games/casino-round/dragon-tiger/${encodeURIComponent(roundId)}`, { credentials: "include" });
          if (!r.ok) return;
          const data = await r.json();
          if (data.status !== "settled") return;
          stopPolling();
          const settledResult: Selection = data.result;
          const dCard = data.details?.dragonCard ?? null;
          const tCard = data.details?.tigerCard ?? null;
          const won = settledResult === mySelection;
          const winAmount = won ? (mySelection === "tie" ? myStake * 9 : myStake * 2) : 0;
          const netChange = winAmount - myStake;
          setDragonCard(dCard); setTigerCard(tCard);
          setResult({ result: settledResult, won, winAmount, netChange, newBalance: 0 });
          addTimer(() => { setDragonFlipped(true); playCardFlip(); }, 200);
          addTimer(() => { setTigerFlipped(true); playCardFlip(); }, 1100);
          addTimer(() => {
            setShowResult(true); setIsDealing(false);
            setHistory(h => [...h, settledResult]);
            queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetBalanceQueryKey() });
            if (won) {
              if (settledResult === "dragon") playDragonRoar(); else if (settledResult === "tiger") playTigerRoar();
              playWin();
              setTimeout(() => { setShowWinNum(true); setShowCoins(true); }, 200);
              setTimeout(() => setShowCoins(false), 3500);
            } else { playLose(); }
            setPhase("result");
          }, 2100);
        } catch { /* keep polling */ }
      }, 500);
    } catch {
      toast({ title: "Network Error", variant: "destructive" });
      setPhase("betting"); setIsDealing(false);
    }
  };

  const handlePlayAgain = () => {
    clearTimers();
    setPhase("betting"); setSelection(null); setStake(0); setCustomStake("");
    setDragonCard(null); setTigerCard(null); setDragonFlipped(false); setTigerFlipped(false);
    setResult(null); setShowResult(false); setShowWinNum(false); setShowCoins(false); setIsDealing(false);
  };

  const dragonState: "idle" | "win" | "lose" = showResult && result
    ? result.result === "dragon" ? "win" : result.result === "tie" ? "idle" : "lose" : "idle";
  const tigerState: "idle" | "win" | "lose" = showResult && result
    ? result.result === "tiger" ? "win" : result.result === "tie" ? "idle" : "lose" : "idle";
  const dragonGlow = showResult && result ? result.result === "dragon" ? "win" as const : result.result === "tie" ? null : "lose" as const : null;
  const tigerGlow = showResult && result ? result.result === "tiger" ? "win" as const : result.result === "tie" ? null : "lose" as const : null;
  const balance = user?.balance ?? 0;
  const canDeal = selection !== null && stake > 0 && stake <= balance && !isDealing;

  if (isLoading) return <div className="flex h-screen items-center justify-center" style={{ background: "#050510" }}><div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" /></div>;

  return (
    <div className="min-h-screen" style={{ background: "radial-gradient(ellipse at top, #0c0c2e 0%, #050510 60%, #0c0c2e 100%)" }}>
      <style>{STYLES}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,.08)", background: "rgba(0,0,0,.4)", backdropFilter: "blur(10px)" }}>
        <button onClick={() => setLocation("/")} style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,.5)", cursor: "pointer", background: "none", border: "none" }}>
          <ArrowLeft size={18} /><span style={{ fontSize: 13 }}>Back</span>
        </button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: 4, color: "white", fontFamily: "Georgia,serif" }}>🐲 DRAGON vs TIGER 🐯</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,.4)", letterSpacing: 2 }}>ONE CARD EACH · HIGHEST WINS</div>
        </div>
        <div style={{ textAlign: "right" }}>
          {isAuthenticated ? (
            <><div style={{ fontSize: 10, color: "rgba(255,255,255,.4)" }}>BALANCE</div><div style={{ fontWeight: 900, color: "#4ade80", fontFamily: "monospace", fontSize: 15 }}>{formatCurrency(result?.newBalance ?? balance)}</div></>
          ) : (
            <button onClick={() => setLocation("/login")} style={{ color: "#60a5fa", fontSize: 13, background: "none", border: "none", cursor: "pointer" }}>Login to Play</button>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "16px 12px" }}>
        {/* Road history */}
        <Road history={history} />

        {/* Main table */}
        <div style={{
          position: "relative", overflow: "hidden",
          background: "radial-gradient(ellipse at center, #063318 0%, #041f0e 60%, #030d07 100%)",
          border: "5px solid #6b4c0f",
          borderRadius: 24,
          boxShadow: "inset 0 0 100px rgba(0,0,0,.6), 0 0 60px rgba(0,0,0,.8), inset 0 2px 0 rgba(255,255,255,.08)",
          padding: "20px 12px 16px",
        }}>
          <CoinParticles active={showCoins} />

          {/* Payout labels */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, padding: "0 16px" }}>
            {[{ label: "DRAGON", pay: "1:1", color: "#60a5fa" }, { label: "TIE", pay: "8:1", color: "#fbbf24" }, { label: "TIGER", pay: "1:1", color: "#fb923c" }].map(x => (
              <div key={x.label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 3, color: x.color, fontFamily: "Georgia,serif" }}>{x.label}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,.4)" }}>Pays {x.pay}</div>
              </div>
            ))}
          </div>

          {/* Characters + cards */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, position: "relative" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <DragonChar state={dragonState} />
              <PlayingCard card={dragonCard} flipped={dragonFlipped} glow={dragonGlow} />
            </div>

            {/* Center VS + countdown + win amount */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, flex: 1 }}>
              {phase === "betting" && <Countdown seconds={countdown} />}
              {isDealing && !dragonFlipped && (
                <div style={{ fontSize: 30, animation: "auraGlow 0.4s ease-in-out infinite alternate" }}>🃏</div>
              )}
              {!isDealing && !showResult && (
                <div style={{ fontSize: 16, fontWeight: 900, color: "#fbbf24", fontFamily: "Georgia,serif", letterSpacing: 4 }}>VS</div>
              )}
              {showWinNum && result && result.won && (
                <div style={{
                  position: "absolute", top: "45%", left: "50%",
                  animation: "winNumPop .55s cubic-bezier(.36,.07,.19,.97) forwards",
                  zIndex: 20, textAlign: "center", whiteSpace: "nowrap", pointerEvents: "none",
                }}>
                  <div style={{ fontSize: 42, fontWeight: 900, color: "#fbbf24", textShadow: "0 0 30px #f59e0b, 0 0 60px rgba(245,158,11,.5)", fontFamily: "Georgia,serif", letterSpacing: 2 }}>
                    +{formatCurrency(result.winAmount)}
                  </div>
                  <div style={{ fontSize: 14, color: "#4ade80", letterSpacing: 3, marginTop: 4 }}>YOU WIN! 🎉</div>
                </div>
              )}
              {showResult && result && !result.won && (
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: "#f87171", letterSpacing: 2 }}>-{formatCurrency(stake)}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,.4)", marginTop: 2 }}>Try again</div>
                </div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <TigerChar state={tigerState} />
              <PlayingCard card={tigerCard} flipped={tigerFlipped} glow={tigerGlow} />
            </div>
          </div>

          {/* Result banner */}
          {showResult && result && (
            <div style={{
              marginTop: 14, borderRadius: 14, padding: "10px 16px", textAlign: "center",
              background: result.won ? "linear-gradient(135deg,rgba(34,197,94,.25),rgba(5,150,105,.15))" : "linear-gradient(135deg,rgba(239,68,68,.2),rgba(185,28,28,.1))",
              border: `1px solid ${result.won ? "rgba(34,197,94,.5)" : "rgba(239,68,68,.35)"}`,
            }}>
              <span style={{ fontSize: 20, fontWeight: 900, letterSpacing: 4, fontFamily: "Georgia,serif", color: result.won ? "#4ade80" : "#fca5a5" }}>
                {result.result === "dragon" ? "🐲 DRAGON WINS!" : result.result === "tiger" ? "🐯 TIGER WINS!" : "🤝 TIE!"}
              </span>
            </div>
          )}
        </div>

        {/* Betting controls */}
        <div style={{ marginTop: 14, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 18, padding: 18 }}>
          {phase === "result" ? (
            <button onClick={handlePlayAgain} style={{
              width: "100%", padding: "14px 0", borderRadius: 12, background: "linear-gradient(135deg,#7c3aed,#4f46e5)",
              color: "white", fontWeight: 900, fontSize: 16, border: "none", cursor: "pointer", letterSpacing: 2,
              boxShadow: "0 4px 20px rgba(124,58,237,.5)",
            }}>▶ PLAY AGAIN</button>
          ) : (
            <>
              {/* Side buttons */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
                {([
                  { id: "dragon", emoji: "🐲", label: "DRAGON", pay: "1:1", color: "#3b82f6" },
                  { id: "tie", emoji: "⚖️", label: "TIE", pay: "8:1", color: "#eab308" },
                  { id: "tiger", emoji: "🐯", label: "TIGER", pay: "1:1", color: "#f97316" },
                ] as { id: Selection; emoji: string; label: string; pay: string; color: string }[]).map(opt => (
                  <button key={opt.id} onClick={() => phase === "betting" && setSelection(opt.id)} disabled={phase !== "betting"}
                    style={{
                      padding: "12px 6px", borderRadius: 12, textAlign: "center",
                      border: `2px solid ${selection === opt.id ? opt.color : "rgba(255,255,255,.1)"}`,
                      background: selection === opt.id ? `linear-gradient(135deg,${opt.color}40,${opt.color}20)` : "rgba(255,255,255,.04)",
                      color: selection === opt.id ? "white" : "rgba(255,255,255,.45)",
                      cursor: phase === "betting" ? "pointer" : "not-allowed", transition: "all .2s",
                      boxShadow: selection === opt.id ? `0 0 20px ${opt.color}60` : "none",
                    }}>
                    <div style={{ fontSize: 22 }}>{opt.emoji}</div>
                    <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 2, marginTop: 2 }}>{opt.label}</div>
                    <div style={{ fontSize: 10, opacity: .6 }}>{opt.pay}</div>
                  </button>
                ))}
              </div>

              {/* Chip buttons */}
              <div style={{ display: "flex", gap: 8, marginBottom: 12, overflowX: "auto" }}>
                {CHIP_AMOUNTS.map(amt => (
                  <button key={amt} onClick={() => phase === "betting" && setStake(amt)} disabled={phase !== "betting"}
                    style={{
                      flexShrink: 0, width: 56, height: 56, borderRadius: "50%",
                      border: `3px solid ${stake === amt ? "#a855f7" : "rgba(255,255,255,.2)"}`,
                      background: stake === amt
                        ? "radial-gradient(circle at 40% 40%, #c084fc, #7c3aed)"
                        : "radial-gradient(circle at 40% 40%, #374151, #1f2937)",
                      color: stake === amt ? "white" : "rgba(255,255,255,.55)",
                      fontWeight: 900, fontSize: 12, cursor: phase === "betting" ? "pointer" : "not-allowed",
                      boxShadow: stake === amt ? "0 0 20px rgba(168,85,247,.6), inset 0 2px 0 rgba(255,255,255,.2)" : "inset 0 2px 0 rgba(255,255,255,.08)",
                      transition: "all .2s",
                    }}>
                    {amt >= 1000 ? `${amt / 1000}K` : amt}
                  </button>
                ))}
              </div>

              {/* Custom + preview */}
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <input type="number" min="0" placeholder="Custom stake..." value={customStake} disabled={phase !== "betting"}
                  onChange={e => { setCustomStake(e.target.value); const p = parseFloat(e.target.value); setStake(isNaN(p) ? 0 : p); }}
                  style={{ flex: 1, padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.15)", color: "white", fontSize: 14, outline: "none" }} />
                {stake > 0 && selection && (
                  <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(251,191,36,.12)", border: "1px solid rgba(251,191,36,.3)", color: "#fbbf24", fontSize: 13, fontWeight: 900, display: "flex", alignItems: "center", whiteSpace: "nowrap" }}>
                    WIN: {formatCurrency(stake * (selection === "tie" ? 9 : 2))}
                  </div>
                )}
              </div>

              {/* Deal button */}
              {!isAuthenticated ? (
                <button onClick={() => setLocation("/login")} style={{ width: "100%", padding: 14, borderRadius: 12, background: "linear-gradient(135deg,#7c3aed,#4f46e5)", color: "white", fontWeight: 900, fontSize: 16, border: "none", cursor: "pointer" }}>LOG IN TO PLAY</button>
              ) : (
                <>
                  <button onClick={handleDeal} disabled={!canDeal} style={{
                    width: "100%", padding: 14, borderRadius: 12, fontWeight: 900, fontSize: 17, letterSpacing: 3,
                    background: canDeal ? "linear-gradient(135deg,#dc2626,#991b1b,#7f1d1d)" : "rgba(255,255,255,.07)",
                    color: canDeal ? "white" : "rgba(255,255,255,.25)",
                    border: `2px solid ${canDeal ? "rgba(220,38,38,.7)" : "rgba(255,255,255,.08)"}`,
                    cursor: canDeal ? "pointer" : "not-allowed",
                    boxShadow: canDeal ? "0 4px 24px rgba(220,38,38,.5)" : "none", transition: "all .2s",
                  }}>
                    {isDealing ? "🃏 DEALING CARDS..." : !selection ? "← PICK A SIDE" : stake <= 0 ? "ENTER STAKE" : "🎴 DEAL CARDS"}
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
