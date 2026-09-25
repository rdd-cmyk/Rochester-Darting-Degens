// Telemetry needs page categories, not emails, recovery tokens or player IDs.
// New routes must be reviewed before they become eligible for collection.
const publicRoutes = new Set(['/', '/matches', '/stats', '/profiles', '/profile', '/change-log']);

export function sanitizeTelemetryEvent<T extends { url: string; route?: string }>(event: T): T | null {
  try {
    const url = new URL(event.url);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    const pathname = decodeURIComponent(url.pathname).replace(/\/$/, '') || '/';
    const route = /^\/profiles\/[^/]+$/.test(pathname) ? '/profiles/[id]' : pathname;
    if (!publicRoutes.has(route) && route !== '/profiles/[id]') return null;

    // Construct from the origin and reviewed route, never the incoming search/hash.
    return { ...event, url: `${url.origin}${route}`, ...('route' in event ? { route } : {}) };
  } catch {
    // Unexpected or malformed URLs must not bypass the privacy filter.
    return null;
  }
}
