import { useEffect, useMemo, useState } from "react";

import { bracketDefinition } from "./bracketDefinition";
import { getChampion, getMatchupTeams } from "./bracketState";
import BracketBoard from "./BracketBoard";
import LiveGamesBoard from "./LiveGamesBoard";
import { EMPTY_SECTIONS, useLiveBracketFeed } from "./liveBracketProvider";
import MatchupDetailsModal from "./MatchupDetailsModal";
import { isResolvedTeam } from "./bracketTeams";
import { createPredictionKey, fetchMatchupPrediction } from "./predictionApi";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export default function LiveBracketPage() {
  const [selectedMatchup, setSelectedMatchup] = useState(null);
  const [predictionCache, setPredictionCache] = useState({});
  const liveFeed = useLiveBracketFeed({ definition: bracketDefinition });
  const liveState = liveFeed.view;
  const champion = useMemo(() => getChampion(liveState?.bracketState || { picks: {} }), [liveState]);
  const tickerSections = liveState?.sections || EMPTY_SECTIONS;

  useEffect(() => {
    if (!selectedMatchup || !liveState) return;
    const teams = getMatchupTeams(bracketDefinition, liveState.bracketState, selectedMatchup.id);
    if (teams.some((team) => !isResolvedTeam(team))) return;

    const key = createPredictionKey(teams);
    if (predictionCache[key]?.data || predictionCache[key]?.loading) return;

    setPredictionCache((current) => ({ ...current, [key]: { loading: true } }));
    fetchMatchupPrediction(API_URL, teams[0], teams[1])
      .then((data) => setPredictionCache((current) => ({ ...current, [key]: { data } })))
      .catch((error) => setPredictionCache((current) => ({ ...current, [key]: { error: error.message } })));
  }, [liveState, predictionCache, selectedMatchup]);

  const selectedTeams = selectedMatchup && liveState ? getMatchupTeams(bracketDefinition, liveState.bracketState, selectedMatchup.id) : [];
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
            disabled={!liveFeed.canAdvance}
            onClick={() => liveFeed.next()}
            type="button"
          >
            Next Mock Update
          </button>
          <button className="secondary-button" onClick={() => liveFeed.reset()} type="button">
            Reset Feed
          </button>
        </div>
      </section>

      <LiveGamesBoard sections={tickerSections} />

      <section className="live-bracket-summary">
        <div className="eyebrow">Feed Window</div>
        <strong>{liveState?.label || "Loading live feed..."}</strong>
        <span className="subtle">{liveState?.meta.helperText || "Loading official bracket feed."}</span>
        {liveState?.meta ? (
          <div className="live-feed-meta">
            <span>{liveState.meta.modeLabel}</span>
            <span>{liveState.meta.sourceLabel}</span>
            {liveState.meta.updatedAtLabel ? <span>{liveState.meta.updatedAtLabel}</span> : null}
          </div>
        ) : null}
        {liveFeed.error ? <span className="error">{liveFeed.error}</span> : null}
      </section>

      <div className="bracket-board-shell">
        <BracketBoard
          definition={bracketDefinition}
          getGameInfo={(matchupId) => liveState?.games[matchupId] || null}
          getTeams={(matchupId) => getMatchupTeams(bracketDefinition, liveState?.bracketState || { initialAssignments: {}, picks: {} }, matchupId)}
          getWinner={(matchupId) => liveState?.bracketState?.picks[matchupId]}
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
        winner={selectedMatchup && liveState ? liveState.bracketState.picks[selectedMatchup.id] : null}
      />
    </section>
  );
}
