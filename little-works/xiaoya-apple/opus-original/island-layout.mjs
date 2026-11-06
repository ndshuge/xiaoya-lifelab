// Small, deterministic layout and navigation for the island's actual ground plane.
export function islandLayout(n=7,portrait=false){
 const cols=portrait?2:n>7?3:4,rows=Math.ceil(n/cols);
 const rx=portrait?2.48:4.65,rz=portrait?(n>7?5.0:4.15):(n>7?3.25:2.7);
 const points=[];
 for(let i=0;i<n;i++){
  const row=Math.floor(i/cols),count=Math.min(cols,n-row*cols),col=i%cols;
  points.push({x:(col-(count-1)/2)*(portrait?1.78:n>7?2.4:1.9),z:(row-(rows-1)/2)*(portrait?1.72:n>7?1.65:1.9)});
 }
 return {rx,rz,points,portrait};
}
export function insideLand(p,bounds,margin=.18){return (p.x/(bounds.rx*.92-margin))**2+(p.z/(bounds.rz*.92-margin))**2<1;}
export function clearPoint(p,bounds,obstacles,radius=.25){return insideLand(p,bounds,radius)&&obstacles.every(o=>Math.hypot(p.x-o.x,p.z-o.z)>o.r+radius);}
export function nearestOpenPoint(target,bounds,obstacles,radius=.25){
 let best=null,distance=Infinity;
 for(let z=-bounds.rz;z<=bounds.rz;z+=.14)for(let x=-bounds.rx;x<=bounds.rx;x+=.14){const p={x,z};if(!clearPoint(p,bounds,obstacles,radius+.03))continue;const d=(x-target.x)**2+(z-target.z)**2;if(d<distance){distance=d;best=p}}
 return best;
}
export function clearSegment(a,b,bounds,obstacles,radius=.25){
 const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.07));
 for(let i=0;i<=n;i++)if(!clearPoint({x:a.x+(b.x-a.x)*i/n,z:a.z+(b.z-a.z)*i/n},bounds,obstacles,radius))return false;
 return true;
}
export function planIslandPath(start,target,bounds,obstacles,radius=.25){
 const step=.18,w=Math.ceil(bounds.rx*2/step)+1,h=Math.ceil(bounds.rz*2/step)+1,total=w*h;
 const point=i=>({x:(i%w)*step-bounds.rx,z:Math.floor(i/w)*step-bounds.rz});
 const free=new Uint8Array(total);let a=-1,b=-1,ad=Infinity,bd=Infinity;
 for(let i=0;i<total;i++){const p=point(i);if(!clearPoint(p,bounds,obstacles,radius+.025))continue;free[i]=1;const da=(p.x-start.x)**2+(p.z-start.z)**2,db=(p.x-target.x)**2+(p.z-target.z)**2;if(da<ad&&clearSegment(start,p,bounds,obstacles,radius)){a=i;ad=da}if(db<bd){b=i;bd=db}}
 if(a<0||b<0)return [];
 if(clearSegment(start,target,bounds,obstacles,radius))return [{...target}];
 const costs=new Float64Array(total).fill(Infinity),prev=new Int32Array(total).fill(-1),closed=new Uint8Array(total),open=[a];costs[a]=0;
 const goal=point(b),heuristic=i=>Math.hypot(point(i).x-goal.x,point(i).z-goal.z);
 let nearest=a,remaining=heuristic(a);
 while(open.length){
  let best=0;for(let k=1;k<open.length;k++)if(costs[open[k]]+heuristic(open[k])<costs[open[best]]+heuristic(open[best]))best=k;
  const cur=open.splice(best,1)[0];if(heuristic(cur)<remaining){nearest=cur;remaining=heuristic(cur);}if(cur===b)break;if(closed[cur])continue;closed[cur]=1;
  const x=cur%w,z=Math.floor(cur/w);
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){
   const nx=x+dx,nz=z+dz;if(nx<0||nx>=w||nz<0||nz>=h)continue;const next=nz*w+nx;if(!free[next]||closed[next])continue;
   if(dx&&dz&&(!free[z*w+nx]||!free[nz*w+x]))continue;
   const cost=costs[cur]+step*Math.hypot(dx,dz);if(cost>=costs[next])continue;costs[next]=cost;prev[next]=cur;open.push(next);
  }
 }
 // A rabbit or a row of hanging signs can isolate a patch. Walk to the closest
 // reachable edge instead of ignoring the user's tap or crossing a solid prop.
 if(b!==a&&prev[b]<0)b=nearest;
 const chain=[];for(let i=b;i!==-1;i=prev[i]){chain.push(point(i));if(i===a)break}chain.reverse();
 // Keep exact start and shorten only where the full segment has clearance.
 const out=[];let current={...start},i=0;
 while(i<chain.length){let far=i;for(let j=i;j<chain.length;j++)if(clearSegment(current,chain[j],bounds,obstacles,radius))far=j;const p=chain[far];if(!clearSegment(current,p,bounds,obstacles,radius))return out;out.push(p);current=p;i=far+1;}
 return out;
}
export function flagState({items=[],due=[],pencilIds=[]}={}){
 if(items.some(x=>x.conflict)||due.some(x=>x.urgent&&!x.done))return 'attention';
 return items.length||due.some(x=>!x.done)||pencilIds.length?'busy':'empty';
}
export function flagRows(day,limit=3){
 const rows=[...(day.items||[]).map(it=>({kind:it.kind,id:it.id,title:it.title,time:it.start,attention:!!it.conflict,...it})),...(day.due||[]).filter(t=>!t.done).map(t=>({kind:'task',id:t.id,title:t.title,time:t.time,attention:!!t.urgent}))];
 rows.sort((a,b)=>String(a.time||a.start||'').localeCompare(String(b.time||b.start||'')));
 if(rows.length<=limit)return rows;
 return [...rows.slice(0,Math.max(0,limit-1)),{kind:'summary',title:'另有 '+(rows.length-limit+1)+' 件',count:rows.length-limit+1}];
}
