const allowed=Object.freeze([0,10,15,30,45,60,120,240,360,480,720]);
function minutes(value){if(!Number.isInteger(value)||!allowed.includes(value))throw Error('Choose a listed display sleep timer.');return value;}
class DisplaySleep {
 constructor({setEnabled,now=Date.now,onError=()=>{}}){Object.assign(this,{setEnabled,now,onError});this.minutes=null;this.lastInput=now();this.asleep=false;this.pending=null;this.closed=false;}
 configure(value){this.minutes=minutes(value);this.closed=false;this.lastInput=this.now();return this.reconcile();}
 activity(){this.lastInput=this.now();if(this.asleep||this.pending)void this.reconcile().catch(this.onError);}
 wantsSleep(){return !this.closed&&this.minutes>0&&this.now()-this.lastInput>=this.minutes*60000;}
 async reconcile(){
  if(this.pending)return this.pending;
  let completed=false;
  this.pending=(async()=>{
   do{const wanted=this.wantsSleep();if(wanted===this.asleep)break;if((await this.setEnabled(!wanted))?.cancelled===true)continue;this.asleep=wanted;}while(true);
   completed=true;
  })().finally(()=>{
   this.pending=null;
   // Activity can arrive after the loop settles but before this promise clears.
   // Recheck successful work so that first input is never lost in that window.
   // Failed commands remain failures; do not create an automatic retry loop.
   if(completed&&this.wantsSleep()!==this.asleep)return this.reconcile();
  });
  return this.pending;
 }
 async close(){this.closed=true;await this.reconcile();}
}
module.exports={allowed,minutes,DisplaySleep};
