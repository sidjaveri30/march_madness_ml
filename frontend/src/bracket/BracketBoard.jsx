import { useMemo } from "react";

import { computeBracketLayout } from "./bracketLayout";
import MatchupCard from "./MatchupCard";

function DebugOverlay({ layout }) {
  return (
    <>
      {layout.guides.columns.map((guide) => (
        <div
          className="bracket-debug-column"
          key={guide.key}
          style={{ left: guide.x }}
        />
      ))}
      {layout.guides.points.map((point) => (
        <div
          className="bracket-debug-point"
          key={point.key}
          style={{ left: point.x, top: point.y }}
        />
      ))}
      {layout.guides.anchors.map((point) => (
        <div
          className="bracket-debug-anchor"
          key={point.key}
          style={{ left: point.x, top: point.y }}
        />
      ))}
    </>
  );
}

export default function BracketBoard({
  debugLayout = false,
  definition,
  getGameInfo = () => null,
  getTeams,
  getWinner,
  interactive = true,
  onDetails,
  onPick = () => {},
}) {
  const layout = useMemo(() => computeBracketLayout(definition), [definition]);

  return (
    <section
      className={`visual-bracket cbs-bracket-board ${debugLayout ? "visual-bracket-debug" : ""}`}
      data-testid="visual-bracket"
      style={{ width: layout.board.width, height: layout.board.height }}
    >
      <svg
        aria-hidden="true"
        className="bracket-connector-layer"
        height={layout.board.height}
        viewBox={`0 0 ${layout.board.width} ${layout.board.height}`}
        width={layout.board.width}
      >
        {layout.connectors.map((connector) => (
          <path className="bracket-connector-path" d={connector.path} key={connector.id} />
        ))}
      </svg>

      {layout.roundHeaders.map((header) => (
        <div
          className={`board-round-header ${header.key.includes("center") ? "board-round-header-center" : ""}`}
          key={header.key}
          style={{ left: header.x, top: header.top, width: header.width }}
        >
          {header.label}
        </div>
      ))}

      {layout.regionLabels.map((label) => (
        <div
          className={`board-region-label board-region-label-${label.side}`}
          key={label.region}
          style={{ left: label.x, top: label.y, width: label.width }}
        >
          <span>{label.region}</span>
        </div>
      ))}

      {layout.cards.map((card) => (
        <MatchupCard
          gameInfo={getGameInfo(card.matchup.id)}
          interactive={interactive}
          key={card.matchup.id}
          matchup={card.matchup}
          onDetails={() => onDetails(card.matchup)}
          onPick={(winner) => onPick(card.matchup.id, winner)}
          side={card.side}
          style={{ left: card.x, top: card.y, width: card.width || undefined }}
          teams={getTeams(card.matchup.id)}
          winner={getWinner(card.matchup.id)}
        />
      ))}

      {debugLayout ? <DebugOverlay layout={layout} /> : null}
    </section>
  );
}
