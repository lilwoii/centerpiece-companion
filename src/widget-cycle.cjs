const types=['spotify','clock','weather','cpu','gpu','mic','twitch','text','off'];
function nextWidget(type){return types[(types.indexOf(type)+1)%types.length];}
class WidgetCycle{
 constructor(workspace,apply,changed){Object.assign(this,{workspace,apply,changed});this.timer=null;this.lastPress=0;}
 press(){const c=this.workspace.config;this.workspace.save({...c,widget:{...c.widget,type:nextWidget(c.widget.type)}});this.changed();clearTimeout(this.timer);this.timer=setTimeout(()=>{this.timer=null;this.apply().catch(()=>{});},60);}
 close(){clearTimeout(this.timer);}
}
module.exports={WidgetCycle,nextWidget,types};
