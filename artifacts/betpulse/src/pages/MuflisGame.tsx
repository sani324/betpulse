import { useState, useCallback, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey, getGetBalanceQueryKey } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");
const CHIP_AMOUNTS = [100, 500, 1_000, 5_000, 10_000];

const OPTIONS = [
  { key: "player", label: "Player", sub: "1.95×", mult: 1.95, color: "#a78bfa", dark: "#4c1d95", glow: "rgba(167,139,250,0.6)" },
  { key: "banker", label: "Banker", sub: "1.95×", mult: 1.95, color: "#f472b6", dark: "#831843", glow: "rgba(244,114,182,0.6)" },
];

/* Fan cards — low values for Muflis (lowest wins) */
const FAN_CARDS = [
  { v: "2",  s: "♠", red: false }, { v: "3",  s: "♥", red: true  },
  { v: "4",  s: "♦", red: true  }, { v: "5",  s: "♣", red: false },
  { v: "6",  s: "♠", red: false }, { v: "7",  s: "♥", red: true  },
  { v: "8",  s: "♦", red: true  }, { v: "9",  s: "♣", red: false },
  { v: "J",  s: "♠", red: false }, { v: "Q",  s: "♥", red: true  },
];

const TIERS = [
  { label: "TRAIL LOW",    value: "9×",    fg: "#fde68a", bg: "linear-gradient(90deg,#3d1900,#92400e,#3d1900)", border: "#d97706" },
  { label: "PURE SEQUENCE", value: "4.5×", fg: "#c4b5fd", bg: "linear-gradient(90deg,#1e0050,#6d28d9,#1e0050)", border: "#7c3aed" },
  { label: "PLAYER",       value: "1.95×", fg: "#ddd6fe", bg: "linear-gradient(90deg,#2e1065,#5b21b6,#2e1065)", border: "#a78bfa" },
  { label: "BANKER",       value: "1.95×", fg: "#fbcfe8", bg: "linear-gradient(90deg,#4a0028,#9d174d,#4a0028)", border: "#f472b6" },
];

const DEAL_ROWS = [
  { label: "Player", color: "#a78bfa" },
  { label: "Banker", color: "#f472b6" },
];

const DISP_CARDS = [
  [{ v:"2", s:"♠", r:false }, { v:"3", s:"♥", r:true  }, { v:"4", s:"♦", r:true  }],
  [{ v:"5", s:"♣", r:false }, { v:"6", s:"♠", r:false }, { v:"7", s:"♥", r:true  }],
];

const STYLES = `
  .muf-bg {
    background-color: #0d001a;
    background-image:
      repeating-linear-gradient(45deg,  rgba(109,40,217,0.18) 0px, rgba(109,40,217,0.18) 2px, transparent 2px, transparent 18px),
      repeating-linear-gradient(-45deg, rgba(109,40,217,0.18) 0px, rgba(109,40,217,0.18) 2px, transparent 2px, transparent 18px);
  }
  @keyframes muf-led { 0%,49%{opacity:1} 50%,100%{opacity:0.18} }
  .muf-led { animation:muf-led 0.65s step-start infinite; }
  .muf-led:nth-child(2n)  { animation-delay:0.32s; }
  .muf-led:nth-child(3n)  { animation-delay:0.12s; }
  .muf-led:nth-child(5n)  { animation-delay:0.48s; }

  @keyframes muf-title {
    0%,100%{ text-shadow:0 0 14px #a78bfa99, 0 0 40px #7c3aed55; }
    50%    { text-shadow:0 0 28px #c4b5fdcc, 0 0 80px #a78bfa99; }
  }
  @keyframes muf-fan {
    0%,100%{ transform:var(--muf-card-transform) translateY(0px); }
    50%    { transform:var(--muf-card-transform) translateY(-5px); }
  }
  @keyframes muf-deal {
    0%  { transform:translateX(-60px) rotate(-15deg); opacity:0; }
    60% { transform:translateX(4px) rotate(1deg); opacity:1; }
    80% { transform:translateX(-2px) rotate(-0.5deg); opacity:1; }
    100%{ transform:translateX(0px) rotate(0deg); opacity:1; }
  }
  @keyframes muf-pulse {
    0%,100%{ box-shadow:0 0 40px rgba(109,40,217,0.28), inset 0 0 60px rgba(0,0,0,0.5); }
    50%    { box-shadow:0 0 70px rgba(167,139,250,0.38), inset 0 0 60px rgba(0,0,0,0.5); }
  }
  @keyframes muf-win {
    0%  { transform:scale(0.6) rotate(-8deg); opacity:0; }
    60% { transform:scale(1.12) rotate(3deg); opacity:1; }
    80% { transform:scale(0.96) rotate(-1deg); opacity:1; }
    100%{ transform:scale(1) rotate(0deg); opacity:1; }
  }
  @keyframes muf-chip {
    0%,100%{ transform:scale(1); }
    50%    { transform:scale(1.1); }
  }
  @keyframes muf-coin {
    0%  { transform:translateY(-20px) rotate(0deg); opacity:1; }
    100%{ transform:translateY(130px) rotate(600deg); opacity:0; }
  }
  @keyframes muf-orb {
    0%,100%{ opacity:0.18; transform:scale(1); }
    50%    { opacity:0.36; transform:scale(1.2); }
  }
  @keyframes muf-tier {
    0%,100%{ opacity:1; } 50%{ opacity:0.82; }
  }
`;

