const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const {EventEmitter}=require('node:events');
// Personal Strava connection. Each user registers their own Strava API app and
// enters its client ID and secret in Connections; the app credentials and sign-in
// tokens are kept with Windows secure storage.
const RUNS=['Run','TrailRun','VirtualRun'];
const REFRESH_MS=10*60000;
function validateApp(v={}){const clientId=String(v.clientId??'').trim(),clientSecret=String(v.clientSecret??'').trim();if(!/^\d{1,12}$/.test(clientId))throw Error('Enter the numeric Client ID from strava.com/settings/api.');if(!/^[A-Za-z0-9]{20,100}$/.test(clientSecret))throw Error('Enter the Client Secret from strava.com/settings/api.');return{clientId,clientSecret};}
function validate(v={}){const unit=v.unit??'mi',goal=Number(v.goal??25);if(!['mi','km'].includes(unit))throw Error('Choose miles or kilometers.');if(!Number.isFinite(goal)||goal<=0||goal>1000)throw Error('Enter a weekly goal between 0 and 1000.');return{unit,goal:Math.round(goal*10)/10};}
const dateKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
// Monday-first week containing `now`, as local calendar dates.
function week(now=Date.now()){const d=new Date(now);d.setHours(0,0,0,0);d.setDate(d.getDate()-(d.getDay()+6)%7);const start=d.getTime();return{start,keys:Array.from({length:7},(_,i)=>{const x=new Date(start);x.setDate(x.getDate()+i);return dateKey(x);}),today:dateKey(new Date(now))};}
// start_date_local is wall-clock time labelled Z, so its date part is the local day.
// Each day sums run distance (meters) and moving time (seconds).
function totals(activities){const out={};for(const a of Array.isArray(activities)?activities:[]){if(!RUNS.includes(a?.sport_type||a?.type)||!Number.isFinite(a.distance)||typeof a.start_date_local!=='string')continue;const key=a.start_date_local.slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(key))continue;const d=out[key]||={distance:0,time:0};d.distance+=a.distance;d.time+=Number.isFinite(a.moving_time)?a.moving_time:0;}return out;}
function summary(data,now=Date.now()){const w=week(now),meters=data?.unit==='km'?1000:1609.344,days=w.keys.map(key=>{const d=data?.days?.[key];return{key,ran:(d?.distance||0)>0,distance:(d?.distance||0)/meters,time:d?.time||0,today:key===w.today,future:key>w.today};});return{days,distance:days.reduce((s,d)=>s+d.distance,0),runs:days.filter(d=>d.ran).length,goal:data?.goal||25,unit:data?.unit||'mi'};}
class StravaConnection extends EventEmitter{
 constructor(directory,shell,safeStorage,io={}){super();Object.assign(this,{shell,safeStorage,fetch:io.fetch||global.fetch,credentials:io.credentials||(()=>this.app||{}),appFile:path.join(directory,'strava-app.bin'),sessionFile:path.join(directory,'strava-session.bin'),settingsFile:path.join(directory,'strava.json')});this.session=null;this.server=null;this.busy=false;this.lastFetch=0;this.settings=validate();this.data={connected:false,days:{},updatedAt:0,...this.settings};this.status='Not connected';
  try{this.settings=validate(JSON.parse(fs.readFileSync(this.settingsFile,'utf8')));}catch{}
  this.app=null;try{if(safeStorage.isEncryptionAvailable())this.app=validateApp(JSON.parse(safeStorage.decryptString(fs.readFileSync(this.appFile))));}catch{}
  try{if(safeStorage.isEncryptionAvailable()){const s=JSON.parse(safeStorage.decryptString(fs.readFileSync(this.sessionFile)));if(typeof s.accessToken==='string'&&typeof s.refreshToken==='string'&&Number.isFinite(s.expiresAt)){this.session=s;this.status='Connected as '+(s.athlete||'Strava athlete');}}}catch{}
  this.data={...this.data,...this.settings,connected:!!this.session};
 }
 view(){const{clientId,clientSecret}=this.credentials();return{...this.settings,configured:!!(clientId&&clientSecret),clientId,connected:!!this.session,pending:!!this.server,status:this.status,athlete:this.session?.athlete||'',updatedAt:this.data.updatedAt,error:this.data.error||'',summary:summary(this.data)};}
 changed(){this.emit('change');}
 save(input){this.settings=validate(input);fs.mkdirSync(path.dirname(this.settingsFile),{recursive:true});fs.writeFileSync(this.settingsFile,JSON.stringify(this.settings));this.data={...this.data,...this.settings};this.changed();return this.view();}
 encrypt(file,value){if(!this.safeStorage.isEncryptionAvailable())throw Error('Windows secure storage is unavailable. Strava was not saved.');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',this.safeStorage.encryptString(JSON.stringify(value)));fs.renameSync(file+'.tmp',file);}
 // A different API app cannot reuse the old app's tokens.
 saveApp(input){const app=validateApp(input);this.encrypt(this.appFile,app);if(this.app&&this.app.clientId!==app.clientId&&this.session){this.clear();this.data={...this.settings,connected:false,days:{},updatedAt:0};}this.app=app;if(!this.session)this.status='Strava app saved. Connect Strava to approve access.';this.changed();return this.view();}
 storeSession(){this.encrypt(this.sessionFile,this.session);}
 async request(url,options={}){const r=await this.fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(12000)});let body;try{body=await r.json();}catch{body=null;}if(r.status===401)throw Object.assign(Error('Strava access was revoked. Connect again.'),{revoked:true});if(r.status===429)throw Error('Strava rate limit reached. Retrying later.');if(!r.ok)throw Error('Strava returned HTTP '+r.status+'.');return body;}
 async token(params){const{clientId,clientSecret}=this.credentials();const d=await this.request('https://www.strava.com/oauth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,...params}).toString()});if(typeof d?.access_token!=='string'||typeof d.refresh_token!=='string'||!Number.isFinite(d.expires_at))throw Error('Strava returned an invalid sign-in response.');this.session={accessToken:d.access_token,refreshToken:d.refresh_token,expiresAt:d.expires_at*1000,athlete:d.athlete?[d.athlete.firstname,d.athlete.lastname].filter(Boolean).join(' ').slice(0,60):this.session?.athlete||''};this.storeSession();}
 start(){
  const{clientId,clientSecret}=this.credentials();if(!/^\d{1,12}$/.test(clientId)||!clientSecret)throw Error('Save your Strava API app first.');
  if(!this.safeStorage.isEncryptionAvailable())throw Error('Windows secure storage is unavailable.');if(this.server)throw Error('Strava sign-in is already open in your browser.');
  const state=crypto.randomBytes(16).toString('hex'),server=http.createServer((req,res)=>this.callback(req,res,state,server));this.server=server;
  const timer=setTimeout(()=>{if(this.server===server){this.finish(server,'Strava sign-in timed out. Try again.');}},5*60000);server.on('close',()=>clearTimeout(timer));
  server.listen(0,'127.0.0.1',()=>{const redirect=`http://127.0.0.1:${server.address().port}/strava`;const url='https://www.strava.com/oauth/authorize?'+new URLSearchParams({client_id:clientId,redirect_uri:redirect,response_type:'code',approval_prompt:'auto',scope:'read,activity:read_all',state});this.status='Approve access in your browser…';this.changed();this.shell.openExternal(url).catch(()=>this.finish(server,'Could not open your browser.'));});
 }
 async callback(req,res,state,server){
  const url=new URL(req.url,'http://127.0.0.1');if(url.pathname!=='/strava'){res.writeHead(404).end();return;}
  const reply=(ok,text)=>{res.writeHead(ok?200:400,{'Content-Type':'text/html; charset=utf-8'});res.end(`<!doctype html><title>Strava</title><body style="font-family:Arial;background:#101722;color:#edf2fa;padding:40px"><h2>${ok?'Strava connected':'Strava not connected'}</h2><p>${text}</p></body>`);};
  if(url.searchParams.get('state')!==state){reply(false,'This sign-in link expired. Start again from the companion.');return;}
  if(url.searchParams.get('error')||!url.searchParams.get('code')){reply(false,'Access was declined.');this.finish(server,'Strava access was declined.');return;}
  if(!/activity:read/.test(url.searchParams.get('scope')||'')){reply(false,'Allow “View data about your activities” so runs can be shown.');this.finish(server,'Strava needs permission to read your activities.');return;}
  try{await this.token({code:url.searchParams.get('code'),grant_type:'authorization_code'});reply(true,'You can close this tab and return to the companion.');this.status='Connected as '+(this.session.athlete||'Strava athlete');this.finish(server);this.refresh(true).catch(()=>{});}
  catch(e){reply(false,'Sign-in failed. Return to the companion and try again.');this.finish(server,e.message);}
 }
 finish(server,error){if(error)this.status=error;if(this.server===server)this.server=null;server.close();server.closeAllConnections?.();this.data.connected=!!this.session;this.changed();}
 cancel(){if(this.server)this.finish(this.server,this.session?'Connected as '+(this.session.athlete||'Strava athlete'):'Sign-in cancelled.');}
 sample(){if(this.session&&!this.busy&&Date.now()-this.lastFetch>=REFRESH_MS)this.refresh().catch(()=>{});}
 async refresh(force=false){
  if(!this.session||this.busy||(!force&&Date.now()-this.lastFetch<REFRESH_MS))return;this.busy=true;this.lastFetch=Date.now();
  try{if(this.session.expiresAt<Date.now()+300000)await this.token({refresh_token:this.session.refreshToken,grant_type:'refresh_token'});
   // A day of slack before Monday covers time zones; totals() keys by local date.
   const after=Math.floor(week().start/1000)-86400;const list=await this.request(`https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=100`,{headers:{Authorization:'Bearer '+this.session.accessToken}});
   if(!Array.isArray(list))throw Error('Strava returned an invalid activity list.');this.data={...this.settings,connected:true,days:totals(list),updatedAt:Date.now(),error:''};this.status='Connected as '+(this.session.athlete||'Strava athlete');
  }catch(e){if(e.revoked)this.clear();this.data={...this.data,connected:!!this.session,error:e.message};this.status=e.message;}
  finally{this.busy=false;this.changed();}
 }
 clear(){this.session=null;for(const f of [this.sessionFile,this.sessionFile+'.tmp'])try{fs.unlinkSync(f);}catch{}}
 async disconnect(){const token=this.session?.accessToken;this.cancel();this.clear();this.data={...this.settings,connected:false,days:{},updatedAt:0};this.status='Disconnected';this.changed();if(token)await this.fetch('https://www.strava.com/oauth/deauthorize',{method:'POST',headers:{Authorization:'Bearer '+token},redirect:'error',signal:AbortSignal.timeout(8000)}).catch(()=>{});}
 close(){if(this.server){this.server.close();this.server=null;}}
}
module.exports={StravaConnection,validateApp,validate,week,totals,summary};
