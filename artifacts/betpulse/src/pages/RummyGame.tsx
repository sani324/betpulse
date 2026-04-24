import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey, getGetBalanceQueryKey } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";
import rummyLogo from "@assets/WhatsApp_Image_2026-04-24_at_5.16.35_PM_1777034496584.jpeg";

type Side = "player" | "house";
type Phase = "betting" | "dealing" | "result";
type CardObj = { rank: string; suit: string; value: number };
const CHIPS = [100, 500, 1000, 5000, 10000];
const SUIT_COLOR: Record<string, string> = { "♥": "#dc2626", "♦": "#dc2626", "♠": "#1e293b", "♣": "#1e293b" };
const COURT = ["J", "Q", "K", "A"];
const FAN = [-14, -7, 0, 7, 14];

const CSS = `
@keyframes deckDeal {
  0%   { transform: translate(-50%,-80px) scale(.6) rotateY(-30deg); opacity:0; }
  50%  { opacity:1; }
  80%  { transform: translate(0,4px) scale(1.04) rotateY(4deg); }
  100% { transform: translate(0,0) scale(1) rotateY(0deg); opacity:1; }
}
@keyframes rmResultIn {
  0%  { transform: translateY(22px) scale(.82); opacity:0; }
  60% { transform: translateY(-5px) scale(1.05); opacity:1; }
  100%{ transform: translateY(0) scale(1); opacity:1; }
}
@keyframes rmWinPop {
  0%  { transform: scale(0) rotate(-14deg); opacity:0; }
  55% { transform: scale(1.3) rotate(3deg); opacity:1; }
  80% { transform: scale(.95) rotate(-1deg); }
  100%{ transform: scale(1) rotate(0deg); opacity:1; }
}
@keyframes rmGlow { 0%,100%{ box-shadow:0 0 22px rgba(251,191,36,.6); } 50%{ box-shadow:0 0 55px rgba(251,191,36,1),0 0 80px rgba(245,158,11,.5); } }
@keyframes rmRoadIn { 0%{ transform:scale(0);opacity:0; } 100%{ transform:scale(1);opacity:1; } }
@keyframes rmPulse { 0%,100%{ transform:scale(1); } 50%{ transform:scale(1.08); } }
@keyframes confettiFall {
  0%  { transform:translateY(-20px) rotate(0deg); opacity:1; }
  100%{ transform:translateY(300px) rotate(720deg); opacity:0; }
}
`;

