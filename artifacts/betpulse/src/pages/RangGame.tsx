import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey, getGetBalanceQueryKey } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";

type CardObj = { rank: string; suit: string; value: number; isTrump: boolean };
type TrickResult = { playerCard: CardObj; houseCard: CardObj; winner: "player" | "house" | "draw" };
type Side = "player" | "house";
type Phase = "betting" | "dealing" | "tricks" | "result";
const CHIPS = [100, 500, 1000, 5000, 10000];

const SUIT_META: Record<string, { color: string; glow: string; label: string }> = {
  "♠": { color: "#93c5fd", glow: "rgba(147,197,253,.8)", label: "Spades" },
  "♥": { color: "#f87171", glow: "rgba(248,113,113,.8)", label: "Hearts" },
  "♦": { color: "#fb923c", glow: "rgba(251,146,60,.8)", label: "Diamonds" },
  "♣": { color: "#4ade80", glow: "rgba(74,222,128,.8)", label: "Clubs" },
};
const SUIT_FACE_COLOR: Record<string, string> = {
  "♥": "#dc2626", "♦": "#dc2626", "♠": "#1e293b", "♣": "#166534",
};
const FAN = [-14, -7, 0, 7, 14];
const COURT = ["J", "Q", "K", "A"];

const CSS = `
@keyframes rng3DFlip {
  0%   { transform: rotateY(180deg) rotateX(15deg) scale(.75); opacity:0; }
  55%  { transform: rotateY(15deg) rotateX(-5deg) scale(1.07); opacity:1; }
  80%  { transform: rotateY(-5deg) rotateX(2deg) scale(.98); }
  100% { transform: rotateY(0deg) rotateX(0deg) scale(1); opacity:1; }
}
@keyframes trumpReveal {
  0%   { transform: scale(0) rotate(-25deg) translateY(30px); opacity:0; }
  55%  { transform: scale(1.22) rotate(4deg) translateY(-5px); opacity:1; }
  80%  { transform: scale(.97) rotate(-2deg); }
  100% { transform: scale(1) rotate(0); opacity:1; }
}
@keyframes trumpGlow {
  0%,100% { box-shadow: 0 0 22px var(--glow-clr), inset 0 0 10px var(--glow-clr); }
  50%      { box-shadow: 0 0 60px var(--glow-clr), 0 0 90px var(--glow-clr), inset 0 0 22px var(--glow-clr); }
}
@keyframes trickSlide {
  0%   { opacity:0; transform:translateX(-20px); }
  100% { opacity:1; transform:translateX(0); }
}
@keyframes trickWin {
  0%   { transform:scale(1); }
  40%  { transform:scale(1.28); }
  70%  { transform:scale(.96); }
  100% { transform:scale(1); }
}
@keyframes rngWinPop {
  0%  { transform:scale(0) rotate(-14deg); opacity:0; }
  55% { transform:scale(1.32) rotate(3deg); opacity:1; }
  80% { transform:scale(.96) rotate(-1deg); }
  100%{ transform:scale(1) rotate(0); opacity:1; }
}
@keyframes roadIn { 0%{transform:scale(0);opacity:0} 100%{transform:scale(1);opacity:1} }
@keyframes cntPulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.15)} }
@keyframes pulse85 { 0%,100%{opacity:.85} 50%{opacity:1} }
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
function playTrumpReveal() {
  try {
    const c = mkAudio(); [330, 415, 523, 659, 784].forEach((f, i) => {
      const o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.type = "triangle"; o.frequency.value = f;
      const t = c.currentTime + i * .12; g.gain.setValueAtTime(.22, t); g.gain.exponentialRampToValueAtTime(.001, t + .4); o.start(t); o.stop(t + .4);
    }); setTimeout(() => c.close(), 2500);
  } catch (_) {}
}
function playTrickWin() {
  try {
    const c = mkAudio(); [440, 554].forEach((f, i) => {
      const o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.type = "sine"; o.frequency.value = f;
      const t = c.currentTime + i * .08; g.gain.setValueAtTime(.14, t); g.gain.exponentialRampToValueAtTime(.001, t + .2); o.start(t); o.stop(t + .2);
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
    const COLS = ["#fbbf24", "#f59e0b", "#a78bfa", "#fff", "#4ade80", "#f472b6", "#38bdf8"];
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

function Card3D({ card, revealed, delay = 0, fanIdx = 2, trumpSuit = "" }: {
  card: CardObj; revealed: boolean; delay?: number; fanIdx?: number; trumpSuit?: string;
}) {
  const isTrump = card.isTrump || card.suit === trumpSuit;
  const faceCol = SUIT_FACE_COLOR[card.suit] || "#1e293b";
  const isCourt = COURT.includes(card.rank);
  const rot = FAN[fanIdx] ?? 0;
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
          background: isTrump ? "linear-gradient(145deg,#fffbeb,#fef3c7)" : "linear-gradient(145deg,#ffffff,#f4f0e8)",
          border: `2px solid ${isTrump ? "#f59e0b" : isCourt ? "#d97706" : "rgba(0,0,0,.15)"}`,
          boxShadow: isTrump
            ? "0 0 26px rgba(245,158,11,.7), 0 6px 18px rgba(0,0,0,.5)"
            : isCourt ? "0 0 12px rgba(217,119,6,.4), 0 4px 14px rgba(0,0,0,.5)"
            : "0 4px 14px rgba(0,0,0,.55)",
          ["--glow-clr" as any]: SUIT_META[card.suit]?.glow ?? "rgba(255,255,255,.5)",
          animation: isTrump ? "trumpGlow 1.2s ease-in-out infinite" : undefined,
          overflow: "hidden",
        }}>
          <div style={{ position: "absolute", top: 3, left: 4, lineHeight: 1.05 }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: faceCol, fontFamily: "Georgia,serif" }}>{card.rank}</div>
            <div style={{ fontSize: 11, color: faceCol }}>{card.suit}</div>
          </div>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontSize: isCourt ? 24 : 28, color: faceCol, filter: "drop-shadow(0 1px 2px rgba(0,0,0,.15))" }}>{card.suit}</div>
          </div>
          {isTrump && (
            <div style={{ position: "absolute", bottom: 14, left: 0, right: 0, textAlign: "center", fontSize: 7, fontWeight: 900, color: "#b45309", letterSpacing: 1 }}>RANG</div>
          )}
          <div style={{ position: "absolute", bottom: 3, right: 4, lineHeight: 1.05, transform: "rotate(180deg)" }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: faceCol, fontFamily: "Georgia,serif" }}>{card.rank}</div>
            <div style={{ fontSize: 11, color: faceCol }}>{card.suit}</div>
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
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, opacity: .55 }}>🃏</div>
        </div>
      </div>
    </div>
  );
}

function TrumpBadge({ suit, revealed }: { suit: string; revealed: boolean }) {
  const m = SUIT_META[suit] || { color: "#fbbf24", glow: "rgba(251,191,36,.8)", label: "?" };
  return (
    <div style={{
      display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 6,
      padding: "16px 28px", borderRadius: 22,
      background: `radial-gradient(ellipse at center,${m.glow.replace(".8", ".2")} 0%,transparent 70%)`,
      border: `3px solid ${m.color}`,
      boxShadow: `0 0 50px ${m.glow},inset 0 0 24px ${m.glow.replace(".8", ".08")}`,
      animation: revealed ? "trumpReveal .75s cubic-bezier(.36,.07,.19,.97) both" : undefined,
      ["--glow-clr" as any]: m.glow,
    }}>
      <div style={{ fontSize: 56, lineHeight: 1, color: m.color, filter: `drop-shadow(0 0 14px ${m.color})` }}>{suit}</div>
      <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 3, color: m.color }}>RANG · {m.label.toUpperCase()}</div>
      <div style={{ fontSize: 9, color: "rgba(255,255,255,.38)", letterSpacing: 2 }}>TRUMP SUIT</div>
    </div>
  );
}

function TrickRow({ trick, idx, show }: { trick: TrickResult; idx: number; show: boolean }) {
  if (!show) return null;
  const pw = trick.winner === "player", hw = trick.winner === "house";
  const pm = SUIT_FACE_COLOR[trick.playerCard.suit] || "#fff";
  const hm = SUIT_FACE_COLOR[trick.houseCard.suit] || "#fff";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", animation: "trickSlide .3s ease-out both", animationDelay: `${idx * .12}s` }}>
      <div style={{
        width: 44, height: 60, borderRadius: 7, flexShrink: 0,
        background: "linear-gradient(145deg,#ffffff,#f4f0e8)",
        border: `2px solid ${pw ? "#fbbf24" : "rgba(0,0,0,.2)"}`,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        boxShadow: pw ? "0 0 14px rgba(251,191,36,.7), 0 3px 8px rgba(0,0,0,.5)" : "0 3px 8px rgba(0,0,0,.5)",
        animation: pw ? "trickWin .4s ease-out" : undefined,
      }}>
        <div style={{ fontSize: 14, fontWeight: 900, color: pm, fontFamily: "Georgia,serif" }}>{trick.playerCard.rank}</div>
        <div style={{ fontSize: 13, color: pm }}>{trick.playerCard.suit}</div>
      </div>
      <div style={{ fontSize: 9, fontWeight: 900, color: pw ? "#fbbf24" : hw ? "#f87171" : "rgba(255,255,255,.3)", letterSpacing: 1, textAlign: "center", minWidth: 30 }}>
        {pw ? "▶ WIN" : hw ? "LOSE ◀" : "DRAW"}
      </div>
      <div style={{
        width: 44, height: 60, borderRadius: 7, flexShrink: 0,
        background: "linear-gradient(145deg,#ffffff,#f4f0e8)",
        border: `2px solid ${hw ? "#f87171" : "rgba(0,0,0,.2)"}`,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        boxShadow: hw ? "0 0 14px rgba(248,113,113,.7), 0 3px 8px rgba(0,0,0,.5)" : "0 3px 8px rgba(0,0,0,.5)",
        animation: hw ? "trickWin .4s ease-out" : undefined,
      }}>
        <div style={{ fontSize: 14, fontWeight: 900, color: hm, fontFamily: "Georgia,serif" }}>{trick.houseCard.rank}</div>
        <div style={{ fontSize: 13, color: hm }}>{trick.houseCard.suit}</div>
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
        <circle cx={27} cy={27} r={r} stroke={s <= 3 ? "#ef4444" : "#fbbf24"} strokeWidth={3.5} fill="none" strokeDasharray={circ} strokeDashoffset={circ * (1 - s / 30)} style={{ transition: "stroke-dashoffset .9s linear,stroke .3s" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 900, color: s <= 3 ? "#ef4444" : "white", animation: s <= 3 ? "cntPulse .5s ease-in-out infinite" : undefined }}>{s}</div>
    </div>
  );
}

const EMPTY_HAND: CardObj[] = Array.from({ length: 5 }, () => ({ rank: "A", suit: "♠", value: 14, isTrump: false }));

export default function RangGame() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [phase, setPhase]     = useState<Phase>("betting");
  const [selection, setSelection] = useState<Side | null>(null);
  const [stake, setStake]     = useState(0);
  const [customStake, setCustomStake] = useState("");
  const [result, setResult]   = useState<any>(null);
  const [revP, setRevP]       = useState<boolean[]>([false, false, false, false, false]);
  const [revH, setRevH]       = useState<boolean[]>([false, false, false, false, false]);
  const [showTrump, setShowTrump] = useState(false);
  const [visibleTricks, setVisibleTricks] = useState(0);
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
    if (!selection || stake <= 0) { toast({ title: "Pick a side and enter stake first", variant: "destructive" }); return; }
    if (!isAuthenticated) { setLocation("/login"); return; }
    if (cdRef.current) clearInterval(cdRef.current);
    clearTmr(); setPhase("dealing"); setResult(null); setShowConfetti(false); setShowWinPop(false); setShowTrump(false); setVisibleTricks(0);
    setRevP([false, false, false, false, false]); setRevH([false, false, false, false, false]);

    try {
      const resp = await fetch("/api/games/rang", {
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
          const r = await fetch(`/api/games/casino-round/rang/${encodeURIComponent(roundId)}`, { credentials: "include" });
          if (!r.ok) return;
          const dd = await r.json();
          if (dd.status !== "settled") return;
          clearInterval(pollId);
          const data = { ...dd.details, winner: dd.result } as any;
          const won = data.winner === mySel;
          const winAmount = won ? Math.round(myStake * 1.95 * 100) / 100 : 0;
          setResult({ ...data, won, winAmount, netChange: winAmount - myStake, newBalance: balanceAfterBet + winAmount });

          addTmr(() => { setShowTrump(true); playTrumpReveal(); }, 400);
          for (let i = 0; i < 5; i++) {
            addTmr(() => { playFlip(); setRevP(rv => { const n = [...rv]; n[i] = true; return n; }); }, 1000 + i * 280);
            addTmr(() => { playFlip(); setRevH(rv => { const n = [...rv]; n[i] = true; return n; }); }, 1000 + i * 280 + 140);
          }
          const trickStart = 1000 + 4 * 280 + 140 + 500;
          setPhase("tricks");
          for (let t = 0; t < (data.tricks?.length ?? 0); t++) {
            addTmr(() => { setVisibleTricks(t + 1); playTrickWin(); }, trickStart + t * 550);
          }
          addTmr(() => {
            setPhase("result"); setHistory(h => [...h, data.winner]);
            qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
            qc.invalidateQueries({ queryKey: getGetBalanceQueryKey() });
            if (won) { playWin(); addTmr(() => { setShowWinPop(true); setShowConfetti(true); }, 250); addTmr(() => setShowConfetti(false), 3600); }
            else playLose();
          }, trickStart + (data.tricks?.length ?? 0) * 550 + 400);
        } catch {}
      }, 500);
    } catch { toast({ title: "Network Error", variant: "destructive" }); setPhase("betting"); }
  };

  const handleAgain = () => {
    clearTmr(); setPhase("betting"); setSelection(null); setStake(0); setCustomStake(""); setResult(null);
    setShowConfetti(false); setShowWinPop(false); setShowTrump(false); setVisibleTricks(0);
    setRevP([false, false, false, false, false]); setRevH([false, false, false, false, false]);
  };

  const balance = user?.balance ?? 0;
  const canDeal = !!selection && stake > 0 && stake <= balance && phase === "betting";
  const trumpMeta = result?.trumpSuit ? SUIT_META[result.trumpSuit] : null;
  const playerTricks = result?.tricks?.filter((t: TrickResult) => t.winner === "player").length ?? 0;
  const houseTricks  = result?.tricks?.filter((t: TrickResult) => t.winner === "house").length ?? 0;
  const playerHand: CardObj[] = result?.playerHand ?? EMPTY_HAND;
  const houseHand: CardObj[]  = result?.houseHand ?? EMPTY_HAND;
  const trumpSuit = result?.trumpSuit ?? "";

  if (isLoading) return <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", background: "#050510" }}><div style={{ width: 48, height: 48, borderRadius: "50%", border: "4px solid #fbbf24", borderTopColor: "transparent", animation: "spin .8s linear infinite" }} /></div>;

  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(ellipse at 50% 0%,#1a1000 0%,#050510 60%,#0a0800 100%)" }}>
      <style>{CSS}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", background: "rgba(0,0,0,.55)", backdropFilter: "blur(14px)", borderBottom: "1px solid rgba(255,255,255,.07)", position: "sticky", top: 0, zIndex: 30 }}>
        <button onClick={() => setLocation("/")} style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,.45)", background: "none", border: "none", cursor: "pointer", fontSize: 13 }}>
          <ArrowLeft size={17} /> Back
        </button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 17, fontWeight: 900, letterSpacing: 4, color: "white", fontFamily: "Georgia,serif" }}>🃏 RUNG</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,.35)", letterSpacing: 2 }}>TRUMP CARD · BEST OF 5 TRICKS</div>
        </div>
        <div style={{ textAlign: "right" }}>
          {isAuthenticated
            ? <><div style={{ fontSize: 10, color: "rgba(255,255,255,.35)", letterSpacing: 1 }}>BALANCE</div>
               <div style={{ fontWeight: 900, color: "#4ade80", fontFamily: "monospace", fontSize: 14 }}>{formatCurrency(result?.newBalance ?? balance)}</div></>
            : <button onClick={() => setLocation("/login")} style={{ color: "#fbbf24", fontSize: 13, background: "none", border: "none", cursor: "pointer" }}>Login</button>}
        </div>
      </div>

      <div style={{ maxWidth: 580, margin: "0 auto", padding: "14px 12px 28px" }}>
        <Road history={history} />

        {/* Rules */}
        <div style={{ background: "rgba(251,191,36,.08)", border: "1px solid rgba(251,191,36,.22)", borderRadius: 12, padding: "9px 16px", marginBottom: 14, fontSize: 12, color: "rgba(255,255,255,.6)", textAlign: "center" }}>
          🃏 A <strong style={{ color: "#fbbf24" }}>Rang</strong> (trump) suit is drawn · Trump beats all others · Best of 5 tricks wins · Pays <strong style={{ color: "#4ade80" }}>1.95×</strong>
        </div>

        {/* Main arena */}
        <div style={{
          position: "relative", overflow: "hidden",
          background: "radial-gradient(ellipse at 50% 35%,#0d4a2b 0%,#063320 55%,#041a11 100%)",
          border: `4px solid ${trumpMeta ? trumpMeta.color + "80" : "rgba(251,191,36,.38)"}`,
          borderRadius: 24, padding: "24px 14px 20px",
          boxShadow: "inset 0 0 80px rgba(0,0,0,.5),0 0 60px rgba(0,0,0,.9)",
          marginBottom: 14, transition: "border-color .6s",
        }}>
          {/* Felt texture */}
          <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(90deg,transparent,transparent 40px,rgba(0,0,0,.04) 40px,rgba(0,0,0,.04) 41px)", pointerEvents: "none" }} />
          <Confetti active={showConfetti} />
          {phase === "betting" && <div style={{ position: "absolute", top: 14, right: 14 }}><Countdown s={countdown} /></div>}

          {/* Trump badge */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
            {!showTrump && phase === "betting" && (
              <div style={{ padding: "14px 28px", borderRadius: 18, border: "2px dashed rgba(251,191,36,.3)", background: "rgba(251,191,36,.04)", textAlign: "center" }}>
                <div style={{ fontSize: 38, opacity: .3 }}>🃏</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,.3)", letterSpacing: 2 }}>RANG HIDDEN</div>
              </div>
            )}
            {!showTrump && phase !== "betting" && (
              <div style={{ padding: "14px 28px", borderRadius: 18, border: "2px solid rgba(251,191,36,.4)", background: "rgba(251,191,36,.08)", textAlign: "center" }}>
                <div style={{ fontSize: 12, color: "#fbbf24", letterSpacing: 2, fontWeight: 900, animation: "pulse85 .7s ease-in-out infinite" }}>REVEALING RANG...</div>
              </div>
            )}
            {showTrump && result && <TrumpBadge suit={result.trumpSuit} revealed />}
          </div>

          {/* Card table */}
          <div style={{ background: "rgba(0,0,0,.25)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 16, padding: "18px 10px" }}>
            <div style={{ display: "flex", gap: 14, justifyContent: "center", alignItems: "flex-start" }}>
              {/* Player hand */}
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 2, color: "#4ade80", marginBottom: 12 }}>YOUR HAND</div>
                <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-end", height: 100, marginBottom: 8 }}>
                  {playerHand.map((card, i) => (
                    <Card3D key={i} card={card} revealed={revP[i] ?? false} delay={i * .18} fanIdx={i} trumpSuit={trumpSuit} />
                  ))}
                </div>
                {revP.every(Boolean) && result && (
                  <div style={{ fontSize: 11, color: "#fbbf24", fontWeight: 900 }}>
                    🔥 {result.playerTrumpCount ?? result.playerHand?.filter((c: any) => c.isTrump).length ?? 0} trump · {playerTricks} tricks
                  </div>
                )}
              </div>

              {/* VS */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: 28, gap: 8, minWidth: 46 }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: "rgba(255,255,255,.18)", letterSpacing: 2 }}>VS</div>
                {phase !== "betting" && result && (
                  <div style={{ fontSize: 13, color: "#fbbf24", fontWeight: 900 }}>{playerTricks}–{houseTricks}</div>
                )}
              </div>

              {/* House hand */}
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 2, color: "#f87171", marginBottom: 12 }}>HOUSE HAND</div>
                <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-end", height: 100, marginBottom: 8 }}>
                  {houseHand.map((card, i) => (
                    <Card3D key={i} card={card} revealed={revH[i] ?? false} delay={i * .18} fanIdx={i} trumpSuit={trumpSuit} />
                  ))}
                </div>
                {revH.every(Boolean) && result && (
                  <div style={{ fontSize: 11, color: "#fbbf24", fontWeight: 900 }}>
                    🔥 {result.houseTrumpCount ?? result.houseHand?.filter((c: any) => c.isTrump).length ?? 0} trump · {houseTricks} tricks
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Trick-by-trick results */}
          {(phase === "tricks" || phase === "result") && result?.tricks && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,.35)", letterSpacing: 2, textAlign: "center", marginBottom: 8 }}>TRICK RESULTS</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {result.tricks.map((trick: TrickResult, idx: number) => (
                  <TrickRow key={idx} trick={trick} idx={idx} show={idx < visibleTricks} />
                ))}
              </div>
            </div>
          )}

          {/* Win pop */}
          {showWinPop && result?.won && (
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", textAlign: "center", zIndex: 20, animation: "rngWinPop .55s cubic-bezier(.36,.07,.19,.97) both" }}>
              <div style={{ fontSize: 38, fontWeight: 900, color: "#fbbf24", textShadow: "0 0 24px #f59e0b", fontFamily: "Georgia,serif" }}>+{formatCurrency(result.winAmount)}</div>
              <div style={{ fontSize: 14, color: "#4ade80", letterSpacing: 3 }}>YOU WIN 🎉</div>
            </div>
          )}

          {/* Status */}
          <div style={{ textAlign: "center", marginTop: 16, minHeight: 38 }}>
            {phase === "betting" && <p style={{ color: "rgba(255,255,255,.28)", fontSize: 13, letterSpacing: 2 }}>PICK A SIDE AND DEAL</p>}
            {phase === "dealing" && <p style={{ color: "#4ade80", fontSize: 14, fontWeight: 900, letterSpacing: 4, animation: "pulse85 .6s ease-in-out infinite" }}>DEALING...</p>}
            {phase === "result" && result && !showWinPop && (
              <div style={{ display: "inline-block", padding: "8px 20px", borderRadius: 12, background: result.won ? "rgba(34,197,94,.15)" : "rgba(239,68,68,.12)", border: `1px solid ${result.won ? "rgba(34,197,94,.4)" : "rgba(239,68,68,.3)"}` }}>
                <span style={{ fontWeight: 900, fontSize: 15, color: result.won ? "#4ade80" : "#f87171", letterSpacing: 2 }}>
                  {result.won ? `YOU WIN! +${formatCurrency(result.winAmount)}` : `HOUSE WINS · −${formatCurrency(stake)}`}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.09)", borderRadius: 20, padding: 18 }}>
          {phase === "result" ? (
            <button onClick={handleAgain} style={{ width: "100%", padding: 15, borderRadius: 14, background: "linear-gradient(135deg,#7c3aed,#4f46e5)", color: "white", fontWeight: 900, fontSize: 16, border: "none", cursor: "pointer", letterSpacing: 3, boxShadow: "0 4px 20px rgba(124,58,237,.5)" }}>
              🃏 DEAL AGAIN
            </button>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                {([
                  { id: "player" as Side, emoji: "🤲", label: "MY HAND WINS", sub: "More tricks for you", color: "#22c55e" },
                  { id: "house"  as Side, emoji: "🏠", label: "HOUSE WINS", sub: "House takes more tricks", color: "#ef4444" },
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
                      border: `3px solid ${stake === amt ? "#fbbf24" : "rgba(255,255,255,.18)"}`,
                      background: stake === amt ? "radial-gradient(circle at 38% 35%,#fde68a,#fbbf24,#d97706)" : "radial-gradient(circle at 38% 35%,#374151,#1f2937)",
                      color: stake === amt ? "#78350f" : "rgba(255,255,255,.45)", fontWeight: 900, fontSize: 12,
                      cursor: phase === "betting" ? "pointer" : "not-allowed",
                      boxShadow: stake === amt ? "0 0 18px rgba(251,191,36,.6),inset 0 2px 0 rgba(255,255,255,.4)" : "inset 0 2px 0 rgba(255,255,255,.06)",
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
                ? <button onClick={() => setLocation("/login")} style={{ width: "100%", padding: 14, borderRadius: 12, background: "linear-gradient(135deg,#fbbf24,#f59e0b)", color: "#78350f", fontWeight: 900, fontSize: 16, border: "none", cursor: "pointer" }}>LOG IN TO PLAY</button>
                : <>
                  <button onClick={handleDeal} disabled={!canDeal} style={{
                    width: "100%", padding: 15, borderRadius: 13, fontWeight: 900, fontSize: 17, letterSpacing: 3,
                    background: canDeal ? "linear-gradient(135deg,#fbbf24,#f59e0b)" : "rgba(255,255,255,.06)",
                    color: canDeal ? "#78350f" : "rgba(255,255,255,.22)",
                    border: `2px solid ${canDeal ? "rgba(251,191,36,.6)" : "rgba(255,255,255,.06)"}`,
                    cursor: canDeal ? "pointer" : "not-allowed",
                    boxShadow: canDeal ? "0 4px 28px rgba(251,191,36,.45)" : "none", transition: "all .2s",
                  }}>
                    {phase === "dealing" || phase === "tricks" ? "🃏 PLAYING..." : !selection ? "PICK A SIDE" : stake <= 0 ? "ENTER STAKE" : "🃏 DEAL CARDS"}
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
