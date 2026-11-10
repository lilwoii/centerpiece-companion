// Native USB code lives in a separate process so a driver/library crash cannot kill the UI.
const HID=require('node-hid');
const inventory=()=>HID.devices().filter(d=>d.vendorId===0x361d&&d.usagePage===0xff00&&d.usage===1&&[0x200,0x202].includes(d.productId));
if(process.argv.includes('--list')){process.stdout.write(JSON.stringify(inventory()));process.exit(0);}
// Keep one native reader per interface for the lifetime of this helper. Short-lived
// version/configuration clients must not open and close competing native readers.
const handles=new Map(),devices=new Map();
const send=value=>{if(process.connected)process.send(value);};
function fail(entry,message,reason='write'){if(entry.failed)return;entry.failed=true;message=String(message||'USB operation failed.').slice(0,160);send({event:'diagnostic',kind:'usb-interface-failed',details:{interface:entry.interface,reason,message,clients:entry.clients.size}});for(const client of entry.clients)send({event:'error',key:client,message});}
function release(entry){if(entry.failed&&!entry.clients.size&&!entry.released){entry.released=true;if(devices.get(entry.path)===entry)devices.delete(entry.path);try{entry.handle.close();}catch{}}}
process.on('message',message=>{const{id,op,key}=message;try{
 if(op==='devices'){send({id,result:inventory()});return;}
 if(op==='open'){const device=inventory().find(d=>d.path===message.path);if(!device)throw Error('Supported Centerpiece interface not found.');let entry=devices.get(device.path);if(entry?.failed){release(entry);entry=devices.get(device.path);if(entry)throw Error('USB session is closing. Reconnect before writing.');}if(!entry){entry={path:device.path,interface:device.productId===0x202?'display':'keyboard',handle:new HID.HID(device.path),clients:new Set()};devices.set(device.path,entry);entry.handle.on('data',data=>{if(!entry.failed)for(const client of entry.clients)send({event:'data',key:client,data});});entry.handle.on('error',error=>{fail(entry,'USB read interrupted: '+(error?.message||'connection unavailable'),'reader');release(entry);});}entry.clients.add(key);handles.set(key,entry);return;}
 const entry=handles.get(key);if(!entry){if(id)send({id,error:'USB connection closed.'});return;}const handle=entry.handle;
 if(op==='close'){handles.delete(key);entry.clients.delete(key);release(entry);return;}
 if(op==='invalidate'){fail(entry,'Display transfer interrupted. Reconnecting the USB session.','protocol');release(entry);return;}
 if(entry.failed)throw Error('USB session failed. Reconnect before writing.');
 const write=packet=>{try{if(handle.write(packet)!==packet.length)throw Error('Incomplete USB packet write.');}catch(error){fail(entry,error.message);throw error;}};
 if(op==='write-batch'){
  if(!Array.isArray(message.packets)||!message.packets.length||message.packets.length>64||message.packets.some(p=>!Array.isArray(p)||p.length!==1024))throw Error('Invalid USB batch.');
  if(!Number.isFinite(message.deadline))throw Error('Missing USB batch deadline.');
  for(const packet of message.packets){if(Date.now()>=message.deadline){fail(entry,'USB batch expired before completion.','deadline');throw Error('USB batch expired before completion.');}write(packet);}
  send({id,result:true});return;
 }
 if(op==='write'){if(!Array.isArray(message.data)||![64,1024].includes(message.data.length))throw Error('Invalid USB packet.');write(message.data);}
 }catch(error){if(id)send({id,error:error.message?.slice(0,160)||'USB operation failed.'});else send({event:'error',key,message:error.message?.slice(0,160)||'USB operation failed.'});}});
process.on('disconnect',()=>{for(const entry of devices.values())try{entry.handle.close();}catch{}process.exit(0);});
