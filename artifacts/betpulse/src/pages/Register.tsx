import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getGetMeQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";

const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

const PERKS = [
  { icon: "🎁", title: "Welcome Bonus", desc: "PKR 50,000 free credits to start" },
  { icon: "🏏", title: "Cricket & Casino", desc: "Bet on PSL, IPL, Dragon Tiger & more" },
  { icon: "🔒", title: "100% Secure", desc: "Your money & data are always safe" },
  { icon: "📱", title: "Works Everywhere", desc: "Bet from any device, anytime" },
];

type Step = "info" | "otp" | "done";

function inputStyle(hasError: boolean) {
  return {
    width: "100%", padding: "12px 16px", borderRadius: 10,
    border: `1.5px solid ${hasError ? "#ef4444" : "#e2e8f0"}`,
    fontSize: 15, color: "#0f172a", background: "white",
    outline: "none", boxSizing: "border-box" as const,
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
  };
}

function ErrorMsg({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>{msg}</p>;
}

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>("info");
  const [loading, setLoading] = useState(false);

  // Step 1 fields
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Step 2 OTP
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function startResendTimer() {
    setResendCountdown(60);
    countdownRef.current = setInterval(() => {
      setResendCountdown(prev => {
        if (prev <= 1) { clearInterval(countdownRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  }

  function validateStep1() {
    const errs: Record<string, string> = {};
    if (username.trim().length < 3) errs.username = "Username must be at least 3 characters";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "Enter a valid email address";
    if (password.length < 6) errs.password = "Password must be at least 6 characters";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSendOtp() {
    if (!validateStep1()) return;
    setLoading(true);
    setErrors({});
    try {
      const r = await fetch(`${API}/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
        credentials: "include",
      });
      const data = await r.json();
      if (!r.ok) {
        setErrors({ global: data.error ?? "Failed to send verification code" });
        setLoading(false);
        return;
      }
      if (data.devOtp) {
        setDevOtpHint(data.devOtp);
        setOtp(data.devOtp.split(""));
      }
      setStep("otp");
      startResendTimer();
    } catch {
      setErrors({ global: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  async function handleResendOtp() {
    if (resendCountdown > 0) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
        credentials: "include",
      });
      const data = await r.json();
      if (r.ok) {
        if (data.devOtp) { setDevOtpHint(data.devOtp); setOtp(data.devOtp.split("")); }
        startResendTimer();
        toast({ title: "Code resent!", description: "Check your email for the new code." });
      } else {
        setErrors({ otp: data.error ?? "Failed to resend" });
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    const code = otp.join("");
    if (code.length < 6) { setErrors({ otp: "Enter all 6 digits" }); return; }
    setLoading(true);
    setErrors({});
    try {
      const r = await fetch(`${API}/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: code }),
        credentials: "include",
      });
      const data = await r.json();
      if (!r.ok) { setErrors({ otp: data.error ?? "Invalid code" }); setLoading(false); return; }
      await handleRegister(data.token);
    } catch {
      setErrors({ otp: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(token: string) {
    const r = await fetch(`${API}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password, verificationToken: token }),
      credentials: "include",
    });
    const data = await r.json();
    if (!r.ok) { setErrors({ otp: data.error ?? "Could not create account" }); return; }
    queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
    setStep("done");
    setTimeout(() => setLocation("/"), 2500);
    toast({ title: "Welcome to BetPulse! 🎉", description: "Your account has been created." });
  }

  function handleOtpKey(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && otp[idx] === "" && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    }
  }

  function handleOtpChange(idx: number, val: string) {
    const digit = val.replace(/\D/g, "").slice(-1);
    const next = [...otp];
    next[idx] = digit;
    setOtp(next);
    if (digit && idx < 5) otpRefs.current[idx + 1]?.focus();
  }

  const stepDot = (n: number, active: boolean, done: boolean) => (
    <div style={{
      width: 30, height: 30, borderRadius: "50%", display: "flex",
      alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700,
      background: done ? "#d1fae5" : active ? "#059669" : "#e2e8f0",
      color: done ? "#059669" : active ? "white" : "#94a3b8",
    }}>{done ? "✓" : n}</div>
  );

  return (
    <div className="flex min-h-screen flex-col md:flex-row" style={{ fontFamily: "system-ui, sans-serif" }}>

      {/* ── LEFT HERO ── */}
      <div className="hidden md:flex md:flex-col md:justify-center" style={{
        flex: "0 0 52%", position: "relative", overflow: "hidden", padding: "40px 48px",
        background: "linear-gradient(150deg, #1e1b4b 0%, #1a3a5c 35%, #065f46 75%, #064e3b 100%)",
      }}>
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <div style={{ position: "absolute", top: -60, left: -60, width: 320, height: 320, borderRadius: "50%", background: "rgba(99,102,241,0.15)" }} />
          <div style={{ position: "absolute", bottom: -80, right: -40, width: 380, height: 380, borderRadius: "50%", background: "rgba(16,185,129,0.12)" }} />
        </div>
        {[
          { top: "8%", right: "10%", rotate: "15deg", size: 64, emoji: "🂾", opacity: 0.15 },
          { top: "15%", right: "22%", rotate: "-8deg", size: 50, emoji: "🂡", opacity: 0.12 },
          { bottom: "12%", left: "8%", rotate: "-12deg", size: 56, emoji: "🃁", opacity: 0.12 },
          { bottom: "20%", left: "22%", rotate: "10deg", size: 44, emoji: "🎴", opacity: 0.1 },
        ].map((c, i) => (
          <div key={i} style={{
            position: "absolute", top: c.top, bottom: c.bottom, left: c.left, right: c.right,
            fontSize: c.size, transform: `rotate(${c.rotate})`,
            opacity: c.opacity, pointerEvents: "none", userSelect: "none", filter: "blur(1px)",
          }}>{c.emoji}</div>
        ))}
        <div style={{ position: "relative", zIndex: 1 }}>
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
            Join 50,000+<br /><span style={{ color: "#34d399" }}>Smart Bettors</span>
          </h1>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.65)", marginBottom: 40, lineHeight: 1.6 }}>
            Create your free account and start winning today. PKR deposits, instant payouts, and the best odds in Pakistan.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {PERKS.map((p) => (
              <div key={p.title} style={{
                background: "rgba(255,255,255,0.08)", backdropFilter: "blur(10px)",
                borderRadius: 14, border: "1px solid rgba(255,255,255,0.12)", padding: "16px",
              }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>{p.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "white", marginBottom: 4 }}>{p.title}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", lineHeight: 1.4 }}>{p.desc}</div>
              </div>
            ))}
          </div>
          <div style={{
            marginTop: 28, padding: "14px 18px",
            background: "rgba(52,211,153,0.15)", border: "1px solid rgba(52,211,153,0.25)",
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
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        background: "#f8fafc", padding: "40px 32px",
      }}>
        <div style={{ width: "100%", maxWidth: 420 }}>

          {/* ── STEP 1: Account Info ── */}
          {step === "info" && (
            <>
              <div style={{ textAlign: "center", marginBottom: 28 }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>🚀</div>
                <h2 style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>Create Your Account</h2>
                <p style={{ fontSize: 14, color: "#64748b" }}>We'll email you a code to confirm it's really you</p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24, justifyContent: "center" }}>
                {stepDot(1, true, false)}
                <div style={{ flex: 1, height: 2, background: "#e2e8f0", maxWidth: 60 }} />
                {stepDot(2, false, false)}
                <div style={{ flex: 1, height: 2, background: "#e2e8f0", maxWidth: 60 }} />
                {stepDot(3, false, false)}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {errors.global && (
                  <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", color: "#dc2626", fontSize: 13 }}>
                    ⚠️ {errors.global}
                  </div>
                )}

                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Username</label>
                  <input
                    type="text" placeholder="betking99" data-testid="input-username"
                    value={username} onChange={e => setUsername(e.target.value)}
                    style={inputStyle(!!errors.username)}
                  />
                  <ErrorMsg msg={errors.username} />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                    Email Address <span style={{ color: "#059669", fontWeight: 500, fontSize: 12 }}>— verification code sent here</span>
                  </label>
                  <input
                    type="email" placeholder="you@gmail.com" autoComplete="email" data-testid="input-email"
                    value={email} onChange={e => setEmail(e.target.value)}
                    style={inputStyle(!!errors.email)}
                  />
                  {errors.email
                    ? <ErrorMsg msg={errors.email} />
                    : <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>Fake/invalid emails are automatically blocked</p>
                  }
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Password</label>
                  <input
                    type="password" placeholder="At least 6 characters" autoComplete="new-password" data-testid="input-password"
                    value={password} onChange={e => setPassword(e.target.value)}
                    style={inputStyle(!!errors.password)}
                  />
                  <ErrorMsg msg={errors.password} />
                </div>

                <p style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", lineHeight: 1.5 }}>
                  By signing up you confirm you are 18+ years old and agree to our Terms of Service.
                </p>

                <button
                  type="button" data-testid="button-register"
                  onClick={handleSendOtp} disabled={loading}
                  style={{
                    width: "100%", padding: "14px", borderRadius: 12, border: "none",
                    background: loading ? "#94a3b8" : "linear-gradient(135deg, #059669 0%, #065f46 100%)",
                    color: "white", fontWeight: 700, fontSize: 16,
                    cursor: loading ? "not-allowed" : "pointer",
                    boxShadow: loading ? "none" : "0 4px 15px rgba(5,150,105,0.35)",
                    transition: "all 0.2s",
                  }}
                >
                  {loading ? "Checking..." : "Send Verification Code →"}
                </button>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0" }}>
                <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
                <span style={{ fontSize: 12, color: "#94a3b8" }}>Already have an account?</span>
                <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
              </div>
              <Link href="/login">
                <button style={{
                  width: "100%", padding: "13px", borderRadius: 12,
                  border: "2px solid #e2e8f0", background: "white", color: "#0f172a",
                  fontWeight: 600, fontSize: 15, cursor: "pointer",
                }}>Log In Instead</button>
              </Link>

              <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 24 }}>
                {[{ icon: "🔒", text: "SSL Secured" }, { icon: "🏦", text: "PKR Supported" }, { icon: "⚡", text: "Instant Payouts" }].map(b => (
                  <div key={b.text} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 18 }}>{b.icon}</div>
                    <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{b.text}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── STEP 2: Email OTP ── */}
          {step === "otp" && (
            <>
              <div style={{ textAlign: "center", marginBottom: 28 }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>📧</div>
                <h2 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>Check Your Email</h2>
                <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6 }}>
                  We sent a 6-digit code to<br />
                  <strong style={{ color: "#059669", fontSize: 15 }}>{email}</strong>
                </p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 28, justifyContent: "center" }}>
                {stepDot(1, false, true)}
                <div style={{ flex: 1, height: 2, background: "#059669", maxWidth: 60 }} />
                {stepDot(2, true, false)}
                <div style={{ flex: 1, height: 2, background: "#e2e8f0", maxWidth: 60 }} />
                {stepDot(3, false, false)}
              </div>

              {/* Dev mode hint */}
              {devOtpHint && (
                <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#92400e", marginBottom: 4 }}>🔧 Demo Mode — Email service not yet connected</div>
                  <div style={{ fontSize: 14, color: "#78350f" }}>Your code: <strong style={{ fontSize: 22, letterSpacing: 4 }}>{devOtpHint}</strong></div>
                  <div style={{ fontSize: 11, color: "#a16207", marginTop: 4 }}>In production this goes directly to your inbox</div>
                </div>
              )}

              {errors.otp && (
                <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", color: "#dc2626", fontSize: 13, marginBottom: 16 }}>
                  ⚠️ {errors.otp}
                </div>
              )}

              {/* 6-digit boxes */}
              <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 20 }}>
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={el => { otpRefs.current[idx] = el; }}
                    type="text" inputMode="numeric" maxLength={1}
                    value={digit}
                    onChange={e => handleOtpChange(idx, e.target.value)}
                    onKeyDown={e => handleOtpKey(idx, e)}
                    style={{
                      width: 52, height: 60, borderRadius: 12,
                      border: `2px solid ${digit ? "#059669" : "#e2e8f0"}`,
                      fontSize: 24, fontWeight: 800, color: "#0f172a",
                      textAlign: "center", background: digit ? "#f0fdf4" : "white",
                      outline: "none", transition: "all 0.15s",
                    }}
                  />
                ))}
              </div>

              <button
                type="button" onClick={handleVerifyOtp}
                disabled={loading || otp.join("").length < 6}
                style={{
                  width: "100%", padding: "14px", borderRadius: 12, border: "none",
                  background: (loading || otp.join("").length < 6) ? "#94a3b8" : "linear-gradient(135deg, #059669 0%, #065f46 100%)",
                  color: "white", fontWeight: 700, fontSize: 16,
                  cursor: (loading || otp.join("").length < 6) ? "not-allowed" : "pointer",
                  boxShadow: "0 4px 15px rgba(5,150,105,0.35)", marginBottom: 16,
                }}
              >
                {loading ? "Verifying..." : "Verify & Create Account 🎉"}
              </button>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => { setStep("info"); setOtp(["","","","","",""]); setDevOtpHint(null); setErrors({}); }}
                  style={{ background: "none", border: "none", color: "#64748b", fontSize: 13, cursor: "pointer", padding: 0 }}
                >
                  ← Change email
                </button>
                <button
                  type="button" onClick={handleResendOtp}
                  disabled={resendCountdown > 0 || loading}
                  style={{
                    background: "none", border: "none", fontSize: 13,
                    cursor: resendCountdown > 0 ? "not-allowed" : "pointer",
                    color: resendCountdown > 0 ? "#94a3b8" : "#059669",
                    fontWeight: 600, padding: 0,
                  }}
                >
                  {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : "Resend code"}
                </button>
              </div>
            </>
          )}

          {/* ── STEP 3: Done ── */}
          {step === "done" && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ fontSize: 64, marginBottom: 20 }}>🎉</div>
              <h2 style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", marginBottom: 12 }}>You're In!</h2>
              <p style={{ fontSize: 16, color: "#64748b", marginBottom: 24 }}>
                Email verified and account created.<br />Taking you to the lobby...
              </p>
              <div style={{
                background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 14,
                padding: "16px 20px", display: "inline-flex", alignItems: "center", gap: 12,
              }}>
                <span style={{ fontSize: 28 }}>🎁</span>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#15803d" }}>Welcome Bonus Added!</div>
                  <div style={{ fontSize: 12, color: "#166534" }}>PKR 50,000 has been credited to your account</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
