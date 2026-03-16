import { useState } from "react";

import PredictGamePage from "./PredictGamePage";
import BracketPage from "./bracket/BracketPage";

const MODES = [
  { id: "predict", label: "Predict a Game" },
  { id: "bracket", label: "Build a Bracket" },
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
            Jump between single-game prediction and a full interactive bracket built from the fixed 2026 field.
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

      {mode === "predict" ? <PredictGamePage /> : <BracketPage />}
    </main>
  );
}
