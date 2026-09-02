import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  useGetAdminDashboard, 
  useGetAdminBets, 
  useCreateEvent, 
  useSettleEvent,
  useUpdateOdds,
  useGetEvents,
  useLogin,
  getGetMeQueryKey,
  getGetAdminDashboardQueryKey,
  getGetAdminBetsQueryKey,
  getGetEventsQueryKey
} from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth-context";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency, formatPercentage, formatDateTime } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ShieldAlert, TrendingUp, Users, Coins, Activity, Pencil, Trash2, UserCog, ArrowUpFromLine, ArrowDownToLine, CheckCircle, XCircle, Clock, AlertCircle, Flag, ShieldX, ShieldCheck, KeyRound, CalendarDays, PlusCircle, BarChart3, Receipt, CreditCard, Gift, Gamepad2, FileBarChart, Trophy } from "lucide-react";
import AdminReports from "@/components/AdminReports";
import { Skeleton } from "@/components/ui/skeleton";

const createEventSchema = z.object({
  sport: z.string().min(1, "Required"),
  league: z.string().optional(),
  homeTeam: z.string().min(1, "Required"),
  awayTeam: z.string().min(1, "Required"),
  startTime: z.string().min(1, "Required"),
  oddsHome: z.coerce.number().min(1.01),
  oddsDraw: z.coerce.number().min(1.01),
  oddsAway: z.coerce.number().min(1.01),
});

const editOddsSchema = z.object({
  oddsHome: z.coerce.number().min(1.01, "Min 1.01"),
  oddsDraw: z.coerce.number().min(1.01, "Min 1.01"),
  oddsAway: z.coerce.number().min(1.01, "Min 1.01"),
});

const adjustBalanceSchema = z.object({
  amount: z.coerce.number().refine(v => v !== 0, "Amount cannot be zero"),
  note: z.string().optional(),
});

