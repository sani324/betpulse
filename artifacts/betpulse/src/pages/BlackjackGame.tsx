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

type Selection = "player" | "dealer" | "tie";
type Phase = "betting" | "spinning" | "result";

const SUITS_RED = ["♥","♦"];
const SUITS_BLK = ["♠","♣"];

interface CardDef { rank:string; suit:string; color:string; }

const HAND_SETS: Record<Selection, { player:CardDef[]; dealer:CardDef[]; pTotal:number; dTotal:number }> = {
  player: {
    player: [{rank:"A",suit:"♠",color:"#111"},{rank:"K",suit:"♦",color:"#dc2626"}],
    dealer: [{rank:"7",suit:"♥",color:"#dc2626"},{rank:"9",suit:"♣",color:"#111"}],
    pTotal:21, dTotal:16,
  },
  dealer: {
    player: [{rank:"6",suit:"♣",color:"#111"},{rank:"8",suit:"♦",color:"#dc2626"}],
    dealer: [{rank:"A",suit:"♥",color:"#dc2626"},{rank:"J",suit:"♠",color:"#111"}],
    pTotal:14, dTotal:21,
  },
  tie: {
    player: [{rank:"9",suit:"♠",color:"#111"},{rank:"8",suit:"♦",color:"#dc2626"}],
    dealer: [{rank:"9",suit:"♣",color:"#111"},{rank:"8",suit:"♥",color:"#dc2626"}],
    pTotal:17, dTotal:17,
  },
};

const SPIN_RANKS = ["2","5","7","9","Q","K","3","J","6","4","8","10","A"];
const SPIN_SUITS_COLOR: Array<[string,string]> = [["♠","#111"],["♥","#dc2626"],["♣","#111"],["♦","#dc2626"]];

const BET_TYPES = [
  { key:"player" as Selection, icon:"🃏", label:"PLAYER WINS", mult:1.95, color:"#22c55e", dark:"#14532d", glow:"rgba(34,197,94,0.6)", bg:"linear-gradient(145deg,#052a0e,#14532d)" },
  { key:"dealer" as Selection, icon:"🏦", label:"DEALER WINS", mult:1.95, color:"#f97316", dark:"#7c2d12", glow:"rgba(249,115,22,0.6)", bg:"linear-gradient(145deg,#1c0800,#7c2d12)" },
  { key:"tie"    as Selection, icon:"💎", label:"PERFECT TIE",  mult:8,    color:"#f5c542", dark:"#78350f", glow:"rgba(245,197,66,0.7)", bg:"linear-gradient(145deg,#1c1000,#854d0e)" },
];

const CHIPS = [
  {amt:100,  color:"#22c55e"},{amt:500,  color:"#3b82f6"},
  {amt:1000, color:"#a855f7"},{amt:5000, color:"#f97316"},{amt:10000,color:"#f5c542"},
];

const TICKER = "♠ ROYAL BLACKJACK TABLE  •  🃏 PLAYER WINS: 1.95×  •  🏦 DEALER WINS: 1.95×  •  💎 PERFECT TIE: 8×  •  ♣ HIT OR STAND  •  ♥ BEAT THE DEALER  •  ♦ FEEL THE RUSH  •  ";

