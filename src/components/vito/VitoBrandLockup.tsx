import logo from "@/assets/vito-logo.png";
import { cn } from "@/lib/utils";

export function VitoBrandLockup({
  className,
  imageClassName,
  showTagline = true,
  compact = false,
  showLogo = true,
}: {
  className?: string;
  imageClassName?: string;
  showTagline?: boolean;
  compact?: boolean;
  showLogo?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center",
        compact ? "gap-3" : "flex-col gap-5 text-center",
        className,
      )}
    >
      {showLogo && (
        <div
          className={cn(
            "relative shrink-0 rounded-full bg-brand-gradient p-[3px] shadow-glow",
            compact ? "size-14" : "size-32 sm:size-40",
          )}
        >
          <span
            aria-hidden="true"
            className="absolute -inset-2 rounded-full border border-primary/15"
          />
          <span
            aria-hidden="true"
            className="absolute -right-1 top-1/2 size-2 -translate-y-1/2 rounded-full bg-accent shadow-[0_0_0_4px_hsl(var(--background))]"
          />
          <div className="relative grid size-full place-items-center rounded-full bg-background/95 p-3 ring-1 ring-white/35 dark:bg-card/95 dark:ring-white/10">
            <img
              src={logo}
              alt="VITO Physio logo"
              className={cn("size-full object-contain", imageClassName)}
            />
          </div>
        </div>
      )}
      <div className={cn("min-w-0", compact ? "text-left" : "text-center")}>
        <p
          className={cn(
            "bg-brand-gradient bg-clip-text font-black leading-none tracking-tight text-transparent",
            compact ? "text-2xl" : "text-4xl sm:text-5xl",
          )}
        >
          VITO
        </p>
        <p
          className={cn(
            "font-black leading-none tracking-tight text-foreground",
            compact ? "text-xl" : "text-3xl sm:text-4xl",
          )}
        >
          Physio
        </p>
        {showTagline && (
          <p
            className={cn(
              "font-semibold text-muted-foreground",
              compact ? "mt-1 text-[0.65rem]" : "mt-2 text-sm sm:text-base",
            )}
          >
            Care that moves with you
          </p>
        )}
      </div>
    </div>
  );
}

export function VitoLoadingMark({
  size = "size-28",
  className,
}: {
  size?: string;
  className?: string;
}) {
  return (
    <span className={cn("relative grid shrink-0 place-items-center", size, className)}>
      <span
        aria-hidden="true"
        className="absolute inset-0 animate-spin rounded-full border-[3px] border-primary/15 border-t-accent motion-reduce:animate-none"
      />
      <span aria-hidden="true" className="absolute inset-2 rounded-full border border-primary/10" />
      <span className="relative grid size-[70%] place-items-center rounded-full bg-background p-3 shadow-sm ring-1 ring-border dark:bg-card">
        <img src={logo} alt="" className="size-full object-contain" />
      </span>
    </span>
  );
}

function VitoLoadingMessage() {
  return (
    <div className="flex flex-col items-center gap-5 text-center" role="status" aria-live="polite">
      <VitoLoadingMark />
      <span className="text-sm font-medium text-muted-foreground">
        Loading your VITO care space…
      </span>
    </div>
  );
}

export function VitoLoadingScreen() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-5 text-foreground">
      <VitoLoadingMessage />
    </main>
  );
}

export function VitoLoadingOverlay() {
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-background px-5 text-foreground">
      <VitoLoadingMessage />
    </div>
  );
}
