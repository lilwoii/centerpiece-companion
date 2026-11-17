const {DisplaySleep,minutes}=require('./display-sleep.cjs');
const {Som}=require('./som.cjs');
const displayPower=require('./display-power.cjs');
class SleepService {
 constructor({run,onError,createSom=()=>new Som(),setEnabled=displayPower.enabled,getPowerIdentity=setEnabled===displayPower.enabled?displayPower.identity:null,setPaused=()=>{},getIdleSeconds,now=Date.now,every=setInterval,cancel=clearInterval}){this.setEnabled=setEnabled;this.getPowerIdentity=getPowerIdentity;this.powerIdentity=null;this.keepAwakeBusy=false;this.testing=false;this.run=run;this.onError=onError;this.createSom=createSom;this.original=null;this.identity=null;this.timer=null;this.every=every;this.cancel=cancel;this.getIdleSeconds=getIdleSeconds;this.activityCheck=null;this.activityEpoch=0;this.configurations=new Set();this.inputFallbackError=null;this.controller=new DisplaySleep({now,onError,setEnabled:async value=>{
   if(!value)setPaused(true);
   try{
    const applied=await this.run(async()=>{
     // New input can arrive while sleep waits behind a display transfer.
     // Cancel before sending power-off, rather than briefly blanking then waking.
     if(!value&&!this.controller.wantsSleep())return {cancelled:true};
     await this.sendPower(value);return {cancelled:false};
    });
    if(value||applied?.cancelled)setPaused(false);
    return applied;
   }catch(error){if(!value)setPaused(false);throw error;}
  }});}
 async sendPower(value){if(this.getPowerIdentity&&(typeof this.powerIdentity!=='string'||!this.powerIdentity.trim()))throw Error('Keyboard identity is unavailable. Reconnect the original keyboard before changing display power.');return this.setEnabled(value,this.powerIdentity);}
 async configure(value){
  if(this.testOperation)throw Error('Test sleep is still changing display power. Wait for it to finish before changing the timer.');
  if(this.closeOperation)throw Error('Display sleep is closing. Wait for restoration to finish before changing its timer.');
  minutes(value);
  // This firmware clamps the one-byte timeout to 1..99 minutes. Zero is NOT Never.
  if(value>99)throw Error('This keyboard firmware supports sleep timers up to 99 minutes for native idle sleep. Choose 10, 15, 30, 45 minutes or 1 hour. Your previous timer is unchanged.');
  // Overlapping changes share the last working baseline. A later failure must
  // not keep an intermediate native value or lose the timer canceled by its predecessor.
  const baseline=this.configurationBaseline||{runtime:this.timer!==null?{minutes:this.testing?this.testMinutes:this.controller.minutes,lastInput:this.controller.lastInput}:null,native:null,writeAttempted:false};
  this.configurationBaseline=baseline;const previous=baseline.runtime,epoch=++this.activityEpoch;this.cancel(this.timer);this.timer=null;
  const pending=this.configureCurrent(value,epoch,baseline);this.configurations.add(pending);
  try{await pending;}catch(error){if(epoch===this.activityEpoch&&previous!==null){this.controller.minutes=previous.minutes;this.controller.lastInput=Math.max(previous.lastInput,this.controller.lastInput);this.armTimer(previous.minutes);}throw error;}finally{this.configurations.delete(pending);if(!this.configurations.size&&this.configurationBaseline===baseline)this.configurationBaseline=null;}
 }
 async configureCurrent(value,epoch,baseline){
  const nativeValue=value===0?99:value;
  try{await this.run(async()=>{const powerIdentity=this.getPowerIdentity?await this.getPowerIdentity():null;if(this.powerIdentity!==null&&powerIdentity!==this.powerIdentity)throw Error('Reconnect the original keyboard before changing its sleep timer.');const s=this.createSom();try{const current=await s.screenTimeout();if(this.getPowerIdentity&&await this.getPowerIdentity()!==powerIdentity)throw Error('Keyboard changed while checking its sleep timer. Reconnect the original keyboard and retry.');if(this.getPowerIdentity){const observed=this.createSom();try{if(observed.identity!==s.identity)throw Error('Display changed while checking its sleep timer. Reconnect the original keyboard and retry.');}finally{observed.close();}}if(this.original===null){this.original=current;this.identity=s.identity;this.powerIdentity=powerIdentity;}if(this.identity!==s.identity)throw Error('Reconnect the original keyboard before changing its sleep timer.');if(!baseline.native)baseline.native={value:current,identity:s.identity};baseline.writeAttempted=true;await s.screenTimeout(nativeValue);const confirmed=await s.screenTimeout();if(confirmed!==nativeValue)throw Error(`The keyboard confirmed ${confirmed} minutes instead of ${value}. Your previous timer will be restored.`);}finally{s.close();}});
  // Overlay traffic can keep the native idle timer alive. Enforce keyboard
  // inactivity independently and pause overlay writes before powering down.
  this.assertConfigurationCurrent(epoch);this.testing=false;await this.controller.configure(value);this.assertConfigurationCurrent(epoch);if(value===0){await this.run(()=>this.sendPower(true));this.assertConfigurationCurrent(epoch);}this.armTimer(value);
  }catch(error){
   // A failed readback or power-on must not leave the native timer at the
   // attempted value while the app continues enforcing its previous setting.
   // Superseded operations leave restoration to the newest change or close().
   if(baseline.writeAttempted&&baseline.native&&epoch===this.activityEpoch){try{await this.run(async()=>{if(epoch!==this.activityEpoch)return;const s=this.createSom();try{if(s.identity!==baseline.native.identity)throw Error('The original keyboard disconnected before its sleep timer could be restored.');await s.screenTimeout(baseline.native.value);if(await s.screenTimeout()!==baseline.native.value)throw Error('The keyboard did not confirm the restored sleep timer.');}finally{s.close();}});}catch(restoreError){error.message+=' Previous native sleep timer could not be restored: '+restoreError.message;}}
   // Preserve cancellation semantics even when the retired native request failed.
   this.assertConfigurationCurrent(epoch);throw error;
  }
 }
 assertConfigurationCurrent(epoch){if(epoch!==this.activityEpoch){const error=Error('Display sleep change was superseded or cancelled.');error.code='SLEEP_CONFIGURATION_CANCELLED';throw error;}}
 armTimer(value){this.timer=value===0?this.every(()=>{
   if(this.testing||this.controller.closed||this.controller.minutes!==0||this.keepAwakeBusy)return;
   const epoch=this.activityEpoch;this.keepAwakeBusy=true;
   this.run(()=>{if(epoch!==this.activityEpoch||this.testing||this.controller.closed||this.controller.minutes!==0)return;return this.sendPower(true);}).catch(this.onError).finally(()=>{this.keepAwakeBusy=false;});
  },30000):this.every(()=>{void this.reconcile().catch(this.onError);},1000);this.timer.unref?.();
 }
 reconcile(){
  if(this.testOperation)return this.testOperation;
  const c=this.controller,now=c.now();
  // A game's input path can bypass the Windows key hook. Ask Windows for its
  // session idle time only before sleeping, or while waiting to wake; ordinary
  // activity needs no additional process requests or USB polling.
  if(!this.getIdleSeconds||this.testing||c.closed||!(c.minutes>0)||(!c.asleep&&now-c.lastInput<c.minutes*60000))return c.reconcile();
  if(this.activityCheck)return this.activityCheck;
  const epoch=this.activityEpoch;
  this.activityCheck=(async()=>{try{const idle=await this.getIdleSeconds();if(epoch!==this.activityEpoch||this.testing||c.closed)return;if(typeof idle==='number'&&Number.isFinite(idle)&&idle>=0){c.lastInput=Math.max(c.lastInput,now-idle*1000);this.inputFallbackError=null;}else this.inputFallbackError='Windows idle state was unavailable.';}catch(error){this.inputFallbackError=String(error?.message||'Windows idle state was unavailable.').slice(0,160);}if(epoch===this.activityEpoch&&!this.testing&&!c.closed)await c.reconcile();})().finally(()=>{this.activityCheck=null;});
  return this.activityCheck;
 }
 async test(){
  if(this.configurations.size)throw Error('Display sleep configuration is changing. Wait for it to finish before Test sleep.');
  if(this.closeOperation)throw Error('Display sleep is closing. Retry Test sleep afterward.');
  if(this.testOperation)return this.testOperation;
  if(this.testing)return this.controller.reconcile();
  const epoch=++this.activityEpoch;this.testing=true;this.testMinutes=this.controller.minutes;this.testClosed=this.controller.closed;this.controller.closed=false;this.controller.minutes=10;this.controller.lastInput=this.controller.now()-600000;
  const operation=(async()=>{try{
   if(this.powerIdentity===null&&this.getPowerIdentity)await this.run(async()=>{const identity=await this.getPowerIdentity();this.assertConfigurationCurrent(epoch);this.powerIdentity=identity;});
   await this.controller.reconcile();
  }catch(e){if(epoch===this.activityEpoch){this.testing=false;this.controller.minutes=this.testMinutes;this.controller.closed=this.testClosed;}throw e;}})();
  this.testOperation=operation;
  try{return await operation;}finally{if(this.testOperation===operation)this.testOperation=null;}
 }
 activity(){this.controller.activity();if(this.testing){this.testing=false;this.controller.minutes=this.testMinutes;this.controller.closed=this.testClosed;}}
 status(){return{minutes:this.controller.minutes,asleep:this.controller.asleep,idleSeconds:Math.max(0,Math.floor((this.controller.now()-this.controller.lastInput)/1000)),timerActive:this.timer!==null,testing:this.testing,inputFallbackError:this.inputFallbackError};}
 async close(){
  if(this.closeOperation)return this.closeOperation;
  this.activityEpoch++;this.cancel(this.timer);this.timer=null;if(this.testing){this.testing=false;this.controller.minutes=this.testMinutes;}
  const operation=(async()=>{
   await Promise.allSettled([...this.configurations]);await this.controller.close();
   if(this.original===null){this.powerIdentity=null;return;}
   const original=this.original,identity=this.identity;
   await this.run(async()=>{const s=this.createSom();try{if(s.identity!==identity)throw Error('Reconnect the original display and retry closing Companion to restore its sleep timer.');await s.screenTimeout(original);if(await s.screenTimeout()!==original)throw Error('The keyboard did not confirm its original sleep timer. Retry closing Companion to restore it.');}finally{s.close();}});
   this.original=null;this.powerIdentity=null;
  })();
  this.closeOperation=operation;
  try{return await operation;}finally{if(this.closeOperation===operation)this.closeOperation=null;}
 }
}
module.exports={SleepService};
