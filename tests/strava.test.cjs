const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {StravaConnection,validateApp,week,totals,summary,validate}=require('../src/strava.cjs');
const {tile,ACTIONS}=require('../src/strava-tiles.cjs');
const thursday=new Date(2026,10,5,9).getTime();
const storage={isEncryptionAvailable:()=>true,encryptString:s=>Buffer.from(s),decryptString:b=>b.toString()};
const app={clientId:'123',clientSecret:'s'.repeat(40)};
function dir(t){const d=fs.mkdtempSync(path.join(os.tmpdir(),'strava-'));t.after(()=>fs.rmSync(d,{recursive:true,force:true}));return d;}
const reply=(status,body)=>({ok:status<400,status,json:async()=>body});
const data={connected:true,updatedAt:thursday,unit:'mi',goal:25,days:{'2026-11-02':{distance:5200,time:1935},'2026-11-05':{distance:12900,time:3912}}};

test('weeks start on Monday and mark today',()=>{const w=week(thursday);assert.equal(w.keys[0],'2026-11-02');assert.equal(w.keys[6],'2026-11-08');assert.equal(w.today,'2026-11-05');});
test('only runs count, keyed by local start date',()=>{
 const d=totals([{sport_type:'Run',distance:5000,moving_time:1500,start_date_local:'2026-11-02T06:00:00Z'},{sport_type:'TrailRun',distance:3000,moving_time:1200,start_date_local:'2026-11-02T18:00:00Z'},{sport_type:'Ride',distance:40000,moving_time:5000,start_date_local:'2026-11-03T06:00:00Z'},{type:'Run',distance:1609.344,start_date_local:'2026-11-05T23:30:00Z'}]);
 assert.deepEqual(d,{'2026-11-02':{distance:8000,time:2700},'2026-11-05':{distance:1609.344,time:0}});
 const s=summary({unit:'mi',goal:20,days:{...d,'2026-10-30':{distance:9000,time:3000}}},thursday);assert.equal(s.days[0].time,2700);
 assert.deepEqual(s.days.map(x=>x.ran),[true,false,false,true,false,false,false]);assert.equal(s.runs,2);assert.ok(Math.abs(s.distance-(8000/1609.344+1))<1e-9);assert.equal(s.days[3].today,true);assert.equal(s.days[4].future,true);
});
test('goal settings and API app credentials are validated',()=>{
 assert.deepEqual(validate({goal:'30',unit:'km'}),{goal:30,unit:'km'});assert.throws(()=>validate({goal:0}));assert.throws(()=>validate({unit:'yd'}));
 assert.deepEqual(validateApp({clientId:' 123 ',clientSecret:app.clientSecret}),app);assert.throws(()=>validateApp({clientId:'abc',clientSecret:app.clientSecret}),/Client ID/);assert.throws(()=>validateApp({clientId:'123',clientSecret:'short'}),/Client Secret/);
});

test('Strava is a searchable Widgets plugin with one display action per position',()=>{
 const {catalog,validateSlot}=require('../src/catalog.cjs'),p=catalog.find(p=>p.id==='strava');
 assert.equal(p.category,'Widgets');assert.equal(p.name,'Strava');assert.ok(require('../src/icons.json')[p.icon].includes('#FC4C02'));
 assert.deepEqual(p.actions.map(a=>a.id),[...ACTIONS.map(([id])=>id),'open','hotkey']);
 for(const [action] of ACTIONS)assert.deepEqual(validateSlot({plugin:'strava',action}),{plugin:'strava',action,value:''});
});
test('tiles stack into goal ring, Mon-Tue, Wed-Thu and Fri-Sun',()=>{
 const goal=tile('goal',data,thursday),first=tile('mon-tue',data,thursday),second=tile('wed-thu',data,thursday),last=tile('fri-sun',data,thursday);
 assert.match(goal,/stroke-dasharray/);assert.match(goal,/\/ 25 mi/);
 assert.match(first,/MON[\s\S]*TUE/);assert.doesNotMatch(first,/WED/);assert.match(first,/>3\.23<\/text>/);assert.match(first,/>32:15<\/text>/);assert.match(tile('wed-thu',data,thursday),/>1:05:12<\/text>/);assert.equal((first.match(/<circle[^>]*fill="#34c759"/g)||[]).length,1);
 assert.match(second,/WED[\s\S]*THU[\s\S]*8\.02/);assert.match(last,/FRI[\s\S]*SAT[\s\S]*SUN/);assert.doesNotMatch(last,/WEEK|runs/);
 for(const svg of [goal,first,second,last])assert.doesNotMatch(svg,/NaN|undefined/);
 assert.equal(tile('goal',{connected:false},thursday),null);assert.equal(tile('goal',{...data,updatedAt:0},thursday),null);assert.equal(tile('open',data,thursday),null);
});
test('the strip draws Strava tiles in every position, including the fifth',()=>{
 const {Workspace,defaults}=require('../src/workspace.cjs'),{update}=require('../src/display-layout.cjs'),{configuredSVG}=require('../src/strip.cjs');const v=c=>Workspace.prototype.validate(c);
 let c=v({...defaults(),slots:ACTIONS.map(([action])=>({plugin:'strava',action}))});c=v(update(c,{action:'fifth',enabled:true}));c.slots[4]={plugin:'strava',action:'goal',value:''};c=v(c);
 const svg=configuredSVG('idle',c,{caps:false,layer:false},{now:thursday,live:{strava:data}});
 assert.equal((svg.match(/stroke-dasharray="[^"]+" transform="rotate\(-90/g)||[]).length,2);assert.match(svg,/translate\(1490 451\)/);assert.match(svg,/MON[\s\S]*THU[\s\S]*SUN/);
 assert.match(svg,/<g transform="translate\(1605 15\)"><rect[^>]*fill="none" fill-opacity="0" stroke-opacity="0"/);
 const colored=configuredSVG('idle',v({...c,slots:c.slots.map((s,i)=>i?s:{...s,appearance:{background:'#112233'}})}),{caps:false,layer:false},{now:thursday,live:{strava:data}});assert.match(colored,/<g transform="translate\(1605 15\)"><rect[^>]*fill="#112233"/);
 const waiting=configuredSVG('idle',c,{caps:false,layer:false},{now:thursday,live:{}});assert.match(waiting,/Strava/);assert.doesNotMatch(waiting,/WEEK/);
});
test('Enter on a Strava display position fetches new runs; Open Strava opens the dashboard',async()=>{
 const {Workspace}=require('../src/workspace.cjs'),ws=Object.create(Workspace.prototype);let opened=false;ws.shell={openExternal:async u=>{assert.equal(u,'https://www.strava.com/dashboard');opened=true;}};const forced=[];ws.strava={refresh:async force=>{forced.push(force);}};
 ws.config={slots:[{plugin:'strava',action:'mon-tue',value:''},{plugin:'strava',action:'open',value:''}]};await ws.run(0);assert.equal(opened,false);assert.deepEqual(forced,[true]);await ws.run(1);assert.equal(opened,true);
});

