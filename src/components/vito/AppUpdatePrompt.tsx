import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
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

type LatestRelease = {
  tag_name?: string;
  assets?: Array<{ name?: string; browser_download_url?: string }>;
};

const DISMISS_PREFIX = "vito-app-update-dismissed:";

function androidExternalIntent(absoluteUrl: string) {
  const url = new URL(absoluteUrl);
  return `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=${url.protocol.slice(0, -1)};action=android.intent.action.VIEW;end`;
}

function isAndroidApp() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export function AppUpdatePrompt() {
  const [update, setUpdate] = useState<VersionManifest | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);

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
        // The published GitHub release is authoritative. The static manifest is only a fallback.
        try {
          const latest = await fetch(
            "https://api.github.com/repos/VitoPhysio/vito-physio/releases/latest",
            { cache: "no-store" },
          );
          if (latest.ok) {
            const release = (await latest.json()) as LatestRelease;
            const tag = release.tag_name?.replace(/^v/, "");
            const apk = release.assets?.find((asset) => asset.name?.toLowerCase().endsWith(".apk"));
            if (tag && (!manifest.version || compareVersions(tag, manifest.version) > 0)) {
              manifest.version = tag;
            }
            // Keep the existing Vercel download pathway for Android installs. GitHub is
            // authoritative for the version check, but the app must download through the
            // server proxy so the APK filename, headers, and update flow stay consistent.
            if (apk?.browser_download_url) manifest.apkUrl = APK_DOWNLOAD_URL;
          }
        } catch {}
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
  const openUpdate = async () => {
    setOpening(true);
    setOpenError(null);
    const absoluteUrl = new URL(downloadUrl, window.location.origin).toString();
    try {
      await Browser.open({ url: absoluteUrl });
    } catch {
      // Older APKs do not contain the Browser plugin. An ordinary WebView navigation
      // cannot hand an APK to Android's installer, so use Android's external intent
      // handler while keeping the same Vercel URL and download pathway.
      window.location.assign(androidExternalIntent(absoluteUrl));
    } finally {
      setOpening(false);
    }
  };
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
            Version {update.version} is ready. Tap Update app, open the downloaded file, then
            confirm Install.
          </p>
          {update.releaseNotes && (
            <p className="mt-2 text-xs text-muted-foreground">{update.releaseNotes}</p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 pl-14">
        <Button
          type="button"
          size="sm"
          className="gap-2"
          onClick={() => void openUpdate()}
          disabled={opening}
        >
          <Download className="size-4" aria-hidden="true" />
          {opening ? "Opening download…" : "Update app"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={dismiss}>
          Continue later
        </Button>
      </div>
      {openError && (
        <p className="mt-2 pl-14 text-xs text-destructive" role="alert">
          {openError}
        </p>
      )}
    </aside>
  );
}
