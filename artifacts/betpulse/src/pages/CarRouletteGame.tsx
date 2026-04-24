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

const TRACK_TRAVEL = 220;
const BASE_SPD = 1.4;
const CHIPS = [{v:100,c:"#22c55e"},{v:500,c:"#3b82f6"},{v:1000,c:"#a855f7"},{v:5000,c:"#f97316"},{v:10000,c:"#f5c542"}];

const CAR_CFG = {
  car1: { name:"BMW M8",      brand:"BMW",         mult:1.95, track:"#60a5fa", glow:"rgba(59,130,246,0.55)",  img:"car1-bmw.png"     },
  car2: { name:"Ferrari F8",  brand:"FERRARI",     mult:1.95, track:"#f87171", glow:"rgba(239,68,68,0.55)",   img:"car2-ferrari.png" },
  car3: { name:"Lambo Urus",  brand:"LAMBORGHINI", mult:5,    track:"#fbbf24", glow:"rgba(245,197,66,0.65)",  img:"car3-lambo.png"   },
} as const;

const TICKER = "🏁 CAR ROULETTE  •  🔵 BMW M8: 1.95×  •  🔴 FERRARI F8: 1.95×  •  🏆 LAMBO URUS JACKPOT: 5×  •  🏎 RACE TO WIN  •  ";

// ─── Styles ───────────────────────────────────────────────────────────────────
const STYLES = `
  .cr3-root {
    background: radial-gradient(ellipse at 50% 0%,#10101e 0%,#06060f 55%,#030308 100%);
    min-height:100dvh;
    font-family:'Segoe UI',system-ui,sans-serif;
    color:#fff;
  }
  @keyframes cr3-ticker   { from{transform:translateX(0)} to{transform:translateX(-50%)} }
  @keyframes cr3-shimmer  { 0%{background-position:-300% 0} 100%{background-position:300% 0} }
  @keyframes cr3-confetti { 0%{transform:translateY(-10px) rotate(0);opacity:1} 100%{transform:translateY(340px) rotate(720deg);opacity:0} }
  @keyframes cr3-burst    { 0%{transform:scale(0.05);opacity:0} 60%{transform:scale(1.07)} 100%{transform:scale(1);opacity:1} }
  @keyframes cr3-road     { from{background-position:0 0} to{background-position:-80px 0} }
  @keyframes cr3-vib      { 0%,100%{transform:translateY(-50%)} 33%{transform:translateY(calc(-50% - 1.5px))} 66%{transform:translateY(calc(-50% + 1.5px))} }
  @keyframes cr3-throb    { 0%,100%{opacity:0.35} 50%{opacity:0.9} }
  @keyframes cr3-lightpop { 0%{transform:scale(0.5);opacity:0} 100%{transform:scale(1);opacity:1} }
  @keyframes cr3-winpulse { 0%,100%{filter:drop-shadow(0 0 6px rgba(245,197,66,0.3))} 50%{filter:drop-shadow(0 0 20px rgba(245,197,66,1))} }
  @keyframes cr3-speedblur{ 0%,100%{opacity:0.6} 50%{opacity:1} }
`;

// ─── Exhaust Trail ─────────────────────────────────────────────────────────────
function ExhaustTrail({ color }:{color:string}) {
  return (
    <div style={{
      position:"absolute",right:"95%",top:"50%",transform:"translateY(-50%)",
      display:"flex",alignItems:"center",gap:3,pointerEvents:"none",
    }}>
      {[0.8,0.5,0.25].map((o,i)=>(
        <div key={i} style={{
          width:14+i*8,height:6+i*2,
          background:`radial-gradient(ellipse,${color},transparent 80%)`,
          borderRadius:40,opacity:o,
          filter:`blur(${i*1.5}px)`,
        }}/>
      ))}
    </div>
  );
}

