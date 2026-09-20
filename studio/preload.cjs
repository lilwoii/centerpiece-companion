const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('studioWindow',{control:action=>{if(!['minimize','maximize','close'].includes(action))return Promise.reject(Error('Unknown window action.'));return ipcRenderer.invoke('studio-window',action);}});
