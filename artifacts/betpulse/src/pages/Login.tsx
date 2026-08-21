import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLogin, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const HIGHLIGHTS = [
  { icon: "👑", title: "Teen Patti & More", desc: "Classic Indian casino games, live" },
  { icon: "🐉", title: "Dragon Tiger & Casino", desc: "Teen Patti, Lucky 7, Rang" },
  { icon: "💰", title: "Instant PKR Payouts", desc: "Win real money, withdraw anytime" },
];

const STATS = [
  { value: "50K+", label: "Active Users" },
  { value: "PKR 2Cr+", label: "Paid Out" },
  { value: "24/7", label: "Live Events" },
];

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const loginMutation = useLogin();

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  function onSubmit(values: z.infer<typeof loginSchema>) {
    loginMutation.mutate({ data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        setLocation("/");
      },
      onError: (error: any) => {
        toast({
          title: "Login Failed",
          description: error.response?.data?.error || "Wrong email or password. Please try again.",
          variant: "destructive",
        });
      },
    });
  }

  const { handleSubmit, register, formState: { errors, isSubmitting } } = form;

  return (
    <div className="flex min-h-screen flex-col md:flex-row" style={{ fontFamily: "system-ui, sans-serif" }}>

      {/* ── LEFT HERO PANEL ── */}
      <div className="hidden md:flex md:flex-col md:justify-between" style={{
        flex: "0 0 55%",
        position: "relative",
        overflow: "hidden",
        padding: "40px 48px",
        background: "linear-gradient(160deg, #064e3b 0%, #065f46 25%, #1a3a5c 65%, #1e1b4b 100%)",
      }}>
        {/* Background texture circles */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -80, right: -80, width: 400, height: 400, borderRadius: "50%", background: "rgba(16,185,129,0.12)" }} />
          <div style={{ position: "absolute", bottom: -100, left: -60, width: 350, height: 350, borderRadius: "50%", background: "rgba(99,102,241,0.12)" }} />
          <div style={{ position: "absolute", top: "40%", left: "50%", width: 200, height: 200, borderRadius: "50%", background: "rgba(245,158,11,0.08)" }} />
        </div>

        {/* Cricket field arc */}
        <div style={{
          position: "absolute", bottom: -200, left: "50%", transform: "translateX(-50%)",
          width: 700, height: 700, borderRadius: "50%",
          border: "2px solid rgba(255,255,255,0.06)",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", bottom: -280, left: "50%", transform: "translateX(-50%)",
          width: 900, height: 900, borderRadius: "50%",
          border: "1px solid rgba(255,255,255,0.04)",
          pointerEvents: "none",
        }} />

        {/* Logo */}
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 40 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: "linear-gradient(135deg, #10b981, #059669)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, boxShadow: "0 4px 15px rgba(16,185,129,0.4)",
            }}>🎯</div>
            <span style={{ fontSize: 26, fontWeight: 800, color: "white", letterSpacing: 1 }}>BetPulse</span>
          </div>

          {/* Hero text */}
          <h1 style={{ fontSize: 42, fontWeight: 800, color: "white", lineHeight: 1.2, marginBottom: 16 }}>
            Pakistan's #1<br />
            <span style={{ color: "#34d399" }}>Betting Platform</span>
          </h1>
          <p style={{ fontSize: 17, color: "rgba(255,255,255,0.7)", marginBottom: 40, lineHeight: 1.6 }}>
            Bet on cricket, casino card games, and more.<br />Win big with the best odds in PKR.
          </p>

          {/* Stats row */}
          <div style={{ display: "flex", gap: 28, marginBottom: 44 }}>
            {STATS.map(s => (
              <div key={s.label}>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#34d399" }}>{s.value}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Game highlight cards */}
        <div style={{ position: "relative", zIndex: 1 }}>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", letterSpacing: 2, marginBottom: 16, textTransform: "uppercase" }}>
            What's available
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {HIGHLIGHTS.map((h) => (
              <div key={h.title} style={{
                display: "flex", alignItems: "center", gap: 14,
                background: "rgba(255,255,255,0.08)",
                backdropFilter: "blur(10px)",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.12)",
                padding: "14px 18px",
              }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 10, flexShrink: 0,
                  background: "rgba(255,255,255,0.1)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 20,
                }}>{h.icon}</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "white" }}>{h.title}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>{h.desc}</div>
                </div>
                <div style={{ marginLeft: "auto", background: "rgba(52,211,153,0.2)", borderRadius: 20, padding: "3px 10px", fontSize: 11, color: "#34d399", fontWeight: 600 }}>
                  LIVE
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom trust badge */}
        <div style={{ position: "relative", zIndex: 1, marginTop: 28, display: "flex", gap: 20 }}>
          {["🔒 Secure & Safe", "⚡ Instant Payouts", "🏆 Trusted Platform"].map(t => (
            <span key={t} style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>{t}</span>
          ))}
        </div>
      </div>

      {/* ── RIGHT FORM PANEL ── */}
      <div style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f8fafc",
        padding: "40px 32px",
      }}>
        <div style={{ width: "100%", maxWidth: 400 }}>
          {/* Mobile logo & Back button */}
          <div style={{ marginBottom: 24, display: "flex", itemsCenter: "center", justifyContent: "space-between" }}>
            <button
              type="button"
              onClick={() => setLocation("/")}
              style={{ background: "#e2e8f0", border: "none", borderRadius: 10, padding: "6px 12px", fontSize: 13, fontWeight: 700, color: "#334155", cursor: "pointer" }}
            >
              ← Back
            </button>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>BetPulse</span>
          </div>

          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>👋</div>
            <h2 style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>
              Welcome back!
            </h2>
            <p style={{ fontSize: 14, color: "#64748b" }}>Login to your BetPulse account</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                Email Address
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                data-testid="input-email"
                {...register("email")}
                style={{
                  width: "100%", padding: "12px 16px", borderRadius: 10,
                  border: `1.5px solid ${errors.email ? "#ef4444" : "#e2e8f0"}`,
                  fontSize: 15, color: "#0f172a", background: "white",
                  outline: "none", boxSizing: "border-box",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                }}
              />
              {errors.email && <p style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>{errors.email.message}</p>}
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                data-testid="input-password"
                {...register("password")}
                style={{
                  width: "100%", padding: "12px 16px", borderRadius: 10,
                  border: `1.5px solid ${errors.password ? "#ef4444" : "#e2e8f0"}`,
                  fontSize: 15, color: "#0f172a", background: "white",
                  outline: "none", boxSizing: "border-box",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                }}
              />
              {errors.password && <p style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              data-testid="button-login"
              disabled={loginMutation.isPending}
              style={{
                width: "100%", padding: "14px",
                borderRadius: 12, border: "none",
                background: loginMutation.isPending
                  ? "#94a3b8"
                  : "linear-gradient(135deg, #059669 0%, #065f46 100%)",
                color: "white", fontWeight: 700, fontSize: 16,
                cursor: loginMutation.isPending ? "not-allowed" : "pointer",
                boxShadow: loginMutation.isPending ? "none" : "0 4px 15px rgba(5,150,105,0.35)",
                transition: "all 0.2s",
                letterSpacing: 0.5,
              }}
            >
              {loginMutation.isPending ? "Logging in..." : "Login to BetPulse →"}
            </button>
          </form>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "24px 0" }}>
            <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
            <span style={{ fontSize: 12, color: "#94a3b8" }}>New to BetPulse?</span>
            <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
          </div>

          <Link href="/register">
            <button style={{
              width: "100%", padding: "13px",
              borderRadius: 12,
              border: "2px solid #e2e8f0",
              background: "white", color: "#0f172a",
              fontWeight: 600, fontSize: 15,
              cursor: "pointer",
              transition: "all 0.2s",
            }}>
              Create Free Account
            </button>
          </Link>

          {/* Trust badges */}
          <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 28 }}>
            {[
              { icon: "🔒", text: "SSL Secured" },
              { icon: "🏦", text: "PKR Supported" },
              { icon: "⚡", text: "Instant Payouts" },
            ].map(b => (
              <div key={b.text} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 18 }}>{b.icon}</div>
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{b.text}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
