const types=['spotify','clock','weather','cpu','gpu','mic','twitch','text','timer','obs','off'];
const legacyTypes=types.filter(t=>!['timer','obs'].includes(t));
function validateOrder(order){if(order===undefined)return [...legacyTypes];if(!Array.isArray(order)||!order.length||order.length>types.length||new Set(order).size!==order.length||order.some(t=>!types.includes(t)))throw Error('Choose at least one widget, without duplicates.');return [...order];}
function nextWidget(type,order=legacyTypes){const list=validateOrder(order);return list[(list.indexOf(type)+1)%list.length];}
class WidgetCycle{
 constructor(workspace,apply,changed){Object.assign(this,{workspace,apply,changed});this.timer=null;this.lastPress=0;}
 press(){const c=this.workspace.config;this.workspace.save({...c,widget:{...c.widget,type:nextWidget(c.widget.type,c.widgetOrder)}});this.changed();clearTimeout(this.timer);this.timer=setTimeout(()=>{this.timer=null;this.apply().catch(()=>{});},60);}
 close(){clearTimeout(this.timer);}
}
module.exports={WidgetCycle,nextWidget,types,validateOrder};
