'use client';
import { defaultConfig, formatLabel, gameDefinition, gameUnit, parseGameScore, presetLabel, ratingExclusion, type GameConfig, type GameFormat } from '@/lib/games/catalog';

export function GameOptions({ game, value, onChange, players, winner, onWinner }: {
  game: string; value: GameConfig | null; onChange: (value: GameConfig) => void;
  players: { id: string; name: string }[]; winner: string; onWinner: (id: string) => void;
}) {
  const config = value ?? defaultConfig();
  const update = (patch: Partial<GameConfig>) => onChange({ ...config, ...patch });
  const team = config.format !== 'individual';
  return <section className="game-options" aria-label="Rules and format" style={{ display: 'grid', gap: '.75rem', minWidth: 0 }}>
    <label>Match format<select aria-label="Match format" value={config.format} onChange={e => {
      const format = e.target.value as GameFormat;
      update({ format, sides: {}, teamScores: {} }); onWinner('');
    }}>{(['individual','2v2','3v3'] as const).map(f => <option key={f} value={f}>{formatLabel(f)}</option>)}</select></label>
    <label>Rule preset<select aria-label="Rule preset" value={config.preset} onChange={e => update({ preset: e.target.value })}>
      <option value="unspecified">Rules unspecified / legacy</option>
      {gameDefinition(game)?.presets.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
    </select></label>
    <p style={{ margin: 0, fontSize: '.9rem' }}>{gameDefinition(game)?.presets.find(p => p.id === config.preset)?.rules ?? 'Record the result even when the exact rules are unknown. Scores stay in the unspecified-rules group.'}</p>
    {game === 'Other' && <label>Other game name<input aria-label="Other game name" maxLength={60} value={config.otherName} onChange={e => update({ otherName: e.target.value })} /></label>}
    {team && <>
      <p style={{ margin: 0 }}>Choose {config.format === '2v2' ? 'two' : 'three'} players per team. A team win changes every teammate’s rating.</p>
      {players.filter(p => p.id).map(p => <label key={p.id}>{p.name} — team<select aria-label={`${p.name} team`} value={config.sides[p.id] ?? ''} onChange={e => {
        const sides = { ...config.sides }; if (e.target.value) sides[p.id] = e.target.value as 'A' | 'B'; else delete sides[p.id];
        update({ sides }); onWinner('');
      }}><option value="">Choose team</option><option value="A">Team A</option><option value="B">Team B</option></select></label>)}
      {(['A','B'] as const).map(side => <label key={side}>Team {side} {gameUnit(game)} (optional)<input type="number" min={0} step="any" aria-label={`Team ${side} score`} value={config.teamScores[side] ?? ''} onChange={e => update({ teamScores: { ...config.teamScores, [side]: e.target.value === '' ? null : Number(e.target.value) } })} /></label>)}
      {config.status === 'completed' && <label>Winning team<select aria-label="Winning team" value={config.sides[winner] ?? ''} onChange={e => onWinner(players.find(p => config.sides[p.id] === e.target.value)?.id ?? '')}><option value="">Choose winner</option><option value="A">Team A</option><option value="B">Team B</option></select></label>}
    </>}
    <details><summary>Result eligibility & finish</summary>
      <label>Result status<select aria-label="Result status" value={config.status} onChange={e => { update({ status: e.target.value as GameConfig['status'] }); onWinner(''); }}><option value="completed">Completed</option><option value="tied">Unresolved tie (unrated)</option><option value="abandoned">Abandoned (unrated)</option></select></label>
      <label><input type="checkbox" checked={config.context === 'practice'} onChange={e => update({ context: e.target.checked ? 'practice' : 'competitive' })} /> Practice (unrated)</label>
      <label><input type="checkbox" checked={config.handicap} onChange={e => update({ handicap: e.target.checked })} /> Handicapped (unrated)</label>
      {game === 'Shanghai' && <label><input type="checkbox" checked={config.finish === 'shanghai'} onChange={e => update({ finish: e.target.checked ? 'shanghai' : 'ordinary' })} /> Won by Shanghai combination</label>}
    </details>
    {ratingExclusion(config) && <p role="status">Excluded from Power Rating: {ratingExclusion(config)}.</p>}
  </section>;
}
export function GameResultDetails({game, config}: {game: string | null; config?: GameConfig | null}) {
  if (!config) return null;
  return <span style={{display:'block'}}>{formatLabel(config.format)} · {presetLabel(game, config)}{config.otherName ? ` · ${config.otherName}` : ''}{ratingExclusion(config) ? ` · Unrated: ${ratingExclusion(config)}` : ''}{config.finish === 'shanghai' ? ' · Shanghai finish' : ''}{config.format !== 'individual' ? (['A','B'] as const).map(side => config.teamScores[side] != null ? ` · Team ${side}: ${config.teamScores[side]} ${gameUnit(game)}` : '').join('') : ''}</span>;
}

// Keep the shared score parser available to entry surfaces that use this component.
export { parseGameScore };
