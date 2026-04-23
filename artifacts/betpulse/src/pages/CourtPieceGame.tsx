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

const SUIT_COLOR: Record<string, string> = { "♠": "#e2e8f0", "♥": "#ef4444", "♦": "#ef4444", "♣": "#e2e8f0" };
const IS_COURT = (rank: string) => ["J", "Q", "K", "A"].includes(rank);
const COURT_LABEL: Record<string, string> = { J: "JACK", Q: "QUEEN", K: "KING", A: "ACE" };

const CSS = `
@keyframes cardFlip {
  0%   { transform: rotateY(180deg) scale(0.8); opacity: 0; }
  50%  { transform: rotateY(90deg) scale(1.05); }
  100% { transform: rotateY(0deg) scale(1); opacity: 1; }
}
@keyframes cardBack {
  0%   { transform: rotateY(0deg) scale(1); }
  100% { transform: rotateY(180deg) scale(0.9); }
}
@keyframes courtGlow {
  0%,100% { box-shadow: 0 0 15px rgba(251,191,36,.4); }
  50%      { box-shadow: 0 0 35px rgba(251,191,36,.9), 0 0 60px rgba(251,191,36,.4); }
}
@keyframes dealIn {
  0%   { transform: translateY(-60px) scale(0.7); opacity: 0; }
  70%  { transform: translateY(4px) scale(1.03); }
  100% { transform: translateY(0) scale(1); opacity: 1; }
}
@keyframes winPop { 0%{transform:translate(-50%,-50%) scale(0) rotate(-10deg);opacity:0} 60%{transform:translate(-50%,-50%) scale(1.3) rotate(3deg);opacity:1} 100%{transform:translate(-50%,-50%) scale(1.05) rotate(-1deg);opacity:1} }
@keyframes roadIn { 0%{transform:scale(0);opacity:0} 100%{transform:scale(1);opacity:1} }
@keytml courtCourtPop{0%{transform:scale(1)}40%{transform:scale(1.35)}100%{transform:scale(1)}}
@keyframes countPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.15)}}
@keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
`;

function mkAudio(){return new((window as any).AudioContext||(window as any).webkitAudioContext)();}
function playCardFlip(){
  try{const c=mkAudio();const b=c.createBuffer(1,c.sampleRate*.04,c.sampleRate);const d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*(1-i/d.length)*.5;const s=c.createBufferSource(),g=c.createGain();s.buffer=b;s.connect(g);g.connect(c.destination);g.gain.setValueAtTime(.3,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.04);s.start();setTimeout(()=>c.close(),500);}catch(_){}
}
function playCourtCard(){
  try{const c=mkAudio();[880,1100].forEach((f,i)=>{const o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.type="sine";o.frequency.value=f;const t=c.currentTime+i*.08;g.gain.setValueAtTime(.2,t);g.gain.exponentialRampToValueAtTime(.001,t+.3);o.start(t);o.stop(t+.3);});setTimeout(()=>c.close(),1000);}catch(_){}
}
function playWin(){try{const c=mkAudio();[523,659,784,1047,1319].forEach((f,i)=>{const o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.type="triangle";o.frequency.value=f;const t=c.currentTime+i*.13;g.gain.setValueAtTime(.25,t);g.gain.exponentialRampToValueAtTime(.001,t+.45);o.start(t);o.stop(t+.45);});setTimeout(()=>c.close(),2500);}catch(_){}}
function playLose(){try{const c=mkAudio();[350,295,240].forEach((f,i)=>{const o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.type="sawtooth";o.frequency.value=f;const t=c.currentTime+i*.22;g.gain.setValueAtTime(.12,t);g.gain.exponentialRampToValueAtTime(.001,t+.25);o.start(t);o.stop(t+.25);});setTimeout(()=>c.close(),2000);}catch(_){}}

