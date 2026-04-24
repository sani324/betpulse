import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey, getGetBalanceQueryKey } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, RefreshCw } from "lucide-react";

// ─── Roulette constants ────────────────────────────────────────────────────────
const WHEEL_ORDER = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const RED_NUMS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const BLACK_NUMS_ARR = [2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35];
const RED_NUMS_ARR   = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
const SEG  = 360 / 37;
const D2R  = Math.PI / 180;
const CHIP_AMOUNTS = [100, 500, 1000, 5000, 10000];

function numColor(n: number): string {
  if (n === 0) return "#16a34a";
  return RED_NUMS.has(n) ? "#b91c1c" : "#111827";
}
function numLabel(n: number): "red" | "black" | "green" {
  if (n === 0) return "green";
  return RED_NUMS.has(n) ? "red" : "black";
}
function pickWinNumber(result: string): number {
  if (result === "green") return 0;
  const pool = result === "red" ? RED_NUMS_ARR : BLACK_NUMS_ARR;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ─── SVG Wheel ────────────────────────────────────────────────────────────────
function sector(i: number, cx: number, cy: number, r: number) {
  const s = (i * SEG - 90) * D2R;
  const e = ((i + 1) * SEG - 90) * D2R;
  const x1 = cx + r * Math.cos(s), y1 = cy + r * Math.sin(s);
  const x2 = cx + r * Math.cos(e), y2 = cy + r * Math.sin(e);
  return `M${cx} ${cy}L${x1.toFixed(2)} ${y1.toFixed(2)}A${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}Z`;
}
function midPos(i: number, cx: number, cy: number, r: number) {
  const a = ((i + 0.5) * SEG - 90) * D2R;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), rot: (i + 0.5) * SEG };
}

function WheelSVG({ rotation, settling }: { rotation: number; settling: boolean }) {
  const cx = 100, cy = 100;
  return (
    <svg width={200} height={200} style={{ overflow: "visible",
      transform: `rotate(${rotation}deg)`,
      transition: settling ? "transform 5s cubic-bezier(0.1,0.7,0.05,1.0)" : "none",
    }}>
      {/* Outer wooden rim */}
      <circle cx={cx} cy={cy} r={99} fill="#5c2d00" />
      <circle cx={cx} cy={cy} r={96} fill="#3d1a00" />

      {/* Coloured sectors */}
      {WHEEL_ORDER.map((num, i) => {
        const mp = midPos(i, cx, cy, 74);
        const rot90 = mp.rot + 90;
        return (
          <g key={i}>
            <path d={sector(i, cx, cy, 93)} fill={numColor(num)} stroke="#3d1a00" strokeWidth={0.7} />
            <text x={mp.x.toFixed(1)} y={mp.y.toFixed(1)}
              fill="white" fontSize={num >= 10 ? "6" : "7"} fontWeight="900"
              textAnchor="middle" dominantBaseline="middle" fontFamily="Arial,sans-serif"
              transform={`rotate(${rot90.toFixed(1)},${mp.x.toFixed(1)},${mp.y.toFixed(1)})`}>
              {num}
            </text>
          </g>
        );
      })}

      {/* Divider lines */}
      {WHEEL_ORDER.map((_, i) => {
        const a = (i * SEG - 90) * D2R;
        const x1 = cx + 24 * Math.cos(a), y1 = cy + 24 * Math.sin(a);
        const x2 = cx + 93 * Math.cos(a), y2 = cy + 93 * Math.sin(a);
        return <line key={i} x1={x1.toFixed(1)} y1={y1.toFixed(1)} x2={x2.toFixed(1)} y2={y2.toFixed(1)} stroke="#c8952a" strokeWidth={0.4} opacity={0.7} />;
      })}

      {/* Outer gold ring */}
      <circle cx={cx} cy={cy} r={93.5} fill="none" stroke="#c8952a" strokeWidth={2.5} />
      <circle cx={cx} cy={cy} r={96.5} fill="none" stroke="#7a5518" strokeWidth={1} />

      {/* Inner hub */}
      <circle cx={cx} cy={cy} r={24} fill="#2d1200" stroke="#c8952a" strokeWidth={1.5} />
      <circle cx={cx} cy={cy} r={16} fill="#1a0800" stroke="#8b6520" strokeWidth={1} />
      <circle cx={cx} cy={cy} r={7}  fill="#c8952a" />
      <circle cx={cx} cy={cy} r={3}  fill="#f5c542" />
    </svg>
  );
}

