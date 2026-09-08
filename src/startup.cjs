class Startup {
 constructor(app,exe){this.app=app;this.options={path:exe,args:['--background']};}
 read(){if(!this.app.isPackaged)return{available:false,enabled:false};const value=this.app.getLoginItemSettings(this.options);return{available:true,enabled:!!value.openAtLogin&&value.executableWillLaunchAtLogin!==false};}
 set(enabled){if(typeof enabled!=='boolean')throw Error('Choose whether to start with Windows.');if(!this.app.isPackaged)throw Error('Startup is available in the installed app.');this.app.setLoginItemSettings({...this.options,openAtLogin:enabled});const result=this.read();if(result.enabled!==enabled)throw Error('Windows did not enable startup. Check Startup apps in Windows Settings.');return result;}
}
function openCompanion(win){win.setSkipTaskbar(false);win.show();win.restore();win.focus();}
function hideCompanion(win){win.hide();win.setSkipTaskbar(true);}
module.exports={Startup,openCompanion,hideCompanion};
