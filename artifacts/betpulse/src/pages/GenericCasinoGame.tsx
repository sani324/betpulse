import { useState, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey, getGetBalanceQueryKey } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Wallet } from "lucide-react";
import { GameConfig } from "@/lib/game-catalog";

const CHIP_AMOUNTS = [100, 500, 1000, 5000, 10000];
const API = import.meta.env.BASE_URL.replace(/\/$/, "");

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

function Spinner() {
  return (
    <div className="relative w-20 h-20">
      <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-yellow-400 animate-spin" />
      <div className="absolute inset-2 rounded-full border-4 border-transparent border-b-yellow-400/50 animate-spin" style={{ animationDirection: "reverse", animationDuration: "0.8s" }} />
      <div className="absolute inset-0 flex items-center justify-center text-3xl">🎲</div>
    </div>
  );
}

function Confetti() {
  const items = ["🎊","⭐","💰","🏆","✨","🎉","💎","🌟"];
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {[...Array(16)].map((_, i) => (
        <div key={i} className="absolute text-2xl animate-bounce"
          style={{
            left: `${Math.random() * 90}%`,
            top: `${Math.random() * 60}%`,
            animationDelay: `${Math.random() * 1}s`,
            animationDuration: `${0.5 + Math.random() * 0.5}s`,
            opacity: 0.8,
          }}>
          {items[i % items.length]}
        </div>
      ))}
    </div>
  );
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
  const [waitDots, setWaitDots] = useState(".");

  useEffect(() => { setBalance(parseFloat(user?.balance || "0")); }, [user?.balance]);

  useEffect(() => {
    if (phase !== "waiting") return;
    const iv = setInterval(() => setWaitDots(d => d.length >= 3 ? "." : d + "."), 500);
    return () => clearInterval(iv);
  }, [phase]);

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
          // Dramatic pause so the player sees the "Auto-Decider" animation clearly
          setTimeout(() => {
            setPhase("result");
            if (data.result === sel) playWin(); else playLose();
            queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetBalanceQueryKey() });
          }, 2000);
        }
      } catch (_) {}
    }, 500);
  }, [queryClient, config.slug]);

  const placeBet = async () => {
    if (!isAuthenticated) { setLocation("/login"); return; }
    if (!selection) { toast({ title: "Pick a side first!", variant: "destructive" }); return; }
    if (balance < stake) { toast({ title: "Insufficient balance!", description: "Please deposit funds to continue.", variant: "destructive" }); return; }
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
      toast({ title: "✅ Bet Placed!", description: `PKR ${stake.toLocaleString()} on ${selectedOpt?.label}` });
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
  const cols = config.cols ?? (config.options.length <= 2 ? 2 : 3);

  const multiplier = selectedOpt?.sub ?? "";

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(180deg,#040e08 0%,#061209 100%)" }}>

      {/* ─── HEADER ─── */}
      <header className="flex items-center justify-between px-4 py-3 sticky top-0 z-50"
        style={{ background: "rgba(4,14,8,0.95)", borderBottom: "1px solid rgba(245,197,66,0.12)", backdropFilter: "blur(12px)" }}>
        <button onClick={() => setLocation("/")} className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all hover:scale-105"
          style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.65)" }}>
          <ArrowLeft size={16} /> Back
        </button>
        <div className="flex items-center gap-2">
          <span className="text-2xl">{config.emoji}</span>
          <span className="font-black text-lg" style={{ background: "linear-gradient(90deg,#f5c542,#ffeba1)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            {config.name}
          </span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold"
          style={{ background: "rgba(245,197,66,0.1)", border: "1px solid rgba(245,197,66,0.2)", color: "#f5c542" }}>
          <Wallet size={13} /> {formatCurrency(balance)}
        </div>
      </header>

      <div className="flex-1 flex flex-col max-w-lg mx-auto w-full px-4 pt-4 pb-6 gap-4">

        {/* ─── GAME TABLE ─── */}
        <div className="relative rounded-3xl overflow-hidden" style={{
          background: "linear-gradient(135deg,#0a2e16 0%,#061a0d 100%)",
          border: "2px solid rgba(245,197,66,0.18)",
          minHeight: 280,
          boxShadow: "0 8px 48px rgba(0,0,0,0.6), inset 0 1px 0 rgba(245,197,66,0.1)",
        }}>
          {/* Felt pattern */}
          <div className="absolute inset-0 opacity-[0.025]" style={{
            backgroundImage: `repeating-linear-gradient(45deg, #f5c542 0px, #f5c542 1px, transparent 1px, transparent 8px)`,
          }} />
          {/* Oval table */}
          <div className="absolute inset-8 rounded-full" style={{ border: "2px dashed rgba(245,197,66,0.1)" }} />

          {/* ── BETTING PHASE ── */}
          {phase === "betting" && (
            <div className="relative z-10 flex flex-col items-center justify-center h-full py-12 gap-4">
              <div className="text-7xl mb-2" style={{ filter: "drop-shadow(0 8px 16px rgba(0,0,0,0.8))" }}>
                {config.emoji}
              </div>
              <div className="text-center">
                <div className="text-[11px] font-black uppercase tracking-widest mb-1" style={{ color: "rgba(245,197,66,0.5)" }}>
                  {config.category}
                </div>
                <div className="text-2xl font-black text-white mb-1">{config.name}</div>
                <div className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.4)" }}>{config.desc}</div>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                style={{ background: "rgba(245,197,66,0.1)", border: "1px solid rgba(245,197,66,0.2)" }}>
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[11px] font-bold" style={{ color: "#f5c542" }}>Place your bet to start</span>
              </div>
            </div>
          )}

          {/* ── WAITING PHASE ── */}
          {phase === "waiting" && (
            <div className="relative z-10 flex flex-col items-center justify-center h-full py-12 gap-5">
              <Spinner />
              <div className="text-center">
                <div className="text-lg font-black text-white">Auto-Decider Running{waitDots}</div>
                <div className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>
                  Your bet on{" "}
                  <span className="font-black" style={{ color: selectedOpt?.color ?? "#f5c542" }}>
                    {selectedOpt?.label}
                  </span>{" "}
                  is live
                </div>
              </div>
              <div className="px-5 py-3 rounded-2xl text-center"
                style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>Your stake</div>
                <div className="text-xl font-black" style={{ color: "#f5c542" }}>{formatCurrency(stake)}</div>
                <div className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>Potential win: {formatCurrency(stake * parseFloat(multiplier))}</div>
              </div>
            </div>
          )}

          {/* ── RESULT PHASE ── */}
          {phase === "result" && (
            <div className="relative z-10 flex flex-col items-center justify-center h-full py-10 gap-4">
              {won && <Confetti />}
              <div className={`text-7xl ${won ? "animate-bounce" : ""}`} style={{ filter: `drop-shadow(0 8px 24px ${won ? "#f5c54288" : "#ef444488"})` }}>
                {won ? "🏆" : "😔"}
              </div>
              <div className={`text-center px-8 py-4 rounded-2xl`}
                style={{
                  background: won ? "rgba(245,197,66,0.12)" : "rgba(239,68,68,0.1)",
                  border: `1.5px solid ${won ? "rgba(245,197,66,0.35)" : "rgba(239,68,68,0.25)"}`,
                }}>
                <div className="text-2xl font-black mb-1" style={{ color: won ? "#f5c542" : "#f87171" }}>
                  {won ? "YOU WON!" : "You Lost"}
                </div>
                <div className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.55)" }}>
                  Result:{" "}
                  <span className="font-black" style={{ color: resultOpt?.color ?? "#f5c542" }}>
                    {resultOpt?.label ?? result?.result}
                  </span>
                </div>
                {won && (
                  <div className="text-lg font-black mt-2" style={{ color: "#4ade80" }}>
                    +{formatCurrency(stake * (parseFloat(multiplier) - 1))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ─── CONTROLS ─── */}
        {phase === "result" ? (
          <button onClick={reset} className="w-full py-4 rounded-2xl font-black text-base tracking-wider transition-all hover:scale-105 active:scale-95"
            style={{ background: "linear-gradient(135deg,#d4a017,#f5c542)", color: "#040e08", boxShadow: "0 0 24px rgba(245,197,66,0.4)" }}>
            🎮 Play Again
          </button>
        ) : phase === "betting" ? (
          <>
            {/* SELECTION BUTTONS */}
            <div>
              <p className="text-xs font-black uppercase tracking-widest mb-3 text-center" style={{ color: "rgba(255,255,255,0.3)" }}>Choose Your Side</p>
              <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
                {config.options.map(opt => {
                  const isSelected = selection === opt.key;
                  return (
                    <button key={opt.key} onClick={() => setSelection(opt.key)}
                      className="py-4 rounded-2xl flex flex-col items-center gap-1.5 transition-all duration-200 hover:scale-105 active:scale-95"
                      style={{
                        background: isSelected ? `${opt.color}20` : "rgba(255,255,255,0.04)",
                        border: `2px solid ${isSelected ? opt.color : "rgba(255,255,255,0.07)"}`,
                        boxShadow: isSelected ? `0 0 24px ${opt.color}55, inset 0 0 12px ${opt.color}15` : "none",
                      }}>
                      <span className="text-3xl">{opt.icon}</span>
                      <span className="text-sm font-black text-white">{opt.label}</span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${opt.color}22`, color: opt.color }}>{opt.sub}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* CHIP AMOUNTS */}
            <div>
              <p className="text-xs font-black uppercase tracking-widest mb-2.5 text-center" style={{ color: "rgba(255,255,255,0.3)" }}>Bet Amount</p>
              <div className="flex gap-2 justify-center flex-wrap">
                {CHIP_AMOUNTS.map(amt => {
                  const active = stake === amt;
                  return (
                    <button key={amt} onClick={() => setStake(amt)}
                      className="px-4 py-2 rounded-xl text-sm font-black transition-all hover:scale-105"
                      style={{
                        background: active ? "linear-gradient(135deg,#d4a017,#f5c542)" : "rgba(255,255,255,0.05)",
                        color: active ? "#040e08" : "rgba(255,255,255,0.55)",
                        border: `1px solid ${active ? "transparent" : "rgba(255,255,255,0.08)"}`,
                        boxShadow: active ? "0 0 12px rgba(245,197,66,0.4)" : "none",
                      }}>
                      PKR {amt >= 1000 ? `${amt / 1000}K` : amt}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* PLACE BET */}
            {selection ? (
              <button onClick={placeBet} disabled={isPlacing}
                className="w-full py-4 rounded-2xl font-black text-base tracking-wider transition-all hover:scale-105 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ background: "linear-gradient(135deg,#d4a017,#f5c542)", color: "#040e08", boxShadow: "0 0 24px rgba(245,197,66,0.4)" }}>
                {isPlacing ? "Placing Bet..." : `🎯 Place Bet · ${formatCurrency(stake)}`}
              </button>
            ) : (
              <div className="w-full py-4 rounded-2xl text-center font-bold text-sm" style={{ background: "rgba(255,255,255,0.03)", border: "2px dashed rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.25)" }}>
                ↑ Pick a side to continue
              </div>
            )}
          </>
        ) : (
          /* WAITING - show minimal info */
          <div className="py-4 rounded-2xl text-center text-sm font-medium" style={{ background: "rgba(245,197,66,0.06)", border: "1px solid rgba(245,197,66,0.12)", color: "rgba(255,255,255,0.5)" }}>
            ⚡ Auto-Decider is running your result...
          </div>
        )}

        {/* GAME INFO */}
        <div className="rounded-2xl p-4 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.3)" }}>Payout Guide</div>
          <div className="flex gap-2 justify-center flex-wrap">
            {config.options.map(opt => (
              <div key={opt.key} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
                style={{ background: `${opt.color}15`, border: `1px solid ${opt.color}30` }}>
                <span className="text-xs">{opt.icon}</span>
                <span className="text-xs font-bold text-white">{opt.label}</span>
                <span className="text-xs font-black" style={{ color: opt.color }}>{opt.sub}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
