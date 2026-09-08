// Isolated UI adapters: never construct hardware/media bridges or contact accounts.
const{contextBridge}=require('electron'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const{Workspace,defaults}=require('../src/workspace.cjs'),{catalog}=require('../src/catalog.cjs'),{Countdown}=require('../src/countdown.cjs'),{Profiles}=require('../src/profiles.cjs');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'centerpiece-ui-profiles-'));
const workspace={config:Workspace.prototype.validate(defaults()),validate:Workspace.prototype.validate};
const timer=new Countdown(),listeners=[];
const state={media:{available:true,title:'A song for the community',artist:'Test artist',status:'Playing',position:12,duration:200,controls:{}},navigation:{active:false},device:{keyboard:true,display:true},strip:true,feedback:'',error:'',startup:{available:true,enabled:false},desk:{catalog,locks:{caps:false},live:{weather:{temperature:21,unit:'°C',label:'Sunny',icon:'sun'}},chat:{},obsStatus:{connected:true,recording:true,recordSeconds:120}},community:{configured:false,features:[],skins:[],queue:[]}};
const profiles=new Profiles(directory,workspace,async config=>{workspace.config=workspace.validate(config);state.profileRevision=(state.profileRevision||0)+1;state.widgetRevision=(state.widgetRevision||0)+1;});
function value(){state.desk.config=workspace.config;state.desk.timer=timer.view();state.profiles=profiles.view();return structuredClone(state);}
function changed(){const current=value();for(const listener of listeners)listener(current);return current;}
const methods=Object.fromEntries([...fs.readFileSync(path.join(__dirname,'../src/preload.cjs'),'utf8').matchAll(/^\s+(\w+):/gm)].map(m=>[m[1],async()=>value()]));
Object.assign(methods,{
 getState:async()=>value(),subscribe:callback=>{listeners.push(callback);return()=>{};},subscribeKey:()=>()=>{},subscribeWindow:()=>()=>{},
 saveWidget:async widget=>{workspace.config=workspace.validate({...workspace.config,widget});state.widgetRevision=(state.widgetRevision||0)+1;state.feedback='Screen widget saved and displayed.';return changed();},
 saveWidgetOrder:async(order,motion)=>{workspace.config=workspace.validate({...workspace.config,widgetOrder:order,weatherMotion:motion});return changed();},
 timerCommand:async(action,minutes)=>{if(action==='start')workspace.config=workspace.validate({...workspace.config,timerMinutes:minutes});timer.command(action,workspace.config.timerMinutes);return changed();},
 pickProfileApp:async()=>'obs64.exe',
 profileAction:async(action,input)=>{if(action==='create'||action==='replace')profiles.save(input.name,action==='replace'?input.id:undefined);else if(action==='link')profiles.link(input.id,input.app);else if(action==='enable')profiles.enable(input.enabled);else if(action==='load')await profiles.load(input.id);else if(action==='remove')profiles.remove(input.id);return changed();}
});
contextBridge.exposeInMainWorld('companion',methods);
window.addEventListener('unload',()=>{for(const name of fs.readdirSync(directory))fs.unlinkSync(path.join(directory,name));fs.rmdirSync(directory);});
