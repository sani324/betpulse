import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey, getGetBalanceQueryKey } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");
const BASE = import.meta.env.BASE_URL;

type Selection = "fortune" | "grand" | "supreme";
type Phase = "betting" | "spinning" | "result";

const FORTUNE_SYMS = ["福","財","天","龍","玉","金","神","壽","吉","寶"];

const BET_TYPES = [
  { key:"fortune" as Selection, char:"福", pinyin:"Fú",  label:"FORTUNE",  sub:"Blessings",    mult:1.95,color:"#f97316",dark:"#7c2d12",glow:"rgba(249,115,22,0.7)",  bg:"linear-gradient(145deg,#1c0800,#7c2d12,#9a3412)" },
  { key:"grand"   as Selection, char:"財", pinyin:"Cái", label:"GRAND",     sub:"Wealth",       mult:5,   color:"#22c55e",dark:"#14532d",glow:"rgba(34,197,94,0.65)", bg:"linear-gradient(145deg,#052a0e,#14532d,#166534)" },
  { key:"supreme" as Selection, char:"天", pinyin:"Tiān",label:"SUPREME",   sub:"Heavenly Win", mult:10,  color:"#f5c542",dark:"#78350f",glow:"rgba(245,197,66,0.8)", bg:"linear-gradient(145deg,#1c1000,#854d0e,#92400e)" },
];

const CHIPS = [
  {amt:100,color:"#f97316"},{amt:500,color:"#22c55e"},
  {amt:1000,color:"#f5c542"},{amt:5000,color:"#a855f7"},{amt:10000,color:"#dc2626"},
];

const TICKER = "🐉 SHEN CAISHEN PALACE  •  福 FORTUNE BLESSINGS: 1.95×  •  財 GRAND WEALTH: 5×  •  天 SUPREME HEAVEN: 10×  •  💰 STRIKE GOLD  •  🏮 LANTERNS LIT  •  🐲 DRAGON RISES  •  ";

const RESULT_CHARS: Record<Selection, string[][]> = {
  fortune: [["福","福","福"],["龍","福","玉"],["福","吉","福"]],
  grand:   [["財","財","財"],["財","金","財"],["寶","財","財"]],
  supreme: [["天","天","天"],["天","龍","天"],["玉","天","天"]],
};

const STYLES = `
  .gof-bg {
    background: radial-gradient(ellipse at 50% 0%,#3d0010 0%,#1a0006 40%,#0d0003 100%);
    min-height:100dvh;
  }
  .gof-bg::before {
    content:'';position:fixed;inset:0;pointer-events:none;z-index:0;
    background:
      radial-gradient(ellipse 100% 50% at 50% 0%,rgba(245,197,66,0.06) 0%,transparent 50%),
      repeating-linear-gradient(90deg,rgba(245,197,66,0.015) 0,rgba(245,197,66,0.015) 1px,transparent 1px,transparent 44px),
      repeating-linear-gradient(0deg,rgba(220,38,38,0.015) 0,rgba(220,38,38,0.015) 1px,transparent 1px,transparent 44px);
  }
  @keyframes gof-ticker    {0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
  @keyframes gof-reel-spin {0%{transform:translateY(0)}100%{transform:translateY(-${FORTUNE_SYMS.length*60}px)}}
  @keyframes gof-coin-fall {0%{transform:translateY(-20px) rotate(0deg);opacity:1}100%{transform:translateY(300px) rotate(720deg);opacity:0}}
  @keyframes gof-gong      {0%{box-shadow:0 0 0 0 rgba(245,197,66,0.6)}50%{box-shadow:0 0 0 20px rgba(245,197,66,0)}100%{box-shadow:0 0 0 0 rgba(245,197,66,0)}}
  @keyframes gof-dragon-f  {0%,100%{transform:translateX(0) scaleX(1)}50%{transform:translateX(4px) scaleX(1.04)}}
  @keyframes gof-lantern   {0%,100%{transform:rotate(-6deg)}50%{transform:rotate(6deg)}}
  @keyframes gof-shimmer   {0%{background-position:-300% 0}100%{background-position:300% 0}}
  @keyframes gof-burst     {0%{transform:scale(0.1);opacity:0}60%{transform:scale(1.1)}80%{transform:scale(0.95)}100%{transform:scale(1);opacity:1}}
  @keyframes gof-char-lock {0%{transform:scale(0.6) rotateX(60deg);opacity:0}70%{transform:scale(1.12) rotateX(-5deg)}100%{transform:scale(1) rotateX(0);opacity:1}}
  @keyframes gof-neon-glow {0%,100%{text-shadow:0 0 10px #f5c542,0 0 30px #f5c54266}50%{text-shadow:0 0 22px #f5c542,0 0 60px #f5c542cc}}
  @keyframes gof-float     {0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
  @keyframes gof-win-pulse {0%,100%{box-shadow:0 0 30px rgba(245,197,66,0.3)}50%{box-shadow:0 0 60px rgba(245,197,66,0.6)}}
  .gof-title-glow { animation: gof-neon-glow 2.5s ease-in-out infinite; }
`;

