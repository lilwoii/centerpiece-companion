class DisplayTasks {
 constructor(cache){this.cache=cache;this.pending=0;this.tail=Promise.resolve();}
 get paused(){return this.pending>0;}
 run(task){this.pending++;const result=this.tail.then(async()=>{const deadline=Date.now()+25000;while(this.cache.updating||this.cache.watching){if(Date.now()>deadline)throw Error('Keyboard display did not finish its current transfer. Reconnect and retry.');await new Promise(resolve=>setTimeout(resolve,15));}return task();});this.tail=result.catch(()=>{});return result.finally(()=>{this.pending--;});}
}
module.exports={DisplayTasks};
