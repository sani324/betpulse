import { useState, useCallback, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey, getGetBalanceQueryKey } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Wallet } from "lucide-react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");
const LOGO = import.meta.env.BASE_URL + "joker-logo.jpg";
const CHIP_AMOUNTS = [100, 500, 1000, 5000, 10000];

const OPTIONS = [
  { key: "player", label: "Player", sub: "1.95×", mult: 1.95, color: "#3b82f6", glow: "rgba(59,130,246,0.55)", icon: "👤", desc: "Equal Bet" },
  { key: "banker", label: "Banker", sub: "1.95×", mult: 1.95, color: "#ef4444", glow: "rgba(239,68,68,0.55)",  icon: "🏦", desc: "Equal Bet" },
  { key: "joker",  label: "Joker",  sub: "9×",    mult: 9,    color: "#f5c542", glow: "rgba(245,197,66,0.65)", icon: "🤡", desc: "Wild Card!" },
];

const PRIZE_TIERS = [
  { label: "🤡 JOKER WILD",  value: "9×",     color: "#f5c542", bg: "linear-gradient(90deg,#7c3a00,#b85a00,#7c3a00)", border: "#f5c542" },
  { label: "🏆 GRAND WIN",   value: "1.95×",  color: "#fb923c", bg: "linear-gradient(90deg,#3b1060,#6d28d9,#3b1060)", border: "#a855f7" },
  { label: "💙 PLAYER",      value: "1.95×",  color: "#60a5fa", bg: "linear-gradient(90deg,#0c1a4a,#1d4ed8,#0c1a4a)", border: "#3b82f6" },
];

const STYLES = `
@keyframes jokerFloat {
  0%,100%{ transform: translateY(0px) rotate(-2deg) scale(1); }
  50%    { transform: translateY(-12px) rotate(2deg) scale(1.04); }
}
@keyframes jokerSpin {
  0%  { transform: rotateY(0deg); }
  100%{ transform: rotateY(360deg); }
}
@keyframes prizeShimmer {
  0%,100%{ opacity: 1; }
  50%    { opacity: 0.7; }
}
@keyframes chipBounce {
  0%,100%{ transform: scale(1); }
  50%    { transform: scale(1.08); }
}
@keyframes resultPop {
  0%  { transform: scale(0.7); opacity: 0; }
  65% { transform: scale(1.08); opacity: 1; }
  100%{ transform: scale(1);    opacity: 1; }
}
@keyframes confettiDrop {
  0%  { transform: translateY(-20px) rotate(0deg); opacity: 1; }
  100%{ transform: translateY(100px) rotate(720deg); opacity: 0; }
}
@keyframes orbPulse {
  0%,100%{ transform: scale(1); opacity: 0.3; }
  50%    { transform: scale(1.3); opacity: 0.6; }
}
`;

