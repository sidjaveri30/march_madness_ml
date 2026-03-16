import { useEffect, useMemo, useState } from "react";

import { bracketDefinition } from "./bracketDefinition";
import { applyWinnerPick, clearWinnerPick, createBracketState, getChampion, getMatchupTeams, setWinnerPick } from "./bracketState";
import { clearBracketState, loadBracketState, saveBracketState } from "./bracketStorage";
import { bracketLayoutStyle } from "./bracketLayout";
import MatchupDetailsModal from "./MatchupDetailsModal";
import { isPickableTeam } from "./bracketTeams";
import RegionBracket from "./RegionBracket";
import RoundColumn from "./RoundColumn";
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

  useEffect(() => {
    saveBracketState(bracketState);
  }, [bracketState]);

  useEffect(() => {
    if (!selectedMatchup) return;
    const teams = getMatchupTeams(bracketDefinition, bracketState, selectedMatchup.id);
    if (teams.some((team) => !isPickableTeam(team))) return;

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
    if (currentWinner === winner) {
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
    selectedMatchup && selectedTeams.every((team) => isPickableTeam(team))
      ? predictionCache[createPredictionKey(selectedTeams)]
      : null;

  return (
    <section className="mode-panel bracket-mode bracket-mode-clean" style={bracketLayoutStyle()}>
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

      <section className="first-four-strip bracket-lane">
        <RoundColumn
          getTeams={(matchupId) => getMatchupTeams(bracketDefinition, bracketState, matchupId)}
          getWinner={(matchupId) => bracketState.picks[matchupId]}
          matchups={bracketDefinition.firstFour}
          onDetails={(matchup) => setSelectedMatchup(matchup)}
          onPick={handlePick}
          roundKey="firstFour"
          side="center"
          title="First Four"
        />
      </section>

      <section className="visual-bracket espn-bracket">
        <div className="bracket-side bracket-side-left">
          {bracketDefinition.layout.leftRegions.map((region) => (
            <RegionBracket
              getTeams={(matchupId) => getMatchupTeams(bracketDefinition, bracketState, matchupId)}
              getWinner={(matchupId) => bracketState.picks[matchupId]}
              key={region}
              onDetails={(matchup) => setSelectedMatchup(matchup)}
              onPick={handlePick}
              region={region}
              rounds={bracketDefinition.regions[region]}
              side="left"
            />
          ))}
        </div>

        <div className="bracket-center">
          <div className="center-stage">
            <RoundColumn
              getTeams={(matchupId) => getMatchupTeams(bracketDefinition, bracketState, matchupId)}
              getWinner={(matchupId) => bracketState.picks[matchupId]}
              matchups={bracketDefinition.finalRounds.finalFour}
              onDetails={(matchup) => setSelectedMatchup(matchup)}
              onPick={handlePick}
              roundKey="finalFour"
              side="center"
              title="Final Four"
            />
            <RoundColumn
              getTeams={(matchupId) => getMatchupTeams(bracketDefinition, bracketState, matchupId)}
              getWinner={(matchupId) => bracketState.picks[matchupId]}
              matchups={bracketDefinition.finalRounds.championship}
              onDetails={(matchup) => setSelectedMatchup(matchup)}
              onPick={handlePick}
              roundKey="championship"
              side="center"
              title="Championship"
            />
          </div>
        </div>

        <div className="bracket-side bracket-side-right">
          {bracketDefinition.layout.rightRegions.map((region) => (
            <RegionBracket
              getTeams={(matchupId) => getMatchupTeams(bracketDefinition, bracketState, matchupId)}
              getWinner={(matchupId) => bracketState.picks[matchupId]}
              key={region}
              onDetails={(matchup) => setSelectedMatchup(matchup)}
              onPick={handlePick}
              region={region}
              rounds={bracketDefinition.regions[region]}
              side="right"
            />
          ))}
        </div>
      </section>

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
