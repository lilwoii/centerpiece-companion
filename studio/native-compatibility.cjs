// Source inventory, not a device compatibility certificate. Keep this shared
// between native source export and the physical-test status check.
const INITIAL_NATIVE_SCENES=Object.freeze(['tidal-observatory','alpine-reflection','storm-window','ember-forge','moon-tranquility','lighthouse-watch','redwood-sanctuary','jellyfish-ballet','solar-orbit','lantern-festival','clockwork-garden','prism-bloom','coral-current','atlas-launch','aurora-valley','volcanic-drift','paper-ocean','desert-caravan','rainy-cafe','sakura-tram','neon-speedway','cloud-courier','dune-runner','prism-breaker']);
function describe(project){
 const nativeSceneSources=[...new Set(project.layers.filter(l=>l.type==='collection'&&INITIAL_NATIVE_SCENES.includes(l.text)).map(l=>l.text))];
 const previewOnlyScenes=[...new Set(project.layers.filter(l=>l.type==='collection'&&!INITIAL_NATIVE_SCENES.includes(l.text)).map(l=>l.text))];
 const previewOnlyBehaviors=[];
 const meshScenes=nativeSceneSources.filter(id=>!['cloud-courier','dune-runner','prism-breaker'].includes(id));
 if(meshScenes.length&&project.layers.some(l=>!['source-over','lighter','multiply'].includes(l.blend||'source-over')))previewOnlyBehaviors.push('collection-compositing');
 if(project.rules.some(r=>r.trigger==='beat'))previewOnlyBehaviors.push('beat-events');
 return{nativeSceneSources,previewOnlyScenes,previewOnlyBehaviors};
}
module.exports={INITIAL_NATIVE_SCENES,describe};
