import { useState, useCallback, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey, getGetBalanceQueryKey } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");
const BASE = import.meta.env.BASE_URL;

type Selection = "bonanza" | "scatter" | "base";
type Phase = "betting" | "spinning" | "settling" | "result";

const COLS = 5;
const ROWS = 3;
const TOTAL = COLS * ROWS; // 15 cells

const ALL_CANDY = ["🍭","🍬","🍫","🍩","🍦","🧁","🎂","🍰","🍡","🍮","⭐","💎","🌈","🎀","🫧"];

const BET_TYPES = [
  {
    key: "bonanza" as Selection,
    icon: "🍭", label: "BONANZA",  sub: "Full Sweet Match", mult: 8,
    color: "#f472b6", dark: "#831843", glow: "rgba(244,114,182,0.75)",
    bg: "linear-gradient(145deg,#4a0044,#831843,#be185d)",
    candy: ["🍭","🍭","🍭","🍭","🍭","🍭","🍭","🍭","🍬","🍭","🍭","🍭","🍭","🍭","🍬"],
  },
  {
    key: "scatter" as Selection,
    icon: "🍬", label: "SCATTER",  sub: "Scattered Sweets",  mult: 3,
    color: "#22d3ee", dark: "#164e63", glow: "rgba(34,211,238,0.7)",
    bg: "linear-gradient(145deg,#002233,#164e63,#0891b2)",
    candy: ["🍬","🍭","🍬","🍩","🍬","🍫","🍬","🍬","🍰","🍬","🍦","🍬","🍬","🧁","🍬"],
  },
  {
    key: "base" as Selection,
    icon: "🍫", label: "BASE SPIN", sub: "Any Sweet Win",  mult: 1.95,
    color: "#fbbf24", dark: "#78350f", glow: "rgba(251,191,36,0.7)",
    bg: "linear-gradient(145deg,#3d1f00,#92400e,#b45309)",
    candy: ["🍫","🍩","🍦","🧁","🎂","🍰","🍡","🍮","⭐","💎","🌈","🎀","🍫","🍩","🍦"],
  },
];

const CHIP_DEFS = [
  { amt:100,   color:"#f472b6", icon:"🍭" },
  { amt:500,   color:"#22d3ee", icon:"🍬" },
  { amt:1000,  color:"#a855f7", icon:"🍇" },
  { amt:5000,  color:"#fbbf24", icon:"⭐" },
  { amt:10000, color:"#ec4899", icon:"💎" },
];

const TICKER = "🍭 SUGAR RUSH CASINO  •  🍬 BONANZA BURST: 8×  •  🍫 SCATTER SWEETS: 3×  •  🍩 BASE SPIN: 1.95×  •  💎 JACKPOT INCOMING  •  🌈 WIN SWEET PRIZES  •  🎀 LUCKY SPIN NOW  •  ⭐ MEGA SWEET JACKPOT  •  ";

