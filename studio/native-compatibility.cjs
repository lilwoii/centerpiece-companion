// Source inventory, not a device compatibility certificate. Keep this shared
// between native source export and the physical-test status check.
const INITIAL_NATIVE_SCENES=Object.freeze(['tidal-observatory','cloud-courier','dune-runner','prism-breaker']);
function describe(project){
 const nativeSceneSources=[...new Set(project.layers.filter(l=>l.type==='collection'&&INITIAL_NATIVE_SCENES.includes(l.text)).map(l=>l.text))];
 const previewOnlyScenes=[...new Set(project.layers.filter(l=>l.type==='collection'&&!INITIAL_NATIVE_SCENES.includes(l.text)).map(l=>l.text))];
 const previewOnlyBehaviors=[];
 if(project.rules.some(r=>r.trigger==='beat'))previewOnlyBehaviors.push('beat-events');
 return{nativeSceneSources,previewOnlyScenes,previewOnlyBehaviors};
}
module.exports={INITIAL_NATIVE_SCENES,describe};
