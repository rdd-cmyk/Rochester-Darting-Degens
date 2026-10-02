// Preserve immutable, dated release manifests after the fixture relocation.
// Only these two exact historical aliases are supported; reads use one authority.
export function canonicalDeferredSqlSource(source) {
  if (source === 'supabase/pending/league_night.sql') return 'supabase/tests/fixtures/league_night.sql';
  if (source === 'supabase/pending/league_night_enforce.sql') return 'supabase/tests/fixtures/league_night_enforce.sql';
  return source;
}
