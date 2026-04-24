import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey, getGetBalanceQueryKey } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");

type Selection = "car1" | "car2" | "car3";
type Phase = "betting" | "racing" | "result";

const CARS = [
  { key:"car1" as Selection, num:1, icon:"🚗", label:"CAR 1",  color:"#3b82f6", dark:"#1e3a8a", glow:"rgba(59,130,246,0.7)", mult:1.95, bg:"linear-gradient(145deg,#0a1628,#1e3a8a)" },
  { key:"car2" as Selection, num:2, icon:"🏎️", label:"CAR 2",  color:"#ef4444", dark:"#7f1d1d", glow:"rgba(239,68,68,0.7)",  mult:1.95, bg:"linear-gradient(145deg,#1a0505,#7f1d1d)" },
  { key:"car3" as Selection, num:3, icon:"⚡", label:"CAR 3",  color:"#f5c542", dark:"#78350f", glow:"rgba(245,197,66,0.8)", mult:5,    bg:"linear-gradient(145deg,#1a0e00,#854d0e)" },
];

const CHIPS = [
  {amt:100,color:"#3b82f6"},{amt:500,color:"#22c55e"},
  {amt:1000,color:"#a855f7"},{amt:5000,color:"#f97316"},{amt:10000,color:"#f5c542"},
];

const TICKER = "🏁 GRAND PRIX CIRCUIT  •  🚗 CAR 1: 1.95×  •  🏎️ CAR 2: 1.95×  •  ⚡ CAR 3: 5× JACKPOT  •  🏆 RACE TO WIN  •  🏁 START YOUR ENGINES  •  🔥 SPEED BETTING  •  ";

const STYLES = `
  .cr-bg {
    background: radial-gradient(ellipse at 50% 0%,#0d1b3e 0%,#020415 55%,#000308 100%);
    min-height:100dvh;
  }
  .cr-bg::before {
    content:'';position:fixed;inset:0;pointer-events:none;z-index:0;
    background:
      repeating-linear-gradient(90deg,rgba(59,130,246,0.015) 0,rgba(59,130,246,0.015) 1px,transparent 1px,transparent 60px);
  }
  @keyframes cr-ticker   {0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
  @keyframes cr-speed-ln {0%{transform:translateX(-100%);opacity:0.8}100%{transform:translateX(200%);opacity:0}}
  @keyframes cr-vibrate  {0%,100%{transform:translateX(0)}25%{transform:translateX(-3px)}75%{transform:translateX(3px)}}
  @keyframes cr-race-out {0%{left:8%}100%{left:82%}}
  @keyframes cr-winner   {0%{transform:scale(1) rotate(0)}25%{transform:scale(1.4) rotate(-8deg)}50%{transform:scale(1.2) rotate(8deg)}75%{transform:scale(1.35) rotate(-4deg)}100%{transform:scale(1.3) rotate(0)}}
  @keyframes cr-light-flash{0%,100%{opacity:0.15}50%{opacity:1}}
  @keyframes cr-burst    {0%{transform:scale(0.1);opacity:0}60%{transform:scale(1.1)}80%{transform:scale(0.95)}100%{transform:scale(1);opacity:1}}
  @keyframes cr-shimmer  {0%{background-position:-300% 0}100%{background-position:300% 0}}
  @keyframes cr-glow-trk {0%,100%{box-shadow:0 0 25px rgba(59,130,246,0.12)}50%{box-shadow:0 0 50px rgba(59,130,246,0.22)}}
  @keyframes cr-dust     {0%{transform:translateY(0) scale(1);opacity:0.8}100%{transform:translateY(-20px) scale(2);opacity:0}}
  @keyframes cr-trophy   {0%{transform:scale(0) translateY(10px);opacity:0}60%{transform:scale(1.2) translateY(-5px)}100%{transform:scale(1) translateY(0);opacity:1}}
`;

