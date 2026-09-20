const {sameBinding}=require('./keyboard-errors.cjs');
const plugin={behaviorId:50397,param1:0x05070013},widget={behaviorId:50397,param1:0x05070045};
function classify(binding,expected){if(!binding)return'unavailable';if(sameBinding(binding,expected))return'companion';if(binding.behaviorId===60498)return'finalmouse-plugin';if(sameBinding(binding,{behaviorId:50397,param1:0x05070073}))return'legacy-companion';return'other';}
function shortcutStatus(map){const base=map?.layers?.find(l=>(l.id||0)===0),layer=map?.layers?.find(l=>l.id===1);const binding=(l,i)=>l?.bindings?.[i]||l?.keys?.[i]?.binding;return{l1:binding(base,63)?.behaviorId===54567&&binding(base,63)?.param1===1?'layer-1':'other',plugin:classify(binding(layer,26),plugin),widget:classify(binding(layer,55),widget)};}
function shortcutsReady(map,includeWidget=true){const s=shortcutStatus(map);return s.l1==='layer-1'&&s.plugin==='companion'&&(!includeWidget||s.widget==='companion');}
module.exports={shortcutStatus,shortcutsReady};
