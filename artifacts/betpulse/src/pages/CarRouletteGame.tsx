import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey, getGetBalanceQueryKey } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");
const BASE = import.meta.env.BASE_URL;

type Selection = "car1" | "car2" | "car3";
type Phase = "betting" | "spinning" | "result";

// ─── Wheel config ─────────────────────────────────────────────────────────────
const N_SECTORS = 12;
const SECTOR_ANG = 360 / N_SECTORS;

// 12 sectors: car1=5, car2=5, car3=2
const WHEEL_MAP: Selection[] = [
  "car1","car2","car1","car2","car1","car3",
  "car2","car1","car2","car1","car2","car3",
];

const CAR_CFG: Record<Selection,{label:string;icon:string;mult:number;primary:string;alt:string;dark:string;glow:string}> = {
  car1: { label:"CAR #1", icon:"🔵", mult:1.95, primary:"#3b82f6", alt:"#1d4ed8", dark:"#0a1525", glow:"rgba(59,130,246,0.5)" },
  car2: { label:"CAR #2", icon:"🔴", mult:1.95, primary:"#ef4444", alt:"#b91c1c", dark:"#1c0505", glow:"rgba(239,68,68,0.5)"  },
  car3: { label:"CAR #3", icon:"🏆", mult:5,    primary:"#f5c542", alt:"#d97706", dark:"#1c1100", glow:"rgba(245,197,66,0.6)"  },
};

const CHIPS = [{v:100,c:"#22c55e"},{v:500,c:"#3b82f6"},{v:1000,c:"#a855f7"},{v:5000,c:"#f97316"},{v:10000,c:"#f5c542"}];

const TICKER = "🏁 CAR ROULETTE  •  🔵 CAR 1: 1.95×  •  🔴 CAR 2: 1.95×  •  🏆 CAR 3: JACKPOT 5×  •  🎰 SPIN TO WIN  •  🏆 SPEED BETTING  •  ";

// ─── SVG Wheel helpers ────────────────────────────────────────────────────────
function polar(cx:number,cy:number,r:number,deg:number){
  const rad=(deg-90)*Math.PI/180;
  return{x:cx+r*Math.cos(rad),y:cy+r*Math.sin(rad)};
}

