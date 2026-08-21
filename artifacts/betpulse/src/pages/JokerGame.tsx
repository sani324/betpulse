import { useState, useCallback, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey, getGetBalanceQueryKey } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";

const API  = import.meta.env.BASE_URL.replace(/\/$/, "");
const LOGO = import.meta.env.BASE_URL + "joker-logo.jpg";
const CHIP_AMOUNTS = [100, 500, 1_000, 5_000, 10_000];

/* ── Game options ─────────────────────────────────────────── */
const OPTIONS = [
  { key: "player", label: "Player", sub: "1.95×", mult: 1.95, color: "#3b82f6", dark: "#1e3a8a" },
  { key: "banker", label: "Banker", sub: "1.95×", mult: 1.95, color: "#ef4444", dark: "#7f1d1d" },
  { key: "joker",  label: "Joker",  sub: "9×",    mult: 9,    color: "#f5c542", dark: "#713f12" },
];

/* ── Reel symbols ─────────────────────────────────────────── */
const REEL_SYMS = ["🤡","🤡","🤡","👑","7️⃣","🍒","💎","⭐","🎭","🃏","🤡","👑","7️⃣","🎭","🍒"];
const REEL_H    = 72; // px per symbol slot

/* ── Prize tiers (matching video) ────────────────────────── */
const TIERS = [
  { label: "JOKER",  value: "9×",    fg: "#ffde6a", bg: "linear-gradient(90deg,#7c4a00,#d4860a,#7c4a00)", border: "#f5c542", glow: "#f5c54288" },
  { label: "GRAND",  value: "1.95×", fg: "#e879f9", bg: "linear-gradient(90deg,#4a007c,#8b2fc9,#4a007c)", border: "#a855f7", glow: "#a855f755" },
  { label: "MAJOR",  value: "1.95×", fg: "#fb923c", bg: "linear-gradient(90deg,#7c1d1d,#b91c1c,#7c1d1d)", border: "#ef4444", glow: "#ef444455" },
  { label: "MINOR",  value: "1.95×", fg: "#4ade80", bg: "linear-gradient(90deg,#064e3b,#059669,#064e3b)", border: "#22c55e", glow: "#22c55e55" },
];

/* ── CSS ──────────────────────────────────────────────────── */
const STYLES = `
  /* background diamond texture */
  .jk-bg {
    background-color: #1a0005;
    background-image:
      repeating-linear-gradient(45deg,  rgba(220,40,40,0.18) 0px, rgba(220,40,40,0.18) 2px, transparent 2px, transparent 14px),
      repeating-linear-gradient(-45deg, rgba(220,40,40,0.18) 0px, rgba(220,40,40,0.18) 2px, transparent 2px, transparent 14px);
  }
  /* LED dot strip */
  @keyframes ledFlash {
    0%,49%{ opacity:1; } 50%,100%{ opacity:0.2; }
  }
  .jk-led { animation: ledFlash 0.55s step-start infinite; }
  .jk-led:nth-child(2n)   { animation-delay: 0.27s; }
  .jk-led:nth-child(3n)   { animation-delay: 0.09s; }
  .jk-led:nth-child(4n)   { animation-delay: 0.36s; }

  /* reel strip */
  @keyframes reelSpin {
    0%   { transform: translateY(0); }
    100% { transform: translateY(calc(-${REEL_H * REEL_SYMS.length}px)); }
  }
  .jk-reel-spin { animation: reelSpin 0.35s linear infinite; }

  /* reel settle bounce */
  @keyframes reelSettle {
    0%  { transform: translateY(var(--ry,0px)) scaleY(1.08); }
    60% { transform: translateY(calc(var(--ry,0px) + 6px)) scaleY(0.95); }
    80% { transform: translateY(calc(var(--ry,0px) - 3px)) scaleY(1.02); }
    100%{ transform: translateY(var(--ry,0px)) scaleY(1); }
  }
  .jk-reel-settle { animation: reelSettle 0.45s cubic-bezier(.34,1.56,.64,1) forwards; }

  @keyframes titleGlow {
    0%,100%{ text-shadow: 0 0 14px #f5c54299, 0 0 40px #f5c54266; }
    50%    { text-shadow: 0 0 28px #f5c542cc, 0 0 80px #f5c54299, 0 2px 0 #7c4a00; }
  }
  @keyframes tierPulse {
    0%,100%{ opacity:1; transform:scaleX(1); }
    50%    { opacity:0.85; transform:scaleX(1.01); }
  }
  @keyframes winExplode {
    0%  { transform:scale(0.5) rotate(-10deg); opacity:0; }
    60% { transform:scale(1.15) rotate(4deg);  opacity:1; }
    80% { transform:scale(0.96) rotate(-1deg); opacity:1; }
    100%{ transform:scale(1) rotate(0deg);     opacity:1; }
  }
  @keyframes coinRain {
    0%  { transform:translateY(-30px) rotate(0deg); opacity:1; }
    100%{ transform:translateY(120px) rotate(540deg); opacity:0; }
  }
  @keyframes machineIdle {
    0%,100%{ box-shadow:0 0 40px rgba(245,197,66,0.25), inset 0 0 60px rgba(0,0,0,0.5); }
    50%    { box-shadow:0 0 70px rgba(245,197,66,0.45), inset 0 0 60px rgba(0,0,0,0.5); }
  }
  @keyframes chipPop {
    0%,100%{ transform:scale(1); }
    50%    { transform:scale(1.12); }
  }
`;

