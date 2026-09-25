import base from './playwright.config.mjs';

// Requires a fresh production build with local Supabase variables but telemetry
// mounted. This suite intercepts the SDK scripts; it does not test hosted intake.
const config = { ...base, testMatch: 'observability.spec.mjs' };
export default config;
