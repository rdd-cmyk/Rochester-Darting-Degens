import { describe, expect, it } from 'vitest';
import { buildLeagueAdvancedStats } from './engine';
import type { MatchFact } from './types';
import { defaultConfig, type GameConfig } from '@/lib/games/catalog';
import { buildNightRecap } from '@/lib/league-night/recap';

function game(id: number, size: number, winA=true, overrides: Partial<GameConfig> = {}): MatchFact[] {
  const players=Array.from({length:size*2},(_,i)=>String(i));
  const config: GameConfig={...defaultConfig(),preset:'701-double-v1',format:size===1?'individual':size===2?'2v2':'3v3',sides:size===1?{}:Object.fromEntries(players.map((p,i)=>[p,i<size?'A':'B'])),...overrides};
  return players.map((p,i)=>({matchId:String(id),playerId:p,displayName:`Player ${p}`,playedAt:new Date(Date.UTC(2026,0,id)).toISOString(),gameType:'701',gameConfig:config,boardType:'Soft Tip',venue:null,isWinner:winA?i<size:i>=size,score:null}));
}
describe('team Power Rating',()=>{
  it.each([1,2,3])('transfers one contest of points and divides credit for team size %i',size=>{
    const result=buildLeagueAdvancedStats(game(1,size));
    expect(result.matchesAnalyzed).toBe(1);
    for(const p of result.players) expect(p.rating).toBeCloseTo(1500+(p.wins?16:-16)/size,10);
    expect(result.players.reduce((n,p)=>n+p.ratingDelta,0)).toBeCloseTo(0,10);
    expect(result.players[0].evidenceGames).toBeCloseTo(1/size);
    expect(result.upsets[0].winnerIds).toHaveLength(size);
    expect(result.upsets[0].opponentNames).toHaveLength(size);
  });
  it('uses only opponents in schedule strength and explains the simultaneous update',()=>{
    const rows=[...game(1,2),...game(2,2,false)];
    const result=buildLeagueAdvancedStats(rows);
    const p=result.players.find(p=>p.playerId==='0')!;
    expect(p.strengthOfSchedule).toBe(1496);
    expect(p.ratingHistory[2].change).toBeLessThan(-8);
    expect(p.ratingHistory[2].opponents).toEqual(['Player 2','Player 3']);
    expect(p.expectedWins).toBeGreaterThan(1);
    expect(buildLeagueAdvancedStats([...rows].reverse()).players).toEqual(result.players);
  });
  it('keeps legacy 1v1 results identical to explicit individual configuration',()=>{
    const rows=[...game(1,1),...game(2,1,false)];
    const legacy=rows.map(p=>({...p,gameConfig:undefined}));
    expect(buildLeagueAdvancedStats(rows).players).toEqual(buildLeagueAdvancedStats(legacy).players);
  });
  it('rejects malformed teams and excludes practice, handicaps and unfinished results',()=>{
    for(const config of [{context:'practice'},{handicap:true},{status:'abandoned'},{sides:{'0':'A','1':'B','2':'A','3':'B'}}] as Partial<GameConfig>[]) {
      expect(buildLeagueAdvancedStats(game(1,2,true,config)).matchesAnalyzed).toBe(0);
    }
  });
  it('replays old edits without inflation',()=>{
    const rows=Array.from({length:30},(_,i)=>game(i+1,2,i%3===0)).flat();
    const before=buildLeagueAdvancedStats(rows);
    const changed=rows.map(p=>p.matchId==='1'?{...p,isWinner:!p.isWinner}:p);
    const after=buildLeagueAdvancedStats(changed);
    expect(after.players[0].rating).not.toBe(before.players[0].rating);
    expect(after.players.reduce((n,p)=>n+p.ratingDelta,0)).toBeCloseTo(0,9);
    expect(after.players.every(p=>!p.provisional)).toBe(true);
  });
  it('deduplicates identical rows but ignores contradictory outcomes or configurations', () => {
    const rows = game(1, 2);
    expect(buildLeagueAdvancedStats([...rows, rows[0]]).matchesAnalyzed).toBe(1);
    expect(buildLeagueAdvancedStats([...rows, {...rows[0], isWinner: false}]).matchesIgnored).toBe(1);
    expect(buildLeagueAdvancedStats(rows.map((p,i) => i === 0 ? {...p,gameConfig:undefined} : p)).matchesIgnored).toBe(1);
  });
  it('handles rotating partners and mixed singles, doubles and triples chronologically', () => {
    const doubles = game(2, 2).map(p => ({...p, gameConfig: {...p.gameConfig!, sides: {'0':'A','1':'B','2':'A','3':'B'} as GameConfig['sides']}, isWinner:['0','2'].includes(p.playerId)}));
    const rows = [...game(1,1), ...doubles, ...game(3,3,false)];
    const result = buildLeagueAdvancedStats(rows);
    const player = result.players.find(p => p.playerId === '0')!;
    expect(player.games).toBe(3);
    expect(player.evidenceGames).toBeCloseTo(1 + 1/2 + 1/3);
    expect(player.formatGames).toEqual({Singles:1,'2v2':1,'3v3':1});
    expect(player.ratingHistory[2].opponents).toEqual(['Player 1','Player 3']);
    expect(result.players.reduce((sum,p) => sum + p.ratingDelta,0)).toBeCloseTo(0,10);
    expect(buildLeagueAdvancedStats([...rows].reverse())).toEqual(result);
  });
  it('does not pool game variants and treats fewer finishing darts as better',()=>{
    const rows=[...game(1,1),...game(2,1)].map(p=>({...p,gameType:'Around the Clock',gameConfig:{...defaultConfig(),preset:'clock-v1'},score:p.isWinner?(p.matchId==='1'?60:45):null}));
    expect(buildLeagueAdvancedStats(rows).players[0].scoreDistribution?.best).toBe(45);
    rows[2].gameConfig.preset='clock-doubles-v1';
    expect(buildLeagueAdvancedStats(rows).scoreLabel).toBeNull();
  });
  it('includes both teammates in nightly standings and rating movements',()=>{
    const facts=game(1,2);
    const recap=buildNightRecap([{id:1,played_at:facts[0].playedAt,game_type:'701',game_config:facts[0].gameConfig,board_type:'Soft Tip',venue:null,notes:null,created_by:null,night_id:'night',revision:1,match_players:facts.map((f,i)=>({id:i,player_id:f.playerId,is_winner:f.isWinner,score:null,points_scored:null,profiles:{display_name:f.displayName,first_name:null,include_first_name_in_display:false}}))}],'night');
    expect(recap.ignored).toBe(0);
    expect(recap.standings.filter(p=>p.wins)).toHaveLength(2);
    expect(recap.ratingMoves.filter(p=>p.gain===8)).toHaveLength(2);
  });
});
