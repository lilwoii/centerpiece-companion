const test=require('node:test'),assert=require('node:assert/strict'),{geometry}=require('../studio/image-converter.js');
test('wide high-resolution image fills without stretching',()=>{const g=geometry(3840,1100);assert.equal(g.dw,1920);assert.equal(g.dh,550);assert.equal(g.scale,.5);assert.equal(g.dx,0);assert.equal(g.needsUpscale,false);});
test('portrait fill crops and framing stays within source coverage',()=>{const g=geometry(2000,3000,'fill',0,1);assert.equal(g.dw,1920);assert.equal(g.dy,550-g.dh);assert.ok(g.dh>550);});
test('small images retain original pixels unless explicitly enlarged',()=>{const g=geometry(640,360);assert.equal(g.scale,1);assert.equal(g.dw,640);assert.equal(g.needsUpscale,true);assert.equal(geometry(640,360,'fill',.5,.5,true).dw,1920);});
test('fit preserves the complete aspect ratio with space around it',()=>{const g=geometry(4000,4000,'fit');assert.equal(g.dw,550);assert.equal(g.dh,550);assert.equal(g.dx,685);});
test('invalid dimensions and excessive decoded size are rejected',()=>{for(const dimensions of [[0,1],[NaN,1],[100000,100000]])assert.throws(()=>geometry(...dimensions));});

test('oversized image headers are rejected before browser decoding',()=>{const {sourceDimensions}=require('../studio/image-converter.js');const b=Buffer.alloc(24);b[0]=137;b.write('PNG',1);b.writeUInt32BE(100000,16);b.writeUInt32BE(100000,20);assert.throws(()=>sourceDimensions(b),/32 million/);assert.throws(()=>sourceDimensions(Buffer.from('<svg/>')),/valid/);});
