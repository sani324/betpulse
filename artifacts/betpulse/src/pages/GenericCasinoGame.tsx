import { useState, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey, getGetBalanceQueryKey } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Wallet, RefreshCw } from "lucide-react";
import { GameConfig } from "@/lib/game-catalog";

const CHIP_AMOUNTS = [100, 500, 1000, 5000, 10000];
const API = import.meta.env.BASE_URL.replace(/\/$/, "");

function mkCtx() { return new ((window as any).AudioContext || (window as any).webkitAudioContext)(); }
function playWin() {
  try {
    const c = mkCtx();
    [523, 659, 784, 1047].forEach((freq, i) => {
      const o = c.createOscillator(); const g = c.createGain();
      o.connect(g); g.connect(c.destination); o.type = "triangle"; o.frequency.value = freq;
      const t = c.currentTime + i * 0.12;
      g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      o.start(t); o.stop(t + 0.4);
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
      const t = c.currentTime + i * 0.2;
      g.gain.setValueAtTime(0.1, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      o.start(t); o.stop(t + 0.25);
    });
    setTimeout(() => c.close(), 2000);
  } catch (_) {}
}

interface Props {
  config: GameConfig;
}

export default function GenericCasinoGame({ config }: Props) {
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

  useEffect(() => { setBalance(parseFloat(user?.balance || "0")); }, [user?.balance]);

  const pollRound = useCallback(async (rId: string, sel: string) => {
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      if (attempts > 180) { clearInterval(interval); setPhase("betting"); return; }
      try {
        const r = await fetch(`${API}/api/games/casino-round/${config.slug}/${rId}`, { credentials: "include" });
        const data = await r.json();
        if (data.status === "settled") {
          clearInterval(interval);
          setResult(data);
          setPhase("result");
          if (data.result === sel) playWin(); else playLose();
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetBalanceQueryKey() });
        }
      } catch (_) {}
    }, 2000);
  }, [queryClient, config.slug]);

  const placeBet = async () => {
    if (!isAuthenticated) { setLocation("/login"); return; }
    if (!selection) { toast({ title: "Pick a side first!", variant: "destructive" }); return; }
    if (balance < stake) { toast({ title: "Insufficient balance", variant: "destructive" }); return; }
    setIsPlacing(true);
    try {
      const r = await fetch(`${API}/api/games/${config.slug}`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stake, selection }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Failed to place bet");
      setBalance(data.newBalance);
      setPhase("waiting");
      pollRound(data.roundId, selection);
      toast({ title: `Bet placed!`, description: `Waiting for ${config.name} result...` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsPlacing(false);
    }
  };

  const reset = () => { setPhase("betting"); setResult(null); setSelection(null); };
  const won = result?.result === selection;
  const selectedOpt = config.options.find(o => o.key === selection);
  const resultOpt = config.options.find(o => o.key === result?.result);

  const cols = config.cols ?? (config.options.length <= 2 ? 2 : config.options.length <= 3 ? 3 : 2);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(180deg,#0a2414 0%,#081c0e 100%)" }}>
      <header className="flex items-center justify-between px-4 py-3" style={{ background: "rgba(13,43,26,0.8)", borderBottom: "1px solid rgba(245,197,66,0.12)" }}>
        <button onClick={() => setLocation("/")} className="flex items-center gap-2 text-sm font-medium" style={{ color: "rgba(255,255,255,0.6)" }}>
          <ArrowLeft size={18} /> Back
        </button>
        <span className="font-black text-xl" style={{ background: "linear-gradient(90deg,#f5c542,#ffeba1)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          {config.emoji} {config.name}
        </span>
        <div className="flex items-center gap-1.5 text-sm font-bold" style={{ color: "#f5c542" }}>
          <Wallet size={14} /> {formatCurrency(balance)}
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center p-4 gap-6 max-w-lg mx-auto w-full">

        {/* Game table area */}
        <div className="w-full rounded-3xl relative overflow-hidden flex flex-col items-center justify-center py-12 gap-4"
          style={{ background: "linear-gradient(135deg,#0d3320,#072010)", border: "2px solid rgba(245,197,66,0.2)", minHeight: 240 }}>
          <div className="pointer-events-none absolute inset-0 select-none opacity-[0.04] flex flex-wrap gap-8 p-4 text-6xl">
            {[...Array(12)].map((_,i) => <span key={i}>{config.bgEmoji}</span>)}
          </div>

          <div className="absolute inset-6 rounded-full" style={{ background: "rgba(5,100,40,0.2)", border: "1px dashed rgba(245,197,66,0.12)" }} />

          <div className="relative z-10 flex flex-col items-center gap-4 px-4 text-center">
            {phase === "betting" && (
              <>
                <div className="text-6xl">{config.emoji}</div>
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "rgba(245,197,66,0.6)" }}>Place your bet</p>
                <p className="text-2xl font-black text-white">{config.name}</p>
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>{config.desc}</p>
              </>
            )}

            {phase === "waiting" && (
              <>
                <div className="text-6xl animate-bounce">{config.emoji}</div>
                <div className="flex items-center gap-2 text-white font-bold">
                  <RefreshCw size={18} className="animate-spin" style={{ color: "#f5c542" }} />
                  Waiting for result...
                </div>
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Your bet on <span style={{ color: selectedOpt?.color ?? "#f5c542" }} className="font-bold">{selectedOpt?.label ?? selection}</span> is live
                </p>
              </>
            )}

            {phase === "result" && (
              <>
                <div className={`text-center px-6 py-3 rounded-2xl ${won ? "text-yellow-400" : "text-red-400"}`}
                  style={{ background: won ? "rgba(245,197,66,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${won ? "rgba(245,197,66,0.3)" : "rgba(239,68,68,0.3)"}` }}>
                  <div className="text-3xl mb-1">{won ? "🏆" : "😔"}</div>
                  <div className="text-xl font-black">{won ? "You Won!" : "You Lost"}</div>
                  <div className="text-sm mt-1 font-semibold">
                    Result: <span style={{ color: resultOpt?.color ?? "#f5c542" }}>{resultOpt?.label ?? result?.result}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Controls */}
        {phase !== "waiting" && (
          <div className="w-full space-y-4">
            {phase === "result" ? (
              <button onClick={reset} className="w-full py-4 rounded-2xl font-bold text-base transition-all hover:scale-105"
                style={{ background: "linear-gradient(135deg,#d4a017,#f5c542)", color: "#081c0e", boxShadow: "0 0 20px rgba(245,197,66,0.35)" }}>
                Play Again
              </button>
            ) : (
              <>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-3 text-center" style={{ color: "rgba(255,255,255,0.4)" }}>Choose your bet</p>
                  <div className={`grid gap-3`} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
                    {config.options.map(opt => (
                      <button key={opt.key} onClick={() => setSelection(opt.key)}
                        className="py-4 rounded-2xl flex flex-col items-center gap-1 transition-all hover:scale-105"
                        style={{
                          background: selection === opt.key ? `${opt.color}22` : "rgba(13,43,26,0.6)",
                          border: `2px solid ${selection === opt.key ? opt.color : "rgba(255,255,255,0.08)"}`,
                          boxShadow: selection === opt.key ? `0 0 20px ${opt.color}44` : "none",
                        }}>
                        <span className="text-2xl">{opt.icon}</span>
                        <span className="text-sm font-bold text-white">{opt.label}</span>
                        <span className="text-xs font-semibold" style={{ color: opt.color }}>{opt.sub}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap justify-center">
                  {CHIP_AMOUNTS.map(amt => (
                    <button key={amt} onClick={() => setStake(amt)}
                      className="px-4 py-2 rounded-xl text-sm font-bold transition-all hover:scale-105"
                      style={{
                        background: stake === amt ? "linear-gradient(135deg,#d4a017,#f5c542)" : "rgba(13,43,26,0.6)",
                        color: stake === amt ? "#081c0e" : "rgba(255,255,255,0.6)",
                        border: `1px solid ${stake === amt ? "transparent" : "rgba(255,255,255,0.1)"}`,
                      }}>
                      ₹{amt >= 1000 ? `${amt/1000}K` : amt}
                    </button>
                  ))}
                </div>

                <button onClick={placeBet} disabled={isPlacing || !selection}
                  className="w-full py-4 rounded-2xl font-bold text-base transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: "linear-gradient(135deg,#d4a017,#f5c542)", color: "#081c0e", boxShadow: "0 0 20px rgba(245,197,66,0.35)" }}>
                  {isPlacing ? "Placing..." : `Place Bet · ${formatCurrency(stake)}`}
                </button>
              </>
            )}
          </div>
        )}

        {phase === "waiting" && (
          <div className="text-center text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
            Bet of {formatCurrency(stake)} on{" "}
            <strong style={{ color: "#f5c542" }}>{selectedOpt?.label ?? selection}</strong> is pending.
            <br />The dealer will settle shortly.
          </div>
        )}
      </div>
    </div>
  );
}
