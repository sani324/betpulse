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
const IS_RED = (s: string) => s === "♥" || s === "♦";
const COURT = ["J", "Q", "K", "A"];

const CSS = `
@keyframes rmFlip3D {
  0%   { transform:rotateY(90deg) scale(.85); opacity:.4; }
  100% { transform:rotateY(0deg) scale(1); opacity:1; }
}
@keyframes rmDealIn {
  0%   { transform:translateY(-60px) rotateY(-30deg) scale(.7); opacity:0; }
  60%  { transform:translateY(6px) rotateY(5deg) scale(1.04); opacity:1; }
  100% { transform:translateY(0) rotateY(0deg) scale(1); opacity:1; }
}
@keyframes rmWin { 0%{transform:scale(0) rotate(-14deg);opacity:0} 55%{transform:scale(1.28) rotate(3deg);opacity:1} 100%{transform:scale(1) rotate(0);opacity:1} }
@keyframes rmPulse { 0%,100%{transform:scale(1);opacity:.7} 50%{transform:scale(1.06);opacity:1} }
@keyframes rmRoad { 0%{transform:scale(0);opacity:0} 100%{transform:scale(1);opacity:1} }
@keyframes rmGoldGlow { 0%,100%{box-shadow:0 0 16px rgba(251,191,36,.6),2px 4px 0 #92400e} 50%{box-shadow:0 0 36px rgba(251,191,36,1),2px 4px 0 #92400e} }
`;

function mkAudio() { return new ((window as any).AudioContext || (window as any).webkitAudioContext)(); }
function playFlip() {
  try {
    const c = mkAudio(); const b = c.createBuffer(1, c.sampleRate * .04, c.sampleRate);
    const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) * .45;
    const s = c.createBufferSource(), g = c.createGain(); s.buffer = b; s.connect(g); g.connect(c.destination);
    g.gain.setValueAtTime(.28, c.currentTime); g.gain.exponentialRampToValueAtTime(.001, c.currentTime + .04); s.start(); setTimeout(() => c.close(), 500);
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
      const t = c.currentTime + i * .22; g.gain.setValueAtTime(.1, t); g.gain.exponentialRampToValueAtTime(.001, t + .25); o.start(t); o.stop(t + .25);
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
    const COLS = ["#fbbf24","#ef4444","#a78bfa","#fff","#4ade80","#f472b6"];
    pts.current = Array.from({ length: 80 }, (_, i) => ({
      x: Math.random() * cv.width, y: -20, vx: (Math.random() - .5) * 6, vy: Math.random() * 3 + 2,
      r: Math.random() * 8 + 3, color: COLS[i % COLS.length], life: 0, maxLife: 90 + Math.random() * 60,
      rot: 0, vrot: (Math.random() - .5) * .5,
    }));
    const loop = () => {
      ctx.clearRect(0, 0, cv.width, cv.height);
      pts.current = pts.current.filter(p => p.life < p.maxLife);
      pts.current.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.vy += .13; p.rot += p.vrot; p.life++;
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
  return <canvas ref={cvRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 40 }} />;
}

