import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useBetSlip } from "@/lib/bet-slip-context";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { 
  ArrowLeft, 
  Search, 
  Tv, 
  Heart, 
  RefreshCw, 
  SlidersHorizontal, 
  FileText, 
  ChevronDown,
  Trophy,
  PlayCircle
} from "lucide-react";

interface MatchMarket {
  id: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  homeLogo?: string;
  awayLogo?: string;
  homeScore?: number;
  awayScore?: number;
  dateTime: string;
  isLive: boolean;
  handicapHome: { tag: string; odds: number };
  handicapAway: { tag: string; odds: number };
  overUnderOver: { tag: string; odds: number };
  overUnderUnder: { tag: string; odds: number };
  moneylineHome: { tag: string; odds: number };
  moneylineAway: { tag: string; odds: number };
  moneylineDraw: { tag: string; odds: number };
  moreMarketsCount: number;
}

const SPORTS_CATEGORIES = [
  { id: "football",     label: "Football",     icon: "⚽", count: 219 },
  { id: "basketball",   label: "Basketball",   icon: "🏀", count: 44 },
  { id: "volleyball",   label: "Volleyball",   icon: "🏐", count: 21 },
  { id: "cricket",      label: "Cricket",      icon: "🏏", count: 4 },
  { id: "tennis",       label: "Tennis",       icon: "🎾", count: 33 },
  { id: "tabletennis",  label: "Table Tennis", icon: "🏓", count: 192 },
  { id: "badminton",    label: "Badminton",    icon: "🏸", count: 18 },
];

const SAMPLE_MATCHES: Record<string, MatchMarket[]> = {
  football: [
    {
      id: "fb-1",
      league: "Colombia Primera A",
      homeTeam: "Jaguares de Cordoba",
      awayTeam: "Boyaca Chico FC",
      homeScore: 0,
      awayScore: 0,
      dateTime: "22/08/2026 02:35",
      isLive: true,
      handicapHome: { tag: "-0.5", odds: 1.82 },
      handicapAway: { tag: "+0.5", odds: 2.06 },
      overUnderOver: { tag: "o 2/2.5", odds: 2.05 },
      overUnderUnder: { tag: "u 2/2.5", odds: 1.81 },
      moneylineHome: { tag: "Home", odds: 1.82 },
      moneylineAway: { tag: "Away", odds: 4.70 },
      moneylineDraw: { tag: "Draw", odds: 3.19 },
      moreMarketsCount: 225,
    },
    {
      id: "fb-2",
      league: "Colombia Primera A",
      homeTeam: "Alianza Valledupar FC",
      awayTeam: "CS Deportivo Pereira",
      homeScore: 0,
      awayScore: 0,
      dateTime: "22/08/2026 06:00",
      isLive: true,
      handicapHome: { tag: "-0.5/1", odds: 1.80 },
      handicapAway: { tag: "+0.5/1", odds: 2.06 },
      overUnderOver: { tag: "o 2/2.5", odds: 1.90 },
      overUnderUnder: { tag: "u 2/2.5", odds: 1.94 },
      moneylineHome: { tag: "Home", odds: 1.61 },
      moneylineAway: { tag: "Away", odds: 5.70 },
      moneylineDraw: { tag: "Draw", odds: 3.58 },
      moreMarketsCount: 204,
    },
    {
      id: "fb-3",
      league: "Argentina Liga Profesional",
      homeTeam: "River Plate",
      awayTeam: "Boca Juniors",
      homeScore: 1,
      awayScore: 0,
      dateTime: "22/08/2026 09:15",
      isLive: true,
      handicapHome: { tag: "-0.5", odds: 1.95 },
      handicapAway: { tag: "+0.5", odds: 1.85 },
      overUnderOver: { tag: "o 2.5", odds: 2.10 },
      overUnderUnder: { tag: "u 2.5", odds: 1.75 },
      moneylineHome: { tag: "Home", odds: 1.95 },
      moneylineAway: { tag: "Away", odds: 3.80 },
      moneylineDraw: { tag: "Draw", odds: 3.20 },
      moreMarketsCount: 310,
    },
  ],
  cricket: [
    {
      id: "ck-1",
      league: "IPL Premier League",
      homeTeam: "Mumbai Indians",
      awayTeam: "Chennai Super Kings",
      homeScore: 164,
      awayScore: 142,
      dateTime: "22/08/2026 19:30",
      isLive: true,
      handicapHome: { tag: "1.5 Wkts", odds: 1.85 },
      handicapAway: { tag: "-1.5 Wkts", odds: 1.95 },
      overUnderOver: { tag: "o 175.5", odds: 1.90 },
      overUnderUnder: { tag: "u 175.5", odds: 1.90 },
      moneylineHome: { tag: "Home", odds: 1.75 },
      moneylineAway: { tag: "Away", odds: 2.10 },
      moneylineDraw: { tag: "Tie", odds: 8.00 },
      moreMarketsCount: 145,
    },
    {
      id: "ck-2",
      league: "PSL T20 League",
      homeTeam: "Lahore Qalandars",
      awayTeam: "Karachi Kings",
      homeScore: 180,
      awayScore: 150,
      dateTime: "22/08/2026 21:00",
      isLive: true,
      handicapHome: { tag: "-2.5 Runs", odds: 1.90 },
      handicapAway: { tag: "+2.5 Runs", odds: 1.90 },
      overUnderOver: { tag: "o 185.5", odds: 1.85 },
      overUnderUnder: { tag: "u 185.5", odds: 1.95 },
      moneylineHome: { tag: "Home", odds: 1.65 },
      moneylineAway: { tag: "Away", odds: 2.30 },
      moneylineDraw: { tag: "Tie", odds: 8.00 },
      moreMarketsCount: 160,
    },
  ],
  basketball: [
    {
      id: "bb-1",
      league: "NBA Regular Season",
      homeTeam: "LA Lakers",
      awayTeam: "Golden State Warriors",
      homeScore: 98,
      awayScore: 95,
      dateTime: "22/08/2026 04:00",
      isLive: true,
      handicapHome: { tag: "-4.5", odds: 1.90 },
      handicapAway: { tag: "+4.5", odds: 1.90 },
      overUnderOver: { tag: "o 220.5", odds: 1.88 },
      overUnderUnder: { tag: "u 220.5", odds: 1.92 },
      moneylineHome: { tag: "Home", odds: 1.55 },
      moneylineAway: { tag: "Away", odds: 2.45 },
      moneylineDraw: { tag: "OT", odds: 12.0 },
      moreMarketsCount: 188,
    },
  ],
};