const STYLES = `
  .bj-bg {
    background: radial-gradient(ellipse at 50% 0%,#073d18 0%,#041a0a 50%,#020d05 100%);
    min-height:100dvh;
  }
  .bj-bg::before {
    content:'';position:fixed;inset:0;pointer-events:none;
    background:
      repeating-linear-gradient(45deg,rgba(245,197,66,0.018) 0,rgba(245,197,66,0.018) 1px,transparent 1px,transparent 32px),
      repeating-linear-gradient(-45deg,rgba(245,197,66,0.018) 0,rgba(245,197,66,0.018) 1px,transparent 1px,transparent 32px);
    z-index:0;
  }
  @keyframes bj-ticker  {0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
  @keyframes bj-flip    {0%{transform:scaleX(1)}40%{transform:scaleX(0)}100%{transform:scaleX(1)}}
  @keyframes bj-dealin  {0%{transform:translateY(-50px) rotate(-10deg);opacity:0}100%{transform:translateY(0) rotate(0deg);opacity:1}}
  @keyframes bj-glow-tbl{0%,100%{box-shadow:0 0 30px rgba(34,197,94,0.15),0 0 80px rgba(245,197,66,0.05)}50%{box-shadow:0 0 50px rgba(34,197,94,0.25),0 0 120px rgba(245,197,66,0.1)}}
  @keyframes bj-burst   {0%{transform:scale(0.15);opacity:0}60%{transform:scale(1.08)}80%{transform:scale(0.96)}100%{transform:scale(1);opacity:1}}
  @keyframes bj-shimmer {0%{background-position:-300% 0}100%{background-position:300% 0}}
  @keyframes bj-float-chip{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
  @keyframes bj-card-pop {0%{transform:scale(0.5) rotate(-20deg);opacity:0}70%{transform:scale(1.08) rotate(2deg)}100%{transform:scale(1) rotate(0);opacity:1}}
  @keyframes bj-spin-rank{0%{transform:translateY(0)}100%{transform:translateY(-800%)}}
  @keyframes bj-confetti {0%{transform:translateY(-10px) rotate(0);opacity:1}100%{transform:translateY(260px) rotate(540deg);opacity:0}}
  .bj-table-glow{animation:bj-glow-tbl 3s ease-in-out infinite;}
  .bj-title-text{background:linear-gradient(90deg,#f5c542,#fff8cc,#f5c542);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
`;

function PlayCard({ rank, suit, color, faceDown, highlight, spinning, delay=0 }:{
  rank:string;suit:string;color:string;faceDown?:boolean;highlight?:boolean;spinning?:boolean;delay?:number;
}) {
  const [spinRank, setSpinRank] = useState(rank);
  const [spinSuit, setSpinSuit] = useState(suit);
  const [spinColor, setSpinColor] = useState(color);
  const timerRef = useRef<any>(null);

  useEffect(()=>{
    if(!spinning){ setSpinRank(rank);setSpinSuit(suit);setSpinColor(color); return; }
    let idx=0;
    timerRef.current=setInterval(()=>{
      idx++;
      const r=SPIN_RANKS[idx%SPIN_RANKS.length];
      const [s,c]=SPIN_SUITS_COLOR[idx%SPIN_SUITS_COLOR.length];
      setSpinRank(r);setSpinSuit(s);setSpinColor(c);
    },90);
    return ()=>clearInterval(timerRef.current);
  },[spinning,rank,suit,color]);

  if(faceDown) return (
    <div style={{
      width:62,height:90,borderRadius:10,
      background:"linear-gradient(135deg,#0a3d1f,#052810)",
      border:"2px solid rgba(245,197,66,0.45)",
      boxShadow:"3px 5px 15px rgba(0,0,0,0.65)",
      display:"flex",alignItems:"center",justifyContent:"center",
      animation:`bj-dealin 0.4s ${delay}s cubic-bezier(.34,1.56,.64,1) both`,
    }}>
      <div style={{fontSize:28,opacity:0.35,color:"#f5c542"}}>♣</div>
    </div>
  );

  return (
    <div style={{
      width:62,height:90,borderRadius:10,
      background:"linear-gradient(155deg,#ffffff,#f0f0f0)",
      border:`2px solid ${highlight?"#f5c542":"rgba(0,0,0,0.1)"}`,
      boxShadow:highlight?"3px 5px 15px rgba(0,0,0,0.45),0 0 24px rgba(245,197,66,0.5)":"3px 5px 15px rgba(0,0,0,0.45)",
      position:"relative",
      animation:`bj-card-pop 0.5s ${delay}s cubic-bezier(.34,1.56,.64,1) both`,
    }}>
      <div style={{position:"absolute",top:5,left:7,fontSize:12,fontWeight:900,color:spinColor,lineHeight:1.1}}>
        {spinRank}<br/>{spinSuit}
      </div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",fontSize:26,color:spinColor}}>
        {spinSuit}
      </div>
      <div style={{position:"absolute",bottom:5,right:7,fontSize:12,fontWeight:900,color:spinColor,lineHeight:1.1,transform:"rotate(180deg)"}}>
        {spinRank}<br/>{spinSuit}
      </div>
    </div>
  );
}

function ScoreTag({n,highlight,label}:{n:number;highlight:boolean;label:string}){
  return (
    <div style={{
      display:"flex",alignItems:"center",gap:6,
      background:highlight?"rgba(245,197,66,0.15)":"rgba(0,0,0,0.5)",
      border:`1px solid ${highlight?"rgba(245,197,66,0.5)":"rgba(255,255,255,0.1)"}`,
      borderRadius:8,padding:"4px 10px",
    }}>
      <span style={{fontSize:10,color:"rgba(255,255,255,0.45)"}}>{label}</span>
      <span style={{fontSize:16,fontWeight:900,color:highlight?"#f5c542":"#fff"}}>{n}</span>
    </div>
  );
}

