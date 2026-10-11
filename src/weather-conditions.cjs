// Quantities describe the same current interval, not a rain probability.
function wet(v){return Number.isFinite(v)&&v>0;}
function conditions(code,isDay=true,current={}){
 if([95,96,99].includes(code))return ['Thunderstorm','storm'];
 const snow=wet(current.snowfall),rain=wet(current.rain)||wet(current.showers);
 if(snow&&rain)return ['Rain & snow','snow'];
 if(snow)return ['Snow','snow'];
 if([71,73,75,77,85,86].includes(code))return ['Snow','snow'];
 if([56,57,66,67].includes(code))return ['Freezing rain','rain'];
 if(rain)return ['Rain','rain'];
 if([51,53,55].includes(code))return ['Drizzle','rain'];
 if([61,63,65,80,81,82].includes(code))return ['Rain','rain'];
 if(code===0)return isDay?['Sunny','sun']:['Clear night','moon'];
 if(code===1||code===2)return isDay?['Partly cloudy','partly']:['Partly cloudy','night-cloud'];
 if(code===3)return ['Overcast','cloud'];
 if([45,48].includes(code))return ['Fog','fog'];
 return ['Unavailable',null];
}
function stormForecast(hourly,now=Date.now()){
 if(!Array.isArray(hourly?.time)||!Array.isArray(hourly?.weather_code))return null;
 const times=hourly.time.slice(0,24).filter((t,i)=>Number.isFinite(t)&&t*1000>now&&t*1000<=now+3*3600000&&[95,96,99].includes(hourly.weather_code[i]));
 return times.length?Math.min(...times)*1000:null;
}
module.exports={conditions,stormForecast};
