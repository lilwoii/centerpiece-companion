// Only transport failures before a settings write may retry automatically.
function retryable(error){if(error?.configurationVerified&&error.code==='KEYBOARD_DISPLAY_INITIALIZATION_FAILED')return true;return !error?.writesAttempted&&/^(STUDIO_(DEVICE_UNAVAILABLE|NOT_CONNECTED|TIMEOUT|REQUEST_TIMEOUT|DISCOVERY_FAILED|OPEN_FAILED|IO_ERROR)|CONNECTION_UNAVAILABLE)$/.test(error?.code||'');}
class ConnectionRecovery{
 constructor(){this.running=false;this.next=0;this.failures=0;this.blocked=false;this.recent=[];}
 reset(){this.blocked=false;this.failures=0;this.next=0;if(!this.running)this.recent=[];}
 status(now=Date.now()){return{blocked:this.blocked,running:this.running,attemptsInLastMinute:this.recent.filter(t=>t>now-60000).length,nextRetrySeconds:Math.max(0,Math.ceil((this.next-now)/1000))};}
 async run({eligible,recover,now}){const clock=now===undefined?()=>Date.now():()=>now;const started=clock();if(!eligible||this.running||this.blocked||started<this.next)return false;this.recent=this.recent.filter(t=>t>started-60000);if(this.recent.length>=2){this.next=this.recent[0]+60000;return false;}this.recent.push(started);this.running=true;try{await recover();this.failures=0;this.next=clock()+10000;return true;}catch(error){this.failures++;this.next=clock()+Math.min(60000,10000*2**Math.min(3,this.failures-1));if(!retryable(error))this.blocked=true;throw error;}finally{this.running=false;}}
}
class BindingCheckHealth{
 constructor(){this.failures=0;}
 success(){this.failures=0;}
 defer(error,{monitorConnected,displayConnected,displayError}){
  if(!monitorConnected||!displayConnected||displayError||!retryable(error)||error?.configurationVerified){this.failures=0;return false;}
  return ++this.failures<=2;
 }
}
module.exports={ConnectionRecovery,retryable,BindingCheckHealth};
