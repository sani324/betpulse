import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRegister, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const PERKS = [
  { icon: "🎁", title: "Welcome Bonus", desc: "PKR 50,000 free credits to start" },
  { icon: "🏏", title: "Cricket & Casino", desc: "Bet on PSL, IPL, Dragon Tiger & more" },
  { icon: "🔒", title: "100% Secure", desc: "Your money & data are always safe" },
  { icon: "📱", title: "Works Everywhere", desc: "Bet from any device, anytime" },
];

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const registerMutation = useRegister();

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { username: "", email: "", password: "" },
  });

  function onSubmit(values: z.infer<typeof registerSchema>) {
    registerMutation.mutate({ data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        toast({ title: "Welcome to BetPulse! 🎉", description: "Your account has been created." });
        setLocation("/");
      },
      onError: (error: any) => {
        toast({
          title: "Sign Up Failed",
          description: error.response?.data?.error || "Could not create account. Please try again.",
          variant: "destructive",
        });
      },
    });
  }

  const { handleSubmit, register, formState: { errors } } = form;

  return (
    <div className="flex min-h-screen flex-col md:flex-row" style={{ fontFamily: "system-ui, sans-serif" }}>

      {/* ── LEFT HERO PANEL ── */}
      <div className="hidden md:flex md:flex-col md:justify-center" style={{
        flex: "0 0 52%",
        position: "relative",
        overflow: "hidden",
        padding: "40px 48px",
        background: "linear-gradient(150deg, #1e1b4b 0%, #1a3a5c 35%, #065f46 75%, #064e3b 100%)",
      }}>
        {/* Background glow circles */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <div style={{ position: "absolute", top: -60, left: -60, width: 320, height: 320, borderRadius: "50%", background: "rgba(99,102,241,0.15)" }} />
          <div style={{ position: "absolute", bottom: -80, right: -40, width: 380, height: 380, borderRadius: "50%", background: "rgba(16,185,129,0.12)" }} />
          <div style={{ position: "absolute", top: "60%", left: "30%", width: 180, height: 180, borderRadius: "50%", background: "rgba(245,158,11,0.08)" }} />
        </div>

        {/* Decorative card shapes */}
        {[
          { top: "8%", right: "10%", rotate: "15deg", size: 64, emoji: "🂾", opacity: 0.15 },
          { top: "15%", right: "22%", rotate: "-8deg", size: 50, emoji: "🂡", opacity: 0.12 },
          { bottom: "12%", left: "8%", rotate: "-12deg", size: 56, emoji: "🃁", opacity: 0.12 },
          { bottom: "20%", left: "22%", rotate: "10deg", size: 44, emoji: "🎴", opacity: 0.1 },
        ].map((c, i) => (
          <div key={i} style={{
            position: "absolute", top: c.top, bottom: c.bottom, left: c.left, right: c.right,
            fontSize: c.size, transform: `rotate(${c.rotate})`,
            opacity: c.opacity, pointerEvents: "none", userSelect: "none",
            filter: "blur(1px)",
          }}>
            {c.emoji}
          </div>
        ))}

        {/* Content */}
        <div style={{ position: "relative", zIndex: 1 }}>
          {/* Brand */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 36 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: "linear-gradient(135deg, #10b981, #059669)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, boxShadow: "0 4px 15px rgba(16,185,129,0.4)",
            }}>🎯</div>
            <span style={{ fontSize: 26, fontWeight: 800, color: "white", letterSpacing: 1 }}>BetPulse</span>
          </div>

          <h1 style={{ fontSize: 38, fontWeight: 800, color: "white", lineHeight: 1.2, marginBottom: 14 }}>
            Join 50,000+<br />
            <span style={{ color: "#34d399" }}>Smart Bettors</span>
          </h1>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.65)", marginBottom: 40, lineHeight: 1.6 }}>
            Create your free account and start winning today. PKR deposits, instant payouts, and the best odds in Pakistan.
          </p>

          {/* Perk cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {PERKS.map((p) => (
              <div key={p.title} style={{
                background: "rgba(255,255,255,0.08)",
                backdropFilter: "blur(10px)",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.12)",
                padding: "16px",
              }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>{p.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "white", marginBottom: 4 }}>{p.title}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", lineHeight: 1.4 }}>{p.desc}</div>
              </div>
            ))}
          </div>

          {/* Social proof */}
          <div style={{
            marginTop: 28, padding: "14px 18px",
            background: "rgba(52,211,153,0.15)",
            border: "1px solid rgba(52,211,153,0.25)",
            borderRadius: 12, display: "flex", alignItems: "center", gap: 14,
          }}>
            <div style={{ fontSize: 28 }}>🏆</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#34d399" }}>Top Winner This Week</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                User "bet_king22" won <strong style={{ color: "white" }}>PKR 4,20,000</strong> on Teen Patti!
              </div>
            </div>
          </div>
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
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🚀</div>
            <h2 style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>
              Create Your Account
            </h2>
            <p style={{ fontSize: 14, color: "#64748b" }}>Free to join — start betting in 30 seconds</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                Username
              </label>
              <input
                type="text"
                placeholder="betking99"
                data-testid="input-username"
                {...register("username")}
                style={{
                  width: "100%", padding: "12px 16px", borderRadius: 10,
                  border: `1.5px solid ${errors.username ? "#ef4444" : "#e2e8f0"}`,
                  fontSize: 15, color: "#0f172a", background: "white",
                  outline: "none", boxSizing: "border-box",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                }}
              />
              {errors.username && <p style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>{errors.username.message}</p>}
            </div>

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
                placeholder="At least 6 characters"
                autoComplete="new-password"
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

            {/* Age disclaimer */}
            <p style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", lineHeight: 1.5 }}>
              By signing up you confirm you are 18+ years old and agree to our Terms of Service.
            </p>

            <button
              type="submit"
              data-testid="button-register"
              disabled={registerMutation.isPending}
              style={{
                width: "100%", padding: "14px",
                borderRadius: 12, border: "none",
                background: registerMutation.isPending
                  ? "#94a3b8"
                  : "linear-gradient(135deg, #059669 0%, #065f46 100%)",
                color: "white", fontWeight: 700, fontSize: 16,
                cursor: registerMutation.isPending ? "not-allowed" : "pointer",
                boxShadow: registerMutation.isPending ? "none" : "0 4px 15px rgba(5,150,105,0.35)",
                transition: "all 0.2s",
                letterSpacing: 0.5,
              }}
            >
              {registerMutation.isPending ? "Creating account..." : "Create Free Account 🎉"}
            </button>
          </form>

          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0" }}>
            <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
            <span style={{ fontSize: 12, color: "#94a3b8" }}>Already have an account?</span>
            <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
          </div>

          <Link href="/login">
            <button style={{
              width: "100%", padding: "13px",
              borderRadius: 12,
              border: "2px solid #e2e8f0",
              background: "white", color: "#0f172a",
              fontWeight: 600, fontSize: 15,
              cursor: "pointer",
            }}>
              Log In Instead
            </button>
          </Link>

          {/* Trust row */}
          <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 24 }}>
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
