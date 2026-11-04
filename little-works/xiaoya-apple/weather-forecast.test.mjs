import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchCityForecast} from './weather-forecast.js';

const now=new Date('2026-11-04T10:00:00');
const city={id:'xian',name:'西安',latitude:34.3416,longitude:108.9398};
function json(){
 return {
  daily:{time:['2026-11-04','2026-11-05'],precipitation_probability_max:[60,85],
   temperature_2m_min:[7,4],temperature_2m_max:[15,13]},
  timezone:'Asia/Shanghai'
 };
}
test('never fetches weather without separate permission',async()=>{
 let called=0;
 const result=await fetchCityForecast({city,now,fetchImpl:async()=>{called++;throw Error('call')}});
 assert.equal(called,0);assert.equal(result,null);
});
test('city-only forecast provider uses coarse grid and expected Open-Meteo daily fields',async()=>{
 let address;
 const fetchImpl=async url=>{address=new URL(url);return new Response(JSON.stringify(json()),{status:200})};
 const f=await fetchCityForecast({city,authorized:true,now,fetchImpl});
 assert.equal(address.hostname,'api.open-meteo.com');
 assert.equal(address.protocol,'https:');
 assert.equal(address.searchParams.get('latitude'),'34.3');
 assert.equal(address.searchParams.get('longitude'),'108.9');
 assert.equal(address.searchParams.get('timezone'),'auto');
 assert.equal(address.searchParams.get('forecast_days'),'4');
 assert.match(address.searchParams.get('daily'),/precipitation_probability_max/);
 assert.equal(f.cityId,'xian');assert.equal(f.days[1].precipitationProbabilityMax,85);
 assert.equal(f.days[1].temperatureMinC,4);
 assert.equal(f.source,'open-meteo');
 assert.equal(f.fetchedAt,now.toISOString());
});
test('malformed dates, bad percentages and mismatched daily arrays fail closed',async()=>{
 for(const daily of [
  {...json().daily,precipitation_probability_max:[140,90]},
  {...json().daily,temperature_2m_min:[7]},
  {...json().daily,time:['2026-11-99','2026-11-05']}
 ]){
  await assert.rejects(fetchCityForecast({city,authorized:true,now,
   fetchImpl:async()=>new Response(JSON.stringify({daily}),{status:200})}),/预报|日期|格式|无效/);
 }
});
test('config rejects missing or unbounded city coordinates without fetching',async()=>{
 for(const incorrect of [{...city,latitude:100},{...city,longitude:Infinity},{...city,name:''}]){
  await assert.rejects(fetchCityForecast({city:incorrect,authorized:true,now,fetchImpl:async()=>{throw Error('should not fetch')}}),/城市|经纬度|位置/);
 }
});
test('network failures do not leak service response details',async()=>{
 await assert.rejects(fetchCityForecast({city,authorized:true,now,
  fetchImpl:async()=>{throw Error('DO_NOT_LEAK_SECRET')}}),err=>{
    assert.ok(!err.message.includes('DO_NOT_LEAK_SECRET'));return true;
  });
});
