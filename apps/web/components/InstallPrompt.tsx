"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    /* Already installed as PWA */
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsStandalone(true);
      return;
    }

    /* Check if iOS */
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent) && !("MSStream" in window);
    setIsIOS(isIOSDevice);

    /* Check if user already dismissed */
    try {
      const last = localStorage.getItem("pwa-install-dismissed");
      if (last) {
        const elapsed = Date.now() - Number(last);
        /* Re-show after 3 days */
        if (elapsed < 3 * 24 * 60 * 60 * 1000) {
          setDismissed(true);
        }
      }
    } catch { /* ignore */ }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === "accepted") {
      setDeferredPrompt(null);
      setIsStandalone(true);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem("pwa-install-dismissed", String(Date.now()));
    } catch { /* ignore */ }
  };

  if (isStandalone || dismissed) return null;
  if (!deferredPrompt && !isIOS) return null;

  return (
    <div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom,0px)+0.5rem)] left-3 right-3 z-[60] flex items-center gap-3 rounded-xl border border-primary/20 bg-white p-3 shadow-[0_12px_40px_rgba(159,18,57,0.15)] md:hidden">
      <span
        className="material-symbols-outlined shrink-0 rounded-lg bg-primary/10 p-2 text-primary"
        style={{ fontSize: 24 }}
      >
        {isIOS ? "ios_share" : "install_mobile"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-on-surface">
          {isIOS ? "Install App on iOS" : "Install App"}
        </p>
        <p className="text-[11px] text-on-secondary-container leading-tight">
          {isIOS 
            ? "Tap Share then 'Add to Home Screen'" 
            : "Add to home screen for faster access"}
        </p>
      </div>
      {!isIOS && (
        <button
          onClick={handleInstall}
          className="shrink-0 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white transition active:scale-95"
        >
          Install
        </button>
      )}
      <button
        onClick={handleDismiss}
        className="material-symbols-outlined shrink-0 rounded-md p-1 text-on-secondary-container/50 transition hover:text-on-surface"
        style={{ fontSize: 18 }}
        aria-label="Dismiss"
      >
        close
      </button>
    </div>
  );
}
