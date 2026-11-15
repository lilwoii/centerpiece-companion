// Setup runs only for an explicit MusicBee assignment, never as a polling side effect.
class MusicBeeSetupFlow{
 constructor({probe,install,onChange}){this.probe=probe;this.install=install;this.onChange=onChange;this.pending=null;this.state={status:'idle',message:''};}
 set(status,message){this.state={status,message};this.onChange(this.state);return this.state;}
 connected(){return this.set('connected','MusicBee connected.');}
 ensure(){if(this.pending)return this.pending;this.pending=this.run().finally(()=>{this.pending=null;});return this.pending;}
 async run(){this.set('checking','Checking MusicBee connection…');try{const media=await this.probe();if(media.available)return this.connected();this.set('installing','Setting up MusicBee automatically…');const result=await this.install();return this.set('restart',result.message);}catch(error){return this.set('error','MusicBee setup: '+error.message);}}
}
module.exports={MusicBeeSetupFlow};
