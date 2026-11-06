// 小芽的立体书 · Paper pop-up islands rendered with Three.js (r180, vendored).
// Two views of the same book:
//  · week   — seven day stops. Courses = houses, events = tents, deadlines = lighthouses, free time = meadow,
//             goals = trees (grown only by real check-ins), Xiaoya's pencils = dashed stepping stones.
//  · season — nine week stops for the long line. Completed items = a paper tower, goal actions = flowers,
//             self-recorded mood = the colour of the plot (local only), future weeks = pencil outlines.
// The scene is a view; picking calls onPick and the 2D page does the work. Lighting follows the real hour.
import * as THREE from './vendor/three/three.module.min.js';

const C={paper:0xf4ecd9,page:0xf7f1e3,pageEdge:0xe6dcc5,spine:0x2b3243,sea:0xcfe1e2,seaLine:0xe6f0ef,sand:0xe9d9b3,
 grass1:0x9fb78a,grass2:0xbcd0a3,path:0xf7f0df,ink:0x2b3243,wall:0xf6efe0,roof:0x3b4458,tent:0xd98b6a,today:0xd98b6a,
 stop:0xfaf5ea,lamp:0xf2c46d,alarm:0xc8553d,pencil:0x8a8f99,leaf:0x88a675,leaf2:0xa5bf8f,trunk:0x9c7b5b,cloud:0xfbf8f1,
 sprout:0x5d8a4c,window:0xe9dfc6,petal:0xe08a6a,petal2:0xf0c46a};
const easeBack=t=>{const c1=1.5,c3=c1+1;return 1+c3*Math.pow(t-1,3)+c1*Math.pow(t-1,2)};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const FONT='"Noto Serif SC","Songti SC","SimSun",serif';

function paperTexture(base='#f4ecd9',grain=10){
 const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');
 g.fillStyle=base;g.fillRect(0,0,256,256);
 const img=g.getImageData(0,0,256,256);let s=7;const rnd=()=>{s=(s*16807)%2147483647;return s/2147483647};
 for(let i=0;i<img.data.length;i+=4){const n=(rnd()-.5)*grain;img.data[i]+=n;img.data[i+1]+=n;img.data[i+2]+=n}
 g.putImageData(img,0,0);
 for(let i=0;i<60;i++){g.strokeStyle='rgba(120,100,70,'+(0.03+rnd()*0.04)+')';g.lineWidth=.6;g.beginPath();const x=rnd()*256,y=rnd()*256;g.moveTo(x,y);g.lineTo(x+(rnd()-.5)*30,y+(rnd()-.5)*8);g.stroke()}
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;
}
/** A paper flag: small kicker line + big main line, with an accent stripe. */
function flagTexture(kicker,main,{accent='#2b3243',bg='#faf5ea',fg='#1c2230'}={}){
 const w=512,h=256,c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');
 g.fillStyle=bg;g.fillRect(0,0,w,h);g.fillStyle=accent;g.fillRect(0,0,w,14);
 g.strokeStyle='rgba(43,50,67,.35)';g.lineWidth=4;g.strokeRect(2,2,w-4,h-4);
 g.fillStyle=fg;g.textAlign='center';g.textBaseline='middle';
 g.font='600 64px '+FONT;g.fillText(kicker,w/2,84);
 g.font='800 104px '+FONT;g.fillText(main,w/2,178);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;
}
function blobShape(radius,seed=3,points=28,wobble=.16){
 const s=new THREE.Shape();let r=seed;const rnd=()=>{r=(r*9301+49297)%233280;return r/233280};
 const offs=Array.from({length:points},()=>1+(rnd()-.5)*wobble*2);
 for(let i=0;i<=points;i++){const a=i/points*Math.PI*2,k=offs[i%points],x=Math.cos(a)*radius*k*1.18,y=Math.sin(a)*radius*k*.82;i?s.lineTo(x,y):s.moveTo(x,y)}
 return s;
}
function layer(shape,depth,y,mat){
 const geo=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:24});geo.rotateX(-Math.PI/2);
 const m=new THREE.Mesh(geo,mat);m.position.y=y;m.castShadow=true;m.receiveShadow=true;return m;
}
/** Keyframes for real-time lighting: hour → sky + light colours. */
const SKY=[
 {h:0,hemi:0x9fb0d4,hi:.95,sun:0xc8d6ff,si:.75,bg:['#323a52','#1f2436'],night:1},
 {h:5.5,hemi:0xa7b4d4,hi:1,sun:0xcfdaff,si:.8,bg:['#3d455c','#262b3c'],night:.9},
 {h:6.6,hemi:0xffd9c4,hi:1.15,sun:0xffb48a,si:1.2,bg:['#fbe6d6','#e9d3c2'],night:.15},
 {h:8.5,hemi:0xfff8ec,hi:1.55,sun:0xfff1dc,si:1.65,bg:['#fbf6ea','#e9e0cc'],night:0},
 {h:16,hemi:0xfff8ec,hi:1.5,sun:0xfff1dc,si:1.6,bg:['#fbf6ea','#e9e0cc'],night:0},
 {h:17.6,hemi:0xffe0c2,hi:1.2,sun:0xffaa66,si:1.45,bg:['#fbe3cc','#ecc9a6'],night:.15},
 {h:19.2,hemi:0xb0aed0,hi:1,sun:0xd6c2ff,si:.85,bg:['#4a4a66','#2b2d40'],night:.8},
 {h:20.2,hemi:0x9fb0d4,hi:.95,sun:0xc8d6ff,si:.75,bg:['#323a52','#1f2436'],night:1},
 {h:24,hemi:0x9fb0d4,hi:.95,sun:0xc8d6ff,si:.75,bg:['#323a52','#1f2436'],night:1}];
