'use strict';
const {parentPort,workerData}=require('node:worker_threads');
async function run(){
 const sharp=require('sharp'),ort=require('onnxruntime-node');
 sharp.concurrency(1);const bytes=Buffer.from(workerData.image.split(',')[1],'base64');
 const original=await sharp(bytes,{limitInputPixels:16*1024*1024}).rotate().resize({width:1920,height:550,fit:'inside',withoutEnlargement:true}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const {width,height}=original.info;
 const rgb=await sharp(original.data,{raw:{width,height,channels:4}}).removeAlpha().resize(320,320,{fit:'fill'}).raw().toBuffer();
 const tensor=new Float32Array(3*320*320),means=[.485,.456,.406],std=[.229,.224,.225];let maximum=1;
 for(const v of rgb)maximum=Math.max(maximum,v);
 for(let i=0;i<320*320;i++)for(let c=0;c<3;c++)tensor[c*320*320+i]=(rgb[i*3+c]/maximum-means[c])/std[c];
 parentPort.postMessage({phase:'Finding the foreground subject…'});
 const session=await ort.InferenceSession.create(workerData.model,{executionProviders:['cpu'],intraOpNumThreads:2,interOpNumThreads:1,graphOptimizationLevel:'all'});
 let prediction;try{const result=await session.run({[session.inputNames[0]]:new ort.Tensor('float32',tensor,[1,3,320,320])});prediction=result[session.outputNames[0]].data;}finally{await session.release();}
 let low=Infinity,high=-Infinity;for(const value of prediction){low=Math.min(low,value);high=Math.max(high,value);}
 if(!Number.isFinite(high)||high-low<1e-6)throw Error('No clear foreground was found. Try a photo with a distinct subject.');
 const small=Buffer.alloc(320*320);for(let i=0;i<small.length;i++)small[i]=Math.round(Math.max(0,Math.min(1,(prediction[i]-low)/(high-low)))*255);
 const mask=await sharp(small,{raw:{width:320,height:320,channels:1}}).resize(width,height,{kernel:'lanczos3'}).greyscale().raw().toBuffer();
 if(mask.length!==width*height)throw Error('The subject mask has an invalid shape.');
 let left=width,top=height,right=0,bottom=0,count=0;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=y*width+x;original.data[i*4+3]=Math.round(original.data[i*4+3]*mask[i]/255);if(original.data[i*4+3]>100){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);count++;}}
 if(count<16)throw Error('The subject is too small to extract. Try a closer photo.');
 left=Math.max(0,left-3);top=Math.max(0,top-3);right=Math.min(width-1,right+3);bottom=Math.min(height-1,bottom+3);
 const output=await sharp(original.data,{raw:{width,height,channels:4}}).extract({left,top,width:right-left+1,height:bottom-top+1}).png().toBuffer();
 parentPort.postMessage({result:{image:'data:image/png;base64,'+output.toString('base64'),width:right-left+1,height:bottom-top+1,sourceWidth:width,sourceHeight:height,left,top}});
}
run().catch(error=>parentPort.postMessage({error:error.message}));