function mkCtx() { return new ((window as any).AudioContext||(window as any).webkitAudioContext)(); }
function playCard() {
  try {
    const c = mkCtx(); const o = c.createOscillator(); const g = c.createGain();
    o.connect(g); g.connect(c.destination); o.type="triangle"; o.frequency.value=550;
    g.gain.setValueAtTime(0.08,c.currentTime); g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.12);
    o.start(c.currentTime); o.stop(c.currentTime+0.12); setTimeout(()=>c.close(),300);
  } catch(_) {}
}
function playWin() {
  try {
    const c = mkCtx();
    [440,554,659,880,1109].forEach((f,i)=>{ const o=c.createOscillator(),g=c.createGain(); o.connect(g); g.connect(c.destination); o.type="triangle"; o.frequency.value=f; const t=c.currentTime+i*0.12; g.gain.setValueAtTime(0.28,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.45); o.start(t); o.stop(t+0.45); });
    setTimeout(()=>c.close(),2500);
  } catch(_) {}
}
function playLose() {
  try {
    const c = mkCtx();
    [300,240,190].forEach((f,i)=>{ const o=c.createOscillator(),g=c.createGain(); o.connect(g); g.connect(c.destination); o.type="sawtooth"; o.frequency.value=f; const t=c.currentTime+i*0.22; g.gain.setValueAtTime(0.1,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.3); o.start(t); o.stop(t+0.3); });
    setTimeout(()=>c.close(),2000);
  } catch(_) {}
}

function LedStrip({ count=20, colors=["#a78bfa","#f472b6","#c4b5fd","#e879f9","#818cf8"] }: { count?:number; colors?:string[] }) {
  return (
    <div style={{ display:"flex", gap:3, justifyContent:"center", padding:"4px 0" }}>
      {Array.from({length:count},(_,i)=>(
        <div key={i} className="muf-led" style={{ width:8, height:8, borderRadius:"50%", background:colors[i%colors.length], boxShadow:`0 0 6px ${colors[i%colors.length]}` }}/>
      ))}
    </div>
  );
}

