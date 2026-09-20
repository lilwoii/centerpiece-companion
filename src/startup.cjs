const fs=require('node:fs'),path=require('node:path');
class Startup {
 constructor(app,exe,directory){this.app=app;this.options={path:exe,args:['--background']};this.preferenceFile=directory?path.join(directory,'startup-preference.json'):null;}
 settings(){return this.app.getLoginItemSettings({...this.options,path:'"'+this.options.path+'"'});}
 remember(enabled){if(!this.preferenceFile)return;fs.mkdirSync(path.dirname(this.preferenceFile),{recursive:true});const temporary=this.preferenceFile+'.tmp';fs.writeFileSync(temporary,JSON.stringify({format:1,enabled})+'\n');fs.renameSync(temporary,this.preferenceFile);}
 initialize(){
  if(!this.app.isPackaged||!this.preferenceFile)return this.read();
  // Defaults run once. Subsequent launches respect changes made in Windows too.
  if(fs.existsSync(this.preferenceFile))return this.read();
  const current=this.settings();
  const disabledInWindows=(current.openAtLogin&&current.executableWillLaunchAtLogin===false)||current.launchItems?.some(item=>item.enabled===false);
  if(disabledInWindows){this.remember(false);return this.read();}
  if(current.openAtLogin){this.remember(true);return this.read();}
  this.remember(true);
  return this.set(true);
 }
 // Electron parses the lookup path as a command line; quote spaces for readback.
 read(){if(!this.app.isPackaged)return{available:false,enabled:false};const value=this.settings();return{available:true,enabled:!!value.openAtLogin&&value.executableWillLaunchAtLogin!==false};}
 set(enabled){if(typeof enabled!=='boolean')throw Error('Choose whether to start with Windows.');if(!this.app.isPackaged)throw Error('Startup is available in the installed app.');this.remember(enabled);this.app.setLoginItemSettings({...this.options,openAtLogin:enabled});const result=this.read();if(result.enabled!==enabled)throw Error('Windows did not '+(enabled?'enable':'disable')+' startup. Check Startup apps in Windows Settings.');return result;}
}
function openCompanion(win){win.setSkipTaskbar(false);win.show();win.restore();win.focus();}
function hideCompanion(win){win.hide();win.setSkipTaskbar(true);}
module.exports={Startup,openCompanion,hideCompanion};
