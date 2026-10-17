import type { ImageLike, Page, PSM, Worker } from 'tesseract.js';
import type { Box, OcrWord } from './types';
import { extractBoard, numericParts } from './extract';
export function pageWords(page: Page): OcrWord[] {
    return (page.blocks ?? []).flatMap(b => b.paragraphs.flatMap(p => p.lines.flatMap(l => l.words.map(w => ({ text: w.text, confidence: w.confidence, bbox: w.bbox })))));
}
export function rectangle(box: Box, width: number, height: number, pad = 15) {
    const left = Math.max(0, Math.floor(box.x0) - pad), top = Math.max(0, Math.floor(box.y0) - 8);
    return { left, top, width: Math.max(1, Math.min(width - left, Math.ceil(box.x1) - left + pad)), height: Math.max(1, Math.min(height - top, Math.ceil(box.y1) - top + 8)) };
}
/** Shared by browser and private-photo evaluation. The caller owns the local
 * worker. No storage, service calls, or game inference. */
export async function scanWithWorker(worker: Worker, masked: ImageLike, original: ImageLike, width: number, height: number, signal: AbortSignal, progress: (text: string) => void) {
    signal.throwIfAborted();
    await worker.setParameters({ tessedit_pageseg_mode: '11' as PSM, tessedit_char_whitelist: '' });
    const { data } = await worker.recognize(masked, {}, { blocks: true, text: true });
    signal.throwIfAborted();
    const words = pageWords(data), result = extractBoard(words);
    await worker.setParameters({ tessedit_pageseg_mode: '7' as PSM, tessedit_char_whitelist: 'PLAYER123456789XO0' });
    for (const column of result.columns.filter(c => c.label.includes('unreadable'))) {
        signal.throwIfAborted();
        const box = { ...column.bbox, x1: column.bbox.x1 + (column.bbox.y1 - column.bbox.y0) * 1.2 };
        const retry = await worker.recognize(original, { rectangle: rectangle(box, width, height) }, { text: true });
        const text = retry.data.text.toUpperCase().replace(/[^A-Z0-9]/g, '');
        const match = text.match(/^P(?:L|I|U)?A(?:Y|V)ER([123456789XO0])$/);
        if (match)
            column.label = `Player ${match[1] === '0' ? 'O' : match[1]}`;
    }
    await worker.setParameters({ tessedit_pageseg_mode: '7' as PSM, tessedit_char_whitelist: '0123456789./ ' });
    for (const column of result.columns) {
        const boxes = new Set<string>();
        for (const cell of column.cells.filter(c => c.uncertain)) {
            signal.throwIfAborted();
            const key = JSON.stringify(cell.bbox);
            if (boxes.has(key))
                continue;
            boxes.add(key);
            progress(`Checking ${column.label} ${cell.label}…`);
            const retry = await worker.recognize(original, { rectangle: rectangle(cell.bbox, width, height) }, { text: true });
            const values = numericParts(retry.data.text), siblings = column.cells.filter(c => JSON.stringify(c.bbox) === key);
            if (values.length === siblings.length && retry.data.confidence > cell.confidence) {
                siblings.forEach((s, i) => {
                    const different = s.value != null && s.value !== values[i];
                    s.value = values[i];
                    s.raw = retry.data.text.trim();
                    s.confidence = retry.data.confidence;
                    s.uncertain = different || s.confidence < 80 || (values.length === 2 && !/^\d+\.\d{2}\s*\/\s*\d+\.\d{2}$/.test(s.raw));
                });
            }
        }
    }
    signal.throwIfAborted();
    return { result, words };
}
