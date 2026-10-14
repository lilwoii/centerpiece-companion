const aliases={SPX:'^GSPC',SP500:'^GSPC',GSPC:'^GSPC',DJI:'^DJI',IXIC:'^IXIC',BTC:'BTC-USD',BTCUSD:'BTC-USD',ETH:'ETH-USD',ETHUSD:'ETH-USD',SOL:'SOL-USD',SOLUSD:'SOL-USD',DOGE:'DOGE-USD',DOGEUSD:'DOGE-USD',XRP:'XRP-USD',XRPUSD:'XRP-USD',ADA:'ADA-USD',ADAUSD:'ADA-USD',LTC:'LTC-USD',LTCUSD:'LTC-USD',BCH:'BCH-USD',BCHUSD:'BCH-USD',AVAX:'AVAX-USD',AVAXUSD:'AVAX-USD'};
function normalize(value){const s=String(value).trim().toUpperCase().replace(/^[$^]+/,'');if(!/^[A-Z0-9][A-Z0-9.=-]{0,19}$/.test(s))throw Error('Enter a symbol such as AAPL, TSLA or BTCUSD.');return aliases[s]||s;}
function label(symbol){return ({'^GSPC':'SPX','^DJI':'DJI','^IXIC':'IXIC'})[symbol]||symbol.replace(/-USD$/,'USD');}
module.exports={normalize,label};
