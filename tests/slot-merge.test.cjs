const test=require('node:test'),assert=require('node:assert/strict');
const {Workspace,defaults}=require('../src/workspace.cjs');
function workspace(){const w=Object.create(Workspace.prototype);w.config=w.validate(defaults());w.save=function(c){this.config=this.validate(c);return this.config;};return w;}
test('targeted slot saves merge current config and retain changes to other slots and widgets',()=>{
 const w=workspace();w.config.widget={...w.config.widget,type:'youtube'};
 w.config.youtubeMusicSource='';w.config.appearance.stripBackground='#123456';
 w.saveSlot({index:0,slot:{plugin:'youtubemusic',action:'toggle',value:''}});
 w.saveSlot({index:1,slot:{plugin:'youtube',action:'open',value:''}});
 assert.equal(w.config.slots[0].plugin,'youtubemusic');assert.equal(w.config.slots[1].plugin,'youtube');
 assert.equal(w.config.widget.type,'youtube');assert.equal(w.config.appearance.stripBackground,'#123456');
 w.saveSlot({index:0,slot:{plugin:'youtubemusic',action:'rewind',value:''}});
 assert.equal(w.config.slots[0].action,'rewind');assert.equal(w.config.slots[1].action,'open');
});
test('invalid targeted saves never mutate saved settings',()=>{
 const w=workspace(),before=JSON.stringify(w.config);
 for(const input of [null,{}, {index:-1,slot:null},{index:4,slot:null},{index:1,slot:{plugin:'youtube',action:'execute'}},{index:1,slot:{plugin:'hotkey',action:'hotkey',value:''}}])assert.throws(()=>w.saveSlot(input));
 assert.equal(JSON.stringify(w.config),before);
});
