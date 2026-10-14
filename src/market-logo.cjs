const fs=require('node:fs'),path=require('node:path');
const brands={AAPL:'apple',NVDA:'nvidia',TSLA:'tesla',GOOG:'google',GOOGL:'google',META:'meta','BTC-USD':'bitcoin','ETH-USD':'ethereum','SOL-USD':'solana','DOGE-USD':'dogecoin','XRP-USD':'ripple',COIN:'coinbase',NFLX:'netflix',INTC:'intel',AMD:'amd'};
const colors={apple:'#F5F5F7',nvidia:'#76B900',tesla:'#E82127',google:'#4285F4',meta:'#0866FF',bitcoin:'#F7931A',ethereum:'#8C8CFF',solana:'#14F195',dogecoin:'#C2A633',ripple:'#EAF1FF',coinbase:'#3478FF',netflix:'#E50914',intel:'#00C7FD',amd:'#ED1C24'};
const cache=new Map();function logo(symbol){const name=brands[symbol];if(!name)return null;if(!cache.has(name)){try{cache.set(name,'data:image/svg+xml;base64,'+Buffer.from(fs.readFileSync(path.join(__dirname,'assets/market-logos',name+'.svg'),'utf8').replace('<svg ','<svg fill="'+colors[name]+'" ')).toString('base64'));}catch{return null;}}return cache.get(name);}
module.exports={logo};
