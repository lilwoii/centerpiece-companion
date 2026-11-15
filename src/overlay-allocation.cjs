const DEFAULT_POOL=Object.freeze([2,3,4,5,6,7,8,9,10]);
function ownedPool(manifest){
 const preserved=manifest?.preservedSlots===undefined?[]:manifest.preservedSlots;
 const valid=list=>Array.isArray(list)&&list.length<=9&&new Set(list).size===list.length&&list.every(n=>Number.isInteger(n)&&n>=2&&n<=10);
 if(!valid(preserved))throw Error('The saved display allocation is invalid. Run Check setup before applying the keyboard display.');
 const pool=manifest?.ownedSlots===undefined?DEFAULT_POOL.filter(n=>!preserved.includes(n)):manifest.ownedSlots;
 if(!valid(pool)||pool.length<2||pool.some(n=>preserved.includes(n)))throw Error('The saved display allocation is invalid. Run Check setup before applying the keyboard display.');
 return [...pool];
}
module.exports={DEFAULT_POOL,ownedPool};
