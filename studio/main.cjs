// Independent local preview. Never import the released Companion main module.
const path=require('node:path');
const DESKTOP_PORT=41736;
function electronEntry(runtime,filename){return !!runtime.versions?.electron&&runtime.type==='browser'&&typeof runtime.argv?.[1]==='string'&&path.resolve(runtime.argv[1]).toLowerCase()===path.resolve(filename).toLowerCase();}
function trustedDocument(value,origin){try{const url=new URL(value);return url.origin===origin&&!url.username&&!url.password&&['/','/studio/index.html'].includes(url.pathname);}catch{return false;}}
function controlWindow(event,action,window,origin){
 if(!window||window.isDestroyed()||event.sender!==window.webContents||!event.senderFrame||event.senderFrame!==window.webContents.mainFrame||!trustedDocument(event.senderFrame.url,origin))throw Error('Untrusted window request.');
 if(action==='minimize')window.minimize();else if(action==='maximize')window.isMaximized()?window.unmaximize():window.maximize();else if(action==='close')window.close();else throw Error('Unknown window action.');
}
function guardWindow(window,origin){
 window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 for(const name of ['will-navigate','will-redirect'])window.webContents.on(name,(event,url)=>{if(!trustedDocument(url,origin))event.preventDefault();});
 window.webContents.on('will-attach-webview',event=>event.preventDefault());
}
function launch(){
 const {app,BrowserWindow,ipcMain,session,dialog}=require('electron');
 app.setPath('userData',path.join(app.getPath('appData'),'centerpiece-skin-studio-local'));
 if(!app.requestSingleInstanceLock()){app.quit();return;}
 let server,window,origin;
 app.on('second-instance',()=>{if(window&&!window.isDestroyed()){if(window.isMinimized())window.restore();window.show();window.focus();}});
 app.whenReady().then(async()=>{
  const started=await require('./server.cjs').startServer(DESKTOP_PORT);server=started.server;origin=started.url;
  session.defaultSession.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));session.defaultSession.setPermissionCheckHandler(()=>false);
  session.defaultSession.webRequest.onBeforeRequest((details,callback)=>{let allowed=false;try{const url=new URL(details.url);allowed=url.origin===origin&&['http:','blob:'].includes(url.protocol)||/^data:image\/(?:png|jpeg|webp);base64,/.test(details.url);}catch{}callback({cancel:!allowed});});
  window=new BrowserWindow({width:1540,height:1000,minWidth:560,minHeight:640,frame:false,title:'Skin Studio · Local development',backgroundColor:'#11151d',icon:path.join(__dirname,'../src/assets/community.png'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false}});
  guardWindow(window,origin);
  ipcMain.handle('studio-window',(event,action)=>controlWindow(event,action,window,origin));
  await window.loadURL(origin);
 }).catch(error=>{dialog.showErrorBox('Skin Studio could not open',error?.code==='EADDRINUSE'?'The local editor port is already in use. Close the other Skin Studio preview using port 41736, then try again. Your saved draft is still on this PC.':'The local preview could not start. Check that its source files are available, then try again. Your saved draft is still on this PC.');app.quit();});
 app.on('window-all-closed',()=>app.quit());app.on('will-quit',()=>server?.close());
}
if(require.main===module||electronEntry(process,__filename))launch();
module.exports={trustedDocument,controlWindow,guardWindow,electronEntry,DESKTOP_PORT};