function mkAudio() { return new ((window as any).AudioContext || (window as any).webkitAudioContext)(); }
function playDeal() {
  try {
    const c = mkAudio(); const b = c.createBuffer(1, c.sampleRate * .05, c.sampleRate);
    const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) * .5;
    const s = c.createBufferSource(), g = c.createGain(); s.buffer = b; s.connect(g); g.connect(c.destination);
    g.gain.setValueAtTime(.3, c.currentTime); g.gain.exponentialRampToValueAtTime(.001, c.currentTime + .05); s.start(); setTimeout(() => c.close(), 500);
  } catch (_) {}
}
function playWin() {
  try {
    const c = mkAudio(); [523, 659, 784, 1047, 1319].forEach((f, i) => {
      const o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.type = "triangle"; o.frequency.value = f;
      const t = c.currentTime + i * .13; g.gain.setValueAtTime(.22, t); g.gain.exponentialRampToValueAtTime(.001, t + .44); o.start(t); o.stop(t + .44);
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
    const COLS = ["#fbbf24", "#f59e0b", "#ef4444", "#fff", "#a78bfa", "#4ade80", "#f472b6"];
    pts.current = Array.from({ length: 100 }, (_, i) => ({
      x: Math.random() * cv.width, y: -20, vx: (Math.random() - .5) * 7, vy: Math.random() * 4 + 2,
      r: Math.random() * 8 + 3, color: COLS[i % COLS.length], life: 0, maxLife: 90 + Math.random() * 70,
      rot: 0, vrot: (Math.random() - .5) * .5, shape: Math.random() > .5 ? "rect" : "circle",
    }));
    const loop = () => {
      ctx.clearRect(0, 0, cv.width, cv.height);
      pts.current = pts.current.filter(p => p.life < p.maxLife);
      pts.current.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.vy += .15; p.rot += p.vrot; p.life++;
        ctx.save(); ctx.globalAlpha = Math.max(0, 1 - p.life / p.maxLife);
        ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.color;
        if (p.shape === "rect") ctx.fillRect(-p.r, -p.r * .5, p.r * 2, p.r);
        else { ctx.beginPath(); ctx.arc(0, 0, p.r, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
      });
      if (pts.current.length) rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active]);
  return <canvas ref={cvRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 50 }} />;
}

function Card3D({ card, revealed, delay = 0, fanIdx = 2, highlight = false, winningSide = false }: {
  card: CardObj; revealed: boolean; delay?: number; fanIdx?: number; highlight?: boolean; winningSide?: boolean;
}) {
  const col = SUIT_COLOR[card.suit] || "#1e293b";
  const isCourt = COURT.includes(card.rank);
  const rot = FAN[fanIdx] ?? 0;

  return (
    <div style={{
      width: 60, height: 86, perspective: 700, flexShrink: 0,
      transform: `rotate(${rot}deg) translateY(${Math.abs(rot) * 0.5}px)`,
      transformOrigin: "bottom center",
      transition: "transform .2s",
      zIndex: fanIdx === 2 ? 5 : Math.abs(2 - fanIdx) === 1 ? 3 : 1,
    }}>
      <div style={{
        width: "100%", height: "100%", position: "relative",
        transformStyle: "preserve-3d",
        transition: `transform 0.52s cubic-bezier(.36,.07,.19,.97) ${delay}s`,
        transform: revealed ? "rotateY(0deg)" : "rotateY(180deg)",
      }}>
        {/* Front face */}
        <div style={{
          position: "absolute", inset: 0, borderRadius: 8,
          backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
          background: "linear-gradient(145deg,#ffffff,#f4f0e8)",
          border: `2px solid ${winningSide ? "#fbbf24" : isCourt && highlight ? "#d97706" : "rgba(0,0,0,.15)"}`,
          boxShadow: winningSide
            ? "0 0 24px rgba(251,191,36,.8), 0 6px 18px rgba(0,0,0,.5)"
            : isCourt && highlight
            ? "0 0 14px rgba(217,119,6,.5), 0 4px 14px rgba(0,0,0,.5)"
            : "0 4px 14px rgba(0,0,0,.55)",
          animation: winningSide ? "rmGlow 1s ease-in-out infinite" : undefined,
          overflow: "hidden",
        }}>
          {/* Top-left corner */}
          <div style={{ position: "absolute", top: 3, left: 4, lineHeight: 1.05 }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: col, fontFamily: "Georgia,serif" }}>{card.rank}</div>
            <div style={{ fontSize: 11, color: col }}>{card.suit}</div>
          </div>
          {/* Center pip */}
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontSize: isCourt ? 26 : 30, color: col, filter: "drop-shadow(0 1px 2px rgba(0,0,0,.15))" }}>{card.suit}</div>
          </div>
          {/* Court label */}
          {isCourt && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ fontSize: 9, fontWeight: 900, color: col, letterSpacing: .5, opacity: .6, marginTop: 24 }}>
                {{ J: "JACK", Q: "QUEEN", K: "KING", A: "ACE" }[card.rank]}
              </div>
            </div>
          )}
          {/* Bottom-right corner */}
          <div style={{ position: "absolute", bottom: 3, right: 4, lineHeight: 1.05, transform: "rotate(180deg)" }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: col, fontFamily: "Georgia,serif" }}>{card.rank}</div>
            <div style={{ fontSize: 11, color: col }}>{card.suit}</div>
          </div>
        </div>
        {/* Back face */}
        <div style={{
          position: "absolute", inset: 0, borderRadius: 8,
          backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
          transform: "rotateY(180deg)",
          background: "linear-gradient(145deg,#7b1a1a,#5a1010)",
          border: "2px solid rgba(251,191,36,.3)",
          boxShadow: "0 4px 14px rgba(0,0,0,.55)",
          overflow: "hidden",
        }}>
          <div style={{ position: "absolute", inset: 4, borderRadius: 5, background: "repeating-linear-gradient(45deg,#6b1616 0,#6b1616 4px,#5a1010 4px,#5a1010 8px)", border: "1px solid rgba(251,191,36,.2)" }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, opacity: .6 }}>♦</div>
        </div>
      </div>
    </div>
  );
}

