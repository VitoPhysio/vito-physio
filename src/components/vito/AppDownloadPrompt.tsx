import { Capacitor } from "@capacitor/core";
import { Download, Smartphone, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

const APK_URL =
  "https://files.manuscdn.com/user_upload_by_module/session_file/310519663441912362/TIKvJunOHigcegKD.apk";
const DISMISS_KEY = "vito-android-download-prompt-dismissed";

function isAndroidBrowser() {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent) && !Capacitor.isNativePlatform();
}

export function AppDownloadPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isAndroidBrowser()) return;
    if (window.localStorage.getItem(DISMISS_KEY) === "1") return;
    setVisible(true);
  }, []);

  if (!visible) return null;

  function dismiss() {
    window.localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  return (
    <aside
      className="fixed inset-x-3 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-[80] mx-auto max-w-lg rounded-2xl border border-primary/15 bg-card/95 p-4 text-card-foreground shadow-2xl backdrop-blur supports-[backdrop-filter]:bg-card/85 print:hidden"
      role="status"
      aria-label="Download the Vito Physio Android app"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss app download message"
        className="absolute right-2 top-2 inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <X className="size-4" />
      </button>

      <div className="flex items-start gap-3 pr-7">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <Smartphone className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="font-bold leading-tight">Get Vito Physio on your phone</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Install the Android app for quicker access. You can continue using the website instead.
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 pl-14">
        <Button asChild size="sm" className="gap-2">
          <a href={APK_URL} download="vito-physio.apk">
            <Download className="size-4" aria-hidden="true" />
            Download app
          </a>
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={dismiss}>
          Not now
        </Button>
      </div>
    </aside>
  );
}