function skyAt(hour){
 const h=((hour%24)+24)%24;let i=0;while(i<SKY.length-2&&SKY[i+1].h<=h)i++;
 const a=SKY[i],b=SKY[i+1],t=clamp((h-a.h)/Math.max(.001,b.h-a.h),0,1);
 const col=(x,y)=>new THREE.Color(x).lerp(new THREE.Color(y),t);
 const mixHex=(x,y)=>'#'+new THREE.Color(x).lerp(new THREE.Color(y),t).getHexString();
 return {hemi:col(a.hemi,b.hemi),hi:lerp(a.hi,b.hi,t),sun:col(a.sun,b.sun),si:lerp(a.si,b.si,t),bg:[mixHex(a.bg[0],b.bg[0]),mixHex(a.bg[1],b.bg[1])],night:lerp(a.night,b.night,t),hour:h};
}

export function createIsland(host,{onPick=()=>{},reduced=()=>false,faces={}}={}){
 let renderer;
 try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'})}catch(e){host.dataset.webgl='off';return null}
 if(!renderer.getContext()){host.dataset.webgl='off';return null}
 renderer.setPixelRatio(Math.min(matchMedia('(pointer: coarse)').matches?1.5:2,window.devicePixelRatio||1));
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 renderer.domElement.className='island-canvas';renderer.domElement.setAttribute('aria-hidden','true');
 host.append(renderer.domElement);
 // HTML overlays: hover tooltip and Xiaoya's speech bubble.
 const tip=document.createElement('div');tip.className='island-pop';tip.hidden=true;host.append(tip);
 const say=document.createElement('div');say.className='island-say';say.hidden=true;say.setAttribute('role','status');host.append(say);
 say.addEventListener('click',e=>{if(e.target.closest('[data-island-talk]')){say.hidden=true;onPick({kind:'xiaoya-talk'})}});

 const scene=new THREE.Scene();
 const camera=new THREE.PerspectiveCamera(32,1,.1,100);
 const hemi=new THREE.HemisphereLight(0xfff8ec,0xc9bda6,1.55);scene.add(hemi);
 const sun=new THREE.DirectionalLight(0xfff1dc,1.65);sun.position.set(-5,9,6);sun.castShadow=true;
 sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-8,right:8,top:8,bottom:-8,near:1,far:30});sun.shadow.bias=-.0008;scene.add(sun);
 const loader=new THREE.TextureLoader();
 const paperTex=paperTexture();paperTex.repeat.set(3,2);
 const grassTex=paperTexture('#bcd0a3',14);grassTex.repeat.set(2,2);
 const seaTex=paperTexture('#cfe1e2',8);seaTex.repeat.set(2,2);

 // ---------- the book (static) ----------
 const book=new THREE.Group();scene.add(book);
 const pageMat=new THREE.MeshLambertMaterial({color:C.page,map:paperTex});
 const edgeMat=new THREE.MeshLambertMaterial({color:C.pageEdge});
 for(const side of [-1,1]){
  const p=new THREE.Mesh(new THREE.BoxGeometry(6.4,.22,7.2),[edgeMat,edgeMat,pageMat,edgeMat,edgeMat,edgeMat]);
  p.position.set(side*3.25,-.11,0);p.rotation.z=side*.035;p.receiveShadow=true;book.add(p);
 }
 const spine=new THREE.Mesh(new THREE.CylinderGeometry(.16,.16,7.3,16),new THREE.MeshLambertMaterial({color:C.spine}));spine.rotation.x=Math.PI/2;spine.position.y=-.2;book.add(spine);
 const coverPivot=new THREE.Group();coverPivot.position.set(0,.02,0);book.add(coverPivot);
 const coverMat=new THREE.MeshLambertMaterial({color:0x3b5a46});
 const coverFace=new THREE.MeshLambertMaterial({map:flagTexture('LifeLab','小芽',{bg:'#3b5a46',fg:'#f4ecd9',accent:'#d98b6a'})});
 const cover=new THREE.Mesh(new THREE.BoxGeometry(6.6,.14,7.4),[coverMat,coverMat,coverFace,coverMat,coverMat,coverMat]);
 cover.position.set(3.3,.08,0);cover.castShadow=true;coverPivot.add(cover);coverPivot.visible=false;
 // Stars (only visible at night).
 const starGeo=new THREE.BufferGeometry();{const p=[];let s=5;const r=()=>{s=(s*16807)%2147483647;return s/2147483647};for(let i=0;i<90;i++)p.push((r()-.5)*16,3+r()*3,-3-r()*5);starGeo.setAttribute('position',new THREE.Float32BufferAttribute(p,3))}
 const stars=new THREE.Points(starGeo,new THREE.PointsMaterial({color:0xfff6dd,size:.06,transparent:true,opacity:0,depthWrite:false}));scene.add(stars);

 // ---------- dynamic world ----------
 const world=new THREE.Group();scene.add(world);
 const pickables=[],pops=[],ripples=[],flags=[];
 let known=new Set(),firstBuild=true,clock=0,last=performance.now(),labelScale=1,night=0;
 const windowMat=new THREE.MeshLambertMaterial({color:C.window,emissive:0x000000});
 const lampMats=[];
 const mat=(color,opts={})=>new THREE.MeshLambertMaterial({color,...opts});
 function pop(obj,delay,key){obj.userData.popKey=key;obj.userData.base=obj.scale.clone();obj.userData.baseRotX=obj.rotation.x;obj.userData.baseY=obj.position.y;
  const isNew=!known.has(key);
  if(reduced()||(!firstBuild&&!isNew))return;
  obj.scale.set(obj.scale.x,.001,obj.scale.z);obj.rotation.x=obj.userData.baseRotX-1.1;pops.push({obj,delay,dur:.62,t:0});
  // Something that appears after the first build was just inked: mark it with a spreading ink ripple.
  if(!firstBuild&&isNew&&obj.userData.pick)ripple(obj.position,delay+.2);
 }
 function ripple(at,delay=0){const r=new THREE.Mesh(new THREE.RingGeometry(.18,.24,48),new THREE.MeshBasicMaterial({color:C.sprout,transparent:true,opacity:0,depthWrite:false}));
  r.rotation.x=-Math.PI/2;r.position.set(at.x,.34,at.z);world.add(r);ripples.push({mesh:r,t:-delay})}
 function pickable(obj,data){obj.userData.pick=data;obj.traverse(o=>{if(o.isMesh||o.isLineSegments){o.userData.pick=data;o.userData.root=obj;if(o.isMesh)pickables.push(o)}})}
 function house(color=C.wall,roof=C.roof){const g=new THREE.Group();
  const body=new THREE.Mesh(new THREE.BoxGeometry(.34,.26,.3),mat(color));body.position.y=.13;
  const r=new THREE.Mesh(new THREE.CylinderGeometry(.01,.27,.2,4,1),mat(roof,{flatShading:true}));r.rotation.y=Math.PI/4;r.position.y=.36;
  const door=new THREE.Mesh(new THREE.PlaneGeometry(.08,.12),mat(C.ink));door.position.set(0,.07,.151);
  for(const x of [-.1,.1]){const w=new THREE.Mesh(new THREE.PlaneGeometry(.06,.06),windowMat);w.position.set(x,.17,.151);g.add(w)}
  [body,r].forEach(m=>{m.castShadow=true;m.receiveShadow=true});g.add(body,r,door);return g}
 function tent(){const g=new THREE.Group();const c=new THREE.Mesh(new THREE.ConeGeometry(.22,.34,4),mat(C.tent,{flatShading:true}));c.position.y=.17;c.rotation.y=Math.PI/4;c.castShadow=true;
  const f=new THREE.Mesh(new THREE.PlaneGeometry(.12,.07),mat(C.alarm,{side:THREE.DoubleSide}));f.position.set(.06,.42,0);const pole=new THREE.Mesh(new THREE.CylinderGeometry(.008,.008,.16),mat(C.ink));pole.position.set(0,.4,0);g.add(c,pole,f);return g}
 function lighthouse(state){const g=new THREE.Group();
  const a=new THREE.Mesh(new THREE.CylinderGeometry(.075,.1,.24,12),mat(C.wall));a.position.y=.12;
  const b=new THREE.Mesh(new THREE.CylinderGeometry(.07,.075,.12,12),mat(state==='done'?C.pencil:C.alarm));b.position.y=.3;
  const lampColor=state==='urgent'?C.alarm:state==='done'?0xb9b9b9:C.lamp;
  const lm=new THREE.MeshBasicMaterial({color:lampColor});lm.userData.base=lampColor;lm.userData.state=state;lampMats.push(lm);
  const lamp=new THREE.Mesh(new THREE.SphereGeometry(.06,12,8),lm);lamp.position.y=.41;
  const cap=new THREE.Mesh(new THREE.ConeGeometry(.08,.08,12),mat(C.ink));cap.position.y=.49;
  [a,b,cap].forEach(m=>{m.castShadow=true});g.add(a,b,lamp,cap);
  if(state==='urgent'){const glow=new THREE.PointLight(C.alarm,1.2,1.4);glow.position.y=.42;g.add(glow);g.userData.blink=lamp}
  return g}
 function tree(level,pencil){const g=new THREE.Group();
  const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.03,.04,.22,6),mat(C.trunk));trunk.position.y=.11;g.add(trunk);
  if(pencil){const cone=new THREE.ConeGeometry(.2,.4,6);const e=new THREE.LineSegments(new THREE.EdgesGeometry(cone),new THREE.LineDashedMaterial({color:C.pencil,dashSize:.04,gapSize:.03}));
   e.computeLineDistances();e.position.y=.4;g.add(e);const hit=new THREE.Mesh(cone,new THREE.MeshBasicMaterial({visible:false}));hit.position.y=.4;g.add(hit);return g}
  for(let i=0;i<level;i++){const c=new THREE.Mesh(new THREE.ConeGeometry(.24-i*.04,.26,7),mat(i%2?C.leaf2:C.leaf,{flatShading:true}));c.position.y=.3+i*.15;c.castShadow=true;g.add(c)}
  return g}
 function stone(){const g=new THREE.Group();const box=new THREE.BoxGeometry(.34,.04,.24);
  const fill=new THREE.Mesh(box,new THREE.MeshBasicMaterial({color:C.pencil,transparent:true,opacity:.14}));
  const edge=new THREE.LineSegments(new THREE.EdgesGeometry(box),new THREE.LineDashedMaterial({color:0x5a606b,dashSize:.035,gapSize:.025}));edge.computeLineDistances();
  g.add(fill,edge);return g}
 function tower(n){const g=new THREE.Group();for(let i=0;i<n;i++){const b=new THREE.Mesh(new THREE.BoxGeometry(.2-i%2*.02,.07,.2-i%2*.02),mat(i%2?C.wall:C.paper));b.position.y=.04+i*.075;b.rotation.y=i*.18;b.castShadow=true;g.add(b)}return g}
 function flower(color){const g=new THREE.Group();const stem=new THREE.Mesh(new THREE.CylinderGeometry(.008,.008,.16),mat(C.leaf));stem.position.y=.08;
  const head=new THREE.Mesh(new THREE.IcosahedronGeometry(.045,0),mat(color,{flatShading:true}));head.position.y=.18;head.castShadow=true;g.add(stem,head);return g}
 function cloud(){const g=new THREE.Group();const m=mat(C.cloud,{transparent:true,opacity:.92});
  for(const [x,r] of [[-.3,.22],[0,.3],[.32,.2]]){const s=new THREE.Mesh(new THREE.CircleGeometry(r,20),m);s.position.x=x;s.castShadow=true;g.add(s)}
  g.rotation.x=-Math.PI/2;return g}
 function addFlag(g,kicker,main,{accent,bg,height=.92}={}){
  const flag=new THREE.Mesh(new THREE.PlaneGeometry(.86,.43),new THREE.MeshBasicMaterial({map:flagTexture(kicker,main,{accent,bg}),side:THREE.DoubleSide}));
  flag.geometry.translate(.43,0,0); // hinge on the pole like a real flag, so the pole never covers the text
  flag.position.set(0,height+.1,0);flag.scale.setScalar(labelScale);
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,height),mat(C.ink));pole.position.y=height/2+.15;
  g.add(pole,flag);g.userData.flag=flag;flags.push(flag);
 }

 let path=null,curve=null,stopsCount=7,xiaoya=null,clouds=[];
 const walk={t:null,target:0,wanderAt:0,face:1,stop:0};
 const faceTex={};
 function face(n){if(!faceTex[n]&&faces[n]){faceTex[n]=loader.load(faces[n]);faceTex[n].colorSpace=THREE.SRGBColorSpace}return faceTex[n]}
 const keep=new Set([paperTex,grassTex,seaTex]);
 function clearWorld(){
  for(const o of [...world.children]){world.remove(o);o.traverse(x=>{x.geometry?.dispose();(Array.isArray(x.material)?x.material:[x.material]).forEach(m=>{if(!m||m===windowMat)return;if(m.map&&!keep.has(m.map)&&!Object.values(faceTex).includes(m.map))m.map.dispose();m.dispose?.()})})}
  pickables.length=0;flags.length=0;lampMats.length=0;ripples.length=0;
 }
 let model=null;
 function base(k){
  const sea=new THREE.Mesh(new THREE.CircleGeometry(4.3,64),mat(C.sea,{map:seaTex}));sea.rotation.x=-Math.PI/2;sea.position.y=.005;sea.receiveShadow=true;sea.scale.set(1.15,1,.8);world.add(sea);pop(sea,0,k('sea'));
  for(const [r,o] of [[3.75,.6],[4.05,.45]]){const ring=new THREE.Mesh(new THREE.RingGeometry(r,r+.035,96),new THREE.MeshBasicMaterial({color:C.seaLine,transparent:true,opacity:o}));ring.rotation.x=-Math.PI/2;ring.position.y=.012;ring.scale.set(1.15,1,.8);ring.userData.wave=r;world.add(ring)}
  const island=new THREE.Group();
  island.add(layer(blobShape(2.9,11),.1,0,mat(C.sand)));island.add(layer(blobShape(2.75,11),.12,.1,mat(C.grass1)));island.add(layer(blobShape(2.55,11),.08,.22,mat(0xffffff,{map:grassTex})));
  world.add(island);pop(island,.05,k('island'));
 }
 function stopPoints(n){
  const out=[];for(let i=0;i<n;i++){const x=lerp(-2.6,2.6,i/(n-1)),z=(i%2?-.58:.5)*1.05;out.push(new THREE.Vector3(x,.31,z))}return out;
 }
 function buildPath(pts,k){
  curve=new THREE.CatmullRomCurve3(pts);path=new THREE.Group();
  for(let i=0;i<=64;i++){const p=curve.getPoint(i/64),t=curve.getTangent(i/64);const tile=new THREE.Mesh(new THREE.BoxGeometry(.13,.02,.09),mat(C.path));tile.position.copy(p);tile.rotation.y=Math.atan2(t.x,t.z);tile.receiveShadow=true;path.add(tile)}
  world.add(path);pop(path,.25,k('path'));
 }
 function placeXiaoya(focusIndex,k){
  const tex=face(model.xiaoyaFace||4);
  const stand=new THREE.Group();
  const card=new THREE.Mesh(new THREE.PlaneGeometry(1.15,1.15),new THREE.MeshLambertMaterial({map:tex,transparent:true,alphaTest:.08,side:THREE.DoubleSide}));card.position.y=.6;card.castShadow=true;
  const foot=new THREE.Mesh(new THREE.CylinderGeometry(.16,.18,.04,20),mat(C.paper));foot.position.y=.02;
  stand.add(card,foot);stand.userData.card=card;
  pickable(stand,{kind:'xiaoya',label:'小芽 · 点我'});world.add(stand);xiaoya=stand;
  walk.target=focusIndex/(stopsCount-1);walk.stop=focusIndex;
  if(walk.t===null||firstBuild)walk.t=reduced()?walk.target:0; // first visit: she walks from the first stop to today
  positionXiaoya(0);pop(stand,1.35,k('xiaoya'));
 }
 function positionXiaoya(bob){
  if(!xiaoya||!curve)return;const t=clamp(walk.t,0,1),p=curve.getPoint(t),tan=curve.getTangent(t);
  const side=new THREE.Vector3(-tan.z,0,tan.x).normalize().multiplyScalar(.32);
  xiaoya.position.set(p.x+side.x,.31+bob,p.z+side.z);
 }

 /** Rebuild from a model. Only objects whose key is new pop up (with an ink ripple) after the first build. */
 function update(m){
  model=m;const keys=new Set();clearWorld();const k=s=>{keys.add(s);return s};
  base(k);
  if(m.kind==='season')buildSeason(m,k);else buildWeek(m,k);
  tip.hidden=true;say.hidden=true;hoverRoot=null;
  // Clouds drift behind the island only; their soft shadows still cross the paper.
  clouds=[];[[-3.4,2.6,-2.6],[3.1,2.9,-3],[.4,3.2,-3.6]].forEach(([x,y,z])=>{const c=cloud();c.position.set(x,y,z);world.add(c);clouds.push(c)});
  applySky(m.hour??new Date().getHours()+new Date().getMinutes()/60);
  known=keys;firstBuild=false;frame();
 }
 function buildWeek(m,k){
  stopsCount=7;const pts=stopPoints(7);buildPath(pts,k);
  m.days.forEach((d,i)=>{
   const g=new THREE.Group();const at=pts[i];g.position.copy(at);
   const disc=new THREE.Mesh(new THREE.CylinderGeometry(d.isToday?.3:.24,d.isToday?.3:.24,.05,28),mat(d.isToday?C.today:C.stop));disc.position.y=.02;disc.receiveShadow=true;g.add(disc);
   addFlag(g,d.label,String(d.dom),{accent:d.isToday?'#d98b6a':'#2b3243',bg:d.isToday?'#fff3e6':'#faf5ea'});
   if(d.isToday){const halo=new THREE.Mesh(new THREE.RingGeometry(.36,.42,40),new THREE.MeshBasicMaterial({color:C.today,transparent:true,opacity:.55}));halo.rotation.x=-Math.PI/2;halo.position.y=.05;g.add(halo);g.userData.halo=halo}
   const busy=d.items.length?d.items.length+' 项课程或活动':'没有课程或活动';
   pickable(g,{kind:'day',date:d.key,label:d.label+' '+d.dom+' 日 · '+busy+(d.due.length?' · '+d.due.length+' 项截止':'')});
   world.add(g);pop(g,.35+i*.07,k('day:'+d.key));
   const ring=(n,idx,rad=.62)=>{const a=(idx/Math.max(1,n))*Math.PI*1.2+(i%2?Math.PI*.9:-Math.PI*.15);return [Math.cos(a)*rad,Math.sin(a)*rad*.8]};
   const items=d.items.slice(0,5);
   items.forEach((it,j)=>{const b=it.kind==='course'?house():tent();b.scale.setScalar(1.5);const [x,z]=ring(items.length,j);b.position.set(at.x+x,.3,at.z+z);
    if(it.conflict){const pen=new THREE.Mesh(new THREE.PlaneGeometry(.1,.06),mat(C.alarm,{side:THREE.DoubleSide}));pen.position.set(0,.55,0);b.add(pen)}
    pickable(b,{kind:it.kind,id:it.id,date:d.key,recurring:it.recurring,occurrenceDate:it.occurrenceDate,label:it.title+' · '+it.start+'–'+it.end+(it.place?' · '+it.place:'')+(it.conflict?' · 有重叠':'')});
    world.add(b);pop(b,.6+i*.07+j*.05,k(it.kind+':'+it.id+'@'+d.key))});
   d.due.slice(0,3).forEach((t,j)=>{const l=lighthouse(t.done?'done':t.urgent?'urgent':'later');l.scale.setScalar(1.6);const side=i%2?-1:1;l.position.set(at.x+(j-.5*(Math.min(3,d.due.length)-1))*.34,.3,at.z+side*.7);
    pickable(l,{kind:'task',id:t.id,label:(t.done?'已交 · ':'截止 '+t.time+' · ')+t.title});world.add(l);pop(l,.7+i*.07+j*.05,k('due:'+t.id+':'+(t.done?1:0)))});
   const tufts=Math.min(6,Math.round(d.freeMinutes/60));
   for(let j=0;j<tufts;j++){const tuft=new THREE.Mesh(new THREE.ConeGeometry(.035,.12,5),mat(j%2?C.leaf:C.leaf2));const a=j*1.7+i,r=.32+((j*37)%10)/40;tuft.position.set(at.x+Math.cos(a)*r,.36,at.z+Math.sin(a)*r*.7);world.add(tuft)}
   d.pencilIds.slice(0,3).forEach((id,j)=>{const s=stone();s.scale.setScalar(1.35);s.position.set(at.x+(j-1)*.4,.36,at.z+(i%2?.42:-.42));s.rotation.y=.2*j;pickable(s,{kind:'pencil',id,date:d.key,label:'小芽的铅笔建议 · 点开看依据'});world.add(s);pop(s,.9+i*.06+j*.05,k('pencil:'+id))});
  });
  goalsRim(m.goals,k,'目标');
  const idx=Math.max(0,m.days.findIndex(d=>d.isToday));placeXiaoya(m.attentionDay??idx,k);
 }
 function moodColor(v){if(v==null)return null;const lo=new THREE.Color(0xa9b7c6),hi=new THREE.Color(0xf0c987);return lo.lerp(hi,clamp((v-1)/4,0,1)).getHex()}
 function buildSeason(m,k){
  stopsCount=m.weeks.length;const pts=stopPoints(stopsCount);buildPath(pts,k);
  m.weeks.forEach((w,i)=>{
   const g=new THREE.Group();const at=pts[i];g.position.copy(at);
   const color=w.isCurrent?C.today:moodColor(w.mood)??C.stop;
   const disc=new THREE.Mesh(new THREE.CylinderGeometry(w.isCurrent?.3:.25,w.isCurrent?.3:.25,.05,28),w.isFuture?new THREE.MeshBasicMaterial({color:C.pencil,transparent:true,opacity:.18}):mat(color));disc.position.y=.02;g.add(disc);
   if(w.isFuture){const e=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.CylinderGeometry(.25,.25,.05,20)),new THREE.LineDashedMaterial({color:0x5a606b,dashSize:.04,gapSize:.03}));e.computeLineDistances();e.position.y=.02;g.add(e)}
   addFlag(g,w.isCurrent?'本周':w.isFuture?'未来':'第 '+(i+1)+' 格',w.label,{accent:w.isCurrent?'#d98b6a':w.isFuture?'#8a8f99':'#2b3243',bg:w.isFuture?'#f1efe9':'#faf5ea',height:.8});
   const parts=[w.done?'完成 '+w.done+' 项':'',w.checkins?'目标行动 '+w.checkins+' 次 · '+w.minutes+' 分钟':'',w.mood!=null?'心情均值 '+w.mood:'',w.isFuture&&w.intentions?'铅笔意向 '+w.intentions+' 次':''].filter(Boolean);
   pickable(g,{kind:'week',start:w.key,label:(w.isCurrent?'本周':w.label+' 这一周')+(parts.length?' · '+parts.join(' · '):' · 还没有记录')});
   world.add(g);pop(g,.35+i*.06,k('wk:'+w.key));
   if(w.done){const t=tower(Math.min(7,w.done));t.position.set(at.x-.28,.31,at.z+(i%2?.3:-.3));pickable(t,{kind:'week',start:w.key,label:'完成 '+w.done+' 项'});world.add(t);pop(t,.6+i*.06,k('tw:'+w.key+':'+w.done))}
   for(let j=0;j<Math.min(7,w.checkins);j++){const f=flower(j%2?C.petal:C.petal2);f.scale.setScalar(1.4);const a=j*.9+i,r=.32+(j%3)*.07;f.position.set(at.x+.2+Math.cos(a)*r*.6,.31,at.z+Math.sin(a)*r*.5);world.add(f);pop(f,.75+i*.06+j*.03,k('fl:'+w.key+':'+j))}
   if(w.isFuture&&w.intentions){for(let j=0;j<Math.min(3,w.intentions);j++){const s=stone();s.position.set(at.x+(j-1)*.32,.36,at.z+(i%2?.4:-.4));world.add(s)}}
  });
  goalsRim(m.goals,k,'长线');
  placeXiaoya(Math.max(0,m.weeks.findIndex(w=>w.isCurrent)),k);
 }
 function goalsRim(goals,k){
  goals.slice(0,8).forEach((g,j)=>{const level=g.checkins?clamp(1+Math.floor(g.checkins/2),1,4):0;const t=tree(level,!g.checkins);t.scale.setScalar(1.45);
   const a=Math.PI*(1.12+j*.11),x=Math.cos(a)*2.45*1.1,z=-Math.abs(Math.sin(a))*2.05*.95-.15;t.position.set(x,.3,z);
   pickable(t,{kind:'goal',id:g.id,label:g.title+' · '+(g.checkins?g.checkins+' 次真实行动':'还没有第一次行动')});world.add(t);pop(t,1.1+j*.06,k('goal:'+g.id+':'+level))});
 }
 function applySky(hour){
  const s=skyAt(hour);night=s.night;
  hemi.color.copy(s.hemi);hemi.intensity=s.hi;sun.color.copy(s.sun);sun.intensity=s.si;
  // Daytime sun travels east → west; at night a high moon keeps shadows short.
  if(night>.5)sun.position.set(-2.5,10,4);
  else{const ang=(clamp(s.hour,6,19)-6)/13*Math.PI;sun.position.set(-Math.cos(ang)*6,5+Math.sin(ang)*5,5)}
  host.style.background='radial-gradient(120% 90% at 50% 20%,'+s.bg[0]+' 0%,'+s.bg[1]+' 100%)';
  host.dataset.night=night>.5?'true':'false';
  stars.material.opacity=night*.9;
  windowMat.emissive.setHex(night>.3?0xffc864:0x000000);windowMat.emissiveIntensity=night;
  for(const lm of lampMats)if(lm.userData.state==='later')lm.color.setHex(night>.3?0xffe08a:lm.userData.base);
 }

 // ---------- camera & interaction ----------
 let yaw=0,targetYaw=0,parallaxX=0,parallaxY=0,camDist=1;
 function fit(){
  const w=host.clientWidth||1,h=host.clientHeight||1;renderer.setSize(w,h,false);camera.aspect=w/h;
  camDist=clamp(1.22/camera.aspect,0.8,2.8);labelScale=clamp(.75+camDist*.32,1,1.5);for(const f of flags)f.scale.setScalar(labelScale);
  camera.updateProjectionMatrix();placeCamera();frame();
 }
 const camBase={y:8.4,z:6.6};
 function placeCamera(){camera.position.set(Math.sin(parallaxX*.08)*1.2,camBase.y*camDist+parallaxY*.25,camBase.z*camDist);camera.lookAt(0,.1,.35)}
 const ray=new THREE.Raycaster(),ptr=new THREE.Vector2();
 let down=null,hoverRoot=null;
 function hitObj(e){const r=renderer.domElement.getBoundingClientRect();ptr.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(ptr,camera);return ray.intersectObjects(pickables,false)[0]?.object||null}
 function screenOf(obj,lift=.85){const v=new THREE.Vector3();obj.getWorldPosition(v);v.y+=lift;v.project(camera);return {x:(v.x+1)/2*host.clientWidth,y:(1-v.y)/2*host.clientHeight}}
 function showTip(root){
  if(!root){tip.hidden=true;return}
  const p=root.userData.pick;tip.textContent=p.label||'';tip.hidden=!p.label;const s=screenOf(root);
  tip.style.left=clamp(s.x,70,host.clientWidth-70)+'px';tip.style.top=Math.max(8,s.y-8)+'px';
 }
 renderer.domElement.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY,yaw:targetYaw,moved:false};renderer.domElement.setPointerCapture?.(e.pointerId)});
 renderer.domElement.addEventListener('pointermove',e=>{
  const r=renderer.domElement.getBoundingClientRect();
  if(down){const dx=e.clientX-down.x;if(Math.abs(dx)>6){down.moved=true;tip.hidden=true;say.hidden=true}targetYaw=clamp(down.yaw+dx/r.width*1.6,-.7,.7);frame();return}
  if(e.pointerType==='mouse'){parallaxX=(e.clientX-r.left)/r.width*2-1;parallaxY=(e.clientY-r.top)/r.height*2-1;
   const o=hitObj(e),root=o?.userData.root||null;if(root!==hoverRoot){hoverRoot=root;renderer.domElement.style.cursor=root?'pointer':'grab'}showTip(hoverRoot);frame()}
 });
 renderer.domElement.addEventListener('pointerleave',()=>{hoverRoot=null;tip.hidden=true;frame()});
 renderer.domElement.addEventListener('pointerup',e=>{const d=down;down=null;if(d&&!d.moved){const o=hitObj(e),p=o?.userData.pick;
  if(!p){say.hidden=true;return}
  if(p.kind==='xiaoya'){hop=1;speak();return}
  onPick(p)}});
 renderer.domElement.addEventListener('pointercancel',()=>{down=null});
 renderer.domElement.style.touchAction='pan-y';
 function speak(){
  if(!xiaoya)return;const text=model?.speech||'我在这里。';
  say.innerHTML='<p></p><button type="button" data-island-talk>和小芽聊聊</button>';say.querySelector('p').textContent=text;say.hidden=false;
  placeSay();clearTimeout(speak.t);speak.t=setTimeout(()=>{say.hidden=true},7000);
 }
 // Above her head when there is room; otherwise below her feet, so the bubble is never clipped.
 function placeSay(){
  if(!xiaoya||say.hidden)return;const head=screenOf(xiaoya,1.3),feet=screenOf(xiaoya,0),h=say.offsetHeight||110;
  const below=head.y-h<8;say.classList.toggle('is-below',below);
  say.style.left=clamp(head.x,130,host.clientWidth-130)+'px';say.style.top=(below?Math.min(host.clientHeight-h-8,feet.y+10):head.y)+'px';
 }

 // ---------- animation loop ----------
 let raf=0,visible=true,hop=0,opening=null;
 function frame(){if(!raf&&visible)raf=requestAnimationFrame(tick)}
 function tick(now){
  raf=0;const dt=Math.min(.05,(now-last)/1000);last=now;clock+=dt;
  let busy=false;
  for(const p of pops){if(p.done)continue;p.t+=dt;const u=clamp((p.t-p.delay)/p.dur,0,1);if(u<1)busy=true;else p.done=true;
   const e=u<=0?0:easeBack(u),b=p.obj.userData.base;p.obj.scale.set(b.x,Math.max(.001,b.y*e),b.z);p.obj.rotation.x=p.obj.userData.baseRotX-1.1*(1-clamp(u*1.4,0,1))}
  if(!busy&&pops.every(p=>p.done))pops.length=0;
  for(const r of ripples){r.t+=dt;if(r.t<0){busy=true;continue}const u=clamp(r.t/1.2,0,1);r.mesh.scale.setScalar(1+u*5);r.mesh.material.opacity=.85*(1-u);if(u<1)busy=true;else r.mesh.visible=false}
  if(opening){busy=opening(dt)||busy}
  yaw+=(targetYaw-yaw)*Math.min(1,dt*8);world.rotation.y=yaw;if(Math.abs(targetYaw-yaw)>.001)busy=true;
  // Hover lift: the hovered piece rises a little, everything else settles.
  for(const o of pickables){const root=o.userData.root;if(!root||root.userData.baseY===undefined||root===xiaoya)continue;
   const want=root.userData.baseY+(root===hoverRoot?.08:0);if(Math.abs(root.position.y-want)>.001){root.position.y+=(want-root.position.y)*Math.min(1,dt*12);busy=true}}
  if(!reduced()){
   for(const [j,c] of clouds.entries()){c.position.x+=dt*.06*(j%2?-1:1);if(c.position.x>4)c.position.x=-4;if(c.position.x<-4)c.position.x=4}
   world.traverse(o=>{if(o.userData.blink)o.userData.blink.material.color.setHex(Math.sin(clock*5)>0?C.alarm:0xf0a090);if(o.userData.wave){const s=1+Math.sin(clock*.8+o.userData.wave)*.012;o.scale.set(1.15*s,1,.8*s)}});
   // Xiaoya walks along the path to her stop, then idles nearby.
   if(xiaoya&&!opening&&pops.length===0){
    const diff=walk.target-walk.t;let bob=0;
    if(Math.abs(diff)>.002){const step=Math.sign(diff)*Math.min(Math.abs(diff),dt*.22);walk.t+=step;walk.face=Math.sign(diff);bob=Math.abs(Math.sin(clock*11))*.05}
    else if(clock>walk.wanderAt){walk.wanderAt=clock+7+Math.random()*6;const home=walk.stop/(stopsCount-1);walk.target=clamp(home+(Math.random()-.5)*.05,0,1)}
    positionXiaoya(bob);
    const card=xiaoya.userData.card;card.position.y=.6+Math.sin(clock*2.2)*.02+(hop>0?Math.sin(hop*Math.PI)*.28:0);if(hop>0)hop=Math.max(0,hop-dt*2.2);
    card.scale.x+=((walk.face<0?-1:1)-card.scale.x)*Math.min(1,dt*10);
    placeSay();
   }
   busy=true;
  }else if(xiaoya){walk.t=walk.target;positionXiaoya(0)}
  const cam=new THREE.Vector3();camera.getWorldPosition(cam);
  if(xiaoya){const l=xiaoya.parent.worldToLocal(cam.clone());xiaoya.rotation.y=Math.atan2(l.x-xiaoya.position.x,l.z-xiaoya.position.z)}
  for(const f of flags){const l=f.parent.worldToLocal(cam.clone());f.rotation.y=Math.atan2(l.x,l.z)}
  if(hoverRoot)showTip(hoverRoot);
  placeCamera();renderer.render(scene,camera);
  if(busy||down)frame();
 }
 const io=new IntersectionObserver(es=>{visible=es[0].isIntersecting&&document.visibilityState==='visible';if(visible)frame()});io.observe(host);
 const onVis=()=>{visible=document.visibilityState==='visible';if(visible)frame()};document.addEventListener('visibilitychange',onVis);
 const ro=new ResizeObserver(fit);ro.observe(host);fit();
 // Re-light every few minutes so dusk and night arrive while the page is open.
 const skyTimer=setInterval(()=>{if(model){applySky(new Date().getHours()+new Date().getMinutes()/60);frame()}},5*60000);

 /** Book opening: cover swings open, the island pops up, camera descends. Resolves when done. */
 function playOpening(){
  return new Promise(res=>{let resolve=res;
   if(reduced()){coverPivot.visible=false;resolve();return}
   // Safety net: if the page cannot paint (hidden tab, throttled frames), finish on time anyway.
   const safety=setTimeout(()=>{if(opening){opening=null;coverPivot.visible=false;world.visible=true;camBase.y=8.4;camBase.z=6.6;if(lastModel){firstBuild=false;update(lastModel)}resolve()}},4200);
   const done=resolve;resolve=()=>{clearTimeout(safety);done()};
   coverPivot.visible=true;coverPivot.rotation.z=0;world.visible=false;walk.t=null;
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
  update(m){
   // Switching between week and season is a different page of the book: rebuild with a fresh pop-up.
   if(lastModel&&lastModel.kind!==m.kind){firstBuild=true;known=new Set();walk.t=null}
   lastModel=m;update(m)},
  playOpening,
  celebrate(){hop=1;frame()},
  speak,
  /** Screen position (CSS px, relative to the host) of the first object of a kind — used by QA and the tour. */
  locate(kind){let root=null;for(const o of pickables){if(o.userData.pick?.kind===kind){root=o.userData.root;break}}if(!root)return null;const s=screenOf(root,kind==='xiaoya'?.6:.15);return {x:s.x,y:s.y}},
  dispose(){cancelAnimationFrame(raf);clearInterval(skyTimer);io.disconnect();ro.disconnect();document.removeEventListener('visibilitychange',onVis);clearWorld();renderer.dispose();renderer.domElement.remove();tip.remove();say.remove()},
  canvas:renderer.domElement
 };
}