// ─── Number grid ──────────────────────────────────────────────────────────────
const GRID_ROWS = [
  [3,6,9,12,15,18,21,24,27,30,33,36],
  [2,5,8,11,14,17,20,23,26,29,32,35],
  [1,4,7,10,13,16,19,22,25,28,31,34],
];

function NumberGrid({ selection, onSelect, disabled }: {
  selection: string | null;
  onSelect: (s: "red" | "black" | "green") => void;
  disabled: boolean;
}) {
  return (
    <div style={{ overflowX: "auto", paddingBottom: 4 }}>
      <div style={{ display: "flex", gap: 2, minWidth: "max-content" }}>
        {/* 0 cell */}
        <button
          onClick={() => !disabled && onSelect("green")}
          disabled={disabled}
          style={{
            width: 28, height: 3 * 26 + 2 * 2, borderRadius: 4,
            background: selection === "green" ? "#16a34a" : "#0f5c28",
            border: `2px solid ${selection === "green" ? "#86efac" : "rgba(255,255,255,0.15)"}`,
            color: "white", fontWeight: 900, fontSize: 13, cursor: disabled ? "not-allowed" : "pointer",
            writingMode: "vertical-rl", textOrientation: "mixed", display: "flex",
            alignItems: "center", justifyContent: "center",
            boxShadow: selection === "green" ? "0 0 10px rgba(34,197,94,0.6)" : undefined,
          }}>0</button>

        {/* Rows of numbers */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {GRID_ROWS.map((row, ri) => (
            <div key={ri} style={{ display: "flex", gap: 2 }}>
              {row.map(num => {
                const color = numLabel(num);
                const isSelected = selection === color;
                return (
                  <button key={num}
                    onClick={() => !disabled && onSelect(color)}
                    disabled={disabled}
                    style={{
                      width: 26, height: 26, borderRadius: 3, fontSize: 9, fontWeight: 900,
                      background: isSelected
                        ? (color === "red" ? "#dc2626" : "#374151")
                        : (color === "red" ? "#991b1b" : "#1f2937"),
                      border: `1.5px solid ${isSelected ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.12)"}`,
                      color: "white", cursor: disabled ? "not-allowed" : "pointer",
                      boxShadow: isSelected ? "0 0 6px rgba(255,255,255,0.4)" : undefined,
                      transition: "all 0.15s",
                    }}>
                    {num}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Outside bets row */}
      <div style={{ display: "flex", gap: 2, marginTop: 4 }}>
        <div style={{ width: 28 }} /> {/* spacer for 0 */}
        {[
          { label: "1ST 12", color: "#6b7280", sel: null },
          { label: "2ND 12", color: "#6b7280", sel: null },
          { label: "3RD 12", color: "#6b7280", sel: null },
        ].map((b, i) => (
          <div key={i} style={{ flex: 1, minWidth: 102, height: 20, borderRadius: 3, background: "rgba(107,114,128,0.2)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: "rgba(255,255,255,0.45)", fontWeight: 700, letterSpacing: 1 }}>
            {b.label}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 2, marginTop: 2 }}>
        <div style={{ width: 28 }} />
        {[
          { label: "1-18", col: "#4b5563", sel: null },
          { label: "EVEN", col: "#4b5563", sel: null },
          { label: "RED", col: "#991b1b", sel: "red" as const },
          { label: "BLACK", col: "#1f2937", sel: "black" as const },
          { label: "ODD", col: "#4b5563", sel: null },
          { label: "19-36", col: "#4b5563", sel: null },
        ].map((b, i) => (
          <button key={i}
            onClick={() => b.sel && !disabled && onSelect(b.sel)}
            disabled={disabled || !b.sel}
            style={{
              flex: 1, height: 20, borderRadius: 3,
              background: selection === b.sel && b.sel ? (b.sel === "red" ? "#dc2626" : "#374151") : b.col,
              border: `1.5px solid ${selection === b.sel && b.sel ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.1)"}`,
              color: "white", fontSize: 7.5, fontWeight: 900, cursor: (disabled || !b.sel) ? "default" : "pointer",
              letterSpacing: 0.5,
            }}>
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Audio ─────────────────────────────────────────────────────────────────────
function mkCtx() { return new ((window as any).AudioContext || (window as any).webkitAudioContext)(); }
function playBallTick() {
  try {
    const c = mkCtx(); const o = c.createOscillator(); const g = c.createGain();
    o.connect(g); g.connect(c.destination); o.type = "sine"; o.frequency.value = 1200;
    g.gain.setValueAtTime(0.06, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.05);
    o.start(); o.stop(c.currentTime + 0.05); setTimeout(() => c.close(), 300);
  } catch {}
}
function playWin() {
  try {
    const c = mkCtx();
    [523, 659, 784, 1047, 1319].forEach((f, i) => {
      const o = c.createOscillator(); const g = c.createGain();
      o.connect(g); g.connect(c.destination); o.type = "triangle"; o.frequency.value = f;
      const t = c.currentTime + i * 0.13;
      g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      o.start(t); o.stop(t + 0.45);
    });
    setTimeout(() => c.close(), 2500);
  } catch {}
}
function playLose() {
  try {
    const c = mkCtx();
    [350, 300, 240].forEach((f, i) => {
      const o = c.createOscillator(); const g = c.createGain();
      o.connect(g); g.connect(c.destination); o.type = "sawtooth"; o.frequency.value = f;
      const t = c.currentTime + i * 0.2;
      g.gain.setValueAtTime(0.1, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      o.start(t); o.stop(t + 0.28);
    });
    setTimeout(() => c.close(), 2000);
  } catch {}
}

// ─── Main Component ────────────────────────────────────────────────────────────
type Phase = "betting" | "rolling" | "settling" | "result";

export default function RouletteGame() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [phase, setPhase]           = useState<Phase>("betting");
  const [selection, setSelection]   = useState<"red" | "black" | "green" | null>(null);
  const [stake, setStake]           = useState(500);
  const [customStake, setCustomStake] = useState("");
  const [wheelRotation, setWheelRotation] = useState(0);
  const [isSettling, setIsSettling] = useState(false);
  const [winNumber, setWinNumber]   = useState<number | null>(null);
  const [result, setResult]         = useState<{ result: string; won: boolean; winAmount: number; newBalance: number } | null>(null);
  const [history, setHistory]       = useState<number[]>([]);

  const rotRef    = useRef(0);
  const spinIvRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickIvRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearAll = () => {
    if (spinIvRef.current) { clearInterval(spinIvRef.current); spinIvRef.current = null; }
    if (tickIvRef.current) { clearInterval(tickIvRef.current); tickIvRef.current = null; }
    timersRef.current.forEach(clearTimeout); timersRef.current = [];
  };
  useEffect(() => () => clearAll(), []);

  const balance = user?.balance ?? 0;
  const canSpin = !!selection && stake > 0 && stake <= balance && phase === "betting";

  const handleSpin = async () => {
    if (!canSpin) { toast({ title: !selection ? "Pick Red, Black, or Zero" : "Enter a valid stake", variant: "destructive" }); return; }
    if (!isAuthenticated) { setLocation("/login"); return; }
    clearAll();
    setPhase("rolling"); setWinNumber(null); setResult(null); setIsSettling(false);

    // Start wheel spin
    rotRef.current = wheelRotation;
    spinIvRef.current = setInterval(() => {
      rotRef.current += 10;
      setWheelRotation(rotRef.current);
    }, 16); // ~60fps, 625°/sec ≈ 1.7 rotations/sec

    // Ball click sound
    tickIvRef.current = setInterval(playBallTick, 120);

    try {
      const resp = await fetch("/api/games/roulette", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ stake, selection }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        toast({ title: "Bet Failed", description: err.error || "Something went wrong", variant: "destructive" });
        clearAll(); setPhase("betting"); return;
      }
      const placed = await resp.json();
      const balanceAfterBet = placed.newBalance as number;
      const roundId = placed.roundId as string;
      const mySel = selection!, myStake = stake;
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetBalanceQueryKey() });

      const startedAt = Date.now();
      const pollId = setInterval(async () => {
        if (Date.now() - startedAt > 10 * 60 * 1000) { clearInterval(pollId); return; }
        try {
          const r = await fetch(`/api/games/casino-round/roulette/${encodeURIComponent(roundId)}`, { credentials: "include" });
          if (!r.ok) return;
          const d = await r.json();
          if (d.status !== "settled") return;
          clearInterval(pollId);

          const resultColor = d.result as string;
          const winNum = pickWinNumber(resultColor);
          const won = resultColor === mySel;
          const mult = mySel === "green" ? 14 : 1.95;
          const winAmount = won ? Math.round(myStake * mult * 100) / 100 : 0;

          // Stop spinning, calculate target rotation
          if (spinIvRef.current) { clearInterval(spinIvRef.current); spinIvRef.current = null; }
          if (tickIvRef.current) { clearInterval(tickIvRef.current); tickIvRef.current = null; }

          const winIndex = WHEEL_ORDER.indexOf(winNum);
          const targetInCycle = (37 - winIndex) * SEG + SEG / 2;
          const currentMod = rotRef.current % 360;
          let extra = targetInCycle - currentMod;
          if (extra < 0) extra += 360;
          const finalRotation = rotRef.current + extra + 7 * 360; // 7 more full spins while decelerating
          rotRef.current = finalRotation;

          setPhase("settling");
          setIsSettling(true);
          setWheelRotation(finalRotation);

          // After settle animation (5s) show result
          const t = setTimeout(() => {
            setIsSettling(false);
            setWinNumber(winNum);
            setHistory(h => [winNum, ...h].slice(0, 8));
            setResult({ result: resultColor, won, winAmount, newBalance: balanceAfterBet + winAmount });
            setPhase("result");
            queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetBalanceQueryKey() });
            if (won) playWin(); else playLose();
          }, 5200);
          timersRef.current.push(t);
        } catch {}
      }, 500);
    } catch {
      toast({ title: "Network Error", variant: "destructive" });
      clearAll(); setPhase("betting");
    }
  };

  const handlePlayAgain = () => {
    clearAll(); setPhase("betting"); setResult(null); setWinNumber(null); setIsSettling(false);
  };

  if (isLoading) return <div className="flex h-screen items-center justify-center" style={{ background: "#08080f" }}><div className="h-10 w-10 animate-spin rounded-full border-4 border-yellow-500 border-t-transparent" /></div>;

  const winColor = winNumber !== null ? numLabel(winNumber) : null;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(160deg, #08080f 0%, #100a00 100%)" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid rgba(200,149,42,0.2)", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(10px)" }}>
        <button onClick={() => setLocation("/")} style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.5)", background: "none", border: "none", cursor: "pointer" }}>
          <ArrowLeft size={18} /><span style={{ fontSize: 13 }}>Back</span>
        </button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 17, fontWeight: 900, letterSpacing: 4, color: "#f5c542", fontFamily: "Georgia,serif" }}>🎡 ROULETTE</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: 1 }}>Spin the wheel — Red, Black, or Zero?</div>
        </div>
        <div style={{ textAlign: "right", minWidth: 80 }}>
          {isAuthenticated ? (
            <><div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: 1 }}>BALANCE</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: "#f5c542", fontFamily: "monospace" }}>{formatCurrency(result?.newBalance ?? balance)}</div></>
          ) : (
            <button onClick={() => setLocation("/login")} style={{ color: "#f5c542", fontSize: 12, background: "none", border: "none", cursor: "pointer" }}>Login</button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 20px", maxWidth: 520, margin: "0 auto", width: "100%" }}>

        {/* ═══ CASINO TABLE ═══ */}
        <div style={{
          position: "relative",
          background: "radial-gradient(ellipse at 50% 30%, #1e7038 0%, #0e4d20 45%, #083018 75%, #041a0c 100%)",
          borderRadius: "46% 46% 44% 44% / 18% 18% 16% 16%",
          border: "5px solid #c8952a",
          boxShadow: "0 0 0 2px #7a5518, 0 0 0 8px rgba(200,149,42,0.12), inset 0 0 120px rgba(0,0,0,0.35), 0 24px 60px rgba(0,0,0,0.7)",
          padding: "28px 16px 52px",
          marginBottom: 14,
        }}>
          {/* Felt sheen */}
          <div style={{ position: "absolute", top: 0, left: "8%", right: "8%", height: "45%", background: "radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.07) 0%, transparent 70%)", pointerEvents: "none", borderRadius: "50%/30%" }} />

          {/* Wheel section */}
          <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ position: "relative", width: 200, height: 200 }}>
              {/* Outer glow */}
              <div style={{ position: "absolute", inset: -6, borderRadius: "50%", boxShadow: "0 0 30px rgba(200,149,42,0.4), 0 0 80px rgba(200,149,42,0.15)", pointerEvents: "none" }} />
              {/* Double border ring */}
              <div style={{ position: "absolute", inset: -3, borderRadius: "50%", border: "3px solid #c8952a", boxShadow: "0 0 0 1px #7a5518" }} />

              <WheelSVG rotation={wheelRotation} settling={isSettling} />

              {/* Fixed ball */}
              <div style={{ position: "absolute", top: 7, left: "50%", transform: "translateX(-50%)", width: 12, height: 12, borderRadius: "50%", background: "radial-gradient(circle at 35% 35%, #ffffff, #c0c0c0)", boxShadow: "0 0 8px rgba(255,255,255,0.9), 0 3px 6px rgba(0,0,0,0.6)", zIndex: 20 }} />
            </div>

            {/* Winning number display */}
            <div style={{ marginTop: 14, textAlign: "center" }}>
              {phase === "result" && winNumber !== null ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: "50%",
                    background: winColor === "green" ? "#16a34a" : winColor === "red" ? "#b91c1c" : "#111827",
                    border: "3px solid #f5c542",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 24, fontWeight: 900, color: "white",
                    boxShadow: `0 0 20px ${winColor === "green" ? "rgba(34,197,94,0.7)" : winColor === "red" ? "rgba(185,28,28,0.7)" : "rgba(255,255,255,0.3)"}`,
                    animation: "resultPop 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards",
                  }}>{winNumber}</div>
                  <div>
                    <div style={{ color: winColor === "green" ? "#4ade80" : winColor === "red" ? "#f87171" : "#d1d5db", fontWeight: 900, fontSize: 15, letterSpacing: 2, fontFamily: "Georgia,serif" }}>
                      {winColor?.toUpperCase()}
                    </div>
                    {result?.won ? (
                      <div style={{ color: "#4ade80", fontSize: 13, fontWeight: 700 }}>🎉 +{formatCurrency(result.winAmount)}</div>
                    ) : (
                      <div style={{ color: "#f87171", fontSize: 13 }}>Better luck next time!</div>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ color: "rgba(245,197,66,0.6)", fontSize: 11, letterSpacing: 3, fontFamily: "Georgia,serif" }}>
                  {phase === "rolling" ? "🎡 SPINNING..." : phase === "settling" ? "🎡 SETTLING..." : "✦ PLACE YOUR BET ✦"}
                </div>
              )}
            </div>

            {/* History strip */}
            {history.length > 0 && (
              <div style={{ display: "flex", gap: 5, marginTop: 10, alignItems: "center" }}>
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", letterSpacing: 1 }}>LAST</span>
                {history.map((n, i) => {
                  const c = numLabel(n);
                  return (
                    <div key={i} style={{ width: 20, height: 20, borderRadius: "50%", fontSize: 8, fontWeight: 900, color: "white", display: "flex", alignItems: "center", justifyContent: "center", background: c === "green" ? "#16a34a" : c === "red" ? "#b91c1c" : "#374151", border: "1px solid rgba(255,255,255,0.2)" }}>{n}</div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ═══ BETTING PANEL ═══ */}
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(200,149,42,0.18)", borderRadius: 18, padding: "18px 14px 20px", backdropFilter: "blur(8px)" }}>
          {phase === "result" ? (
            <button onClick={handlePlayAgain} style={{ width: "100%", padding: "14px 0", borderRadius: 12, background: "linear-gradient(135deg,#7c3aed,#4f46e5)", color: "white", fontWeight: 900, fontSize: 16, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, letterSpacing: 1 }}>
              <RefreshCw size={18} /> SPIN AGAIN
            </button>
          ) : (
            <>
              {/* Number grid */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: 3, marginBottom: 8, fontFamily: "Georgia,serif" }}>BETTING TABLE</div>
                <NumberGrid selection={selection} onSelect={setSelection} disabled={phase !== "betting"} />
              </div>

              {/* Quick bet buttons */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: 3, marginBottom: 8, fontFamily: "Georgia,serif" }}>QUICK SELECT</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  {([
                    { key: "red"   as const, label: "RED",   emoji: "🔴", mult: "1.95×", bg: "#991b1b", sel: "#dc2626" },
                    { key: "black" as const, label: "BLACK", emoji: "⚫", mult: "1.95×", bg: "#1f2937", sel: "#374151" },
                    { key: "green" as const, label: "ZERO",  emoji: "🟢", mult: "14×",   bg: "#14532d", sel: "#16a34a" },
                  ]).map(opt => (
                    <button key={opt.key} onClick={() => phase === "betting" && setSelection(opt.key)} disabled={phase !== "betting"}
                      style={{
                        padding: "11px 4px", borderRadius: 10, textAlign: "center",
                        border: `2px solid ${selection === opt.key ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.1)"}`,
                        background: selection === opt.key ? opt.sel : opt.bg,
                        cursor: phase === "betting" ? "pointer" : "not-allowed", transition: "all 0.2s",
                        boxShadow: selection === opt.key ? "0 0 14px rgba(255,255,255,0.2)" : undefined,
                      }}>
                      <div style={{ fontSize: 16 }}>{opt.emoji}</div>
                      <div style={{ fontSize: 11, fontWeight: 900, color: "white", letterSpacing: 1 }}>{opt.label}</div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", fontWeight: 700 }}>{opt.mult}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Chip selector */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: 3, marginBottom: 8, fontFamily: "Georgia,serif" }}>STAKE (PKR)</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 5 }}>
                  {CHIP_AMOUNTS.map(amt => (
                    <button key={amt} onClick={() => phase === "betting" && setStake(amt)} disabled={phase !== "betting"}
                      style={{
                        padding: "9px 0", borderRadius: 8, fontSize: 12, fontWeight: 900,
                        border: `2px solid ${stake === amt ? "#f5c542" : "rgba(255,255,255,0.1)"}`,
                        background: stake === amt ? "rgba(245,197,66,0.18)" : "rgba(255,255,255,0.04)",
                        color: stake === amt ? "#f5c542" : "rgba(255,255,255,0.4)",
                        cursor: phase === "betting" ? "pointer" : "not-allowed", transition: "all 0.15s",
                      }}>
                      {amt >= 1000 ? `${amt / 1000}K` : amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom */}
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <input type="number" min="0" placeholder="Custom amount" value={customStake} disabled={phase !== "betting"}
                  onChange={e => { setCustomStake(e.target.value); const p = parseFloat(e.target.value); setStake(isNaN(p) ? 0 : p); }}
                  style={{ flex: 1, padding: "9px 12px", borderRadius: 8, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "white", fontSize: 13, outline: "none" }} />
                {stake > 0 && selection && (
                  <div style={{ padding: "9px 12px", borderRadius: 8, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", color: "#4ade80", fontSize: 12, fontWeight: 900, display: "flex", alignItems: "center", whiteSpace: "nowrap" }}>
                    Win {formatCurrency(Math.round(stake * (selection === "green" ? 14 : 1.95)))}
                  </div>
                )}
              </div>

              {/* Spin button */}
              {!isAuthenticated ? (
                <button onClick={() => setLocation("/login")} style={{ width: "100%", padding: "14px 0", borderRadius: 12, background: "linear-gradient(135deg,#c8952a 0%,#f5c542 50%,#c8952a 100%)", color: "#0a0a00", fontWeight: 900, fontSize: 15, border: "none", cursor: "pointer", letterSpacing: 2 }}>
                  LOGIN TO PLAY
                </button>
              ) : (
                <button onClick={handleSpin} disabled={!canSpin} style={{
                  width: "100%", padding: "14px 0", borderRadius: 12, fontWeight: 900, fontSize: 15, letterSpacing: 2,
                  background: canSpin ? "linear-gradient(135deg,#c8952a 0%,#f5c542 50%,#c8952a 100%)" : "rgba(255,255,255,0.07)",
                  color: canSpin ? "#0a0a00" : "rgba(255,255,255,0.2)",
                  border: `2px solid ${canSpin ? "#f5c542" : "rgba(255,255,255,0.07)"}`,
                  cursor: canSpin ? "pointer" : "not-allowed",
                  boxShadow: canSpin ? "0 4px 24px rgba(245,197,66,0.4)" : "none", transition: "all 0.2s",
                }}>
                  {phase === "rolling" ? "🎡 SPINNING..." : phase === "settling" ? "🎡 SETTLING..." : !selection ? "PICK RED, BLACK, OR ZERO" : stake <= 0 ? "ENTER YOUR STAKE" : "🎡 SPIN THE WHEEL"}
                </button>
              )}
              {isAuthenticated && stake > balance && (
                <p style={{ color: "#f87171", fontSize: 11, textAlign: "center", marginTop: 6 }}>Insufficient balance — max: {formatCurrency(balance)}</p>
              )}
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes resultPop {
          0%   { transform: scale(0.4); opacity: 0; }
          65%  { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1);   opacity: 1; }
        }
      `}</style>
    </div>
  );
}
