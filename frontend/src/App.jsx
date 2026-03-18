import { Suspense, lazy, useEffect, useMemo, useState } from "react";

const PredictGamePage = lazy(() => import("./PredictGamePage"));
const LiveBracketPage = lazy(() => import("./bracket/LiveBracketPage"));
const MyBracketPage = lazy(() => import("./bracket/MyBracketPage"));
const SurvivorPoolPage = lazy(() => import("./survivor/SurvivorPoolPage"));

const MODES = [
  { id: "predict", label: "Predict a Game" },
  { id: "my-bracket", label: "My Bracket" },
  { id: "live-bracket", label: "Live Bracket" },
  { id: "survivor-pool", label: "Survivor Pool" },
];
const THEME_STORAGE_KEY = "hub-ui-theme";

function getPreferredTheme() {
  if (typeof window === "undefined") return "light";
  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (savedTheme === "light" || savedTheme === "dark") return savedTheme;
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
}

export default function App() {
  const [mode, setMode] = useState("predict");
  const [theme, setTheme] = useState(getPreferredTheme);
  const activeMode = MODES.find((option) => option.id === mode);
  const ActivePage = useMemo(() => {
    switch (mode) {
      case "my-bracket":
        return MyBracketPage;
      case "live-bracket":
        return LiveBracketPage;
      case "survivor-pool":
        return SurvivorPoolPage;
      case "predict":
      default:
        return PredictGamePage;
    }
  }, [mode]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  return (
    <main className="shell">
      <section className="app-header">
        <div className="app-header-copy">
          <div className="eyebrow">March Madness ML</div>
          <h1>2026 tournament intelligence</h1>
          <p className="subtle">
            Predict individual games, manage your personal bracket entries, and track the official bracket separately as the tournament unfolds.
          </p>
        </div>
        <div className="app-header-actions">
          <div className="app-active-mode-chip">
            <span className="metric-label">Workspace</span>
            <strong>{activeMode?.label}</strong>
          </div>
          <button
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            aria-pressed={theme === "dark"}
            className={`theme-toggle ${theme === "dark" ? "theme-toggle-active" : ""}`}
            onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
            type="button"
          >
            <span className="theme-toggle-track">
              <span className="theme-toggle-label">{theme === "dark" ? "Dark" : "Light"}</span>
              <span aria-hidden="true" className="theme-toggle-thumb" />
            </span>
          </button>
          <div className="mode-switch" role="tablist">
            {MODES.map((option) => (
              <button
                aria-selected={mode === option.id}
                className={`mode-button ${mode === option.id ? "mode-button-active" : ""}`}
                key={option.id}
                onClick={() => setMode(option.id)}
                role="tab"
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <Suspense fallback={<section className="mode-panel"><p className="subtle">Loading workspace...</p></section>}>
        <ActivePage />
      </Suspense>
    </main>
  );
}