export default function SportsMenu() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { addItem, removeItem, items } = useBetSlip();

  const [activeFilter, setActiveFilter] = useState<string>("today");
  const [activeSport, setActiveSport] = useState<string>("football");
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});

  const matches = SAMPLE_MATCHES[activeSport] || SAMPLE_MATCHES.football;

  const isSelected = (matchId: string, selection: string) => {
    return items.some(item => item.eventId === matchId && item.selection === selection);
  };

  const handleOddsClick = (match: MatchMarket, selection: "home" | "draw" | "away", odds: number, label: string) => {
    const itemKey = `${match.id}-${selection}`;
    if (isSelected(match.id, selection)) {
      removeItem(itemKey);
    } else {
      addItem({
        eventId: match.id,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        selection,
        odds,
      });
    }
  };

  const toggleFavorite = (id: string) => {
    setFavorites(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="min-h-screen bg-[#f3f4f6] text-slate-800 font-sans pb-16">
      
      {/* ─── HEADER BAR (Z7VIP Screenshot Exact Match) ─── */}
      <div className="bg-[#144733] text-white px-4 py-3 flex items-center justify-between shadow-md">
        <button onClick={() => setLocation("/")} className="p-1 text-slate-200 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-1 font-bold text-lg text-emerald-300 tracking-tight">
          <span>z7.com</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-emerald-200/80 bg-emerald-900/60 px-2 py-1 rounded">
            👤 255266674
          </span>
          <div className="flex items-center gap-1 bg-[#1d5c43] px-2.5 py-1 rounded-full border border-emerald-400/30 text-xs font-bold text-yellow-300">
            <span>🇵🇰</span>
            <span>{parseFloat(user?.balance || "0").toFixed(2)}</span>
            <RefreshCw className="w-3 h-3 text-emerald-300 cursor-pointer hover:rotate-180 transition" />
          </div>
        </div>
      </div>

      {/* ─── TOP MARQUEE BANNER ─── */}
      <div className="bg-white px-4 py-2 text-xs font-medium text-slate-500 border-b border-slate-200 flex items-center gap-2 overflow-hidden shadow-xs">
        <span className="text-emerald-700">📢</span>
        <marquee scrollamount="4" className="w-full">
          You can follow other players&apos; betting decisions here
        </marquee>
      </div>

      {/* ─── SUB-FILTER PILLS ─── */}
      <div className="px-3 py-3 flex items-center gap-2 overflow-x-auto no-scrollbar bg-slate-100 border-b border-slate-200">
        <button
          onClick={() => setActiveFilter("today")}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${
            activeFilter === "today"
              ? "bg-[#144733] text-white shadow"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          Today 606
        </button>

        <button
          onClick={() => setActiveFilter("live")}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${
            activeFilter === "live"
              ? "bg-[#144733] text-white shadow"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          Live betting 88
        </button>

        <button
          onClick={() => setActiveFilter("early")}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${
            activeFilter === "early"
              ? "bg-[#144733] text-white shadow"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          Early Bet 2557
        </button>

        <button
          onClick={() => setActiveFilter("parlay")}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${
            activeFilter === "parlay"
              ? "bg-[#144733] text-white shadow"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          Parlay
        </button>
      </div>

      {/* ─── HORIZONTAL SPORTS CATEGORY SLIDER ─── */}
      <div className="px-3 py-3 bg-white border-b border-slate-200 overflow-x-auto flex items-center gap-4 no-scrollbar">
        {SPORTS_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveSport(cat.id)}
            className={`flex flex-col items-center gap-1 min-w-[58px] transition relative ${
              activeSport === cat.id ? "text-[#144733] font-black border-b-2 border-[#144733] pb-1" : "text-slate-500 font-semibold opacity-75 hover:opacity-100"
            }`}
          >
            <div className="relative text-2xl">
              <span>{cat.icon}</span>
              <span className="absolute -top-1 -right-2 text-[9px] font-bold bg-slate-100 text-slate-600 px-1 rounded-full border border-slate-200">
                {cat.count}
              </span>
            </div>
            <span className="text-[11px] leading-tight">{cat.label}</span>
          </button>
        ))}
      </div>

      {/* ─── SPORTS CONTENT & LEAGUE CARDS ─── */}
      <div className="max-w-3xl mx-auto px-3 py-4 space-y-4">
        
        {/* League Controls Bar */}
        <div className="flex items-center justify-between text-xs text-slate-600 font-semibold px-1">
          <div className="flex items-center gap-1.5 text-slate-900 font-extrabold text-sm capitalize">
            <span>{SPORTS_CATEGORIES.find(c => c.id === activeSport)?.icon}</span>
            <span>{activeSport} Matches</span>
          </div>

          <div className="flex items-center gap-3">
            <button className="flex items-center gap-1 hover:text-slate-900">
              <FileText className="w-3.5 h-3.5 text-slate-500" /> Records
            </button>
            <button className="flex items-center gap-1 hover:text-slate-900">
              <Search className="w-3.5 h-3.5 text-slate-500" /> Search
            </button>
            <button className="flex items-center gap-1 hover:text-slate-900">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" /> Set Up
            </button>
          </div>
        </div>

        {/* Matches List Grouped By League */}
        {matches.map((match) => (
          <div key={match.id} className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            
            {/* League Title Header */}
            <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 bg-emerald-700 text-white rounded-full flex items-center justify-center text-[10px]">🏆</span>
                <span>{match.league}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>

            {/* Match Details Row */}
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-2 font-mono">
                  <span>{match.dateTime}</span>
                  <button onClick={() => toggleFavorite(match.id)}>
                    <Heart className={`w-3.5 h-3.5 transition ${favorites[match.id] ? "fill-red-500 text-red-500" : "text-slate-300"}`} />
                  </button>
                </div>

                <div className="grid grid-cols-3 text-[10px] text-slate-400 font-semibold text-center w-full max-w-[280px]">
                  <span>Full court handicap</span>
                  <span>Full match over/under</span>
                  <span>Full match moneyline</span>
                </div>
              </div>

              {/* Match Teams & Odds 3-Column Grid (Screenshot Exact Match) */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                
                {/* Teams & Score (Cols 5) */}
                <div className="md:col-span-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900">{match.homeTeam}</span>
                    <span className="text-base font-extrabold text-slate-900 font-mono">{match.homeScore ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900">{match.awayTeam}</span>
                    <span className="text-base font-extrabold text-slate-900 font-mono">{match.awayScore ?? 0}</span>
                  </div>
                </div>

                {/* 3 Betting Market Columns (Cols 7) */}
                <div className="md:col-span-7 grid grid-cols-3 gap-2">
                  
                  {/* 1. Handicap Column */}
                  <div className="flex flex-col gap-1.5">
                    <button
                      onClick={() => handleOddsClick(match, "home", match.handicapHome.odds, match.handicapHome.tag)}
                      className={`p-2 rounded-xl border text-center transition flex flex-col items-center justify-center ${
                        isSelected(match.id, "home")
                          ? "bg-emerald-700 text-white border-emerald-700 font-bold"
                          : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <span className="text-[10px] text-slate-400">{match.handicapHome.tag}</span>
                      <span className="text-xs font-black">{match.handicapHome.odds.toFixed(2)}</span>
                    </button>

                    <button
                      onClick={() => handleOddsClick(match, "away", match.handicapAway.odds, match.handicapAway.tag)}
                      className={`p-2 rounded-xl border text-center transition flex flex-col items-center justify-center ${
                        isSelected(match.id, "away")
                          ? "bg-emerald-700 text-white border-emerald-700 font-bold"
                          : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <span className="text-[10px] text-slate-400">{match.handicapAway.tag}</span>
                      <span className="text-xs font-black">{match.handicapAway.odds.toFixed(2)}</span>
                    </button>
                  </div>

                  {/* 2. Over / Under Column */}
                  <div className="flex flex-col gap-1.5">
                    <button
                      onClick={() => handleOddsClick(match, "home", match.overUnderOver.odds, match.overUnderOver.tag)}
                      className="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-center flex flex-col items-center justify-center"
                    >
                      <span className="text-[10px] text-slate-400">{match.overUnderOver.tag}</span>
                      <span className="text-xs font-black">{match.overUnderOver.odds.toFixed(2)}</span>
                    </button>

                    <button
                      onClick={() => handleOddsClick(match, "away", match.overUnderUnder.odds, match.overUnderUnder.tag)}
                      className="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-center flex flex-col items-center justify-center"
                    >
                      <span className="text-[10px] text-slate-400">{match.overUnderUnder.tag}</span>
                      <span className="text-xs font-black">{match.overUnderUnder.odds.toFixed(2)}</span>
                    </button>
                  </div>

                  {/* 3. Moneyline Column */}
                  <div className="flex flex-col gap-1.5">
                    <button
                      onClick={() => handleOddsClick(match, "home", match.moneylineHome.odds, "Home")}
                      className="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-center flex flex-col items-center justify-center"
                    >
                      <span className="text-[10px] text-slate-400">Home</span>
                      <span className="text-xs font-black">{match.moneylineHome.odds.toFixed(2)}</span>
                    </button>

                    <button
                      onClick={() => handleOddsClick(match, "away", match.moneylineAway.odds, "Away")}
                      className="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-center flex flex-col items-center justify-center"
                    >
                      <span className="text-[10px] text-slate-400">Away</span>
                      <span className="text-xs font-black">{match.moneylineAway.odds.toFixed(2)}</span>
                    </button>

                    <button
                      onClick={() => handleOddsClick(match, "draw", match.moneylineDraw.odds, "Draw")}
                      className="p-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-center flex items-center justify-between px-2 text-[10px]"
                    >
                      <span className="text-slate-400">Draw</span>
                      <span className="font-extrabold">{match.moneylineDraw.odds.toFixed(2)}</span>
                    </button>
                  </div>

                </div>
              </div>

              {/* Card Footer Tools (Live Stream Icon + More Markets Link) */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Tv className="w-4 h-4 text-emerald-600 cursor-pointer" />
                </div>
                <button className="text-emerald-700 font-bold hover:underline flex items-center gap-1">
                  <span>More {match.moreMarketsCount}+ &gt;</span>
                </button>
              </div>

            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
