import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey, getGetBalanceQueryKey } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, RefreshCw } from "lucide-react";

type Side = "andar" | "bahar";
type Phase = "betting" | "dealing" | "revealing" | "result";
const CHIP_AMOUNTS = [100, 500, 1000, 5000, 10000];

const STYLES = `
@keyframes cardDeal {
  0% { transform: translateY(-40px) rotate(-8deg) scale(0.7); opacity: 0; }
  70% { transform: translateY(4px) rotate(1deg) scale(1.03); opacity: 1; }
  100% { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; }
}
@keyframes cardFlip {
  0% { transform: rotateY(90deg) scale(0.9); opacity: 0.3; }
  100% { transform: rotateY(0deg) scale(1); opacity: 1; }
}
@keyframes jokerReveal {
  0% { transform: scale(0.4) rotate(-20deg); opacity: 0; }
  65% { transform: scale(1.12) rotate(4deg); opacity: 1; }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}
@keyframes resultPop {
  0% { transform: scale(0.5) translateY(20px); opacity: 0; }
  65% { transform: scale(1.06) translateY(-4px); opacity: 1; }
  100% { transform: scale(1) translateY(0); opacity: 1; }
}
@keyframes sideWin {
  0%, 100% { transform: scale(1); box-shadow: 0 0 20px rgba(34,197,94,0.4); }
  50% { transform: scale(1.03); box-shadow: 0 0 40px rgba(34,197,94,0.8); }
}
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
@keyframes dealingPulse {
  0%, 100% { opacity: 0.7; }
  50% { opacity: 1; }
}
`;

type DCard = { rank: string; suit: string; value: number };

