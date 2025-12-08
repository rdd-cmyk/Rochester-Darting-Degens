// /lib/playerName.ts
export function formatPlayerName(
  display_name: string | null | undefined,
  first_name: string | null | undefined
) {
  const d = display_name?.trim();
  const f = first_name?.trim();

  if (d && f) return `${d} (${f})`;
  if (d) return d;
  if (f) return f;
  return 'Unknown player';
}
