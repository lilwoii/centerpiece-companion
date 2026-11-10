const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(){
 const nodes=new Map(),listeners=new Map(),forms=[];let created=0;
 function node(tag='div'){created++;const events=new Map(),attrs={};return{tag,children:[],dataset:{},style:{},value:'',textContent:'',className:'',disabled:false,hidden:false,checked:false,rebuilds:0,
  append(child){this.children.push(child);},replaceChildren(...children){this.children=children;this.rebuilds++;},setAttribute(k,v){attrs[k]=v;},getAttribute:k=>attrs[k],addEventListener(type,fn){events.set(type,fn);},click(){events.get('click')?.();},
  querySelectorAll(selector){const result=[];for(const child of this.children){if(selector==='.key'&&child.className==='key')result.push(child);result.push(...child.querySelectorAll(selector));}return result;},
  querySelector(selector){const position=selector.match(/^\[data-position="(\d+)"\]$/)?.[1];return this.querySelectorAll('.key').find(key=>key.dataset.position===position)||null;}
 };}
 const el=id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);};el('key-layer').value='0';
 const base=Array.from({length:68},(_,position)=>({position,name:'Key '+position,label:'Letter '+position,binding:{behaviorId:50397,param1:0x70004+position%26}}));base[1].binding.param1=0x03070029;base[2].binding.param1=0xc00cd;
 const keymap={layers:[{id:0,keys:base},{id:1,keys:structuredClone(base).map(k=>({...k,label:'Layer 1 '+k.label}))}],choices:Array.from({length:200},(_,i)=>({value:0x70004+i,label:'Action '+i})).concat({value:0xc00cd,label:'Play / pause'})};
 let context;const document={createElement:node,addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(fn);},dispatchEvent(event){for(const fn of listeners.get(event.type)||[])fn(event);return !event.defaultPrevented;}};
 context=vm.createContext({document,Event,keymap,selectedKey:32,el,option:(value,text)=>Object.assign(node('option'),{value:String(value),textContent:text}),draft:{keyIcons:{}},MI:{find:code=>code===0xc00cd?{code}:null},iconUri:()=> 'sample-media-artwork',mediaForm:()=>forms.push(context.selectedKey)});
 const desk=fs.readFileSync(require.resolve('../src/desk.js'),'utf8');vm.runInContext(desk.slice(desk.indexOf('function selectedLayer()'),desk.indexOf("el('read-keyboard').addEventListener")),context);
 const custom=fs.readFileSync(require.resolve('../src/customization-ui.js'),'utf8');vm.runInContext(custom.slice(custom.indexOf(' const previousKeyboard=drawKeyboard;'),custom.indexOf(" el('key-target').addEventListener")),context);
 context.drawKeyboard();return{el,context,forms,created:()=>created};
}
test('selecting keys refreshes binding/media controls without rebuilding artwork, keys, or action choices',()=>{
 const f=fixture(),board=f.el('keyboard-map'),buttons=board.querySelectorAll('.key'),image=buttons[2].children[0],choices=[...f.el('key-target').children],created=f.created(),rebuilds=board.rebuilds;
 buttons[1].click();assert.equal(f.context.selectedKey,1);assert.equal(f.el('key-target').value,String(0x70029));assert.equal(f.el('key-ctrl').checked,true);assert.equal(f.el('key-shift').checked,true);assert.equal(f.el('key-alt').checked,false);assert.equal(f.forms.at(-1),1);
 assert.deepEqual(board.querySelectorAll('.key'),buttons);assert.equal(buttons[2].children[0],image);assert.deepEqual(f.el('key-target').children,choices);assert.equal(f.created(),created);assert.equal(board.rebuilds,rebuilds);
 const formUpdates=f.forms.length;buttons[1].click();assert.equal(f.forms.length,formUpdates);buttons[2].click();assert.equal(f.el('key-target').value,String(0xc00cd));assert.equal(f.el('key-ctrl').checked,false);assert.equal(f.forms.at(-1),2);assert.equal(f.created(),created);
});
test('swap choices exclude current and reserved keys while preserving nodes across selection',()=>{
 const f=fixture(),options=[...f.el('swap-target').children];assert.ok(!options.some(o=>o.value==='63'));f.context.selectKeyboardKey(0);assert.equal(options.find(o=>o.value==='0').disabled,true);assert.equal(options.find(o=>o.value==='0').hidden,true);assert.notEqual(f.el('swap-target').value,'0');
 f.context.selectKeyboardKey(1);assert.equal(options.find(o=>o.value==='0').disabled,false);assert.equal(options.find(o=>o.value==='1').disabled,true);assert.deepEqual(f.el('swap-target').children,options);
 f.el('key-layer').value='1';f.context.drawKeyboard();assert.ok(f.el('swap-target').children.every(o=>!['26','55','62','63'].includes(o.value)));f.context.selectKeyboardKey(26);assert.equal(f.el('save-key').disabled,true);assert.equal(f.el('swap-key').disabled,true);
});
test('binding changes and Undo refresh the selected form using the new keymap',()=>{
 const f=fixture();f.context.selectKeyboardKey(1);const before=structuredClone(f.context.keymap);f.context.keymap=structuredClone(before);f.context.keymap.layers[0].keys[1].binding.param1=0xc00cd;f.context.drawKeyboard();assert.equal(f.el('key-target').value,String(0xc00cd));
 f.context.selectKeyboardKey(2);f.context.keymap=structuredClone(before);f.context.drawKeyboard();f.context.selectKeyboardKey(1);assert.equal(f.el('key-target').value,String(0x70029));assert.equal(f.el('key-ctrl').checked,true);assert.equal(f.el('key-shift').checked,true);
 assert.equal(f.context.selectKeyboardKey(100),false);assert.equal(f.context.selectKeyboardKey(NaN),false);assert.equal(f.context.selectedKey,1);
});
