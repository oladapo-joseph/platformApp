/**
 * Light, dark or follow the OS (US-6.2). The choice is kept in localStorage so
 * index.html's theme script can apply it before first paint, and saved to the account
 * (useThemeChoice) so it follows the user to other devices.
 */
export type ThemeChoice = "system" | "light" | "dark";

const KEY = "el-theme";

export function savedTheme(): ThemeChoice {
  try {
    const t = localStorage.getItem(KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);
  try {
    if (choice === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {
    /* private mode: the choice lasts for this page only */
  }
  window.dispatchEvent(new CustomEvent("el-theme-change"));
}

/** For useSyncExternalStore: every theme control shows the same choice. */
export function subscribeTheme(onChange: () => void): () => void {
  window.addEventListener("el-theme-change", onChange);
  window.addEventListener("storage", onChange); // another tab
  return () => {
    window.removeEventListener("el-theme-change", onChange);
    window.removeEventListener("storage", onChange);
  };
}
