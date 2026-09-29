/** Keep an absent recorded score distinct from a valid numeric zero. */
export function formatRecordedScore(score: number | null | undefined): string {
  return score == null ? '—' : score.toString();
}
