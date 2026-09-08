const fs=require('node:fs'),icons=require('simple-icons'),{catalog}=require('../src/catalog.cjs'),path=require('node:path');
const dir=path.join(__dirname,'../src/icons');fs.mkdirSync(dir,{recursive:true});const data={};
const overrides={spotify:'1DB954',youtube:'FF0000',discord:'5865F2',obsstudio:'FFFFFF',steam:'C7D5E0',epicgames:'FFFFFF',github:'FFFFFF',gogdotcom:'A57BDD',applemusic:'FA243C'};
for(const p of catalog){const i=Object.values(icons).find(i=>i.slug===p.icon);const color=overrides[p.icon]||i?.hex||'9BB9FF';const svg=i?i.svg.replace('<svg ',`<svg fill="#${color}" `):`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5" fill="none" stroke="#9bb9ff"/><text x="12" y="16" text-anchor="middle" font-family="Arial" font-size="11" fill="#edf2fa">${p.name.slice(0,2).toUpperCase()}</text></svg>`;fs.writeFileSync(path.join(dir,p.icon+'.svg'),svg);data[p.icon]=svg;}
fs.writeFileSync(path.join(dir,'../icons.json'),JSON.stringify(data));
fs.copyFileSync(path.join(__dirname,'../node_modules/simple-icons/LICENSE.md'),path.join(dir,'LICENSE-SIMPLE-ICONS.txt'));