const STYLES = `
  .sb-bg {
    background: radial-gradient(ellipse at 60% 0%, #3b0a5e 0%, #1a0028 40%, #0d001a 100%);
    min-height:100dvh;
    position:relative;
    overflow:hidden;
  }
  .sb-bg::before {
    content:'';
    position:fixed;
    inset:0;
    background:
      radial-gradient(ellipse 90% 50% at 50% -5%, rgba(236,72,153,0.12) 0%, transparent 55%),
      repeating-linear-gradient(45deg,rgba(244,114,182,0.025) 0px,rgba(244,114,182,0.025) 1px,transparent 1px,transparent 28px),
      repeating-linear-gradient(-45deg,rgba(167,139,250,0.02) 0px,rgba(167,139,250,0.02) 1px,transparent 1px,transparent 28px);
    pointer-events:none;
    z-index:0;
  }

  @keyframes sb-ticker    { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
  @keyframes sb-neon      { 0%,100%{text-shadow:0 0 10px #f472b6,0 0 30px #f472b699} 50%{text-shadow:0 0 22px #f472b6,0 0 60px #f472b6cc,0 0 120px #f472b655} }
  @keyframes sb-rainbow   { 0%{border-color:#f472b6} 16%{border-color:#fb923c} 33%{border-color:#fbbf24} 50%{border-color:#4ade80} 66%{border-color:#22d3ee} 83%{border-color:#a78bfa} 100%{border-color:#f472b6} }
  @keyframes sb-glow-ring { 0%{box-shadow:0 0 20px #f472b666,0 0 50px #a855f744} 50%{box-shadow:0 0 40px #f472b699,0 0 90px #a855f766,inset 0 0 30px rgba(244,114,182,0.06)} 100%{box-shadow:0 0 20px #f472b666,0 0 50px #a855f744} }
  @keyframes sb-candy-pop { 0%{transform:scale(0) rotate(-30deg);opacity:0} 55%{transform:scale(1.25) rotate(8deg);opacity:1} 75%{transform:scale(0.9) rotate(-3deg)} 90%{transform:scale(1.06)} 100%{transform:scale(1) rotate(0deg);opacity:1} }
  @keyframes sb-candy-spin{ 0%{transform:scale(0.65) rotate(0deg)} 100%{transform:scale(0.65) rotate(360deg)} }
  @keyframes sb-candy-fall{ 0%{transform:translateY(-20px) rotate(0deg);opacity:1} 100%{transform:translateY(280px) rotate(480deg);opacity:0} }
  @keyframes sb-burst     { 0%{transform:scale(0.2);opacity:0} 55%{transform:scale(1.1)} 80%{transform:scale(0.95)} 100%{transform:scale(1);opacity:1} }
  @keyframes sb-mega-pulse{ 0%,100%{text-shadow:0 0 14px #fbbf2488,0 0 40px #fbbf2433} 50%{text-shadow:0 0 30px #fbbf24cc,0 0 80px #fbbf2466} }
  @keyframes sb-btn-float { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-5px) scale(1.04)} }
  @keyframes sb-shimmer   { 0%{background-position:-300% 0} 100%{background-position:300% 0} }
  @keyframes sb-sunray    { 0%,100%{opacity:0.07} 50%{opacity:0.14} }
  @keyframes sb-chip-pop  { 0%,100%{transform:scale(1)} 50%{transform:scale(1.18)} }

  .sb-grid-wrap {
    animation: sb-glow-ring 2.8s ease-in-out infinite;
    border: 2.5px solid #f472b6;
    animation: sb-rainbow 4s linear infinite, sb-glow-ring 2.8s ease-in-out infinite;
  }
  .sb-title { animation: sb-neon 2.5s ease-in-out infinite; }
  .sb-mega  { animation: sb-mega-pulse 2.2s ease-in-out infinite; }
`;

function mkAudio() {
  try { return new ((window as any).AudioContext || (window as any).webkitAudioContext)(); } catch { return null; }
}
function playSpin() {
  const c = mkAudio(); if (!c) return;
  [300,350,280,320].forEach((f,i) => {
    const o=c.createOscillator(),g=c.createGain();
    o.connect(g);g.connect(c.destination);o.type="sine";o.frequency.value=f;
    const t=c.currentTime+i*0.05;
    g.gain.setValueAtTime(0.07,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.12);
    o.start(t);o.stop(t+0.15);
  });
  setTimeout(()=>c.close(),500);
}
function playWin() {
  const c = mkAudio(); if (!c) return;
  [523,659,784,1047,1319,1568].forEach((f,i) => {
    const o=c.createOscillator(),g=c.createGain();
    o.connect(g);g.connect(c.destination);o.type="sine";o.frequency.value=f;
    const t=c.currentTime+i*0.07;
    g.gain.setValueAtTime(0.1,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.32);
    o.start(t);o.stop(t+0.36);
  });
  setTimeout(()=>c.close(),1000);
}
function playPop() {
  const c = mkAudio(); if (!c) return;
  const o=c.createOscillator(),g=c.createGain();
  o.connect(g);g.connect(c.destination);o.type="sine";o.frequency.value=900;
  g.gain.setValueAtTime(0.07,c.currentTime);g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.08);
  o.start();o.stop(c.currentTime+0.1);
  setTimeout(()=>c.close(),200);
}

interface Candy { id:number; x:number; icon:string; }

