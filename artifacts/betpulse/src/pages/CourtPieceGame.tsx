import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey, getGetBalanceQueryKey } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";

type Side = "player" | "house";
type Phase = "betting" | "dealing" | "result";
const CHIPS = [100, 500, 1000, 5000, 10000];
const SUIT_FACE_COLOR: Record<string, string> = { "♥": "#dc2626", "♦": "#dc2626", "♠": "#1e293b", "♣": "#166534" };
const COURT = ["J", "Q", "K", "A"];
const COURT_LABEL: Record<string, string> = { J: "JACK", Q: "QUEEN", K: "KING", A: "ACE" };
const FAN = [-14, -7, 0, 7, 14];

const CSS = `
@keyframes cp3DFlip {
  0%   { transform: rotateY(180deg) rotateX(15deg) scale(.75); opacity:0; }
  55%  { transform: rotateY(15deg) rotateX(-5deg) scale(1.07); opacity:1; }
  80%  { transform: rotateY(-5deg) rotateX(2deg) scale(.98); }
  100% { transform: rotateY(0deg) rotateX(0deg) scale(1); opacity:1; }
}
@keyframes courtGlow {
  0%,100% { box-shadow: 0 0 22px rgba(251,191,36,.7), 0 6px 18px rgba(0,0,0,.5); }
  50%      { box-shadow: 0 0 55px rgba(251,191,36,1), 0 0 80px rgba(245,158,11,.5), 0 6px 18px rgba(0,0,0,.5); }
}
@keyframes cpWinPop {
  0%  { transform: scale(0) rotate(-14deg); opacity:0; }
  55% { transform: scale(1.32) rotate(3deg); opacity:1; }
  80% { transform: scale(.96) rotate(-1deg); }
  100%{ transform: scale(1) rotate(0); opacity:1; }
}
@keyframes cpResultIn {
  0%  { transform: translateY(20px) scale(.82); opacity:0; }
  60% { transform: translateY(-4px) scale(1.06); opacity:1; }
  100%{ transform: translateY(0) scale(1); opacity:1; }
}
@keyframes roadIn  { 0%{transform:scale(0);opacity:0} 100%{transform:scale(1);opacity:1} }
@keyframes cntPulse{ 0%,100%{transform:scale(1)} 50%{transform:scale(1.15)} }
@keyframes pulse85 { 0%,100%{opacity:.85} 50%{opacity:1} }
@keyframes courtBadge {
  0%   { transform: scale(0) rotate(-20deg) translateY(10px); opacity:0; }
  60%  { transform: scale(1.25) rotate(3deg) translateY(-3px); opacity:1; }
  100% { transform: scale(1) rotate(0) translateY(0); opacity:1; }
}
`;

function mkAudio() { return new ((window as any).AudioContext || (window as any).webkitAudioContext)(); }
function playFlip() {
  try {
    const c = mkAudio(); const b = c.createBuffer(1, c.sampleRate * .04, c.sampleRate);
    const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) * .5;
    const s = c.createBufferSource(), g = c.createGain(); s.buffer = b; s.connect(g); g.connect(c.destination);
    g.gain.setValueAtTime(.3, c.currentTime); g.gain.exponentialRampToValueAtTime(.001, c.currentTime + .04); s.start(); setTimeout(() => c.close(), 500);
  } catch (_) {}
}
function playCourt() {
  try {
    const c = mkAudio(); [880, 1100].forEach((f, i) => {
      const o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.type = "sine"; o.frequency.value = f;
      const t = c.currentTime + i * .08; g.gain.setValueAtTime(.2, t); g.gain.exponentialRampToValueAtTime(.001, t + .3); o.start(t); o.stop(t + .3);
    }); setTimeout(() => c.close(), 1000);
  } catch (_) {}
}
function playWin() {
  try {
    const c = mkAudio(); [523, 659, 784, 1047, 1319].forEach((f, i) => {
      const o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.type = "triangle"; o.frequency.value = f;
      const t = c.currentTime + i * .13; g.gain.setValueAtTime(.25, t); g.gain.exponentialRampToValueAtTime(.001, t + .45); o.start(t); o.stop(t + .45);
    }); setTimeout(() => c.close(), 2500);
  } catch (_) {}
}
function playLose() {
  try {
    const c = mkAudio(); [350, 295, 240].forEach((f, i) => {
      const o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.type = "sawtooth"; o.frequency.value = f;
      const t = c.currentTime + i * .22; g.gain.setValueAtTime(.12, t); g.gain.exponentialRampToValueAtTime(.001, t + .25); o.start(t); o.stop(t + .25);
    }); setTimeout(() => c.close(), 2000);
  } catch (_) {}
}

