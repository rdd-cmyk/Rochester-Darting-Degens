import { it, expect } from 'vitest';
import { extractBoard, numericParts } from './extract';
import { maskPixels, validatePhoto } from './image';
import type { OcrWord } from './types';
import annotations from './fixtures/g3-photos.json';
import capturedWords from './fixtures/ocr-words.json';
const word = (text: string, x: number, y: number, width = 50): OcrWord => ({ text, confidence: 96, bbox: { x0: x, y0: y, x1: x + width, y1: y + 20 } });
it.each(capturedWords)('keeps confident first-pass readings correct for $file',sample=>{
    const expected=annotations.find(a=>a.file===sample.file)!;
    const found=extractBoard(sample.words);
    expect(found.columns).toHaveLength(expected.labels.length);
    found.columns.forEach((column,index)=>column.cells.filter(c=>!c.uncertain).forEach(cell=>{
        const rows=expected.rows as Record<string,number[]>;
        expect(cell.value,`${column.label} ${cell.label}`).toBe(rows[cell.label][index]);
    }));
});
it('reads slash pairs without silently accepting merged decimals', () => {
    expect(numericParts('17.71 / 53.12')).toEqual([17.71, 53.12]);
    expect(numericParts('0.437/1.29')).toEqual([.43, 1.29]);
    expect(numericParts('0.33/71.00')).toEqual([.33, 1]);
    expect(numericParts('17.71753.12')).toEqual([17.71, 53.12]);
    expect(numericParts('17.71/88.88')).toEqual([]);
    expect(numericParts('0')).toEqual([0]);
    expect(numericParts('18%')).toEqual([]);
});
it('finds player headings and a label column between arbitrary player columns', () => {
    const result = extractBoard([word('PLAYER', 100, 10, 60), word('1', 165, 10, 10), word('PLAYER', 400, 15, 60), word('2', 465, 15, 10),
        word('MARKS', 270, 60), word('23', 125, 57), word('27', 425, 63), word('MPD', 240, 100), word('MPR', 300, 100), word('0.37/1.10', 100, 97, 90), word('0.43/1.29', 400, 103, 90)]);
    expect(result.columns.map(c => c.label)).toEqual(['Player 1', 'Player 2']);
    expect(result.columns[0].cells.find(c => c.label === 'MPR')?.value).toBe(1.1);
    expect(result.columns[1].cells.find(c => c.label === 'Marks')?.value).toBe(27);
});
it('returns manual-entry guidance for unsupported screens', () => expect(extractBoard([word('GAME STATS', 0, 0)]).columns).toEqual([]));
it('accepts the supplied photo sizes and rejects unsupported or excessive files', () => {
    expect(() => validatePhoto({ type: 'image/jpeg', size: 13000000 })).not.toThrow();
    expect(() => validatePhoto({ type: 'image/heic', size: 100 })).toThrow('JPEG');
    expect(() => validatePhoto({ type: 'image/png', size: 26 * 1024 * 1024 })).toThrow('25 MB');
});
it('isolates white and green text while discarding blue background', () => {
    const data = new Uint8Array([220, 230, 240, 255, 0, 255, 0, 255, 20, 70, 200, 255]);
    maskPixels(data, 3, 1);
    expect([data[0], data[4], data[8]]).toEqual([0, 0, 255]);
});