function mkCtx() { return new ((window as any).AudioContext || (window as any).webkitAudioContext)(); }
function playWin() {
  try {
    const c = mkCtx();
    [523, 659, 784, 1047, 1319].forEach((freq, i) => {
      const o = c.createOscillator(); const g = c.createGain();
      o.connect(g); g.connect(c.destination); o.type = "triangle"; o.frequency.value = freq;
      const t = c.currentTime + i * 0.12;
      g.gain.setValueAtTime(0.28, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      o.start(t); o.stop(t + 0.45);
    });
    setTimeout(() => c.close(), 2500);
  } catch (_) {}
}
function playLose() {
  try {
    const c = mkCtx();
    [300, 250, 200].forEach((freq, i) => {
      const o = c.createOscillator(); const g = c.createGain();
      o.connect(g); g.connect(c.destination); o.type = "sawtooth"; o.frequency.value = freq;
      const t = c.currentTime + i * 0.22;
      g.gain.setValueAtTime(0.1, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      o.start(t); o.stop(t + 0.3);
    });
    setTimeout(() => c.close(), 2000);
  } catch (_) {}
}

function SpinningCard() {
  return (
    <div style={{ width: 90, height: 120, position: "relative" }}>
      <div style={{
        width: "100%", height: "100%",
        background: "linear-gradient(145deg,#fff9f0,#ffe4b5)",
        borderRadius: 14,
        border: "3px solid #f5c542",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 52,
        boxShadow: "0 8px 32px rgba(245,197,66,0.6), 0 0 60px rgba(245,197,66,0.2)",
        animation: "jokerSpin 1.4s linear infinite",
      }}>
        🤡
      </div>
    </div>
  );
}

function WinConfetti({ color }: { color: string }) {
  const items = ["🎊", "⭐", "💰", "✨", "🏆", "💎", "🌟", "🎉"];
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      {[...Array(18)].map((_, i) => (
        <div key={i} style={{
          position: "absolute", fontSize: 20,
          left: `${5 + Math.floor(i * 5.5) % 92}%`,
          top: `-10%`,
          animation: `confettiDrop ${0.8 + (i % 4) * 0.3}s ease-in ${(i % 6) * 0.15}s both`,
          color: i % 3 === 0 ? color : i % 3 === 1 ? "#fff" : "#f5c542",
        }}>
          {items[i % items.length]}
        </div>
      ))}
    </div>
  );
}

export default function JokerGame() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [stake, setStake] = useState(500);
  const [selection, setSelection] = useState<string | null>(null);
  const [phase, setPhase] = useState<"betting" | "waiting" | "result">("betting");
  const [result, setResult] = useState<any>(null);
  const [balance, setBalance] = useState<number>(parseFloat(user?.balance || "0"));
  const [isPlacing, setIsPlacing] = useState(false);
  const [waitDots, setWaitDots] = useState(".");
  const tickRef = useRef(0);

  useEffect(() => { setBalance(parseFloat(user?.balance || "0")); }, [user?.balance]);

  useEffect(() => {
    if (phase !== "waiting") return;
    const iv = setInterval(() => setWaitDots(d => d.length >= 3 ? "." : d + "."), 500);
    return () => clearInterval(iv);
  }, [phase]);

  const pollRound = useCallback(async (rId: string, sel: string) => {
    tickRef.current = 0;
    const interval = setInterval(async () => {
      tickRef.current++;
      if (tickRef.current > 180) { clearInterval(interval); setPhase("betting"); return; }
      try {
        const r = await fetch(`${API}/api/games/casino-round/joker/${rId}`, { credentials: "include" });
        const data = await r.json();
        if (data.status === "settled") {
          clearInterval(interval);
          setResult(data);
          setTimeout(() => {
            setPhase("result");
            if (data.result === sel) playWin(); else playLose();
            queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetBalanceQueryKey() });
          }, 1800);
        }
      } catch (_) {}
    }, 500);
  }, [queryClient]);

  const placeBet = async () => {
    if (!isAuthenticated) { setLocation("/login"); return; }
    if (!selection) { toast({ title: "Pick a side first!", variant: "destructive" }); return; }
    if (balance < stake) { toast({ title: "Insufficient balance!", variant: "destructive" }); return; }
    setIsPlacing(true);
    try {
      const r = await fetch(`${API}/api/games/joker`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stake, selection }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Failed to place bet");
      setBalance(data.newBalance);
      setPhase("waiting");
      pollRound(data.roundId, selection);
      const opt = OPTIONS.find(o => o.key === selection);
      toast({ title: "🤡 Bet Placed!", description: `${formatCurrency(stake)} on ${opt?.label}` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setIsPlacing(false); }
  };

  const reset = () => { setPhase("betting"); setResult(null); setSelection(null); };
  const won = result?.result === selection;
  const selOpt = OPTIONS.find(o => o.key === selection);
  const resOpt = OPTIONS.find(o => o.key === result?.result);
  const profit = selOpt ? stake * (selOpt.mult - 1) : 0;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "linear-gradient(180deg,#1a0040 0%,#0d0020 60%,#06000f 100%)", position: "relative", overflow: "hidden" }}>
      <style>{STYLES}</style>

      {/* Background orbs */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: "10%", left: "15%", width: 280, height: 280, borderRadius: "50%", background: "rgba(168,85,247,0.15)", filter: "blur(60px)", animation: "orbPulse 4s ease-in-out infinite" }} />
        <div style={{ position: "absolute", bottom: "20%", right: "10%", width: 220, height: 220, borderRadius: "50%", background: "rgba(245,197,66,0.1)", filter: "blur(50px)", animation: "orbPulse 5s ease-in-out 1s infinite" }} />
        <div style={{ position: "absolute", top: "50%", left: "50%", width: 350, height: 350, borderRadius: "50%", background: "rgba(239,68,68,0.07)", filter: "blur(80px)", transform: "translate(-50%,-50%)", animation: "orbPulse 6s ease-in-out 2s infinite" }} />
      </div>

      {/* Header */}
      <header style={{ position: "sticky", top: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "rgba(20,0,50,0.92)", borderBottom: "1px solid rgba(168,85,247,0.3)", backdropFilter: "blur(16px)" }}>
        <button onClick={() => setLocation("/")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.65)", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
          <ArrowLeft size={15} /> Back
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <img src={LOGO} alt="Joker" style={{ width: 32, height: 32, borderRadius: 8, objectFit: "cover", border: "1.5px solid rgba(245,197,66,0.5)" }} />
          <span style={{ fontWeight: 900, fontSize: 17, background: "linear-gradient(90deg,#f5c542,#ffeba1,#f5c542)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Joker Joker
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 10, background: "rgba(245,197,66,0.1)", border: "1px solid rgba(245,197,66,0.25)", color: "#f5c542", fontSize: 13, fontWeight: 700 }}>
          <Wallet size={13} /> {formatCurrency(balance)}
        </div>
      </header>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "0 12px 20px", gap: 14, maxWidth: 500, margin: "0 auto", width: "100%", position: "relative", zIndex: 1 }}>

        {/* ── Hero Logo Banner ── */}
        <div style={{ width: "100%", position: "relative", borderRadius: "0 0 28px 28px", overflow: "hidden", boxShadow: "0 8px 48px rgba(168,85,247,0.4), 0 0 80px rgba(245,197,66,0.15)" }}>
          <img src={LOGO} alt="Joker Joker" style={{ width: "100%", height: 200, objectFit: "cover", objectPosition: "center 20%", display: "block" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(0deg, rgba(20,0,50,0.85) 0%, rgba(20,0,50,0.2) 50%, transparent 100%)" }} />
          <div style={{ position: "absolute", bottom: 12, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 6 }}>
            {PRIZE_TIERS.map((tier, i) => (
              <div key={i} style={{
                padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 800,
                background: tier.bg, border: `1.5px solid ${tier.border}55`,
                color: tier.color, letterSpacing: 0.5,
                animation: `prizeShimmer ${2 + i * 0.4}s ease-in-out ${i * 0.3}s infinite`,
                textShadow: `0 0 10px ${tier.color}88`,
              }}>
                {tier.label} <span style={{ color: "#fff", marginLeft: 3 }}>{tier.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Game Table ── */}
        <div style={{
          width: "100%", borderRadius: 24, overflow: "hidden", position: "relative",
          background: "linear-gradient(135deg,#1a0840 0%,#2d0d6b 40%,#1a0840 100%)",
          border: "2px solid rgba(168,85,247,0.4)",
          boxShadow: "0 8px 40px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.08)",
          minHeight: 220,
        }}>
          {/* Diamond felt pattern */}
          <div style={{ position: "absolute", inset: 0, opacity: 0.04, backgroundImage: "repeating-linear-gradient(45deg,#a855f7 0px,#a855f7 1px,transparent 1px,transparent 10px)" }} />

          {/* Betting phase */}
          {phase === "betting" && (
            <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 16px", gap: 16 }}>
              <div style={{ fontSize: 72, animation: "jokerFloat 3s ease-in-out infinite", filter: "drop-shadow(0 8px 24px rgba(245,197,66,0.5))" }}>
                🤡
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", marginBottom: 4 }}>Teen Patti · Joker Wild</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Player • Banker • Joker 9×</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 16px", borderRadius: 20, background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.35)" }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 8px #4ade80", animation: "prizeShimmer 1.2s ease-in-out infinite" }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: "#a78bfa" }}>Place your bet to start</span>
              </div>
            </div>
          )}

          {/* Waiting phase */}
          {phase === "waiting" && (
            <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "28px 16px", gap: 18 }}>
              <SpinningCard />
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 17, fontWeight: 900, color: "#fff" }}>Joker is deciding{waitDots}</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginTop: 4 }}>
                  Your bet:{" "}
                  <span style={{ color: selOpt?.color, fontWeight: 800 }}>{selOpt?.icon} {selOpt?.label}</span>
                </div>
              </div>
              <div style={{ padding: "12px 24px", borderRadius: 16, background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.07)", textAlign: "center" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>Your stake</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#f5c542" }}>{formatCurrency(stake)}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
                  Potential win: {formatCurrency(stake * (selOpt?.mult ?? 1))}
                </div>
              </div>
            </div>
          )}

          {/* Result phase */}
          {phase === "result" && (
            <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "28px 16px", gap: 14, overflow: "hidden" }}>
              {won && <WinConfetti color={selOpt?.color ?? "#f5c542"} />}
              <div style={{ fontSize: 64, animation: won ? "jokerFloat 0.8s ease-in-out infinite" : "none", filter: `drop-shadow(0 8px 28px ${won ? (selOpt?.color ?? "#f5c542") : "#ef4444"}aa)`, position: "relative", zIndex: 3 }}>
                {won ? "🏆" : "😔"}
              </div>
              <div style={{
                padding: "16px 32px", borderRadius: 20, textAlign: "center",
                background: won ? "rgba(245,197,66,0.12)" : "rgba(239,68,68,0.1)",
                border: `2px solid ${won ? "rgba(245,197,66,0.4)" : "rgba(239,68,68,0.3)"}`,
                animation: "resultPop 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards",
                position: "relative", zIndex: 3,
              }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: won ? "#f5c542" : "#f87171", marginBottom: 4 }}>
                  {won ? "YOU WON!" : "You Lost"}
                </div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)" }}>
                  Result:{" "}
                  <span style={{ color: resOpt?.color, fontWeight: 800 }}>{resOpt?.icon} {resOpt?.label}</span>
                </div>
                {won && (
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#4ade80", marginTop: 6 }}>
                    +{formatCurrency(profit)}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Controls ── */}
        {phase === "result" && (
          <button onClick={reset} style={{
            width: "100%", padding: "15px 0", borderRadius: 16, fontWeight: 900, fontSize: 16, letterSpacing: 2,
            background: "linear-gradient(135deg,#7c3aed 0%,#a855f7 50%,#7c3aed 100%)",
            color: "#fff", border: "2px solid rgba(168,85,247,0.6)", cursor: "pointer",
            boxShadow: "0 4px 24px rgba(168,85,247,0.5)",
          }}>
            🤡 Play Again
          </button>
        )}

        {phase === "betting" && (
          <>
            {/* Bet options */}
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
              <p style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: 3, textTransform: "uppercase", margin: 0 }}>
                Choose Your Side
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                {OPTIONS.map(opt => {
                  const isSel = selection === opt.key;
                  return (
                    <button key={opt.key} onClick={() => setSelection(opt.key)} style={{
                      padding: "16px 8px", borderRadius: 18, display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                      background: isSel
                        ? `radial-gradient(ellipse at top, ${opt.color}30 0%, rgba(20,0,50,0.9) 100%)`
                        : "rgba(30,0,60,0.7)",
                      border: `2px solid ${isSel ? opt.color : "rgba(168,85,247,0.2)"}`,
                      boxShadow: isSel ? `0 0 28px ${opt.glow}, inset 0 1px 0 rgba(255,255,255,0.1)` : "none",
                      cursor: "pointer",
                      transform: isSel ? "scale(1.04)" : "scale(1)",
                      transition: "all 0.18s",
                    }}>
                      <span style={{ fontSize: 32, filter: isSel ? `drop-shadow(0 0 10px ${opt.color})` : "none" }}>
                        {opt.icon}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: isSel ? "#fff" : "rgba(255,255,255,0.7)" }}>
                        {opt.label}
                      </span>
                      <span style={{
                        fontSize: 12, fontWeight: 900, padding: "3px 10px", borderRadius: 10,
                        background: isSel ? `${opt.color}30` : "rgba(255,255,255,0.06)",
                        color: isSel ? opt.color : "rgba(255,255,255,0.4)",
                        border: `1px solid ${isSel ? opt.color + "55" : "rgba(255,255,255,0.08)"}`,
                      }}>
                        {opt.sub}
                      </span>
                      <span style={{ fontSize: 10, color: opt.color, fontWeight: 700, opacity: isSel ? 1 : 0.4 }}>
                        {opt.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Chip selector */}
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              {CHIP_AMOUNTS.map(amt => {
                const active = stake === amt;
                return (
                  <button key={amt} onClick={() => setStake(amt)} style={{
                    width: 58, height: 58, borderRadius: "50%", fontWeight: 900, fontSize: 12,
                    border: `3px solid ${active ? "#f5c542" : "rgba(168,85,247,0.3)"}`,
                    background: active
                      ? "radial-gradient(circle at 38% 35%, #ffde6a, #b8860b)"
                      : "radial-gradient(circle at 38% 35%, #2d0d6b, #1a0840)",
                    color: active ? "#1a0040" : "rgba(255,255,255,0.5)",
                    cursor: "pointer",
                    boxShadow: active
                      ? "0 0 20px rgba(245,197,66,0.6), inset 0 2px 0 rgba(255,255,255,0.3)"
                      : "inset 0 2px 0 rgba(255,255,255,0.05)",
                    animation: active ? "chipBounce 0.8s ease-in-out infinite" : "none",
                    transition: "all 0.18s",
                  }}>
                    {amt >= 1000 ? `${amt / 1000}K` : amt}
                  </button>
                );
              })}
            </div>

            {/* Place bet button */}
            {isAuthenticated ? (
              <button onClick={placeBet} disabled={isPlacing || !selection} style={{
                width: "100%", padding: "15px 0", borderRadius: 16, fontWeight: 900, fontSize: 16, letterSpacing: 2,
                background: selection
                  ? "linear-gradient(135deg,#7c3aed 0%,#a855f7 50%,#f5c542 100%)"
                  : "rgba(255,255,255,0.05)",
                color: selection ? "#fff" : "rgba(255,255,255,0.25)",
                border: `2px solid ${selection ? "rgba(168,85,247,0.6)" : "rgba(255,255,255,0.06)"}`,
                cursor: selection ? "pointer" : "not-allowed",
                boxShadow: selection ? "0 4px 28px rgba(168,85,247,0.55)" : "none",
                transition: "all 0.2s",
              }}>
                {isPlacing ? "🃏 Dealing cards..." : !selection ? "← PICK A SIDE" : `🃏 PLACE BET · ${formatCurrency(stake)}`}
              </button>
            ) : (
              <button onClick={() => setLocation("/login")} style={{
                width: "100%", padding: "15px 0", borderRadius: 16, fontWeight: 900, fontSize: 16,
                background: "linear-gradient(135deg,#7c3aed,#4f46e5)", color: "#fff",
                border: "none", cursor: "pointer", boxShadow: "0 4px 20px rgba(124,58,237,0.5)",
              }}>
                LOG IN TO PLAY
              </button>
            )}

            {/* Payout info strip */}
            <div style={{ width: "100%", display: "flex", gap: 8 }}>
              {OPTIONS.map(opt => (
                <div key={opt.key} style={{
                  flex: 1, padding: "8px 4px", borderRadius: 12, textAlign: "center",
                  background: `${opt.color}0f`, border: `1px solid ${opt.color}25`,
                }}>
                  <div style={{ fontSize: 14 }}>{opt.icon}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>{opt.label}</div>
                  <div style={{ fontSize: 12, fontWeight: 900, color: opt.color }}>{opt.sub}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
