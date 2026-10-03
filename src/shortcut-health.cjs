// Keep only classifications, never key presses, raw mappings or identifiers.
class ShortcutHealth{
 constructor(){this.events=[];this.last='';}
 record(kind,{shortcuts,monitorConnected,displayConnected}={}){
  const value={kind,monitorConnected:!!monitorConnected,displayConnected:!!displayConnected};
  if(shortcuts)value.shortcuts=Object.fromEntries(['l1','plugin','widget'].map(key=>[key,shortcuts[key]]));
  const fingerprint=JSON.stringify(value);if(fingerprint===this.last)return;
  this.last=fingerprint;this.events.push({at:new Date().toISOString(),...value});
  if(this.events.length>20)this.events.shift();
 }
 view(){return structuredClone(this.events);}
}
module.exports={ShortcutHealth};
