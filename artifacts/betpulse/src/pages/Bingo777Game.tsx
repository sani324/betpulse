import { useState, useCallback, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey, getGetBalanceQueryKey } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Zap } from "lucide-react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");
const BASE = import.meta.env.BASE_URL;

/* Bet options — completely different from card games */
const BET_TYPES = [
  { key:"triple7",  icon:"777",  label:"TRIPLE 7",  sub:"All three 7s", mult:50,  color:"#f5c542", dark:"#78350f", glow:"rgba(245,197,66,0.7)",  bg:"linear-gradient(135deg,#451a00,#92400e)" },
  { key:"double7",  icon:"77✕",  label:"DOUBLE 7",  sub:"Any two 7s",   mult:10,  color:"#fb923c", dark:"#7c2d12", glow:"rgba(251,146,60,0.6)",  bg:"linear-gradient(135deg,#431407,#9a3412)" },
  { key:"lucky7",   icon:"7⭐",  label:"LUCKY 7",   sub:"Any one 7",    mult:3,   color:"#4ade80", dark:"#14532d", glow:"rgba(74,222,128,0.6)",  bg:"linear-gradient(135deg,#052e16,#166534)" },
  { key:"anywin",   icon:"✦✦✦", label:"ANY WIN",   sub:"Any match",    mult:1.5, color:"#818cf8", dark:"#312e81", glow:"rgba(129,140,248,0.6)",  bg:"linear-gradient(135deg,#1e1b4b,#3730a3)" },
];

const CHIP_AMOUNTS = [100, 500, 1_000, 5_000, 10_000];
const CHIP_COLORS  = ["#ef4444","#f97316","#f5c542","#22c55e","#a855f7"];

/* Reel symbols */
const REEL_SYMS = ["7","🍒","⭐","BAR","🔔","7","🍋","7","💎"];

/* Prize chips shown horizontally */
const PRIZE_CHIPS = [
  { label:"GRAND",    value:"50×",  color:"#f5c542", bg:"radial-gradient(circle at 40% 35%,#fbbf24,#92400e)", glow:"rgba(245,197,66,0.8)" },
  { label:"JACKPOT",  value:"10×",  color:"#fff",    bg:"radial-gradient(circle at 40% 35%,#f87171,#7f1d1d)", glow:"rgba(248,113,113,0.7)" },
  { label:"MINOR",    value:"3×",   color:"#fff",    bg:"radial-gradient(circle at 40% 35%,#4ade80,#14532d)", glow:"rgba(74,222,128,0.6)" },
  { label:"BONUS",    value:"1.5×", color:"#fff",    bg:"radial-gradient(circle at 40% 35%,#818cf8,#312e81)", glow:"rgba(129,140,248,0.6)" },
];

const TICKER_MSG = "🏆 JACKPOT: PKR 2,45,32,000  ✦  🎰 GRAND PRIZE: PKR 75,00,000  ✦  🌟 LUCKY WINNER: +PKR 48,000  ✦  🎯 NEXT DRAW IN 30s  ✦  💰 LAST WIN: PKR 1,20,000  ✦  ";

