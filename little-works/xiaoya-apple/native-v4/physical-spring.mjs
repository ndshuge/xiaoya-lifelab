// Physics-sampled springs for compositor-friendly Web Animations.
// Based on a damped second-order oscillator, not a two-stop cubic tween.
// Sample once, then leave transform interpolation to WAAPI.
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
export function springProgress(t,{response=.55,damping=.8}={}){
 const z=clamp(damping,.05,.995);
 const omega=2*Math.PI/Math.max(.12,response);
 const damped=omega*Math.sqrt(1-z*z);
 return 1-Math.exp(-z*omega*t)*(Math.cos(damped*t)+(z/Math.sqrt(1-z*z))*Math.sin(damped*t));
}
export function springTranslations(from,to,{duration=700,response=.55,damping=.8,axis='y'}={}){
 const count=Math.ceil(duration/16);
 const translate=v=>axis==='x'?'translate3d('+v.toFixed(3)+'px,0,0)':'translate3d(0,'+v.toFixed(3)+'px,0)';
 const frames=[];
 for(let j=0;j<=count;j++){
  const offset=j/count,progress=springProgress(offset*duration/1000,{response,damping});
  const v=j===count?to:from+(to-from)*progress;
  frames.push({offset,transform:translate(v)});
 }
 return frames;
}