function ReelDrum({ symbol, spinning, delay=0, resultBt }:{
  symbol:string; spinning:boolean; delay?:number; resultBt?:typeof BET_TYPES[0]|null;
}){
  const [visIndex,setVisIndex]=useState(0);
  const timerRef=useRef<any>(null);

  useEffect(()=>{
    if(!spinning){clearInterval(timerRef.current);return;}
    timerRef.current=setInterval(()=>{
      setVisIndex(i=>(i+1)%FORTUNE_SYMS.length);
    },75);
    return()=>clearInterval(timerRef.current);
  },[spinning]);

  const displaySym=spinning?FORTUNE_SYMS[visIndex]:symbol;
  const isResult=!spinning&&resultBt;

  return (
    <div style={{
      width:80,height:88,borderRadius:14,
      background:isResult?resultBt!.bg:"linear-gradient(145deg,#1a0006,#3d0010)",
      border:`2px solid ${isResult?resultBt!.color:"rgba(245,197,66,0.35)"}`,
      display:"flex",alignItems:"center",justifyContent:"center",
      overflow:"hidden",position:"relative",
      boxShadow:isResult?`0 0 22px ${resultBt!.glow},inset 0 0 12px rgba(0,0,0,0.3)`:"inset 0 0 12px rgba(0,0,0,0.5)",
      transition:"border-color 0.3s,box-shadow 0.3s",
    }}>
      {/* Reel lines */}
      <div style={{position:"absolute",inset:0,
        background:"repeating-linear-gradient(0deg,rgba(0,0,0,0.2) 0,rgba(0,0,0,0.2) 1px,transparent 1px,transparent 29px)",
        pointerEvents:"none",opacity:0.4}}/>

      <div style={{
        fontSize:40,lineHeight:1,fontWeight:900,
        color:isResult?resultBt!.color:"#f5c542",
        textShadow:isResult?`0 0 16px ${resultBt!.glow}`:"0 0 8px rgba(245,197,66,0.4)",
        animation:(!spinning&&isResult)?`gof-char-lock 0.55s ${delay}s cubic-bezier(.34,1.56,.64,1) both`:
          spinning?"none":undefined,
        filter:spinning?"blur(1.5px)":"none",
        transition:"filter 0.2s",
      }}>
        {displaySym}
      </div>

      {/* Reflection */}
      <div style={{position:"absolute",bottom:0,left:0,right:0,height:"35%",
        background:"linear-gradient(0deg,rgba(245,197,66,0.08),transparent)",pointerEvents:"none"}}/>
    </div>
  );
}

