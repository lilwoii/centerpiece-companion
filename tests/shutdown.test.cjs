const test=require('node:test'),assert=require('node:assert/strict');
const {shutdownGate}=require('../src/shutdown.cjs');
test('repeated quit cannot bypass pending USB cleanup',async()=>{
 let release,cleaned=0,finished=0,prevented=0;
 const gate=shutdownGate(async()=>{cleaned++;await new Promise(r=>release=r);},()=>finished++,()=>assert.fail());
 const event={preventDefault(){prevented++;}};
 const pending=gate(event);await Promise.resolve();gate(event);
 assert.equal(prevented,2);assert.equal(cleaned,1);assert.equal(finished,0);
 release();await pending;gate(event);assert.equal(finished,1);assert.equal(prevented,2);
});
test('cleanup failure keeps app alive and permits a clean retry',async()=>{
 let tries=0,failures=0,finished=0;
 const gate=shutdownGate(async()=>{if(++tries===1)throw Error('busy');},()=>finished++,()=>failures++);
 await gate({preventDefault(){}});assert.equal(finished,0);assert.equal(failures,1);
 await gate({preventDefault(){}});assert.equal(finished,1);
});
const fs=require('node:fs'),vm=require('node:vm');
function closingIpc(){const source=fs.readFileSync(require.resolve('../src/main.cjs'),'utf8');const begin=source.indexOf('function handle(name, fn) {'),end=source.indexOf('\nif (!app.requestSingleInstanceLock()',begin);assert.ok(begin>=0&&end>begin);const frame={url:'file:///companion/index.html'},handlers=new Map(),context={ipcMain:{handle:(name,fn)=>handlers.set(name,fn)},win:{webContents:{mainFrame:frame}},pageURL:frame.url,quitting:false,setupBusy:false};vm.createContext(context);vm.runInContext(source.slice(begin,end),context);return{context,handlers,event:{senderFrame:frame}};}
test('closing app rejects new settings actions instead of resurrecting closed services',async()=>{const{context,handlers,event}=closingIpc();let writes=0;context.handle('set-display-sleep',async()=>++writes);assert.equal(await handlers.get('set-display-sleep')(event,10),1);context.quitting=true;await assert.rejects(handlers.get('set-display-sleep')(event,15),/closing/i);assert.equal(writes,1);});
test('shutdown IPC guard still validates sender and preserves setup restrictions',async()=>{const{context,handlers,event}=closingIpc();let writes=0;context.handle('change-key',()=>++writes);await assert.rejects(handlers.get('change-key')({senderFrame:{url:'file:///other'}}),/Untrusted/);context.setupBusy=true;await assert.rejects(handlers.get('change-key')(event),/setup is in progress/);assert.equal(writes,0);});
