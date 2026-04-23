import React from "react";
import { Wallet, Home, Gamepad2, History, User, Plus, ArrowDownToLine, Crown, Flame, Dices, Coins, Trophy, Sparkles, Gem, ArrowRight, Bell } from "lucide-react";

export function Mobile() {
  return (
    <div style={{ width: '390px', minHeight: '844px' }} className="relative bg-[#081f12] text-white font-sans overflow-hidden flex flex-col">
      {/* Background Glows */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-[#1a4a2b] to-transparent opacity-50 pointer-events-none" />
      <div className="absolute -top-32 -right-32 w-64 h-64 bg-[#f5c542] blur-[120px] rounded-full opacity-20 pointer-events-none" />
      
      {/* Header */}
      <header className="relative z-10 px-4 py-4 flex items-center justify-between bg-gradient-to-b from-[#081f12] to-transparent">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#d4a017] to-[#f5c542] p-[2px] flex items-center justify-center shadow-[0_0_15px_rgba(245,197,66,0.3)]">
            <div className="w-full h-full bg-[#0d2b1a] rounded-full flex items-center justify-center border border-[#f5c542]/50">
              <Crown size={20} className="text-[#f5c542]" />
            </div>
          </div>
          <div>
            <h1 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#f5c542] to-[#ffeba1]">
              BetPulse
            </h1>
            <p className="text-[10px] text-[#f5c542]/70 uppercase tracking-widest font-semibold mt-[-2px]">Pro Casino</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button className="relative text-[#f5c542] p-1.5 bg-[#143d23] rounded-full border border-[#f5c542]/20">
            <Bell size={18} />
            <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border-2 border-[#143d23]" />
          </button>
        </div>
      </header>

      {/* Balance Panel */}
      <div className="relative z-10 px-4 mt-2">
        <div className="relative rounded-2xl overflow-hidden p-[1px] bg-gradient-to-b from-[#f5c542]/40 to-transparent">
          <div className="absolute inset-0 bg-[#0d2b1a]/90 backdrop-blur-md" />
          
          <div className="relative p-4 rounded-2xl border border-[#1a4a2b]/50">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#143d23] flex items-center justify-center border border-[#f5c542]/30">
                  <Wallet size={16} className="text-[#f5c542]" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-medium">Total Balance</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm font-bold text-[#f5c542]">₹</span>
                    <span className="text-2xl font-bold text-white tracking-tight">2,500.00</span>
                  </div>
                </div>
              </div>
              <button className="w-8 h-8 rounded-full bg-[#1a4a2b] flex items-center justify-center text-gray-300">
                <History size={16} />
              </button>
            </div>
            
            <div className="flex gap-3">
              <button className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#d4a017] to-[#f5c542] text-[#081f12] font-bold text-sm shadow-[0_4px_15px_rgba(245,197,66,0.3)] flex items-center justify-center gap-1.5 transition-transform active:scale-95">
                <Plus size={16} strokeWidth={3} /> Deposit
              </button>
              <button className="flex-1 py-2.5 rounded-xl bg-[#143d23] text-[#f5c542] border border-[#f5c542]/30 font-bold text-sm flex items-center justify-center gap-1.5 transition-transform active:scale-95">
                <ArrowDownToLine size={16} /> Withdraw
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="relative z-10 flex-1 overflow-y-auto pb-24 pt-4 px-4 space-y-6 scrollbar-none">
        
        {/* Promotional Banner */}
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#1a4a2b] to-[#081f12] border border-[#f5c542]/20 shadow-lg">
          <div className="absolute right-0 top-0 w-32 h-32 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#f5c542]/20 to-transparent pointer-events-none" />
          
          {/* Subtle Card Suits Pattern */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none flex flex-wrap gap-4 p-2">
            {[...Array(20)].map((_, i) => (
              <span key={i} className="text-4xl">♠ ♥ ♣ ♦</span>
            ))}
          </div>

          <div className="relative p-5">
            <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#f5c542]/20 border border-[#f5c542]/30 text-[#f5c542] text-[10px] font-bold uppercase tracking-wider mb-2">
              <Sparkles size={10} /> Welcome Bonus
            </div>
            <h2 className="text-xl font-bold text-white leading-tight mb-1">
              Welcome to<br/>BetPulse Casino
            </h2>
            <p className="text-xs text-gray-300 mb-4 max-w-[200px]">
              Play Andar Bahar, Dragon Tiger, Teen Patti & more
            </p>
            <button className="px-4 py-2 bg-[#f5c542] text-[#081f12] text-xs font-bold rounded-lg shadow-[0_0_10px_rgba(245,197,66,0.4)] flex items-center gap-1">
              Claim ₹500 Bonus <ArrowRight size={14} />
            </button>
          </div>
          
          <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-gradient-to-br from-[#d4a017] to-[#f5c542] opacity-20 blur-2xl rounded-full" />
        </div>

        {/* Categories */}
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none">
          <button className="flex flex-col items-center gap-1.5 min-w-[64px]">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#f5c542] to-[#d4a017] flex items-center justify-center shadow-[0_4px_10px_rgba(245,197,66,0.3)] border-2 border-white/20">
              <Flame size={24} className="text-[#081f12]" />
            </div>
            <span className="text-xs font-bold text-[#f5c542]">Hot</span>
          </button>
          <button className="flex flex-col items-center gap-1.5 min-w-[64px]">
            <div className="w-14 h-14 rounded-2xl bg-[#143d23] flex items-center justify-center border border-[#f5c542]/20">
              <Crown size={24} className="text-[#f5c542]" />
            </div>
            <span className="text-xs font-medium text-gray-400">Cards</span>
          </button>
          <button className="flex flex-col items-center gap-1.5 min-w-[64px]">
            <div className="w-14 h-14 rounded-2xl bg-[#143d23] flex items-center justify-center border border-[#f5c542]/20">
              <Dices size={24} className="text-[#f5c542]" />
            </div>
            <span className="text-xs font-medium text-gray-400">Table</span>
          </button>
          <button className="flex flex-col items-center gap-1.5 min-w-[64px]">
            <div className="w-14 h-14 rounded-2xl bg-[#143d23] flex items-center justify-center border border-[#f5c542]/20">
              <Coins size={24} className="text-[#f5c542]" />
            </div>
            <span className="text-xs font-medium text-gray-400">Casual</span>
          </button>
        </div>

        {/* Games Grid */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Trophy size={18} className="text-[#f5c542]" /> Top Games
            </h3>
            <button className="text-xs text-[#f5c542] font-medium">See All</button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Hero Game - Teen Patti */}
            <div className="col-span-2 group relative rounded-2xl overflow-hidden bg-[#143d23] border border-[#f5c542]/40 shadow-lg">
              <div className="absolute inset-0 bg-gradient-to-r from-[#0d2b1a] via-transparent to-[#0d2b1a] opacity-80" />
              <div className="absolute -right-10 -top-10 w-40 h-40 bg-[#f5c542] opacity-10 blur-2xl rounded-full" />
              
              <div className="relative p-4 flex items-center justify-between">
                <div>
                  <div className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 mb-2">
                    HOTTEST
                  </div>
                  <h4 className="text-xl font-bold text-white mb-1">Teen Patti</h4>
                  <p className="text-xs text-gray-400 mb-3">Live Players: 12,450</p>
                  <button className="px-5 py-2 bg-gradient-to-r from-[#d4a017] to-[#f5c542] text-[#081f12] text-xs font-bold rounded-lg shadow-[0_0_15px_rgba(245,197,66,0.4)]">
                    Play Now
                  </button>
                </div>
                
                {/* Decorative Cards Graphic */}
                <div className="relative w-24 h-24 flex items-center justify-center">
                  <div className="absolute w-12 h-16 bg-white rounded-md shadow-xl -rotate-12 transform origin-bottom-right border-2 border-gray-200 flex items-center justify-center">
                    <span className="text-red-600 text-xl font-bold">♥</span>
                  </div>
                  <div className="absolute w-12 h-16 bg-white rounded-md shadow-xl rotate-0 transform z-10 border-2 border-gray-200 flex items-center justify-center">
                    <span className="text-black text-xl font-bold">♠</span>
                  </div>
                  <div className="absolute w-12 h-16 bg-white rounded-md shadow-xl rotate-12 transform origin-bottom-left border-2 border-gray-200 flex items-center justify-center">
                    <span className="text-red-600 text-xl font-bold">♦</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Other Games */}
            <GameCard title="Dragon Tiger" icon={<Flame size={24} className="text-orange-400" />} players="8.2K" />
            <GameCard title="Andar Bahar" icon={<Gem size={24} className="text-blue-400" />} players="6.5K" />
            <GameCard title="Coin Flip" icon={<Coins size={24} className="text-yellow-400" />} players="3.1K" />
            <GameCard title="Dice Roll" icon={<Dices size={24} className="text-purple-400" />} players="2.8K" />
            <GameCard title="Rang" icon={<Crown size={24} className="text-green-400" />} players="1.9K" />
            <GameCard title="Court Piece" icon={<Trophy size={24} className="text-red-400" />} players="1.5K" />
          </div>
          
          <div className="mt-3">
             <div className="w-full relative rounded-2xl overflow-hidden bg-[#143d23] border border-white/5 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#1a4a2b] border border-white/10 flex items-center justify-center">
                    <span className="text-lg font-mono font-bold text-gray-300">123</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Code Piece</h4>
                    <p className="text-[10px] text-gray-400">Casual Strategy • 900+ Playing</p>
                  </div>
                </div>
                <button className="w-8 h-8 rounded-full bg-[#f5c542]/10 flex items-center justify-center text-[#f5c542]">
                  <ArrowRight size={16} />
                </button>
             </div>
          </div>
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="absolute bottom-0 w-full bg-[#081f12] border-t border-[#1a4a2b] px-6 py-3 pb-8 z-50 shadow-[0_-10px_30px_rgba(8,31,18,0.8)]">
        <div className="flex justify-between items-center relative">
          <NavItem icon={<Home size={22} />} label="Home" isActive />
          <NavItem icon={<Gamepad2 size={22} />} label="Games" />
          
          {/* Center Action */}
          <div className="relative -top-6">
            <div className="w-14 h-14 rounded-full bg-gradient-to-b from-[#f5c542] to-[#d4a017] p-[3px] shadow-[0_0_20px_rgba(245,197,66,0.4)]">
              <div className="w-full h-full bg-[#0d2b1a] rounded-full flex items-center justify-center border-2 border-[#f5c542]/80">
                <Crown size={24} className="text-[#f5c542]" />
              </div>
            </div>
            <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[10px] font-bold text-[#f5c542]">VIP</span>
          </div>
          
          <NavItem icon={<History size={22} />} label="My Bets" />
          <NavItem icon={<User size={22} />} label="Profile" />
        </div>
      </nav>
    </div>
  );
}

function GameCard({ title, icon, players }: { title: string, icon: React.ReactNode, players: string }) {
  return (
    <div className="relative rounded-2xl overflow-hidden bg-[#143d23] border border-white/5 p-3 flex flex-col justify-between aspect-square">
      <div className="absolute top-0 right-0 p-2">
        <div className="flex items-center gap-1 text-[9px] font-bold text-gray-400 bg-black/30 px-1.5 py-0.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> {players}
        </div>
      </div>
      
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#1a4a2b] to-[#0d2b1a] border border-white/10 flex items-center justify-center shadow-inner mt-2">
        {icon}
      </div>
      
      <div>
        <h4 className="text-sm font-bold text-white leading-tight">{title}</h4>
      </div>
    </div>
  );
}

function NavItem({ icon, label, isActive = false }: { icon: React.ReactNode, label: string, isActive?: boolean }) {
  return (
    <button className={`flex flex-col items-center gap-1 ${isActive ? 'text-[#f5c542]' : 'text-gray-500'}`}>
      <div className={`p-1.5 rounded-xl ${isActive ? 'bg-[#f5c542]/10' : ''}`}>
        {icon}
      </div>
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}
