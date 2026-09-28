import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "meeplemark:theme";
const DARK_MODE_QUERY = "(prefers-color-scheme: dark)";

function storedTheme(): Theme | null {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

function currentTheme(): Theme {
  const explicitTheme = document.documentElement.dataset.theme;
  if (explicitTheme === "light" || explicitTheme === "dark") return explicitTheme;
  return window.matchMedia(DARK_MODE_QUERY).matches ? "dark" : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(currentTheme);

  useEffect(() => {
    const media = window.matchMedia(DARK_MODE_QUERY);
    const followSystemTheme = (event: MediaQueryListEvent) => {
      if (storedTheme() === null) setTheme(event.matches ? "dark" : "light");
    };

    media.addEventListener("change", followSystemTheme);
    return () => media.removeEventListener("change", followSystemTheme);
  }, []);

  const nextTheme: Theme = theme === "dark" ? "light" : "dark";
  const label = `Use ${nextTheme} mode`;

  function toggleTheme() {
    document.documentElement.dataset.theme = nextTheme;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // The appearance still changes for this page if storage is unavailable.
    }
    setTheme(nextTheme);
  }

  return (
    <button
      className="theme-toggle"
      type="button"
      aria-label={label}
      aria-pressed={theme === "dark"}
      title={label}
      onClick={toggleTheme}
    >
      <span className="theme-toggle-icon" aria-hidden="true">{nextTheme === "dark" ? "☾" : "☀"}</span>
      <span className="theme-toggle-label">{nextTheme === "dark" ? "Dark" : "Light"}</span>
    </button>
  );
}
