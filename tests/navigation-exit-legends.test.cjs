const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('src/main.cjs','utf8');
test('L1 release preserves navigation; next press exits once and updates highlights',()=>{
 const calls=[],context={state:{layer:true,strip:true},navigation:{active:true},strip:{setLayer:x=>calls.push(['layer',x])},leaveMode(){calls.push(['exit']);this.navigation.active=false;},send(){}};
 // Use a closure so this binding is immaterial to the fixture.
 context.leaveMode=()=>{calls.push(['exit']);context.navigation.active=false;};vm.createContext(context);
 vm.runInContext(source.slice(source.indexOf('function handleLayerState('),source.indexOf('function musicSlot()')),context);
 context.handleLayerState(false);assert.equal(context.navigation.active,true);
 context.handleLayerPress();assert.equal(context.navigation.active,false);
 context.handleLayerState(true);assert.equal(calls.filter(x=>x[0]==='exit').length,1);
 assert.deepEqual(calls.filter(x=>x[0]==='layer'),[['layer',false],['layer',true]]);
});
test('UK ISO backslash, ANSI hash and shifted variants remain distinct single legends',()=>{
 const {bindingLegend}=require('../src/language-labels.js');const labels=Array(68).fill('');labels[29]='#';const shift=[...labels];shift[29]='~';const language={id:'00000809',labels,shift};
 for(const [usage,normal,shifted]of [[100,'\\','|'],[49,'#','~'],[50,'#','~']]){
  const binding={behaviorId:50397,param1:0x70000|usage};assert.equal(bindingLegend('\\',binding,language,{}),normal);assert.equal(bindingLegend('\\',binding,language,{shift:true}),shifted);
 }
});
test('rebinding reasserts exclusive legend ownership before refreshing overlays',async()=>{
 let commits=0;const context={state:{strip:true},strip:{legends:{model:{},commit:async()=>commits++},som:{}},displayTasks:{run:fn=>fn()}};vm.createContext(context);
 vm.runInContext(source.slice(source.indexOf('async function restoreLegendOwnership('),source.indexOf('function refreshKeyAppearance()')),context);
 await context.restoreLegendOwnership();assert.equal(commits,1);context.strip.legends.model=null;await context.restoreLegendOwnership();assert.equal(commits,1);
 for(const name of ['change-key','undo-key']){const handler=source.slice(source.indexOf("handle('"+name+"'"));assert.ok(handler.indexOf('await restoreLegendOwnership()')<handler.indexOf('refreshKeyAppearance()'));}
});
test('DKS is absent from app UI and IPC and excluded from shipped files',()=>{
 for(const file of ['src/index.html','src/customization-ui.js','src/preload.cjs','src/main.cjs'])assert.doesNotMatch(fs.readFileSync(file,'utf8'),/dks-draft|dks-editor-ui|dks-model|dks-settings|dks-control|saveDksDraft|dksDraft/);
 assert.ok(require('../package.json').build.files.includes('!src/dks-*'));
});
