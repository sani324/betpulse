import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey, getGetBalanceQueryKey } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";

/* ─── Game types ─── */
type CardObj = { rank: string; suit: string; value: number; isTrump: boolean };
type TrickResult = { playerCard: CardObj; houseCard: CardObj; winner: "player" | "house" | "draw" };
type Side = "player" | "house";
type Phase = "betting" | "dealing" | "tricks" | "result";
const CHIPS = [100, 500, 1000, 5000, 10000];

const SUIT_COLORS: Record<string, { primary: string; glow: string; emoji: string; name: string }> = {
  "♠": { primary: "#60a5fa", glow: "rgba(96,165,250,.8)", emoji: "♠", name: "Spades" },
  "♥": { primary: "#f87171", glow: "rgba(248,113,113,.8)", emoji: "♥", name: "Hearts" },
  "♦": { primary: "#fb923c", glow: "rgba(251,146,60,.8)", emoji: "♦", name: "Diamonds" },
  "♣": { primary: "#4ade80", glow: "rgba(74,222,128,.8)", emoji: "♣", name: "Clubs" },
};
const RANK_LABELS: Record<string, string> = { J: "J", Q: "Q", K: "K", A: "A" };
const IS_COURT = (r: string) => ["J","Q","K","A"].includes(r);

const CSS = `
@keyframes cardFlip{0%{transform:rotateY(180deg) scale(.8);opacity:0}60%{transform:rotateY(20deg) scale(1.06)}100%{transform:rotateY(0) scale(1);opacity:1}}
@keyframes trumpReveal{0%{transform:scale(0) rotate(-25deg);opacity:0}50%{transform:scale(1.2) rotate(4deg)}80%{transform:scale(.97) rotate(-2deg)}100%{transform:scale(1) rotate(0);opacity:1}}
@keyframes trumpGlow{0%,100%{box-shadow:0 0 20px var(--glow-color),inset 0 0 10px var(--glow-color)}50%{box-shadow:0 0 55px var(--glow-color),0 0 80px var(--glow-color),inset 0 0 20px var(--glow-color)}}
@keyframes trickWin{0%{transform:scale(1)}40%{transform:scale(1.25)}70%{transform:scale(.97)}100%{transform:scale(1)}}
@keyframes dealIn{0%{transform:translateY(-50px) scale(.7);opacity:0}70%{transform:translateY(4px) scale(1.03)}100%{transform:translateY(0) scale(1);opacity:1}}
@keyframes winPop{0%{transform:translate(-50%,-50%) scale(0) rotate(-12deg);opacity:0}60%{transform:translate(-50%,-50%) scale(1.3) rotate(3deg);opacity:1}100%{transform:translate(-50%,-50%) scale(1.05) rotate(-1deg);opacity:1}}
@keyframes countPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.15)}}
@keyframes roadIn{0%{transform:scale(0);opacity:0}100%{transform:scale(1);opacity:1}}
@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
@keyframes trickSlide{0%{opacity:0;transform:translateY(-10px)}100%{opacity:1;transform:translateY(0)}}
`;

