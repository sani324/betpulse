import { useState, useCallback, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey, getGetBalanceQueryKey } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Leaf } from "lucide-react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");
const BASE = import.meta.env.BASE_URL;

type Selection = "jackpot" | "mix" | "plain";
type Phase = "betting" | "spinning" | "settling" | "result";

const BET_TYPES = [
  {
    key: "jackpot" as Selection,
    icon: "🥝",
    label: "JACKPOT",
    sub: "Rare Fruit Match",
    mult: 10,
    color: "#f5c542",
    dark: "#78350f",
    glow: "rgba(245,197,66,0.75)",
    bg: "linear-gradient(145deg,#3d1f00,#92400e,#b45309)",
    fruits: ["🥝","🍒","🥝","🍒","🥝","🍒","🥝","🍒","🥝"],
  },
  {
    key: "mix" as Selection,
    icon: "🍓",
    label: "MIX FRUITS",
    sub: "Multi Fruit Match",
    mult: 3,
    color: "#4ade80",
    dark: "#14532d",
    glow: "rgba(74,222,128,0.65)",
    bg: "linear-gradient(145deg,#052e16,#166534,#15803d)",
    fruits: ["🍓","🍇","🍉","🍊","🍋","🍑","🍒","🥝","🍏"],
  },
  {
    key: "plain" as Selection,
    icon: "🍊",
    label: "PLAIN",
    sub: "Any Fruit Win",
    mult: 1.95,
    color: "#fb923c",
    dark: "#7c2d12",
    glow: "rgba(251,146,60,0.65)",
    bg: "linear-gradient(145deg,#431407,#9a3412,#c2410c)",
    fruits: ["🍓","🍓","🍊","🍊","🍋","🍋","🍑","🍑","🍑"],
  },
];

const ALL_FRUITS = ["🍓","🍇","🍉","🍊","🍋","🍑","🍒","🥝","🍏","🫐","🍈","🍌"];

const CHIP_DEFS = [
  { amt:100,    color:"#ef4444", icon:"🍓" },
  { amt:500,    color:"#f97316", icon:"🍊" },
  { amt:1000,   color:"#eab308", icon:"🍋" },
  { amt:5000,   color:"#22c55e", icon:"🍏" },
  { amt:10000,  color:"#a855f7", icon:"🍇" },
];

const TICKER = "🌿 FRESH HARVEST DAILY  •  🥝 JACKPOT PRIZE: 10×  •  🍓 MIX MATCH: 3×  •  🍊 PLAIN WIN: 1.95×  •  🌱 PLAY & WIN BIG  •  🍒 RARE FRUITS INCOMING  •  🏆 LUCKY HARVESTER WINS ₹45,000  •  🌾 HARVEST TIME!  •  ";

