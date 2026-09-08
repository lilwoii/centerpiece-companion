const monotonic = () => performance.now();
class Countdown {
 constructor(clock=monotonic){this.clock=clock;this.seconds=1500;this.remaining=1500;this.started=null;}
 view(){const remaining=Math.max(0,this.remaining-(this.started===null?0:(this.clock()-this.started)/1000));return{seconds:this.seconds,remaining:Math.ceil(remaining),running:this.started!==null&&remaining>0,finished:remaining===0};}
 command(action,minutes=25){
  if(action==='start'){if(!Number.isInteger(minutes)||minutes<1||minutes>180)throw Error('Choose a timer from 1 to 180 minutes.');this.seconds=minutes*60;this.remaining=this.seconds;this.started=this.clock();}
  else if(action==='toggle'){const state=this.view();if(state.running){this.remaining=Math.max(0,this.remaining-(this.clock()-this.started)/1000);this.started=null;}else{if(state.finished)this.remaining=this.seconds;this.started=this.clock();}}
  else if(action==='reset'){this.remaining=this.seconds;this.started=null;}
  else throw Error('Choose a timer control.');
  return this.view();
 }
}
module.exports={Countdown};
