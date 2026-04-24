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
type Phase = "betting" | "countdown" | "racing" | "result";

const TRACK_TRAVEL = 240; // px the car moves right on track
const BASE_SPD = 1.4;
const CHIPS = [{v:100,c:"#22c55e"},{v:500,c:"#3b82f6"},{v:1000,c:"#a855f7"},{v:5000,c:"#f97316"},{v:10000,c:"#f5c542"}];

const CAR_CFG = {
  car1: { name:"BMW M8",    brand:"BMW",        mult:1.95, bg:"#1d4ed8", track:"#3b82f6", badge:"rgba(59,130,246,0.3)", glow:"rgba(59,130,246,0.5)"  },
  car2: { name:"Ferrari F8",brand:"FERRARI",    mult:1.95, bg:"#b91c1c", track:"#ef4444", badge:"rgba(239,68,68,0.3)",  glow:"rgba(239,68,68,0.5)"   },
  car3: { name:"Lambo Urus",brand:"LAMBORGHINI",mult:5,    bg:"#92400e", track:"#f59e0b", badge:"rgba(245,158,11,0.3)", glow:"rgba(245,197,66,0.6)"  },
} as const;

const TICKER = "🏁 CAR ROULETTE  •  🔵 BMW M8: 1.95×  •  🔴 FERRARI F8: 1.95×  •  🏆 LAMBO URUS JACKPOT: 5×  •  🏎 RACE TO WIN  •  ";

// ─── Car SVGs ──────────────────────────────────────────────────────────────────
function BMW({ lit, spin }:{ lit?:boolean; spin?:boolean }) {
  const wheelStyle = spin ? { animation:"cr3-wspin 0.15s linear infinite" } as React.CSSProperties : {};
  return (
    <svg viewBox="0 0 155 55" style={{width:155,height:55,display:"block",overflow:"visible"}}>
      <defs>
        <radialGradient id="bw-body" cx="50%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#60a5fa"/><stop offset="100%" stopColor="#1d4ed8"/>
        </radialGradient>
        <radialGradient id="bw-wheel" cx="35%" cy="25%" r="65%">
          <stop offset="0%" stopColor="#6b7280"/><stop offset="100%" stopColor="#111"/>
        </radialGradient>
      </defs>
      {/* Underbody */}
      <rect x="15" y="43" width="128" height="5" rx="2" fill="#1e3a8a"/>
      {/* Body */}
      <path d="M15,43 L15,36 Q18,26 30,21 Q44,16 62,13 Q80,11 97,12 Q114,13 126,19 Q138,26 143,36 L143,43 Z"
        fill="url(#bw-body)"/>
      {/* Roof */}
      <path d="M44,21 Q52,10 68,7 Q84,5 98,7 Q110,10 117,18 Q100,13 80,12 Q60,12 44,21 Z"
        fill="#1e40af"/>
      {/* Roof highlight */}
      <path d="M50,19 Q56,10 68,7 Q78,5 84,7 Q75,11 60,17 Z" fill="rgba(147,197,253,0.45)"/>
      {/* Front window */}
      <path d="M46,20 Q53,10 68,7 Q78,5 84,7 Q74,12 58,17 Z" fill="rgba(186,230,253,0.68)"/>
      {/* Rear window */}
      <path d="M88,8 Q100,7 110,14 Q106,19 97,20 Q90,15 88,8 Z" fill="rgba(186,230,253,0.68)"/>
      {/* Headlight cluster */}
      <ellipse cx="144" cy="31" rx="7" ry="5" fill={lit?"#fef9c3":"#fef08a"} opacity="0.9"/>
      <ellipse cx="144" cy="31" rx="4" ry="3" fill="#fff" opacity="0.5"/>
      {/* Taillights */}
      <rect x="12" y="27" width="5" height="13" rx="2" fill="#ef4444" opacity="0.9"/>
      <rect x="12" y="27" width="3" height="5" rx="1" fill="#fca5a5" opacity="0.7"/>
      {/* BMW Roundel */}
      <g transform="translate(132,34) scale(0.9)">
        <circle r="6" fill="#fff" opacity="0.9"/>
        <path d="M-6,0 A6,6 0 0,1 0,-6 L0,0 Z" fill="#3b82f6"/>
        <path d="M0,0 A6,6 0 0,1 6,0 L6,0 Z" fill="#3b82f6"/>
        <circle r="6" fill="none" stroke="#ddd" strokeWidth="0.8"/>
      </g>
      {/* Left wheel */}
      <g transform={`translate(36,46)`} style={wheelStyle}>
        <circle r="11" fill="url(#bw-wheel)"/>
        <circle r="8" fill="#1f2937" stroke="#9ca3af" strokeWidth="1.5"/>
        <line x1="0" y1="-7" x2="0" y2="7" stroke="#9ca3af" strokeWidth="1"/>
        <line x1="-7" y1="0" x2="7" y2="0" stroke="#9ca3af" strokeWidth="1"/>
        <circle r="2.5" fill="#374151"/>
      </g>
      {/* Right wheel */}
      <g transform={`translate(118,46)`} style={wheelStyle}>
        <circle r="11" fill="url(#bw-wheel)"/>
        <circle r="8" fill="#1f2937" stroke="#9ca3af" strokeWidth="1.5"/>
        <line x1="0" y1="-7" x2="0" y2="7" stroke="#9ca3af" strokeWidth="1"/>
        <line x1="-7" y1="0" x2="7" y2="0" stroke="#9ca3af" strokeWidth="1"/>
        <circle r="2.5" fill="#374151"/>
      </g>
    </svg>
  );
}