function Hand({ label, cards, revealed, total, courtCount, isWinner, side }: {
  label: string; cards: CardObj[]; revealed: boolean[];
  total: number; courtCount: number; isWinner: boolean | null; side: Side;
}) {
  const col = side === "player" ? "#4ade80" : "#f87171";
  return (
    <div style={{ flex: 1, textAlign: "center" }}>
      <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 2, color: col, marginBottom: 12 }}>{label}</div>
      {/* Fan of cards */}
      <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-end", gap: -8, position: "relative", height: 100, marginBottom: 8 }}>
        {cards.map((card, i) => (
          <Card3D key={i} card={card} revealed={revealed[i] ?? false} delay={i * .18} fanIdx={i} highlight={true} winningSide={isWinner === true && revealed.every(Boolean)} />
        ))}
      </div>
      {revealed.every(Boolean) && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, marginTop: 6 }}>
          <div style={{ fontSize: 11, color: "#fbbf24", fontWeight: 900 }}>
            👑 {courtCount} Court &nbsp;·&nbsp; {total} pts
          </div>
          {isWinner !== null && (
            <div style={{
              padding: "3px 14px", borderRadius: 8, fontSize: 12, fontWeight: 900,
              background: isWinner ? `${col}22` : "rgba(255,255,255,.06)",
              border: `1px solid ${isWinner ? col : "rgba(255,255,255,.1)"}`,
              color: isWinner ? col : "rgba(255,255,255,.4)",
            }}>
              {isWinner ? "🏆 WINS!" : "LOSES"}
            </div>
          )}
        </div>
      )}
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
          fontSize: 10, fontWeight: 900, color: "white",
          border: "1.5px solid rgba(255,255,255,.3)",
          animation: "rmRoadIn .3s ease-out backwards", animationDelay: `${Math.min(i * .03, .3)}s`,
        }}>{r === "player" ? "P" : "H"}</div>
      ))}
      {!history.length && <span style={{ color: "rgba(255,255,255,.22)", fontSize: 12, fontStyle: "italic" }}>Round history will appear here</span>}
    </div>
  );
}

const EMPTY: CardObj[] = Array.from({ length: 5 }, () => ({ rank: "A", suit: "♠", value: 14 }));

