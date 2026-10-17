import type { Box, OcrWord, PhotoCell, ScanResult } from './types';
const centerY = (b: Box) => (b.y0 + b.y1) / 2;
const centerX = (b: Box) => (b.x0 + b.x1) / 2;
function union(words: OcrWord[]): Box {
    return { x0: Math.min(...words.map(w => w.bbox.x0)), y0: Math.min(...words.map(w => w.bbox.y0)), x1: Math.max(...words.map(w => w.bbox.x1)), y1: Math.max(...words.map(w => w.bbox.y1)) };
}
export function wordLines(words: OcrWord[]) {
    const lines: OcrWord[][] = [];
    for (const word of [...words].sort((a, b) => centerY(a.bbox) - centerY(b.bbox))) {
        const line = lines.find(l => Math.abs(centerY(l[0].bbox) - centerY(word.bbox)) < Math.max(10, (word.bbox.y1 - word.bbox.y0) * .65));
        if (line)
            line.push(word);
        else
            lines.push([word]);
    }
    return lines.map(line => line.sort((a, b) => a.bbox.x0 - b.bbox.x0));
}
function rowLabel(text: string): string[] | null {
    const clean = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (/MP[DOIU].*MPR/.test(clean))
        return ['MPD', 'MPR'];
    if (/PPD.*PPR/.test(clean))
        return ['PPD', 'PPR'];
    if (clean === 'MPR' || clean === 'PPD' || clean === 'PPR')
        return [clean];
    if (/^(POINTS|P0INTS)$/.test(clean))
        return ['Points'];
    if (clean === 'SCORE')
        return ['Score'];
    if (/^(DARTS|0ARTS)$/.test(clean))
        return ['Darts'];
    if (/^MARKS$/.test(clean))
        return ['Marks'];
    if (/^ROUNDS$/.test(clean))
        return ['Rounds'];
    return null;
}
export function numericParts(text: string): number[] {
    // Only normalize obvious OCR glyph confusions inside a numeric-only cell.
    const clean = text.trim().replace(/[Oo]/g, '0').replace(/[Il|]/g, '1').replace(/,/g, '.');
    if (!/^[\d.\s/]+$/.test(clean))
        return [];
    // G3 pairs show exactly two decimals. A photographed slash is often read
    // as 7 or 1 attached to either value. Only accept a unique split consistent
    // with the displayed per-dart/per-three-darts relationship.
    const pair = clean.match(/^(\d+\.\d{2})(.*)$/);
    if (pair && /\d+\.\d{2}/.test(pair[2])) {
        const first = Number(pair[1]), candidates = new Set<number>();
        for (let i = 0; i < pair[2].length; i++) {
            const prefix = pair[2].slice(0, i), remaining = pair[2].slice(i).trim();
            if (/^[\s/17]*$/.test(prefix) && /^\d+\.\d{2}$/.test(remaining)) {
                const second = Number(remaining);
                if (Math.abs(second - first * 3) < .031)
                    candidates.add(second);
            }
        }
        return candidates.size === 1 ? [first, [...candidates][0]] : [];
    }
    if (!/^\d+(?:\.\d+)?$/.test(clean))
        return [];
    return [Number(clean)];
}
/** Locate headings and row labels, then join their intersections geometrically.
 * The labels can sit between any two columns; they are never player columns. */
