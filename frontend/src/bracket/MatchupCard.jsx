import { memo } from "react";

import TeamSlot from "./TeamSlot";
import { getTeamId, isPickableTeam, sameTeam } from "./bracketTeams";
import { getDisplayGameInfo, getMatchupHeaderMeta } from "./gameDisplay";

function MatchupCard({ matchup, teams, winner, onPick, onDetails, side, style = null, interactive = true, gameInfo = null }) {
  const [teamA, teamB] = teams;
  const canPickA = isPickableTeam(teamA);
  const canPickB = isPickableTeam(teamB);
  const displayGame = getDisplayGameInfo(gameInfo);
  const headerMeta = getMatchupHeaderMeta(matchup, displayGame);

  return (
    <article className={`matchup-card matchup-card-${side}`} data-testid={`matchup-${matchup.id}`} style={style}>
      <div className="matchup-card-header">
        <div className="matchup-meta">
          <div className="matchup-label">{headerMeta.label}</div>
          {headerMeta.detail ? <div className="matchup-sublabel">{headerMeta.detail}</div> : null}
        </div>
        <button
          aria-label={`View ${matchup.label} details`}
          className="matchup-info-button"
          data-testid={`details-${matchup.id}`}
          onClick={onDetails}
          type="button"
        >
          i
        </button>
      </div>

      <div className="matchup-teams">
        <TeamSlot
          interactive={interactive}
          isDisabled={!canPickA}
          isSelected={sameTeam(winner, teamA)}
          onClick={() => canPickA && onPick(teamA)}
          score={displayGame?.team_a_score}
          seed={matchup.slots[0]?.seed}
          team={teamA}
        />
        <TeamSlot
          interactive={interactive}
          isDisabled={!canPickB}
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
    sameStyle(previousProps.style, nextProps.style) &&
    getTeamId(previousProps.teams?.[0]) === getTeamId(nextProps.teams?.[0]) &&
    getTeamId(previousProps.teams?.[1]) === getTeamId(nextProps.teams?.[1]) &&
    getTeamId(previousProps.winner) === getTeamId(nextProps.winner) &&
    sameGameInfo(previousProps.gameInfo, nextProps.gameInfo)
  );
}

export default memo(MatchupCard, areEqualMatchupCards);
