'use strict';
// Asset renderer only. This script does not launch a browser or access hardware.
const fs=require('node:fs');
const path=require('node:path');
const Canvas=require(process.env.STUDIO_CANVAS_MODULE||'@napi-rs/canvas');
const C=require('../studio/collection-effects.js');
const P=require('../studio/collection-presets.js');
const R=require('../studio/render.js');
const presets=require('../studio/presets.js');
global.Image=Canvas.Image;
const directory=path.resolve(__dirname,'../studio/examples/community-collection/previews');
async function drawProject(project,time,events=[]){const canvas=Canvas.createCanvas(1920,550),ctx=canvas.getContext('2d');ctx.fillStyle=project.canvas.background;ctx.fillRect(0,0,1920,550);const effects=R.activeRules(project,R.eventsAt(events,time),time);for(const layer of project.layers){ctx.save();ctx.globalAlpha=layer.opacity;ctx.globalCompositeOperation=layer.blend;ctx.translate(layer.x,layer.y);if(layer.type==='image'){const image=await Canvas.loadImage(layer.image);ctx.drawImage(image,0,0,layer.width,layer.height);}else if(layer.type==='collection'){const bitmap=layer.image?await Canvas.loadImage(layer.image):null;C.draw(ctx,layer,time,effects.filter(e=>e.rule.target==='all'||e.rule.target===layer.id),bitmap);}ctx.restore();}return canvas;}
async function main(){fs.mkdirSync(directory,{recursive:true});const entries=[];for(const preset of P.list){const project=preset.create(),events=preset.id==='atlas-launch'?[{type:'keyDown',key:'Space',time:.6,x:1036,y:430,strength:1}]:[],canvas=await drawProject(project,2.5,events);fs.writeFileSync(path.join(directory,preset.id+'.png'),canvas.toBuffer('image/png'));entries.push({name:preset.name,canvas});}
 const original=presets.list.find(p=>p.id==='ignition').create(),canvas=Canvas.createCanvas(1920,550);await R.prepareImages(original);R.draw(canvas.getContext('2d'),original,2.5,[]);fs.writeFileSync(path.join(directory,'ignition.png'),canvas.toBuffer('image/png'));entries.push({name:'Ignition · original',canvas});
 const contact=Canvas.createCanvas(1440,Math.ceil(entries.length/2)*258),c=contact.getContext('2d');c.fillStyle='#11151d';c.fillRect(0,0,contact.width,contact.height);for(let i=0;i<entries.length;i++){const x=(i%2)*720,y=Math.floor(i/2)*258;c.drawImage(entries[i].canvas,x+12,y+12,696,199.375);c.font='600 19px Segoe UI';c.fillStyle='#edf2fa';c.fillText(entries[i].name,x+18,y+239);}const verification=path.resolve(__dirname,'../verification');fs.mkdirSync(verification,{recursive:true});fs.writeFileSync(path.join(verification,'collection-contact-sheet.png'),contact.toBuffer('image/png'));console.log('Rendered '+entries.length+' accurate preview images and collection-contact-sheet.png.');}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
