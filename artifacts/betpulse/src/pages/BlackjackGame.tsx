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

type Selection = "player" | "dealer" | "tie";
type Phase = "betting" | "dealing" | "result";

interface CardDef { rank: string; suit: string; }

const RED_SUITS = new Set(["♥","♦"]);

const HAND_PRESETS: Record<Selection,{dealer:CardDef[];player:CardDef[];dt:number;pt:number}> = {
  player: { dealer:[{rank:"7",suit:"♣"},{rank:"9",suit:"♦"}], player:[{rank:"A",suit:"♠"},{rank:"K",suit:"♥"}], dt:16, pt:21 },
  dealer: { dealer:[{rank:"A",suit:"♦"},{rank:"J",suit:"♣"}], player:[{rank:"5",suit:"♠"},{rank:"9",suit:"♥"}], dt:21, pt:14 },
  tie:    { dealer:[{rank:"9",suit:"♣"},{rank:"8",suit:"♥"}], player:[{rank:"9",suit:"♠"},{rank:"8",suit:"♦"}], dt:17, pt:17 },
};

const RANKS_POOL = ["A","K","Q","J","10","9","8","7","6","5"];
const SUITS_POOL: Array<[string,boolean]> = [["♠",false],["♥",true],["♦",true],["♣",false]];

const BET_OPTIONS = [
  { key:"player" as Selection, label:"PLAYER", icon:"👤", mult:1.95, color:"#22c55e", dark:"#052a0e", border:"rgba(34,197,94,0.55)", glow:"rgba(34,197,94,0.45)" },
  { key:"dealer" as Selection, label:"DEALER", icon:"🏦", mult:1.95, color:"#f97316", dark:"#1c0800", border:"rgba(249,115,22,0.55)", glow:"rgba(249,115,22,0.45)" },
  { key:"tie"    as Selection, label:"TIE",    icon:"🤝", mult:8,    color:"#f5c542", dark:"#1c1000", border:"rgba(245,197,66,0.6)",  glow:"rgba(245,197,66,0.55)" },
];

const CHIPS = [{v:100,c:"#22c55e"},{v:500,c:"#3b82f6"},{v:1000,c:"#a855f7"},{v:5000,c:"#f97316"},{v:10000,c:"#f5c542"}];

const TICKER = "♠ ROYAL BLACKJACK  •  🎯 PLAYER WINS: 1.95×  •  🏦 DEALER WINS: 1.95×  •  💎 TIE: 8×  •  ♣ 21 WINS  •  ♥ BEAT THE HOUSE  •  ♦ PLACE YOUR BET  •  ";

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&display=swap');

  .bj2-root {
    background: radial-gradient(ellipse at 50% -20%, #0a3d18 0%, #041508 45%, #020c05 100%);
    min-height: 100dvh;
    font-family: 'Segoe UI', system-ui, sans-serif;
    color: #fff;
  }
  .bj2-root::before {
    content: '';
    position: fixed;
    inset: 0;
    pointer-events: none;
    background:
      radial-gradient(ellipse 70% 40% at 50% 0%, rgba(34,197,94,0.05) 0%, transparent 60%),
      repeating-linear-gradient(45deg, rgba(245,197,66,0.012) 0px, rgba(245,197,66,0.012) 1px, transparent 1px, transparent 38px),
      repeating-linear-gradient(-45deg, rgba(245,197,66,0.012) 0px, rgba(245,197,66,0.012) 1px, transparent 1px, transparent 38px);
    z-index: 0;
  }

  @keyframes bj2-ticker   { from{transform:translateX(0)} to{transform:translateX(-50%)} }
  @keyframes bj2-dealtop  { from{transform:translateX(40px) translateY(-30px) rotate(8deg);opacity:0} to{transform:none;opacity:1} }
  @keyframes bj2-dealbot  { from{transform:translateX(-40px) translateY(30px) rotate(-8deg);opacity:0} to{transform:none;opacity:1} }
  @keyframes bj2-facedown { from{transform:scale(0.6) rotate(-12deg);opacity:0} to{transform:none;opacity:1} }
  @keyframes bj2-felt-gl  { 0%,100%{box-shadow:0 0 40px rgba(34,197,94,0.12), 0 0 80px rgba(245,197,66,0.04)} 50%{box-shadow:0 0 60px rgba(34,197,94,0.2),0 0 120px rgba(245,197,66,0.08)} }
  @keyframes bj2-burst    { 0%{transform:scale(0.05);opacity:0} 55%{transform:scale(1.06)} 80%{transform:scale(0.97)} 100%{transform:scale(1);opacity:1} }
  @keyframes bj2-shimmer  { 0%{background-position:-300% 0} 100%{background-position:300% 0} }
  @keyframes bj2-win-glow { 0%,100%{box-shadow:0 0 0 3px rgba(245,197,66,0.3)} 50%{box-shadow:0 0 0 6px rgba(245,197,66,0.6),0 0 24px rgba(245,197,66,0.3)} }
  @keyframes bj2-confetti { 0%{transform:translateY(-10px) rotate(0);opacity:1} 100%{transform:translateY(300px) rotate(600deg);opacity:0} }
  @keyframes bj2-chip-hover{0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-5px) scale(1.06)} }
  @keyframes bj2-card-spin { 0%,100%{transform:scaleX(1)} 45%{transform:scaleX(0)} }

  .bj2-table { animation: bj2-felt-gl 3.5s ease-in-out infinite; }
  .bj2-win-card { animation: bj2-win-glow 1s ease-in-out infinite; }
