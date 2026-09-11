// Isolated renderer verification. The fixture exposes no hardware, accounts or updater.
const {app,BrowserWindow}=require('electron');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
app.setPath('userData',path.join(app.getPath('temp'),'centerpiece-update-status-verification'));
app.whenReady().then(async()=>{try{
 const win=new BrowserWindow({show:false,width:1320,height:920,webPreferences:{backgroundThrottling:false,offscreen:true,preload:path.join(__dirname,'features-preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:false}});
 const errors=[];win.webContents.on('console-message',(_event,level,message)=>{if(level>=3&&!message.includes('Content-Security-Policy'))errors.push(message);});
 await win.loadFile(path.join(__dirname,'../src/index.html'));
 const js=source=>win.webContents.executeJavaScript(source);
 const render=async(status,message)=>{await js(`renderCommunity({updates:${JSON.stringify({status,message})}})`);return js(`(()=>{const s=document.getElementById('update-status'),b=document.getElementById('update-action');return {label:s.querySelector('strong')?.textContent,detail:s.querySelector('.update-detail')?.textContent,text:s.textContent,statusClasses:[...s.classList],buttonClasses:[...b.classList],button:b.textContent,disabled:b.disabled,color:getComputedStyle(s).color,description:b.getAttribute('aria-describedby'),width:b.getBoundingClientRect().width};})()`);};
 let state=await render('available','Update 0.3.0-preview.99 available');
 assert.equal(state.label,'Update available');assert.equal(state.detail,'Version 0.3.0-preview.99');assert.equal(state.button,'Download update');assert.equal(state.disabled,false);assert.equal(state.color,'rgb(255, 180, 91)');assert.equal(state.description,'update-status');assert.ok(state.buttonClasses.includes('update-attention'));
 const actionWidth=state.width;
 await js('window.updateLabel=document.querySelector("#update-status strong")');
 await render('available','Update 0.3.0-preview.99 available');assert.equal(await js('updateLabel===document.querySelector("#update-status strong")'),true,'unchanged live state retains status DOM');
 state=await render('downloading','Downloading update · 42%');assert.equal(state.label,'Downloading update');assert.equal(state.detail,'42%');assert.equal(state.button,'Downloading…');assert.equal(state.disabled,true);assert.ok(state.statusClasses.includes('update-progress'));assert.ok(!state.buttonClasses.includes('update-attention'));assert.equal(state.width,actionWidth);
 state=await render('ready','Update ready · restart to install');assert.equal(state.label,'Update ready');assert.equal(state.button,'Restart & update');assert.equal(state.disabled,false);assert.ok(state.statusClasses.includes('update-attention'));assert.ok(!state.statusClasses.includes('update-progress'));
 for(const status of ['idle','checking','current','manual','unconfigured','error']){
  state=await render(status,status==='error'?'Update check failed. Your current version is still available.':'Status '+status);
  assert.equal(state.label,undefined);assert.equal(state.button,'Check for updates');assert.equal(state.disabled,['checking','manual','unconfigured'].includes(status));assert.ok(!state.statusClasses.includes('update-attention'));assert.ok(!state.statusClasses.includes('update-progress'));assert.ok(!state.buttonClasses.includes('update-attention'));assert.equal(state.statusClasses.includes('update-error'),status==='error');assert.equal(state.width,actionWidth);
 }
 const retry='That update folder is not writable. Retry and choose another folder.';
 state=await render('available',retry);assert.equal(state.label,'Update available');assert.equal(state.detail,retry);assert.ok(!state.statusClasses.includes('update-error'));
 const directory=path.join(__dirname,'../verification');fs.mkdirSync(directory,{recursive:true});
 for(const width of [1320,1024,850,560]){
  win.setSize(width,920);await new Promise(resolve=>setTimeout(resolve,100));
  for(const [status,message] of [['available','Update 0.3.0-preview.99 available'],['available',retry],['error','Update check failed. Your current version is still available.']]){
   await render(status,message);
   assert.equal(await js('document.documentElement.scrollWidth<=innerWidth'),true,`${width} ${status} document overflow`);
   assert.equal(await js(`['update-status','update-action','window-close'].every(id=>{const r=document.getElementById(id).getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.width>0&&r.height>0})`),true,`${width} ${status} header clipped`);
  }
  await render('available','Update 0.3.0-preview.99 available');
  if(width===1320||width===560)fs.writeFileSync(path.join(directory,`update-available-${width}.png`),(await win.webContents.capturePage()).toPNG());
 }
 assert.deepEqual(errors,[]);console.log('Update header passed: orange available/ready, download progress, cleared stale states, full retry messages and 1320/1024/850/560px layouts.');win.destroy();app.exit(0);
 }catch(error){console.error(error);app.exit(1);}});
