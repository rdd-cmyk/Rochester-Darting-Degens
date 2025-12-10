/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert');
const { test } = require('node:test');

const { clearMatchesState } = require('./matchState');

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

  assert.deepStrictEqual(state.matches, []);
  assert.deepStrictEqual(state.profiles, []);
  assert.strictEqual(state.currentPage, 1);
  assert.strictEqual(state.totalPages, 1);
});