function sectorPath(cx:number,cy:number,r:number,a1:number,a2:number){
  const s=polar(cx,cy,r,a1), e=polar(cx,cy,r,a2);
  const large=a2-a1>180?1:0;
  const si=polar(cx,cy,34,a1), ei=polar(cx,cy,34,a2);
  return `M ${si.x},${si.y} L ${s.x},${s.y} A ${r},${r} 0 ${large},1 ${e.x},${e.y} L ${ei.x},${ei.y} A 34,34 0 ${large},0 ${si.x},${si.y} Z`;
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const STYLES = `
  .cr2-root {
    background: radial-gradient(ellipse at 50% -10%, #0e0028 0%, #060010 50%, #020008 100%);
    min-height: 100dvh;
    font-family: 'Segoe UI', system-ui, sans-serif;
    color: #fff;
  }
  .cr2-root::before {
    content: '';
    position: fixed;
    inset: 0;
    pointer-events: none;
    background:
      radial-gradient(ellipse 80% 50% at 50% 0%, rgba(139,92,246,0.06) 0%, transparent 60%),
      repeating-linear-gradient(60deg, rgba(139,92,246,0.015) 0px, rgba(139,92,246,0.015) 1px, transparent 1px, transparent 40px);
    z-index: 0;
  }
  @keyframes cr2-ticker    { from{transform:translateX(0)} to{transform:translateX(-50%)} }
  @keyframes cr2-shimmer   { 0%{background-position:-300% 0} 100%{background-position:300% 0} }
  @keyframes cr2-pulse-glow{ 0%,100%{opacity:0.6} 50%{opacity:1} }
  @keyframes cr2-burst     { 0%{transform:scale(0.05);opacity:0} 55%{transform:scale(1.07)} 80%{transform:scale(0.97)} 100%{transform:scale(1);opacity:1} }
  @keyframes cr2-confetti  { 0%{transform:translateY(-10px) rotate(0deg);opacity:1} 100%{transform:translateY(320px) rotate(720deg);opacity:0} }
  @keyframes cr2-ring      { 0%{box-shadow:0 0 0 0 rgba(245,197,66,0.6)} 70%{box-shadow:0 0 0 20px rgba(245,197,66,0)} 100%{box-shadow:0 0 0 0 rgba(245,197,66,0)} }
  @keyframes cr2-ball      { 0%{transform:rotate(0deg) translateX(88px)} 100%{transform:rotate(360deg) translateX(88px)} }
  @keyframes cr2-ballstop  { 0%{transform:rotate(0deg) translateX(88px)} 100%{transform:rotate(1800deg) translateX(88px)} }
`;

// ─── Wheel component ──────────────────────────────────────────────────────────
function SpinWheel({ deg, winSector, phase }:{deg:number;winSector:number|null;phase:Phase}) {
  const cx=150,cy=150,R=130;
  const winner = winSector;

  const sectors = WHEEL_MAP.map((car,i)=>{
    const a1=i*SECTOR_ANG, a2=(i+1)*SECTOR_ANG;
    const cfg=CAR_CFG[car];
    const isAlt=i%2===1;
    const fill=isAlt?cfg.alt:cfg.primary;
    const isWin=winner===i&&phase==="result";
    const mid=polar(cx,cy,R*0.66,a1+SECTOR_ANG/2);

    return {car,a1,a2,fill,isWin,mid,cfg,path:sectorPath(cx,cy,R,a1,a2)};
  });

  return (
    <div style={{position:"relative",width:300,height:300}}>
      {/* Outer ring glow */}
      <div style={{
        position:"absolute",inset:-6,borderRadius:"50%",
        background:`conic-gradient(from 0deg, #3b82f6, #ef4444, #f5c542, #3b82f6)`,
        opacity:phase==="spinning"?0.5:0.2,
        filter:"blur(8px)",
        transition:"opacity 0.5s",
        animation:phase==="result"?"cr2-ring 1s ease-out":undefined,
      }}/>

      <svg viewBox="0 0 300 300" style={{
        width:300,height:300,
        transform:`rotate(${deg}deg)`,
        transition:"none",
        filter:phase==="result"?"drop-shadow(0 0 18px rgba(245,197,66,0.5))":undefined,
      }}>
        <defs>
          <filter id="sect-glow">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          {sectors.map((s,i)=>(
            <radialGradient key={i} id={`sg${i}`} cx="50%" cy="30%" r="70%">
              <stop offset="0%" stopColor={s.fill} stopOpacity="0.9"/>
              <stop offset="100%" stopColor={s.fill} stopOpacity="0.6"/>
            </radialGradient>
          ))}
        </defs>

        {/* Sectors */}
        {sectors.map((s,i)=>(
          <path key={i} d={s.path}
            fill={s.isWin?`#ffffff22`:s.fill}
            stroke={s.isWin?"rgba(245,197,66,0.8)":"rgba(0,0,0,0.4)"}
            strokeWidth={s.isWin?2:1}
            filter={s.isWin?"url(#sect-glow)":undefined}
            opacity={winner!==null&&!s.isWin&&phase==="result"?0.45:1}
          />
        ))}

        {/* Spoke lines */}
        {sectors.map((s,i)=>{
          const p1=polar(cx,cy,34,s.a1);
          const p2=polar(cx,cy,R,s.a1);
          return <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
            stroke="rgba(0,0,0,0.6)" strokeWidth={1.5}/>;
        })}

        {/* Sector labels */}
        {sectors.map((s,i)=>{
          const isWin=winner===i&&phase==="result";
          return (
            <g key={i}>
              <text
                x={s.mid.x} y={s.mid.y-5}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={15}
                fill={isWin?"#fff":"rgba(255,255,255,0.9)"}
                fontWeight={isWin?900:700}
                transform={`rotate(${s.a1+SECTOR_ANG/2},${s.mid.x},${s.mid.y})`}
              >
                {s.car==="car1"?"🚗":s.car==="car2"?"🏎":"⭐"}
              </text>
              <text
                x={s.mid.x} y={s.mid.y+10}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={8} fontWeight={900}
                fill={isWin?"#fff":"rgba(255,255,255,0.65)"}
                letterSpacing={0}
                transform={`rotate(${s.a1+SECTOR_ANG/2},${s.mid.x},${s.mid.y})`}
              >
                {s.car==="car3"?"5×":"1.95×"}
              </text>
            </g>
          );
        })}

        {/* Center hub */}
        <circle cx={cx} cy={cy} r={34} fill="#0a0018" stroke="rgba(245,197,66,0.5)" strokeWidth={2}/>
        <circle cx={cx} cy={cy} r={28} fill="#100020" stroke="rgba(245,197,66,0.2)" strokeWidth={1}/>
        <text x={cx} y={cy+1} textAnchor="middle" dominantBaseline="middle" fontSize={18}>🎰</text>
      </svg>

      {/* Pointer / needle */}
      <div style={{
        position:"absolute",top:-2,left:"50%",transform:"translateX(-50%)",
        width:0,height:0,
        borderLeft:"12px solid transparent",borderRight:"12px solid transparent",
        borderTop:"28px solid #f5c542",
        filter:"drop-shadow(0 4px 8px rgba(245,197,66,0.8))",
        zIndex:10,
      }}/>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function CarRouletteGame() {
  const [,nav]    = useLocation();
  const {user}    = useAuth();
  const qc        = useQueryClient();
  const {toast}   = useToast();

  const [phase,setPhase]     = useState<Phase>("betting");
  const [selection,setSel]   = useState<Selection|null>(null);
  const [bet,setBet]         = useState(0);
  const [win,setWin]         = useState(0);
  const [resultKey,setRes]   = useState<Selection|null>(null);
  const [winSector,setWinSec]= useState<number|null>(null);
  const [confetti,setConf]   = useState<{x:number;id:number;icon:string}[]>([]);

  const wheelDegRef  = useRef(0);
  const [wheelDeg,setWheelDeg] = useState(0);
  const intervalRef  = useRef<any>(null);
  const pollRef      = useRef<any>(null);
  const decelRef     = useRef<{startDeg:number;target:number;startMs:number}|null>(null);
  const resultReadyRef = useRef<Selection|null>(null);
  const phaseComplRef  = useRef(false);
  const balance = (user as any)?.balance ?? 0;

  useEffect(()=>{
    const s=document.createElement("style");s.textContent=STYLES;document.head.appendChild(s);
    return()=>{try{document.head.removeChild(s)}catch{}};
  },[]);

  // Wheel tick loop
  useEffect(()=>{
    if(intervalRef.current)clearInterval(intervalRef.current);
    intervalRef.current=setInterval(()=>{
      const d=decelRef.current;
      if(d){
        const elapsed=Date.now()-d.startMs;
        const dur=4200;
        const t=Math.min(elapsed/dur,1);
        const eased=1-Math.pow(1-t,3);
        const deg=d.startDeg+(d.target-d.startDeg)*eased;
        wheelDegRef.current=deg;
        setWheelDeg(deg);
        if(t>=1&&!phaseComplRef.current){
          phaseComplRef.current=true;
          clearInterval(intervalRef.current);
          // find winning sector from final deg
          const norm=((deg%360)+360)%360;
          // pointer at top=0° → wheel angle 0° means sector 0 is at top
          // sectorIndex at top = floor((-norm+360)%360 / SECTOR_ANG)
          const atTop=(((-norm)%360)+360)%360;
          const secIdx=Math.floor(atTop/SECTOR_ANG)%N_SECTORS;
          setWinSec(secIdx);
          const srv=resultReadyRef.current!;
          setRes(srv);
          const won=srv===resultReadyRef.current&&resultReadyRef.current!==null;
          const cfg=CAR_CFG[srv];
          // already stored the selection that placed the bet in ref
          setTimeout(()=>{setPhase("result");},300);
        }
      } else {
        wheelDegRef.current += 9;
        setWheelDeg(wheelDegRef.current);
      }
    },16);
    return()=>clearInterval(intervalRef.current);
  },[]);

  useEffect(()=>()=>{if(pollRef.current)clearInterval(pollRef.current);},[]);

  function fireConfetti(){
    const icons=["🏎","🚗","🏆","💰","⭐","🎉","🏁","💎"];
    setConf(Array.from({length:18},(_,i)=>({x:Math.random()*90,id:i,icon:icons[i%icons.length]})));
    setTimeout(()=>setConf([]),2800);
  }

  function getWheelTarget(result:Selection):number{
    const validSectors=WHEEL_MAP
      .map((c,i)=>({c,i}))
      .filter(x=>x.c===result)
      .map(x=>x.i);
    const si=validSectors[Math.floor(Math.random()*validSectors.length)];
    // center of sector si in degrees
    const sectorCenterDeg=si*SECTOR_ANG+SECTOR_ANG/2;
    // to land at top, wheel must rotate so sector center maps to 0°
    const neededWheelRot=(360-sectorCenterDeg+360)%360;
    const currentNorm=((wheelDegRef.current%360)+360)%360;
    let diff=(neededWheelRot-currentNorm+360)%360;
    if(diff<180) diff+=360; // ensure at least half rotation in decel
    return wheelDegRef.current+diff+1080; // 3 extra spins
  }

  const placeBet=useCallback(async()=>{
    if(!selection||bet<=0||phase!=="betting")return;
    const lockedSel=selection,lockedBet=bet;
    setPhase("spinning");decelRef.current=null;resultReadyRef.current=null;phaseComplRef.current=false;
    setWinSec(null);setRes(null);setWin(0);

    try{
      const r=await fetch(`${API}/api/games/car-roulette`,{
        method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",
        body:JSON.stringify({selection:lockedSel,stake:lockedBet}),
      });
      if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.error||"Bet failed");}
      const {roundId}=await r.json();
      qc.invalidateQueries({queryKey:getGetBalanceQueryKey()});
      qc.invalidateQueries({queryKey:getGetMeQueryKey()});

      if(pollRef.current)clearInterval(pollRef.current);
      pollRef.current=setInterval(async()=>{
        try{
          const pr=await fetch(`${API}/api/games/casino-round/car-roulette/${roundId}`,{credentials:"include"});
          if(!pr.ok)return;
          const d=await pr.json();
          if(d.status==="settled"){
            clearInterval(pollRef.current);
            const srv=(d.result??"").trim().toLowerCase() as Selection;
            const target=getWheelTarget(srv);
            resultReadyRef.current=srv;
            const won=srv===lockedSel;
            setWin(won?lockedBet*CAR_CFG[srv].mult:0);
            if(won){qc.invalidateQueries({queryKey:getGetBalanceQueryKey()});qc.invalidateQueries({queryKey:getGetMeQueryKey()});}
            decelRef.current={startDeg:wheelDegRef.current,target,startMs:Date.now()};
            if(won) setTimeout(()=>fireConfetti(),4400);
          }
        }catch{}
      },600);
      setTimeout(()=>{if(pollRef.current)clearInterval(pollRef.current);},35000);
    }catch(e:any){
      setPhase("betting");
      toast({title:"Error",description:(e as any).message,variant:"destructive"});
    }
  },[selection,bet,phase,qc,toast]);

  function collect(){
    setPhase("betting");setWin(0);setRes(null);setSel(null);setBet(0);
    setWinSec(null);decelRef.current=null;resultReadyRef.current=null;phaseComplRef.current=false;
  }
  function chip(v:number){if(phase!=="betting")return;setBet(b=>Math.min(b+v,balance));}

  const busy=phase==="spinning";
  const selCfg=selection?CAR_CFG[selection]:null;
  const resCfg=resultKey?CAR_CFG[resultKey]:null;
  const won=win>0;

  return (
    <div className="cr2-root">
      {/* Confetti */}
      <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:60,overflow:"hidden"}}>
        {confetti.map(c=>(
          <div key={c.id} style={{position:"absolute",top:-20,left:`${c.x}%`,fontSize:18,
            animation:`cr2-confetti ${1.4+Math.random()*0.8}s ease-in forwards`}}>{c.icon}</div>
        ))}
      </div>

      <div style={{position:"relative",zIndex:10,maxWidth:480,margin:"0 auto",paddingBottom:32}}>
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
          padding:"13px 16px",background:"rgba(2,0,10,0.95)",
          borderBottom:"1px solid rgba(139,92,246,0.2)",backdropFilter:"blur(14px)",
          position:"sticky",top:0,zIndex:30}}>
          <button onClick={()=>nav("/")} style={{
            display:"flex",alignItems:"center",gap:6,padding:"7px 13px",
            background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.09)",
            borderRadius:10,color:"rgba(255,255,255,0.6)",cursor:"pointer",fontSize:14,
          }}>
            <ArrowLeft size={15}/>Back
          </button>
          <div style={{display:"flex",alignItems:"center",gap:9}}>
            <img src={`${BASE}car-roulette-logo.jpg`} alt="" style={{height:34,width:34,borderRadius:8,objectFit:"cover"}}
              onError={e=>(e.currentTarget.style.display="none")}/>
            <div>
              <div style={{fontSize:15,fontWeight:900,letterSpacing:2,
                background:"linear-gradient(90deg,#3b82f6,#fff,#ef4444)",
                WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>
                🏁 CAR ROULETTE
              </div>
              <div style={{fontSize:9,color:"rgba(139,92,246,0.6)",letterSpacing:2}}>GRAND PRIX SPIN</div>
            </div>
          </div>
          <div style={{background:"rgba(139,92,246,0.08)",border:"1px solid rgba(139,92,246,0.22)",
            borderRadius:10,padding:"6px 12px",textAlign:"right"}}>
            <div style={{fontSize:8,color:"rgba(255,255,255,0.3)",letterSpacing:1}}>BALANCE</div>
            <div style={{fontSize:12,fontWeight:800,color:"#a78bfa"}}>{formatCurrency(balance)}</div>
          </div>
        </div>

        {/* Ticker */}
        <div style={{height:26,overflow:"hidden",display:"flex",alignItems:"center",
          background:"rgba(2,0,10,0.9)",borderBottom:"1px solid rgba(139,92,246,0.12)"}}>
          <div style={{whiteSpace:"nowrap",fontSize:11,color:"rgba(139,92,246,0.55)",letterSpacing:0.5,
            animation:"cr2-ticker 22s linear infinite"}}>{TICKER}{TICKER}</div>
        </div>

        <div style={{padding:"14px 12px 8px"}}>
          <div style={{textAlign:"center",marginBottom:12,fontSize:10,letterSpacing:3,
            color:"rgba(139,92,246,0.4)",fontWeight:700}}>🏁 SPIN THE WHEEL — PICK YOUR WINNER 🏁</div>

          {/* ═══ Wheel ═══ */}
          <div style={{
            display:"flex",flexDirection:"column",alignItems:"center",
            background:"radial-gradient(ellipse at 50% 30%,rgba(30,10,70,0.95),rgba(4,0,15,0.98))",
            border:"2px solid rgba(139,92,246,0.3)",borderRadius:24,
            padding:"24px 14px 20px",position:"relative",overflow:"hidden",
          }}>
            {/* Background speed lines */}
            {busy&&Array.from({length:6},(_,i)=>(
              <div key={i} style={{
                position:"absolute",
                top:`${10+i*15}%`,left:0,right:0,height:1,
                background:`linear-gradient(90deg,transparent,rgba(139,92,246,${0.05+i*0.02}),transparent)`,
                animation:`cr2-shimmer ${1.2+i*0.2}s linear infinite`,backgroundSize:"200% 100%",
              }}/>
            ))}

            <SpinWheel deg={wheelDeg} winSector={winSector} phase={phase}/>

            {/* Result panel — overlaid on wheel area */}
            {phase==="result"&&resCfg&&(
              <div style={{
                marginTop:18,width:"100%",
                background:won
                  ?"linear-gradient(135deg,rgba(10,25,5,0.95),rgba(20,60,20,0.95))"
                  :"linear-gradient(135deg,rgba(20,5,5,0.95),rgba(80,15,15,0.95))",
                border:`2px solid ${won?"rgba(245,197,66,0.55)":"rgba(239,68,68,0.35)"}`,
                borderRadius:18,padding:"18px 14px",textAlign:"center",
                animation:"cr2-burst 0.5s cubic-bezier(.34,1.56,.64,1) both",
                backdropFilter:"blur(8px)",
              }}>
                <div style={{fontSize:36,marginBottom:4}}>
                  {won?"🏆":"💨"}
                </div>
                <div style={{fontSize:16,fontWeight:900,letterSpacing:2,marginBottom:4,
                  color:won?"#f5c542":"#fca5a5"}}>
                  {won?"WINNER WINNER!":"BETTER LUCK NEXT SPIN"}
                </div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.45)",marginBottom:won?10:14}}>
                  <span style={{color:resCfg.primary,fontWeight:700}}>{resCfg.label}</span> takes the race · {resCfg.mult}×
                </div>
                {won&&(
                  <div style={{fontSize:28,fontWeight:900,color:"#f5c542",letterSpacing:1,
                    textShadow:"0 0 24px rgba(245,197,66,0.6)",marginBottom:14}}>
                    +{formatCurrency(win)}
                  </div>
                )}
                <button onClick={collect} style={{
                  padding:"12px 32px",borderRadius:14,border:"none",cursor:"pointer",
                  fontWeight:900,fontSize:14,letterSpacing:1,
                  background:won?"linear-gradient(90deg,#d97706,#f5c542,#d97706)":"linear-gradient(90deg,#7f1d1d,#dc2626)",
                  color:won?"#020c05":"#fff",
                  boxShadow:won?"0 0 20px rgba(245,197,66,0.4)":undefined,
                }}>
                  {won?"💰 COLLECT":"🏁 SPIN AGAIN"}
                </button>
              </div>
            )}

            {busy&&(
              <div style={{marginTop:12,display:"flex",alignItems:"center",gap:6,
                color:"rgba(139,92,246,0.7)",fontSize:11,letterSpacing:2}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:"#8b5cf6",
                  animation:"cr2-pulse-glow 0.6s ease-in-out infinite"}}/>
                WHEEL IS SPINNING...
              </div>
            )}
          </div>

          {/* Bet cards */}
          <div style={{marginTop:14,display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
            {(Object.entries(CAR_CFG) as [Selection,typeof CAR_CFG[Selection]][]).map(([key,cfg])=>{
              const sel=selection===key;
              const isJack=key==="car3";
              return (
                <div key={key} onClick={()=>{if(phase!=="betting")return;setSel(key);}}
                  style={{
                    background:sel?`linear-gradient(145deg,${cfg.dark},rgba(0,0,0,0.8))`:"rgba(0,0,0,0.5)",
                    border:`2px solid ${sel?cfg.glow:"rgba(255,255,255,0.07)"}`,
                    borderRadius:16,padding:"14px 6px",textAlign:"center",cursor:"pointer",
                    transition:"all 0.2s",position:"relative",overflow:"hidden",
                    boxShadow:sel?`0 0 24px ${cfg.glow}`:undefined,
                  }}>
                  {isJack&&(
                    <div style={{
                      position:"absolute",top:5,left:"50%",transform:"translateX(-50%)",
                      background:"linear-gradient(90deg,#d97706,#f5c542)",
                      borderRadius:8,padding:"2px 8px",fontSize:7,fontWeight:900,
                      color:"#020c05",letterSpacing:1,whiteSpace:"nowrap",
                    }}>JACKPOT</div>
                  )}
                  <div style={{fontSize:22,marginBottom:4,marginTop:isJack?12:0}}>
                    {cfg.icon}
                  </div>
                  <div style={{fontSize:9,fontWeight:900,letterSpacing:2,
                    color:sel?cfg.primary:"rgba(255,255,255,0.4)"}}>{cfg.label}</div>
                  <div style={{fontSize:20,fontWeight:900,marginTop:4,
                    color:sel?cfg.primary:"rgba(255,255,255,0.2)",
                    textShadow:sel?`0 0 14px ${cfg.glow}`:undefined}}>{cfg.mult}×</div>
                </div>
              );
            })}
          </div>

          {/* Chips */}
          <div style={{marginTop:14}}>
            <div style={{fontSize:9,letterSpacing:3,color:"rgba(255,255,255,0.2)",marginBottom:8,textAlign:"center"}}>
              PLACE CHIPS
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap"}}>
              {CHIPS.map(({v,c})=>(
                <button key={v} onClick={()=>chip(v)} disabled={busy} style={{
                  width:52,height:52,borderRadius:"50%",border:`3px solid ${c}`,cursor:"pointer",
                  background:`radial-gradient(circle at 35% 30%,${c}cc,${c}55)`,
                  color:"#fff",fontSize:10,fontWeight:900,
                  boxShadow:`0 4px 14px ${c}44,inset 0 1px 0 rgba(255,255,255,0.3)`,
                  opacity:busy?0.4:1,
                }}>
                  {v>=1000?`${v/1000}K`:v}
                </button>
              ))}
            </div>
          </div>

          {/* Info bar */}
          <div style={{marginTop:14,display:"grid",gridTemplateColumns:"repeat(3,1fr)",
            background:"rgba(0,0,0,0.5)",border:"1px solid rgba(139,92,246,0.1)",
            borderRadius:14,overflow:"hidden"}}>
            {[
              {l:"WIN",    v:formatCurrency(win),    c:win>0?"#f5c542":"rgba(255,255,255,0.2)"},
              {l:"BET",    v:formatCurrency(bet),    c:bet>0?"#22c55e":"rgba(255,255,255,0.2)"},
              {l:"BALANCE",v:formatCurrency(balance),c:"rgba(255,255,255,0.35)"},
            ].map((item,i)=>(
              <div key={i} style={{padding:"10px 0",textAlign:"center",
                borderRight:i<2?"1px solid rgba(139,92,246,0.08)":undefined}}>
                <div style={{fontSize:8,letterSpacing:2,color:"rgba(255,255,255,0.2)",marginBottom:2}}>{item.l}</div>
                <div style={{fontSize:12,fontWeight:700,color:item.c}}>{item.v}</div>
              </div>
            ))}
          </div>

          {/* Spin button */}
          {phase!=="result"&&(
            <button onClick={placeBet} disabled={busy||!selection||bet<=0}
              style={{
                marginTop:14,width:"100%",padding:"17px 0",borderRadius:18,border:"none",cursor:"pointer",
                fontSize:16,fontWeight:900,letterSpacing:2,
                background:busy
                  ?"linear-gradient(90deg,#1e1035,#2d1a5c)"
                  :(!selection||bet<=0)
                  ?"rgba(255,255,255,0.04)"
                  :"linear-gradient(90deg,#3b82f6,#8b5cf6,#ef4444,#8b5cf6,#3b82f6)",
                backgroundSize:"200% 100%",
                color:(!selection||bet<=0)&&!busy?"rgba(255,255,255,0.2)":"#fff",
                boxShadow:(!busy&&selection&&bet>0)?"0 0 30px rgba(139,92,246,0.5),0 4px 20px rgba(0,0,0,0.5)":undefined,
                animation:(!busy&&selection&&bet>0)?"cr2-shimmer 2.5s linear infinite":undefined,
                opacity:(!selection||bet<=0)&&!busy?0.35:1,
              }}>
              {busy?"🎰 SPINNING THE WHEEL...":"🏁 SPIN THE WHEEL 🏁"}
            </button>
          )}

          <div style={{marginTop:8,textAlign:"center",fontSize:11,color:"rgba(255,255,255,0.18)",letterSpacing:1}}>
            {!selection&&phase==="betting"&&"Pick Car #1 · Car #2 · or Jackpot Car #3"}
            {selection&&bet<=0&&phase==="betting"&&`${selCfg?.icon} ${selCfg?.label} selected — add chips`}
            {selection&&bet>0&&phase==="betting"&&`${selCfg?.mult}× payout if ${selCfg?.label} wins`}
            {busy&&"Wheel is spinning — results incoming..."}
          </div>
        </div>
      </div>
    </div>
  );
}
