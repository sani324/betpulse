import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Wallet, CheckCircle, Clock } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default function SodaPayCheckout() {
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const amount = searchParams.get("amount") || "500.00";
  const phone = searchParams.get("phone") || "03139620729";
  const orderId = searchParams.get("orderId") || "PAY-" + Math.floor(100000 + Math.random() * 900000);

  return (
    <div className="min-h-screen bg-[#f0f4f8] flex flex-col items-center justify-center p-4 font-sans text-slate-800">
      
      {/* Top Header Bar */}
      <div className="w-full max-w-md flex items-center justify-between py-3 mb-2">
        <button 
          onClick={() => setLocation("/wallet")} 
          className="flex items-center gap-1 text-slate-600 text-sm font-semibold hover:text-slate-900 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Wallet
        </button>
        <span className="text-xs text-slate-400 font-mono">Order: {orderId}</span>
      </div>

      {/* Main Soda-Pay Checkout Card Container (Exact Match of Screenshot 2) */}
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden flex flex-col items-center p-6 md:p-8 space-y-6">
        
        {/* Card Header (PAY Logo & Amount) */}
        <div className="w-full flex items-center justify-between pb-6 border-b border-slate-100">
          <div className="text-3xl font-black tracking-tighter text-slate-900 font-mono">
            PAY
          </div>
          <div className="text-right">
            <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Amount</div>
            <div className="text-2xl font-extrabold text-slate-900">{parseFloat(amount).toFixed(2)}</div>
          </div>
        </div>

        {/* Status Graphic (Yellow Wallet Icon with Exclamation Mark) */}
        <div className="relative flex items-center justify-center my-2">
          <div className="w-24 h-24 bg-amber-100/80 rounded-3xl flex items-center justify-center text-amber-500 shadow-inner">
            <svg className="w-14 h-14" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20 7h-4V5c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zM10 5h4v2h-4V5zm10 14H4V9h16v10z"/>
              <path d="M12 11h2v4h-2zm0 5h2v2h-2z" />
            </svg>
          </div>
          <div className="absolute top-1 right-1 w-7 h-7 bg-amber-400 rounded-full flex items-center justify-center text-slate-950 font-bold text-base shadow-md">
            !
          </div>
        </div>

        {/* Bilingual Status Text (Arabic / Urdu + English) */}
        <div className="text-center space-y-2">
          <div className="text-2xl font-bold text-amber-500 font-serif leading-tight">
            الاداءية قيد الانتظار
          </div>
          <div className="text-xl font-bold text-amber-500 leading-tight">
            Please open the app to make payment
          </div>
          <div className="text-lg font-bold text-amber-500 font-sans leading-tight">
            ادائیگی کے لیے براہ کرم ایپ کھولیں۔
          </div>
        </div>

        {/* Request Details Tag */}
        <div className="text-center space-y-1 pt-2">
          <div className="text-lg font-bold text-blue-600">
            Payment Request Sent
          </div>
          <div className="text-base font-semibold text-slate-700 tracking-wide">
            A/C {phone}
          </div>
        </div>

        {/* Step-by-step Instructions (English & Urdu Exact Match) */}
        <div className="w-full bg-slate-50/80 rounded-2xl p-4 border border-slate-100 space-y-3 text-left">
          <div className="text-sm font-bold text-slate-900">
            Please follow these steps:
          </div>
          <ol className="text-xs text-slate-600 space-y-2 font-medium">
            <li className="flex items-start gap-2">
              <span className="font-bold text-slate-800">1.</span>
              <span>Check your app for payment notification</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-slate-800">2.</span>
              <span>Find &quot;My Approvals&quot; in your app</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-slate-800">3.</span>
              <span>Accept the transaction request to complete payment</span>
            </li>
          </ol>

          <div className="text-xs text-slate-500 pt-2 border-t border-slate-200/60 leading-relaxed font-sans text-rightDir dir-rtl">
            میں کے پیغام کی اطلاع پر کلک کریں یا براہ کرم تلاش کریں &quot;Payment Request&quot; تاکہ لین دین کی درخواست کو قبول کیا جا سکے۔
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="w-full pt-2 space-y-2">
          <button
            onClick={() => setLocation("/wallet")}
            className="w-full py-3.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm shadow-md transition"
          >
            I Have Accepted Payment · Return to Wallet
          </button>
        </div>

      </div>

      {/* Security Footer */}
      <div className="mt-6 text-xs text-slate-400 flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5 text-slate-400" /> Protected by 256-Bit Encrypted Gateway Payment Proxy
      </div>
    </div>
  );
}
