(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.StudioProjectLoader=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  // Use one coordinator for every action that can replace or append to the draft.
  // getSnapshot must return a primitive revision (or serialized draft), not a mutable object.
  // create/prepare may await I/O. commit is synchronous so its final guard stays atomic.
  class Coordinator{
    constructor(getSnapshot=()=>0){
      if(typeof getSnapshot!=='function')throw TypeError('A project snapshot reader is required.');
      this.getSnapshot=getSnapshot;
      this.latest=null;
    }
    begin(){
      const token=Object.freeze({snapshot:this.getSnapshot()});
      this.latest=token;
      return token;
    }
    status(token){
      if(!token||token!==this.latest)return 'superseded';
      return Object.is(token.snapshot,this.getSnapshot())?'current':'edited';
    }
    current(token){return this.status(token)==='current';}
    cancel(){this.latest=null;}
    async load(create,prepare,commit){
      if(typeof create!=='function'||typeof prepare!=='function'||typeof commit!=='function')throw TypeError('Project loading needs create, prepare and commit actions.');
      const token=this.begin();
      let project;
      try{
        project=await create();
        const afterCreate=this.status(token);
        if(afterCreate!=='current')return {status:afterCreate};
        await prepare(project);
      }catch(error){
        const state=this.status(token);
        if(state!=='current')return {status:state};
        throw error;
      }
      const state=this.status(token);
      if(state!=='current')return {status:state};
      // A commit error is never treated as a cancelled load, even if commit changed the revision.
      commit(project);
      return {status:'loaded'};
    }
  }
  return {Coordinator};
});
