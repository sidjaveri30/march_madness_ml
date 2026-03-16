import { useEffect, useMemo, useState } from "react";

import { bracketDefinition } from "./bracketDefinition";
import { applyWinnerPick, clearWinnerPick, createBracketState, getChampion, getMatchupTeams, setWinnerPick } from "./bracketState";
import { clearBracketState, loadBracketState, saveBracketState } from "./bracketStorage";
import BracketBoard from "./BracketBoard";
import MatchupDetailsModal from "./MatchupDetailsModal";
import { isResolvedTeam, sameTeam } from "./bracketTeams";
import SaveBracketControls from "./SaveBracketControls";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function createPredictionKey(teams) {
  return [...teams].sort().join("__");
}

export default function BracketPage() {
  const [bracketState, setBracketState] = useState(() => createBracketState(bracketDefinition, loadBracketState()));
  const [selectedMatchup, setSelectedMatchup] = useState(null);
  const [predictionCache, setPredictionCache] = useState({});
  const [saveStatus, setSaveStatus] = useState("");
  const [debugLayout, setDebugLayout] = useState(false);

  useEffect(() => {
    saveBracketState(bracketState);
  }, [bracketState]);

  useEffect(() => {
    if (!selectedMatchup) return;
    const teams = getMatchupTeams(bracketDefinition, bracketState, selectedMatchup.id);
    if (teams.some((team) => !isResolvedTeam(team))) return;

    const key = createPredictionKey(teams);
    if (predictionCache[key]?.data || predictionCache[key]?.loading) return;

    setPredictionCache((current) => ({ ...current, [key]: { loading: true } }));
    fetch(`${API_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team_a: teams[0], team_b: teams[1], neutral_site: true }),
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json();
          throw new Error(payload.detail || "Prediction unavailable");
        }
        return response.json();
      })
      .then((data) => setPredictionCache((current) => ({ ...current, [key]: { data } })))
      .catch((error) => setPredictionCache((current) => ({ ...current, [key]: { error: error.message } })));
  }, [bracketState, predictionCache, selectedMatchup]);

  const champion = useMemo(() => getChampion(bracketState), [bracketState]);

  function handlePick(matchupId, winner) {
    const currentWinner = bracketState.picks[matchupId];
    if (sameTeam(currentWinner, winner)) {
      setBracketState(clearWinnerPick(bracketDefinition, bracketState, matchupId));
      return;
    }
    setBracketState(applyWinnerPick(bracketDefinition, bracketState, matchupId, winner));
  }

  function handlePickFromModal(matchupId, winner) {
    setBracketState((current) => setWinnerPick(bracketDefinition, current, matchupId, winner));
  }

  function handleSave() {
    saveBracketState(bracketState);
    setSaveStatus("Bracket saved locally.");
    window.setTimeout(() => setSaveStatus(""), 1800);
  }

  function handleReset() {
    const nextState = createBracketState(bracketDefinition);
    setBracketState(nextState);
    clearBracketState();
    setSaveStatus("Bracket reset.");
    window.setTimeout(() => setSaveStatus(""), 1800);
  }

  function handleExport() {
    const blob = new Blob([JSON.stringify(bracketState, null, 2)], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = "2026-bracket.json";
    anchor.click();
    URL.revokeObjectURL(href);
  }

  async function handleImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const raw = await file.text();
    try {
      const imported = createBracketState(bracketDefinition, JSON.parse(raw));
      setBracketState(imported);
      setSaveStatus("Bracket imported.");
    } catch {
      setSaveStatus("Could not import bracket JSON.");
    }
    window.setTimeout(() => setSaveStatus(""), 2200);
  }

  const selectedTeams = selectedMatchup ? getMatchupTeams(bracketDefinition, bracketState, selectedMatchup.id) : [];
  const selectedPrediction =
    selectedMatchup && selectedTeams.every((team) => isResolvedTeam(team))
      ? predictionCache[createPredictionKey(selectedTeams)]
      : null;

  return (
    <section className="mode-panel bracket-mode bracket-mode-clean">
      <section className="bracket-toolbar">
        <div className="bracket-title-block">
          <div className="eyebrow">2026 NCAA Tournament</div>
          <h2>Build a bracket</h2>
          <p className="subtle">Click a team to advance it. Open matchup info only when you need model context.</p>
        </div>
        <div className="bracket-toolbar-meta">
          <div className="champion-chip">
            <span className="metric-label">Champion</span>
            <strong>{champion || "TBD"}</strong>
          </div>
          <button className={`secondary-button ${debugLayout ? "secondary-button-active" : ""}`} onClick={() => setDebugLayout((current) => !current)} type="button">
            {debugLayout ? "Hide Layout Debug" : "Show Layout Debug"}
          </button>
          <div className="save-controls-wrap">
            <SaveBracketControls
              onExport={handleExport}
              onImport={handleImport}
              onReset={handleReset}
              onSave={handleSave}
              saveStatus={saveStatus}
            />
          </div>
        </div>
      </section>

      <div className="bracket-board-shell">
        <BracketBoard
          debugLayout={debugLayout}
          definition={bracketDefinition}
          getTeams={(matchupId) => getMatchupTeams(bracketDefinition, bracketState, matchupId)}
          getWinner={(matchupId) => bracketState.picks[matchupId]}
          onDetails={(matchup) => setSelectedMatchup(matchup)}
          onPick={handlePick}
        />
      </div>

      <MatchupDetailsModal
        matchup={selectedMatchup}
        onClose={() => setSelectedMatchup(null)}
        onPick={(winner) => handlePickFromModal(selectedMatchup.id, winner)}
        prediction={selectedPrediction}
        teams={selectedTeams}
        winner={selectedMatchup ? bracketState.picks[selectedMatchup.id] : null}
      />
    </section>
  );
}
