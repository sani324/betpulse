import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey, getGetBalanceQueryKey } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Crown, Wallet } from "lucide-react";

const CHIP_AMOUNTS = [100, 500, 1000, 5000, 10000];
const API = import.meta.env.BASE_URL.replace(/\/$/, "");

type Phase = "betting" | "dealing" | "waiting" | "revealing" | "result";

function mkCtx() { return new ((window as any).AudioContext || (window as any).webkitAudioContext)(); }
function playCardFlip() {
  try {
    const c = mkCtx();
    const o = c.createOscillator(); const g = c.createGain();
    o.connect(g); g.connect(c.destination); o.type = "sine"; o.frequency.value = 880;
    g.gain.setValueAtTime(0.15, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.12);
    o.start(c.currentTime); o.stop(c.currentTime + 0.12);
    setTimeout(() => c.close(), 500);
  } catch (_) {}
}
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

function PlayingCard({ rank, suit, hidden, visible, flipped }: {
  rank?: string; suit?: string; hidden?: boolean; visible?: boolean; flipped?: boolean;
}) {
  const isRed = suit === "♥" || suit === "♦";
  return (
    <div
      className="relative w-16 h-24 rounded-xl flex items-center justify-center shadow-2xl"
      style={{
        background: hidden && !flipped ? "linear-gradient(135deg,#1a4a2b,#0d2b1a)" : "white",
        border: hidden && !flipped ? "2px solid rgba(245,197,66,0.3)" : "2px solid #e5e7eb",
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0) scale(1)" : "translateY(-30px) scale(0.7)",
        transition: "all 0.35s cubic-bezier(0.34,1.56,0.64,1)",
      }}
    >
      {hidden && !flipped ? (
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

  // Animation states
  const [dealtCount, setDealtCount] = useState(0);       // 0-6 cards dealt face-down
  const [revealedCount, setRevealedCount] = useState(0); // 0-6 cards flipped face-up
  const dealTimersRef = useRef<ReturnType<typeof setInterval>[]>([]);

  useEffect(() => { setBalance(parseFloat(user?.balance || "0")); }, [user?.balance]);

  // Card dealing animation when entering "dealing" phase
  useEffect(() => {
    if (phase !== "dealing") return;
    setDealtCount(0);
    let count = 0;
    const iv = setInterval(() => {
      count++;
      setDealtCount(count);
      playCardFlip();
      if (count >= 6) {
        clearInterval(iv);
        setPhase("waiting");
      }
    }, 280);
    dealTimersRef.current.push(iv);
    return () => clearInterval(iv);
  }, [phase]);

  // Card reveal animation when entering "revealing" phase
  useEffect(() => {
    if (phase !== "revealing") return;
    setRevealedCount(0);
    let count = 0;
    const iv = setInterval(() => {
      count++;
      setRevealedCount(count);
      playCardFlip();
      if (count >= 6) {
        clearInterval(iv);
        setTimeout(() => setPhase("result"), 400);
      }
    }, 350);
    return () => clearInterval(iv);
  }, [phase]);

  const pollRound = useCallback(async (rId: string, sel: string) => {
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      if (attempts > 240) { clearInterval(interval); setPhase("betting"); return; }
      try {
        const r = await fetch(`${API}/api/games/casino-round/teen-patti/${rId}`, { credentials: "include" });
        const data = await r.json();
        if (data.status === "settled") {
          clearInterval(interval);
          setResult(data);
          const won = data.result === sel || (data.result === "pair" && sel === "pair");
          if (won) playWin(); else playLose();
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetBalanceQueryKey() });
          setPhase("revealing");
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
      setDealtCount(0); setRevealedCount(0); setResult(null);
      setPhase("dealing");
      toast({ title: `Bet placed on ${selection}!`, description: "Cards are being dealt..." });
      pollRound(data.roundId, selection);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
      setPhase("betting");
    } finally {
      setIsPlacing(false);
    }
  };

  const reset = () => {
    setPhase("betting"); setResult(null); setRoundId(null);
    setSelection(null); setDealtCount(0); setRevealedCount(0);
  };

  const wonBet = result && (result.result === selection || (selection === "pair" && result.result === "pair"));
  const playerCards: {rank:string;suit:string}[] = result?.details?.playerCards ?? [];
  const bankerCards: {rank:string;suit:string}[] = result?.details?.bankerCards ?? [];

  // Deal order: P0, B0, P1, B1, P2, B2
  // dealtCount 1=P0 visible, 2=P0+B0, 3=P0+B0+P1 etc.
  const pDealt = [dealtCount >= 1, dealtCount >= 3, dealtCount >= 5];
  const bDealt = [dealtCount >= 2, dealtCount >= 4, dealtCount >= 6];

  // Reveal: same interleaved order
  const pRevealed = [revealedCount >= 1, revealedCount >= 3, revealedCount >= 5];
  const bRevealed = [revealedCount >= 2, revealedCount >= 4, revealedCount >= 6];

  const isPlaying = phase === "dealing" || phase === "waiting" || phase === "revealing";

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(180deg,#0a2414 0%,#081c0e 100%)" }}>
      {/* Banner Header */}
      <div style={{ position: "relative", width: "100%", height: 150, overflow: "hidden", flexShrink: 0 }}>
        <img
          src={`${import.meta.env.BASE_URL}teen-patti-banner.jpg`}
          alt="Teen Patti"
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 30%", display: "block" }}
        />
        {/* Dark gradient overlay */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.1) 50%, rgba(10,36,20,0.85) 100%)" }} />
        {/* Back button */}
        <button
          onClick={() => setLocation("/")}
          style={{ position: "absolute", top: 12, left: 12, display: "flex", alignItems: "center", gap: 6, background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 20, padding: "5px 14px", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", backdropFilter: "blur(4px)" }}
        >
          <ArrowLeft size={15} /> Back
        </button>
        {/* Balance badge */}
        <div style={{ position: "absolute", top: 12, right: 12, display: "flex", alignItems: "center", gap: 5, background: "rgba(0,0,0,0.55)", border: "1px solid rgba(245,197,66,0.4)", borderRadius: 20, padding: "5px 14px", color: "#f5c542", fontSize: 13, fontWeight: 700, backdropFilter: "blur(4px)" }}>
          <Wallet size={13} /> {formatCurrency(balance)}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center p-4 gap-6 max-w-lg mx-auto w-full">

        {/* Card Table */}
        <div className="w-full rounded-3xl overflow-hidden relative" style={{ background: "linear-gradient(135deg,#0d3320,#072010)", border: "2px solid rgba(245,197,66,0.2)", minHeight: 300 }}>
          <div className="pointer-events-none absolute inset-0 select-none opacity-[0.03] flex flex-wrap gap-6 p-4 text-6xl">
            {["♠","♥","♣","♦"].map((s,i) => <span key={i}>{s}</span>)}
          </div>
          <div className="absolute inset-6 rounded-full" style={{ background: "rgba(5,100,40,0.3)", border: "1px dashed rgba(245,197,66,0.15)" }} />

          <div className="relative z-10 flex flex-col items-center justify-center py-10 gap-8">

            {/* Betting phase */}
            {phase === "betting" && (
              <div className="flex flex-col items-center gap-6">
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "rgba(245,197,66,0.6)" }}>Place your bet to deal the cards</p>
                <div className="flex gap-8">
                  {/* Placeholder face-down decks */}
                  <div className="flex flex-col items-center gap-2">
                    <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>Player</div>
                    <div className="flex gap-1">
                      {[0,1,2].map(i => (
                        <div key={i} className="w-12 h-18 rounded-lg" style={{ width:44, height:64, background:"linear-gradient(135deg,#1a4a2b,#0d2b1a)", border:"1.5px solid rgba(245,197,66,0.2)", opacity: 0.5 }} />
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col items-center justify-center text-xs font-bold" style={{ color: "rgba(255,255,255,0.3)" }}>vs</div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>Banker</div>
                    <div className="flex gap-1">
                      {[0,1,2].map(i => (
                        <div key={i} className="w-12 h-18 rounded-lg" style={{ width:44, height:64, background:"linear-gradient(135deg,#1a4a2b,#0d2b1a)", border:"1.5px solid rgba(245,197,66,0.2)", opacity: 0.5 }} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Dealing / Waiting — animated card deal */}
            {(phase === "dealing" || phase === "waiting") && (
              <div className="flex flex-col items-center gap-6">
                <div className="text-center">
                  <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "rgba(245,197,66,0.6)" }}>
                    {phase === "dealing" ? "Dealing cards..." : "Cards dealt · Deciding winner..."}
                  </p>
                  <div className="flex justify-center gap-1.5 mt-1">
                    {[0,1,2].map(i => (
                      <div key={i} className="w-2 h-2 rounded-full animate-bounce" style={{ background:"#f5c542", animationDelay:`${i*0.15}s` }} />
                    ))}
                  </div>
                </div>
                <div className="flex gap-8">
                  <div className="flex flex-col items-center gap-2">
                    <div className="text-xs font-bold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Player</div>
                    <div className="flex gap-2">
                      {pDealt.map((vis, i) => (
                        <PlayingCard key={i} hidden visible={vis} />
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center text-xs font-bold" style={{ color: "rgba(255,255,255,0.3)" }}>vs</div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="text-xs font-bold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Banker</div>
                    <div className="flex gap-2">
                      {bDealt.map((vis, i) => (
                        <PlayingCard key={i} hidden visible={vis} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Revealing — cards flip one by one */}
            {phase === "revealing" && (
              <div className="flex flex-col items-center gap-6">
                <div className="text-center">
                  <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "rgba(245,197,66,0.6)" }}>Revealing hands...</p>
                </div>
                <div className="flex gap-8">
                  <div className="flex flex-col items-center gap-2">
                    <div className="text-xs font-bold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Player</div>
                    <div className="flex gap-2">
                      {[0,1,2].map(i => (
                        <PlayingCard
                          key={i}
                          rank={pRevealed[i] ? playerCards[i]?.rank : undefined}
                          suit={pRevealed[i] ? playerCards[i]?.suit : undefined}
                          hidden={!pRevealed[i]}
                          visible={true}
                          flipped={pRevealed[i]}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center text-xs font-bold" style={{ color: "rgba(255,255,255,0.3)" }}>vs</div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="text-xs font-bold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Banker</div>
                    <div className="flex gap-2">
                      {[0,1,2].map(i => (
                        <PlayingCard
                          key={i}
                          rank={bRevealed[i] ? bankerCards[i]?.rank : undefined}
                          suit={bRevealed[i] ? bankerCards[i]?.suit : undefined}
                          hidden={!bRevealed[i]}
                          visible={true}
                          flipped={bRevealed[i]}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Result */}
            {phase === "result" && (
              <div className="flex flex-col items-center gap-5 w-full px-4">
                <div className={`text-center px-6 py-3 rounded-2xl ${wonBet ? "text-yellow-400" : "text-red-400"}`} style={{ background: wonBet ? "rgba(245,197,66,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${wonBet ? "rgba(245,197,66,0.3)" : "rgba(239,68,68,0.3)"}` }}>
                  <div className="text-2xl font-black">{wonBet ? "🏆 You Won!" : "😔 You Lost"}</div>
                  <div className="text-sm mt-1 font-semibold capitalize">Winner: {result?.result}</div>
                </div>
                <div className="flex gap-8">
                  <div className="flex flex-col items-center gap-2">
                    <div className="text-xs font-bold uppercase tracking-wider" style={{ color: result?.result === "player" ? "#f5c542" : "rgba(255,255,255,0.4)" }}>
                      Player {result?.result === "player" && "👑"}
                    </div>
                    <div className="flex gap-2">
                      {playerCards.map((c, i) => <PlayingCard key={i} rank={c.rank} suit={c.suit} visible={true} />)}
                    </div>
                  </div>
                  <div className="flex items-center text-xs font-bold" style={{ color: "rgba(255,255,255,0.3)" }}>vs</div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="text-xs font-bold uppercase tracking-wider" style={{ color: result?.result === "banker" ? "#f5c542" : "rgba(255,255,255,0.4)" }}>
                      Banker {result?.result === "banker" && "👑"}
                    </div>
                    <div className="flex gap-2">
                      {bankerCards.map((c, i) => <PlayingCard key={i} rank={c.rank} suit={c.suit} visible={true} />)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Betting Controls */}
        {!isPlaying && (
          <div className="w-full space-y-4">
            {phase === "result" ? (
              <button onClick={reset} className="w-full py-4 rounded-2xl font-bold text-base transition-all hover:scale-105" style={{ background: "linear-gradient(135deg,#d4a017,#f5c542)", color: "#081c0e", boxShadow: "0 0 20px rgba(245,197,66,0.35)" }}>
                Deal Again
              </button>
            ) : (
              <>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-3 text-center" style={{ color: "rgba(255,255,255,0.4)" }}>Choose your side</p>
                  <div className="grid grid-cols-3 gap-3">
                    {([
                      { key: "player",  label: "Player",  sub: "1.95×", color: "#3b82f6" },
                      { key: "banker",  label: "Banker",  sub: "1.95×", color: "#ef4444" },
                      { key: "pair",    label: "Pair",    sub: "11×",   color: "#a855f7" },
                    ] as const).map(opt => (
                      <button key={opt.key} onClick={() => setSelection(opt.key)}
                        className="py-4 rounded-2xl flex flex-col items-center gap-1 transition-all hover:scale-105"
                        style={{ background: selection === opt.key ? `${opt.color}22` : "rgba(13,43,26,0.6)", border: `2px solid ${selection === opt.key ? opt.color : "rgba(255,255,255,0.08)"}`, boxShadow: selection === opt.key ? `0 0 20px ${opt.color}44` : "none" }}>
                        <span className="text-sm font-bold text-white">{opt.label}</span>
                        <span className="text-xs font-semibold" style={{ color: opt.color }}>{opt.sub}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-3 text-center" style={{ color: "rgba(255,255,255,0.4)" }}>Bet Amount</p>
                  <div className="flex gap-2 flex-wrap justify-center">
                    {CHIP_AMOUNTS.map(amt => (
                      <button key={amt} onClick={() => setStake(amt)}
                        className="px-4 py-2 rounded-xl text-sm font-bold transition-all hover:scale-105"
                        style={{ background: stake === amt ? "linear-gradient(135deg,#d4a017,#f5c542)" : "rgba(13,43,26,0.6)", color: stake === amt ? "#081c0e" : "rgba(255,255,255,0.6)", border: `1px solid ${stake === amt ? "transparent" : "rgba(255,255,255,0.1)"}` }}>
                        ₹{amt >= 1000 ? `${amt/1000}K` : amt}
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={placeBet} disabled={isPlacing || !selection}
                  className="w-full py-4 rounded-2xl font-bold text-base transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
                  style={{ background: "linear-gradient(135deg,#d4a017,#f5c542)", color: "#081c0e", boxShadow: "0 0 20px rgba(245,197,66,0.35)" }}>
                  {isPlacing ? "Shuffling deck..." : `Deal Cards · ${formatCurrency(stake)}`}
                </button>
              </>
            )}
          </div>
        )}

        {isPlaying && (
          <div className="text-center text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
            Your {formatCurrency(stake)} bet on <strong style={{ color: "#f5c542" }}>{selection}</strong>
            {phase === "dealing" && " · Dealing cards..."}
            {phase === "waiting" && " · Deciding the winner..."}
            {phase === "revealing" && " · Revealing the winner..."}
          </div>
        )}
      </div>
    </div>
  );
}
