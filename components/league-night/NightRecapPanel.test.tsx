import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { defaultConfig } from '@/lib/games/catalog';
import type { LeagueNight, NightMatch } from '@/lib/league-night/types';
import { NightRecapPanel } from './NightRecapPanel';
vi.mock('@/components/solo/NightSoloActivity', () => ({ NightSoloActivity: () => null }));

it('credits every winning teammate in the ordered nightly recap', () => {
  const night: LeagueNight = {id:'night', title:'Local test night', night_date:'2026-01-01',
    venue:null, created_by:'a', created_at:'2026-01-01T00:00:00Z'};
  const ids = ['a','b','c','d'];
  const match: NightMatch = {id:1, revision:1, night_id:'night', created_by:'a',
    played_at:'2026-01-01T20:00:00Z', game_type:'701', board_type:'Soft Tip',
    venue:null, notes:null, game_config:{...defaultConfig(), format:'2v2', preset:'701-double-v1',
      sides:{a:'A',b:'A',c:'B',d:'B'}}, match_players:ids.map((player_id,i)=>({
      id:i+1, player_id, is_winner:i<2, score:null, points_scored:null,
      profiles:{display_name:player_id.toUpperCase(), first_name:null, include_first_name_in_display:false},
    }))};
  render(<NightRecapPanel night={night} history={[match]} loading={false} error="" onRefresh={()=>{}} />);
  expect(screen.getByText('A + B won as Doubles (2v2)')).toBeInTheDocument();
});
it.each(['tied', 'abandoned'] as const)('shows an unrated %s result without inventing a winner or an invalid-result warning', (status) => {
  const night: LeagueNight = {id:'night', title:'Local test night', night_date:'2026-01-01',
    venue:null, created_by:'a', created_at:'2026-01-01T00:00:00Z'};
  const match: NightMatch = {id:2, revision:1, night_id:'night', created_by:'a',
    played_at:'2026-01-01T20:00:00Z', game_type:'501', board_type:'Soft Tip',
    venue:null, notes:null, game_config:{...defaultConfig(), status},
    match_players:['a','b'].map((player_id,i)=>({id:i+1,player_id,is_winner:false,
      score:50, points_scored:null, profiles:{display_name:player_id.toUpperCase(),first_name:null,include_first_name_in_display:false}}))};
  const view = render(<NightRecapPanel night={night} history={[match]} loading={false} error="" onRefresh={()=>{}} />);
  expect(screen.getByText('1 recorded game · 2 players in action')).toBeInTheDocument();
  expect(screen.getByText(status === 'tied' ? 'Tied game' : 'Abandoned game')).toBeInTheDocument();
  expect(screen.getByText(`Unrated · Result ${status}`)).toBeInTheDocument();
  expect(view.container.querySelector('.night-warning')).toBeNull();
  expect(view.container.querySelector('.night-result')?.textContent).not.toContain('won');
});