function AdminContent() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, isAdmin, isLoading: isLoadingAuth } = useAuth();
  const loginMutation = useLogin();

  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [settleDialogOpen, setSettleDialogOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);

  const [editOddsOpen, setEditOddsOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);

  const [adjustUserId, setAdjustUserId] = useState<number | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);

  const [resetPasswordUserId, setResetPasswordUserId] = useState<number | null>(null);
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);

  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [withdrawalsLoading, setWithdrawalsLoading] = useState(false);
  const [denyNote, setDenyNote] = useState("");

  const [deposits, setDeposits] = useState<any[]>([]);
  const [depositsLoading, setDepositsLoading] = useState(false);
  const [denyDepositNote, setDenyDepositNote] = useState("");

  const [exposure, setExposure] = useState<any[]>([]);
  const [exposureLoading, setExposureLoading] = useState(false);

  const [gameOverrides, setGameOverrides] = useState<Record<string, string>>({});
  const [gameOverridesLoading, setGameOverridesLoading] = useState(false);

  type CasinoSide = { selection: string; betCount: number; totalStaked: number; users: { username: string; stake: number; result: string; when: string }[] };
  type CasinoGameStat = { game: string; key: string; sides: CasinoSide[]; totalBets: number; totalStaked: number; override: string | null };
  const [casinoStats, setCasinoStats] = useState<CasinoGameStat[]>([]);
  const [casinoStatsLoading, setCasinoStatsLoading] = useState(false);
  const [casinoStatsWindow, setCasinoStatsWindow] = useState(60);

  type LiveRoundSide = { selection: string; betCount: number; totalStaked: number; users: { username: string; stake: number }[] };
  type LiveRound = { id: string; game: string; openedAt: string; totalBets: number; totalStaked: number; sides: LiveRoundSide[] };
  const [liveRounds, setLiveRounds] = useState<LiveRound[]>([]);
  const [settling, setSettling] = useState<string | null>(null);
  const [autoSettling, setAutoSettling] = useState<string | null>(null);
  const [lastAutoResult, setLastAutoResult] = useState<Record<string, { result: string; reason: string }>>({});
  const [autoMode, setAutoMode] = useState(false);
  const [autoInterval, setAutoInterval] = useState(3);
  const [autoModeLoading, setAutoModeLoading] = useState(false);

  type PaymentSetting = { method: string; label: string; accountName: string; accountNumber: string; instructions: string; isActive: boolean };
  const [paymentSettings, setPaymentSettings] = useState<PaymentSetting[]>([]);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentEdits, setPaymentEdits] = useState<Record<string, Partial<PaymentSetting>>>({});
  const [editingPaymentMethod, setEditingPaymentMethod] = useState<string | null>(null);
  const [newMethod, setNewMethod] = useState({ label: "", accountName: "", accountNumber: "", instructions: "" });
  const [addingMethod, setAddingMethod] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Signup & Referral bonus state
  const [signupBonus, setSignupBonus] = useState<number>(50000);
  const [signupBonusInput, setSignupBonusInput] = useState<string>("50000");
  const [referralBonus, setReferralBonus] = useState<number>(500);
  const [referralBonusInput, setReferralBonusInput] = useState<string>("500");
  const [signupBonusSaving, setSignupBonusSaving] = useState(false);
  const [signupBonusLoaded, setSignupBonusLoaded] = useState(false);

  const loadSignupBonus = async () => {
    try {
      const res = await fetch("/api/admin/bonuses", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setSignupBonus(data.signupBonus ?? 50000);
        setSignupBonusInput(String(data.signupBonus ?? 50000));
        setReferralBonus(data.referralBonus ?? 500);
        setReferralBonusInput(String(data.referralBonus ?? 500));
      }
    } catch {}
    setSignupBonusLoaded(true);
  };

  const saveBonuses = async () => {
    const sVal = Math.max(0, Math.round(parseFloat(signupBonusInput) || 0));
    const rVal = Math.max(0, Math.round(parseFloat(referralBonusInput) || 0));
    setSignupBonusSaving(true);
    try {
      const res = await fetch("/api/admin/bonuses", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ signupBonus: sVal, referralBonus: rVal }),
      });
      if (res.ok) {
        setSignupBonus(sVal);
        setSignupBonusInput(String(sVal));
        setReferralBonus(rVal);
        setReferralBonusInput(String(rVal));
        toast({ title: "Bonuses updated successfully!", description: `Signup Bonus: PKR ${sVal.toLocaleString()} | Referral Bonus: PKR ${rVal.toLocaleString()}` });
      } else {
        toast({ title: "Failed to save", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    }
    setSignupBonusSaving(false);
  };

  const { data: dashboard, isLoading: isLoadingDashboard } = useGetAdminDashboard({
    query: { queryKey: getGetAdminDashboardQueryKey() }
  });

  const { data: bets, isLoading: isLoadingBets } = useGetAdminBets(
    { limit: 50 },
    { query: { queryKey: getGetAdminBetsQueryKey({ limit: 50 }) } }
  );

  const { data: events, isLoading: isLoadingEvents } = useGetEvents(
    {},
    { query: { queryKey: getGetEventsQueryKey({}) } }
  );

  const createEventMutation = useCreateEvent();
  const settleEventMutation = useSettleEvent();
  const updateOddsMutation = useUpdateOdds();

  const form = useForm<z.infer<typeof createEventSchema>>({
    resolver: zodResolver(createEventSchema),
    defaultValues: {
      sport: "Football",
      league: "",
      homeTeam: "",
      awayTeam: "",
      startTime: "",
      oddsHome: 2.0,
      oddsDraw: 3.0,
      oddsAway: 4.0,
    },
  });

  const oddsForm = useForm<z.infer<typeof editOddsSchema>>({
    resolver: zodResolver(editOddsSchema),
    defaultValues: { oddsHome: 2.0, oddsDraw: 3.0, oddsAway: 4.0 },
  });

  const adjustForm = useForm<z.infer<typeof adjustBalanceSchema>>({
    resolver: zodResolver(adjustBalanceSchema),
    defaultValues: { amount: 1000, note: "" },
  });

  async function loadUsers() {
    setUsersLoading(true);
    try {
      const resp = await fetch("/api/admin/users", { credentials: "include" });
      const data = await resp.json();
      setUsers(data);
    } catch (e) {
      toast({ title: "Failed to load users", variant: "destructive" });
    } finally {
      setUsersLoading(false);
    }
  }

  async function loadWithdrawals() {
    setWithdrawalsLoading(true);
    try {
      const resp = await fetch("/api/admin/withdrawals", { credentials: "include" });
      const data = await resp.json();
      setWithdrawals(data);
    } catch (e) {
      toast({ title: "Failed to load withdrawals", variant: "destructive" });
    } finally {
      setWithdrawalsLoading(false);
    }
  }

  async function approveWithdrawal(id: number) {
    try {
      const resp = await fetch(`/api/admin/withdrawals/${id}/approve`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminNote: "Approved — payment will be sent shortly" }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      toast({ title: "Withdrawal Approved", description: `New balance: ${formatCurrency(data.newBalance)}` });
      loadWithdrawals();
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
  }

  async function denyWithdrawal(id: number, note: string) {
    try {
      const resp = await fetch(`/api/admin/withdrawals/${id}/deny`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminNote: note || "Request denied" }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      toast({ title: "Withdrawal Denied" });
      loadWithdrawals();
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
  }

  async function loadDeposits() {
    setDepositsLoading(true);
    try {
      const resp = await fetch("/api/admin/deposits", { credentials: "include" });
      const data = await resp.json();
      setDeposits(data);
    } catch (e) {
      toast({ title: "Failed to load deposits", variant: "destructive" });
    } finally {
      setDepositsLoading(false);
    }
  }

  async function approveDeposit(id: number) {
    try {
      const resp = await fetch(`/api/admin/deposits/${id}/approve`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminNote: "Verified — balance credited" }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      toast({ title: "Deposit Approved", description: `New balance: ${formatCurrency(data.newBalance)}` });
      loadDeposits();
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
  }

  async function denyDeposit(id: number, note: string) {
    try {
      const resp = await fetch(`/api/admin/deposits/${id}/deny`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminNote: note || "Payment not verified" }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      toast({ title: "Deposit Denied" });
      loadDeposits();
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
  }

  async function loadExposure() {
    setExposureLoading(true);
    try {
      const resp = await fetch("/api/admin/event-exposure", { credentials: "include" });
      const data = await resp.json();
      setExposure(data);
    } catch (e) {
      toast({ title: "Failed to load exposure data", variant: "destructive" });
    } finally {
      setExposureLoading(false);
    }
  }

  // Auto-refresh the live round every 2s while the Game Controls tab is active.
  useEffect(() => {
    loadAutoMode();
    loadLiveRounds();
    const t = setInterval(() => {
      loadLiveRounds();
    }, 2000);
    return () => clearInterval(t);
  }, []);

  async function loadLiveRounds() {
    try {
      const resp = await fetch("/api/admin/casino-rounds", { credentials: "include" });
      if (!resp.ok) throw new Error("failed");
      const data = await resp.json();
      setLiveRounds(data.rounds ?? []);
      // Populate last result colors from server-side settled rounds
      if (data.lastSettled) {
        const updates: Record<string, { result: string; reason: string }> = {};
        for (const [game, settled] of Object.entries(data.lastSettled as Record<string, { result: string; betCount: number; settledAt: string }>)) {
          if (settled.result) {
            updates[game] = {
              result: settled.result,
              reason: `${settled.betCount} bet(s) settled — ${settled.result} won`,
            };
          }
        }
        if (Object.keys(updates).length > 0) {
          setLastAutoResult(prev => ({ ...prev, ...updates }));
        }
      }
    } catch {
      setLiveRounds([]);
    }
  }

  async function settleRound(game: string, result: string) {
    setSettling(`${game}:${result}`);
    try {
      const resp = await fetch(`/api/admin/casino-rounds/${game}/settle`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ result }),
      });
      if (!resp.ok) throw new Error("settle failed");
      toast({ title: `✅ ${game} settled`, description: `Result: ${result}` });
      await loadLiveRounds();
    } catch (e) {
      toast({ title: "Settle failed", variant: "destructive" });
      console.error(e);
    } finally {
      setSettling(null);
    }
  }

  async function autoSettleRound(game: string) {
    setAutoSettling(game);
    try {
      const resp = await fetch(`/api/admin/casino-rounds/${game}/auto-settle`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!resp.ok) throw new Error("auto-settle failed");
      const data = await resp.json();
      setLastAutoResult(prev => ({ ...prev, [game]: { result: data.autoResult, reason: data.reason } }));
      toast({ title: `🤖 Auto-settled: ${game}`, description: data.reason });
      await loadLiveRounds();
    } catch (e) {
      toast({ title: "Auto-settle failed", variant: "destructive" });
    } finally {
      setAutoSettling(null);
    }
  }

  async function autoSettleAll() {
    setAutoSettling("ALL");
    try {
      const resp = await fetch("/api/admin/casino-rounds/auto-settle-all", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!resp.ok) throw new Error("failed");
      const data = await resp.json();
      const updates: Record<string, { result: string; reason: string }> = {};
      for (const r of (data.results ?? [])) {
        updates[r.game] = { result: r.result, reason: r.reason };
      }
      setLastAutoResult(prev => ({ ...prev, ...updates }));
      toast({ title: `🤖 Auto-settled ${data.results?.length ?? 0} games`, description: data.results?.map((r: any) => `${r.game}→${r.result}`).join(", ") });
      await loadLiveRounds();
    } catch (e) {
      toast({ title: "Auto-settle all failed", variant: "destructive" });
    } finally {
      setAutoSettling(null);
    }
  }

  async function loadAutoMode() {
    try {
      const resp = await fetch("/api/admin/auto-settle-mode", { credentials: "include" });
      if (resp.ok) {
        const data = await resp.json();
        setAutoMode(data.enabled);
        setAutoInterval(data.intervalSec ?? 10);
      }
    } catch {}
  }

  async function toggleAutoMode(enabled: boolean) {
    setAutoModeLoading(true);
    try {
      const resp = await fetch("/api/admin/auto-settle-mode", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, intervalSec: autoInterval }),
      });
      if (!resp.ok) throw new Error("failed");
      const data = await resp.json();
      setAutoMode(data.enabled);
      setAutoInterval(data.intervalSec ?? 10);
      toast({
        title: data.enabled ? "🤖 Auto Mode ON" : "✋ Manual Mode ON",
        description: data.enabled
          ? `System will auto-settle every ${data.intervalSec}s. House always wins.`
          : "Auto-settle stopped. You control results manually.",
      });
      await loadLiveRounds();
    } catch {
      toast({ title: "Failed to toggle mode", variant: "destructive" });
    } finally {
      setAutoModeLoading(false);
    }
  }

  async function loadCasinoStats(minutes = casinoStatsWindow) {
    setCasinoStatsLoading(true);
    try {
      const resp = await fetch(`/api/admin/casino-stats?minutes=${minutes}`, { credentials: "include" });
      if (!resp.ok) throw new Error("failed");
      const data = await resp.json();
      setCasinoStats(data.games ?? []);
    } catch {
      setCasinoStats([]);
    } finally {
      setCasinoStatsLoading(false);
    }
  }

  async function loadGameOverrides() {
    setGameOverridesLoading(true);
    try {
      const resp = await fetch("/api/admin/game-overrides", { credentials: "include" });
      const data = await resp.json();
      setGameOverrides(data);
    } catch {
      toast({ title: "Failed to load game overrides", variant: "destructive" });
    } finally {
      setGameOverridesLoading(false);
    }
  }

  async function loadPaymentSettings() {
    setPaymentLoading(true);
    try {
      const resp = await fetch("/api/payment-settings");
      setPaymentSettings(await resp.json());
    } finally {
      setPaymentLoading(false);
    }
  }

  async function savePaymentSetting(method: string) {
    const edit = paymentEdits[method] ?? {};
    const current = paymentSettings.find(p => p.method === method) ?? { method, label: method, accountName: "", accountNumber: "", instructions: "", isActive: true };
    const merged = { ...current, ...edit };
    try {
      const resp = await fetch(`/api/admin/payment-settings/${method}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(merged),
      });
      if (resp.ok) {
        toast({ title: "Saved!", description: `${merged.label} payment details updated.` });
        await loadPaymentSettings();
        setPaymentEdits(prev => { const n = { ...prev }; delete n[method]; return n; });
      } else {
        toast({ title: "Save failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    }
  }

  async function addNewPaymentMethod() {
    if (!newMethod.label.trim() || !newMethod.accountNumber.trim()) {
      toast({ title: "Method name and account number are required", variant: "destructive" }); return;
    }
    const methodKey = newMethod.label.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    if (paymentSettings.some(p => p.method === methodKey)) {
      toast({ title: "A method with this name already exists", variant: "destructive" }); return;
    }
    setAddingMethod(true);
    try {
      const resp = await fetch(`/api/admin/payment-settings/${methodKey}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newMethod.label.trim(), accountName: newMethod.accountName, accountNumber: newMethod.accountNumber, instructions: newMethod.instructions, isActive: true }),
      });
      if (resp.ok) {
        toast({ title: "New payment method added!", description: `${newMethod.label} is now active.` });
        setNewMethod({ label: "", accountName: "", accountNumber: "", instructions: "" });
        setShowAddForm(false);
        await loadPaymentSettings();
      } else {
        toast({ title: "Failed to add method", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setAddingMethod(false);
    }
  }

  async function deletePaymentMethod(method: string) {
    try {
      await fetch(`/api/admin/payment-settings/${method}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false, accountNumber: "", accountName: "", instructions: "" }),
      });
      await loadPaymentSettings();
      toast({ title: "Method removed from user view" });
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    }
  }

  async function setGameOverride(game: string, result: string) {
    try {
      const resp = await fetch("/api/admin/game-overrides", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game, result }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      setGameOverrides(data.overrides);
      toast({ title: `✅ Override set`, description: `${game} → ${result} is now FORCED` });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
  }

  async function clearGameOverride(game: string) {
    try {
      const resp = await fetch(`/api/admin/game-overrides/${game}`, {
        method: "DELETE", credentials: "include",
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      setGameOverrides(data.overrides);
      toast({ title: `🎲 Override cleared`, description: `${game} is now RANDOM` });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
  }

  function onCreateEvent(values: z.infer<typeof createEventSchema>) {
    createEventMutation.mutate(
      { data: values },
      {
        onSuccess: () => {
          toast({ title: "Event Created Successfully" });
          form.reset();
          queryClient.invalidateQueries({ queryKey: getGetEventsQueryKey({}) });
        },
        onError: (error: any) => {
          toast({ title: "Failed to create event", description: error.response?.data?.error || "An error occurred", variant: "destructive" });
        }
      }
    );
  }

  function onSettleEvent(result: "home" | "draw" | "away") {
    if (!selectedEventId) return;
    settleEventMutation.mutate(
      { eventId: selectedEventId, data: { result } },
      {
        onSuccess: (data) => {
          toast({ 
            title: "Event Settled",
            description: `Paid out: ${formatCurrency(data.totalPaidOut)} | Profit: ${formatCurrency(data.platformProfit)}`
          });
          setSettleDialogOpen(false);
          setSelectedEventId(null);
          queryClient.invalidateQueries({ queryKey: getGetEventsQueryKey({}) });
          queryClient.invalidateQueries({ queryKey: getGetAdminDashboardQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetAdminBetsQueryKey({ limit: 50 }) });
        },
        onError: (error: any) => {
          toast({ title: "Failed to settle event", description: error.response?.data?.error || "An error occurred", variant: "destructive" });
        }
      }
    );
  }

  function openEditOdds(event: any) {
    setEditingEvent(event);
    oddsForm.reset({ oddsHome: event.oddsHome, oddsDraw: event.oddsDraw, oddsAway: event.oddsAway });
    setEditOddsOpen(true);
  }

  function onUpdateOdds(values: z.infer<typeof editOddsSchema>) {
    if (!editingEvent) return;
    updateOddsMutation.mutate(
      { eventId: editingEvent.id, data: values },
      {
        onSuccess: () => {
          toast({ title: "Odds updated successfully" });
          setEditOddsOpen(false);
          setEditingEvent(null);
          queryClient.invalidateQueries({ queryKey: getGetEventsQueryKey({}) });
        },
        onError: (error: any) => {
          toast({ title: "Failed to update odds", description: error.response?.data?.error || "An error occurred", variant: "destructive" });
        }
      }
    );
  }

  async function onDeleteEvent(eventId: number) {
    try {
      const resp = await fetch(`/api/events/${eventId}/delete`, { method: "DELETE", credentials: "include" });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      toast({ title: "Event deleted successfully" });
      queryClient.invalidateQueries({ queryKey: getGetEventsQueryKey({}) });
    } catch (e: any) {
      toast({ title: "Failed to delete event", description: e.message, variant: "destructive" });
    }
  }

  async function onAdjustBalance(values: z.infer<typeof adjustBalanceSchema>) {
    try {
      const resp = await fetch(`/api/admin/users/${adjustUserId}/adjust`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      toast({ title: "Balance adjusted", description: `New balance: ${formatCurrency(data.newBalance)}` });
      setAdjustOpen(false);
      setAdjustUserId(null);
      adjustForm.reset();
      loadUsers();
    } catch (e: any) {
      toast({ title: "Failed to adjust balance", description: e.message, variant: "destructive" });
    }
  }

  async function onToggleBlock(userId: number) {
    try {
      const resp = await fetch(`/api/admin/users/${userId}/block`, {
        method: "POST", credentials: "include",
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      toast({ title: data.message });
      loadUsers();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  }

  async function onToggleFlag(userId: number) {
    try {
      const resp = await fetch(`/api/admin/users/${userId}/flag`, {
        method: "POST", credentials: "include",
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      toast({ title: data.message });
      loadUsers();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  }

  async function onResetPassword() {
    if (!resetPasswordUserId) return;
    if (!newPassword || newPassword.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    setResetPasswordLoading(true);
    try {
      const resp = await fetch(`/api/admin/users/${resetPasswordUserId}/reset-password`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      toast({ title: "Password reset successfully" });
      setResetPasswordOpen(false);
      setResetPasswordUserId(null);
      setNewPassword("");
    } catch (e: any) {
      toast({ title: "Failed to reset password", description: e.message, variant: "destructive" });
    } finally {
      setResetPasswordLoading(false);
    }
  }

  if (isLoadingAuth) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center p-4">
        <div className="text-amber-400 font-bold flex items-center gap-2 text-sm bg-amber-500/10 px-4 py-3 rounded-2xl border border-amber-500/30 shadow-lg">
          <ShieldAlert className="w-5 h-5 animate-pulse" />
          <span>Authenticating Admin Credentials...</span>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-amber-500/40 bg-[#0d1f14] shadow-2xl">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-14 h-14 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mb-3">
              <ShieldAlert className="w-8 h-8 text-amber-400" />
            </div>
            <CardTitle className="text-2xl font-black text-amber-400 tracking-tight">Admin Control Center</CardTitle>
            <CardDescription className="text-xs text-white/60">
              Enter Admin Credentials to access Game Controls, Events, and Withdrawals
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-white/80">Admin Email</label>
              <Input
                type="email"
                value={adminEmail}
                onChange={e => setAdminEmail(e.target.value)}
                className="bg-background border-emerald-800 text-foreground font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-white/80">Password</label>
              <Input
                type="password"
                value={adminPassword}
                onChange={e => setAdminPassword(e.target.value)}
                className="bg-background border-emerald-800 text-foreground font-mono text-sm"
              />
            </div>
            <Button
              className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold text-sm h-11"
              disabled={loginLoading}
              onClick={() => {
                setLoginLoading(true);
                loginMutation.mutate(
                  { data: { email: adminEmail, password: adminPassword } },
                  {
                    onSuccess: () => {
                      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
                      toast({ title: "Welcome Admin!" });
                    },
                    onError: (err: any) => {
                      toast({ title: "Login failed", description: err.response?.data?.error || "Invalid admin credentials", variant: "destructive" });
                    },
                    onSettled: () => setLoginLoading(false),
                  }
                );
              }}
            >
              {loginLoading ? "Logging in..." : "🔓 Unlock Admin Control Center"}
            </Button>

          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => window.history.length > 1 ? window.history.back() : (window.location.href = "/")}
            className="flex items-center gap-1.5 text-slate-300 hover:text-white font-bold text-sm bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700 transition"
          >
            <span>← Back</span>
          </button>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2 text-destructive">
            <ShieldAlert className="h-8 w-8" />
            Admin Control Center
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card/40 border-destructive/20 shadow-lg shadow-destructive/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">House Earnings</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {isLoadingDashboard || !dashboard ? <Skeleton className="h-8 w-24" /> : (
              <>
                <div className={`text-2xl font-bold ${(dashboard.grossProfit ?? 0) >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  {formatCurrency(dashboard.grossProfit ?? 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatPercentage((dashboard.profitMargin ?? 0) / 100)} kept from settled bets
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Money at Risk</CardTitle>
            <Activity className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            {isLoadingDashboard || !dashboard ? <Skeleton className="h-8 w-24" /> : (
              <>
                <div className="text-2xl font-bold text-orange-500">
                  {formatCurrency(dashboard.pendingLiability ?? 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Max payout if all open bets win</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Bets Placed</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingDashboard || !dashboard ? <Skeleton className="h-8 w-24" /> : (
              <>
                <div className="text-2xl font-bold">{formatCurrency(dashboard.totalStaked ?? 0)}</div>
                <p className="text-xs text-muted-foreground mt-1">{dashboard.totalBets ?? 0} bets by all players</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Registered Players</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingDashboard || !dashboard ? <Skeleton className="h-8 w-24" /> : (
              <>
                <div className="text-2xl font-bold">{dashboard.totalUsers ?? 0}</div>
                <p className="text-xs text-muted-foreground mt-1">Accounts on the platform</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="events" className="w-full" onValueChange={(v) => {
        window.scrollTo({ top: 120, behavior: "smooth" });
        if (v === "users") loadUsers();
        if (v === "withdrawals") loadWithdrawals();
        if (v === "deposits") loadDeposits();
        if (v === "liability") loadExposure();
        if (v === "gamecontrols") { loadGameOverrides(); loadCasinoStats(); loadLiveRounds(); }
        if (v === "paymentsettings") loadPaymentSettings();
        if (v === "signupbonus" && !signupBonusLoaded) loadSignupBonus();
      }}>
        <div className="flex flex-col md:flex-row gap-5 items-start w-full">
          {/* ── Sidebar Navigation ── */}
          <TabsList className="grid grid-cols-2 sm:grid-cols-3 md:flex md:flex-col h-auto w-full md:w-56 shrink-0 bg-[#0d1f14] border border-[#1a3a22] rounded-2xl p-2.5 gap-1.5 md:sticky md:top-4 shadow-xl">

            {/* GAMES & SPORTS group */}
            <p className="col-span-2 sm:col-span-3 md:col-span-1 text-[9px] font-black uppercase tracking-widest text-amber-400/80 px-1 pt-1 pb-0.5">Games & Sports</p>
            <TabsTrigger value="gamecontrols" className="w-full justify-start gap-2.5 rounded-lg px-3 py-2.5 text-sm font-bold bg-amber-900/60 text-amber-100 border border-amber-700/50 data-[state=active]:bg-amber-500 data-[state=active]:text-black data-[state=active]:border-amber-400 data-[state=active]:shadow-lg data-[state=active]:shadow-amber-900/50 hover:bg-amber-800/70 transition-all shadow-none">
              <Gamepad2 className="h-4 w-4 shrink-0" />
              Game Controls
            </TabsTrigger>
            <TabsTrigger value="events" className="w-full justify-start gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold bg-emerald-900/50 text-emerald-100 border border-emerald-800/40 data-[state=active]:bg-emerald-500 data-[state=active]:text-white data-[state=active]:border-emerald-400 data-[state=active]:shadow-lg data-[state=active]:shadow-emerald-900/50 hover:bg-emerald-800/60 transition-all shadow-none">
              <CalendarDays className="h-4 w-4 shrink-0" />
              Manage Events
            </TabsTrigger>
            <TabsTrigger value="create" onClick={() => window.scrollTo({ top: 120, behavior: "smooth" })} className="w-full justify-start gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold bg-emerald-900/50 text-emerald-100 border border-emerald-800/40 data-[state=active]:bg-emerald-500 data-[state=active]:text-white data-[state=active]:border-emerald-400 data-[state=active]:shadow-lg data-[state=active]:shadow-emerald-900/50 hover:bg-emerald-800/60 transition-all shadow-none">
              <PlusCircle className="h-4 w-4 shrink-0" />
              Create Event
            </TabsTrigger>

            {/* ANALYTICS group */}
            <p className="col-span-2 sm:col-span-3 md:col-span-1 text-[9px] font-black uppercase tracking-widest text-white/30 px-1 pt-2 pb-0.5">Analytics</p>
            <TabsTrigger value="reports" className="w-full justify-start gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold bg-orange-900/50 text-orange-100 border border-orange-800/40 data-[state=active]:bg-orange-500 data-[state=active]:text-white data-[state=active]:border-orange-400 data-[state=active]:shadow-lg data-[state=active]:shadow-orange-900/50 hover:bg-orange-800/60 transition-all shadow-none">
              <FileBarChart className="h-4 w-4 shrink-0" />
              Reports
            </TabsTrigger>
            <TabsTrigger value="liability" className="w-full justify-start gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold bg-orange-900/50 text-orange-100 border border-orange-800/40 data-[state=active]:bg-orange-500 data-[state=active]:text-white data-[state=active]:border-orange-400 data-[state=active]:shadow-lg data-[state=active]:shadow-orange-900/50 hover:bg-orange-800/60 transition-all shadow-none">
              <BarChart3 className="h-4 w-4 shrink-0" />
              Liability
            </TabsTrigger>
            <TabsTrigger value="bets" className="w-full justify-start gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold bg-orange-900/50 text-orange-100 border border-orange-800/40 data-[state=active]:bg-orange-500 data-[state=active]:text-white data-[state=active]:border-orange-400 data-[state=active]:shadow-lg data-[state=active]:shadow-orange-900/50 hover:bg-orange-800/60 transition-all shadow-none">
              <Receipt className="h-4 w-4 shrink-0" />
              All Bets
            </TabsTrigger>

            {/* USERS group */}
            <p className="col-span-2 sm:col-span-3 md:col-span-1 text-[9px] font-black uppercase tracking-widest text-white/30 px-1 pt-2 pb-0.5">Users</p>
            <TabsTrigger value="users" className="w-full justify-start gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold bg-sky-900/50 text-sky-100 border border-sky-800/40 data-[state=active]:bg-sky-500 data-[state=active]:text-white data-[state=active]:border-sky-400 data-[state=active]:shadow-lg data-[state=active]:shadow-sky-900/50 hover:bg-sky-800/60 transition-all shadow-none">
              <Users className="h-4 w-4 shrink-0" />
              Users
            </TabsTrigger>

            {/* FINANCE group */}
            <p className="col-span-2 sm:col-span-3 md:col-span-1 text-[9px] font-black uppercase tracking-widest text-white/30 px-1 pt-2 pb-0.5">Finance</p>
            <TabsTrigger value="deposits" className="w-full justify-start gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold bg-blue-900/50 text-blue-100 border border-blue-800/40 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:border-blue-400 data-[state=active]:shadow-lg data-[state=active]:shadow-blue-900/50 hover:bg-blue-800/60 transition-all shadow-none">
              <ArrowDownToLine className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">Deposits</span>
              {deposits.filter(d => d.status === "pending").length > 0 && (
                <span className="bg-white text-blue-700 text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none">
                  {deposits.filter(d => d.status === "pending").length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="withdrawals" className="w-full justify-start gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold bg-yellow-900/50 text-yellow-100 border border-yellow-800/40 data-[state=active]:bg-yellow-500 data-[state=active]:text-black data-[state=active]:border-yellow-400 data-[state=active]:shadow-lg data-[state=active]:shadow-yellow-900/50 hover:bg-yellow-800/60 transition-all shadow-none">
              <ArrowUpFromLine className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">Withdrawals</span>
              {withdrawals.filter(w => w.status === "pending").length > 0 && (
                <span className="bg-black/30 text-yellow-100 text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none">
                  {withdrawals.filter(w => w.status === "pending").length}
                </span>
              )}
            </TabsTrigger>

            {/* SETTINGS group */}
            <p className="col-span-2 sm:col-span-3 md:col-span-1 text-[9px] font-black uppercase tracking-widest text-white/30 px-1 pt-2 pb-0.5">Settings</p>
            <TabsTrigger value="paymentsettings" className="w-full justify-start gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold bg-teal-900/50 text-teal-100 border border-teal-800/40 data-[state=active]:bg-teal-500 data-[state=active]:text-white data-[state=active]:border-teal-400 data-[state=active]:shadow-lg data-[state=active]:shadow-teal-900/50 hover:bg-teal-800/60 transition-all shadow-none">
              <CreditCard className="h-4 w-4 shrink-0" />
              Payment Setup
            </TabsTrigger>
            <TabsTrigger value="signupbonus" className="w-full justify-start gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold bg-purple-900/50 text-purple-100 border border-purple-800/40 data-[state=active]:bg-purple-500 data-[state=active]:text-white data-[state=active]:border-purple-400 data-[state=active]:shadow-lg data-[state=active]:shadow-purple-900/50 hover:bg-purple-800/60 transition-all shadow-none">
              <Gift className="h-4 w-4 shrink-0" />
              Signup Bonus
            </TabsTrigger>

            <div className="pb-1" />
          </TabsList>

          {/* ── Content Area ── */}
          <div className="flex-1 min-w-0 w-full">

        {/* ── Reports ── */}
        <TabsContent value="reports" className="space-y-4">
          <div>
            <h2 className="text-xl font-black text-white mb-1">Platform Reports</h2>
            <p className="text-sm text-white/40">Daily, weekly and monthly earnings — house profits, player wins and losses</p>
          </div>
          <AdminReports />
        </TabsContent>

        <TabsContent value="events" className="space-y-4">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>All Events</CardTitle>
              <CardDescription>Edit odds, settle results, or delete events without any bets</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingEvents ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : !events || events.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No events found.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event</TableHead>
                      <TableHead>Sport</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Odds H / D / A</TableHead>
                      <TableHead>Start</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events?.map(event => (
                      <TableRow key={event.id}>
                        <TableCell className="font-medium">
                          {event.homeTeam} vs {event.awayTeam}
                        </TableCell>
                        <TableCell><Badge variant="outline">{event.sport}</Badge></TableCell>
                        <TableCell>
                          <Badge variant={event.status === "finished" ? "destructive" : event.status === "live" ? "default" : "outline"}>
                            {event.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {event.oddsHome.toFixed(2)} / {event.oddsDraw.toFixed(2)} / {event.oddsAway.toFixed(2)}
                        </TableCell>
                        <TableCell>{formatDateTime(event.startTime)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              onClick={() => openEditOdds(event)}
                            >
                              <Pencil className="h-3 w-3" />
                              Edit Odds
                            </Button>

                            {event.status !== "finished" && (
                              <Dialog open={settleDialogOpen && selectedEventId === event.id} onOpenChange={(open) => {
                                setSettleDialogOpen(open);
                                if (!open) setSelectedEventId(null);
                              }}>
                                <DialogTrigger asChild>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    className="gap-1"
                                    onClick={() => setSelectedEventId(event.id)}
                                  >
                                    <Flag className="h-3 w-3" />
                                    Settle Result
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2 text-emerald-400">
                                      <Trophy className="h-5 w-5 text-yellow-400" />
                                      Settle Match Result & Control Profit
                                    </DialogTitle>
                                    <DialogDescription>
                                      Pick the outcome for <strong>{event.homeTeam} vs {event.awayTeam}</strong> ({event.sport}).
                                      You control the result — selecting the losing side for users guarantees <strong>100% Admin Profit</strong>.
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="grid grid-cols-1 gap-2.5 py-3">
                                    <Button
                                      variant="default"
                                      className="flex flex-col h-auto py-3.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-black font-extrabold shadow-lg shadow-amber-500/20"
                                      onClick={() => onSettleEvent("auto")}
                                      disabled={settleEventMutation.isPending}
                                    >
                                      <span className="font-extrabold text-sm flex items-center gap-1.5">
                                        🟢 Auto-Win (Guaranteed Max House Profit)
                                      </span>
                                      <span className="text-[10px] text-black/70">Calculates lowest user payout to guarantee maximum Admin Profit</span>
                                    </Button>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1">
                                      <Button
                                        variant="outline"
                                        className="flex flex-col h-auto py-3.5 border-emerald-500/30 hover:border-emerald-500 hover:bg-emerald-500/10"
                                        onClick={() => onSettleEvent("home")}
                                        disabled={settleEventMutation.isPending}
                                      >
                                        <span className="font-bold text-sm text-foreground">{event.homeTeam}</span>
                                        <span className="text-xs text-emerald-400 mt-0.5">Home Win ({event.oddsHome.toFixed(2)}x)</span>
                                        <span className="text-[10px] text-muted-foreground mt-1">Force Win</span>
                                      </Button>

                                      {event.oddsDraw > 0 && (
                                        <Button
                                          variant="outline"
                                          className="flex flex-col h-auto py-3.5 border-yellow-500/30 hover:border-yellow-500 hover:bg-yellow-500/10"
                                          onClick={() => onSettleEvent("draw")}
                                          disabled={settleEventMutation.isPending}
                                        >
                                          <span className="font-bold text-sm text-foreground">Draw / Tie</span>
                                          <span className="text-xs text-yellow-400 mt-0.5">Draw ({event.oddsDraw.toFixed(2)}x)</span>
                                          <span className="text-[10px] text-muted-foreground mt-1">Force Draw</span>
                                        </Button>
                                      )}

                                      <Button
                                        variant="outline"
                                        className="flex flex-col h-auto py-3.5 border-blue-500/30 hover:border-blue-500 hover:bg-blue-500/10"
                                        onClick={() => onSettleEvent("away")}
                                        disabled={settleEventMutation.isPending}
                                      >
                                        <span className="font-bold text-sm text-foreground">{event.awayTeam}</span>
                                        <span className="text-xs text-blue-400 mt-0.5">Away Win ({event.oddsAway.toFixed(2)}x)</span>
                                        <span className="text-[10px] text-muted-foreground mt-1">Force Win</span>
                                      </Button>
                                    </div>
                                  </div>

                                  <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 text-center font-medium">
                                    💡 <strong>Admin Win Strategy:</strong> Whichever outcome you select above becomes the official result. All bets placed on other outcomes will be marked <strong>LOST</strong>, and 100% of their stakes will stay with the Admin!
                                  </div>
                                </DialogContent>
                              </Dialog>
                            )}

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm" className="gap-1">
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Event</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete <strong>{event.homeTeam} vs {event.awayTeam}</strong>?
                                    This can only be done if there are no bets placed on this event.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={() => onDeleteEvent(event.id)}
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="liability" className="space-y-4">
          <Card className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Liability Monitor</CardTitle>
                <CardDescription>
                  See where users are placing the most bets — adjust odds on heavily-backed outcomes to protect the house
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={loadExposure} disabled={exposureLoading}>
                {exposureLoading ? "Loading..." : "Refresh"}
              </Button>
            </CardHeader>
            <CardContent>
              {exposureLoading ? (
                <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>
              ) : exposure.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Activity className="mx-auto h-12 w-12 mb-4 opacity-20" />
                  <p>No active events with bets yet</p>
                  <p className="text-xs mt-1">Click Refresh after users place bets</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {exposure.map((ev: any) => {
                    const totalStaked = ev.home.staked + ev.draw.staked + ev.away.staked;
                    const maxLiability = Math.max(ev.home.liability, ev.draw.liability, ev.away.liability);
                    const getBarWidth = (staked: number) => totalStaked > 0 ? Math.round((staked / totalStaked) * 100) : 0;
                    const isHighRisk = (liability: number) => liability === maxLiability && liability > 0;

                    return (
                      <Card key={ev.eventId} className={`border ${maxLiability > 0 ? 'border-orange-500/30 bg-orange-500/5' : 'border-border/40 bg-card/20'}`}>
                        <CardHeader className="pb-2 pt-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-bold text-base">{ev.homeTeam} vs {ev.awayTeam}</div>
                              <div className="text-xs text-muted-foreground">{ev.sport} · Total staked: <span className="font-mono text-primary">{formatCurrency(totalStaked)}</span></div>
                            </div>
                            <Badge variant={ev.status === "live" ? "destructive" : "outline"} className="text-xs">
                              {ev.status.toUpperCase()}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {[
                            { label: `${ev.homeTeam} (Home Win)`, key: "home", data: ev.home, odds: ev.oddsHome },
                            { label: "Draw", key: "draw", data: ev.draw, odds: ev.oddsDraw },
                            { label: `${ev.awayTeam} (Away Win)`, key: "away", data: ev.away, odds: ev.oddsAway },
                          ].filter(item => item.key !== "draw" || ev.oddsDraw > 0).map(({ label, data, odds }) => {
                            const barW = getBarWidth(data.staked);
                            const highRisk = isHighRisk(data.liability);
                            return (
                              <div key={label}>
                                <div className="flex items-center justify-between text-sm mb-1">
                                  <span className={`font-medium ${highRisk ? 'text-orange-400' : 'text-foreground'}`}>
                                    {highRisk && '⚠️ '}{label}
                                    <span className="ml-2 text-xs text-muted-foreground font-mono">@ {odds}x</span>
                                  </span>
                                  <div className="text-right">
                                    <span className="font-mono text-xs">{formatCurrency(data.staked)} staked</span>
                                    {data.liability > 0 && (
                                      <span className={`ml-2 text-xs font-mono ${highRisk ? 'text-orange-400 font-bold' : 'text-muted-foreground'}`}>
                                        → {formatCurrency(data.liability)} payout if wins
                                      </span>
                                    )}
                                    {data.count > 0 && (
                                      <span className="ml-2 text-xs text-muted-foreground">({data.count} bet{data.count !== 1 ? 's' : ''})</span>
                                    )}
                                  </div>
                                </div>
                                <div className="h-2 bg-card rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${highRisk ? 'bg-orange-500' : 'bg-primary/50'}`}
                                    style={{ width: `${barW}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                          {maxLiability > 0 && (
                            <div className="flex items-start gap-2 mt-2 p-2 rounded bg-orange-500/10 border border-orange-500/20">
                              <AlertCircle className="h-4 w-4 text-orange-400 mt-0.5 shrink-0" />
                              <p className="text-xs text-orange-300">
                                The ⚠️ outcome has the highest payout risk. Consider lowering its odds in the <strong>Manage Events</strong> tab (Edit Odds) to reduce your liability or attract bets on the other outcomes.
                              </p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="create">
          <Card className="max-w-2xl border-border/50">
            <CardHeader>
              <CardTitle>Create New Event</CardTitle>
              <CardDescription>The house margin (overround) is calculated automatically based on the odds.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onCreateEvent)} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="sport"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sport</FormLabel>
                          <select
                            value={field.value || "Cricket"}
                            onChange={(e) => field.onChange(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground font-bold text-sm focus:outline-none focus:border-emerald-500 cursor-pointer h-10"
                          >
                            <optgroup label="🏏 Sports Categories">
                              <option value="Cricket">🏏 Cricket</option>
                              <option value="Football">⚽ Football</option>
                              <option value="Basketball">🏀 Basketball</option>
                              <option value="Tennis">🎾 Tennis</option>
                              <option value="Volleyball">🏐 Volleyball</option>
                              <option value="Table Tennis">🏓 Table Tennis</option>
                              <option value="Badminton">🏸 Badminton</option>
                            </optgroup>
                            <optgroup label="🎮 Casino Games">
                              <option value="Teen Patti">👑 Teen Patti</option>
                              <option value="Dragon Tiger">🔥 Dragon Tiger</option>
                              <option value="Andar Bahar">🃏 Andar Bahar</option>
                              <option value="Blackjack">♠️ Blackjack</option>
                              <option value="Roulette">🎡 Roulette</option>
                              <option value="Lucky 7">🎲 Lucky 7</option>
                              <option value="Jhandi Munda">🎴 Jhandi Munda</option>
                              <option value="Joker">🃏 Joker</option>
                              <option value="Crash">🚀 Crash</option>
                              <option value="God of Fortune">🐉 God of Fortune</option>
                              <option value="Bingo 777">🎰 777 Bingo</option>
                              <option value="Sweet Bonanza">🍭 Sweet Bonanza</option>
                              <option value="10 Cards">🔟 10 Cards</option>
                              <option value="Muflis">♟️ Muflis</option>
                              <option value="Car Roulette">🏎️ Car Roulette</option>
                              <option value="Fruit Line">🍉 Fruit Line</option>
                              <option value="Coin Flip">🪙 Coin Flip</option>
                              <option value="Rummy">🀄 Rummy</option>
                              <option value="Rung">♠️ Rung</option>
                              <option value="Dice Roll">🎲 Dice Roll</option>
                              <option value="Court Piece">🂡 Court Piece</option>
                            </optgroup>
                          </select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="league"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>League (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Premier League" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="homeTeam"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Home Team</FormLabel>
                          <FormControl>
                            <Input placeholder="Home Team" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="awayTeam"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Away Team</FormLabel>
                          <FormControl>
                            <Input placeholder="Away Team" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="startTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Time</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-4 border rounded-md p-4 bg-background/50">
                    <h3 className="font-medium text-sm">Initial Odds (higher margin = more admin profit)</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="oddsHome"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Home Win</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.01" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="oddsDraw"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Draw</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.01" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="oddsAway"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Away Win</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.01" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <Button type="submit" disabled={createEventMutation.isPending}>
                    {createEventMutation.isPending ? "Creating..." : "Create Event"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bets">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>Global Bet Feed</CardTitle>
              <CardDescription>All bets placed across the platform</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingBets ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : !bets || bets.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No bets found.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Pick</TableHead>
                      <TableHead className="text-right">Stake</TableHead>
                      <TableHead className="text-right">Odds</TableHead>
                      <TableHead className="text-right">Admin Profit</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bets?.map(bet => (
                      <TableRow key={bet.id}>
                        <TableCell className="font-medium">{bet.username}</TableCell>
                        <TableCell>{bet.homeTeam} vs {bet.awayTeam}</TableCell>
                        <TableCell className="text-xs font-bold">
                          {bet.selection === "home" ? `${bet.homeTeam} Win` : bet.selection === "away" ? `${bet.awayTeam} Win` : bet.selection === "draw" ? "Draw" : String(bet.selection)}
                        </TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(bet.stake)}</TableCell>
                        <TableCell className="text-right font-mono">{bet.odds.toFixed(2)}</TableCell>
                        <TableCell className={`text-right font-mono font-bold ${bet.profit && bet.profit > 0 ? 'text-primary' : bet.profit && bet.profit < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                          {bet.profit !== undefined ? formatCurrency(bet.profit) : 'Pending'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={bet.status === 'won' ? 'default' : bet.status === 'lost' ? 'destructive' : 'outline'}>
                            {bet.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <Card className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <UserCog className="h-5 w-5" />
                  User Management
                </CardTitle>
                <CardDescription>View all registered users — adjust balance, reset password, block or flag for fraud</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={loadUsers} disabled={usersLoading}>
                {usersLoading ? "Loading..." : "Refresh"}
              </Button>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">Click Refresh to load users.</div>
              ) : (
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead className="text-right">Wagered</TableHead>
                      <TableHead className="text-right">Won</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user: any) => (
                      <TableRow key={user.id} className={user.isBlocked ? "opacity-60 bg-red-500/5" : user.isFlagged ? "bg-yellow-500/5" : ""}>
                        <TableCell>
                          <div className="font-medium">{user.username}</div>
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                          <Badge variant={user.role === "admin" ? "destructive" : "outline"} className="mt-1 text-xs">
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {user.isBlocked && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-400">
                                <ShieldX className="h-3 w-3" /> Blocked
                              </span>
                            )}
                            {user.isFlagged && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/15 px-2 py-0.5 text-xs font-semibold text-yellow-500">
                                <Flag className="h-3 w-3" /> Fraud Flag
                              </span>
                            )}
                            {!user.isBlocked && !user.isFlagged && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-semibold text-green-500">
                                <ShieldCheck className="h-3 w-3" /> Active
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(user.balance)}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(user.totalWagered)}</TableCell>
                        <TableCell className="text-right font-mono text-primary">{formatCurrency(user.totalWon)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1 flex-wrap">
                            {/* Adjust Balance */}
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1 h-7 text-xs"
                              disabled={user.role === "admin"}
                              onClick={() => {
                                setAdjustUserId(user.id);
                                adjustForm.reset({ amount: 1000, note: "" });
                                setAdjustOpen(true);
                              }}
                            >
                              <Coins className="h-3 w-3" /> Balance
                            </Button>
                            {/* Reset Password */}
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1 h-7 text-xs"
                              disabled={user.role === "admin"}
                              onClick={() => {
                                setResetPasswordUserId(user.id);
                                setNewPassword("");
                                setResetPasswordOpen(true);
                              }}
                            >
                              <KeyRound className="h-3 w-3" /> Password
                            </Button>
                            {/* Flag / Unflag */}
                            <Button
                              variant={user.isFlagged ? "default" : "outline"}
                              size="sm"
                              className={`gap-1 h-7 text-xs ${user.isFlagged ? "bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30 border-yellow-500/30" : ""}`}
                              disabled={user.role === "admin"}
                              onClick={() => onToggleFlag(user.id)}
                              title={user.isFlagged ? "Remove fraud flag" : "Flag for fraud review"}
                            >
                              <Flag className="h-3 w-3" /> {user.isFlagged ? "Unflag" : "Flag"}
                            </Button>
                            {/* Block / Unblock */}
                            <Button
                              variant={user.isBlocked ? "default" : "outline"}
                              size="sm"
                              className={`gap-1 h-7 text-xs ${user.isBlocked ? "bg-red-500/20 text-red-400 hover:bg-red-500/30 border-red-500/30" : "text-red-400 hover:text-red-300 hover:border-red-400"}`}
                              disabled={user.role === "admin"}
                              onClick={() => onToggleBlock(user.id)}
                              title={user.isBlocked ? "Unblock this user" : "Block this user"}
                            >
                              {user.isBlocked ? <ShieldCheck className="h-3 w-3" /> : <ShieldX className="h-3 w-3" />}
                              {user.isBlocked ? "Unblock" : "Block"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deposits" className="space-y-4">
          <Card className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ArrowDownToLine className="h-5 w-5 text-primary" />
                  Deposit Requests
                </CardTitle>
                <CardDescription>Verify payments and credit user accounts</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={loadDeposits} disabled={depositsLoading}>
                {depositsLoading ? "Loading..." : "Refresh"}
              </Button>
            </CardHeader>
            <CardContent>
              {depositsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : deposits.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ArrowDownToLine className="mx-auto h-12 w-12 mb-4 opacity-20" />
                  <p>No deposit requests yet</p>
                  <p className="text-xs mt-1">Click Refresh after users submit deposit requests</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Transaction Ref</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deposits.map((dep: any) => (
                      <TableRow key={dep.id}>
                        <TableCell>
                          <div className="font-medium">{dep.username}</div>
                          <div className="text-xs text-muted-foreground">{dep.email}</div>
                        </TableCell>
                        <TableCell className="font-mono font-bold text-primary">{formatCurrency(dep.amount)}</TableCell>
                        <TableCell className="capitalize">{dep.paymentMethod.replace(/_/g, " ")}</TableCell>
                        <TableCell className="font-mono text-xs max-w-[140px] truncate">{dep.transactionRef}</TableCell>
                        <TableCell>
                          {dep.status === "pending" && <Badge variant="outline" className="text-yellow-500 border-yellow-500"><Clock className="h-3 w-3 mr-1" />Pending</Badge>}
                          {dep.status === "approved" && <Badge variant="outline" className="text-green-500 border-green-500"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>}
                          {dep.status === "denied" && <Badge variant="outline" className="text-destructive border-destructive"><XCircle className="h-3 w-3 mr-1" />Denied</Badge>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDateTime(dep.createdAt)}</TableCell>
                        <TableCell>
                          {dep.status === "pending" && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-green-500/50 text-green-500 hover:bg-green-500/10 gap-1"
                                onClick={() => approveDeposit(dep.id)}
                              >
                                <CheckCircle className="h-3 w-3" />
                                Approve
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="outline" className="border-destructive/50 text-destructive hover:bg-destructive/10 gap-1">
                                    <XCircle className="h-3 w-3" />
                                    Deny
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Deny Deposit?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will deny the {formatCurrency(dep.amount)} deposit request from <strong>{dep.username}</strong>. Their balance will NOT be credited.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <Input
                                    placeholder="Reason for denial (optional)"
                                    value={denyDepositNote}
                                    onChange={(e) => setDenyDepositNote(e.target.value)}
                                    className="mt-2"
                                  />
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => { denyDeposit(dep.id, denyDepositNote); setDenyDepositNote(""); }}>
                                      Deny Deposit
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          )}
                          {dep.status !== "pending" && (
                            <span className="text-xs text-muted-foreground">{dep.adminNote}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="withdrawals" className="space-y-4">
          <Card className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ArrowUpFromLine className="h-5 w-5 text-primary" />
                  Withdrawal Requests
                </CardTitle>
                <CardDescription>Review and process user payout requests</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={loadWithdrawals} disabled={withdrawalsLoading}>
                {withdrawalsLoading ? "Loading..." : "Refresh"}
              </Button>
            </CardHeader>
            <CardContent>
              {withdrawalsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : withdrawals.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ArrowUpFromLine className="mx-auto h-12 w-12 mb-4 opacity-20" />
                  <p>No withdrawal requests yet</p>
                  <p className="text-xs mt-1">Click Refresh after users submit withdrawal requests</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {withdrawals.map((wr: any) => (
                      <TableRow key={wr.id}>
                        <TableCell>
                          <div className="font-medium">{wr.username}</div>
                          <div className="text-xs text-muted-foreground">{wr.email}</div>
                        </TableCell>
                        <TableCell className="font-mono font-bold text-primary">{formatCurrency(wr.amount)}</TableCell>
                        <TableCell className="capitalize">{wr.paymentMethod.replace(/_/g, " ")}</TableCell>
                        <TableCell className="font-mono text-xs max-w-[120px] truncate">{wr.accountDetails}</TableCell>
                        <TableCell>
                          {wr.status === "pending" && <Badge variant="outline" className="text-yellow-500 border-yellow-500"><Clock className="h-3 w-3 mr-1" />Pending</Badge>}
                          {wr.status === "approved" && <Badge variant="outline" className="text-green-500 border-green-500"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>}
                          {wr.status === "denied" && <Badge variant="outline" className="text-destructive border-destructive"><XCircle className="h-3 w-3 mr-1" />Denied</Badge>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDateTime(wr.createdAt)}</TableCell>
                        <TableCell>
                          {wr.status === "pending" && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-green-500/50 text-green-500 hover:bg-green-500/10 gap-1"
                                onClick={() => approveWithdrawal(wr.id)}
                              >
                                <CheckCircle className="h-3 w-3" />
                                Approve
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="outline" className="border-destructive/50 text-destructive hover:bg-destructive/10 gap-1">
                                    <XCircle className="h-3 w-3" />
                                    Deny
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Deny Withdrawal?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will deny the {formatCurrency(wr.amount)} withdrawal request from <strong>{wr.username}</strong>. Their balance will NOT be deducted.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <Input
                                    placeholder="Reason for denial (optional)"
                                    value={denyNote}
                                    onChange={(e) => setDenyNote(e.target.value)}
                                    className="mt-2"
                                  />
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => { denyWithdrawal(wr.id, denyNote); setDenyNote(""); }}>
                                      Deny Request
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          )}
                          {wr.status !== "pending" && (
                            <span className="text-xs text-muted-foreground">{wr.adminNote}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── PAYMENT SETUP TAB ─── */}
        <TabsContent value="paymentsettings" className="space-y-4">
          <Card className="border-green-500/30 bg-green-500/5">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-green-400 flex items-center gap-2">💳 Payment Setup</CardTitle>
                <CardDescription>Enter your account numbers below. Users will see these details when they deposit money.</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={loadPaymentSettings} disabled={paymentLoading}>
                {paymentLoading ? "Loading..." : "Refresh"}
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* ── ADD NEW METHOD button ── */}
              {!showAddForm && (
                <Button onClick={() => { setShowAddForm(true); setEditingPaymentMethod(null); }}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold">
                  ➕ Add New Payment Method
                </Button>
              )}

              {/* ── ADD FORM ── */}
              {showAddForm && (
                <div className="border border-green-500/40 bg-green-500/5 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-bold text-green-400">➕ Add New Payment Method</p>
                    <button onClick={() => { setShowAddForm(false); setNewMethod({ label: "", accountName: "", accountNumber: "", instructions: "" }); }}
                      className="text-xs text-muted-foreground hover:text-white px-2 py-1 rounded hover:bg-white/10">✕ Cancel</button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Method Name <span className="text-red-400">*</span></label>
                      <input value={newMethod.label}
                        onChange={e => setNewMethod(p => ({ ...p, label: e.target.value }))}
                        placeholder="e.g. Meezan Bank, SadaPay, HBL"
                        className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-green-500/30 text-foreground focus:outline-none focus:border-green-500/60" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Account Holder Name</label>
                      <input value={newMethod.accountName}
                        onChange={e => setNewMethod(p => ({ ...p, accountName: e.target.value }))}
                        placeholder="e.g. Muhammad Ali"
                        className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-green-500/30 text-foreground focus:outline-none focus:border-green-500/60" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Account / Phone / IBAN <span className="text-red-400">*</span></label>
                      <input value={newMethod.accountNumber}
                        onChange={e => setNewMethod(p => ({ ...p, accountNumber: e.target.value }))}
                        placeholder="0312-XXXXXXX or PK00XXXX..."
                        className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-green-500/30 text-foreground focus:outline-none focus:border-green-500/60 font-mono" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Instructions (optional)</label>
                      <input value={newMethod.instructions}
                        onChange={e => setNewMethod(p => ({ ...p, instructions: e.target.value }))}
                        placeholder="e.g. Bank deposit only"
                        className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-green-500/30 text-foreground focus:outline-none focus:border-green-500/60" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={addNewPaymentMethod} disabled={addingMethod} className="flex-1 bg-green-600 hover:bg-green-700 text-white">
                      {addingMethod ? "Saving..." : "✓ Save New Method"}
                    </Button>
                    <Button variant="outline" onClick={() => { setShowAddForm(false); setNewMethod({ label: "", accountName: "", accountNumber: "", instructions: "" }); }}
                      className="px-4">Cancel</Button>
                  </div>
                </div>
              )}

              {/* ── PAYMENT METHODS LIST ── */}
              {paymentLoading && paymentSettings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">Loading payment settings...</div>
              ) : paymentSettings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">No payment methods yet. Add one above.</div>
              ) : (
                <div className="space-y-2">
                  {paymentSettings.map((pm) => {
                    const emojis: Record<string, string> = { jazzcash: "📱", easypaisa: "💚", nayapay: "🔵", bank_transfer: "🏦" };
                    const emoji = emojis[pm.method] ?? "💳";
                    const isEditing = editingPaymentMethod === pm.method;
                    const edit = paymentEdits[pm.method] ?? {};
                    const val = { ...pm, ...edit };
                    return (
                      <div key={pm.method} className={`border rounded-xl overflow-hidden transition-all ${isEditing ? "border-yellow-500/50" : pm.isActive ? "border-border/40" : "border-border/20 opacity-60"}`}>
                        {/* Row: icon + info + buttons */}
                        <div className="flex items-center gap-3 px-4 py-3 bg-card/40">
                          <span className="text-xl shrink-0">{emoji}</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm flex items-center gap-2">
                              {pm.label}
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${pm.isActive ? "bg-green-500/20 text-green-400" : "bg-gray-500/20 text-gray-400"}`}>
                                {pm.isActive ? "Active" : "Inactive"}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {pm.accountNumber ? pm.accountNumber : <span className="italic">No account set</span>}
                              {pm.accountName ? ` · ${pm.accountName}` : ""}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => {
                                if (isEditing) { setEditingPaymentMethod(null); setPaymentEdits(p => { const n = { ...p }; delete n[pm.method]; return n; }); }
                                else { setEditingPaymentMethod(pm.method); setShowAddForm(false); }
                              }}
                              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border ${isEditing ? "border-gray-500/40 bg-gray-500/10 text-gray-300 hover:bg-gray-500/20" : "border-yellow-500/30 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20"}`}>
                              {isEditing ? "✕ Cancel" : "✏️ Edit"}
                            </button>
                            <button
                              onClick={async () => {
                                if (!confirm(`Delete "${pm.label}"? This cannot be undone.`)) return;
                                await fetch(`/api/admin/payment-settings/${pm.method}`, { method: "DELETE", credentials: "include" });
                                if (editingPaymentMethod === pm.method) setEditingPaymentMethod(null);
                                await loadPaymentSettings();
                                toast({ title: `"${pm.label}" deleted` });
                              }}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
                              🗑 Delete
                            </button>
                          </div>
                        </div>
                        {/* Edit form (expands below row) */}
                        {isEditing && (
                          <div className="border-t border-yellow-500/20 bg-yellow-500/5 px-4 py-4 space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="text-xs text-muted-foreground block mb-1">Account Holder Name</label>
                                <input value={val.accountName}
                                  onChange={e => setPaymentEdits(p => ({ ...p, [pm.method]: { ...p[pm.method], accountName: e.target.value } }))}
                                  placeholder="e.g. Muhammad Ali"
                                  className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-yellow-500/30 text-foreground focus:outline-none focus:border-yellow-500/60" />
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground block mb-1">
                                  {pm.method === "bank_transfer" ? "IBAN / Account Number" : "Phone / Account Number"}
                                </label>
                                <input value={val.accountNumber}
                                  onChange={e => setPaymentEdits(p => ({ ...p, [pm.method]: { ...p[pm.method], accountNumber: e.target.value } }))}
                                  placeholder={pm.method === "bank_transfer" ? "PK00XXXX0000000000000000" : "0312-XXXXXXX"}
                                  className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-yellow-500/30 text-foreground focus:outline-none focus:border-yellow-500/60 font-mono" />
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground block mb-1">Instructions (optional)</label>
                                <input value={val.instructions}
                                  onChange={e => setPaymentEdits(p => ({ ...p, [pm.method]: { ...p[pm.method], instructions: e.target.value } }))}
                                  placeholder="e.g. Send as Mobile Transfer"
                                  className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-yellow-500/30 text-foreground focus:outline-none focus:border-yellow-500/60" />
                              </div>
                              <div className="flex items-end pb-1">
                                <label className="flex items-center gap-2 cursor-pointer text-sm">
                                  <input type="checkbox" checked={val.isActive}
                                    onChange={e => setPaymentEdits(p => ({ ...p, [pm.method]: { ...p[pm.method], isActive: e.target.checked } }))}
                                    className="accent-green-500 w-4 h-4" />
                                  <span>Active <span className="text-xs text-muted-foreground">(visible to users)</span></span>
                                </label>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={async () => { await savePaymentSetting(pm.method); setEditingPaymentMethod(null); }}
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white">
                                💾 Save Changes
                              </Button>
                              <Button size="sm" variant="outline"
                                onClick={() => { setEditingPaymentMethod(null); setPaymentEdits(p => { const n = { ...p }; delete n[pm.method]; return n; }); }}
                                className="px-4">Cancel</Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="text-xs text-muted-foreground pt-1 px-1">
                💡 Active methods appear on the user deposit page. Click <strong>✏️ Edit</strong> to update details, <strong>🗑 Delete</strong> to remove permanently.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── SIGNUP BONUS TAB ─── */}
        {/* ─── SIGNUP & REFERRAL BONUS TAB ─── */}
        <TabsContent value="signupbonus" className="space-y-4">
          <Card className="border-purple-500/30 bg-purple-500/5">
            <CardHeader>
              <CardTitle className="text-purple-400 flex items-center gap-2">🎁 Signup & Referral Bonuses</CardTitle>
              <CardDescription>Configure PKR bonus rewards for new signups and referral links. Bonuses are play-only credits.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Bonus Edit Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Signup Bonus Card */}
                <div className="p-4 bg-card/60 rounded-xl border border-purple-500/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-purple-300">🎁 New Signup Bonus</div>
                      <div className="text-2xl font-black text-purple-400">PKR {signupBonus.toLocaleString()}</div>
                    </div>
                    <span className="text-3xl">🎉</span>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Signup Bonus Amount (PKR)</label>
                    <input
                      type="number"
                      min="0"
                      step="500"
                      value={signupBonusInput}
                      onChange={e => setSignupBonusInput(e.target.value)}
                      placeholder="e.g. 50000"
                      className="w-full px-3 py-2 text-base font-mono rounded-lg bg-background border border-purple-500/30 text-foreground focus:outline-none focus:border-purple-500/70"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[0, 1000, 5000, 10000, 50000].map(preset => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setSignupBonusInput(String(preset))}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                          signupBonusInput === String(preset)
                            ? "bg-purple-600 border-purple-500 text-white"
                            : "border-border/50 bg-card/40 hover:border-purple-500/50"
                        }`}
                      >
                        {preset === 0 ? "Off" : `${preset.toLocaleString()}`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Referral Bonus Card */}
                <div className="p-4 bg-card/60 rounded-xl border border-emerald-500/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-emerald-300">👥 Referral Reward Bonus</div>
                      <div className="text-2xl font-black text-emerald-400">PKR {referralBonus.toLocaleString()}</div>
                    </div>
                    <span className="text-3xl">🤝</span>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Referral Reward per User (PKR)</label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={referralBonusInput}
                      onChange={e => setReferralBonusInput(e.target.value)}
                      placeholder="e.g. 500"
                      className="w-full px-3 py-2 text-base font-mono rounded-lg bg-background border border-emerald-500/30 text-foreground focus:outline-none focus:border-emerald-500/70"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[0, 200, 500, 1000, 2000].map(preset => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setReferralBonusInput(String(preset))}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                          referralBonusInput === String(preset)
                            ? "bg-emerald-600 border-emerald-500 text-white"
                            : "border-border/50 bg-card/40 hover:border-emerald-500/50"
                        }`}
                      >
                        {preset === 0 ? "Off" : `${preset.toLocaleString()}`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <Button
                onClick={saveBonuses}
                disabled={signupBonusSaving}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-emerald-600 hover:from-purple-700 hover:to-emerald-700 text-white font-bold text-base shadow-lg shadow-purple-900/30"
              >
                {signupBonusSaving ? "Saving..." : "💾 Save Both Bonus Settings"}
              </Button>

              <div className="p-3 bg-card/30 rounded-lg border border-border/30 text-xs text-muted-foreground space-y-1">
                <p>💡 <strong>How Bonuses Work & Non-Withdrawable Rule:</strong></p>
                <p>• All signup and referral bonuses are automatically credited as <strong>Play-Only Credit</strong>.</p>
                <p>• Users <strong>CANNOT withdraw bonus funds directly</strong>. They must play sports bets or casino games — all winnings earned from bets become 100% real withdrawable cash!</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── GAME CONTROLS TAB ─── */}
        <TabsContent value="gamecontrols" className="space-y-6">

          {/* ─── SPORTS MATCHES CONTROL SECTION ─── */}
          <Card className="border-emerald-500/30 bg-emerald-950/20">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-emerald-400">
                  <Trophy className="h-5 w-5 text-yellow-400" />
                  ⚽ Sports Center Live Control
                </CardTitle>
                <CardDescription>
                  Manage odds, live status, and settle match outcomes for Sports bets
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {!events || events.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  No sports matches created yet. Use "Create Event" tab to add matches.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-3">
                    {events?.slice(0, 8).map(event => (
                      <div key={event.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-card/40 border border-border/40 gap-2">
                        <div>
                          <div className="font-bold text-sm flex items-center gap-2">
                            <span>{event.homeTeam} vs {event.awayTeam}</span>
                            <Badge variant={event.status === "finished" ? "destructive" : event.status === "live" ? "default" : "outline"} className="text-[10px]">
                              {event.status.toUpperCase()}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5 font-mono">
                            {event.sport} · Odds: <span className="text-emerald-400 font-bold">{event.oddsHome.toFixed(2)}</span> / <span className="text-yellow-400 font-bold">{event.oddsDraw.toFixed(2)}</span> / <span className="text-blue-400 font-bold">{event.oddsAway.toFixed(2)}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs gap-1"
                            onClick={() => openEditOdds(event)}
                          >
                            <Pencil className="h-3 w-3" /> Edit Odds
                          </Button>
                          {event.status !== "finished" && (
                            <Button
                              variant="destructive"
                              size="sm"
                              className="h-8 text-xs gap-1"
                              onClick={() => {
                                setSelectedEventId(event.id);
                                setSettleDialogOpen(true);
                              }}
                            >
                              <Flag className="h-3 w-3" /> Settle Match
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* LIVE ROUND CONTROL — every casino game is round-based: bets queue, admin picks the result */}
          {(() => {
            const GAME_CONFIGS: { game: string; title: string; sides: { key: string; label: string; color: string; text: string }[] }[] = [
              { game: "dragon-tiger", title: "🐲 Dragon Tiger", sides: [
                { key: "dragon", label: "🐲 Dragon", color: "bg-red-600 hover:bg-red-700", text: "text-red-300" },
                { key: "tiger",  label: "🐯 Tiger",  color: "bg-orange-500 hover:bg-orange-600", text: "text-orange-300" },
                { key: "tie",    label: "🤝 Tie",    color: "bg-yellow-600 hover:bg-yellow-700", text: "text-yellow-300" },
              ]},
              { game: "coin-flip", title: "🪙 Coin Flip", sides: [
                { key: "heads", label: "Heads", color: "bg-amber-500 hover:bg-amber-600", text: "text-amber-300" },
                { key: "tails", label: "Tails", color: "bg-slate-500 hover:bg-slate-600", text: "text-slate-300" },
              ]},
              { game: "dice-roll", title: "🎲 Dice Roll", sides: [
                { key: "low",   label: "Low (2-6)",  color: "bg-blue-600 hover:bg-blue-700", text: "text-blue-300" },
                { key: "seven", label: "Seven (7) 5x", color: "bg-purple-600 hover:bg-purple-700", text: "text-purple-300" },
                { key: "high",  label: "High (8-12)", color: "bg-pink-600 hover:bg-pink-700", text: "text-pink-300" },
              ]},
              { game: "rang", title: "♠ Rung", sides: [
                { key: "player", label: "Player", color: "bg-emerald-600 hover:bg-emerald-700", text: "text-emerald-300" },
                { key: "house",  label: "House",  color: "bg-red-600 hover:bg-red-700", text: "text-red-300" },
              ]},
              { game: "court-piece", title: "♣ Court Piece", sides: [
                { key: "player", label: "Player", color: "bg-emerald-600 hover:bg-emerald-700", text: "text-emerald-300" },
                { key: "house",  label: "House",  color: "bg-red-600 hover:bg-red-700", text: "text-red-300" },
              ]},
              { game: "andar-bahar", title: "🃏 Andar Bahar", sides: [
                { key: "andar", label: "⬅ Andar", color: "bg-blue-600 hover:bg-blue-700", text: "text-blue-300" },
                { key: "bahar", label: "➡ Bahar", color: "bg-red-600 hover:bg-red-700", text: "text-red-300" },
              ]},
              { game: "roulette", title: "🎡 Roulette", sides: [
                { key: "red",   label: "🔴 Red",   color: "bg-red-600 hover:bg-red-700", text: "text-red-300" },
                { key: "black", label: "⚫ Black", color: "bg-slate-600 hover:bg-slate-700", text: "text-slate-300" },
                { key: "green", label: "🟢 Green 14×", color: "bg-green-600 hover:bg-green-700", text: "text-green-300" },
              ]},
              { game: "bingo-777", title: "🎰 777 Bingo", sides: [
                { key: "triple7", label: "7️⃣ Triple 7 (20×)", color: "bg-yellow-500 hover:bg-yellow-600", text: "text-yellow-300" },
                { key: "bar",     label: "🟥 BAR (5×)",       color: "bg-purple-600 hover:bg-purple-700", text: "text-purple-300" },
                { key: "cherry",  label: "🍒 Cherry (2×)",    color: "bg-red-600 hover:bg-red-700", text: "text-red-300" },
              ]},
              { game: "fruit-line", title: "🍉 Fruit Line", sides: [
                { key: "jackpot", label: "🍇 Jackpot (10×)", color: "bg-yellow-500 hover:bg-yellow-600", text: "text-yellow-300" },
                { key: "mix",     label: "🍉 Mix Win (3×)",  color: "bg-green-600 hover:bg-green-700", text: "text-green-300" },
                { key: "plain",   label: "🍋 Single (1.95×)",color: "bg-blue-600 hover:bg-blue-700", text: "text-blue-300" },
              ]},
              { game: "sweet-bonanza", title: "🍭 Sweet Bonanza", sides: [
                { key: "bonanza", label: "🍭 Bonanza (8×)",  color: "bg-pink-600 hover:bg-pink-700", text: "text-pink-300" },
                { key: "scatter", label: "⭐ Scatter (3×)",  color: "bg-orange-500 hover:bg-orange-600", text: "text-orange-300" },
                { key: "base",    label: "🍬 Base (1.95×)",  color: "bg-blue-600 hover:bg-blue-700", text: "text-blue-300" },
              ]},
              { game: "crash", title: "✈️ Aviator", sides: [
                { key: "x2",  label: "💚 Cash at 2×",  color: "bg-green-600 hover:bg-green-700", text: "text-green-300" },
                { key: "x5",  label: "🧡 Cash at 5×",  color: "bg-orange-500 hover:bg-orange-600", text: "text-orange-300" },
                { key: "x10", label: "🔴 Cash at 10×", color: "bg-red-600 hover:bg-red-700", text: "text-red-300" },
              ]},
              { game: "joker", title: "🃏 Joker", sides: [
                { key: "player", label: "👤 Player",      color: "bg-blue-600 hover:bg-blue-700", text: "text-blue-300" },
                { key: "banker", label: "🏦 Banker",      color: "bg-red-600 hover:bg-red-700", text: "text-red-300" },
                { key: "joker",  label: "🤡 Joker (9×)", color: "bg-yellow-500 hover:bg-yellow-600", text: "text-yellow-300" },
              ]},
              { game: "ten-cards", title: "🔟 10 Cards", sides: [
                { key: "player", label: "👤 Player", color: "bg-blue-600 hover:bg-blue-700", text: "text-blue-300" },
                { key: "banker", label: "🏦 Banker", color: "bg-red-600 hover:bg-red-700", text: "text-red-300" },
              ]},
              { game: "muflis", title: "♟️ Muflis", sides: [
                { key: "player", label: "👤 Player", color: "bg-blue-600 hover:bg-blue-700", text: "text-blue-300" },
                { key: "banker", label: "🏦 Banker", color: "bg-red-600 hover:bg-red-700", text: "text-red-300" },
              ]},
              { game: "blackjack", title: "♠️ Blackjack", sides: [
                { key: "player", label: "🤚 Player",     color: "bg-green-600 hover:bg-green-700", text: "text-green-300" },
                { key: "dealer", label: "🏠 Dealer",     color: "bg-red-600 hover:bg-red-700", text: "text-red-300" },
                { key: "tie",    label: "🤝 Tie (8×)",   color: "bg-yellow-500 hover:bg-yellow-600", text: "text-yellow-300" },
              ]},
              { game: "car-roulette", title: "🏎️ Car Roulette", sides: [
                { key: "car1", label: "🔴 Car 1",      color: "bg-red-600 hover:bg-red-700", text: "text-red-300" },
                { key: "car2", label: "🔵 Car 2",      color: "bg-blue-600 hover:bg-blue-700", text: "text-blue-300" },
                { key: "car3", label: "🟡 Car 3 (5×)", color: "bg-yellow-500 hover:bg-yellow-600", text: "text-yellow-300" },
              ]},
              { game: "god-of-fortune", title: "🐉 God of Fortune", sides: [
                { key: "fortune", label: "🍀 Fortune",        color: "bg-green-600 hover:bg-green-700", text: "text-green-300" },
                { key: "grand",   label: "🔥 Grand (5×)",     color: "bg-orange-500 hover:bg-orange-600", text: "text-orange-300" },
                { key: "supreme", label: "👑 Supreme (10×)",  color: "bg-yellow-500 hover:bg-yellow-600", text: "text-yellow-300" },
              ]},
              { game: "rummy", title: "🀄 Rummy", sides: [
                { key: "player", label: "👤 Player", color: "bg-green-600 hover:bg-green-700", text: "text-green-300" },
                { key: "house",  label: "🏠 House",  color: "bg-red-600 hover:bg-red-700", text: "text-red-300" },
              ]},
              { game: "teen-patti", title: "🃏 Teen Patti (3 Patti)", sides: [
                { key: "player", label: "👤 Player",       color: "bg-blue-600 hover:bg-blue-700", text: "text-blue-300" },
                { key: "banker", label: "🏦 Banker",       color: "bg-red-600 hover:bg-red-700", text: "text-red-300" },
                { key: "pair",   label: "👯 Pair (11×)",   color: "bg-yellow-500 hover:bg-yellow-600", text: "text-yellow-300" },
              ]},
              { game: "lucky-7", title: "🎰 Lucky 7", sides: [
                { key: "under7", label: "⬇ Under 7 (1.95×)", color: "bg-blue-600 hover:bg-blue-700", text: "text-blue-300" },
                { key: "seven",  label: "7️⃣ Seven (5×)",      color: "bg-yellow-500 hover:bg-yellow-600", text: "text-yellow-300" },
                { key: "over7",  label: "⬆ Over 7 (1.95×)",  color: "bg-pink-600 hover:bg-pink-700", text: "text-pink-300" },
              ]},
              { game: "jhandi-munda", title: "🎲 Jhandi Munda", sides: [
                { key: "spade",   label: "♠ Spade",   color: "bg-slate-600 hover:bg-slate-700", text: "text-slate-300" },
                { key: "heart",   label: "♥ Heart",   color: "bg-red-600 hover:bg-red-700", text: "text-red-300" },
                { key: "diamond", label: "♦ Diamond", color: "bg-blue-600 hover:bg-blue-700", text: "text-blue-300" },
                { key: "club",    label: "♣ Club",    color: "bg-green-600 hover:bg-green-700", text: "text-green-300" },
                { key: "star",    label: "⭐ Star",   color: "bg-yellow-500 hover:bg-yellow-600", text: "text-yellow-300" },
                { key: "moon",    label: "🌙 Moon",   color: "bg-purple-600 hover:bg-purple-700", text: "text-purple-300" },
              ]},
            ];
            return (
              <Card className="border-emerald-500/40 bg-emerald-500/5">
                <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
                  <div className="w-full space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <CardTitle className="text-emerald-300 flex items-center gap-2">🟢 Live Rounds — Settlement Control</CardTitle>
                      <Button variant="outline" size="sm" onClick={loadLiveRounds}>🔄 Refresh</Button>
                    </div>

                    {/* ── BIG ON/OFF TOGGLE ── */}
                    <div className={`rounded-xl p-4 border-2 transition-all duration-300 ${autoMode ? "border-purple-500/60 bg-purple-950/40" : "border-border/40 bg-card/20"}`}>
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-3">
                          {/* Traffic-light style indicator */}
                          <div className={`w-14 h-8 rounded-full relative cursor-pointer transition-all duration-300 flex-shrink-0 ${autoMode ? "bg-purple-600" : "bg-zinc-600"}`}
                            onClick={() => !autoModeLoading && toggleAutoMode(!autoMode)}>
                            <div className={`absolute top-1 w-6 h-6 rounded-full shadow-md transition-all duration-300 ${autoMode ? "left-7 bg-white" : "left-1 bg-zinc-300"}`} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`font-black text-lg ${autoMode ? "text-purple-300" : "text-muted-foreground"}`}>
                                {autoMode ? "🤖 AUTO MODE" : "✋ MANUAL MODE"}
                              </span>
                              {autoMode && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-500/25 text-purple-300 animate-pulse">● ACTIVE</span>}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {autoMode
                                ? `House auto-wins every ${autoInterval}s — fewest-bet option wins automatically`
                                : "You manually choose who wins each round"}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Interval picker — only shown when auto mode off (to configure before turning on) */}
                          {!autoMode && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-muted-foreground">Every</span>
                              <select
                                value={autoInterval}
                                onChange={e => setAutoInterval(Number(e.target.value))}
                                className="bg-card/60 border border-border/50 rounded-md px-2 py-1 text-xs text-white"
                              >
                                {[3,5,10,15,20,30,45,60,90,120].map(s => (
                                  <option key={s} value={s}>{s}s</option>
                                ))}
                              </select>
                            </div>
                          )}
                          <Button
                            size="sm"
                            disabled={autoModeLoading}
                            onClick={() => toggleAutoMode(!autoMode)}
                            className={`font-black px-5 ${autoMode
                              ? "bg-zinc-700 hover:bg-zinc-600 text-white"
                              : "bg-purple-600 hover:bg-purple-700 text-white"}`}
                          >
                            {autoModeLoading ? "..." : autoMode ? "Turn OFF" : "Turn ON"}
                          </Button>
                        </div>
                      </div>

                      {/* Auto mode description strip */}
                      {autoMode && (
                        <div className="mt-3 pt-3 border-t border-purple-500/20 flex items-center justify-between gap-2 flex-wrap">
                          <div className="text-xs text-purple-300/70">
                            Auto-picks the option with <strong className="text-purple-200">fewest bets</strong> every <strong className="text-purple-200">{autoInterval}s</strong>. If 3 bet Tiger and 0 bet Tie → <strong className="text-purple-200">Tie wins</strong>. Manual buttons are disabled.
                          </div>
                          <Button
                            size="sm" variant="outline"
                            onClick={autoSettleAll}
                            disabled={!!autoSettling}
                            className="text-[11px] border-purple-500/40 text-purple-300 hover:bg-purple-900/40"
                          >
                            {autoSettling === "ALL" ? "⏳..." : "⚡ Run Now"}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  {GAME_CONFIGS.map(cfg => {
                    const round = liveRounds.find(r => r.game === cfg.game);
                    const sideMap: Record<string, LiveRoundSide> = {};
                    (round?.sides ?? []).forEach(s => { sideMap[s.selection] = s; });
                    const totalBets = round?.totalBets ?? 0;
                    const isAutoSettlingThis = autoSettling === cfg.game;
                    const lastAuto = lastAutoResult[cfg.game];

                    // Prediction for auto-mode display (mirrors backend logic)
                    const aCounts: Record<string, number> = {};
                    const aStaked: Record<string, number> = {};
                    for (const s of cfg.sides) { aCounts[s.key] = sideMap[s.key]?.betCount ?? 0; aStaked[s.key] = sideMap[s.key]?.totalStaked ?? 0; }
                    const aMinCount = Math.min(...cfg.sides.map(s => aCounts[s.key]));
                    const aCandidates = cfg.sides.filter(s => aCounts[s.key] === aMinCount);
                    const aMinStaked = Math.min(...aCandidates.map(s => aStaked[s.key]));
                    const aFinal = aCandidates.filter(s => aStaked[s.key] === aMinStaked);
                    // For display: show exactly ONE green winner (first in tied list)
                    const aDisplayWinner = aFinal[0];
                    const isTied = aFinal.length > 1;
                    const aWillLose = cfg.sides.filter(s => s.key !== aDisplayWinner?.key);
                    const aLostPool = aWillLose.reduce((a, s) => a + aStaked[s.key], 0);
                    const aWinLabel = aDisplayWinner?.label.replace(/[^\w\s]/g,'').trim() ?? "";
                    const aAllTiedLabels = aFinal.map(s => s.label.replace(/[^\w\s]/g,'').trim()).join(" or ");
                    const aReason = totalBets === 0
                      ? "No bets yet — auto-settle will skip this round"
                      : isTied && aMinCount === 0
                        ? `${aAllTiedLabels} are tied at 0 bets — system randomly picks one → all ${aWillLose.filter(s => aCounts[s.key] > 0).map(s=>s.label.replace(/[^\w\s]/g,'').trim()).join(" + ")} bettors LOSE → Admin keeps PKR ${aLostPool.toFixed(0)}`
                        : aMinCount === 0
                          ? `${aWinLabel} has 0 bets → declared winner → all other bettors lose → Admin keeps PKR ${aLostPool.toFixed(0)}`
                          : isTied
                            ? `All options tied at ${aMinCount} bet(s) — randomly picks one to win`
                            : `${aWinLabel} has fewest bets (${aMinCount}) → Admin keeps PKR ${aLostPool.toFixed(0)} from ${aWillLose.filter(s=>aCounts[s.key]>0).length} losing side(s)`;

                    return (
                      <div key={cfg.game} className={`border rounded-xl p-3 transition-all duration-200 ${autoMode ? "border-purple-500/20 bg-purple-950/10" : "border-border/40 bg-card/20"}`}>
                        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                          <div className="font-bold text-base">{cfg.title}</div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="text-xs text-muted-foreground">
                              <span className="font-mono">{round?.id?.slice(-6) ?? "—"}</span> · <span className={totalBets > 0 ? "text-emerald-400 font-bold" : ""}>{totalBets} bet{totalBets === 1 ? "" : "s"}</span>
                            </div>
                            {/* Per-game auto button — hidden when global auto mode is ON */}
                            {!autoMode && (
                              <Button
                                size="sm"
                                onClick={() => autoSettleRound(cfg.game)}
                                disabled={!!settling || !!autoSettling}
                                className="h-6 px-2 text-[11px] bg-purple-600/25 border border-purple-500/40 text-purple-300 hover:bg-purple-600/40"
                                variant="outline"
                              >
                                {isAutoSettlingThis ? "⏳..." : "🤖 Auto"}
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Last result — large prominent win/loss display */}
                        {lastAuto && (
                          <div className="mb-3 rounded-xl overflow-hidden border border-border/40 shadow-lg">
                            <div className="px-3 py-2 bg-black/40 flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-black text-white/50 mr-1">🎯 LAST RESULT:</span>
                              {cfg.sides.map(s => (
                                <span key={s.key} className={`px-2.5 py-1 rounded-lg text-xs font-black tracking-wide ${
                                  s.key === lastAuto.result
                                    ? "bg-emerald-500 text-white shadow-md shadow-emerald-900/60 scale-110 ring-2 ring-emerald-400/50"
                                    : "bg-red-900/70 text-red-300 line-through opacity-50"
                                }`}>
                                  {s.key === lastAuto.result ? "✅ WON" : "❌"} {s.label}
                                </span>
                              ))}
                            </div>
                            <div className="px-3 py-1.5 text-[11px] text-muted-foreground/70 italic bg-black/20">{lastAuto.reason}</div>
                          </div>
                        )}

                        {/* ── AUTO MODE ON: prediction view ── */}
                        {autoMode ? (
                          <div>
                            {/* Prediction banner */}
                            {totalBets > 0 ? (
                              <div className="mb-3 rounded-xl overflow-hidden border border-emerald-500/50 shadow-lg shadow-emerald-900/20">
                                {/* Green header: this WINS */}
                                <div className="bg-emerald-600/30 border-b border-emerald-500/30 px-3 py-2 flex items-center justify-between flex-wrap gap-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-300">🤖 AUTO PICK — WINS:</span>
                                    {aDisplayWinner && (
                                      <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-500 text-white shadow">
                                        ✅ {aDisplayWinner.label}
                                      </span>
                                    )}
                                    {isTied && <span className="text-[10px] text-yellow-400/80 font-bold">(tied — random pick)</span>}
                                  </div>
                                  {aLostPool > 0 && (
                                    <span className="text-[11px] font-black text-emerald-300 bg-emerald-900/50 px-2 py-0.5 rounded-full">
                                      💰 Admin Profit: PKR {aLostPool.toFixed(0)}
                                    </span>
                                  )}
                                </div>
                                <div className="px-3 py-1.5 bg-black/20 text-[11px] text-emerald-400/70 leading-relaxed">{aReason}</div>
                              </div>
                            ) : (
                              <div className="mb-3 rounded-lg px-3 py-2 border border-purple-500/20 text-[11px] text-purple-400/50 italic text-center">
                                No bets yet — waiting for players. Auto-settle will skip empty rounds.
                              </div>
                            )}

                            {/* Bet grid */}
                            <div className={`grid gap-2 ${cfg.sides.length >= 6 ? "grid-cols-3" : cfg.sides.length === 2 ? "grid-cols-2" : "grid-cols-1 md:grid-cols-3"}`}>
                              {cfg.sides.map(s => {
                                const count = aCounts[s.key];
                                const sk = aStaked[s.key];
                                const totalStakedAll = round?.totalStaked ?? 0;
                                const pct = totalStakedAll > 0 ? Math.round((sk / totalStakedAll) * 100) : 0;
                                const isWinner = s.key === aDisplayWinner?.key && totalBets > 0;
                                const isLoser = !isWinner && totalBets > 0 && count > 0;
                                return (
                                  <div key={s.key} className={`border rounded-lg p-2 transition-all ${
                                    isWinner
                                      ? "border-emerald-400/70 bg-emerald-950/50 ring-2 ring-emerald-500/40 shadow-md shadow-emerald-900/30"
                                      : isLoser
                                        ? "border-red-500/50 bg-red-950/30 ring-1 ring-red-500/20"
                                        : "border-border/20 bg-card/20"
                                  }`}>
                                    <div className="flex items-center justify-between mb-1">
                                      <div className={`font-bold text-sm ${isWinner ? "text-emerald-300" : isLoser ? "text-red-300" : s.text}`}>{s.label}</div>
                                      <div className="flex items-center gap-1">
                                        <span className={`text-[11px] tabular-nums font-bold ${isLoser ? "text-red-400/70" : ""}`}>{count}</span>
                                        {isWinner && <span className="text-[9px] bg-emerald-500 text-white px-1.5 py-0.5 rounded font-black tracking-wide">✅ WINS</span>}
                                        {isLoser  && <span className="text-[9px] bg-red-700 text-red-200 px-1.5 py-0.5 rounded font-black tracking-wide">❌ LOSES</span>}
                                      </div>
                                    </div>
                                    {count > 0 && (
                                      <>
                                        <div className={`text-[10px] mb-1 ${isLoser ? "text-red-400/60" : "text-muted-foreground"}`}>PKR {sk.toFixed(0)} · {pct}%</div>
                                        <div className="h-1.5 rounded-full bg-border/40">
                                          <div className={`h-full rounded-full ${isWinner ? "bg-emerald-400" : "bg-red-500/60"}`} style={{ width: `${pct}%` }} />
                                        </div>
                                      </>
                                    )}
                                    {count === 0 && totalBets > 0 && isWinner && (
                                      <div className="text-[10px] text-emerald-400/80 mt-1 font-semibold">0 bets → auto picks this → WINS</div>
                                    )}
                                    {sideMap[s.key]?.users && sideMap[s.key]!.users.length > 0 && (
                                      <div className="text-[10px] text-muted-foreground mt-1 max-h-10 overflow-y-auto">
                                        {sideMap[s.key]!.users.map((u, i) => (
                                          <div key={i} className="flex justify-between gap-1 truncate">
                                            <span className={`truncate ${isLoser ? "line-through opacity-40 text-red-400/60" : ""}`}>{u.username}</span>
                                            <span className={`tabular-nums ${isLoser ? "text-red-400/50" : ""}`}>PKR {u.stake}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          /* ── MANUAL MODE: full settle buttons ── */
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">✋ Click to settle manually:</div>
                            <div className={`grid gap-2 ${cfg.sides.length >= 6 ? "grid-cols-3" : cfg.sides.length === 2 ? "grid-cols-2" : "grid-cols-1 md:grid-cols-3"}`}>
                              {cfg.sides.map(s => {
                                const data = sideMap[s.key];
                                const count = data?.betCount ?? 0;
                                const staked = data?.totalStaked ?? 0;
                                const isSettling = settling === `${cfg.game}:${s.key}`;
                                const totalStakedAll = round?.totalStaked ?? 0;
                                const pct = totalStakedAll > 0 ? Math.round((staked / totalStakedAll) * 100) : 0;
                                return (
                                  <div key={s.key} className="border rounded-lg p-2 bg-card/40 border-border/30">
                                    <div className="flex items-baseline justify-between mb-1">
                                      <div className={`font-semibold text-sm ${s.text}`}>{s.label}</div>
                                      <div className="text-[11px] tabular-nums font-bold">{count} bets</div>
                                    </div>
                                    {count > 0 && (
                                      <>
                                        <div className="text-[10px] text-muted-foreground mb-1">PKR {staked.toFixed(0)} · {pct}% of pool</div>
                                        <div className="h-1 rounded-full mb-1.5 bg-border/40">
                                          <div className="h-full rounded-full bg-emerald-400/60" style={{ width: `${pct}%` }} />
                                        </div>
                                      </>
                                    )}
                                    {data?.users && data.users.length > 0 && (
                                      <div className="text-[10px] text-muted-foreground mb-2 max-h-12 overflow-y-auto">
                                        {data.users.map((u, i) => (
                                          <div key={i} className="flex justify-between gap-1 truncate">
                                            <span className="truncate">{u.username}</span>
                                            <span className="tabular-nums">PKR {u.stake}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    <Button
                                      size="sm"
                                      onClick={() => settleRound(cfg.game, s.key)}
                                      disabled={!!settling || !!autoSettling}
                                      className={`w-full text-white text-xs h-7 ${s.color}`}
                                    >
                                      {isSettling ? "Settling..." : `✅ ${s.label} Wins`}
                                    </Button>
                                  </div>
                                );
                              })}
                            </div>
                            {totalBets === 0 && <div className="text-[11px] text-muted-foreground mt-2 text-center italic">No bets yet. Settle anyway or wait for players.</div>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })()}

          <Card className="border-cyan-500/30 bg-cyan-500/5">
            <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
              <div>
                <CardTitle className="text-cyan-400 flex items-center gap-2">
                  📊 Live Casino Bets — Per Side
                </CardTitle>
                <CardDescription>
                  Counts of recent bets per side per game. Use this to decide which side to force in the override panel below (e.g. if 3 users bet on Tiger and you want them to lose, set Dragon Tiger override to <strong>Dragon</strong>).
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={casinoStatsWindow}
                  onChange={(e) => { const m = Number(e.target.value); setCasinoStatsWindow(m); loadCasinoStats(m); }}
                  className="bg-card/50 border border-border/50 rounded-md px-2 py-1 text-xs"
                >
                  <option value={5}>Last 5 min</option>
                  <option value={15}>Last 15 min</option>
                  <option value={60}>Last 1 hour</option>
                  <option value={360}>Last 6 hours</option>
                  <option value={1440}>Last 24 hours</option>
                </select>
                <Button variant="outline" size="sm" onClick={() => loadCasinoStats()} disabled={casinoStatsLoading}>
                  {casinoStatsLoading ? "Loading..." : "Refresh"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {casinoStats.length === 0 ? (
                <div className="text-sm text-muted-foreground bg-card/30 rounded-lg p-4 border border-border/30 text-center">
                  No casino bets in the selected window. Have a user place a bet on Dragon Tiger / Coin Flip / etc and refresh.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {casinoStats.map((g) => {
                    const topSide = g.sides[0];
                    return (
                      <div key={g.key} className="border border-border/40 bg-card/30 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-bold text-sm">{g.game}</div>
                          <div className="text-xs text-muted-foreground">{g.totalBets} bets</div>
                        </div>
                        <div className="space-y-1.5">
                          {g.sides.map((s) => {
                            const isLeader = s.selection === topSide?.selection;
                            const pct = g.totalBets > 0 ? Math.round((s.betCount / g.totalBets) * 100) : 0;
                            return (
                              <div key={s.selection} className="text-xs">
                                <div className="flex items-center justify-between mb-0.5">
                                  <span className={`font-semibold ${isLeader ? "text-cyan-300" : "text-muted-foreground"}`}>
                                    {s.selection.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
                                  </span>
                                  <span className="tabular-nums">
                                    <span className="font-bold text-foreground">{s.betCount}</span>
                                    <span className="text-muted-foreground"> bets · PKR {s.totalStaked.toFixed(2)} staked</span>
                                  </span>
                                </div>
                                <div className="h-1.5 bg-card/60 rounded-full overflow-hidden">
                                  <div className={`h-full ${isLeader ? "bg-cyan-400" : "bg-cyan-500/40"}`} style={{ width: `${pct}%` }} />
                                </div>
                                {s.users.length > 0 && (
                                  <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                                    {s.users.slice(0, 5).map((u) => u.username).join(", ")}{s.users.length > 5 ? "…" : ""}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {g.override && (
                          <div className="text-[11px] text-orange-400 mt-2">⚡ Override active: <strong>{g.override.toUpperCase()}</strong></div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="text-[11px] text-muted-foreground mt-3">
                Note: Casino games settle instantly — these are recent bets, not pending. Stake totals are approximate (only losing bets contribute exact stake).
              </div>
            </CardContent>
          </Card>

          <Card className="border-orange-500/30 bg-orange-500/5">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-orange-400 flex items-center gap-2">
                  🎮 Casino Game Controls
                </CardTitle>
                <CardDescription>
                  Force a specific result for any casino game. Users will always get the result you set — select <strong>Random</strong> to go back to fair play.
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={loadGameOverrides} disabled={gameOverridesLoading}>
                {gameOverridesLoading ? "Loading..." : "Refresh"}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                {[
                  {
                    game: "teen-patti", label: "👑 Teen Patti",
                    options: [
                      { value: "player", label: "👤 Player Wins", color: "bg-green-600 hover:bg-green-700 text-white" },
                      { value: "house",  label: "🏠 House (Admin) Wins", color: "bg-red-600 hover:bg-red-700 text-white" },
                      { value: "trail",  label: "🔥 Trio / Trail 100×", color: "bg-amber-500 hover:bg-amber-600 text-white" },
                    ],
                  },
                  {
                    game: "lucky-7", label: "7️⃣ Lucky 7",
                    options: [
                      { value: "low",   label: "⬇ 7 Down (1-6)", color: "bg-blue-600 hover:bg-blue-700 text-white" },
                      { value: "seven", label: "7️⃣ Seven 7×",     color: "bg-amber-500 hover:bg-amber-600 text-white" },
                      { value: "high",  label: "⬆ 7 Up (8-12)", color: "bg-red-600 hover:bg-red-700 text-white" },
                    ],
                  },
                  {
                    game: "jhandi-munda", label: "🚩 Jhandi Munda",
                    options: [
                      { value: "flag",  label: "🚩 Flag",  color: "bg-red-600 hover:bg-red-700 text-white" },
                      { value: "crown", label: "👑 Crown", color: "bg-yellow-500 hover:bg-yellow-600 text-white" },
                      { value: "spade", label: "♠️ Spade", color: "bg-gray-700 hover:bg-gray-800 text-white" },
                    ],
                  },
                  {
                    game: "dragon-tiger", label: "🐲 Dragon Tiger",
                    options: [
                      { value: "dragon", label: "🐲 Dragon", color: "bg-red-600 hover:bg-red-700 text-white" },
                      { value: "tiger",  label: "🐯 Tiger",  color: "bg-orange-500 hover:bg-orange-600 text-white" },
                      { value: "tie",    label: "🤝 Tie",    color: "bg-yellow-600 hover:bg-yellow-700 text-white" },
                    ],
                  },
                  {
                    game: "coin-flip", label: "🪙 Coin Flip",
                    options: [
                      { value: "heads", label: "🟡 Heads", color: "bg-yellow-500 hover:bg-yellow-600 text-white" },
                      { value: "tails", label: "⚫ Tails", color: "bg-gray-600 hover:bg-gray-700 text-white" },
                    ],
                  },
                  {
                    game: "dice-roll", label: "🎲 Dice Roll",
                    options: [
                      { value: "low",   label: "⬇ Low",  color: "bg-blue-600 hover:bg-blue-700 text-white" },
                      { value: "high",  label: "⬆ High", color: "bg-red-600 hover:bg-red-700 text-white" },
                      { value: "seven", label: "7️⃣ Seven", color: "bg-purple-600 hover:bg-purple-700 text-white" },
                    ],
                  },
                  {
                    game: "rang", label: "🃏 Rung (Trump)",
                    options: [
                      { value: "player", label: "🤲 Player Wins", color: "bg-green-600 hover:bg-green-700 text-white" },
                      { value: "house",  label: "🏠 House Wins",  color: "bg-red-600 hover:bg-red-700 text-white" },
                    ],
                  },
                  {
                    game: "court-piece", label: "♛ Court Piece",
                    options: [
                      { value: "player", label: "🤲 Player Wins", color: "bg-green-600 hover:bg-green-700 text-white" },
                      { value: "house",  label: "🏠 House Wins",  color: "bg-red-600 hover:bg-red-700 text-white" },
                    ],
                  },
                  {
                    game: "andar-bahar", label: "🃏 Andar Bahar",
                    options: [
                      { value: "andar", label: "⬅ Andar", color: "bg-blue-600 hover:bg-blue-700 text-white" },
                      { value: "bahar", label: "➡ Bahar", color: "bg-red-600 hover:bg-red-700 text-white" },
                    ],
                  },
                  {
                    game: "roulette", label: "🎡 Roulette",
                    options: [
                      { value: "red",   label: "🔴 Red",      color: "bg-red-600 hover:bg-red-700 text-white" },
                      { value: "black", label: "⚫ Black",    color: "bg-slate-600 hover:bg-slate-700 text-white" },
                      { value: "green", label: "🟢 Green 14×",color: "bg-green-600 hover:bg-green-700 text-white" },
                    ],
                  },
                  {
                    game: "bingo-777", label: "🎰 777 Bingo",
                    options: [
                      { value: "triple7", label: "7️⃣ Triple 7", color: "bg-yellow-500 hover:bg-yellow-600 text-white" },
                      { value: "bar",     label: "🟥 BAR",      color: "bg-purple-600 hover:bg-purple-700 text-white" },
                      { value: "cherry",  label: "🍒 Cherry",   color: "bg-red-600 hover:bg-red-700 text-white" },
                    ],
                  },
                  {
                    game: "fruit-line", label: "🍉 Fruit Line",
                    options: [
                      { value: "jackpot", label: "🍇 Jackpot", color: "bg-yellow-500 hover:bg-yellow-600 text-white" },
                      { value: "mix",     label: "🍉 Mix Win", color: "bg-green-600 hover:bg-green-700 text-white" },
                      { value: "plain",   label: "🍋 Single",  color: "bg-blue-600 hover:bg-blue-700 text-white" },
                    ],
                  },
                  {
                    game: "sweet-bonanza", label: "🍭 Sweet Bonanza",
                    options: [
                      { value: "bonanza", label: "🍭 Bonanza", color: "bg-pink-600 hover:bg-pink-700 text-white" },
                      { value: "scatter", label: "⭐ Scatter", color: "bg-orange-500 hover:bg-orange-600 text-white" },
                      { value: "base",    label: "🍬 Base",    color: "bg-blue-600 hover:bg-blue-700 text-white" },
                    ],
                  },
                  {
                    game: "crash", label: "✈️ Aviator",
                    options: [
                      { value: "x2",  label: "💚 2×",  color: "bg-green-600 hover:bg-green-700 text-white" },
                      { value: "x5",  label: "🧡 5×",  color: "bg-orange-500 hover:bg-orange-600 text-white" },
                      { value: "x10", label: "🔴 10×", color: "bg-red-600 hover:bg-red-700 text-white" },
                    ],
                  },
                  {
                    game: "joker", label: "🃏 Joker",
                    options: [
                      { value: "player", label: "👤 Player",   color: "bg-blue-600 hover:bg-blue-700 text-white" },
                      { value: "banker", label: "🏦 Banker",   color: "bg-red-600 hover:bg-red-700 text-white" },
                      { value: "joker",  label: "🤡 Joker 9×", color: "bg-yellow-500 hover:bg-yellow-600 text-white" },
                    ],
                  },
                  {
                    game: "ten-cards", label: "🔟 10 Cards",
                    options: [
                      { value: "player", label: "👤 Player", color: "bg-blue-600 hover:bg-blue-700 text-white" },
                      { value: "banker", label: "🏦 Banker", color: "bg-red-600 hover:bg-red-700 text-white" },
                    ],
                  },
                  {
                    game: "muflis", label: "♟️ Muflis",
                    options: [
                      { value: "player", label: "👤 Player", color: "bg-blue-600 hover:bg-blue-700 text-white" },
                      { value: "banker", label: "🏦 Banker", color: "bg-red-600 hover:bg-red-700 text-white" },
                    ],
                  },
                  {
                    game: "blackjack", label: "♠️ Blackjack",
                    options: [
                      { value: "player", label: "🤚 Player",   color: "bg-green-600 hover:bg-green-700 text-white" },
                      { value: "dealer", label: "🏠 Dealer",   color: "bg-red-600 hover:bg-red-700 text-white" },
                      { value: "tie",    label: "🤝 Tie 8×",   color: "bg-yellow-500 hover:bg-yellow-600 text-white" },
                    ],
                  },
                  {
                    game: "car-roulette", label: "🏎️ Car Roulette",
                    options: [
                      { value: "car1", label: "🔴 Car 1",     color: "bg-red-600 hover:bg-red-700 text-white" },
                      { value: "car2", label: "🔵 Car 2",     color: "bg-blue-600 hover:bg-blue-700 text-white" },
                      { value: "car3", label: "🟡 Car 3 5×",  color: "bg-yellow-500 hover:bg-yellow-600 text-white" },
                    ],
                  },
                  {
                    game: "god-of-fortune", label: "🐉 God of Fortune",
                    options: [
                      { value: "fortune", label: "🍀 Fortune",       color: "bg-green-600 hover:bg-green-700 text-white" },
                      { value: "grand",   label: "🔥 Grand 5×",      color: "bg-orange-500 hover:bg-orange-600 text-white" },
                      { value: "supreme", label: "👑 Supreme 10×",   color: "bg-yellow-500 hover:bg-yellow-600 text-white" },
                    ],
                  },
                  {
                    game: "rummy", label: "🀄 Rummy",
                    options: [
                      { value: "player", label: "👤 Player", color: "bg-green-600 hover:bg-green-700 text-white" },
                      { value: "house",  label: "🏠 House",  color: "bg-red-600 hover:bg-red-700 text-white" },
                    ],
                  },
                ].map(({ game, label, options }) => {
                  const activeOverride = gameOverrides[game];
                  return (
                    <div key={game} className={`border rounded-xl p-3 ${activeOverride ? "border-orange-500/50 bg-orange-500/5" : "border-border/40 bg-card/30"}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <div className="font-bold text-sm">{label}</div>
                          <div className="text-xs mt-0.5">
                            {activeOverride
                              ? <span className="text-orange-400 font-semibold">⚡ {activeOverride.toUpperCase()}</span>
                              : <span className="text-green-400">🎲 Random</span>}
                          </div>
                        </div>
                        {activeOverride && (
                          <Button variant="ghost" size="sm" onClick={() => clearGameOverride(game)} className="text-green-400 hover:bg-green-500/10 h-7 px-2 text-xs">
                            ✕ Clear
                          </Button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {options.map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => setGameOverride(game, opt.value)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${opt.color} ${activeOverride === opt.value ? "ring-2 ring-white scale-105 shadow-lg" : "opacity-60 hover:opacity-100"}`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="text-xs text-muted-foreground bg-card/30 rounded-lg p-3 border border-border/30">
                ⚠️ Overrides reset on server restart. Set back to <strong>Random</strong> after each use.
              </div>
            </CardContent>
          </Card>
        </TabsContent>
          </div>{/* end flex-1 content area */}
        </div>{/* end flex gap-6 */}
      </Tabs>

      <Dialog open={editOddsOpen} onOpenChange={setEditOddsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Odds</DialogTitle>
            <DialogDescription>
              Update odds for <strong>{editingEvent?.homeTeam} vs {editingEvent?.awayTeam}</strong>.
              The house margin updates automatically.
            </DialogDescription>
          </DialogHeader>
          <Form {...oddsForm}>
            <form onSubmit={oddsForm.handleSubmit(onUpdateOdds)} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <FormField control={oddsForm.control} name="oddsHome" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Home Win</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={oddsForm.control} name="oddsDraw" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Draw</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={oddsForm.control} name="oddsAway" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Away Win</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setEditOddsOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={updateOddsMutation.isPending}>
                  {updateOddsMutation.isPending ? "Saving..." : "Save Odds"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust User Balance</DialogTitle>
            <DialogDescription>
              Enter a positive amount to credit or a negative amount (e.g. -5000) to deduct from the user's balance.
            </DialogDescription>
          </DialogHeader>
          <Form {...adjustForm}>
            <form onSubmit={adjustForm.handleSubmit(onAdjustBalance)} className="space-y-4">
              <FormField control={adjustForm.control} name="amount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount (PKR) — use negative to deduct</FormLabel>
                  <FormControl><Input type="number" step="1" placeholder="e.g. 10000 or -5000" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={adjustForm.control} name="note" render={({ field }) => (
                <FormItem>
                  <FormLabel>Note (Optional)</FormLabel>
                  <FormControl><Input placeholder="Reason for adjustment" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setAdjustOpen(false)}>Cancel</Button>
                <Button type="submit">Apply</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetPasswordOpen} onOpenChange={setResetPasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              Reset User Password
            </DialogTitle>
            <DialogDescription>
              Set a new password for this user. They will need to use this new password to log in.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">New Password</label>
              <Input
                type="password"
                placeholder="Enter new password (min. 6 characters)"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setResetPasswordOpen(false)}>Cancel</Button>
              <Button onClick={onResetPassword} disabled={resetPasswordLoading}>
                {resetPasswordLoading ? "Resetting..." : "Reset Password"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

class AdminErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Admin Panel Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[75vh] flex items-center justify-center p-4">
          <div className="bg-[#0d1f14] border border-amber-500/50 rounded-2xl p-6 text-center space-y-4 max-w-md shadow-2xl">
            <div className="text-4xl">🛡️</div>
            <div className="font-extrabold text-amber-400 text-xl">Admin Control Center Notice</div>
            <div className="text-xs text-white/70 bg-black/40 p-3 rounded-xl border border-white/10 font-mono">
              {String(this.state.error?.message || "An unexpected error occurred.")}
            </div>
            <button
              onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
              className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-black font-bold text-sm rounded-xl transition"
            >
              🔄 Reload Admin Panel
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function Admin() {
  return (
    <AdminErrorBoundary>
      <AdminContent />
    </AdminErrorBoundary>
  );
}