/* ── Audio ────────────────────────────────────────────────── */
function mkCtx() { return new ((window as any).AudioContext || (window as any).webkitAudioContext)(); }
function playReel() {
  try {
    const c = mkCtx();
    const o = c.createOscillator(); const g = c.createGain();
    o.connect(g); g.connect(c.destination); o.type = "square"; o.frequency.value = 440;
    g.gain.setValueAtTime(0.05, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.06);
    o.start(c.currentTime); o.stop(c.currentTime + 0.06);
    setTimeout(() => c.close(), 200);
  } catch(_) {}
}
function playWin() {
  try {
    const c = mkCtx();
    [523,659,784,1047,1319].forEach((f,i) => {
      const o = c.createOscillator(); const g = c.createGain();
      o.connect(g); g.connect(c.destination); o.type = "triangle"; o.frequency.value = f;
      const t = c.currentTime + i*0.12;
      g.gain.setValueAtTime(0.3,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.45);
      o.start(t); o.stop(t+0.45);
    }); setTimeout(() => c.close(), 2500);
  } catch(_) {}
}
function playLose() {
  try {
    const c = mkCtx();
    [280,230,180].forEach((f,i)=>{
      const o = c.createOscillator(); const g = c.createGain();
      o.connect(g); g.connect(c.destination); o.type = "sawtooth"; o.frequency.value = f;
      const t = c.currentTime+i*0.22;
      g.gain.setValueAtTime(0.1,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.3);
      o.start(t); o.stop(t+0.3);
    }); setTimeout(() => c.close(), 2000);
  } catch(_) {}
}

/* ── LED strip ────────────────────────────────────────────── */
function LedStrip({ count = 18 }: { count?: number }) {
  const COLORS = ["#f5c542","#ef4444","#a855f7","#22c55e","#f5c542","#ef4444"];
  return (
    <div style={{ display:"flex", gap:3, justifyContent:"center", padding:"4px 0" }}>
      {Array.from({length:count},(_,i)=>(
        <div key={i} className="jk-led" style={{
          width:8, height:8, borderRadius:"50%",
          background: COLORS[i%COLORS.length],
          boxShadow:`0 0 6px ${COLORS[i%COLORS.length]}`,
        }}/>
      ))}
    </div>
  );
}

