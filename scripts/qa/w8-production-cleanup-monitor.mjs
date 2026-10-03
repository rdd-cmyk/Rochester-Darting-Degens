// Fixed production target. No recipient records, credentials or headers logged.
const key=process.env.RDD_PRODUCTION_MONITOR_KEY;
if(!key?.startsWith('sb_secret_'))throw Error('Missing production cleanup monitor secret');
if(process.env.RDD_PRODUCTION_MONITOR_SIMULATE_FAILURE==='true')throw Error('Intentional production cleanup monitor alert rehearsal');
let healthy=false;
for(let attempt=0;attempt<3;attempt++){
 try{
  const response=await fetch('https://hrqsbzmsfichiimtxijj.supabase.co/rest/v1/rpc/rdd_production_cleanup_health',{
   method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(15000),
  });
  if(response.ok&&(await response.json()).healthy===true){healthy=true;break;}
 }catch{/* Bounded retry; never print credential-bearing details. */}
 if(attempt<2)await new Promise(resolve=>setTimeout(resolve,2000));
}
if(!healthy)throw Error('Production invitation cleanup unhealthy or unreachable; inspect Cron job and run history before retry');
console.log('PASS: production cleanup active at approved daily schedule; latest scheduled run succeeded within 26 hours.');