function CoinParticles({ active }: { active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const anim = useRef(0);
  const pts = useRef<any[]>([]);
  useEffect(() => {
    if (!active){pts.current=[];return;}
    const cv=ref.current;if(!cv)return;const ctx=cv.getContext("2d");if(!ctx)return;
    cv.width=cv.offsetWidth;cv.height=cv.offsetHeight;
    const COLS=["#fbbf24","#f59e0b","#a855f7","#fff","#22c55e"];
    pts.current=Array.from({length:80},()=>({x:Math.random()*cv.width,y:-20,vx:(Math.random()-.5)*5,vy:Math.random()*3+2,r:Math.random()*10+4,color:COLS[Math.floor(Math.random()*COLS.length)],life:0,maxLife:100+Math.random()*60,rot:0,vrot:(Math.random()-.5)*.35}));
    const loop=()=>{ctx.clearRect(0,0,cv.width,cv.height);pts.current=pts.current.filter(p=>p.life<p.maxLife);pts.current.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=.13;p.rot+=p.vrot;p.life++;ctx.save();ctx.globalAlpha=1-p.life/p.maxLife;ctx.translate(p.x,p.y);ctx.rotate(p.rot);ctx.beginPath();ctx.ellipse(0,0,p.r,p.r*.5,0,0,Math.PI*2);ctx.fillStyle=p.color;ctx.fill();ctx.restore();});if(pts.current.length)anim.current=requestAnimationFrame(loop);};
    anim.current=requestAnimationFrame(loop);
    return()=>cancelAnimationFrame(anim.current);
  },[active]);
  return <canvas ref={ref} style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none",zIndex:50}} />;
}

function PlayingCard({ rank, suit, revealed, delay = 0, isCourt = false }: { rank: string; suit: string; revealed: boolean; delay?: number; isCourt?: boolean }) {
  const color = SUIT_COLOR[suit];
  const court = IS_COURT(rank);
  return (
    <div style={{
      width: 52, height: 72, borderRadius: 8, position: "relative",
      animation: revealed ? `cardFlip .45s ease-out ${delay}s both` : undefined,
    }}>
      {revealed ? (
        <div style={{
          width: "100%", height: "100%", borderRadius: 8,
          background: court ? "linear-gradient(135deg,#1a0a00,#2d1500)" : "linear-gradient(135deg,#0f172a,#1e293b)",
          border: `2px solid ${court ? "#fbbf24" : "rgba(255,255,255,.2)"}`,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          boxShadow: court && isCourt ? "0 0 20px rgba(251,191,36,.6),inset 0 0 10px rgba(251,191,36,.1)" : "0 4px 12px rgba(0,0,0,.6)",
          animation: court && isCourt ? "courtGlow 1.2s ease-in-out infinite" : undefined,
          cursor: "default",
        }}>
          <div style={{ fontSize: 20, fontWeight: 900, color, lineHeight: 1 }}>{rank}</div>
          <div style={{ fontSize: 16, color, lineHeight: 1, marginTop: 2 }}>{suit}</div>
          {court && <div style={{ fontSize: 7, color: "#fbbf24", fontWeight: 700, letterSpacing: .5, marginTop: 1 }}>{COURT_LABEL[rank]}</div>}
        </div>
      ) : (
        <div style={{
          width: "100%", height: "100%", borderRadius: 8,
          background: "repeating-linear-gradient(45deg,#1e3a5f,#1e3a5f 4px,#1a3357 4px,#1a3357 8px)",
          border: "2px solid rgba(255,255,255,.15)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 12px rgba(0,0,0,.6)",
        }}>
          <div style={{ fontSize: 18, opacity: .4 }}>🂠</div>
        </div>
      )}
    </div>
  );
}