const STYLES = `
  .fl-bg {
    background: radial-gradient(ellipse at 30% 0%, #1a4d00 0%, #0a2800 35%, #041200 100%);
    min-height:100dvh;
    position:relative;
    overflow:hidden;
  }
  .fl-bg::before {
    content:'';
    position:fixed;
    inset:0;
    background:
      radial-gradient(ellipse 80% 40% at 50% -10%, rgba(74,222,128,0.10) 0%, transparent 60%),
      repeating-linear-gradient(60deg, rgba(74,222,128,0.025) 0px, rgba(74,222,128,0.025) 1px, transparent 1px, transparent 38px),
      repeating-linear-gradient(-60deg, rgba(74,222,128,0.02) 0px, rgba(74,222,128,0.02) 1px, transparent 1px, transparent 38px);
    pointer-events:none;
    z-index:0;
  }
  @keyframes fl-ticker   { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
  @keyframes fl-sunray   { 0%,100%{opacity:0.06;transform:scale(1) rotate(0deg)} 50%{opacity:0.14;transform:scale(1.08) rotate(4deg)} }
  @keyframes fl-leaf-fall{
    0%   {transform:translateY(-10px) translateX(0px) rotate(0deg) scale(1);opacity:1}
    25%  {transform:translateY(60px) translateX(15px) rotate(90deg) scale(0.9)}
    50%  {transform:translateY(120px) translateX(-10px) rotate(180deg) scale(0.8)}
    75%  {transform:translateY(180px) translateX(12px) rotate(270deg) scale(0.7)}
    100% {transform:translateY(260px) translateX(-5px) rotate(360deg) scale(0.3);opacity:0}
  }
  @keyframes fl-fruit-tumble {
    0%   {transform:scale(0.6) rotate(-20deg);opacity:0.4}
    30%  {transform:scale(1.1) rotate(10deg);opacity:1}
    60%  {transform:scale(0.95) rotate(-5deg)}
    80%  {transform:scale(1.04) rotate(2deg)}
    100% {transform:scale(1) rotate(0deg);opacity:1}
  }
  @keyframes fl-fruit-spin {
    0%   {transform:scale(0.7) rotate(0deg)}
    100% {transform:scale(0.7) rotate(360deg)}
  }
  @keyframes fl-harvest-pulse {
    0%,100%{box-shadow:0 0 20px rgba(74,222,128,0.4),0 0 60px rgba(74,222,128,0.2)}
    50%{box-shadow:0 0 40px rgba(74,222,128,0.7),0 0 120px rgba(74,222,128,0.35)}
  }
  @keyframes fl-win-burst {
    0%  {transform:scale(0.3);opacity:0}
    50% {transform:scale(1.08)}
    70% {transform:scale(0.96)}
    85% {transform:scale(1.03)}
    100%{transform:scale(1);opacity:1}
  }
  @keyframes fl-glow-ring {
    0%,100%{opacity:0.5;transform:scale(1)}
    50%{opacity:1;transform:scale(1.05)}
  }
  @keyframes fl-vine-sway {
    0%,100%{transform:rotate(-3deg) scaleY(1)}
    50%{transform:rotate(3deg) scaleY(1.03)}
  }
  @keyframes fl-badge-hover {
    0%,100%{transform:translateY(0) scale(1)}
    50%{transform:translateY(-4px) scale(1.04)}
  }
  @keyframes fl-chip-bounce {
    0%,100%{transform:scale(1)}
    50%{transform:scale(1.15)}
  }
  @keyframes fl-header-glow {
    0%,100%{text-shadow:0 0 12px rgba(74,222,128,0.6)}
    50%{text-shadow:0 0 28px rgba(74,222,128,0.95),0 0 60px rgba(74,222,128,0.5)}
  }
  @keyframes fl-overlay-in {
    0%{opacity:0;transform:scale(0.7) translateY(40px)}
    60%{transform:scale(1.05) translateY(-6px)}
    80%{transform:scale(0.98)}
    100%{opacity:1;transform:scale(1) translateY(0)}
  }
  @keyframes fl-shimmer {
    0%  {background-position:-200% 0}
    100%{background-position:200% 0}
  }
  .fl-btn-harvest {
    animation:fl-harvest-pulse 2.2s ease-in-out infinite;
  }
  .fl-title-glow {
    animation:fl-header-glow 2.5s ease-in-out infinite;
  }
`;

