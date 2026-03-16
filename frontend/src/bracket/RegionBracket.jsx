import RoundColumn from "./RoundColumn";

export default function RegionBracket({ region, rounds, getTeams, getWinner, onPick, onDetails, side }) {
  const orderedRounds =
    side === "right"
      ? [
          ["elite8", rounds.elite8, "Elite Eight"],
          ["sweet16", rounds.sweet16, "Sweet 16"],
          ["secondRound", rounds.secondRound, "Second Round"],
          ["firstRound", rounds.firstRound, "First Round"],
        ]
      : [
          ["firstRound", rounds.firstRound, "First Round"],
          ["secondRound", rounds.secondRound, "Second Round"],
          ["sweet16", rounds.sweet16, "Sweet 16"],
          ["elite8", rounds.elite8, "Elite Eight"],
        ];

  return (
    <section className={`region-bracket region-bracket-${side}`}>
      <div className="region-header">
        <div className="region-name">{region}</div>
      </div>
      <div className="region-columns">
        {orderedRounds.map(([roundKey, matchups, title]) => (
          <RoundColumn
            getTeams={getTeams}
            getWinner={getWinner}
            key={roundKey}
            matchups={matchups}
            onDetails={onDetails}
            onPick={onPick}
            roundKey={roundKey}
            side={side}
            title={title}
          />
        ))}
      </div>
    </section>
  );
}
