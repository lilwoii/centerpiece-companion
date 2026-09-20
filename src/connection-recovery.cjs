// Only transport failures before a settings write may retry automatically.
function retryable(error){if(error?.configurationVerified&&error.code==='KEYBOARD_DISPLAY_INITIALIZATION_FAILED')return true;return !error?.writesAttempted&&/^(STUDIO_(DEVICE_UNAVAILABLE|NOT_CONNECTED|TIMEOUT|REQUEST_TIMEOUT|DISCOVERY_FAILED|OPEN_FAILED|IO_ERROR)|CONNECTION_UNAVAILABLE)$/.test(error?.code||'');}
class ConnectionRecovery{
 constructor(){this.running=false;this.next=0;this.failures=0;this.blocked=false;}
 async run({eligible,recover,now=Date.now()}){if(!eligible||this.running||this.blocked||now<this.next)return false;this.running=true;try{await recover();this.failures=0;this.next=now+10000;return true;}catch(error){this.failures++;this.next=now+Math.min(60000,10000*2**Math.min(3,this.failures-1));if(!retryable(error))this.blocked=true;throw error;}finally{this.running=false;}}
}
module.exports={ConnectionRecovery,retryable};
