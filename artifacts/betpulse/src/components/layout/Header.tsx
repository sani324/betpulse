import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Crown, Wallet, LogOut, ShieldAlert, Menu, X, Home, ListChecks, Gamepad2, LayoutDashboard, Plus, ArrowDownToLine, Trophy } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { InstallAppModal } from "../InstallAppModal";

export function Header() {
  const { user, isAuthenticated, isAdmin } = useAuth();
  const logoutMutation = useLogout();
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [homeView, setHomeView] = useState<"lobby" | "games">("lobby");

  // Jab bhi home page se hat ke kahin aur jao, view reset ho jaye
  useEffect(() => {
    if (location !== "/") setHomeView("lobby");
  }, [location]);

  const handleLogout = () => {
    const finishLogout = () => {
      queryClient.setQueryData(getGetMeQueryKey(), null);
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      setLocation("/login");
      setMobileOpen(false);
    };
    logoutMutation.mutate(undefined, {
      onSuccess: finishLogout,
      onError: finishLogout,
    });
  };

  const nav = (href: string) => {
    setLocation(href);
    setMobileOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full backdrop-blur-xl" style={{ background: "rgba(8,28,14,0.95)", borderBottom: "1px solid rgba(245,197,66,0.12)" }}>
        <div className="flex h-16 items-center justify-between px-4 md:px-8">

          {/* Left: Logo + Nav */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="relative w-9 h-9">
                <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #d4a017, #f5c542)", boxShadow: "0 0 16px rgba(245,197,66,0.35)" }}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "#081c0e", border: "1.5px solid rgba(245,197,66,0.6)" }}>
                    <Crown size={14} style={{ color: "#f5c542" }} />
                  </div>
                </div>
              </div>
              <div>
                <div className="text-lg font-black tracking-tight leading-none" style={{ background: "linear-gradient(90deg,#f5c542,#ffeba1)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  BetPulse
                </div>
                <div className="text-[9px] font-bold uppercase tracking-[0.2em] leading-none" style={{ color: "rgba(245,197,66,0.7)" }}>
                  Pro Casino
                </div>
              </div>
            </Link>

            <nav className="hidden items-center gap-2 md:flex">
              <NavLink
                variant="lobby"
                icon={<Home size={15} />}
                label="Lobby"
                isActive={location === "/"}
                onClick={() => {
                  setLocation("/");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              />
              <NavLink
                variant="sports"
                href="/sports"
                icon={<Trophy size={15} />}
                label="Sports"
              />
              <NavLink
                variant="games"
                icon={<Gamepad2 size={15} />}
                label="Games"
                onClick={() => {
                  if (location !== "/") setLocation("/");
                  setTimeout(() => {
                    const el = document.getElementById("games-section");
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                    else window.scrollTo({ top: 300, behavior: "smooth" });
                  }, 100);
                }}
              />
              {isAuthenticated && (
                <NavLink variant="mybets" href="/my-bets" icon={<ListChecks size={15} />} label="My Bets" />
              )}
              {isAdmin && (
                <NavLink variant="admin" href="/admin" icon={<ShieldAlert size={15} />} label="Admin" />
              )}
            </nav>
          </div>

          {/* Right: balance + actions */}
          <div className="flex items-center gap-2">
            <InstallAppModal />
            {isAuthenticated ? (
              <>
                {/* Balance chip */}
                <div className="hidden sm:flex items-center gap-2 rounded-full px-3 py-1.5" style={{ background: "rgba(20,61,35,0.8)", border: "1px solid rgba(245,197,66,0.2)" }}>
                  <Wallet size={13} style={{ color: "#f5c542" }} />
                  <span className="text-sm font-bold font-mono" style={{ color: "#f5c542" }}>
                    {formatCurrency(user?.balance || 0)}
                  </span>
                </div>
                <Link href="/wallet" className="hidden sm:block">
                  <button className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all hover:scale-105 active:scale-95" style={{ background: "linear-gradient(135deg,#d4a017,#f5c542)", color: "#081c0e", boxShadow: "0 0 12px rgba(245,197,66,0.3)" }}>
                    <Plus size={13} strokeWidth={3} /> Deposit
                  </button>
                </Link>
                <Link href="/dashboard" className="hidden sm:block">
                  <button className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-white/5" title="Dashboard">
                    <LayoutDashboard size={17} className="text-gray-400" />
                  </button>
                </Link>
                <button onClick={handleLogout} title="Logout" className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-white/5 hidden sm:flex">
                  <LogOut size={17} className="text-gray-400" />
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="hidden sm:block">
                  <button className="px-4 py-1.5 rounded-full text-sm font-semibold text-gray-300 border transition-colors hover:bg-white/5" style={{ borderColor: "rgba(255,255,255,0.15)" }}>Login</button>
                </Link>
                <Link href="/register" className="hidden sm:block">
                  <button className="px-4 py-1.5 rounded-full text-sm font-bold transition-all hover:scale-105" style={{ background: "linear-gradient(135deg,#d4a017,#f5c542)", color: "#081c0e" }}>Sign Up</button>
                </Link>
              </>
            )}

            {/* Hamburger — mobile only */}
            <button
              className="flex h-9 w-9 items-center justify-center rounded-xl sm:hidden"
              style={{ background: "rgba(20,61,35,0.8)", border: "1px solid rgba(245,197,66,0.2)" }}
              onClick={() => setMobileOpen(o => !o)}
              aria-label="Menu"
            >
              {mobileOpen ? <X size={18} style={{ color: "#f5c542" }} /> : <Menu size={18} style={{ color: "#f5c542" }} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30 sm:hidden" style={{ top: 64 }} onClick={() => setMobileOpen(false)}>
          <div
            className="absolute inset-x-0 top-0 shadow-2xl backdrop-blur-xl"
            style={{ background: "rgba(8,28,14,0.98)", borderBottom: "1px solid rgba(245,197,66,0.15)" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex flex-col divide-y px-4 pb-4 pt-2" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              {isAuthenticated && (
                <div className="py-3">
                  <div className="text-xs font-medium mb-1" style={{ color: "rgba(245,197,66,0.6)" }}>Your Balance</div>
                  <div className="flex items-center gap-2 font-mono font-bold text-lg" style={{ color: "#f5c542" }}>
                    <Wallet size={16} /> {formatCurrency(user?.balance || 0)}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => nav("/wallet")} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold" style={{ background: "linear-gradient(135deg,#d4a017,#f5c542)", color: "#081c0e" }}>
                      <Plus size={13} strokeWidth={3} /> Deposit
                    </button>
                    <button onClick={() => nav("/wallet")} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold" style={{ background: "rgba(20,61,35,0.8)", color: "#f5c542", border: "1px solid rgba(245,197,66,0.3)" }}>
                      <ArrowDownToLine size={13} /> Withdraw
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-1 py-3">
                <MobileNavItem onClick={() => { nav("/"); window.scrollTo({ top: 0, behavior: "smooth" }); }} icon={<Home size={16} />} label="Lobby" />
                <MobileNavItem onClick={() => nav("/sports")} icon={<Trophy size={16} />} label="⚽ Sports Center" />
                <MobileNavItem onClick={() => {
                  nav("/");
                  setTimeout(() => {
                    const el = document.getElementById("games-section");
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                    else window.scrollTo({ top: 300, behavior: "smooth" });
                  }, 100);
                }} icon={<Gamepad2 size={16} />} label="All Games" />
                {isAuthenticated && (
                  <>
                    <MobileNavItem onClick={() => nav("/my-bets")} icon={<ListChecks size={16} />} label="My Bets" />
                    <MobileNavItem onClick={() => nav("/wallet")} icon={<Wallet size={16} />} label="Wallet" />
                    <MobileNavItem onClick={() => nav("/dashboard")} icon={<LayoutDashboard size={16} />} label="Dashboard" />
                  </>
                )}
                {isAdmin && (
                  <MobileNavItem onClick={() => nav("/admin")} icon={<ShieldAlert size={16} />} label="Admin Panel" danger />
                )}
              </div>

              <div className="pt-3">
                {isAuthenticated ? (
                  <button onClick={handleLogout} className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold" style={{ border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }}>
                    <LogOut size={16} /> Log Out
                  </button>
                ) : (
                  <div className="flex gap-3">
                    <button onClick={() => nav("/login")} className="flex-1 rounded-xl py-3 text-sm font-semibold" style={{ border: "1px solid rgba(245,197,66,0.25)", color: "#f5c542" }}>Login</button>
                    <button onClick={() => nav("/register")} className="flex-1 rounded-xl py-3 text-sm font-bold" style={{ background: "linear-gradient(135deg,#d4a017,#f5c542)", color: "#081c0e" }}>Sign Up</button>
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

function NavLink({ href, icon, label, variant = "lobby", isActive: forceActive, onClick }: {
  href?: string;
  icon: React.ReactNode;
  label: string;
  variant?: "lobby" | "sports" | "games" | "mybets" | "admin";
  isActive?: boolean;
  onClick?: () => void;
}) {
  const [location] = useLocation();
  const computedActive = href
    ? (location === href || (href !== "/" && location.startsWith(href.split("?")[0])))
    : false;
  const isActive = forceActive !== undefined ? forceActive : computedActive;

  const variantStyles = {
    lobby: {
      active: "bg-gradient-to-r from-amber-400 to-yellow-400 text-black border-amber-300 shadow-md shadow-amber-500/30 font-black scale-105",
      inactive: "bg-amber-950/40 text-amber-300 border-amber-500/30 hover:bg-amber-500 hover:text-black font-bold",
    },
    sports: {
      active: "bg-gradient-to-r from-emerald-500 to-green-400 text-black border-green-300 shadow-md shadow-green-500/30 font-black scale-105",
      inactive: "bg-emerald-950/60 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500 hover:text-black font-bold",
    },
    games: {
      active: "bg-gradient-to-r from-purple-500 to-violet-400 text-white border-purple-300 shadow-md shadow-purple-500/30 font-black scale-105",
      inactive: "bg-purple-950/60 text-purple-300 border-purple-500/40 hover:bg-purple-600 hover:text-white font-bold",
    },
    mybets: {
      active: "bg-gradient-to-r from-sky-500 to-blue-400 text-white border-sky-300 shadow-md shadow-sky-500/30 font-black scale-105",
      inactive: "bg-sky-950/60 text-sky-300 border-sky-500/40 hover:bg-sky-600 hover:text-white font-bold",
    },
    admin: {
      active: "bg-gradient-to-r from-rose-600 to-red-500 text-white border-rose-300 shadow-md shadow-rose-500/40 font-black scale-105",
      inactive: "bg-rose-950/80 text-rose-300 border-rose-500/50 hover:bg-rose-600 hover:text-white font-bold",
    },
  };

  const styleConfig = variantStyles[variant] || variantStyles.lobby;
  const currentClass = isActive ? styleConfig.active : styleConfig.inactive;

  const button = (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs border transition-all duration-200 active:scale-95 ${currentClass}`}
    >
      <span className="shrink-0">{icon}</span>
      <span>{label}</span>
    </button>
  );

  return onClick ? button : <Link href={href!}>{button}</Link>;
}

function MobileNavItem({ onClick, icon, label, danger }: { onClick: () => void; icon: React.ReactNode; label: string; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-xs font-bold transition-all border ${
        danger
          ? "bg-rose-950/60 border-rose-500/40 text-rose-300 hover:bg-rose-600 hover:text-white"
          : "bg-emerald-950/40 border-amber-500/20 text-amber-200 hover:bg-amber-500 hover:text-black"
      }`}
    >
      <span className={danger ? "text-rose-400" : "text-amber-400"}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}
