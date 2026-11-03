// Original XiaoYa day timeline: functional view geometry, independent of UI CSS.
const escapeHtml=x=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const minute=time=>{const m=String(time||'').match(/^(\d\d?):([0-5]\d)/);if(!m)return 0;return Math.min(1440,Math.max(0,Number(m[1])*60+Number(m[2])))};
const pad=v=>String(v).padStart(2,'0');
const localDay=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());

export function layoutTimelineEvents(events){
  const sorted=events.map((item,index)=>{
    const begin=minute(item.start),end=minute(item.end),rawDuration=end<=begin?end+1440-begin:end-begin;
    const effectiveEnd=Math.min(1440,begin+rawDuration);
    return {...item,originalIndex:index,startMinute:begin,endMinute:effectiveEnd,
      top:begin/1440*100,height:Math.max(1.2,(effectiveEnd-begin)/1440*100),lane:0,lanes:1};
  }).sort((a,b)=>a.startMinute-b.startMinute||a.originalIndex-b.originalIndex);
  const groups=[];let group=[],groupEnd=-1;
  for(const item of sorted){
    if(group.length&&item.startMinute>=groupEnd){groups.push(group);group=[];groupEnd=-1;}
    group.push(item);groupEnd=Math.max(groupEnd,item.endMinute);
  }
  if(group.length)groups.push(group);
  for(const g of groups){
    const laneEnds=[];
    for(const item of g){
      let slot=laneEnds.findIndex(end=>end<=item.startMinute);
      if(slot<0)slot=laneEnds.length;
      item.lane=slot;laneEnds[slot]=item.endMinute;
    }
    for(const item of g)item.lanes=laneEnds.length;
  }
  return sorted;
}
export function buildDayTimeline(events,{date=localDay(new Date()),nowDate=new Date()}={}){
  const positioned=layoutTimelineEvents(events);
  const ticks=Array.from({length:24},(_,h)=>
    '<div class="hour-tick" style="top:'+(h*100/24).toFixed(5)+'%"><span class="hour-label">'+pad(h)+':00</span><span class="hour-line"></span></div>').join('');
  const entries=positioned.map(x=>{
    const top=x.top.toFixed(5),height=x.height.toFixed(5);
    const tip=escapeHtml(x.name)+' '+escapeHtml(x.start)+'–'+escapeHtml(x.end)+' '+escapeHtml(x.place||'');
    return '<button class="native-event '+(x.kind==='course'?'course':'event')+'" style="--top:'+top+';--height:'+height+';--lane:'+x.lane+';--lanes:'+x.lanes+'"'+
      ' data-edit="'+(x.kind==='course'?'course':'event')+'" data-id="'+escapeHtml(x.id)+'" aria-label="'+tip+'" title="'+tip+'">'+
      '<span class="native-event-title">'+escapeHtml(x.name)+'</span>'+
      '<span class="native-event-detail">'+escapeHtml(x.start)+'–'+escapeHtml(x.end)+(x.place?' · '+escapeHtml(x.place):'')+'</span></button>';
  }).join('');
  const today=date===localDay(nowDate);
  const at=nowDate.getHours()*60+nowDate.getMinutes();
  const marker=today?'<div class="native-now" style="--at:'+(at/1440*100).toFixed(5)+'"><b>'+pad(nowDate.getHours())+':'+pad(nowDate.getMinutes())+'</b><span></span></div>':'';
  const placeholder=events.length?'':'<div class="timeline-empty">今天没有安排<br><small>点击右上角「添加活动」创建日程</small></div>';
  return '<div class="native-timeline-scroll" aria-label="24小时时间轴" tabindex="0">'+
    '<div class="native-timeline-canvas">'+ticks+entries+marker+placeholder+'</div></div>';
}
