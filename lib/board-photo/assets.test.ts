// @vitest-environment node
import { it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import manifest from '../../public/ocr/v7/assets.json';
it('ships the pinned worker, embedded-WASM cores and language data unchanged', () => {
    expect(manifest.engine).toBe('tesseract.js@7.0.0');
    for (const [file, hash] of Object.entries(manifest.files)) {
        const content = readFileSync(path.join(process.cwd(), 'public/ocr/v7', file));
        expect(createHash('sha256').update(content).digest('hex')).toBe(hash);
        if (file === 'worker.min.js')
            expect(content.equals(readFileSync('node_modules/tesseract.js/dist/worker.min.js'))).toBe(true);
        if (file.endsWith('.wasm.js'))
            expect(content.equals(readFileSync(path.join('node_modules/tesseract.js-core', file)))).toBe(true);
    }
});