function mkAudio(){return new((window as any).AudioContext||(window as any).webkitAudioContext)();}
function playCardFlip(){try{const c=mkAudio();const b=c.createBuffer(1,c.sampleRate*.04,c.sampleRate);const d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*(1-i/d.length)*.5;const s=c.createBufferSource(),g=c.createGain();s.buffer=b;s.connect(g);g.connect(c.destination);g.gain.setValueAtTime(.3,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.04);s.start();setTimeout(()=>c.close(),500);}catch(_){}}
function playTrumpReveal(){try{const c=mkAudio();[330,415,523,659,784].forEach((f,i)=>{const o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.type="triangle";o.frequency.value=f;const t=c.currentTime+i*.12;g.gain.setValueAtTime(.22,t);g.gain.exponentialRampToValueAtTime(.001,t+.4);o.start(t);o.stop(t+.4);});setTimeout(()=>c.close(),2500);}catch(_){}}
function playTrickWin(){try{const c=mkAudio();[440,554].forEach((f,i)=>{const o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.type="sine";o.frequency.value=f;const t=c.currentTime+i*.08;g.gain.setValueAtTime(.15,t);g.gain.exponentialRampToValueAtTime(.001,t+.2);o.start(t);o.stop(t+.2);});setTimeout(()=>c.close(),1000);}catch(_){}}
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
    const COLS=["#fbbf24","#f59e0b","#a78bfa","#fff","#4ade80"];
    pts.current=Array.from({length:80},()=>({x:Math.random()*cv.width,y:-20,vx:(Math.random()-.5)*5,vy:Math.random()*3+2,r:Math.random()*10+4,color:COLS[Math.floor(Math.random()*COLS.length)],life:0,maxLife:100+Math.random()*60,rot:0,vrot:(Math.random()-.5)*.35}));
    const loop=()=>{ctx.clearRect(0,0,cv.width,cv.height);pts.current=pts.current.filter(p=>p.life<p.maxLife);pts.current.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=.13;p.rot+=p.vrot;p.life++;ctx.save();ctx.globalAlpha=1-p.life/p.maxLife;ctx.translate(p.x,p.y);ctx.rotate(p.rot);ctx.beginPath();ctx.ellipse(0,0,p.r,p.r*.5,0,0,Math.PI*2);ctx.fillStyle=p.color;ctx.fill();ctx.restore();});if(pts.current.length)anim.current=requestAnimationFrame(loop);};
    anim.current=requestAnimationFrame(loop);
    return()=>cancelAnimationFrame(anim.current);
  },[active]);
  return <canvas ref={ref} style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none",zIndex:50}} />;
}

function PlayingCard({ card, revealed, delay = 0, highlight = false }: { card: CardObj; revealed: boolean; delay?: number; highlight?: boolean }) {
  const suitMeta = SUIT_COLORS[card.suit];
  const isCourt = IS_COURT(card.rank);
  return (
    <div style={{ width: 48, height: 66, position: "relative", animation: revealed ? `cardFlip .42s ease-out ${delay}s both` : undefined }}>
      {revealed ? (
        <div style={{
          width: "100%", height: "100%", borderRadius: 7,
          background: card.isTrump
            ? `linear-gradient(145deg, #1a0a00, #2d1a00)`
            : `linear-gradient(145deg, #0f172a, #1e293b)`,
          border: `2px solid ${card.isTrump ? "#fbbf24" : highlight ? "#a78bfa" : isCourt ? "rgba(255,255,255,.3)" : "rgba(255,255,255,.12)"}`,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          boxShadow: card.isTrump
            ? `0 0 18px rgba(251,191,36,.55),inset 0 0 8px rgba(251,191,36,.1)`
            : "0 3px 10px rgba(0,0,0,.6)",
          cursor: "default", transition: "transform .2s",
          ["--glow-color" as any]: suitMeta.glow,
          animation: card.isTrump && highlight ? "trumpGlow 1.3s ease-in-out infinite" : undefined,
        }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: suitMeta.primary, lineHeight: 1 }}>{card.rank}</div>
          <div style={{ fontSize: 15, color: suitMeta.primary, lineHeight: 1, marginTop: 1 }}>{card.suit}</div>
          {card.isTrump && <div style={{ fontSize: 7, color: "#fbbf24", fontWeight: 800, letterSpacing: .5, marginTop: 2 }}>RANG</div>}
          {isCourt && !card.isTrump && <div style={{ fontSize: 7, color: "rgba(255,255,255,.45)", letterSpacing: .5 }}>{RANK_LABELS[card.rank]}</div>}
        </div>
      ) : (
        <div style={{ width: "100%", height: "100%", borderRadius: 7, background: "repeating-linear-gradient(45deg,#1e3a5f,#1e3a5f 4px,#1a3357 4px,#1a3357 8px)", border: "2px solid rgba(255,255,255,.15)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 3px 10px rgba(0,0,0,.6)" }}>
          <div style={{ fontSize: 16, opacity: .35 }}>🂠</div>
        </div>
      )}
    </div>
  );
}

