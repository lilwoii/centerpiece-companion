const {spawn}=require('node:child_process'),readline=require('node:readline'),path=require('node:path'),{EventEmitter}=require('node:events');
class SystemBridge extends EventEmitter{
 constructor(){super();this.seq=0;this.pending=new Map();this.proc=null;this.reader=null;this.active=null;}
 request(action,codes){
  if(this.pending.size>=16)return Promise.reject(Error('Windows input helper is busy. Try again.'));
  if(!this.proc){
   let p;try{p=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'system.ps1')],{windowsHide:true,stdio:['pipe','pipe','pipe']});}catch(error){return Promise.reject(error);}this.proc=p;
   this.reader=readline.createInterface({input:p.stdout});this.reader.on('line',line=>{if(this.proc!==p)return;let r;try{r=JSON.parse(line);}catch{return;}if(r.event==='music-toggle'){this.emit('music-toggle');return;}if(r.event==='activity'){this.emit('activity');return;}if(r.event==='locks'){this.emit('locks',{caps:!!r.caps,shift:!!r.shift});return;}const wait=this.pending.get(r.id);if(wait&&this.active===r.id){clearTimeout(wait.timer);this.pending.delete(r.id);this.active=null;r.ok?wait.resolve(r.result):wait.reject(Error(r.error));this.pump();}});
   const ended=()=>{if(this.proc===p)this.close();};p.stderr.resume();p.stdin.on('error',ended);p.on('error',ended);p.on('exit',ended);
  }
  return new Promise((resolve,reject)=>{const id=++this.seq;this.pending.set(id,{id,action,codes,resolve,reject,timer:null});this.pump();});
 }
 pump(){
  if(!this.proc||this.active!==null||!this.pending.size)return;
  // PowerShell executes serially. Start a deadline only when a command is sent,
  // so a location query cannot expire a shortcut that has not executed yet.
  const p=this.proc,w=this.pending.values().next().value;this.active=w.id;
  w.timer=setTimeout(()=>{if(this.proc===p&&this.active===w.id)this.close(Error('Windows input did not respond. Pending commands were cancelled; try again.'));},w.action==='windows-location'?16000:5000);
  try{p.stdin.write(JSON.stringify({id:w.id,action:w.action,codes:w.codes})+'\n');}catch(error){if(this.proc===p)this.close(error);}
 }
 close(error=Error('Input helper closed')){const p=this.proc;this.proc=null;this.active=null;this.reader?.close();this.reader=null;for(const w of this.pending.values()){clearTimeout(w.timer);w.reject(error);}this.pending.clear();p?.kill();}
}
module.exports={SystemBridge};
