import TeamLogo from "../TeamLogo";
import {
  canPlayerMakeRoundPicks,
  getGameStatus,
  getLegalTeamOptionsForPlayer,
  getPlayerRoundPick,
} from "./survivorPoolUtils.js";

function formatGameMeta(matchup) {
  if (matchup.gameInfo?.status === "live") {
    return matchup.gameInfo.detail ? `LIVE • ${matchup.gameInfo.detail}` : "LIVE";
  }
  if (matchup.gameInfo?.status === "final") {
    return "FINAL";
  }
  if (matchup.gameInfo?.startTime) {
    const start = new Date(matchup.gameInfo.startTime);
    if (!Number.isNaN(start.getTime())) {
      return start.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    }
  }
  return matchup.label;
}

function TeamPickButton({ disabled = false, label, onClick, selected, team, used }) {
  return (
    <button
      aria-label={label}
      className={`survivor-team-pick ${selected ? "survivor-team-pick-selected" : ""}`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <TeamLogo size="sm" team={team.name} />
      <span>{team.name}</span>
      {used ? <span className="survivor-status-chip">Used</span> : null}
    </button>
  );
}

export default function PickEntrySection({
  now,
  onSubmitPicks,
  pickError,
  roundContext,
  selectedPlayerId,
  selectedTeamIds,
  setPickError,
  setSelectedPlayerId,
  setSelectedTeamIds,
  pool,
}) {
  const selectedPlayer = pool.players.find((player) => player.id === selectedPlayerId) || null;
  const currentPick = selectedPlayer && roundContext ? getPlayerRoundPick(selectedPlayer, roundContext.roundKey) : null;
  const legalTeams = selectedPlayer && roundContext ? getLegalTeamOptionsForPlayer(selectedPlayer, roundContext) : [];
  const legalTeamIds = new Set(legalTeams.map((team) => team.id));
  const eligibility = roundContext ? canPlayerMakeRoundPicks(selectedPlayer, roundContext) : { allowed: false, message: "Official round data is loading." };

  function toggleTeam(teamId) {
    setPickError("");
    setSelectedTeamIds((current) => {
      if (current.includes(teamId)) return current.filter((entry) => entry !== teamId);
      return [...current, teamId];
    });
  }

  return (
    <section className="survivor-section" data-testid="survivor-pick-entry">
      <div className="survivor-section-header">
        <div>
          <div className="eyebrow">Current Round Picks</div>
          <h3>{roundContext?.tournamentLabel || "Official round loading"}</h3>
          <p className="subtle">
            {roundContext
              ? `Every active player must make exactly ${roundContext.requiredPicks} pick${roundContext.requiredPicks === 1 ? "" : "s"} from teams still alive in ${roundContext.tournamentLabel}.`
              : "The official bracket feed has not loaded a current round yet."}
          </p>
        </div>
      </div>

      <div className="survivor-config-grid">
        <label className="survivor-field">
          <span>Active Player</span>
          <select className="survivor-input" onChange={(event) => setSelectedPlayerId(event.target.value)} value={selectedPlayerId}>
            <option value="">Select a player</option>
            {pool.players
              .filter((player) => !player.eliminated)
              .map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
          </select>
        </label>
        <label className="survivor-field">
          <span>Picks Required</span>
          <input className="survivor-input" readOnly value={roundContext ? `${roundContext.requiredPicks}` : "0"} />
        </label>
      </div>

      {roundContext ? (
        <div className="survivor-pick-summary">
          <span>
            {selectedPlayer
              ? `${legalTeams.length} legal team${legalTeams.length === 1 ? "" : "s"} available after removing previously used picks.`
              : "Choose a player to unlock the official team board."}
          </span>
          <strong>
            {selectedTeamIds.length}/{roundContext.requiredPicks} selected
          </strong>
          {currentPick ? <span className="subtle">Saved: {currentPick.teamIds.join(", ")}</span> : null}
        </div>
      ) : null}

      {!eligibility.allowed && selectedPlayer ? <div className="inline-error">{eligibility.message}</div> : null}
      {pickError ? <div className="inline-error">{pickError}</div> : null}

      <div className="survivor-games-list">
        {roundContext?.matchups?.map((matchup) => {
          const locked = getGameStatus(matchup.gameInfo, now) === "locked";
          return (
            <article className="survivor-card survivor-game-card" key={matchup.id}>
              <div className="survivor-game-header">
                <strong>{matchup.label}</strong>
                <span className={`survivor-status-chip ${locked ? "survivor-status-chip-danger" : ""}`}>{locked ? formatGameMeta(matchup) : formatGameMeta(matchup)}</span>
              </div>

              <div className="survivor-pick-grid">
                {matchup.resolvedTeams.map((team) => {
                  const used = selectedPlayer?.usedTeamIds?.includes(team.id);
                  const legal = legalTeamIds.has(team.id);
                  return (
                    <TeamPickButton
                      disabled={!selectedPlayer || locked || !legal}
                      key={team.id}
                      label={team.name}
                      onClick={() => toggleTeam(team.id)}
                      selected={selectedTeamIds.includes(team.id)}
                      team={team}
                      used={used}
                    />
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>

      <div className="survivor-pick-footer">
        <div className="subtle">Only official March Madness teams still alive this round can be selected.</div>
        <button className="primary-button" disabled={!selectedPlayer || !roundContext} onClick={onSubmitPicks} type="button">
          Save Round Picks
        </button>
      </div>
    </section>
  );
}
