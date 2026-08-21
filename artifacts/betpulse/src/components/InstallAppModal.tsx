import { useState, useEffect } from "react";
import { Smartphone, Download, Check, X, ShieldCheck } from "lucide-react";

export function InstallAppModal() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if app is running in standalone mode (already installed)
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setIsInstalled(true);
        setDeferredPrompt(null);
        setShowModal(false);
      }
    } else {
      // Fallback instruction for Android / iOS
      alert("To install BetPulse App:\n1. Tap your browser menu (⋮ or share icon)\n2. Select 'Add to Home Screen' or 'Install App'");
    }
  };

  if (isInstalled) return null;

  return (
    <>
      {/* Floating App Banner / Button */}
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all hover:scale-105 active:scale-95 animate-pulse"
        style={{
          background: "linear-gradient(135deg, #10b981, #059669)",
          color: "#ffffff",
          boxShadow: "0 0 14px rgba(16,185,129,0.4)"
        }}
      >
        <Smartphone size={14} />
        <span>Download App</span>
      </button>

      {/* Modal Popup */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div
            className="relative w-full max-w-sm rounded-2xl p-6 text-center shadow-2xl border"
            style={{
              background: "#081c0e",
              borderColor: "rgba(245,197,66,0.3)",
              boxShadow: "0 0 30px rgba(0,0,0,0.8)"
            }}
          >
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X size={20} />
            </button>

            <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: "linear-gradient(135deg, #d4a017, #f5c542)", boxShadow: "0 0 20px rgba(245,197,66,0.4)" }}>
              <Smartphone size={32} className="text-[#081c0e]" />
            </div>

            <h3 className="text-xl font-extrabold text-white mb-1">Install BetPulse App</h3>
            <p className="text-xs text-gray-300 mb-5 leading-relaxed">
              Get the fast, full-screen Android & iOS app experience directly on your mobile home screen!
            </p>

            <div className="space-y-2.5 mb-6 text-left text-xs text-gray-200">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
                <span>100% Safe & Secure Official App</span>
              </div>
              <div className="flex items-center gap-2">
                <Check size={16} className="text-emerald-400 shrink-0" />
                <span>Fast loading & full-screen gaming</span>
              </div>
              <div className="flex items-center gap-2">
                <Check size={16} className="text-emerald-400 shrink-0" />
                <span>Instant access without opening browser</span>
              </div>
            </div>

            <button
              onClick={handleInstallClick}
              className="w-full py-3 rounded-xl font-bold text-sm transition-all hover:brightness-110 active:scale-98 flex items-center justify-center gap-2 shadow-lg"
              style={{
                background: "linear-gradient(135deg, #f5c542, #d4a017)",
                color: "#081c0e"
              }}
            >
              <Download size={18} />
              <span>Install BetPulse App Now</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
