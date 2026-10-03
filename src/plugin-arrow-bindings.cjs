const {sameBinding}=require('./keyboard-errors.cjs');
// Stock Centerpiece L1 navigation opens the firmware's separate Plugin Engine.
// Only migrate exact stock bindings; never replace a user's custom arrows.
const stockArrows=[[57,44345,0x70052],[65,1072,0x70050],[66,17738,0x70051],[67,33158,0x7004f]];
const engineActions=[44345,1072,17738,33158,60498];
function pluginArrowChanges(map){
 const layer=map?.layers?.find(l=>l.id===1);
 return stockArrows.flatMap(([position,behaviorId,key])=>{
  const original=layer?.bindings?.[position]||layer?.keys?.[position]?.binding;
  return original&&engineActions.some(id=>sameBinding(original,{behaviorId:id}))?[{position,original,installed:{behaviorId:50397,param1:key}}]:[];
 });
}
function arrowRestorations(layer,backup){
 return (backup.pluginArrows||[]).filter(item=>{
  const stock=stockArrows.find(([position])=>position===item.position);
  return stock&&engineActions.some(id=>sameBinding(item.original,{behaviorId:id}))&&sameBinding(item.installed,{behaviorId:50397,param1:stock[2]})&&sameBinding(layer.bindings[item.position],item.installed);
 });
}
module.exports={pluginArrowChanges,arrowRestorations};
