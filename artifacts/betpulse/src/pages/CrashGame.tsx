import { useState, useCallback, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey, getGetBalanceQueryKey } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Wallet, Volume2, VolumeX, Info, Users, ShieldCheck, History } from "lucide-react";

const CHIP_AMOUNTS = [100, 500, 1000, 5000, 10000];
const API = import.meta.env.BASE_URL.replace(/\/$/, "");

const OPTIONS = [
  { key: "x2",  label: "Cash at 2×",  sub: "2.00×",  color: "#3b82f6", mult: 2.0 },
  { key: "x5",  label: "Cash at 5×",  sub: "5.00×",  color: "#a855f7", mult: 5.0 },
  { key: "x10", label: "Cash at 10×", sub: "10.00×", color: "#ec4899", mult: 10.0 },
];

const INITIAL_HISTORY = [
  { mult: 1.24, color: "#3b82f6" },
  { mult: 2.85, color: "#a855f7" },
  { mult: 1.05, color: "#3b82f6" },
  { mult: 15.40, color: "#ec4899" },
  { mult: 1.98, color: "#3b82f6" },
  { mult: 5.12, color: "#a855f7" },
  { mult: 1.10, color: "#3b82f6" },
  { mult: 33.20, color: "#ec4899" },
  { mult: 2.15, color: "#a855f7" },
];

// SVG viewBox: 0 0 340 220
const VW = 340, VH = 220;
const ORIGIN_X = 24, ORIGIN_Y = 196;

function multToPoint(m: number): [number, number] {
  const t = Math.min((m - 1) / 10, 1);
  const x = ORIGIN_X + t * (VW - ORIGIN_X - 20);
  const y = ORIGIN_Y - Math.pow(t, 0.65) * (VH - 30);
  return [x, y];
}

function angleForPoints(prev: [number, number], curr: [number, number]): number {
  const dx = curr[0] - prev[0];
  const dy = curr[1] - prev[1];
  return Math.atan2(-dy, dx) * (180 / Math.PI);
}

function mkCtx() { return new ((window as any).AudioContext || (window as any).webkitAudioContext)(); }
function playWin() {
  try {
    const c = mkCtx();
    [523, 659, 784, 1047, 1319].forEach((freq, i) => {
      const o = c.createOscillator(); const g = c.createGain();
      o.connect(g); g.connect(c.destination); o.type = "triangle"; o.frequency.value = freq;
      const t = c.currentTime + i * 0.12;
      g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      o.start(t); o.stop(t + 0.45);
    });
    setTimeout(() => c.close(), 2500);
  } catch (_) {}
}
function playLose() {
  try {
    const c = mkCtx();
    [330, 280, 230].forEach((freq, i) => {
      const o = c.createOscillator(); const g = c.createGain();
      o.connect(g); g.connect(c.destination); o.type = "sawtooth"; o.frequency.value = freq;
      const t = c.currentTime + i * 0.22;
      g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      o.start(t); o.stop(t + 0.3);
    });
    setTimeout(() => c.close(), 2000);
  } catch (_) {}
}

