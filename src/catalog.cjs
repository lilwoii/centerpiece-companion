const entries=[
 ['weather','Local weather','Widgets',null,null],
 ['clock','Local time','Widgets',null,null],
 ['cpu','CPU monitor','Widgets',null,null],
 ['gpu','GPU temperature','Widgets',null,null],
 ['mic','Microphone mute','Voice',null,null],
 ['spotify','Spotify','Music','spotify','https://open.spotify.com/'],
 ['youtube','YouTube','Streaming','youtube','https://www.youtube.com/'],
 ['twitch','Twitch','Streaming','twitch','https://www.twitch.tv/'],
 ['obs','OBS Studio','Streaming','obsstudio',null],
 ['discord','Discord','Voice','discord','https://discord.com/channels/@me'],
 ['voice','Voice / microphone','Voice',null,null],
 ['steam','Steam','Gaming','steam','steam://open/main'],
 ['kick','Kick','Streaming','kick','https://kick.com/'],
 ['streamlabs','Streamlabs','Streaming','streamlabs','https://streamlabs.com/dashboard'],
 ['voicemod','Voicemod','Voice',null,'https://www.voicemod.net/'],
 ['soundboard','Soundboard','Voice',null,null],
 ['media','Media & volume','System',null,null],
 ['browser','Website','System',null,null],
 ['app','Launch an app','System',null,null],
 ['hotkey','Keyboard shortcut','System',null,null],
 ['applemusic','Apple Music','Music','applemusic','https://music.apple.com/'],
 ['youtubemusic','YouTube Music','Music','youtubemusic','https://music.youtube.com/'],
 ['vlc','VLC','Music','vlcmediaplayer',null],
 ['teamspeak','TeamSpeak','Voice','teamspeak','https://www.teamspeak.com/'],
 ['zoom','Zoom','Voice','zoom','https://zoom.us/'],
 ['telegram','Telegram','Voice','telegram','https://web.telegram.org/'],
 ['whatsapp','WhatsApp','Voice','whatsapp','https://web.whatsapp.com/'],
 ['epic','Epic Games','Gaming','epicgames','https://store.epicgames.com/'],
 ['gog','GOG','Gaming','gogdotcom','https://www.gog.com/'],
 ['reddit','Reddit','Community','reddit','https://www.reddit.com/'],
 ['patreon','Patreon','Community','patreon','https://www.patreon.com/'],
 ['kofi','Ko-fi','Community','kofi','https://ko-fi.com/'],
 ['github','GitHub','Community','github','https://github.com/']
];
const action=(id,label)=>({id,label});
const catalog=entries.map(([id,name,category,icon,url])=>({id,name,category,icon:icon||id,url,actions:[
 ...(['weather','clock','cpu','gpu'].includes(id)?[action('display','Show live reading')]:[]),
 ...(id==='mic'?[action('mute','Mute / unmute microphone')]:[]),
 ...(id==='spotify'?[action('toggle','Play / pause'),action('previous','Previous track'),action('next','Next track')]:[]),
 ...(id==='obs'?[action('record','Start / stop recording'),action('replay','Save replay buffer'),action('scene','Switch scene'),action('mute','Mute / unmute input')]:[]),
 ...(id==='media'?[action('toggle','Play / pause'),action('previous','Previous track'),action('next','Next track'),action('volumeup','Volume up'),action('volumedown','Volume down'),action('volumemute','Mute speakers')]:[]),
 ...(url?[action('open',id==='steam'?'Open Steam':`Open ${name}`)]:[]),
 ...(id==='browser'?[action('url','Open website')]:[]),
 ...(id==='app'?[action('app','Open chosen app')]:[]),
 action('hotkey','Send configured shortcut')
]}));
function hotkeyCodes(value){
 if(typeof value!=='string'||value.length>80)throw Error('Enter a shortcut such as Ctrl+Shift+F10.');
 const parts=value.split('+').map(s=>s.trim().toUpperCase()),mods={CTRL:17,CONTROL:17,ALT:18,SHIFT:16};
 const final=parts.pop();const codes=parts.map(p=>mods[p]);
 if(codes.some(c=>!c)||new Set(codes).size!==codes.length)throw Error('Use Ctrl, Alt or Shift once, followed by one key.');
 const special={SPACE:32,ENTER:13,ESC:27,TAB:9,UP:38,DOWN:40,LEFT:37,RIGHT:39,HOME:36,END:35,DELETE:46,INSERT:45};
 let key=special[final];if(/^[A-Z0-9]$/.test(final))key=final.charCodeAt(0);if(/^F([1-9]|1[0-9]|2[0-4])$/.test(final))key=111+Number(final.slice(1));
 if(!key||(!codes.length&&!/^F/.test(final)))throw Error('Use a modifier with a key, or F1–F24.');
 if(codes.includes(17)&&codes.includes(18)&&key===80)throw Error('L1+P uses this shortcut. Choose another.');
 return [...codes,key];
}
function validateSlot(slot){
 if(slot===null)return null;
 const p=catalog.find(p=>p.id===slot?.plugin);if(!p||!p.actions.some(a=>a.id===slot.action))throw Error('Choose a plugin and an available action.');
 const value=typeof slot.value==='string'?slot.value.trim():'';
 if(slot.action==='hotkey')hotkeyCodes(value);
 if(slot.action==='url'){let u;try{u=new URL(value);}catch{}if(!u||!['https:','http:'].includes(u.protocol)||u.username||u.password)throw Error('Enter an http or https website address.');}
 if(p.id==='obs'&&['scene','mute'].includes(slot.action)&&(!value||value.length>200))throw Error('Enter the exact OBS scene or input name.');
 if(slot.action==='app'&&(!/^[a-z]:[\\/]/i.test(value)||!/\.(exe|lnk)$/i.test(value)||!require('node:fs').existsSync(value)))throw Error('Choose an installed app.');
 return {plugin:p.id,action:slot.action,value};
}
module.exports={catalog,hotkeyCodes,validateSlot};
