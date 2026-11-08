import { Capacitor } from "@capacitor/core";
import { Download, ExternalLink, Share, Smartphone, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { APK_DOWNLOAD_URL, detectWebPlatform, type WebPlatform } from "@/lib/app-release";

const APP_URL_SCHEME = "com.vitophysio.app";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isWebApp() {
  return typeof window !== "undefined" && !Capacitor.isNativePlatform();
}

function isStandaloneApp() {
  if (typeof window === "undefined") return false;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone;
  return window.matchMedia("(display-mode: standalone)").matches || iosStandalone === true;
}

function openPhoneApp() {
  if (typeof window === "undefined") return;
  window.location.assign(`${APP_URL_SCHEME}://`);
}

export function AppDownloadPrompt() {
  const [platform, setPlatform] = useState<WebPlatform | null>(null);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isWebApp() || isStandaloneApp()) return;

    setPlatform(
      detectWebPlatform(navigator.userAgent, navigator.platform, navigator.maxTouchPoints),
    );
    setVisible(true);

    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
  }, []);

  if (!visible || !platform) return null;

  const isIos = platform === "ios";
  const isDesktop = platform === "desktop";

  async function installDesktopPwa() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
    setVisible(false);
  }

  return (
    <aside
      className="fixed inset-x-3 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-[120] mx-auto max-w-lg rounded-2xl border border-primary/15 bg-card/95 p-4 text-card-foreground shadow-2xl backdrop-blur supports-[backdrop-filter]:bg-card/85 print:hidden"
      role="dialog"
      aria-modal="false"
      aria-labelledby="app-download-title"
      aria-describedby="app-download-description"
    >
      <button
        type="button"
        onClick={() => setVisible(false)}
        aria-label="Continue on the website"
        className="absolute right-2 top-2 inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <X className="size-4" />
      </button>

      <div className="flex items-start gap-3 pr-7">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          {isIos ? (
            <Share className="size-5" aria-hidden="true" />
          ) : (
            <Smartphone className="size-5" aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0">
          <p id="app-download-title" className="font-bold leading-tight">
            {isIos
              ? "Add Vito Physio to your Home Screen"
              : isDesktop
                ? "Install Vito Physio on this computer"
                : "Use Vito Physio on Android"}
          </p>
          <p id="app-download-description" className="mt-1 text-sm text-muted-foreground">
            {isIos
              ? "In Safari, tap Share, then choose Add to Home Screen for an app-like experience."
              : isDesktop
                ? installPrompt
                  ? "Install Vito Physio as a standalone app without opening another browser tab."
                  : "In Chrome or Edge, open the browser menu and choose Install Vito Physio or Add to desktop."
                : "Download the Android app for the best phone experience, or open it if it is already installed."}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 pl-14">
        {isIos ? (
          <Button type="button" variant="secondary" size="sm" onClick={() => setVisible(false)}>
            Continue in Safari
          </Button>
        ) : isDesktop ? (
          installPrompt ? (
            <Button
              type="button"
              size="sm"
              className="gap-2"
              onClick={() => void installDesktopPwa()}
            >
              <Download className="size-4" aria-hidden="true" />
              Install desktop app
            </Button>
          ) : null
        ) : (
          <>
            <Button asChild size="sm" className="gap-2">
              <a href={APK_DOWNLOAD_URL} download="Vito-physio.apk">
                <Download className="size-4" aria-hidden="true" />
                Download Android app
              </a>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-2"
              onClick={openPhoneApp}
            >
              <ExternalLink className="size-4" aria-hidden="true" />
              Open Android app
            </Button>
          </>
        )}
        <Button type="button" variant="ghost" size="sm" onClick={() => setVisible(false)}>
          Continue on website
        </Button>
      </div>
    </aside>
  );
}
