export const CAPS=Object.freeze({storage:5000000000,classA:500000,classB:5000000});
const fail=(message,status=503)=>{throw Object.assign(Error(message),{status});};
export async function reserveR2(env,{a=0,b=0,bytes=0,id,now=Math.floor(Date.now()/1000)}={}){
 if(![a,b,bytes].every(n=>Number.isSafeInteger(n)&&n>=0)||!a&&!b||bytes&&!/^[a-f0-9]{64}$/.test(id||''))throw Error('Invalid storage reservation.');
 // One D1 transaction checks the account baseline, current verified period,
 // request cutoffs and storage headroom before any billable R2 call.
 const update=env.DB.prepare('UPDATE r2_budget SET used_a=used_a+?,used_b=used_b+?,storage_bytes=storage_bytes+? WHERE id=1 AND verified_at>0 AND cycle_start<=? AND cycle_end>? AND baseline_a>=0 AND baseline_b>=0 AND baseline_a+used_a+?<=? AND baseline_b+used_b+?<=? AND storage_bytes+?<=? RETURNING id').bind(a,b,bytes,now,now,a,CAPS.classA,b,CAPS.classB,bytes,CAPS.storage);
 const operations=[update];if(bytes)operations.push(env.DB.prepare('INSERT INTO r2_storage_reservations(id,bytes,created) SELECT ?,?,? WHERE changes()=1').bind(id,bytes,now));
 let results;try{results=await env.DB.batch(operations);}catch{fail('Attachment budget is unavailable. Uploads and reads are paused.');}
 if(!results[0]?.results?.length)fail('Attachment budget or billing period needs owner review, or a usage limit was reached. Uploads and reads are paused.');
 // Counts are deliberately never refunded after dispatch: a timeout may still
 // have reached R2. Retries reserve again. No date-based automatic reset.
}
export async function releaseStorage(env,id){
 // Call only AFTER R2 confirms deletion (including an already absent object).
 // Atomic decrement + ledger removal makes duplicate cleanup idempotent.
 await env.DB.batch([
  env.DB.prepare('UPDATE r2_budget SET storage_bytes=MAX(0,storage_bytes-COALESCE((SELECT bytes FROM r2_storage_reservations WHERE id=?),0)) WHERE id=1').bind(id),
  env.DB.prepare('DELETE FROM r2_storage_reservations WHERE id=?').bind(id)
 ]);
}
export async function budgetStatus(env,now=Math.floor(Date.now()/1000)){
 const row=await env.DB.prepare('SELECT cycle_start,cycle_end,verified_at,baseline_a,baseline_b,used_a,used_b,storage_bytes FROM r2_budget WHERE id=1').first();
 if(!row||row.verified_at<=0||row.cycle_start>now||row.cycle_end<=now)return{verified:false,message:'R2 usage baseline and billing period need verification. Uploads and reads stay paused.',caps:CAPS};
 const usage={storage:row.storage_bytes,classA:row.baseline_a+row.used_a,classB:row.baseline_b+row.used_b};return{verified:true,cycleStart:row.cycle_start,cycleEnd:row.cycle_end,usage,caps:CAPS,warning:Object.keys(usage).some(key=>usage[key]>=CAPS[key]*.8)};
}
