import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useCanGoBack,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { AppDownloadPrompt } from "@/components/vito/AppDownloadPrompt";
import { AppUpdatePrompt } from "@/components/vito/AppUpdatePrompt";
import { applyTheme, getStoredTheme } from "@/lib/theme";

const queryPersister = createSyncStoragePersister({
  storage: typeof window === "undefined" ? undefined : window.localStorage,
  key: "vito-query-cache-v2",
  throttleTime: 1000,
});

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#35108f" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "VITO Physio" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "format-detection", content: "telephone=no" },
      { title: "VITO Physio" },
      {
        name: "description",
        content: "Sports physiotherapy case management for schools, academies, clubs and athletes.",
      },
      { property: "og:title", content: "VITO Physio" },
      {
        property: "og:description",
        content: "Sports physiotherapy case management for schools, academies, clubs and athletes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/vito-logo.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let listener: { remove: () => Promise<void> } | undefined;
    void App.addListener("backButton", () => {
      if (canGoBack) {
        router.history.back();
      } else {
        void App.exitApp();
      }
    }).then((handle) => {
      listener = handle;
    });

    return () => {
      void listener?.remove();
    };
  }, [canGoBack, router]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    void (async () => {
      const [{ startNativePush }, { registerDeviceToken }, { supabase }] = await Promise.all([
        import("@/lib/device-push"),
        import("@/lib/notification.functions"),
        import("@/integrations/supabase/client"),
      ]);
      await startNativePush(
        (path) => {
          const [pathname, query = ""] = path.split("?");
          if (pathname) void router.navigate({ href: query ? `${pathname}?${query}` : pathname });
        },
        async (token, platform, androidActions) => {
          const { data } = await supabase.auth.getSession();
          if (data.session) await registerDeviceToken({ data: { token, platform, androidActions } });
        },
      );
    })().catch(() => undefined);
  }, [router]);

  useEffect(() => {
    // Nudge the alert queue while the app is open so activity alerts go out promptly.
    let stopped = false;
    const tick = async () => {
      if (stopped || document.visibilityState !== "visible") return;
      const [{ supabase }, { dispatchPendingPushes }] = await Promise.all([
        import("@/integrations/supabase/client"),
        import("@/lib/notification.functions"),
      ]);
      const { data } = await supabase.auth.getSession();
      if (data.session) await dispatchPendingPushes();
    };
    void tick().catch(() => undefined);
    const id = window.setInterval(() => void tick().catch(() => undefined), 30000);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const theme = getStoredTheme();
    applyTheme(theme);
  }, []);

  useEffect(() => {
    void SplashScreen.hide({ fadeOutDuration: 200 });
  }, []);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: queryPersister,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      }}
    >
      {/* Required: nested routes render here; removing <Outlet /> breaks all child routes. */}
      <Outlet />
      {!isOnline && (
        <div className="fixed inset-x-3 bottom-3 z-[110] mx-auto max-w-lg rounded-xl border border-accent/30 bg-card/95 px-4 py-3 text-center text-sm font-medium text-card-foreground shadow-xl backdrop-blur print:hidden">
          Limited offline mode: showing saved Vito Physio content. New data will load when you
          reconnect.
        </div>
      )}
      <AppDownloadPrompt />
      <AppUpdatePrompt />
      <Toaster richColors position="top-center" />
    </PersistQueryClientProvider>
  );
}