function RaceTrack({ selection, phase, resultKey }:{
  selection:Selection|null; phase:Phase; resultKey:Selection|null;
}) {
  const [carPositions,setCarPositions]=useState<Record<string,number>>({car1:8,car2:8,car3:8});
  const [winnerCar,setWinnerCar]=useState<Selection|null>(null);
  const [lights,setLights]=useState([false,false,false,false,false]);
  const animRefs=useRef<any[]>([]);

  useEffect(()=>{
    animRefs.current.forEach(clearInterval);animRefs.current=[];
    if(phase==="betting"){
      setCarPositions({car1:8,car2:8,car3:8});setWinnerCar(null);
      setLights([false,false,false,false,false]);
    }
    if(phase==="racing"){
      // Start lights sequence
      [0,1,2,3,4].forEach((i)=>{
        setTimeout(()=>setLights(prev=>{const n=[...prev];n[i]=true;return n;}),i*350);
      });
      setTimeout(()=>{
        setLights([false,false,false,false,false]);
        // Cars vibrate then race
        const vibId=setInterval(()=>{
          setCarPositions(prev=>({
            car1: prev.car1+(Math.random()-0.48)*6,
            car2: prev.car2+(Math.random()-0.48)*6,
            car3: prev.car3+(Math.random()-0.48)*6,
          }));
        },80);
        animRefs.current.push(vibId);
      },5*350+200);
    }
    if(phase==="result"&&resultKey){
      animRefs.current.forEach(clearInterval);animRefs.current=[];
      // Settle all cars, winner shoots ahead
      const startPos={car1:12,car2:12,car3:12};
      let steps=0;
      const settleId=setInterval(()=>{
        steps++;
        const progress=Math.min(steps/25,1);
        setCarPositions({
          car1: startPos.car1+(resultKey==="car1"?70:50)*Math.pow(progress,0.8),
          car2: startPos.car2+(resultKey==="car2"?70:50)*Math.pow(progress,0.8),
          car3: startPos.car3+(resultKey==="car3"?70:50)*Math.pow(progress,0.8),
        });
        if(steps>=25){clearInterval(settleId);setWinnerCar(resultKey);}
      },55);
      animRefs.current.push(settleId);
    }
    return()=>{animRefs.current.forEach(clearInterval);};
  },[phase,resultKey]);

  const raceInProgress=phase==="racing";

  return (
    <div style={{position:"relative"}}>
      {/* Start lights */}
      {(phase==="racing"&&lights.some(Boolean))&&(
        <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:10}}>
          {lights.map((on,i)=>(
            <div key={i} style={{width:18,height:18,borderRadius:"50%",
              background:on?"#ef4444":"rgba(239,68,68,0.15)",
              boxShadow:on?"0 0 14px #ef4444,0 0 28px #ef444488":undefined,
              transition:"all 0.2s"}}/>
          ))}
        </div>
      )}

      {/* Track */}
      <div style={{
        background:"linear-gradient(180deg,#0a0f1e,#111827,#0a0f1e)",
        border:"2px solid rgba(59,130,246,0.25)",borderRadius:18,
        padding:"12px 10px",position:"relative",overflow:"hidden",
        animation:"cr-glow-trk 3s ease-in-out infinite",
      }}>
        {/* Checkered pattern left */}
        <div style={{position:"absolute",left:0,top:0,bottom:0,width:16,borderRadius:"16px 0 0 16px",
          background:"repeating-linear-gradient(180deg,#fff 0,#fff 8px,#111 8px,#111 16px)",opacity:0.4}}/>
        {/* Checkered pattern right */}
        <div style={{position:"absolute",right:0,top:0,bottom:0,width:16,borderRadius:"0 16px 16px 0",
          background:"repeating-linear-gradient(180deg,#fff 0,#fff 8px,#111 8px,#111 16px)",opacity:0.4}}/>

        {/* Speed lines when racing */}
        {raceInProgress&&[...Array(6)].map((_,i)=>(
          <div key={i} style={{position:"absolute",height:2,width:"40%",
            background:`linear-gradient(90deg,transparent,${CARS[i%3].color}66,transparent)`,
            top:`${15+i*14}%`,
            animation:`cr-speed-ln ${0.5+i*0.1}s ${i*0.08}s linear infinite`}}/>
        ))}

        {/* Lane dividers */}
        {[33,66].map(p=>(
          <div key={p} style={{position:"absolute",left:"8%",right:"8%",top:`${p}%`,height:1,
            background:"rgba(255,255,255,0.06)",borderTop:"1px dashed rgba(255,255,255,0.06)"}}/>
        ))}

        {/* The 3 car lanes */}
        {CARS.map((car,i)=>{
          const pos=carPositions[car.key]??8;
          const isWinner=winnerCar===car.key;
          const isSelected=selection===car.key;
          return (
            <div key={car.key} style={{height:52,position:"relative",marginBottom:i<2?8:0,
              background:isSelected?"rgba(255,255,255,0.025)":"transparent",
              borderRadius:8,border:isSelected?`1px solid ${car.color}22`:"1px solid transparent"}}>
              {/* Car number label */}
              <div style={{position:"absolute",left:20,top:"50%",transform:"translateY(-50%)",
                fontSize:9,fontWeight:900,letterSpacing:1,color:`${car.color}88`}}>#{car.num}</div>

              {/* Car */}
              <div style={{
                position:"absolute",
                left:`${Math.max(8,Math.min(pos,82))}%`,
                top:"50%",
                transform:"translateY(-50%)",
                fontSize:28,
                transition:raceInProgress?"none":"left 0.5s cubic-bezier(.34,1.56,.64,1)",
                animation:raceInProgress?"cr-vibrate 0.15s linear infinite":
                  isWinner?"cr-winner 0.6s ease-in-out forwards":undefined,
                filter:isWinner?`drop-shadow(0 0 12px ${car.color})`:`drop-shadow(0 2px 4px rgba(0,0,0,0.5))`,
                zIndex:2,
              }}>{car.icon}</div>

              {/* Winner trophy */}
              {isWinner&&(
                <div style={{position:"absolute",left:"85%",top:"10%",fontSize:20,
                  animation:"cr-trophy 0.5s cubic-bezier(.34,1.56,.64,1) forwards"}}>🏆</div>
              )}

              {/* Dust/exhaust particles */}
              {raceInProgress&&[...Array(3)].map((_,p)=>(
                <div key={p} style={{position:"absolute",
                  left:`${Math.max(8,Math.min(pos-4,78))}%`,
                  top:`${30+p*15}%`,
                  fontSize:8,opacity:0.4,
                  animation:`cr-dust ${0.4+p*0.1}s ${p*0.05}s ease-out infinite`}}>
                  💨
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CarRouletteGame(){
  const [,nav]=useLocation();
  const {user}=useAuth();
  const qc=useQueryClient();
  const {toast}=useToast();

  const [phase,setPhase]=useState<Phase>("betting");
  const [selection,setSelection]=useState<Selection|null>(null);
  const [bet,setBet]=useState(0);
  const [win,setWin]=useState(0);
  const [resultKey,setResultKey]=useState<Selection|null>(null);
  const [lapTime,setLapTime]=useState("00:00.000");

  const pollTimer=useRef<any>(null);
  const lapInterval=useRef<any>(null);
  const lapStart=useRef<number>(0);
  const balance=(user as any)?.balance??0;

  useEffect(()=>{
    const s=document.createElement("style");s.textContent=STYLES;document.head.appendChild(s);
    return()=>{try{document.head.removeChild(s)}catch{}};
  },[]);
  useEffect(()=>()=>{if(pollTimer.current)clearInterval(pollTimer.current);},[]);

  useEffect(()=>{
    if(phase==="racing"){
      lapStart.current=Date.now();
      lapInterval.current=setInterval(()=>{
        const ms=Date.now()-lapStart.current;
        const s=Math.floor(ms/1000)%60;
        const m=Math.floor(ms/60000);
        setLapTime(`${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}.${String(ms%1000).padStart(3,"0")}`);
      },33);
    } else {
      if(lapInterval.current)clearInterval(lapInterval.current);
    }
    return()=>{if(lapInterval.current)clearInterval(lapInterval.current);};
  },[phase]);

  async function placeBet(){
    if(!selection||bet<=0||phase!=="betting")return;
    const lockedSel=selection,lockedBet=bet;
    setPhase("racing");setResultKey(null);

    try{
      const r=await fetch(`${API}/api/games/car-roulette`,{
        method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",
        body:JSON.stringify({selection:lockedSel,stake:lockedBet}),
      });
      if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.error||"Bet failed");}
      const {roundId}=await r.json();
      qc.invalidateQueries({queryKey:getGetBalanceQueryKey()});
      qc.invalidateQueries({queryKey:getGetMeQueryKey()});

      if(pollTimer.current)clearInterval(pollTimer.current);
      pollTimer.current=setInterval(async()=>{
        try{
          const pr=await fetch(`${API}/api/games/casino-round/car-roulette/${roundId}`,{credentials:"include"});
          if(!pr.ok)return;
          const data=await pr.json();
          if(data.status==="settled"){
            clearInterval(pollTimer.current);
            const serverResult=(data.result??"").trim().toLowerCase() as Selection;
            setTimeout(()=>{
              setResultKey(serverResult);
              setTimeout(()=>{
                const won=serverResult===lockedSel;
                setWin(won?lockedBet*(CARS.find(c=>c.key===lockedSel)?.mult??1.95):0);
                setPhase("result");
                if(won){qc.invalidateQueries({queryKey:getGetBalanceQueryKey()});qc.invalidateQueries({queryKey:getGetMeQueryKey()});}
              },1200);
            },500);
          }
        }catch{}
      },600);
      setTimeout(()=>{if(pollTimer.current)clearInterval(pollTimer.current);},30000);
    }catch(e:any){
      setPhase("betting");
      toast({title:"Error",description:(e as any).message,variant:"destructive"});
    }
  }

  function collect(){setPhase("betting");setWin(0);setResultKey(null);setSelection(null);setBet(0);setLapTime("00:00.000");}
  function addChip(a:number){if(phase!=="betting")return;setBet(b=>Math.min(b+a,balance));}

  const selCar=CARS.find(c=>c.key===selection);
  const resCar=CARS.find(c=>c.key===resultKey);
  const busy=phase==="racing";

  return (
    <div className="cr-bg" style={{fontFamily:"'Segoe UI',system-ui,sans-serif",color:"#fff",position:"relative"}}>
      <div style={{position:"relative",zIndex:10,maxWidth:480,margin:"0 auto",paddingBottom:32}}>

        {/* Header */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",
          background:"rgba(2,4,21,0.92)",borderBottom:"1px solid rgba(59,130,246,0.2)",backdropFilter:"blur(14px)"}}>
          <button onClick={()=>nav("/")} style={{background:"rgba(59,130,246,0.1)",border:"1px solid rgba(59,130,246,0.3)",
            borderRadius:10,padding:"7px 12px",color:"#93c5fd",cursor:"pointer",
            display:"flex",alignItems:"center",gap:6,fontSize:14}}>
            <ArrowLeft size={16}/>Back
          </button>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:15,fontWeight:900,letterSpacing:2,
              background:"linear-gradient(90deg,#3b82f6,#fff,#ef4444)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>
              🏁 CAR ROULETTE
            </div>
            <div style={{fontSize:9,color:"rgba(59,130,246,0.6)",letterSpacing:2}}>GRAND PRIX CIRCUIT</div>
          </div>
          <div style={{background:"rgba(59,130,246,0.1)",border:"1px solid rgba(59,130,246,0.25)",
            borderRadius:10,padding:"6px 12px",textAlign:"right"}}>
            <div style={{fontSize:9,color:"rgba(255,255,255,0.4)",letterSpacing:1}}>BALANCE</div>
            <div style={{fontSize:13,fontWeight:700,color:"#93c5fd"}}>{formatCurrency(balance)}</div>
          </div>
        </div>

        {/* Ticker */}
        <div style={{background:"rgba(2,4,21,0.9)",borderBottom:"1px solid rgba(59,130,246,0.12)",
          overflow:"hidden",height:26,display:"flex",alignItems:"center"}}>
          <div style={{whiteSpace:"nowrap",fontSize:11,color:"rgba(59,130,246,0.75)",letterSpacing:0.5,
            animation:"cr-ticker 20s linear infinite"}}>{TICKER}{TICKER}</div>
        </div>

        <div style={{padding:"14px 12px 10px"}}>
          <div style={{textAlign:"center",marginBottom:10}}>
            <div style={{fontSize:10,letterSpacing:4,color:"rgba(59,130,246,0.6)",fontWeight:700}}>
              🏁 GRAND PRIX RACE 🏁
            </div>
          </div>

          {/* Race Track */}
          <div style={{position:"relative"}}>
            <RaceTrack selection={selection} phase={phase} resultKey={resultKey}/>

            {/* Lap Timer */}
            <div style={{display:"flex",justifyContent:"center",marginTop:10}}>
              <div style={{
                background:"rgba(0,0,0,0.7)",border:"1px solid rgba(59,130,246,0.3)",
                borderRadius:8,padding:"5px 16px",fontFamily:"'Courier New',monospace",
                fontSize:14,fontWeight:900,color:phase==="racing"?"#22d3ee":"rgba(255,255,255,0.3)",
                letterSpacing:2,
              }}>⏱ {lapTime}</div>
            </div>

            {/* Inline result panel */}
            {phase==="result"&&resultKey&&(()=>{
              const won=win>0;
              return (
                <div style={{marginTop:14,
                  background:won?`linear-gradient(135deg,${resCar?.dark??"#0a1628"},${resCar?.dark??"#1e3a8a"})`:
                    "linear-gradient(135deg,#0f0515,#1e0028)",
                  border:`2px solid ${won?resCar?.color??"#3b82f6":"#7c3aed"}`,
                  borderRadius:16,padding:"16px 14px",textAlign:"center",
                  animation:"cr-burst 0.5s cubic-bezier(.34,1.56,.64,1) forwards",
                  boxShadow:`0 0 32px ${won?resCar?.glow??"rgba(59,130,246,0.5)":"rgba(124,58,237,0.35)"}`}}>
                  <div style={{fontSize:38,marginBottom:4}}>{won?"🏆":"💨"}</div>
                  <div style={{fontSize:16,fontWeight:900,letterSpacing:2,
                    color:won?resCar?.color??"#3b82f6":"#c4b5fd",marginBottom:4}}>
                    {won?"WINNER! PODIUM FINISH!":"BETTER LUCK NEXT RACE!"}
                  </div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",marginBottom:won?8:12}}>
                    {resCar?.icon} <strong style={{color:resCar?.color??""}}>{resCar?.label}</strong> wins · {resCar?.mult}×
                  </div>
                  {won&&<div style={{fontSize:28,fontWeight:900,color:"#f5c542",
                    textShadow:"0 0 16px rgba(245,197,66,0.6)",marginBottom:12}}>+{formatCurrency(win)}</div>}
                  <button onClick={collect} style={{padding:"10px 28px",borderRadius:12,border:"none",cursor:"pointer",
                    fontWeight:900,fontSize:14,
                    background:won?`linear-gradient(90deg,${resCar?.dark},${resCar?.color})`:"linear-gradient(90deg,#6d28d9,#7c3aed)",
                    color:"#fff"}}>
                    {won?"🏆 COLLECT PRIZE":"🏁 RACE AGAIN"}
                  </button>
                </div>
              );
            })()}
          </div>

          {/* Car bet cards */}
          <div style={{marginTop:14,display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
            {CARS.map(car=>(
              <div key={car.key} onClick={()=>{if(phase!=="betting")return;setSelection(car.key);}}
                style={{background:selection===car.key?car.bg:"rgba(0,0,0,0.5)",
                  border:`2px solid ${selection===car.key?car.color:"rgba(255,255,255,0.08)"}`,
                  borderRadius:16,padding:"13px 6px",textAlign:"center",cursor:"pointer",transition:"all 0.25s",
                  boxShadow:selection===car.key?`0 0 20px ${car.glow}`:undefined}}>
                <div style={{fontSize:28,marginBottom:4}}>{car.icon}</div>
                <div style={{fontSize:9,fontWeight:900,letterSpacing:2,
                  color:selection===car.key?car.color:"rgba(255,255,255,0.5)"}}>#{car.num} {car.label}</div>
                <div style={{fontSize:18,fontWeight:900,marginTop:4,
                  color:selection===car.key?car.color:"rgba(255,255,255,0.3)"}}>{car.mult}×</div>
                {car.mult===5&&<div style={{fontSize:8,color:"rgba(245,197,66,0.6)",marginTop:2,letterSpacing:1}}>DARK HORSE</div>}
              </div>
            ))}
          </div>

          {/* Chips */}
          <div style={{marginTop:14}}>
            <div style={{fontSize:9,letterSpacing:3,color:"rgba(255,255,255,0.3)",marginBottom:8,textAlign:"center"}}>BET AMOUNT</div>
            <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap"}}>
              {CHIPS.map(c=>(
                <button key={c.amt} onClick={()=>addChip(c.amt)} disabled={busy} style={{
                  width:52,height:52,borderRadius:"50%",border:`3px solid ${c.color}`,cursor:"pointer",
                  background:`radial-gradient(circle at 35% 30%,${c.color}bb,${c.color}55)`,
                  color:"#fff",fontSize:10,fontWeight:900,
                  boxShadow:`0 4px 12px ${c.color}44`,opacity:busy?0.5:1,
                }}>
                  {c.amt>=1000?`${c.amt/1000}K`:c.amt}
                </button>
              ))}
            </div>
          </div>

          {/* Info bar */}
          <div style={{marginTop:14,display:"grid",gridTemplateColumns:"repeat(3,1fr)",
            background:"rgba(0,0,0,0.5)",border:"1px solid rgba(59,130,246,0.1)",borderRadius:14,overflow:"hidden"}}>
            {[{label:"WIN",value:formatCurrency(win),color:win>0?"#22d3ee":"rgba(255,255,255,0.3)"},
              {label:"BET",value:formatCurrency(bet),color:bet>0?"#f5c542":"rgba(255,255,255,0.3)"},
              {label:"BALANCE",value:formatCurrency(balance),color:"rgba(255,255,255,0.5)"},
            ].map((item,i)=>(
              <div key={i} style={{padding:"10px 0",textAlign:"center",
                borderRight:i<2?"1px solid rgba(59,130,246,0.08)":undefined}}>
                <div style={{fontSize:8,letterSpacing:2,color:"rgba(255,255,255,0.3)",marginBottom:3}}>{item.label}</div>
                <div style={{fontSize:13,fontWeight:700,color:item.color}}>{item.value}</div>
              </div>
            ))}
          </div>

          {/* Race button */}
          {phase!=="result"&&(
            <button onClick={placeBet} disabled={busy||!selection||bet<=0}
              style={{marginTop:14,width:"100%",padding:"17px 0",borderRadius:18,border:"none",cursor:"pointer",
                fontSize:16,fontWeight:900,letterSpacing:2,
                background:busy?"linear-gradient(90deg,#1e3a8a,#1d4ed8)":(!selection||bet<=0)?"rgba(255,255,255,0.06)":"linear-gradient(90deg,#1d4ed8,#3b82f6,#60a5fa,#3b82f6,#1d4ed8)",
                backgroundSize:"200% 100%",
                color:(!selection||bet<=0)&&!busy?"rgba(255,255,255,0.25)":"#fff",
                boxShadow:(!busy&&selection&&bet>0)?"0 0 28px rgba(59,130,246,0.5)":undefined,
                animation:(!busy&&selection&&bet>0)?"cr-shimmer 2.2s linear infinite":undefined,
                opacity:(!selection||bet<=0)&&!busy?0.5:1}}>
              {busy?"🏁 RACE IN PROGRESS...":"🚗 START THE RACE!"}
            </button>
          )}
          <div style={{marginTop:8,textAlign:"center",fontSize:11,color:"rgba(255,255,255,0.25)",letterSpacing:1}}>
            {!selection&&phase==="betting"&&"Pick a car to back and place your bet"}
            {selection&&bet<=0&&phase==="betting"&&`${selCar?.icon} ${selCar?.label} selected — add chips!`}
            {selection&&bet>0&&phase==="betting"&&`${selCar?.mult}× payout if ${selCar?.label} wins!`}
            {busy&&"🏎️ Cars are racing — hang tight!"}
          </div>
        </div>
      </div>
    </div>
  );
}