/* Real playing card — white face with rank+suit corners and centre pip */
function PlayCard({ card, revealed, delay = 0, idx = 0, total = 5, isWinner = false }: {
  card: CardObj; revealed: boolean; delay?: number; idx?: number; total?: number; isWinner?: boolean;
}) {
  const red = IS_RED(card.suit);
  const faceColor = red ? "#dc2626" : "#1a2744";
  const isCourt = COURT.includes(card.rank);
  // fan rotation: spread cards like a real hand
  const spread = total > 1 ? (idx / (total - 1) - 0.5) * 28 : 0;
  const liftY = Math.abs(spread) * 0.4;

  return (
    <div style={{
      flexShrink: 0,
      transform: `rotate(${spread}deg) translateY(${liftY}px)`,
      transformOrigin: "bottom center",
      transition: "transform .2s",
      zIndex: idx === Math.floor(total / 2) ? 5 : 1,
      filter: isWinner && revealed ? "drop-shadow(0 0 10px rgba(251,191,36,.9))" : "drop-shadow(0 2px 6px rgba(0,0,0,.7))",
    }}>
      <div style={{
        width: 54, height: 78,
        perspective: 600,
      }}>
        <div style={{
          width: "100%", height: "100%",
          transformStyle: "preserve-3d",
          transition: `transform .55s cubic-bezier(.36,.07,.19,.97) ${delay}s`,
          transform: revealed ? "rotateY(0deg)" : "rotateY(180deg)",
          position: "relative",
        }}>
          {/* ── FRONT FACE ── */}
          <div style={{
            position: "absolute", inset: 0,
            backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" as any,
            borderRadius: 7,
            background: "linear-gradient(150deg,#ffffff 0%,#f5f0e8 100%)",
            border: `2px solid ${isWinner ? "#fbbf24" : isCourt ? "#d97706" : "rgba(0,0,0,.18)"}`,
            boxShadow: isWinner
              ? "0 0 18px rgba(251,191,36,.7), 2px 4px 0 #92400e, 4px 8px 0 rgba(0,0,0,.3)"
              : "2px 4px 0 rgba(0,0,0,.3), 4px 8px 0 rgba(0,0,0,.15)",
            animation: isWinner && revealed ? "rmGoldGlow 1s ease-in-out infinite" : undefined,
            overflow: "hidden",
          }}>
            {/* top-left */}
            <div style={{ position: "absolute", top: 3, left: 4, lineHeight: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: faceColor, fontFamily: "Georgia,serif" }}>{card.rank}</div>
              <div style={{ fontSize: 11, color: faceColor, marginTop: -1 }}>{card.suit}</div>
            </div>
            {/* center pip */}
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ fontSize: isCourt ? 22 : 26, color: faceColor }}>{card.suit}</div>
            </div>
            {/* court label */}
            {isCourt && (
              <div style={{ position: "absolute", bottom: 15, left: 0, right: 0, textAlign: "center", fontSize: 6, fontWeight: 900, color: faceColor, opacity: .7, letterSpacing: .5 }}>
                {{ J:"JACK", Q:"QUEEN", K:"KING", A:"ACE" }[card.rank]}
              </div>
            )}
            {/* bottom-right (mirrored) */}
            <div style={{ position: "absolute", bottom: 3, right: 4, lineHeight: 1, transform: "rotate(180deg)" }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: faceColor, fontFamily: "Georgia,serif" }}>{card.rank}</div>
              <div style={{ fontSize: 11, color: faceColor, marginTop: -1 }}>{card.suit}</div>
            </div>
          </div>
          {/* ── BACK FACE ── */}
          <div style={{
            position: "absolute", inset: 0,
            backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" as any,
            transform: "rotateY(180deg)",
            borderRadius: 7,
            background: "linear-gradient(145deg,#7c1d1d,#5a0e0e)",
            border: "2px solid rgba(251,191,36,.4)",
            boxShadow: "2px 4px 0 rgba(0,0,0,.4), 4px 8px 0 rgba(0,0,0,.2)",
            overflow: "hidden",
          }}>
            {/* inner border */}
            <div style={{ position: "absolute", inset: 4, borderRadius: 4, border: "1px solid rgba(251,191,36,.3)", background: "repeating-linear-gradient(45deg,#6b1616 0,#6b1616 3px,#5a0e0e 3px,#5a0e0e 6px)" }} />
            {/* center emblem */}
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, zIndex: 1 }}>♦</div>
          </div>
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
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 2, color: col, marginBottom: 10, textShadow: `0 0 12px ${col}88` }}>{label}</div>
      {/* Fan of cards — overlapping */}
      <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-end", position: "relative", height: 90, width: "100%" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          {cards.map((card, i) => (
            <div key={i} style={{ marginLeft: i === 0 ? 0 : -18 }}>
              <PlayCard card={card} revealed={revealed[i] ?? false} delay={i * .15} idx={i} total={cards.length} isWinner={isWinner === true} />
            </div>
          ))}
        </div>
      </div>
      {revealed.every(Boolean) && total > 0 && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{ fontSize: 11, color: "#fbbf24", fontWeight: 900 }}>👑 {courtCount} court · {total} pts</div>
          {isWinner !== null && (
            <div style={{ padding: "3px 12px", borderRadius: 8, fontSize: 12, fontWeight: 900, background: isWinner ? `${col}22` : "rgba(255,255,255,.06)", border: `1px solid ${isWinner ? col : "rgba(255,255,255,.1)"}`, color: isWinner ? col : "rgba(255,255,255,.38)" }}>
              {isWinner ? "🏆 WINNER!" : "LOSES"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Road({ history }: { history: Side[] }) {
  return (
    <div style={{ display: "flex", gap: 5, justifyContent: "center", flexWrap: "wrap", marginBottom: 12, minHeight: 26 }}>
      {history.slice(-20).map((r, i) => (
        <div key={i} style={{ width: 24, height: 24, borderRadius: "50%", background: r === "player" ? "linear-gradient(135deg,#22c55e,#14532d)" : "linear-gradient(135deg,#ef4444,#991b1b)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 900, color: "white", animation: "rmRoad .25s ease-out backwards", animationDelay: `${Math.min(i * .03, .25)}s` }}>
          {r === "player" ? "P" : "H"}
        </div>
      ))}
      {!history.length && <span style={{ color: "rgba(255,255,255,.2)", fontSize: 11, fontStyle: "italic" }}>Round history will appear here</span>}
    </div>
  );
}

const EMPTY: CardObj[] = [
  { rank: "A", suit: "♠", value: 14 }, { rank: "K", suit: "♥", value: 13 },
  { rank: "Q", suit: "♦", value: 12 }, { rank: "J", suit: "♣", value: 11 },
  { rank: "10", suit: "♠", value: 10 },
];

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
  const [showWin, setShowWin] = useState(false);
  const [history, setHistory] = useState<Side[]>([]);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTmr = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const addTmr = (fn: () => void, ms: number) => { const t = setTimeout(fn, ms); timers.current.push(t); };
  useEffect(() => () => clearTmr(), []);

  const handleDeal = async () => {
    if (!selection || stake <= 0) { toast({ title: "Pick a side and enter a stake", variant: "destructive" }); return; }
    if (!isAuthenticated) { setLocation("/login"); return; }
    clearTmr(); setPhase("dealing"); setResult(null); setShowConfetti(false); setShowWin(false);
    setRevP([false, false, false, false, false]); setRevH([false, false, false, false, false]);
    try {
      const resp = await fetch("/api/games/rummy", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ stake, selection }) });
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
      qc.invalidateQueries({ queryKey: getGetMeQueryKey() }); qc.invalidateQueries({ queryKey: getGetBalanceQueryKey() });
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
          setResult({ ...data, won, winAmount, newBalance: balanceAfterBet + winAmount });
          for (let i = 0; i < 5; i++) {
            addTmr(() => { playFlip(); setRevP(rv => { const n=[...rv]; n[i]=true; return n; }); }, 300 + i * 260);
            addTmr(() => { playFlip(); setRevH(rv => { const n=[...rv]; n[i]=true; return n; }); }, 300 + i * 260 + 130);
          }
          addTmr(() => {
            setPhase("result"); setHistory(h => [...h, data.winner]);
            qc.invalidateQueries({ queryKey: getGetMeQueryKey() }); qc.invalidateQueries({ queryKey: getGetBalanceQueryKey() });
            if (won) { playWin(); addTmr(() => { setShowWin(true); setShowConfetti(true); }, 200); addTmr(() => setShowConfetti(false), 3500); }
            else playLose();
          }, 300 + 4 * 260 + 130 + 500);
        } catch {}
      }, 500);
    } catch { toast({ title: "Network Error", variant: "destructive" }); setPhase("betting"); }
  };

  const handleAgain = () => {
    clearTmr(); setPhase("betting"); setSelection(null); setStake(0); setCustomStake(""); setResult(null);
    setRevP([false,false,false,false,false]); setRevH([false,false,false,false,false]); setShowConfetti(false); setShowWin(false);
  };

  const balance = user?.balance ?? 0;
  const canDeal = !!selection && stake > 0 && stake <= balance && phase === "betting";
  const playerHand: CardObj[] = result?.playerHand ?? EMPTY;
  const houseHand: CardObj[]  = result?.houseHand ?? EMPTY;

  if (isLoading) return <div style={{ display:"flex", height:"100vh", alignItems:"center", justifyContent:"center", background:"#0a0003" }}><div style={{ width:44, height:44, borderRadius:"50%", border:"4px solid #dc2626", borderTopColor:"transparent", animation:"spin .8s linear infinite" }} /></div>;

  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(ellipse at 50% 0%,#1a0005 0%,#07000a 60%,#150009 100%)", overflowX: "hidden" }}>
      <style>{CSS}</style>

      {/* ── Header ── */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"11px 16px", background:"rgba(0,0,0,.6)", backdropFilter:"blur(14px)", borderBottom:"1px solid rgba(255,255,255,.07)", position:"sticky", top:0, zIndex:30 }}>
        <button onClick={()=>setLocation("/")} style={{ display:"flex", alignItems:"center", gap:5, color:"rgba(255,255,255,.45)", background:"none", border:"none", cursor:"pointer", fontSize:13 }}>
          <ArrowLeft size={16}/> Back
        </button>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <img src={rummyLogo} alt="Rummy" style={{ width:32, height:32, borderRadius:7, objectFit:"cover", border:"1px solid rgba(251,191,36,.3)" }}/>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:15, fontWeight:900, letterSpacing:4, color:"white", fontFamily:"Georgia,serif" }}>RUMMY</div>
            <div style={{ fontSize:9, color:"rgba(255,255,255,.35)", letterSpacing:2 }}>HIGHEST POINTS WINS · 1.95×</div>
          </div>
        </div>
        <div style={{ textAlign:"right" }}>
          {isAuthenticated
            ? <><div style={{fontSize:9,color:"rgba(255,255,255,.35)"}}>BALANCE</div><div style={{fontWeight:900,color:"#4ade80",fontFamily:"monospace",fontSize:13}}>{formatCurrency(result?.newBalance ?? balance)}</div></>
            : <button onClick={()=>setLocation("/login")} style={{color:"#fbbf24",fontSize:13,background:"none",border:"none",cursor:"pointer"}}>Login</button>}
        </div>
      </div>

      <div style={{ maxWidth: 540, margin: "0 auto", padding: "12px 10px 24px" }}>
        <Road history={history} />

        {/* Rules */}
        <div style={{ background:"rgba(220,38,38,.08)", border:"1px solid rgba(220,38,38,.22)", borderRadius:11, padding:"8px 14px", marginBottom:12, fontSize:11, color:"rgba(255,255,255,.6)", textAlign:"center" }}>
          🃏 5 cards each · Highest point total wins · J=11 Q=12 K=13 A=14 · Pays <strong style={{color:"#4ade80"}}>1.95×</strong>
        </div>

        {/* ── 3D Casino Table ── */}
        <div style={{ perspective: 1000, perspectiveOrigin: "50% -10%", marginBottom: 12 }}>
          <div style={{
            transform: "rotateX(14deg)",
            transformOrigin: "50% 100%",
            position: "relative", overflow: "hidden",
            background: "radial-gradient(ellipse at 50% 30%,#0d5c35 0%,#074726 50%,#032d18 100%)",
            border: "5px solid #7c3a12",
            borderRadius: 22,
            padding: "22px 14px 20px",
            boxShadow: "0 30px 60px rgba(0,0,0,.8), inset 0 0 60px rgba(0,0,0,.4)",
          }}>
            {/* felt stitching */}
            <div style={{ position:"absolute", inset:6, borderRadius:17, border:"2px dashed rgba(255,255,255,.07)", pointerEvents:"none" }}/>
            <Confetti active={showConfetti}/>

            {/* Hands */}
            <div style={{ display:"flex", alignItems:"flex-start", gap:8 }}>
              <Hand label="YOUR HAND" cards={playerHand} revealed={phase==="betting"?[false,false,false,false,false]:revP} total={result?.playerTotal??0} courtCount={result?.playerCourt??0} isWinner={result ? result.winner==="player" : null} side="player"/>
              {/* VS divider */}
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", paddingTop:28, minWidth:44, gap:6 }}>
                <div style={{ fontSize:16, fontWeight:900, color:"rgba(255,255,255,.18)", letterSpacing:2 }}>VS</div>
                {phase==="result"&&result&&(
                  <div style={{ fontSize:12, color:"#fbbf24", fontWeight:900, textAlign:"center" }}>
                    {result.playerTotal}<br/>–<br/>{result.houseTotal}
                  </div>
                )}
              </div>
              <Hand label="HOUSE HAND" cards={houseHand} revealed={phase==="betting"?[false,false,false,false,false]:revH} total={result?.houseTotal??0} courtCount={result?.houseCourt??0} isWinner={result ? result.winner==="house" : null} side="house"/>
            </div>

            {/* Win pop */}
            {showWin && result?.won && (
              <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", textAlign:"center", zIndex:30, animation:"rmWin .5s cubic-bezier(.36,.07,.19,.97) both" }}>
                <div style={{ fontSize:36, fontWeight:900, color:"#fbbf24", textShadow:"0 0 24px #f59e0b", fontFamily:"Georgia,serif" }}>+{formatCurrency(result.winAmount)}</div>
                <div style={{ fontSize:13, color:"#4ade80", letterSpacing:3 }}>YOU WIN! 🎉</div>
              </div>
            )}

            {/* Status */}
            <div style={{ textAlign:"center", marginTop:14, minHeight:32 }}>
              {phase==="betting" && <p style={{ color:"rgba(255,255,255,.25)", fontSize:12, letterSpacing:2 }}>PICK YOUR SIDE AND DEAL</p>}
              {phase==="dealing" && <p style={{ color:"#4ade80", fontSize:13, fontWeight:900, letterSpacing:4, animation:"rmPulse .6s ease-in-out infinite" }}>DEALING CARDS...</p>}
              {phase==="result"&&result&&!showWin&&(
                <div style={{ display:"inline-block", padding:"7px 18px", borderRadius:10, background:result.won?"rgba(34,197,94,.15)":"rgba(239,68,68,.12)", border:`1px solid ${result.won?"rgba(34,197,94,.4)":"rgba(239,68,68,.3)"}` }}>
                  <span style={{ fontWeight:900, fontSize:14, color:result.won?"#4ade80":"#f87171", letterSpacing:2 }}>
                    {result.won?`YOU WIN! +${formatCurrency(result.winAmount)}`:`HOUSE WINS · −${formatCurrency(stake)}`}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Controls ── */}
        <div style={{ background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.08)", borderRadius:18, padding:16 }}>
          {phase==="result" ? (
            <button onClick={handleAgain} style={{ width:"100%", padding:14, borderRadius:13, background:"linear-gradient(135deg,#dc2626,#991b1b)", color:"white", fontWeight:900, fontSize:16, border:"none", cursor:"pointer", letterSpacing:3, boxShadow:"0 4px 20px rgba(220,38,38,.5)" }}>
              🃏 DEAL AGAIN
            </button>
          ) : (
            <>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
                {([
                  { id:"player" as Side, emoji:"🤲", label:"MY HAND WINS", sub:"Your cards score more points", color:"#22c55e" },
                  { id:"house"  as Side, emoji:"🏠", label:"HOUSE WINS",   sub:"House cards score more points", color:"#ef4444" },
                ]).map(opt=>(
                  <button key={opt.id} onClick={()=>phase==="betting"&&setSelection(opt.id)} disabled={phase!=="betting"}
                    style={{ padding:"13px 8px", borderRadius:12, textAlign:"center", border:`2px solid ${selection===opt.id?opt.color:"rgba(255,255,255,.09)"}`, background:selection===opt.id?`${opt.color}22`:"rgba(255,255,255,.04)", color:selection===opt.id?"white":"rgba(255,255,255,.38)", fontWeight:900, cursor:"pointer", boxShadow:selection===opt.id?`0 0 20px ${opt.color}44`:"none", transition:"all .2s" }}>
                    <div style={{fontSize:24}}>{opt.emoji}</div>
                    <div style={{fontSize:12,letterSpacing:1,marginTop:4}}>{opt.label}</div>
                    <div style={{fontSize:10,opacity:.5,marginTop:2}}>{opt.sub}</div>
                    <div style={{fontSize:11,color:"#4ade80",fontWeight:900,marginTop:3}}>1.95×</div>
                  </button>
                ))}
              </div>
              {/* Chips */}
              <div style={{ display:"flex", gap:7, marginBottom:11, justifyContent:"center" }}>
                {CHIPS.map(amt=>(
                  <button key={amt} onClick={()=>phase==="betting"&&setStake(amt)} disabled={phase!=="betting"}
                    style={{ width:50, height:50, borderRadius:"50%", border:`3px solid ${stake===amt?"#dc2626":"rgba(255,255,255,.18)"}`, background:stake===amt?"radial-gradient(circle at 38% 35%,#f87171,#dc2626)":"radial-gradient(circle at 38% 35%,#374151,#1f2937)", color:stake===amt?"white":"rgba(255,255,255,.45)", fontWeight:900, fontSize:11, cursor:"pointer", boxShadow:stake===amt?"0 0 16px rgba(220,38,38,.6),inset 0 2px 0 rgba(255,255,255,.2)":"inset 0 2px 0 rgba(255,255,255,.06)", transition:"all .2s" }}>
                    {amt>=1000?`${amt/1000}K`:amt}
                  </button>
                ))}
              </div>
              <div style={{ display:"flex", gap:8, marginBottom:12 }}>
                <input type="number" min="0" placeholder="Custom stake..." value={customStake} disabled={phase!=="betting"}
                  onChange={e=>{setCustomStake(e.target.value);const p=parseFloat(e.target.value);setStake(isNaN(p)?0:p);}}
                  style={{ flex:1, padding:"9px 13px", borderRadius:9, background:"rgba(255,255,255,.07)", border:"1px solid rgba(255,255,255,.12)", color:"white", fontSize:13, outline:"none" }}/>
                {stake>0&&selection&&(
                  <div style={{ padding:"9px 12px", borderRadius:9, background:"rgba(251,191,36,.1)", border:"1px solid rgba(251,191,36,.28)", color:"#fbbf24", fontSize:12, fontWeight:900, display:"flex", alignItems:"center", whiteSpace:"nowrap" }}>
                    WIN: {formatCurrency(Math.round(stake*1.95))}
                  </div>
                )}
              </div>
              {!isAuthenticated
                ? <button onClick={()=>setLocation("/login")} style={{ width:"100%", padding:13, borderRadius:12, background:"linear-gradient(135deg,#dc2626,#991b1b)", color:"white", fontWeight:900, fontSize:15, border:"none", cursor:"pointer" }}>LOG IN TO PLAY</button>
                : <>
                  <button onClick={handleDeal} disabled={!canDeal} style={{ width:"100%", padding:14, borderRadius:12, fontWeight:900, fontSize:16, letterSpacing:3, background:canDeal?"linear-gradient(135deg,#dc2626,#991b1b)":"rgba(255,255,255,.06)", color:canDeal?"white":"rgba(255,255,255,.22)", border:`2px solid ${canDeal?"rgba(220,38,38,.6)":"rgba(255,255,255,.06)"}`, cursor:canDeal?"pointer":"not-allowed", boxShadow:canDeal?"0 4px 24px rgba(220,38,38,.45)":"none", transition:"all .2s" }}>
                    {phase==="dealing"?"🃏 DEALING...":!selection?"PICK A SIDE":stake<=0?"ENTER STAKE":"🃏 DEAL CARDS"}
                  </button>
                  {stake>balance&&<p style={{color:"#f87171",fontSize:11,textAlign:"center",marginTop:6}}>Max: {formatCurrency(balance)}</p>}
                </>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
