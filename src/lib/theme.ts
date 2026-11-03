export type ThemeMode = "light" | "dark" | "system";

const STORAGE_KEY = "vito-theme";

export function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "dark" || stored === "light" || stored === "system") return stored;
  return "system";
}

export function applyTheme(theme: ThemeMode) {
  if (typeof document === "undefined") return;

  const media = window.matchMedia?.("(prefers-color-scheme: dark)");
  const isDark = theme === "dark" || (theme === "system" && Boolean(media?.matches));

  document.documentElement.classList.toggle("dark", isDark);
  document.documentElement.style.colorScheme = isDark ? "dark" : "light";
}

export function watchSystemTheme(onChange: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => undefined;

  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener?.("change", onChange);
  return () => media.removeEventListener?.("change", onChange);
}
