// Only board destinations are supported. Never redirect to arbitrary query input.
export function authReturnPath(search: string): string {
  const next = new URLSearchParams(search).get('next') ?? '';
  return /^\/board(?:\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?$/i.test(next) ? next : '/matches';
}