const STYLES = `
  .b7-bg {
    background-color:#150000;
    background-image:
      radial-gradient(ellipse at top, #4a0a00 0%, transparent 60%),
      repeating-linear-gradient(90deg, rgba(245,197,66,0.04) 0px, rgba(245,197,66,0.04) 1px, transparent 1px, transparent 40px),
      repeating-linear-gradient(0deg,  rgba(245,197,66,0.04) 0px, rgba(245,197,66,0.04) 1px, transparent 1px, transparent 40px);
  }
  @keyframes b7-ticker { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
  @keyframes b7-glow   { 0%,100%{opacity:0.7} 50%{opacity:1} }
  @keyframes b7-pulse  { 0%,100%{text-shadow:0 0 12px #f5c54299,0 0 40px #f5c54255} 50%{text-shadow:0 0 28px #f5c542cc,0 0 80px #f5c54299} }
  @keyframes b7-reel   { 0%{transform:translateY(0)} 100%{transform:translateY(-800px)} }
  @keyframes b7-settle { 0%{transform:scale(1.4)} 60%{transform:scale(0.92)} 80%{transform:scale(1.06)} 100%{transform:scale(1)} }
  @keyframes b7-chipbounce { 0%,100%{transform:scale(1)} 50%{transform:scale(1.12)} }
  @keyframes b7-win    { 0%{transform:scale(0.5) rotate(-8deg);opacity:0} 60%{transform:scale(1.15) rotate(3deg);opacity:1} 80%{transform:scale(0.95)} 100%{transform:scale(1);opacity:1} }
  @keyframes b7-coin   { 0%{transform:translateY(-10px) rotate(0deg);opacity:1} 100%{transform:translateY(200px) rotate(720deg);opacity:0} }
  @keyframes b7-shake  { 0%,100%{transform:rotate(0deg)} 20%{transform:rotate(-3deg)} 40%{transform:rotate(3deg)} 60%{transform:rotate(-2deg)} 80%{transform:rotate(2deg)} }
  @keyframes b7-orb    { 0%,100%{opacity:0.15;transform:scale(1)} 50%{opacity:0.3;transform:scale(1.15)} }
  @keyframes b7-led    { 0%,49%{opacity:1} 50%,100%{opacity:0.2} }
  .b7-led  { animation:b7-led 0.55s step-start infinite; }
  .b7-led:nth-child(2n){ animation-delay:.28s; }
  .b7-led:nth-child(3n){ animation-delay:.10s; }
  .b7-led:nth-child(5n){ animation-delay:.42s; }
  @keyframes b7-float  { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-6px)} }
`;

function sound(type:"spin"|"stop"|"win"|"lose") {
  try {
    const C = (window as any).AudioContext||(window as any).webkitAudioContext;
    const c = new C();
    if (type==="spin") {
      const o=c.createOscillator(),g=c.createGain(); o.connect(g); g.connect(c.destination); o.type="square"; o.frequency.value=180; g.gain.setValueAtTime(0.04,c.currentTime); g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.08); o.start(); o.stop(c.currentTime+0.08);
    } else if (type==="stop") {
      [400,350].forEach((f,i)=>{ const o=c.createOscillator(),g=c.createGain(); o.connect(g); g.connect(c.destination); o.type="triangle"; o.frequency.value=f; const t=c.currentTime+i*0.08; g.gain.setValueAtTime(0.1,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.15); o.start(t); o.stop(t+0.15); });
    } else if (type==="win") {
      [523,659,784,880,1047,1319].forEach((f,i)=>{ const o=c.createOscillator(),g=c.createGain(); o.connect(g); g.connect(c.destination); o.type="triangle"; o.frequency.value=f; const t=c.currentTime+i*0.1; g.gain.setValueAtTime(0.25,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.4); o.start(t); o.stop(t+0.4); });
    } else {
      [220,180,150].forEach((f,i)=>{ const o=c.createOscillator(),g=c.createGain(); o.connect(g); g.connect(c.destination); o.type="sawtooth"; o.frequency.value=f; const t=c.currentTime+i*0.2; g.gain.setValueAtTime(0.08,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.25); o.start(t); o.stop(t+0.25); });
    }
    setTimeout(()=>c.close(),3000);
  } catch(_){}
}

/* ── LED strip ── */
function LedRow({ count=24, cols=["#f5c542","#ef4444","#fb923c","#fbbf24"] }:{ count?:number; cols?:string[] }) {
  return (
    <div style={{ display:"flex", gap:4, justifyContent:"center", padding:"5px 8px" }}>
      {Array.from({length:count},(_,i)=>(
        <div key={i} className="b7-led" style={{ width:9, height:9, borderRadius:"50%", background:cols[i%cols.length], boxShadow:`0 0 7px ${cols[i%cols.length]}` }}/>
      ))}
    </div>
  );
}

