(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.StudioInteractions=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const effects=[
  {id:'ripple',name:'Water ripple',icon:'◎',description:'Waves spread from the keys you press.'},
  {id:'burst',name:'Particle burst',icon:'✺',description:'Send particles outward from a key.'},
  {id:'flash',name:'Color flash',icon:'◈',description:'Briefly light up the selected layer.'},
  {id:'pulse',name:'Soft pulse',icon:'◉',description:'A smooth glow that fades away.'},
  {id:'toggle',name:'Toggle visibility',icon:'◐',description:'Show or hide a layer with each press.'},
  {id:'heat',name:'Heat glow',icon:'♨',description:'Leave a warm glow where you type.'},
  {id:'shockwave',name:'Shockwave',icon:'⊙',description:'Send an expanding ring across the scene.'},
  {id:'sparkle',name:'Sparkles',icon:'✦',description:'Scatter bright sparks around a key.'},
  {id:'launch',name:'Launch / activate',icon:'↗',description:'Activate the scene’s special motion, where supported.'},
  {id:'flee',name:'Move away nearby',icon:'↝',description:'Nearby objects move away from the keys you press.'},
  {id:'lightning',name:'Cloud lightning',icon:'ϟ',description:'Send a branching bolt from a different cloud position with every press.'}
 ];
 const triggers=[{value:'keyDown',label:'When a key is pressed'},{value:'keyUp',label:'When a key is released'},{value:'pointer',label:'When the preview is clicked'},{value:'beat',label:'On a test beat'},{value:'caps',label:'When Caps Lock is pressed'}];
 function name(id){return effects.find(e=>e.id===id)?.name||id;}
 function keyName(code){return code.replace(/^Key|^Digit/,'').replace(/^Arrow/,'Arrow ').replace(/(Left|Right)$/,' $1');}
 function keySummary(rule){if(rule.keys)return rule.keys.length<=3?rule.keys.map(keyName).join(' + '):rule.keys.length+' keys';return rule.key==='any'?'All keys':keyName(rule.key);}
 function selectedKeyCodes(indices,codes,valid){return [...new Set([...indices].map(i=>codes[i]).filter(k=>k&&k!=='any'&&valid(k)))];}
 return{effects,triggers,name,keyName,keySummary,selectedKeyCodes};
});
