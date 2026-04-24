import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, ProtectedRoute } from "@/lib/auth-context";
import { BetSlipProvider } from "@/lib/bet-slip-context";
import { AppLayout } from "@/components/layout/AppLayout";

import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import EventDetail from "@/pages/EventDetail";
import MyBets from "@/pages/MyBets";
import WalletPage from "@/pages/Wallet";
import Dashboard from "@/pages/Dashboard";
import Admin from "@/pages/Admin";
import DragonTigerGame from "@/pages/DragonTigerGame";
import CoinFlipGame from "@/pages/CoinFlipGame";
import DiceRollGame from "@/pages/DiceRollGame";
import RangGame from "@/pages/RangGame";
import CourtPieceGame from "@/pages/CourtPieceGame";
import TeenPattiGame from "@/pages/TeenPattiGame";
import Lucky7Game from "@/pages/Lucky7Game";
import JhandiMundaGame from "@/pages/JhandiMundaGame";
import JokerGame from "@/pages/JokerGame";
import TenCardsGame from "@/pages/TenCardsGame";
import MuflisGame from "@/pages/MuflisGame";
import Bingo777Game from "@/pages/Bingo777Game";
import CatalogGame from "@/pages/CatalogGame";
import CrashGame from "@/pages/CrashGame";
import AndarBaharGame from "@/pages/AndarBaharGame";
import RouletteGame from "@/pages/RouletteGame";
import FruitLineGame from "@/pages/FruitLineGame";
import SweetBonanzaGame from "@/pages/SweetBonanzaGame";
import BlackjackGame from "@/pages/BlackjackGame";
import CarRouletteGame from "@/pages/CarRouletteGame";
import GodOfFortuneGame from "@/pages/GodOfFortuneGame";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      
      <Route path="/">
        <AppLayout><Home /></AppLayout>
      </Route>

      <Route path="/events/:eventId">
        <AppLayout><EventDetail /></AppLayout>
      </Route>

      <Route path="/my-bets">
        <ProtectedRoute><AppLayout><MyBets /></AppLayout></ProtectedRoute>
      </Route>

      <Route path="/wallet">
        <ProtectedRoute><AppLayout><WalletPage /></AppLayout></ProtectedRoute>
      </Route>

      <Route path="/dashboard">
        <ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>
      </Route>

      <Route path="/admin">
        <ProtectedRoute requireAdmin><AppLayout><Admin /></AppLayout></ProtectedRoute>
      </Route>

      {/* Casino game pages */}
      <Route path="/play/teen-patti" component={TeenPattiGame} />
      <Route path="/play/dragon-tiger" component={DragonTigerGame} />
      <Route path="/play/coin-flip" component={CoinFlipGame} />
      <Route path="/play/dice-roll" component={DiceRollGame} />
      <Route path="/play/rang" component={RangGame} />
      <Route path="/play/court-piece" component={CourtPieceGame} />
      <Route path="/play/lucky-7" component={Lucky7Game} />
      <Route path="/play/jhandi-munda" component={JhandiMundaGame} />
      <Route path="/play/joker" component={JokerGame} />
      <Route path="/play/ten-cards" component={TenCardsGame} />
      <Route path="/play/muflis" component={MuflisGame} />
      <Route path="/play/bingo-777" component={Bingo777Game} />
      <Route path="/play/crash" component={CrashGame} />
      <Route path="/play/andar-bahar" component={AndarBaharGame} />
      <Route path="/play/roulette" component={RouletteGame} />
      <Route path="/play/fruit-line" component={FruitLineGame} />
      <Route path="/play/sweet-bonanza" component={SweetBonanzaGame} />
      <Route path="/play/blackjack" component={BlackjackGame} />
      <Route path="/play/car-roulette" component={CarRouletteGame} />
      <Route path="/play/god-of-fortune" component={GodOfFortuneGame} />
      <Route path="/play/:slug" component={CatalogGame} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <BetSlipProvider>
              <Router />
            </BetSlipProvider>
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
