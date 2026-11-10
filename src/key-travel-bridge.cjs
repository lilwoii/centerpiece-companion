'use strict';
// Transient editor-only telemetry. Never enters application state or crash logs.
function attachKeyTravel(monitor,win){
 let enabled=false;
 const visible=()=>!win.isDestroyed()&&win.isVisible()&&!win.isMinimized()&&win.isFocused();
 const stop=()=>{enabled=false;monitor.watchTravel(false);};
 const travel=sample=>{if(!enabled)return;if(!visible()){stop();return;}win.webContents.send('key-travel',sample);};
 const connected=()=>monitor.watchTravel(enabled&&visible());
 const disconnected=()=>{if(enabled&&visible())win.webContents.send('key-travel',{unavailable:true});};
 monitor.on('travel',travel);
 monitor.on('connected',connected);monitor.on('disconnected',disconnected);
 for(const event of ['blur','hide','minimize'])win.on(event,stop);
 win.webContents.on('did-start-loading',stop);
 const close=()=>{stop();monitor.removeListener('travel',travel);monitor.removeListener('connected',connected);monitor.removeListener('disconnected',disconnected);};
 win.once('closed',close);
 return{set(enabledInput){if(typeof enabledInput!=='boolean')throw Error('Invalid key travel setting');enabled=enabledInput&&visible();monitor.watchTravel(enabled);return{enabled,connected:monitor.status().connected};},close};
}
module.exports={attachKeyTravel};
