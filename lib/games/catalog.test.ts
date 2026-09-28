import { describe, expect, it } from 'vitest';
import { GAME_CATALOG, defaultConfig, parseGameScore, validateConfig, comparisonKey, type GameConfig } from './catalog';
import { readFileSync } from 'node:fs';

const participants = ['a','b','c','d'].map((player_id,i) => ({player_id,is_winner:i<2,score:null,points_scored:null}));
const doubles = (): GameConfig => ({...defaultConfig(),format:'2v2',sides:{a:'A',b:'A',c:'B',d:'B'}});
describe('recorded game contracts', () => {
  it('keeps every selectable preset supported by the SQL write contract', () => {
    const sql = readFileSync('supabase/tests/fixtures/game_modes.sql','utf8');
    for (const game of GAME_CATALOG) for (const preset of game.presets) expect(sql).toContain(`('${preset.id}','${game.name}')`);
  });
  it('distinguishes zero, missing scores, decimal averages and completion counts', () => {
    expect(parseGameScore('', 'Count-Up')).toBeNull();
    expect(parseGameScore('0', 'Count-Up')).toBe(0);
    expect(parseGameScore('23.5', '701','ppd')).toBe(70.5);
    expect(parseGameScore('2.75','Cut-Throat Cricket')).toBe(2.75);
    expect(() => parseGameScore('3.5','Around the Clock')).toThrow();
    expect(() => parseGameScore('0','Gotcha')).toThrow();
    expect(() => parseGameScore('-1','Count-Up')).toThrow();
    expect(() => parseGameScore('Infinity','Count-Up')).toThrow();
  });
  it('rejects mixed winning sides, incomplete teams and assigning an absent player', () => {
    expect(() => validateConfig('701',doubles(),participants)).not.toThrow();
    expect(() => validateConfig('701',doubles(),participants.map((p,i) => ({...p,is_winner:i%2===0})))).toThrow();
    expect(() => validateConfig('701',{...doubles(),sides:{a:'A',b:'A',c:'B'}},participants)).toThrow();
    expect(() => validateConfig('701',{...doubles(),sides:{...doubles().sides,x:'A'}},participants)).toThrow();
  });
  it('keeps shared points off individual rows and completion scores off nonfinishers', () => {
    expect(() => validateConfig('Count-Up',{...doubles(),teamScores:{A:0,B:250}},participants)).not.toThrow();
    expect(() => validateConfig('Count-Up',doubles(),participants.map(p=>({...p,score:200})))).toThrow();
    expect(() => validateConfig('Gotcha',{...doubles(),teamScores:{B:20}},participants)).toThrow();
    expect(() => validateConfig('Gotcha',defaultConfig(),[{...participants[0],score:15},{...participants[2],score:20}])).toThrow();
  });
  it('rejects a preset from another game and distinguishes Bermuda from Half-It', () => {
    expect(() => validateConfig('701',{...doubles(),preset:'clock-v1'},participants)).toThrow();
    expect(comparisonKey('Halve-It / Bermuda Triangle','Soft Tip',{...defaultConfig(),preset:'half-it-9-v1'})).not.toBe(comparisonKey('Halve-It / Bermuda Triangle','Soft Tip',{...defaultConfig(),preset:'bermuda-13-v1'}));
  });
});