function FaceDownCard({ delay = 0 }: { delay?: number }) {
  return (
    <div style={{
      width: 52, height: 74, borderRadius: 7, flexShrink: 0,
      background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%)",
      border: "2px solid rgba(255,255,255,0.25)",
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: "0 4px 12px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1)",
      animation: `cardDeal 0.35s ease-out ${delay}s both`,
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", inset: 4, border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4 }} />
      <div style={{ fontSize: 22, opacity: 0.5 }}>🂠</div>
    </div>
  );
}

function MiniCard({ card, isMatch, revealed, delay = 0 }: { card: DCard; isMatch: boolean; revealed: boolean; delay?: number }) {
  const isRed = card.suit === "♥" || card.suit === "♦";
  return (
    <div style={{
      width: 52, height: 74, borderRadius: 7, flexShrink: 0,
      background: revealed ? "white" : "linear-gradient(135deg,#1e1b4b,#312e81)",
      border: `2.5px solid ${isMatch && revealed ? "#22c55e" : revealed ? "#d1d5db" : "rgba(255,255,255,0.2)"}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      flexDirection: "column", fontFamily: "Georgia,serif", fontWeight: "bold",
      color: isRed ? "#dc2626" : "#111827",
      animation: revealed ? `cardFlip 0.35s ease-out ${delay}s both` : undefined,
      boxShadow: isMatch && revealed
        ? "0 0 16px rgba(34,197,94,0.8), 0 4px 12px rgba(0,0,0,0.5)"
        : "0 4px 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)",
      position: "relative", overflow: "hidden",
    }}>
      {revealed ? (
        <>
          <div style={{ position: "absolute", top: 3, left: 5, fontSize: 10, fontWeight: 900, lineHeight: 1, color: isRed ? "#dc2626" : "#111827" }}>{card.rank}</div>
          <div style={{ fontSize: 22 }}>{card.suit}</div>
          <div style={{ position: "absolute", bottom: 3, right: 5, fontSize: 10, fontWeight: 900, lineHeight: 1, color: isRed ? "#dc2626" : "#111827", transform: "rotate(180deg)" }}>{card.rank}</div>
          {isMatch && (
            <div style={{ position: "absolute", inset: 0, background: "rgba(34,197,94,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ fontSize: 18 }}>✓</div>
            </div>
          )}
        </>
      ) : (
        <div style={{ fontSize: 22, opacity: 0.4 }}>🂠</div>
      )}
    </div>
  );
}

function JokerCard({ card, revealed }: { card: DCard | null; revealed: boolean }) {
  const isRed = card && (card.suit === "♥" || card.suit === "♦");
  return (
    <div style={{
      width: 90, height: 126, borderRadius: 12, margin: "0 auto",
      background: revealed && card ? "white" : "linear-gradient(145deg, #6d28d9 0%, #4f46e5 50%, #7c3aed 100%)",
      border: `4px solid ${revealed ? "#f5c542" : "rgba(245,197,66,0.6)"}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      flexDirection: "column", fontFamily: "Georgia,serif", fontWeight: "bold",
      color: isRed ? "#dc2626" : "#111827",
      boxShadow: revealed
        ? "0 0 40px rgba(245,197,66,0.6), 0 12px 32px rgba(0,0,0,0.6)"
        : "0 0 20px rgba(109,40,217,0.4), 0 8px 24px rgba(0,0,0,0.5)",
      animation: revealed ? "jokerReveal 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards" : undefined,
      position: "relative",
      transition: "box-shadow 0.3s",
    }}>
      {revealed && card ? (
        <>
          <div style={{ position: "absolute", top: 5, left: 7, fontSize: 13, fontWeight: 900, color: isRed ? "#dc2626" : "#111827" }}>{card.rank}</div>
          <div style={{ fontSize: 36 }}>{card.suit}</div>
          <div style={{ position: "absolute", bottom: 5, right: 7, fontSize: 13, fontWeight: 900, color: isRed ? "#dc2626" : "#111827", transform: "rotate(180deg)" }}>{card.rank}</div>
        </>
      ) : (
        <>
          <div style={{ position: "absolute", inset: 4, border: "1.5px solid rgba(255,255,255,0.15)", borderRadius: 8 }} />
          <div style={{ fontSize: 40, filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))" }}>🃏</div>
        </>
      )}
      {revealed && (
        <div style={{ position: "absolute", top: -13, left: "50%", transform: "translateX(-50%)", background: "linear-gradient(90deg,#c8952a,#f5c542,#c8952a)", borderRadius: 8, padding: "3px 10px", fontSize: 9, fontWeight: 900, color: "#1a0a00", whiteSpace: "nowrap", letterSpacing: 1 }}>
          JOKER
        </div>
      )}
    </div>
  );
}

function playCardSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtx();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.06, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) * 0.6;
    const src = ctx.createBufferSource(); const g = ctx.createGain();
    src.buffer = buf; src.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.3, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
    src.start(); setTimeout(() => ctx.close(), 500);
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