function Confetti({ active }: { active: boolean }) {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const pts = useRef<any[]>([]);
  useEffect(() => {
    if (!active) { pts.current = []; return; }
    const cv = cvRef.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    cv.width = cv.offsetWidth; cv.height = cv.offsetHeight;
    const COLS = ["#fbbf24", "#f59e0b", "#a855f7", "#fff", "#22c55e", "#f472b6", "#38bdf8"];
    pts.current = Array.from({ length: 90 }, (_, i) => ({
      x: Math.random() * cv.width, y: -20, vx: (Math.random() - .5) * 7, vy: Math.random() * 4 + 2,
      r: Math.random() * 9 + 3, color: COLS[i % COLS.length], life: 0, maxLife: 90 + Math.random() * 70,
      rot: 0, vrot: (Math.random() - .5) * .5,
    }));
    const loop = () => {
      ctx.clearRect(0, 0, cv.width, cv.height);
      pts.current = pts.current.filter(p => p.life < p.maxLife);
      pts.current.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.vy += .14; p.rot += p.vrot; p.life++;
        ctx.save(); ctx.globalAlpha = Math.max(0, 1 - p.life / p.maxLife);
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.color; ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * .45, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      });
      if (pts.current.length) rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active]);
  return <canvas ref={cvRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 50 }} />;
}

function Card3D({ card, revealed, delay = 0, fanIdx = 2, glowOnReveal = false }: {
  card: { rank: string; suit: string }; revealed: boolean; delay?: number; fanIdx?: number; glowOnReveal?: boolean;
}) {
  const col = SUIT_FACE_COLOR[card.suit] || "#1e293b";
  const isCourt = COURT.includes(card.rank);
  const rot = FAN[fanIdx] ?? 0;
  const glowing = glowOnReveal && isCourt && revealed;

  return (
    <div style={{
      width: 60, height: 86, perspective: 700, flexShrink: 0,
      transform: `rotate(${rot}deg) translateY(${Math.abs(rot) * .5}px)`,
      transformOrigin: "bottom center",
      zIndex: fanIdx === 2 ? 5 : Math.abs(2 - fanIdx) === 1 ? 3 : 1,
    }}>
      <div style={{
        width: "100%", height: "100%", position: "relative",
        transformStyle: "preserve-3d",
        transition: `transform 0.52s cubic-bezier(.36,.07,.19,.97) ${delay}s`,
        transform: revealed ? "rotateY(0deg)" : "rotateY(180deg)",
      }}>
        {/* Front */}
        <div style={{
          position: "absolute", inset: 0, borderRadius: 8,
          backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
          background: isCourt ? "linear-gradient(145deg,#fffbeb,#fef3c7)" : "linear-gradient(145deg,#ffffff,#f4f0e8)",
          border: `2px solid ${isCourt ? "#d97706" : "rgba(0,0,0,.15)"}`,
          boxShadow: glowing ? "0 0 26px rgba(251,191,36,.85), 0 6px 18px rgba(0,0,0,.5)"
            : isCourt ? "0 0 12px rgba(217,119,6,.4), 0 4px 14px rgba(0,0,0,.5)"
            : "0 4px 14px rgba(0,0,0,.55)",
          animation: glowing ? "courtGlow 1.1s ease-in-out infinite" : undefined,
          overflow: "hidden",
        }}>
          {/* Top-left corner */}
          <div style={{ position: "absolute", top: 3, left: 4, lineHeight: 1.05 }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: col, fontFamily: "Georgia,serif" }}>{card.rank}</div>
            <div style={{ fontSize: 11, color: col }}>{card.suit}</div>
          </div>
          {/* Center pip */}
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontSize: isCourt ? 22 : 28, color: col, filter: "drop-shadow(0 1px 2px rgba(0,0,0,.15))" }}>{card.suit}</div>
          </div>
          {/* Court name */}
          {isCourt && (
            <div style={{ position: "absolute", bottom: 16, left: 0, right: 0, textAlign: "center", fontSize: 7, fontWeight: 900, color: "#b45309", letterSpacing: .5 }}>
              {COURT_LABEL[card.rank]}
            </div>
          )}
          {/* Bottom-right corner */}
          <div style={{ position: "absolute", bottom: 3, right: 4, lineHeight: 1.05, transform: "rotate(180deg)" }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: col, fontFamily: "Georgia,serif" }}>{card.rank}</div>
            <div style={{ fontSize: 11, color: col }}>{card.suit}</div>
          </div>
        </div>
        {/* Back */}
        <div style={{
          position: "absolute", inset: 0, borderRadius: 8,
          backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
          transform: "rotateY(180deg)",
          background: "linear-gradient(145deg,#1e3a6e,#152d57)",
          border: "2px solid rgba(255,255,255,.15)",
          boxShadow: "0 4px 14px rgba(0,0,0,.6)",
          overflow: "hidden",
        }}>
          <div style={{ position: "absolute", inset: 4, borderRadius: 5, background: "repeating-linear-gradient(45deg,#1a3460 0,#1a3460 4px,#142b50 4px,#142b50 8px)", border: "1px solid rgba(255,255,255,.1)" }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, opacity: .55 }}>👑</div>
        </div>
      </div>
    </div>
  );
}

