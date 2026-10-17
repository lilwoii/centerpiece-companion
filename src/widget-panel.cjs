// The lower-left cutout leaves the physical Up key visible.
const bounds={x:1710,y:219,width:194,height:211};
const slots=['lower','bottom','top'];
function positions(count,input){
 if(input!==undefined&&(!Array.isArray(input)||new Set(input).size!==input.length||input.some(p=>!slots.includes(p))))throw Error('Choose a different position for each extra widget.');
 const result=(input||[]).slice(0,count);for(const slot of slots)if(result.length<count&&!result.includes(slot))result.push(slot);return result;
}
function cells(count,split=50,assigned){
 const order=positions(count-1,assigned),top=order.includes('top'),lower=order.filter(p=>p!=='top'),main=top?194*(split===60?60:50)/100:194;
 return [{x:0,y:0,width:main,height:94},...order.map(p=>p==='top'?{x:main,y:0,width:194-main,height:94}:{x:105,y:94+(lower.length===2&&p==='bottom'?58.5:0),width:89,height:117/lower.length})];
}
const outline='M9 0H185Q194 0 194 9V202Q194 211 185 211H114Q105 211 105 202V94H9Q0 94 0 85V9Q0 0 9 0Z';
const topOutline='M9 0H185Q194 0 194 9V85Q194 94 185 94H9Q0 94 0 85V9Q0 0 9 0Z';
function placements(widgets,split=50,assigned){return cells(widgets.length,split,assigned);}
module.exports={bounds,cells,placements,outline,topOutline,positions};