function mkAudio() {
  try { return new ((window as any).AudioContext || (window as any).webkitAudioContext)(); } catch { return null; }
}
function playHarvest() {
  const c = mkAudio(); if (!c) return;
  [440,550,660,880].forEach((f,i)=>{
    const o=c.createOscillator(),g=c.createGain();
    o.connect(g);g.connect(c.destination);
    o.type="sine";o.frequency.value=f;
    const t=c.currentTime+i*0.07;
    g.gain.setValueAtTime(0.09,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.18);
    o.start(t);o.stop(t+0.2);
  });
  setTimeout(()=>c.close(),600);
}
function playWin() {
  const c = mkAudio(); if (!c) return;
  [523,659,784,1047,1319].forEach((f,i)=>{
    const o=c.createOscillator(),g=c.createGain();
    o.connect(g);g.connect(c.destination);
    o.type="sine";o.frequency.value=f;
    const t=c.currentTime+i*0.08;
    g.gain.setValueAtTime(0.1,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.3);
    o.start(t);o.stop(t+0.35);
  });
  setTimeout(()=>c.close(),900);
}
function playPop() {
  const c = mkAudio(); if (!c) return;
  const o=c.createOscillator(),g=c.createGain();
  o.connect(g);g.connect(c.destination);
  o.type="sine";o.frequency.value=800;
  g.gain.setValueAtTime(0.07,c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.08);
  o.start();o.stop(c.currentTime+0.1);
  setTimeout(()=>c.close(),200);
}

interface LeafParticle { id:number; x:number; icon:string; delay:number; }

