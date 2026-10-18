'use strict';
const layout=require('./layout.json'),{physical}=require('./keymap.cjs');
function positions(){return layout.keys.map((k,index)=>({id:String(index),label:physical[index],x:Math.round((k.x||0)*1920/1800+4),y:Math.round((k.y||0)*550/500+4),width:Math.round(k.width*1920/1800-8),height:Math.round(k.height*550/500-8)}));}
module.exports={positions};
