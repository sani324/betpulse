import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey, getGetBalanceQueryKey } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, RefreshCw } from "lucide-react";

type Side = "andar" | "bahar";
type Phase = "betting" | "dealing" | "result";
const CHIP_AMOUNTS = [100, 500, 1000, 5000];

const STYLES = `
@keyframes cardFlip {
  0% { transform: rotateY(0deg) scale(0.8); opacity: 0; }
  50% { transform: rotateY(90deg) scale(0.9); opacity: 0.5; }
  100% { transform: rotateY(0deg) scale(1); opacity: 1; }
}
@keyframes jokerReveal {
  0% { transform: scale(0) rotate(-15deg); opacity: 0; }
  60% { transform: scale(1.15) rotate(5deg); opacity: 1; }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}
@keyframes matchGlow {
  0%, 100% { box-shadow: 0 0 20px rgba(34,197,94,0.6); }
  50% { box-shadow: 0 0 50px rgba(34,197,94,1), 0 0 100px rgba(34,197,94,0.4); }
}
@keyframes resultPop {
  0% { transform: scale(0) rotate(-10deg); opacity: 0; }
  60% { transform: scale(1.1) rotate(3deg); opacity: 1; }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}
@keyframes sideWin {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.04); }
}
`;

type DCard = { rank: string; suit: string; value: number };

