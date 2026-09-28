// Synthetic sensitivity experiment, not evidence about actual league fairness.
// Frozen last 1,000 outcomes test predictions after 4,000 training contests.
import assert from 'node:assert/strict';
const probability=(a,b)=>1/(1+10**((b-a)/400));
const mean=(values,ids)=>ids.reduce((sum,i)=>sum+values[i],0)/ids.length;
function run(seed, scenario, weight) {
  let state=seed;
  const random=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/2**32);
  const truth=Array.from({length:24},(_,i)=>1200+600*i/23);
  const ratings=truth.map(()=>1500);
  let loss=0, tested=0, maximum=0;
  for(let game=0;game<5000;game++) {
    const size=scenario==='mixed' ? [1,2,3][game%3] : 3;
    let a,b;
    if(scenario==='fixed-trios') {
      const first=Math.floor(random()*8), second=(first+1+Math.floor(random()*7))%8;
      a=[first,first+8,first+16]; b=[second,second+8,second+16];
    } else {
      const ids=truth.map((_,i)=>i);
      for(let i=ids.length-1;i>0;i--) { const j=Math.floor(random()*(i+1)); [ids[i],ids[j]]=[ids[j],ids[i]]; }
      a=ids.slice(0,size);b=ids.slice(size,size*2);
    }
    const expected=probability(mean(ratings,a),mean(ratings,b));
    const result=random()<probability(mean(truth,a),mean(truth,b))?1:0;
    if(game<4000) {
      const delta=32*(result-expected)/(weight==='split' ? size : Math.sqrt(size));
      maximum=Math.max(maximum,Math.abs(delta));
      for(const id of a)ratings[id]+=delta;
      for(const id of b)ratings[id]-=delta;
    } else {loss+=(expected-result)**2;tested++;}
  }
  assert(Math.abs(ratings.reduce((a,b)=>a+b,0)-36000)<1e-7);
  return {brier:loss/tested,rmse:Math.sqrt(ratings.reduce((sum,r,i)=>sum+(r-truth[i])**2,0)/24),maximum};
}
for(const scenario of ['mixed','rotating-trios','fixed-trios']) {
  for(const weight of ['split','sqrt']) {
    const runs=Array.from({length:20},(_,i)=>run(i+1,scenario,weight));
    const average=key=>runs.reduce((sum,r)=>sum+r[key],0)/runs.length;
    console.log(`${scenario} / ${weight}: Brier ${average('brier').toFixed(4)}, skill RMSE ${average('rmse').toFixed(1)}, max individual update ${Math.max(...runs.map(r=>r.maximum)).toFixed(2)}`);
  }
}
