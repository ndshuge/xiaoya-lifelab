// Optional city-level Open-Meteo adapter. Never calls geolocation, never fetches unless authorized.
// Coordinates are manually selected by the user and rounded to ~0.1 degree before transmission.
const endpoint='https://api.open-meteo.com/v1/forecast';
const validDay=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&
 Number.isFinite(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
const validPct=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=100;
const validTemp=x=>typeof x==='number'&&Number.isFinite(x)&&x>=-100&&x<=80;
const safeTime=now=>{const t=new Date(now);if(!Number.isFinite(+t))throw Error('时间无效');return t};
function validateCity(city){
 if(!city||typeof city.id!=='string'||!city.id.trim()||city.id.length>80||
   typeof city.name!=='string'||!city.name.trim()||city.name.length>80)
  throw Error('城市必须由用户明确选择');
 if(!Number.isFinite(city.latitude)||city.latitude< -90||city.latitude>90||
    !Number.isFinite(city.longitude)||city.longitude< -180||city.longitude>180)
  throw Error('城市经纬度无效');
}
function sanitizeDaily(json){
 const day=json?.daily;
 if(!day||!['time','precipitation_probability_max','temperature_2m_min','temperature_2m_max']
  .every(k=>Array.isArray(day[k])&&day[k].length>0&&day[k].length<=4))
  throw Error('天气预报格式无效');
 const count=day.time.length;
 if(['precipitation_probability_max','temperature_2m_min','temperature_2m_max']
  .some(k=>day[k].length!==count))throw Error('天气预报日期与数值长度不一致');
 const seen=new Set();
 return day.time.map((date,i)=>{
  if(!validDay(date)||seen.has(date)||!validPct(day.precipitation_probability_max[i])||
    !validTemp(day.temperature_2m_min[i])||!validTemp(day.temperature_2m_max[i])||
    day.temperature_2m_min[i]>day.temperature_2m_max[i])throw Error('天气预报含无效日期或数值');
  seen.add(date);
  return {date,precipitationProbabilityMax:day.precipitation_probability_max[i],
    temperatureMinC:day.temperature_2m_min[i],temperatureMaxC:day.temperature_2m_max[i]};
 });
}
/** Explicit consent to a public forecast request; never inferred from the location of user/browser. */
export async function fetchCityForecast({city,authorized=false,now=new Date(),fetchImpl=globalThis.fetch,signal}={}){
 if(authorized!==true)return null;
 validateCity(city);
 now=safeTime(now);
 if(typeof fetchImpl!=='function')throw Error('天气网络接口不可用');
 const latitude=Math.round(city.latitude*10)/10;
 const longitude=Math.round(city.longitude*10)/10;
 const qs=new URLSearchParams({
  latitude:String(latitude),longitude:String(longitude),
  daily:'precipitation_probability_max,temperature_2m_min,temperature_2m_max',
  timezone:'auto',forecast_days:'4'
 });
 let response;
 try{response=await fetchImpl(endpoint+'?'+qs.toString(),{method:'GET',signal})}
 catch{throw Error('天气服务连接失败，请稍后重试')}
 if(!response?.ok)throw Error('天气服务暂时不可用');
 let value;
 try{
  const text=await response.text();
  if(text.length>65_536)throw Error('large');
  value=JSON.parse(text);
 }catch{throw Error('天气预报返回格式无效')}
 return {source:'open-meteo',cityId:city.id,cityLabel:city.name,fetchedAt:now.toISOString(),
  days:sanitizeDaily(value)};
}
