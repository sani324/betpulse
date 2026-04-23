import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey, getGetBalanceQueryKey } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Crown, Wallet, RefreshCw } from "lucide-react";

const CHIP_AMOUNTS = [100, 500, 1000, 5000, 10000];
const API = import.meta.env.BASE_URL.replace(/\/$/, "");

type Phase = "betting" | "waiting" | "result";

function mkCtx() { return new ((window as any).AudioContext || (window as any).webkitAudioContext)(); }
function playWin() {
  try {
    const c = mkCtx();
    [523, 659, 784, 1047, 1319].forEach((freq, i) => {
      const o = c.createOscillator(); const g = c.createGain();
      o.connect(g); g.connect(c.destination); o.type = "triangle"; o.frequency.value = freq;
      const t = c.currentTime + i * 0.13;
      g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      o.start(t); o.stop(t + 0.45);
    });
    setTimeout(() => c.close(), 2500);
  } catch (_) {}
}
function playLose() {
  try {
    const c = mkCtx();
    [380, 330, 285, 240].forEach((freq, i) => {
      const o = c.createOscillator(); const g = c.createGain();
      o.connect(g); g.connect(c.destination); o.type = "sawtooth"; o.frequency.value = freq;
      const t = c.currentTime + i * 0.19;
      g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      o.start(t); o.stop(t + 0.28);
    });
    setTimeout(() => c.close(), 2000);
  } catch (_) {}
}

function PlayingCard({ rank, suit, hidden }: { rank?: string; suit?: string; hidden?: boolean }) {
  const isRed = suit === "♥" || suit === "♦";
  return (
    <div
      className="relative w-16 h-24 rounded-xl flex items-center justify-center shadow-2xl transition-all"
      style={{
        background: hidden ? "linear-gradient(135deg,#1a4a2b,#0d2b1a)" : "white",
        border: hidden ? "2px solid rgba(245,197,66,0.3)" : "2px solid #e5e7eb",
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
      }}
    >
      {hidden ? (
        <div className="text-3xl opacity-40 text-yellow-400">♠</div>
      ) : (
        <div className="flex flex-col items-center" style={{ color: isRed ? "#dc2626" : "#111827" }}>
          <span className="text-xl font-black leading-none">{rank}</span>
          <span className="text-xl leading-none">{suit}</span>
        </div>
      )}
    </div>
  );
}

function HandArea({ label, cards, isWinner }: { label: string; cards?: { rank: string; suit: string }[]; isWinner?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="text-xs font-bold uppercase tracking-wider" style={{ color: isWinner ? "#f5c542" : "rgba(255,255,255,0.5)" }}>
        {label} {isWinner && "👑"}
      </div>
      <div className="flex gap-2">
        {cards ? cards.map((c, i) => <PlayingCard key={i} rank={c.rank} suit={c.suit} />) : [0,1,2].map(i => <PlayingCard key={i} hidden />)}
      </div>
    </div>
  );
}

