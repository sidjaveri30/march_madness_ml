import TeamSlot from "./TeamSlot";
import { isPickableTeam, sameTeam } from "./bracketTeams";
import { getDisplayGameInfo } from "./gameDisplay";

export default function MatchupCard({ matchup, teams, winner, onPick, onDetails, side, style = null, interactive = true, gameInfo = null }) {
  const [teamA, teamB] = teams;
  const canPickA = isPickableTeam(teamA);
  const canPickB = isPickableTeam(teamB);
  const displayGame = getDisplayGameInfo(gameInfo);

  return (
    <article className={`matchup-card matchup-card-${side}`} data-testid={`matchup-${matchup.id}`} style={style}>
      <div className="matchup-card-header">
        <div className="matchup-meta">
          <div className="matchup-label">{matchup.label}</div>
          {matchup.sublabel ? <div className="matchup-sublabel">{matchup.sublabel}</div> : null}
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

      {displayGame ? (
        <div className="matchup-status-row">
          <span className={`matchup-status-pill matchup-status-pill-${displayGame.status}`}>{displayGame.displayStatusLabel}</span>
          {displayGame.displayStatusDetail ? <span className="matchup-status-detail">{displayGame.displayStatusDetail}</span> : null}
        </div>
      ) : null}

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