export default function AndarBaharGame() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState<Phase>("betting");
  const [selection, setSelection] = useState<Side | null>(null);
  const [stake, setStake] = useState(500);
  const [customStake, setCustomStake] = useState("");
  const [joker, setJoker] = useState<DCard | null>(null);
  const [jokerRevealed, setJokerRevealed] = useState(false);
  const [allCards, setAllCards] = useState<Array<{ card: DCard; side: Side; isMatch: boolean }>>([]);
  const [revealedCount, setRevealedCount] = useState(0);
  const [simulatedCount, setSimulatedCount] = useState(0);
  const [result, setResult] = useState<{ result: Side; won: boolean; winAmount: number; netChange: number; newBalance: number } | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const simIvRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clearTimers = () => { timersRef.current.forEach(clearTimeout); timersRef.current = []; };
  const addTimer = (fn: () => void, delay: number) => { const t = setTimeout(fn, delay); timersRef.current.push(t); return t; };
  useEffect(() => () => { clearTimers(); if (simIvRef.current) clearInterval(simIvRef.current); }, []);

  useEffect(() => {
    if (phase !== "dealing") { if (simIvRef.current) { clearInterval(simIvRef.current); simIvRef.current = null; } return; }
    setSimulatedCount(0);
    let count = 0;
    const t = setTimeout(() => {
      simIvRef.current = setInterval(() => {
        count++;
        setSimulatedCount(count);
        playCardSound();
        if (count >= 18) { if (simIvRef.current) { clearInterval(simIvRef.current); simIvRef.current = null; } }
      }, 300);
    }, 700);
    timersRef.current.push(t);
    return () => { clearTimeout(t); if (simIvRef.current) { clearInterval(simIvRef.current); simIvRef.current = null; } };
  }, [phase]);

  const handleDeal = async () => {
    if (!selection || stake <= 0) { toast({ title: "Pick Andar or Bahar and enter a stake", variant: "destructive" }); return; }
    if (!isAuthenticated) { setLocation("/login"); return; }
    clearTimers();
    setPhase("dealing"); setJoker(null); setJokerRevealed(false);
    setAllCards([]); setRevealedCount(0); setResult(null);
    try {
      const resp = await fetch("/api/games/andar-bahar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ stake, selection }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        if (resp.status === 401) { queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() }); toast({ title: "Session Expired", variant: "destructive" }); }
        else toast({ title: "Bet Failed", description: err.error || "Something went wrong.", variant: "destructive" });
        setPhase("betting"); return;
      }
      const placed = await resp.json();
      const balanceAfterBet = placed.newBalance as number;
      const roundId = placed.roundId as string;
      const myStake = stake, mySel = selection;
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetBalanceQueryKey() });
      const startedAt = Date.now();
      const pollId: ReturnType<typeof setInterval> = setInterval(async () => {
        if (Date.now() - startedAt > 10 * 60 * 1000) { clearInterval(pollId); return; }
        try {
          const r = await fetch(`/api/games/casino-round/andar-bahar/${encodeURIComponent(roundId)}`, { credentials: "include" });
          if (!r.ok) return;
          const d = await r.json();
          if (d.status !== "settled") return;
          clearInterval(pollId);
          const det = d.details as { joker: DCard; dealtCards: Array<{ card: DCard; side: Side; isMatch: boolean }>; winner: Side };
          const won = det.winner === mySel;
          const winAmount = won ? Math.round(myStake * 1.95 * 100) / 100 : 0;
          if (simIvRef.current) { clearInterval(simIvRef.current); simIvRef.current = null; }
          setSimulatedCount(0);
          setJoker(det.joker);
          setAllCards(det.dealtCards);
          setPhase("revealing");
          addTimer(() => { setJokerRevealed(true); playCardSound(); }, 400);
          det.dealtCards.forEach((_, i) => addTimer(() => { setRevealedCount(i + 1); playCardSound(); }, 1100 + i * 300));
          const totalTime = 1100 + det.dealtCards.length * 300 + 600;
          addTimer(() => {
            setResult({ result: det.winner, won, winAmount, netChange: winAmount - myStake, newBalance: balanceAfterBet + winAmount });
            setPhase("result");
            queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetBalanceQueryKey() });
            if (won) playWin(); else playLose();
          }, totalTime);
        } catch {}
      }, 500);
    } catch {
      toast({ title: "Network Error", variant: "destructive" });
      setPhase("betting");
    }
  };

  const handlePlayAgain = () => {
    clearTimers();
    if (simIvRef.current) { clearInterval(simIvRef.current); simIvRef.current = null; }
    setPhase("betting"); setJoker(null); setJokerRevealed(false);
    setAllCards([]); setRevealedCount(0); setSimulatedCount(0); setResult(null);
  };

  const balance = user?.balance ?? 0;
  const canDeal = selection !== null && stake > 0 && stake <= balance && phase === "betting";

  const andarCards = allCards.filter(c => c.side === "andar").slice(0, revealedCount);
  const baharCards = allCards.filter((c, i) => {
    const cum = allCards.slice(0, i + 1);
    return c.side === "bahar" && (cum.filter(x => x.side === "andar").length + cum.filter(x => x.side === "bahar").length) <= revealedCount;
  });

  if (isLoading) return <div className="flex h-screen items-center justify-center" style={{ background: "#08080f" }}><div className="h-10 w-10 animate-spin rounded-full border-4 border-yellow-500 border-t-transparent" /></div>;

  const andarSim = Math.ceil(simulatedCount / 2);
  const baharSim = Math.floor(simulatedCount / 2);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(160deg, #08080f 0%, #0a100a 100%)" }}>
      <style>{STYLES}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid rgba(200,149,42,0.2)", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(10px)" }}>
        <button onClick={() => setLocation("/")} style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.5)", background: "none", border: "none", cursor: "pointer", padding: "4px 0" }}>
          <ArrowLeft size={18} /><span style={{ fontSize: 13 }}>Back</span>
        </button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 17, fontWeight: 900, letterSpacing: 4, color: "#f5c542", fontFamily: "Georgia,serif" }}>🃏 ANDAR BAHAR</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: 1 }}>Match the Joker — which side wins?</div>
        </div>
        <div style={{ textAlign: "right", minWidth: 80 }}>
          {isAuthenticated ? (
            <div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: 1 }}>BALANCE</div>
              <div style={{ fontSize: 15, fontWeight: 900, color: "#f5c542", fontFamily: "monospace" }}>{formatCurrency(result?.newBalance ?? balance)}</div>
            </div>
          ) : (
            <button onClick={() => setLocation("/login")} style={{ color: "#f5c542", fontSize: 12, background: "none", border: "none", cursor: "pointer" }}>Login</button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "14px 14px 20px", maxWidth: 520, margin: "0 auto", width: "100%" }}>

        {/* ═══ CASINO TABLE ═══ */}
        <div style={{
          position: "relative",
          background: "radial-gradient(ellipse at 50% 30%, #1e7038 0%, #0e4d20 45%, #083018 75%, #041a0c 100%)",
          borderRadius: "46% 46% 44% 44% / 18% 18% 16% 16%",
          border: "5px solid #c8952a",
          boxShadow: "0 0 0 2px #7a5518, 0 0 0 8px rgba(200,149,42,0.12), inset 0 0 120px rgba(0,0,0,0.35), 0 24px 60px rgba(0,0,0,0.7)",
          padding: "28px 20px 52px",
          marginBottom: 14,
        }}>
          {/* Felt sheen */}
          <div style={{ position: "absolute", top: 0, left: "8%", right: "8%", height: "45%", background: "radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.08) 0%, transparent 70%)", pointerEvents: "none", borderRadius: "50%/30%", zIndex: 0 }} />

          {/* ── Joker Section ── */}
          <div style={{ position: "relative", zIndex: 1, textAlign: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: "rgba(245,197,66,0.6)", letterSpacing: 4, fontFamily: "Georgia,serif", marginBottom: 10 }}>✦ JOKER CARD ✦</div>
            <JokerCard card={joker} revealed={jokerRevealed} />
            {jokerRevealed && joker && (
              <div style={{ marginTop: 10, color: "rgba(255,255,255,0.55)", fontSize: 12 }}>
                Match the rank: <span style={{ color: "#f5c542", fontWeight: 900, fontSize: 15 }}>{joker.rank}</span>
              </div>
            )}
            {phase === "dealing" && !jokerRevealed && (
              <div style={{ marginTop: 10, color: "rgba(245,197,66,0.7)", fontSize: 11, letterSpacing: 2, animation: "dealingPulse 1s ease-in-out infinite" }}>
                DEALING CARDS{simulatedCount > 0 ? ` · ${simulatedCount}` : "..."}
              </div>
            )}
          </div>

          {/* ── ANDAR | BAHAR columns ── */}
          <div style={{ position: "relative", zIndex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { side: "andar" as Side, label: "ANDAR", badge: "A", color: "#3b82f6", simCount: andarSim, cards: andarCards },
              { side: "bahar" as Side, label: "BAHAR", badge: "B", color: "#ef4444", simCount: baharSim, cards: baharCards },
            ].map(col => {
              const isWinner = phase === "result" && result?.result === col.side;
              return (
                <div key={col.side} style={{
                  background: isWinner ? "rgba(34,197,94,0.18)" : "rgba(0,0,0,0.25)",
                  borderRadius: 10,
                  padding: "10px 6px 12px",
                  border: `2px solid ${isWinner ? "#22c55e" : col.color + "40"}`,
                  animation: isWinner ? "sideWin 0.8s ease-in-out infinite" : undefined,
                  minHeight: 85,
                  backdropFilter: "blur(4px)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, marginBottom: 10 }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: "50%",
                      background: col.color,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 900, color: "white",
                      boxShadow: `0 2px 8px ${col.color}60`,
                    }}>{col.badge}</div>
                    <span style={{ color: col.color, fontSize: 12, fontWeight: 900, letterSpacing: 2, fontFamily: "Georgia,serif" }}>{col.label}</span>
                    {isWinner && <span style={{ fontSize: 14 }}>✓</span>}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "center" }}>
                    {phase === "dealing" && Array.from({ length: col.simCount }).map((_, i) => <FaceDownCard key={i} />)}
                    {phase !== "dealing" && col.cards.map((c, i) => <MiniCard key={i} card={c.card} isMatch={c.isMatch} revealed={true} delay={0} />)}
                    {((phase === "dealing" && col.simCount === 0) || (phase !== "dealing" && col.cards.length === 0)) && (
                      <div style={{ color: "rgba(255,255,255,0.18)", fontSize: 22, textAlign: "center", width: "100%", paddingTop: 6 }}>·</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Result banner ── */}
          {phase === "result" && result && (
            <div style={{
              position: "relative", zIndex: 1, marginTop: 14,
              padding: "12px 16px", borderRadius: 12, textAlign: "center",
              background: result.won ? "rgba(34,197,94,0.22)" : "rgba(239,68,68,0.2)",
              border: `1.5px solid ${result.won ? "#22c55e80" : "#ef444455"}`,
              animation: "resultPop 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards",
            }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: result.won ? "#4ade80" : "#f87171", letterSpacing: 3, fontFamily: "Georgia,serif" }}>
                {result.result.toUpperCase()} WINS!
              </div>
              <div style={{ fontSize: 14, color: result.won ? "#86efac" : "#fca5a5", marginTop: 4, fontWeight: 600 }}>
                {result.won ? `🎉 You won ${formatCurrency(result.winAmount)}!` : "Better luck next time!"}
              </div>
            </div>
          )}
        </div>

        {/* ═══ BETTING PANEL ═══ */}
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(200,149,42,0.18)", borderRadius: 18, padding: "18px 16px 20px", backdropFilter: "blur(8px)" }}>
          {phase === "result" ? (
            <button onClick={handlePlayAgain} style={{ width: "100%", padding: "14px 0", borderRadius: 12, background: "linear-gradient(135deg, #7c3aed, #4f46e5)", color: "white", fontWeight: 900, fontSize: 16, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, letterSpacing: 1 }}>
              <RefreshCw size={18} /> PLAY AGAIN
            </button>
          ) : (
            <>
              {/* Side selection */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: 3, marginBottom: 8, fontFamily: "Georgia,serif" }}>PICK YOUR SIDE</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[
                    { id: "andar" as Side, label: "ANDAR", badge: "A", sub: "Left side", payout: "1.9×", color: "#3b82f6" },
                    { id: "bahar" as Side, label: "BAHAR", badge: "B", sub: "Right side", payout: "2.0×", color: "#ef4444" },
                  ].map(opt => (
                    <button key={opt.id} onClick={() => phase === "betting" && setSelection(opt.id)} disabled={phase !== "betting"}
                      style={{
                        padding: "12px 8px", borderRadius: 10, textAlign: "center",
                        border: `2px solid ${selection === opt.id ? opt.color : "rgba(255,255,255,0.1)"}`,
                        background: selection === opt.id ? `${opt.color}20` : "rgba(255,255,255,0.04)",
                        cursor: phase === "betting" ? "pointer" : "not-allowed", transition: "all 0.2s",
                      }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, marginBottom: 4 }}>
                        <div style={{ width: 18, height: 18, borderRadius: "50%", background: opt.color, fontSize: 9, fontWeight: 900, color: "white", display: "flex", alignItems: "center", justifyContent: "center" }}>{opt.badge}</div>
                        <span style={{ fontSize: 13, fontWeight: 900, color: selection === opt.id ? opt.color : "rgba(255,255,255,0.5)", letterSpacing: 1 }}>{opt.label}</span>
                      </div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{opt.sub}</div>
                      <div style={{ fontSize: 15, color: opt.color, fontWeight: 900, marginTop: 4 }}>{opt.payout}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Chip selector */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: 3, marginBottom: 8, fontFamily: "Georgia,serif" }}>STAKE (PKR)</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 5 }}>
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

              {/* Custom + win preview */}
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <input type="number" min="0" placeholder="Custom amount" value={customStake} disabled={phase !== "betting"}
                  onChange={e => { setCustomStake(e.target.value); const p = parseFloat(e.target.value); setStake(isNaN(p) ? 0 : p); }}
                  style={{ flex: 1, padding: "9px 12px", borderRadius: 8, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "white", fontSize: 13, outline: "none" }} />
                {stake > 0 && selection && (
                  <div style={{ padding: "9px 12px", borderRadius: 8, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", color: "#4ade80", fontSize: 12, fontWeight: 900, display: "flex", alignItems: "center", whiteSpace: "nowrap" }}>
                    Win {formatCurrency(Math.round(stake * (selection === "bahar" ? 2.0 : 1.9)))}
                  </div>
                )}
              </div>

              {/* Deal button */}
              {!isAuthenticated ? (
                <button onClick={() => setLocation("/login")} style={{ width: "100%", padding: "14px 0", borderRadius: 12, background: "linear-gradient(135deg, #c8952a 0%, #f5c542 50%, #c8952a 100%)", color: "#0a0a00", fontWeight: 900, fontSize: 15, border: "none", cursor: "pointer", letterSpacing: 2 }}>
                  LOGIN TO PLAY
                </button>
              ) : (
                <button onClick={handleDeal} disabled={!canDeal} style={{
                  width: "100%", padding: "14px 0", borderRadius: 12, fontWeight: 900, fontSize: 15, letterSpacing: 2,
                  background: canDeal ? "linear-gradient(135deg, #c8952a 0%, #f5c542 50%, #c8952a 100%)" : "rgba(255,255,255,0.07)",
                  color: canDeal ? "#0a0a00" : "rgba(255,255,255,0.2)",
                  border: `2px solid ${canDeal ? "#f5c542" : "rgba(255,255,255,0.07)"}`,
                  cursor: canDeal ? "pointer" : "not-allowed",
                  boxShadow: canDeal ? "0 4px 24px rgba(245,197,66,0.4)" : "none",
                  transition: "all 0.2s",
                }}>
                  {phase === "dealing" ? "🃏 DEALING CARDS..." : phase === "revealing" ? "🃏 REVEALING..." : !selection ? "PICK ANDAR OR BAHAR" : stake <= 0 ? "ENTER YOUR STAKE" : "🃏 DEAL CARDS"}
                </button>
              )}
              {isAuthenticated && stake > balance && (
                <p style={{ color: "#f87171", fontSize: 11, textAlign: "center", marginTop: 6 }}>Insufficient balance — max: {formatCurrency(balance)}</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