function CourtScoreBar({ playerCourt, houseCourt, show }: { playerCourt: number; houseCourt: number; show: boolean }) {
  if (!show) return null;
  const pWin = playerCourt > houseCourt;
  const hWin = houseCourt > playerCourt;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderRadius: 14, background: "rgba(0,0,0,.35)", border: "1px solid rgba(255,255,255,.08)", animation: "courtBadge .55s cubic-bezier(.36,.07,.19,.97) both" }}>
      <div style={{ textAlign: "center", flex: 1 }}>
        <div style={{ fontSize: 28, fontWeight: 900, color: pWin ? "#fbbf24" : "rgba(255,255,255,.5)", fontFamily: "Georgia,serif", textShadow: pWin ? "0 0 20px rgba(251,191,36,.8)" : "none" }}>{playerCourt}</div>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,.4)", letterSpacing: 2 }}>YOUR COURTS</div>
      </div>
      <div style={{ fontSize: 26 }}>👑</div>
      <div style={{ textAlign: "center", flex: 1 }}>
        <div style={{ fontSize: 28, fontWeight: 900, color: hWin ? "#fbbf24" : "rgba(255,255,255,.5)", fontFamily: "Georgia,serif", textShadow: hWin ? "0 0 20px rgba(251,191,36,.8)" : "none" }}>{houseCourt}</div>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,.4)", letterSpacing: 2 }}>HOUSE COURTS</div>
      </div>
    </div>
  );
}

function Road({ history }: { history: Side[] }) {
  return (
    <div style={{ display: "flex", gap: 5, justifyContent: "center", flexWrap: "wrap", marginBottom: 14, minHeight: 28 }}>
      {history.slice(-22).map((r, i) => (
        <div key={i} style={{
          width: 26, height: 26, borderRadius: "50%",
          background: r === "player" ? "linear-gradient(135deg,#22c55e,#14532d)" : "linear-gradient(135deg,#ef4444,#991b1b)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 10, fontWeight: 900, color: "white", border: "1.5px solid rgba(255,255,255,.3)",
          animation: "roadIn .3s ease-out backwards", animationDelay: `${Math.min(i * .03, .3)}s`,
        }}>{r === "player" ? "P" : "H"}</div>
      ))}
      {!history.length && <span style={{ color: "rgba(255,255,255,.22)", fontSize: 12, fontStyle: "italic" }}>Round history appears here</span>}
    </div>
  );
}