/* Single playing card */
function MufCard({ value, suit, red, rot=0, tx=0, delay=0, size=1, animate=false }: {
  value:string; suit:string; red:boolean; rot?:number; tx?:number; delay?:number; size?:number; animate?:boolean;
}) {
  const W=Math.round(52*size), H=Math.round(76*size);
  const fs=Math.round(11*size), ss=Math.round(20*size);
  const color = red ? "#be123c" : "#1e1b4b";
  const transform = `rotate(${rot}deg) translateX(${tx}px)`;
  return (
    <div style={{
      width:W, height:H, flexShrink:0, position:"absolute",
      background:"linear-gradient(145deg,#fffef5 0%,#fff9f0 60%,#fef3c7 100%)",
      borderRadius:Math.round(7*size),
      border:`${Math.round(1.5*size)}px solid rgba(167,139,250,0.65)`,
      boxShadow:`0 ${Math.round(4*size)}px ${Math.round(16*size)}px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.8)`,
      display:"flex", flexDirection:"column", justifyContent:"space-between",
      padding:`${Math.round(4*size)}px`,
      transformOrigin:"bottom center",
      "--muf-card-transform": transform,
      transform,
      animation: animate ? `muf-fan ${2+delay*0.3}s ease-in-out ${delay*0.1}s infinite` : "none",
    } as any}>
      <div style={{ fontSize:fs, fontWeight:900, color, lineHeight:1 }}>{value}{suit}</div>
      <div style={{ fontSize:ss, textAlign:"center", color, lineHeight:1 }}>{suit}</div>
      <div style={{ fontSize:fs, fontWeight:900, color, lineHeight:1, transform:"rotate(180deg)", alignSelf:"flex-end" }}>{value}{suit}</div>
    </div>
  );
}

