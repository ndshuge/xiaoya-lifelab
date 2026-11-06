// 小芽的立体书 · Paper pop-up island for one week, rendered with Three.js (r180, vendored).
// Every object maps to a real record: courses = houses, events = tents, deadlines = lighthouses,
// free time = meadow, goals = trees (grown only by real check-ins), Xiaoya's pencils = dashed stepping stones.
// The scene is a view: picking an object calls onPick and the 2D page handles it.
import * as THREE from './vendor/three/three.module.min.js';

const C={paper:0xf4ecd9,page:0xf7f1e3,pageEdge:0xe6dcc5,spine:0x2b3243,sea:0xcfe1e2,seaLine:0xe6f0ef,sand:0xe9d9b3,
 grass1:0x9fb78a,grass2:0xbcd0a3,path:0xf7f0df,ink:0x2b3243,wall:0xf6efe0,roof:0x3b4458,tent:0xd98b6a,today:0xd98b6a,
 stop:0xfaf5ea,lamp:0xf2c46d,alarm:0xc8553d,pencil:0x8a8f99,leaf:0x88a675,leaf2:0xa5bf8f,trunk:0x9c7b5b,cloud:0xfbf8f1};
const easeBack=t=>{const c1=1.5,c3=c1+1;return 1+c3*Math.pow(t-1,3)+c1*Math.pow(t-1,2)};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function paperTexture(base='#f4ecd9',grain=10){
 const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');
 g.fillStyle=base;g.fillRect(0,0,256,256);
 const img=g.getImageData(0,0,256,256);let s=7;const rnd=()=>{s=(s*16807)%2147483647;return s/2147483647};
 for(let i=0;i<img.data.length;i+=4){const n=(rnd()-.5)*grain;img.data[i]+=n;img.data[i+1]+=n;img.data[i+2]+=n}
 g.putImageData(img,0,0);
 for(let i=0;i<60;i++){g.strokeStyle='rgba(120,100,70,'+(0.03+rnd()*0.04)+')';g.lineWidth=.6;g.beginPath();const x=rnd()*256,y=rnd()*256;g.moveTo(x,y);g.lineTo(x+(rnd()-.5)*30,y+(rnd()-.5)*8);g.stroke()}
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;
}
function labelTexture(lines,{w=256,h=128,bg='#faf5ea',fg='#2b3243',accent=null}={}){
 const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');
 g.fillStyle=bg;g.fillRect(0,0,w,h);if(accent){g.fillStyle=accent;g.fillRect(0,0,w,8)}
 g.fillStyle=fg;g.textAlign='center';g.textBaseline='middle';
 const font='"Noto Serif SC","Songti SC","SimSun",serif';
 if(lines.length===1){g.font='700 '+Math.round(h*.46)+'px '+font;g.fillText(lines[0],w/2,h/2+2)}
 else{g.font='600 '+Math.round(h*.3)+'px '+font;g.fillText(lines[0],w/2,h*.34);g.font='700 '+Math.round(h*.38)+'px '+font;g.fillText(lines[1],w/2,h*.72)}
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
}
function blobShape(radius,seed=3,points=28,wobble=.16){
 const s=new THREE.Shape();let r=seed;const rnd=()=>{r=(r*9301+49297)%233280;return r/233280};
 const offs=Array.from({length:points},()=>1+(rnd()-.5)*wobble*2);
 for(let i=0;i<=points;i++){const a=i/points*Math.PI*2,k=offs[i%points],x=Math.cos(a)*radius*k*1.18,y=Math.sin(a)*radius*k*.82;i?s.lineTo(x,y):s.moveTo(x,y)}
 return s;
}
function layer(shape,depth,color,y,mat){
 const geo=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:24});geo.rotateX(-Math.PI/2);
 const m=new THREE.Mesh(geo,mat||new THREE.MeshLambertMaterial({color}));m.position.y=y;m.castShadow=true;m.receiveShadow=true;return m;
}

