const sharp=require('sharp');
// Compare areas, not single glyph/antialiasing pixels. Firmware returns a
// half-size thumbnail with a different resampler and sometimes flattened alpha.
async function compareOverlayPreview(expectedPng,actualPng){
 const metadata=await sharp(actualPng,{limitInputPixels:960*275}).metadata();
 if(metadata.width!==960||metadata.height!==275)throw Error('Unexpected overlay preview dimensions');
 const normalize=bytes=>sharp(bytes).flatten({background:'#000000'}).resize(240,69,{kernel:'lanczos3'}).blur(1).removeAlpha().raw().toBuffer();
 const [expected,actual]=await Promise.all([normalize(expectedPng),normalize(actualPng)]);
 let worst=0,regions=0;
 for(let y=0;y<69;y+=12)for(let x=0;x<240;x+=12){let total=0,count=0;for(let yy=y;yy<Math.min(69,y+12);yy++)for(let xx=x;xx<Math.min(240,x+12);xx++){const at=(yy*240+xx)*3;if(Math.max(expected[at],expected[at+1],expected[at+2],actual[at],actual[at+1],actual[at+2])<12)continue;for(let c=0;c<3;c++)total+=Math.abs(expected[at+c]-actual[at+c]);count+=3;}if(count>=18){regions++;worst=Math.max(worst,total/count);}}
 return {matches:worst<=24,maximumAreaDifference:Math.round(worst*10)/10,regions};
}
async function verifyOverlayPreview(bytes,read,{attempts=3,delay=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 let result;
 for(let attempt=0;attempt<attempts;attempt++){if(attempt)await delay(150*attempt);const preview=await read();if(!preview){result={matches:false,empty:true};continue;}result=await compareOverlayPreview(bytes,preview);if(result.matches)return result;}
 const error=Error(result?.empty?'The keyboard returned an empty overlay preview after upload.':'The keyboard acknowledged the overlay but returned different preview content after 3 reads. Display recovery can retry the upload; your key bindings were saved.');error.code='OVERLAY_PREVIEW_MISMATCH';error.details=result;throw error;
}
module.exports={compareOverlayPreview,verifyOverlayPreview};
