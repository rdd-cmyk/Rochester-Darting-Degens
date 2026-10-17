'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { ActionButton } from '@/components/ui/ActionButton';
import { gameUnit, isX01 } from '@/lib/games/catalog';
import { buildPhotoPatch, initialChoice, previewPhotoPatch, readSource, sourceOptions } from '@/lib/board-photo/mapping';
import { decodePhoto, FULL_CROP, preparePhoto, type Crop } from '@/lib/board-photo/image';
import type { ColumnChoice, PhotoEntry, PhotoPatch, ScanResult } from '@/lib/board-photo/types';
import './board-photo.css';
export function BoardPhotoAutofill({ entry, disabled, onApply, contextKey = '' }: {
    entry: PhotoEntry;
    disabled: boolean;
    contextKey?: string;
    onApply: (patch: PhotoPatch) => void;
}) {
    const [open, setOpen] = useState(false);
    return <section className="board-photo-tool" aria-label="Board photo autofill">
    <ActionButton disabled={disabled} onClick={() => setOpen(!open)}>{open ? 'Close board photo' : 'Read board photo'}</ActionButton>
    {open && !disabled && <PhotoReview key={contextKey + JSON.stringify(entry)} entry={entry} onClose={() => setOpen(false)} onApply={patch => { onApply(patch); setOpen(false); }}/>}
  </section>;
}
function PhotoReview({ entry, onApply, onClose }: {
    entry: PhotoEntry;
    onApply: (patch: PhotoPatch) => void;
    onClose: () => void;
}) {
    const id = useId();
    const [source, setSource] = useState<HTMLCanvasElement | null>(null);
    const [crop, setCrop] = useState<Crop>(FULL_CROP);
    const [rotation, setRotation] = useState(0);
    const [busy, setBusy] = useState(false);
    const [status, setStatus] = useState('');
    const [error, setError] = useState('');
    const [result, setResult] = useState<ScanResult | null>(null);
    const [choices, setChoices] = useState<ColumnChoice[]>([]);
    const [confirmed, setConfirmed] = useState(false);
    const [preview, setPreview] = useState<PhotoPatch | null>(null);
    const [replace, setReplace] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const request = useRef<AbortController | null>(null);
    const mounted = useRef(true);
    const team = Boolean(entry.config && entry.config.format !== 'individual');
    const participants = entry.players.filter(p => p.id);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; request.current?.abort(); }; }, []);
    useEffect(() => {
        if (!source || !canvasRef.current)
            return;
        const canvas = preparePhoto(source, crop, rotation);
        const target = canvasRef.current;
        target.width = canvas.width;
        target.height = canvas.height;
        target.getContext('2d')?.drawImage(canvas, 0, 0);
    }, [source, crop, rotation]);
    function invalidate() { request.current?.abort(); request.current = null; setBusy(false); setResult(null); setChoices([]); setPreview(null); setReplace(false); setError(''); }
    async function select(file?: File) {
        if (!file)
            return;
        invalidate();
        const control = new AbortController();
        request.current = control;
        setBusy(true);
        setStatus('Preparing photo…');
        try {
            const decoded = await decodePhoto(file);
            if (!mounted.current || control.signal.aborted)
                return;
            setSource(decoded);
            setCrop(FULL_CROP);
            setRotation(0);
            setStatus('Photo ready. Crop to the table if needed, then read stats.');
        }
        catch (e) {
            if (mounted.current && !control.signal.aborted)
                setError(e instanceof Error ? e.message : 'Could not open this photo. Try JPEG, PNG, or WebP.');
        }
        finally {
            if (mounted.current && !control.signal.aborted)
                setBusy(false);
        }
    }
    async function scan() {
        if (!source)
            return;
        invalidate();
        const control = new AbortController();
        request.current = control;
        setBusy(true);
        setStatus('Starting local reader…');
        try {
            const { recognizeBoard } = await import('@/lib/board-photo/recognize');
            const found = await recognizeBoard(preparePhoto(source, crop, rotation), control.signal, text => { if (mounted.current && !control.signal.aborted)
                setStatus(text); });
            if (!mounted.current || control.signal.aborted)
                return;
            setResult(found);
            setChoices(found.columns.map(c => initialChoice(c, entry.game)));
            setStatus(found.columns.length ? `Read ${found.columns.length} columns. Check the photo and confirm every assigned column.` : 'No supported stats found. Crop closer and retry, or enter the match manually.');
        }
        catch (e) {
            if (mounted.current && !control.signal.aborted)
                setError(e instanceof Error ? `Could not read this photo: ${e.message}. Retry or enter the match manually.` : 'Could not read this photo. Retry or enter the match manually.');
        }
        finally {
            if (mounted.current && !control.signal.aborted)
                setBusy(false);
        }
    }
    function change(index: number, patch: Partial<ColumnChoice>) { setPreview(null); setReplace(false); setError(''); setChoices(old => old.map((c, i) => i === index ? { ...c, ...patch, ...(!('reviewed' in patch) ? { reviewed: false } : {}) } : c)); }
    function showPreview() {
        setError('');
        try {
            if (!confirmed)
                throw new Error('Confirm the game and match format first.');
            setPreview(buildPhotoPatch(entry, choices));
            setReplace(false);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Check the assignments and values.');
        }
    }
    const changes = preview ? previewPhotoPatch(entry, preview) : [];
    const overwrites = changes.some(c => c.before !== '' && c.before !== c.after);
    return <div className="board-photo-review rdd-form-controls" onKeyDown={event => {
            if (event.key === 'Enter' && event.target instanceof HTMLInputElement && !['checkbox', 'file'].includes(event.target.type)) {
                event.preventDefault();
                event.stopPropagation();
            }
        }}>
    <h3 className="rdd-section-title">Read a board photo</h3>
    <p>Choose the game, players, teams and winner in the match form first. Then match each board column below. Photos stay in this browser; saving the match is a separate step.</p>
    <p className="rdd-field-help">Changing the match form resets this reader. Supported: the pictured G3 two- and three-column stats screens.</p>
    <div className="board-photo-actions">
      <label htmlFor={`${id}-file`}>Choose a photo<input id={`${id}-file`} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e => { void select(e.target.files?.[0]); e.target.value = ''; }}/></label>
      <label htmlFor={`${id}-camera`}>Take a photo<input id={`${id}-camera`} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={busy} onChange={e => { void select(e.target.files?.[0]); e.target.value = ''; }}/></label>
    </div>
    <div className="board-photo-layout">
      {source && <div>
        <canvas className="board-photo-canvas" ref={canvasRef} role="img" aria-label="Board photo after crop and rotation"/>
        <fieldset disabled={busy} className="board-photo-crop"><legend>Crop and rotate</legend>
          {(['left', 'top', 'right', 'bottom'] as const).map(edge => <label key={edge}>{edge[0].toUpperCase() + edge.slice(1)} %<input type="number" min={0} max={100} step={1} value={crop[edge]} onChange={e => {
                    const next = { ...crop, [edge]: Math.max(0, Math.min(100, Number(e.target.value))) };
                    if (next.right - next.left < 10 || next.bottom - next.top < 10)
                        return;
                    invalidate();
                    setCrop(next);
                }}/></label>)}
          <label>Rotation (degrees)<input type="number" min={-180} max={180} value={rotation} onChange={e => { invalidate(); setRotation(Math.max(-180, Math.min(180, Number(e.target.value)))); }}/></label>
          <ActionButton onClick={() => { invalidate(); setCrop(FULL_CROP); setRotation(0); }}>Reset crop</ActionButton>
        </fieldset>
        <div className="board-photo-actions"><ActionButton disabled={busy} onClick={() => void scan()}>{result ? 'Read again' : 'Read stats'}</ActionButton>
          {busy && <ActionButton onClick={() => { invalidate(); setStatus('Reading cancelled. Your match entry is unchanged.'); }}>Cancel reading</ActionButton>}
        </div>
      </div>}
      <div className="board-photo-values">
        <p role="status" aria-live="polite">{status}</p>
        {error && <p className="rdd-state" role="alert">{error}</p>}
        {result?.warnings.map(w => <p key={w}>{w}</p>)}
        {result && result.columns.length > 0 && <>
          <label><input type="checkbox" checked={confirmed} onChange={e => { setConfirmed(e.target.checked); setPreview(null); }}/> I confirm {entry.game}, {entry.config?.format ?? 'individual'}, and the winner/result selected in the match form.</label>
          {result.columns.map((column, index) => {
                const choice = choices[index];
                if (!choice)
                    return null;
                const scoreSources = sourceOptions(column, entry.game), pointSources = sourceOptions(column, entry.game, true);
                const shared = choice.target.startsWith('team:');
                return <fieldset key={column.id} className="board-photo-column"><legend>{column.label}</legend>
              <label>Assign {column.label}<select value={choice.target} onChange={e => change(index, { target: e.target.value, points: e.target.value.startsWith('team:') ? '' : choice.points })}>
                <option value="">Skip this column</option>
                {participants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                {team && <><option value="team:A">Shared Team A result</option><option value="team:B">Shared Team B result</option></>}
              </select></label>
              <details><summary>Detected rows and uncertainty</summary><dl>{column.cells.map(c => <div key={c.label}><dt>{c.label}{c.uncertain ? ' — check reading' : ''}</dt><dd>{c.value ?? 'Unreadable'}<span className="rdd-field-help">{c.raw ? ` (read “${c.raw.trim()}”)` : ''}</span></dd></div>)}</dl></details>
              <label>{column.label} {gameUnit(entry.game)} source<select value={choice.scoreSource} onChange={e => change(index, { scoreSource: e.target.value, score: readSource(column, e.target.value, entry.game) })}><option value="">Choose source / leave blank</option>{scoreSources.map(s => <option key={s} value={s}>{s}{isX01(entry.game) && s === 'PPD' ? ' × 3 (calculated)' : ''}</option>)}</select></label>
              <label>{column.label} {gameUnit(entry.game)}<input type="text" inputMode="decimal" value={choice.score} disabled={!choice.scoreSource} onChange={e => change(index, { score: e.target.value })}/></label>
              {column.cells.some(c => c.uncertain && [choice.scoreSource, choice.pointsSource].includes(c.label)) && <p>Uncertain reading: check the selected values against the photo, or correct them before confirming.</p>}
              {choice.scoreSource === 'PPD' && isX01(entry.game) && <p>Calculated from rounded PPD × 3. Check against the board.</p>}
              {pointSources.length > 0 && !shared && <>
                <label>{column.label} {entry.game === 'Cut-Throat Cricket' ? 'penalty points' : 'points'} source<select value={choice.pointsSource} onChange={e => change(index, { pointsSource: e.target.value, points: readSource(column, e.target.value, entry.game) })}><option value="">Choose source / leave blank</option>{pointSources.map(s => <option key={s} value={s}>{s}</option>)}</select></label>
                <label>{column.label} {entry.game === 'Cut-Throat Cricket' ? 'penalty points' : 'points'}<input type="text" inputMode="numeric" value={choice.points} disabled={!choice.pointsSource} onChange={e => change(index, { points: e.target.value })}/></label>
              </>}
              {shared && pointSources.length > 0 && <p>Only the shared {gameUnit(entry.game)} can be applied. The form has no separate shared Cricket points field.</p>}
              {!scoreSources.length && !pointSources.length && <p>No compatible source rows for this game. Enter its stats manually in the match form.</p>}
              <label><input type="checkbox" checked={choice.reviewed} disabled={!choice.target} onChange={e => change(index, { reviewed: e.target.checked })}/> I checked {column.label}’s assignment and values against the photo.</label>
            </fieldset>;
            })}
          <ActionButton disabled={busy} onClick={showPreview}>Preview changes</ActionButton>
        </>}
        {preview && <section aria-label="Photo changes preview" className="board-photo-preview">
          <h4>Review changes</h4><ul>{changes.map(c => <li key={c.label}>{c.label}: {c.before || 'blank'} → <strong>{c.after}</strong></li>)}</ul>
          {overwrites && <label><input type="checkbox" checked={replace} onChange={e => setReplace(e.target.checked)}/> Replace the populated values shown above.</label>}
          <ActionButton variant="primary" disabled={busy || (overwrites && !replace)} onClick={() => onApply(preview)}>Fill match form</ActionButton>
        </section>}
      </div>
    </div>
    <ActionButton onClick={onClose}>Cancel photo review</ActionButton>
  </div>;
}
