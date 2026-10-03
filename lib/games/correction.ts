import { buildLeagueAdvancedStats } from '@/lib/stats/engine';
import { facts } from '@/lib/league-night/recap';
import type { NightMatch, MatchWrite } from '@/lib/league-night/types';

/** Preview a correction against complete authorized history, without writing. */
export function previewCorrection(history: NightMatch[], payload: MatchWrite) {
  const original=history.find(m=>m.id===payload.match_id);
  if(!original || original.revision!==payload.expected_revision) throw new Error('Reload this match before previewing its correction.');
  const replacement: NightMatch={...original,played_at:payload.played_at,game_type:payload.game_type,game_config:payload.game_config,board_type:payload.board_type,venue:payload.venue,notes:payload.notes,match_players:payload.players.map((p,i)=>({...p,id:i,profiles:original.match_players?.find(q=>q.player_id===p.player_id)?.profiles}))};
  const before=buildLeagueAdvancedStats(facts(history));
  const after=buildLeagueAdvancedStats(facts(history.map(m=>m.id===original.id?replacement:m)));
  const ids=new Set([...before.players,...after.players].map(p=>p.playerId));
  const changes=[...ids].map(id=>{
    const a=before.players.find(p=>p.playerId===id),b=after.players.find(p=>p.playerId===id);
    return {id,name:b?.displayName??a?.displayName??'Player',before:a?.rating??1500,after:b?.rating??1500};
  }).filter(p=>Math.abs(p.after-p.before)>1e-8);
  return {from:original.game_type,to:payload.game_type,changes};
}