/* ── Single slot reel ── */
function SlotReel({ spinning, symbol, delay=0, settled }:{ spinning:boolean; symbol:string; delay?:number; settled:boolean }) {
  const spinDuration = `${0.06}s`;
  return (
    <div style={{
      width:88, height:110, borderRadius:14, overflow:"hidden", position:"relative",
      background:"linear-gradient(180deg,#fef9e7 0%,#fff 30%,#fff 70%,#fef9e7 100%)",
      border:"3px solid #f5c542",
      boxShadow:"0 0 20px rgba(245,197,66,0.5), inset 0 2px 6px rgba(0,0,0,0.1)",
    }}>
      {/* Gradient overlays top/bottom for reel blur effect */}
      <div style={{ position:"absolute", top:0, left:0, right:0, height:28, background:"linear-gradient(180deg,rgba(254,249,231,0.95),transparent)", zIndex:2 }}/>
      <div style={{ position:"absolute", bottom:0, left:0, right:0, height:28, background:"linear-gradient(0deg,rgba(254,249,231,0.95),transparent)", zIndex:2 }}/>

      {spinning ? (
        /* Spinning: rapid cycling */
        <div style={{ display:"flex", flexDirection:"column", animation:`b7-reel ${spinDuration} linear infinite` }}>
          {[...REEL_SYMS,...REEL_SYMS,...REEL_SYMS,...REEL_SYMS,...REEL_SYMS].map((s,i)=>(
            <div key={i} style={{ height:110, display:"flex", alignItems:"center", justifyContent:"center", fontSize:42, fontWeight:900, color:s==="7"?"#dc2626":"#1a1a2e", filter:s==="7"?"drop-shadow(0 0 4px #f5c54288)":"none" }}>{s}</div>
          ))}
        </div>
      ) : (
        /* Settled */
        <div style={{
          height:"100%", display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:symbol==="7"?58:42, fontWeight:900,
          color:symbol==="7"?"#dc2626":"#1a1a2e",
          animation: settled?`b7-settle 0.5s cubic-bezier(.34,1.56,.64,1) ${delay}s both`:"none",
          filter:symbol==="7"?"drop-shadow(0 0 8px #f5c542)":"none",
        }}>
          {symbol}
        </div>
      )}

      {/* Centre line */}
      <div style={{ position:"absolute", left:0, right:0, top:"50%", height:2, background:"rgba(245,197,66,0.3)", transform:"translateY(-50%)", zIndex:1 }}/>
    </div>
  );
}

