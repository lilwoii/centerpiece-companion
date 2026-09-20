'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{Worker}=require('node:worker_threads');
const MODEL_URL='https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net.onnx';
const MODEL_SHA='8d10d2f3bb75ae3b6d527c77944fc5e7dcd94b29809d47a739a7a728a912b491';
class PhotoAnimator{
 constructor(directory){this.folder=path.join(directory,'photo-tools');this.job=null;this.worker=null;this.abort=null;}
 status(){if(!this.job)return{state:'idle'};return{...this.job};}
 start(input){
  require('../studio/model.js').rasterInfo(input?.image);
  if(!input?.image)throw Error('Choose a photo first.');
  if(this.job?.state==='working')throw Error('A photo is already processing. Wait or cancel it first.');
  const id=crypto.randomUUID();this.job={id,state:'working',phase:'Checking local photo tools…'};
  this.abort=new AbortController();void this.run(id,input.image,this.abort.signal);return this.status();
 }
 cancel(){if(this.job?.state==='working'){this.job={id:this.job.id,state:'cancelled',phase:'Photo processing cancelled.'};this.abort?.abort();void this.worker?.terminate();this.worker=null;}return this.status();}
 async model(signal){
  fs.mkdirSync(this.folder,{recursive:true});const file=path.join(this.folder,'u2net.onnx');
  if(fs.existsSync(file)&&fs.statSync(file).size===175997641){const hash=crypto.createHash('sha256');for await(const chunk of fs.createReadStream(file,{signal}))hash.update(chunk);if(hash.digest('hex')===MODEL_SHA)return file;}
  this.job.phase='Downloading local photo tools · 168 MB, once per PC…';
  const response=await fetch(MODEL_URL,{signal:AbortSignal.any([signal,AbortSignal.timeout(300000)])});
  if(!response.ok||!['github.com','release-assets.githubusercontent.com','objects.githubusercontent.com'].includes(new URL(response.url).hostname))throw Error('Photo tools could not download. Check your connection and try again.');
  const temp=file+'.'+crypto.randomUUID()+'.partial',hash=crypto.createHash('sha256');let total=0;const fd=fs.openSync(temp,'wx');
  try{for await(const chunk of response.body){total+=chunk.length;if(total>175997641)throw Error('Photo tools failed the size check.');hash.update(chunk);fs.writeSync(fd,chunk);}if(total!==175997641||hash.digest('hex')!==MODEL_SHA)throw Error('Photo tools failed verification. Please retry.');}
  catch(error){fs.closeSync(fd);fs.rmSync(temp,{force:true});throw error;}
  fs.closeSync(fd);fs.renameSync(temp,file);return file;
 }
 async run(id,image,signal){
  try{
   const model=await this.model(signal);if(signal.aborted)return;
   this.job.phase='Preparing your photo…';
   await new Promise((resolve,reject)=>{
    const worker=this.worker=new Worker(path.join(__dirname,'studio-photo-worker.cjs'),{workerData:{image,model}});
    const timeout=setTimeout(()=>{void worker.terminate();reject(Error('Photo processing took too long. Try a smaller photo.'));},90000);
    worker.on('message',message=>{if(this.job.id!==id||this.job.state!=='working')return;if(message.phase)this.job.phase=message.phase;if(message.error)reject(Error(message.error));if(message.result){this.job={id,state:'ready',phase:'Subject ready. Review the edges before adding it.',result:message.result};resolve();}});
    worker.once('error',reject);worker.once('exit',()=>{clearTimeout(timeout);if(this.job.id===id&&this.job.state==='working')reject(Error('Photo processing stopped. Try again.'));else resolve();});
   });
  }catch(error){if(this.job?.id===id&&this.job.state==='working')this.job={id,state:'failed',phase:error.message};}
  finally{if(this.job?.id===id){void this.worker?.terminate();this.worker=null;}}
 }
}
module.exports={PhotoAnimator,MODEL_URL,MODEL_SHA};