export default function TeenPattiGame() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [stake, setStake] = useState(500);
  const [selection, setSelection] = useState<"player" | "banker" | "pair" | null>(null);
  const [phase, setPhase] = useState<Phase>("betting");
  const [roundId, setRoundId] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [balance, setBalance] = useState<number>(parseFloat(user?.balance || "0"));
  const [isPlacing, setIsPlacing] = useState(false);

  useEffect(() => { setBalance(parseFloat(user?.balance || "0")); }, [user?.balance]);

  const pollRound = useCallback(async (rId: string, sel: string) => {
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      if (attempts > 120) { clearInterval(interval); setPhase("betting"); return; }
      try {
        const r = await fetch(`${API}/api/games/casino-round/teen-patti/${rId}`, { credentials: "include" });
        const data = await r.json();
        if (data.status === "settled") {
          clearInterval(interval);
          setResult(data);
          setPhase("result");
          const won = data.result === sel || (data.result === "pair" && sel === "pair");
          if (won) playWin(); else playLose();
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetBalanceQueryKey() });
        }
      } catch (_) {}
    }, 500);
  }, [queryClient]);

  const placeBet = async () => {
    if (!isAuthenticated) { setLocation("/login"); return; }
    if (!selection) { toast({ title: "Pick a side first!", variant: "destructive" }); return; }
    if (balance < stake) { toast({ title: "Insufficient balance", variant: "destructive" }); return; }
    setIsPlacing(true);
    try {
      const r = await fetch(`${API}/api/games/teen-patti`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stake, selection }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Failed to place bet");
      setBalance(data.newBalance);
      setRoundId(data.roundId);
      setPhase("waiting");
      toast({ title: `Bet placed on ${selection}!`, description: "Waiting for admin to settle round..." });
      pollRound(data.roundId, selection);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsPlacing(false);
    }
  };

  const reset = () => { setPhase("betting"); setResult(null); setRoundId(null); setSelection(null); };

  const wonBet = result && (result.result === selection || (selection === "pair" && result.result === "pair"));
  const playerCards = result?.details?.playerCards;
  const bankerCards = result?.details?.bankerCards;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(180deg,#0a2414 0%,#081c0e 100%)" }}>
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3" style={{ background: "rgba(13,43,26,0.8)", borderBottom: "1px solid rgba(245,197,66,0.12)" }}>
        <button onClick={() => setLocation("/")} className="flex items-center gap-2 text-sm font-medium" style={{ color: "rgba(255,255,255,0.6)" }}>
          <ArrowLeft size={18} /> Back
        </button>
        <div className="flex items-center gap-2">
          <Crown size={18} style={{ color: "#f5c542" }} />
          <span className="font-black text-lg" style={{ background: "linear-gradient(90deg,#f5c542,#ffeba1)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Teen Patti</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm font-bold" style={{ color: "#f5c542" }}>
          <Wallet size={14} /> {formatCurrency(balance)}
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center p-4 gap-6 max-w-lg mx-auto w-full">

        {/* Card Table */}
        <div className="w-full rounded-3xl overflow-hidden relative" style={{ background: "linear-gradient(135deg,#0d3320,#072010)", border: "2px solid rgba(245,197,66,0.2)", minHeight: 280 }}>
          <div className="pointer-events-none absolute inset-0 select-none opacity-[0.03] flex flex-wrap gap-6 p-4 text-6xl">
            {["♠","♥","♣","♦"].map((s,i) => <span key={i}>{s}</span>)}
          </div>

          {/* Table oval */}
          <div className="absolute inset-6 rounded-full" style={{ background: "rgba(5,100,40,0.3)", border: "1px dashed rgba(245,197,66,0.15)" }} />

          <div className="relative z-10 flex flex-col items-center justify-center py-10 gap-8">
            {phase === "betting" && (
              <div className="flex flex-col items-center gap-4">
                <div className="text-center">
                  <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "rgba(245,197,66,0.6)" }}>Place your bet</p>
                  <p className="text-2xl font-black text-white">Waiting for bets...</p>
                </div>
                <div className="flex gap-4">
                  <HandArea label="Player" />
                  <div className="flex flex-col items-center justify-center gap-1 px-2">
                    <div className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.3)" }}>vs</div>
                  </div>
                  <HandArea label="Banker" />
                </div>
              </div>
            )}

            {phase === "waiting" && (
              <div className="flex flex-col items-center gap-4">
                <div className="text-center">
                  <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "rgba(245,197,66,0.6)" }}>Round in progress</p>
                  <div className="flex items-center gap-2 text-white font-bold">
                    <RefreshCw size={16} className="animate-spin" style={{ color: "#f5c542" }} /> Waiting for dealer...
                  </div>
                </div>
                <div className="flex gap-4">
                  <HandArea label="Player" />
                  <div className="flex flex-col items-center justify-center px-2">
                    <div className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.3)" }}>vs</div>
                  </div>
                  <HandArea label="Banker" />
                </div>
              </div>
            )}

            {phase === "result" && (
              <div className="flex flex-col items-center gap-4 w-full px-4">
                <div className={`text-center px-6 py-3 rounded-2xl ${wonBet ? "text-yellow-400" : "text-red-400"}`} style={{ background: wonBet ? "rgba(245,197,66,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${wonBet ? "rgba(245,197,66,0.3)" : "rgba(239,68,68,0.3)"}` }}>
                  <div className="text-2xl font-black">{wonBet ? "🏆 You Won!" : "😔 You Lost"}</div>
                  <div className="text-sm mt-1 font-semibold capitalize">Result: {result?.result}</div>
                </div>
                <div className="flex gap-6">
                  <HandArea label="Player" cards={playerCards} isWinner={result?.result === "player"} />
                  <div className="flex flex-col items-center justify-center px-2">
                    <div className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.3)" }}>vs</div>
                  </div>
                  <HandArea label="Banker" cards={bankerCards} isWinner={result?.result === "banker"} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Betting Controls */}
        {phase !== "waiting" && (
          <div className="w-full space-y-4">
            {phase === "result" ? (
              <button onClick={reset} className="w-full py-4 rounded-2xl font-bold text-base transition-all hover:scale-105" style={{ background: "linear-gradient(135deg,#d4a017,#f5c542)", color: "#081c0e", boxShadow: "0 0 20px rgba(245,197,66,0.35)" }}>
                Play Again
              </button>
            ) : (
              <>
                {/* Selection */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-3 text-center" style={{ color: "rgba(255,255,255,0.4)" }}>Choose your side</p>
                  <div className="grid grid-cols-3 gap-3">
                    {([
                      { key: "player",  label: "Player",  sub: "1.95×", color: "#3b82f6" },
                      { key: "banker",  label: "Banker",  sub: "1.95×", color: "#ef4444" },
                      { key: "pair",    label: "Pair",    sub: "11×",   color: "#a855f7" },
                    ] as const).map(opt => (
                      <button
                        key={opt.key}
                        onClick={() => setSelection(opt.key)}
                        className="py-4 rounded-2xl flex flex-col items-center gap-1 transition-all hover:scale-105"
                        style={{
                          background: selection === opt.key ? `${opt.color}22` : "rgba(13,43,26,0.6)",
                          border: `2px solid ${selection === opt.key ? opt.color : "rgba(255,255,255,0.08)"}`,
                          boxShadow: selection === opt.key ? `0 0 20px ${opt.color}44` : "none",
                        }}
                      >
                        <span className="text-sm font-bold text-white">{opt.label}</span>
                        <span className="text-xs font-semibold" style={{ color: opt.color }}>{opt.sub}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Chip amounts */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-3 text-center" style={{ color: "rgba(255,255,255,0.4)" }}>Bet Amount</p>
                  <div className="flex gap-2 flex-wrap justify-center">
                    {CHIP_AMOUNTS.map(amt => (
                      <button
                        key={amt}
                        onClick={() => setStake(amt)}
                        className="px-4 py-2 rounded-xl text-sm font-bold transition-all hover:scale-105"
                        style={{
                          background: stake === amt ? "linear-gradient(135deg,#d4a017,#f5c542)" : "rgba(13,43,26,0.6)",
                          color: stake === amt ? "#081c0e" : "rgba(255,255,255,0.6)",
                          border: `1px solid ${stake === amt ? "transparent" : "rgba(255,255,255,0.1)"}`,
                        }}
                      >
                        ₹{amt >= 1000 ? `${amt / 1000}K` : amt}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={placeBet}
                  disabled={isPlacing || !selection}
                  className="w-full py-4 rounded-2xl font-bold text-base transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
                  style={{ background: "linear-gradient(135deg,#d4a017,#f5c542)", color: "#081c0e", boxShadow: "0 0 20px rgba(245,197,66,0.35)" }}
                >
                  {isPlacing ? "Placing..." : `Place Bet · ${formatCurrency(stake)}`}
                </button>
              </>
            )}
          </div>
        )}

        {phase === "waiting" && (
          <div className="text-center text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
            Your bet of {formatCurrency(stake)} on <strong style={{ color: "#f5c542" }}>{selection}</strong> is pending.<br />The admin will deal the cards shortly.
          </div>
        )}
      </div>
    </div>
  );
}
