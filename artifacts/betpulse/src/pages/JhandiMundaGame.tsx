import { useState, useCallback, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey, getGetBalanceQueryKey } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Wallet } from "lucide-react";

const CHIP_AMOUNTS = [100, 500, 1000, 5000, 10000];
const API = import.meta.env.BASE_URL.replace(/\/$/, "");

const SYMBOLS: { key: string; icon: string; label: string; color: string; bg: string }[] = [
  { key: "heart",   icon: "♥", label: "Paan",   color: "#ef4444", bg: "rgba(239,68,68,0.15)"   },
  { key: "diamond", icon: "♦", label: "Iit",    color: "#f97316", bg: "rgba(249,115,22,0.15)"  },
  { key: "club",    icon: "♣", label: "Chidi",  color: "#22c55e", bg: "rgba(34,197,94,0.15)"   },
  { key: "spade",   icon: "♠", label: "Hukum",  color: "#94a3b8", bg: "rgba(148,163,184,0.12)" },
  { key: "star",    icon: "👑", label: "Raja",   color: "#f5c542", bg: "rgba(245,197,66,0.15)"  },
  { key: "moon",    icon: "🚩", label: "Jhandi", color: "#a855f7", bg: "rgba(168,85,247,0.15)"  },
];
const SYM_KEYS = SYMBOLS.map(s => s.key);

const STYLES = `
@keyframes jm-roll {
  0%  { transform: rotate(-18deg) scale(0.88) translateY(2px); }
  20% { transform: rotate(14deg)  scale(1.10) translateY(-12px); }
  40% { transform: rotate(-12deg) scale(0.92) translateY(4px); }
  60% { transform: rotate(16deg)  scale(1.08) translateY(-8px); }
  80% { transform: rotate(-10deg) scale(0.94) translateY(3px); }
  100%{ transform: rotate(-18deg) scale(0.88) translateY(2px); }
}
@keyframes jm-settle {
  0%  { transform: scale(0.65) rotate(-20deg); opacity: 0.4; }
  55% { transform: scale(1.22) rotate(6deg);  opacity: 1; }
  75% { transform: scale(0.94) rotate(-2deg); opacity: 1; }
  100%{ transform: scale(1)    rotate(0deg);  opacity: 1; }
}
@keyframes jm-winPulse {
  0%,100% { box-shadow: var(--win-shadow-sm); }
  50%     { box-shadow: var(--win-shadow-lg); }
}
@keyframes countPop {
  0%  { transform: translate(-50%,-50%) scale(0);   opacity: 0; }
  65% { transform: translate(-50%,-50%) scale(1.3); opacity: 1; }
  100%{ transform: translate(-50%,-50%) scale(1);   opacity: 1; }
}
@keyframes resultSlide {
  0%  { opacity: 0; transform: translateY(16px); }
  100%{ opacity: 1; transform: translateY(0); }
}
`;