// ─── Race Lane ─────────────────────────────────────────────────────────────────
function RaceLane({
  carId, pos, isRacing, isWinner, phase, selected
}:{
  carId:Selection; pos:number; isRacing:boolean; isWinner:boolean; phase:Phase; selected:boolean;
}) {
  const cfg = CAR_CFG[carId];
  const won = isWinner && phase === "result";
  const moving = isRacing && !won;

  return (
    <div style={{
      position:"relative",
      height:88,
      background:"linear-gradient(90deg,rgba(5,5,18,0.95),rgba(8,8,22,0.9))",
      border:`1.5px solid ${selected?"rgba(245,197,66,0.3)":"rgba(255,255,255,0.05)"}`,
      borderRadius:10,
      overflow:"hidden",
      marginBottom:5,
      boxShadow:won?`inset 0 0 50px ${cfg.glow}`:undefined,
      transition:"box-shadow 0.4s",
    }}>
      {/* Moving road lines */}
      {moving&&(
        <div style={{
          position:"absolute",inset:0,
          backgroundImage:`repeating-linear-gradient(90deg,
            transparent 0,transparent 22px,
            rgba(255,255,255,0.04) 22px,rgba(255,255,255,0.04) 38px)`,
          backgroundSize:"80px 100%",
          animation:"cr3-road 0.35s linear infinite",
        }}/>
      )}

      {/* Asphalt texture */}
      <div style={{
        position:"absolute",inset:0,
        backgroundImage:"radial-gradient(rgba(255,255,255,0.015) 1px,transparent 1px)",
        backgroundSize:"12px 12px",
        pointerEvents:"none",
      }}/>

      {/* Brand tag */}
      <div style={{
        position:"absolute",left:7,top:"50%",transform:"translateY(-50%)",
        zIndex:3,display:"flex",flexDirection:"column",alignItems:"flex-start",gap:1,
      }}>
        <div style={{fontSize:8,fontWeight:900,letterSpacing:1,
          color:selected?cfg.track:"rgba(255,255,255,0.25)"}}>
          {cfg.brand}
        </div>
        <div style={{fontSize:8,color:"rgba(255,255,255,0.18)"}}>{cfg.mult}×</div>
      </div>

      {/* Car image */}
      <div style={{
        position:"absolute",
        left: 44 + (TRACK_TRAVEL * pos / 100),
        top:"50%",
        transform:"translateY(-50%)",
        zIndex:4,
        animation:won?"cr3-winpulse 0.7s ease-in-out infinite":
                  moving?"cr3-vib 0.1s linear infinite":undefined,
      }}>
        {/* Exhaust / speed trail */}
        {moving&&<ExhaustTrail color={cfg.track}/>}

        {/* Actual car photo */}
        <img
          src={`${BASE}${cfg.img}`}
          alt={cfg.name}
          style={{
            width:145,
            height:70,
            objectFit:"contain",
            objectPosition:"center",
            display:"block",
            filter:won
              ?`drop-shadow(0 0 12px ${cfg.glow}) brightness(1.1)`
              :moving
              ?`drop-shadow(0 0 6px ${cfg.glow})`
              :`drop-shadow(0 0 2px rgba(0,0,0,0.8)) brightness(${selected?1:0.7})`,
            transition:"filter 0.3s",
          }}
        />

        {/* Speed lines behind car when racing fast */}
        {moving && pos > 30 && (
          <div style={{
            position:"absolute",right:"95%",top:"25%",bottom:"25%",
            width:30,
            background:`linear-gradient(90deg,transparent,${cfg.track}22,${cfg.track}11,transparent)`,
            pointerEvents:"none",
          }}/>
        )}
      </div>

      {/* Winner trophy */}
      {won&&(
        <div style={{
          position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",
          fontSize:28,animation:"cr3-lightpop 0.4s ease both",zIndex:5,
        }}>🏆</div>
      )}
    </div>
  );
}