function CardFan() {
  return (
    <div style={{ position:"relative", height:110, width:"100%", display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
      {FAN_CARDS.map((c,i)=>{
        const n = FAN_CARDS.length;
        const angle = (i-(n-1)/2)*9;
        const offset = (i-(n-1)/2)*22;
        return <MufCard key={i} value={c.v} suit={c.s} red={c.red} rot={angle} tx={offset} delay={i} animate size={1.05}/>;
      })}
    </div>
  );
}

function DealCard({ delay=0, revealed=false, value="", suit="", red=false }: {
  delay?:number; revealed?:boolean; value?:string; suit?:string; red?:boolean;
}) {
  return (
    <div style={{ width:55, height:78, borderRadius:8, flexShrink:0, animation:`muf-deal 0.45s cubic-bezier(.34,1.56,.64,1) ${delay}s both`, position:"relative" }}>
      {revealed ? (
        <div style={{
          width:"100%", height:"100%", borderRadius:8,
          background:"linear-gradient(145deg,#fffef5,#fff9f0,#fef3c7)",
          border:"2px solid rgba(167,139,250,0.65)",
          boxShadow:"0 4px 16px rgba(0,0,0,0.6)",
          display:"flex", flexDirection:"column", justifyContent:"space-between", padding:"5px",
        }}>
          <div style={{ fontSize:12, fontWeight:900, color:red?"#be123c":"#1e1b4b", lineHeight:1 }}>{value}{suit}</div>
          <div style={{ fontSize:22, textAlign:"center", color:red?"#be123c":"#1e1b4b" }}>{suit}</div>
          <div style={{ fontSize:12, fontWeight:900, color:red?"#be123c":"#1e1b4b", transform:"rotate(180deg)", alignSelf:"flex-end" }}>{value}{suit}</div>
        </div>
      ) : (
        <div style={{
          width:"100%", height:"100%", borderRadius:8,
          background:"linear-gradient(135deg,#4c1d95 0%,#6d28d9 50%,#4c1d95 100%)",
          border:"2px solid rgba(167,139,250,0.45)",
          boxShadow:"0 4px 16px rgba(0,0,0,0.6)",
          display:"flex", alignItems:"center", justifyContent:"center", fontSize:22,
          backgroundImage:"repeating-linear-gradient(45deg,rgba(255,255,255,0.05) 0px,rgba(255,255,255,0.05) 2px,transparent 2px,transparent 10px)",
        }}>🂠</div>
      )}
    </div>
  );
}

function CoinRain() {
  return (
    <div style={{ position:"absolute", inset:0, overflow:"hidden", pointerEvents:"none", zIndex:10 }}>
      {Array.from({length:22},(_,i)=>(
        <div key={i} style={{ position:"absolute", fontSize:18, left:`${3+i*4.2}%`, top:"-8%", animation:`muf-coin ${0.7+Math.random()*0.5}s ease-in ${i*0.065}s both` }}>
          {["💜","🃏","✨","💎","⭐"][i%5]}
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════
   MAIN
══════════════════════════════════ */
export default function MuflisGame() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [stake,     setStake]     = useState(500);
  const [selection, setSelection] = useState<string|null>(null);
  const [phase,     setPhase]     = useState<"betting"|"dealing"|"result">("betting");
  const [result,    setResult]    = useState<any>(null);
  const [balance,   setBalance]   = useState<number>(parseFloat(user?.balance||"0"));
  const [isPlacing, setIsPlacing] = useState(false);
  const [dealtCards, setDealtCards] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const tickRef = useRef(0);

  useEffect(()=>{ setBalance(parseFloat(user?.balance||"0")); },[user?.balance]);

  const pollRound = useCallback(async (rId:string, sel:string) => {
    tickRef.current = 0;
    const iv = setInterval(async () => {
      tickRef.current++;
      if (tickRef.current>200) { clearInterval(iv); setPhase("betting"); return; }
      try {
        const r = await fetch(`${API}/api/games/casino-round/muflis/${rId}`,{credentials:"include"});
        const data = await r.json();
        if (data.status==="settled") {
          clearInterval(iv);
          setResult(data);
          [0,1,2].forEach(i=>{ setTimeout(()=>{ setDealtCards(i+1); playCard(); }, i*400); });
          setTimeout(()=>{
            setShowResult(true);
            setPhase("result");
            if (data.result===sel) playWin(); else playLose();
            queryClient.invalidateQueries({queryKey:getGetMeQueryKey()});
            queryClient.invalidateQueries({queryKey:getGetBalanceQueryKey()});
          }, 1800);
        }
      } catch(_) {}
    }, 500);
  },[queryClient]);

  const placeBet = async () => {
    if (!isAuthenticated) { setLocation("/login"); return; }
    if (!selection) { toast({title:"Pick a side!",variant:"destructive"}); return; }
    if (balance<stake) { toast({title:"Insufficient balance!",variant:"destructive"}); return; }
    setIsPlacing(true);
    try {
      const r = await fetch(`${API}/api/games/muflis`,{
        method:"POST", credentials:"include",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({stake,selection}),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error||"Failed");
      setBalance(data.newBalance);
      setDealtCards(0); setShowResult(false); setResult(null);
      setPhase("dealing");
      pollRound(data.roundId, selection);
      toast({title:"🃏 Dealing cards!", description:`${formatCurrency(stake)} on ${OPTIONS.find(o=>o.key===selection)?.label}`});
    } catch(e:any) {
      toast({title:"Error",description:e.message,variant:"destructive"});
    } finally { setIsPlacing(false); }
  };

  const reset = ()=>{ setPhase("betting"); setResult(null); setSelection(null); setDealtCards(0); setShowResult(false); };
  const won    = result?.result===selection;
  const selOpt = OPTIONS.find(o=>o.key===selection);
  const resOpt = OPTIONS.find(o=>o.key===result?.result);
  const profit = selOpt ? stake*(selOpt.mult-1) : 0;
  const isDealing = phase==="dealing";

  return (
    <div className="muf-bg" style={{ minHeight:"100vh", display:"flex", flexDirection:"column", color:"#fff", overflowX:"hidden" }}>
      <style>{STYLES}</style>

      {/* Ambient orbs */}
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0 }}>
        <div style={{ position:"absolute", top:"5%", left:"10%", width:280, height:280, borderRadius:"50%", background:"rgba(109,40,217,0.18)", filter:"blur(70px)", animation:"muf-orb 5s ease-in-out infinite" }}/>
        <div style={{ position:"absolute", bottom:"15%", right:"8%", width:220, height:220, borderRadius:"50%", background:"rgba(244,114,182,0.12)", filter:"blur(60px)", animation:"muf-orb 6s ease-in-out 2s infinite" }}/>
        <div style={{ position:"absolute", top:"40%", left:"50%", width:180, height:180, borderRadius:"50%", background:"rgba(167,139,250,0.08)", filter:"blur(50px)", animation:"muf-orb 7s ease-in-out 1s infinite" }}/>
      </div>

      {/* ── HEADER ── */}
      <header style={{ position:"sticky", top:0, zIndex:50, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"9px 14px", background:"rgba(13,0,26,0.92)", borderBottom:"1px solid rgba(167,139,250,0.3)", backdropFilter:"blur(14px)" }}>
        <button onClick={()=>setLocation("/")} style={{ display:"flex", alignItems:"center", gap:5, padding:"6px 12px", borderRadius:10, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.6)", cursor:"pointer", fontSize:13, fontWeight:600 }}>
          <ArrowLeft size={15}/> Back
        </button>

        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:"linear-gradient(135deg,#4c1d95,#6d28d9)", border:"2px solid #a78bfa", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, fontWeight:900, color:"#c4b5fd", boxShadow:"0 0 14px rgba(167,139,250,0.45)" }}>
            ♟
          </div>
          <span style={{ fontWeight:900, fontSize:18, letterSpacing:2, animation:"muf-title 2.5s ease-in-out infinite", background:"linear-gradient(90deg,#a78bfa,#c4b5fd,#f472b6,#a78bfa)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
            MUFLIS
          </span>
          <span style={{ fontSize:12, letterSpacing:1, color:"rgba(196,181,253,0.5)", fontStyle:"italic" }}>Lowest Wins</span>
        </div>

        <div style={{ padding:"6px 12px", borderRadius:10, background:"rgba(167,139,250,0.1)", border:"1px solid rgba(167,139,250,0.25)", color:"#c4b5fd", fontSize:13, fontWeight:800 }}>
          {formatCurrency(balance)}
        </div>
      </header>

      <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", padding:"10px 10px 24px", gap:10, maxWidth:460, margin:"0 auto", width:"100%", position:"relative", zIndex:1 }}>

        {/* ── CARD FAN HERO ── */}
        <div style={{
          width:"100%", borderRadius:20, overflow:"hidden",
          background:"linear-gradient(160deg,#0d001a 0%,#2e1065 40%,#1e0a4a 70%,#0d001a 100%)",
          border:"2px solid rgba(167,139,250,0.4)",
          boxShadow:"0 0 60px rgba(109,40,217,0.3), 0 0 120px rgba(167,139,250,0.08)",
          padding:"18px 12px 8px",
        }}>
          <CardFan/>
          <div style={{ textAlign:"center", marginTop:10, marginBottom:4 }}>
            <div style={{ fontSize:28, fontWeight:900, letterSpacing:5, animation:"muf-title 2.5s ease-in-out infinite", background:"linear-gradient(90deg,#a78bfa,#c4b5fd,#f472b6,#a78bfa)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
              MUFLIS
            </div>
            <div style={{ fontSize:11, color:"rgba(196,181,253,0.4)", letterSpacing:4, marginTop:2, textTransform:"uppercase" }}>Lowest Hand Wins • Teen Patti Variant</div>
          </div>
          <LedStrip count={22}/>
        </div>

        {/* ── PRIZE TIERS ── */}
        <div style={{ width:"100%", display:"flex", flexDirection:"column", gap:5 }}>
          {TIERS.map((t,i)=>(
            <div key={i} style={{
              display:"flex", alignItems:"center", justifyContent:"space-between",
              padding:"9px 18px", borderRadius:10,
              background:t.bg, border:`2px solid ${t.border}44`,
              boxShadow:`0 0 18px ${t.border}33`,
              animation:`muf-tier ${2+i*0.35}s ease-in-out ${i*0.15}s infinite`,
            }}>
              <span style={{ fontWeight:900, fontSize:14, color:t.fg, letterSpacing:3, textTransform:"uppercase" }}>{t.label}</span>
              <span style={{ fontWeight:900, fontSize:18, color:"#fff", letterSpacing:2 }}>{t.value}</span>
            </div>
          ))}
        </div>

        {/* ── CARD TABLE ── */}
        <div style={{
          width:"100%", borderRadius:22, overflow:"hidden", position:"relative",
          background:"radial-gradient(ellipse at center, #1a0040 0%, #0d0025 60%, #040010 100%)",
          border:"3px solid rgba(167,139,250,0.4)",
          boxShadow:"0 0 50px rgba(109,40,217,0.25), inset 0 0 40px rgba(0,0,0,0.8)",
          animation: isDealing ? undefined : "muf-pulse 3s ease-in-out infinite",
        }}>
          <div style={{ borderBottom:"2px solid rgba(167,139,250,0.2)", background:"rgba(0,0,0,0.4)" }}>
            <LedStrip count={20}/>
          </div>

          <div style={{ padding:"16px 12px", display:"flex", flexDirection:"column", alignItems:"center", gap:14, position:"relative" }}>
            {phase==="result" && won && <CoinRain/>}

            {phase==="betting" && (
              <p style={{ fontSize:11, fontWeight:800, letterSpacing:4, color:"rgba(167,139,250,0.4)", textTransform:"uppercase", margin:0 }}>PLACE YOUR BET</p>
            )}
            {isDealing && (
              <p style={{ fontSize:11, fontWeight:800, letterSpacing:4, color:"#a78bfa", textTransform:"uppercase", margin:0, animation:"muf-title 0.8s ease-in-out infinite" }}>🃏 DEALING CARDS...</p>
            )}

            {/* Betting phase: purple card backs */}
            {phase==="betting" && (
              <div style={{ display:"flex", gap:16, alignItems:"center", justifyContent:"center" }}>
                {[0,1,2,3,4].map(i=>(
                  <div key={i} style={{
                    width:42, height:62, borderRadius:6,
                    background:"linear-gradient(135deg,#4c1d95 0%,#6d28d9 50%,#4c1d95 100%)",
                    border:"1.5px solid rgba(167,139,250,0.4)",
                    boxShadow:"0 3px 10px rgba(0,0,0,0.6)",
                    backgroundImage:"repeating-linear-gradient(45deg,rgba(255,255,255,0.04) 0px,rgba(255,255,255,0.04) 2px,transparent 2px,transparent 10px)",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:18, transform:`rotate(${(i-2)*5}deg)`, opacity:0.6+i*0.08,
                  }}>🂠</div>
                ))}
              </div>
            )}

            {/* Deal animation rows */}
            {(isDealing || phase==="result") && (
              <div style={{ width:"100%", display:"flex", flexDirection:"column", gap:12, position:"relative", zIndex:5 }}>
                {DEAL_ROWS.map((row,ri)=>(
                  <div key={ri} style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <div style={{ fontSize:11, fontWeight:800, color:row.color, letterSpacing:2, textTransform:"uppercase", minWidth:44 }}>{row.label}</div>
                    <div style={{ display:"flex", gap:6 }}>
                      {DISP_CARDS[ri].map((c,ci)=>(
                        <DealCard key={ci} delay={ri*0.15+ci*0.4} revealed={dealtCards>ci} value={c.v} suit={c.s} red={c.r}/>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Result overlay */}
            {showResult && (
              <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", zIndex:20, background:"rgba(0,0,0,0.8)", backdropFilter:"blur(3px)" }}>
                <div style={{
                  padding:"20px 36px", borderRadius:20, textAlign:"center",
                  background: won ? "linear-gradient(135deg,#2e1065,#6d28d9)" : "linear-gradient(135deg,#3b0060,#7c1c7c)",
                  border:`3px solid ${won?"#a78bfa":"#f472b6"}`,
                  boxShadow:`0 0 60px ${won?"rgba(167,139,250,0.55)":"rgba(244,114,182,0.5)"}`,
                  animation:"muf-win 0.55s cubic-bezier(.34,1.56,.64,1) forwards",
                }}>
                  <div style={{ fontSize:52 }}>{won?"🏆":"😔"}</div>
                  <div style={{ fontSize:26, fontWeight:900, letterSpacing:3, color:won?"#c4b5fd":"#f9a8d4", marginTop:4 }}>
                    {won?"YOU WON!":"YOU LOST"}
                  </div>
                  {won && <div style={{ fontSize:20, fontWeight:900, color:"#4ade80", marginTop:6 }}>+{formatCurrency(profit)}</div>}
                  <div style={{ fontSize:13, color:"rgba(255,255,255,0.55)", marginTop:6 }}>
                    Result: <span style={{ color:resOpt?.color, fontWeight:800 }}>{resOpt?.label}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={{ borderTop:"2px solid rgba(167,139,250,0.2)", background:"rgba(0,0,0,0.4)" }}>
            <LedStrip count={20}/>
          </div>
        </div>

        {/* ── CONTROLS ── */}
        {phase==="result" && (
          <button onClick={reset} style={{
            width:"100%", padding:"15px 0", borderRadius:16, fontWeight:900, fontSize:16, letterSpacing:3,
            background:"linear-gradient(135deg,#4c1d95 0%,#7c3aed 50%,#4c1d95 100%)",
            color:"#fff", border:"2px solid rgba(167,139,250,0.5)", cursor:"pointer",
            boxShadow:"0 0 30px rgba(109,40,217,0.5)",
          }}>🃏 DEAL AGAIN</button>
        )}

        {phase!=="result" && !isDealing && (
          <>
            <p style={{ textAlign:"center", fontSize:11, fontWeight:800, letterSpacing:4, color:"rgba(167,139,250,0.4)", textTransform:"uppercase", margin:0 }}>Choose Your Side</p>

            {/* Player / Banker */}
            <div style={{ width:"100%", display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              {OPTIONS.map(opt=>{
                const isSel = selection===opt.key;
                return (
                  <button key={opt.key} onClick={()=>setSelection(opt.key)} style={{
                    padding:"20px 8px 16px", borderRadius:18, display:"flex", flexDirection:"column", alignItems:"center", gap:8,
                    background: isSel ? `linear-gradient(180deg,${opt.color}33 0%,${opt.dark}cc 100%)` : "rgba(255,255,255,0.04)",
                    border:`2px solid ${isSel?opt.color:"rgba(167,139,250,0.12)"}`,
                    boxShadow: isSel?`0 0 32px ${opt.glow}, inset 0 0 20px ${opt.color}15`:"none",
                    cursor:"pointer",
                    transform: isSel?"scale(1.04)":"scale(1)",
                    transition:"all 0.18s",
                  }}>
                    <span style={{ fontSize:38, filter:isSel?`drop-shadow(0 0 12px ${opt.color})`:"none" }}>
                      {opt.key==="player"?"👤":"🏦"}
                    </span>
                    <span style={{ fontSize:15, fontWeight:900, color:isSel?opt.color:"rgba(255,255,255,0.6)", letterSpacing:2 }}>
                      {opt.label.toUpperCase()}
                    </span>
                    <span style={{ fontSize:18, fontWeight:900, padding:"5px 16px", borderRadius:10, background:`${opt.color}${isSel?"30":"18"}`, color:opt.color, border:`1px solid ${opt.color}${isSel?"66":"28"}` }}>
                      {opt.sub}
                    </span>
                    <span style={{ fontSize:10, color:isSel?opt.color:"rgba(255,255,255,0.22)", fontWeight:700, letterSpacing:1 }}>
                      LOWEST HAND · MUFLIS
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Chip selector */}
            <div style={{ display:"flex", gap:8, justifyContent:"center", flexWrap:"wrap" }}>
              {CHIP_AMOUNTS.map(amt=>{
                const active = stake===amt;
                return (
                  <button key={amt} onClick={()=>setStake(amt)} style={{
                    width:58, height:58, borderRadius:"50%", fontWeight:900, fontSize:11,
                    border:`3px solid ${active?"#a78bfa":"rgba(109,40,217,0.3)"}`,
                    background: active
                      ? "radial-gradient(circle at 38% 35%,#c4b5fd,#6d28d9)"
                      : "radial-gradient(circle at 38% 35%,#1a0040,#0d001a)",
                    color: active?"#0d001a":"rgba(255,255,255,0.4)",
                    cursor:"pointer",
                    boxShadow: active?"0 0 22px rgba(167,139,250,0.6), inset 0 2px 0 rgba(255,255,255,0.3)":"inset 0 2px 0 rgba(255,255,255,0.05)",
                    animation: active?"muf-chip 0.8s ease-in-out infinite":"none",
                    transition:"all 0.15s",
                  }}>
                    {amt>=1000?`${amt/1000}K`:amt}
                  </button>
                );
              })}
            </div>

            {/* Info bar */}
            <div style={{ width:"100%", display:"flex", justifyContent:"space-between", padding:"8px 16px", borderRadius:12, background:"rgba(0,0,0,0.5)", border:"1px solid rgba(167,139,250,0.15)" }}>
              <span style={{ fontSize:12, color:"rgba(255,255,255,0.4)", fontWeight:700 }}>WIN: <span style={{ color:"#4ade80" }}>{selection?formatCurrency(stake*(OPTIONS.find(o=>o.key===selection)?.mult??1)):"—"}</span></span>
              <span style={{ fontSize:12, color:"rgba(255,255,255,0.4)", fontWeight:700 }}>BET: <span style={{ color:"#a78bfa" }}>{formatCurrency(stake)}</span></span>
              <span style={{ fontSize:12, color:"rgba(255,255,255,0.4)", fontWeight:700 }}>BAL: <span style={{ color:"#c4b5fd" }}>{formatCurrency(balance)}</span></span>
            </div>

            {/* Deal button */}
            {isAuthenticated ? (
              <button onClick={placeBet} disabled={isPlacing||!selection} style={{
                width:"100%", padding:"16px 0", borderRadius:16, fontWeight:900, fontSize:18, letterSpacing:4,
                background: selection
                  ? "linear-gradient(135deg,#2e1065 0%,#7c3aed 40%,#f472b6 60%,#2e1065 100%)"
                  : "rgba(255,255,255,0.04)",
                color: selection?"#fff":"rgba(255,255,255,0.2)",
                border:`2px solid ${selection?"rgba(167,139,250,0.5)":"rgba(255,255,255,0.05)"}`,
                boxShadow: selection?"0 0 40px rgba(109,40,217,0.6), 0 0 20px rgba(244,114,182,0.2)":"none",
                cursor: selection?"pointer":"not-allowed",
                transition:"all 0.2s",
                textShadow: selection?"0 0 16px rgba(255,255,255,0.5)":"none",
              }}>
                {isPlacing?"🃏 DEALING...":!selection?"← PICK A SIDE":"🃏 DEAL CARDS"}
              </button>
            ) : (
              <button onClick={()=>setLocation("/login")} style={{
                width:"100%", padding:"16px 0", borderRadius:16, fontWeight:900, fontSize:18, letterSpacing:4,
                background:"linear-gradient(135deg,#4c1d95,#7c3aed)", color:"#fff",
                border:"2px solid rgba(167,139,250,0.4)", cursor:"pointer",
                boxShadow:"0 0 30px rgba(109,40,217,0.5)",
              }}>LOG IN TO PLAY</button>
            )}
          </>
        )}

        {isDealing && (
          <div style={{ textAlign:"center", padding:"10px 20px", borderRadius:12, background:"rgba(109,40,217,0.08)", border:"1px solid rgba(167,139,250,0.18)", fontSize:13, color:"rgba(255,255,255,0.5)" }}>
            🃏 Bet on <strong style={{ color:selOpt?.color }}>{selOpt?.label}</strong> · Cards are being dealt...
          </div>
        )}
      </div>
    </div>
  );
}
