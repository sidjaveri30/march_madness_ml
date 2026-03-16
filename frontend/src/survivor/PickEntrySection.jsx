import { useMemo, useState } from "react";

import TeamLogo from "../TeamLogo";
import {
  canPlayerMakeRoundPicks,
  findMatchupForTeam,
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

function TeamPickButton({ disabled = false, onClick, selected, team, used }) {
  return (
    <button
      aria-label={team.name}
      className={`survivor-team-tile ${selected ? "survivor-team-tile-selected" : ""} ${used ? "survivor-team-tile-used" : ""}`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <TeamLogo size="sm" team={team.name} />
      <span className="survivor-team-tile-name">{team.name}</span>
      {used ? <span className="survivor-status-chip">Used</span> : null}
    </button>
  );
}

function RegionFilterButton({ active, children, onClick }) {
  return (
    <button className={`survivor-filter-chip ${active ? "survivor-filter-chip-active" : ""}`} onClick={onClick} type="button">
      {children}
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
  const [query, setQuery] = useState("");
  const [regionFilter, setRegionFilter] = useState("all");
  const selectedPlayer = pool.players.find((player) => player.id === selectedPlayerId) || null;
  const currentPick = selectedPlayer && roundContext ? getPlayerRoundPick(selectedPlayer, roundContext.roundKey) : null;
  const legalTeams = selectedPlayer && roundContext ? getLegalTeamOptionsForPlayer(selectedPlayer, roundContext) : [];
  const legalTeamIds = new Set(legalTeams.map((team) => team.id));
  const teamNameLookup = useMemo(
    () =>
      new Map([
        ...((roundContext?.availableTeams || []).map((team) => [team.id, team.name])),
        ...((roundContext?.unresolvedTeams || []).map((team) => [team.id, team.name])),
      ]),
    [roundContext],
  );
  const eligibility = roundContext ? canPlayerMakeRoundPicks(selectedPlayer, roundContext) : { allowed: false, message: "Official round data is loading." };
  const regionOptions = useMemo(() => {
    const regions = Array.from(new Set((roundContext?.matchups || []).map((matchup) => matchup.region).filter(Boolean)));
    return ["all", ...regions];
  }, [roundContext]);

  const filteredTeams = useMemo(() => {
    if (!roundContext) return [];
    const normalizedQuery = query.trim().toLowerCase();
    return roundContext.availableTeams.filter((team) => {
      const matchup = findMatchupForTeam(roundContext, team.id);
      const matchesRegion = regionFilter === "all" || matchup?.region === regionFilter;
      const matchesQuery = !normalizedQuery || team.name.toLowerCase().includes(normalizedQuery);
      return matchesRegion && matchesQuery;
    });
  }, [query, regionFilter, roundContext]);

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
              ? `Choose exactly ${roundContext.requiredPicks} team${roundContext.requiredPicks === 1 ? "" : "s"} from the official ${roundContext.tournamentLabel} field.`
              : "The official bracket feed has not loaded a current round yet."}
          </p>
        </div>
      </div>

      <div className="survivor-config-grid survivor-compact-controls">
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
          <span>Search Teams</span>
          <input className="survivor-input" onChange={(event) => setQuery(event.target.value)} placeholder="Search legal teams" value={query} />
        </label>
      </div>

      {roundContext ? (
        <div className="survivor-pick-summary survivor-pick-summary-sticky">
          <span>
            {selectedPlayer
              ? `${legalTeams.length} legal team${legalTeams.length === 1 ? "" : "s"} available. ${roundContext.unresolvedTeams.length ? `${roundContext.unresolvedTeams.length} play-in slot${roundContext.unresolvedTeams.length === 1 ? "" : "s"} still unresolved.` : ""}`
              : "Choose a player to unlock the team board."}
          </span>
          <strong>
            {selectedTeamIds.length}/{roundContext.requiredPicks} selected
          </strong>
          {currentPick ? <span className="subtle">Saved picks: {currentPick.teamIds.map((teamId) => teamNameLookup.get(teamId) || teamId).join(", ")}</span> : null}
        </div>
      ) : null}

      <div className="survivor-filter-bar">
        {regionOptions.map((region) => (
          <RegionFilterButton active={regionFilter === region} key={region} onClick={() => setRegionFilter(region)}>
            {region === "all" ? "All Regions" : region}
          </RegionFilterButton>
        ))}
      </div>

      {!eligibility.allowed && selectedPlayer ? <div className="inline-error">{eligibility.message}</div> : null}
      {pickError ? <div className="inline-error">{pickError}</div> : null}

      <div className="survivor-picker-layout">
        <article className="survivor-card">
          <div className="survivor-section-header">
            <div>
              <div className="eyebrow">Available Teams</div>
              <h4 className="survivor-subheading">Compact team board</h4>
            </div>
          </div>

          <div className="survivor-team-grid">
            {filteredTeams.map((team) => {
              const matchup = findMatchupForTeam(roundContext, team.id);
              const used = selectedPlayer?.usedTeamIds?.includes(team.id);
              const legal = legalTeamIds.has(team.id);
              const locked = matchup?.gameInfo && getGameStatus(matchup.gameInfo, now) === "locked";
              return (
                <TeamPickButton
                  disabled={!selectedPlayer || locked || !legal}
                  key={team.id}
                  onClick={() => toggleTeam(team.id)}
                  selected={selectedTeamIds.includes(team.id)}
                  team={team}
                  used={used}
                />
              );
            })}
          </div>

          {!filteredTeams.length ? <p className="subtle">No teams match the current filter.</p> : null}

          {roundContext?.unresolvedTeams?.length ? (
            <div className="survivor-unresolved-list">
              <div className="eyebrow">Play-In Pending</div>
              <div className="survivor-inline-actions">
                {roundContext.unresolvedTeams.map((team) => (
                  <span className="survivor-status-chip" key={team.id}>
                    {team.name}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </article>

        <article className="survivor-card">
          <div className="survivor-section-header">
            <div>
              <div className="eyebrow">Selected Picks</div>
              <h4 className="survivor-subheading">Round summary</h4>
            </div>
          </div>

          <div className="survivor-selected-picks">
            {selectedTeamIds.length ? (
              selectedTeamIds.map((teamId) => {
                const team = roundContext.availableTeams.find((entry) => entry.id === teamId);
                const matchup = findMatchupForTeam(roundContext, teamId);
                return (
                  <div className="survivor-selected-pick-card" key={teamId}>
                    <div className="survivor-team-row">
                      <TeamLogo size="sm" team={team?.name || teamId} />
                      <strong>{team?.name || teamId}</strong>
                    </div>
                    <div className="subtle">{matchup?.label || "Official matchup"}</div>
                    <div className="survivor-game-meta">
                      <span>{formatGameMeta(matchup)}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="subtle">No teams selected yet.</p>
            )}
          </div>

          <details className="survivor-matchup-details">
            <summary>Round matchup context</summary>
            <div className="survivor-games-list">
              {roundContext?.matchups?.map((matchup) => (
                <div className="survivor-dashboard-game" key={matchup.id}>
                  <div className="survivor-game-header">
                    <strong>{matchup.label}</strong>
                    <span className="survivor-status-chip">{formatGameMeta(matchup)}</span>
                  </div>
                  {matchup.resolvedTeams.map((team) => (
                    <div className="survivor-team-row" key={team.id}>
                      <TeamLogo size="sm" team={team.name} />
                      <span>{team.name}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </details>
        </article>
      </div>

      <div className="survivor-pick-footer">
        <div className="subtle">Only official March Madness teams still alive this round can be selected, and previously used teams stay blocked.</div>
        <button className="primary-button" disabled={!selectedPlayer || !roundContext} onClick={onSubmitPicks} type="button">
          Save Round Picks
        </button>
      </div>
    </section>
  );
}
