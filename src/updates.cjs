const {EventEmitter}=require('node:events');
const config=require('./distribution.json');
class Updates extends EventEmitter{
 constructor(app){super();this.app=app;this.state={status:'unconfigured',message:'Community release repository is not configured yet.'};this.updater=null;}
 start(){if(!/^[A-Za-z0-9-]+$/.test(config.githubOwner)||!/^[A-Za-z0-9_.-]+$/.test(config.githubRepo))return;
  if(!this.app.isPackaged||!require('fs').existsSync(require('path').join(process.resourcesPath,'app-update.yml'))){this.state={status:'manual',message:'Automatic updates require the installed GitHub release.'};return;}
  const {autoUpdater:u}=require('electron-updater');this.updater=u;u.autoDownload=false;u.autoInstallOnAppQuit=false;u.allowDowngrade=false;u.allowPrerelease=this.app.getVersion().includes('-');u.logger=null;
  // electron-builder pins the public GitHub update source in app-update.yml.

  u.on('checking-for-update',()=>this.set('checking','Checking for updates…'));
  u.on('update-available',info=>this.set('available',`Update ${info.version} available`));
  u.on('update-not-available',()=>this.set('current','You have the latest release.'));
  u.on('download-progress',p=>this.set('downloading',`Downloading update · ${Math.round(p.percent)}%`));
  u.on('update-downloaded',()=>this.set('ready','Update ready · restart to install'));
  u.on('error',()=>this.set('error','Update check failed. Your current version is still available.'));
  this.set('idle','Check for a newer community release.');
 }
 set(status,message){this.state={status,message};this.emit('change');}
 async check(){if(!this.updater)return this.state;await this.updater.checkForUpdates().catch(()=>{});return this.state;}
 async download(){if(!this.updater||this.state.status!=='available')throw Error('Check for an available update first.');await this.updater.downloadUpdate();return this.state;}
 install(){if(!this.updater||this.state.status!=='ready')throw Error('Download the update first.');this.updater.quitAndInstall(false,true);}
}
module.exports={Updates};
