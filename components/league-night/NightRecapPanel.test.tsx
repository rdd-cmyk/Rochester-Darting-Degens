import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { defaultConfig } from '@/lib/games/catalog';
import type { LeagueNight, NightMatch } from '@/lib/league-night/types';
import { NightRecapPanel } from './NightRecapPanel';

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