export default function BlackjackGame(){
  const [,nav]=useLocation();
  const {user}=useAuth();
  const qc=useQueryClient();
  const {toast}=useToast();

  const [phase,setPhase]=useState<Phase>("betting");
  const [selection,setSelection]=useState<Selection|null>(null);
  const [bet,setBet]=useState(0);
  const [win,setWin]=useState(0);
  const [resultKey,setResultKey]=useState<Selection|null>(null);
  const [displayCards,setDisplayCards]=useState<{player:CardDef[];dealer:CardDef[];pTotal:number;dTotal:number}|null>(null);
  const [spinning,setSpinning]=useState(false);
  const [confetti,setConfetti]=useState<{x:number;icon:string;id:number}[]>([]);

  const pollTimer=useRef<any>(null);
  const balance=(user as any)?.balance??0;

  useEffect(()=>{
    const s=document.createElement("style");s.textContent=STYLES;document.head.appendChild(s);
    return ()=>{try{document.head.removeChild(s)}catch{}};
  },[]);
  useEffect(()=>()=>{if(pollTimer.current)clearInterval(pollTimer.current)},[]);

  function startConfetti(){
    const icons=["💰","⭐","🃏","♠","♣","♥","♦","💎"];
    const items=Array.from({length:18},(_,i)=>({x:Math.random()*88,icon:icons[i%icons.length],id:i}));
    setConfetti(items);
    setTimeout(()=>setConfetti([]),2500);
  }

  async function placeBet(){
    if(!selection||bet<=0||phase!=="betting")return;
    const lockedSel=selection,lockedBet=bet;
    setPhase("spinning");setSpinning(true);setDisplayCards(null);

    try{
      const r=await fetch(`${API}/api/games/blackjack`,{
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
          const pr=await fetch(`${API}/api/games/casino-round/blackjack/${roundId}`,{credentials:"include"});
          if(!pr.ok)return;
          const data=await pr.json();
          if(data.status==="settled"){
            clearInterval(pollTimer.current);
            const serverResult=(data.result??"").trim().toLowerCase() as Selection;
            const handSet=HAND_SETS[serverResult]??HAND_SETS.player;
            setSpinning(false);
            setTimeout(()=>{
              setDisplayCards(handSet);
              setTimeout(()=>{
                const won=serverResult===lockedSel;
                setResultKey(serverResult);
                setWin(won?lockedBet*(BET_TYPES.find(b=>b.key===lockedSel)?.mult??1.95):0);
                setPhase("result");
                if(won){startConfetti();qc.invalidateQueries({queryKey:getGetBalanceQueryKey()});qc.invalidateQueries({queryKey:getGetMeQueryKey()});}
              },800);
            },300);
          }
        }catch{}
      },600);
      setTimeout(()=>{if(pollTimer.current)clearInterval(pollTimer.current)},30000);
    }catch(e:any){
      setPhase("betting");setSpinning(false);
      toast({title:"Error",description:e.message,variant:"destructive"});
    }
  }

  function collect(){setPhase("betting");setWin(0);setResultKey(null);setSelection(null);setBet(0);setDisplayCards(null);setSpinning(false);}
  function addChip(a:number){if(phase!=="betting")return;setBet(b=>Math.min(b+a,balance));}

  const selBt=BET_TYPES.find(b=>b.key===selection);
  const resBt=BET_TYPES.find(b=>b.key===resultKey);
  const busy=phase==="spinning";

  // Which cards to show
  const showHands = displayCards ?? (selection ? HAND_SETS[selection] : null);
  const pWin = resultKey==="player";
  const dWin = resultKey==="dealer";
  const isTie = resultKey==="tie";

  return (
    <div className="bj-bg" style={{fontFamily:"'Segoe UI',system-ui,sans-serif",color:"#fff",position:"relative"}}>

      {/* Confetti */}
      <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:50,overflow:"hidden"}}>
        {confetti.map(c=>(
          <div key={c.id} style={{position:"absolute",top:"-20px",left:`${c.x}%`,fontSize:18,
            animation:`bj-confetti ${1.5+Math.random()*0.8}s ease-in forwards`}}>{c.icon}</div>
        ))}
      </div>

      <div style={{position:"relative",zIndex:10,maxWidth:480,margin:"0 auto",paddingBottom:32}}>
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",
          background:"rgba(2,13,5,0.9)",borderBottom:"1px solid rgba(245,197,66,0.2)",backdropFilter:"blur(14px)"}}>
          <button onClick={()=>nav("/")} style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",
            borderRadius:10,padding:"7px 12px",color:"rgba(255,255,255,0.7)",cursor:"pointer",
            display:"flex",alignItems:"center",gap:6,fontSize:14}}>
            <ArrowLeft size={16}/>Back
          </button>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <img src={`${BASE}blackjack-logo.jpg`} alt="" style={{height:36,width:36,borderRadius:8,objectFit:"cover"}}
              onError={e=>(e.currentTarget.style.display="none")}/>
            <div style={{textAlign:"center"}}>
              <div className="bj-title-text" style={{fontSize:16,fontWeight:900,letterSpacing:2}}>♠ BLACKJACK ♠</div>
              <div style={{fontSize:9,color:"rgba(245,197,66,0.5)",letterSpacing:2}}>ROYAL TABLE</div>
            </div>
          </div>
          <div style={{background:"rgba(245,197,66,0.1)",border:"1px solid rgba(245,197,66,0.25)",
            borderRadius:10,padding:"6px 12px",textAlign:"right"}}>
            <div style={{fontSize:9,color:"rgba(255,255,255,0.4)",letterSpacing:1}}>BALANCE</div>
            <div style={{fontSize:13,fontWeight:700,color:"#f5c542"}}>{formatCurrency(balance)}</div>
          </div>
        </div>

        {/* Ticker */}
        <div style={{background:"rgba(4,26,10,0.9)",borderBottom:"1px solid rgba(245,197,66,0.12)",
          overflow:"hidden",height:26,display:"flex",alignItems:"center"}}>
          <div style={{whiteSpace:"nowrap",fontSize:11,color:"rgba(245,197,66,0.65)",letterSpacing:0.5,
            animation:"bj-ticker 22s linear infinite"}}>{TICKER}{TICKER}</div>
        </div>

        <div style={{padding:"14px 12px 10px"}}>
          <div style={{textAlign:"center",marginBottom:10}}>
            <div style={{fontSize:10,letterSpacing:4,color:"rgba(245,197,66,0.6)",fontWeight:700}}>♥ ROYAL BLACKJACK TABLE ♦</div>
          </div>

          {/* ─── CARD TABLE ─── */}
          <div className="bj-table-glow" style={{
            background:"radial-gradient(ellipse at 50% 40%,#0f5a28 0%,#073d18 50%,#041a0a 100%)",
            border:"2px solid rgba(245,197,66,0.3)",
            borderRadius:22,padding:"18px 14px",position:"relative",overflow:"hidden",
          }}>
            {/* Felt texture rings */}
            <div style={{position:"absolute",inset:0,borderRadius:22,
              background:"radial-gradient(ellipse 90% 70% at 50% 50%,rgba(255,255,255,0.025) 0%,transparent 70%)",
              pointerEvents:"none"}}/>
            {/* Gold corner suits */}
            {["♠","♥","♣","♦"].map((s,i)=>(
              <div key={i} style={{position:"absolute",fontSize:14,opacity:0.12,color:"#f5c542",
                top:i<2?8:"auto",bottom:i>=2?8:"auto",
                left:i%2===0?10:"auto",right:i%2===1?10:"auto"}}>{s}</div>
            ))}

            <div style={{position:"relative",zIndex:2}}>
              {/* DEALER section */}
              <div style={{marginBottom:14}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                  <div style={{fontSize:10,letterSpacing:3,color:"rgba(255,255,255,0.4)",fontWeight:700}}>DEALER</div>
                  {showHands&&<ScoreTag n={showHands.dTotal} highlight={dWin||isTie} label="TOTAL"/>}
                </div>
                <div style={{display:"flex",gap:10,justifyContent:"center"}}>
                  {showHands ? (
                    showHands.dealer.map((c,i)=>(
                      <PlayCard key={i} rank={c.rank} suit={c.suit} color={c.color}
                        highlight={(dWin||isTie)&&phase==="result"} spinning={spinning} delay={i*0.12}/>
                    ))
                  ):(
                    [0,1].map(i=><PlayCard key={i} rank="?" suit="♣" color="#111" faceDown spinning={spinning} delay={i*0.12}/>)
                  )}
                </div>
              </div>

              {/* VS divider */}
              <div style={{display:"flex",alignItems:"center",gap:8,margin:"8px 0"}}>
                <div style={{flex:1,height:1,background:"rgba(245,197,66,0.15)"}}/>
                <div style={{fontSize:11,fontWeight:900,color:"rgba(245,197,66,0.5)",letterSpacing:2}}>VS</div>
                <div style={{flex:1,height:1,background:"rgba(245,197,66,0.15)"}}/>
              </div>

              {/* PLAYER section */}
              <div style={{marginTop:14}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                  <div style={{fontSize:10,letterSpacing:3,color:"rgba(255,255,255,0.4)",fontWeight:700}}>PLAYER</div>
                  {showHands&&<ScoreTag n={showHands.pTotal} highlight={pWin||isTie} label="TOTAL"/>}
                </div>
                <div style={{display:"flex",gap:10,justifyContent:"center"}}>
                  {showHands ? (
                    showHands.player.map((c,i)=>(
                      <PlayCard key={i} rank={c.rank} suit={c.suit} color={c.color}
                        highlight={(pWin||isTie)&&phase==="result"} spinning={spinning} delay={i*0.12+0.1}/>
                    ))
                  ):(
                    [0,1].map(i=><PlayCard key={i} rank="?" suit="♠" color="#111" faceDown spinning={spinning} delay={i*0.12+0.1}/>)
                  )}
                </div>
              </div>

              {/* Inline result panel */}
              {phase==="result"&&resultKey&&(()=>{
                const won=win>0;
                return (
                  <div style={{marginTop:14,
                    background:won?"linear-gradient(135deg,#052a0e,#166534,#15803d)":"linear-gradient(135deg,#1a0505,#7f1d1d)",
                    border:`2px solid ${won?"#4ade80":"#ef4444"}`,borderRadius:16,padding:"16px 14px",
                    textAlign:"center",animation:"bj-burst 0.5s cubic-bezier(.34,1.56,.64,1) forwards",
                    boxShadow:`0 0 30px ${won?"rgba(74,222,128,0.35)":"rgba(239,68,68,0.3)"}`}}>
                    <div style={{fontSize:36,marginBottom:4}}>{isTie?"🤝":won?"🏆":"😔"}</div>
                    <div style={{fontSize:16,fontWeight:900,letterSpacing:2,
                      color:won?"#4ade80":"#fca5a5",marginBottom:4}}>
                      {isTie&&won?"TIE JACKPOT!":won?"YOU WIN!":"DEALER WINS"}
                    </div>
                    <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",marginBottom:won?8:12}}>
                      Result: <strong style={{color:resBt?.color??""}}>{resBt?.label}</strong> · {resBt?.mult}×
                    </div>
                    {won&&<div style={{fontSize:28,fontWeight:900,color:"#f5c542",
                      textShadow:"0 0 16px rgba(245,197,66,0.6)",marginBottom:12}}>+{formatCurrency(win)}</div>}
                    <button onClick={collect} style={{padding:"10px 28px",borderRadius:12,border:"none",cursor:"pointer",
                      fontWeight:900,fontSize:14,
                      background:won?"linear-gradient(90deg,#16a34a,#22c55e)":"linear-gradient(90deg,#b91c1c,#dc2626)",
                      color:"#fff"}}>
                      {won?"🃏 COLLECT CHIPS":"🔄 DEAL AGAIN"}
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Bet type cards */}
          <div style={{marginTop:14,display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
            {BET_TYPES.map(bt=>(
              <div key={bt.key} onClick={()=>{if(phase!=="betting")return;setSelection(bt.key);}}
                style={{background:selection===bt.key?bt.bg:"rgba(0,0,0,0.45)",
                  border:`2px solid ${selection===bt.key?bt.color:"rgba(255,255,255,0.09)"}`,
                  borderRadius:16,padding:"13px 6px",textAlign:"center",cursor:"pointer",transition:"all 0.25s",
                  boxShadow:selection===bt.key?`0 0 20px ${bt.glow}`:undefined}}>
                <div style={{fontSize:26,marginBottom:3}}>{bt.icon}</div>
                <div style={{fontSize:9,fontWeight:900,letterSpacing:2,
                  color:selection===bt.key?bt.color:"rgba(255,255,255,0.5)"}}>{bt.label}</div>
                <div style={{fontSize:18,fontWeight:900,marginTop:4,
                  color:selection===bt.key?bt.color:"rgba(255,255,255,0.3)"}}>{bt.mult}×</div>
              </div>
            ))}
          </div>

          {/* Chip tray */}
          <div style={{marginTop:14}}>
            <div style={{fontSize:9,letterSpacing:3,color:"rgba(255,255,255,0.3)",marginBottom:8,textAlign:"center"}}>PLACE YOUR CHIPS</div>
            <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap"}}>
              {CHIPS.map(c=>(
                <button key={c.amt} onClick={()=>addChip(c.amt)} disabled={busy} style={{
                  width:52,height:52,borderRadius:"50%",border:`3px solid ${c.color}`,cursor:"pointer",
                  background:`radial-gradient(circle at 35% 30%,${c.color}cc,${c.color}55)`,
                  color:"#fff",fontSize:10,fontWeight:900,
                  boxShadow:`0 4px 12px ${c.color}44`,opacity:busy?0.5:1,
                  animation:selection&&!busy?`bj-float-chip ${2+c.amt%3*0.5}s ease-in-out infinite`:undefined,
                }}>
                  {c.amt>=1000?`${c.amt/1000}K`:c.amt}
                </button>
              ))}
            </div>
          </div>

          {/* Info bar */}
          <div style={{marginTop:14,display:"grid",gridTemplateColumns:"repeat(3,1fr)",
            background:"rgba(0,0,0,0.5)",border:"1px solid rgba(245,197,66,0.1)",borderRadius:14,overflow:"hidden"}}>
            {[{label:"WIN",value:formatCurrency(win),color:win>0?"#4ade80":"rgba(255,255,255,0.3)"},
              {label:"BET",value:formatCurrency(bet),color:bet>0?"#f5c542":"rgba(255,255,255,0.3)"},
              {label:"BALANCE",value:formatCurrency(balance),color:"rgba(255,255,255,0.5)"}
            ].map((item,i)=>(
              <div key={i} style={{padding:"10px 0",textAlign:"center",
                borderRight:i<2?"1px solid rgba(245,197,66,0.08)":undefined}}>
                <div style={{fontSize:8,letterSpacing:2,color:"rgba(255,255,255,0.3)",marginBottom:3}}>{item.label}</div>
                <div style={{fontSize:13,fontWeight:700,color:item.color}}>{item.value}</div>
              </div>
            ))}
          </div>

          {/* Deal button */}
          {phase!=="result"&&(
            <button onClick={placeBet} disabled={busy||!selection||bet<=0}
              style={{marginTop:14,width:"100%",padding:"17px 0",borderRadius:18,border:"none",cursor:"pointer",
                fontSize:16,fontWeight:900,letterSpacing:2,
                background:busy?"linear-gradient(90deg,#14532d,#166534)":(!selection||bet<=0)?"rgba(255,255,255,0.06)":"linear-gradient(90deg,#15803d,#16a34a,#22c55e,#16a34a,#15803d)",
                backgroundSize:"200% 100%",
                color:(!selection||bet<=0)&&!busy?"rgba(255,255,255,0.25)":"#fff",
                boxShadow:(!busy&&selection&&bet>0)?"0 0 28px rgba(34,197,94,0.45)":undefined,
                animation:(!busy&&selection&&bet>0)?"bj-shimmer 2.2s linear infinite":undefined,
                opacity:(!selection||bet<=0)&&!busy?0.5:1}}>
              {busy?"🃏 SHUFFLING CARDS...":"♠ DEAL CARDS ♠"}
            </button>
          )}
          <div style={{marginTop:8,textAlign:"center",fontSize:11,color:"rgba(255,255,255,0.25)",letterSpacing:1}}>
            {!selection&&phase==="betting"&&"Pick Player • Dealer • Tie to start"}
            {selection&&bet<=0&&phase==="betting"&&`${selBt?.icon} ${selBt?.label} selected — add chips`}
            {selection&&bet>0&&phase==="betting"&&`${selBt?.mult}× payout if ${selBt?.label}!`}
            {busy&&"🃏 Cards are being dealt..."}
          </div>
        </div>
      </div>
    </div>
  );
}
