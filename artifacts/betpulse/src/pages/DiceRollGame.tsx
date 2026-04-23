import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey, getGetBalanceQueryKey } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, RefreshCw } from "lucide-react";

type DiceSel = "low" | "seven" | "high";
type Phase = "betting" | "rolling" | "landing" | "result";
const CHIP_AMOUNTS = [100, 500, 1000, 5000];

const STYLES = `
/* Dice tumbles downward, spinning on Z axis so dots stay readable */
@keyframes diceFallIn {
  0%   { transform: translateY(-320px) rotateZ(-600deg); opacity: 0; }
  15%  { opacity: 1; }
  62%  { transform: translateY(18px)   rotateZ(-30deg); opacity: 1; }
  74%  { transform: translateY(-14px)  rotateZ(8deg); }
  83%  { transform: translateY(8px)    rotateZ(-3deg); }
  90%  { transform: translateY(-4px)   rotateZ(1deg); }
  96%  { transform: translateY(2px)    rotateZ(0deg); }
  100% { transform: translateY(0px)    rotateZ(0deg); opacity: 1; }
}

/* Rapid wheel-spin while rolling (dots visible but blurring fast) */
@keyframes diceRollSpin {
  0%   { transform: translateY(0px) rotateZ(0deg); }
  25%  { transform: translateY(-10px) rotateZ(-90deg); }
  50%  { transform: translateY(0px)   rotateZ(-180deg); }
  75%  { transform: translateY(-10px) rotateZ(-270deg); }
  100% { transform: translateY(0px)   rotateZ(-360deg); }
}

@keyframes diceWinPulse {
  0%,100% { transform: scale(1);    box-shadow: 0 0 28px rgba(34,197,94,0.6); }
  50%      { transform: scale(1.12); box-shadow: 0 0 55px rgba(34,197,94,1); }
}

@keyframes resultSlide {
  0%   { transform: translateY(16px); opacity: 0; }
  100% { transform: translateY(0);    opacity: 1; }
}

@keyframes shadowGrow {
  0%   { transform: translateY(-320px); opacity: 0; }
  62%  { opacity: 0.5; }
  100% { transform: translateY(0px); opacity: 0; }
}
`;

const DICE_DOTS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 28], [72, 28], [28, 50], [72, 50], [28, 72], [72, 72]],
};

function Die({ value, phase }: { value: number; phase: Phase }) {
  const rolling  = phase === "rolling";
  const landing  = phase === "landing";
  const won_show = phase === "result";

  const bg = rolling
    ? "linear-gradient(145deg,#2d1b69,#1a1040,#3b1f8c)"
    : landing || won_show
    ? "linear-gradient(145deg,#14532d,#166534,#15803d)"
    : "linear-gradient(145deg,#1e293b,#0f172a,#1a2540)";

  const border = rolling
    ? "rgba(192,132,252,0.8)"
    : landing || won_show
    ? "rgba(74,222,128,0.8)"
    : "rgba(255,255,255,0.2)";

  const dotColor  = rolling ? "#e9d5ff" : landing || won_show ? "#4ade80" : "#ffffff";
  const dotGlow   = rolling
    ? "0 0 8px rgba(216,180,254,0.9), 0 0 16px rgba(192,132,252,0.6)"
    : landing || won_show
    ? "0 0 10px rgba(74,222,128,1), 0 0 20px rgba(34,197,94,0.6)"
    : "0 2px 4px rgba(0,0,0,0.5)";

  const animation = rolling
    ? "diceRollSpin 0.35s linear infinite"
    : landing
    ? "diceFallIn 0.9s cubic-bezier(0.22,1,0.36,1) both"
    : won_show
    ? "diceWinPulse 0.8s ease-in-out infinite"
    : undefined;

  const boxShadow = rolling
    ? "0 0 28px rgba(168,85,247,0.7), 0 0 56px rgba(139,92,246,0.3), inset 0 0 16px rgba(192,132,252,0.1)"
    : landing || won_show
    ? "0 0 32px rgba(34,197,94,0.7), 0 0 60px rgba(74,222,128,0.3), inset 0 0 16px rgba(74,222,128,0.1)"
    : "0 8px 28px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.08)";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div style={{
        width: 108, height: 108, borderRadius: 20, position: "relative",
        background: bg,
        border: `3px solid ${border}`,
        animation,
        boxShadow,
        transition: "background 0.4s, border 0.4s, box-shadow 0.4s",
      }}>
        {(DICE_DOTS[value] || []).map(([x, y], i) => (
          <div key={i} style={{
            position: "absolute",
            width: 18, height: 18, borderRadius: "50%",
            background: dotColor,
            left: `${x}%`, top: `${y}%`,
            transform: "translate(-50%,-50%)",
            boxShadow: dotGlow,
            transition: "background 0.3s, box-shadow 0.3s",
          }} />
        ))}
      </div>
      {/* Ground shadow that shrinks as dice lands */}
      {landing && (
        <div style={{
          width: 70, height: 10, borderRadius: "50%",
          background: "rgba(0,0,0,0.5)",
          filter: "blur(4px)",
          animation: "shadowGrow 0.9s cubic-bezier(0.22,1,0.36,1) both",
          marginTop: -8,
        }} />
      )}
    </div>
  );
}

function playDiceSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtx();
    for (let i = 0; i < 8; i++) {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.07, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let j = 0; j < data.length; j++) data[j] = (Math.random() * 2 - 1) * (1 - j / data.length);
      const src = ctx.createBufferSource();
      const g = ctx.createGain();
      src.buffer = buf; src.connect(g); g.connect(ctx.destination);
      const t = ctx.currentTime + i * 0.15;
      g.gain.setValueAtTime(0.18, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
      src.start(t);
    }
    setTimeout(() => ctx.close(), 2500);
  } catch (_) {}
}

function playLandSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtx();
    [180, 140].forEach((freq, i) => {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.12, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let j = 0; j < data.length; j++) data[j] = (Math.random() * 2 - 1) * Math.exp(-j / (data.length * 0.3));
      const src = ctx.createBufferSource(); const g = ctx.createGain();
      src.buffer = buf; src.connect(g); g.connect(ctx.destination);
      const t = ctx.currentTime + i * 0.05;
      g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      src.start(t);
    });
    setTimeout(() => ctx.close(), 1000);
  } catch (_) {}
}

function playWin() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtx();
    [523, 659, 784, 1047].forEach((freq, i) => {
      const osc = ctx.createOscillator(); const g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination); osc.type = "triangle"; osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.14;
      g.gain.setValueAtTime(0.22, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.start(t); osc.stop(t + 0.4);
    });
    setTimeout(() => ctx.close(), 2000);
  } catch (_) {}
}

function playLose() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtx();
    [350, 300, 250].forEach((freq, i) => {
      const osc = ctx.createOscillator(); const g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination); osc.type = "sawtooth"; osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.2;
      g.gain.setValueAtTime(0.1, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.start(t); osc.stop(t + 0.25);
    });
    setTimeout(() => ctx.close(), 2000);
  } catch (_) {}
}

