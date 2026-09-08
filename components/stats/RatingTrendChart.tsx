import type { PlayerAdvancedStats } from '@/lib/stats/types';

const CHART_COLORS = [
  'var(--stats-series-1)',
  'var(--stats-series-2)',
  'var(--stats-series-3)',
  'var(--stats-series-4)',
  'var(--stats-series-5)',
];
const WIDTH = 760;
const HEIGHT = 280;
const PADDING = { top: 24, right: 116, bottom: 34, left: 52 };

type RatingTrendChartProps = {
  players: PlayerAdvancedStats[];
};

export function RatingTrendChart({ players }: RatingTrendChartProps) {
  const chartPlayers = players
    .filter((player) => player.ratingHistory.length > 1)
    .slice(0, CHART_COLORS.length);

  if (chartPlayers.length === 0) {
    return (
      <div className="stats-chart-empty">
        Add at least one valid match to draw rating history.
      </div>
    );
  }

  const ratings = chartPlayers.flatMap((player) =>
    player.ratingHistory.map((point) => point.rating)
  );
  const rawMin = Math.min(...ratings, 1500);
  const rawMax = Math.max(...ratings, 1500);
  const padding = Math.max(20, (rawMax - rawMin) * 0.15);
  const minRating = rawMin - padding;
  const maxRating = rawMax + padding;
  const maxAppearances = Math.max(
    ...chartPlayers.map((player) => player.ratingHistory.length - 1),
    1
  );

  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const xFor = (appearance: number) =>
    PADDING.left + (appearance / maxAppearances) * plotWidth;
  const yFor = (rating: number) =>
    PADDING.top + ((maxRating - rating) / (maxRating - minRating)) * plotHeight;
  const guideRatings = [minRating, (minRating + maxRating) / 2, maxRating];

  return (
    <>
      <div className="stats-chart-wrap">
        <svg
          className="stats-rating-chart"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label="Power rating by player appearance for the leading eligible players"
        >
        <title>Power rating history</title>
        <desc>
          Lines show the rating after each player appearance. The dashed reference line is
          the starting rating of 1500. Exact values are available in the table after the
          chart.
        </desc>

        {guideRatings.map((rating) => (
          <g key={rating}>
            <line
              x1={PADDING.left}
              x2={WIDTH - PADDING.right}
              y1={yFor(rating)}
              y2={yFor(rating)}
              className="stats-chart-grid"
            />
            <text x={PADDING.left - 10} y={yFor(rating) + 4} textAnchor="end" fill="var(--stats-muted)">
              {Math.round(rating)}
            </text>
          </g>
        ))}

        <line
          x1={PADDING.left}
          x2={WIDTH - PADDING.right}
          y1={yFor(1500)}
          y2={yFor(1500)}
          className="stats-chart-baseline"
        />

        {chartPlayers.map((player, playerIndex) => {
          const color = CHART_COLORS[playerIndex];
          const points = player.ratingHistory
            .map((point, index) => `${xFor(index)},${yFor(point.rating)}`)
            .join(' ');
          const finalPoint = player.ratingHistory[player.ratingHistory.length - 1];

          return (
            <g key={player.playerId}>
              <polyline
                points={points}
                fill="none"
                stroke={color}
                strokeWidth="3"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {player.ratingHistory.map((point, index) => (
                <circle
                  key={`${player.playerId}-${point.matchId}`}
                  cx={xFor(index)}
                  cy={yFor(point.rating)}
                  r="3.5"
                  fill="var(--stats-panel)"
                  stroke={color}
                  strokeWidth="2"
                />
              ))}
              <text
                x={WIDTH - PADDING.right + 10}
                y={yFor(finalPoint.rating) + 4}
                fill={color}
                className="stats-chart-direct-label"
              >
                {player.displayName} {Math.round(player.rating)}
              </text>
            </g>
          );
        })}

        <text
          x={PADDING.left + plotWidth / 2}
          y={HEIGHT - 8}
          textAnchor="middle"
          className="stats-chart-axis-title"
        >
          Player appearances
        </text>
        </svg>
      </div>
      <details className="stats-chart-data">
        <summary>View exact rating history</summary>
        <div className="stats-table-scroll">
          <table className="stats-table">
            <caption>Exact rating history for the charted players</caption>
            <thead>
              <tr>
                <th scope="col">Player</th>
                <th scope="col">Appearance</th>
                <th scope="col">Date</th>
                <th scope="col">Rating</th>
              </tr>
            </thead>
            <tbody>
              {chartPlayers.flatMap((player) =>
                player.ratingHistory.map((point, index) => (
                  <tr key={`${player.playerId}-${point.matchId}-${index}`}>
                    <th scope="row">{player.displayName}</th>
                    <td className="stats-number">
                      {index === 0 ? 'Baseline' : index}
                    </td>
                    <td>
                      <time dateTime={point.playedAt}>
                        {new Date(point.playedAt).toLocaleDateString()}
                      </time>
                    </td>
                    <td className="stats-number">{point.rating.toFixed(1)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
