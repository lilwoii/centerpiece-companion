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
 await Promise.all([first,second]);assert.equal(calls,4);assert.equal(client.state.user.color,'#dd88ee');
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

test('shutdown cancels an attachment upload without posting or deleting the draft',()=>fixture(async client=>{
 const file=path.join(path.dirname(client.file),'attachment.png');fs.writeFileSync(file,Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]));
 client.token='a'.repeat(64);client.state.user={id:'111111111111111111',name:'Tester'};
 const id=client.addMediaPaths([file])[0].id,fetchBefore=global.fetch,calls=[];let started;
 const uploading=new Promise(resolve=>started=resolve);
 global.fetch=async(url,options)=>{calls.push(new URL(url).pathname);started();return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true}));};
 try{const pending=client.submit({kind:'feature',title:'Useful request',body:'A sufficiently detailed request.',mediaIds:[id]});const rejected=assert.rejects(pending);await uploading;client.dispose();await rejected;assert.deepEqual(calls,['/media']);assert.equal(client.requests.size,0);assert.equal(client.mediaDrafts.has(id),true);assert.equal(client.token,'a'.repeat(64));assert.equal(client.state.user.name,'Tester');await assert.rejects(client.request('/feed'),/closing/);}
 finally{global.fetch=fetchBefore;fs.unlinkSync(file);}
}));

test('late upload completion after session change cannot submit with the new account',()=>fixture(async client=>{
 const file=path.join(path.dirname(client.file),'attachment.png');fs.writeFileSync(file,Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]));
 client.token='a'.repeat(64);client.state.user={id:'111111111111111111'};const id=client.addMediaPaths([file])[0].id,calls=[];let release;
 client.request=async route=>{calls.push(route);return new Promise(resolve=>release=resolve);};
 try{const pending=client.submit({kind:'feature',title:'Useful request',body:'A sufficiently detailed request.',mediaIds:[id]});client.clear();client.token='b'.repeat(64);client.state.user={id:'222222222222222222'};release({id:'c'.repeat(64),kind:'image',name:'attachment.png',size:12,expires:9999999999});await assert.rejects(pending,/session changed/);assert.deepEqual(calls,['/media']);assert.equal(client.token,'b'.repeat(64));}
 finally{fs.unlinkSync(file);}
}));

test('ordinary sign-in cancellation leaves feed requests and retry available',()=>fixture(async client=>{
 let cancelled=0;client.cancelLogin=()=>{cancelled++;};client.close();assert.equal(cancelled,1);assert.equal(client.disposed,false);
 const before=global.fetch;global.fetch=async()=>new Response(JSON.stringify({items:[]}));try{assert.deepEqual(await client.request('/feed'),{items:[]});assert.equal(client.requests.size,0);}finally{global.fetch=before;}
}));

test('closing while the attachment picker is open does not read selected files',()=>fixture(async client=>{
 client.state.user={id:'111111111111111111'};let choose;const pending=client.chooseMedia({showOpenDialog:()=>new Promise(resolve=>choose=resolve)});client.dispose();choose({canceled:false,filePaths:['nonexistent-file.png']});await assert.rejects(pending,/closing/);assert.equal(client.mediaDrafts.size,0);
}));

test('healthy attachment submission still uploads once, posts, and refreshes',()=>fixture(async client=>{
 const file=path.join(path.dirname(client.file),'attachment.png');fs.writeFileSync(file,Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]));client.token='a'.repeat(64);client.state.user={id:'111111111111111111',name:'Tester'};const id=client.addMediaPaths([file])[0].id,calls=[];
 client.request=async route=>{calls.push(route);if(route==='/media')return{id:'c'.repeat(64),kind:'image',name:'attachment.png',size:12,expires:9999999999};if(route==='/submit')return{id:'d'.repeat(64)};if(route==='/me')return{id:'111111111111111111',name:'Tester'};return{items:[]};};
 try{await client.submit({kind:'feature',title:'Useful request',body:'A sufficiently detailed request.',mediaIds:[id]});assert.deepEqual(calls,['/media','/submit','/me','/feed','/feed?kind=skin','/mentions']);assert.equal(client.mediaDrafts.size,0);}finally{fs.unlinkSync(file);}
}));
