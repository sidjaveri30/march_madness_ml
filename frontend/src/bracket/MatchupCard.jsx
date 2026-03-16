import TeamSlot from "./TeamSlot";
import { isPickableTeam, sameTeam } from "./bracketTeams";
import { getDisplayGameInfo, getMatchupHeaderMeta } from "./gameDisplay";

export default function MatchupCard({ matchup, teams, winner, onPick, onDetails, side, style = null, interactive = true, gameInfo = null }) {
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