export function extractBoard(words: OcrWord[]): ScanResult {
    const headers: {
        label: string;
        bbox: Box;
    }[] = [];
    for (const current of words) {
        const clean = current.text.toUpperCase().replace(/[^A-Z0-9]/g, '');
        const prefix = clean.match(/^P(?:L|I|U)?A(?:Y|V)ER/);
        if (!prefix)
            continue;
        const inline = clean.slice(prefix[0].length);
        const next = words.filter(w => w !== current && /^[123456789XO0]$/i.test(w.text) && w.bbox.x0 >= current.bbox.x1 - (current.bbox.y1 - current.bbox.y0) * .5 && w.bbox.x0 - current.bbox.x1 < (current.bbox.x1 - current.bbox.x0) * .5 && Math.abs(centerY(w.bbox) - centerY(current.bbox)) < (current.bbox.y1 - current.bbox.y0) * .6).sort((a, b) => a.bbox.x0 - b.bbox.x0)[0];
        const suffix = /^[123456789XO0]$/.test(inline) ? inline : next?.text.toUpperCase();
        headers.push({ label: suffix ? `Player ${suffix === '0' ? 'O' : suffix}` : 'Unreadable label', bbox: union(next ? [current, next] : [current]) });
    }
    const unique = headers.filter((h, i) => headers.findIndex(v => Math.abs(centerX(v.bbox) - centerX(h.bbox)) < 50) === i).sort((a, b) => a.bbox.x0 - b.bbox.x0);
    if (unique.length < 2 || unique.length > 3)
        return { columns: [], warnings: ['Could not identify a supported two- or three-column G3 screen. Crop to the stats table and retry, or enter the match manually.'] };
    const headingsBottom = Math.max(...unique.map(h => h.bbox.y1));
    const slope = (centerY(unique.at(-1)!.bbox) - centerY(unique[0].bbox)) / (centerX(unique.at(-1)!.bbox) - centerX(unique[0].bbox));
    const body = words.filter(w => w.bbox.y0 > headingsBottom);
    const labels: {
        labels: string[];
        bbox: Box;
    }[] = [];
    // Build label-only lines so a value on the same baseline does not contaminate
    // e.g. "Points". Row labels contain letters; numeric OCR confusions are kept
    // out by requiring a genuine label match.
    for (const line of wordLines(body.filter(w => /[A-Za-z]/.test(w.text)))) {
        for (let i = 0; i < line.length; i++) {
            for (let length = Math.min(3, line.length - i); length >= 1; length--) {
                const part = line.slice(i, i + length);
                const mapped = rowLabel(part.map(w => w.text).join(' '));
                if (mapped) {
                    labels.push({ labels: mapped, bbox: union(part) });
                    i += length - 1;
                    break;
                }
            }
        }
    }
    const columns = unique.map((header, index) => {
        const x = centerX(header.bbox);
        const others = [...unique.filter(h => h !== header).map(h => centerX(h.bbox)), ...labels.map(l => centerX(l.bbox))];
        const halfWidth = Math.min(...others.map(other => Math.abs(other - x))) * .48;
        const columnWords = body.filter(w => Math.abs(centerX(w.bbox) - x) <= halfWidth);
        const cells: PhotoCell[] = [];
        for (const row of [...labels].sort((a, b) => b.labels.length - a.labels.length || a.bbox.y0 - b.bbox.y0)) {
            if (cells.some(c => c.label === row.labels[0]))
                continue;
            // Mild perspective means baselines slope: use a generous row band, but
            // never take a numeric cell from a neighboring row.
            const rowGaps = labels.filter(l => l !== row).map(l => Math.abs(centerY(l.bbox) - centerY(row.bbox))).filter(n => n > 8);
            const tolerance = Math.min(row.bbox.y1 - row.bbox.y0, rowGaps.length ? Math.min(...rowGaps) * .45 : 25);
            const rowY = centerY(row.bbox) + slope * (x - centerX(row.bbox));
            const near = columnWords.filter(w => Math.abs(centerY(w.bbox) - rowY) <= Math.max(12, tolerance));
            const raw = near.sort((a, b) => a.bbox.x0 - b.bbox.x0).map(w => w.text).join(' ');
            const values = numericParts(raw);
            const confidence = near.length ? Math.min(...near.map(w => w.confidence)) : 0;
            const bbox = near.length ? union(near) : { x0: Math.max(0, x - halfWidth), x1: x + halfWidth, y0: rowY - (row.bbox.y1 - row.bbox.y0) * .7, y1: rowY + (row.bbox.y1 - row.bbox.y0) * .7 };
            row.labels.forEach((label, i) => cells.push({ label, raw, value: values.length === row.labels.length ? values[i] : null, confidence, bbox, uncertain: values.length !== row.labels.length || confidence < 80 || (values.length === 2 && !/^\d+\.\d{2}\s*\/\s*\d+\.\d{2}$/.test(raw)) }));
        }
        return { id: `column-${index}`, label: header.label === 'Unreadable label' ? `Column ${index + 1} (label unreadable)` : header.label, bbox: header.bbox, cells };
    });
    return { columns, warnings: columns.some(c => !c.cells.some(v => v.value != null)) ? ['Some columns could not be read. Try a closer crop or type the values during review.'] : [] };
}