`;

// ─── Card SVG ─────────────────────────────────────────────────────────────────
function PlayingCard({ rank, suit, faceDown, dealAnim="top", delay=0, winner=false, spinning=false }:{
  rank:string; suit:string; faceDown?:boolean; dealAnim?:"top"|"bot"; delay?:number; winner?:boolean; spinning?:boolean;
}) {
  const isRed = RED_SUITS.has(suit);
  const clr = isRed ? "#dc2626" : "#111";

  const [spinRank,setSpinRank] = useState(rank);
  const [spinSuit,setSpinSuit] = useState(suit);
  const timerRef = useRef<any>(null);
  useEffect(()=>{
    if(!spinning){setSpinRank(rank);setSpinSuit(suit);return;}
    let i=0;
    timerRef.current=setInterval(()=>{
      i++;
      const [s,] = SUITS_POOL[i%4];
      setSpinRank(RANKS_POOL[i%RANKS_POOL.length]);
      setSpinSuit(s);
    },80);
    return ()=>clearInterval(timerRef.current);
  },[spinning,rank,suit]);

  const displayRank = spinning ? spinRank : rank;
  const displaySuit = spinning ? spinSuit : suit;
  const displayRed  = RED_SUITS.has(displaySuit);
  const displayClr  = displayRed ? "#dc2626" : "#111";

  if (faceDown) return (
    <div style={{
      width:66,height:92,borderRadius:10,
      background:"linear-gradient(145deg,#0d4a22,#062810)",
      border:"2px solid rgba(245,197,66,0.4)",
      boxShadow:"4px 6px 18px rgba(0,0,0,0.7)",
      display:"flex",alignItems:"center",justifyContent:"center",
      animation:`bj2-facedown 0.4s ${delay}s both`,
      position:"relative",overflow:"hidden",
    }}>
      <div style={{
        position:"absolute",inset:5,borderRadius:6,
        background:"repeating-linear-gradient(45deg,rgba(245,197,66,0.05) 0,rgba(245,197,66,0.05) 2px,transparent 2px,transparent 10px)",
        border:"1px solid rgba(245,197,66,0.2)",
      }}/>
      <span style={{fontSize:26,opacity:0.25,color:"#f5c542"}}>♦</span>
    </div>
  );

  return (
    <div className={winner?"bj2-win-card":""} style={{
      width:66,height:92,borderRadius:10,
      background:"linear-gradient(160deg,#ffffff,#f4f4f4)",
      border:`2px solid ${winner?"rgba(245,197,66,0.8)":"rgba(0,0,0,0.08)"}`,
      boxShadow:winner?"4px 6px 18px rgba(0,0,0,0.5),0 0 20px rgba(245,197,66,0.4)":"4px 6px 18px rgba(0,0,0,0.5)",
      position:"relative",
      animation:`${dealAnim==="top"?"bj2-dealtop":"bj2-dealbot"} 0.5s ${delay}s cubic-bezier(.34,1.56,.64,1) both`,
      overflow:"hidden",
    }}>
      {/* Top-left */}
      <div style={{position:"absolute",top:5,left:6,lineHeight:1.1}}>
        <div style={{fontSize:13,fontWeight:900,color:displayClr,fontFamily:"serif"}}>{displayRank}</div>
        <div style={{fontSize:11,color:displayClr}}>{displaySuit}</div>
      </div>
      {/* Center suit */}
      <div style={{
        position:"absolute",inset:0,
        display:"flex",alignItems:"center",justifyContent:"center",
        fontSize: displayRank==="10"||displayRank==="J"||displayRank==="Q"||displayRank==="K"||displayRank==="A" ? 28 : 30,
        color:displayClr,
        animation:spinning?"bj2-card-spin 0.3s linear infinite":undefined,
      }}>{displaySuit}</div>
      {/* Bottom-right (inverted) */}
      <div style={{position:"absolute",bottom:5,right:6,lineHeight:1.1,transform:"rotate(180deg)"}}>
        <div style={{fontSize:13,fontWeight:900,color:displayClr,fontFamily:"serif"}}>{displayRank}</div>
        <div style={{fontSize:11,color:displayClr}}>{displaySuit}</div>
      </div>
      {/* Sheen */}
      <div style={{position:"absolute",inset:0,background:"linear-gradient(130deg,rgba(255,255,255,0.7) 0%,transparent 55%)",pointerEvents:"none"}}/>
    </div>
  );
}

function ScoreBadge({n,side,highlight}:{n:number;side:"player"|"dealer";highlight:boolean}){
  return (
    <div style={{
      background:highlight?"rgba(245,197,66,0.18)":"rgba(0,0,0,0.55)",
      border:`1.5px solid ${highlight?"rgba(245,197,66,0.6)":"rgba(255,255,255,0.1)"}`,
      borderRadius:20,padding:"3px 12px",
      fontSize:13,fontWeight:900,
      color:highlight?"#f5c542":"rgba(255,255,255,0.5)",
      boxShadow:highlight?"0 0 14px rgba(245,197,66,0.3)":undefined,
      transition:"all 0.4s",
    }}>
      {n === 21 && side==="player" ? "✨ 21" : n === 21 ? "♠ 21" : n}
    </div>
  );
}

export default function BlackjackGame() {
  const [,nav] = useLocation();
  const {user} = useAuth();
  const qc = useQueryClient();
  const {toast} = useToast();

  const [phase,setPhase]       = useState<Phase>("betting");
  const [selection,setSel]     = useState<Selection|null>(null);
  const [bet,setBet]           = useState(0);
  const [win,setWin]           = useState(0);
  const [resultKey,setRes]     = useState<Selection|null>(null);
  const [hands,setHands]       = useState<typeof HAND_PRESETS[Selection]|null>(null);
  const [spinning,setSpinning] = useState(false);
  const [confetti,setConf]     = useState<{x:number;id:number;icon:string}[]>([]);

  const pollRef = useRef<any>(null);
  const balance = (user as any)?.balance ?? 0;

  useEffect(()=>{
    const s=document.createElement("style");s.textContent=STYLES;document.head.appendChild(s);
    return()=>{try{document.head.removeChild(s)}catch{}};
  },[]);
  useEffect(()=>()=>{if(pollRef.current)clearInterval(pollRef.current);},[]);

  function fireConfetti(){
    const icons=["♠","♥","♦","♣","💰","⭐","💎","🎊"];
    setConf(Array.from({length:20},(_,i)=>({x:Math.random()*88,id:i,icon:icons[i%icons.length]})));
    setTimeout(()=>setConf([]),2600);
  }

  const placeBet = useCallback(async()=>{
    if(!selection||bet<=0||phase!=="betting")return;
    const lockedSel=selection,lockedBet=bet;
    setPhase("dealing");setSpinning(true);setHands(null);setRes(null);

    try{
      const r=await fetch(`${API}/api/games/blackjack`,{
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
          const pr=await fetch(`${API}/api/games/casino-round/blackjack/${roundId}`,{credentials:"include"});
          if(!pr.ok)return;
          const d=await pr.json();
          if(d.status==="settled"){
            clearInterval(pollRef.current);
            const srv=(d.result??"").trim().toLowerCase() as Selection;
            const preset=HAND_PRESETS[srv]??HAND_PRESETS.player;
            setSpinning(false);
            setTimeout(()=>{
              setHands(preset);
              setTimeout(()=>{
                const won=srv===lockedSel;
                setRes(srv);
                setWin(won?lockedBet*(BET_OPTIONS.find(b=>b.key===lockedSel)?.mult??1.95):0);
                setPhase("result");
                if(won){fireConfetti();qc.invalidateQueries({queryKey:getGetBalanceQueryKey()});qc.invalidateQueries({queryKey:getGetMeQueryKey()});}
              },900);
            },250);
          }
        }catch{}
      },600);
      setTimeout(()=>{if(pollRef.current)clearInterval(pollRef.current);},30000);
    }catch(e:any){
      setPhase("betting");setSpinning(false);
      toast({title:"Error",description:e.message,variant:"destructive"});
    }
  },[selection,bet,phase,qc,toast]);

  function collect(){setPhase("betting");setWin(0);setRes(null);setSel(null);setBet(0);setHands(null);setSpinning(false);}
  function chip(v:number){if(phase!=="betting")return;setBet(b=>Math.min(b+v,balance));}

  const selOpt = BET_OPTIONS.find(b=>b.key===selection);
  const resOpt = BET_OPTIONS.find(b=>b.key===resultKey);
  const busy   = phase==="dealing";

  const pWin = resultKey==="player";
  const dWin = resultKey==="dealer";
  const isTie = resultKey==="tie";

  const showHands = hands ?? (selection && phase==="betting" ? HAND_PRESETS[selection] : null);

  return (
    <div className="bj2-root">
      {/* Confetti */}
      <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:60,overflow:"hidden"}}>
        {confetti.map(c=>(
          <div key={c.id} style={{position:"absolute",top:"-20px",left:`${c.x}%`,fontSize:18,
            animation:`bj2-confetti ${1.4+Math.random()*0.8}s ease-in forwards`}}>{c.icon}</div>
        ))}
      </div>

      <div style={{position:"relative",zIndex:10,maxWidth:480,margin:"0 auto",paddingBottom:32}}>
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
          padding:"13px 16px",background:"rgba(2,12,4,0.95)",
          borderBottom:"1px solid rgba(245,197,66,0.18)",backdropFilter:"blur(14px)",position:"sticky",top:0,zIndex:30}}>
          <button onClick={()=>nav("/")} style={{
            display:"flex",alignItems:"center",gap:6,padding:"7px 13px",
            background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",
            borderRadius:10,color:"rgba(255,255,255,0.65)",cursor:"pointer",fontSize:14,
          }}>
            <ArrowLeft size={15}/>Back
          </button>
          <div style={{display:"flex",alignItems:"center",gap:9}}>
            <img src={`${BASE}blackjack-logo.jpg`} alt="" style={{height:34,width:34,borderRadius:8,objectFit:"cover"}}
              onError={e=>(e.currentTarget.style.display="none")}/>
            <div>
              <div style={{fontSize:15,fontWeight:900,letterSpacing:2,
                background:"linear-gradient(90deg,#f5c542,#fffde7,#f5c542)",
                WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>
                ♠ BLACKJACK ♠
              </div>
              <div style={{fontSize:9,color:"rgba(245,197,66,0.45)",letterSpacing:2}}>ROYAL CASINO TABLE</div>
            </div>
          </div>
          <div style={{background:"rgba(245,197,66,0.08)",border:"1px solid rgba(245,197,66,0.22)",
            borderRadius:10,padding:"6px 12px",textAlign:"right"}}>
            <div style={{fontSize:8,color:"rgba(255,255,255,0.35)",letterSpacing:1}}>BALANCE</div>
            <div style={{fontSize:12,fontWeight:800,color:"#f5c542"}}>{formatCurrency(balance)}</div>
          </div>
        </div>

        {/* Ticker */}
        <div style={{height:26,overflow:"hidden",display:"flex",alignItems:"center",
          background:"rgba(2,12,4,0.85)",borderBottom:"1px solid rgba(245,197,66,0.1)"}}>
          <div style={{whiteSpace:"nowrap",fontSize:11,color:"rgba(245,197,66,0.6)",letterSpacing:0.5,
            animation:"bj2-ticker 22s linear infinite"}}>{TICKER}{TICKER}</div>
        </div>

        <div style={{padding:"14px 12px 8px"}}>
          {/* Table label */}
          <div style={{textAlign:"center",marginBottom:10,fontSize:10,letterSpacing:3,
            color:"rgba(245,197,66,0.4)",fontWeight:700}}>♥ ROYAL TABLE — LIVE BLACKJACK ♦</div>

          {/* ═══ CASINO TABLE ═══ */}
          <div className="bj2-table" style={{
            background:"radial-gradient(ellipse at 50% 30%,#186a34 0%,#0f4d24 40%,#083318 75%,#052010 100%)",
            border:"2.5px solid rgba(245,197,66,0.35)",borderRadius:24,
            padding:"16px 14px",position:"relative",overflow:"hidden",
          }}>
            {/* Table edge shadow */}
            <div style={{position:"absolute",inset:0,borderRadius:22,
              background:"radial-gradient(ellipse 100% 60% at 50% 100%,rgba(0,0,0,0.4) 0%,transparent 60%)",
              pointerEvents:"none"}}/>
            {/* Decorative corner suits */}
            {["♠","♦","♣","♥"].map((s,i)=>(
              <div key={i} style={{position:"absolute",fontSize:16,opacity:0.1,color:"#f5c542",
                top:i<2?10:undefined,bottom:i>=2?10:undefined,
                left:i%2===0?12:undefined,right:i%2===1?12:undefined}}>{s}</div>
            ))}

            <div style={{position:"relative",zIndex:2}}>
              {/* DEALER section */}
              <div style={{marginBottom:12}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                  <div style={{
                    fontSize:9,letterSpacing:3,fontWeight:900,
                    color:"rgba(255,255,255,0.35)",
                    border:"1px solid rgba(255,255,255,0.1)",borderRadius:4,
                    padding:"2px 8px",
                  }}>DEALER</div>
                  {showHands&&<ScoreBadge n={showHands.dt} side="dealer" highlight={(dWin||isTie)&&phase==="result"}/>}
                </div>
                <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
                  {showHands ? (
                    showHands.dealer.map((c,i)=>(
                      <PlayingCard key={i} rank={c.rank} suit={c.suit} dealAnim="top"
                        delay={i*0.15} winner={(dWin||isTie)&&phase==="result"} spinning={spinning}/>
                    ))
                  ) : (
                    [0,1].map(i=><PlayingCard key={i} rank="A" suit="♠" faceDown delay={i*0.1} spinning={spinning}/>)
                  )}
                </div>
              </div>

              {/* VS divider */}
              <div style={{display:"flex",alignItems:"center",gap:10,margin:"10px 0"}}>
                <div style={{flex:1,height:1,background:"linear-gradient(90deg,transparent,rgba(245,197,66,0.25))"}}/>
                <div style={{
                  fontSize:10,fontWeight:900,letterSpacing:3,
                  color:"rgba(245,197,66,0.45)",
                  border:"1px solid rgba(245,197,66,0.2)",borderRadius:20,padding:"2px 12px",
                }}>VS</div>
                <div style={{flex:1,height:1,background:"linear-gradient(90deg,rgba(245,197,66,0.25),transparent)"}}/>
              </div>

              {/* PLAYER section */}
              <div>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                  <div style={{
                    fontSize:9,letterSpacing:3,fontWeight:900,
                    color:"rgba(255,255,255,0.35)",
                    border:"1px solid rgba(255,255,255,0.1)",borderRadius:4,
                    padding:"2px 8px",
                  }}>PLAYER</div>
                  {showHands&&<ScoreBadge n={showHands.pt} side="player" highlight={(pWin||isTie)&&phase==="result"}/>}
                </div>
                <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
                  {showHands ? (
                    showHands.player.map((c,i)=>(
                      <PlayingCard key={i} rank={c.rank} suit={c.suit} dealAnim="bot"
                        delay={i*0.15+0.2} winner={(pWin||isTie)&&phase==="result"} spinning={spinning}/>
                    ))
                  ) : (
                    [0,1].map(i=><PlayingCard key={i} rank="A" suit="♠" faceDown delay={i*0.1} spinning={spinning}/>)
                  )}
                </div>
              </div>

              {/* ── Result Panel ── */}
              {phase==="result"&&resultKey&&(()=>{
                const won=win>0;
                return (
                  <div style={{
                    marginTop:14,
                    background:won
                      ?"linear-gradient(135deg,rgba(5,42,14,0.95),rgba(20,83,45,0.95))"
                      :"linear-gradient(135deg,rgba(26,5,5,0.95),rgba(127,29,29,0.95))",
                    border:`2px solid ${won?"rgba(245,197,66,0.55)":"rgba(239,68,68,0.4)"}`,
                    borderRadius:18,padding:"18px 14px",textAlign:"center",
                    animation:"bj2-burst 0.5s cubic-bezier(.34,1.56,.64,1) both",
                    backdropFilter:"blur(8px)",
                    boxShadow:`0 0 40px ${won?"rgba(245,197,66,0.2)":"rgba(239,68,68,0.15)"}`,
                  }}>
                    <div style={{fontSize:42,marginBottom:4}}>
                      {isTie?"🤝":won?"🏆":"💔"}
                    </div>
                    <div style={{
                      fontSize:18,fontWeight:900,letterSpacing:2,marginBottom:4,
                      color:won?"#f5c542":"#fca5a5",
                      textShadow:won?"0 0 20px rgba(245,197,66,0.5)":undefined,
                    }}>
                      {isTie&&won?"🎉 TIE JACKPOT":won?"YOU WIN!":"DEALER WINS"}
                    </div>
                    <div style={{fontSize:11,color:"rgba(255,255,255,0.45)",marginBottom:won?10:14}}>
                      {resOpt?.icon} <strong style={{color:resOpt?.color}}>{resOpt?.label}</strong> wins · {resOpt?.mult}×
                    </div>
                    {won&&(
                      <div style={{fontSize:30,fontWeight:900,color:"#f5c542",letterSpacing:1,
                        textShadow:"0 0 24px rgba(245,197,66,0.6)",marginBottom:14}}>
                        +{formatCurrency(win)}
                      </div>
                    )}
                    <button onClick={collect} style={{
                      padding:"12px 36px",borderRadius:14,border:"none",cursor:"pointer",
                      fontWeight:900,fontSize:15,letterSpacing:1,
                      background:won?"linear-gradient(90deg,#d97706,#f5c542,#d97706)":"linear-gradient(90deg,#7f1d1d,#dc2626)",
                      color:won?"#020c05":"#fff",
                      boxShadow:won?"0 0 20px rgba(245,197,66,0.4)":undefined,
                    }}>
                      {won?"♠ COLLECT WINNINGS":"♥ DEAL AGAIN"}
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Bet type cards */}
          <div style={{marginTop:14,display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
            {BET_OPTIONS.map(opt=>{
              const sel=selection===opt.key;
              return (
                <div key={opt.key} onClick={()=>{if(phase!=="betting")return;setSel(opt.key);}}
                  style={{
                    background:sel?`linear-gradient(145deg,${opt.dark},rgba(0,0,0,0.8))`:"rgba(0,0,0,0.5)",
                    border:`2px solid ${sel?opt.border:"rgba(255,255,255,0.07)"}`,
                    borderRadius:16,padding:"14px 6px",textAlign:"center",cursor:"pointer",
                    transition:"all 0.2s",
                    boxShadow:sel?`0 0 24px ${opt.glow},inset 0 0 12px ${opt.dark}55`:undefined,
                  }}>
                  <div style={{fontSize:24,marginBottom:4}}>{opt.icon}</div>
                  <div style={{fontSize:9,fontWeight:900,letterSpacing:2,
                    color:sel?opt.color:"rgba(255,255,255,0.45)"}}>{opt.label}</div>
                  <div style={{fontSize:20,fontWeight:900,marginTop:4,
                    color:sel?opt.color:"rgba(255,255,255,0.25)",
                    textShadow:sel?`0 0 14px ${opt.glow}`:undefined}}>{opt.mult}×</div>
                </div>
              );
            })}
          </div>

          {/* Chip tray */}
          <div style={{marginTop:14}}>
            <div style={{fontSize:9,letterSpacing:3,color:"rgba(255,255,255,0.25)",marginBottom:8,textAlign:"center"}}>
              PLACE CHIPS
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap"}}>
              {CHIPS.map(({v,c})=>(
                <button key={v} onClick={()=>chip(v)} disabled={busy} style={{
                  width:52,height:52,borderRadius:"50%",border:`3px solid ${c}`,cursor:"pointer",
                  background:`radial-gradient(circle at 35% 30%,${c}cc,${c}55)`,
                  color:"#fff",fontSize:10,fontWeight:900,letterSpacing:0.5,
                  boxShadow:`0 4px 14px ${c}44,inset 0 1px 0 rgba(255,255,255,0.3)`,
                  opacity:busy?0.5:1,
                  animation:selection&&!busy?`bj2-chip-hover ${2+v/5000*0.5}s ease-in-out infinite`:undefined,
                  transition:"transform 0.15s",
                }}>
                  {v>=1000?`${v/1000}K`:v}
                </button>
              ))}
            </div>
          </div>

          {/* Info bar */}
          <div style={{marginTop:14,display:"grid",gridTemplateColumns:"repeat(3,1fr)",
            background:"rgba(0,0,0,0.5)",border:"1px solid rgba(245,197,66,0.08)",
            borderRadius:14,overflow:"hidden"}}>
            {[
              {l:"WIN",   v:formatCurrency(win),    c:win>0?"#f5c542":"rgba(255,255,255,0.25)"},
              {l:"BET",   v:formatCurrency(bet),    c:bet>0?"#22c55e":"rgba(255,255,255,0.25)"},
              {l:"BALANCE",v:formatCurrency(balance),c:"rgba(255,255,255,0.4)"},
            ].map((item,i)=>(
              <div key={i} style={{padding:"10px 0",textAlign:"center",
                borderRight:i<2?"1px solid rgba(245,197,66,0.07)":undefined}}>
                <div style={{fontSize:8,letterSpacing:2,color:"rgba(255,255,255,0.25)",marginBottom:2}}>{item.l}</div>
                <div style={{fontSize:12,fontWeight:700,color:item.c}}>{item.v}</div>
              </div>
            ))}
          </div>

          {/* Deal button */}
          {phase!=="result"&&(
            <button onClick={placeBet} disabled={busy||!selection||bet<=0}
              style={{
                marginTop:14,width:"100%",padding:"17px 0",borderRadius:18,border:"none",cursor:"pointer",
                fontSize:16,fontWeight:900,letterSpacing:2,
                background:busy
                  ?"linear-gradient(90deg,#14532d,#166534)"
                  :(!selection||bet<=0)
                  ?"rgba(255,255,255,0.05)"
                  :"linear-gradient(90deg,#d97706,#f5c542,#fef08a,#f5c542,#d97706)",
                backgroundSize:"200% 100%",
                color:(!selection||bet<=0)&&!busy?"rgba(255,255,255,0.2)":"#020c05",
                boxShadow:(!busy&&selection&&bet>0)?"0 0 30px rgba(245,197,66,0.4),0 4px 20px rgba(0,0,0,0.4)":undefined,
                animation:(!busy&&selection&&bet>0)?"bj2-shimmer 2.5s linear infinite":undefined,
                opacity:(!selection||bet<=0)&&!busy?0.45:1,
                transition:"all 0.2s",
              }}>
              {busy?"🃏 DEALING CARDS...":"♠ DEAL CARDS ♠"}
            </button>
          )}

          <div style={{marginTop:8,textAlign:"center",fontSize:11,color:"rgba(255,255,255,0.2)",letterSpacing:1}}>
            {!selection&&phase==="betting"&&"Pick Player • Dealer • Tie to begin"}
            {selection&&bet<=0&&phase==="betting"&&`${selOpt?.icon} ${selOpt?.label} — add chips to bet`}
            {selection&&bet>0&&phase==="betting"&&`${selOpt?.mult}× payout if ${selOpt?.label} wins`}
            {busy&&"🃏 Cards are being dealt — stand by..."}
          </div>
        </div>
      </div>
    </div>
  );
}
