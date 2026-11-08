// Deterministic, bounded, data-free school. Ocean coordinates are the current paper island's local x/z.
const clamp=(x,min,max)=>Math.max(min,Math.min(max,x));
const tau=Math.PI*2;
export function seaRadius(x,z,bounds){
  if(!Number.isFinite(x)||!Number.isFinite(z)||!bounds||bounds.rx<=0||bounds.rz<=0)return Infinity;
  return Math.hypot(x/bounds.rx,z/bounds.rz);
}
export function createFishSchool(bounds,count=8){
  const n=clamp(Math.floor(Number.isFinite(count)?count:0),0,12);
  let fear=null,scares=0;
  function sample(time=0){
    const t=Number.isFinite(time)?time:0;
    const decay=fear?clamp(1-(t-fear.time)/3.6,0,1)**2:0;
    return Array.from({length:n},(_,i)=>{
      const shoal=Math.floor(i/4),member=i%4,groups=Math.max(1,Math.ceil(n/4));
      const a=shoal*tau/groups+(member-1.5)*.105+Math.sin(i*7.13)*.025+t*(.09+.008*shoal);
      const lane=1.33+.12*Math.sin(shoal*2.4)+.06*Math.cos(member*1.9);
      let x=Math.cos(a)*bounds.rx*lane,z=Math.sin(a)*bounds.rz*lane;
      let heading=Math.atan2(-Math.sin(a)*bounds.rx,Math.cos(a)*bounds.rz);
      if(decay>0){
        const dx=x-fear.x,dz=z-fear.z,dist=Math.hypot(dx,dz);
        if(dist<2.2){
          const force=(1-dist/2.2)*decay*.66;
          const ux=dist>.03?dx/dist:Math.cos(a),uz=dist>.03?dz/dist:Math.sin(a);
          x+=ux*force;z+=uz*force;
          let r=seaRadius(x,z,bounds);
          if(r<1.10){const k=1.10/r;x*=k;z*=k;}
          r=seaRadius(x,z,bounds);
          if(r>1.92){const k=1.92/r;x*=k;z*=k;}
          heading=Math.atan2(ux,uz);
        }
      }
      return {x,z,heading,size:.12+.045*(.5+.5*Math.sin(i*2.13)),kind:i%3};
    });
  }
  return {
    count:n,
    sample,
    scare(x,z,time){
      const r=seaRadius(x,z,bounds);
      if(!Number.isFinite(time)||r<1.07||r>2.3)return false;
      fear={x,z,time};scares++;return true;
    },
    diagnostics(){return {count:n,scares,active:!!fear,activeUntil:fear?fear.time+3.6:0};}
  };
}
