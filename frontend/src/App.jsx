import { useState } from "react";

import PredictGamePage from "./PredictGamePage";
import LiveBracketPage from "./bracket/LiveBracketPage";
import MyBracketPage from "./bracket/MyBracketPage";
import SurvivorPoolPage from "./survivor/SurvivorPoolPage";

const MODES = [
  { id: "predict", label: "Predict a Game" },
  { id: "my-bracket", label: "My Bracket" },
  { id: "live-bracket", label: "Live Bracket" },
  { id: "survivor-pool", label: "Survivor Pool" },
];

export default function App() {
  const [mode, setMode] = useState("predict");
  const activeMode = MODES.find((option) => option.id === mode);

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

      {mode === "predict" ? <PredictGamePage /> : null}
      {mode === "my-bracket" ? <MyBracketPage /> : null}
      {mode === "live-bracket" ? <LiveBracketPage /> : null}
      {mode === "survivor-pool" ? <SurvivorPoolPage /> : null}
    </main>
  );
}