test('saved API app credentials persist encrypted and a new app clears old tokens',t=>{
 const d=dir(t),s=new StravaConnection(d,{},storage);assert.equal(s.view().configured,false);
 s.saveApp(app);assert.equal(JSON.parse(fs.readFileSync(path.join(d,'strava-app.bin'),'utf8')).clientId,'123');
 const again=new StravaConnection(d,{},storage);assert.equal(again.view().configured,true);assert.equal(again.view().clientId,'123');assert.equal('clientSecret' in again.view(),false);
 fs.writeFileSync(path.join(d,'strava-session.bin'),JSON.stringify({accessToken:'a',refreshToken:'r',expiresAt:Date.now()+1e6}));
 const first=dir(t);fs.writeFileSync(path.join(first,'strava-session.bin'),JSON.stringify({accessToken:'a',refreshToken:'r',expiresAt:Date.now()+1e6}));const fresh=new StravaConnection(first,{},storage);fresh.saveApp(app);assert.equal(fresh.view().connected,true);
 const signed=new StravaConnection(d,{},storage);assert.equal(signed.view().connected,true);signed.saveApp({...app,clientId:'456'});assert.equal(signed.view().connected,false);assert.equal(fs.existsSync(path.join(d,'strava-session.bin')),false);
});
test('sign-in rejects a forged callback and accepts the real one',async t=>{
 const calls=[];let opened='';
 const s=new StravaConnection(dir(t),{openExternal:async u=>{opened=u;}},storage,{credentials:()=>app,fetch:async(url,o)=>{calls.push([url,o]);return url.includes('/oauth/token')?reply(200,{access_token:'a'.repeat(20),refresh_token:'r'.repeat(20),expires_at:Date.now()/1000+21600,athlete:{firstname:'Sam'}}):reply(200,[{sport_type:'Run',distance:5000,start_date_local:new Date().toISOString()}]);}});
 t.after(()=>s.close());
 s.start();await new Promise(r=>s.once('change',r));
 const auth=new URL(opened),redirect=auth.searchParams.get('redirect_uri'),state=auth.searchParams.get('state');
 assert.equal(auth.origin,'https://www.strava.com');assert.match(redirect,/^http:\/\/127\.0\.0\.1:\d+\/strava$/);
 assert.equal((await fetch(redirect+'?state=wrong&code=x&scope=read,activity:read_all')).status,400);assert.equal(s.session,null);
 assert.equal((await fetch(redirect+`?state=${state}&code=good&scope=read,activity:read_all`)).status,200);
 await new Promise(r=>setTimeout(r,50));
 assert.equal(s.session.athlete,'Sam');assert.equal(s.server,null);assert.equal(s.data.connected,true);assert.equal(Object.keys(s.data.days).length,1);
 assert.match(calls[0][1].body,/grant_type=authorization_code/);assert.match(calls[0][1].body,/client_secret=s{40}/);assert.equal(calls[1][1].headers.Authorization,'Bearer '+'a'.repeat(20));
});
test('sign-in needs a saved API app',t=>{const s=new StravaConnection(dir(t),{openExternal:async()=>{}},storage);assert.throws(()=>s.start(),/Save your Strava API app/);});
test('expired tokens refresh and revoked access disconnects',async t=>{
 const d=dir(t);fs.writeFileSync(path.join(d,'strava-session.bin'),JSON.stringify({accessToken:'old',refreshToken:'r1',expiresAt:Date.now()-1000,athlete:'Sam'}));
 let mode='ok';const seen=[];
 const s=new StravaConnection(d,{},storage,{credentials:()=>app,fetch:async(url)=>{seen.push(url);if(url.includes('/oauth/token'))return reply(200,{access_token:'new',refresh_token:'r2',expires_at:Date.now()/1000+21600});return mode==='ok'?reply(200,[]):reply(401,{});}});
 await s.refresh(true);assert.match(seen[0],/oauth\/token/);assert.equal(s.session.accessToken,'new');assert.equal(s.data.connected,true);
 mode='revoked';await s.refresh(true);assert.equal(s.session,null);assert.equal(s.data.connected,false);assert.equal(fs.existsSync(path.join(d,'strava-session.bin')),false);
});
