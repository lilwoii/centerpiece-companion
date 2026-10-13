(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SlotAutosave=api;})(typeof window==='object'?window:globalThis,()=>{
 'use strict';
 function canAutosave(catalog,plugin,action){
  const entry=catalog?.find(p=>p.id===plugin);
  return !!entry?.actions.some(a=>a.id===action)&&plugin!=='decoration'&&!['hotkey','url','app','scene'].includes(action)&&(action!=='mute'||plugin==='mic');
 }
 // One writer; replace queued choices for the same position, retaining other positions.
 // A choice configures a tile only. It never invokes its playback/launch action.
 function create({save,onPending=()=>{},onSaved=()=>{},onError=()=>{}}){
  const pending=new Map(),latest=new Map();let active=false,revision=0,generation=0,idle=[];
  async function drain(){
   if(active)return;active=true;
   try{while(pending.size){
    const [index,request]=pending.entries().next().value;pending.delete(index);
    try{
     const result=await save({index,slot:request.slot});
     if(request.generation===generation&&latest.get(index)===request.revision)onSaved(index,request.slot,result);
     request.resolve(result);
    }catch(error){
     if(request.generation===generation&&latest.get(index)===request.revision)onError(index,error);
     request.resolve({error});
    }
   }}finally{active=false;const callbacks=idle;idle=[];callbacks.forEach(resolve=>resolve());}
  }
  return {
   enqueue(index,slot){
    if(!Number.isInteger(index)||index<0||index>3)throw Error('Choose a keyboard position.');
    const snapshot=structuredClone(slot),number=++revision;latest.set(index,number);
    pending.get(index)?.resolve({superseded:true});
    const result=new Promise(resolve=>pending.set(index,{slot:snapshot,revision:number,generation,resolve}));
    onPending(index,snapshot);void drain();return result;
   },
   invalidate(){generation++;for(const item of pending.values())item.resolve({superseded:true});pending.clear();latest.clear();},
   whenIdle(){return active?new Promise(resolve=>idle.push(resolve)):Promise.resolve();}
  };
 }
 return {canAutosave,create};
});
