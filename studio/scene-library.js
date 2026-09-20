(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./model.js'):root.StudioModel);if(typeof module==='object'&&module.exports)module.exports=api;else root.StudioScenes=api;})(typeof globalThis!=='undefined'?globalThis:this,function(M){
 const KEY='centerpiece-studio-scenes-v1';
 function validate(value){if(!value||!Number.isInteger(value.count)||value.count<1||value.count>5||!Array.isArray(value.slots)||value.slots.length!==5)throw Error('The saved scene library is invalid. Existing data was kept.');return{count:value.count,defaultScene:M.validate(value.defaultScene),slots:value.slots.map(v=>v===null?null:M.validate(v))};}
 function load(storage,initial){const raw=storage.getItem(KEY);if(raw!==null)return validate(JSON.parse(raw));const result={count:5,defaultScene:M.clone(initial),slots:[null,null,null,null,null]};save(storage,result);return result;}
 function save(storage,value){const safe=validate(value),raw=JSON.stringify(safe);if(raw.length>4*1024*1024)throw Error('Saved scenes exceed 4 MB. Export image-heavy projects as files instead.');storage.setItem(KEY,raw);return safe;}
 // Call under the shared Web Lock when multiple editor windows are available.
 // Read and merge at save time so another window's different project spaces survive.
 function updateSlot(storage,initial,index,project,expectedSlot){
  if(!Number.isInteger(index)||index<0||index>=5)throw Error('Choose a Companion project space from 1 to 5.');
  const incoming=M.validate(project),expected=expectedSlot===null?null:M.validate(expectedSlot);
  const current=load(storage,initial);
  if(JSON.stringify(current.slots[index])!==JSON.stringify(expected)){
   const error=Error('Project '+(index+1)+' changed in another window. Your current design was kept. Refresh saved projects before replacing that space.');
   error.code='STUDIO_SCENE_CONFLICT';throw error;
  }
  current.slots[index]=incoming;
  return save(storage,current);
 }
 return{load,save,updateSlot,validate,KEY};
});
