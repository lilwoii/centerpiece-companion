const fs=require('node:fs'),path=require('node:path');const{catalog,validateSlot,hotkeyCodes}=require('./catalog.cjs');const{SystemBridge}=require('./system.cjs');const{KeymapEditor}=require('./keymap.cjs');const OBSWebSocket=require('obs-websocket-js').default;
const defaults=()=>({slots:[{plugin:'spotify',action:'previous',value:''},{plugin:'spotify',action:'toggle',value:''},{plugin:'spotify',action:'next',value:''},null],indicator:{enabled:false,on:'#9bb9ff',off:'#243040',x:8,y:201,width:161,height:84}});
const {LiveData,safeLocation}=require('./live-data.cjs');const{TwitchChat}=require('./twitch.cjs');
const widgetDefault=()=>({type:'off',text:'',x:1710,y:219,width:194,height:94});
class Workspace{
 constructor(directory,shell,dialog,media){this.directory=directory;this.file=path.join(directory,'desk.json');this.shell=shell;this.dialog=dialog;this.media=media;this.system=new SystemBridge();this.editor=new KeymapEditor(path.join(directory,'keymap-backups'));this.config=this.validate(defaults());this.obs=null;this.locks={caps:false};this.live=new LiveData(this.system);this.chat=new TwitchChat();try{const c=JSON.parse(fs.readFileSync(this.file));if(c.slots?.length===3)c.slots.push(null);this.config=this.validate(c);}catch{}this.live.weatherSettings=this.config.weather;this.live.lhm=this.config.sensors; }
 validate(c){if(!Array.isArray(c?.slots)||c.slots.length!==4)throw Error('Choose exactly four strip positions.');const slots=c.slots.map(validateSlot),i=c.indicator;
 if(!i||typeof i.enabled!=='boolean'||![i.on,i.off].every(s=>/^#[0-9a-f]{6}$/i.test(s)))throw Error('Choose valid indicator colors.');
 for(const [k,max]of [['x',1919],['y',549],['width',1920],['height',550]])if(!Number.isInteger(i[k])||i[k]<(k==='x'||k==='y'?0:1)||i[k]>max)throw Error('Indicator area is outside the keyboard screen.');
 if(i.x+i.width>1920||i.y+i.height>550)throw Error('Indicator area is outside the keyboard screen.');
 const w=c.widget||widgetDefault();if(!['off','follow','spotify','clock','weather','cpu','gpu','mic','twitch','text'].includes(w.type)||typeof w.text!=='string'||w.text.length>200)throw Error('Choose a supported detail widget.');for(const k of ['x','y','width','height'])if(!Number.isInteger(w[k])||w[k]<0)throw Error('Choose a valid widget area.');if(w.width<80||w.height<50||w.x+w.width>1920||w.y+w.height>550)throw Error('Widget area is outside the screen.');
 const weather=c.weather||{location:null,unit:'fahrenheit'};if(!['fahrenheit','celsius'].includes(weather.unit))throw Error('Choose °F or °C.');const layerColor=c.layerColor||'';if(layerColor&&!/^#[0-9a-f]{6}$/i.test(layerColor))throw Error('Choose a valid L1 color.');const languageId=c.languageId||'qwerty';if(!['qwerty','korean-2'].includes(languageId)&&!/^[0-9a-f]{8}$/i.test(languageId))throw Error('Choose a keyboard language.');return{languageId,slots,indicator:{enabled:i.enabled,on:i.on,off:i.off,x:i.x,y:i.y,width:i.width,height:i.height},widget:{type:w.type,text:w.text,x:w.x,y:w.y,width:w.width,height:w.height},weather:{location:weather.location?safeLocation(weather.location):null,unit:weather.unit},layerColor,sensors:c.sensors===true};
 }
 save(c){const valid=this.validate(c);fs.mkdirSync(this.directory,{recursive:true});fs.writeFileSync(this.file+'.tmp',JSON.stringify(valid,null,2));fs.renameSync(this.file+'.tmp',this.file);this.config=valid;this.live.weatherSettings=valid.weather;this.live.lhm=valid.sensors;return valid;}
 view(){return{language:this.language,catalog,config:this.config,locks:this.locks,obsConnected:!!this.obs,live:this.live.state,chat:this.chat.state};}
 async connectObs(password,port){if(typeof password!=='string'||password.length>512||!Number.isInteger(port)||port<1||port>65535)throw Error('Enter an OBS port and password.');const obs=new OBSWebSocket();obs.on('error',()=>{});obs.on('ConnectionClosed',()=>{if(this.obs===obs)this.obs=null;});try{await obs.connect(`ws://127.0.0.1:${port}`,password,{rpcVersion:1});}catch{await obs.disconnect().catch(()=>{});throw Error('Could not connect. Enable OBS WebSocket Server and check the port and password.');}if(this.obs)await this.obs.disconnect();this.obs=obs;return true;}
 async run(index){if(!Number.isInteger(index)||index<0||index>3)throw Error('Invalid slot');const slot=this.config.slots[index];if(!slot)throw Error('This position is empty. Add a plugin first.');const p=catalog.find(p=>p.id===slot.plugin);
 if(slot.action==='hotkey')return this.system.request('keys',hotkeyCodes(slot.value));
 if(slot.action==='open')return this.shell.openExternal(p.url);
 if(slot.action==='url')return this.shell.openExternal(slot.value);
 if(slot.action==='app'){const error=await this.shell.openPath(slot.value);if(error)throw Error(error);return;}
 if(slot.plugin==='spotify')return this.media.request(slot.action);
 if(slot.action==='display'){await this.live.sample();return;}
 if(slot.plugin==='mic'){this.live.state.mic=await this.system.request('mic-toggle');return;}
 if(slot.plugin==='media')return this.system.request('keys',[{previous:177,next:176,toggle:179,volumeup:175,volumedown:174,volumemute:173}[slot.action]]);
 if(slot.plugin==='obs'){if(!this.obs)throw Error('Connect OBS in the Connections page first.');const requests={record:['ToggleRecord',{}],replay:['SaveReplayBuffer',{}],scene:['SetCurrentProgramScene',{sceneName:slot.value}],mute:['ToggleInputMute',{inputName:slot.value}]};const[method,args]=requests[slot.action];await this.obs.call(method,args);return;}
 throw Error('Choose an action for this plugin.');
 }
 async pick(){const result=await this.dialog.showOpenDialog({title:'Choose an app to launch',properties:['openFile'],filters:[{name:'Windows apps',extensions:['exe','lnk']}]});return result.canceled?'':result.filePaths[0];}
 close(){this.system.close();this.obs?.disconnect().catch(()=>{});this.chat.close();}
}
module.exports={Workspace,defaults};
