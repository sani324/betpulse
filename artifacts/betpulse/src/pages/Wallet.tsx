import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { 
  useGetBalance, 
  useGetTransactions, 
  getGetBalanceQueryKey, 
  getGetTransactionsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  Wallet as WalletIcon,
  ArrowDownToLine,
  ArrowUpFromLine,
  Activity,
  Check,
  X,
  ChevronDown,
  Gift,
  RefreshCw,
  Info,
  Clock,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const PRESET_AMOUNTS = [
  { amount: 100, bonus: 20 },
  { amount: 500, bonus: 80 },
  { amount: 1000, bonus: 163 },
  { amount: 3000, bonus: 345 },
  { amount: 5000, bonus: 380 },
  { amount: 10000, bonus: 670 },
  { amount: 30000, bonus: 2050 },
  { amount: 50000, bonus: 2500 },
];

export default function WalletPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Deposit Form States (Z7VIP Screenshot 1 Exact Match)
  const [selectedDepositType, setSelectedDepositType] = useState<"online" | "crypto">("online");
  const [selectedAmount, setSelectedAmount] = useState<number>(500);
  const [payerPhone, setPayerPhone] = useState<string>("03139620729");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [expandPromos, setExpandPromos] = useState<boolean>(false);

  // Withdrawal Form States
  const [withdrawAmount, setWithdrawAmount] = useState<number>(1000);
  const [withdrawMethod, setWithdrawMethod] = useState<string>("easypaisa");
  const [accountTitle, setAccountTitle] = useState<string>("");
  const [accountNumber, setAccountNumber] = useState<string>("");
  const [isSubmittingWithdraw, setIsSubmittingWithdraw] = useState<boolean>(false);

  // Request History
  const [depositRequests, setDepositRequests] = useState<any[]>([]);
  const [withdrawRequests, setWithdrawRequests] = useState<any[]>([]);

  const { data: balanceInfo, isLoading: isLoadingBalance } = useGetBalance({
    query: { queryKey: getGetBalanceQueryKey() }
  });

  const { data: transactions, isLoading: isLoadingTx } = useGetTransactions(
    { limit: 50 },
    { query: { queryKey: getGetTransactionsQueryKey({ limit: 50 }) } }
  );

  const getBonusForAmount = (amt: number) => {
    const item = PRESET_AMOUNTS.find(p => p.amount === amt);
    return item ? item.bonus : Math.round(amt * 0.15);
  };

  const currentBonus = getBonusForAmount(selectedAmount);
  const totalReceive = selectedAmount + currentBonus;

  async function fetchRequests() {
    try {
      const dRes = await fetch("/api/wallet/deposit-requests");
      if (dRes.ok) setDepositRequests(await dRes.json());
      const wRes = await fetch("/api/wallet/withdraw-requests");
      if (wRes.ok) setWithdrawRequests(await wRes.json());
    } catch (_) {}
  }

  useEffect(() => {
    fetchRequests();
  }, []);

  // Submit Deposit -> Redirects to Soda-Pay Checkout Page (Screenshot 2)
  async function handleDepositNow() {
    if (!payerPhone || payerPhone.trim().length < 5) {
      toast({ title: "Enter Payer Phone Number", description: "Please enter your mobile wallet number (e.g. 03139620729).", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/wallet/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: selectedAmount,
          paymentMethod: selectedDepositType === "crypto" ? "usdt" : "easypaisa",
          transactionRef: `PH-${payerPhone.trim()}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Deposit Failed", description: data.error || "Failed to create deposit order", variant: "destructive" });
        setIsSubmitting(false);
        return;
      }

      // Automatically redirect to Soda-Pay Checkout Gateway Page (Screenshot 2)
      const orderId = `PAY-${Math.floor(100000 + Math.random() * 900000)}`;
      setLocation(`/checkout?amount=${selectedAmount}&phone=${encodeURIComponent(payerPhone.trim())}&orderId=${orderId}`);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
      setIsSubmitting(false);
    }
  }

  async function handleWithdrawSubmit() {
    if (!accountTitle || accountTitle.trim().length < 2) {
      toast({ title: "Enter Account Title", description: "Please enter account holder name.", variant: "destructive" });
      return;
    }
    if (!accountNumber || accountNumber.trim().length < 5) {
      toast({ title: "Enter Account Number", description: "Please enter valid account number or IBAN.", variant: "destructive" });
      return;
    }

    setIsSubmittingWithdraw(true);
    try {
      const res = await fetch("/api/wallet/withdraw-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: withdrawAmount,
          paymentMethod: withdrawMethod,
          accountDetails: `${accountTitle.trim()} — ${accountNumber.trim()}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Withdrawal Failed", description: data.error || "Failed to submit withdrawal", variant: "destructive" });
        setIsSubmittingWithdraw(false);
        return;
      }
      toast({ title: "✅ Withdrawal Submitted!", description: "Request is in queue for admin processing." });
      setAccountTitle("");
      setAccountNumber("");
      fetchRequests();
      queryClient.invalidateQueries({ queryKey: getGetBalanceQueryKey() });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsSubmittingWithdraw(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 pb-12 font-sans">
      <div className="max-w-xl mx-auto px-4 py-3 space-y-4">
        
        {/* Top Header Bar with Back Button */}
        <div className="flex items-center justify-between py-2 border-b border-slate-200">
          <button
            type="button"
            onClick={() => window.history.length > 1 ? window.history.back() : setLocation("/")}
            className="flex items-center gap-1.5 text-slate-700 hover:text-slate-950 font-bold text-sm bg-slate-200/70 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition"
          >
            <X className="w-4 h-4 text-slate-600 hidden" />
            <span className="text-base">←</span>
            <span>Back</span>
          </button>
          <div className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
            <WalletIcon className="w-4 h-4 text-emerald-600" />
            <span>Deposit & Wallet</span>
          </div>
          <div className="w-14" />
        </div>

        {/* Main Wallet Tabs */}
        <Tabs defaultValue="deposit" className="w-full">
          <TabsList className="grid grid-cols-3 w-full bg-slate-200/80 p-1 rounded-2xl h-12">
            <TabsTrigger value="deposit" className="rounded-xl font-bold text-xs data-[state=active]:bg-emerald-700 data-[state=active]:text-white">
              Deposit
            </TabsTrigger>
            <TabsTrigger value="withdraw" className="rounded-xl font-bold text-xs data-[state=active]:bg-amber-600 data-[state=active]:text-white">
              Withdraw
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-xl font-bold text-xs data-[state=active]:bg-slate-800 data-[state=active]:text-white">
              History
            </TabsTrigger>
          </TabsList>

          {/* ─── DEPOSIT TAB (EXACT MATCH OF USER SCREENSHOT 1) ─── */}
          <TabsContent value="deposit" className="mt-4 space-y-4">
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-5">
              
              {/* Top Balance Row */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="text-sm font-semibold text-slate-600">Balance</div>
                <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1 rounded-full border border-slate-200 text-sm font-bold text-slate-800">
                  <span>🇵🇰</span>
                  <span>{parseFloat(String(balanceInfo?.balance || "0")).toFixed(2)}</span>
                  <RefreshCw className="w-3.5 h-3.5 text-slate-400 cursor-pointer hover:rotate-180 transition" onClick={() => queryClient.invalidateQueries()} />
                </div>
              </div>

              {/* Online Deposit vs Cryptocurrency Tabs */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedDepositType("online")}
                  className={`relative py-3 rounded-2xl font-bold text-sm transition flex items-center justify-center gap-2 ${
                    selectedDepositType === "online"
                      ? "text-emerald-700 border-b-2 border-emerald-700"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  <span className="text-lg">📲</span>
                  <span>Online deposit</span>
                  <span className="absolute -top-1.5 right-4 bg-red-500 text-white text-[10px] font-extrabold px-1.5 py-0.2 rounded-full shadow">
                    +3%
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedDepositType("crypto")}
                  className={`relative py-3 rounded-2xl font-bold text-sm transition flex items-center justify-center gap-2 ${
                    selectedDepositType === "crypto"
                      ? "text-amber-600 border-b-2 border-amber-600"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  <span className="text-lg">🪙</span>
                  <span>Cryptocurrency</span>
                  <span className="absolute -top-1.5 right-4 bg-orange-500 text-white text-[10px] font-extrabold px-1.5 py-0.2 rounded-full shadow">
                    +7%
                  </span>
                </button>
              </div>

              {/* Amount Box */}
              <div className="bg-emerald-50/50 border border-emerald-400/60 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-500">Rs</span>
                    <span className="text-2xl font-black text-slate-900">{selectedAmount}</span>
                  </div>
                  <button onClick={() => setSelectedAmount(0)} className="p-1 text-slate-400 hover:text-slate-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="text-xs text-slate-600 font-medium">
                  You can receive up to <span className="underline font-bold text-slate-900">{totalReceive.toFixed(2)}</span>(don&apos;t forget), Event bonus <span className="text-amber-600 font-bold">+{currentBonus.toFixed(2)}</span>
                </div>
              </div>

              {/* Preset Amounts Grid */}
              <div className="grid grid-cols-4 gap-2.5">
                {PRESET_AMOUNTS.map((item) => (
                  <button
                    key={item.amount}
                    type="button"
                    onClick={() => setSelectedAmount(item.amount)}
                    className={`p-3 rounded-2xl border transition text-center flex flex-col items-center justify-center gap-0.5 ${
                      selectedAmount === item.amount
                        ? "bg-amber-50/60 border-amber-400 shadow-sm text-slate-900 font-extrabold"
                        : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <span className="text-sm font-bold">{item.amount.toLocaleString()}</span>
                    <span className="text-[11px] font-bold text-amber-500">+{item.bonus.toFixed(2)}</span>
                  </button>
                ))}
              </div>

              {/* Deposit Promotion Box (Clear Preview Wording) */}
              <div className="bg-orange-50/50 border border-orange-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-sm text-slate-800">
                    <span>🎁</span>
                    <span>Deposit Bonus Offer (On Approval)</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono border-amber-400 text-amber-700 bg-amber-50">
                    Bonus Preview
                  </Badge>
                </div>

                <div className="text-xs text-slate-500 text-center font-medium">
                  Bonus is credited automatically <strong className="text-slate-800">after Admin approves</strong> your deposit
                </div>

                {/* Bonus Check Items */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs bg-white p-2.5 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-2">
                      <span>🎁</span>
                      <span className="font-semibold text-slate-800">Bonus +₨ 80.00</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 text-[11px]">Deposit ≥ ₨500</span>
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                        Pending Deposit
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs bg-white p-2.5 rounded-xl border border-slate-100 opacity-60">
                    <div className="flex items-center gap-2">
                      <span>🎁</span>
                      <span className="font-semibold text-slate-700">Bonus +₨ 20.00</span>
                    </div>
                    <span className="text-slate-400 text-[11px]">Deposit ≥ ₨100</span>
                  </div>

                  {expandPromos && (
                    <div className="flex items-center justify-between text-xs bg-white p-2.5 rounded-xl border border-slate-100 opacity-60">
                      <div className="flex items-center gap-2">
                        <span>🎁</span>
                        <span className="font-semibold text-slate-700">Bonus +₨ 50.00</span>
                      </div>
                      <span className="text-slate-400 text-[11px]">Deposit ≥ ₨300</span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setExpandPromos(!expandPromos)}
                  className="w-full text-center text-xs font-semibold text-slate-500 flex items-center justify-center gap-1 pt-1"
                >
                  <span>{expandPromos ? "Collapse" : "Expand"}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition ${expandPromos ? "rotate-180" : ""}`} />
                </button>
              </div>

              {/* Enter Payer Info (User's Mobile Number) */}
              <div className="space-y-2 pt-2">
                <div className="text-xs font-bold text-slate-700 text-center uppercase tracking-wider">
                  Enter payer info for proper crediting
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">
                    <span className="text-red-500 font-bold">*</span> Payer&apos;s mobile wallet number
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-3.5 text-slate-400 text-sm">📱</div>
                    <input
                      type="text"
                      value={payerPhone}
                      onChange={(e) => setPayerPhone(e.target.value)}
                      placeholder="03139620729"
                      className="w-full pl-9 pr-9 py-3 bg-white border border-slate-300 rounded-2xl text-slate-900 font-bold text-sm focus:outline-none focus:border-emerald-600"
                    />
                    {payerPhone && (
                      <button onClick={() => setPayerPhone("")} className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Full Width Dark Green Button: Deposit Now */}
              <button
                type="button"
                disabled={isSubmitting || !selectedAmount}
                onClick={handleDepositNow}
                className="w-full py-4 rounded-2xl bg-[#0f4d32] hover:bg-[#0c3f29] text-white font-extrabold text-base shadow-lg transition active:scale-[0.99] disabled:opacity-50"
              >
                {isSubmitting ? "Redirecting to Checkout..." : "Deposit Now"}
              </button>

            </div>
          </TabsContent>

          {/* ─── WITHDRAW TAB ─── */}
          <TabsContent value="withdraw" className="mt-4 space-y-4">
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-5">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-900">Withdraw Funds</h3>
                <p className="text-xs text-slate-500">
                  Withdrawable Net Balance: <strong className="text-emerald-600 font-bold">{formatCurrency((balanceInfo as any)?.withdrawableBalance || balanceInfo?.balance || 0)}</strong>
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700">Select Withdrawal Channel</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setWithdrawMethod("easypaisa")}
                    className={`py-3 rounded-2xl border font-bold text-sm transition flex items-center justify-center gap-2 ${
                      withdrawMethod === "easypaisa"
                        ? "bg-emerald-50 border-emerald-600 text-emerald-700"
                        : "bg-white border-slate-200 text-slate-600"
                    }`}
                  >
                    <span>💚 EasyPaisa</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setWithdrawMethod("jazzcash")}
                    className={`py-3 rounded-2xl border font-bold text-sm transition flex items-center justify-center gap-2 ${
                      withdrawMethod === "jazzcash"
                        ? "bg-red-50 border-red-600 text-red-700"
                        : "bg-white border-slate-200 text-slate-600"
                    }`}
                  >
                    <span>🔴 JazzCash</span>
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-700">Withdrawal Amount (PKR)</label>
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(Number(e.target.value))}
                  className="w-full p-3 bg-white border border-slate-300 rounded-2xl font-extrabold text-base text-slate-900"
                />
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-700">Account Holder Name</label>
                <input
                  type="text"
                  placeholder="e.g. Muhammad Ali"
                  value={accountTitle}
                  onChange={(e) => setAccountTitle(e.target.value)}
                  className="w-full p-3 bg-white border border-slate-300 rounded-2xl font-bold text-sm text-slate-900"
                />
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-700">Account Number / Mobile</label>
                <input
                  type="text"
                  placeholder="e.g. 03001234567"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="w-full p-3 bg-white border border-slate-300 rounded-2xl font-bold text-sm text-slate-900 font-mono"
                />
              </div>

              <button
                type="button"
                disabled={isSubmittingWithdraw}
                onClick={handleWithdrawSubmit}
                className="w-full py-4 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-base shadow-lg transition disabled:opacity-50"
              >
                {isSubmittingWithdraw ? "Submitting Request..." : "Submit Withdrawal Request"}
              </button>
            </div>
          </TabsContent>

          {/* ─── HISTORY TAB ─── */}
          <TabsContent value="history" className="mt-4 space-y-4">

            {/* 1. Deposit & Withdrawal Request Statuses with Admin Reason */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center justify-between">
                <span>📋 Request Approvals & Status</span>
                <button onClick={fetchRequests} className="text-xs text-emerald-700 hover:underline flex items-center gap-1 font-semibold">
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
              </h3>

              {depositRequests.length === 0 && withdrawRequests.length === 0 ? (
                <p className="text-xs text-slate-400 py-2">No pending or previous approval requests.</p>
              ) : (
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {/* Deposit Requests */}
                  {depositRequests.map((req: any) => (
                    <div key={`dep-${req.id}`} className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800">📥 Deposit Request</span>
                          <span className="text-xs font-mono font-bold text-emerald-600">{formatCurrency(req.amount)}</span>
                        </div>
                        <Badge variant="outline" className={`text-[10px] uppercase font-bold ${
                          req.status === "approved" ? "border-green-500 text-green-600 bg-green-50"
                          : req.status === "denied" ? "border-red-500 text-red-600 bg-red-50"
                          : "border-amber-500 text-amber-600 bg-amber-50"
                        }`}>
                          {req.status === "approved" ? "✓ Approved" : req.status === "denied" ? "✕ Denied" : "⏳ Pending"}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-slate-500 flex justify-between font-mono">
                        <span>Ref: {req.transactionRef}</span>
                        <span>{formatDateTime(req.createdAt)}</span>
                      </div>
                      {req.adminNote && (
                        <div className={`p-2 rounded-xl text-xs font-medium border ${
                          req.status === "denied" ? "bg-red-50 border-red-200 text-red-700" : "bg-emerald-50 border-emerald-200 text-emerald-800"
                        }`}>
                          💬 <strong>Admin Reason:</strong> {req.adminNote}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Withdrawal Requests */}
                  {withdrawRequests.map((req: any) => (
                    <div key={`with-${req.id}`} className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800">📤 Withdrawal Request</span>
                          <span className="text-xs font-mono font-bold text-amber-600">{formatCurrency(req.amount)}</span>
                        </div>
                        <Badge variant="outline" className={`text-[10px] uppercase font-bold ${
                          req.status === "approved" ? "border-green-500 text-green-600 bg-green-50"
                          : req.status === "denied" ? "border-red-500 text-red-600 bg-red-50"
                          : "border-amber-500 text-amber-600 bg-amber-50"
                        }`}>
                          {req.status === "approved" ? "✓ Approved" : req.status === "denied" ? "✕ Denied" : "⏳ Pending"}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-slate-500 flex justify-between font-mono">
                        <span>{req.paymentMethod.replace("_", " ").toUpperCase()} ({req.accountNumber})</span>
                        <span>{formatDateTime(req.createdAt)}</span>
                      </div>
                      {req.adminNote && (
                        <div className={`p-2 rounded-xl text-xs font-medium border ${
                          req.status === "denied" ? "bg-red-50 border-red-200 text-red-700" : "bg-emerald-50 border-emerald-200 text-emerald-800"
                        }`}>
                          💬 <strong>Admin Note / Reason:</strong> {req.adminNote}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Recent Account Transactions */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-4">
              <h3 className="text-base font-bold text-slate-900">Recent Account Transactions</h3>
              {isLoadingTx ? (
                <Skeleton className="h-20 w-full bg-slate-100" />
              ) : !transactions || transactions.length === 0 ? (
                <p className="text-xs text-slate-500">No transactions recorded yet.</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {transactions.map((tx: any) => (
                    <div key={tx.id} className="p-3 bg-slate-50 border border-slate-200/60 rounded-2xl flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-slate-800">{tx.description}</div>
                        <div className="text-[10px] text-slate-400">{formatDateTime(tx.createdAt)}</div>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-extrabold ${
                          tx.type === "bet_won" || tx.type === "deposit_approved" ? "text-emerald-600" : "text-slate-900"
                        }`}>
                          {tx.type === "bet_won" || tx.type === "deposit_approved" ? "+" : "-"}{formatCurrency(tx.amount)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

      </div>
    </div>
  );
}
