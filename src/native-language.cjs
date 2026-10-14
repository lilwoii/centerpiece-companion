// Native IDs from XPANEL's Legends page. Never substitute a nearby language.
const nativeIds=Object.freeze({qwerty:0,'00000409':0,'00000813':1,'00000407':2,'00000419':3,'00000411':4});
function nativeId(language){return nativeIds[language.resolvedId||language.id];}
async function apply(language,{run,createSom}){
 const value=nativeId(language);
 if(value===undefined)return {applied:false,reason:'This firmware has no native legend set for this Windows layout. Preview only; keyboard labels are unchanged.'};
 return run(async()=>{const s=createSom();let previous,changed=false;try{previous=await s.language();if(previous!==value){changed=true;await s.language(value);}const confirmed=await s.language();if(confirmed!==value)throw Error('The keyboard did not confirm the selected legend language.');return{applied:true,value};}catch(error){if(changed&&Number.isInteger(previous))try{await s.language(previous);}catch{throw Error(error.message+' The previous legend language could not be restored. Reconnect and retry.');}throw error;}finally{s.close();}});
}
module.exports={nativeId,apply};
