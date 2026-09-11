const {app,BrowserWindow}=require('electron'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
app.setPath('userData',path.join(app.getPath('temp'),'centerpiece-setup-recovery-verification'));
app.whenReady().then(async()=>{try{
  const win=new BrowserWindow({show:false,width:1320,height:920,webPreferences:{offscreen:true,backgroundThrottling:false,contextIsolation:true,nodeIntegration:false,sandbox:false,preload:path.join(__dirname,'features-preload.cjs'),additionalArguments:['--setup-recovery-test']}});
  const errors=[];win.webContents.on('console-message',(_e,level,message)=>{if(level>=3&&!message.includes('Content-Security-Policy'))errors.push(message);});
  const js=s=>win.webContents.executeJavaScript(s),wait=()=>new Promise(r=>setTimeout(r,120)),click=async id=>{await js(`document.getElementById(${JSON.stringify(id)}).click()`);await wait();};
  await win.loadFile(path.join(__dirname,'../src/index.html'));await wait();
  assert.equal(await js('document.getElementById("review-setup").hidden'),false);
  assert.match(await js('document.getElementById("setup-failure-detail").textContent'),/KEYBOARD_PENDING_CHANGES/);
  await click('review-setup');assert.equal(await js('document.activeElement.id'),'setup-recovery-cancel');assert.equal(await js('document.getElementById("setup-recovery-dialog").open'),true);assert.match(await js('document.getElementById("setup-recovery-description").textContent'),/including any pending key or layout changes/);assert.equal(await js('window.setupTest.counts().confirmed'),0);
  const dir=path.join(__dirname,'../verification');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'setup-recovery.png'),(await win.webContents.capturePage()).toPNG());
  await click('setup-recovery-cancel');assert.equal(await js('document.activeElement.id'),'review-setup');assert.equal(await js('window.setupTest.counts().canceled'),1);
  win.setSize(560,900);await click('review-setup');assert.equal(await js('document.documentElement.scrollWidth<=innerWidth'),true);assert.equal(await js('document.getElementById("setup-recovery-dialog").getBoundingClientRect().right<=innerWidth'),true);fs.writeFileSync(path.join(dir,'setup-recovery-narrow.png'),(await win.webContents.capturePage()).toPNG());
  await js('window.setupTest.fail(true)');await click('setup-recovery-confirm');assert.equal(await js('document.getElementById("setup-recovery-dialog").open'),true);assert.match(await js('document.getElementById("setup-recovery-error").textContent'),/configuration changed/);assert.equal(await js('document.getElementById("setup-recovery-confirm").disabled'),true);await click('setup-recovery-cancel');
  await js('window.setupTest.fail(false)');await click('review-setup');await click('setup-recovery-confirm');assert.equal(await js('document.getElementById("setup-recovery-dialog").open'),false);assert.equal(await js('document.getElementById("setup-banner").hidden'),true);assert.equal(await js('window.setupTest.counts().confirmed'),2);assert.deepEqual(errors,[]);
  console.log('Setup recovery: precise error, no write before confirmation, cancel/focus, stale failure, retry, success and narrow layout passed.');win.destroy();app.exit(0);
}catch(e){console.error(e);app.exit(1);}});