export default function SweetBonanzaGame() {
  const [,nav] = useLocation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [phase, setPhase]           = useState<Phase>("betting");
  const [selection, setSelection]   = useState<Selection|null>(null);
  const [bet, setBet]               = useState(0);
  const [win, setWin]               = useState(0);
  const [resultKey, setResultKey]   = useState<string|null>(null);
  const [grid, setGrid]             = useState<string[]>(()=>Array.from({length:TOTAL},(_,i)=>ALL_CANDY[i%ALL_CANDY.length]));
  const [spinningIdx, setSpinningIdx] = useState<number[]>([]);
  const [settledIdx, setSettledIdx]   = useState<number[]>([]);
  const [candies, setCandies]         = useState<Candy[]>([]);
  const [megaPool] = useState(()=>Math.floor(200000+Math.random()*100000));

  const pollTimer     = useRef<ReturnType<typeof setInterval>|null>(null);
  const spinIntervals = useRef<ReturnType<typeof setInterval>[]>([]);
  const candyTimer    = useRef<ReturnType<typeof setInterval>|null>(null);
  const betSnapshot   = useRef<{selection:Selection;amount:number}|null>(null);

  const balance = (user as any)?.balance ?? 0;

  useEffect(()=>{
    const s=document.createElement("style");s.textContent=STYLES;document.head.appendChild(s);
    return ()=>{ try{document.head.removeChild(s)}catch{} };
  },[]);

  useEffect(()=>()=>{
    if(pollTimer.current) clearInterval(pollTimer.current);
    spinIntervals.current.forEach(clearInterval);
    if(candyTimer.current) clearInterval(candyTimer.current);
  },[]);

  function startCandyRain() {
    const icons = ["🍭","🍬","🍫","🍩","🍦","🧁","⭐","💎","🌈"];
    let id=0;
    if(candyTimer.current) clearInterval(candyTimer.current);
    candyTimer.current = setInterval(()=>{
      setCandies(prev=>{
        const fresh:Candy={id:id++,x:Math.random()*90,icon:icons[Math.floor(Math.random()*icons.length)]};
        return [...prev.slice(-22),fresh];
      });
    },100);
    setTimeout(()=>{
      if(candyTimer.current) clearInterval(candyTimer.current);
      setTimeout(()=>setCandies([]),2200);
    },2500);
  }

  function startSpinGrid() {
    const all=Array.from({length:TOTAL},(_,i)=>i);
    setSpinningIdx(all);setSettledIdx([]);
    spinIntervals.current.forEach(clearInterval);
    spinIntervals.current=all.map(idx=>(
      setInterval(()=>{
        setGrid(g=>{const n=[...g];n[idx]=ALL_CANDY[Math.floor(Math.random()*ALL_CANDY.length)];return n;});
      },65+idx*4)
    ));
  }

  /* Settle column-by-column (5 cols) */
  function settleGrid(resultCandies:string[]) {
    spinIntervals.current.forEach(clearInterval);spinIntervals.current=[];
    const order:number[]=[];
    for(let c=0;c<COLS;c++) for(let r=0;r<ROWS;r++) order.push(r*COLS+c);
    order.forEach((idx,step)=>{
      setTimeout(()=>{
        setGrid(g=>{const n=[...g];n[idx]=resultCandies[idx];return n;});
        setSpinningIdx(prev=>prev.filter(i=>i!==idx));
        setSettledIdx(prev=>[...prev,idx]);
        playPop();
      },step*90);
    });
  }

  async function placeBet() {
    if(!selection||bet<=0||phase!=="betting") return;
    const lockedSelection:Selection=selection;
    const lockedBet:number=bet;
    betSnapshot.current={selection:lockedSelection,amount:lockedBet};

    setPhase("spinning");startSpinGrid();startCandyRain();playSpin();

    try {
      const r=await fetch(`${API}/api/games/sweet-bonanza`,{
        method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",
        body:JSON.stringify({selection:lockedSelection,stake:lockedBet}),
      });
      if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.error||"Bet failed");}
      const {roundId}=await r.json();
      qc.invalidateQueries({queryKey:getGetBalanceQueryKey()});
      qc.invalidateQueries({queryKey:getGetMeQueryKey()});

      if(pollTimer.current) clearInterval(pollTimer.current);
      pollTimer.current=setInterval(async()=>{
        try {
          const pr=await fetch(`${API}/api/games/casino-round/sweet-bonanza/${roundId}`,{credentials:"include"});
          if(!pr.ok) return;
          const data=await pr.json();
          if(data.status==="settled"){
            clearInterval(pollTimer.current!);
            const serverResult:string=(data.result??"").trim().toLowerCase();
            const bt=BET_TYPES.find(b=>b.key===lockedSelection)!;
            const won=serverResult===lockedSelection;
            const resultBt=BET_TYPES.find(b=>b.key===serverResult);
            const resultCandies=won?[...bt.candy]:[...(resultBt?.candy??BET_TYPES.find(b=>b.key!==lockedSelection)!.candy)];
            setPhase("settling");
            settleGrid(resultCandies);
            setTimeout(()=>{
              setPhase("result");
              if(won){
                setWin(lockedBet*bt.mult);
                setResultKey(serverResult);
                playWin();startCandyRain();
                qc.invalidateQueries({queryKey:getGetBalanceQueryKey()});
                qc.invalidateQueries({queryKey:getGetMeQueryKey()});
              } else {
                setWin(0);setResultKey(serverResult);
              }
            },TOTAL*90+450);
          }
        } catch {}
      },600);

      setTimeout(()=>{if(pollTimer.current) clearInterval(pollTimer.current);},30000);
    } catch(e:any) {
      setPhase("betting");spinIntervals.current.forEach(clearInterval);
      setGrid(Array.from({length:TOTAL},(_,i)=>ALL_CANDY[i%ALL_CANDY.length]));
      toast({title:"Error",description:e.message,variant:"destructive"});
    }
  }

  function collect() {
    setPhase("betting");setWin(0);setResultKey(null);setSelection(null);setBet(0);
    setSettledIdx([]);setGrid(Array.from({length:TOTAL},(_,i)=>ALL_CANDY[i%ALL_CANDY.length]));
  }

  function addChip(amt:number) {
    if(phase!=="betting") return;
    setBet(b=>Math.min(b+amt,balance));playPop();
  }

  const busy=phase==="spinning"||phase==="settling";
  const selectedBt=BET_TYPES.find(b=>b.key===selection);

  return (
    <div className="sb-bg" style={{fontFamily:"'Segoe UI',system-ui,sans-serif",color:"#fff",position:"relative"}}>

      {/* Candy rain particles */}
      <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:50,overflow:"hidden"}}>
        {candies.map(c=>(
          <div key={c.id} style={{
            position:"absolute",top:"-30px",left:`${c.x}%`,
            fontSize:20,animation:`sb-candy-fall ${1.6+Math.random()}s ease-in forwards`,
          }}>{c.icon}</div>
        ))}
      </div>

      <div style={{position:"relative",zIndex:10,maxWidth:480,margin:"0 auto",paddingBottom:32}}>

        {/* ── HEADER ── */}
        <div style={{
          display:"flex",alignItems:"center",justifyContent:"space-between",
          padding:"14px 16px",
          background:"rgba(0,0,0,0.55)",
          borderBottom:"1px solid rgba(244,114,182,0.3)",
          backdropFilter:"blur(14px)",
        }}>
          <button onClick={()=>nav("/")} style={{
            background:"rgba(244,114,182,0.12)",border:"1px solid rgba(244,114,182,0.35)",
            borderRadius:10,padding:"7px 12px",color:"#f472b6",cursor:"pointer",
            display:"flex",alignItems:"center",gap:6,fontSize:14,
          }}>
            <ArrowLeft size={16}/> Back
          </button>

          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <img src={`${BASE}sweet-bonanza-logo.jpg`} alt="" style={{height:34,width:34,borderRadius:8,objectFit:"cover"}}
              onError={e=>(e.currentTarget.style.display="none")}/>
            <div>
              <div className="sb-title" style={{fontSize:15,fontWeight:900,letterSpacing:2,color:"#f472b6"}}>
                SWEET BONANZA
              </div>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.5)",letterSpacing:1}}>SUGAR RUSH PARADISE</div>
            </div>
          </div>

          <div style={{
            background:"rgba(244,114,182,0.1)",border:"1px solid rgba(244,114,182,0.3)",
            borderRadius:10,padding:"6px 12px",textAlign:"right",
          }}>
            <div style={{fontSize:9,color:"rgba(255,255,255,0.5)",letterSpacing:1}}>BALANCE</div>
            <div style={{fontSize:13,fontWeight:700,color:"#f472b6"}}>{formatCurrency(balance)}</div>
          </div>
        </div>

        {/* ── CANDY TICKER ── */}
        <div style={{
          background:"rgba(59,10,94,0.85)",borderBottom:"1px solid rgba(244,114,182,0.18)",
          overflow:"hidden",height:28,display:"flex",alignItems:"center",
        }}>
          <div style={{
            whiteSpace:"nowrap",fontSize:11,color:"rgba(244,114,182,0.85)",letterSpacing:0.5,
            animation:"sb-ticker 20s linear infinite",
          }}>
            {TICKER}{TICKER}
          </div>
        </div>

        {/* ── MAIN BOARD ── */}
        <div style={{padding:"14px 12px 10px"}}>

          {/* Title */}
          <div style={{textAlign:"center",marginBottom:12}}>
            <div style={{fontSize:10,letterSpacing:4,color:"rgba(244,114,182,0.75)",fontWeight:700}}>
              🍭 SUGAR RUSH PARADISE 🍭
            </div>
          </div>

          {/* ── CANDY GRID (5 × 3) ── */}
          <div className="sb-grid-wrap" style={{
            background:"linear-gradient(145deg,rgba(26,0,40,0.95),rgba(10,0,20,0.98))",
            borderRadius:20,padding:12,
            position:"relative",overflow:"hidden",
          }}>
            {/* Radial glow inside */}
            <div style={{
              position:"absolute",inset:0,
              background:"radial-gradient(ellipse at 50% -10%,rgba(244,114,182,0.1) 0%,transparent 60%)",
              animation:"sb-sunray 3.5s ease-in-out infinite",
              pointerEvents:"none",
            }}/>

            <div style={{position:"relative",zIndex:2}}>
              {/* 5×3 grid */}
              <div style={{display:"grid",gridTemplateColumns:`repeat(${COLS},1fr)`,gap:6,marginBottom:12}}>
                {grid.map((candy,i)=>{
                  const isSpinning=spinningIdx.includes(i);
                  const isSettled=settledIdx.includes(i);
                  return (
                    <div key={i} style={{
                      aspectRatio:"1",
                      background: isSettled
                        ? (selectedBt?`${selectedBt.bg}99`:"rgba(131,24,67,0.5)")
                        : "rgba(0,0,0,0.5)",
                      border: isSettled
                        ? `2px solid ${selectedBt?.color??"#f472b6"}99`
                        : "2px solid rgba(244,114,182,0.14)",
                      borderRadius:11,
                      display:"flex",alignItems:"center",justifyContent:"center",
                      fontSize:22,
                      animation: isSettled
                        ? "sb-candy-pop 0.42s cubic-bezier(.34,1.56,.64,1) forwards"
                        : isSpinning?"sb-candy-spin 0.22s linear infinite":undefined,
                      boxShadow: isSettled&&selectedBt?`0 0 10px ${selectedBt.glow}`:undefined,
                      transition:"border-color 0.3s,box-shadow 0.3s",
                    }}>
                      {candy}
                    </div>
                  );
                })}
              </div>

              {/* Mega prize pool banner */}
              <div style={{
                background:"linear-gradient(90deg,rgba(251,191,36,0.06),rgba(251,191,36,0.18),rgba(251,191,36,0.06))",
                border:"1px solid rgba(251,191,36,0.3)",borderRadius:10,
                padding:"7px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",
              }}>
                <span style={{fontSize:10,letterSpacing:2,color:"rgba(251,191,36,0.75)"}}>💎 MEGA JACKPOT</span>
                <span className="sb-mega" style={{fontSize:15,fontWeight:900,color:"#fbbf24"}}>
                  {formatCurrency(megaPool)}
                </span>
              </div>

              {/* ── INLINE RESULT PANEL ── */}
              {phase==="result"&&resultKey&&(()=>{
                const won=win>0;
                const resultBt=BET_TYPES.find(b=>b.key===resultKey);
                return (
                  <div style={{
                    marginTop:12,
                    background:won
                      ?"linear-gradient(135deg,#4a0044,#831843,#be185d)"
                      :"linear-gradient(135deg,#1a0028,#3b0a5e,#4c0070)",
                    border:`2px solid ${won?"#f472b6":"#7c3aed"}`,
                    borderRadius:16,padding:"18px 14px",textAlign:"center",
                    boxShadow:`0 0 35px ${won?"rgba(244,114,182,0.45)":"rgba(124,58,237,0.35)"}`,
                    animation:"sb-burst 0.55s cubic-bezier(.34,1.56,.64,1) forwards",
                  }}>
                    <div style={{fontSize:38,marginBottom:4}}>{won?"🏆":"😔"}</div>
                    <div style={{fontSize:17,fontWeight:900,letterSpacing:2,
                      color:won?"#f9a8d4":"#c4b5fd",marginBottom:4}}>
                      {won?"SWEET WINNER!":"NO SUGAR TODAY"}
                    </div>
                    <div style={{fontSize:12,color:"rgba(255,255,255,0.6)",marginBottom:won?8:12}}>
                      Result: <strong style={{color:resultBt?.color??"#fff"}}>{resultKey.toUpperCase()}</strong>
                      {" · "}{resultBt?.label} {resultBt?.mult}×
                    </div>
                    {won&&(
                      <div style={{fontSize:30,fontWeight:900,color:"#fbbf24",
                        textShadow:"0 0 18px rgba(251,191,36,0.7)",marginBottom:12}}>
                        +{formatCurrency(win)}
                      </div>
                    )}
                    <button onClick={collect} style={{
                      padding:"11px 32px",borderRadius:12,border:"none",cursor:"pointer",
                      fontWeight:900,fontSize:14,letterSpacing:1,
                      background:won
                        ?"linear-gradient(90deg,#f472b6,#ec4899)"
                        :"linear-gradient(90deg,#7c3aed,#6d28d9)",
                      color:"#fff",
                    }}>
                      {won?"🍭 COLLECT SWEETS":"🔄 SPIN AGAIN"}
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* ── BET TYPE CARDS ── */}
          <div style={{marginTop:14,display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
            {BET_TYPES.map(bt=>(
              <div key={bt.key} onClick={()=>{
                if(phase!=="betting") return;
                setSelection(bt.key);playPop();
              }} style={{
                background:selection===bt.key?bt.bg:"rgba(0,0,0,0.45)",
                border:`2px solid ${selection===bt.key?bt.color:"rgba(255,255,255,0.1)"}`,
                borderRadius:16,padding:"13px 6px",textAlign:"center",cursor:"pointer",
                transition:"all 0.25s",
                boxShadow:selection===bt.key?`0 0 22px ${bt.glow},0 0 44px ${bt.glow}44`:"none",
                animation:selection===bt.key?"sb-btn-float 2s ease-in-out infinite":undefined,
              }}>
                <div style={{fontSize:28,marginBottom:3}}>{bt.icon}</div>
                <div style={{fontSize:9,fontWeight:900,letterSpacing:2,
                  color:selection===bt.key?bt.color:"rgba(255,255,255,0.6)"}}>
                  {bt.label}
                </div>
                <div style={{fontSize:19,fontWeight:900,marginTop:4,
                  color:selection===bt.key?bt.color:"rgba(255,255,255,0.4)",
                  textShadow:selection===bt.key?`0 0 14px ${bt.glow}`:undefined}}>
                  {bt.mult}×
                </div>
                <div style={{fontSize:9,color:"rgba(255,255,255,0.4)",marginTop:2}}>{bt.sub}</div>
              </div>
            ))}
          </div>

          {/* ── CHIP TRAY ── */}
          <div style={{marginTop:14}}>
            <div style={{fontSize:9,letterSpacing:3,color:"rgba(255,255,255,0.35)",marginBottom:8,textAlign:"center"}}>
              SELECT BET AMOUNT
            </div>
            <div style={{display:"flex",gap:7,justifyContent:"center",flexWrap:"wrap"}}>
              {CHIP_DEFS.map(c=>(
                <button key={c.amt} onClick={()=>addChip(c.amt)} disabled={busy} style={{
                  width:54,height:54,borderRadius:"50%",border:`3px solid ${c.color}`,cursor:"pointer",
                  background:`radial-gradient(circle at 35% 30%,${c.color}cc,${c.color}66)`,
                  color:"#fff",fontSize:10,fontWeight:900,
                  display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:1,
                  boxShadow:`0 4px 14px ${c.color}55`,opacity:busy?0.5:1,transition:"transform 0.15s",
                }}>
                  <span style={{fontSize:14}}>{c.icon}</span>
                  <span style={{fontSize:9}}>{c.amt>=1000?`${c.amt/1000}K`:c.amt}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── INFO BAR ── */}
          <div style={{
            marginTop:14,display:"grid",gridTemplateColumns:"repeat(3,1fr)",
            background:"rgba(0,0,0,0.45)",border:"1px solid rgba(244,114,182,0.15)",
            borderRadius:14,overflow:"hidden",
          }}>
            {[
              {label:"WIN",   value:formatCurrency(win),    color:win>0?"#f472b6":"rgba(255,255,255,0.35)"},
              {label:"BET",   value:formatCurrency(bet),    color:bet>0?"#fbbf24":"rgba(255,255,255,0.35)"},
              {label:"BALANCE",value:formatCurrency(balance),color:"rgba(255,255,255,0.55)"},
            ].map((item,i)=>(
              <div key={i} style={{
                padding:"10px 0",textAlign:"center",
                borderRight:i<2?"1px solid rgba(244,114,182,0.1)":undefined,
              }}>
                <div style={{fontSize:8,letterSpacing:2,color:"rgba(255,255,255,0.3)",marginBottom:3}}>{item.label}</div>
                <div style={{fontSize:13,fontWeight:700,color:item.color}}>{item.value}</div>
              </div>
            ))}
          </div>

          {/* ── SPIN BUTTON ── */}
          {phase!=="result"&&(
            <button
              onClick={placeBet}
              disabled={busy||!selection||bet<=0}
              style={{
                marginTop:14,width:"100%",padding:"18px 0",borderRadius:18,border:"none",cursor:"pointer",
                fontSize:17,fontWeight:900,letterSpacing:2,
                background:busy
                  ?"linear-gradient(90deg,#831843,#be185d)"
                  :(!selection||bet<=0)
                  ?"rgba(255,255,255,0.08)"
                  :"linear-gradient(90deg,#db2777,#ec4899,#f472b6,#ec4899,#db2777)",
                backgroundSize:"200% 100%",
                color:(!selection||bet<=0)?"rgba(255,255,255,0.3)":"#fff",
                opacity:(!selection||bet<=0)&&!busy?0.5:1,
                transition:"all 0.25s",
                animation:(!busy&&selection&&bet>0&&phase==="betting")?"sb-shimmer 2s linear infinite":undefined,
                boxShadow:(!busy&&selection&&bet>0)?"0 0 30px rgba(236,72,153,0.5),0 0 60px rgba(236,72,153,0.2)":undefined,
              }}
            >
              {phase==="spinning"?"🌀 SPINNING SWEETS...":
               phase==="settling"?"🍬 SETTLING...":
               "🍭 SPIN FOR SWEETS!"}
            </button>
          )}

          {/* Hint */}
          <div style={{marginTop:10,textAlign:"center",fontSize:11,color:"rgba(255,255,255,0.3)",letterSpacing:1}}>
            {phase==="betting"&&!selection&&"Pick a bet type above to start spinning"}
            {phase==="betting"&&selection&&bet<=0&&`${selectedBt?.icon} ${selectedBt?.label} selected — add chips`}
            {phase==="betting"&&selection&&bet>0&&`${selectedBt?.mult}× payout if ${selectedBt?.label} wins!`}
            {phase==="spinning"&&"🍭 Sweets are tumbling... hold tight!"}
            {phase==="settling"&&"🍬 Candies landing..."}
          </div>
        </div>
      </div>
    </div>
  );
}