function MiniCard({ card, isMatch, revealed, delay = 0 }: { card: DCard; isMatch: boolean; revealed: boolean; delay?: number }) {
  const isRed = card.suit === "♥" || card.suit === "♦";
  return (
    <div style={{
      width: 44, height: 62, borderRadius: 6, flexShrink: 0,
      background: revealed ? "white" : "linear-gradient(135deg,#1e1b4b,#312e81)",
      border: `2px solid ${isMatch && revealed ? "#22c55e" : revealed ? "#e5e7eb" : "rgba(255,255,255,0.2)"}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      flexDirection: "column", fontFamily: "Georgia,serif", fontWeight: "bold",
      color: isRed ? "#dc2626" : "#111827",
      animation: revealed ? `cardFlip 0.4s ease-out ${delay}s both` : undefined,
      boxShadow: isMatch && revealed ? "0 0 20px rgba(34,197,94,0.7)" : "0 2px 8px rgba(0,0,0,0.4)",
      position: "relative", overflow: "hidden",
      transition: "border-color 0.3s",
    }}>
      {revealed ? (
        <>
          <div style={{ fontSize: 11, fontWeight: 900, lineHeight: 1 }}>{card.rank}</div>
          <div style={{ fontSize: 16 }}>{card.suit}</div>
          {isMatch && <div style={{ position: "absolute", inset: 0, background: "rgba(34,197,94,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ fontSize: 14 }}>✓</div></div>}
        </>
      ) : (
        <div style={{ fontSize: 18, opacity: 0.4 }}>🂠</div>
      )}
    </div>
  );
}

function JokerCard({ card, revealed }: { card: DCard | null; revealed: boolean }) {
  const isRed = card && (card.suit === "♥" || card.suit === "♦");
  return (
    <div style={{
      width: 80, height: 112, borderRadius: 12, margin: "0 auto",
      background: revealed ? "white" : "linear-gradient(135deg,#7c3aed,#4f46e5)",
      border: `4px solid ${revealed ? "#fbbf24" : "rgba(251,191,36,0.5)"}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      flexDirection: "column", fontFamily: "Georgia,serif", fontWeight: "bold",
      color: isRed ? "#dc2626" : "#111827",
      boxShadow: "0 0 30px rgba(251,191,36,0.4), 0 8px 24px rgba(0,0,0,0.5)",
      animation: revealed ? "jokerReveal 0.6s cubic-bezier(0.36,0.07,0.19,0.97) forwards" : undefined,
      position: "relative",
    }}>
      {revealed && card ? (
        <>
          <div style={{ fontSize: 18, fontWeight: 900 }}>{card.rank}</div>
          <div style={{ fontSize: 30 }}>{card.suit}</div>
        </>
      ) : (
        <div style={{ fontSize: 34, opacity: 0.8 }}>🃏</div>
      )}
      {revealed && <div style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", background: "#fbbf24", borderRadius: 8, padding: "2px 8px", fontSize: 9, fontWeight: 900, color: "#92400e", whiteSpace: "nowrap" }}>JOKER</div>}
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
  const [stake, setStake] = useState(0);
  const [customStake, setCustomStake] = useState("");
  const [joker, setJoker] = useState<DCard | null>(null);
  const [jokerRevealed, setJokerRevealed] = useState(false);
  const [allCards, setAllCards] = useState<Array<{ card: DCard; side: Side; isMatch: boolean }>>([]);
  const [revealedCount, setRevealedCount] = useState(0);
  const [result, setResult] = useState<{ result: Side; won: boolean; winAmount: number; netChange: number; newBalance: number } | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTimers = () => { timersRef.current.forEach(clearTimeout); timersRef.current = []; };
  const addTimer = (fn: () => void, delay: number) => { const t = setTimeout(fn, delay); timersRef.current.push(t); return t; };
  useEffect(() => () => clearTimers(), []);

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
      const roundId = placed.roundId as string;
      const myStake = stake, mySel = selection;
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetBalanceQueryKey() });
      toast({ title: "Bet placed", description: "Waiting for the round to be settled..." });
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
          setJoker(det.joker); setAllCards(det.dealtCards);
          addTimer(() => { setJokerRevealed(true); playCardSound(); }, 500);
          det.dealtCards.forEach((_, i) => addTimer(() => { setRevealedCount(i + 1); playCardSound(); }, 1200 + i * 320));
          const totalTime = 1200 + det.dealtCards.length * 320 + 600;
          addTimer(() => {
            setResult({ result: det.winner, won, winAmount, netChange: winAmount - myStake, newBalance: 0 });
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
    clearTimers(); setPhase("betting"); setSelection(null); setStake(0); setCustomStake("");
    setJoker(null); setJokerRevealed(false); setAllCards([]); setRevealedCount(0); setResult(null);
  };

  const balance = user?.balance ?? 0;
  const canDeal = selection !== null && stake > 0 && stake <= balance && phase === "betting";

  const andarCards = allCards.filter(c => c.side === "andar").slice(0, revealedCount);
  const baharCards = allCards.filter((c, i) => {
    const cumulativeAndar = allCards.slice(0, i + 1).filter(x => x.side === "andar").length;
    const cumulativeBahar = allCards.slice(0, i + 1).filter(x => x.side === "bahar").length;
    return c.side === "bahar" && (cumulativeBahar + cumulativeAndar) <= revealedCount;
  });

  if (isLoading) return <div className="flex h-screen items-center justify-center bg-background"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(160deg, #0a0a1a 0%, #0a1a0a 60%, #0a0a1a 100%)" }}>
      <style>{STYLES}</style>
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <button onClick={() => setLocation("/")} className="flex items-center gap-2 text-muted-foreground hover:text-white transition-colors">
          <ArrowLeft className="h-5 w-5" /><span className="text-sm">Back</span>
        </button>
        <div className="text-center">
          <h1 className="text-xl font-bold tracking-widest text-white uppercase">🃏 Andar Bahar</h1>
          <p className="text-xs text-muted-foreground">Match the Joker — which side wins?</p>
        </div>
        <div className="text-right">
          {isAuthenticated ? (
            <><p className="text-xs text-muted-foreground">Balance</p><p className="font-bold text-primary font-mono">{formatCurrency(result?.newBalance ?? balance)}</p></>
          ) : (
            <button onClick={() => setLocation("/login")} className="text-sm text-primary hover:underline">Login to Play</button>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        <div style={{
          background: "radial-gradient(ellipse at center, #0d4a1f 0%, #063010 60%, #041a0a 100%)",
          border: "5px solid #7c5c1e", borderRadius: 24, padding: "24px 16px",
          boxShadow: "inset 0 0 60px rgba(0,0,0,0.5), 0 8px 40px rgba(0,0,0,0.6)",
        }}>
          <div className="text-center mb-4">
            <p style={{ color: "#fbbf24", fontSize: 12, letterSpacing: 3, fontFamily: "Georgia,serif", marginBottom: 8 }}>JOKER CARD</p>
            <JokerCard card={joker} revealed={jokerRevealed} />
            {jokerRevealed && joker && (
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 8 }}>Match the rank: <span style={{ color: "#fbbf24", fontWeight: "bold" }}>{joker.rank}</span></p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            {[{ side: "andar", cards: andarCards, color: "#3b82f6", label: "ANDAR" }, { side: "bahar", cards: baharCards, color: "#f97316", label: "BAHAR" }].map(col => (
              <div key={col.side} style={{
                background: phase === "result" && result?.result === col.side ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.04)",
                border: `2px solid ${phase === "result" && result?.result === col.side ? "rgba(34,197,94,0.5)" : `${col.color}44`}`,
                borderRadius: 12, padding: "10px 8px", minHeight: 90,
                animation: phase === "result" && result?.result === col.side ? "sideWin 0.6s ease-in-out infinite" : undefined,
              }}>
                <p style={{ color: col.color, fontSize: 11, fontWeight: 900, letterSpacing: 2, textAlign: "center", marginBottom: 8, fontFamily: "Georgia,serif" }}>
                  {col.label} {phase === "result" && result?.result === col.side && "✓"}
                </p>
                <div className="flex flex-wrap gap-1 justify-center">
                  {col.cards.map((c, i) => (
                    <MiniCard key={i} card={c.card} isMatch={c.isMatch} revealed={true} delay={0} />
                  ))}
                  {col.cards.length === 0 && <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 12, textAlign: "center", width: "100%", marginTop: 12 }}>Waiting...</div>}
                </div>
              </div>
            ))}
          </div>

          {phase === "result" && result && (
            <div className="mt-4 rounded-xl py-3 px-4 text-center" style={{
              background: result.won ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
              border: `1px solid ${result.won ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.3)"}`,
              animation: "resultPop 0.5s cubic-bezier(0.36,0.07,0.19,0.97) forwards",
            }}>
              <p style={{ fontSize: 20, fontWeight: 900, color: result.won ? "#4ade80" : "#f87171", letterSpacing: 3, fontFamily: "Georgia,serif" }}>
                {result.result.toUpperCase()} WINS!
              </p>
              <p style={{ color: result.won ? "#4ade80" : "#f87171", fontWeight: "bold", marginTop: 4, fontSize: 14 }}>
                {result.won ? `You won ${formatCurrency(result.winAmount)}! 🎉` : "Better luck next time!"}
              </p>
            </div>
          )}
        </div>

        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 20 }}>
          {phase === "result" ? (
            <button onClick={handlePlayAgain} className="w-full py-3 rounded-xl font-bold text-base flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)", color: "white" }}>
              <RefreshCw className="h-5 w-5" /> Play Again
            </button>
          ) : (
            <>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, letterSpacing: 2, marginBottom: 10, textTransform: "uppercase" }}>Pick your side</p>
              <div className="grid grid-cols-2 gap-3 mb-5">
                {([{ id: "andar", label: "🔵 ANDAR", sub: "Left side", payout: "1.9×", color: "#3b82f6" }, { id: "bahar", label: "🟠 BAHAR", sub: "Right side", payout: "2.0×", color: "#f97316" }] as { id: Side; label: string; sub: string; payout: string; color: string }[]).map(opt => (
                  <button key={opt.id} onClick={() => phase === "betting" && setSelection(opt.id)} disabled={phase !== "betting"}
                    style={{
                      padding: "16px 8px", borderRadius: 12, textAlign: "center",
                      border: `2px solid ${selection === opt.id ? opt.color : "rgba(255,255,255,0.1)"}`,
                      background: selection === opt.id ? `${opt.color}33` : "rgba(255,255,255,0.05)",
                      color: selection === opt.id ? "white" : "rgba(255,255,255,0.5)",
                      fontWeight: "bold", cursor: phase === "betting" ? "pointer" : "not-allowed", transition: "all .2s",
                    }}>
                    <div style={{ fontSize: 16 }}>{opt.label}</div>
                    <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{opt.sub}</div>
                    <div style={{ fontSize: 12, color: opt.color, marginTop: 4, fontWeight: 900 }}>{opt.payout}</div>
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
                    Win: {formatCurrency(Math.round(stake * (selection === "bahar" ? 2.0 : 1.9)))}
                  </div>
                )}
              </div>
              {!isAuthenticated ? (
                <button onClick={() => setLocation("/login")} style={{ width: "100%", padding: 14, borderRadius: 12, background: "linear-gradient(135deg,#7c3aed,#4f46e5)", color: "white", fontWeight: "bold", fontSize: 16, border: "none", cursor: "pointer" }}>Log In to Play</button>
              ) : (
                <button onClick={handleDeal} disabled={!canDeal} style={{
                  width: "100%", padding: 14, borderRadius: 12, fontWeight: "bold", fontSize: 16, letterSpacing: 2,
                  background: canDeal ? "linear-gradient(135deg,#059669,#065f46)" : "rgba(255,255,255,0.08)",
                  color: canDeal ? "white" : "rgba(255,255,255,0.3)",
                  border: `2px solid ${canDeal ? "rgba(5,150,105,0.6)" : "rgba(255,255,255,0.08)"}`,
                  cursor: canDeal ? "pointer" : "not-allowed",
                  boxShadow: canDeal ? "0 4px 20px rgba(5,150,105,0.4)" : "none", transition: "all .2s",
                }}>
                  {phase !== "betting" ? "🃏 Dealing cards..." : !selection ? "Pick Andar or Bahar" : stake <= 0 ? "Enter your stake" : "🃏 DEAL CARDS"}
                </button>
              )}
              {isAuthenticated && stake > balance && <p style={{ color: "#f87171", fontSize: 12, textAlign: "center", marginTop: 8 }}>Insufficient balance — max: {formatCurrency(balance)}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