// Authentic Red Aviator Aircraft SVG
function AviatorPlaneSVG({ x, y, angle, crashed, propAngle = 0 }: {
  x: number; y: number; angle: number; crashed: boolean; propAngle?: number;
}) {
  if (crashed) {
    return (
      <g transform={`translate(${x},${y})`}>
        <text x="-16" y="8" fontSize="30">💥</text>
      </g>
    );
  }

  const tilt = -angle;
  return (
    <g transform={`translate(${x},${y}) rotate(${tilt})`}>
      {/* Engine Flame Trail */}
      <ellipse cx="-24" cy="0" rx="14" ry="5" fill="url(#exhaustGlow)" opacity="0.85" />

      {/* Main Red Fuselage */}
      <ellipse cx="0" cy="0" rx="22" ry="7.5" fill="#e11d48" />
      <ellipse cx="2" cy="-2.5" rx="16" ry="3.8" fill="#fb7185" opacity="0.7" />

      {/* Nose Cone */}
      <ellipse cx="21" cy="0" rx="6.5" ry="5.5" fill="#9f1239" />

      {/* Cockpit Canopy */}
      <ellipse cx="6" cy="-6" rx="6" ry="4.5" fill="#60a5fa" opacity="0.9" />
      <ellipse cx="6" cy="-6.5" rx="4.5" ry="3" fill="#93c5fd" opacity="0.6" />

      {/* Upper Main Wing */}
      <polygon points="-2,-24 11,-24 16,0 -9,0" fill="#e11d48" />
      <polygon points="-2,-24 11,-24 11,-20 -1,-20" fill="#f43f5e" opacity="0.6" />

      {/* Lower Wing Stub */}
      <polygon points="-2,9 9,9 11,0 -6,0" fill="#9f1239" />

      {/* Tail Fin */}
      <polygon points="-18,-15 -13,0 -10,0" fill="#e11d48" />

      {/* White Stripe Decal */}
      <line x1="-10" y1="-1" x2="14" y2="-1" stroke="#ffffff" strokeWidth="1.5" opacity="0.8" />

      {/* Spinning Propeller */}
      <circle cx="27" cy="0" r="3.5" fill="#1f2937" />
      <g transform={`rotate(${propAngle}, 27, 0)`}>
        <ellipse cx="27" cy="0" rx="1.8" ry="12" fill="#374151" opacity="0.9" />
        <ellipse cx="27" cy="0" rx="1.8" ry="12" fill="#1f2937" opacity="0.8" transform="rotate(90,27,0)" />
      </g>

      <defs>
        <radialGradient id="exhaustGlow" cx="100%" cy="50%" r="100%">
          <stop offset="0%" stopColor="#ff4500" stopOpacity="0.9" />
          <stop offset="60%" stopColor="#e11d48" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#e11d48" stopOpacity="0" />
        </radialGradient>
      </defs>
    </g>
  );
}

