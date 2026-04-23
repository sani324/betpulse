import React from "react";
import { Wallet, Search, Bell, Home, Gamepad2, History, User, Coins, Plus, ArrowDownToLine, Trophy, Flame, Crown, Dices, Gem, Sparkles, LogOut, ChevronDown, ArrowRight } from "lucide-react";

export function Desktop() {
  return (
    <div style={{ width: '1280px', minHeight: '800px' }} className="relative bg-[#0a2414] text-white font-sans overflow-hidden flex flex-col h-full min-h-screen">
      
      {/* Background Decor */}
      <div className="absolute top-0 inset-x-0 h-[500px] bg-gradient-to-b from-[#113a21] to-transparent opacity-80 pointer-events-none" />
      <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-[#f5c542] blur-[200px] rounded-full opacity-[0.08] pointer-events-none" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-[#1a4a2b] blur-[150px] rounded-full opacity-40 pointer-events-none" />

      {/* Top Navbar */}
      <header className="relative z-50 h-20 border-b border-white/10 bg-[#0d2b1a]/90 backdrop-blur-xl px-8 flex items-center justify-between sticky top-0">
        <div className="flex items-center gap-12">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#d4a017] to-[#f5c542] p-[2px] shadow-[0_0_20px_rgba(245,197,66,0.3)]">
              <div className="w-full h-full bg-[#0d2b1a] rounded-full flex items-center justify-center border-2 border-[#f5c542]/50">
                <Crown size={24} className="text-[#f5c542]" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#f5c542] to-[#ffeba1] tracking-tight">
                BetPulse
              </h1>
              <p className="text-[11px] text-[#f5c542]/80 uppercase tracking-[0.2em] font-bold mt-[-4px]">Premium Casino</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1">
            <NavLink icon={<Home size={18} />} label="Lobby" isActive />
            <NavLink icon={<Gamepad2 size={18} />} label="All Games" />
            <NavLink icon={<Trophy size={18} />} label="Tournaments" badge="NEW" />
            <NavLink icon={<History size={18} />} label="My Bets" />
          </nav>
        </div>

        <div className="flex items-center gap-6">
          {/* Search */}
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#f5c542] transition-colors" size={16} />
            <input 
              type="text" 
              placeholder="Find games..." 
              className="w-48 bg-[#143d23] border border-white/10 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-[#f5c542]/50 focus:ring-1 focus:ring-[#f5c542]/50 transition-all text-white placeholder-gray-500"
            />
          </div>

          <div className="w-px h-8 bg-white/10" />

          {/* Balance Area */}
          <div className="flex items-center gap-3 bg-[#143d23] rounded-full p-1.5 border border-[#f5c542]/20 shadow-[0_0_15px_rgba(0,0,0,0.5)]">
            <div className="flex items-center gap-2 px-3 py-1">
              <div className="w-6 h-6 rounded-full bg-[#f5c542]/20 flex items-center justify-center">
                <Wallet size={12} className="text-[#f5c542]" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-400 font-medium leading-none mb-1">Balance</span>
                <span className="text-sm font-bold text-white leading-none">₹2,500.00</span>
              </div>
            </div>
            <button className="flex items-center gap-1.5 bg-gradient-to-r from-[#d4a017] to-[#f5c542] text-[#081f12] px-4 py-2 rounded-full text-sm font-bold shadow-[0_0_10px_rgba(245,197,66,0.3)] hover:scale-105 transition-transform">
              <Plus size={16} strokeWidth={3} /> Deposit
            </button>
          </div>

          <div className="flex items-center gap-4 ml-2">
            <button className="relative text-gray-300 hover:text-white transition-colors">
              <Bell size={20} />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#0d2b1a]" />
            </button>
            <div className="flex items-center gap-2 cursor-pointer hover:bg-white/5 p-1.5 rounded-lg transition-colors border border-transparent hover:border-white/10">
              <div className="w-9 h-9 rounded-full bg-[#1a4a2b] border border-white/20 flex items-center justify-center overflow-hidden">
                <User size={18} className="text-gray-300" />
              </div>
              <ChevronDown size={16} className="text-gray-400" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Sidebar */}
        <aside className="w-64 border-r border-white/5 bg-[#0a2414]/50 overflow-y-auto hidden md:flex flex-col p-6 z-10">
          <div className="space-y-8">
            <div>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 px-3">Categories</h3>
              <div className="space-y-1">
                <SidebarItem icon={<Flame size={18} />} label="Popular Games" isActive />
                <SidebarItem icon={<Crown size={18} />} label="Card Games" />
                <SidebarItem icon={<Dices size={18} />} label="Table Games" />
                <SidebarItem icon={<Coins size={18} />} label="Casual & Mini" />
              </div>
            </div>
            
            <div>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 px-3">My Account</h3>
              <div className="space-y-1">
                <SidebarItem icon={<History size={18} />} label="Bet History" />
                <SidebarItem icon={<ArrowDownToLine size={18} />} label="Withdraw" />
                <SidebarItem icon={<User size={18} />} label="Profile Settings" />
              </div>
            </div>
          </div>
          
          <div className="mt-auto pt-8">
            <div className="p-4 rounded-xl border border-[#f5c542]/20 bg-gradient-to-b from-[#143d23] to-transparent relative overflow-hidden">
              <div className="absolute right-[-20px] top-[-20px] opacity-10">
                <Crown size={80} />
              </div>
              <h4 className="text-sm font-bold text-[#f5c542] mb-1">VIP Club</h4>
              <p className="text-xs text-gray-400 mb-3">Level up for 10% cashback</p>
              <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden mb-2">
                <div className="h-full bg-gradient-to-r from-[#d4a017] to-[#f5c542] w-[45%]" />
              </div>
              <div className="flex justify-between text-[10px] font-medium text-gray-500">
                <span>Silver</span>
                <span className="text-[#f5c542]">Gold</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-8 relative z-10 scrollbar-none">
          <div className="max-w-6xl mx-auto space-y-10">
            
            {/* Promo Banner Hero */}
            <div className="relative h-64 rounded-3xl overflow-hidden bg-[#143d23] border border-[#f5c542]/20 shadow-[0_20px_50px_rgba(0,0,0,0.5)] group">
              <div className="absolute inset-0 bg-gradient-to-r from-[#0d2b1a] via-[#0d2b1a]/90 to-transparent z-10" />
              
              {/* Decorative Background Image / Pattern */}
              <div className="absolute inset-0 right-0 z-0 bg-[#0a2414] opacity-80 mix-blend-overlay">
                <div className="absolute inset-0 opacity-[0.05] pointer-events-none flex flex-wrap gap-8 p-8 justify-end transform scale-150 -rotate-12">
                  {[...Array(30)].map((_, i) => (
                    <span key={i} className="text-8xl">♠ ♥ ♣ ♦</span>
                  ))}
                </div>
              </div>
              
              <div className="absolute right-10 bottom-0 top-0 w-1/2 z-0 hidden md:flex items-center justify-center">
                <div className="relative w-full h-full flex items-center justify-center">
                   <div className="absolute w-40 h-56 bg-white rounded-xl shadow-2xl -rotate-12 transform origin-bottom-right border-4 border-gray-200 flex items-center justify-center group-hover:-rotate-[15deg] transition-transform duration-500">
                     <div className="text-red-600 flex flex-col items-center">
                        <span className="text-6xl font-bold mb-2">A</span>
                        <span className="text-5xl">♥</span>
                     </div>
                   </div>
                   <div className="absolute w-40 h-56 bg-white rounded-xl shadow-2xl rotate-0 transform z-10 border-4 border-gray-200 flex items-center justify-center group-hover:-translate-y-4 transition-transform duration-500">
                     <div className="text-black flex flex-col items-center">
                        <span className="text-6xl font-bold mb-2">A</span>
                        <span className="text-5xl">♠</span>
                     </div>
                   </div>
                   <div className="absolute w-40 h-56 bg-white rounded-xl shadow-2xl rotate-12 transform origin-bottom-left border-4 border-gray-200 flex items-center justify-center group-hover:rotate-[15deg] transition-transform duration-500">
                     <div className="text-red-600 flex flex-col items-center">
                        <span className="text-6xl font-bold mb-2">A</span>
                        <span className="text-5xl">♦</span>
                     </div>
                   </div>
                </div>
              </div>

              <div className="relative z-20 h-full flex flex-col justify-center p-12 max-w-2xl">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f5c542]/10 border border-[#f5c542]/30 text-[#f5c542] text-xs font-bold uppercase tracking-wider mb-4 w-max">
                  <Sparkles size={14} /> New Player Bonus
                </div>
                <h2 className="text-5xl font-black text-white leading-tight mb-4 tracking-tight drop-shadow-md">
                  Welcome to <br/>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#f5c542] to-[#ffeba1]">BetPulse Casino</span>
                </h2>
                <p className="text-lg text-gray-300 mb-8 max-w-md">
                  Play Andar Bahar, Dragon Tiger, Teen Patti & more. Authentic Indian casino experience.
                </p>
                <div className="flex gap-4">
                  <button className="px-8 py-3.5 bg-gradient-to-r from-[#d4a017] to-[#f5c542] text-[#081f12] text-sm font-bold rounded-xl shadow-[0_0_20px_rgba(245,197,66,0.4)] hover:shadow-[0_0_30px_rgba(245,197,66,0.6)] hover:scale-105 transition-all flex items-center gap-2">
                    Claim ₹500 Bonus <ArrowRight size={18} />
                  </button>
                  <button className="px-8 py-3.5 bg-white/10 text-white border border-white/20 text-sm font-bold rounded-xl hover:bg-white/20 transition-all backdrop-blur-md">
                    View Games
                  </button>
                </div>
              </div>
            </div>

            {/* Games Section */}
            <section>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold flex items-center gap-3">
                  <Flame size={24} className="text-[#f5c542]" /> 
                  Popular Right Now
                </h3>
                <div className="flex gap-2">
                   <button className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 transition-colors">
                     <ChevronDown className="rotate-90" size={20} />
                   </button>
                   <button className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 transition-colors">
                     <ChevronDown className="-rotate-90" size={20} />
                   </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                
                {/* Hero Game Card - Teen Patti */}
                <div className="col-span-1 md:col-span-2 lg:col-span-2 row-span-2 group relative rounded-3xl overflow-hidden bg-[#143d23] border border-[#f5c542]/40 shadow-xl cursor-pointer min-h-[340px]">
                  <div className="absolute inset-0 bg-gradient-to-br from-[#0d2b1a] via-[#113a21] to-[#0a2414]" />
                  <div className="absolute -right-20 -top-20 w-80 h-80 bg-[#f5c542] opacity-[0.07] blur-3xl rounded-full group-hover:opacity-[0.15] transition-opacity duration-700" />
                  
                  {/* Abstract Card graphics for Teen Patti */}
                  <div className="absolute right-0 bottom-0 w-2/3 h-full overflow-hidden opacity-50 group-hover:opacity-80 transition-opacity duration-500">
                    <div className="absolute right-10 bottom-10 w-32 h-48 border border-white/20 bg-white/5 rounded-xl backdrop-blur-sm -rotate-6 transform origin-bottom-right" />
                    <div className="absolute right-20 bottom-16 w-32 h-48 border border-white/20 bg-white/5 rounded-xl backdrop-blur-sm rotate-6 transform origin-bottom-left" />
                    <div className="absolute right-32 bottom-8 w-32 h-48 border-2 border-[#f5c542]/50 bg-gradient-to-br from-[#1a4a2b] to-[#0d2b1a] rounded-xl shadow-2xl -rotate-12 transform origin-bottom-right flex items-center justify-center z-10">
                       <Crown size={48} className="text-[#f5c542] opacity-50" />
                    </div>
                  </div>

                  <div className="relative h-full p-8 flex flex-col justify-between z-20">
                    <div className="flex justify-between items-start">
                      <div className="inline-flex px-3 py-1 rounded-md text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30 backdrop-blur-md">
                        <Flame size={14} className="inline mr-1" /> HOTTEST GAME
                      </div>
                      <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-full backdrop-blur-md border border-white/10">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-xs font-bold text-white">12,450 Playing</span>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-5xl font-black text-white mb-2 drop-shadow-md tracking-tight">Teen Patti</h4>
                      <p className="text-gray-300 mb-8 max-w-sm text-lg">The classic 3-card Indian poker game. Real players, high stakes.</p>
                      <button className="px-10 py-4 bg-[#f5c542] text-[#081f12] text-base font-bold rounded-xl shadow-[0_0_20px_rgba(245,197,66,0.3)] hover:scale-105 transition-transform flex items-center gap-2 group-hover:bg-[#ffeba1]">
                        Play Now <Gamepad2 size={20} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Standard Game Cards */}
                <DesktopGameCard 
                  title="Dragon Tiger" 
                  desc="Fast-paced 2-card draw"
                  icon={<Flame size={32} className="text-orange-400" />} 
                  players="8.2K" 
                  tag="TRENDING"
                  tagColor="text-orange-400 bg-orange-400/10 border-orange-400/20"
                />
                <DesktopGameCard 
                  title="Andar Bahar" 
                  desc="Classic prediction game"
                  icon={<Gem size={32} className="text-blue-400" />} 
                  players="6.5K" 
                />
                <DesktopGameCard 
                  title="Coin Flip" 
                  desc="Heads or Tails? 2x payout"
                  icon={<Coins size={32} className="text-yellow-400" />} 
                  players="3.1K" 
                />
                <DesktopGameCard 
                  title="Dice Roll" 
                  desc="Multiplayer high-roller dice"
                  icon={<Dices size={32} className="text-purple-400" />} 
                  players="2.8K" 
                />
                <DesktopGameCard 
                  title="Rang" 
                  desc="Strategic trick-taking"
                  icon={<Crown size={32} className="text-green-400" />} 
                  players="1.9K" 
                />
                <DesktopGameCard 
                  title="Court Piece" 
                  desc="Partnership card battle"
                  icon={<Trophy size={32} className="text-red-400" />} 
                  players="1.5K" 
                />
                <DesktopGameCard 
                  title="Code Piece" 
                  desc="Number sequence strategy"
                  icon={<span className="text-2xl font-mono font-bold text-gray-300">123</span>} 
                  players="900+" 
                />
              </div>
            </section>
            
          </div>
        </main>
      </div>
    </div>
  );
}