function TrumpBadge({ suit, revealed }: { suit: string; revealed: boolean }) {
  const m = SUIT_COLORS[suit];
  return (
    <div style={{
      display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 4,
      padding: "14px 24px", borderRadius: 20,
      background: `radial-gradient(ellipse at center, ${m.glow.replace(".8","0.2")} 0%, transparent 70%)`,
      border: `3px solid ${m.primary}`,
      boxShadow: `0 0 40px ${m.glow}, inset 0 0 20px ${m.glow.replace(".8",".08")}`,
      animation: revealed ? "trumpReveal .7s cubic-bezier(.36,.07,.19,.97) both" : undefined,
      ["--glow-color" as any]: m.glow,
    }}>
      <div style={{ fontSize: 52, lineHeight: 1, color: m.primary, filter: `drop-shadow(0 0 12px ${m.primary})` }}>{m.emoji}</div>
      <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 3, color: m.primary }}>RANG · {m.name.toUpperCase()}</div>
      <div style={{ fontSize: 10, color: "rgba(255,255,255,.4)", letterSpacing: 1 }}>TRUMP SUIT</div>
    </div>
  );
}

function TrickRow({ trick, idx, show }: { trick: TrickResult; idx: number; show: boolean }) {
  if (!show) return null;
  const pw = trick.winner === "player";
  const hw = trick.winner === "house";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", animation: "trickSlide .3s ease-out both", animationDelay: `${idx * .15}s` }}>
      <div style={{ width: 36, height: 50, borderRadius: 6, background: "#0f172a", border: `2px solid ${pw ? "#4ade80" : "rgba(255,255,255,.1)"}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900, color: SUIT_COLORS[trick.playerCard.suit].primary, boxShadow: pw ? "0 0 12px rgba(74,222,128,.5)" : "none" }}>
        {trick.playerCard.rank}<br />{trick.playerCard.suit}
      </div>
      <div style={{ fontSize: 10, fontWeight: 900, color: pw ? "#4ade80" : hw ? "#f87171" : "rgba(255,255,255,.3)", letterSpacing: 1 }}>
        {pw ? "YOU WIN" : hw ? "HOUSE" : "DRAW"}
      </div>
      <div style={{ width: 36, height: 50, borderRadius: 6, background: "#0f172a", border: `2px solid ${hw ? "#f87171" : "rgba(255,255,255,.1)"}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900, color: SUIT_COLORS[trick.houseCard.suit].primary, boxShadow: hw ? "0 0 12px rgba(248,113,113,.5)" : "none" }}>
        {trick.houseCard.rank}<br />{trick.houseCard.suit}
      </div>
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
        <circle cx={27} cy={27} r={r} stroke={s<=3?"#ef4444":"#fbbf24"} strokeWidth={3.5} fill="none" strokeDasharray={circ} strokeDashoffset={circ*(1-s/30)} style={{transition:"stroke-dashoffset .9s linear,stroke .3s"}} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 900, color: s<=3?"#ef4444":"white", animation: s<=3?"countPulse .5s ease-in-out infinite":undefined }}>{s}</div>
    </div>
  );
}

