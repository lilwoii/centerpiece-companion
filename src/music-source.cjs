// Source IDs identify local Windows media sessions; they are never executed.
function validateSource(value='') {
  if(typeof value!=='string'||value.length>512||/[\x00-\x1f\x7f]/.test(value)||/spotify/i.test(value))throw Error('Choose a valid YouTube Music media source.');
  return value;
}
function validateTarget(value='auto') {
  if(!['auto','desktop','web'].includes(value))throw Error('Choose Auto, Desktop or Web for YouTube Music.');
  return value;
}
function playerTarget(value='desktop') {const target=validateTarget(value);return target==='auto'?'desktop':target;}
function savedPlayerTarget(target,source='') {
  source=validateSource(source);
  if((target===undefined||target==='auto')&&source){
    return /(^|[.\\])(?:youtube[ ._-]*music(?:[ ._-]*desktop(?:[ ._-]*app)?)?|ytmdesktop(?:app)?)\.exe$/i.test(source)?'desktop':'web';
  }
  return playerTarget(target);
}
module.exports={validateSource,validateTarget,playerTarget,savedPlayerTarget};
