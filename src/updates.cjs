const {EventEmitter}=require('node:events');
const config=require('./distribution.json');
class Updates extends EventEmitter{
 constructor(app){super();this.app=app;this.state={status:'unconfigured',message:'Community release repository is not configured yet.'};this.updater=null;this.checkPromise=null;this.lastCheck=0;this.installAttempt=null;}
 start(){if(!/^[A-Za-z0-9-]+$/.test(config.githubOwner)||!/^[A-Za-z0-9_.-]+$/.test(config.githubRepo))return;
  if(!this.app.isPackaged||!require('fs').existsSync(require('path').join(process.resourcesPath,'app-update.yml'))){this.state={status:'manual',message:'Automatic updates require the installed GitHub release.'};return;}
  const {NsisUpdater}=require('electron-updater');this.cacheRoot=require('./update-storage.cjs').updateStorage(this.app);const u=new NsisUpdater();Object.defineProperty(u.app,'baseCachePath',{get:()=>this.cacheRoot});this.updater=u;u.autoDownload=false;u.autoInstallOnAppQuit=false;u.allowDowngrade=false;u.allowPrerelease=this.app.getVersion().includes('-');u.logger=null;
  // electron-builder pins the public GitHub update source in app-update.yml.

  u.on('checking-for-update',()=>this.set('checking','Checking for updates…'));
  u.on('update-available',info=>this.set('available',`Update ${info.version} available`));
  u.on('update-not-available',()=>this.set('current','You have the latest release.'));
  u.on('download-progress',p=>this.set('downloading',`Downloading update · ${Math.round(p.percent)}%`));
  u.on('update-downloaded',()=>this.set('ready','Update ready · restart to install'));
  u.on('error',error=>this.handleError(error));
  this.set('idle','Check for a newer community release.');
 }
 set(status,message){if(['available','ready'].includes(this.state.status)&&['checking','error','current'].includes(status))return;this.state={status,message};this.emit('change');}
 async check({background=false}={}){if(!this.updater||['downloading','ready','available'].includes(this.state.status))return this.state;if(this.checkPromise)return this.checkPromise;if(background&&Date.now()-this.lastCheck<60000)return this.state;this.lastCheck=Date.now();this.checkPromise=Promise.resolve().then(()=>this.updater.checkForUpdates()).catch(()=>this.set('error','Update check failed. Check your internet connection and try again.')).then(()=>this.state).finally(()=>{this.checkPromise=null;});return this.checkPromise;}
 async download(){if(!this.updater||this.state.status!=='available')throw Error('Check for an available update first.');this.set('downloading','Preparing update folder…');try{const root=await require('./update-storage.cjs').chooseWritableStorage(this.app,this.cacheRoot,require('electron').dialog);if(!root){this.set('available','Update download cancelled. Click Download update to choose a folder.');return this.state;}if(root!==this.cacheRoot){this.cacheRoot=root;this.updater.downloadedUpdateHelper=null;}await this.updater.downloadUpdate();return this.state;}catch(error){this.set('available',['EPERM','EACCES','EROFS'].includes(error.code)?'That update folder is not writable. Retry and choose another folder.':error.code==='ENOSPC'?'The update drive is full. Free space before retrying.':'Update download failed. Please retry.');return this.state;}}
 handleError(error){
  if(!this.installAttempt){this.set('error','Update check failed. Your current version is still available.');return;}
  const previous=this.installAttempt;this.installAttempt=null;this.updater.quitAndInstallCalled=false;
  for(const key of ['TEMP','TMP']){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}
  this.set('ready',error?.code==='ENOSPC'?'The update drive is full. Free space, then retry Restart to install.':['EPERM','EACCES','EROFS'].includes(error?.code)?'Windows denied access to the update installer or its temporary folder. Check folder permissions, then retry Restart to install.':'The update installer could not start. Retry Restart to install and approve the Windows permission prompt if it appears.');
 }
 install(){
  if(!this.updater||this.state.status!=='ready')throw Error('Download the update first.');
  if(this.installAttempt)return this.state;
  this.installAttempt={TEMP:process.env.TEMP,TMP:process.env.TMP};
  try{
   const temp=require('./update-storage.cjs').prepareUpdateTemp(this.cacheRoot);
   process.env.TEMP=temp;process.env.TMP=temp;
   this.set('ready','Starting update installer…');
   this.updater.quitAndInstall(true,true);
  }catch(error){this.handleError(error);}
  return this.state;
 }
}
module.exports={Updates};
