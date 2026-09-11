const {randomInt}=require('node:crypto');
let sequence=randomInt(1,0x7fffffff);
// All Studio clients share the same HID reader. Request IDs must be unique
// across clients, including clients opened after a previous request timed out.
function nextRequestId(){sequence=(sequence+1)>>>0;if(!sequence)sequence=1;return sequence;}
function validateResponse(body,response){
 if(response.meta){const error=new Error(response.meta.simpleError===1?'Keyboard configuration access is locked. Unlock it in XPANEL and retry.':'Keyboard returned a protocol error. Run Check setup for a report.');error.code='STUDIO_META_ERROR';throw error;}
 const subsystem=Object.keys(body).find(k=>['core','keymap','behaviors'].includes(k)),method=subsystem&&Object.keys(body[subsystem])[0];
 if(!method||!Object.hasOwn(response[subsystem]||{},method)){const error=new Error('Keyboard returned an unexpected configuration response. Run Check setup.');error.code='STUDIO_RESPONSE_MISMATCH';throw error;}
 return response;
}
async function pendingChanges(studio){const value=(await studio.request({keymap:{checkUnsavedChanges:true}}))?.keymap?.checkUnsavedChanges;if(typeof value!=='boolean'){const error=new Error('Keyboard did not return a valid pending-changes status. Run Check setup.');error.code='STUDIO_INVALID_PENDING_STATUS';throw error;}return value;}
async function requireCleanSetup(studio){if(await pendingChanges(studio)){const error=new Error('Keyboard reports pending configuration changes. If XPANEL shows none, click Check setup and share the report. Setup has not changed your keyboard.');error.code='KEYBOARD_PENDING_CHANGES';throw error;}}
module.exports={nextRequestId,validateResponse,pendingChanges,requireCleanSetup};
