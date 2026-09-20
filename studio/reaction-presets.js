(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./model.js'):root.StudioModel);if(typeof module==='object'&&module.exports)module.exports=api;else root.StudioReactionPresets=api;})(typeof globalThis!=='undefined'?globalThis:this,function(M){
 'use strict';
 const r=(effect,color,strength,duration,extra={})=>({effect,color,strength,duration,...extra});
 const definitions=[
  ['pond-touch','Pond touch','Water','A soft ring spreads from each key.',[r('ripple','#a8eadf',.65,2.4)]],
  ['rain-drops','Rain drops','Water','Small, quick ripples for fast typing.',[r('ripple','#6bbcff',.45,.8)]],
  ['double-tide','Double tide','Water','Two rings travel at different speeds.',[r('ripple','#72dfed',.7,1.2),r('ripple','#b4f8e5',.45,3)]],
  ['deep-sonar','Deep sonar','Water','A broad sonar ring with a lingering glow.',[r('shockwave','#41b9ce',.75,3.2),r('heat','#24728c',.4,4)]],
  ['ice-crystal','Ice crystals','Water','Cold ripples break into bright crystal sparks.',[r('ripple','#acdcff',.6,1.6),r('sparkle','#e5f8ff',.65,1.1)]],
  ['spring-splash','Spring splash','Water','A ripple on press and a splash on release.',[r('ripple','#81e6c2',.8,1.8),r('burst','#cdf7ef',.6,.7,{trigger:'keyUp'})]],
  ['firefly-touch','Firefly touch','Particles','Gentle gold sparks appear around each key.',[r('sparkle','#edda87',.35,2.8)]],
  ['ember-trail','Ember trail','Particles','Warm particles leave a slow fading heat trail.',[r('burst','#f09745',.6,1.1),r('heat','#d44c2a',.7,4.8)]],
  ['celebration','Celebration','Particles','Two colored bursts and a quick pulse.',[r('burst','#ed75ba',1.1,1.3),r('sparkle','#62e6d4',1,2.3),r('pulse','#eddd97',.35,.6)]],
  ['stardust','Stardust','Particles','Silver sparks over a quiet violet glow.',[r('sparkle','#e2eafa',.7,3.4),r('heat','#9182d2',.3,2.2)]],
  ['meteor-strike','Meteor strike','Particles','An immediate flash, flying sparks and a shockwave.',[r('flash','#ffe6b5',.55,.15),r('burst','#f6a250',1.15,1.5),r('shockwave','#df6948',.8,2.8)]],
  ['release-confetti','Release confetti','Particles','Particles appear when you let the key go.',[r('burst','#87ddb9',.9,1.4,{trigger:'keyUp'}),r('sparkle','#bd93eb',.6,2,{trigger:'keyUp'})]],
  ['soft-feedback','Soft feedback','Light','A short subtle pulse with every press.',[r('pulse','#a9c7ed',.3,.45)]],
  ['neon-key','Neon key','Light','A quick cyan flash followed by a violet glow.',[r('flash','#6deaf4',.5,.2),r('heat','#9b6fe1',.45,1.6)]],
  ['slow-afterglow','Slow afterglow','Light','A gentle glow that lingers while you type.',[r('heat','#f1b984',.65,7)]],
  ['heartbeat','Heartbeat','Light','Press and release create two separate pulses.',[r('pulse','#f282a0',.8,.8),r('pulse','#ffc1d0',.5,.5,{trigger:'keyUp'})]],
  ['camera-flash','Camera flash','Light','A brief bright flash without a long trail.',[r('flash','#edf5ff',1,.12)]],
  ['release-glow','Release glow','Light','The selected layer glows after a key is released.',[r('flash','#b5dfaf',.55,.45,{trigger:'keyUp'}),r('heat','#69ab93',.5,2,{trigger:'keyUp'})]],
  ['gravity-ring','Gravity ring','Space','A wide violet ring and a soft pulse.',[r('shockwave','#9f98f4',.8,3.5),r('pulse','#84cdea',.35,1.2)]],
  ['solar-flare','Solar flare','Space','A hot expanding wave with gold sparks.',[r('shockwave','#f6b659',1.2,2),r('sparkle','#fff0c2',.8,1.5)]],
  ['deep-echo','Deep echo','Space','A quick blue ring inside a slower outer ring.',[r('shockwave','#74b0ef',.6,1),r('shockwave','#6679b7',.55,4.5)]],
  ['orbital-contact','Orbital contact','Space','Sparks on contact, then a ring on release.',[r('sparkle','#c8eaf1',.9,.9),r('ripple','#77afcc',.65,2.8,{trigger:'keyUp'})]],
  ['supernova','Supernova','Space','A strong flash, particle burst and long shockwave.',[r('flash','#f7ebdd',.7,.2),r('burst','#b6a7ec',1.4,2),r('shockwave','#75c8e9',1.2,4)]],
  ['quiet-nebula','Quiet nebula','Space','Sparse star sparks and a long colored afterglow.',[r('sparkle','#d8c5f2',.3,4),r('heat','#7663ab',.4,8)]],
  ['gentle-avoidance','Gentle avoidance','Movement','Nearby objects glide away and settle back.',[r('flee','#a8eadf',.6,4,{radius:220,distance:110})],true],
  ['startled-fish','Startled fish','Movement','Nearby fish dart away from a ripple.',[r('flee','#bfe3cf',1.2,2.8,{radius:245,distance:210}),r('ripple','#a3d8c8',.6,2)],true],
  ['shy-butterfly','Shy butterfly','Movement','A narrow reaction zone with a longer escape.',[r('flee','#dabbeb',.9,3.8,{radius:160,distance:260}),r('sparkle','#eddaed',.35,1.1)],true],
  ['magnetic-repel','Magnetic repel','Movement','A wide push with a visible expanding ring.',[r('flee','#8cc6ef',1,3,{radius:450,distance:150}),r('shockwave','#87bcdc',.6,2.4)],true],
  ['bubble-pop','Bubble pop','Movement','A quick nudge and small particles.',[r('flee','#c9e9f0',.55,1.4,{radius:190,distance:80}),r('burst','#c9e9f0',.45,.65)],true],
  ['wake-and-drift','Wake & drift','Movement','A slow ripple pushes nearby objects over a broad area.',[r('ripple','#93cddd',.5,4.5),r('flee','#93cddd',.65,6,{radius:360,distance:180})],true],
  ['tap-to-hide','Tap to hide / show','Visibility','Each press toggles the selected layer.',[r('toggle','#9bb9ff',1,1)],true],
  ['spark-and-switch','Spark & switch','Visibility','Toggle an object with a small sparkle at the pressed key.',[r('toggle','#bddcf0',1,1),r('sparkle','#bddcf0',.7,1.1)],true],
  ['press-reveal','Press to reveal','Visibility','Starting hidden: press shows the object; release hides it.',[r('toggle','#b3dfca',1,1),r('toggle','#b3dfca',1,1,{trigger:'keyUp'})],true],
  ['signal-switch','Signal switch','Visibility','Toggle an object while a colored ring marks the action.',[r('toggle','#d4bded',1,1),r('ripple','#d4bded',.7,1.7)],true],
  ['electric-touch','Electric touch','Combined','A sharp spark, short flash and compact wave.',[r('sparkle','#83e7ef',1.2,.55),r('flash','#c0f8ff',.55,.16),r('ripple','#4fa7dc',.45,.9)]],
  ['forest-magic','Forest magic','Combined','Firefly sparks above a green ripple and lingering glow.',[r('sparkle','#e5d98f',.45,2.5),r('ripple','#79b797',.55,3.2),r('heat','#527d6b',.3,4)]],
  ['warm-typing','Warm typing','Combined','Gentle press pulses and release embers.',[r('pulse','#eeb996',.25,.6),r('burst','#d68661',.35,1.8,{trigger:'keyUp'}),r('heat','#a55c59',.25,3.8)]],
  ['aurora-touch','Aurora touch','Combined','Mint and violet rings with a soft sparkle.',[r('ripple','#92dbca',.5,2),r('shockwave','#a498d9',.45,3.4),r('sparkle','#d6e9d8',.3,1.6)]],
  ['frosted-glass','Frosted glass','Combined','An icy flash fades into fine sparks and a pale ring.',[r('flash','#dcebf1',.3,.4),r('sparkle','#b5d7e8',.35,2),r('ripple','#86adcb',.5,3)]],
  ['finale','Grand finale','Combined','A strong press burst followed by a second wave on release.',[r('burst','#eabe88',1.4,1.6),r('sparkle','#ebaad0',1,2.5),r('shockwave','#9ecfea',1.1,3.6,{trigger:'keyUp'})]]
 ];
 const list=definitions.map(([id,name,category,description,rules,object=false])=>Object.freeze({id,name,category,description,rules:Object.freeze(rules.map(Object.freeze)),object}));
 function apply(project,id,{layerId,keys=[]}={}){
  const p=M.validate(project),preset=list.find(v=>v.id===id);if(!preset)throw Error('Choose a reaction preset.');
  const layer=layerId?p.layers.find(l=>l.id===layerId):null;
  if(layerId&&!layer)throw Error('Select a layer that is still in this skin.');
  if(preset.object&&(!layer||layer.locked))throw Error('Select an unlocked object layer for this reaction.');
  if(!Array.isArray(keys)||keys.some(k=>!M.validKey(k)||k==='any'))throw Error('Choose valid keys for this reaction.');
  const keyGroup=[...new Set(keys)];if(keyGroup.length>68)throw Error('Choose up to 68 keys.');
  const added=preset.rules.map(rule=>M.createRule({...rule,target:['flee','toggle','flash','pulse'].includes(rule.effect)&&layer?layer.id:'all',...(keyGroup.length?{keys:keyGroup}:{})}));
  p.rules.push(...added);return{project:M.validate(p),ruleIds:added.map(r=>r.id),preset};
 }
 return{list,categories:[...new Set(list.map(v=>v.category))],apply};
});
