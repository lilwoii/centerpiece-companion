'use strict';
function update(config,input){if(!input||typeof input!=='object')throw Error('Choose a layout action.');const next={...config,widgetPositions:require('./widget-panel.cjs').positions(config.extraWidgets.length,config.widgetPositions)};
 if(input.action==='fifth'){if(typeof input.enabled!=='boolean')throw Error('Choose whether to show position five.');if(input.enabled&&next.slots.length===4)next.slots=[...next.slots,next.extraPlugin||null];if(!input.enabled&&next.slots.length===5){next.extraPlugin=next.slots[4];next.slots=next.slots.slice(0,4);}}
 else if(input.action==='widget-position'){const i=input.index-1;if(!Number.isInteger(i)||i<0||i>=next.extraWidgets.length||!['top','lower','bottom'].includes(input.position))throw Error('Select an extra widget and its position.');const other=next.widgetPositions.indexOf(input.position),old=next.widgetPositions[i];if(other>=0)next.widgetPositions[other]=old;next.widgetPositions[i]=input.position;}
 else if(input.action==='widget-split'){if(![50,60].includes(input.value))throw Error('Choose a 50/50 or 60/40 widget split.');next.widgetSplit=input.value;}
 else if(input.action==='cycling')next.pluginCycling=require('./plugin-motion.js').normalize(input.value);
 else if(input.action==='add-widget'){if(next.extraWidgets.length>=3)throw Error('Up to four widgets can be displayed.');next.widgetPositions.push(['lower','bottom','top'].find(p=>!next.widgetPositions.includes(p)));next.extraWidgets=[...next.extraWidgets,{type:input.type||'clock',text:input.type==='text'?'Your text':'',x:1815,y:313,width:89,height:117}];}
 else if(input.action==='remove-widget'){if(!Number.isInteger(input.index)||input.index<1||input.index>next.extraWidgets.length)throw Error('Choose an extra widget to remove.');next.widgetPositions=next.widgetPositions.filter((_,i)=>i!==input.index-1);next.extraWidgets=next.extraWidgets.filter((_,i)=>i!==input.index-1);}
 else throw Error('Unknown layout action.');return next;
}
module.exports={update};
