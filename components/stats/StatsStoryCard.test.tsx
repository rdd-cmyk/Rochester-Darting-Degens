import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { StatsStoryCard } from './StatsStoryCard';

describe('StatsStoryCard', () => {
  test('presents the story and links to the player profile', () => {
    render(
      <StatsStoryCard
        eyebrow="Power leader"
        value="1542"
        playerId="player-1"
        playerName="Ace"
        detail="Established rating"
      />
    );

    expect(screen.getByText('Power leader')).toBeInTheDocument();
    expect(screen.getByText('1542')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ace' })).toHaveAttribute(
      'href',
      '/profiles/player-1'
    );
  });

  test('supports a league-level story without a player link', () => {
    render(
      <StatsStoryCard
        eyebrow="Matches analyzed"
        value="28"
        detail="Across the current filter"
        accent="silver"
      />
    );

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
