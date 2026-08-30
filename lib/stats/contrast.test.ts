import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

const stylesheet = readFileSync(
  path.join(process.cwd(), 'app', 'globals.css'),
  'utf8'
);

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) =>
    Number.parseInt(hex.slice(offset, offset + 2), 16) / 255
  );
  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4
  );

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(foreground: string, background: string): number {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

function variable(block: string, name: string): string {
  const match = block.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match) throw new Error(`Missing CSS variable --${name}.`);
  return match[1];
}

describe('statistics contrast palette', () => {
  const rootBlock = stylesheet.match(/:root\s*{([\s\S]*?)}/)?.[1] ?? '';
  const darkBlock =
    stylesheet.match(
      /@media\s*\(prefers-color-scheme:\s*dark\)\s*{\s*:root\s*{([\s\S]*?)}/
    )?.[1] ?? '';

  test.each([
    'stats-series-1',
    'stats-series-2',
    'stats-series-3',
    'stats-series-4',
    'stats-series-5',
    'stats-positive',
    'stats-negative',
  ])('%s meets text contrast in light and dark themes', (name) => {
    expect(contrastRatio(variable(rootBlock, name), '#ffffff')).toBeGreaterThanOrEqual(
      4.5
    );
    expect(contrastRatio(variable(darkBlock, name), '#111b2b')).toBeGreaterThanOrEqual(
      4.5
    );
  });
});