export default function FruitLineGame() {
  const [,nav] = useLocation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [phase, setPhase]       = useState<Phase>("betting");
  const [selection, setSelection] = useState<Selection|null>(null);
  const [bet, setBet]           = useState(0);
  const [win, setWin]           = useState(0);
  const [resultKey, setResultKey] = useState<string|null>(null);
  const [grid, setGrid]         = useState<string[]>(()=>ALL_FRUITS.slice(0,9));
  const [spinningIdx, setSpinningIdx] = useState<number[]>([]);
  const [settledIdx, setSettledIdx]   = useState<number[]>([]);
  const [leaves, setLeaves]     = useState<LeafParticle[]>([]);
  const [showOverlay, setShowOverlay] = useState(false);
  const [jackpotPool] = useState(()=>Math.floor(80000+Math.random()*50000));

  const roundIdRef    = useRef<string|null>(null);
  const pollTimer     = useRef<ReturnType<typeof setInterval>|null>(null);
  const spinIntervals = useRef<ReturnType<typeof setInterval>[]>([]);
  const leafTimer     = useRef<ReturnType<typeof setInterval>|null>(null);
  const betSnapshot   = useRef<{selection:Selection;amount:number}|null>(null);

  const balance = (user as any)?.balance ?? 0;

  /* Inject styles once */
  useEffect(()=>{
    const s=document.createElement("style");s.textContent=STYLES;document.head.appendChild(s);
    return ()=>{ try{document.head.removeChild(s)}catch{} };
  },[]);

  /* Cleanup on unmount */
  useEffect(()=>()=>{
    if(pollTimer.current) clearInterval(pollTimer.current);
    spinIntervals.current.forEach(clearInterval);
    if(leafTimer.current) clearInterval(leafTimer.current);
  },[]);

  /* Launch falling leaves */
  function startLeaves() {
    const leafIcons = ["🍃","🌿","🍀","🌱","🍂","🍁"];
    let id=0;
    if(leafTimer.current) clearInterval(leafTimer.current);
    leafTimer.current = setInterval(()=>{
      setLeaves(prev=>{
        const fresh:LeafParticle={id:id++,x:Math.random()*90,icon:leafIcons[Math.floor(Math.random()*leafIcons.length)],delay:0};
        return [...prev.slice(-18),fresh];
      });
    },120);
    setTimeout(()=>{
      if(leafTimer.current) clearInterval(leafTimer.current);
      setTimeout(()=>setLeaves([]),2000);
    },2500);
  }

  /* Spinning grid animation */
  function startSpinGrid() {
    const all = Array.from({length:9},(_,i)=>i);
    setSpinningIdx(all);
    setSettledIdx([]);
    spinIntervals.current.forEach(clearInterval);
    spinIntervals.current = all.map(idx=>{
      return setInterval(()=>{
        setGrid(g=>{
          const n=[...g];
          n[idx]=ALL_FRUITS[Math.floor(Math.random()*ALL_FRUITS.length)];
          return n;
        });
      }, 80 + idx*10);
    });
  }

  /* Settle grid cell-by-cell with result fruits */
  function settleGrid(resultFruits: string[]) {
    spinIntervals.current.forEach(clearInterval);
    spinIntervals.current=[];
    const order=[0,3,6,1,4,7,2,5,8]; // column-by-column cascade
    order.forEach((idx,step)=>{
      setTimeout(()=>{
        setGrid(g=>{ const n=[...g]; n[idx]=resultFruits[idx]; return n; });
        setSpinningIdx(prev=>prev.filter(i=>i!==idx));
        setSettledIdx(prev=>[...prev,idx]);
        playPop();
      }, step * 140);
    });
  }

  /* Place bet → poll result */
  async function placeBet() {
    if(!selection || bet<=0 || phase!=="betting") return;

    /* Snapshot selection + amount NOW — before any async / re-render */
    const lockedSelection: Selection = selection;
    const lockedBet: number = bet;
    betSnapshot.current = {selection: lockedSelection, amount: lockedBet};

    setPhase("spinning");
    startSpinGrid();
    startLeaves();
    playHarvest();

    try {
      const r = await fetch(`${API}/api/games/fruit-line`,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        credentials:"include",
        body:JSON.stringify({selection:lockedSelection, stake:lockedBet}),
      });
      if(!r.ok){ const e=await r.json().catch(()=>({})); throw new Error(e.error||"Bet failed"); }
      const {roundId} = await r.json();
      roundIdRef.current=roundId;
      qc.invalidateQueries({queryKey:getGetBalanceQueryKey()});
      qc.invalidateQueries({queryKey:getGetMeQueryKey()});

      /* Poll for settlement — use lockedSelection / lockedBet (never stale) */
      if(pollTimer.current) clearInterval(pollTimer.current);
      pollTimer.current = setInterval(async()=>{
        try {
          const pr = await fetch(`${API}/api/games/casino-round/fruit-line/${roundId}`,{credentials:"include"});
          if(!pr.ok) return;
          const data = await pr.json();
          if(data.status==="settled"){
            clearInterval(pollTimer.current!);
            const serverResult: string = (data.result ?? "").trim().toLowerCase();
            const bt = BET_TYPES.find(b=>b.key===lockedSelection)!;
            const won = serverResult === lockedSelection;
            const resultFruits = won
              ? [...bt.fruits]
              : [...(BET_TYPES.find(b=>b.key===serverResult)?.fruits ?? BET_TYPES.find(b=>b.key!==lockedSelection)!.fruits)];
            setPhase("settling");
            settleGrid(resultFruits);
            setTimeout(()=>{
              setPhase("result");
              if(won){
                const payout = lockedBet * bt.mult;
                setWin(payout);
                setResultKey(serverResult);
                setShowOverlay(true);
                playWin();
                startLeaves();
                qc.invalidateQueries({queryKey:getGetBalanceQueryKey()});
                qc.invalidateQueries({queryKey:getGetMeQueryKey()});
              } else {
                setWin(0);
                setResultKey(serverResult);
                toast({
                  title:"No Harvest 🍂",
                  description:`Result was ${serverResult.toUpperCase()}. You bet ${lockedSelection.toUpperCase()}. Try again!`,
                  variant:"destructive",
                });
              }
            }, 9*140+400);
          }
        } catch {}
      },600);

      /* Timeout safety */
      setTimeout(()=>{ if(pollTimer.current) clearInterval(pollTimer.current); },30000);
    } catch(e:any) {
      setPhase("betting");
      spinIntervals.current.forEach(clearInterval);
      setGrid(ALL_FRUITS.slice(0,9));
      toast({title:"Error",description:e.message,variant:"destructive"});
    }
  }

  function collect() {
    setShowOverlay(false);
    setPhase("betting");
    setWin(0);
    setResultKey(null);
    setSelection(null);
    setBet(0);
    setSettledIdx([]);
    setGrid(ALL_FRUITS.slice(0,9));
  }

  function addChip(amt:number) {
    if(phase!=="betting") return;
    setBet(b=>Math.min(b+amt,balance));
    playPop();
  }

  const busy = phase==="spinning"||phase==="settling";
  const selectedBt = BET_TYPES.find(b=>b.key===selection);

  return (
    <div className="fl-bg" style={{fontFamily:"'Segoe UI',system-ui,sans-serif",color:"#fff",position:"relative"}}>
      {/* Leaf particles layer */}
      <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:50,overflow:"hidden"}}>
        {leaves.map(l=>(
          <div key={l.id} style={{
            position:"absolute",top:"-30px",left:`${l.x}%`,
            fontSize:24,animation:`fl-leaf-fall ${1.8+Math.random()*1.2}s ease-in forwards`,
            animationDelay:`${l.delay}ms`,
          }}>{l.icon}</div>
        ))}
      </div>

      {/* Win Overlay */}
      {showOverlay && (
        <div style={{
          position:"fixed",inset:0,zIndex:80,display:"flex",alignItems:"center",justifyContent:"center",
          background:"rgba(0,0,0,0.75)",backdropFilter:"blur(8px)",
        }}>
          <div style={{
            background:"linear-gradient(145deg,#052e16,#14532d,#166534)",
            border:"3px solid #4ade80",borderRadius:28,padding:"36px 32px",textAlign:"center",
            maxWidth:320,width:"90%",
            animation:"fl-overlay-in 0.7s cubic-bezier(.34,1.56,.64,1) forwards",
            boxShadow:"0 0 60px rgba(74,222,128,0.5),0 0 120px rgba(74,222,128,0.2)",
          }}>
            <div style={{fontSize:56,marginBottom:8}}>🏆</div>
            <div style={{fontSize:18,fontWeight:900,color:"#4ade80",letterSpacing:3,marginBottom:4}}>HARVEST WINNER!</div>
            <div style={{fontSize:13,color:"rgba(255,255,255,0.7)",marginBottom:16}}>
              {selectedBt?.label} — {selectedBt?.mult}× Multiplier
            </div>
            <div style={{fontSize:36,fontWeight:900,color:"#f5c542",
              textShadow:"0 0 20px rgba(245,197,66,0.8)",marginBottom:24}}>
              +{formatCurrency(win)}
            </div>
            <div style={{display:"flex",gap:8,flexDirection:"column"}}>
              <button onClick={collect} style={{
                padding:"14px 0",borderRadius:14,border:"none",cursor:"pointer",fontWeight:900,
                fontSize:16,letterSpacing:1,
                background:"linear-gradient(90deg,#4ade80,#22c55e)",color:"#052e16",
              }}>✨ COLLECT HARVEST</button>
              <button onClick={()=>{setShowOverlay(false);setPhase("betting");setWin(0);setResultKey(null);setGrid(ALL_FRUITS.slice(0,9));setSettledIdx([]);}} style={{
                padding:"10px 0",borderRadius:14,border:"1px solid rgba(74,222,128,0.4)",cursor:"pointer",
                background:"transparent",color:"#4ade80",fontSize:14,
              }}>Play Again</button>
            </div>
          </div>
        </div>
      )}

      <div style={{position:"relative",zIndex:10,maxWidth:480,margin:"0 auto",paddingBottom:32}}>
        {/* ── HEADER ── */}
        <div style={{
          display:"flex",alignItems:"center",justifyContent:"space-between",
          padding:"14px 16px",
          background:"rgba(0,0,0,0.5)",
          borderBottom:"1px solid rgba(74,222,128,0.25)",
          backdropFilter:"blur(12px)",
        }}>
          <button onClick={()=>nav("/")} style={{
            background:"rgba(74,222,128,0.12)",border:"1px solid rgba(74,222,128,0.3)",
            borderRadius:10,padding:"7px 12px",color:"#4ade80",cursor:"pointer",
            display:"flex",alignItems:"center",gap:6,fontSize:14,
          }}>
            <ArrowLeft size={16}/> Back
          </button>

          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <img src={`${BASE}fruit-line-logo.jpg`} alt="" style={{height:34,width:34,borderRadius:8,objectFit:"cover"}}
              onError={e=>(e.currentTarget.style.display="none")}/>
            <div>
              <div style={{fontSize:15,fontWeight:900,letterSpacing:2,color:"#4ade80"}}
                className="fl-title-glow">FRUIT LINE</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.5)",letterSpacing:1}}>ORCHARD HARVEST</div>
            </div>
          </div>

          <div style={{
            background:"rgba(74,222,128,0.12)",border:"1px solid rgba(74,222,128,0.3)",
            borderRadius:10,padding:"6px 12px",textAlign:"right",
          }}>
            <div style={{fontSize:9,color:"rgba(255,255,255,0.5)",letterSpacing:1}}>BALANCE</div>
            <div style={{fontSize:13,fontWeight:700,color:"#4ade80"}}>{formatCurrency(balance)}</div>
          </div>
        </div>

        {/* ── NATURE TICKER ── */}
        <div style={{
          background:"rgba(5,46,22,0.8)",borderBottom:"1px solid rgba(74,222,128,0.15)",
          overflow:"hidden",height:28,display:"flex",alignItems:"center",
        }}>
          <div style={{
            whiteSpace:"nowrap",fontSize:11,color:"rgba(74,222,128,0.8)",letterSpacing:0.5,
            animation:"fl-ticker 22s linear infinite",
          }}>
            {TICKER}{TICKER}
          </div>
        </div>

        {/* ── MAIN BOARD: Orchard Machine ── */}
        <div style={{padding:"16px 14px 10px"}}>

          {/* Machine title */}
          <div style={{textAlign:"center",marginBottom:12}}>
            <div style={{fontSize:11,letterSpacing:4,color:"rgba(74,222,128,0.7)",fontWeight:700}}>
              🌾 ORCHARD HARVEST MACHINE 🌾
            </div>
          </div>

          {/* Fruit Grid — the centerpiece */}
          <div style={{
            background:"linear-gradient(145deg,rgba(5,46,22,0.9),rgba(2,20,10,0.95))",
            border:"2px solid rgba(74,222,128,0.35)",
            borderRadius:20,padding:14,
            boxShadow:"inset 0 0 40px rgba(0,0,0,0.6), 0 0 30px rgba(74,222,128,0.1)",
            position:"relative",overflow:"hidden",
          }}>
            {/* Inner sunray glow */}
            <div style={{
              position:"absolute",inset:0,
              background:"radial-gradient(ellipse at 50% -20%,rgba(74,222,128,0.08) 0%,transparent 65%)",
              pointerEvents:"none",
              animation:"fl-sunray 4s ease-in-out infinite",
            }}/>

            {/* Wooden frame border accent */}
            <div style={{
              position:"absolute",inset:6,border:"1px solid rgba(245,197,66,0.2)",
              borderRadius:14,pointerEvents:"none",
            }}/>

            <div style={{position:"relative",zIndex:2}}>
              {/* 3×3 Grid */}
              <div style={{
                display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:14,
              }}>
                {grid.map((fruit,i)=>{
                  const isSpinning = spinningIdx.includes(i);
                  const isSettled  = settledIdx.includes(i);
                  return (
                    <div key={i} style={{
                      aspectRatio:"1",
                      background: isSettled
                        ? (selectedBt ? `${selectedBt.bg}88` : "rgba(20,83,45,0.6)")
                        : "rgba(0,0,0,0.45)",
                      border: isSettled
                        ? `2px solid ${selectedBt?.color ?? "#4ade80"}88`
                        : "2px solid rgba(74,222,128,0.18)",
                      borderRadius:14,
                      display:"flex",alignItems:"center",justifyContent:"center",
                      fontSize:28,
                      animation: isSettled
                        ? "fl-fruit-tumble 0.45s cubic-bezier(.34,1.56,.64,1) forwards"
                        : isSpinning
                        ? "fl-fruit-spin 0.25s linear infinite"
                        : undefined,
                      boxShadow: isSettled && selectedBt
                        ? `0 0 12px ${selectedBt.glow}`
                        : undefined,
                      transition:"border-color 0.3s,box-shadow 0.3s",
                      overflow:"hidden",
                    }}>
                      {fruit}
                    </div>
                  );
                })}
              </div>

              {/* Jackpot pool banner */}
              <div style={{
                background:"linear-gradient(90deg,rgba(245,197,66,0.08),rgba(245,197,66,0.18),rgba(245,197,66,0.08))",
                border:"1px solid rgba(245,197,66,0.3)",
                borderRadius:10,padding:"7px 14px",
                display:"flex",justifyContent:"space-between",alignItems:"center",
              }}>
                <span style={{fontSize:10,letterSpacing:2,color:"rgba(245,197,66,0.7)"}}>🥇 JACKPOT POOL</span>
                <span style={{fontSize:15,fontWeight:900,color:"#f5c542",
                  textShadow:"0 0 12px rgba(245,197,66,0.6)"}}>
                  {formatCurrency(jackpotPool)}
                </span>
              </div>
            </div>
          </div>

          {/* ── PRIZE MEDALLIONS ── */}
          <div style={{marginTop:14,display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
            {BET_TYPES.map(bt=>(
              <div key={bt.key} onClick={()=>{
                if(phase!=="betting") return;
                setSelection(bt.key);
                playPop();
              }} style={{
                background: selection===bt.key ? bt.bg : "rgba(0,0,0,0.4)",
                border: `2px solid ${selection===bt.key ? bt.color : "rgba(255,255,255,0.1)"}`,
                borderRadius:16,padding:"12px 6px",textAlign:"center",cursor:"pointer",
                transition:"all 0.25s",
                boxShadow: selection===bt.key ? `0 0 20px ${bt.glow},0 0 40px ${bt.glow}44` : "none",
                animation: selection===bt.key ? "fl-badge-hover 2.2s ease-in-out infinite" : undefined,
                transform: selection===bt.key ? "translateY(-2px)" : undefined,
              }}>
                <div style={{fontSize:26,marginBottom:3}}>{bt.icon}</div>
                <div style={{fontSize:9,fontWeight:900,letterSpacing:2,
                  color: selection===bt.key ? bt.color : "rgba(255,255,255,0.6)"}}>
                  {bt.label}
                </div>
                <div style={{
                  marginTop:4,fontSize:18,fontWeight:900,
                  color: selection===bt.key ? bt.color : "rgba(255,255,255,0.4)",
                  textShadow: selection===bt.key ? `0 0 14px ${bt.glow}` : undefined,
                }}>
                  {bt.mult}×
                </div>
                <div style={{fontSize:9,color:"rgba(255,255,255,0.45)",marginTop:2}}>{bt.sub}</div>
              </div>
            ))}
          </div>

          {/* ── CHIP TRAY ── */}
          <div style={{marginTop:14}}>
            <div style={{fontSize:9,letterSpacing:3,color:"rgba(255,255,255,0.4)",marginBottom:8,textAlign:"center"}}>
              SELECT BET AMOUNT
            </div>
            <div style={{display:"flex",gap:7,justifyContent:"center",flexWrap:"wrap"}}>
              {CHIP_DEFS.map(c=>(
                <button key={c.amt} onClick={()=>addChip(c.amt)} disabled={busy} style={{
                  width:54,height:54,borderRadius:"50%",border:`3px solid ${c.color}`,cursor:"pointer",
                  background:`radial-gradient(circle at 35% 30%, ${c.color}cc, ${c.color}66)`,
                  color:"#fff",fontSize:10,fontWeight:900,
                  display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:1,
                  boxShadow:`0 4px 14px ${c.color}55`,
                  opacity:busy?0.5:1,
                  transition:"transform 0.15s",
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
            background:"rgba(0,0,0,0.45)",border:"1px solid rgba(74,222,128,0.15)",
            borderRadius:14,overflow:"hidden",
          }}>
            {[
              {label:"WIN",value:formatCurrency(win),color:win>0?"#4ade80":"rgba(255,255,255,0.4)"},
              {label:"BET",value:formatCurrency(bet),color:bet>0?"#f5c542":"rgba(255,255,255,0.4)"},
              {label:"BALANCE",value:formatCurrency(balance),color:"rgba(255,255,255,0.6)"},
            ].map((item,i)=>(
              <div key={i} style={{
                padding:"10px 0",textAlign:"center",
                borderRight:i<2?"1px solid rgba(74,222,128,0.1)":undefined,
              }}>
                <div style={{fontSize:8,letterSpacing:2,color:"rgba(255,255,255,0.35)",marginBottom:3}}>{item.label}</div>
                <div style={{fontSize:13,fontWeight:700,color:item.color}}>{item.value}</div>
              </div>
            ))}
          </div>

          {/* ── HARVEST BUTTON ── */}
          <button
            onClick={placeBet}
            disabled={busy||!selection||bet<=0||phase==="result"}
            className={(!busy&&selection&&bet>0&&phase==="betting")?"fl-btn-harvest":undefined}
            style={{
              marginTop:14,width:"100%",padding:"18px 0",borderRadius:18,border:"none",cursor:"pointer",
              fontSize:17,fontWeight:900,letterSpacing:2,
              background: busy
                ? "linear-gradient(90deg,#166534,#15803d)"
                : (!selection||bet<=0||phase==="result")
                ? "rgba(255,255,255,0.08)"
                : "linear-gradient(90deg,#16a34a,#22c55e,#4ade80,#22c55e,#16a34a)",
              backgroundSize:"200% 100%",
              color: (!selection||bet<=0) ? "rgba(255,255,255,0.3)" : "#052e16",
              opacity: (!selection||bet<=0||phase==="result") && !busy ? 0.5 : 1,
              transition:"all 0.25s",
              animation: (!busy&&selection&&bet>0&&phase==="betting") ? "fl-shimmer 2s linear infinite, fl-harvest-pulse 2.2s ease-in-out infinite" : undefined,
            }}
          >
            {phase==="spinning"   ? "🌀 HARVESTING..." :
             phase==="settling"   ? "🍃 SETTLING..." :
             phase==="result"     ? (win>0?"✨ COLLECT HARVEST!":"🔄 NEXT ROUND") :
             "🌾 HARVEST TIME!"}
          </button>

          {phase==="result"&&win<=0&&(
            <button onClick={collect} style={{
              marginTop:10,width:"100%",padding:"13px 0",borderRadius:14,
              border:"1px solid rgba(74,222,128,0.3)",background:"transparent",
              color:"#4ade80",fontSize:14,fontWeight:700,cursor:"pointer",letterSpacing:1,
            }}>🔄 New Round</button>
          )}

          {/* Phase hint */}
          <div style={{marginTop:10,textAlign:"center",fontSize:11,color:"rgba(255,255,255,0.35)",letterSpacing:1}}>
            {phase==="betting" && !selection && "Pick a harvest type above to begin"}
            {phase==="betting" && selection && bet<=0 && `${selectedBt?.icon} ${selectedBt?.label} selected — add chips to bet`}
            {phase==="betting" && selection && bet>0 && `Ready to harvest! ${selectedBt?.mult}× multiplier if ${selectedBt?.label} wins`}
            {phase==="spinning" && "🌀 Fruits are tumbling... good luck!"}
            {phase==="settling" && "🍃 Harvest settling..."}
            {phase==="result" && resultKey && `Result: ${resultKey.toUpperCase()}`}
          </div>
        </div>
      </div>
    </div>
  );
}
