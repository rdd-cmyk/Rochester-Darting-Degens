/**
 * @template MatchT
 * @template ProfileT
 * @typedef {Object} MatchesViewStateResetters
 * @property {import('react').Dispatch<import('react').SetStateAction<MatchT[]>>} setMatches
 * @property {import('react').Dispatch<import('react').SetStateAction<ProfileT[]>>} setProfiles
 * @property {import('react').Dispatch<import('react').SetStateAction<number>>} setCurrentPage
 * @property {import('react').Dispatch<import('react').SetStateAction<number>>} setTotalPages
 */

/**
 * Reset the match list view state for logged out visitors.
 * @template MatchT
 * @template ProfileT
 * @param {MatchesViewStateResetters<MatchT, ProfileT>} param0
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
