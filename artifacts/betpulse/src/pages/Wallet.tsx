import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  useGetBalance, 
  useGetTransactions, 
  getGetBalanceQueryKey, 
  getGetTransactionsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import {
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  Activity,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  Info,
  CreditCard,
  Gift,
  Copy,
  Check,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const depositSchema = z.object({
  amount: z.coerce.number().min(100, "Minimum deposit is PKR 100").max(1000000),
  paymentMethod: z.string().min(1, "Select a payment method"),
  transactionRef: z.string().min(3, "Enter your 11/12-digit transaction TRX ID"),
});

const withdrawSchema = z.object({
  amount: z.coerce.number().min(500, "Minimum withdrawal is PKR 500").max(500000),
  paymentMethod: z.string().min(1, "Select a payment method"),
  accountTitle: z.string().min(2, "Enter account holder name"),
  accountNumber: z.string().min(5, "Enter valid account number or IBAN"),
});

type PaymentSetting = { method: string; label: string; accountName: string; accountNumber: string; instructions: string; isActive: boolean };

type DepositRequest = {
  id: number;
  amount: number;
  paymentMethod: string;
  transactionRef: string;
  status: string;
  adminNote: string | null;
  createdAt: string;
};

type WithdrawalRequest = {
  id: number;
  amount: number;
  paymentMethod: string;
  accountDetails: string;
  status: string;
  adminNote: string | null;
  createdAt: string;
};

const DEFAULT_ADMIN_ACCOUNTS: Record<string, PaymentSetting> = {
  easypaisa: {
    method: "easypaisa",
    label: "EasyPaisa",
    accountName: "BetPulse Official",
    accountNumber: "03001234567",
    instructions: "Send funds via EasyPaisa App -> Enter 11-digit TRX ID below after payment.",
    isActive: true,
  },
  jazzcash: {
    method: "jazzcash",
    label: "JazzCash",
    accountName: "BetPulse Official",
    accountNumber: "03019876543",
    instructions: "Send funds via JazzCash App -> Enter 12-digit TRX ID below after payment.",
    isActive: true,
  },
  bank_transfer: {
    method: "bank_transfer",
    label: "Bank Transfer",
    accountName: "BetPulse Gaming Ltd",
    accountNumber: "PK36MEZN0001020304050607",
    instructions: "Transfer to Meezan Bank IBAN -> Enter Bank Transaction Reference ID below.",
    isActive: true,
  },
};

const DEPOSIT_PRESETS = [500, 1000, 2500, 5000, 10000, 25000];
const WITHDRAW_PRESETS = [500, 1000, 2500, 5000, 10000, 25000];

export default function WalletPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [depositRequests, setDepositRequests] = useState<DepositRequest[]>([]);
  const [withdrawRequests, setWithdrawRequests] = useState<WithdrawalRequest[]>([]);
  const [isLoadingDeposits, setIsLoadingDeposits] = useState(false);
  const [isLoadingWithdraws, setIsLoadingWithdraws] = useState(false);
  const [isSubmittingDeposit, setIsSubmittingDeposit] = useState(false);
  const [isSubmittingWithdraw, setIsSubmittingWithdraw] = useState(false);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSetting[]>([]);
  const [selectedDepositMethod, setSelectedDepositMethod] = useState<string>("easypaisa");
  const [selectedWithdrawMethod, setSelectedWithdrawMethod] = useState<string>("easypaisa");
  const [copiedNumber, setCopiedNumber] = useState(false);

  const { data: balanceInfo, isLoading: isLoadingBalance } = useGetBalance({
    query: { queryKey: getGetBalanceQueryKey() }
  });

  const { data: transactions, isLoading: isLoadingTx } = useGetTransactions(
    { limit: 50 },
    { query: { queryKey: getGetTransactionsQueryKey({ limit: 50 }) } }
  );

  const depositForm = useForm<z.infer<typeof depositSchema>>({
    resolver: zodResolver(depositSchema),
    defaultValues: { amount: 1000, paymentMethod: "easypaisa", transactionRef: "" },
  });

  const withdrawForm = useForm<z.infer<typeof withdrawSchema>>({
    resolver: zodResolver(withdrawSchema),
    defaultValues: { amount: 1000, paymentMethod: "easypaisa", accountTitle: "", accountNumber: "" },
  });

  async function fetchDepositRequests() {
    setIsLoadingDeposits(true);
    try {
      const res = await fetch("/api/wallet/deposit-requests");
      if (res.ok) setDepositRequests(await res.json());
    } finally {
      setIsLoadingDeposits(false);
    }
  }

  async function fetchWithdrawRequests() {
    setIsLoadingWithdraws(true);
    try {
      const res = await fetch("/api/wallet/withdraw-requests");
      if (res.ok) setWithdrawRequests(await res.json());
    } finally {
      setIsLoadingWithdraws(false);
    }
  }

  async function fetchPaymentSettings() {
    try {
      const res = await fetch("/api/payment-settings");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) setPaymentSettings(data);
      }
    } catch (_) {}
  }

  useEffect(() => {
    fetchDepositRequests();
    fetchWithdrawRequests();
    fetchPaymentSettings();
  }, []);

  const getAdminAccount = (method: string): PaymentSetting => {
    const found = paymentSettings.find(s => s.method === method && s.isActive);
    if (found) return found;
    return DEFAULT_ADMIN_ACCOUNTS[method] || DEFAULT_ADMIN_ACCOUNTS.easypaisa;
  };

  const handleCopyAccount = (numberToCopy: string) => {
    navigator.clipboard.writeText(numberToCopy);
    setCopiedNumber(true);
    toast({
      title: "📋 Copied to Clipboard!",
      description: `Account number ${numberToCopy} copied.`,
    });
    setTimeout(() => setCopiedNumber(false), 2000);
  };

  async function onDepositSubmit(values: z.infer<typeof depositSchema>) {
    setIsSubmittingDeposit(true);
    try {
      const res = await fetch("/api/wallet/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: values.amount,
          paymentMethod: selectedDepositMethod,
          transactionRef: values.transactionRef,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Deposit Request Failed", description: data.error || "Something went wrong", variant: "destructive" });
        return;
      }
      toast({ title: "✅ Deposit Submitted!", description: "Admin will review your TRX ID and credit your balance shortly." });
      depositForm.reset({ amount: 1000, paymentMethod: selectedDepositMethod, transactionRef: "" });
      fetchDepositRequests();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsSubmittingDeposit(false);
    }
  }

  async function onWithdrawSubmit(values: z.infer<typeof withdrawSchema>) {
    setIsSubmittingWithdraw(true);
    try {
      const formattedAccount = `${values.accountTitle.trim()} — ${values.accountNumber.trim()}`;
      const res = await fetch("/api/wallet/withdraw-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: values.amount,
          paymentMethod: selectedWithdrawMethod,
          accountDetails: formattedAccount,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Withdrawal Failed", description: data.error || "Something went wrong", variant: "destructive" });
        return;
      }
      toast({ title: "✅ Withdrawal Submitted!", description: "Your request is in queue for admin processing." });
      withdrawForm.reset({ amount: 1000, paymentMethod: selectedWithdrawMethod, accountTitle: "", accountNumber: "" });
      fetchWithdrawRequests();
      queryClient.invalidateQueries({ queryKey: getGetBalanceQueryKey() });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsSubmittingWithdraw(false);
    }
  }

  const currentAdminAcc = getAdminAccount(selectedDepositMethod);

  return (
    <div className="container max-w-5xl py-6 space-y-6">
      {/* ─── WALLET BALANCE BANNER ─── */}
      <div className="relative overflow-hidden rounded-3xl p-6 border-2 border-emerald-500/40 bg-gradient-to-r from-emerald-950 via-green-900 to-emerald-950 shadow-2xl text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-emerald-300 text-xs uppercase tracking-wider font-semibold">
              <Wallet className="w-4 h-4 text-emerald-400" /> Z7VIP Cash Wallet
            </div>
            {isLoadingBalance ? (
              <Skeleton className="h-10 w-48 bg-emerald-900/50" />
            ) : (
              <div className="text-4xl font-extrabold text-yellow-400 tracking-tight">
                {formatCurrency(balanceInfo?.balance ?? 0)}
              </div>
            )}
            <div className="flex items-center gap-4 text-xs text-emerald-200/80 pt-1">
              <span>Total Deposited: <strong className="text-white">{formatCurrency(balanceInfo?.totalDeposited ?? 0)}</strong></span>
              <span>•</span>
              <span>Total Won: <strong className="text-white">{formatCurrency(balanceInfo?.totalWon ?? 0)}</strong></span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-emerald-900/60 border border-emerald-400/30 p-3 rounded-2xl text-center min-w-[140px]">
              <div className="text-xs text-emerald-300 font-semibold flex items-center justify-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Withdrawable
              </div>
              <div className="text-lg font-bold text-emerald-200">
                {formatCurrency(balanceInfo?.withdrawableBalance ?? 0)}
              </div>
            </div>

            {(balanceInfo?.bonusBalance ?? 0) > 0 && (
              <div className="bg-amber-950/60 border border-amber-500/30 p-3 rounded-2xl text-center min-w-[130px]">
                <div className="text-xs text-amber-300 font-semibold flex items-center justify-center gap-1">
                  <Gift className="w-3.5 h-3.5 text-amber-400" /> Bonus Credit
                </div>
                <div className="text-lg font-bold text-amber-300">
                  {formatCurrency(balanceInfo?.bonusBalance ?? 0)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── MAIN TABS (DEPOSIT / WITHDRAW / HISTORY) ─── */}
      <Tabs defaultValue="deposit" className="w-full">
        <TabsList className="grid grid-cols-3 w-full max-w-md mx-auto h-12 bg-slate-900 border border-slate-800 p-1 rounded-2xl">
          <TabsTrigger value="deposit" className="rounded-xl font-bold text-xs flex items-center gap-1.5 data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
            <ArrowDownToLine className="w-4 h-4" /> Deposit (Jama)
          </TabsTrigger>
          <TabsTrigger value="withdraw" className="rounded-xl font-bold text-xs flex items-center gap-1.5 data-[state=active]:bg-yellow-500 data-[state=active]:text-slate-950">
            <ArrowUpFromLine className="w-4 h-4" /> Withdraw (Nikalwayein)
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-xl font-bold text-xs flex items-center gap-1.5 data-[state=active]:bg-slate-800 data-[state=active]:text-white">
            <Activity className="w-4 h-4" /> Transactions
          </TabsTrigger>
        </TabsList>

        {/* ─── DEPOSIT TAB ─── */}
        <TabsContent value="deposit" className="mt-6 space-y-6">
          <Card className="bg-slate-900 border-slate-800 text-white shadow-xl">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2 text-emerald-400">
                <Zap className="w-5 h-5" /> Instant Deposit Portal
              </CardTitle>
              <CardDescription className="text-slate-400">
                Select payment method, send funds to official account, and enter TRX ID to credit balance.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* Payment Provider Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">1. Select Payment Method</label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => { setSelectedDepositMethod("easypaisa"); depositForm.setValue("paymentMethod", "easypaisa"); }}
                    className={`p-3.5 rounded-2xl border-2 transition flex flex-col items-center gap-1 ${
                      selectedDepositMethod === "easypaisa"
                        ? "bg-emerald-600/20 border-emerald-500 text-emerald-400 font-bold shadow-lg shadow-emerald-500/10"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <span className="text-2xl">💚</span>
                    <span className="text-sm">EasyPaisa</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setSelectedDepositMethod("jazzcash"); depositForm.setValue("paymentMethod", "jazzcash"); }}
                    className={`p-3.5 rounded-2xl border-2 transition flex flex-col items-center gap-1 ${
                      selectedDepositMethod === "jazzcash"
                        ? "bg-red-600/20 border-red-500 text-red-400 font-bold shadow-lg shadow-red-500/10"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <span className="text-2xl">🔴</span>
                    <span className="text-sm">JazzCash</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setSelectedDepositMethod("bank_transfer"); depositForm.setValue("paymentMethod", "bank_transfer"); }}
                    className={`p-3.5 rounded-2xl border-2 transition flex flex-col items-center gap-1 ${
                      selectedDepositMethod === "bank_transfer"
                        ? "bg-blue-600/20 border-blue-500 text-blue-400 font-bold shadow-lg shadow-blue-500/10"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <span className="text-2xl">🏦</span>
                    <span className="text-sm">Bank Transfer</span>
                  </button>
                </div>
              </div>

              {/* Admin Official Account Details Box */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                  <span>Official Transfer Account Details</span>
                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 bg-emerald-950/40">Verified</Badge>
                </div>

                <div className="grid md:grid-cols-2 gap-4 bg-slate-900/80 p-4 rounded-xl border border-slate-800">
                  <div>
                    <div className="text-xs text-slate-400">Account Title / Name</div>
                    <div className="text-base font-bold text-white mt-0.5">{currentAdminAcc.accountName}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Account Number / IBAN</div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <span className="text-lg font-extrabold text-yellow-400 tracking-wider font-mono">
                        {currentAdminAcc.accountNumber}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleCopyAccount(currentAdminAcc.accountNumber)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-8 px-3 rounded-lg flex items-center gap-1.5 shrink-0"
                      >
                        {copiedNumber ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedNumber ? "Copied" : "Copy"}
                      </Button>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-400 italic">
                  💡 {currentAdminAcc.instructions} (Min Deposit: PKR 100).
                </p>
              </div>

              {/* Deposit Form */}
              <Form {...depositForm}>
                <form onSubmit={depositForm.handleSubmit(onDepositSubmit)} className="space-y-4">
                  {/* Preset Amount Quick Chips */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">2. Select Deposit Amount</label>
                    <div className="grid grid-cols-6 gap-2">
                      {DEPOSIT_PRESETS.map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => depositForm.setValue("amount", amt)}
                          className={`py-2 rounded-xl text-xs font-bold transition border ${
                            depositForm.watch("amount") === amt
                              ? "bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/20"
                              : "bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800"
                          }`}
                        >
                          +{amt >= 1000 ? `${amt / 1000}k` : amt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <FormField
                      control={depositForm.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold text-slate-300">Custom Amount (PKR)</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="1000" {...field} className="bg-slate-950 border-slate-800 text-white font-bold h-11" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={depositForm.control}
                      name="transactionRef"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold text-slate-300">Transaction TRX ID / Reference</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. 034928174928" {...field} className="bg-slate-950 border-slate-800 text-white font-mono h-11" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmittingDeposit}
                    className="w-full h-12 bg-gradient-to-r from-emerald-500 to-green-600 text-slate-950 font-extrabold text-base shadow-lg shadow-emerald-500/20 hover:brightness-110"
                  >
                    {isSubmittingDeposit ? "Submitting Request..." : "Submit Deposit Request 📥"}
                  </Button>
                </form>
              </Form>

              {/* Deposit History */}
              <div className="pt-4 space-y-3 border-t border-slate-800">
                <h4 className="text-sm font-bold text-slate-200">Your Recent Deposit Requests</h4>
                {isLoadingDeposits ? (
                  <Skeleton className="h-16 w-full bg-slate-800" />
                ) : depositRequests.length === 0 ? (
                  <p className="text-xs text-slate-500">No deposit requests submitted yet.</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {depositRequests.map((req) => (
                      <div key={req.id} className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
                        <div>
                          <div className="text-sm font-bold text-white">{formatCurrency(req.amount)}</div>
                          <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                            <span className="uppercase font-semibold text-emerald-400">{req.paymentMethod}</span>
                            <span>•</span>
                            <span className="font-mono">{req.transactionRef}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className={`capitalize ${
                            req.status === "approved" ? "border-emerald-500 text-emerald-400 bg-emerald-950/40" :
                            req.status === "rejected" ? "border-red-500 text-red-400 bg-red-950/40" :
                            "border-amber-500 text-amber-400 bg-amber-950/40"
                          }`}>
                            {req.status}
                          </Badge>
                          <div className="text-[10px] text-slate-500 mt-1">{formatDateTime(req.createdAt)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── WITHDRAW TAB ─── */}
        <TabsContent value="withdraw" className="mt-6 space-y-6">
          <Card className="bg-slate-900 border-slate-800 text-white shadow-xl">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2 text-yellow-400">
                <ArrowUpFromLine className="w-5 h-5" /> Fast Withdrawal Portal
              </CardTitle>
              <CardDescription className="text-slate-400">
                Submit withdrawal request to receive payouts directly in your EasyPaisa, JazzCash, or Bank account.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">

              {/* Withdrawable Warning / Limits Alert */}
              <Alert className="bg-slate-950 border-amber-500/40 text-slate-300">
                <Info className="h-4 h-4 text-amber-400" />
                <AlertDescription className="text-xs space-y-1">
                  <div>• Withdrawable Net Balance: <strong className="text-yellow-400">{formatCurrency(balanceInfo?.withdrawableBalance ?? 0)}</strong></div>
                  <div>• Minimum Withdrawal: <strong>PKR 500</strong> | Maximum Withdrawal: <strong>PKR 500,000</strong></div>
                </AlertDescription>
              </Alert>

              {/* Payment Provider Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">1. Select Withdrawal Method</label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => { setSelectedWithdrawMethod("easypaisa"); withdrawForm.setValue("paymentMethod", "easypaisa"); }}
                    className={`p-3.5 rounded-2xl border-2 transition flex flex-col items-center gap-1 ${
                      selectedWithdrawMethod === "easypaisa"
                        ? "bg-emerald-600/20 border-emerald-500 text-emerald-400 font-bold shadow-lg shadow-emerald-500/10"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <span className="text-2xl">💚</span>
                    <span className="text-sm">EasyPaisa</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setSelectedWithdrawMethod("jazzcash"); withdrawForm.setValue("paymentMethod", "jazzcash"); }}
                    className={`p-3.5 rounded-2xl border-2 transition flex flex-col items-center gap-1 ${
                      selectedWithdrawMethod === "jazzcash"
                        ? "bg-red-600/20 border-red-500 text-red-400 font-bold shadow-lg shadow-red-500/10"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <span className="text-2xl">🔴</span>
                    <span className="text-sm">JazzCash</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setSelectedWithdrawMethod("bank_transfer"); withdrawForm.setValue("paymentMethod", "bank_transfer"); }}
                    className={`p-3.5 rounded-2xl border-2 transition flex flex-col items-center gap-1 ${
                      selectedWithdrawMethod === "bank_transfer"
                        ? "bg-blue-600/20 border-blue-500 text-blue-400 font-bold shadow-lg shadow-blue-500/10"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <span className="text-2xl">🏦</span>
                    <span className="text-sm">Bank Transfer</span>
                  </button>
                </div>
              </div>

              {/* Withdrawal Form */}
              <Form {...withdrawForm}>
                <form onSubmit={withdrawForm.handleSubmit(onWithdrawSubmit)} className="space-y-4">
                  {/* Preset Amount Quick Chips */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">2. Select Withdrawal Amount</label>
                    <div className="grid grid-cols-6 gap-2">
                      {WITHDRAW_PRESETS.map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => withdrawForm.setValue("amount", amt)}
                          className={`py-2 rounded-xl text-xs font-bold transition border ${
                            withdrawForm.watch("amount") === amt
                              ? "bg-yellow-400 text-slate-950 border-yellow-300 shadow-md shadow-yellow-500/20"
                              : "bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800"
                          }`}
                        >
                          {amt >= 1000 ? `${amt / 1000}k` : amt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <FormField
                    control={withdrawForm.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold text-slate-300">Withdrawal Amount (PKR)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="1000" {...field} className="bg-slate-950 border-slate-800 text-white font-bold h-11" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid md:grid-cols-2 gap-4">
                    <FormField
                      control={withdrawForm.control}
                      name="accountTitle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold text-slate-300">Account Holder Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Muhammad Ali" {...field} className="bg-slate-950 border-slate-800 text-white h-11" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={withdrawForm.control}
                      name="accountNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold text-slate-300">Account Number / Mobile / IBAN</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. 03001234567" {...field} className="bg-slate-950 border-slate-800 text-white font-mono h-11" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmittingWithdraw}
                    className="w-full h-12 bg-gradient-to-r from-yellow-400 to-amber-500 text-slate-950 font-extrabold text-base shadow-lg shadow-amber-500/20 hover:brightness-110"
                  >
                    {isSubmittingWithdraw ? "Submitting Request..." : "Submit Withdrawal Request 📤"}
                  </Button>
                </form>
              </Form>

              {/* Withdrawal History */}
              <div className="pt-4 space-y-3 border-t border-slate-800">
                <h4 className="text-sm font-bold text-slate-200">Your Recent Withdrawal Requests</h4>
                {isLoadingWithdraws ? (
                  <Skeleton className="h-16 w-full bg-slate-800" />
                ) : withdrawRequests.length === 0 ? (
                  <p className="text-xs text-slate-500">No withdrawal requests submitted yet.</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {withdrawRequests.map((req) => (
                      <div key={req.id} className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
                        <div>
                          <div className="text-sm font-bold text-white">{formatCurrency(req.amount)}</div>
                          <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                            <span className="uppercase font-semibold text-yellow-400">{req.paymentMethod}</span>
                            <span>•</span>
                            <span>{req.accountDetails}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className={`capitalize ${
                            req.status === "approved" ? "border-emerald-500 text-emerald-400 bg-emerald-950/40" :
                            req.status === "rejected" ? "border-red-500 text-red-400 bg-red-950/40" :
                            "border-amber-500 text-amber-400 bg-amber-950/40"
                          }`}>
                            {req.status}
                          </Badge>
                          <div className="text-[10px] text-slate-500 mt-1">{formatDateTime(req.createdAt)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── TRANSACTIONS HISTORY TAB ─── */}
        <TabsContent value="history" className="mt-6 space-y-6">
          <Card className="bg-slate-900 border-slate-800 text-white shadow-xl">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2 text-white">
                <Activity className="w-5 h-5 text-blue-400" /> Wallet Transaction History
              </CardTitle>
              <CardDescription className="text-slate-400">
                Detailed record of all bets, wins, deposits, and withdrawals on your account.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingTx ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full bg-slate-800" />
                  <Skeleton className="h-12 w-full bg-slate-800" />
                </div>
              ) : !transactions || transactions.length === 0 ? (
                <p className="text-xs text-slate-500">No transactions recorded yet.</p>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {transactions.map((tx) => (
                    <div key={tx.id} className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="text-sm font-semibold text-slate-200">{tx.description}</div>
                        <div className="text-xs text-slate-500">{formatDateTime(tx.createdAt)}</div>
                      </div>
                      <div className="text-right space-y-0.5">
                        <div className={`text-sm font-bold ${
                          tx.type === "bet_won" || tx.type === "deposit_approved" ? "text-emerald-400" :
                          tx.type === "bet_placed" || tx.type === "withdrawal_submitted" ? "text-red-400" : "text-white"
                        }`}>
                          {tx.type === "bet_won" || tx.type === "deposit_approved" ? "+" : "-"}{formatCurrency(tx.amount)}
                        </div>
                        <div className="text-[11px] text-slate-400">Bal: {formatCurrency(tx.balanceAfter)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
