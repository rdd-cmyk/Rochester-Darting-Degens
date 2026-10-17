import { describe, it, expect } from 'vitest';
import { defaultConfig } from '@/lib/games/catalog';
import { applyPhotoPatch, buildPhotoPatch, initialChoice, previewPhotoPatch, sourceOptions } from './mapping';
import type { ColumnChoice, PhotoColumn, PhotoEntry } from './types';
const column = (rows: Record<string, number | null>): PhotoColumn => ({ id: 'one', label: 'Player 1', bbox: { x0: 0, y0: 0, x1: 10, y1: 10 }, cells: Object.entries(rows).map(([label, value]) => ({ label, value, raw: String(value), confidence: 90, uncertain: false, bbox: { x0: 0, y0: 0, x1: 10, y1: 10 } })) });
const entry = (game = '501'): PhotoEntry => ({ game, config: defaultConfig(), mode: '3da', winner: 'a', players: ['a', 'b'].map(id => ({ id, name: id.toUpperCase(), score: '', points: '' })) });
const choice = (patch: Partial<ColumnChoice> = {}): ColumnChoice => ({ columnId: 'one', target: 'a', scoreSource: 'PPR', pointsSource: '', score: '53.12', points: '', reviewed: true, ...patch });
describe('photo stat mapping', () => {
    it('preserves invalid unrelated PPD text by refusing the mode conversion',()=>{
        const game=entry();game.mode='ppd';game.players[1].score='bad input';
        expect(()=>buildPhotoPatch(game,[choice()])).toThrow('other entered PPD');
        expect(game.players[1].score).toBe('bad input');
    });
    it('preserves displayed PPR rather than multiplying rounded PPD', () => {
        const c = column({ PPD: 17.71, PPR: 53.12 });
        const selection = initialChoice(c, '301');
        expect(selection.score).toBe('53.12');
        expect(sourceOptions(c, '301')).toEqual(['PPR']);
        expect(buildPhotoPatch(entry('301'), [{ ...selection, target: 'a', reviewed: true }]).players[0].score).toBe('53.12');
    });
    it('only calculates 3DA when PPD is the available source', () => expect(initialChoice(column({ PPD: 17.71 }), '501').score).toBe('53.13'));
    it('does not mistake MPD or marks for Cricket MPR', () => {
        expect(initialChoice(column({ MPD: .33, Marks: 6, MPR: 1 }), 'Cricket').score).toBe('1');
        expect(initialChoice(column({ Marks: 6 }), 'Cricket').score).toBe('');
    });
    it('preserves a real zero and leaves missing values blank', () => {
        const c = initialChoice(column({ MPR: null, Points: 0 }), 'Cricket');
        expect(c.score).toBe('');
        expect(c.points).toBe('0');
    });
    it('requires explicit source choice when Points and Score both appear', () => {
        const c = column({ Points: 401, Score: 129, MPR: 2.25 });
        expect(initialChoice(c, 'Cricket').pointsSource).toBe('');
        expect(initialChoice(c, 'Count-Up').scoreSource).toBe('');
    });
    it('rejects incompatible averages and invalid points', () => {
        expect(() => buildPhotoPatch(entry(), [choice({ score: '428.57' })])).toThrow();
        expect(() => buildPhotoPatch(entry('Cricket'), [choice({ score: '2', scoreSource: 'MPR', points: '1.5', pointsSource: 'Points' })])).toThrow('whole number');
    });
    it('requires assignments, distinct players, review and a winner', () => {
        expect(() => buildPhotoPatch(entry(), [choice({ reviewed: false })])).toThrow('Review');
        expect(() => buildPhotoPatch(entry(), [choice(), choice()])).toThrow('only once');
        expect(() => buildPhotoPatch({ ...entry(), winner: '' }, [choice()])).toThrow();
        expect(() => buildPhotoPatch(entry(), [choice({ target: 'unknown' })])).toThrow('from this match');
        expect(() => buildPhotoPatch(entry(), [choice({ target: '' })])).toThrow('Assign');
    });
    it('records darts only for a confirmed finisher', () => {
        const game = entry('Gotcha');
        expect(buildPhotoPatch(game, [choice({ scoreSource: 'Darts', score: '17' })]).players[0].score).toBe('17');
        expect(() => buildPhotoPatch(game, [choice({ target: 'b', scoreSource: 'Darts', score: '15' })])).toThrow('finisher');
    });
    it.each(['2v2', '3v3'] as const)('keeps shared %s results out of personal stats', format => {
        const size = format === '2v2' ? 4 : 6;
        const players = Array.from({ length: size }, (_, i) => ({ id: String(i), name: String(i), score: '', points: '' }));
        const sides = Object.fromEntries(players.map((p, i) => [p.id, i < size / 2 ? 'A' : 'B'])) as Record<string, 'A' | 'B'>;
        const game: PhotoEntry = { ...entry('Count-Up'), winner: '0', players, config: { ...defaultConfig(), format, sides } };
        const patch = buildPhotoPatch(game, [choice({ target: 'team:A', scoreSource: 'Points', score: '3000' })]);
        expect(patch.players).toEqual([]);
        expect(patch.teamScores).toEqual({ A: 3000 });
        expect(applyPhotoPatch(game, patch).players.every(p => p.score === '')).toBe(true);
        expect(() => buildPhotoPatch({ ...game, players: players.slice(1) }, [choice({ target: 'team:A' })])).toThrow();
        expect(() => buildPhotoPatch(game, [choice({ target: '0', scoreSource: 'Points', score: '3000' })])).toThrow('shared team score');
    });
    it('allows personal team averages and prevents duplicating shared Cricket points', () => {
        const game = entry('Cricket');
        game.players = ['a', 'b', 'c', 'd'].map(id => ({ id, name: id, score: '', points: '' }));
        game.config = { ...defaultConfig(), format: '2v2', sides: { a: 'A', b: 'A', c: 'B', d: 'B' } };
        expect(buildPhotoPatch(game, [choice({ scoreSource: 'MPR', score: '2.25' })]).players[0].id).toBe('a');
        expect(() => buildPhotoPatch(game, [choice({ target: 'team:A', scoreSource: 'MPR', score: '2.25', points: '20', pointsSource: 'Points' })])).toThrow('no separate');
    });
    it('preserves unrelated values and converts existing PPD only once when switching to 3DA', () => {
        const game = entry();
        game.mode = 'ppd';
        game.players[0].score = '20';
        game.players[1].score = '18.11';
        const patch = buildPhotoPatch(game, [choice()]);
        expect(previewPhotoPatch(game, patch)[0]).toEqual({ label: 'A 3DA', before: '60', after: '53.12' });
        const next = applyPhotoPatch(game, patch);
        expect(next.mode).toBe('3da');
        expect(next.players.map(p => p.score)).toEqual(['53.12', '54.33']);
        expect(applyPhotoPatch(next, patch).players[1].score).toBe('54.33');
        expect(game.players[0].score).toBe('20');
    });
});