export function createIsland(host,{onPick=()=>{},reduced=()=>false,faceUrl='',faces={}}={}){
 let renderer;
 try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'})}catch(e){host.dataset.webgl='off';return null}
 renderer.setPixelRatio(Math.min(matchMedia('(pointer: coarse)').matches?1.5:2,window.devicePixelRatio||1));
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 renderer.domElement.className='island-canvas';renderer.domElement.setAttribute('aria-hidden','true');
 host.append(renderer.domElement);
 const scene=new THREE.Scene();
 const camera=new THREE.PerspectiveCamera(32,1,.1,100);
 const hemi=new THREE.HemisphereLight(0xfff8ec,0xc9bda6,1.55);scene.add(hemi);
 const sun=new THREE.DirectionalLight(0xfff1dc,1.65);sun.position.set(-5,9,6);sun.castShadow=true;
 sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-8,right:8,top:8,bottom:-8,near:1,far:30});sun.shadow.bias=-.0008;scene.add(sun);
 const loader=new THREE.TextureLoader();
 const paperTex=paperTexture();paperTex.repeat.set(3,2);

 // ---------- the book (static) ----------
 const book=new THREE.Group();scene.add(book);
 const pageMat=new THREE.MeshLambertMaterial({color:C.page,map:paperTex});
 const edgeMat=new THREE.MeshLambertMaterial({color:C.pageEdge});
 for(const side of [-1,1]){
  const p=new THREE.Mesh(new THREE.BoxGeometry(6.4,.22,7.2),[edgeMat,edgeMat,pageMat,edgeMat,edgeMat,edgeMat]);
  p.position.set(side*3.25,-.11,0);p.rotation.z=side*.035;p.receiveShadow=true;book.add(p);
 }
 const spine=new THREE.Mesh(new THREE.CylinderGeometry(.16,.16,7.3,16),new THREE.MeshLambertMaterial({color:C.spine}));spine.rotation.x=Math.PI/2;spine.position.y=-.2;book.add(spine);
 // Cover, hinged at the spine, used by the opening.
 const coverPivot=new THREE.Group();coverPivot.position.set(0,.02,0);book.add(coverPivot);
 const coverMat=new THREE.MeshLambertMaterial({color:0x3b5a46});
 const coverFace=new THREE.MeshLambertMaterial({map:labelTexture(['小芽'],{w:512,h:256,bg:'#3b5a46',fg:'#f4ecd9'})});
 const cover=new THREE.Mesh(new THREE.BoxGeometry(6.6,.14,7.4),[coverMat,coverMat,coverFace,coverMat,coverMat,coverMat]);
 cover.position.set(3.3,.08,0);cover.castShadow=true;coverPivot.add(cover);coverPivot.visible=false;

 // ---------- dynamic world ----------
 const world=new THREE.Group();scene.add(world);
 const pickables=[];
 const pops=[];          // {obj, delay, dur, start}
 let known=new Set(),firstBuild=true,animating=false,clock=0,last=performance.now();
 const mat=(color,opts={})=>new THREE.MeshLambertMaterial({color,...opts});
 // Pop-up: the piece starts folded flat (tilted back about its base) and springs upright.
 // The fold is relative to the piece's own resting rotation, so flat pieces (sea, rings) stay flat.
 function pop(obj,delay,key){obj.userData.popKey=key;obj.userData.base=obj.scale.clone();obj.userData.baseRotX=obj.rotation.x;
  if(reduced()||(!firstBuild&&known.has(key)))return;
  obj.scale.set(obj.scale.x,.001,obj.scale.z);obj.rotation.x=obj.userData.baseRotX-1.1;pops.push({obj,delay,dur:.62,t:0});animating=true}
 function pickable(obj,data){obj.userData.pick=data;obj.traverse(o=>{if(o.isMesh){o.userData.pick=data;pickables.push(o)}})}
 function house(color=C.wall,roof=C.roof){const g=new THREE.Group();
  const body=new THREE.Mesh(new THREE.BoxGeometry(.34,.26,.3),mat(color));body.position.y=.13;
  const r=new THREE.Mesh(new THREE.CylinderGeometry(.01,.27,.2,4,1),mat(roof,{flatShading:true}));r.rotation.y=Math.PI/4;r.position.y=.36;
  const door=new THREE.Mesh(new THREE.PlaneGeometry(.08,.12),mat(C.ink));door.position.set(0,.07,.151);
  [body,r].forEach(m=>{m.castShadow=true;m.receiveShadow=true});g.add(body,r,door);return g}
 function tent(){const g=new THREE.Group();const c=new THREE.Mesh(new THREE.ConeGeometry(.22,.34,4),mat(C.tent,{flatShading:true}));c.position.y=.17;c.rotation.y=Math.PI/4;c.castShadow=true;
  const f=new THREE.Mesh(new THREE.PlaneGeometry(.12,.07),mat(C.alarm,{side:THREE.DoubleSide}));f.position.set(.06,.42,0);const pole=new THREE.Mesh(new THREE.CylinderGeometry(.008,.008,.16),mat(C.ink));pole.position.set(0,.4,0);g.add(c,pole,f);return g}
 function lighthouse(state){const g=new THREE.Group();
  const a=new THREE.Mesh(new THREE.CylinderGeometry(.075,.1,.24,12),mat(C.wall));a.position.y=.12;
  const b=new THREE.Mesh(new THREE.CylinderGeometry(.07,.075,.12,12),mat(state==='done'?C.pencil:C.alarm));b.position.y=.3;
  const lampColor=state==='urgent'?C.alarm:state==='done'?0xb9b9b9:C.lamp;
  const lamp=new THREE.Mesh(new THREE.SphereGeometry(.06,12,8),new THREE.MeshBasicMaterial({color:lampColor}));lamp.position.y=.41;
  const cap=new THREE.Mesh(new THREE.ConeGeometry(.08,.08,12),mat(C.ink));cap.position.y=.49;
  [a,b,cap].forEach(m=>{m.castShadow=true});g.add(a,b,lamp,cap);
  if(state==='urgent'){const glow=new THREE.PointLight(C.alarm,1.2,1.4);glow.position.y=.42;g.add(glow);g.userData.blink=lamp}
  return g}
 function tree(level,pencil){const g=new THREE.Group();
  const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.03,.04,.22,6),mat(C.trunk));trunk.position.y=.11;g.add(trunk);
  if(pencil){const cone=new THREE.ConeGeometry(.2,.4,6);const e=new THREE.LineSegments(new THREE.EdgesGeometry(cone),new THREE.LineDashedMaterial({color:C.pencil,dashSize:.04,gapSize:.03}));
   e.computeLineDistances();e.position.y=.4;g.add(e);return g}
  for(let i=0;i<level;i++){const c=new THREE.Mesh(new THREE.ConeGeometry(.24-i*.04,.26,7),mat(i%2?C.leaf2:C.leaf,{flatShading:true}));c.position.y=.3+i*.15;c.castShadow=true;g.add(c)}
  return g}
 function stone(){const g=new THREE.Group();const box=new THREE.BoxGeometry(.34,.04,.24);
  const fill=new THREE.Mesh(box,new THREE.MeshBasicMaterial({color:C.pencil,transparent:true,opacity:.14}));
  const edge=new THREE.LineSegments(new THREE.EdgesGeometry(box),new THREE.LineDashedMaterial({color:0x5a606b,dashSize:.035,gapSize:.025}));edge.computeLineDistances();
  g.add(fill,edge);return g}
 function cloud(){const g=new THREE.Group();const m=mat(C.cloud,{transparent:true,opacity:.92});
  for(const [x,r] of [[-.3,.22],[0,.3],[.32,.2]]){const s=new THREE.Mesh(new THREE.CircleGeometry(r,20),m);s.position.x=x;g.add(s)}
  g.rotation.x=-Math.PI/2;return g}

 let island=null,path=null,xiaoya=null,xiaoyaHome=new THREE.Vector3(),clouds=[];
 const faceTex={};
 function face(n){if(!faceTex[n]&&faces[n]){faceTex[n]=loader.load(faces[n]);faceTex[n].colorSpace=THREE.SRGBColorSpace}return faceTex[n]}
 function clearWorld(){for(const o of [...world.children]){world.remove(o);o.traverse(x=>{x.geometry?.dispose();(Array.isArray(x.material)?x.material:[x.material]).forEach(m=>{if(m&&m.map&&!Object.values(faceTex).includes(m.map)&&m.map!==paperTex)m.map.dispose();m?.dispose?.()})})}pickables.length=0}

 /** Rebuild from a week model. Only objects whose key is new pop up after the first build. */
 function update(model){
  const keys=new Set();clearWorld();
  const k=s=>{keys.add(s);return s};
  const sea=new THREE.Mesh(new THREE.CircleGeometry(4.3,64),mat(C.sea));sea.rotation.x=-Math.PI/2;sea.position.y=.005;sea.receiveShadow=true;sea.scale.set(1.15,1,.8);world.add(sea);pop(sea,0,k('sea'));
  for(const [r,o] of [[3.75,.6],[4.05,.45]]){const ring=new THREE.Mesh(new THREE.RingGeometry(r,r+.035,96),new THREE.MeshBasicMaterial({color:C.seaLine,transparent:true,opacity:o}));ring.rotation.x=-Math.PI/2;ring.position.y=.012;ring.scale.set(1.15,1,.8);world.add(ring)}
  const base=blobShape(2.9,11);island=new THREE.Group();
  island.add(layer(base,.1,C.sand,0));island.add(layer(blobShape(2.75,11),.12,C.grass1,.1));island.add(layer(blobShape(2.55,11),.08,C.grass2,.22,mat(C.grass2,{map:paperTex})));
  world.add(island);pop(island,.05,k('island'));
  // Path through seven day stops (an S across the island).
  const pts=[[-2.55,.5],[-1.75,-.55],[-.85,.35],[0,-.6],[.85,.35],[1.75,-.55],[2.55,.45]].map(([x,z])=>new THREE.Vector3(x,.31,z*1.05));
  const curve=new THREE.CatmullRomCurve3(pts);path=new THREE.Group();
  for(let i=0;i<=56;i++){const p=curve.getPoint(i/56),t=curve.getTangent(i/56);const tile=new THREE.Mesh(new THREE.BoxGeometry(.13,.02,.09),mat(C.path));tile.position.copy(p);tile.rotation.y=Math.atan2(t.x,t.z);tile.receiveShadow=true;path.add(tile)}
  world.add(path);pop(path,.25,k('path'));
  model.days.forEach((d,i)=>{
   const g=new THREE.Group();const at=pts[i];g.position.copy(at);
   const disc=new THREE.Mesh(new THREE.CylinderGeometry(d.isToday?.3:.24,d.isToday?.3:.24,.05,28),mat(d.isToday?C.today:C.stop));disc.position.y=.02;disc.receiveShadow=true;g.add(disc);
   const flag=new THREE.Mesh(new THREE.PlaneGeometry(.66,.34),new THREE.MeshBasicMaterial({map:labelTexture([d.label,String(d.dom)],{w:384,h:192,accent:d.isToday?'#d98b6a':'#2b3243',bg:d.isToday?'#fff6ea':'#faf5ea'}),side:THREE.DoubleSide}));
   flag.geometry.translate(.33,0,0); // hinge on the pole like a real flag, so the pole never covers the date
   flag.position.set(0,.92,0);const pole=new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,.74),mat(C.ink));pole.position.y=.56;g.add(pole,flag);g.userData.flag=flag;
   if(d.isToday){const halo=new THREE.Mesh(new THREE.RingGeometry(.36,.42,40),new THREE.MeshBasicMaterial({color:C.today,transparent:true,opacity:.55}));halo.rotation.x=-Math.PI/2;halo.position.y=.05;g.add(halo);g.userData.halo=halo}
   pickable(g,{kind:'day',date:d.key});
   world.add(g);pop(g,.35+i*.07,k('day:'+d.key));
   // Buildings around the stop: courses = houses, events = tents.
   const ring=(n,idx,rad=.55)=>{const a=(idx/Math.max(1,n))*Math.PI*1.2+(i%2?Math.PI*.9:-Math.PI*.15);return [Math.cos(a)*rad,Math.sin(a)*rad*.8]};
   const items=d.items.slice(0,5);
   items.forEach((it,j)=>{const b=it.kind==='course'?house():tent();b.scale.setScalar(1.5);const [x,z]=ring(items.length,j,.62);b.position.set(at.x+x,.3,at.z+z);
    if(it.conflict){const pen=new THREE.Mesh(new THREE.PlaneGeometry(.1,.06),mat(C.alarm,{side:THREE.DoubleSide}));pen.position.set(0,.55,0);b.add(pen)}
    pickable(b,{kind:it.kind,id:it.id,date:d.key,recurring:it.recurring,occurrenceDate:it.occurrenceDate});world.add(b);pop(b,.6+i*.07+j*.05,k(it.kind+':'+it.id+'@'+d.key))});
   // Deadlines = lighthouses on the shore side of the stop.
   d.due.slice(0,3).forEach((t,j)=>{const l=lighthouse(t.done?'done':t.urgent?'urgent':'later');l.scale.setScalar(1.6);const side=i%2?-1:1;l.position.set(at.x+(j-.5*(Math.min(3,d.due.length)-1))*.34,.3,at.z+side*.7);
    pickable(l,{kind:'task',id:t.id});world.add(l);pop(l,.7+i*.07+j*.05,k('due:'+t.id))});
   // Free time = meadow tufts (one per free hour, at most six).
   const tufts=Math.min(6,Math.round(d.freeMinutes/60));
   for(let j=0;j<tufts;j++){const tuft=new THREE.Mesh(new THREE.ConeGeometry(.035,.12,5),mat(j%2?C.leaf:C.leaf2));const a=j*1.7+i,r=.32+((j*37)%10)/40;tuft.position.set(at.x+Math.cos(a)*r,.36,at.z+Math.sin(a)*r*.7);world.add(tuft)}
   // Xiaoya's pencil proposals on this day = dashed stepping stones.
   d.pencilIds.slice(0,3).forEach((id,j)=>{const s=stone();s.scale.setScalar(1.35);s.position.set(at.x+(j-1)*.4,.36,at.z+(i%2?.42:-.42));s.rotation.y=.2*j;pickable(s,{kind:'pencil',id,date:d.key});world.add(s);pop(s,.9+i*.06+j*.05,k('pencil:'+id))});
  });
  // Goals = trees around the rim; growth comes only from real check-ins.
  model.goals.slice(0,8).forEach((g,j)=>{const level=g.checkins?clamp(1+Math.floor(g.checkins/2),1,4):0;const t=tree(level,!g.checkins);t.scale.setScalar(1.45);
   const a=Math.PI*(1.12+j*.11),x=Math.cos(a)*2.45*1.1,z=-Math.abs(Math.sin(a))*2.05*.95-.15;t.position.set(x,.3,z);pickable(t,{kind:'goal',id:g.id});world.add(t);pop(t,1.1+j*.06,k('goal:'+g.id+':'+level))});
  // Clouds.
  clouds=[];[[-3.2,2.2,-2.4],[2.9,2.6,-2.8],[.4,2.9,-3.4]].forEach(([x,y,z],j)=>{const c=cloud();c.position.set(x,y,z);world.add(c);clouds.push(c)});
  // Xiaoya: a paper standee that faces the camera, standing at her point of attention.
  const tex=face(model.xiaoyaFace||4);
  const stand=new THREE.Group();
  const card=new THREE.Mesh(new THREE.PlaneGeometry(1.15,1.15),new THREE.MeshLambertMaterial({map:tex,transparent:true,alphaTest:.08,side:THREE.DoubleSide}));card.position.y=.6;card.castShadow=true;
  const foot=new THREE.Mesh(new THREE.CylinderGeometry(.16,.18,.04,20),mat(C.paper));foot.position.y=.02;
  stand.add(card,foot);const idx=Math.max(0,model.days.findIndex(d=>d.isToday));const focus=pts[model.attentionDay??idx]||pts[idx];
  xiaoyaHome.set(focus.x+.38,.31,focus.z+.18);stand.position.copy(xiaoyaHome);stand.userData.card=card;
  pickable(stand,{kind:'xiaoya'});world.add(stand);xiaoya=stand;pop(stand,1.35,k('xiaoya'));
  known=keys;firstBuild=false;frame();
 }

 // ---------- camera & interaction ----------
 let yaw=0,targetYaw=0,parallaxX=0,parallaxY=0,camDist=1;
 function fit(){
  const w=host.clientWidth||1,h=host.clientHeight||1;renderer.setSize(w,h,false);camera.aspect=w/h;
  camDist=clamp(1.22/camera.aspect,0.8,2.8);camera.updateProjectionMatrix();placeCamera();frame();
 }
 // ~52° looking down: the island reads as a whole diorama sitting on the open book.
 const camBase={y:8.4,z:6.6};
 function placeCamera(){camera.position.set(Math.sin(parallaxX*.08)*1.2,camBase.y*camDist+parallaxY*.25,camBase.z*camDist);camera.lookAt(0,.1,.35)}
 const ray=new THREE.Raycaster(),ptr=new THREE.Vector2();
 let down=null,hover=null;
 function hit(e){const r=renderer.domElement.getBoundingClientRect();ptr.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(ptr,camera);return ray.intersectObjects(pickables,false)[0]?.object?.userData?.pick||null}
 renderer.domElement.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY,yaw:targetYaw,moved:false};renderer.domElement.setPointerCapture?.(e.pointerId)});
 renderer.domElement.addEventListener('pointermove',e=>{
  const r=renderer.domElement.getBoundingClientRect();
  if(down){const dx=e.clientX-down.x;if(Math.abs(dx)>6)down.moved=true;targetYaw=clamp(down.yaw+dx/r.width*1.6,-.7,.7);frame();return}
  if(e.pointerType==='mouse'){parallaxX=(e.clientX-r.left)/r.width*2-1;parallaxY=(e.clientY-r.top)/r.height*2-1;const p=hit(e);if(p!==hover){hover=p;renderer.domElement.style.cursor=p?'pointer':'grab'}frame()}
 });
 renderer.domElement.addEventListener('pointerup',e=>{const d=down;down=null;if(d&&!d.moved){const p=hit(e);if(p){if(xiaoya&&p.kind==='xiaoya')hop=1;onPick(p)}}});
 renderer.domElement.addEventListener('pointercancel',()=>{down=null});
 renderer.domElement.style.touchAction='pan-y';

 // ---------- animation loop ----------
 let raf=0,visible=true,hop=0,opening=null;
 function frame(){if(!raf&&visible)raf=requestAnimationFrame(tick)}
 function tick(now){
  raf=0;const dt=Math.min(.05,(now-last)/1000);last=now;clock+=dt;
  let busy=false;
  for(const p of pops){if(p.done)continue;p.t+=dt;const u=clamp((p.t-p.delay)/p.dur,0,1);if(u<1)busy=true;else p.done=true;
   const e=u<=0?0:easeBack(u),b=p.obj.userData.base;p.obj.scale.set(b.x,Math.max(.001,b.y*e),b.z);p.obj.rotation.x=p.obj.userData.baseRotX-1.1*(1-clamp(u*1.4,0,1))}
  if(!busy)pops.length=0;
  if(opening){busy=opening(dt)||busy}
  yaw+=(targetYaw-yaw)*Math.min(1,dt*8);world.rotation.y=yaw;if(Math.abs(targetYaw-yaw)>.001)busy=true;
  if(!reduced()){
   for(const [j,c] of clouds.entries()){c.position.x+=dt*.06*(j%2?-1:1);if(c.position.x>4)c.position.x=-4;if(c.position.x<-4)c.position.x=4}
   if(xiaoya){const card=xiaoya.userData.card;card.position.y=.6+Math.sin(clock*2.2)*.025+(hop>0?Math.sin(hop*Math.PI)*.25:0);if(hop>0){hop=Math.max(0,hop-dt*2.2)}}
   world.traverse(o=>{if(o.userData.blink)o.userData.blink.material.color.setHex(Math.sin(clock*5)>0?C.alarm:0xf0a090)});
   busy=true;
  }
  if(xiaoya){const v=new THREE.Vector3();camera.getWorldPosition(v);const local=xiaoya.parent.worldToLocal(v.clone());xiaoya.rotation.y=Math.atan2(local.x-xiaoya.position.x,local.z-xiaoya.position.z)}
  world.traverse(o=>{if(o.userData.flag){const v=new THREE.Vector3();camera.getWorldPosition(v);const l=o.worldToLocal(v.clone());o.userData.flag.rotation.y=Math.atan2(l.x,l.z)}});
  placeCamera();renderer.render(scene,camera);
  if(busy||down)frame();
 }
 const io=new IntersectionObserver(es=>{visible=es[0].isIntersecting&&document.visibilityState==='visible';if(visible)frame()});io.observe(host);
 const onVis=()=>{visible=document.visibilityState==='visible';if(visible)frame()};document.addEventListener('visibilitychange',onVis);
 const ro=new ResizeObserver(fit);ro.observe(host);fit();

 /** Book opening: cover swings open, the island pops up, camera descends. Resolves when done. */
 function playOpening(){
  return new Promise(res=>{let resolve=res;
   if(reduced()){coverPivot.visible=false;resolve();return}
   // Safety net: if the page cannot paint (hidden tab, throttled frames), finish on time anyway.
   const safety=setTimeout(()=>{if(opening){opening=null;coverPivot.visible=false;world.visible=true;camBase.y=8.4;camBase.z=6.6;if(lastModel){firstBuild=false;update(lastModel)}resolve()}},4200);
   const done=resolve;resolve=()=>{clearTimeout(safety);done()};
   coverPivot.visible=true;coverPivot.rotation.z=0;world.visible=false;
   let t=0;const startY=camBase.y,startZ=camBase.z;camBase.y=13;camBase.z=4.5;
   opening=dt=>{t+=dt;
    const c=clamp(t/1.2,0,1);coverPivot.rotation.z=-Math.PI*(1-Math.pow(1-c,3));
    if(t>.75&&!world.visible){world.visible=true;firstBuild=true;known=new Set();if(lastModel)update(lastModel)}
    const k=clamp((t-.4)/2.2,0,1),e=1-Math.pow(1-k,3);camBase.y=13+(startY-13)*e;camBase.z=4.5+(startZ-4.5)*e;
    if(c>=1)coverPivot.visible=false;
    if(t>=2.7){camBase.y=startY;camBase.z=startZ;opening=null;resolve();return false}
    return true};
   frame();
  });
 }
 let lastModel=null;
 return {
  update(model){lastModel=model;update(model)},
  playOpening,
  celebrate(){hop=1;frame()},
  dispose(){cancelAnimationFrame(raf);io.disconnect();ro.disconnect();document.removeEventListener('visibilitychange',onVis);clearWorld();renderer.dispose();renderer.domElement.remove()},
  canvas:renderer.domElement
 };
}
