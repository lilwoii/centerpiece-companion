// Missed state-event fixture: failed review rejects before the renderer receives fresh state.
const{app,BrowserWindow}=require('electron'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
app.setPath('userData',path.join(app.getPath('temp'),'centerpiece-setup-feedback-verification'));
app.whenReady().then(async()=>{try{
 const win=new BrowserWindow({show:false,width:1320,height:920,webPreferences:{offscreen:true,backgroundThrottling:false,contextIsolation:true,nodeIntegration:false,sandbox:false,preload:path.join(__dirname,'features-preload.cjs'),additionalArguments:['--setup-feedback-test']}}),errors=[];
 win.webContents.on('console-message',(_event,level,message)=>{if(level>=3&&!message.includes('Content-Security-Policy'))errors.push(message);});
 const js=source=>win.webContents.executeJavaScript(source),wait=()=>new Promise(resolve=>setTimeout(resolve,120));
 const click=async id=>{await js(`document.getElementById(${JSON.stringify(id)}).click()`);await wait();};
 await win.loadFile(path.join(__dirname,'../src/index.html'));await wait();
 for(const code of ['KEYBOARD_OVERLAY_OCCUPIED','KEYBOARD_OVERLAY_SPACE_REQUIRED']){
  await js(`window.setupFeedbackTest.reset();window.setupFeedbackTest.code(${JSON.stringify(code)});announce('The keyboard reports pending configuration changes.',true)`);await wait();
  assert.equal(await js('document.getElementById("review-setup").hidden'),false);
  await click('review-setup');
  assert.match(await js('document.getElementById("setup-failure-detail").textContent'),new RegExp(code));
  assert.doesNotMatch(await js('document.getElementById("setup-failure-detail").textContent'),/KEYBOARD_PENDING_CHANGES/);
  assert.equal(await js('document.getElementById("desk-feedback").textContent'),'');
  assert.equal(await js('document.getElementById("review-setup").hidden'),true,'old pending report must not offer recovery for a different blocker');
  assert.equal(await js('document.getElementById("setup-recovery-dialog").open'),false);
  await click('check-setup');assert.match(await js('document.getElementById("setup-report-summary").textContent'),new RegExp(code));assert.match(await js('document.getElementById("setup-report-summary").textContent'),/separate from this blocker/);
  await js("announce('Widget save failed. Please retry.',true);window.setupFeedbackTest.rebroadcast()");await wait();assert.equal(await js('document.getElementById("desk-feedback").textContent'),'Widget save failed. Please retry.');
 }
 const directory=path.join(__dirname,'../verification');fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(path.join(directory,'setup-current-blocker.png'),(await win.webContents.capturePage()).toPNG());
 await js('window.setupFeedbackTest.clear()');await wait();
 assert.equal(await js('document.getElementById("setup-failure-detail").hidden'),true);assert.equal(await js('document.getElementById("setup-failure-detail").textContent'),'');assert.equal(await js('document.getElementById("review-setup").hidden'),true);assert.match(await js('document.getElementById("setup-report-summary").textContent'),/no pending changes/);assert.doesNotMatch(await js('document.getElementById("setup-report-summary").textContent'),/OVERLAY/);
 assert.deepEqual(errors,[]);console.log('Setup feedback passed: failed IPC refresh, latest blocker, no stale pending banner, nonrecoverable review hidden, report diagnosis, unrelated feedback retained and cleared failure state.');win.destroy();app.exit(0);
 }catch(error){console.error(error);app.exit(1);}});