export default function GodOfFortuneGame(){
  const [,nav]=useLocation();
  const {user}=useAuth();
  const qc=useQueryClient();
  const {toast}=useToast();

  const [phase,setPhase]=useState<Phase>("betting");
  const [selection,setSelection]=useState<Selection|null>(null);
  const [bet,setBet]=useState(0);
  const [win,setWin]=useState(0);
  const [resultKey,setResultKey]=useState<Selection|null>(null);
  const [reelSymbols,setReelSymbols]=useState(["福","財","天"]);
  const [spinning,setSpinning]=useState(false);
  const [coins,setCoins]=useState<{x:number;id:number}[]>([]);
  const coinIdRef=useRef(0);
  const [megaPool]=useState(()=>Math.floor(500000+Math.random()*200000));

  const pollTimer=useRef<any>(null);
  const coinTimer=useRef<any>(null);
  const balance=(user as any)?.balance??0;

  useEffect(()=>{
    const s=document.createElement("style");s.textContent=STYLES;document.head.appendChild(s);
    return()=>{try{document.head.removeChild(s)}catch{}};
  },[]);
  useEffect(()=>()=>{if(pollTimer.current)clearInterval(pollTimer.current);},[]);

  function startCoinRain(){
    if(coinTimer.current)clearInterval(coinTimer.current);
    coinTimer.current=setInterval(()=>{
      setCoins(prev=>[...prev.slice(-20),{x:Math.random()*90,id:coinIdRef.current++}]);
    },90);
    setTimeout(()=>{clearInterval(coinTimer.current);setTimeout(()=>setCoins([]),2000);},2500);
  }

  function settleReels(result:Selection){
    const variants=RESULT_CHARS[result];
    const picked=variants[Math.floor(Math.random()*variants.length)];
    setSpinning(false);
    // Lock each reel with stagger
    setTimeout(()=>setReelSymbols(r=>{const n=[...r];n[0]=picked[0];return n;}),0);
    setTimeout(()=>setReelSymbols(r=>{const n=[...r];n[1]=picked[1];return n;}),220);
    setTimeout(()=>setReelSymbols(r=>{const n=[...r];n[2]=picked[2];return n;}),440);
  }

  async function placeBet(){
    if(!selection||bet<=0||phase!=="betting")return;
    const lockedSel=selection,lockedBet=bet;
    setPhase("spinning");setSpinning(true);setResultKey(null);
    setReelSymbols(["福","財","天"]);

    try{
      const r=await fetch(`${API}/api/games/god-of-fortune`,{
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
          const pr=await fetch(`${API}/api/games/casino-round/god-of-fortune/${roundId}`,{credentials:"include"});
          if(!pr.ok)return;
          const data=await pr.json();
          if(data.status==="settled"){
            clearInterval(pollTimer.current);
            const serverResult=(data.result??"").trim().toLowerCase() as Selection;
            settleReels(serverResult);
            setTimeout(()=>{
              setResultKey(serverResult);
              const won=serverResult===lockedSel;
              setWin(won?lockedBet*(BET_TYPES.find(b=>b.key===lockedSel)?.mult??1.95):0);
              setPhase("result");
              if(won){startCoinRain();qc.invalidateQueries({queryKey:getGetBalanceQueryKey()});qc.invalidateQueries({queryKey:getGetMeQueryKey()});}
            },700);
          }
        }catch{}
      },600);
      setTimeout(()=>{if(pollTimer.current)clearInterval(pollTimer.current);},30000);
    }catch(e:any){
      setPhase("betting");setSpinning(false);
      toast({title:"Error",description:(e as any).message,variant:"destructive"});
    }
  }

  function collect(){setPhase("betting");setWin(0);setResultKey(null);setSelection(null);setBet(0);setSpinning(false);setReelSymbols(["福","財","天"]);}
  function addChip(a:number){if(phase!=="betting")return;setBet(b=>Math.min(b+a,balance));}

  const selBt=BET_TYPES.find(b=>b.key===selection);
  const resBt=BET_TYPES.find(b=>b.key===resultKey);
  const busy=phase==="spinning";

  return (
    <div className="gof-bg" style={{fontFamily:"'Segoe UI',system-ui,sans-serif",color:"#fff",position:"relative"}}>

      {/* Coin rain */}
      <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:50,overflow:"hidden"}}>
        {coins.map(c=>(
          <div key={c.id} style={{position:"absolute",top:"-30px",left:`${c.x}%`,fontSize:18,
            animation:`gof-coin-fall ${1.4+Math.random()*0.8}s ease-in forwards`}}>🪙</div>
        ))}
      </div>

      <div style={{position:"relative",zIndex:10,maxWidth:480,margin:"0 auto",paddingBottom:32}}>
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",
          background:"rgba(13,0,3,0.92)",borderBottom:"1px solid rgba(245,197,66,0.22)",backdropFilter:"blur(14px)"}}>
          <button onClick={()=>nav("/")} style={{background:"rgba(245,197,66,0.08)",border:"1px solid rgba(245,197,66,0.3)",
            borderRadius:10,padding:"7px 12px",color:"#f5c542",cursor:"pointer",
            display:"flex",alignItems:"center",gap:6,fontSize:14}}>
            <ArrowLeft size={16}/>Back
          </button>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <img src={`${BASE}god-of-fortune-logo.jpg`} alt="" style={{height:36,width:36,borderRadius:8,objectFit:"cover"}}
              onError={e=>(e.currentTarget.style.display="none")}/>
            <div style={{textAlign:"center"}}>
              <div className="gof-title-glow" style={{fontSize:15,fontWeight:900,letterSpacing:2,color:"#f5c542"}}>
                🐉 GOD OF FORTUNE
              </div>
              <div style={{fontSize:9,color:"rgba(245,197,66,0.5)",letterSpacing:2}}>神仙财神宫殿</div>
            </div>
          </div>
          <div style={{background:"rgba(245,197,66,0.08)",border:"1px solid rgba(245,197,66,0.25)",
            borderRadius:10,padding:"6px 12px",textAlign:"right"}}>
            <div style={{fontSize:9,color:"rgba(255,255,255,0.4)",letterSpacing:1}}>BALANCE</div>
            <div style={{fontSize:13,fontWeight:700,color:"#f5c542"}}>{formatCurrency(balance)}</div>
          </div>
        </div>

        {/* Ticker */}
        <div style={{background:"rgba(13,0,3,0.92)",borderBottom:"1px solid rgba(245,197,66,0.12)",
          overflow:"hidden",height:26,display:"flex",alignItems:"center"}}>
          <div style={{whiteSpace:"nowrap",fontSize:11,color:"rgba(245,197,66,0.7)",letterSpacing:0.5,
            animation:"gof-ticker 22s linear infinite"}}>{TICKER}{TICKER}</div>
        </div>

        <div style={{padding:"14px 12px 10px"}}>
          <div style={{textAlign:"center",marginBottom:10}}>
            <div style={{fontSize:10,letterSpacing:4,color:"rgba(245,197,66,0.5)",fontWeight:700}}>🏮 SHEN CAISHEN PALACE 🏮</div>
          </div>

          {/* ─── SHRINE / DRUM MACHINE ─── */}
          <div style={{
            background:"linear-gradient(180deg,#2a0008,#1a0006,#0d0003)",
            border:"2px solid rgba(245,197,66,0.4)",borderRadius:24,
            padding:"18px 14px",position:"relative",overflow:"hidden",
            animation:phase==="result"&&win>0?"gof-win-pulse 1.5s ease-in-out infinite":undefined,
          }}>
            {/* Dragon decorations */}
            <div style={{position:"absolute",top:8,left:10,fontSize:22,opacity:0.18,
              animation:"gof-dragon-f 3s ease-in-out infinite"}}>🐉</div>
            <div style={{position:"absolute",top:8,right:10,fontSize:22,opacity:0.18,
              animation:"gof-dragon-f 3.4s ease-in-out infinite",transform:"scaleX(-1)"}}>🐉</div>
            {/* Lanterns */}
            <div style={{position:"absolute",top:2,left:"25%",fontSize:16,opacity:0.3,
              animation:"gof-lantern 2.2s ease-in-out infinite",transformOrigin:"top center"}}>🏮</div>
            <div style={{position:"absolute",top:2,right:"25%",fontSize:16,opacity:0.3,
              animation:"gof-lantern 2.6s ease-in-out infinite",transformOrigin:"top center"}}>🏮</div>

            {/* Pagoda arch top */}
            <div style={{textAlign:"center",marginBottom:14,fontSize:11,letterSpacing:3,
              color:"rgba(245,197,66,0.5)",fontWeight:700}}>
              ═══ FORTUNE DRUMS ═══
            </div>

            {/* Three Drums */}
            <div style={{display:"flex",gap:10,justifyContent:"center",alignItems:"center",marginBottom:14}}>
              {reelSymbols.map((sym,i)=>(
                <ReelDrum key={i} symbol={sym} spinning={spinning} delay={i*0.15}
                  resultBt={resultKey?BET_TYPES.find(b=>b.key===resultKey):null}/>
              ))}
            </div>

            {/* Drum labels */}
            <div style={{display:"flex",gap:10,justifyContent:"center",marginBottom:14}}>
              {["HEAVEN","EARTH","HUMAN"].map((l,i)=>(
                <div key={i} style={{width:80,textAlign:"center",fontSize:8,letterSpacing:2,
                  color:"rgba(245,197,66,0.4)"}}>
                  {spinning?(["◎","◉","◎"][i]):l}
                </div>
              ))}
            </div>

            {/* Jackpot pool */}
            <div style={{
              background:"linear-gradient(90deg,rgba(245,197,66,0.05),rgba(245,197,66,0.15),rgba(245,197,66,0.05))",
              border:"1px solid rgba(245,197,66,0.3)",borderRadius:10,
              padding:"8px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",
            }}>
              <span style={{fontSize:10,letterSpacing:2,color:"rgba(245,197,66,0.65)"}}>🪙 SUPREME POT</span>
              <span style={{fontSize:16,fontWeight:900,color:"#f5c542",
                textShadow:"0 0 16px rgba(245,197,66,0.6)"}}>{formatCurrency(megaPool)}</span>
            </div>

            {/* Inline result panel */}
            {phase==="result"&&resultKey&&(()=>{
              const won=win>0;
              return (
                <div style={{marginTop:14,
                  background:won?resBt?.bg??"":`linear-gradient(135deg,#1a0006,#3d0010)`,
                  border:`2px solid ${won?resBt?.color??"#f5c542":"#7c3aed"}`,
                  borderRadius:16,padding:"18px 14px",textAlign:"center",
                  animation:"gof-burst 0.55s cubic-bezier(.34,1.56,.64,1) forwards",
                  boxShadow:`0 0 36px ${won?resBt?.glow??"rgba(245,197,66,0.5)":"rgba(124,58,237,0.3)"}`}}>
                  <div style={{fontSize:38,marginBottom:4}}>{won?"🏆":"🕯️"}</div>
                  <div style={{fontSize:17,fontWeight:900,letterSpacing:2,
                    color:won?resBt?.color??"#f5c542":"#c4b5fd",marginBottom:4}}>
                    {won?"CAISHEN BLESSES YOU!":"THE SHRINE IS SILENT"}
                  </div>
                  <div style={{fontSize:13,marginBottom:4}}>{resBt?.char}</div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",marginBottom:won?8:12}}>
                    Result: <strong style={{color:resBt?.color??""}}>{resBt?.label}</strong> · {resBt?.sub} · {resBt?.mult}×
                  </div>
                  {won&&<div style={{fontSize:30,fontWeight:900,color:"#f5c542",
                    textShadow:"0 0 20px rgba(245,197,66,0.7)",marginBottom:12}}>+{formatCurrency(win)}</div>}
                  <button onClick={collect} style={{padding:"11px 32px",borderRadius:12,border:"none",cursor:"pointer",
                    fontWeight:900,fontSize:14,letterSpacing:1,
                    background:won?`linear-gradient(90deg,${resBt?.dark},${resBt?.color})`:"linear-gradient(90deg,#7c3aed,#6d28d9)",
                    color:won&&resBt?.key==="supreme"?"#1a0006":"#fff"}}>
                    {won?"🪙 COLLECT FORTUNE":"🏮 PRAY AGAIN"}
                  </button>
                </div>
              );
            })()}
          </div>

          {/* Fortune bet cards */}
          <div style={{marginTop:14,display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
            {BET_TYPES.map(bt=>(
              <div key={bt.key} onClick={()=>{if(phase!=="betting")return;setSelection(bt.key);}}
                style={{background:selection===bt.key?bt.bg:"rgba(0,0,0,0.5)",
                  border:`2px solid ${selection===bt.key?bt.color:"rgba(245,197,66,0.1)"}`,
                  borderRadius:16,padding:"13px 6px 10px",textAlign:"center",cursor:"pointer",
                  transition:"all 0.25s",
                  boxShadow:selection===bt.key?`0 0 22px ${bt.glow}`:undefined,
                  animation:selection===bt.key?"gof-float 2.2s ease-in-out infinite":undefined}}>
                <div style={{fontSize:32,fontWeight:900,marginBottom:4,
                  color:selection===bt.key?bt.color:"rgba(245,197,66,0.5)",
                  textShadow:selection===bt.key?`0 0 12px ${bt.glow}`:undefined}}>{bt.char}</div>
                <div style={{fontSize:9,fontWeight:900,letterSpacing:2,
                  color:selection===bt.key?bt.color:"rgba(255,255,255,0.45)"}}>{bt.label}</div>
                <div style={{fontSize:9,color:"rgba(255,255,255,0.3)",marginBottom:4}}>{bt.pinyin}</div>
                <div style={{fontSize:18,fontWeight:900,
                  color:selection===bt.key?bt.color:"rgba(255,255,255,0.3)"}}>{bt.mult}×</div>
                <div style={{fontSize:8,color:"rgba(255,255,255,0.35)",marginTop:2}}>{bt.sub}</div>
              </div>
            ))}
          </div>

          {/* Chips */}
          <div style={{marginTop:14}}>
            <div style={{fontSize:9,letterSpacing:3,color:"rgba(245,197,66,0.35)",marginBottom:8,textAlign:"center"}}>PLACE YOUR OFFERING</div>
            <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap"}}>
              {CHIPS.map(c=>(
                <button key={c.amt} onClick={()=>addChip(c.amt)} disabled={busy} style={{
                  width:52,height:52,borderRadius:"50%",border:`3px solid ${c.color}`,cursor:"pointer",
                  background:`radial-gradient(circle at 35% 30%,${c.color}cc,${c.color}44)`,
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
            background:"rgba(0,0,0,0.5)",border:"1px solid rgba(245,197,66,0.1)",borderRadius:14,overflow:"hidden"}}>
            {[{label:"WIN",value:formatCurrency(win),color:win>0?"#f5c542":"rgba(255,255,255,0.3)"},
              {label:"BET",value:formatCurrency(bet),color:bet>0?"#f97316":"rgba(255,255,255,0.3)"},
              {label:"BALANCE",value:formatCurrency(balance),color:"rgba(255,255,255,0.5)"},
            ].map((item,i)=>(
              <div key={i} style={{padding:"10px 0",textAlign:"center",
                borderRight:i<2?"1px solid rgba(245,197,66,0.08)":undefined}}>
                <div style={{fontSize:8,letterSpacing:2,color:"rgba(255,255,255,0.3)",marginBottom:3}}>{item.label}</div>
                <div style={{fontSize:13,fontWeight:700,color:item.color}}>{item.value}</div>
              </div>
            ))}
          </div>

          {/* Invoke button */}
          {phase!=="result"&&(
            <button onClick={placeBet} disabled={busy||!selection||bet<=0}
              style={{marginTop:14,width:"100%",padding:"18px 0",borderRadius:18,border:"none",cursor:"pointer",
                fontSize:16,fontWeight:900,letterSpacing:2,
                background:busy?"linear-gradient(90deg,#7c2d12,#9a3412)":(!selection||bet<=0)?"rgba(255,255,255,0.05)":"linear-gradient(90deg,#9a3412,#dc2626,#f5c542,#dc2626,#9a3412)",
                backgroundSize:"200% 100%",
                color:(!selection||bet<=0)&&!busy?"rgba(255,255,255,0.25)":"#1a0006",
                boxShadow:(!busy&&selection&&bet>0)?"0 0 30px rgba(245,197,66,0.4),0 0 60px rgba(220,38,38,0.2)":undefined,
                animation:(!busy&&selection&&bet>0)?"gof-shimmer 2s linear infinite":undefined,
                opacity:(!selection||bet<=0)&&!busy?0.5:1}}>
              {busy?"🐉 SPIRITS ARE DECIDING...":"🏮 INVOKE FORTUNE 🏮"}
            </button>
          )}
          <div style={{marginTop:8,textAlign:"center",fontSize:11,color:"rgba(245,197,66,0.3)",letterSpacing:1}}>
            {!selection&&phase==="betting"&&"Choose your fortune path to begin"}
            {selection&&bet<=0&&phase==="betting"&&`${selBt?.char} ${selBt?.label} chosen — make your offering`}
            {selection&&bet>0&&phase==="betting"&&`${selBt?.mult}× reward if ${selBt?.label} ${selBt?.pinyin} blesses you`}
            {busy&&"🐉 The dragon is deciding your fate..."}
          </div>
        </div>
      </div>
    </div>
  );
}
