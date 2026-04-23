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
import AndarBaharGame from "@/pages/AndarBaharGame";
import RangGame from "@/pages/RangGame";
import CourtPieceGame from "@/pages/CourtPieceGame";

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

      <Route path="/play/dragon-tiger" component={DragonTigerGame} />
      <Route path="/play/coin-flip" component={CoinFlipGame} />
      <Route path="/play/dice-roll" component={DiceRollGame} />
      <Route path="/play/andar-bahar" component={AndarBaharGame} />
      <Route path="/play/rang" component={RangGame} />
      <Route path="/play/court-piece" component={CourtPieceGame} />

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
