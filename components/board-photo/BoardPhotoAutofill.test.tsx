import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { BoardPhotoAutofill } from './BoardPhotoAutofill';
import { defaultConfig } from '@/lib/games/catalog';
import type { PhotoEntry, ScanResult } from '@/lib/board-photo/types';
const mocks = vi.hoisted(() => ({ decode: vi.fn(), recognize: vi.fn() }));
vi.mock('@/lib/board-photo/image', () => ({ decodePhoto: mocks.decode, FULL_CROP: { left: 0, top: 0, right: 100, bottom: 100 }, preparePhoto: (source: HTMLCanvasElement) => source }));
vi.mock('@/lib/board-photo/recognize', () => ({ recognizeBoard: mocks.recognize }));
const entry: PhotoEntry = { game: '301', config: defaultConfig(), mode: '3da', winner: 'a', players: [{ id: 'a', name: 'Ace', score: '60', points: '' }, { id: 'b', name: 'Bee', score: '', points: '' }] };
const result: ScanResult = { warnings: [], columns: [{ id: 'one', label: 'Player 1', bbox: { x0: 0, y0: 0, x1: 10, y1: 10 }, cells: [{ label: 'PPR', value: 53.12, confidence: 95, uncertain: false, raw: '17.71 / 53.12', bbox: { x0: 0, y0: 10, x1: 20, y1: 20 } }] }] };
beforeEach(() => {
    vi.clearAllMocks();
    mocks.decode.mockResolvedValue(document.createElement('canvas'));
    mocks.recognize.mockResolvedValue(result);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
});
afterEach(() => vi.restoreAllMocks());
async function load() { fireEvent.click(screen.getByRole('button', { name: 'Read board photo' })); fireEvent.change(screen.getByLabelText('Choose a photo', { exact: true }), { target: { files: [new File(['photo'], 'stats.jpg', { type: 'image/jpeg' })] } }); await screen.findByRole('button', { name: 'Read stats' }); }
async function read() { await load(); fireEvent.click(screen.getByRole('button', { name: 'Read stats' })); await screen.findByText(/Read 1 columns/); }
function review() { fireEvent.click(screen.getByRole('checkbox', { name: /I confirm 301/ })); fireEvent.change(screen.getByRole('combobox', { name: 'Assign Player 1' }), { target: { value: 'a' } }); fireEvent.click(screen.getByRole('checkbox', { name: /I checked Player 1/ })); fireEvent.click(screen.getByRole('button', { name: 'Preview changes' })); }
it('reviews and previews without saving; populated fields require replacement confirmation', async () => {
    const apply = vi.fn();
    render(<BoardPhotoAutofill entry={entry} disabled={false} onApply={apply}/>);
    await read();
    review();
    expect(screen.getByLabelText('Photo changes preview')).toHaveTextContent('60 → 53.12');
    expect(apply).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Fill match form' })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Replace the populated values shown above.' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fill match form' }));
    expect(apply).toHaveBeenCalledExactlyOnceWith({ players: [{ id: 'a', score: '53.12' }], teamScores: {} });
    expect(screen.queryByText('Review changes')).not.toBeInTheDocument();
});
it('requires reviewing edited values again and does not submit the parent form on Enter', async () => {
    const submit = vi.fn(e => e.preventDefault());
    render(<form onSubmit={submit}><BoardPhotoAutofill entry={entry} disabled={false} onApply={vi.fn()}/></form>);
    await read();
    review();
    const score = screen.getByRole('textbox', { name: 'Player 1 3DA' });
    fireEvent.change(score, { target: { value: '54' } });
    expect(screen.getByRole('checkbox', { name: /I checked Player 1/ })).not.toBeChecked();
    expect(screen.queryByText('Review changes')).not.toBeInTheDocument();
    expect(fireEvent.keyDown(score, { key: 'Enter', cancelable: true })).toBe(false);
    expect(submit).not.toHaveBeenCalled();
});
it('cancels a running scan and ignores its eventual result', async () => {
    let resolve!: (r: ScanResult) => void;
    mocks.recognize.mockImplementation(() => new Promise<ScanResult>(r => { resolve = r; }));
    const apply = vi.fn();
    render(<BoardPhotoAutofill entry={entry} disabled={false} onApply={apply}/>);
    await load();
    fireEvent.click(screen.getByRole('button', { name: 'Read stats' }));
    await waitFor(() => expect(mocks.recognize).toHaveBeenCalled());
    const signal = mocks.recognize.mock.calls[0][1] as AbortSignal;
    fireEvent.click(screen.getByRole('button', { name: 'Cancel reading' }));
    expect(signal.aborted).toBe(true);
    await act(async () => resolve(result));
    expect(screen.queryByRole('combobox', { name: 'Assign Player 1' })).not.toBeInTheDocument();
    expect(apply).not.toHaveBeenCalled();
});
it('invalidates the scan when the match context changes or saving locks the form', async () => {
    let resolve!: (r: ScanResult) => void;
    mocks.recognize.mockImplementation(() => new Promise<ScanResult>(r => { resolve = r; }));
    const view = render(<BoardPhotoAutofill entry={entry} contextKey="match-1" disabled={false} onApply={vi.fn()}/>);
    await load();
    fireEvent.click(screen.getByRole('button', { name: 'Read stats' }));
    await waitFor(() => expect(mocks.recognize).toHaveBeenCalled());
    const signal = mocks.recognize.mock.calls[0][1] as AbortSignal;
    view.rerender(<BoardPhotoAutofill entry={entry} contextKey="match-2" disabled={false} onApply={vi.fn()}/>);
    expect(signal.aborted).toBe(true);
    await act(async () => resolve(result));
    expect(screen.queryByRole('combobox', { name: 'Assign Player 1' })).not.toBeInTheDocument();
    view.rerender(<BoardPhotoAutofill entry={entry} disabled={true} onApply={vi.fn()}/>);
    expect(screen.getByRole('button', { name: 'Close board photo' })).toBeDisabled();
    expect(screen.queryByLabelText('Choose a photo', { exact: true })).not.toBeInTheDocument();
});
it('keeps the match untouched on scan failure and supports retry', async () => {
    mocks.recognize.mockRejectedValueOnce(new Error('worker unavailable'));
    const apply = vi.fn();
    render(<BoardPhotoAutofill entry={entry} disabled={false} onApply={apply}/>);
    await load();
    fireEvent.click(screen.getByRole('button', { name: 'Read stats' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Retry or enter the match manually');
    expect(apply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Read stats' }));
    await screen.findByText(/Read 1 columns/);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