/* ── Single reel ──────────────────────────────────────────── */
function Reel({ spinning, finalIdx, settled }: { spinning:boolean; finalIdx:number; settled:boolean }) {
  const offsetY = -(finalIdx * REEL_H);
  return (
    <div style={{
      width:80, height: REEL_H * 3, overflow:"hidden", position:"relative",
      background:"linear-gradient(180deg,#0a0005 0%,#1a000a 50%,#0a0005 100%)",
      borderRadius:8, border:"2px solid rgba(245,197,66,0.4)",
      boxShadow:"inset 0 0 20px rgba(0,0,0,0.8)",
    }}>
      {/* Gradient masks top/bottom */}
      <div style={{position:"absolute",top:0,left:0,right:0,height:40,background:"linear-gradient(180deg,#1a0005 0%,transparent 100%)",zIndex:2,pointerEvents:"none"}}/>
      <div style={{position:"absolute",bottom:0,left:0,right:0,height:40,background:"linear-gradient(0deg,#1a0005 0%,transparent 100%)",zIndex:2,pointerEvents:"none"}}/>
      {/* Active row highlight */}
      <div style={{position:"absolute",top:REEL_H,left:0,right:0,height:REEL_H,background:"rgba(245,197,66,0.07)",border:"1px solid rgba(245,197,66,0.2)",zIndex:1,pointerEvents:"none"}}/>

      {/* Symbol strip — doubled for seamless loop */}
      <div
        className={spinning ? "jk-reel-spin" : settled ? "jk-reel-settle" : ""}
        style={{
          "--ry": `${offsetY - REEL_H}px`,
          transform: spinning ? undefined : `translateY(${offsetY - REEL_H}px)`,
        } as any}
      >
        {[...REEL_SYMS, ...REEL_SYMS].map((s,i)=>(
          <div key={i} style={{
            height: REEL_H, display:"flex", alignItems:"center", justifyContent:"center",
            fontSize: 38, lineHeight:1,
            filter: settled && i === (finalIdx + REEL_SYMS.length) ? "drop-shadow(0 0 12px #f5c542)" : "none",
          }}>{s}</div>
        ))}
      </div>
    </div>
  );
}

