import { useState } from "react";
import { ReactNode } from "react";
import { Header } from "./Header";
import { BetSlip } from "./BetSlip";
import { useAuth } from "@/lib/auth-context";
import { useBetSlip } from "@/lib/bet-slip-context";
import { ShoppingCart, X } from "lucide-react";

import { useLocation } from "wouter";

export function AppLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const { items } = useBetSlip();
  const [location] = useLocation();
  const [mobileBetSlipOpen, setMobileBetSlipOpen] = useState(false);

  const isAdminPage = location.startsWith("/admin");

  return (
    <div className="relative flex min-h-[100dvh] flex-col bg-background text-foreground selection:bg-primary/30">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto pb-24">
          <div className="container max-w-7xl p-4 md:p-8">
            {children}
          </div>
        </main>

        {/* Desktop bet slip sidebar */}
        {isAuthenticated && (
          <aside className="hidden w-[350px] border-l border-border/40 bg-card/50 lg:block">
            <BetSlip />
          </aside>
        )}
      </div>

      {/* Mobile: floating Bet Slip button */}
      {isAuthenticated && !isAdminPage && (
        <>
          <button
            onClick={() => setMobileBetSlipOpen(true)}
            className="fixed bottom-6 right-5 z-30 flex items-center gap-2 rounded-full px-5 py-3 text-sm font-bold text-white shadow-xl transition-all hover:scale-105 active:scale-95 lg:hidden"
            style={{
              background: "linear-gradient(135deg, #059669, #065f46)",
              boxShadow: "0 4px 20px rgba(5,150,105,0.5)",
            }}
          >
            <ShoppingCart className="h-4 w-4" />
            Bet Slip
            {items.length > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-extrabold text-primary">
                {items.length}
              </span>
            )}
          </button>

          {/* Mobile bet slip drawer */}
          {mobileBetSlipOpen && (
            <div
              className="fixed inset-0 z-40 lg:hidden"
              style={{ background: "rgba(0,0,0,0.6)" }}
              onClick={() => setMobileBetSlipOpen(false)}
            >
              <div
                className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-border/40 bg-background"
                style={{ maxHeight: "85vh", overflow: "hidden" }}
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
                  <span className="font-semibold">Bet Slip</span>
                  <button
                    onClick={() => setMobileBetSlipOpen(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-card/60"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div style={{ overflowY: "auto", maxHeight: "calc(85vh - 56px)" }}>
                  <BetSlip />
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