export default function DiceRollGame() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState<Phase>("betting");
  const [selection, setSelection] = useState<DiceSel | null>(null);
  const [stake, setStake] = useState(0);
  const [customStake, setCustomStake] = useState("");
  const [dice1, setDice1] = useState(3);
  const [dice2, setDice2] = useState(4);
  const [result, setResult] = useState<{ dice1: number; dice2: number; sum: number; result: DiceSel; won: boolean; winAmount: number; netChange: number; newBalance: number } | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const rollInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    if (rollInterval.current) { clearInterval(rollInterval.current); rollInterval.current = null; }
  };
  const addTimer = (fn: () => void, delay: number) => {
    const t = setTimeout(fn, delay); timersRef.current.push(t); return t;
  };
  useEffect(() => () => clearTimers(), []);

  const handleRoll = async () => {
    if (!selection || stake <= 0) { toast({ title: "Pick a bet and enter a stake", variant: "destructive" }); return; }
    if (!isAuthenticated) { setLocation("/login"); return; }

    clearTimers();
    setResult(null);
    setPhase("rolling");

    // Rapidly cycle dice faces during rolling
    rollInterval.current = setInterval(() => {
      setDice1(Math.ceil(Math.random() * 6));
      setDice2(Math.ceil(Math.random() * 6));
    }, 65);
    playDiceSound();

    try {
      const resp = await fetch("/api/games/dice-roll", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ stake, selection }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        if (resp.status === 401) { queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() }); toast({ title: "Session Expired", variant: "destructive" }); }
        else toast({ title: "Bet Failed", description: err.error || "Something went wrong.", variant: "destructive" });
        clearTimers(); setPhase("betting"); return;
      }
      const data = await resp.json();

      // After at least 1.5s of rolling, stop interval and trigger landing
      addTimer(() => {
        if (rollInterval.current) { clearInterval(rollInterval.current); rollInterval.current = null; }
        // Lock to final dice values and trigger fall-in animation
        setDice1(data.dice1);
        setDice2(data.dice2);
        setPhase("landing");
        playLandSound();

        // After landing animation completes, show result
        addTimer(() => {
          setResult(data);
          setPhase("result");
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetBalanceQueryKey() });
          if (data.won) playWin(); else playLose();
        }, 950);
      }, 1600);

    } catch {
      clearTimers();
      toast({ title: "Network Error", variant: "destructive" });
      setPhase("betting");
    }
  };

  const handlePlayAgain = () => {
    clearTimers();
    setPhase("betting"); setSelection(null); setStake(0); setCustomStake("");
    setResult(null); setDice1(3); setDice2(4);
  };

  const balance = user?.balance ?? 0;
  const canRoll = selection !== null && stake > 0 && stake <= balance && phase === "betting";

  const BETS = [
    { id: "low",   label: "LOW",     sub: "Sum 2–6",    payout: "1.9×", color: "#3b82f6", emoji: "⬇️" },
    { id: "seven", label: "LUCKY 7", sub: "Exactly 7",  payout: "5×",   color: "#eab308", emoji: "7️⃣" },
    { id: "high",  label: "HIGH",    sub: "Sum 8–12",   payout: "1.9×", color: "#ef4444", emoji: "⬆️" },
  ] as { id: DiceSel; label: string; sub: string; payout: string; color: string; emoji: string }[];

  if (isLoading) return <div className="flex h-screen items-center justify-center bg-background"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(160deg, #0a0a1a 0%, #1a0a0a 60%, #0a0a1a 100%)" }}>
      <style>{STYLES}</style>

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <button onClick={() => setLocation("/")} className="flex items-center gap-2 text-muted-foreground hover:text-white transition-colors">
          <ArrowLeft className="h-5 w-5" /><span className="text-sm">Back</span>
        </button>
        <div className="text-center">
          <h1 className="text-xl font-bold tracking-widest text-white uppercase">🎲 Dice Roll</h1>
          <p className="text-xs text-muted-foreground">High, Low, or Lucky 7 — you decide</p>
        </div>
        <div className="text-right">
          {isAuthenticated ? (
            <><p className="text-xs text-muted-foreground">Balance</p>
              <p className="font-bold text-primary font-mono">{formatCurrency(result?.newBalance ?? balance)}</p></>
          ) : (
            <button onClick={() => setLocation("/login")} className="text-sm text-primary hover:underline">Login to Play</button>
          )}
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-8 space-y-6">

        {/* Dice Stage */}
        <div style={{
          background: "radial-gradient(ellipse at 50% 30%, #1c0a3a 0%, #0d0618 70%)",
          border: "3px solid rgba(168,85,247,0.25)",
          borderRadius: 28,
          padding: "44px 24px 36px",
          boxShadow: "inset 0 0 80px rgba(139,92,246,0.06), 0 8px 40px rgba(0,0,0,0.7)",
          overflow: "hidden",
          position: "relative",
          minHeight: 220,
        }}>
          {/* Subtle table surface lines */}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, transparent, rgba(168,85,247,0.2), transparent)" }} />

          {/* Dice row */}
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 36, marginBottom: 20 }}>
            <Die value={dice1} phase={phase} />
            <div style={{ fontSize: 28, color: "#fbbf24", fontFamily: "Georgia,serif", fontWeight: "bold", paddingBottom: 12 }}>+</div>
            <Die value={dice2} phase={phase} />
          </div>

          {/* Status text */}
          {phase === "betting" && (
            <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 14 }}>
              Pick a bet and roll the dice!
            </div>
          )}
          {phase === "rolling" && (
            <div style={{ textAlign: "center", color: "#c084fc", fontSize: 16, fontWeight: "bold", letterSpacing: 3 }}>
              ROLLING...
            </div>
          )}
          {phase === "landing" && (
            <div style={{ textAlign: "center", color: "#fbbf24", fontSize: 22, fontWeight: 900, letterSpacing: 4 }}>
              ...
            </div>
          )}
          {phase === "result" && result && (
            <>
              <div style={{ textAlign: "center", fontSize: 26, color: "#fbbf24", fontWeight: 900, letterSpacing: 4, marginBottom: 10 }}>
                = {result.sum}
              </div>
              <div className="text-center rounded-2xl py-3 px-6" style={{
                background: result.won ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.12)",
                border: `1px solid ${result.won ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.3)"}`,
                animation: "resultSlide 0.4s ease-out",
              }}>
                <p style={{ fontSize: 22, fontWeight: 900, color: result.won ? "#4ade80" : "#f87171", letterSpacing: 3, fontFamily: "Georgia,serif" }}>
                  {result.result === "seven" ? "LUCKY 7 🎉" : result.result === "high" ? "HIGH ⬆️" : "LOW ⬇️"}
                </p>
                <p style={{ color: result.won ? "#4ade80" : "#f87171", fontWeight: "bold", marginTop: 4, fontSize: 15 }}>
                  {result.won ? `+${formatCurrency(result.winAmount)} 🎉` : "Better luck next time!"}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Controls */}
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: 20 }}>
          {phase === "result" ? (
            <button onClick={handlePlayAgain} className="w-full py-3 rounded-xl font-bold text-base flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)", color: "white" }}>
              <RefreshCw className="h-5 w-5" /> Roll Again
            </button>
          ) : (
            <>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, letterSpacing: 2, marginBottom: 10, textTransform: "uppercase" }}>Pick your bet</p>
              <div className="grid grid-cols-3 gap-3 mb-5">
                {BETS.map(opt => (
                  <button key={opt.id} onClick={() => phase === "betting" && setSelection(opt.id)} disabled={phase !== "betting"}
                    style={{
                      padding: "14px 8px", borderRadius: 12, textAlign: "center",
                      border: `2px solid ${selection === opt.id ? opt.color : "rgba(255,255,255,0.1)"}`,
                      background: selection === opt.id ? `${opt.color}33` : "rgba(255,255,255,0.05)",
                      color: selection === opt.id ? "white" : "rgba(255,255,255,0.5)",
                      fontWeight: "bold", cursor: phase === "betting" ? "pointer" : "not-allowed", transition: "all .2s",
                    }}>
                    <div style={{ fontSize: 20 }}>{opt.emoji}</div>
                    <div style={{ fontSize: 13, marginTop: 3 }}>{opt.label}</div>
                    <div style={{ fontSize: 10, opacity: 0.7 }}>{opt.sub}</div>
                    <div style={{ fontSize: 11, color: opt.color, fontWeight: 900, marginTop: 3 }}>{opt.payout}</div>
                  </button>
                ))}
              </div>

              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, letterSpacing: 2, marginBottom: 10, textTransform: "uppercase" }}>Stake (PKR)</p>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {CHIP_AMOUNTS.map(amt => (
                  <button key={amt} onClick={() => phase === "betting" && setStake(amt)} disabled={phase !== "betting"}
                    style={{
                      padding: "10px 0", borderRadius: 10, fontSize: 14, fontWeight: "bold",
                      border: `2px solid ${stake === amt ? "#a855f7" : "rgba(255,255,255,0.12)"}`,
                      background: stake === amt ? "rgba(168,85,247,0.25)" : "rgba(255,255,255,0.05)",
                      color: stake === amt ? "#c084fc" : "rgba(255,255,255,0.5)",
                      cursor: phase === "betting" ? "pointer" : "not-allowed", transition: "all .2s",
                    }}>
                    {amt >= 1000 ? `${amt / 1000}K` : amt}
                  </button>
                ))}
              </div>

              <div className="flex gap-2 mb-5">
                <input type="number" min="0" placeholder="Custom amount..." value={customStake} disabled={phase !== "betting"}
                  onChange={e => { setCustomStake(e.target.value); const p = parseFloat(e.target.value); setStake(isNaN(p) ? 0 : p); }}
                  style={{ flex: 1, padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", color: "white", fontSize: 14, outline: "none" }} />
                {stake > 0 && selection && (
                  <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", color: "#4ade80", fontSize: 13, fontWeight: "bold", display: "flex", alignItems: "center", whiteSpace: "nowrap" }}>
                    Win: {formatCurrency(Math.round(stake * (selection === "seven" ? 5 : 1.9)))}
                  </div>
                )}
              </div>

              {!isAuthenticated ? (
                <button onClick={() => setLocation("/login")} style={{ width: "100%", padding: 14, borderRadius: 12, background: "linear-gradient(135deg,#7c3aed,#4f46e5)", color: "white", fontWeight: "bold", fontSize: 16, border: "none", cursor: "pointer" }}>
                  Log In to Play
                </button>
              ) : (
                <button onClick={handleRoll} disabled={!canRoll} style={{
                  width: "100%", padding: 14, borderRadius: 12, fontWeight: "bold", fontSize: 16, letterSpacing: 2,
                  background: canRoll ? "linear-gradient(135deg,#ef4444,#b91c1c)" : "rgba(255,255,255,0.08)",
                  color: canRoll ? "white" : "rgba(255,255,255,0.3)",
                  border: `2px solid ${canRoll ? "rgba(239,68,68,0.6)" : "rgba(255,255,255,0.08)"}`,
                  cursor: canRoll ? "pointer" : "not-allowed",
                  boxShadow: canRoll ? "0 4px 20px rgba(239,68,68,0.4)" : "none", transition: "all .2s",
                }}>
                  {phase === "rolling" ? "🎲 Rolling..." : phase === "landing" ? "🎲 Landing..." : !selection ? "Pick a bet first" : stake <= 0 ? "Enter your stake" : "🎲 ROLL DICE"}
                </button>
              )}
              {isAuthenticated && stake > balance && (
                <p style={{ color: "#f87171", fontSize: 12, textAlign: "center", marginTop: 8 }}>Insufficient balance — max: {formatCurrency(balance)}</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