function mkCtx() { return new ((window as any).AudioContext || (window as any).webkitAudioContext)(); }
function playDiceSound() {
  try {
    const c = mkCtx();
    const o = c.createOscillator(); const g = c.createGain();
    o.connect(g); g.connect(c.destination); o.type = "square"; o.frequency.value = 220;
    g.gain.setValueAtTime(0.09, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.09);
    o.start(c.currentTime); o.stop(c.currentTime + 0.09);
    setTimeout(() => c.close(), 300);
  } catch (_) {}
}
function playWin() {
  try {
    const c = mkCtx();
    [523, 659, 784, 1047].forEach((freq, i) => {
      const o = c.createOscillator(); const g = c.createGain();
      o.connect(g); g.connect(c.destination); o.type = "triangle"; o.frequency.value = freq;
      const t = c.currentTime + i * 0.12;
      g.gain.setValueAtTime(0.22, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      o.start(t); o.stop(t + 0.4);
    });
    setTimeout(() => c.close(), 2500);
  } catch (_) {}
}
function playLose() {
  try {
    const c = mkCtx();
    [300, 250].forEach((freq, i) => {
      const o = c.createOscillator(); const g = c.createGain();
      o.connect(g); g.connect(c.destination); o.type = "sawtooth"; o.frequency.value = freq;
      const t = c.currentTime + i * 0.2;
      g.gain.setValueAtTime(0.1, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      o.start(t); o.stop(t + 0.25);
    });
    setTimeout(() => c.close(), 2000);
  } catch (_) {}
}

function Die({
  symKey, isRolling, settled, isWin, dimmed,
}: {
  symKey?: string; isRolling?: boolean; settled?: boolean; isWin?: boolean; dimmed?: boolean;
}) {
  const sym = SYMBOLS.find(s => s.key === symKey);
  const winColor = sym?.color ?? "#f5c542";
  return (
    <div style={{
      width: 82, height: 82, flexShrink: 0, position: "relative",
      background: settled
        ? "linear-gradient(145deg,#fffdf2 0%,#fff8d6 60%,#ffeda0 100%)"
        : "linear-gradient(145deg,#ffffff 0%,#f4f4f4 100%)",
      borderRadius: 18,
      border: `3px solid ${isWin ? winColor : settled ? "#ddd" : "#ccc"}`,
      boxShadow: isWin
        ? `0 6px 24px ${winColor}66, inset 0 2px 0 rgba(255,255,255,0.9)`
        : settled
        ? "0 6px 20px rgba(0,0,0,0.4), inset 0 2px 0 rgba(255,255,255,0.7)"
        : dimmed
        ? "0 2px 8px rgba(0,0,0,0.2)"
        : "0 4px 14px rgba(0,0,0,0.35), inset 0 2px 0 rgba(255,255,255,0.6)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 38,
      opacity: dimmed ? 0.45 : 1,
      animation: isRolling
        ? "jm-roll 0.13s linear infinite"
        : settled
        ? "jm-settle 0.45s cubic-bezier(0.34,1.56,0.64,1) forwards"
        : "none",
      transition: "border-color 0.25s, box-shadow 0.25s, opacity 0.2s",
      cursor: "default",
    }}>
      <span style={{
        lineHeight: 1,
        color: sym ? sym.color : "rgba(0,0,0,0.18)",
        filter: isWin ? `drop-shadow(0 0 6px ${winColor})` : "none",
        transition: "filter 0.3s",
      }}>
        {sym ? sym.icon : "?"}
      </span>
    </div>
  );
}

function SymbolCard({
  sym, selected, onClick, disabled, count,
}: {
  sym: typeof SYMBOLS[0]; selected: boolean; onClick: () => void; disabled: boolean; count?: number;
}) {
  return (
    <button
      onClick={onClick} disabled={disabled}
      style={{
        position: "relative",
        padding: "14px 8px", borderRadius: 16, border: `2px solid ${selected ? sym.color : "rgba(255,255,255,0.1)"}`,
        background: selected ? sym.bg : "rgba(10,36,20,0.7)",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
        boxShadow: selected ? `0 0 22px ${sym.color}55, inset 0 1px 0 rgba(255,255,255,0.1)` : "none",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "all 0.18s", transform: selected ? "scale(1.04)" : "scale(1)",
        opacity: disabled && !selected ? 0.55 : 1,
      }}
    >
      <span style={{ fontSize: 34, lineHeight: 1, filter: selected ? `drop-shadow(0 0 8px ${sym.color})` : "none" }}>
        {sym.icon}
      </span>
      <span style={{ fontSize: 11, fontWeight: 800, color: selected ? sym.color : "rgba(255,255,255,0.55)", letterSpacing: 1 }}>
        {sym.label}
      </span>
      {count !== undefined && (
        <div style={{
          position: "absolute", top: -10, right: -10, width: 26, height: 26,
          borderRadius: "50%", background: count > 0 ? sym.color : "rgba(255,255,255,0.15)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 900, color: count > 0 ? "#000" : "rgba(255,255,255,0.4)",
          border: "2px solid rgba(0,0,0,0.3)",
          animation: count > 0 ? "countPop 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards" : "none",
        }}>
          {count}
        </div>
      )}
    </button>
  );
}

export default function JhandiMundaGame() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [stake, setStake] = useState(500);
  const [selection, setSelection] = useState<string | null>(null);
  const [phase, setPhase] = useState<"betting" | "rolling" | "settling" | "result">("betting");
  const [result, setResult] = useState<any>(null);
  const [balance, setBalance] = useState<number>(parseFloat(user?.balance || "0"));
  const [isPlacing, setIsPlacing] = useState(false);

  const [rollingDisplay, setRollingDisplay] = useState<string[]>(SYM_KEYS);
  const [settledCount, setSettledCount] = useState(0);
  const [finalDice, setFinalDice] = useState<string[]>([]);
  const rollIvRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { setBalance(parseFloat(user?.balance || "0")); }, [user?.balance]);

  useEffect(() => {
    if (phase !== "rolling") return;
    setSettledCount(0);
    rollIvRef.current = setInterval(() => {
      setRollingDisplay(() => Array.from({ length: 6 }, () => SYM_KEYS[Math.floor(Math.random() * 6)]));
    }, 80);
    return () => { if (rollIvRef.current) clearInterval(rollIvRef.current); };
  }, [phase]);

  useEffect(() => {
    if (phase !== "settling" || finalDice.length !== 6) return;
    if (rollIvRef.current) { clearInterval(rollIvRef.current); rollIvRef.current = null; }
    setSettledCount(0);
    let count = 0;
    const iv = setInterval(() => {
      count++;
      setSettledCount(count);
      playDiceSound();
      setRollingDisplay(prev => {
        const next = [...prev];
        next[count - 1] = finalDice[count - 1];
        return next;
      });
      if (count >= 6) { clearInterval(iv); setTimeout(() => setPhase("result"), 700); }
    }, 270);
    return () => clearInterval(iv);
  }, [phase, finalDice]);

  const pollRound = useCallback(async (rId: string, sel: string) => {
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      if (attempts > 240) { clearInterval(interval); setPhase("betting"); return; }
      try {
        const r = await fetch(`${API}/api/games/casino-round/jhandi-munda/${rId}`, { credentials: "include" });
        const data = await r.json();
        if (data.status === "settled") {
          clearInterval(interval);
          setResult(data);
          const dice: string[] = data.details?.dice ?? [];
          setFinalDice(dice);
          const won = data.result === sel;
          if (won) playWin(); else playLose();
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetBalanceQueryKey() });
          setPhase("settling");
        }
      } catch (_) {}
    }, 500);
  }, [queryClient]);

  const placeBet = async () => {
    if (!isAuthenticated) { setLocation("/login"); return; }
    if (!selection) { toast({ title: "Pick a symbol!", variant: "destructive" }); return; }
    if (balance < stake) { toast({ title: "Insufficient balance", variant: "destructive" }); return; }
    setIsPlacing(true);
    try {
      const r = await fetch(`${API}/api/games/jhandi-munda`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stake, selection }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Failed");
      setBalance(data.newBalance);
      setResult(null); setFinalDice([]); setSettledCount(0);
      setPhase("rolling");
      pollRound(data.roundId, selection);
      const sym = SYMBOLS.find(s => s.key === selection);
      toast({ title: `Bet on ${sym?.icon} ${sym?.label}!`, description: "Rolling 6 dice..." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
      setPhase("betting");
    } finally { setIsPlacing(false); }
  };

  const reset = () => { setPhase("betting"); setResult(null); setSelection(null); setSettledCount(0); setFinalDice([]); };
  const won = result?.result === selection;
  const resultDice: string[] = result?.details?.dice ?? [];
  const selSym = SYMBOLS.find(s => s.key === selection);
  const isPlaying = phase === "rolling" || phase === "settling";

  const symCounts = resultDice.reduce<Record<string, number>>((acc, k) => {
    acc[k] = (acc[k] ?? 0) + 1; return acc;
  }, {});
  const myCount = selection ? (symCounts[selection] ?? 0) : 0;

  const diceToShow: string[] = phase === "result" ? resultDice : rollingDisplay;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(180deg,#0a1e12 0%,#061208 100%)" }}>
      <style>{STYLES}</style>

      {/* Header */}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "rgba(8,28,14,0.9)", borderBottom: "1px solid rgba(245,197,66,0.15)" }}>
        <button onClick={() => setLocation("/")} style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.55)", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
          <ArrowLeft size={16} /> Back
        </button>
        <span style={{ fontWeight: 900, fontSize: 18, background: "linear-gradient(90deg,#f5c542,#ffeba1)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Jhandi Munda 🎴
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 700, color: "#f5c542" }}>
          <Wallet size={14} /> {formatCurrency(balance)}
        </div>
      </header>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "14px 12px", gap: 14, maxWidth: 500, margin: "0 auto", width: "100%" }}>

        {/* ── Dice table ── */}
        <div style={{
          width: "100%", borderRadius: 24, overflow: "hidden", position: "relative",
          background: "radial-gradient(ellipse at center, #0c3d1a 0%, #072010 55%, #040d07 100%)",
          border: "3px solid rgba(200,160,40,0.35)",
          boxShadow: "inset 0 0 60px rgba(0,0,0,0.5), 0 0 40px rgba(0,0,0,0.6)",
          padding: "20px 16px 16px",
          minHeight: 260,
        }}>
          {/* Phase label */}
          <div style={{ textAlign: "center", marginBottom: 14 }}>
            {phase === "betting" && (
              <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(245,197,66,0.55)", letterSpacing: 3, textTransform: "uppercase" }}>
                6 Dice · Pick your symbol
              </p>
            )}
            {phase === "rolling" && (
              <p style={{ fontSize: 12, fontWeight: 700, color: "#f5c542", letterSpacing: 2, animation: "resultSlide 0.3s ease-out" }}>
                🎲 Rolling 6 dice...
              </p>
            )}
            {phase === "settling" && (
              <p style={{ fontSize: 12, fontWeight: 700, color: "#fbbf24", letterSpacing: 2 }}>
                Settling... {settledCount}/6
              </p>
            )}
            {phase === "result" && (
              <div style={{ animation: "resultSlide 0.35s ease-out" }}>
                <div style={{
                  display: "inline-block", padding: "6px 22px", borderRadius: 30, fontSize: 15, fontWeight: 900, letterSpacing: 2,
                  background: won ? "linear-gradient(135deg,rgba(34,197,94,.22),rgba(5,150,105,.12))" : "linear-gradient(135deg,rgba(239,68,68,.2),rgba(185,28,28,.1))",
                  border: `1px solid ${won ? "rgba(34,197,94,.5)" : "rgba(239,68,68,.4)"}`,
                  color: won ? "#4ade80" : "#f87171",
                }}>
                  {won ? `🏆 Won ${myCount}× · +${formatCurrency(myCount * stake)}` : "😔 You Lost"}
                </div>
              </div>
            )}
          </div>

          {/* 6 dice in a 3×2 grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, justifyItems: "center" }}>
            {Array.from({ length: 6 }, (_, i) => {
              const key = diceToShow[i];
              const isSettled = phase === "result" || (phase === "settling" && i < settledCount);
              const isRollingDie = (phase === "rolling") || (phase === "settling" && i >= settledCount);
              const isWin = isSettled && key === selection;
              const dimmed = phase === "betting";
              return (
                <Die
                  key={i}
                  symKey={key ?? SYMBOLS[i].key}
                  isRolling={isRollingDie}
                  settled={isSettled && phase !== "rolling"}
                  isWin={isWin}
                  dimmed={dimmed}
                />
              );
            })}
          </div>

          {/* Result symbol counts row */}
          {phase === "result" && (
            <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 14, flexWrap: "wrap", animation: "resultSlide 0.4s ease-out" }}>
              {SYMBOLS.map(s => {
                const cnt = symCounts[s.key] ?? 0;
                const isSel = s.key === selection;
                return (
                  <div key={s.key} style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                    opacity: cnt > 0 ? 1 : 0.3,
                  }}>
                    <span style={{ fontSize: 22, filter: isSel && cnt > 0 ? `drop-shadow(0 0 8px ${s.color})` : "none" }}>{s.icon}</span>
                    <span style={{ fontSize: 12, fontWeight: 900, color: isSel ? s.color : "rgba(255,255,255,0.6)" }}>×{cnt}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Your pick (rolling/settling) */}
          {(phase === "rolling" || phase === "settling") && selSym && (
            <div style={{ textAlign: "center", marginTop: 12, fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
              Your pick: <span style={{ color: selSym.color, fontWeight: 800 }}>{selSym.icon} {selSym.label}</span>
            </div>
          )}
        </div>

        {/* ── Controls ── */}
        {!isPlaying && (
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
            {phase === "result" ? (
              <button onClick={reset} style={{
                width: "100%", padding: "14px 0", borderRadius: 16, fontWeight: 900, fontSize: 16,
                background: "linear-gradient(135deg,#d4a017,#f5c542)", color: "#061208",
                border: "none", cursor: "pointer", boxShadow: "0 4px 20px rgba(245,197,66,0.4)",
              }}>
                🎲 Roll Again
              </button>
            ) : (
              <>
                <p style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: 2, textTransform: "uppercase", margin: 0 }}>
                  Pick your symbol · Pays 1× per match
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                  {SYMBOLS.map(sym => (
                    <SymbolCard
                      key={sym.key} sym={sym} selected={selection === sym.key}
                      onClick={() => setSelection(sym.key)} disabled={false}
                    />
                  ))}
                </div>

                {/* Chip selector */}
                <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                  {CHIP_AMOUNTS.map(amt => (
                    <button key={amt} onClick={() => setStake(amt)} style={{
                      width: 60, height: 60, borderRadius: "50%", fontWeight: 900, fontSize: 12,
                      border: `3px solid ${stake === amt ? "#f5c542" : "rgba(255,255,255,0.18)"}`,
                      background: stake === amt
                        ? "radial-gradient(circle at 40% 35%, #ffde6a, #d4a017)"
                        : "radial-gradient(circle at 40% 35%, #253d2a, #162418)",
                      color: stake === amt ? "#061208" : "rgba(255,255,255,0.5)",
                      cursor: "pointer",
                      boxShadow: stake === amt ? "0 0 18px rgba(245,197,66,0.55), inset 0 2px 0 rgba(255,255,255,0.3)" : "inset 0 2px 0 rgba(255,255,255,0.06)",
                      transition: "all 0.18s",
                    }}>
                      {amt >= 1000 ? `${amt / 1000}K` : amt}
                    </button>
                  ))}
                </div>

                {/* Roll button */}
                {isAuthenticated ? (
                  <button onClick={placeBet} disabled={isPlacing || !selection} style={{
                    width: "100%", padding: "15px 0", borderRadius: 16, fontWeight: 900, fontSize: 17, letterSpacing: 2,
                    background: selection
                      ? "linear-gradient(135deg,#d4a017 0%,#f5c542 50%,#ffe170 100%)"
                      : "rgba(255,255,255,0.07)",
                    color: selection ? "#061208" : "rgba(255,255,255,0.3)",
                    border: `2px solid ${selection ? "rgba(245,197,66,0.6)" : "rgba(255,255,255,0.08)"}`,
                    cursor: selection ? "pointer" : "not-allowed",
                    boxShadow: selection ? "0 4px 24px rgba(245,197,66,0.5)" : "none",
                    transition: "all 0.2s",
                  }}>
                    {isPlacing ? "🎲 Rolling..." : !selection ? "← PICK A SYMBOL" : `🎲 ROLL DICE · ${formatCurrency(stake)}`}
                  </button>
                ) : (
                  <button onClick={() => setLocation("/login")} style={{
                    width: "100%", padding: "15px 0", borderRadius: 16, fontWeight: 900, fontSize: 16,
                    background: "linear-gradient(135deg,#7c3aed,#4f46e5)", color: "white",
                    border: "none", cursor: "pointer",
                  }}>
                    LOG IN TO PLAY
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {isPlaying && (
          <div style={{ textAlign: "center", fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
            {formatCurrency(stake)} bet on{" "}
            <strong style={{ color: selSym?.color }}>{selSym?.icon} {selSym?.label}</strong>
            {phase === "rolling" && " · Dice are tumbling..."}
            {phase === "settling" && " · Dice are landing..."}
          </div>
        )}
      </div>
    </div>
  );
}
