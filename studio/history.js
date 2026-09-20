(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./model.js'));
  else root.StudioHistory=factory(root.StudioModel);
})(typeof globalThis!=='undefined'?globalThis:this,function(Model){
  'use strict';
  const MAX_ENTRIES=60,MAX_BYTES=32*1024*1024;
  function limit(value,fallback,min,max,name){
    if(value===undefined)return fallback;
    if(!Number.isSafeInteger(value)||value<min||value>max)throw new RangeError('Invalid Skin Studio history '+name+'.');
    return value;
  }
  function snapshot(project,maxBytes){
    const text=JSON.stringify(Model.validate(project));
    if(text.length>maxBytes)throw new RangeError('This project is too large for undo history. Reduce embedded image sizes before applying this change.');
    const bytes=new TextEncoder().encode(text).length;
    if(bytes>maxBytes)throw new RangeError('This project is too large for undo history. Reduce embedded image sizes before applying this change.');
    return{text,bytes};
  }
  class History{
    constructor(initial,options={}){
      this._maxEntries=limit(options.maxEntries,MAX_ENTRIES,2,256,'entry limit');
      this._maxBytes=limit(options.maxBytes,MAX_BYTES,1,MAX_BYTES,'byte limit');
      this.reset(initial);
    }
    get current(){return JSON.parse(this._entries[this._index].text);}
    get canUndo(){return this._index>0;}
    get canRedo(){return this._index<this._entries.length-1;}
    commit(project){
      // Validate before touching either branch so rejected edits retain redo.
      const next=snapshot(project,this._maxBytes);
      if(next.text===this._entries[this._index].text)return this.current;
      const entries=this._entries.slice(0,this._index+1);entries.push(next);
      let bytes=entries.reduce((total,entry)=>total+entry.bytes,0);
      while(entries.length>this._maxEntries||bytes>this._maxBytes)bytes-=entries.shift().bytes;
      this._entries=entries;this._index=entries.length-1;
      return this.current;
    }
    undo(){if(this.canUndo)this._index--;return this.current;}
    redo(){if(this.canRedo)this._index++;return this.current;}
    reset(project){
      const next=snapshot(project,this._maxBytes);
      this._entries=[next];this._index=0;
      return this.current;
    }
  }
  return{History,MAX_ENTRIES,MAX_BYTES};
});