function Ferrari({ lit, spin }:{ lit?:boolean; spin?:boolean }) {
  const wheelStyle = spin ? { animation:"cr3-wspin 0.12s linear infinite" } as React.CSSProperties : {};
  return (
    <svg viewBox="0 0 160 52" style={{width:155,height:52,display:"block",overflow:"visible"}}>
      <defs>
        <radialGradient id="fe-body" cx="50%" cy="25%" r="70%">
          <stop offset="0%" stopColor="#f87171"/><stop offset="100%" stopColor="#991b1b"/>
        </radialGradient>
      </defs>
      {/* Side skirt */}
      <rect x="10" y="40" width="148" height="5" rx="2" fill="#7f1d1d"/>
      {/* Main body — very low profile */}
      <path d="M10,40 L10,33 Q12,25 22,21 Q32,17 45,15 Q62,13 82,13 Q103,12 120,15 Q136,18 146,26 Q154,32 156,40 Z"
        fill="url(#fe-body)"/>
      {/* Cabin — very compact */}
      <path d="M47,15 Q54,7 68,5 Q82,3 95,5 Q106,7 111,13 Q95,12 82,13 Q62,13 47,15 Z"
        fill="#b91c1c"/>
      {/* Front window */}
      <path d="M49,14 Q55,7 68,5 Q78,3 84,5 Q75,9 59,13 Z" fill="rgba(252,165,165,0.58)"/>
      {/* Rear window */}
      <path d="M87,5 Q99,4 108,11 Q104,15 95,15 Q88,11 87,5 Z" fill="rgba(252,165,165,0.58)"/>
      {/* Long pointed nose */}
      <path d="M154,34 L164,37 L163,41 L154,41 Z" fill="#7f1d1d"/>
      {/* Headlight */}
      <ellipse cx="158" cy="33" rx="5" ry="3.5" fill="#fef9c3" opacity="0.95"/>
      {/* Taillights */}
      <ellipse cx="11" cy="33" rx="3" ry="7" fill="#fbbf24" opacity="0.9"/>
      {/* Ferrari logo */}
      <text x="138" y="32" fontSize="10" textAnchor="middle" fill="rgba(255,255,255,0.55)" style={{userSelect:"none"}}>🐎</text>
      {/* Side vent */}
      <rect x="132" y="35" width="14" height="2.5" rx="1" fill="#7f1d1d"/>
      {/* Diffuser */}
      <path d="M144,39 L158,38 L158,41 L144,42 Z" fill="#7f1d1d" opacity="0.8"/>
      {/* Left wheel */}
      <g transform={`translate(36,44)`} style={wheelStyle}>
        <circle r="10" fill="#111"/>
        <circle r="7.5" fill="#1f2937" stroke="#e5e7eb" strokeWidth="1.5"/>
        <line x1="0" y1="-6" x2="0" y2="6" stroke="#e5e7eb" strokeWidth="1"/>
        <line x1="-6" y1="0" x2="6" y2="0" stroke="#e5e7eb" strokeWidth="1"/>
        <circle r="2.5" fill="#374151"/>
      </g>
      {/* Right wheel */}
      <g transform={`translate(120,44)`} style={wheelStyle}>
        <circle r="10" fill="#111"/>
        <circle r="7.5" fill="#1f2937" stroke="#e5e7eb" strokeWidth="1.5"/>
        <line x1="0" y1="-6" x2="0" y2="6" stroke="#e5e7eb" strokeWidth="1"/>
        <line x1="-6" y1="0" x2="6" y2="0" stroke="#e5e7eb" strokeWidth="1"/>
        <circle r="2.5" fill="#374151"/>
      </g>
    </svg>
  );
}