export default function RangGame() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [phase, setPhase] = useState<Phase>("betting");
  const [selection, setSelection] = useState<Side | null>(null);
  const [stake, setStake] = useState(0);
  const [customStake, setCustomStake] = useState("");
  const [result, setResult] = useState<any>(null);
  const [revealedPlayer, setRevealedPlayer] = useState<boolean[]>([false,false,false,false,false]);
  const [revealedHouse, setRevealedHouse] = useState<boolean[]>([false,false,false,false,false]);
  const [showTrump, setShowTrump] = useState(false);
  const [visibleTricks, setVisibleTricks] = useState(0);
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
    cdRef.current = setInterval(() => setCountdown(c => { if (c<=1){return 30;} return c-1; }), 1000);
    return () => { if (cdRef.current) clearInterval(cdRef.current); };
  }, [phase]);
  useEffect(() => () => { clearTmr(); if (cdRef.current) clearInterval(cdRef.current); }, []);

  const handleDeal = async () => {
    if (!selection || stake <= 0) { toast({ title: "Pick a side and enter stake first", variant: "destructive" }); return; }
    if (!isAuthenticated) { setLocation("/login"); return; }
    if (cdRef.current) clearInterval(cdRef.current);
    clearTmr();
    setPhase("dealing"); setResult(null); setShowCoins(false); setShowWinPop(false); setShowTrump(false); setVisibleTricks(0);
    setRevealedPlayer([false,false,false,false,false]);
    setRevealedHouse([false,false,false,false,false]);

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
      const roundId = placed.roundId as string;
      const myStake = stake, mySel = selection;
      qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
      qc.invalidateQueries({ queryKey: getGetBalanceQueryKey() });
      toast({ title: "Bet placed", description: "Waiting for the round to be settled..." });
      const startedAt = Date.now();
      const pollId: ReturnType<typeof setInterval> = setInterval(async () => {
        if (Date.now() - startedAt > 10 * 60 * 1000) { clearInterval(pollId); return; }
        try {
          const r = await fetch(`/api/games/casino-round/rang/${encodeURIComponent(roundId)}`, { credentials: "include" });
          if (!r.ok) return;
          const dd = await r.json();
          if (dd.status !== "settled") return;
          clearInterval(pollId);
          const data = { ...dd.details, winner: dd.result } as { trumpSuit: string; trumpCard: { rank: string; suit: string; isTrump?: boolean }; playerHand: { rank: string; suit: string; isTrump: boolean }[]; houseHand: { rank: string; suit: string; isTrump: boolean }[]; tricks: { playerCard: { rank: string; suit: string; isTrump?: boolean }; houseCard: { rank: string; suit: string; isTrump?: boolean }; winner: Side | "draw" }[]; playerTricks: number; houseTricks: number; winner: Side };
          const won = data.winner === mySel;
          const winAmount = won ? Math.round(myStake * 1.95 * 100) / 100 : 0;
          setResult({ ...data, won, winAmount, netChange: winAmount - myStake, newBalance: 0 });

          addTmr(() => { setShowTrump(true); playTrumpReveal(); }, 400);
          for (let i = 0; i < 5; i++) {
            addTmr(() => { playCardFlip(); setRevealedPlayer(rr => { const n=[...rr]; n[i]=true; return n; }); }, 1000 + i * 300);
            addTmr(() => { playCardFlip(); setRevealedHouse(rr => { const n=[...rr]; n[i]=true; return n; }); }, 1000 + i * 300 + 150);
          }
          const trickStart = 1000 + 4 * 300 + 150 + 500;
          setPhase("tricks");
          for (let t = 0; t < data.tricks.length; t++) {
            addTmr(() => { setVisibleTricks(t + 1); playTrickWin(); }, trickStart + t * 600);
          }
          addTmr(() => {
            setPhase("result"); setHistory(h => [...h, data.winner]);
            qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
            qc.invalidateQueries({ queryKey: getGetBalanceQueryKey() });
            if (won) { playWin(); addTmr(() => { setShowWinPop(true); setShowCoins(true); }, 300); addTmr(() => setShowCoins(false), 3500); }
            else playLose();
          }, trickStart + data.tricks.length * 600 + 400);
        } catch {}
      }, 1500);
    } catch { toast({ title: "Network Error", variant: "destructive" }); setPhase("betting"); }
  };

  const handleAgain = () => {
    clearTmr(); setPhase("betting"); setSelection(null); setStake(0); setCustomStake("");
    setResult(null); setShowCoins(false); setShowWinPop(false); setShowTrump(false); setVisibleTricks(0);
    setRevealedPlayer([false,false,false,false,false]);
    setRevealedHouse([false,false,false,false,false]);
  };

  const balance = user?.balance ?? 0;
  const canDeal = !!selection && stake > 0 && stake <= balance && phase === "betting";
  const EMPTY_HAND = Array.from({length:5}, () => ({ rank:"?", suit:"♠", value:0, isTrump:false }));

  const trumpMeta = result?.trumpSuit ? SUIT_COLORS[result.trumpSuit] : null;
  const playerTricks = result?.tricks?.filter((t: TrickResult) => t.winner === "player").length ?? 0;
  const houseTricks = result?.tricks?.filter((t: TrickResult) => t.winner === "house").length ?? 0;

  if (isLoading) return <div className="flex h-screen items-center justify-center" style={{background:"#050510"}}><div className="h-12 w-12 animate-spin rounded-full border-4 border-yellow-500 border-t-transparent" /></div>;

  return (
    <div className="min-h-screen pb-8" style={{ background: "radial-gradient(ellipse at top, #1a1000 0%, #050510 60%, #0a0800 100%)" }}>
      <style>{CSS}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,.08)", background: "rgba(0,0,0,.4)", backdropFilter: "blur(10px)", position: "sticky", top: 0, zIndex: 30 }}>
        <button onClick={() => setLocation("/")} style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,.5)", cursor: "pointer", background: "none", border: "none" }}>
          <ArrowLeft size={18} /><span style={{ fontSize: 13 }}>Back</span>
        </button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: 3, color: "white", fontFamily: "Georgia,serif" }}>🃏 RANG</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,.4)", letterSpacing: 2 }}>TRUMP CARD GAME · RUNG</div>
        </div>
        <div style={{ textAlign: "right" }}>
          {isAuthenticated
            ? <><div style={{fontSize:10,color:"rgba(255,255,255,.4)"}}>BALANCE</div><div style={{fontWeight:900,color:"#4ade80",fontFamily:"monospace",fontSize:14}}>{formatCurrency(result?.newBalance ?? balance)}</div></>
            : <button onClick={()=>setLocation("/login")} style={{color:"#fbbf24",fontSize:13,background:"none",border:"none",cursor:"pointer"}}>Login</button>}
        </div>
      </div>

      <div style={{ maxWidth: 620, margin: "0 auto", padding: "14px 12px" }}>
        <Road history={history} />

        {/* Rules banner */}
        <div style={{ background: "rgba(251,191,36,.08)", border: "1px solid rgba(251,191,36,.25)", borderRadius: 12, padding: "10px 16px", marginBottom: 14, fontSize: 12, color: "rgba(255,255,255,.6)", textAlign: "center" }}>
          🃏 A trump <strong style={{color:"#fbbf24"}}>Rang</strong> suit is revealed · Trump cards beat all others · Best of 5 tricks wins · Pays <strong style={{color:"#4ade80"}}>1.9×</strong>
        </div>

        {/* Main arena */}
        <div style={{ position: "relative", overflow: "hidden", background: "radial-gradient(ellipse at center,#120c00 0%,#060400 100%)", border: `3px solid ${trumpMeta ? trumpMeta.primary + "66" : "rgba(251,191,36,.35)"}`, borderRadius: 24, padding: "20px 14px 18px", marginBottom: 14, boxShadow: "inset 0 0 60px rgba(251,191,36,.05),0 0 50px rgba(0,0,0,.8)", transition: "border-color .5s" }}>
          <CoinParticles active={showCoins} />
          {phase === "betting" && <div style={{ position: "absolute", top: 14, right: 14 }}><Countdown s={countdown} /></div>}

          {/* TRUMP SUIT DISPLAY */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 18 }}>
            {!showTrump && phase === "betting" && (
              <div style={{ padding: "14px 28px", borderRadius: 16, border: "2px dashed rgba(251,191,36,.3)", background: "rgba(251,191,36,.04)", textAlign: "center" }}>
                <div style={{ fontSize: 36, opacity: .3 }}>🃏</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,.3)", letterSpacing: 2 }}>RANG (TRUMP) HIDDEN</div>
              </div>
            )}
            {!showTrump && phase !== "betting" && (
              <div style={{ padding: "14px 28px", borderRadius: 16, border: "2px solid rgba(251,191,36,.4)", background: "rgba(251,191,36,.08)", textAlign: "center" }}>
                <div style={{ fontSize: 12, color: "#fbbf24", letterSpacing: 2, fontWeight: 900 }}>REVEALING RANG...</div>
              </div>
            )}
            {showTrump && result && (
              <TrumpBadge suit={result.trumpSuit} revealed />
            )}
          </div>

          {/* Card table */}
          <div style={{ background: "rgba(21,128,61,.1)", border: "2px dashed rgba(255,255,255,.1)", borderRadius: 16, padding: "16px 10px" }}>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              {/* Player hand */}
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontWeight: 900, fontSize: 12, letterSpacing: 2, color: "#4ade80", marginBottom: 8 }}>YOUR HAND</div>
                <div style={{ display: "flex", gap: 4, justifyContent: "center", flexWrap: "wrap" }}>
                  {(result?.playerHand ?? EMPTY_HAND).map((card: CardObj, i: number) => (
                    <PlayingCard key={i} card={card} revealed={revealedPlayer[i] ?? false} delay={i * .18} />
                  ))}
                </div>
                {result && revealedPlayer.every(Boolean) && (
                  <div style={{ marginTop: 6, fontSize: 11, color: "#fbbf24", fontWeight: 900 }}>
                    👑 {result.playerTrumpCount} trump · {playerTricks} trick{playerTricks !== 1 ? "s" : ""}
                  </div>
                )}
              </div>

              {/* VS */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: 24 }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: "rgba(255,255,255,.2)", letterSpacing: 2 }}>VS</div>
                {phase !== "betting" && result && (
                  <div style={{ marginTop: 8, fontSize: 11, color: "#fbbf24", fontWeight: 900, textAlign: "center" }}>
                    {playerTricks}–{houseTricks}
                  </div>
                )}
              </div>

              {/* House hand */}
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontWeight: 900, fontSize: 12, letterSpacing: 2, color: "#f87171", marginBottom: 8 }}>HOUSE HAND</div>
                <div style={{ display: "flex", gap: 4, justifyContent: "center", flexWrap: "wrap" }}>
                  {(result?.houseHand ?? EMPTY_HAND).map((card: CardObj, i: number) => (
                    <PlayingCard key={i} card={card} revealed={revealedHouse[i] ?? false} delay={i * .18} />
                  ))}
                </div>
                {result && revealedHouse.every(Boolean) && (
                  <div style={{ marginTop: 6, fontSize: 11, color: "#fbbf24", fontWeight: 900 }}>
                    👑 {result.houseTrumpCount} trump · {houseTricks} trick{houseTricks !== 1 ? "s" : ""}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tricks display */}
          {(phase === "tricks" || phase === "result") && result?.tricks?.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,.4)", textAlign: "center", marginBottom: 8, letterSpacing: 2 }}>TRICK RESULTS</div>
              <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
                {result.tricks.slice(0, visibleTricks).map((trick: TrickResult, i: number) => (
                  <TrickRow key={i} trick={trick} idx={i} show />
                ))}
              </div>
            </div>
          )}

          {/* Win pop overlay */}
          {showWinPop && result && (
            <div style={{ position: "absolute", top: "50%", left: "50%", animation: "winPop .55s cubic-bezier(.36,.07,.19,.97) forwards", textAlign: "center", zIndex: 20 }}>
              <div style={{ fontSize: 34, fontWeight: 900, color: "#fbbf24", textShadow: "0 0 20px #f59e0b", fontFamily: "Georgia,serif" }}>+{formatCurrency(result.winAmount)}</div>
              <div style={{ fontSize: 13, color: "#4ade80", letterSpacing: 2 }}>YOU WIN 🎉</div>
            </div>
          )}

          {/* Status text */}
          <div style={{ textAlign: "center", marginTop: 14, minHeight: 36 }}>
            {phase === "betting" && <p style={{ color: "rgba(255,255,255,.3)", fontSize: 13 }}>Bet on which hand wins the most trump tricks!</p>}
            {phase === "dealing" && <p style={{ color: "#fbbf24", fontSize: 14, fontWeight: 900, letterSpacing: 3 }}>DEALING CARDS...</p>}
            {phase === "tricks" && <p style={{ color: "#a78bfa", fontSize: 13, fontWeight: 900, letterSpacing: 2 }}>PLAYING TRICKS...</p>}
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
            <button onClick={handleAgain} style={{ width: "100%", padding: "14px 0", borderRadius: 12, background: "linear-gradient(135deg,#92400e,#b45309,#d97706)", color: "white", fontWeight: 900, fontSize: 16, border: "none", cursor: "pointer", letterSpacing: 2 }}>🃏 DEAL AGAIN</button>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                {([
                  { id: "player" as Side, label: "🤲 MY HAND WINS",  sub: "I win more tricks", color: "#22c55e", bg: "linear-gradient(135deg,#22c55e30,#22c55e15)" },
                  { id: "house"  as Side, label: "🏠 HOUSE WINS",    sub: "House wins more tricks", color: "#ef4444", bg: "linear-gradient(135deg,#ef444430,#ef444415)" },
                ] as any[]).map(opt => (
                  <button key={opt.id} onClick={() => phase === "betting" && setSelection(opt.id)} disabled={phase !== "betting"}
                    style={{ padding: "16px 8px", borderRadius: 12, textAlign: "center", border: `2px solid ${selection === opt.id ? opt.color : "rgba(255,255,255,.1)"}`, background: selection === opt.id ? opt.bg : "rgba(255,255,255,.04)", color: selection === opt.id ? "white" : "rgba(255,255,255,.4)", cursor: "pointer", transition: "all .2s", boxShadow: selection === opt.id ? `0 0 22px ${opt.color}44` : "none" }}>
                    <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: 1 }}>{opt.label}</div>
                    <div style={{ fontSize: 11, opacity: .6, marginTop: 4 }}>{opt.sub}</div>
                    <div style={{ fontSize: 11, color: "#4ade80", fontWeight: 900, marginTop: 4 }}>Pays 1.9×</div>
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", gap: 8, marginBottom: 12, overflowX: "auto" }}>
                {CHIPS.map(amt => (
                  <button key={amt} onClick={() => phase === "betting" && setStake(amt)} disabled={phase !== "betting"}
                    style={{ flexShrink: 0, width: 54, height: 54, borderRadius: "50%", border: `3px solid ${stake===amt?"#fbbf24":"rgba(255,255,255,.2)"}`, background: stake===amt?"radial-gradient(circle at 40% 40%,#fbbf24,#b45309)":"radial-gradient(circle at 40% 40%,#374151,#1f2937)", color: stake===amt?"#1a0a00":"rgba(255,255,255,.5)", fontWeight: 900, fontSize: 12, cursor: "pointer", boxShadow: stake===amt?"0 0 18px rgba(251,191,36,.6),inset 0 2px 0 rgba(255,255,255,.3)":"inset 0 2px 0 rgba(255,255,255,.08)", transition: "all .2s" }}>
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
                    style={{ width: "100%", padding: 14, borderRadius: 12, fontWeight: 900, fontSize: 17, letterSpacing: 3, background: canDeal?"linear-gradient(135deg,#92400e,#b45309,#d97706)":"rgba(255,255,255,.07)", color: canDeal?"white":"rgba(255,255,255,.25)", border: `2px solid ${canDeal?"rgba(251,191,36,.7)":"rgba(255,255,255,.08)"}`, cursor: canDeal?"pointer":"not-allowed", boxShadow: canDeal?"0 4px 24px rgba(251,191,36,.4)":"none", transition: "all .2s" }}>
                    {phase !== "betting" ? "🃏 PLAYING..." : !selection ? "← PICK A SIDE" : stake <= 0 ? "ENTER STAKE" : "🃏 DEAL RANG"}
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