export default function CrashGame() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [stake, setStake] = useState(500);
  const [selection, setSelection] = useState<string | null>("x2");
  const [phase, setPhase] = useState<"betting" | "waiting" | "result">("betting");
  const [result, setResult] = useState<any>(null);
  const [balance, setBalance] = useState<number>(parseFloat(String(user?.balance || "0")));
  const [isPlacing, setIsPlacing] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "my" | "top">("all");
  const [showHowToPlay, setShowHowToPlay] = useState(false);

  // History Pills
  const [history, setHistory] = useState(INITIAL_HISTORY);

  // Animation state
  const [displayMult, setDisplayMult] = useState(1.00);
  const [pathPoints, setPathPoints] = useState<[number, number][]>([[ORIGIN_X, ORIGIN_Y]]);
  const [planeAngle, setPlaneAngle] = useState(25);
  const [crashed, setCrashed] = useState(false);
  const [cashedOut, setCashedOut] = useState(false);
  const [propAngle, setPropAngle] = useState(0);

  const animRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);
  const resultRef = useRef<any>(null);
  const selectionRef = useRef<string | null>("x2");
  const resultArrivedAtRef = useRef<number | null>(null);
  const multAtResultRef = useRef<number>(1);

  useEffect(() => { setBalance(parseFloat(String(user?.balance || "0"))); }, [user?.balance]);

  useEffect(() => {
    resultRef.current = result;
    if (result && resultArrivedAtRef.current === null) {
      resultArrivedAtRef.current = Date.now();
      multAtResultRef.current = displayMult;
    }
  }, [result, displayMult]);

  useEffect(() => { selectionRef.current = selection; }, [selection]);

  const stopAnim = useCallback(() => {
    if (animRef.current) { clearInterval(animRef.current); animRef.current = null; }
  }, []);

  const startFlyingAnim = useCallback(() => {
    stopAnim();
    startTimeRef.current = Date.now();
    resultArrivedAtRef.current = null;
    multAtResultRef.current = 1;
    setDisplayMult(1.00);
    setPathPoints([[ORIGIN_X, ORIGIN_Y]]);
    setCrashed(false);
    setCashedOut(false);
    setPhase("waiting");

    animRef.current = setInterval(() => {
      const currentResult = resultRef.current;
      const sel = selectionRef.current;
      setPropAngle(a => (a + 25) % 360);

      if (currentResult && resultArrivedAtRef.current !== null) {
        const sinceResult = (Date.now() - resultArrivedAtRef.current) / 1000;
        const won = currentResult.result === sel;
        const crashOpt = OPTIONS.find(o => o.key === currentResult.result);
        const targetMult = crashOpt?.mult ?? 2.0;
        const startMult = multAtResultRef.current;

        let m: number;
        if (startMult >= targetMult) {
          m = startMult;
        } else {
          const progress = Math.min(sinceResult / 1.5, 1);
          m = startMult + (targetMult - startMult) * Math.pow(progress, 0.7);
        }

        setDisplayMult(m);
        const pt = multToPoint(m);
        const totalElapsed = (Date.now() - startTimeRef.current) / 1000;
        const damping = Math.max(0, 1 - sinceResult / 1.2);
        const wave = Math.sin(totalElapsed * 3.2) * 8 * damping;
        const wavePt: [number, number] = [pt[0], pt[1] + wave];

        setPathPoints(prev => {
          const last = prev[prev.length - 1];
          const ang = last ? angleForPoints(last, wavePt) : 25;
          setPlaneAngle(ang);
          return [...prev, wavePt];
        });

        const done = startMult >= targetMult ? sinceResult >= 0.2 : sinceResult >= 1.5;
        if (done) {
          stopAnim();
          if (won) setCashedOut(true); else setCrashed(true);

          // Append to history
          const color = targetMult >= 10 ? "#ec4899" : targetMult >= 2 ? "#a855f7" : "#3b82f6";
          setHistory(prev => [{ mult: targetMult, color }, ...prev.slice(0, 12)]);
        }
        return;
      }

      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const m = Math.min(1 + elapsed * 0.35 + elapsed * elapsed * 0.02, 10.0);
      setDisplayMult(m);
      const pt = multToPoint(m);

      const wave = Math.sin(elapsed * 3.2) * 8;
      const wavePt: [number, number] = [pt[0], pt[1] + wave];

      setPathPoints(prev => {
        const last = prev[prev.length - 1];
        const ang = last ? angleForPoints(last, wavePt) : 25;
        setPlaneAngle(ang);
        return [...prev, wavePt];
      });
    }, 35);
  }, [stopAnim]);

  useEffect(() => { stopAnim(); }, [stopAnim]);

  const pollRound = useCallback(async (rId: string, sel: string) => {
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      if (attempts > 240) { clearInterval(interval); setPhase("betting"); return; }
      try {
        const r = await fetch(`${API}/api/games/casino-round/crash/${rId}`, { credentials: "include" });
        const data = await r.json();
        if (data.status === "settled") {
          clearInterval(interval);
          setResult(data);
          setTimeout(() => {
            setPhase("result");
            if (soundEnabled) {
              if (data.result === sel) playWin(); else playLose();
            }
            queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetBalanceQueryKey() });
          }, 1800);
        }
      } catch (_) {}
    }, 500);
  }, [queryClient, soundEnabled]);

  const placeBet = async () => {
    if (!isAuthenticated) { setLocation("/login"); return; }
    if (!selection) { toast({ title: "Select a cashout target!", variant: "destructive" }); return; }
    if (balance < stake) { toast({ title: "Insufficient balance!", variant: "destructive" }); return; }
    setIsPlacing(true);
    try {
      const r = await fetch(`${API}/api/games/crash`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stake, selection }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Failed to place bet");
      setBalance(data.newBalance);
      setResult(null);
      startFlyingAnim();
      pollRound(data.roundId, selection);
      const opt = OPTIONS.find(o => o.key === selection);
      toast({ title: "✈️ Bet Placed!", description: `PKR ${stake.toLocaleString()} at ${opt?.sub}` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsPlacing(false);
    }
  };

  const reset = () => {
    stopAnim();
    setPhase("betting");
    setResult(null);
    setDisplayMult(1.00);
    setPathPoints([[ORIGIN_X, ORIGIN_Y]]);
    setCrashed(false);
    setCashedOut(false);
  };

  const won = result?.result === selection;
  const selectedOpt = OPTIONS.find(o => o.key === selection);
  const currentPt = pathPoints[pathPoints.length - 1] ?? [ORIGIN_X, ORIGIN_Y];

  // Dummy Live Bets Feed for Aviator Community Vibe
  const dummyLiveBets = [
    { user: "user_891", bet: 1000, mult: "1.45x", payout: 1450, isWin: true },
    { user: "ali_king", bet: 5000, mult: "2.10x", payout: 10500, isWin: true },
    { user: "zain_786", bet: 500, mult: "Flew Away", payout: 0, isWin: false },
    { user: "kami_pro", bet: 2500, mult: "5.00x", payout: 12500, isWin: true },
    { user: "player_99", bet: 10000, mult: "Flew Away", payout: 0, isWin: false },
  ];

  return (
    <div className="min-h-screen flex flex-col text-white font-sans select-none" style={{ background: "#0e0f12" }}>

      {/* ── TOP AVIATOR NAVBAR ── */}
      <header className="flex items-center justify-between px-3 py-2 border-b border-gray-800/80 bg-[#141518]">
        <div className="flex items-center gap-3">
          <button onClick={() => setLocation("/")} className="p-1.5 rounded-lg bg-gray-800/60 hover:bg-gray-700 text-gray-300">
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xl">✈️</span>
            <span className="font-black text-xl tracking-wider text-rose-500">
              AVIATOR
            </span>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Users size={10} /> 18.4K Live
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-900 border border-amber-500/30 text-amber-400 font-mono font-bold text-xs">
            <Wallet size={13} /> {formatCurrency(balance)}
          </div>

          <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-2 rounded-xl bg-gray-800/60 text-gray-400 hover:text-white">
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <button onClick={() => setShowHowToPlay(true)} className="p-2 rounded-xl bg-gray-800/60 text-gray-400 hover:text-white">
            <Info size={16} />
          </button>
        </div>
      </header>

      {/* ── MULTIPLIER HISTORY BAR ── */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#181a1f] border-b border-gray-800 overflow-x-auto scrollbar-none text-xs">
        <span className="text-gray-500 font-bold flex items-center gap-1 shrink-0 text-[10px] uppercase mr-1">
          <History size={12} /> History
        </span>
        {history.map((h, i) => (
          <span
            key={i}
            className="px-2.5 py-0.5 rounded-full font-extrabold font-mono shrink-0 text-[11px] border"
            style={{
              color: h.color,
              borderColor: `${h.color}40`,
              background: `${h.color}15`,
            }}
          >
            {h.mult.toFixed(2)}x
          </span>
        ))}
      </div>

      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full p-3 gap-3">

        {/* ── MAIN FLIGHT RADAR DISPLAY ── */}
        <div className="relative rounded-2xl overflow-hidden border border-gray-800 bg-[#0c0c0e] flex-1 flex flex-col justify-between"
          style={{ minHeight: 270, boxShadow: "0 10px 40px rgba(0,0,0,0.8)" }}>

          {/* Grid lines background */}
          <div className="absolute inset-0 pointer-events-none opacity-20"
            style={{ backgroundImage: "linear-gradient(to right, #2a2d34 1px, transparent 1px), linear-gradient(to bottom, #2a2d34 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

          {/* Glowing Center Multiplier / Status */}
          <div className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none">
            {crashed ? (
              <div className="text-center animate-in fade-in zoom-in duration-200">
                <div className="text-3xl md:text-5xl font-black text-rose-500 uppercase tracking-widest drop-shadow-[0_0_20px_rgba(225,29,72,0.8)]">
                  FLEW AWAY!
                </div>
                <div className="text-lg md:text-2xl font-bold font-mono text-gray-400 mt-1">
                  @ {displayMult.toFixed(2)}x
                </div>
              </div>
            ) : cashedOut ? (
              <div className="text-center animate-in fade-in zoom-in duration-200">
                <div className="text-3xl md:text-5xl font-black text-emerald-400 uppercase tracking-widest drop-shadow-[0_0_20px_rgba(16,185,129,0.8)]">
                  CASHED OUT!
                </div>
                <div className="text-xl font-bold font-mono text-amber-400 mt-1">
                  +{formatCurrency(stake * (selectedOpt?.mult ?? 2) - stake)}
                </div>
              </div>
            ) : phase === "waiting" ? (
              <div className="text-center">
                <div className="text-5xl md:text-7xl font-black font-mono tracking-tight text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.4)]">
                  {displayMult.toFixed(2)}x
                </div>
              </div>
            ) : (
              <div className="text-center">
                <div className="text-4xl md:text-6xl text-rose-500/80 mb-2 animate-pulse">✈️</div>
                <div className="text-sm font-bold text-gray-400 uppercase tracking-widest">
                  WAITING FOR NEXT ROUND
                </div>
                <div className="text-xs text-gray-500 mt-1">Place your bet below to take off</div>
              </div>
            )}
          </div>

          {/* SVG Flight Canvas */}
          <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full h-full min-h-[220px]" preserveAspectRatio="none">
            {/* Grid Coordinates */}
            {[40, 80, 120, 160].map(y => (
              <line key={y} x1={ORIGIN_X} y1={y} x2={VW} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="3 3" />
            ))}
            {[80, 160, 240, 320].map(x => (
              <line key={x} x1={x} y1="0" x2={x} y2={ORIGIN_Y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="3 3" />
            ))}

            {/* Flight Trajectory Fill & Line */}
            {pathPoints.length > 1 && (
              <>
                <polyline
                  points={[...pathPoints, [currentPt[0], ORIGIN_Y], [ORIGIN_X, ORIGIN_Y]].map(p => p.join(",")).join(" ")}
                  fill="url(#trajectoryFill)" opacity="0.35" />
                <polyline
                  points={pathPoints.map(p => p.join(",")).join(" ")}
                  fill="none" stroke="#e11d48" strokeWidth="3.5" strokeLinecap="round"
                  style={{ filter: "drop-shadow(0 0 6px #e11d48)" }} />
              </>
            )}

            {/* Aircraft */}
            {phase === "waiting" && (
              <AviatorPlaneSVG x={currentPt[0]} y={currentPt[1]} angle={planeAngle} crashed={crashed} propAngle={propAngle} />
            )}

            <defs>
              <linearGradient id="trajectoryFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#e11d48" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#e11d48" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* ── SPRIBE AVIATOR BETTING CONTROLS PANEL ── */}
        <div className="bg-[#141518] rounded-2xl p-3.5 border border-gray-800">

          {/* Cashout Target Selector */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
              <span>Auto Cash Out Target</span>
              <span className="text-amber-400">Target: {selectedOpt?.sub ?? "2.00x"}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {OPTIONS.map(opt => {
                const isSel = selection === opt.key;
                return (
                  <button
                    key={opt.key}
                    disabled={phase === "waiting"}
                    onClick={() => setSelection(opt.key)}
                    className={`py-2.5 px-3 rounded-xl flex items-center justify-between font-bold text-xs transition-all border ${
                      isSel
                        ? "border-rose-500 bg-rose-500/15 text-white shadow-lg shadow-rose-500/20"
                        : "border-gray-800 bg-gray-900/60 text-gray-400 hover:border-gray-700"
                    }`}
                  >
                    <span>{opt.label}</span>
                    <span className="text-rose-400 font-mono">{opt.sub}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chip Quick Selectors */}
          <div className="mb-4">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Bet Amount (PKR)</div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {CHIP_AMOUNTS.map(amt => (
                <button
                  key={amt}
                  disabled={phase === "waiting"}
                  onClick={() => setStake(amt)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold font-mono transition-all border ${
                    stake === amt
                      ? "border-amber-400 bg-amber-400 text-gray-950"
                      : "border-gray-800 bg-gray-900 text-gray-300 hover:border-gray-700"
                  }`}
                >
                  {amt >= 1000 ? `${amt / 1000}K` : amt}
                </button>
              ))}
              <button
                disabled={phase === "waiting"}
                onClick={() => setStake(s => s * 2)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-extrabold bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700"
              >
                2x
              </button>
            </div>
          </div>

          {/* Main Action Button (BET / CASH OUT) */}
          {phase === "result" ? (
            <button
              onClick={reset}
              className="w-full py-4 rounded-xl font-black text-base uppercase tracking-wider bg-gradient-to-r from-amber-400 to-amber-500 text-gray-950 hover:brightness-110 shadow-lg shadow-amber-500/25 transition-all"
            >
              PLAY NEXT ROUND ✈️
            </button>
          ) : phase === "waiting" ? (
            <div className="w-full py-4 rounded-xl font-black text-center text-sm uppercase tracking-wider bg-rose-900/40 border border-rose-500/30 text-rose-300 animate-pulse">
              ✈️ FLIGHT IN PROGRESS · CASHING OUT AT {selectedOpt?.sub}
            </div>
          ) : (
            <button
              onClick={placeBet}
              disabled={isPlacing}
              className="w-full py-4 rounded-xl font-black text-base uppercase tracking-wider bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:brightness-110 shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50"
            >
              {isPlacing ? "BETTING..." : `BET ${formatCurrency(stake)} ✈️`}
            </button>
          )}
        </div>

        {/* ── LIVE BETS COMMUNITY FEED ── */}
        <div className="bg-[#141518] rounded-2xl p-3 border border-gray-800">
          <div className="flex items-center justify-between border-b border-gray-800 pb-2 mb-2 text-xs font-bold">
            <div className="flex gap-4">
              <button onClick={() => setActiveTab("all")} className={activeTab === "all" ? "text-rose-500 border-b-2 border-rose-500 pb-0.5" : "text-gray-400"}>All Bets</button>
              <button onClick={() => setActiveTab("my")} className={activeTab === "my" ? "text-rose-500 border-b-2 border-rose-500 pb-0.5" : "text-gray-400"}>My Bets</button>
            </div>
            <span className="text-[10px] text-gray-500 uppercase flex items-center gap-1"><ShieldCheck size={12} className="text-emerald-500" /> Provably Fair</span>
          </div>

          <div className="space-y-1.5 text-xs">
            {dummyLiveBets.map((b, i) => (
              <div key={i} className="flex items-center justify-between py-1 px-2 rounded-lg bg-gray-900/40">
                <span className="text-gray-400 font-mono">{b.user}</span>
                <span className="font-mono text-gray-300">PKR {b.bet}</span>
                <span className={`font-mono font-bold ${b.isWin ? "text-emerald-400" : "text-rose-500"}`}>{b.mult}</span>
                <span className="font-mono font-bold text-amber-400">{b.isWin ? `+${formatCurrency(b.payout)}` : "-"}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* How To Play Modal */}
      {showHowToPlay && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141518] border border-gray-800 rounded-2xl p-5 max-w-sm w-full text-center">
            <h3 className="text-xl font-black text-rose-500 mb-2">How to Play Aviator</h3>
            <p className="text-xs text-gray-300 mb-4 leading-relaxed">
              1. Place your bet before the plane takes off.<br />
              2. Watch the multiplier rise as the plane ascends.<br />
              3. Cash out before the plane flies away to win your multiplier!
            </p>
            <button onClick={() => setShowHowToPlay(false)} className="w-full py-2.5 rounded-xl font-bold bg-rose-500 text-white">Got it!</button>
          </div>
        </div>
      )}
    </div>
  );
}