function Hand({ label, cards, revealed, courtCount, isWinner, side }: { label: string; cards: { rank: string; suit: string }[]; revealed: boolean[]; courtCount: number; isWinner: boolean | null; side: Side }) {
  const sideColor = side === "player" ? "#22c55e" : "#ef4444";
  return (
    <div style={{ flex: 1, textAlign: "center" }}>
      <div style={{ fontWeight: 900, fontSize: 13, letterSpacing: 2, color: sideColor, marginBottom: 8 }}>{label}</div>
      <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 8 }}>
        {cards.map((card, i) => (
          <PlayingCard key={i} rank={card.rank} suit={card.suit} revealed={revealed[i] ?? false} delay={i * .18} isCourt={IS_COURT(card.rank)} />
        ))}
      </div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,.5)", marginTop: 4 }}>
        {revealed.filter(Boolean).length === cards.length && (
          <span style={{ color: "#fbbf24", fontWeight: 900 }}>
            👑 {courtCount} Court Card{courtCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>
      {isWinner !== null && revealed.every(Boolean) && (
        <div style={{ marginTop: 6, padding: "4px 12px", borderRadius: 8, display: "inline-block", background: isWinner ? `${sideColor}25` : "rgba(255,255,255,.05)", border: `1px solid ${isWinner ? sideColor : "rgba(255,255,255,.1)"}`, fontSize: 12, fontWeight: 900, color: isWinner ? sideColor : "rgba(255,255,255,.4)" }}>
          {isWinner ? "🏆 WINS!" : "LOSES"}
        </div>
      )}
    </div>
  );
}

function Road({ history }: { history: Side[] }) {
  return (
    <div style={{ display: "flex", gap: 5, justifyContent: "center", flexWrap: "wrap", marginBottom: 14, minHeight: 28 }}>
      {history.slice(-24).map((r, i) => (
        <div key={i} style={{ width: 26, height: 26, borderRadius: "50%", background: r === "player" ? "linear-gradient(135deg,#22c55e,#14532d)" : "linear-gradient(135deg,#ef4444,#991b1b)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900, color: "white", border: "1.5px solid rgba(255,255,255,.3)", boxShadow: "0 2px 8px rgba(0,0,0,.4)", animation: "roadIn .3s ease-out backwards", animationDelay: `${Math.min(i * .03, .3)}s` }}>
          {r === "player" ? "P" : "H"}
        </div>
      ))}
      {!history.length && <span style={{ color: "rgba(255,255,255,.25)", fontSize: 12 }}>Round history appears here</span>}
    </div>
  );
}

function Countdown({ s }: { s: number }) {
  const r=22; const circ=2*Math.PI*r;
  return (
    <div style={{ position: "relative", width: 54, height: 54 }}>
      <svg width={54} height={54} style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
        <circle cx={27} cy={27} r={r} stroke="rgba(255,255,255,.1)" strokeWidth={3.5} fill="none" />
        <circle cx={27} cy={27} r={r} stroke={s<=3?"#ef4444":"#22c55e"} strokeWidth={3.5} fill="none" strokeDasharray={circ} strokeDashoffset={circ*(1-s/30)} style={{transition:"stroke-dashoffset .9s linear,stroke .3s"}} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 900, color: s<=3?"#ef4444":"white", animation: s<=3?"countPulse .5s ease-in-out infinite":undefined }}>{s}</div>
    </div>
  );
}

export default function CourtPieceGame() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [phase, setPhase] = useState<Phase>("betting");
  const [selection, setSelection] = useState<Side | null>(null);
  const [stake, setStake] = useState(0);
  const [customStake, setCustomStake] = useState("");
  const [result, setResult] = useState<{ playerHand: any[]; houseHand: any[]; playerCourt: number; houseCourt: number; winner: Side; won: boolean; winAmount: number; newBalance: number } | null>(null);
  const [revealedPlayer, setRevealedPlayer] = useState<boolean[]>([false,false,false,false,false]);
  const [revealedHouse, setRevealedHouse] = useState<boolean[]>([false,false,false,false,false]);
  const [showCoins, setShowCoins] = useState(false);
  const [showWinPop, setShowWinPop] = useState(false);
  const [history, setHistory] = useState<Side[]>([]);
  const [countdown, setCountdown] = useState(30);
  const cdRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTmr = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const addTmr = (fn: () => void, ms: number) => { const t = setTimeout(fn, ms); timers.current.push(t); };

  useEffect(() => {
    if (phase !== "betting") return;
    setCountdown(30);
    if (cdRef.current) clearInterval(cdRef.current);
    cdRef.current = setInterval(() => setCountdown(c => { if (c <= 1){return 30;} return c-1; }), 1000);
    return () => { if (cdRef.current) clearInterval(cdRef.current); };
  }, [phase]);
  useEffect(() => () => { clearTmr(); if (cdRef.current) clearInterval(cdRef.current); }, []);

  const handleDeal = async () => {
    if (!selection || stake <= 0) { toast({ title: "Pick a side and stake first", variant: "destructive" }); return; }
    if (!isAuthenticated) { setLocation("/login"); return; }
    if (cdRef.current) clearInterval(cdRef.current);
    clearTmr(); setPhase("dealing"); setResult(null); setShowCoins(false); setShowWinPop(false);
    setRevealedPlayer([false,false,false,false,false]);
    setRevealedHouse([false,false,false,false,false]);
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
      const roundId = placed.roundId as string;
      const myStake = stake, mySel = selection;
      qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
      qc.invalidateQueries({ queryKey: getGetBalanceQueryKey() });
      toast({ title: "Bet placed", description: "⚡ Auto-Decider is running..." });
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
          for (let i = 0; i < 5; i++) {
            const idx = i;
            addTmr(() => {
              playCardFlip();
              if (IS_COURT(data.playerHand[idx].rank)) addTmr(() => playCourtCard(), 150);
              setRevealedPlayer(rr => { const n=[...rr]; n[idx]=true; return n; });
            }, 400 + idx * 350);
            addTmr(() => {
              playCardFlip();
              if (IS_COURT(data.houseHand[idx].rank)) addTmr(() => playCourtCard(), 150);
              setRevealedHouse(rr => { const n=[...rr]; n[idx]=true; return n; });
            }, 400 + idx * 350 + 180);
          }
          addTmr(() => {
            setResult({ playerHand: data.playerHand, houseHand: data.houseHand, playerCourt: data.playerCourt, houseCourt: data.houseCourt, winner: data.winner, won, winAmount, newBalance: 0 });
            setPhase("result"); setHistory(h => [...h, data.winner]);
            qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
            qc.invalidateQueries({ queryKey: getGetBalanceQueryKey() });
            if (won) { playWin(); addTmr(() => { setShowWinPop(true); setShowCoins(true); }, 300); addTmr(() => setShowCoins(false), 3500); }
            else playLose();
          }, 400 + 4 * 350 + 180 + 600);
        } catch {}
      }, 500);
    } catch { toast({ title: "Network Error", variant: "destructive" }); setPhase("betting"); }
  };

  const handleAgain = () => {
    clearTmr(); setPhase("betting"); setSelection(null); setStake(0); setCustomStake("");
    setResult(null); setShowCoins(false); setShowWinPop(false);
    setRevealedPlayer([false,false,false,false,false]);
    setRevealedHouse([false,false,false,false,false]);
  };

  const balance = user?.balance ?? 0;
  const canDeal = !!selection && stake > 0 && stake <= balance && phase === "betting";
  const EMPTY_HAND = [{rank:"?",suit:"♠"},{rank:"?",suit:"♠"},{rank:"?",suit:"♠"},{rank:"?",suit:"♠"},{rank:"?",suit:"♠"}];

  if (isLoading) return <div className="flex h-screen items-center justify-center" style={{background:"#050510"}}><div className="h-12 w-12 animate-spin rounded-full border-4 border-green-500 border-t-transparent" /></div>;

  return (
    <div className="min-h-screen pb-8" style={{ background: "radial-gradient(ellipse at top, #0a1f0a 0%, #050510 60%, #1a0a0a 100%)" }}>
      <style>{CSS}</style>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,.08)", background: "rgba(0,0,0,.4)", backdropFilter: "blur(10px)", position: "sticky", top: 0, zIndex: 30 }}>
        <button onClick={() => setLocation("/")} style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,.5)", cursor: "pointer", background: "none", border: "none" }}>
          <ArrowLeft size={18} /><span style={{ fontSize: 13 }}>Back</span>
        </button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: 3, color: "white", fontFamily: "Georgia,serif" }}>🃏 COURT PIECE</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,.4)", letterSpacing: 2 }}>CARD GAME · MOST COURT CARDS WINS</div>
        </div>
        <div style={{ textAlign: "right" }}>
          {isAuthenticated
            ? <><div style={{fontSize:10,color:"rgba(255,255,255,.4)"}}>BALANCE</div><div style={{fontWeight:900,color:"#4ade80",fontFamily:"monospace",fontSize:14}}>{formatCurrency(result?.newBalance??balance)}</div></>
            : <button onClick={()=>setLocation("/login")} style={{color:"#22c55e",fontSize:13,background:"none",border:"none",cursor:"pointer"}}>Login</button>}
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "14px 12px" }}>
        <Road history={history} />

        {/* Game rules banner */}
        <div style={{ background: "rgba(251,191,36,.08)", border: "1px solid rgba(251,191,36,.25)", borderRadius: 12, padding: "10px 16px", marginBottom: 14, fontSize: 12, color: "rgba(255,255,255,.6)", textAlign: "center" }}>
          👑 Court cards = <strong style={{color:"#fbbf24"}}>J · Q · K · A</strong> &nbsp;|&nbsp; Most court cards in 5 cards wins &nbsp;|&nbsp; Pays <strong style={{color:"#4ade80"}}>1.9×</strong>
        </div>

        {/* Arena */}
        <div style={{ position: "relative", overflow: "hidden", background: "radial-gradient(ellipse at center,#0b1a08 0%,#050f04 100%)", border: "3px solid rgba(34,197,94,.35)", borderRadius: 24, padding: "22px 16px 18px", marginBottom: 14, boxShadow: "inset 0 0 60px rgba(34,197,94,.06),0 0 50px rgba(0,0,0,.8)" }}>
          <CoinParticles active={showCoins} />
          {phase === "betting" && <div style={{ position: "absolute", top: 14, right: 14 }}><Countdown s={countdown} /></div>}

          {/* Card table felt */}
          <div style={{ background: "rgba(21,128,61,.15)", border: "2px dashed rgba(34,197,94,.2)", borderRadius: 16, padding: "18px 12px", position: "relative" }}>
            <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
              {/* Player hand */}
              <Hand
                label="YOUR HAND"
                cards={phase === "betting" ? EMPTY_HAND : (result?.playerHand ?? EMPTY_HAND)}
                revealed={phase === "betting" ? [false,false,false,false,false] : revealedPlayer}
                courtCount={result?.playerCourt ?? 0}
                isWinner={result ? result.winner === "player" : null}
                side="player"
              />
              {/* VS divider */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: 20 }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: "rgba(255,255,255,.25)", letterSpacing: 2 }}>VS</div>
                {phase === "result" && result && (
                  <div style={{ marginTop: 8, fontSize: 10, color: "#fbbf24", fontWeight: 900, textAlign: "center" }}>
                    {result.playerCourt} – {result.houseCourt}
                  </div>
                )}
              </div>
              {/* House hand */}
              <Hand
                label="HOUSE HAND"
                cards={phase === "betting" ? EMPTY_HAND : (result?.houseHand ?? EMPTY_HAND)}
                revealed={phase === "betting" ? [false,false,false,false,false] : revealedHouse}
                courtCount={result?.houseCourt ?? 0}
                isWinner={result ? result.winner === "house" : null}
                side="house"
              />
            </div>
          </div>

          {/* Win pop */}
          {showWinPop && result && (
            <div style={{ position: "absolute", top: "50%", left: "50%", animation: "winPop .55s cubic-bezier(.36,.07,.19,.97) forwards", textAlign: "center", zIndex: 20 }}>
              <div style={{ fontSize: 36, fontWeight: 900, color: "#fbbf24", textShadow: "0 0 20px #f59e0b", fontFamily: "Georgia,serif" }}>+{formatCurrency(result.winAmount)}</div>
              <div style={{ fontSize: 13, color: "#4ade80", letterSpacing: 2 }}>YOU WIN 🎉</div>
            </div>
          )}

          {/* Status */}
          <div style={{ textAlign: "center", marginTop: 14, minHeight: 36 }}>
            {phase === "betting" && <p style={{ color: "rgba(255,255,255,.3)", fontSize: 13 }}>Pick Your Hand or House Hand, then deal!</p>}
            {phase === "dealing" && <p style={{ color: "#4ade80", fontSize: 15, fontWeight: 900, letterSpacing: 3 }}>DEALING CARDS...</p>}
            {phase === "result" && result && !showWinPop && (
              <div style={{ padding: "8px 16px", borderRadius: 12, display: "inline-block", background: result.won ? "rgba(34,197,94,.15)" : "rgba(239,68,68,.12)", border: `1px solid ${result.won ? "rgba(34,197,94,.4)" : "rgba(239,68,68,.3)"}` }}>
                <span style={{ fontWeight: 900, fontSize: 15, color: result.won ? "#4ade80" : "#f87171", letterSpacing: 2 }}>
                  {result.won ? `YOUR HAND WINS! +${formatCurrency(result.winAmount)}` : `HOUSE WINS · -${formatCurrency(stake)}`}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 18, padding: 16 }}>
          {phase === "result" ? (
            <button onClick={handleAgain} style={{ width: "100%", padding: "14px 0", borderRadius: 12, background: "linear-gradient(135deg,#7c3aed,#4f46e5)", color: "white", fontWeight: 900, fontSize: 16, border: "none", cursor: "pointer", letterSpacing: 2 }}>🃏 DEAL AGAIN</button>
          ) : (
            <>
              {/* Side selection */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                {([
                  { id: "player" as Side, label: "🤲 MY HAND WINS", sub: "Your 5 cards get more J/Q/K/A", color: "#22c55e", bg: "linear-gradient(135deg,#22c55e,#16a34a)" },
                  { id: "house"  as Side, label: "🏠 HOUSE WINS",   sub: "House 5 cards get more J/Q/K/A", color: "#ef4444", bg: "linear-gradient(135deg,#ef4444,#dc2626)" },
                ] as any[]).map(opt => (
                  <button key={opt.id} onClick={() => phase === "betting" && setSelection(opt.id)} disabled={phase !== "betting"}
                    style={{ padding: "16px 8px", borderRadius: 12, textAlign: "center", border: `2px solid ${selection === opt.id ? opt.color : "rgba(255,255,255,.1)"}`, background: selection === opt.id ? `linear-gradient(135deg,${opt.color}30,${opt.color}15)` : "rgba(255,255,255,.04)", color: selection === opt.id ? "white" : "rgba(255,255,255,.4)", cursor: "pointer", transition: "all .2s", boxShadow: selection === opt.id ? `0 0 20px ${opt.color}44` : "none" }}>
                    <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: 1 }}>{opt.label}</div>
                    <div style={{ fontSize: 11, opacity: .6, marginTop: 4 }}>{opt.sub}</div>
                    <div style={{ fontSize: 11, color: "#4ade80", fontWeight: 900, marginTop: 4 }}>Pays 1.9×</div>
                  </button>
                ))}
              </div>

              {/* Chips */}
              <div style={{ display: "flex", gap: 8, marginBottom: 12, overflowX: "auto" }}>
                {CHIPS.map(amt => (
                  <button key={amt} onClick={() => phase === "betting" && setStake(amt)} disabled={phase !== "betting"}
                    style={{ flexShrink: 0, width: 54, height: 54, borderRadius: "50%", border: `3px solid ${stake===amt?"#22c55e":"rgba(255,255,255,.2)"}`, background: stake===amt?"radial-gradient(circle at 40% 40%,#4ade80,#16a34a)":"radial-gradient(circle at 40% 40%,#374151,#1f2937)", color: stake===amt?"white":"rgba(255,255,255,.5)", fontWeight: 900, fontSize: 12, cursor: "pointer", boxShadow: stake===amt?"0 0 18px rgba(34,197,94,.6),inset 0 2px 0 rgba(255,255,255,.2)":"inset 0 2px 0 rgba(255,255,255,.08)", transition: "all .2s" }}>
                    {amt>=1000?`${amt/1000}K`:amt}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <input type="number" min="0" placeholder="Custom stake..." value={customStake} disabled={phase !== "betting"}
                  onChange={e => { setCustomStake(e.target.value); const p=parseFloat(e.target.value); setStake(isNaN(p)?0:p); }}
                  style={{ flex: 1, padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.15)", color: "white", fontSize: 14, outline: "none" }} />
                {stake > 0 && (
                  <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(251,191,36,.12)", border: "1px solid rgba(251,191,36,.3)", color: "#fbbf24", fontSize: 12, fontWeight: 900, display: "flex", alignItems: "center", whiteSpace: "nowrap" }}>
                    WIN: {formatCurrency(Math.round(stake * 1.9))}
                  </div>
                )}
              </div>
              {!isAuthenticated ? (
                <button onClick={() => setLocation("/login")} style={{ width: "100%", padding: 14, borderRadius: 12, background: "linear-gradient(135deg,#7c3aed,#4f46e5)", color: "white", fontWeight: 900, fontSize: 16, border: "none", cursor: "pointer" }}>LOG IN TO PLAY</button>
              ) : (
                <>
                  <button onClick={handleDeal} disabled={!canDeal}
                    style={{ width: "100%", padding: 14, borderRadius: 12, fontWeight: 900, fontSize: 17, letterSpacing: 3, background: canDeal?"linear-gradient(135deg,#22c55e,#16a34a,#14532d)":"rgba(255,255,255,.07)", color: canDeal?"white":"rgba(255,255,255,.25)", border: `2px solid ${canDeal?"rgba(34,197,94,.7)":"rgba(255,255,255,.08)"}`, cursor: canDeal?"pointer":"not-allowed", boxShadow: canDeal?"0 4px 24px rgba(34,197,94,.5)":"none", transition: "all .2s" }}>
                    {phase === "dealing" ? "🃏 DEALING..." : !selection ? "← PICK A SIDE" : stake <= 0 ? "ENTER STAKE" : "🃏 DEAL CARDS"}
                  </button>
                  {stake > balance && <p style={{ color: "#f87171", fontSize: 12, textAlign: "center", marginTop: 8 }}>Insufficient balance</p>}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