function Lambo({ lit, spin }:{ lit?:boolean; spin?:boolean }) {
  const wheelStyle = spin ? { animation:"cr3-wspin 0.10s linear infinite" } as React.CSSProperties : {};
  return (
    <svg viewBox="0 0 165 52" style={{width:155,height:52,display:"block",overflow:"visible"}}>
      <defs>
        <radialGradient id="la-body" cx="45%" cy="20%" r="70%">
          <stop offset="0%" stopColor="#fbbf24"/><stop offset="100%" stopColor="#92400e"/>
        </radialGradient>
      </defs>
      {/* Underbody */}
      <rect x="12" y="40" width="150" height="5" rx="1" fill="#78350f"/>
      {/* Extreme wedge body */}
      <path d="M12,40 L12,35 L18,28 L25,23 Q40,18 58,16 Q78,14 98,14 Q118,15 134,19 Q148,24 158,33 Q163,37 163,40 Z"
        fill="url(#la-body)"/>
      {/* Very low angular roof */}
      <path d="M44,16 L54,8 Q65,4 80,4 Q94,4 104,8 L112,16 Q96,14 78,14 Q58,15 44,16 Z"
        fill="#b45309"/>
      {/* Windshield — super raked */}
      <path d="M46,16 L56,8 Q66,4 79,4 Q87,4 91,6 Q80,10 63,15 Z" fill="rgba(253,230,138,0.52)"/>
      {/* Rear window */}
      <path d="M94,6 Q104,5 110,13 Q106,16 98,16 Q93,11 94,6 Z" fill="rgba(253,230,138,0.52)"/>
      {/* Extreme nose */}
      <path d="M158,31 L168,35 L168,40 L158,40 Z" fill="#78350f"/>
      {/* Headlight — angular slash */}
      <path d="M160,30 L167,33 L167,37 L160,35 Z" fill="#fef3c7" opacity="0.95"/>
      {/* Taillights */}
      <path d="M12,30 L12,39 L15,39 L18,30 Z" fill="#f97316" opacity="0.9"/>
      {/* Lambo logo */}
      <text x="140" y="30" fontSize="10" textAnchor="middle" fill="rgba(255,255,255,0.5)" style={{userSelect:"none"}}>🐂</text>
      {/* Side exhaust */}
      <rect x="128" y="36" width="18" height="3" rx="1" fill="#78350f"/>
      {/* Rear diffuser */}
      <path d="M150,38 L164,38 L166,41 L150,42 Z" fill="#78350f"/>
      {/* Gold wheel spokes */}
      {/* Left wheel */}
      <g transform={`translate(38,43)`} style={wheelStyle}>
        <circle r="11" fill="#111"/>
        <circle r="8" fill="#1f2937" stroke="#f59e0b" strokeWidth="2"/>
        <line x1="0" y1="-7" x2="0" y2="7" stroke="#f59e0b" strokeWidth="1.2"/>
        <line x1="-7" y1="0" x2="7" y2="0" stroke="#f59e0b" strokeWidth="1.2"/>
        <line x1="-5" y1="-5" x2="5" y2="5" stroke="#f59e0b" strokeWidth="1"/>
        <line x1="5" y1="-5" x2="-5" y2="5" stroke="#f59e0b" strokeWidth="1"/>
        <circle r="2.5" fill="#78350f"/>
      </g>
      {/* Right wheel */}
      <g transform={`translate(122,43)`} style={wheelStyle}>
        <circle r="11" fill="#111"/>
        <circle r="8" fill="#1f2937" stroke="#f59e0b" strokeWidth="2"/>
        <line x1="0" y1="-7" x2="0" y2="7" stroke="#f59e0b" strokeWidth="1.2"/>
        <line x1="-7" y1="0" x2="7" y2="0" stroke="#f59e0b" strokeWidth="1.2"/>
        <line x1="-5" y1="-5" x2="5" y2="5" stroke="#f59e0b" strokeWidth="1"/>
        <line x1="5" y1="-5" x2="-5" y2="5" stroke="#f59e0b" strokeWidth="1"/>
        <circle r="2.5" fill="#78350f"/>
      </g>
    </svg>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const STYLES = `
  .cr3-root {
    background: radial-gradient(ellipse at 50% 0%,#0c0c1e 0%,#06060f 55%,#030308 100%);
    min-height:100dvh;
    font-family:'Segoe UI',system-ui,sans-serif;
    color:#fff;
  }
  @keyframes cr3-ticker    { from{transform:translateX(0)} to{transform:translateX(-50%)} }
  @keyframes cr3-shimmer   { 0%{background-position:-300% 0} 100%{background-position:300% 0} }
  @keyframes cr3-confetti  { 0%{transform:translateY(-10px) rotate(0);opacity:1} 100%{transform:translateY(340px) rotate(720deg);opacity:0} }
  @keyframes cr3-burst     { 0%{transform:scale(0.05);opacity:0} 60%{transform:scale(1.06)} 100%{transform:scale(1);opacity:1} }
  @keyframes cr3-road      { from{transform:translateX(0)} to{transform:translateX(-80px)} }
  @keyframes cr3-wspin     { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  @keyframes cr3-throb     { 0%,100%{opacity:0.4} 50%{opacity:1} }
  @keyframes cr3-lightpop  { 0%{transform:scale(0.6);opacity:0} 100%{transform:scale(1);opacity:1} }
  @keyframes cr3-winpulse  { 0%,100%{filter:drop-shadow(0 0 4px rgba(245,197,66,0.4))} 50%{filter:drop-shadow(0 0 14px rgba(245,197,66,0.9))} }
  @keyframes cr3-flame     { 0%,100%{transform:scaleY(0.8) scaleX(0.9);opacity:0.7} 50%{transform:scaleY(1.1) scaleX(0.8);opacity:1} }
  @keyframes cr3-vib       { 0%,100%{transform:translateY(0)} 25%{transform:translateY(-1px)} 75%{transform:translateY(1px)} }
`;

// ─── Flame exhaust trail ──────────────────────────────────────────────────────
function SpeedFlame({ color }:{color:string}) {
  return (
    <div style={{position:"absolute",right:"100%",top:"30%",display:"flex",gap:2}}>
      {[1,0.7,0.4].map((o,i)=>(
        <div key={i} style={{
          width:8+i*6,height:6+i*2,
          background:`radial-gradient(ellipse,${color},transparent)`,
          borderRadius:40,
          opacity:o,
          animation:`cr3-flame ${0.15+i*0.1}s ease-in-out infinite alternate`,
          transform:`translateY(${i*1}px)`,
        }}/>
      ))}
    </div>
  );
}

// ─── Single Race Lane ─────────────────────────────────────────────────────────
function RaceLane({
  carId, pos, isRacing, isWinner, isFinished, phase, selected
}:{
  carId: Selection; pos:number; isRacing:boolean; isWinner:boolean; isFinished:boolean; phase:Phase; selected:boolean;
}) {
  const cfg = CAR_CFG[carId];
  const spin = isRacing && !isFinished;
  const won  = isWinner && phase === "result";

  return (
    <div style={{
      position:"relative",
      height:72,
      background:`linear-gradient(90deg,
        rgba(0,0,0,0.6) 0%,
        rgba(10,10,22,0.8) 100%)`,
      border:`1.5px solid ${selected?"rgba(245,197,66,0.35)":"rgba(255,255,255,0.05)"}`,
      borderRadius:10,
      overflow:"hidden",
      marginBottom:4,
      boxShadow:won?`inset 0 0 40px ${cfg.glow}`:undefined,
    }}>
      {/* Road texture - scrolling dashes */}
      {isRacing&&!isFinished&&(
        <div style={{
          position:"absolute",inset:0,
          backgroundImage:`repeating-linear-gradient(90deg,
            transparent 0,transparent 20px,
            rgba(255,255,255,0.06) 20px,rgba(255,255,255,0.06) 36px)`,
          backgroundSize:"80px 100%",
          animation:"cr3-road 0.4s linear infinite",
        }}/>
      )}

      {/* Lane label */}
      <div style={{
        position:"absolute",left:6,top:"50%",transform:"translateY(-50%)",
        display:"flex",flexDirection:"column",alignItems:"center",gap:1,
        zIndex:3,
      }}>
        <div style={{fontSize:8,fontWeight:900,letterSpacing:1,
          color:selected?cfg.track:"rgba(255,255,255,0.3)"}}>
          {cfg.brand}
        </div>
        <div style={{fontSize:8,color:"rgba(255,255,255,0.2)"}}>{cfg.mult}×</div>
      </div>

      {/* Car */}
      <div style={{
        position:"absolute",
        left: 40 + (TRACK_TRAVEL * pos / 100),
        top:"50%",
        transform:"translateY(-50%)",
        transition:isFinished?"none":undefined,
        zIndex:2,
        animation:won?"cr3-winpulse 0.8s ease-in-out infinite":
                  isRacing&&!isFinished?"cr3-vib 0.12s linear infinite":undefined,
      }}>
        {/* Flame/exhaust trail */}
        {isRacing && !isFinished && (
          <SpeedFlame color={cfg.track}/>
        )}
        {carId==="car1" && <BMW lit={won} spin={spin}/>}
        {carId==="car2" && <Ferrari lit={won} spin={spin}/>}
        {carId==="car3" && <Lambo lit={won} spin={spin}/>}
      </div>

      {/* Winner flag */}
      {won && (
        <div style={{
          position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",
          fontSize:24,animation:"cr3-lightpop 0.4s ease both",
          zIndex:5,
        }}>🏆</div>
      )}

      {/* Speed boost flame on winner approaching finish */}
      {isWinner && isRacing && pos > 70 && (
        <div style={{
          position:"absolute",right:0,top:0,bottom:0,width:80,
          background:"linear-gradient(90deg,transparent,rgba(245,197,66,0.12))",
          pointerEvents:"none",
        }}/>
      )}
    </div>
  );
}

// ─── Start lights ─────────────────────────────────────────────────────────────
function StartLights({ count }:{count:number}) {
  return (
    <div style={{display:"flex",gap:8,justifyContent:"center",padding:"8px 0"}}>
      {[0,1,2,3,4].map(i=>(
        <div key={i} style={{
          width:20,height:20,borderRadius:"50%",
          border:"2px solid rgba(255,255,255,0.2)",
          background: i < count ? "#ef4444" : "rgba(30,0,0,0.8)",
          boxShadow: i < count ? "0 0 14px #ef4444" : undefined,
          animation: i < count ? "cr3-lightpop 0.2s ease both" : undefined,
          transition:"all 0.15s",
        }}/>
      ))}
    </div>
  );
}

// ─── Main Game ────────────────────────────────────────────────────────────────
export default function CarRouletteGame() {
  const [,nav]       = useLocation();
  const {user}       = useAuth();
  const qc           = useQueryClient();
  const {toast}      = useToast();

  const [phase,setPhase]       = useState<Phase>("betting");
  const [selection,setSel]     = useState<Selection|null>(null);
  const [bet,setBet]           = useState(0);
  const [win,setWin]           = useState(0);
  const [resultKey,setRes]     = useState<Selection|null>(null);
  const [lights,setLights]     = useState(0);
  const [confetti,setConf]     = useState<{x:number;id:number;icon:string}[]>([]);

  // Car positions 0-100 (%)
  const [carPos,setCarPos] = useState<Record<Selection,number>>({car1:0,car2:0,car3:0});
  const posRef    = useRef<Record<Selection,number>>({car1:0,car2:0,car3:0});
  const velRef    = useRef<Record<Selection,number>>({car1:0,car2:0,car3:0});
  const resultRef = useRef<Selection|null>(null);
  const rafRef    = useRef<number|null>(null);
  const racingRef = useRef(false);
  const finishedRef = useRef(false);
  const pollRef   = useRef<any>(null);
  const lockedSelRef = useRef<Selection|null>(null);

  const balance = (user as any)?.balance ?? 0;

  useEffect(()=>{
    const s=document.createElement("style");s.textContent=STYLES;document.head.appendChild(s);
    return()=>{try{document.head.removeChild(s)}catch{}};
  },[]);
  useEffect(()=>()=>{
    if(pollRef.current)clearInterval(pollRef.current);
    if(rafRef.current)cancelAnimationFrame(rafRef.current);
  },[]);

  function fireConfetti(){
    const icons=["🏎","🏆","💰","⭐","🎉","🏁","💎","🔥"];
    setConf(Array.from({length:18},(_,i)=>({x:Math.random()*90,id:i,icon:icons[i%8]})));
    setTimeout(()=>setConf([]),3000);
  }

  // RAF animation tick
  function tick(){
    if(!racingRef.current) return;
    const pos = posRef.current;
    const vel = velRef.current;
    const result = resultRef.current;

    (["car1","car2","car3"] as Selection[]).forEach(car=>{
      const v = vel[car];
      if(result){
        if(car===result){
          // Winner rushes to finish
          vel[car] = Math.min(v+0.25, 14);
        } else {
          // Losers slow to stop
          vel[car] = Math.max(v-0.08, 0);
        }
      } else {
        // Free racing with jitter
        const jitter = Math.sin(Date.now()*0.003+car.charCodeAt(3)*0.7)*0.8;
        vel[car] = BASE_SPD + jitter;
      }
      pos[car] = Math.min(pos[car] + Math.max(0,vel[car]), 100);
    });

    posRef.current={...pos};
    setCarPos({...pos});

    if(result && pos[result]>=100 && !finishedRef.current){
      finishedRef.current=true;
      racingRef.current=false;
      const won=result===lockedSelRef.current;
      setRes(result);
      setTimeout(()=>{setPhase("result");if(won){fireConfetti();}},350);
      return;
    }
    rafRef.current=requestAnimationFrame(tick);
  }

  function startRace(){
    racingRef.current=true;
    finishedRef.current=false;
    resultRef.current=null;
    posRef.current={car1:0,car2:0,car3:0};
    velRef.current={car1:BASE_SPD,car2:BASE_SPD,car3:BASE_SPD};
    setCarPos({car1:0,car2:0,car3:0});
    if(rafRef.current)cancelAnimationFrame(rafRef.current);
    rafRef.current=requestAnimationFrame(tick);
  }

  function runCountdown(then:()=>void){
    setLights(0);
    setPhase("countdown");
    let n=0;
    const iv=setInterval(()=>{
      n++;setLights(n);
      if(n>=5){clearInterval(iv);then();}
    },400);
  }

  const placeBet=useCallback(async()=>{
    if(!selection||bet<=0||phase!=="betting")return;
    const lSel=selection,lBet=bet;
    lockedSelRef.current=lSel;

    try{
      const r=await fetch(`${API}/api/games/car-roulette`,{
        method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",
        body:JSON.stringify({selection:lSel,stake:lBet}),
      });
      if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.error||"Bet failed");}
      const {roundId}=await r.json();
      qc.invalidateQueries({queryKey:getGetBalanceQueryKey()});
      qc.invalidateQueries({queryKey:getGetMeQueryKey()});

      runCountdown(()=>{
        setPhase("racing");
        startRace();
      });

      if(pollRef.current)clearInterval(pollRef.current);
      pollRef.current=setInterval(async()=>{
        try{
          const pr=await fetch(`${API}/api/games/casino-round/car-roulette/${roundId}`,{credentials:"include"});
          if(!pr.ok)return;
          const d=await pr.json();
          if(d.status==="settled"){
            clearInterval(pollRef.current);
            const srv=(d.result??"").trim().toLowerCase() as Selection;
            const won=srv===lSel;
            setWin(won?lBet*CAR_CFG[srv].mult:0);
            if(won){qc.invalidateQueries({queryKey:getGetBalanceQueryKey()});qc.invalidateQueries({queryKey:getGetMeQueryKey()});}
            resultRef.current=srv;
          }
        }catch{}
      },600);
      setTimeout(()=>{
        if(pollRef.current)clearInterval(pollRef.current);
        // force result if polling timed out
        if(!resultRef.current&&racingRef.current){
          resultRef.current=lSel as Selection;
        }
      },30000);
    }catch(e:any){
      setPhase("betting");
      toast({title:"Error",description:(e as any).message,variant:"destructive"});
    }
  },[selection,bet,phase,qc,toast]);

  function collect(){
    setPhase("betting");setWin(0);setRes(null);setSel(null);setBet(0);
    setCarPos({car1:0,car2:0,car3:0});
    posRef.current={car1:0,car2:0,car3:0};
    resultRef.current=null;lockedSelRef.current=null;
    racingRef.current=false;finishedRef.current=false;setLights(0);
  }
  function chip(v:number){if(phase!=="betting")return;setBet(b=>Math.min(b+v,balance));}

  const busy=phase==="countdown"||phase==="racing";
  const selCfg=selection?CAR_CFG[selection]:null;
  const resCfg=resultKey?CAR_CFG[resultKey]:null;
  const won=win>0;

  return (
    <div className="cr3-root">
      {/* Confetti */}
      <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:60,overflow:"hidden"}}>
        {confetti.map(c=>(
          <div key={c.id} style={{position:"absolute",top:-20,left:`${c.x}%`,fontSize:18,
            animation:`cr3-confetti ${1.4+Math.random()*0.8}s ease-in forwards`}}>{c.icon}</div>
        ))}
      </div>

      <div style={{position:"relative",zIndex:10,maxWidth:480,margin:"0 auto",paddingBottom:32}}>
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
          padding:"13px 16px",
          background:"rgba(3,3,8,0.96)",
          borderBottom:"1px solid rgba(255,255,255,0.06)",
          backdropFilter:"blur(14px)",position:"sticky",top:0,zIndex:30}}>
          <button onClick={()=>nav("/")} style={{
            display:"flex",alignItems:"center",gap:6,padding:"7px 13px",
            background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",
            borderRadius:10,color:"rgba(255,255,255,0.55)",cursor:"pointer",fontSize:14,
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
              <div style={{fontSize:9,color:"rgba(255,255,255,0.25)",letterSpacing:2}}>SUPERCAR RACE</div>
            </div>
          </div>
          <div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",
            borderRadius:10,padding:"6px 12px",textAlign:"right"}}>
            <div style={{fontSize:8,color:"rgba(255,255,255,0.25)",letterSpacing:1}}>BALANCE</div>
            <div style={{fontSize:12,fontWeight:800,color:"#f5c542"}}>{formatCurrency(balance)}</div>
          </div>
        </div>

        {/* Ticker */}
        <div style={{height:26,overflow:"hidden",display:"flex",alignItems:"center",
          background:"rgba(3,3,8,0.9)",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
          <div style={{whiteSpace:"nowrap",fontSize:11,color:"rgba(255,255,255,0.28)",letterSpacing:0.5,
            animation:"cr3-ticker 22s linear infinite"}}>{TICKER}{TICKER}</div>
        </div>

        <div style={{padding:"12px 12px 8px"}}>
          {/* Section label */}
          <div style={{textAlign:"center",marginBottom:10,fontSize:10,letterSpacing:3,
            color:"rgba(255,255,255,0.2)",fontWeight:700}}>🏎 SELECT YOUR SUPERCAR AND RACE 🏎</div>

          {/* ═══ RACETRACK ═══ */}
          <div style={{
            background:"linear-gradient(180deg,#0a0a1a 0%,#060610 100%)",
            border:"2px solid rgba(255,255,255,0.07)",
            borderRadius:18,padding:"14px 10px 10px",
            position:"relative",overflow:"hidden",
          }}>
            {/* Night sky gradient */}
            <div style={{position:"absolute",inset:0,
              background:"radial-gradient(ellipse 120% 60% at 50% -20%,rgba(30,20,80,0.4) 0%,transparent 60%)",
              pointerEvents:"none"}}/>

            {/* Start lights */}
            {phase==="countdown"&&<StartLights count={lights}/>}

            {/* START / FINISH line labels */}
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,padding:"0 4px"}}>
              <div style={{fontSize:9,color:"rgba(255,255,255,0.25)",letterSpacing:2}}>START</div>
              <div style={{fontSize:9,color:"rgba(255,255,255,0.25)",letterSpacing:2}}>FINISH 🏁</div>
            </div>

            {/* Finish line */}
            <div style={{
              position:"absolute",right:10,top:0,bottom:0,width:12,
              backgroundImage:"repeating-linear-gradient(180deg,#fff 0,#fff 6px,#000 6px,#000 12px)",
              backgroundSize:"12px 12px",opacity:0.25,borderRadius:"0 4px 4px 0",
              pointerEvents:"none",zIndex:5,
            }}/>

            {/* Track lanes */}
            {(["car1","car2","car3"] as Selection[]).map(id=>(
              <RaceLane key={id} carId={id}
                pos={carPos[id]}
                isRacing={phase==="racing"}
                isWinner={resultKey===id}
                isFinished={resultKey===id&&phase==="result"}
                phase={phase}
                selected={selection===id}
              />
            ))}

            {/* Result panel */}
            {phase==="result"&&resCfg&&(
              <div style={{
                marginTop:10,
                background:won
                  ?"linear-gradient(135deg,rgba(5,25,5,0.97),rgba(10,50,15,0.97))"
                  :"linear-gradient(135deg,rgba(20,5,5,0.97),rgba(60,10,10,0.97))",
                border:`2px solid ${won?"rgba(245,197,66,0.55)":"rgba(239,68,68,0.35)"}`,
                borderRadius:16,padding:"18px 14px",textAlign:"center",
                animation:"cr3-burst 0.5s cubic-bezier(.34,1.56,.64,1) both",
              }}>
                <div style={{fontSize:38,marginBottom:4}}>{won?"🏆":"💨"}</div>
                <div style={{fontSize:16,fontWeight:900,letterSpacing:2,marginBottom:2,
                  color:won?"#f5c542":"#fca5a5"}}>
                  {won?"RACE WINNER!":"YOU LOST"}
                </div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginBottom:won?10:14}}>
                  <span style={{color:resCfg.track,fontWeight:700}}>{resCfg.name}</span> crossed the finish line · {resCfg.mult}×
                </div>
                {won&&(
                  <div style={{fontSize:28,fontWeight:900,color:"#f5c542",
                    textShadow:"0 0 24px rgba(245,197,66,0.6)",marginBottom:14}}>
                    +{formatCurrency(win)}
                  </div>
                )}
                <button onClick={collect} style={{
                  padding:"12px 32px",borderRadius:14,border:"none",cursor:"pointer",
                  fontWeight:900,fontSize:14,letterSpacing:1,
                  background:won?"linear-gradient(90deg,#d97706,#f5c542)":"linear-gradient(90deg,#7f1d1d,#dc2626)",
                  color:won?"#020c05":"#fff",
                  boxShadow:won?"0 0 20px rgba(245,197,66,0.4)":undefined,
                }}>
                  {won?"💰 COLLECT":"🏁 RACE AGAIN"}
                </button>
              </div>
            )}

            {/* Racing status */}
            {phase==="racing"&&(
              <div style={{marginTop:8,textAlign:"center",fontSize:10,letterSpacing:2,
                color:"rgba(255,255,255,0.3)",animation:"cr3-throb 0.8s ease-in-out infinite"}}>
                🏁 RACE IN PROGRESS...
              </div>
            )}
          </div>

          {/* Bet cards */}
          <div style={{marginTop:12,display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
            {(Object.entries(CAR_CFG) as [Selection,typeof CAR_CFG[Selection]][]).map(([key,cfg])=>{
              const sel=selection===key;
              const isJack=key==="car3";
              return (
                <div key={key} onClick={()=>{if(busy||phase==="result")return;setSel(key);}}
                  style={{
                    background:sel?`linear-gradient(145deg,rgba(0,0,0,0.9),rgba(0,0,0,0.7))`:"rgba(0,0,0,0.4)",
                    border:`2px solid ${sel?cfg.track:"rgba(255,255,255,0.07)"}`,
                    borderRadius:16,padding:"12px 6px",textAlign:"center",cursor:"pointer",
                    transition:"all 0.2s",position:"relative",overflow:"hidden",
                    boxShadow:sel?`0 0 24px ${cfg.glow}`:undefined,
                  }}>
                  {isJack&&(
                    <div style={{
                      position:"absolute",top:4,left:"50%",transform:"translateX(-50%)",
                      background:"linear-gradient(90deg,#d97706,#f5c542)",
                      borderRadius:6,padding:"1px 7px",fontSize:7,fontWeight:900,
                      color:"#020c05",letterSpacing:1,whiteSpace:"nowrap",
                    }}>JACKPOT 5×</div>
                  )}
                  <div style={{
                    fontSize:8,fontWeight:900,letterSpacing:1,marginTop:isJack?16:2,
                    color:sel?cfg.track:"rgba(255,255,255,0.4)"}}>
                    {cfg.brand}
                  </div>
                  <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginBottom:4}}>{cfg.name}</div>
                  {/* Mini car */}
                  <div style={{display:"flex",justifyContent:"center",marginBottom:4,
                    filter:sel?`drop-shadow(0 0 6px ${cfg.glow})`:"grayscale(0.7) brightness(0.6)"}}>
                    {key==="car1"&&<BMW/>}
                    {key==="car2"&&<Ferrari/>}
                    {key==="car3"&&<Lambo/>}
                  </div>
                  <div style={{fontSize:16,fontWeight:900,
                    color:sel?cfg.track:"rgba(255,255,255,0.2)",
                    textShadow:sel?`0 0 10px ${cfg.glow}`:undefined}}>{cfg.mult}×</div>
                </div>
              );
            })}
          </div>

          {/* Chip tray */}
          <div style={{marginTop:12}}>
            <div style={{fontSize:9,letterSpacing:3,color:"rgba(255,255,255,0.18)",marginBottom:8,textAlign:"center"}}>
              PLACE CHIPS
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap"}}>
              {CHIPS.map(({v,c})=>(
                <button key={v} onClick={()=>chip(v)} disabled={busy||phase==="result"} style={{
                  width:52,height:52,borderRadius:"50%",border:`3px solid ${c}`,cursor:"pointer",
                  background:`radial-gradient(circle at 35% 30%,${c}cc,${c}55)`,
                  color:"#fff",fontSize:10,fontWeight:900,
                  boxShadow:`0 4px 14px ${c}44,inset 0 1px 0 rgba(255,255,255,0.3)`,
                  opacity:busy||phase==="result"?0.35:1,
                }}>
                  {v>=1000?`${v/1000}K`:v}
                </button>
              ))}
            </div>
          </div>

          {/* Info bar */}
          <div style={{marginTop:12,display:"grid",gridTemplateColumns:"repeat(3,1fr)",
            background:"rgba(0,0,0,0.5)",border:"1px solid rgba(255,255,255,0.05)",
            borderRadius:14,overflow:"hidden"}}>
            {[
              {l:"WIN",    v:formatCurrency(win),    c:win>0?"#f5c542":"rgba(255,255,255,0.18)"},
              {l:"BET",    v:formatCurrency(bet),    c:bet>0?"#22c55e":"rgba(255,255,255,0.18)"},
              {l:"BALANCE",v:formatCurrency(balance),c:"rgba(255,255,255,0.3)"},
            ].map((item,i)=>(
              <div key={i} style={{padding:"10px 0",textAlign:"center",
                borderRight:i<2?"1px solid rgba(255,255,255,0.04)":undefined}}>
                <div style={{fontSize:8,letterSpacing:2,color:"rgba(255,255,255,0.18)",marginBottom:2}}>{item.l}</div>
                <div style={{fontSize:12,fontWeight:700,color:item.c}}>{item.v}</div>
              </div>
            ))}
          </div>

          {/* Race button */}
          {phase!=="result"&&(
            <button onClick={placeBet} disabled={busy||!selection||bet<=0}
              style={{
                marginTop:12,width:"100%",padding:"17px 0",borderRadius:18,border:"none",cursor:"pointer",
                fontSize:16,fontWeight:900,letterSpacing:2,
                background:busy
                  ?"linear-gradient(90deg,#111,#1a1a2e)"
                  :(!selection||bet<=0)
                  ?"rgba(255,255,255,0.04)"
                  :"linear-gradient(90deg,#1d4ed8,#7c3aed,#b91c1c)",
                backgroundSize:"200% 100%",
                color:(!selection||bet<=0)&&!busy?"rgba(255,255,255,0.15)":"#fff",
                boxShadow:(!busy&&selection&&bet>0)?"0 0 28px rgba(124,58,237,0.45),0 4px 20px rgba(0,0,0,0.5)":undefined,
                animation:(!busy&&selection&&bet>0)?"cr3-shimmer 2.5s linear infinite":undefined,
                opacity:(!selection||bet<=0)&&!busy?0.35:1,
              }}>
              {phase==="countdown"?"🚦 RACE STARTING...":busy?"🏁 RACE IN PROGRESS...":"🏎 START THE RACE 🏎"}
            </button>
          )}

          <div style={{marginTop:8,textAlign:"center",fontSize:10,color:"rgba(255,255,255,0.14)",letterSpacing:1}}>
            {!selection&&phase==="betting"&&"Pick BMW • Ferrari • or Lambo Jackpot"}
            {selection&&bet<=0&&phase==="betting"&&`${selCfg?.name} selected — add chips to bet`}
            {selection&&bet>0&&phase==="betting"&&`${selCfg?.mult}× payout if ${selCfg?.name} wins`}
          </div>
        </div>
      </div>
    </div>
  );
}
