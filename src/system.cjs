const {spawn}=require('node:child_process'),readline=require('node:readline'),path=require('node:path'),{EventEmitter}=require('node:events');
class SystemBridge extends EventEmitter{
 constructor(){super();this.seq=0;this.pending=new Map();this.proc=null;}
 request(action,codes){
  if(!this.proc){const p=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'system.ps1')],{windowsHide:true,stdio:['pipe','pipe','pipe']});this.proc=p;
   readline.createInterface({input:p.stdout}).on('line',line=>{try{const r=JSON.parse(line);if(r.event==='locks'){this.emit('locks',{caps:!!r.caps});return;}const wait=this.pending.get(r.id);if(wait){clearTimeout(wait.timer);this.pending.delete(r.id);r.ok?wait.resolve(r.result):wait.reject(Error(r.error));}}catch{}});
   p.stderr.resume();p.stdin.on('error',()=>this.close());p.on('error',()=>this.close());p.on('exit',()=>{if(this.proc===p)this.close();});
  }
  return new Promise((resolve,reject)=>{const id=++this.seq;this.pending.set(id,{resolve,reject,timer:setTimeout(()=>{this.pending.delete(id);reject(Error('Windows input did not respond.'));},action==='windows-location'?16000:5000)});this.proc.stdin.write(JSON.stringify({id,action,codes})+'\n');});
 }
 close(){const p=this.proc;this.proc=null;p?.kill();for(const w of this.pending.values()){clearTimeout(w.timer);w.reject(Error('Input helper closed'));}this.pending.clear();}
}
module.exports={SystemBridge};
