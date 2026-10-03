export type GameFormat = 'individual' | '2v2' | '3v3';
export type Side = 'A' | 'B';
export type GameConfig = {
  version: 1;
  preset: string;
  format: GameFormat;
  context: 'competitive' | 'practice';
  status: 'completed' | 'tied' | 'abandoned';
  handicap: boolean;
  sides: Record<string, Side>;
  teamScores: Partial<Record<Side, number | null>>;
  otherName: string;
  finish: 'ordinary' | 'shanghai';
};
export type GameDefinition = {
  name: string;
  unit: '3DA' | 'MPR' | 'Points' | 'Darts to finish' | 'Score';
  lowerBetter?: boolean;
  cap: number;
  whole?: boolean;
  completionOnly?: boolean;
  presets: { id: string; label: string; rules: string }[];
};

const x01 = (name: string): GameDefinition => ({ name, unit: '3DA', cap: 180, presets: [
  { id: `${name}-double-v1`, label: 'Straight in · double out · 25/50 bull', rules: `Start ${name}; straight in; double out; outer bull 25, inner bull 50; no round limit.` },
  { id: `${name}-open-v1`, label: 'Straight in/out · full bull', rules: `Start ${name}; straight in/out; bull 50; no round limit.` },
  { id: `${name}-dido-v1`, label: 'Double in/out · 25/50 bull', rules: `Start ${name}; double in/out; outer bull 25, inner bull 50; no round limit.` },
  { id: `${name}-master-v1`, label: 'Straight in · master out · full bull', rules: `Start ${name}; straight in; finish on double, triple or bull; bull 50; no round limit.` },
] });
const cricketRules = 'Targets 20–15 and bull; three marks close a target; outer/inner bull one/two marks; no round limit.';
export const GAME_CATALOG: readonly GameDefinition[] = [
  x01('501'), x01('301'), x01('701'),
  { name: 'Cricket', unit: 'MPR', cap: 9, presets: [{ id: 'cricket-v1', label: 'Standard Cricket', rules: `${cricketRules} Close all targets with at least as many points as opponents to win.` }] },
  { name: 'Cut-Throat Cricket', unit: 'MPR', cap: 9, presets: [{ id: 'cut-throat-v1', label: 'Cut-Throat · 20–15 and bull', rules: `${cricketRules} Points go to opponents with that target open; close all targets with no more penalty points than opponents to win.` }] },
  { name: 'No-Score Cricket', unit: 'Darts to finish', cap: 9999, whole: true, lowerBetter: true, completionOnly: true, presets: [{ id: 'no-score-v1', label: 'Close 20–15 and bull', rules: `${cricketRules} First to close every target wins; no points.` }] },
  { name: 'Count-Up', unit: 'Points', cap: 9999, whole: true, presets: [
    { id: 'count-up-8-full-v1', label: '8 rounds · full bull', rules: 'Eight rounds of three darts; bull 50; highest points wins. Resolve ties before recording a winner.' },
    { id: 'count-up-8-split-v1', label: '8 rounds · 25/50 bull', rules: 'Eight rounds of three darts; outer bull 25, inner bull 50; highest points wins. Resolve ties before recording a winner.' },
  ] },
  { name: 'Around the Clock', unit: 'Darts to finish', cap: 9999, whole: true, lowerBetter: true, completionOnly: true, presets: [
    { id: 'clock-v1', label: '1–20 then bull · any segment', rules: 'Hit 1 through 20 in order, then either bull; doubles/triples advance one target only. First to complete wins.' },
    { id: 'clock-doubles-v1', label: 'Doubles 1–20 then double bull', rules: 'Hit doubles 1 through 20 in order, then double bull. First to complete wins.' },
  ] },
  { name: 'Shanghai', unit: 'Points', cap: 9999, whole: true, presets: [{ id: 'shanghai-7-v1', label: '7 rounds · instant Shanghai win', rules: 'Three darts at each target 1 through 7. Highest points wins, or a single, double and triple of the current target in one turn wins immediately.' }] },
  { name: 'Gotcha', unit: 'Darts to finish', cap: 9999, whole: true, lowerBetter: true, completionOnly: true, presets: [
    { id: 'gotcha-301-return-v1', label: '301 · bust restores turn start', rules: 'Count up from zero to exactly 301; straight out; bull 50. After each dart, matching an opponent resets their score to zero. Overshooting restores your turn-start score and ends the turn. No round limit.' },
    { id: 'gotcha-301-subtract-v1', label: '301 · Arachnid excess penalty', rules: 'Count up from zero to exactly 301; straight out; bull 50. Matching an opponent resets them to zero. Overshooting subtracts the excess from your turn-start score; no reset on a bust. No round limit.' },
  ] },
  { name: 'Halve-It / Bermuda Triangle', unit: 'Points', cap: 9999, whole: true, presets: [
    { id: 'half-it-9-v1', label: 'Halve-It · 9 rounds', rules: 'Start 40; targets 15,16,any double,17,18,any triple,19,20,bull. Three darts per round; missing all three halves the score, rounded down. Bull 25/50. Highest score wins.' },
    { id: 'bermuda-13-v1', label: 'Bermuda Triangle · 13 rounds', rules: 'Start zero; targets 12,13,14,any double,15,16,17,any triple,18,19,20,bull,double bull. Three darts per round; missing all three halves the score, rounded down. Bull 25/50. Highest score wins.' },
  ] },
  { name: 'Other', unit: 'Score', cap: 9999, whole: true, presets: [] },
];
export const GAME_TYPES = GAME_CATALOG.map(g => g.name);
export function gameDefinition(game: string | null) { return GAME_CATALOG.find(g => g.name === game); }
export function isX01(game: string | null) { return gameDefinition(game)?.unit === '3DA'; }
export function hasCricketPoints(game: string | null) { return game === 'Cricket' || game === 'Cut-Throat Cricket'; }
export function gameUnit(game: string | null) { return gameDefinition(game)?.unit ?? 'Score'; }
export function defaultConfig(): GameConfig {
  // No automatic assertion about the board's rules. The recorder selects a preset.
  return { version: 1, preset: 'unspecified', format: 'individual', context: 'competitive', status: 'completed', handicap: false, sides: {}, teamScores: {}, otherName: '', finish: 'ordinary' };
}
export function formatLabel(format?: GameFormat) { return format === '2v2' ? 'Doubles (2v2)' : format === '3v3' ? 'Triples (3v3)' : 'Individual'; }
export function presetLabel(game: string | null, config?: GameConfig | null) {
  return gameDefinition(game)?.presets.find(p => p.id === config?.preset)?.label ?? 'Rules unspecified';
}
export function ratingExclusion(config?: GameConfig | null): string | null {
  if (!config) return null;
  if (config.context === 'practice') return 'Practice result';
  if (config.status !== 'completed') return `Result ${config.status}`;
  if (config.handicap) return 'Handicapped result';
  return null;
}
export function comparisonKey(game: string | null, board: string | null, config?: GameConfig | null) {
  return JSON.stringify([game, board, config?.preset ?? 'unspecified', config?.format ?? 'individual']);
}
// Keep the original home/profile averages intact without mixing new rule or
// shared-team cohorts into them. Detailed comparisons live in Advanced Stats.
export function isLegacyScoreCohort(config?: GameConfig | null) {
  return !config || (config.format === 'individual' && config.preset === 'unspecified');
}
export function parseGameScore(raw: string, game: string | null, mode: '3da' | 'ppd' = '3da'): number | null {
  if (!raw.trim()) return null;
  let score = Number(raw);
  const definition = gameDefinition(game);
  if (isX01(game) && mode === 'ppd') score *= 3;
  if (!Number.isFinite(score) || score < 0 || score > (definition?.cap ?? 9999) ||
      ((definition ? definition.whole : true) && !Number.isInteger(score)) || (definition?.completionOnly && score === 0))
    throw new Error(`${game ?? 'Game'}: enter ${definition?.completionOnly ? 'a positive' : 'a nonnegative'} ${(definition ? definition.whole : true) ? 'whole number' : 'number'} up to ${definition?.cap ?? 9999}, or leave it blank.`);
  return Number(score.toFixed(6));
}
export function validateConfig(game: string | null, config: GameConfig, players: { player_id: string; is_winner: boolean; score: number | null; points_scored: number | null }[]) {
  if (config.version !== 1 || !['individual', '2v2', '3v3'].includes(config.format) ||
      !['competitive', 'practice'].includes(config.context) || !['completed','tied','abandoned'].includes(config.status) ||
      typeof config.handicap !== 'boolean' || typeof config.otherName !== 'string' || config.otherName.length > 60 ||
      !['ordinary','shanghai'].includes(config.finish) || (config.finish === 'shanghai' && game !== 'Shanghai'))
    throw new Error('Check the game rules and result settings.');
  if (config.preset !== 'unspecified' && !gameDefinition(game)?.presets.some(p => p.id === config.preset)) throw new Error('Choose rules for this game.');
  if (!config.sides || !config.teamScores || typeof config.sides !== 'object' || typeof config.teamScores !== 'object') throw new Error('Choose valid teams.');
  if (Object.keys(config.sides).some(id => !players.some(p => p.player_id === id)) || Object.values(config.sides).some(side => !['A','B'].includes(side))) throw new Error('Team assignments must match the selected players.');
  if (config.format === 'individual') {
    if (Object.keys(config.sides).length || Object.keys(config.teamScores).length) throw new Error('Individual games cannot contain team scores or assignments.');
    if (players.filter(p => p.is_winner).length !== (config.status === 'completed' ? 1 : 0)) throw new Error('Choose exactly one winner for a completed game.');
  } else {
    const size = config.format === '2v2' ? 2 : 3;
    if (players.length !== size * 2 || ['A','B'].some(side => players.filter(p => config.sides[p.player_id] === side).length !== size)) throw new Error(`Assign ${size} different players to each team.`);
    const winningSides = ['A','B'].filter(side => players.filter(p => config.sides[p.player_id] === side).every(p => p.is_winner));
    if (config.status === 'completed' ? winningSides.length !== 1 || players.filter(p => p.is_winner).length !== size : players.some(p => p.is_winner)) throw new Error('Choose one winning team for a completed game.');
    for (const [side, score] of Object.entries(config.teamScores)) {
      if (!['A','B'].includes(side)) throw new Error('Unknown team score.');
      if (score != null) {
        parseGameScore(String(score), game);
        if (gameDefinition(game)?.completionOnly && !winningSides.includes(side)) throw new Error('Only the finishing team can have darts to finish.');
      }
    }
    if (!['3DA','MPR'].includes(gameUnit(game)) && players.some(p => p.score !== null || p.points_scored !== null)) throw new Error('Enter the shared score on the team, not individual players.');
  }
  if (config.format === 'individual' && gameDefinition(game)?.completionOnly && players.some(p => !p.is_winner && p.score !== null)) throw new Error('Only the finisher can have darts to finish.');
}
