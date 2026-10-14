const {DisplaySleep,minutes}=require('./display-sleep.cjs');
const {Som}=require('./som.cjs');
class SleepService {
 constructor({run,onError,createSom=()=>new Som(),setEnabled=value=>require('./display-power.cjs').enabled(value)}){this.setEnabled=setEnabled;this.keepAwakeBusy=false;this.testing=false;this.run=run;this.onError=onError;this.createSom=createSom;this.original=null;this.identity=null;this.timer=null;this.controller=new DisplaySleep({setEnabled,onError});}
 async configure(value){
  minutes(value);
  // This firmware clamps the one-byte timeout to 1..99 minutes. Zero is NOT Never.
  if(value>99)throw Error('This keyboard firmware supports sleep timers up to 99 minutes for native idle sleep. Choose 10, 15, 30, 45 minutes or 1 hour. Your previous timer is unchanged.');
  clearInterval(this.timer);this.timer=null;const nativeValue=value===0?99:value;
  await this.run(async()=>{const s=this.createSom();try{const current=await s.screenTimeout();if(this.original===null){this.original=current;this.identity=s.identity;}if(this.identity!==s.identity)throw Error('Reconnect the original keyboard before changing its sleep timer.');await s.screenTimeout(nativeValue);const confirmed=await s.screenTimeout();if(confirmed!==nativeValue)throw Error(`The keyboard confirmed ${confirmed} minutes instead of ${value}. Your previous timer will be restored.`);}finally{s.close();}});
  // Native firmware handles idle sleep and wake, including the first key press.
  // The software controller is used only for the explicit Test sleep action.
  await this.controller.configure(value);if(value===0){await this.setEnabled(true);this.timer=setInterval(()=>{if(this.testing||this.keepAwakeBusy)return;this.keepAwakeBusy=true;this.run(()=>this.setEnabled(true)).catch(this.onError).finally(()=>{this.keepAwakeBusy=false;});},30000);this.timer.unref?.();}
 }
 async test(){this.testing=true;this.testMinutes=this.controller.minutes;this.controller.minutes=10;this.controller.lastInput=this.controller.now()-600000;try{await this.controller.reconcile();}catch(e){this.testing=false;this.controller.minutes=this.testMinutes;throw e;}}
 activity(){this.controller.activity();if(this.testing){this.testing=false;this.controller.minutes=this.testMinutes;}}
 async close(){clearInterval(this.timer);this.timer=null;await this.controller.close();if(this.original===null)return;await this.run(async()=>{const s=this.createSom();try{if(s.identity===this.identity)await s.screenTimeout(this.original);}finally{s.close();}});this.original=null;}
}
module.exports={SleepService};
