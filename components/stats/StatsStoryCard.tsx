import Link from 'next/link';

type StatsStoryCardProps = {
  eyebrow: string;
  value: string;
  playerId?: string;
  playerName?: string;
  detail: string;
  accent?: 'orange' | 'blue' | 'cream' | 'silver';
};

export function StatsStoryCard({
  eyebrow,
  value,
  playerId,
  playerName,
  detail,
  accent = 'orange',
}: StatsStoryCardProps) {
  return (
    <article className={`stats-story-card stats-story-card--${accent}`}>
      <p className="stats-eyebrow">{eyebrow}</p>
      <p className="stats-story-value">{value}</p>
      {playerId && playerName ? (
        <Link className="stats-player-link" href={`/profiles/${playerId}`}>
          {playerName}
        </Link>
      ) : null}
      <p className="stats-story-detail">{detail}</p>
    </article>
  );
}
