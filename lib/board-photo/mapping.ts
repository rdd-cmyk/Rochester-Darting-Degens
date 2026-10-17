import { gameDefinition, gameUnit, hasCricketPoints, isX01, parseGameScore, validateConfig } from '@/lib/games/catalog';
import type { ColumnChoice, PhotoColumn, PhotoEntry, PhotoPatch } from './types';
export function sourceOptions(column: PhotoColumn, game: string, points = false): string[] {
    const labels = column.cells.map(c => c.label);
    if (points)
        return hasCricketPoints(game) ? labels.filter(l => ['Points', 'Score'].includes(l)) : [];
    if (isX01(game))
        return labels.includes('PPR') ? ['PPR'] : labels.includes('PPD') ? ['PPD'] : [];
    if (gameUnit(game) === 'MPR')
        return labels.filter(l => l === 'MPR');
    if (gameUnit(game) === 'Darts to finish')
        return labels.filter(l => l === 'Darts');
    return labels.filter(l => ['Points', 'Score'].includes(l));
}
export function readSource(column: PhotoColumn, source: string, game: string): string {
    const cell = column.cells.find(c => c.label === source);
    if (cell?.value == null)
        return '';
    return String(isX01(game) && source === 'PPD' ? Number((cell.value * 3).toFixed(6)) : cell.value);
}
export function initialChoice(column: PhotoColumn, game: string): ColumnChoice {
    const scores = sourceOptions(column, game);
    const points = sourceOptions(column, game, true);
    const scoreSource = scores.length === 1 ? scores[0] : '';
    const pointsSource = points.length === 1 ? points[0] : '';
    return { columnId: column.id, target: '', scoreSource, pointsSource,
        score: readSource(column, scoreSource, game), points: readSource(column, pointsSource, game), reviewed: false };
}
// Pure, shared boundary: both editors apply canonical 3DA strings and retain
// their own save/recovery machinery. A shared team result is never personal.
export function buildPhotoPatch(entry: PhotoEntry, choices: ColumnChoice[]): PhotoPatch {
    const config = entry.config;
    const team = Boolean(config && config.format !== 'individual');
    const participants = entry.players.filter(p => p.id);
    if (new Set(participants.map(p => p.id)).size !== participants.length)
        throw new Error('Choose a different player for each place.');
    if (participants.length < 2)
        throw new Error('Choose at least two players in the match form first.');
    if (config)
        validateConfig(entry.game, config, participants.map(p => ({ player_id: p.id, is_winner: team
                ? Boolean(entry.winner && config.sides[p.id] === config.sides[entry.winner]) : p.id === entry.winner,
            score: null, points_scored: null })));
    else if (!participants.some(p => p.id === entry.winner))
        throw new Error('Choose the winner in the match form first.');
    const used = new Set<string>();
    const patch: PhotoPatch = { players: [], teamScores: {} };
    for (const choice of choices) {
        if (!choice.target)
            continue;
        if (used.has(choice.target))
            throw new Error('Assign each player or team only once per photo.');
        used.add(choice.target);
        if (!choice.reviewed)
            throw new Error('Review and confirm each assigned column.');
        if (!choice.score.trim() && !choice.points.trim())
            continue;
        if (choice.score.trim() && !choice.scoreSource)
            throw new Error('Choose the source row for each score.');
        if (choice.points.trim() && !choice.pointsSource)
            throw new Error('Choose the source row for points.');
        const allowedSources = isX01(entry.game) ? ['PPR', 'PPD'] : gameUnit(entry.game) === 'MPR' ? ['MPR'] : gameUnit(entry.game) === 'Darts to finish' ? ['Darts'] : ['Points', 'Score'];
        if (choice.score.trim() && !allowedSources.includes(choice.scoreSource))
            throw new Error('Choose a compatible source row for this game.');
        if (choice.points.trim() && !['Points', 'Score'].includes(choice.pointsSource))
            throw new Error('Choose the source row for points.');
        const score = choice.score.trim() ? parseGameScore(choice.score, entry.game) : null;
        const points = choice.points.trim() ? Number(choice.points) : null;
        if (points != null && (!hasCricketPoints(entry.game) || !Number.isInteger(points) || points < 0 || points > 9999))
            throw new Error('Cricket points must be a whole number from 0 to 9999.');
        if (choice.target.startsWith('team:')) {
            const side = choice.target.slice(5);
            if (!team || !['A', 'B'].includes(side))
                throw new Error('Choose a team from this match.');
            if (points != null)
                throw new Error('Shared Cricket points have no separate team-points field. Leave them blank.');
            if (gameDefinition(entry.game)?.completionOnly && config?.sides[entry.winner] !== side && score != null)
                throw new Error('Only the finishing team can have darts to finish.');
            if (score != null)
                patch.teamScores[side as 'A' | 'B'] = score;
        }
        else {
            const id = choice.target;
            if (!participants.some(p => p.id === id))
                throw new Error('Choose a player from this match.');
            if (team && !['3DA', 'MPR'].includes(gameUnit(entry.game)))
                throw new Error('This game uses a shared team score. Assign the column to a team.');
            if (gameDefinition(entry.game)?.completionOnly && entry.winner !== id && score != null)
                throw new Error('Only the finisher can have darts to finish.');
            patch.players.push({ id, ...(score != null ? { score: String(score) } : {}), ...(points != null ? { points: String(points) } : {}) });
        }
    }
    if (!patch.players.length && !Object.keys(patch.teamScores).length)
        throw new Error('Assign a column and review at least one compatible value.');
    if(isX01(entry.game)&&entry.mode==='ppd'){
        for(const player of entry.players){
            if(player.score.trim()&&!patch.players.some(p=>p.id===player.id&&p.score!==undefined)){
                try { parseGameScore(player.score,entry.game,'ppd'); }
                catch { throw new Error('Correct the other entered PPD values before applying this photo.'); }
            }
        }
    }
    return patch;
}
export function previewPhotoPatch(entry: PhotoEntry, patch: PhotoPatch) {
    const changes: {
        label: string;
        before: string;
        after: string;
    }[] = [];
    for (const p of patch.players) {
        const existing = entry.players.find(v => v.id === p.id)!;
        if (p.score !== undefined)
            changes.push({ label: `${existing.name} ${gameUnit(entry.game)}`, before: existing.score && isX01(entry.game) && entry.mode === 'ppd' ? String(Number(existing.score) * 3) : existing.score, after: p.score });
        if (p.points !== undefined)
            changes.push({ label: `${existing.name} ${entry.game === 'Cut-Throat Cricket' ? 'penalty points' : 'points'}`, before: existing.points, after: p.points });
    }
    for (const [side, value] of Object.entries(patch.teamScores))
        changes.push({ label: `Team ${side} ${gameUnit(entry.game)}`, before: entry.config?.teamScores[side as 'A' | 'B']?.toString() ?? '', after: String(value) });
    return changes;
}
export function applyPhotoPatch(entry: PhotoEntry, patch: PhotoPatch): PhotoEntry {
    return { ...entry, mode: isX01(entry.game) ? '3da' : entry.mode,
        config: entry.config ? { ...entry.config, teamScores: { ...entry.config.teamScores, ...patch.teamScores } } : null,
        players: entry.players.map(p => {
            const change = patch.players.find(c => c.id === p.id);
            return { ...p, score: change?.score ?? (isX01(entry.game) && entry.mode === 'ppd' && p.score.trim() ? String(parseGameScore(p.score,entry.game,'ppd')) : p.score), points: change?.points ?? p.points };
        }) };
}