/* ── Coin rain ── */
function CoinRain() {
  return (
    <div style={{ position:"absolute", inset:0, overflow:"hidden", pointerEvents:"none", zIndex:15 }}>
      {Array.from({length:26},(_,i)=>(
        <div key={i} style={{ position:"absolute", fontSize:i%3===0?22:16, left:`${2+i*3.6}%`, top:"-6%", animation:`b7-coin ${0.65+Math.random()*0.55}s ease-in ${i*0.06}s both` }}>
          {["💰","🎰","✨","⭐","🪙","💎","777"][i%7]}
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════
   MAIN
══════════════════════════════════════════ */
export default function Bingo777Game() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [stake,     setStake]     = useState(500);
  const [betType,   setBetType]   = useState<string|null>(null);
  const [phase,     setPhase]     = useState<"idle"|"spinning"|"result">("idle");
  const [result,    setResult]    = useState<any>(null);
  const [balance,   setBalance]   = useState<number>(parseFloat(user?.balance||"0"));
  const [isPlacing, setIsPlacing] = useState(false);

  /* Reel state */
  const [reelSymbols, setReelSymbols] = useState(["7","7","7"]);
  const [reelStopped, setReelStopped] = useState([false,false,false]);
  const [showResult,  setShowResult]  = useState(false);

  const tickRef = useRef(0);

  useEffect(()=>{ setBalance(parseFloat(user?.balance||"0")); },[user?.balance]);

  /* Map result string to reel display */
  const getReelSymbols = (res:string):string[] => {
    if (res==="triple7") return ["7","7","7"];
    if (res==="double7") return ["7","7","🍒"];
    if (res==="lucky7")  return ["7","🍒","🔔"];
    return ["⭐","⭐","⭐"]; // anywin — 3 matching non-7
  };

  const pollRound = useCallback(async (rId:string, sel:string) => {
    tickRef.current = 0;
    const iv = setInterval(async () => {
      tickRef.current++;
      if (tickRef.current>200) { clearInterval(iv); setPhase("idle"); return; }
      try {
        const r = await fetch(`${API}/api/games/casino-round/bingo-777/${rId}`,{credentials:"include"});
        const data = await r.json();
        if (data.status==="settled") {
          clearInterval(iv);
          setResult(data);
          const syms = getReelSymbols(data.result||sel);
          setReelSymbols(syms);
          /* Stop reels one by one */
          [0,1,2].forEach(i=>{
            setTimeout(()=>{
              setReelStopped(prev=>{ const n=[...prev]; n[i]=true; return n; });
              sound("stop");
            }, i*600);
          });
          setTimeout(()=>{
            setShowResult(true);
            setPhase("result");
            if (data.result===sel||!data.result) sound("win"); else sound("lose");
            queryClient.invalidateQueries({queryKey:getGetMeQueryKey()});
            queryClient.invalidateQueries({queryKey:getGetBalanceQueryKey()});
          }, 2400);
        }
      } catch(_) {}
    }, 500);
  },[queryClient]);

  const placeBet = async () => {
    if (!isAuthenticated) { setLocation("/login"); return; }
    if (!betType) { toast({title:"Select a bet type!",variant:"destructive"}); return; }
    if (balance<stake) { toast({title:"Insufficient balance!",variant:"destructive"}); return; }
    setIsPlacing(true);
    try {
      const r = await fetch(`${API}/api/games/bingo-777`,{
        method:"POST", credentials:"include",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({stake,selection:betType}),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error||"Failed");
      setBalance(data.newBalance);
      setReelStopped([false,false,false]);
      setShowResult(false); setResult(null);
      setPhase("spinning");
      sound("spin");
      pollRound(data.roundId, betType);
      toast({title:"🎰 Spinning!", description:`${formatCurrency(stake)} on ${BET_TYPES.find(b=>b.key===betType)?.label}`});
    } catch(e:any) {
      toast({title:"Error",description:e.message,variant:"destructive"});
    } finally { setIsPlacing(false); }
  };

  const reset = ()=>{ setPhase("idle"); setResult(null); setBetType(null); setReelStopped([false,false,false]); setShowResult(false); setReelSymbols(["7","7","7"]); };

  const selBet  = BET_TYPES.find(b=>b.key===betType);
  const won     = !!result && (result.result===betType||!result.result);
  const profit  = selBet ? stake*(selBet.mult-1) : 0;
  const isSpinning = phase==="spinning";
  const reelsStopped = reelStopped.every(Boolean);

  return (
    <div className="b7-bg" style={{ minHeight:"100vh", display:"flex", flexDirection:"column", color:"#fff", overflowX:"hidden" }}>
      <style>{STYLES}</style>

      {/* Ambient orbs */}
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0 }}>
        <div style={{ position:"absolute", top:"0%", left:"20%", width:320, height:320, borderRadius:"50%", background:"rgba(220,38,38,0.15)", filter:"blur(80px)", animation:"b7-orb 5s ease-in-out infinite" }}/>
        <div style={{ position:"absolute", top:"20%", right:"10%", width:260, height:260, borderRadius:"50%", background:"rgba(245,197,66,0.1)", filter:"blur(70px)", animation:"b7-orb 7s ease-in-out 2s infinite" }}/>
        <div style={{ position:"absolute", bottom:"20%", left:"5%", width:200, height:200, borderRadius:"50%", background:"rgba(251,146,60,0.08)", filter:"blur(60px)", animation:"b7-orb 6s ease-in-out 1s infinite" }}/>
      </div>

      {/* ── HEADER ── */}
      <header style={{ position:"sticky", top:0, zIndex:50, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 12px", background:"rgba(21,0,0,0.94)", borderBottom:"1px solid rgba(245,197,66,0.3)", backdropFilter:"blur(12px)" }}>
        <button onClick={()=>setLocation("/")} style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 10px", borderRadius:9, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.6)", cursor:"pointer", fontSize:13, fontWeight:600 }}>
          <ArrowLeft size={14}/> Back
        </button>

        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <img src={`${BASE}bingo777-logo.jpg`} alt="777 Bingo" style={{ height:40, width:"auto", borderRadius:8, objectFit:"contain", filter:"drop-shadow(0 0 10px rgba(245,197,66,0.7))" }}/>
        </div>

        <div style={{ padding:"5px 10px", borderRadius:9, background:"rgba(245,197,66,0.1)", border:"1px solid rgba(245,197,66,0.28)", color:"#f5c542", fontSize:13, fontWeight:800 }}>
          {formatCurrency(balance)}
        </div>
      </header>

      {/* ── JACKPOT TICKER ── */}
      <div style={{ overflow:"hidden", background:"linear-gradient(90deg,#7f1d1d,#991b1b,#7f1d1d)", borderBottom:"2px solid rgba(245,197,66,0.4)", padding:"7px 0" }}>
        <div style={{ display:"flex", gap:0, animation:"b7-ticker 14s linear infinite", whiteSpace:"nowrap" }}>
          <span style={{ fontSize:12, fontWeight:800, letterSpacing:2, color:"#fbbf24", paddingRight:40 }}>{TICKER_MSG}{TICKER_MSG}</span>
        </div>
      </div>

      <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", padding:"10px 10px 24px", gap:10, maxWidth:460, margin:"0 auto", width:"100%", position:"relative", zIndex:1 }}>

        {/* ── HORIZONTAL PRIZE CHIPS ── */}
        <div style={{ width:"100%", display:"flex", gap:6, justifyContent:"space-between" }}>
          {PRIZE_CHIPS.map((p,i)=>(
            <div key={i} style={{
              flex:1, padding:"10px 4px", borderRadius:14, textAlign:"center",
              background:p.bg, border:`2px solid rgba(255,255,255,0.15)`,
              boxShadow:`0 0 18px ${p.glow}`,
            }}>
              <div style={{ fontSize:10, fontWeight:900, letterSpacing:2, color:"rgba(255,255,255,0.65)", textTransform:"uppercase" }}>{p.label}</div>
              <div style={{ fontSize:22, fontWeight:900, color:p.color, lineHeight:1.1, marginTop:2, animation:"b7-glow 2s ease-in-out infinite" }}>{p.value}</div>
            </div>
          ))}
        </div>

        {/* ── SLOT MACHINE PANEL ── */}
        <div style={{
          width:"100%", borderRadius:24, overflow:"hidden", position:"relative",
          background:"linear-gradient(180deg,#3d0000 0%,#1a0000 40%,#0d0000 100%)",
          border:"3px solid rgba(245,197,66,0.5)",
          boxShadow:"0 0 60px rgba(220,38,38,0.3), 0 0 30px rgba(245,197,66,0.15), inset 0 0 40px rgba(0,0,0,0.7)",
        }}>
          <LedRow count={22}/>

          <div style={{ padding:"14px 12px 10px", display:"flex", flexDirection:"column", alignItems:"center", gap:12, position:"relative" }}>
            {phase==="result" && won && <CoinRain/>}

            {/* Machine label */}
            <div style={{ textAlign:"center" }}>
              <span style={{ fontSize:11, fontWeight:800, letterSpacing:5, color:"rgba(245,197,66,0.45)", textTransform:"uppercase" }}>
                {isSpinning?"🎰 SPINNING...":phase==="result"?"🎰 RESULT":"🎰 INSERT COIN"}
              </span>
            </div>

            {/* The 3 Reels */}
            <div style={{ display:"flex", gap:10, alignItems:"center", justifyContent:"center", position:"relative", zIndex:5 }}>
              {/* Left decorative column */}
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                <div style={{ width:18, height:18, borderRadius:"50%", background:isSpinning?"#ef4444":"#4ade80", boxShadow:isSpinning?"0 0 10px #ef4444":"0 0 10px #4ade80", transition:"all 0.3s" }}/>
                <div style={{ width:18, height:18, borderRadius:"50%", background:isSpinning?"#f5c542":"#4ade80", boxShadow:isSpinning?"0 0 10px #f5c542":"0 0 10px #4ade80", transition:"all 0.3s", animationDelay:"0.2s" }}/>
                <div style={{ width:18, height:18, borderRadius:"50%", background:isSpinning?"#fb923c":"#4ade80", boxShadow:isSpinning?"0 0 10px #fb923c":"0 0 10px #4ade80", transition:"all 0.3s" }}/>
              </div>

              {[0,1,2].map(i=>(
                <SlotReel key={i} spinning={isSpinning && !reelStopped[i]} symbol={reelSymbols[i]} delay={i*0.12} settled={reelStopped[i]||phase==="idle"}/>
              ))}

              {/* Right decorative column */}
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                <div style={{ width:18, height:18, borderRadius:"50%", background:isSpinning?"#fb923c":"#4ade80", boxShadow:isSpinning?"0 0 10px #fb923c":"0 0 10px #4ade80", transition:"all 0.3s" }}/>
                <div style={{ width:18, height:18, borderRadius:"50%", background:isSpinning?"#f5c542":"#4ade80", boxShadow:isSpinning?"0 0 10px #f5c542":"0 0 10px #4ade80", transition:"all 0.3s" }}/>
                <div style={{ width:18, height:18, borderRadius:"50%", background:isSpinning?"#ef4444":"#4ade80", boxShadow:isSpinning?"0 0 10px #ef4444":"0 0 10px #4ade80", transition:"all 0.3s" }}/>
              </div>
            </div>

            {/* Result overlay (inside machine) */}
            {showResult && (
              <div style={{
                padding:"12px 28px", borderRadius:16, textAlign:"center",
                background: won?"linear-gradient(135deg,#78350f,#b45309)":"linear-gradient(135deg,#450a0a,#7f1d1d)",
                border:`2px solid ${won?"#f5c542":"#ef4444"}`,
                boxShadow:`0 0 40px ${won?"rgba(245,197,66,0.5)":"rgba(239,68,68,0.4)"}`,
                animation:"b7-win 0.5s cubic-bezier(.34,1.56,.64,1) forwards",
                position:"relative", zIndex:20,
              }}>
                <div style={{ fontSize:36 }}>{won?"🏆":"😔"}</div>
                <div style={{ fontSize:20, fontWeight:900, letterSpacing:3, color:won?"#fde68a":"#f87171", marginTop:2 }}>
                  {won?"YOU WON!":"NO LUCK"}
                </div>
                {won&&<div style={{ fontSize:18, fontWeight:900, color:"#4ade80", marginTop:4 }}>+{formatCurrency(profit)}</div>}
              </div>
            )}

            {/* Idle state: 777 decorative display */}
            {phase==="idle" && !showResult && (
              <div style={{ display:"flex", gap:14, alignItems:"center" }}>
                {["7","7","7"].map((s,i)=>(
                  <div key={i} style={{ fontSize:14, fontWeight:900, color:"rgba(245,197,66,0.3)", letterSpacing:1 }}>—</div>
                ))}
              </div>
            )}
          </div>

          {/* Handle bar decoration */}
          <div style={{ display:"flex", justifyContent:"center", paddingBottom:10 }}>
            <div style={{ width:6, height:30, borderRadius:3, background:"linear-gradient(180deg,#f5c542,#92400e)", boxShadow:"0 0 8px rgba(245,197,66,0.4)" }}/>
          </div>

          <LedRow count={22}/>
        </div>

        {/* ── RESULT ACTION / CONTROLS ── */}
        {phase==="result" && (
          <button onClick={reset} style={{
            width:"100%", padding:"14px 0", borderRadius:16, fontWeight:900, fontSize:16, letterSpacing:3,
            background:"linear-gradient(135deg,#7f1d1d 0%,#dc2626 50%,#7f1d1d 100%)",
            color:"#fbbf24", border:"2px solid rgba(245,197,66,0.5)", cursor:"pointer",
            boxShadow:"0 0 30px rgba(220,38,38,0.5)",
          }}>🎰 SPIN AGAIN</button>
        )}

        {phase!=="result" && !isSpinning && (
          <>
            {/* ── BET TYPE GRID (2×2) ── completely different from card games */}
            <p style={{ fontSize:10, fontWeight:800, letterSpacing:4, color:"rgba(245,197,66,0.4)", textTransform:"uppercase", margin:0 }}>SELECT YOUR BET</p>
            <div style={{ width:"100%", display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              {BET_TYPES.map(b=>{
                const isSel = betType===b.key;
                return (
                  <button key={b.key} onClick={()=>setBetType(b.key)} style={{
                    padding:"12px 8px", borderRadius:14,
                    background: isSel ? b.bg : "rgba(255,255,255,0.04)",
                    border:`2px solid ${isSel?b.color:"rgba(245,197,66,0.12)"}`,
                    boxShadow: isSel?`0 0 28px ${b.glow}`:"none",
                    cursor:"pointer", transition:"all 0.16s",
                    transform: isSel?"scale(1.03)":"scale(1)",
                    display:"flex", flexDirection:"column", alignItems:"center", gap:4,
                  }}>
                    {/* Big multiplier */}
                    <div style={{ fontSize:22, fontWeight:900, color:isSel?b.color:"rgba(255,255,255,0.2)", fontFamily:"monospace", letterSpacing:1, lineHeight:1 }}>
                      {b.icon}
                    </div>
                    <div style={{ fontSize:13, fontWeight:900, color:isSel?b.color:"rgba(255,255,255,0.55)", letterSpacing:1 }}>{b.label}</div>
                    <div style={{ fontSize:10, color:isSel?"rgba(255,255,255,0.55)":"rgba(255,255,255,0.2)" }}>{b.sub}</div>
                    <div style={{
                      fontSize:14, fontWeight:900, padding:"3px 12px", borderRadius:8,
                      background:`${b.color}${isSel?"25":"12"}`,
                      color:b.color, border:`1px solid ${b.color}${isSel?"55":"22"}`,
                    }}>×{b.mult}</div>
                  </button>
                );
              })}
            </div>

            {/* ── COLORED BINGO BALL CHIPS (unique style) ── */}
            <p style={{ fontSize:10, fontWeight:800, letterSpacing:4, color:"rgba(245,197,66,0.35)", textTransform:"uppercase", margin:0 }}>STAKE AMOUNT</p>
            <div style={{ display:"flex", gap:7, justifyContent:"center", alignItems:"center" }}>
              {CHIP_AMOUNTS.map((amt,idx)=>{
                const active = stake===amt;
                const col = CHIP_COLORS[idx];
                return (
                  <button key={amt} onClick={()=>setStake(amt)} style={{
                    width:55, height:55, borderRadius:"50%", fontWeight:900, fontSize:10,
                    border:`3px solid ${active?col:"rgba(255,255,255,0.12)"}`,
                    background: active
                      ? `radial-gradient(circle at 35% 30%,${col}dd,${col}66)`
                      : `radial-gradient(circle at 35% 30%,rgba(255,255,255,0.08),rgba(0,0,0,0.3))`,
                    color: active?"#fff":"rgba(255,255,255,0.35)",
                    cursor:"pointer",
                    boxShadow: active?`0 0 20px ${col}88, 0 4px 12px rgba(0,0,0,0.5), inset 0 2px 0 rgba(255,255,255,0.4)`:"inset 0 2px 0 rgba(255,255,255,0.06)",
                    animation: active?"b7-chipbounce 0.9s ease-in-out infinite":"none",
                    transition:"all 0.15s",
                    position:"relative",
                  }}>
                    {/* Ball number text */}
                    <span style={{ display:"block", lineHeight:1.2 }}>{amt>=1000?`${amt/1000}K`:amt}</span>
                  </button>
                );
              })}
            </div>

            {/* Info row */}
            <div style={{ width:"100%", display:"flex", justifyContent:"space-between", padding:"7px 14px", borderRadius:10, background:"rgba(0,0,0,0.5)", border:"1px solid rgba(245,197,66,0.15)" }}>
              <span style={{ fontSize:12, color:"rgba(255,255,255,0.35)", fontWeight:700 }}>WIN: <span style={{ color:"#4ade80" }}>{betType?formatCurrency(stake*(BET_TYPES.find(b=>b.key===betType)?.mult??1)):"—"}</span></span>
              <span style={{ fontSize:12, color:"rgba(255,255,255,0.35)", fontWeight:700 }}>BET: <span style={{ color:"#f5c542" }}>{formatCurrency(stake)}</span></span>
              <span style={{ fontSize:12, color:"rgba(255,255,255,0.35)", fontWeight:700 }}>BAL: <span style={{ color:"#fb923c" }}>{formatCurrency(balance)}</span></span>
            </div>

            {/* Spin button */}
            {isAuthenticated ? (
              <button onClick={placeBet} disabled={isPlacing||!betType} style={{
                width:"100%", padding:"17px 0", borderRadius:16, fontWeight:900, fontSize:19, letterSpacing:3,
                background: betType
                  ? "linear-gradient(135deg,#7f1d1d 0%,#b91c1c 20%,#f5c542 50%,#b91c1c 80%,#7f1d1d 100%)"
                  : "rgba(255,255,255,0.04)",
                color: betType?"#fff":"rgba(255,255,255,0.15)",
                border:`2px solid ${betType?"rgba(245,197,66,0.6)":"rgba(255,255,255,0.05)"}`,
                boxShadow: betType?"0 0 50px rgba(220,38,38,0.6), 0 0 25px rgba(245,197,66,0.3)":"none",
                cursor: betType?"pointer":"not-allowed",
                transition:"all 0.2s",
                textShadow: betType?"0 0 18px rgba(255,255,255,0.6)":"none",
                display:"flex", alignItems:"center", justifyContent:"center", gap:10,
              }}>
                <Zap size={20} style={{ filter:betType?"drop-shadow(0 0 6px #fff)":"none" }}/>
                {isPlacing?"SPINNING...":!betType?"← SELECT BET TYPE":"SPIN TO WIN"}
                <Zap size={20} style={{ filter:betType?"drop-shadow(0 0 6px #fff)":"none" }}/>
              </button>
            ) : (
              <button onClick={()=>setLocation("/login")} style={{
                width:"100%", padding:"17px 0", borderRadius:16, fontWeight:900, fontSize:19, letterSpacing:3,
                background:"linear-gradient(135deg,#7f1d1d,#dc2626)", color:"#fbbf24",
                border:"2px solid rgba(245,197,66,0.4)", cursor:"pointer",
                boxShadow:"0 0 30px rgba(220,38,38,0.4)",
              }}>LOG IN TO PLAY</button>
            )}
          </>
        )}

        {isSpinning && (
          <div style={{ textAlign:"center", padding:"10px 16px", borderRadius:12, background:"rgba(220,38,38,0.08)", border:"1px solid rgba(245,197,66,0.15)", fontSize:13, color:"rgba(255,255,255,0.45)", animation:"b7-shake 0.4s ease-in-out infinite" }}>
            🎰 Spinning reels... Bet on <strong style={{ color:selBet?.color }}>{selBet?.label}</strong>
          </div>
        )}
      </div>
    </div>
  );
}
