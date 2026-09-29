import { beforeEach, expect, it, vi } from 'vitest';
import { generateMetadata } from './layout';

const { maybeSingle } = vi.hoisted(() => ({ maybeSingle: vi.fn() }));

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
  },
}));

beforeEach(() => vi.resetAllMocks());

it('keeps a neutral title when the anonymous metadata query cannot see a profile', async () => {
  maybeSingle.mockResolvedValue({ data: null, error: null });

  const metadata = await generateMetadata({ params: Promise.resolve({ id: 'existing-private-player' }) });

  expect(metadata.title).toEqual({ absolute: 'RDD - Player Profile' });
});

it('preserves the formatted name when the metadata query can read it', async () => {
  maybeSingle.mockResolvedValue({
    data: { display_name: 'Captain', first_name: 'Demo', include_first_name_in_display: true },
    error: null,
  });

  const metadata = await generateMetadata({ params: Promise.resolve({ id: 'player-1' }) });

  expect(metadata.title).toEqual({ absolute: 'RDD - Captain (Demo)' });
});
