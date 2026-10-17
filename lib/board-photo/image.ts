export type Crop = {
    left: number;
    top: number;
    right: number;
    bottom: number;
};
export const FULL_CROP: Crop = { left: 0, top: 0, right: 100, bottom: 100 };
export const MAX_PHOTO_BYTES = 25 * 1024 * 1024;
export function validatePhoto(file: Pick<File, 'type' | 'size'>) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
        throw new Error('Choose a JPEG, PNG, or WebP photo.');
    if (file.size > MAX_PHOTO_BYTES)
        throw new Error('Choose a photo smaller than 25 MB.');
}
export async function decodePhoto(file: File): Promise<HTMLCanvasElement> {
    validatePhoto(file);
    const image = await createImageBitmap(file);
    try {
        if (image.width * image.height > 65000000)
            throw new Error('This image is too large. Choose a smaller photo.');
        const scale = Math.min(1, 2600 / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx)
            throw new Error('This browser cannot prepare photos. You can still enter the match manually.');
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        return canvas;
    }
    finally {
        image.close();
    }
}
export function preparePhoto(source: HTMLCanvasElement, crop: Crop, rotation: number) {
    if (crop.right - crop.left < 10 || crop.bottom - crop.top < 10)
        throw new Error('Keep at least 10% of the photo in each direction.');
    const sx = source.width * crop.left / 100, sy = source.height * crop.top / 100;
    const sw = source.width * (crop.right - crop.left) / 100, sh = source.height * (crop.bottom - crop.top) / 100;
    const angle = rotation * Math.PI / 180;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(Math.abs(sw * Math.cos(angle)) + Math.abs(sh * Math.sin(angle)));
    canvas.height = Math.ceil(Math.abs(sh * Math.cos(angle)) + Math.abs(sw * Math.sin(angle)));
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(angle);
    ctx.drawImage(source, sx, sy, sw, sh, -sw / 2, -sh / 2, sw, sh);
    return canvas;
}
export function textMask(source: HTMLCanvasElement) {
    const canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = source.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(source, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    maskPixels(pixels.data, canvas.width, canvas.height);
    ctx.putImageData(pixels, 0, 0);
    return canvas;
}
export function maskPixels(data: Uint8ClampedArray | Uint8Array, width: number, height: number) {
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const white = Math.min(r, g, b) > 125 && Math.max(r, g, b) - Math.min(r, g, b) < 100;
        const green = g > 130 && g > r * 1.3 && g > b * 1.1;
        const v = white || green ? 0 : 255;
        data[i] = data[i + 1] = data[i + 2] = v;
    }
    // Remove connected grid/frame components rather than their individual runs.
    // This preserves text strokes even when the photographed grid is slanted.
    const visited = new Uint8Array(width * height), queue = new Int32Array(width * height);
    for (let pixel = 0; pixel < visited.length; pixel++) {
        if (visited[pixel] || data[pixel * 4] !== 0)
            continue;
        let head = 0, tail = 1;
        queue[0] = pixel;
        visited[pixel] = 1;
        let left = width, right = 0, top = height, bottom = 0;
        while (head < tail) {
            const current = queue[head++], x = current % width, y = Math.floor(current / width);
            left = Math.min(left, x);
            right = Math.max(right, x);
            top = Math.min(top, y);
            bottom = Math.max(bottom, y);
            for (let dy = -1; dy <= 1; dy++)
                for (let dx = -1; dx <= 1; dx++) {
                    const nx = x + dx, ny = y + dy;
                    if (nx < 0 || nx >= width || ny < 0 || ny >= height)
                        continue;
                    const next = ny * width + nx;
                    if (!visited[next] && data[next * 4] === 0) {
                        visited[next] = 1;
                        queue[tail++] = next;
                    }
                }
        }
        if (right - left > Math.max(70, width * .10) || bottom - top > Math.max(90, width * .12)) {
            for (let i = 0; i < tail; i++) {
                const offset = queue[i] * 4;
                data[offset] = data[offset + 1] = data[offset + 2] = 255;
            }
        }
    }
}
