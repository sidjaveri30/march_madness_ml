import { Suspense, lazy, useMemo, useState } from "react";

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

export default function App() {
  const [mode, setMode] = useState("predict");
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
