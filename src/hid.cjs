const{fork,execFileSync}=require('node:child_process'),{EventEmitter}=require('node:events'),path=require('node:path');
const worker=path.join(__dirname,'hid-worker.cjs');let child,sequence=0,cached;const handles=new Map(),pending=new Map();
function environment(){return{...process.env,ELECTRON_RUN_AS_NODE:'1'};}
function start(){if(child?.connected)return child;const proc=fork(worker,[],{execPath:process.execPath,env:environment(),windowsHide:true,stdio:['ignore','ignore','ignore','ipc'],serialization:'advanced'});child=proc;
 proc.on('message',m=>{if(m.id){const item=pending.get(m.id);if(item){clearTimeout(item.timer);pending.delete(m.id);m.error?item.reject(Error(m.error)):item.resolve(m.result);}}else{const h=handles.get(m.key);if(h&&!h.closed){if(m.event==='data')h.emit('data',Buffer.from(m.data));else if(m.event==='error')h.emit('error',Error(m.message));}}});
 const end=()=>{if(child!==proc)return;child=null;cached=null;for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('USB helper stopped. Reconnect the keyboard in the app.'));}pending.clear();const open=[...handles.values()];handles.clear();for(const h of open){h.closed=true;h.emit('error',Error('USB helper stopped. Restart the keyboard connection in the app.'));}};proc.on('error',end);proc.on('exit',end);return proc;
}
function send(message){const p=start();p.send(message,error=>{if(error&&message.key){const h=handles.get(message.key);if(h&&!h.closed)h.emit('error',Error('USB helper is unavailable.'));}});}
class VirtualHID extends EventEmitter{
 constructor(devicePath){super();this.key=++sequence;this.closed=false;handles.set(this.key,this);send({op:'open',key:this.key,path:devicePath});}
 write(data){if(this.closed)throw Error('USB connection closed. Restart the keyboard connection.');send({op:'write',key:this.key,data:Array.from(data)});return data.length;}
 close(){if(this.closed)return;this.closed=true;handles.delete(this.key);if(child?.connected)child.send({op:'close',key:this.key},()=>{});}
}
function devices(){if(cached)return cached;cached=JSON.parse(execFileSync(process.execPath,[worker,'--list'],{env:environment(),windowsHide:true,timeout:8000,maxBuffer:200000,encoding:'utf8'}));return cached;}
function devicesAsync(){return new Promise((resolve,reject)=>{const id=++sequence;const timer=setTimeout(()=>{pending.delete(id);reject(Error('USB discovery timed out.'));},8000);pending.set(id,{resolve:value=>{cached=value;resolve(value);},reject,timer});send({op:'devices',id});});}
function shutdown(){const p=child;child=null;for(const h of handles.values())h.closed=true;handles.clear();for(const item of pending.values()){clearTimeout(item.timer);item.reject(Error('App closed.'));}pending.clear();p?.disconnect();}
module.exports={HID:VirtualHID,devices,devicesAsync,shutdown};
