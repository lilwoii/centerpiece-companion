'use strict';
const {app,BrowserWindow,Menu}=require('electron'),path=require('node:path');
app.setPath('userData',path.resolve(__dirname,'../.local-preview/desktop-editor-profile'));
app.setName('Centerpiece Companion');
app.setAppUserModelId('community.centerpiece.companion.preview');
let win,dock,server,closing=false;
app.whenReady().then(()=>{
 Menu.setApplicationMenu(null);
 win=new BrowserWindow({frame:false,autoHideMenuBar:true,icon:path.join(__dirname,'../src/assets/community.ico'),width:1440,height:1000,minWidth:1000,minHeight:700,title:'Centerpiece Companion · Private Studio test',backgroundColor:'#11151d',webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.session.setPermissionRequestHandler((_w,_p,callback)=>callback(false));
 dock=new(require('../src/unreal-dock.cjs').UnrealDock)(()=>win);const preview=require('./customization-preview.cjs');preview.configureEditorDock(dock);server=preview.server;
 preview.configureWindowControl(action=>{if(action==='minimize')win.minimize();if(action==='maximize')win.isMaximized()?win.unmaximize():win.maximize();const result={available:true,maximized:win.isMaximized()};if(action==='close')setImmediate(()=>win.close());return result;});
 server.listen(41740,'127.0.0.1',()=>win.loadURL('http://127.0.0.1:41740/#studio'));
 win.on('close',event=>{if(closing)return;event.preventDefault();void dock.shutdown().then(()=>{closing=true;server.close();win.close();}).catch(error=>console.error(error));});
});
app.on('window-all-closed',()=>app.quit());
