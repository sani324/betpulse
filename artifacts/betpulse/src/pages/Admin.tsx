import { useState } from "react";
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
  getGetAdminDashboardQueryKey,
  getGetAdminBetsQueryKey,
  getGetEventsQueryKey
} from "@workspace/api-client-react";
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
import { ShieldAlert, TrendingUp, Users, Coins, Activity, Pencil, Trash2, UserCog, ArrowUpFromLine, ArrowDownToLine, CheckCircle, XCircle, Clock, AlertCircle, Flag, ShieldX, ShieldCheck, KeyRound } from "lucide-react";
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

export default function Admin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  type PaymentSetting = { method: string; label: string; accountName: string; accountNumber: string; instructions: string; isActive: boolean };
  const [paymentSettings, setPaymentSettings] = useState<PaymentSetting[]>([]);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentEdits, setPaymentEdits] = useState<Record<string, Partial<PaymentSetting>>>({});
  const [editingPaymentMethod, setEditingPaymentMethod] = useState<string | null>(null);
  const [newMethod, setNewMethod] = useState({ label: "", accountName: "", accountNumber: "", instructions: "" });
  const [addingMethod, setAddingMethod] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Signup bonus state
  const [signupBonus, setSignupBonus] = useState<number>(50000);
  const [signupBonusInput, setSignupBonusInput] = useState<string>("50000");
  const [signupBonusSaving, setSignupBonusSaving] = useState(false);
  const [signupBonusLoaded, setSignupBonusLoaded] = useState(false);

  const loadSignupBonus = async () => {
    try {
      const res = await fetch("/api/admin/platform-settings/signup_bonus", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        const val = Math.round(parseFloat(data.value));
        setSignupBonus(val);
        setSignupBonusInput(String(val));
      }
    } catch {}
    setSignupBonusLoaded(true);
  };

  const saveSignupBonus = async () => {
    const val = Math.max(0, Math.round(parseFloat(signupBonusInput) || 0));
    setSignupBonusSaving(true);
    try {
      const res = await fetch("/api/admin/platform-settings/signup_bonus", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ value: String(val) }),
      });
      if (res.ok) {
        setSignupBonus(val);
        setSignupBonusInput(String(val));
        toast({ title: "Signup bonus updated!", description: `New users will now receive PKR ${val.toLocaleString()} on signup.` });
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

  const unsettledEvents = events?.filter(e => e.status !== "finished") || [];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2 text-destructive">
          <ShieldAlert className="h-8 w-8" />
          Admin Control Center
        </h1>
        <div className="text-xs text-muted-foreground bg-card border rounded px-3 py-2">
          Login: <strong>admin@betpulse.com</strong> &nbsp;|&nbsp; Pass: <strong>password</strong>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card/40 border-destructive/20 shadow-lg shadow-destructive/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Gross Profit</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {isLoadingDashboard ? <Skeleton className="h-8 w-24" /> : (
              <>
                <div className={`text-2xl font-bold ${dashboard!.grossProfit >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  {formatCurrency(dashboard!.grossProfit)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Margin: {formatPercentage(dashboard!.profitMargin / 100)}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Liability</CardTitle>
            <Activity className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            {isLoadingDashboard ? <Skeleton className="h-8 w-24" /> : (
              <>
                <div className="text-2xl font-bold text-orange-500">
                  {formatCurrency(dashboard!.pendingLiability)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Total potential payout</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Staked</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingDashboard ? <Skeleton className="h-8 w-24" /> : (
              <>
                <div className="text-2xl font-bold">{formatCurrency(dashboard!.totalStaked)}</div>
                <p className="text-xs text-muted-foreground mt-1">Across {dashboard!.totalBets} bets</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingDashboard ? <Skeleton className="h-8 w-24" /> : (
              <div className="text-2xl font-bold">{dashboard!.totalUsers}</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="events" className="w-full" onValueChange={(v) => {
        if (v === "users") loadUsers();
        if (v === "withdrawals") loadWithdrawals();
        if (v === "deposits") loadDeposits();
        if (v === "liability") loadExposure();
        if (v === "gamecontrols") { loadGameOverrides(); loadCasinoStats(); }
        if (v === "paymentsettings") loadPaymentSettings();
        if (v === "signupbonus" && !signupBonusLoaded) loadSignupBonus();
      }}>
        <TabsList className="bg-card/50 p-1 mb-6 flex-wrap h-auto gap-1">
          <TabsTrigger value="events">Manage Events</TabsTrigger>
          <TabsTrigger value="create">Create Event</TabsTrigger>
          <TabsTrigger value="liability">📊 Liability Monitor</TabsTrigger>
          <TabsTrigger value="bets">All Bets</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="deposits">
            Deposits
            {deposits.filter(d => d.status === "pending").length > 0 && (
              <span className="ml-1.5 bg-blue-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                {deposits.filter(d => d.status === "pending").length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="withdrawals">
            Withdrawals
            {withdrawals.filter(w => w.status === "pending").length > 0 && (
              <span className="ml-1.5 bg-yellow-500 text-black text-xs font-bold px-1.5 py-0.5 rounded-full">
                {withdrawals.filter(w => w.status === "pending").length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="paymentsettings" className="bg-green-500/10 text-green-400 data-[state=active]:bg-green-600 data-[state=active]:text-white">
            💳 Payment Setup
          </TabsTrigger>
          <TabsTrigger value="signupbonus" className="bg-purple-500/10 text-purple-400 data-[state=active]:bg-purple-600 data-[state=active]:text-white">
            🎁 Signup Bonus
          </TabsTrigger>
          <TabsTrigger value="gamecontrols" className="bg-orange-500/10 text-orange-400 data-[state=active]:bg-orange-500 data-[state=active]:text-white">
            🎮 Game Controls
          </TabsTrigger>
        </TabsList>

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
                    {events.map(event => (
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
                                    <DialogTitle>Settle Event</DialogTitle>
                                    <DialogDescription>
                                      Select the winning outcome for <strong>{event.homeTeam} vs {event.awayTeam}</strong>.
                                      All pending bets will be settled automatically.
                                      <br /><br />
                                      <strong className="text-destructive">Warning: This cannot be undone.</strong>
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="grid grid-cols-3 gap-4 py-4">
                                    <Button variant="outline" className="flex flex-col h-auto py-4" onClick={() => onSettleEvent("home")} disabled={settleEventMutation.isPending}>
                                      <span className="font-bold">{event.homeTeam}</span>
                                      <span className="text-xs text-muted-foreground mt-1">Home Win</span>
                                    </Button>
                                    <Button variant="outline" className="flex flex-col h-auto py-4" onClick={() => onSettleEvent("draw")} disabled={settleEventMutation.isPending}>
                                      <span className="font-bold">Draw</span>
                                      <span className="text-xs text-muted-foreground mt-1">Tie</span>
                                    </Button>
                                    <Button variant="outline" className="flex flex-col h-auto py-4" onClick={() => onSettleEvent("away")} disabled={settleEventMutation.isPending}>
                                      <span className="font-bold">{event.awayTeam}</span>
                                      <span className="text-xs text-muted-foreground mt-1">Away Win</span>
                                    </Button>
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
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select sport" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Football">⚽ Football</SelectItem>
                              <SelectItem value="Basketball">🏀 Basketball</SelectItem>
                              <SelectItem value="Tennis">🎾 Tennis</SelectItem>
                              <SelectItem value="Cricket">🏏 Cricket</SelectItem>
                              <SelectItem value="Teen Patti">🃏 Teen Patti</SelectItem>
                              <SelectItem value="Dragon Tiger">🐉 Dragon Tiger</SelectItem>
                              <SelectItem value="Andar Bahar">🎴 Andar Bahar</SelectItem>
                              <SelectItem value="Rang">♠️ Rang</SelectItem>
                              <SelectItem value="Piec">🂡 Piec</SelectItem>
                              <SelectItem value="Kabaddi">Kabaddi</SelectItem>
                              <SelectItem value="Hockey">Hockey</SelectItem>
                            </SelectContent>
                          </Select>
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
                    <h3 className="font-medium text-sm">Initial Odds (higher margin = more house profit)</h3>
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
                      <TableHead className="text-right">House Profit</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bets.map(bet => (
                      <TableRow key={bet.id}>
                        <TableCell className="font-medium">{bet.username}</TableCell>
                        <TableCell>{bet.homeTeam} vs {bet.awayTeam}</TableCell>
                        <TableCell className="uppercase text-xs font-bold">{bet.selection}</TableCell>
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
        <TabsContent value="signupbonus" className="space-y-4">
          <Card className="border-purple-500/30 bg-purple-500/5">
            <CardHeader>
              <CardTitle className="text-purple-400 flex items-center gap-2">🎁 Signup Bonus</CardTitle>
              <CardDescription>Set how much PKR bonus balance every new user receives when they create an account. Set to 0 to disable the bonus entirely.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Current value display */}
              <div className="flex items-center justify-between p-4 bg-card/60 rounded-xl border border-purple-500/20">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Current Signup Bonus</div>
                  <div className="text-3xl font-bold text-purple-400">
                    PKR {signupBonus.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {signupBonus === 0 ? "Bonus is disabled — new users start with PKR 0" : `Every new signup receives PKR ${signupBonus.toLocaleString()} automatically`}
                  </div>
                </div>
                <div className="text-5xl">🎁</div>
              </div>

              {/* Edit section */}
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium block mb-2">New Bonus Amount (PKR)</label>
                  <div className="flex gap-3">
                    <input
                      type="number"
                      min="0"
                      step="500"
                      value={signupBonusInput}
                      onChange={e => setSignupBonusInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && saveSignupBonus()}
                      placeholder="e.g. 50000"
                      className="flex-1 px-4 py-3 text-lg font-mono rounded-xl bg-background border border-purple-500/30 text-foreground focus:outline-none focus:border-purple-500/70"
                    />
                    <Button
                      onClick={saveSignupBonus}
                      disabled={signupBonusSaving || signupBonusInput === String(signupBonus)}
                      className="px-6 bg-purple-600 hover:bg-purple-700 text-white font-semibold"
                    >
                      {signupBonusSaving ? "Saving..." : "💾 Save"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Enter 0 to give no bonus. Changes apply to all new signups immediately.</p>
                </div>

                {/* Quick presets */}
                <div>
                  <div className="text-xs text-muted-foreground mb-2">Quick presets:</div>
                  <div className="flex flex-wrap gap-2">
                    {[0, 1000, 5000, 10000, 25000, 50000, 100000].map(preset => (
                      <button
                        key={preset}
                        onClick={() => setSignupBonusInput(String(preset))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          signupBonusInput === String(preset)
                            ? "bg-purple-600 border-purple-500 text-white"
                            : "border-border/50 bg-card/40 hover:border-purple-500/50 hover:text-purple-400"
                        }`}
                      >
                        {preset === 0 ? "No Bonus" : `PKR ${preset.toLocaleString()}`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-3 bg-card/30 rounded-lg border border-border/30 text-xs text-muted-foreground">
                💡 <strong>How it works:</strong> When a new user signs up, the system automatically credits their account with the signup bonus amount and records it as a "Welcome bonus" transaction in their history.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── GAME CONTROLS TAB ─── */}
        <TabsContent value="gamecontrols" className="space-y-4">
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
                                  <span className={`font-semibold uppercase ${isLeader ? "text-cyan-300" : "text-muted-foreground"}`}>
                                    {s.selection}
                                  </span>
                                  <span className="tabular-nums">
                                    <span className="font-bold text-foreground">{s.betCount}</span>
                                    <span className="text-muted-foreground"> bets · ₹{s.totalStaked.toFixed(2)} staked</span>
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
                    game: "andar-bahar", label: "🃏 Andar Bahar",
                    options: [
                      { value: "andar", label: "⬅ Andar", color: "bg-green-600 hover:bg-green-700 text-white" },
                      { value: "bahar", label: "➡ Bahar", color: "bg-red-600 hover:bg-red-700 text-white" },
                    ],
                  },
                  {
                    game: "rang", label: "🃏 Rang (Trump)",
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