/* ── Coin rain ────────────────────────────────────────────── */
function CoinRain() {
  return (
    <div style={{position:"absolute",inset:0,pointerEvents:"none",overflow:"hidden",zIndex:10}}>
      {Array.from({length:24},(_,i)=>(
        <div key={i} style={{
          position:"absolute", fontSize:20,
          left:`${4+i*3.8}%`, top:"-8%",
          animation:`coinRain ${0.7+Math.random()*0.6}s ease-in ${i*0.07}s both`,
        }}>
          {["💰","🪙","✨","⭐"][i%4]}
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Main Component
══════════════════════════════════════════════════════════ */
export default function JokerGame() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [stake, setStake]         = useState(500);
  const [selection, setSelection] = useState<string|null>(null);
  const [phase, setPhase]         = useState<"betting"|"spinning"|"result">("betting");
  const [result, setResult]       = useState<any>(null);
  const [balance, setBalance]     = useState<number>(parseFloat(String(user?.balance||"0")));
  const [isPlacing, setIsPlacing] = useState(false);

  // Reel state: each reel has a "final symbol index" and settled flag
  const [reelIdxs, setReelIdxs]       = useState([0,0,0]);
  const [settledReels, setSettledReels] = useState([false,false,false]);
  const [showWin, setShowWin]         = useState(false);

  const tickRef = useRef(0);

  useEffect(()=>{ setBalance(parseFloat(String(user?.balance||"0"))); },[user?.balance]);

  /* poll backend */
  const pollRound = useCallback(async (rId:string, sel:string) => {
    tickRef.current = 0;
    const iv = setInterval(async () => {
      tickRef.current++;
      if (tickRef.current > 200) { clearInterval(iv); setPhase("betting"); return; }
      try {
        const r = await fetch(`${API}/api/games/casino-round/joker/${rId}`,{credentials:"include"});
        const data = await r.json();
        if (data.status === "settled") {
          clearInterval(iv);
          setResult(data);
          const won = data.result === sel;
          // settle reels one by one
          const resultIdx = won ? 0 : 8; // 🤡 for win, 🎭 for loss
          [0,1,2].forEach(ri => {
            setTimeout(()=>{
              setReelIdxs(prev => { const n=[...prev]; n[ri]=won?0:(3+ri); return n; });
              setSettledReels(prev => { const n=[...prev]; n[ri]=true; return n; });
              playReel();
              if (ri===2) {
                setTimeout(()=>{
                  setPhase("result");
                  if (won) { playWin(); setShowWin(true); } else playLose();
                  queryClient.invalidateQueries({queryKey:getGetMeQueryKey()});
                  queryClient.invalidateQueries({queryKey:getGetBalanceQueryKey()});
                }, 600);
              }
            }, 600 + ri*500);
          });
        }
      } catch(_) {}
    }, 500);
  },[queryClient]);

  const placeBet = async () => {
    if (!isAuthenticated) { setLocation("/login"); return; }
    if (!selection) { toast({title:"Pick a side!",variant:"destructive"}); return; }
    if (balance < stake) { toast({title:"Insufficient balance!",variant:"destructive"}); return; }
    setIsPlacing(true);
    try {
      const r = await fetch(`${API}/api/games/joker`,{
        method:"POST", credentials:"include",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({stake,selection}),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error||"Failed");
      setBalance(data.newBalance);
      setSettledReels([false,false,false]);
      setShowWin(false);
      setPhase("spinning");
      pollRound(data.roundId, selection);
      toast({title:"🤡 Reels Spinning!", description:`${formatCurrency(stake)} on ${OPTIONS.find(o=>o.key===selection)?.label}`});
    } catch(e:any) {
      toast({title:"Error",description:e.message,variant:"destructive"});
    } finally { setIsPlacing(false); }
  };

  const reset = () => {
    setPhase("betting"); setResult(null); setSelection(null);
    setSettledReels([false,false,false]); setShowWin(false);
  };

  const won     = result?.result === selection;
  const selOpt  = OPTIONS.find(o=>o.key===selection);
  const resOpt  = OPTIONS.find(o=>o.key===result?.result);
  const profit  = selOpt ? stake*(selOpt.mult-1) : 0;
  const isSpinning = phase === "spinning";

  return (
    <div className="jk-bg" style={{ minHeight:"100vh", display:"flex", flexDirection:"column", color:"#fff", position:"relative", overflowX:"hidden" }}>
      <style>{STYLES}</style>

      {/* ── HEADER ──────────────────────────────────────────── */}
      <header style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 14px", background:"rgba(0,0,0,0.7)", borderBottom:"1px solid rgba(245,197,66,0.3)", backdropFilter:"blur(12px)", position:"sticky", top:0, zIndex:50 }}>
        <button onClick={()=>setLocation("/")} style={{ display:"flex", alignItems:"center", gap:5, padding:"6px 12px", borderRadius:10, background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.12)", color:"rgba(255,255,255,0.7)", cursor:"pointer", fontSize:13, fontWeight:600 }}>
          <ArrowLeft size={15}/> Back
        </button>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <img src={LOGO} alt="Joker" style={{ width:34, height:34, borderRadius:8, objectFit:"cover", border:"2px solid #f5c542", boxShadow:"0 0 12px #f5c54266" }}/>
          <span style={{ fontWeight:900, fontSize:18, letterSpacing:1, animation:"titleGlow 2s ease-in-out infinite", background:"linear-gradient(90deg,#f5c542,#ffeba1,#f5c542)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
            JACKPOT JOKER
          </span>
        </div>
        <div style={{ padding:"6px 12px", borderRadius:10, background:"rgba(245,197,66,0.12)", border:"1px solid rgba(245,197,66,0.3)", color:"#f5c542", fontSize:13, fontWeight:800 }}>
          {formatCurrency(balance)}
        </div>
      </header>

      <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", padding:"12px 10px 24px", gap:10, maxWidth:460, margin:"0 auto", width:"100%" }}>

        {/* ── HERO LOGO ─────────────────────────────────────── */}
        <div style={{ width:"100%", borderRadius:18, overflow:"hidden", position:"relative", boxShadow:"0 0 60px rgba(245,197,66,0.3), 0 0 120px rgba(200,40,40,0.2)" }}>
          <img src={LOGO} alt="Joker Joker" style={{ width:"100%", height:160, objectFit:"cover", objectPosition:"center 15%", display:"block" }}/>
          <div style={{ position:"absolute", inset:0, background:"linear-gradient(0deg,rgba(26,0,5,0.9) 0%,rgba(26,0,5,0.1) 50%,transparent 100%)" }}/>
          <div style={{ position:"absolute", bottom:0, left:0, right:0 }}>
            <LedStrip count={24}/>
          </div>
        </div>

        {/* ── JACKPOT PRIZE TIERS ───────────────────────────── */}
        <div style={{ width:"100%", display:"flex", flexDirection:"column", gap:5 }}>
          {TIERS.map((t,i)=>(
            <div key={i} style={{
              display:"flex", alignItems:"center", justifyContent:"space-between",
              padding:"9px 18px", borderRadius:10,
              background: t.bg,
              border:`2px solid ${t.border}55`,
              boxShadow:`0 0 20px ${t.glow}`,
              animation:`tierPulse ${2+i*0.4}s ease-in-out ${i*0.2}s infinite`,
            }}>
              <span style={{ fontWeight:900, fontSize:15, color:t.fg, letterSpacing:3, textTransform:"uppercase", textShadow:`0 0 12px ${t.fg}88` }}>
                {t.label}
              </span>
              <span style={{ fontWeight:900, fontSize:18, color:"#fff", textShadow:`0 0 16px ${t.fg}`, letterSpacing:2 }}>
                {t.value}
              </span>
            </div>
          ))}
        </div>

        {/* ── SLOT MACHINE ──────────────────────────────────── */}
        <div style={{
          width:"100%", borderRadius:22, overflow:"hidden", position:"relative",
          background:"linear-gradient(180deg,#1a0008 0%,#0d0005 100%)",
          border:"3px solid #f5c542",
          boxShadow:"0 0 50px rgba(245,197,66,0.35), inset 0 0 40px rgba(0,0,0,0.8)",
          animation: isSpinning ? undefined : "machineIdle 3s ease-in-out infinite",
        }}>
          {/* LED top */}
          <div style={{ borderBottom:"2px solid rgba(245,197,66,0.3)", background:"rgba(0,0,0,0.5)" }}>
            <LedStrip count={20}/>
          </div>

          {/* Reels area */}
          <div style={{ padding:"16px 12px", display:"flex", flexDirection:"column", alignItems:"center", gap:12, position:"relative" }}>
            {phase==="result" && won && <CoinRain/>}

            {/* WIN / RESULT overlay */}
            {phase === "result" && (
              <div style={{
                position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center",
                zIndex:20, background:"rgba(0,0,0,0.75)", backdropFilter:"blur(2px)",
              }}>
                <div style={{
                  padding:"20px 36px", borderRadius:20, textAlign:"center",
                  background: won ? "linear-gradient(135deg,#7c4a00,#b8860a)" : "linear-gradient(135deg,#4a0000,#7f1d1d)",
                  border:`3px solid ${won?"#f5c542":"#ef4444"}`,
                  boxShadow:`0 0 60px ${won?"rgba(245,197,66,0.6)":"rgba(239,68,68,0.5)"}`,
                  animation:"winExplode 0.55s cubic-bezier(.34,1.56,.64,1) forwards",
                }}>
                  <div style={{ fontSize:52, marginBottom:4 }}>{won?"🏆":"😔"}</div>
                  <div style={{ fontSize:26, fontWeight:900, letterSpacing:3, color: won?"#ffde6a":"#f87171", textShadow: won?"0 0 20px #f5c542":"none" }}>
                    {won ? "YOU WON!" : "YOU LOST"}
                  </div>
                  {won && (
                    <div style={{ fontSize:22, fontWeight:900, color:"#4ade80", marginTop:6, textShadow:"0 0 14px #4ade80" }}>
                      +{formatCurrency(profit)}
                    </div>
                  )}
                  <div style={{ fontSize:13, color:"rgba(255,255,255,0.6)", marginTop:6 }}>
                    Result: <span style={{ color:resOpt?.color, fontWeight:800 }}>{resOpt?.label}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Spinning phase label */}
            {isSpinning && (
              <p style={{ fontSize:11, fontWeight:800, letterSpacing:4, color:"#f5c542", textTransform:"uppercase", animation:"titleGlow 0.8s ease-in-out infinite" }}>
                🎰 SPINNING...
              </p>
            )}
            {phase === "betting" && (
              <p style={{ fontSize:11, fontWeight:800, letterSpacing:4, color:"rgba(245,197,66,0.5)", textTransform:"uppercase" }}>
                PLACE YOUR BET
              </p>
            )}

            {/* The 3 reels */}
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              {[0,1,2].map(ri=>(
                <Reel key={ri}
                  spinning={isSpinning && !settledReels[ri]}
                  finalIdx={reelIdxs[ri]}
                  settled={settledReels[ri]}
                />
              ))}
            </div>

            {/* Multiplier badges */}
            <div style={{ display:"flex", gap:6 }}>
              {["×1","×3","×9"].map((m,i)=>(
                <div key={i} style={{
                  padding:"5px 14px", borderRadius:8, fontWeight:900, fontSize:14, letterSpacing:2,
                  background: i===2?"linear-gradient(135deg,#7c4a00,#d4860a)":i===1?"linear-gradient(135deg,#4a007c,#8b2fc9)":"linear-gradient(135deg,#0c3020,#065f46)",
                  border:`1.5px solid ${i===2?"#f5c542":i===1?"#a855f7":"#22c55e"}55`,
                  color: i===2?"#ffde6a":i===1?"#e879f9":"#4ade80",
                }}>
                  {m}
                </div>
              ))}
            </div>
          </div>

          {/* LED bottom */}
          <div style={{ borderTop:"2px solid rgba(245,197,66,0.3)", background:"rgba(0,0,0,0.5)" }}>
            <LedStrip count={20}/>
          </div>
        </div>

        {/* ── CONTROLS ──────────────────────────────────────── */}
        {phase === "result" && (
          <button onClick={reset} style={{
            width:"100%", padding:"15px 0", borderRadius:16, fontWeight:900, fontSize:16, letterSpacing:3,
            background:"linear-gradient(135deg,#7c4a00 0%,#d4860a 50%,#7c4a00 100%)",
            color:"#fff", border:"2px solid #f5c542",
            boxShadow:"0 0 30px rgba(245,197,66,0.5)", cursor:"pointer",
          }}>
            🎰 SPIN AGAIN
          </button>
        )}

        {phase !== "result" && !isSpinning && (
          <>
            {/* Choose side */}
            <div style={{ width:"100%", display:"flex", flexDirection:"column", gap:10 }}>
              <p style={{ textAlign:"center", fontSize:11, fontWeight:800, letterSpacing:4, color:"rgba(245,197,66,0.45)", textTransform:"uppercase", margin:0 }}>
                Choose Your Side
              </p>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
                {OPTIONS.map(opt=>{
                  const isSel = selection===opt.key;
                  return (
                    <button key={opt.key} onClick={()=>setSelection(opt.key)} style={{
                      padding:"14px 6px 12px", borderRadius:16, display:"flex", flexDirection:"column", alignItems:"center", gap:6,
                      background: isSel
                        ? `linear-gradient(180deg,${opt.color}33 0%,${opt.dark}99 100%)`
                        : "rgba(255,255,255,0.04)",
                      border:`2px solid ${isSel?opt.color:"rgba(245,197,66,0.15)"}`,
                      boxShadow: isSel ? `0 0 30px ${opt.color}55, inset 0 0 20px ${opt.color}15` : "none",
                      cursor:"pointer",
                      transform: isSel?"scale(1.05)":"scale(1)",
                      transition:"all 0.18s",
                    }}>
                      <span style={{ fontSize:opt.key==="joker"?38:32, filter:isSel?`drop-shadow(0 0 12px ${opt.color})`:"none" }}>
                        {opt.key==="player"?"👤":opt.key==="banker"?"🏦":"🤡"}
                      </span>
                      <span style={{ fontSize:13, fontWeight:800, color:isSel?opt.color:"rgba(255,255,255,0.65)", letterSpacing:1 }}>
                        {opt.label.toUpperCase()}
                      </span>
                      <span style={{
                        fontSize:13, fontWeight:900, padding:"3px 10px", borderRadius:8,
                        background:`${opt.color}${isSel?"33":"15"}`,
                        color:opt.color, border:`1px solid ${opt.color}${isSel?"77":"30"}`,
                      }}>
                        {opt.sub}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Chips */}
            <div style={{ display:"flex", gap:8, justifyContent:"center", flexWrap:"wrap" }}>
              {CHIP_AMOUNTS.map(amt=>{
                const active = stake===amt;
                return (
                  <button key={amt} onClick={()=>setStake(amt)} style={{
                    width:58, height:58, borderRadius:"50%", fontWeight:900, fontSize:11,
                    border:`3px solid ${active?"#f5c542":"rgba(245,197,66,0.2)"}`,
                    background: active
                      ? "radial-gradient(circle at 38% 35%,#ffde6a,#b8860b)"
                      : "radial-gradient(circle at 38% 35%,#3d0010,#1a0005)",
                    color: active?"#1a0005":"rgba(255,255,255,0.5)",
                    cursor:"pointer",
                    boxShadow: active?"0 0 22px rgba(245,197,66,0.65), inset 0 2px 0 rgba(255,255,255,0.3)":"inset 0 2px 0 rgba(255,255,255,0.05)",
                    animation: active?"chipPop 0.8s ease-in-out infinite":"none",
                    transition:"all 0.15s",
                  }}>
                    {amt>=1000?`${amt/1000}K`:amt}
                  </button>
                );
              })}
            </div>

            {/* Bet info bar */}
            <div style={{ width:"100%", display:"flex", justifyContent:"space-between", padding:"8px 16px", borderRadius:12, background:"rgba(0,0,0,0.5)", border:"1px solid rgba(245,197,66,0.2)" }}>
              <span style={{ fontSize:12, color:"rgba(255,255,255,0.45)", fontWeight:700 }}>
                WIN: <span style={{ color:"#4ade80" }}>{selection?formatCurrency(stake*(OPTIONS.find(o=>o.key===selection)?.mult??1)):"—"}</span>
              </span>
              <span style={{ fontSize:12, color:"rgba(255,255,255,0.45)", fontWeight:700 }}>
                BET: <span style={{ color:"#f5c542" }}>{formatCurrency(stake)}</span>
              </span>
              <span style={{ fontSize:12, color:"rgba(255,255,255,0.45)", fontWeight:700 }}>
                BAL: <span style={{ color:"#60a5fa" }}>{formatCurrency(balance)}</span>
              </span>
            </div>

            {/* Place bet */}
            {isAuthenticated ? (
              <button onClick={placeBet} disabled={isPlacing||!selection} style={{
                width:"100%", padding:"16px 0", borderRadius:16, fontWeight:900, fontSize:18, letterSpacing:4,
                background: selection
                  ? "linear-gradient(135deg,#7c0020 0%,#c71c3e 40%,#d4a017 60%,#7c0020 100%)"
                  : "rgba(255,255,255,0.05)",
                color: selection?"#fff":"rgba(255,255,255,0.2)",
                border:`2px solid ${selection?"rgba(245,197,66,0.6)":"rgba(255,255,255,0.06)"}`,
                boxShadow: selection?"0 0 40px rgba(200,30,60,0.6), 0 0 20px rgba(245,197,66,0.3)":"none",
                cursor: selection?"pointer":"not-allowed",
                transition:"all 0.2s",
                textShadow: selection?"0 0 16px rgba(255,255,255,0.5)":"none",
              }}>
                {isPlacing ? "🎰 SPINNING..." : !selection ? "← PICK A SIDE" : "🎰 SPIN NOW"}
              </button>
            ) : (
              <button onClick={()=>setLocation("/login")} style={{
                width:"100%", padding:"16px 0", borderRadius:16, fontWeight:900, fontSize:18, letterSpacing:4,
                background:"linear-gradient(135deg,#7c0020,#c71c3e)", color:"#fff",
                border:"2px solid rgba(245,197,66,0.4)", cursor:"pointer",
                boxShadow:"0 0 30px rgba(200,30,60,0.5)",
              }}>
                LOG IN TO PLAY
              </button>
            )}
          </>
        )}

        {isSpinning && (
          <div style={{ textAlign:"center", padding:"10px 20px", borderRadius:12, background:"rgba(245,197,66,0.08)", border:"1px solid rgba(245,197,66,0.2)", fontSize:13, color:"rgba(255,255,255,0.55)" }}>
            🃏 Bet on <strong style={{ color:selOpt?.color }}>{selOpt?.label}</strong> · Reels are spinning...
          </div>
        )}
      </div>
    </div>
  );
}
