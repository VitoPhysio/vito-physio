import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { Download, RefreshCw, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  APK_DOWNLOAD_URL,
  APP_NAME,
  APP_VERSION_MANIFEST_URL,
  compareVersions,
} from "@/lib/app-release";

type VersionManifest = {
  version?: string;
  apkUrl?: string;
  releaseNotes?: string;
};

const DISMISS_PREFIX = "vito-app-update-dismissed:";

function isAndroidApp() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export function AppUpdatePrompt() {
  const [update, setUpdate] = useState<VersionManifest | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isAndroidApp()) return;
    let active = true;

    async function checkForUpdate() {
      try {
        const [{ version: installedVersion }, response] = await Promise.all([
          App.getInfo(),
          fetch(`${APP_VERSION_MANIFEST_URL}?t=${Date.now()}`, { cache: "no-store" }),
        ]);
        if (!response.ok) return;
        const manifest = (await response.json()) as VersionManifest;
        if (!manifest.version || compareVersions(manifest.version, installedVersion) <= 0) {
          if (active) setUpdate(null);
          return;
        }
        if (!active) return;
        setDismissed(window.sessionStorage.getItem(`${DISMISS_PREFIX}${manifest.version}`) === "1");
        setUpdate(manifest);
      } catch {
        // An update check must never prevent the current app from working.
      }
    }

    void checkForUpdate();
    const listener = App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) {
        setDismissed(false);
        void checkForUpdate();
      }
    });

    return () => {
      active = false;
      void listener.then((handle) => handle.remove());
    };
  }, []);

  if (!update?.version || dismissed) return null;

  const downloadUrl = APK_DOWNLOAD_URL;
  const dismiss = () => {
    window.sessionStorage.setItem(`${DISMISS_PREFIX}${update.version}`, "1");
    setDismissed(true);
  };

  return (
    <aside
      className="fixed inset-x-3 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-[200] mx-auto max-w-lg rounded-lg border border-primary/20 bg-card p-4 text-card-foreground shadow-2xl print:hidden"
      role="status"
      aria-label={`${APP_NAME} update available`}
    >
      <Button
        variant="ghost"
        size="icon"
        type="button"
        onClick={dismiss}
        aria-label="Dismiss update notification"
        className="absolute right-2 top-2 inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <X className="size-4" />
      </Button>

      <div className="flex items-start gap-3 pr-7">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <RefreshCw className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="font-bold leading-tight">A new Vito Physio update is ready</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Version {update.version} is ready. Tap Update app, open the downloaded file, then confirm Install.
          </p>
          {update.releaseNotes && (
            <p className="mt-2 text-xs text-muted-foreground">{update.releaseNotes}</p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 pl-14">
        <Button asChild size="sm" className="gap-2">
          <a href={downloadUrl} download="VitoPhysio.apk" target="_system" rel="noopener noreferrer">
            <Download className="size-4" aria-hidden="true" />
            Update app
          </a>
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={dismiss}>
          Continue later
        </Button>
      </div>
    </aside>
  );
}
