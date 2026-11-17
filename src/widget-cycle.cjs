const types=['spotify','youtubemusic','youtube','clock','weather','cpu','gpu','mic','twitch','text','timer','obs','calendar','network','ram','vram','performance','downloads','market','musicbee','off'];
const legacyTypes=types.filter(t=>!['musicbee','timer','obs','calendar','youtubemusic','youtube','network','ram','vram','performance','downloads','market'].includes(t));
function validateOrder(order){if(Array.isArray(order)&&order.some(t=>['appointment','battery'].includes(t))){order=order.filter(t=>!['appointment','battery'].includes(t));if(!order.length)order=['off'];}if(order===undefined)return [...legacyTypes];if(!Array.isArray(order)||!order.length||order.length>types.length||new Set(order).size!==order.length||order.some(t=>!types.includes(t)))throw Error('Choose at least one widget, without duplicates.');return [...order];}
function includeWidget(order,type){const result=validateOrder(order);if(type!=='off'&&types.includes(type)&&!result.includes(type)){const index=result.indexOf('off');result.splice(index<0?result.length:index,0,type);}return result;}
function nextWidget(type,order=legacyTypes){const list=Array.isArray(order)&&!order.length?[...types]:validateOrder(order);return list[(list.indexOf(type)+1)%list.length];}
class WidgetCycle{
 constructor(workspace,apply,changed){Object.assign(this,{workspace,apply,changed});this.timer=null;this.running=false;this.pending=false;this.closed=false;}
 schedule(delay=60){clearTimeout(this.timer);this.timer=setTimeout(()=>{this.timer=null;void this.flush();},delay);}
 async flush(){
  if(this.closed)return;if(this.running){this.pending=true;return;}this.running=true;
  try{await this.apply();}catch{}finally{this.running=false;if(this.pending&&!this.closed){this.pending=false;if(this.timer===null)this.schedule(0);}}
 }
 press(){if(this.closed)return;const c=this.workspace.config;this.workspace.save({...c,widget:{...c.widget,type:nextWidget(c.widget.type,c.widgetFavorites??c.widgetOrder)}});this.changed();this.schedule();}
 cancel(){this.pending=false;clearTimeout(this.timer);this.timer=null;}
 close(){this.closed=true;this.cancel();}
}

module.exports={WidgetCycle,nextWidget,types,validateOrder,includeWidget};
