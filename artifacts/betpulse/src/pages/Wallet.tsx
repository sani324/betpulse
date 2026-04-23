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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Lock,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const depositSchema = z.object({
  amount: z.coerce.number().min(100, "Minimum deposit is PKR 100").max(1000000),
  paymentMethod: z.string().min(1, "Select a payment method"),
  transactionRef: z.string().min(3, "Enter your transaction ID or description"),
});

const withdrawSchema = z.object({
  amount: z.coerce.number().min(500, "Minimum withdrawal is PKR 500").max(500000),
  paymentMethod: z.string().min(1, "Select a payment method"),
  accountDetails: z.string().min(5, "Enter your account number or IBAN").max(200),
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
  const [selectedDepositMethod, setSelectedDepositMethod] = useState<string>("");

  const { data: balanceInfo, isLoading: isLoadingBalance } = useGetBalance({
    query: { queryKey: getGetBalanceQueryKey() }
  });

  const { data: transactions, isLoading: isLoadingTx } = useGetTransactions(
    { limit: 50 },
    { query: { queryKey: getGetTransactionsQueryKey({ limit: 50 }) } }
  );

  const depositForm = useForm<z.infer<typeof depositSchema>>({
    resolver: zodResolver(depositSchema),
    defaultValues: { amount: 1000 },
  });

  const withdrawForm = useForm<z.infer<typeof withdrawSchema>>({
    resolver: zodResolver(withdrawSchema),
    defaultValues: { amount: 1000 },
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

  useEffect(() => {
    fetchDepositRequests();
    fetchWithdrawRequests();
    fetch("/api/payment-settings").then(r => r.json()).then(setPaymentSettings).catch(() => {});
  }, []);

  async function onDeposit(values: z.infer<typeof depositSchema>) {
    setIsSubmittingDeposit(true);
    try {
      const res = await fetch("/api/wallet/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Error", description: data.error, variant: "destructive" });
      } else {
        toast({
          title: "Deposit Request Submitted",
          description: "The admin will verify your payment and credit your account.",
        });
        depositForm.reset();
        fetchDepositRequests();
      }
    } catch {
      toast({ title: "Error", description: "Network error. Please try again.", variant: "destructive" });
    } finally {
      setIsSubmittingDeposit(false);
    }
  }

  async function onWithdraw(values: z.infer<typeof withdrawSchema>) {
    setIsSubmittingWithdraw(true);
    try {
      const res = await fetch("/api/wallet/withdraw-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Error", description: data.error, variant: "destructive" });
      } else {
        toast({ title: "Withdrawal Requested", description: "Your request has been submitted. The admin will process it shortly." });
        withdrawForm.reset();
        fetchWithdrawRequests();
      }
    } catch {
      toast({ title: "Error", description: "Network error. Please try again.", variant: "destructive" });
    } finally {
      setIsSubmittingWithdraw(false);
    }
  }

  const getTxIcon = (type: string) => {
    switch (type) {
      case "deposit": return <ArrowDownToLine className="h-4 w-4 text-primary" />;
      case "withdrawal": return <ArrowUpFromLine className="h-4 w-4 text-destructive" />;
      case "bet_placed": return <Activity className="h-4 w-4 text-blue-500" />;
      case "bet_won": return <ArrowDownToLine className="h-4 w-4 text-primary" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getTxColor = (type: string) => {
    if (["deposit", "bet_won", "bonus"].includes(type)) return "text-primary";
    return "text-foreground";
  };

  const getTxSign = (type: string) => {
    if (["deposit", "bet_won", "bonus"].includes(type)) return "+";
    if (["withdrawal", "bet_placed"].includes(type)) return "-";
    return "";
  };

  const statusBadge = (status: string) => {
    if (status === "pending") return <Badge variant="outline" className="text-yellow-500 border-yellow-500 gap-1"><Clock className="h-3 w-3" />Pending</Badge>;
    if (status === "approved") return <Badge variant="outline" className="text-green-500 border-green-500 gap-1"><CheckCircle className="h-3 w-3" />Approved</Badge>;
    if (status === "denied") return <Badge variant="outline" className="text-destructive border-destructive gap-1"><XCircle className="h-3 w-3" />Denied</Badge>;
    return <Badge variant="outline">{status}</Badge>;
  };

  const methodLabel = (m: string) => {
    const labels: Record<string, string> = { easypaisa: "EasyPaisa", jazzcash: "JazzCash", nayapay: "NayaPay", bank_transfer: "Bank Transfer" };
    return labels[m] ?? m;
  };

  const activePayments = paymentSettings.filter(p => p.isActive && p.accountNumber);
  const selectedPayment = paymentSettings.find(p => p.method === selectedDepositMethod);

  const pendingDeposits = depositRequests.filter(r => r.status === "pending").length;
  const pendingWithdrawals = withdrawRequests.filter(r => r.status === "pending").length;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <Wallet className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight">Wallet</h1>
      </div>

      <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 shadow-xl shadow-black/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-muted-foreground font-medium">Total Balance</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingBalance ? (
            <Skeleton className="h-16 w-48" />
          ) : (
            <div className="text-5xl md:text-7xl font-black tabular-nums tracking-tighter text-primary">
              {formatCurrency(balanceInfo?.balance || 0)}
            </div>
          )}

          {/* Withdrawable vs Bonus breakdown */}
          {!isLoadingBalance && (balanceInfo?.bonusBalance ?? 0) > 0 && (
            <div className="grid grid-cols-2 gap-3 mt-5">
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <ArrowUpFromLine className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs text-primary font-bold uppercase tracking-wider">Withdrawable</span>
                </div>
                <div className="font-mono font-bold text-lg text-primary">
                  {formatCurrency(balanceInfo?.withdrawableBalance ?? 0)}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">Available to cash out</p>
              </div>
              <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Gift className="h-3.5 w-3.5 text-yellow-500" />
                  <span className="text-xs text-yellow-500 font-bold uppercase tracking-wider">Bonus</span>
                  <Lock className="h-3 w-3 text-yellow-500/60" />
                </div>
                <div className="font-mono font-bold text-lg text-yellow-400">
                  {formatCurrency(balanceInfo?.bonusBalance ?? 0)}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">Play-only, not withdrawable</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-border/30">
            <div>
              <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold">Total Deposited</div>
              <div className="font-mono font-medium">{formatCurrency(balanceInfo?.totalDeposited || 0)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold">Total Wagered</div>
              <div className="font-mono font-medium">{formatCurrency(balanceInfo?.totalWagered || 0)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold">Total Won</div>
              <div className="font-mono font-medium text-primary">{formatCurrency(balanceInfo?.totalWon || 0)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-card/40 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Request Deposit
            </CardTitle>
            <CardDescription>Submit a deposit request for admin approval</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Step 1: Show admin payment accounts */}
            {activePayments.length > 0 && (
              <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
                <p className="text-xs font-bold text-primary uppercase tracking-wider mb-3">
                  Step 1 — Send money to one of these accounts:
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {activePayments.map(pm => {
                    const icons: Record<string,string> = { jazzcash: "📱", easypaisa: "💚", nayapay: "🔵", bank_transfer: "🏦" };
                    const isSelected = selectedDepositMethod === pm.method;
                    return (
                      <button key={pm.method} type="button"
                        onClick={() => { setSelectedDepositMethod(pm.method); depositForm.setValue("paymentMethod" as any, pm.method); }}
                        className={`w-full text-left rounded-lg p-3 border transition-all ${isSelected ? "border-primary bg-primary/10" : "border-border/40 bg-card/30 hover:border-primary/40"}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{icons[pm.method] ?? "💳"}</span>
                            <span className="font-bold text-sm">{pm.label}</span>
                            {isSelected && <span className="text-xs text-primary font-bold">✓ Selected</span>}
                          </div>
                        </div>
                        <div className="mt-1 ml-7">
                          {pm.accountName && <p className="text-xs text-muted-foreground">{pm.accountName}</p>}
                          <p className="font-mono text-sm font-bold text-foreground">{pm.accountNumber}</p>
                          {pm.instructions && <p className="text-xs text-muted-foreground italic mt-0.5">{pm.instructions}</p>}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  After sending, fill the form below with your transaction ID so the admin can verify and credit your account.
                </p>
              </div>
            )}
            {activePayments.length === 0 && (
              <Alert className="mb-4 border-blue-500/30 bg-blue-500/5">
                <Info className="h-4 w-4 text-blue-400" />
                <AlertDescription className="text-xs text-muted-foreground">
                  Contact admin for payment account details. Then submit this form with your transaction reference.
                </AlertDescription>
              </Alert>
            )}

            <Form {...depositForm}>
              <form onSubmit={depositForm.handleSubmit(onDeposit)} className="space-y-4">
                <FormField control={depositForm.control} name="amount" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (PKR)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-muted-foreground text-xs font-bold">PKR</span>
                        <Input type="number" className="pl-12 font-mono text-lg" {...field} data-testid="input-deposit-amount" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-3 gap-2">
                  {[500, 1000, 5000].map(amt => (
                    <Button key={amt} type="button" variant="outline" size="sm" onClick={() => depositForm.setValue("amount", amt)} className="font-mono text-xs">
                      {amt.toLocaleString()}
                    </Button>
                  ))}
                </div>
                <FormField control={depositForm.control} name="paymentMethod" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Method Used</FormLabel>
                    <Select onValueChange={(v) => { field.onChange(v); setSelectedDepositMethod(v); }} value={selectedDepositMethod || field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="How did you pay?" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {paymentSettings.filter(p => p.isActive).map(pm => {
                          const icons: Record<string,string> = { jazzcash: "📱", easypaisa: "💚", nayapay: "🔵", bank_transfer: "🏦" };
                          return <SelectItem key={pm.method} value={pm.method}>{icons[pm.method] ?? "💳"} {pm.label}</SelectItem>;
                        })}
                        {paymentSettings.filter(p => p.isActive).length === 0 && (
                          <>
                            <SelectItem value="jazzcash">📱 JazzCash</SelectItem>
                            <SelectItem value="easypaisa">💚 EasyPaisa</SelectItem>
                            <SelectItem value="nayapay">🔵 NayaPay</SelectItem>
                            <SelectItem value="bank_transfer">🏦 Bank Transfer</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={depositForm.control} name="transactionRef" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transaction ID / Reference</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. TXN12345678 or screenshot ref" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="w-full font-bold" disabled={isSubmittingDeposit} data-testid="btn-deposit">
                  {isSubmittingDeposit ? "Submitting..." : "Submit Deposit Request"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowUpFromLine className="h-5 w-5 text-primary" />
              Request Withdrawal
            </CardTitle>
            <CardDescription>Request a payout to your account</CardDescription>
          </CardHeader>
          <CardContent>
            {(balanceInfo?.bonusBalance ?? 0) > 0 && (
              <Alert className="mb-3 border-yellow-500/30 bg-yellow-500/5">
                <Gift className="h-4 w-4 text-yellow-400" />
                <AlertDescription className="text-xs text-muted-foreground">
                  <span className="font-semibold text-yellow-400">Bonus funds are not withdrawable.</span>{" "}
                  Your {formatCurrency(balanceInfo?.bonusBalance ?? 0)} signup bonus can only be used to play games.
                  {(balanceInfo?.withdrawableBalance ?? 0) > 0
                    ? ` You can withdraw up to ${formatCurrency(balanceInfo?.withdrawableBalance ?? 0)} (your winnings/deposits above the bonus).`
                    : " Win more than your bonus amount to unlock withdrawals."}
                </AlertDescription>
              </Alert>
            )}
            <Alert className="mb-4 border-yellow-500/30 bg-yellow-500/5">
              <AlertCircle className="h-4 w-4 text-yellow-400" />
              <AlertDescription className="text-xs text-muted-foreground">
                Withdrawal requests are reviewed by the admin. You will receive your money via the selected payment method once approved. Minimum: PKR 500.
              </AlertDescription>
            </Alert>
            <Form {...withdrawForm}>
              <form onSubmit={withdrawForm.handleSubmit(onWithdraw)} className="space-y-4">
                <FormField control={withdrawForm.control} name="amount" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (PKR)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-muted-foreground text-xs font-bold">PKR</span>
                        <Input type="number" className="pl-12 font-mono text-lg" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={withdrawForm.control} name="paymentMethod" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Method</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Where to send money?" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {paymentSettings.filter(p => p.isActive).map(pm => {
                          const icons: Record<string,string> = { jazzcash: "📱", easypaisa: "💚", nayapay: "🔵", bank_transfer: "🏦" };
                          return <SelectItem key={pm.method} value={pm.method}>{icons[pm.method] ?? "💳"} {pm.label}</SelectItem>;
                        })}
                        {paymentSettings.filter(p => p.isActive).length === 0 && (
                          <>
                            <SelectItem value="jazzcash">📱 JazzCash</SelectItem>
                            <SelectItem value="easypaisa">💚 EasyPaisa</SelectItem>
                            <SelectItem value="nayapay">🔵 NayaPay</SelectItem>
                            <SelectItem value="bank_transfer">🏦 Bank Transfer (IBAN)</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={withdrawForm.control} name="accountDetails" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Number / IBAN</FormLabel>
                    <FormControl>
                      <Input placeholder="03XX-XXXXXXX or IBAN" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" variant="outline" className="w-full font-bold border-primary/50 hover:border-primary" disabled={isSubmittingWithdraw}>
                  {isSubmittingWithdraw ? "Submitting..." : "Request Withdrawal"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="transactions">
        <TabsList className="w-full flex-wrap h-auto">
          <TabsTrigger value="transactions" className="flex-1">Transactions</TabsTrigger>
          <TabsTrigger value="deposits" className="flex-1">
            Deposit Requests
            {pendingDeposits > 0 && <span className="ml-1.5 bg-blue-500/20 text-blue-400 text-xs px-1.5 py-0.5 rounded-full">{pendingDeposits}</span>}
          </TabsTrigger>
          <TabsTrigger value="withdrawals" className="flex-1">
            Withdrawal Requests
            {pendingWithdrawals > 0 && <span className="ml-1.5 bg-yellow-500/20 text-yellow-400 text-xs px-1.5 py-0.5 rounded-full">{pendingWithdrawals}</span>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transactions">
          <Card className="bg-card/30 border-border/50">
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
              <CardDescription>All confirmed credits and debits on your account</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingTx ? (
                <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
              ) : !transactions || transactions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Activity className="mx-auto h-12 w-12 mb-4 opacity-20" />
                  <p>No transactions yet</p>
                  <p className="text-xs mt-1">Transactions appear here once your deposit is approved</p>
                </div>
              ) : (
                <div className="space-y-0 relative">
                  <div className="absolute left-[27px] top-4 bottom-4 w-px bg-border/50 hidden md:block"></div>
                  {transactions.map((tx) => (
                    <div key={tx.id} className="relative flex items-center p-4 hover:bg-card/50 transition-colors rounded-lg group">
                      <div className="hidden md:flex h-14 w-14 rounded-full bg-background border border-border items-center justify-center z-10 shadow-sm mr-4 group-hover:border-primary/50 transition-colors">
                        {getTxIcon(tx.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{tx.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">{formatDateTime(tx.createdAt)}</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-mono font-bold ${getTxColor(tx.type)}`}>
                          {getTxSign(tx.type)}{formatCurrency(tx.amount)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 font-mono">Bal: {formatCurrency(tx.balanceAfter)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deposits">
          <Card className="bg-card/30 border-border/50">
            <CardHeader>
              <CardTitle>Deposit Requests</CardTitle>
              <CardDescription>Track your deposit request status</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingDeposits ? (
                <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
              ) : depositRequests.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CreditCard className="mx-auto h-12 w-12 mb-4 opacity-20" />
                  <p>No deposit requests yet</p>
                  <p className="text-xs mt-1">Submit a deposit request using the form above</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {depositRequests.map((req) => (
                    <div key={req.id} className="flex items-start justify-between p-4 border border-border/40 rounded-lg hover:bg-card/50 transition-colors">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono font-bold text-primary">{formatCurrency(req.amount)}</span>
                          {statusBadge(req.status)}
                        </div>
                        <p className="text-xs text-muted-foreground">{methodLabel(req.paymentMethod)} — Ref: {req.transactionRef}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{formatDateTime(req.createdAt)}</p>
                        {req.adminNote && <p className="text-xs text-muted-foreground mt-1 italic">Admin: {req.adminNote}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="withdrawals">
          <Card className="bg-card/30 border-border/50">
            <CardHeader>
              <CardTitle>Withdrawal Requests</CardTitle>
              <CardDescription>Track your payout requests</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingWithdraws ? (
                <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
              ) : withdrawRequests.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ArrowUpFromLine className="mx-auto h-12 w-12 mb-4 opacity-20" />
                  <p>No withdrawal requests yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {withdrawRequests.map((req) => (
                    <div key={req.id} className="flex items-start justify-between p-4 border border-border/40 rounded-lg hover:bg-card/50 transition-colors">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono font-bold text-primary">{formatCurrency(req.amount)}</span>
                          {statusBadge(req.status)}
                        </div>
                        <p className="text-xs text-muted-foreground">{methodLabel(req.paymentMethod)} — {req.accountDetails}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{formatDateTime(req.createdAt)}</p>
                        {req.adminNote && <p className="text-xs text-muted-foreground mt-1 italic">Admin: {req.adminNote}</p>}
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
