import { useEffect, useMemo, useState } from "react";

import { bracketDefinition } from "./bracketDefinition";
import { getChampion, getMatchupTeams } from "./bracketState";
import BracketBoard from "./BracketBoard";
import LiveTicker from "./LiveTicker";
import MatchupDetailsModal from "./MatchupDetailsModal";
import { isResolvedTeam } from "./bracketTeams";
import { MOCK_LIVE_SNAPSHOTS, buildLiveBracketState, getTickerSections } from "./liveBracketData";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function createPredictionKey(teams) {
  return [...teams].sort().join("__");
}

export default function LiveBracketPage() {
  const [snapshotIndex, setSnapshotIndex] = useState(0);
  const [selectedMatchup, setSelectedMatchup] = useState(null);
  const [predictionCache, setPredictionCache] = useState({});
  const snapshot = MOCK_LIVE_SNAPSHOTS[snapshotIndex];
  const liveState = useMemo(() => buildLiveBracketState(snapshot, bracketDefinition), [snapshot]);
  const champion = useMemo(() => getChampion(liveState.bracketState), [liveState]);
  const tickerSections = useMemo(() => getTickerSections(snapshot), [snapshot]);

  useEffect(() => {
    if (!selectedMatchup) return;
    const teams = getMatchupTeams(bracketDefinition, liveState.bracketState, selectedMatchup.id);
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
  }, [liveState, predictionCache, selectedMatchup]);

  const selectedTeams = selectedMatchup ? getMatchupTeams(bracketDefinition, liveState.bracketState, selectedMatchup.id) : [];
  const selectedPrediction =
    selectedMatchup && selectedTeams.every((team) => isResolvedTeam(team))
      ? predictionCache[createPredictionKey(selectedTeams)]
      : null;

  return (
    <section className="mode-panel bracket-mode bracket-mode-clean">
      <section className="bracket-toolbar">
        <div className="bracket-title-block">
          <div className="eyebrow">Live Bracket</div>
          <h2>Track the official tournament in real time</h2>
          <p className="subtle">Scores, status, and automatic advancement here are driven by official results only and never modify your personal bracket entries.</p>
        </div>
        <div className="bracket-toolbar-meta">
          <div className="champion-chip">
            <span className="metric-label">Official Leader</span>
            <strong>{champion || "TBD"}</strong>
          </div>
          <button
            className="secondary-button"
            onClick={() => setSnapshotIndex((current) => Math.min(current + 1, MOCK_LIVE_SNAPSHOTS.length - 1))}
            type="button"
          >
            Next Mock Update
          </button>
          <button className="secondary-button" onClick={() => setSnapshotIndex(0)} type="button">
            Reset Feed
          </button>
        </div>
      </section>

      <LiveTicker sections={tickerSections} />

      <section className="live-bracket-summary">
        <div className="eyebrow">Feed Window</div>
        <strong>{snapshot.label}</strong>
        <span className="subtle">Mock live mode is on so we can validate ticker behavior, official advancement, and First Four resolution before the games are actually live.</span>
      </section>

      <div className="bracket-board-shell">
        <BracketBoard
          definition={bracketDefinition}
          getGameInfo={(matchupId) => liveState.games[matchupId] || null}
          getTeams={(matchupId) => getMatchupTeams(bracketDefinition, liveState.bracketState, matchupId)}
          getWinner={(matchupId) => liveState.bracketState.picks[matchupId]}
          interactive={false}
          onDetails={(matchup) => setSelectedMatchup(matchup)}
        />
      </div>

      <MatchupDetailsModal
        allowSelection={false}
        matchup={selectedMatchup}
        onClose={() => setSelectedMatchup(null)}
        onPick={() => {}}
        prediction={selectedPrediction}
        teams={selectedTeams}
        winner={selectedMatchup ? liveState.bracketState.picks[selectedMatchup.id] : null}
      />
    </section>
  );
}
