const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Community}=require('../src/community.cjs');
async function fixture(fn){const directory=fs.mkdtempSync(path.join(os.tmpdir(),'companion-profile-'));try{const client=new Community(directory,{}, {isEncryptionAvailable:()=>false});client.origin='https://community.example';return await fn(client);}finally{fs.rmdirSync(directory);}}
test('saved display name color is included in the signed-in profile',async()=>{
 const {default:worker}=await import('../community-server/worker.mjs');
 const env={PUBLIC_ORIGIN:'https://community.example',DISCORD_CLIENT_ID:'123456789012345678',DISCORD_CLIENT_SECRET:'fixture',DB:{prepare(sql){return{bind(){return this;},async first(){if(sql.includes('rate_limits'))return{count:1};if(sql.includes('FROM sessions'))return{user_id:'111111111111111111',username:'Tester',expires:Math.floor(Date.now()/1000)+30*86400};if(sql.includes('FROM profiles'))return{color:'#dd88ee'};return null;},async run(){}};}}};
 const response=await worker.fetch(new Request(env.PUBLIC_ORIGIN+'/me',{headers:{Authorization:'Bearer '+'a'.repeat(64)}}),env,{});
 assert.equal(response.status,200);assert.equal((await response.json()).color,'#dd88ee');
});
test('profile refresh coalesces requests without losing the saved color',()=>fixture(async client=>{
 client.token='a'.repeat(64);let finish,calls=0;
 client.request=async route=>{calls++;if(route==='/me')return new Promise(resolve=>finish=resolve);return{items:[]};};
 const first=client.refresh(),second=client.refresh();assert.equal(calls,1);
 finish({id:'111111111111111111',name:'Tester',color:'#dd88ee',isAdmin:false});
 await Promise.all([first,second]);assert.equal(calls,3);assert.equal(client.state.user.color,'#dd88ee');
}));
test('a pending profile refresh cannot restore a signed-out user',()=>fixture(async client=>{
 client.token='a'.repeat(64);let finish;
 client.request=async()=>new Promise(resolve=>finish=resolve);
 const pending=client.refresh();client.clear();finish({id:'111111111111111111',name:'Tester',color:'#dd88ee'});await pending;
 assert.equal(client.state.user,null);assert.deepEqual(client.state.queue,[]);
}));
test('profile validation excludes malformed identity and keeps a saved color with an older service',()=>fixture(async client=>{
 assert.throws(()=>client.profile({id:'owner',name:'Tester'}));
 client.state.user={id:'111111111111111111',name:'Tester',color:'#dd88ee'};
 assert.equal(client.profile({id:client.state.user.id,name:'Tester'}).color,'#dd88ee');
 assert.equal(client.profile({id:'222222222222222222',name:'Another'}).color,'#9bb9ff');
}));
