import MatchupCard from "./MatchupCard";

export default function RoundColumn({ title, matchups, getTeams, getWinner, onPick, onDetails, side = "left", roundKey }) {
  return (
    <div className={`round-column round-column-${side} round-column-${roundKey || "generic"}`}>
      <div className="round-title">{title}</div>
      <div className="round-stack">
        {matchups.map((matchup) => (
          <MatchupCard
            key={matchup.id}
            getWinner={getWinner}
            matchup={matchup}
            onDetails={() => onDetails(matchup)}
            onPick={(winner) => onPick(matchup.id, winner)}
            teams={getTeams(matchup.id)}
            winner={getWinner(matchup.id)}
            side={side}
          />
        ))}
      </div>
    </div>
  );
}
