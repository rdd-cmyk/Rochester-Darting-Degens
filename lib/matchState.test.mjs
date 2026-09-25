import { expect, test } from 'vitest';

import { clearMatchesState } from './matchState.js';

test('clearMatchesState resets match view data to defaults', () => {
  const state = {
    matches: [{ id: 1 }],
    profiles: [{ id: 'abc' }],
    currentPage: 3,
    totalPages: 4,
  };

  clearMatchesState({
    setMatches: (value) => {
      state.matches = value;
    },
    setProfiles: (value) => {
      state.profiles = value;
    },
    setCurrentPage: (value) => {
      state.currentPage = value;
    },
    setTotalPages: (value) => {
      state.totalPages = value;
    },
  });

  expect(state.matches).toEqual([]);
  expect(state.profiles).toEqual([]);
  expect(state.currentPage).toBe(1);
  expect(state.totalPages).toBe(1);
});
