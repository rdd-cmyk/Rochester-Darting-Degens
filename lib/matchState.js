/**
 * @template T
 * @typedef {(value: T | ((prev: T) => T)) => void} SetState
 */

/**
 * @typedef {Object} MatchesViewStateResetters
 * @property {SetState<unknown[]>} setMatches
 * @property {SetState<unknown[]>} setProfiles
 * @property {SetState<number>} setCurrentPage
 * @property {SetState<number>} setTotalPages
 */

/**
 * Reset the match list view state for logged out visitors.
 * @param {MatchesViewStateResetters} param0
 */
export function clearMatchesState({
  setMatches,
  setProfiles,
  setCurrentPage,
  setTotalPages,
}) {
  setMatches([]);
  setProfiles([]);
  setCurrentPage(1);
  setTotalPages(1);
}
