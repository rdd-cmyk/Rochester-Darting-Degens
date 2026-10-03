// Explicit private destinations only. Never redirect to arbitrary query input.
export function authReturnPath(search: string): string {
  const next = new URLSearchParams(search).get('next') ?? '';
  const uuid='[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
  const allowed=new RegExp(`^/(?:board(?:/${uuid})?|rivalries(?:/challenges/${uuid}|/pair/${uuid}/${uuid})?)$`,'i');
  return allowed.test(next) ? next : '/';
}
