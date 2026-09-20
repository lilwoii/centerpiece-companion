(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./model.js'));
  else root.StudioStorage=factory(root.StudioModel);
})(typeof globalThis!=='undefined'?globalThis:this,function(Model){
  'use strict';
  const DEFAULT_KEY='centerpiece-skin-studio-draft',MAX_BYTES=32*1024*1024;
  class DraftError extends Error{
    constructor(code,message){super(message);this.name='StudioDraftError';this.code=code;}
  }
  function keyName(key){
    if(typeof key!=='string'||!key.length||key.length>128||/[\x00-\x1f\x7f]/.test(key))throw new DraftError('STUDIO_DRAFT_KEY','Choose a valid local draft name.');
    return key;
  }
  function checkSize(text){
    if(text.length>MAX_BYTES||new TextEncoder().encode(text).length>MAX_BYTES)throw new DraftError('STUDIO_DRAFT_TOO_LARGE','This project is too large for local autosave. Reduce embedded image sizes. Your previous draft was kept.');
  }
  function reason(error){return typeof error?.message==='string'?' '+error.message.replace(/[\r\n]+/g,' ').slice(0,200):'';}
  function load(storage,key=DEFAULT_KEY){
    key=keyName(key);let text;
    try{text=storage.getItem(key);}catch{throw new DraftError('STUDIO_DRAFT_UNAVAILABLE','Local autosave could not be read. Open a saved project file, or continue with a new project. No saved draft was removed.');}
    if(text===null)return null;
    if(typeof text!=='string')throw new DraftError('STUDIO_DRAFT_INVALID','The saved draft is not a valid project. Open a saved project file to recover your work. The draft was kept.');
    checkSize(text);
    let project;
    try{project=JSON.parse(text);}catch{throw new DraftError('STUDIO_DRAFT_INVALID','The saved draft contains invalid project data. Open a saved project file to recover your work. The draft was kept.');}
    try{return Model.validate(project);}catch(error){throw new DraftError('STUDIO_DRAFT_INVALID','The saved draft could not be opened.'+reason(error)+' Open a saved project file to recover your work. The draft was kept.');}
  }
  function save(storage,project,key=DEFAULT_KEY){
    key=keyName(key);let normalized,text;
    try{normalized=Model.validate(project);text=JSON.stringify(normalized);}catch(error){throw new DraftError('STUDIO_DRAFT_INVALID_PROJECT','This project could not be saved.'+reason(error)+' Your previous draft was kept.');}
    checkSize(text);
    try{
      // Web Storage replaces one value atomically. A temporary key would need
      // double quota and could destroy a recoverable draft during cleanup.
      storage.setItem(key,text);
    }catch(error){
      const quota=error?.name==='QuotaExceededError'||error?.code===22||error?.code===1014;
      throw new DraftError(quota?'STUDIO_DRAFT_QUOTA':'STUDIO_DRAFT_UNAVAILABLE',quota?'Local autosave is full. Use Save project to keep a file copy, then reduce image sizes or layers. Your previous draft was kept.':'Local autosave is unavailable. Use Save project to keep a file copy. No saved draft was removed.');
    }
    return normalized;
  }
  return{load,save,DraftError,DEFAULT_KEY,MAX_BYTES};
});