function Countdown({ s }: { s: number }) {
  const r = 22, circ = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: 54, height: 54 }}>
      <svg width={54} height={54} style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
        <circle cx={27} cy={27} r={r} stroke="rgba(255,255,255,.1)" strokeWidth={3.5} fill="none" />
        <circle cx={27} cy={27} r={r} stroke={s <= 3 ? "#ef4444" : "#22c55e"} strokeWidth={3.5} fill="none" strokeDasharray={circ} strokeDashoffset={circ * (1 - s / 30)} style={{ transition: "stroke-dashoffset .9s linear,stroke .3s" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 900, color: s <= 3 ? "#ef4444" : "white", animation: s <= 3 ? "cntPulse .5s ease-in-out infinite" : undefined }}>{s}</div>
    </div>
  );
}

const EMPTY: { rank: string; suit: string }[] = [{ rank: "A", suit: "♠" }, { rank: "K", suit: "♥" }, { rank: "Q", suit: "♦" }, { rank: "J", suit: "♣" }, { rank: "A", suit: "♣" }];

export default function CourtPieceGame() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [phase, setPhase]     = useState<Phase>("betting");
  const [selection, setSelection] = useState<Side | null>(null);
  const [stake, setStake]     = useState(0);
  const [customStake, setCustomStake] = useState("");
  const [result, setResult]   = useState<{ playerHand: any[]; houseHand: any[]; playerCourt: number; houseCourt: number; winner: Side; won: boolean; winAmount: number; newBalance: number } | null>(null);
  const [revP, setRevP]       = useState<boolean[]>([false, false, false, false, false]);
  const [revH, setRevH]       = useState<boolean[]>([false, false, false, false, false]);
  const [showCourtBar, setShowCourtBar] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showWinPop, setShowWinPop] = useState(false);
  const [history, setHistory] = useState<Side[]>([]);
  const [countdown, setCountdown] = useState(30);
  const cdRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTmr = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const addTmr = (fn: () => void, ms: number) => { const t = setTimeout(fn, ms); timers.current.push(t); };

  useEffect(() => {
    if (phase !== "betting") return;
    setCountdown(30);
    if (cdRef.current) clearInterval(cdRef.current);
    cdRef.current = setInterval(() => setCountdown(c => { if (c <= 1) return 30; return c - 1; }), 1000);
    return () => { if (cdRef.current) clearInterval(cdRef.current); };
  }, [phase]);
  useEffect(() => () => { clearTmr(); if (cdRef.current) clearInterval(cdRef.current); }, []);

  const handleDeal = async () => {
    if (!selection || stake <= 0) { toast({ title: "Pick a side and stake first", variant: "destructive" }); return; }
    if (!isAuthenticated) { setLocation("/login"); return; }
    if (cdRef.current) clearInterval(cdRef.current);
    clearTmr(); setPhase("dealing"); setResult(null); setShowConfetti(false); setShowWinPop(false); setShowCourtBar(false);
    setRevP([false, false, false, false, false]); setRevH([false, false, false, false, false]);

    try {
      const resp = await fetch("/api/games/court-piece", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ stake, selection }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        if (resp.status === 401) qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
        toast({ title: "Bet Failed", description: err.error || "Try again.", variant: "destructive" });
        setPhase("betting"); return;
      }
      const placed = await resp.json();
      const balanceAfterBet = placed.newBalance as number;
      const roundId = placed.roundId as string;
      const myStake = stake, mySel = selection;
      qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
      qc.invalidateQueries({ queryKey: getGetBalanceQueryKey() });

      const startedAt = Date.now();
      const pollId: ReturnType<typeof setInterval> = setInterval(async () => {
        if (Date.now() - startedAt > 10 * 60 * 1000) { clearInterval(pollId); return; }
        try {
          const r = await fetch(`/api/games/casino-round/court-piece/${encodeURIComponent(roundId)}`, { credentials: "include" });
          if (!r.ok) return;
          const dd = await r.json();
          if (dd.status !== "settled") return;
          clearInterval(pollId);
          const data = { ...dd.details, winner: dd.result };
          const won = data.winner === mySel;
          const winAmount = won ? Math.round(myStake * 1.95 * 100) / 100 : 0;
          const res = { playerHand: data.playerHand, houseHand: data.houseHand, playerCourt: data.playerCourt, houseCourt: data.houseCourt, winner: data.winner, won, winAmount, newBalance: balanceAfterBet + winAmount };
          setResult(res);

          for (let i = 0; i < 5; i++) {
            addTmr(() => {
              playFlip();
              if (COURT.includes(data.playerHand[i].rank)) addTmr(() => playCourt(), 150);
              setRevP(rv => { const n = [...rv]; n[i] = true; return n; });
            }, 350 + i * 320);
            addTmr(() => {
              playFlip();
              if (COURT.includes(data.houseHand[i].rank)) addTmr(() => playCourt(), 150);
              setRevH(rv => { const n = [...rv]; n[i] = true; return n; });
            }, 350 + i * 320 + 160);
          }
          addTmr(() => setShowCourtBar(true), 350 + 4 * 320 + 160 + 350);
          addTmr(() => {
            setPhase("result"); setHistory(h => [...h, data.winner]);
            qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
            qc.invalidateQueries({ queryKey: getGetBalanceQueryKey() });
            if (won) { playWin(); addTmr(() => { setShowWinPop(true); setShowConfetti(true); }, 250); addTmr(() => setShowConfetti(false), 3600); }
            else playLose();
          }, 350 + 4 * 320 + 160 + 700);
        } catch {}
      }, 500);
    } catch { toast({ title: "Network Error", variant: "destructive" }); setPhase("betting"); }
  };

  const handleAgain = () => {
    clearTmr(); setPhase("betting"); setSelection(null); setStake(0); setCustomStake(""); setResult(null);
    setShowConfetti(false); setShowWinPop(false); setShowCourtBar(false);
    setRevP([false, false, false, false, false]); setRevH([false, false, false, false, false]);
  };

  const balance = user?.balance ?? 0;
  const canDeal = !!selection && stake > 0 && stake <= balance && phase === "betting";
  const playerHand = result?.playerHand ?? EMPTY;
  const houseHand  = result?.houseHand ?? EMPTY;

  if (isLoading) return <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", background: "#050510" }}><div style={{ width: 48, height: 48, borderRadius: "50%", border: "4px solid #22c55e", borderTopColor: "transparent", animation: "spin .8s linear infinite" }} /></div>;

  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(ellipse at 50% 0%,#0a1f0a 0%,#050510 60%,#0d0d1a 100%)" }}>
      <style>{CSS}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", background: "rgba(0,0,0,.55)", backdropFilter: "blur(14px)", borderBottom: "1px solid rgba(255,255,255,.07)", position: "sticky", top: 0, zIndex: 30 }}>
        <button onClick={() => setLocation("/")} style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,.45)", background: "none", border: "none", cursor: "pointer", fontSize: 13 }}>
          <ArrowLeft size={17} /> Back
        </button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: 3, color: "white", fontFamily: "Georgia,serif" }}>👑 COURT PIECE</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,.35)", letterSpacing: 2 }}>MOST COURT CARDS WINS</div>
        </div>
        <div style={{ textAlign: "right" }}>
          {isAuthenticated
            ? <><div style={{ fontSize: 10, color: "rgba(255,255,255,.35)", letterSpacing: 1 }}>BALANCE</div>
               <div style={{ fontWeight: 900, color: "#4ade80", fontFamily: "monospace", fontSize: 14 }}>{formatCurrency(result?.newBalance ?? balance)}</div></>
            : <button onClick={() => setLocation("/login")} style={{ color: "#22c55e", fontSize: 13, background: "none", border: "none", cursor: "pointer" }}>Login</button>}
        </div>
      </div>

      <div style={{ maxWidth: 560, margin: "0 auto", padding: "14px 12px 28px" }}>
        <Road history={history} />

        {/* Rules */}
        <div style={{ background: "rgba(251,191,36,.08)", border: "1px solid rgba(251,191,36,.22)", borderRadius: 12, padding: "9px 16px", marginBottom: 14, fontSize: 12, color: "rgba(255,255,255,.6)", textAlign: "center" }}>
          👑 Court cards = <strong style={{ color: "#fbbf24" }}>J · Q · K · A</strong> &nbsp;·&nbsp; Most court cards in 5-card hand wins &nbsp;·&nbsp; Pays <strong style={{ color: "#4ade80" }}>1.95×</strong>
        </div>

        {/* Main arena */}
        <div style={{
          position: "relative", overflow: "hidden",
          background: "radial-gradient(ellipse at 50% 35%,#0d4a2b 0%,#063320 55%,#041a11 100%)",
          border: "4px solid rgba(34,197,94,.38)",
          borderRadius: 24, padding: "24px 14px 20px",
          boxShadow: "inset 0 0 80px rgba(0,0,0,.5),0 0 60px rgba(0,0,0,.9)",
          marginBottom: 14,
        }}>
          <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(90deg,transparent,transparent 40px,rgba(0,0,0,.04) 40px,rgba(0,0,0,.04) 41px)", pointerEvents: "none" }} />
          <Confetti active={showConfetti} />
          {phase === "betting" && <div style={{ position: "absolute", top: 14, right: 14 }}><Countdown s={countdown} /></div>}

          {/* Card table */}
          <div style={{ background: "rgba(0,0,0,.22)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 16, padding: "18px 10px" }}>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", alignItems: "flex-start" }}>
              {/* Player */}
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 2, color: "#4ade80", marginBottom: 12 }}>YOUR HAND</div>
                <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-end", height: 100, marginBottom: 8 }}>
                  {playerHand.map((card: any, i: number) => (
                    <Card3D key={i} card={card} revealed={phase === "betting" ? false : (revP[i] ?? false)} delay={i * .18} fanIdx={i} glowOnReveal={true} />
                  ))}
                </div>
                {revP.every(Boolean) && result && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <div style={{ fontSize: 11, color: "#fbbf24", fontWeight: 900 }}>
                      {result.playerCourt} Court Card{result.playerCourt !== 1 ? "s" : ""}
                    </div>
                    <div style={{ padding: "3px 12px", borderRadius: 8, fontSize: 12, fontWeight: 900, background: result.winner === "player" ? "rgba(34,197,94,.2)" : "rgba(255,255,255,.06)", border: `1px solid ${result.winner === "player" ? "#22c55e" : "rgba(255,255,255,.1)"}`, color: result.winner === "player" ? "#4ade80" : "rgba(255,255,255,.4)" }}>
                      {result.winner === "player" ? "🏆 WINS!" : "LOSES"}
                    </div>
                  </div>
                )}
              </div>

              {/* VS */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: 28, gap: 8, minWidth: 42 }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: "rgba(255,255,255,.18)", letterSpacing: 2 }}>VS</div>
                {showCourtBar && result && (
                  <div style={{ fontSize: 14, fontWeight: 900, color: "#fbbf24", animation: "cpWinPop .5s both" }}>
                    {result.playerCourt}–{result.houseCourt}
                  </div>
                )}
              </div>

              {/* House */}
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 2, color: "#f87171", marginBottom: 12 }}>HOUSE HAND</div>
                <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-end", height: 100, marginBottom: 8 }}>
                  {houseHand.map((card: any, i: number) => (
                    <Card3D key={i} card={card} revealed={phase === "betting" ? false : (revH[i] ?? false)} delay={i * .18} fanIdx={i} glowOnReveal={true} />
                  ))}
                </div>
                {revH.every(Boolean) && result && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <div style={{ fontSize: 11, color: "#fbbf24", fontWeight: 900 }}>
                      {result.houseCourt} Court Card{result.houseCourt !== 1 ? "s" : ""}
                    </div>
                    <div style={{ padding: "3px 12px", borderRadius: 8, fontSize: 12, fontWeight: 900, background: result.winner === "house" ? "rgba(239,68,68,.18)" : "rgba(255,255,255,.06)", border: `1px solid ${result.winner === "house" ? "#ef4444" : "rgba(255,255,255,.1)"}`, color: result.winner === "house" ? "#f87171" : "rgba(255,255,255,.4)" }}>
                      {result.winner === "house" ? "🏆 WINS!" : "LOSES"}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Court score bar */}
          {showCourtBar && result && (
            <div style={{ marginTop: 16 }}>
              <CourtScoreBar playerCourt={result.playerCourt} houseCourt={result.houseCourt} show={showCourtBar} />
            </div>
          )}

          {/* Win pop */}
          {showWinPop && result?.won && (
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", textAlign: "center", zIndex: 20, animation: "cpWinPop .55s cubic-bezier(.36,.07,.19,.97) both" }}>
              <div style={{ fontSize: 38, fontWeight: 900, color: "#fbbf24", textShadow: "0 0 24px #f59e0b", fontFamily: "Georgia,serif" }}>+{formatCurrency(result.winAmount)}</div>
              <div style={{ fontSize: 14, color: "#4ade80", letterSpacing: 3 }}>YOU WIN 🎉</div>
            </div>
          )}

          {/* Status */}
          <div style={{ textAlign: "center", marginTop: 18, minHeight: 38 }}>
            {phase === "betting" && <p style={{ color: "rgba(255,255,255,.28)", fontSize: 13, letterSpacing: 2 }}>PICK YOUR SIDE AND DEAL</p>}
            {phase === "dealing" && <p style={{ color: "#4ade80", fontSize: 14, fontWeight: 900, letterSpacing: 4, animation: "pulse85 .6s ease-in-out infinite" }}>DEALING CARDS...</p>}
            {phase === "result" && result && !showWinPop && (
              <div style={{ animation: "cpResultIn .5s cubic-bezier(.22,1,.36,1) both" }}>
                <div style={{ display: "inline-block", padding: "8px 20px", borderRadius: 12, background: result.won ? "rgba(34,197,94,.15)" : "rgba(239,68,68,.12)", border: `1px solid ${result.won ? "rgba(34,197,94,.4)" : "rgba(239,68,68,.3)"}` }}>
                  <span style={{ fontWeight: 900, fontSize: 15, color: result.won ? "#4ade80" : "#f87171", letterSpacing: 2 }}>
                    {result.won ? `YOU WIN! +${formatCurrency(result.winAmount)}` : `HOUSE WINS · −${formatCurrency(stake)}`}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.09)", borderRadius: 20, padding: 18 }}>
          {phase === "result" ? (
            <button onClick={handleAgain} style={{ width: "100%", padding: 15, borderRadius: 14, background: "linear-gradient(135deg,#7c3aed,#4f46e5)", color: "white", fontWeight: 900, fontSize: 16, border: "none", cursor: "pointer", letterSpacing: 3, boxShadow: "0 4px 20px rgba(124,58,237,.5)" }}>
              👑 DEAL AGAIN
            </button>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                {([
                  { id: "player" as Side, emoji: "🤲", label: "MY HAND WINS", sub: "Your cards get more J/Q/K/A", color: "#22c55e" },
                  { id: "house"  as Side, emoji: "🏠", label: "HOUSE WINS", sub: "House cards get more J/Q/K/A", color: "#ef4444" },
                ]).map(opt => (
                  <button key={opt.id} onClick={() => phase === "betting" && setSelection(opt.id)} disabled={phase !== "betting"}
                    style={{
                      padding: "15px 8px", borderRadius: 13, textAlign: "center",
                      border: `2px solid ${selection === opt.id ? opt.color : "rgba(255,255,255,.09)"}`,
                      background: selection === opt.id ? `${opt.color}25` : "rgba(255,255,255,.04)",
                      color: selection === opt.id ? "white" : "rgba(255,255,255,.38)",
                      fontWeight: 900, cursor: phase === "betting" ? "pointer" : "not-allowed",
                      boxShadow: selection === opt.id ? `0 0 22px ${opt.color}44` : "none",
                      transition: "all .2s",
                    }}>
                    <div style={{ fontSize: 26 }}>{opt.emoji}</div>
                    <div style={{ fontSize: 13, letterSpacing: 1, marginTop: 5 }}>{opt.label}</div>
                    <div style={{ fontSize: 10, opacity: .55, marginTop: 2 }}>{opt.sub}</div>
                    <div style={{ fontSize: 11, color: "#4ade80", fontWeight: 900, marginTop: 4 }}>1.95×</div>
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12, overflowX: "auto", paddingBottom: 2 }}>
                {CHIPS.map(amt => (
                  <button key={amt} onClick={() => phase === "betting" && setStake(amt)} disabled={phase !== "betting"}
                    style={{
                      flexShrink: 0, width: 54, height: 54, borderRadius: "50%",
                      border: `3px solid ${stake === amt ? "#22c55e" : "rgba(255,255,255,.18)"}`,
                      background: stake === amt ? "radial-gradient(circle at 38% 35%,#4ade80,#22c55e,#15803d)" : "radial-gradient(circle at 38% 35%,#374151,#1f2937)",
                      color: stake === amt ? "#052e16" : "rgba(255,255,255,.45)", fontWeight: 900, fontSize: 12,
                      cursor: phase === "betting" ? "pointer" : "not-allowed",
                      boxShadow: stake === amt ? "0 0 18px rgba(34,197,94,.6),inset 0 2px 0 rgba(255,255,255,.4)" : "inset 0 2px 0 rgba(255,255,255,.06)",
                      transition: "all .2s",
                    }}>{amt >= 1000 ? `${amt / 1000}K` : amt}</button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <input type="number" min="0" placeholder="Custom stake..." value={customStake} disabled={phase !== "betting"}
                  onChange={e => { setCustomStake(e.target.value); const p = parseFloat(e.target.value); setStake(isNaN(p) ? 0 : p); }}
                  style={{ flex: 1, padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", color: "white", fontSize: 14, outline: "none" }} />
                {stake > 0 && selection && (
                  <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(251,191,36,.1)", border: "1px solid rgba(251,191,36,.28)", color: "#fbbf24", fontSize: 13, fontWeight: 900, display: "flex", alignItems: "center", whiteSpace: "nowrap" }}>
                    WIN: {formatCurrency(Math.round(stake * 1.95))}
                  </div>
                )}
              </div>
              {!isAuthenticated
                ? <button onClick={() => setLocation("/login")} style={{ width: "100%", padding: 14, borderRadius: 12, background: "linear-gradient(135deg,#22c55e,#16a34a)", color: "white", fontWeight: 900, fontSize: 16, border: "none", cursor: "pointer" }}>LOG IN TO PLAY</button>
                : <>
                  <button onClick={handleDeal} disabled={!canDeal} style={{
                    width: "100%", padding: 15, borderRadius: 13, fontWeight: 900, fontSize: 17, letterSpacing: 3,
                    background: canDeal ? "linear-gradient(135deg,#22c55e,#16a34a)" : "rgba(255,255,255,.06)",
                    color: canDeal ? "white" : "rgba(255,255,255,.22)",
                    border: `2px solid ${canDeal ? "rgba(34,197,94,.6)" : "rgba(255,255,255,.06)"}`,
                    cursor: canDeal ? "pointer" : "not-allowed",
                    boxShadow: canDeal ? "0 4px 28px rgba(34,197,94,.45)" : "none", transition: "all .2s",
                  }}>
                    {phase === "dealing" ? "👑 DEALING..." : !selection ? "PICK A SIDE" : stake <= 0 ? "ENTER STAKE" : "👑 DEAL CARDS"}
                  </button>
                  {stake > balance && <p style={{ color: "#f87171", fontSize: 12, textAlign: "center", marginTop: 8 }}>Insufficient balance — max: {formatCurrency(balance)}</p>}
                </>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