function NavLink({ icon, label, isActive = false, badge }: { icon: React.ReactNode, label: string, isActive?: boolean, badge?: string }) {
  return (
    <button className={`px-4 py-2 rounded-xl flex items-center gap-2 font-bold text-sm transition-all ${
      isActive 
        ? 'bg-[#1a4a2b] text-white border border-[#f5c542]/30 shadow-inner' 
        : 'text-gray-400 hover:text-white hover:bg-white/5'
    }`}>
      <span className={isActive ? 'text-[#f5c542]' : ''}>{icon}</span>
      {label}
      {badge && (
        <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-black bg-red-500 text-white tracking-wider">
          {badge}
        </span>
      )}
    </button>
  );
}

function SidebarItem({ icon, label, isActive = false }: { icon: React.ReactNode, label: string, isActive?: boolean }) {
  return (
    <button className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
      isActive
        ? 'bg-gradient-to-r from-[#1a4a2b] to-transparent text-white font-bold border-l-2 border-[#f5c542]'
        : 'text-gray-400 hover:bg-white/5 hover:text-white font-medium border-l-2 border-transparent'
    }`}>
      <span className={`${isActive ? 'text-[#f5c542]' : 'text-gray-500'}`}>{icon}</span>
      {label}
    </button>
  );
}

function DesktopGameCard({ title, desc, icon, players, tag, tagColor }: { 
  title: string, desc: string, icon: React.ReactNode, players: string, tag?: string, tagColor?: string 
}) {
  return (
    <div className="group relative rounded-2xl overflow-hidden bg-[#113a21] border border-white/5 hover:border-[#f5c542]/30 transition-all duration-300 hover:shadow-[0_10px_30px_rgba(0,0,0,0.5)] hover:-translate-y-1 cursor-pointer flex flex-col min-h-[160px]">
      
      {/* Hover glow */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#1a4a2b]/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-0" />
      
      <div className="relative z-10 p-5 flex flex-col h-full">
        <div className="flex justify-between items-start mb-4">
          <div className="w-14 h-14 rounded-xl bg-[#0a2414] border border-white/10 flex items-center justify-center shadow-inner group-hover:scale-110 group-hover:border-[#f5c542]/30 transition-all duration-300">
            {icon}
          </div>
          
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-300 bg-black/40 px-2 py-1 rounded-full border border-white/5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> {players}
            </div>
            {tag && (
              <div className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${tagColor}`}>
                {tag}
              </div>
            )}
          </div>
        </div>
        
        <div className="mt-auto">
          <h4 className="text-lg font-bold text-white mb-1 group-hover:text-[#f5c542] transition-colors">{title}</h4>
          <p className="text-xs text-gray-400">{desc}</p>
        </div>
      </div>
      
      {/* Play Overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 z-20">
        <button className="w-12 h-12 rounded-full bg-[#f5c542] text-[#081f12] flex items-center justify-center pl-1 shadow-[0_0_20px_rgba(245,197,66,0.5)] transform scale-50 group-hover:scale-100 transition-all duration-300 delay-75">
          <Gamepad2 size={24} className="ml-[-4px]" />
        </button>
      </div>
    </div>
  );
}
