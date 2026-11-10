// Cross Electron's bridge once; preserve each UI consumer's private state copy.
(function(root,factory){
 'use strict';
 if(typeof module==='object'&&module.exports)module.exports=factory;
 else if(root.companionNative){
  const shared=factory(root.companionNative,error=>root.reportError(error));
  Object.defineProperty(root,'companion',{value:shared.api,enumerable:true});
  root.addEventListener('beforeunload',shared.close,{once:true});
 }
})(typeof window!=='undefined'?window:globalThis,function(native,reportError){
 'use strict';
 const listeners=new Set();let disconnect=null,pending=null,closed=false;
 function copyState(value,seen=new Map()){
  if(value===null||typeof value!=='object')return value;
  if(seen.has(value))return seen.get(value);
  const proto=Object.getPrototypeOf(value);
  // State is JSON-shaped. Copy its mutable containers, while immutable artwork
  // strings stay shared by the JS engine. Preserve unusual values defensively.
  if(!Array.isArray(value)&&proto!==Object.prototype&&proto!==null){const result=structuredClone(value);seen.set(value,result);return result;}
  const result=Array.isArray(value)?value.slice():{...value};seen.set(value,result);
  for(const key of Object.keys(value))result[key]=copyState(value[key],seen);
  return result;
 }
 function subscribe(callback){
  if(typeof callback!=='function')throw new TypeError('A state callback is required.');
  if(closed)return()=>{};
  const entry={callback};listeners.add(entry);
  if(!disconnect)disconnect=native.subscribe(state=>{
   // No queue or history; a consumer's local edits cannot leak to another one.
   for(const item of [...listeners])if(listeners.has(item))try{item.callback(copyState(state));}catch(error){reportError(error);}
  });
  return()=>{listeners.delete(entry);if(!listeners.size&&disconnect){const stop=disconnect;disconnect=null;stop();}};
 }
 function getState(){
  // Initial UI modules request state together. Later explicit reads stay fresh.
  if(!pending){pending=Promise.resolve().then(()=>native.getState());const active=pending;void active.then(()=>{if(pending===active)pending=null;},()=>{if(pending===active)pending=null;});}
  return pending.then(state=>copyState(state));
 }
 function close(){closed=true;listeners.clear();if(disconnect){const stop=disconnect;disconnect=null;stop();}pending=null;}
 return{api:Object.freeze({...native,subscribe,getState}),close};
});
