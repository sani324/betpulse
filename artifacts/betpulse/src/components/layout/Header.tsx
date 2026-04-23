import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Wallet, LogOut, LayoutDashboard, ShieldAlert, Menu, X, Home, ListChecks } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export function Header() {
  const { user, isAuthenticated, isAdmin } = useAuth();
  const logoutMutation = useLogout();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        setLocation("/login");
        setMobileOpen(false);
      },
    });
  };

  const nav = (href: string) => {
    setLocation(href);
    setMobileOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 max-w-none items-center justify-between px-4 md:px-8">

          {/* Left: logo + desktop nav */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm">🎯</div>
              <span className="text-xl font-extrabold tracking-tight text-primary">BETPULSE</span>
            </Link>

            <nav className="hidden items-center gap-5 text-sm font-medium md:flex">
              <Link href="/" className="transition-colors hover:text-primary">🌐 Sports</Link>
              {isAuthenticated && (
                <>
                  <Link href="/my-bets" className="transition-colors hover:text-primary">📋 My Bets</Link>
                  {isAdmin && (
                    <Link href="/admin" className="flex items-center gap-1 text-red-400 transition-colors hover:text-red-300">
                      <ShieldAlert className="h-4 w-4" />
                      Admin
                    </Link>
                  )}
                </>
              )}
            </nav>
          </div>

          {/* Right: balance + actions */}
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <>
                <Link href="/wallet">
                  <Button variant="outline" size="sm" className="gap-1.5 font-mono text-xs hidden sm:flex" data-testid="header-wallet-balance">
                    <Wallet className="h-3.5 w-3.5 text-primary" />
                    {formatCurrency(user?.balance || 0)}
                  </Button>
                </Link>
                <Link href="/dashboard" className="hidden sm:block">
                  <Button variant="ghost" size="icon" title="Dashboard">
                    <LayoutDashboard className="h-5 w-5" />
                  </Button>
                </Link>
                <Button variant="ghost" size="icon" onClick={handleLogout} title="Logout" data-testid="header-logout-btn" className="hidden sm:flex">
                  <LogOut className="h-5 w-5" />
                </Button>
              </>
            ) : (
              <>
                <Link href="/login" className="hidden sm:block">
                  <Button variant="ghost" size="sm" data-testid="header-login-btn">Login</Button>
                </Link>
                <Link href="/register" className="hidden sm:block">
                  <Button size="sm" data-testid="header-register-btn">Sign Up</Button>
                </Link>
              </>
            )}

            {/* Hamburger button — mobile only */}
            <button
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/50 bg-card/50 sm:hidden"
              onClick={() => setMobileOpen(o => !o)}
              aria-label="Menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* ── MOBILE DRAWER ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 sm:hidden"
          style={{ top: 64 }}
          onClick={() => setMobileOpen(false)}
        >
          <div
            className="absolute inset-x-0 top-0 border-b border-border/40 bg-background/98 shadow-xl backdrop-blur"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex flex-col divide-y divide-border/30 px-4 pb-4 pt-2">
              {/* Balance (mobile) */}
              {isAuthenticated && (
                <div className="py-3">
                  <div className="text-xs text-muted-foreground mb-1">Your Balance</div>
                  <div className="flex items-center gap-2 font-mono font-bold text-primary text-lg">
                    <Wallet className="h-4 w-4" />
                    {formatCurrency(user?.balance || 0)}
                  </div>
                </div>
              )}

              {/* Nav links */}
              <div className="flex flex-col gap-1 py-3">
                <button onClick={() => nav("/")} className="flex items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium hover:bg-card/60">
                  <Home className="h-4 w-4 text-primary" /> Home & Sports
                </button>
                {isAuthenticated && (
                  <>
                    <button onClick={() => nav("/my-bets")} className="flex items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium hover:bg-card/60">
                      <ListChecks className="h-4 w-4 text-primary" /> My Bets
                    </button>
                    <button onClick={() => nav("/wallet")} className="flex items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium hover:bg-card/60">
                      <Wallet className="h-4 w-4 text-primary" /> Wallet & Deposits
                    </button>
                    <button onClick={() => nav("/dashboard")} className="flex items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium hover:bg-card/60">
                      <LayoutDashboard className="h-4 w-4 text-primary" /> Dashboard
                    </button>
                    {isAdmin && (
                      <button onClick={() => nav("/admin")} className="flex items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium text-red-400 hover:bg-red-500/10">
                        <ShieldAlert className="h-4 w-4" /> Admin Panel
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Auth actions */}
              <div className="pt-3">
                {isAuthenticated ? (
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-border/50 py-3 text-sm font-semibold text-muted-foreground hover:bg-card/60"
                  >
                    <LogOut className="h-4 w-4" /> Log Out
                  </button>
                ) : (
                  <div className="flex gap-3">
                    <button
                      onClick={() => nav("/login")}
                      className="flex-1 rounded-xl border border-border/50 py-3 text-sm font-semibold hover:bg-card/60"
                      data-testid="header-login-btn"
                    >
                      Login
                    </button>
                    <button
                      onClick={() => nav("/register")}
                      className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground"
                      data-testid="header-register-btn"
                    >
                      Sign Up
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