// ─── Start Lights ─────────────────────────────────────────────────────────────
function StartLights({ count }:{count:number}) {
  return (
    <div style={{display:"flex",gap:8,justifyContent:"center",padding:"6px 0 10px"}}>
      {[0,1,2,3,4].map(i=>(
        <div key={i} style={{
          width:22,height:22,borderRadius:"50%",
          border:"2px solid rgba(255,255,255,0.15)",
          background:i<count?"#ef4444":"rgba(25,0,0,0.8)",
          boxShadow:i<count?"0 0 16px #ef4444,0 0 30px rgba(239,68,68,0.4)":undefined,
          animation:i<count?"cr3-lightpop 0.2s ease both":undefined,
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

  const [phase,setPhase]     = useState<Phase>("betting");
  const [selection,setSel]   = useState<Selection|null>(null);
  const [bet,setBet]         = useState(0);
  const [win,setWin]         = useState(0);
  const [resultKey,setRes]   = useState<Selection|null>(null);
  const [lights,setLights]   = useState(0);
  const [confetti,setConf]   = useState<{x:number;id:number;icon:string}[]>([]);
  const [carPos,setCarPos]   = useState<Record<Selection,number>>({car1:0,car2:0,car3:0});

  const posRef     = useRef<Record<Selection,number>>({car1:0,car2:0,car3:0});
  const velRef     = useRef<Record<Selection,number>>({car1:0,car2:0,car3:0});
  const resultRef  = useRef<Selection|null>(null);
  const rafRef     = useRef<number|null>(null);
  const racingRef  = useRef(false);
  const doneRef    = useRef(false);
  const pollRef    = useRef<any>(null);
  const lockedRef  = useRef<Selection|null>(null);

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

  function tick(){
    if(!racingRef.current) return;
    const pos=posRef.current, vel=velRef.current, result=resultRef.current;

    (["car1","car2","car3"] as Selection[]).forEach(car=>{
      const v=vel[car];
      if(result){
        vel[car]=car===result?Math.min(v+0.3,16):Math.max(v-0.06,0);
      } else {
        vel[car]=BASE_SPD+Math.sin(Date.now()*0.003+car.charCodeAt(3)*0.7)*0.7;
      }
      pos[car]=Math.min(pos[car]+Math.max(0,vel[car]),100);
    });

    posRef.current={...pos};
    setCarPos({...pos});

    if(result&&pos[result]>=100&&!doneRef.current){
      doneRef.current=true; racingRef.current=false;
      const won=result===lockedRef.current;
      setRes(result);
      setTimeout(()=>{setPhase("result");if(won)fireConfetti();},300);
      return;
    }
    rafRef.current=requestAnimationFrame(tick);
  }

  function startRace(){
    racingRef.current=true;doneRef.current=false;resultRef.current=null;
    posRef.current={car1:0,car2:0,car3:0};
    velRef.current={car1:BASE_SPD,car2:BASE_SPD,car3:BASE_SPD};
    setCarPos({car1:0,car2:0,car3:0});
    if(rafRef.current)cancelAnimationFrame(rafRef.current);
    rafRef.current=requestAnimationFrame(tick);
  }

  function runCountdown(cb:()=>void){
    setLights(0);setPhase("countdown");
    let n=0;
    const iv=setInterval(()=>{n++;setLights(n);if(n>=5){clearInterval(iv);cb();}},400);
  }

  const placeBet=useCallback(async()=>{
    if(!selection||bet<=0||phase!=="betting")return;
    const lSel=selection,lBet=bet;
    lockedRef.current=lSel;

    try{
      const r=await fetch(`${API}/api/games/car-roulette`,{
        method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",
        body:JSON.stringify({selection:lSel,stake:lBet}),
      });
      if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.error||"Bet failed");}
      const {roundId}=await r.json();
      qc.invalidateQueries({queryKey:getGetBalanceQueryKey()});
      qc.invalidateQueries({queryKey:getGetMeQueryKey()});

      runCountdown(()=>{setPhase("racing");startRace();});

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
      setTimeout(()=>{if(pollRef.current)clearInterval(pollRef.current);},35000);
    }catch(e:any){
      setPhase("betting");
      toast({title:"Error",description:(e as any).message,variant:"destructive"});
    }
  },[selection,bet,phase,qc,toast]);

  function collect(){
    setPhase("betting");setWin(0);setRes(null);setSel(null);setBet(0);
    setCarPos({car1:0,car2:0,car3:0});
    posRef.current={car1:0,car2:0,car3:0};
    resultRef.current=null;lockedRef.current=null;
    racingRef.current=false;doneRef.current=false;setLights(0);
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
          padding:"13px 16px",background:"rgba(3,3,8,0.97)",
          borderBottom:"1px solid rgba(255,255,255,0.05)",
          backdropFilter:"blur(14px)",position:"sticky",top:0,zIndex:30}}>
          <button onClick={()=>nav("/")} style={{
            display:"flex",alignItems:"center",gap:6,padding:"7px 13px",
            background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",
            borderRadius:10,color:"rgba(255,255,255,0.5)",cursor:"pointer",fontSize:14,
          }}>
            <ArrowLeft size={15}/>Back
          </button>
          <div style={{display:"flex",alignItems:"center",gap:9}}>
            <img src={`${BASE}car-roulette-logo.jpg`} alt="" style={{height:34,width:34,borderRadius:8,objectFit:"cover"}}
              onError={e=>(e.currentTarget.style.display="none")}/>
            <div>
              <div style={{fontSize:15,fontWeight:900,letterSpacing:2,
                background:"linear-gradient(90deg,#60a5fa,#fff,#f87171)",
                WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>
                🏁 CAR ROULETTE
              </div>
              <div style={{fontSize:9,color:"rgba(255,255,255,0.22)",letterSpacing:2}}>SUPERCAR RACE</div>
            </div>
          </div>
          <div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",
            borderRadius:10,padding:"6px 12px",textAlign:"right"}}>
            <div style={{fontSize:8,color:"rgba(255,255,255,0.25)",letterSpacing:1}}>BALANCE</div>
            <div style={{fontSize:12,fontWeight:800,color:"#f5c542"}}>{formatCurrency(balance)}</div>
          </div>
        </div>

        {/* Ticker */}
        <div style={{height:26,overflow:"hidden",display:"flex",alignItems:"center",
          background:"rgba(3,3,8,0.92)",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
          <div style={{whiteSpace:"nowrap",fontSize:11,color:"rgba(255,255,255,0.25)",letterSpacing:0.5,
            animation:"cr3-ticker 22s linear infinite"}}>{TICKER}{TICKER}</div>
        </div>

        <div style={{padding:"12px 12px 8px"}}>
          <div style={{textAlign:"center",marginBottom:10,fontSize:10,letterSpacing:3,
            color:"rgba(255,255,255,0.18)",fontWeight:700}}>🏎 PICK YOUR SUPERCAR AND RACE 🏎</div>

          {/* ═══ RACETRACK ═══ */}
          <div style={{
            background:"linear-gradient(180deg,#0a0a1e 0%,#05050f 100%)",
            border:"2px solid rgba(255,255,255,0.06)",
            borderRadius:18,padding:"12px 10px 10px",
            position:"relative",overflow:"hidden",
          }}>
            {/* Ambient glow */}
            <div style={{position:"absolute",inset:0,
              background:"radial-gradient(ellipse 120% 60% at 50% -10%,rgba(60,40,120,0.2) 0%,transparent 60%)",
              pointerEvents:"none"}}/>

            {/* Start lights */}
            {phase==="countdown"&&<StartLights count={lights}/>}

            {/* Labels */}
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:5,padding:"0 4px"}}>
              <div style={{fontSize:9,color:"rgba(255,255,255,0.2)",letterSpacing:2}}>START 🚦</div>
              <div style={{fontSize:9,color:"rgba(255,255,255,0.2)",letterSpacing:2}}>FINISH 🏁</div>
            </div>

            {/* Checkered finish line */}
            <div style={{
              position:"absolute",right:10,top:0,bottom:0,width:10,zIndex:5,
              backgroundImage:"repeating-linear-gradient(180deg,rgba(255,255,255,0.2) 0,rgba(255,255,255,0.2) 5px,rgba(0,0,0,0.3) 5px,rgba(0,0,0,0.3) 10px)",
              backgroundSize:"10px 10px",
              borderRadius:"0 6px 6px 0",
              pointerEvents:"none",
            }}/>

            {/* Race lanes */}
            {(["car1","car2","car3"] as Selection[]).map(id=>(
              <RaceLane key={id} carId={id}
                pos={carPos[id]}
                isRacing={phase==="racing"}
                isWinner={resultKey===id}
                phase={phase}
                selected={selection===id}
              />
            ))}

            {/* Race status */}
            {phase==="racing"&&(
              <div style={{marginTop:6,textAlign:"center",fontSize:10,letterSpacing:2,
                color:"rgba(255,255,255,0.28)",animation:"cr3-throb 0.8s ease-in-out infinite"}}>
                🏁 RACE IN PROGRESS...
              </div>
            )}

            {/* Result panel */}
            {phase==="result"&&resCfg&&(
              <div style={{
                marginTop:10,
                background:won
                  ?"linear-gradient(135deg,rgba(4,20,4,0.98),rgba(8,45,12,0.98))"
                  :"linear-gradient(135deg,rgba(20,4,4,0.98),rgba(60,8,8,0.98))",
                border:`2px solid ${won?"rgba(245,197,66,0.5)":"rgba(239,68,68,0.3)"}`,
                borderRadius:16,padding:"18px 14px",textAlign:"center",
                animation:"cr3-burst 0.5s cubic-bezier(.34,1.56,.64,1) both",
              }}>
                <div style={{fontSize:38,marginBottom:4}}>{won?"🏆":"💨"}</div>
                <div style={{fontSize:16,fontWeight:900,letterSpacing:2,marginBottom:2,
                  color:won?"#f5c542":"#fca5a5"}}>
                  {won?"RACE WINNER!":"BETTER LUCK NEXT TIME"}
                </div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginBottom:won?10:14}}>
                  <span style={{color:resCfg.track,fontWeight:700}}>{resCfg.name}</span> crosses finish · {resCfg.mult}×
                </div>
                {won&&(
                  <div style={{fontSize:28,fontWeight:900,color:"#f5c542",
                    textShadow:"0 0 24px rgba(245,197,66,0.7)",marginBottom:14}}>
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
                  {won?"💰 COLLECT WINNINGS":"🏁 RACE AGAIN"}
                </button>
              </div>
            )}
          </div>

          {/* ─── Car selection cards ─── */}
          <div style={{marginTop:12,display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
            {(Object.entries(CAR_CFG) as [Selection, typeof CAR_CFG[Selection]][]).map(([key,cfg])=>{
              const sel=selection===key;
              const isJack=key==="car3";
              return (
                <div key={key} onClick={()=>{if(busy||phase==="result")return;setSel(key);}}
                  style={{
                    background:sel
                      ?"linear-gradient(160deg,rgba(10,10,30,0.97),rgba(5,5,18,0.97))"
                      :"rgba(6,6,14,0.7)",
                    border:`2px solid ${sel?cfg.track:"rgba(255,255,255,0.06)"}`,
                    borderRadius:16,padding:"10px 6px 8px",textAlign:"center",
                    cursor:phase!=="betting"?"default":"pointer",
                    transition:"all 0.2s",position:"relative",overflow:"hidden",
                    boxShadow:sel?`0 0 28px ${cfg.glow}`:undefined,
                  }}>
                  {isJack&&(
                    <div style={{
                      position:"absolute",top:4,left:"50%",transform:"translateX(-50%)",
                      background:"linear-gradient(90deg,#d97706,#f5c542)",
                      borderRadius:6,padding:"1px 8px",fontSize:7,fontWeight:900,
                      color:"#020c05",letterSpacing:1,whiteSpace:"nowrap",
                    }}>JACKPOT</div>
                  )}
                  <div style={{
                    fontSize:8,fontWeight:900,letterSpacing:1,
                    marginTop:isJack?14:2,marginBottom:1,
                    color:sel?cfg.track:"rgba(255,255,255,0.35)"}}>
                    {cfg.brand}
                  </div>
                  {/* Real car image thumbnail */}
                  <div style={{
                    height:48,display:"flex",alignItems:"center",justifyContent:"center",
                    filter:sel?`drop-shadow(0 0 8px ${cfg.glow})`:"grayscale(0.5) brightness(0.65)",
                    transition:"filter 0.2s",
                  }}>
                    <img src={`${BASE}${cfg.img}`} alt={cfg.name}
                      style={{maxWidth:"100%",maxHeight:48,objectFit:"contain"}}/>
                  </div>
                  <div style={{fontSize:9,color:"rgba(255,255,255,0.25)",marginBottom:2}}>{cfg.name}</div>
                  <div style={{fontSize:18,fontWeight:900,
                    color:sel?cfg.track:"rgba(255,255,255,0.18)",
                    textShadow:sel?`0 0 12px ${cfg.glow}`:undefined}}>{cfg.mult}×</div>
                </div>
              );
            })}
          </div>

          {/* Chips */}
          <div style={{marginTop:12}}>
            <div style={{fontSize:9,letterSpacing:3,color:"rgba(255,255,255,0.16)",marginBottom:8,textAlign:"center"}}>
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
            background:"rgba(0,0,0,0.5)",border:"1px solid rgba(255,255,255,0.04)",
            borderRadius:14,overflow:"hidden"}}>
            {[
              {l:"WIN",    v:formatCurrency(win),    c:win>0?"#f5c542":"rgba(255,255,255,0.16)"},
              {l:"BET",    v:formatCurrency(bet),    c:bet>0?"#22c55e":"rgba(255,255,255,0.16)"},
              {l:"BALANCE",v:formatCurrency(balance),c:"rgba(255,255,255,0.28)"},
            ].map((item,i)=>(
              <div key={i} style={{padding:"10px 0",textAlign:"center",
                borderRight:i<2?"1px solid rgba(255,255,255,0.04)":undefined}}>
                <div style={{fontSize:8,letterSpacing:2,color:"rgba(255,255,255,0.16)",marginBottom:2}}>{item.l}</div>
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
                  ?"linear-gradient(90deg,#0f0f20,#1a1a35)"
                  :(!selection||bet<=0)
                  ?"rgba(255,255,255,0.03)"
                  :"linear-gradient(90deg,#1d4ed8,#7c3aed,#b91c1c)",
                backgroundSize:"200% 100%",
                color:(!selection||bet<=0)&&!busy?"rgba(255,255,255,0.12)":"#fff",
                boxShadow:(!busy&&selection&&bet>0)?"0 0 30px rgba(124,58,237,0.45),0 4px 20px rgba(0,0,0,0.5)":undefined,
                animation:(!busy&&selection&&bet>0)?"cr3-shimmer 2.5s linear infinite":undefined,
                opacity:(!selection||bet<=0)&&!busy?0.35:1,
              }}>
              {phase==="countdown"?"🚦 RACE STARTING...":busy?"🏁 RACE IN PROGRESS...":"🏎 START THE RACE 🏎"}
            </button>
          )}

          <div style={{marginTop:8,textAlign:"center",fontSize:10,color:"rgba(255,255,255,0.12)",letterSpacing:1}}>
            {!selection&&phase==="betting"&&"Pick BMW • Ferrari • or Jackpot Lamborghini"}
            {selection&&bet<=0&&phase==="betting"&&`${selCfg?.name} selected — add chips to continue`}
            {selection&&bet>0&&phase==="betting"&&`${selCfg?.mult}× payout if ${selCfg?.name} wins the race`}
          </div>
        </div>
      </div>
    </div>
  );
}
