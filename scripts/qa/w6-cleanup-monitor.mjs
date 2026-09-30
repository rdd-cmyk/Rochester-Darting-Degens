// No production target or configurable origin; CI must use a test-project key.
const key = process.env.RDD_TESTING_MONITOR_KEY;
if (!key || !key.startsWith('sb_secret_')) throw Error('Missing isolated testing monitor secret');
if (process.env.RDD_TESTING_MONITOR_SIMULATE_FAILURE === 'true') throw Error('Intentional cleanup-monitor alert rehearsal');
let healthy = false;
for (let attempt=0; attempt<3; attempt++) {
  try {
    const response = await fetch('https://uepayhdrgzrxhkqbwebo.supabase.co/rest/v1/rpc/rdd_test_cleanup_health', {
      method:'POST', headers:{apikey:key,'Content-Type':'application/json'}, body:'{}', signal:AbortSignal.timeout(15000),
    });
    if (response.ok && (await response.json()).healthy === true) { healthy=true; break; }
  } catch { /* Retry without printing request/credential details. */ }
  if (attempt<2) await new Promise(resolve=>setTimeout(resolve,2000));
}
if (!healthy) throw Error('RDD Release Testing invitation cleanup is unhealthy or unreachable; inspect Cron history and retry the job');
console.log('PASS: isolated test invitation cleanup active; latest scheduled run succeeded within 26 hours.');
