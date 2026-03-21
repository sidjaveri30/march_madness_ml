import { memo } from "react";

import TeamSlot from "./TeamSlot";
import { getTeamId, isPickableTeam, sameTeam } from "./bracketTeams";
import { getDisplayGameInfo, getMatchupHeaderMeta } from "./gameDisplay";

function OutcomeIcon({ outcome }) {
  if (outcome === "correct") {
    return (
      <svg aria-hidden="true" className="matchup-outcome-icon-svg" viewBox="0 0 16 16">
        <path d="M3.5 8.4 6.5 11.3 12.5 4.8" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      </svg>
    );
  }

  if (outcome === "incorrect" || outcome === "busted") {
    return (
      <svg aria-hidden="true" className="matchup-outcome-icon-svg" viewBox="0 0 16 16">
        <path d="M4.5 4.5 11.5 11.5M11.5 4.5 4.5 11.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      </svg>
    );
  }

  return null;
}

function MatchupCard({ matchup, teams, winner, onPick, onDetails, side, style = null, interactive = true, gameInfo = null, showPickOutcome = false }) {
  const [teamA, teamB] = teams;
  const canPickA = isPickableTeam(teamA);
  const canPickB = isPickableTeam(teamB);
  const displayGame = getDisplayGameInfo(gameInfo);
  const headerMeta = getMatchupHeaderMeta(matchup, displayGame);
  const espnUrl = displayGame?.espnUrl || null;
  const statusDisplay = displayGame?.statusDisplay || null;
  const hasHeaderMeta = Boolean(headerMeta.label || headerMeta.detail);
  const pickOutcome = showPickOutcome ? gameInfo?.pickOutcome || "pending" : "pending";
  function openEspnGame() {
    if (!espnUrl || typeof window === "undefined") return;
    window.open(espnUrl, "_blank", "noopener,noreferrer");
  }

  function handleCardClick(event) {
    if (!espnUrl) return;
    if (event.target.closest(".matchup-info-button")) return;
    openEspnGame();
  }

  function handleCardKeyDown(event) {
    if (!espnUrl) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openEspnGame();
  }

  const actions = (
    <>
      {espnUrl ? <span aria-hidden="true" className="matchup-external-indicator">↗</span> : null}
      <button
        aria-label={`View ${matchup.label} details`}
        className="matchup-info-button"
        data-testid={`details-${matchup.id}`}
        onClick={(event) => {
          event.stopPropagation();
          onDetails();
        }}
        type="button"
      >
        i
      </button>
    </>
  );

  return (
    <article
      aria-label={espnUrl ? `Open ESPN game page for ${teamA || "TBD"} vs ${teamB || "TBD"}` : undefined}
      className={`matchup-card matchup-card-${side} matchup-card-outcome-${pickOutcome} ${espnUrl ? "matchup-card-linkable" : ""} ${hasHeaderMeta ? "" : "matchup-card-tight-top"}`}
      data-testid={`matchup-${matchup.id}`}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      role={espnUrl ? "link" : undefined}
      style={style}
      tabIndex={espnUrl ? 0 : undefined}
    >
      {hasHeaderMeta ? (
        <div className="matchup-card-header">
          <div className="matchup-meta">
            {headerMeta.label ? <div className="matchup-label">{headerMeta.label}</div> : null}
            {headerMeta.detail ? <div className="matchup-sublabel">{headerMeta.detail}</div> : null}
          </div>
          <div className="matchup-card-actions">{actions}</div>
        </div>
      ) : (
        <div className="matchup-card-actions matchup-card-actions-floating">{actions}</div>
      )}

      {statusDisplay ? (
        <div className="matchup-status-row">
          {statusDisplay.type === "live" ? (
            <span className="matchup-status-live-group">
              <span className="matchup-status-live-dot" />
              <span className="matchup-status-pill matchup-status-pill-inline matchup-status-pill-live">{statusDisplay.liveLabel}</span>
            </span>
          ) : null}
          <span className={`matchup-status-detail matchup-status-detail-${statusDisplay.type}`}>{statusDisplay.text}</span>
          {pickOutcome !== "pending" && pickOutcome !== "placeholder" ? (
            <span
              className={`matchup-outcome-icon matchup-outcome-icon-${pickOutcome}`}
              title={
                pickOutcome === "correct"
                  ? "Pick correct"
                  : pickOutcome === "incorrect"
                    ? "Pick incorrect"
                    : "Pick busted"
              }
            >
              <OutcomeIcon outcome={pickOutcome} />
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="matchup-teams">
        <TeamSlot
          interactive={interactive}
          isDisabled={!canPickA}
          outcome={showPickOutcome && sameTeam(winner, teamA) ? pickOutcome : "pending"}
          isSelected={sameTeam(winner, teamA)}
          onClick={() => canPickA && onPick(teamA)}
          score={displayGame?.team_a_score}
          seed={matchup.slots[0]?.seed}
          team={teamA}
        />
        <TeamSlot
          interactive={interactive}
          isDisabled={!canPickB}
          outcome={showPickOutcome && sameTeam(winner, teamB) ? pickOutcome : "pending"}
          isSelected={sameTeam(winner, teamB)}
          onClick={() => canPickB && onPick(teamB)}
          score={displayGame?.team_b_score}
          seed={matchup.slots[1]?.seed}
          team={teamB}
        />
      </div>
    </article>
  );
}

function sameStyle(left = null, right = null) {
  if (left === right) return true;
  if (!left || !right) return left === right;
  return left.left === right.left && left.top === right.top && left.width === right.width && left.height === right.height;
}

function sameGameInfo(left = null, right = null) {
  if (left === right) return true;
  if (!left || !right) return left === right;
  return (
    left.status === right.status &&
    left.statusLabel === right.statusLabel &&
    left.detail === right.detail &&
    left.pickOutcome === right.pickOutcome &&
    left.gameId === right.gameId &&
    left.espnUrl === right.espnUrl &&
    left.commenceTime === right.commenceTime &&
    left.startTime === right.startTime &&
    left.team_a_score === right.team_a_score &&
    left.team_b_score === right.team_b_score &&
    left.teamAScore === right.teamAScore &&
    left.teamBScore === right.teamBScore &&
    left.scoreA === right.scoreA &&
    left.scoreB === right.scoreB &&
    left.roundLabel === right.roundLabel &&
    left.region === right.region
  );
}

function areEqualMatchupCards(previousProps, nextProps) {
  return (
    previousProps.matchup.id === nextProps.matchup.id &&
    previousProps.side === nextProps.side &&
    previousProps.interactive === nextProps.interactive &&
    previousProps.showPickOutcome === nextProps.showPickOutcome &&
    sameStyle(previousProps.style, nextProps.style) &&
    getTeamId(previousProps.teams?.[0]) === getTeamId(nextProps.teams?.[0]) &&
    getTeamId(previousProps.teams?.[1]) === getTeamId(nextProps.teams?.[1]) &&
    getTeamId(previousProps.winner) === getTeamId(nextProps.winner) &&
    sameGameInfo(previousProps.gameInfo, nextProps.gameInfo)
  );
}

export default memo(MatchupCard, areEqualMatchupCards);
