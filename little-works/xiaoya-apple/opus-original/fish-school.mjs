// Deterministic, bounded shoals for the paper island. Coordinates are island-local x/z.
// Pure math: safe to run in Node tests and on low-power mobile devices.
const TAU=Math.PI*2;
const finite=Number.isFinite;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const norm=(x,z,b)=>Math.hypot(x/b.rx,z/b.rz);

export function createFishSchool(bounds,count=10){
  if(!(bounds?.rx>0&&bounds?.rz>0))throw Error('Valid island bounds required');
  const total=clamp(Math.trunc(finite(count)?count:0),0,20);
  const families=Math.max(1,Math.ceil(total/4));
  let scarePoint=null,scares=0;
  function sample(time=0){
    const t=finite(time)?time:0;
    return Array.from({length:total},(_,i)=>{
      const family=Math.floor(i/4),slot=i%4;
      const a=family*TAU/families+t*(family%2?-.105:.12)+(slot-1.5)*.042;
      const r=1.40+.095*Math.sin(t*.27+family*2.3)+(slot%2?.04:-.03);
      let x=bounds.rx*Math.cos(a)*r-Math.sin(a)*(slot-1.5)*.22;
      let z=bounds.rz*Math.sin(a)*r+Math.cos(a)*(slot-1.5)*.22;
      let heading=a+Math.PI/2+(family%2?Math.PI:0);
      if(scarePoint){
        const age=t-scarePoint.time;
        if(age>=0&&age<4.0){
          const dx=x-scarePoint.x,dz=z-scarePoint.z,d=Math.hypot(dx,dz);
          if(d<2.5){
            const impulse=(1-d/2.5)*Math.exp(-age*.9)*.82;
            const ux=d>.001?dx/d:Math.cos(a);
            const uz=d>.001?dz/d:Math.sin(a);
            x+=ux*impulse;z+=uz*impulse;
            heading=Math.atan2(uz,ux);
          }
        }
      }
      const e=norm(x,z,bounds);
      if(e<1.085||e>1.94){const s=clamp(e,1.085,1.94)/Math.max(e,.0001);x*=s;z*=s;}
      return {x,z,heading,size:.16+(i%4)*.017};
    });
  }
  function scare(x,z,time){
    if(![x,z,time].every(finite))return false;
    const e=norm(x,z,bounds);
    if(e<1.04||e>2.15)return false;
    scarePoint={x,z,time};scares++;
    return true;
  }
  return {sample,scare,diagnostics:()=>({count:total,scares,lastScare:scarePoint?{...scarePoint}:null})};
}
