// Native USB code lives in a separate process so a driver/library crash cannot kill the UI.
const HID=require('node-hid');
const inventory=()=>HID.devices().filter(d=>d.vendorId===0x361d&&d.usagePage===0xff00&&d.usage===1&&[0x200,0x202].includes(d.productId));
if(process.argv.includes('--list')){process.stdout.write(JSON.stringify(inventory()));process.exit(0);}
// Keep one native reader per interface for the lifetime of this helper. Short-lived
// version/configuration clients must not open and close competing native readers.
const handles=new Map(),devices=new Map();
const send=value=>{if(process.connected)process.send(value);};
process.on('message',message=>{const{id,op,key}=message;try{
 if(op==='devices'){send({id,result:inventory()});return;}
 if(op==='open'){const device=inventory().find(d=>d.path===message.path);if(!device)throw Error('Supported Centerpiece interface not found.');let entry=devices.get(device.path);if(!entry){entry={handle:new HID.HID(device.path),clients:new Set()};devices.set(device.path,entry);entry.handle.on('data',data=>{for(const client of entry.clients)send({event:'data',key:client,data});});entry.handle.on('error',()=>{for(const client of entry.clients)send({event:'error',key:client,message:'USB connection interrupted.'});});}entry.clients.add(key);handles.set(key,entry);return;}
 const entry=handles.get(key);if(!entry)return;const handle=entry.handle;
 if(op==='write'){if(!Array.isArray(message.data)||![64,1024].includes(message.data.length))throw Error('Invalid USB packet.');handle.write(message.data);}
 else if(op==='close'){handles.delete(key);entry.clients.delete(key);}
 }catch(error){if(id)send({id,error:'USB operation failed.'});else send({event:'error',key,message:error.message?.slice(0,160)||'USB operation failed.'});}});
process.on('disconnect',()=>{for(const entry of devices.values())try{entry.handle.close();}catch{}process.exit(0);});
