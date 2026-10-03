/** Presentation only: the night has a date, not a finalized/ended state. */
export function nightRecapContext(nightDate: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)?.value;
  const today = `${part('year')}-${part('month')}-${part('day')}`;
  return nightDate === today
    ? { summary: 'So far tonight', eyebrow: 'The night so far' }
    : nightDate < today
      ? { summary: 'Night recap', eyebrow: 'The night in review' }
      : { summary: 'Recorded results', eyebrow: 'The next night' };
}
