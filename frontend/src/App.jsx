import { useState } from "react";

import PredictGamePage from "./PredictGamePage";
import LiveBracketPage from "./bracket/LiveBracketPage";
import MyBracketPage from "./bracket/MyBracketPage";

const MODES = [
  { id: "predict", label: "Predict a Game" },
  { id: "my-bracket", label: "My Bracket" },
  { id: "live-bracket", label: "Live Bracket" },
];

export default function App() {
  const [mode, setMode] = useState("predict");

  return (
    <main className="shell">
      <section className="app-header">
        <div>
          <div className="eyebrow">March Madness ML</div>
          <h1>2026 tournament intelligence</h1>
          <p className="subtle">
            Predict individual games, manage your personal bracket entries, and track the official bracket separately as the tournament unfolds.
          </p>
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
      </section>

      {mode === "predict" ? <PredictGamePage /> : null}
      {mode === "my-bracket" ? <MyBracketPage /> : null}
      {mode === "live-bracket" ? <LiveBracketPage /> : null}
    </main>
  );
}