export default function RummyGame() {
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
  const [showConfetti, setShowConfetti] = useState(false);
  const [history, setHistory] = useState<Side[]>([]);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTmr = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const addTmr = (fn: () => void, ms: number) => { const t = setTimeout(fn, ms); timers.current.push(t); };
  useEffect(() => () => clearTmr(), []);

  const handleDeal = async () => {
    if (!selection || stake <= 0) { toast({ title: "Pick a side and enter a stake", variant: "destructive" }); return; }
    if (!isAuthenticated) { setLocation("/login"); return; }
    clearTmr(); setPhase("dealing"); setResult(null); setShowConfetti(false);
    setRevP([false, false, false, false, false]); setRevH([false, false, false, false, false]);

    try {
      const resp = await fetch("/api/games/rummy", {
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
          const r = await fetch(`/api/games/casino-round/rummy/${encodeURIComponent(roundId)}`, { credentials: "include" });
          if (!r.ok) return;
          const dd = await r.json();
          if (dd.status !== "settled") return;
          clearInterval(pollId);
          const data = { ...dd.details, winner: dd.result };
          const won = data.winner === mySel;
          const winAmount = won ? Math.round(myStake * 1.95 * 100) / 100 : 0;
          const res = { ...data, won, winAmount, newBalance: balanceAfterBet + winAmount };
          setResult(res);

          for (let i = 0; i < 5; i++) {
            addTmr(() => { playDeal(); setRevP(rv => { const n = [...rv]; n[i] = true; return n; }); }, 300 + i * 280);
            addTmr(() => { playDeal(); setRevH(rv => { const n = [...rv]; n[i] = true; return n; }); }, 300 + i * 280 + 140);
          }
          addTmr(() => {
            setPhase("result"); setHistory(h => [...h, data.winner]);
            qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
            qc.invalidateQueries({ queryKey: getGetBalanceQueryKey() });
            if (won) { playWin(); addTmr(() => setShowConfetti(true), 200); addTmr(() => setShowConfetti(false), 3800); }
            else playLose();
          }, 300 + 4 * 280 + 140 + 600);
        } catch {}
      }, 500);
    } catch { toast({ title: "Network Error", variant: "destructive" }); setPhase("betting"); }
  };

  const handleAgain = () => {
    clearTmr(); setPhase("betting"); setSelection(null); setStake(0); setCustomStake(""); setResult(null);
    setRevP([false, false, false, false, false]); setRevH([false, false, false, false, false]); setShowConfetti(false);
  };

  const balance = user?.balance ?? 0;
  const canDeal = !!selection && stake > 0 && stake <= balance && phase === "betting";
  const playerHand: CardObj[] = result?.playerHand ?? EMPTY;
  const houseHand: CardObj[]  = result?.houseHand ?? EMPTY;

  if (isLoading) return <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", background: "#0a0003" }}><div style={{ width: 48, height: 48, borderRadius: "50%", border: "4px solid #dc2626", borderTopColor: "transparent", animation: "spin .8s linear infinite" }} /></div>;

  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(ellipse at 50% 0%,#1a0005 0%,#07000a 60%,#150009 100%)" }}>
      <style>{CSS}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", background: "rgba(0,0,0,.55)", backdropFilter: "blur(14px)", borderBottom: "1px solid rgba(255,255,255,.07)", position: "sticky", top: 0, zIndex: 30 }}>
        <button onClick={() => setLocation("/")} style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,.45)", background: "none", border: "none", cursor: "pointer", fontSize: 13 }}>
          <ArrowLeft size={17} /> Back
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src={rummyLogo} alt="Rummy" style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover" }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: 4, color: "white", fontFamily: "Georgia,serif" }}>RUMMY</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,.35)", letterSpacing: 2 }}>CARD GAME · 1.95×</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          {isAuthenticated
            ? <><div style={{ fontSize: 10, color: "rgba(255,255,255,.35)", letterSpacing: 1 }}>BALANCE</div>
               <div style={{ fontWeight: 900, color: "#4ade80", fontFamily: "monospace", fontSize: 14 }}>{formatCurrency(result?.newBalance ?? balance)}</div></>
            : <button onClick={() => setLocation("/login")} style={{ color: "#fbbf24", fontSize: 13, background: "none", border: "none", cursor: "pointer" }}>Login</button>}
        </div>
      </div>

      <div style={{ maxWidth: 560, margin: "0 auto", padding: "14px 12px 24px" }}>
        <Road history={history} />

        {/* Rules banner */}
        <div style={{ background: "rgba(220,38,38,.08)", border: "1px solid rgba(220,38,38,.25)", borderRadius: 12, padding: "9px 16px", marginBottom: 14, fontSize: 12, color: "rgba(255,255,255,.6)", textAlign: "center" }}>
          🃏 5 cards dealt each · Highest point total wins · Court cards (J Q K A) = max points · Pays <strong style={{ color: "#4ade80" }}>1.95×</strong>
        </div>

        {/* Table */}
        <div style={{
          position: "relative", overflow: "hidden",
          background: "radial-gradient(ellipse at 50% 35%,#0d4a2b 0%,#063320 55%,#041a11 100%)",
          border: "4px solid #7c2d12",
          borderRadius: 24, padding: "28px 16px 22px",
          boxShadow: "inset 0 0 80px rgba(0,0,0,.55), 0 0 60px rgba(0,0,0,.9)",
          marginBottom: 14,
        }}>
          {/* Felt texture lines */}
          <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(90deg,transparent,transparent 40px,rgba(0,0,0,.04) 40px,rgba(0,0,0,.04) 41px)", pointerEvents: "none" }} />
          <Confetti active={showConfetti} />

          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", position: "relative" }}>
            {/* Player */}
            <Hand
              label="YOUR HAND" cards={playerHand}
              revealed={phase === "betting" ? [false, false, false, false, false] : revP}
              total={result?.playerTotal ?? 0}
              courtCount={result?.playerCourt ?? 0}
              isWinner={result ? result.winner === "player" : null}
              side="player"
            />

            {/* VS */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: 28, gap: 10, minWidth: 48 }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: "rgba(255,255,255,.2)", letterSpacing: 2 }}>VS</div>
              {phase === "result" && result && (
                <div style={{ fontSize: 11, color: "#fbbf24", fontWeight: 900, textAlign: "center", animation: "rmWinPop .5s both" }}>
                  {result.playerTotal}–{result.houseTotal}
                </div>
              )}
            </div>

            {/* House */}
            <Hand
              label="HOUSE HAND" cards={houseHand}
              revealed={phase === "betting" ? [false, false, false, false, false] : revH}
              total={result?.houseTotal ?? 0}
              courtCount={result?.houseCourt ?? 0}
              isWinner={result ? result.winner === "house" : null}
              side="house"
            />
          </div>

          {/* Status */}
          <div style={{ textAlign: "center", marginTop: 18, minHeight: 44 }}>
            {phase === "betting" && <p style={{ color: "rgba(255,255,255,.3)", fontSize: 13, letterSpacing: 2 }}>PICK YOUR SIDE AND DEAL</p>}
            {phase === "dealing" && <p style={{ color: "#4ade80", fontSize: 15, fontWeight: 900, letterSpacing: 4, animation: "rmPulse .6s ease-in-out infinite" }}>DEALING CARDS...</p>}
            {phase === "result" && result && (
              <div style={{ animation: "rmResultIn .5s cubic-bezier(.22,1,.36,1) both" }}>
                {result.won
                  ? <><div style={{ fontSize: 36, fontWeight: 900, color: "#fbbf24", fontFamily: "Georgia,serif", textShadow: "0 0 24px #f59e0b" }}>+{formatCurrency(result.winAmount)}</div>
                     <div style={{ fontSize: 13, color: "#4ade80", letterSpacing: 3 }}>YOU WIN! 🎉</div></>
                  : <><div style={{ fontSize: 18, fontWeight: 900, color: "#f87171", letterSpacing: 2 }}>HOUSE WINS</div>
                     <div style={{ fontSize: 13, color: "#f87171", opacity: .8 }}>−{formatCurrency(stake)} · Better luck next time!</div></>}
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.09)", borderRadius: 20, padding: 18 }}>
          {phase === "result" ? (
            <button onClick={handleAgain} style={{ width: "100%", padding: "15px 0", borderRadius: 14, background: "linear-gradient(135deg,#dc2626,#991b1b)", color: "white", fontWeight: 900, fontSize: 16, border: "none", cursor: "pointer", letterSpacing: 3, boxShadow: "0 4px 20px rgba(220,38,38,.5)" }}>
              🃏 DEAL AGAIN
            </button>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                {([
                  { id: "player" as Side, emoji: "🤲", label: "MY HAND WINS", sub: "Your cards beat the house", color: "#22c55e" },
                  { id: "house"  as Side, emoji: "🏠", label: "HOUSE WINS", sub: "House cards beat yours", color: "#ef4444" },
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
                      border: `3px solid ${stake === amt ? "#dc2626" : "rgba(255,255,255,.18)"}`,
                      background: stake === amt ? "radial-gradient(circle at 38% 35%,#f87171,#dc2626)" : "radial-gradient(circle at 38% 35%,#374151,#1f2937)",
                      color: stake === amt ? "white" : "rgba(255,255,255,.45)", fontWeight: 900, fontSize: 12,
                      cursor: phase === "betting" ? "pointer" : "not-allowed",
                      boxShadow: stake === amt ? "0 0 18px rgba(220,38,38,.6), inset 0 2px 0 rgba(255,255,255,.18)" : "inset 0 2px 0 rgba(255,255,255,.06)",
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
                ? <button onClick={() => setLocation("/login")} style={{ width: "100%", padding: 14, borderRadius: 12, background: "linear-gradient(135deg,#dc2626,#991b1b)", color: "white", fontWeight: 900, fontSize: 16, border: "none", cursor: "pointer" }}>LOG IN TO PLAY</button>
                : <>
                  <button onClick={handleDeal} disabled={!canDeal} style={{
                    width: "100%", padding: 15, borderRadius: 13, fontWeight: 900, fontSize: 17, letterSpacing: 3,
                    background: canDeal ? "linear-gradient(135deg,#dc2626,#991b1b)" : "rgba(255,255,255,.06)",
                    color: canDeal ? "white" : "rgba(255,255,255,.22)",
                    border: `2px solid ${canDeal ? "rgba(220,38,38,.6)" : "rgba(255,255,255,.06)"}`,
                    cursor: canDeal ? "pointer" : "not-allowed",
                    boxShadow: canDeal ? "0 4px 28px rgba(220,38,38,.5)" : "none", transition: "all .2s",
                  }}>
                    {phase === "dealing" ? "🃏 DEALING..." : !selection ? "PICK A SIDE" : stake <= 0 ? "ENTER STAKE" : "🃏 DEAL CARDS"}
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
