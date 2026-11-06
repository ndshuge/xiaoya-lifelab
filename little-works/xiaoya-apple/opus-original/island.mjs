// 小芽的立体书 v3 · A paper pop-up diorama rendered with Three.js r180 (vendored) + post-processing.
// Look: cardstock with fibre normals, cut edges in a darker tone, layered contour terrain, tilt-shift miniature
// depth of field, ACES tone mapping, glowing lamps at night, vignette and paper grain.
// Data is physical: a busy day rises into a hill; courses are cut-paper houses (lit windows at night),
// events are tents, deadlines are lighthouses, free time is meadow, goals are crossed-card trees grown by
// real check-ins, Xiaoya's pencils are dashed stepping stones. Season view: weeks as plots, completed work as
// paper towers, goal actions as flowers, recorded mood tints the plot (local only).
import * as THREE from './vendor/three/three.module.min.js';
import {EffectComposer} from './vendor/three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from './vendor/three/addons/postprocessing/RenderPass.js';
import {ShaderPass} from './vendor/three/addons/postprocessing/ShaderPass.js';
import {UnrealBloomPass} from './vendor/three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from './vendor/three/addons/postprocessing/OutputPass.js';
import {RoomEnvironment} from './vendor/three/addons/environments/RoomEnvironment.js';

const C={page:0xf5eedf,pageEdge:0xd9ccb0,spine:0x2b3243,sea1:0x8fc3c9,sea2:0xa9d3d6,sea3:0xc4e2e1,seaEdge:0x6d9ea4,
 sand:0xe6d3a8,sandEdge:0xb89c6a,g1:0x8fae78,g2:0xa9c38f,g3:0xc2d6a4,g4:0xd6e2b7,g5:0xe7ebcb,gEdge:0x6e8a5a,path:0xf8f1e0,
 ink:0x2b3243,wall:0xf6efe0,wallEdge:0xcfc3a8,roof:0x3e4a62,roofEdge:0x242b3b,tent:0xdc8c69,tentEdge:0xa95d3f,today:0xdc8c69,
 stop:0xfbf6ea,lamp:0xffd27a,alarm:0xd0553b,pencil:0x8a8f99,leaf:0x7fa36b,leaf2:0x9cbf84,leafEdge:0x587a48,trunk:0x8f6c4f,
 cloud:0xfdfaf3,cloudEdge:0xd8d0c0,sprout:0x5d8a4c,window:0xf1e6c8,petal:0xe58a68,petal2:0xf2c766};
const easeBack=t=>{const c1=1.6,c3=c1+1;return 1+c3*Math.pow(t-1,3)+c1*Math.pow(t-1,2)};
const easeInOut=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const FONT='"Noto Serif SC","Songti SC","SimSun",serif';
const toMin=s=>{const [h,m]=String(s).split(':').map(Number);return h*60+m};

// ---------- procedural paper ----------
function seeded(seed){let s=seed;return()=>{s=(s*16807)%2147483647;return s/2147483647}}
function paperMaps(base='#f5eedf',seed=7){
 const N=256,c=document.createElement('canvas');c.width=c.height=N;const g=c.getContext('2d'),r=seeded(seed);
 const h=new Float32Array(N*N);
 for(let i=0;i<N*N;i++)h[i]=r()*.35;
 for(let k=0;k<420;k++){let x=r()*N,y=r()*N;const a=r()*Math.PI,len=6+r()*26;for(let t=0;t<len;t++){const xi=((x|0)%N+N)%N,yi=((y|0)%N+N)%N;h[yi*N+xi]+=.55;x+=Math.cos(a);y+=Math.sin(a)}}
 for(let pass=0;pass<2;pass++){const o=h.slice();for(let y=0;y<N;y++)for(let x=0;x<N;x++){let s=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)s+=o[((y+dy+N)%N)*N+((x+dx+N)%N)];h[y*N+x]=s/9}}
 g.fillStyle=base;g.fillRect(0,0,N,N);const img=g.getImageData(0,0,N,N);
 const nc=document.createElement('canvas');nc.width=nc.height=N;const ng=nc.getContext('2d'),nimg=ng.createImageData(N,N);
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){const i=y*N+x,v=h[i];
  const sh=(v-.3)*26;img.data[i*4]+=sh;img.data[i*4+1]+=sh;img.data[i*4+2]+=sh*.9;
  const dx=h[y*N+((x+1)%N)]-h[y*N+((x-1+N)%N)],dy=h[((y+1)%N)*N+x]-h[((y-1+N)%N)*N+x];
  const nx=-dx*3,ny=-dy*3,nz=1,l=Math.hypot(nx,ny,nz);nimg.data[i*4]=(nx/l*.5+.5)*255;nimg.data[i*4+1]=(ny/l*.5+.5)*255;nimg.data[i*4+2]=(nz/l*.5+.5)*255;nimg.data[i*4+3]=255}
 g.putImageData(img,0,0);ng.putImageData(nimg,0,0);
 const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;
 const normal=new THREE.CanvasTexture(nc);normal.wrapS=normal.wrapT=THREE.RepeatWrapping;
 return {map,normal};
}
function bannerTexture(kicker,main,{accent='#2b3243',bg='#fbf6ea',fg='#1c2230'}={}){
 const w=512,h=224,c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');
 g.fillStyle=bg;g.fillRect(0,0,w,h);g.fillStyle=accent;g.fillRect(0,0,w,12);
 // swallow-tail cut on the right edge
 g.globalCompositeOperation='destination-out';g.beginPath();g.moveTo(w,h*.18);g.lineTo(w-46,h*.58);g.lineTo(w,h);g.closePath();g.fill();g.globalCompositeOperation='source-over';
 g.fillStyle=fg;g.textAlign='center';g.textBaseline='middle';
 g.font='600 58px '+FONT;g.fillText(kicker,(w-46)/2,78);g.font='800 96px '+FONT;g.fillText(main,(w-46)/2,162);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;
}
function skyTexture(top,bottom){const c=document.createElement('canvas');c.width=4;c.height=256;const g=c.getContext('2d');const gr=g.createLinearGradient(0,0,0,256);gr.addColorStop(0,top);gr.addColorStop(1,bottom);g.fillStyle=gr;g.fillRect(0,0,4,256);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t}
function softShadowTexture(){const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');const gr=g.createRadialGradient(32,32,2,32,32,32);gr.addColorStop(0,'rgba(40,36,28,.5)');gr.addColorStop(1,'rgba(40,36,28,0)');g.fillStyle=gr;g.fillRect(0,0,64,64);return new THREE.CanvasTexture(c)}

// ---------- shapes ----------
function blobShape(rx,rz,seed=3,points=32,wobble=.14){
 const s=new THREE.Shape(),r=seeded(seed*7919+13);const offs=Array.from({length:points},()=>1+(r()-.5)*wobble*2);
 for(let i=0;i<=points;i++){const a=i/points*Math.PI*2,k=offs[i%points],x=Math.cos(a)*rx*k,y=Math.sin(a)*rz*k;i?s.lineTo(x,y):s.moveTo(x,y)}
 return s;
}
function waveRing(r,amp,waves,phase,sx=1.18,sz=.82){
 const s=new THREE.Shape();for(let i=0;i<=160;i++){const a=i/160*Math.PI*2,rr=r+Math.sin(a*waves+phase)*amp+Math.sin(a*waves*2.3+phase*1.7)*amp*.35;const x=Math.cos(a)*rr*sx,y=Math.sin(a)*rr*sz;i?s.lineTo(x,y):s.moveTo(x,y)}
 return s;
}
function extrudeFlat(shape,depth,capMat,sideMat){
 const geo=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:24});geo.rotateX(-Math.PI/2);
 const m=new THREE.Mesh(geo,[capMat,sideMat]);m.castShadow=true;m.receiveShadow=true;return m;
}
function extrudeUpright(shape,depth,capMat,sideMat){
 const geo=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:12});geo.translate(0,0,-depth/2);
 const m=new THREE.Mesh(geo,[capMat,sideMat]);m.castShadow=true;m.receiveShadow=true;return m;
}

// ---------- shaders ----------
const TiltShift={uniforms:{tDiffuse:{value:null},resolution:{value:new THREE.Vector2(1,1)},focus:{value:.56},band:{value:.16},amount:{value:6}},
 vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
 fragmentShader:'uniform sampler2D tDiffuse;uniform vec2 resolution;uniform float focus,band,amount;varying vec2 vUv;\n'+
 'void main(){float d=abs(vUv.y-focus);float b=smoothstep(band,band+.45,d)*amount;if(b<.05){gl_FragColor=texture2D(tDiffuse,vUv);return;}\n'+
 'vec4 s=vec4(0.);float t=0.;for(int i=-4;i<=4;i++){for(int j=-3;j<=3;j++){float w=exp(-float(i*i+j*j)/9.);s+=texture2D(tDiffuse,vUv+vec2(float(j),float(i))*b/resolution)*w;t+=w;}}gl_FragColor=s/t;}'};
const Grade={uniforms:{tDiffuse:{value:null},time:{value:0},vignette:{value:.38},grain:{value:.022},warm:{value:.02},saturation:{value:1.18}},
 vertexShader:TiltShift.vertexShader,
 fragmentShader:'uniform sampler2D tDiffuse;uniform float time,vignette,grain,warm,saturation;varying vec2 vUv;\n'+
 'float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}\n'+
 'void main(){vec4 c=texture2D(tDiffuse,vUv);float l=dot(c.rgb,vec3(.2126,.7152,.0722));c.rgb=mix(vec3(l),c.rgb,saturation);vec2 q=vUv-.5;float v=1.-dot(q,q)*vignette*1.6;c.rgb*=v;\n'+
 'c.rgb+=(h(vUv*vec2(1731.,977.)+time)-.5)*grain;c.r+=warm*.6;c.b-=warm*.4;gl_FragColor=c;}'};

/** Real-time lighting keyframes: hour → sky + lights. */
const SKY=[
 {h:0,hemi:0x7d8fb8,hi:.55,sun:0xb8c8f0,si:.75,sky:['#1f2840','#3c4660'],night:1,exp:.9},
 {h:5.5,hemi:0x8a98bc,hi:.6,sun:0xc2cff4,si:.8,sky:['#2f3852','#545a78'],night:.9,exp:.9},
 {h:6.6,hemi:0xf5d2bc,hi:.75,sun:0xffb48a,si:1.4,sky:['#efcdb9','#f8e7da'],night:.12,exp:.92},
 {h:8.5,hemi:0xf4ecdc,hi:.8,sun:0xfff0d8,si:1.75,sky:['#e3dbc6','#f4eedf'],night:0,exp:.92},
 {h:16,hemi:0xf4ecdc,hi:.78,sun:0xfff0d8,si:1.7,sky:['#e3dbc6','#f4eedf'],night:0,exp:.92},
 {h:17.6,hemi:0xf6d4b4,hi:.72,sun:0xffa060,si:1.55,sky:['#eabf9b','#f8e0c8'],night:.12,exp:.92},
 {h:19.2,hemi:0x9a98be,hi:.62,sun:0xc9b4f5,si:.85,sky:['#433f5e','#6f6584'],night:.8,exp:.9},
 {h:20.2,hemi:0x7d8fb8,hi:.55,sun:0xb8c8f0,si:.75,sky:['#1f2840','#3c4660'],night:1,exp:.9},
 {h:24,hemi:0x7d8fb8,hi:.55,sun:0xb8c8f0,si:.75,sky:['#1f2840','#3c4660'],night:1,exp:.9}];
function skyAt(hour){
 const h=((hour%24)+24)%24;let i=0;while(i<SKY.length-2&&SKY[i+1].h<=h)i++;
 const a=SKY[i],b=SKY[i+1],t=clamp((h-a.h)/Math.max(.001,b.h-a.h),0,1);
 const col=(x,y)=>new THREE.Color(x).lerp(new THREE.Color(y),t);
 const mixHex=(x,y)=>'#'+new THREE.Color(x).lerp(new THREE.Color(y),t).getHexString();
 return {hemi:col(a.hemi,b.hemi),hi:lerp(a.hi,b.hi,t),sun:col(a.sun,b.sun),si:lerp(a.si,b.si,t),sky:[mixHex(a.sky[0],b.sky[0]),mixHex(a.sky[1],b.sky[1])],night:lerp(a.night,b.night,t),exp:lerp(a.exp,b.exp,t),hour:h};
}

export function createIsland(host,{onPick=()=>{},reduced=()=>false,faces={}}={}){
 let renderer;
 try{renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'})}catch(e){host.dataset.webgl='off';return null}
 if(!renderer.getContext()){host.dataset.webgl='off';return null}
 const lite=matchMedia('(pointer: coarse)').matches||Math.min(screen.width,screen.height)<700;
 renderer.setPixelRatio(Math.min(lite?1.25:1.5,window.devicePixelRatio||1));
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;
 renderer.domElement.className='island-canvas';renderer.domElement.setAttribute('aria-hidden','true');
 host.append(renderer.domElement);host.dataset.tier=lite?'lite':'full';
 const tip=document.createElement('div');tip.className='island-pop';tip.hidden=true;host.append(tip);
 const say=document.createElement('div');say.className='island-say';say.hidden=true;say.setAttribute('role','status');host.append(say);
 say.addEventListener('click',e=>{if(e.target.closest('[data-island-talk]')){say.hidden=true;onPick({kind:'xiaoya-talk'})}});

 const scene=new THREE.Scene();
 const pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(new RoomEnvironment(),.04).texture;scene.environmentIntensity=.18;
 const camera=new THREE.PerspectiveCamera(30,1,.1,100);
 const hemi=new THREE.HemisphereLight(0xfff6ea,0xb7a98c,1.2);scene.add(hemi);
 const sun=new THREE.DirectionalLight(0xfff0d8,2.8);sun.position.set(-4,7,5);sun.castShadow=true;
 sun.shadow.mapSize.set(lite?1024:2048,lite?1024:2048);Object.assign(sun.shadow.camera,{left:-7,right:7,top:7,bottom:-7,near:1,far:30});sun.shadow.bias=-.0006;sun.shadow.normalBias=.02;sun.shadow.radius=4;scene.add(sun);
 const loader=new THREE.TextureLoader();
 const paper=paperMaps('#f5eedf',7);paper.map.repeat.set(3,2);paper.normal.repeat.set(3,2);
 const fibre=paperMaps('#ffffff',11);fibre.map.repeat.set(2,2);fibre.normal.repeat.set(2,2);
 const P=(color,opts={})=>new THREE.MeshStandardMaterial({color,roughness:.93,metalness:0,map:fibre.map,normalMap:fibre.normal,normalScale:new THREE.Vector2(.35,.35),envMapIntensity:.6,...opts});
 const shadowTex=softShadowTexture();

 // ---------- post-processing ----------
 const composer=new EffectComposer(renderer);
 composer.addPass(new RenderPass(scene,camera));
 const tilt=new ShaderPass(TiltShift);composer.addPass(tilt);
 const bloom=lite?null:new UnrealBloomPass(new THREE.Vector2(256,256),.28,.5,.92);if(bloom)composer.addPass(bloom);
 const grade=new ShaderPass(Grade);composer.addPass(grade);
 composer.addPass(new OutputPass());

 // ---------- the book ----------
 const book=new THREE.Group();scene.add(book);
 const pageMat=new THREE.MeshStandardMaterial({color:C.page,roughness:.95,map:paper.map,normalMap:paper.normal,normalScale:new THREE.Vector2(.5,.5)});
 const edgeMat=P(C.pageEdge);
 for(const side of [-1,1]){
  // A page stack: several sheets fanned slightly so the edge reads as paper.
  for(let k=0;k<3;k++){const p=new THREE.Mesh(new THREE.BoxGeometry(6.5-k*.04,.07,7.3-k*.04),[edgeMat,edgeMat,pageMat,edgeMat,edgeMat,edgeMat]);
   p.position.set(side*(3.3-k*.01),-.04-k*.07,0);p.rotation.z=side*(.03+k*.006);p.receiveShadow=true;p.castShadow=k===0;book.add(p)}
 }
 const spine=new THREE.Mesh(new THREE.CylinderGeometry(.18,.18,7.4,24),P(C.spine,{map:null}));spine.rotation.x=Math.PI/2;spine.position.y=-.22;book.add(spine);
 const coverPivot=new THREE.Group();book.add(coverPivot);
 const coverMat=P(0x3b5a46,{map:null});
 const coverFace=new THREE.MeshStandardMaterial({map:bannerTexture('LifeLab','小芽',{bg:'#3b5a46',fg:'#f4ecd9',accent:'#dc8c69'}),roughness:.8});
 const cover=new THREE.Mesh(new THREE.BoxGeometry(6.7,.14,7.5),[coverMat,coverMat,coverFace,coverMat,coverMat,coverMat]);
 cover.position.set(3.35,.08,0);cover.castShadow=true;coverPivot.add(cover);coverPivot.visible=false;
 const starGeo=new THREE.BufferGeometry();{const p=[],r=seeded(5);for(let i=0;i<140;i++)p.push((r()-.5)*22,4+r()*4,-4-r()*6);starGeo.setAttribute('position',new THREE.Float32BufferAttribute(p,3))}
 const stars=new THREE.Points(starGeo,new THREE.PointsMaterial({color:0xfff6dd,size:.07,transparent:true,opacity:0,depthWrite:false}));scene.add(stars);

 // ---------- dynamic world ----------
 const world=new THREE.Group();scene.add(world);
 const pickables=[],pops=[],ripples=[],flags=[],waves=[],timeUniforms=[];
 let known=new Set(),firstBuild=true,clock=0,last=performance.now(),labelScale=1,night=0;
 const windowMat=new THREE.MeshStandardMaterial({color:C.window,emissive:0x000000,roughness:.9});
 const lampMats=[];
 const mats={};const M=(key,color,opts)=>mats[key]||(mats[key]=P(color,opts));
 function pop(obj,delay,key){obj.userData.popKey=key;obj.userData.base=obj.scale.clone();obj.userData.baseRotX=obj.rotation.x;obj.userData.baseY=obj.position.y;
  const isNew=!known.has(key);if(reduced()||(!firstBuild&&!isNew))return;
  obj.scale.set(obj.scale.x,.001,obj.scale.z);obj.rotation.x=obj.userData.baseRotX-1.25;pops.push({obj,delay,dur:.7,t:0});
  if(!firstBuild&&isNew&&obj.userData.pick)ripple(obj.position,delay+.25);
 }
 function ripple(at,delay=0){const r=new THREE.Mesh(new THREE.RingGeometry(.2,.26,56),new THREE.MeshBasicMaterial({color:C.sprout,transparent:true,opacity:0,depthWrite:false}));
  r.rotation.x=-Math.PI/2;r.position.set(at.x,at.y+.04,at.z);world.add(r);ripples.push({mesh:r,t:-delay})}
 function pickable(obj,data){obj.userData.pick=data;obj.traverse(o=>{if(o.isMesh||o.isLineSegments){o.userData.pick=data;o.userData.root=obj;if(o.isMesh)pickables.push(o)}})}

 // Terrain: base island + per-stop contour hills. heightAt() keeps everything sitting on the paper.
 const BASE_TOP=.34,STEP=.075;let hills=[];
 function heightAt(x,z){let h=BASE_TOP;for(const hl of hills){let n=0;for(const r of hl.radii){const dx=(x-hl.x)/(r*1.12),dz=(z-hl.z)/(r*.9);if(dx*dx+dz*dz<1)n++}h=Math.max(h,BASE_TOP+n*STEP)}return h}
 function buildTerrain(k,stops){
  const sea=new THREE.Group();
  [[4.55,.1,9,0,C.sea1,.0],[4.2,.09,11,1.3,C.sea2,.03],[3.85,.08,13,2.6,C.sea3,.06]].forEach(([r,a,w,ph,col,y],j)=>{
   const shape=portrait?waveRing(r,a,w,ph,.82,1.18):waveRing(r,a,w,ph);const m=extrudeFlat(shape,.03,M('sea'+j,col),M('seaE',C.seaEdge));m.position.y=y;m.receiveShadow=true;m.castShadow=false;sea.add(m);waves.push({m,phase:ph,amp:.012+j*.004,y})});
  world.add(sea);pop(sea,0,k('sea'));
  const isl=new THREE.Group();
  const layers=[[2.95,2.2,C.sand,C.sandEdge,0,.1],[2.82,2.08,C.g1,C.gEdge,.1,.1],[2.66,1.95,C.g2,C.gEdge,.2,.07],[2.5,1.82,C.g3,C.gEdge,.27,.07]];
  // Landscape: the island is wide. Portrait (phones): the same island turned lengthwise to fill the screen.
  layers.forEach(([rx,rz,c,e,y,d],j)=>{const ax=rx*1.18,az=rz;const m=extrudeFlat(portrait?blobShape(az*1.1,ax*.92,11,36,.12):blobShape(ax,az,11,36,.12),d,M('l'+j,c),M('le'+j,e));m.position.y=y;isl.add(m)});
  hills=[];
  stops.forEach((s,i)=>{const levels=clamp(s.levels|0,0,4);const radii=[];const g=new THREE.Group();
   for(let l=1;l<=levels;l++){const r=.66-(l-1)*.12;radii.push(r);const col=[C.g4,C.g5,0xeee9cf,0xf3ecd6][l-1];const m=extrudeFlat(blobShape(r*1.12,r*.9,i*17+l,24,.16),STEP,M('h'+l,col),M('he',C.gEdge));m.position.set(s.x,BASE_TOP+(l-1)*STEP,s.z);g.add(m)}
   hills.push({x:s.x,z:s.z,radii});isl.add(g)});
  world.add(isl);pop(isl,.05,k('island:'+stops.map(s=>s.levels).join('')));
 }
 function buildPath(pts,k){
  curve=new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(p.x,0,p.z)));const g=new THREE.Group();
  const tileMat=M('path',C.path);
  for(let i=0;i<=80;i++){const p=curve.getPoint(i/80),t=curve.getTangent(i/80);const tile=new THREE.Mesh(new THREE.BoxGeometry(.12,.025,.085),tileMat);tile.position.set(p.x,heightAt(p.x,p.z)+.014,p.z);tile.rotation.y=Math.atan2(t.x,t.z)+(i%2?.12:-.08);tile.receiveShadow=true;tile.castShadow=true;g.add(tile)}
  world.add(g);pop(g,.3,k('path'));
 }
 // ---------- cut-paper models ----------
 function house(){const g=new THREE.Group();
  const front=new THREE.Shape();front.moveTo(-.18,0);front.lineTo(.18,0);front.lineTo(.18,.24);front.lineTo(0,.4);front.lineTo(-.18,.24);front.closePath();
  for(const x of [-.1,.06]){const hole=new THREE.Path();hole.moveTo(x,.13);hole.lineTo(x+.055,.13);hole.lineTo(x+.055,.2);hole.lineTo(x,.2);hole.closePath();front.holes.push(hole)}
  const door=new THREE.Path();door.moveTo(-.03,0);door.lineTo(.03,0);door.lineTo(.03,.1);door.lineTo(-.03,.1);door.closePath();front.holes.push(door);
  const body=extrudeUpright(front,.3,M('wall',C.wall),M('wallE',C.wallEdge));g.add(body);
  const glow=new THREE.Mesh(new THREE.BoxGeometry(.32,.18,.26),windowMat);glow.position.y=.11;g.add(glow);
  const roofMat=[M('roof',C.roof),M('roofE',C.roofEdge)];
  for(const s of [-1,1]){const r=new THREE.Mesh(new THREE.BoxGeometry(.24,.018,.36),roofMat[0]);r.position.set(s*.092,.33,0);r.rotation.z=-s*.72;r.castShadow=true;g.add(r)}
  return g}
 function tent(){const g=new THREE.Group();const s=new THREE.Shape();s.moveTo(-.2,0);s.lineTo(.2,0);s.lineTo(0,.34);s.closePath();
  const d=new THREE.Path();d.moveTo(-.04,0);d.lineTo(.04,0);d.lineTo(0,.12);d.closePath();s.holes.push(d);
  g.add(extrudeUpright(s,.3,M('tent',C.tent),M('tentE',C.tentEdge)));
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.006,.006,.14),M('ink',C.ink,{map:null}));pole.position.y=.4;g.add(pole);
  const f=new THREE.Mesh(new THREE.PlaneGeometry(.1,.06),M('alarmS',C.alarm,{side:THREE.DoubleSide}));f.position.set(.05,.44,0);g.add(f);return g}
 function lighthouse(state){const g=new THREE.Group();
  const white=M('lhW',C.wall),red=M(state==='done'?'lhD':'lhR',state==='done'?C.pencil:C.alarm);
  [[.1,.085,.12,white],[.085,.075,.08,red],[.075,.068,.08,white]].reduce((y,[a,b,h,m])=>{const c=new THREE.Mesh(new THREE.CylinderGeometry(b,a,h,14),m);c.position.y=y+h/2;c.castShadow=true;g.add(c);return y+h},0);
  const color=state==='urgent'?C.alarm:state==='done'?0xbbbbbb:C.lamp;
  const lm=new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:state==='done'?0:1.6,roughness:.4});lm.userData={state,color};lampMats.push(lm);
  const lamp=new THREE.Mesh(new THREE.SphereGeometry(.055,16,10),lm);lamp.position.y=.33;g.add(lamp);
  const cap=new THREE.Mesh(new THREE.ConeGeometry(.08,.08,14),M('cap',C.ink,{map:null}));cap.position.y=.42;cap.castShadow=true;g.add(cap);
  if(state==='urgent'){const glow=new THREE.PointLight(C.alarm,1.4,1.4);glow.position.y=.34;g.add(glow);g.userData.blink=lm}
  return g}
 function treeShape(h){const s=new THREE.Shape();const w=h*.42;s.moveTo(-.025,0);s.lineTo(.025,0);s.lineTo(.025,h*.18);
  const tiers=3;for(let i=0;i<tiers;i++){const y0=h*(.16+i*.24),y1=y0+h*.3,ww=w*(1-i*.24);s.lineTo(ww,y0);s.lineTo(ww*.22,y1)}
  s.lineTo(0,h);for(let i=tiers-1;i>=0;i--){const y0=h*(.16+i*.24),y1=y0+h*.3,ww=w*(1-i*.24);s.lineTo(-ww*.22,y1);s.lineTo(-ww,y0)}
  s.lineTo(-.025,h*.18);s.closePath();return s}
 function tree(level,pencil){const g=new THREE.Group();const h=.32+level*.11;
  if(pencil){const geo=new THREE.ShapeGeometry(treeShape(.42));for(const r of [0,Math.PI/2]){const e=new THREE.LineSegments(new THREE.EdgesGeometry(geo),new THREE.LineDashedMaterial({color:C.pencil,dashSize:.03,gapSize:.022}));e.computeLineDistances();e.rotation.y=r;g.add(e)}
   const hit=new THREE.Mesh(new THREE.BoxGeometry(.3,.42,.3),new THREE.MeshBasicMaterial({visible:false}));hit.position.y=.21;g.add(hit);return g}
  for(const [r,k] of [[0,'leaf'],[Math.PI/2,'leaf2']]){const m=extrudeUpright(treeShape(h),.022,M(k,C[k]),M('leafE',C.leafEdge));m.rotation.y=r;g.add(m)}
  return g}
 function stone(){const g=new THREE.Group();const box=new THREE.BoxGeometry(.34,.035,.24);
  const fill=new THREE.Mesh(box,new THREE.MeshBasicMaterial({color:C.pencil,transparent:true,opacity:.16,depthWrite:false}));
  const edge=new THREE.LineSegments(new THREE.EdgesGeometry(box),new THREE.LineDashedMaterial({color:0x4f5560,dashSize:.03,gapSize:.022}));edge.computeLineDistances();
  g.add(fill,edge);return g}
 function tower(n){const g=new THREE.Group();for(let i=0;i<n;i++){const b=new THREE.Mesh(new THREE.BoxGeometry(.2-i%2*.025,.065,.2-i%2*.025),[M('twE',C.wallEdge),M('twE',C.wallEdge),M('tw'+(i%2),i%2?C.wall:0xf0e6cf),M('twE',C.wallEdge),M('twE',C.wallEdge),M('twE',C.wallEdge)]);b.position.y=.035+i*.068;b.rotation.y=i*.21;b.castShadow=true;b.receiveShadow=true;g.add(b)}return g}
 function flower(color){const g=new THREE.Group();const stem=new THREE.Mesh(new THREE.CylinderGeometry(.006,.006,.16),M('leaf',C.leaf));stem.position.y=.08;g.add(stem);
  const petals=new THREE.Shape();for(let i=0;i<=40;i++){const a=i/40*Math.PI*2,r=.05+Math.abs(Math.sin(a*2.5))*.03;const x=Math.cos(a)*r,y=Math.sin(a)*r;i?petals.lineTo(x,y):petals.moveTo(x,y)}
  const head=extrudeUpright(petals,.012,M('pt'+color,color),M('ptE',0xb06a48));head.position.y=.19;g.add(head);
  const core=new THREE.Mesh(new THREE.SphereGeometry(.018,8,6),M('core',0xf6e3a1));core.position.set(0,.19,.01);g.add(core);return g}
 function cloud(){const g=new THREE.Group();const s=new THREE.Shape();
  const bumps=[[-.34,.0,.2],[-.12,.1,.26],[.14,.08,.24],[.36,-.01,.18]];s.moveTo(-.55,-.1);
  for(const [x,y,r] of bumps)s.absarc(x,y,r,Math.PI,0,true);s.lineTo(.55,-.1);s.closePath();
  const m=extrudeFlat(s,.05,M('cloud',C.cloud,{transparent:true,opacity:.96}),M('cloudE',C.cloudEdge));m.rotation.x=0;g.add(m);return g}
 function addBanner(g,kicker,main,{accent,bg,height=.9}={}){
  const geo=new THREE.PlaneGeometry(.9,.39,14,2);geo.translate(.45,0,0);
  const tex=bannerTexture(kicker,main,{accent,bg});
  // A touch of self-light keeps the lettering legible when the banner faces away from the sun.
  const banner=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({map:tex,emissive:0xffffff,emissiveMap:tex,emissiveIntensity:.32,side:THREE.DoubleSide,roughness:.85,transparent:true,alphaTest:.5}));
  banner.position.set(0,height+.12,0);banner.scale.setScalar(labelScale);banner.castShadow=true;banner.userData.rest=geo.attributes.position.array.slice();banner.userData.seed=Math.random()*6;
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.011,.011,height+.2),M('ink',C.ink,{map:null}));pole.position.y=(height+.2)/2;pole.castShadow=true;
  const knob=new THREE.Mesh(new THREE.SphereGeometry(.022,10,8),M('knob',C.today,{map:null}));knob.position.y=height+.21;
  g.add(pole,knob,banner);g.userData.flag=banner;flags.push(banner);
 }

 let curve=null,stopsCount=7,xiaoya=null,clouds=[];
 const walk={t:null,target:0,wanderAt:0,face:1,stop:0};
 const faceTex={};
 function face(n){if(!faceTex[n]&&faces[n]){faceTex[n]=loader.load(faces[n]);faceTex[n].colorSpace=THREE.SRGBColorSpace}return faceTex[n]}
 const keepTex=new Set([paper.map,paper.normal,fibre.map,fibre.normal,shadowTex]);
 function clearWorld(){
  for(const o of [...world.children]){world.remove(o);o.traverse(x=>{x.geometry?.dispose();(Array.isArray(x.material)?x.material:[x.material]).forEach(m=>{if(!m||m===windowMat||Object.values(mats).includes(m))return;if(m.map&&!keepTex.has(m.map)&&!Object.values(faceTex).includes(m.map))m.map.dispose();m.dispose?.()})})}
  pickables.length=0;flags.length=0;lampMats.length=0;ripples.length=0;waves.length=0;timeUniforms.length=0;
 }
 let model=null;
 let portrait=false;
 // Stops along an S: left→right on wide screens, far→near on portrait phones.
 function stopPoints(n){const out=[];for(let i=0;i<n;i++){const u=lerp(-1,1,i/(n-1)),s=i%2?-1:1;
  out.push(portrait?{x:s*.62,z:u*2.75}:{x:u*2.55,z:(i%2?-.6:.52)*1.04})}return out}

 function placeXiaoya(focusIndex,k){
  const tex=face(model.xiaoyaFace||4);const stand=new THREE.Group();
  const geo=new THREE.PlaneGeometry(1.1,1.1,8,10);
  const cardMat=new THREE.MeshStandardMaterial({map:tex,transparent:true,alphaTest:.1,side:THREE.DoubleSide,roughness:.85});
  // Leaf sway: vertices in the top third (the sprout) swing gently with time.
  const uTime={value:0};timeUniforms.push(uTime);
  cardMat.onBeforeCompile=sh=>{sh.uniforms.uTime=uTime;sh.vertexShader='uniform float uTime;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nfloat k=smoothstep(.62,1.,uv.y);transformed.x+=sin(uTime*2.1+uv.x*2.)*.045*k;transformed.y+=cos(uTime*1.7)*.012*k;')};
  const card=new THREE.Mesh(geo,cardMat);card.position.y=.58;card.castShadow=true;
  const cardDepth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,map:tex,alphaTest:.1});card.customDepthMaterial=cardDepth;
  const foot=new THREE.Mesh(new THREE.CylinderGeometry(.15,.17,.035,24),M('foot',0xf7f0e2));foot.position.y=.018;
  const blob=new THREE.Mesh(new THREE.PlaneGeometry(.7,.42),new THREE.MeshBasicMaterial({map:shadowTex,transparent:true,depthWrite:false}));blob.rotation.x=-Math.PI/2;blob.position.y=.004;
  stand.add(blob,foot,card);stand.userData.card=card;
  pickable(stand,{kind:'xiaoya',label:'小芽 · 点我'});world.add(stand);xiaoya=stand;
  walk.target=focusIndex/(stopsCount-1);walk.stop=focusIndex;
  if(walk.t===null||firstBuild)walk.t=reduced()?walk.target:0;
  positionXiaoya(0);pop(stand,1.45,k('xiaoya'));
 }
 function positionXiaoya(bob){
  if(!xiaoya||!curve)return;const t=clamp(walk.t,0,1),p=curve.getPoint(t),tan=curve.getTangent(t);
  const side=new THREE.Vector3(-tan.z,0,tan.x).normalize().multiplyScalar(.3);const x=p.x+side.x,z=p.z+side.z;
  xiaoya.position.set(x,heightAt(x,z)+bob,z);
 }

 function update(m){
  model=m;const keys=new Set();clearWorld();const k=s=>{keys.add(s);return s};
  tip.hidden=true;say.hidden=true;hoverRoot=null;
  if(m.kind==='season')buildSeason(m,k);else buildWeek(m,k);
  clouds=[];[[-3.4,2.7,-2.5,1],[3.2,3,-2.9,.85],[.5,3.3,-3.6,1.1]].forEach(([x,y,z,s])=>{const c=cloud();c.position.set(x,y,z);c.scale.setScalar(s);world.add(c);clouds.push(c)});
  applySky(m.hour??new Date().getHours()+new Date().getMinutes()/60);
  known=keys;firstBuild=false;frame();
 }
 function buildWeek(m,k){
  stopsCount=7;const pts=stopPoints(7);
  const busy=m.days.map(d=>d.items.reduce((n,it)=>n+Math.max(0,toMin(it.end)-toMin(it.start)),0)/60);
  buildTerrain(k,pts.map((p,i)=>({...p,levels:Math.round(busy[i]/1.1)})));
  buildPath(pts,k);
  m.days.forEach((d,i)=>{
   const at=pts[i],top=heightAt(at.x,at.z);const g=new THREE.Group();g.position.set(at.x,top,at.z);
   const disc=new THREE.Mesh(new THREE.CylinderGeometry(d.isToday?.29:.23,d.isToday?.29:.23,.04,36),M(d.isToday?'stopT':'stop',d.isToday?C.today:C.stop));disc.position.y=.02;disc.receiveShadow=true;disc.castShadow=true;g.add(disc);
   addBanner(g,d.label,String(d.dom),{accent:d.isToday?'#dc8c69':'#2b3243',bg:d.isToday?'#fff3e6':'#fbf6ea'});
   if(d.isToday){const halo=new THREE.Mesh(new THREE.RingGeometry(.35,.4,48),new THREE.MeshBasicMaterial({color:C.today,transparent:true,opacity:.6,depthWrite:false}));halo.rotation.x=-Math.PI/2;halo.position.y=.045;g.add(halo);g.userData.halo=halo}
   const busyText=d.items.length?d.items.length+' 项课程或活动'+(busy[i]?' · 约 '+Math.round(busy[i]*10)/10+' 小时':''):'没有课程或活动';
   pickable(g,{kind:'day',date:d.key,label:d.label+' '+d.dom+' 日 · '+busyText+(d.due.length?' · '+d.due.length+' 项截止':''),dive:true});
   world.add(g);pop(g,.4+i*.07,k('day:'+d.key));
   const ring=(n,idx,rad=.6)=>{const a=(idx/Math.max(1,n))*Math.PI*1.25+(i%2?Math.PI*.88:-Math.PI*.12);return [Math.cos(a)*rad,Math.sin(a)*rad*.8]};
   const items=d.items.slice(0,5);
   items.forEach((it,j)=>{const b=it.kind==='course'?house():tent();b.scale.setScalar(1.45);const [x,z]=ring(items.length,j);const px=at.x+x,pz=at.z+z;b.position.set(px,heightAt(px,pz),pz);b.rotation.y=Math.atan2(-x,-z)*.25;
    if(it.conflict){const pen=new THREE.Mesh(new THREE.PlaneGeometry(.1,.06),M('alarmS',C.alarm,{side:THREE.DoubleSide}));pen.position.set(0,.52,0);b.add(pen)}
    pickable(b,{kind:it.kind,id:it.id,date:d.key,recurring:it.recurring,occurrenceDate:it.occurrenceDate,label:it.title+' · '+it.start+'–'+it.end+(it.place?' · '+it.place:'')+(it.conflict?' · 有重叠':'')});
    world.add(b);pop(b,.65+i*.07+j*.05,k(it.kind+':'+it.id+'@'+d.key))});
   d.due.slice(0,3).forEach((t,j)=>{const l=lighthouse(t.done?'done':t.urgent?'urgent':'later');l.scale.setScalar(1.55);const side=i%2?-1:1;const px=at.x+(j-.5*(Math.min(3,d.due.length)-1))*.34,pz=at.z+side*.7;l.position.set(px,heightAt(px,pz),pz);
    pickable(l,{kind:'task',id:t.id,label:(t.done?'已交 · ':'截止 '+t.time+' · ')+t.title});world.add(l);pop(l,.75+i*.07+j*.05,k('due:'+t.id+':'+(t.done?1:0)))});
   const tufts=Math.min(7,Math.round(d.freeMinutes/55));const r=seeded(i*31+5);
   for(let j=0;j<tufts;j++){const tuft=new THREE.Mesh(new THREE.ConeGeometry(.028,.11,5),M(j%2?'leaf':'leaf2',j%2?C.leaf:C.leaf2));const a=r()*Math.PI*2,rr=.3+r()*.25;const px=at.x+Math.cos(a)*rr,pz=at.z+Math.sin(a)*rr*.7;tuft.position.set(px,heightAt(px,pz)+.05,pz);tuft.castShadow=true;world.add(tuft)}
   d.pencilIds.slice(0,3).forEach((id,j)=>{const s=stone();s.scale.setScalar(1.35);const px=at.x+(j-1)*.4,pz=at.z+(i%2?.42:-.42);s.position.set(px,heightAt(px,pz)+.03,pz);s.rotation.y=.2*j;pickable(s,{kind:'pencil',id,date:d.key,label:'小芽的铅笔建议 · 点开看依据',dive:true});world.add(s);pop(s,.95+i*.06+j*.05,k('pencil:'+id))});
  });
  goalsRim(m.goals,k);
  const idx=Math.max(0,m.days.findIndex(d=>d.isToday));placeXiaoya(m.attentionDay??idx,k);
 }
 function moodColor(v){if(v==null)return null;const lo=new THREE.Color(0x9fb3c8),hi=new THREE.Color(0xf2c47a);return lo.lerp(hi,clamp((v-1)/4,0,1)).getHex()}
 function buildSeason(m,k){
  stopsCount=m.weeks.length;const pts=stopPoints(stopsCount);
  buildTerrain(k,pts.map((p,i)=>({...p,levels:m.weeks[i].isFuture?0:Math.round((m.weeks[i].done+m.weeks[i].checkins)/2.2)})));
  buildPath(pts,k);
  m.weeks.forEach((w,i)=>{
   const at=pts[i],top=heightAt(at.x,at.z);const g=new THREE.Group();g.position.set(at.x,top,at.z);
   const mood=moodColor(w.mood);
   const disc=new THREE.Mesh(new THREE.CylinderGeometry(w.isCurrent?.29:.24,w.isCurrent?.29:.24,.04,36),w.isFuture?new THREE.MeshBasicMaterial({color:C.pencil,transparent:true,opacity:.18,depthWrite:false}):(w.isCurrent?M('stopT',C.today):P(mood??C.stop)));disc.position.y=.02;disc.receiveShadow=true;g.add(disc);
   if(w.isFuture){const e=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.CylinderGeometry(.24,.24,.04,24)),new THREE.LineDashedMaterial({color:0x4f5560,dashSize:.035,gapSize:.025}));e.computeLineDistances();e.position.y=.02;g.add(e)}
   addBanner(g,w.isCurrent?'本周':w.isFuture?'未来':'第 '+(i+1)+' 格',w.label,{accent:w.isCurrent?'#dc8c69':w.isFuture?'#8a8f99':'#2b3243',bg:w.isFuture?'#f1efe9':'#fbf6ea',height:.78});
   const parts=[w.done?'完成 '+w.done+' 项':'',w.checkins?'目标行动 '+w.checkins+' 次 · '+w.minutes+' 分钟':'',w.mood!=null?'心情均值 '+w.mood:'',w.isFuture&&w.intentions?'铅笔意向 '+w.intentions+' 次':''].filter(Boolean);
   pickable(g,{kind:'week',start:w.key,label:(w.isCurrent?'本周':w.label+' 这一周')+(parts.length?' · '+parts.join(' · '):' · 还没有记录'),dive:true});
   world.add(g);pop(g,.4+i*.06,k('wk:'+w.key));
   if(w.done){const t=tower(Math.min(7,w.done));const px=at.x-.3,pz=at.z+(i%2?.3:-.3);t.position.set(px,heightAt(px,pz),pz);pickable(t,{kind:'week',start:w.key,label:'完成 '+w.done+' 项',dive:true});world.add(t);pop(t,.65+i*.06,k('tw:'+w.key+':'+w.done))}
   const r=seeded(i*13+3);
   for(let j=0;j<Math.min(7,w.checkins);j++){const f=flower(j%2?C.petal:C.petal2);f.scale.setScalar(1.35);const a=r()*Math.PI*2,rr=.25+r()*.2;const px=at.x+.22+Math.cos(a)*rr*.6,pz=at.z+Math.sin(a)*rr*.5;f.position.set(px,heightAt(px,pz),pz);f.rotation.y=r()*Math.PI;world.add(f);pop(f,.8+i*.06+j*.03,k('fl:'+w.key+':'+j))}
   if(w.isFuture&&w.intentions){for(let j=0;j<Math.min(3,w.intentions);j++){const s=stone();const px=at.x+(j-1)*.32,pz=at.z+(i%2?.4:-.4);s.position.set(px,heightAt(px,pz)+.03,pz);world.add(s)}}
  });
  goalsRim(m.goals,k);
  placeXiaoya(Math.max(0,m.weeks.findIndex(w=>w.isCurrent)),k);
 }
 function goalsRim(goals,k){
  goals.slice(0,8).forEach((g,j)=>{const level=g.checkins?clamp(1+Math.floor(g.checkins/2),1,5):0;const t=tree(level,!g.checkins);t.scale.setScalar(1.5);
   let x,z;if(portrait){x=(j%2?1:-1)*1.75;z=-2.6+Math.floor(j/2)*.55}else{const a=Math.PI*(1.1+j*.105);x=Math.cos(a)*2.5*1.1;z=-Math.abs(Math.sin(a))*1.75-.1}
   t.position.set(x,heightAt(x,z),z);t.rotation.y=j*.5;
   pickable(t,{kind:'goal',id:g.id,label:g.title+' · '+(g.checkins?g.checkins+' 次真实行动':'还没有第一次行动')});world.add(t);pop(t,1.15+j*.06,k('goal:'+g.id+':'+level))});
 }
 function applySky(hour){
  const s=skyAt(hour);night=s.night;
  hemi.color.copy(s.hemi);hemi.intensity=s.hi;sun.color.copy(s.sun);sun.intensity=s.si;renderer.toneMappingExposure=s.exp;
  if(night>.5)sun.position.set(-2.5,10,4);else{const ang=(clamp(s.hour,6,19)-6)/13*Math.PI;sun.position.set(-Math.cos(ang)*6,5+Math.sin(ang)*5,5)}
  scene.background?.dispose?.();scene.background=skyTexture(s.sky[0],s.sky[1]);
  host.dataset.night=night>.5?'true':'false';
  stars.material.opacity=night*.95;
  windowMat.emissive.setHex(night>.3?0xffb84d:0x000000);windowMat.emissiveIntensity=night*1.6;
  for(const lm of lampMats)if(lm.userData.state==='later'){lm.emissiveIntensity=night>.3?2:.8}
  // Bloom only catches true light sources (lamps, lit windows): the threshold sits above lit paper.
  if(bloom){bloom.enabled=night>.25;bloom.strength=.45*night;bloom.threshold=1.05;bloom.radius=.45}
  grade.uniforms.warm.value=night>.5?-.015:.02;
 }

 // ---------- camera ----------
 let yaw=0,targetYaw=0,parallaxX=0,parallaxY=0,camDist=1,dive=null,driftClock=0,lastDt=0;
 const camLook=new THREE.Vector3(0,.15,.35),camLookTarget=camLook.clone();
 function fit(){
  const w=host.clientWidth||1,h=host.clientHeight||1;renderer.setSize(w,h,false);composer.setSize(w,h);camera.aspect=w/h;
  tilt.uniforms.resolution.value.set(w*renderer.getPixelRatio(),h*renderer.getPixelRatio());
  const wantPortrait=camera.aspect<.9;
  if(wantPortrait!==portrait){portrait=wantPortrait;camBase.y=portrait?10.2:8;camBase.z=portrait?5:6.9;if(model&&!opening){const m=model;known=new Set([...known]);update(m)}}
  camDist=portrait?clamp(1.04/camera.aspect,.9,2.3):clamp(1.2/camera.aspect,.78,2.8);labelScale=clamp(.72+camDist*.32,1,1.55);for(const f of flags)f.scale.setScalar(labelScale);
  tilt.uniforms.amount.value=lite?2.2:3.2;tilt.uniforms.band.value=camera.aspect<1?.3:.26;
  camera.updateProjectionMatrix();placeCamera();frame();
 }
 const camBase={y:8,z:6.9};
 function placeCamera(){
  // Slow "breathing" drift, paused while the pointer is over a piece so targets stay put.
  if(!hoverRoot&&!down)driftClock+=lastDt;const drift=reduced()?0:Math.sin(driftClock*.12)*.045;
  let d=camDist,lookX=camLook.x,lookZ=camLook.z;
  if(dive){const u=easeInOut(clamp(dive.t/dive.dur,0,1));d=lerp(camDist,camDist*.42,u);lookX=lerp(camLook.x,dive.to.x,u);lookZ=lerp(camLook.z,dive.to.z,u)}
  const ang=drift+Math.sin(parallaxX*.08)*.15;
  camera.position.set(lookX+Math.sin(ang)*camBase.z*d,camBase.y*d+parallaxY*.2,lookZ+Math.cos(ang)*camBase.z*d-camLook.z*.0);
  camera.lookAt(lookX,camLook.y,lookZ);
  tilt.uniforms.focus.value=.54+(dive?easeInOut(clamp(dive.t/dive.dur,0,1))*-.04:0);
 }
 const ray=new THREE.Raycaster(),ptr=new THREE.Vector2();
 let down=null,hoverRoot=null;
 function hitObj(e){const r=renderer.domElement.getBoundingClientRect();ptr.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(ptr,camera);return ray.intersectObjects(pickables,false)[0]?.object||null}
 function screenOf(obj,lift=.85){const v=new THREE.Vector3();obj.getWorldPosition(v);v.y+=lift;v.project(camera);return {x:(v.x+1)/2*host.clientWidth,y:(1-v.y)/2*host.clientHeight}}
 function showTip(root){
  if(!root){tip.hidden=true;return}
  const p=root.userData.pick;tip.textContent=p.label||'';tip.hidden=!p.label;const s=screenOf(root);
  tip.style.left=clamp(s.x,90,host.clientWidth-90)+'px';tip.style.top=Math.max(8,s.y-8)+'px';
 }
 renderer.domElement.addEventListener('pointerdown',e=>{if(dive)return;down={x:e.clientX,y:e.clientY,yaw:targetYaw,moved:false};renderer.domElement.setPointerCapture?.(e.pointerId)});
 renderer.domElement.addEventListener('pointermove',e=>{
  const r=renderer.domElement.getBoundingClientRect();
  if(down){const dx=e.clientX-down.x;if(Math.abs(dx)>6){down.moved=true;tip.hidden=true;say.hidden=true}targetYaw=clamp(down.yaw+dx/r.width*1.6,-.7,.7);frame();return}
  // No pointer parallax: a camera that follows the mouse moves targets out from under the cursor.
  if(e.pointerType==='mouse'){
   const o=hitObj(e),root=o?.userData.root||null;if(root!==hoverRoot){hoverRoot=root;renderer.domElement.style.cursor=root?'pointer':'grab'}showTip(hoverRoot);frame()}
 });
 renderer.domElement.addEventListener('pointerleave',()=>{hoverRoot=null;tip.hidden=true;frame()});
 renderer.domElement.addEventListener('pointerup',e=>{const d=down;down=null;if(!d||d.moved||dive)return;const o=hitObj(e),p=o?.userData.pick;
  if(!p){say.hidden=true;return}
  if(p.kind==='xiaoya'){hop=1;speak();return}
  // Days, weeks and pencils: the camera dives toward the stop, then the page turns to paper.
  if(p.dive&&!reduced()){const v=new THREE.Vector3();o.userData.root.getWorldPosition(v);dive={t:0,dur:.6,to:v,pick:p};tip.hidden=true;frame();return}
  onPick(p)});
 renderer.domElement.addEventListener('pointercancel',()=>{down=null});
 renderer.domElement.style.touchAction='pan-y';
 function speak(){
  if(!xiaoya)return;const text=model?.speech||'我在这里。';
  say.innerHTML='<p></p><button type="button" data-island-talk>和小芽聊聊</button>';say.querySelector('p').textContent=text;say.hidden=false;
  placeSay();clearTimeout(speak.t);speak.t=setTimeout(()=>{say.hidden=true},7000);
 }
 function placeSay(){
  if(!xiaoya||say.hidden)return;const head=screenOf(xiaoya,1.25),feet=screenOf(xiaoya,0),h=say.offsetHeight||110;
  const below=head.y-h<8;say.classList.toggle('is-below',below);
  say.style.left=clamp(head.x,140,host.clientWidth-140)+'px';say.style.top=(below?Math.min(host.clientHeight-h-8,feet.y+10):head.y)+'px';
 }

 // ---------- animation loop ----------
 let raf=0,visible=true,hop=0,opening=null;
 function frame(){if(!raf&&visible)raf=requestAnimationFrame(tick)}
 const camW=new THREE.Vector3(),tmpQ=new THREE.Quaternion();
 function tick(now){
  raf=0;const dt=Math.min(.05,(now-last)/1000);last=now;clock+=dt;lastDt=dt;
  let busy=false;
  for(const p of pops){if(p.done)continue;p.t+=dt;const u=clamp((p.t-p.delay)/p.dur,0,1);if(u<1)busy=true;else p.done=true;
   const e=u<=0?0:easeBack(u),b=p.obj.userData.base;p.obj.scale.set(b.x,Math.max(.001,b.y*e),b.z);p.obj.rotation.x=p.obj.userData.baseRotX-1.25*(1-clamp(u*1.35,0,1))}
  if(pops.length&&pops.every(p=>p.done))pops.length=0;
  for(const r of ripples){r.t+=dt;if(r.t<0){busy=true;continue}const u=clamp(r.t/1.3,0,1);r.mesh.scale.setScalar(1+u*5.5);r.mesh.material.opacity=.9*(1-u);if(u<1)busy=true;else r.mesh.visible=false}
  if(opening){busy=opening(dt)||busy}
  if(dive){dive.t+=dt;busy=true;if(dive.t>=dive.dur){const p=dive.pick;dive=null;onPick(p)}}
  yaw+=(targetYaw-yaw)*Math.min(1,dt*8);world.rotation.y=yaw;if(Math.abs(targetYaw-yaw)>.001)busy=true;
  for(const o of pickables){const root=o.userData.root;if(!root||root.userData.baseY===undefined||root===xiaoya)continue;
   const want=root.userData.baseY+(root===hoverRoot?.07:0);if(Math.abs(root.position.y-want)>.001){root.position.y+=(want-root.position.y)*Math.min(1,dt*12);busy=true}}
  camera.getWorldPosition(camW);
  if(!reduced()){
   for(const u of timeUniforms)u.value=clock;
   for(const w of waves){w.m.position.y=w.y+Math.sin(clock*.9+w.phase)*w.amp;w.m.rotation.y=Math.sin(clock*.15+w.phase)*.012}
   for(const [j,c] of clouds.entries()){c.position.x+=dt*.07*(j%2?-1:1);if(c.position.x>4.4)c.position.x=-4.4;if(c.position.x<-4.4)c.position.x=4.4;c.position.y+=Math.sin(clock*.6+j)*.0008}
   for(const f of flags){const a=f.geometry.attributes.position,rest=f.userData.rest;for(let i=0;i<a.count;i++){const x=rest[i*3];a.array[i*3+2]=Math.sin(clock*3.2+x*7+f.userData.seed)*.035*(x/.9)}a.needsUpdate=true}
   for(const lm of lampMats)if(lm.userData.state==='urgent')lm.emissiveIntensity=1.4+Math.sin(clock*5)*1.2;
   if(xiaoya&&!opening&&pops.length===0){
    const diff=walk.target-walk.t;let bob=0,squash=0;
    if(Math.abs(diff)>.002){const step=Math.sign(diff)*Math.min(Math.abs(diff),dt*.2);walk.t+=step;walk.face=Math.sign(diff);const ph=Math.abs(Math.sin(clock*10));bob=ph*.05;squash=(ph-.5)*.12}
    else if(clock>walk.wanderAt){walk.wanderAt=clock+7+Math.random()*6;const home=walk.stop/(stopsCount-1);walk.target=clamp(home+(Math.random()-.5)*.05,0,1)}
    positionXiaoya(bob);
    const card=xiaoya.userData.card;const jump=hop>0?Math.sin(hop*Math.PI):0;
    card.position.y=.58+Math.sin(clock*2.2)*.015+jump*.3;card.scale.y=1+squash+(hop>0?jump*.08:Math.sin(clock*2.2)*.01);
    card.scale.x+=((walk.face<0?-1:1)*(1-squash*.6)-card.scale.x)*Math.min(1,dt*10);if(hop>0)hop=Math.max(0,hop-dt*2.1);
    placeSay();
   }
   busy=true;
  }else if(xiaoya){walk.t=walk.target;positionXiaoya(0)}
  if(xiaoya){const l=xiaoya.parent.worldToLocal(camW.clone());xiaoya.rotation.y=Math.atan2(l.x-xiaoya.position.x,l.z-xiaoya.position.z)}
  // Banners face the camera fully (pitch included) so the lettering stays readable from a top-down phone view;
  // a small yaw keeps them from looking pasted onto the screen.
  for(const f of flags){f.parent.getWorldQuaternion(tmpQ).invert();f.quaternion.copy(tmpQ.multiply(camera.quaternion));f.rotateY(-.26)}
  if(hoverRoot)showTip(hoverRoot);
  grade.uniforms.time.value=clock%10;
  placeCamera();composer.render(dt);
  if(busy||down)frame();
 }
 const io=new IntersectionObserver(es=>{visible=es[0].isIntersecting&&document.visibilityState==='visible';if(visible)frame()});io.observe(host);
 const onVis=()=>{visible=document.visibilityState==='visible';if(visible)frame()};document.addEventListener('visibilitychange',onVis);
 const ro=new ResizeObserver(fit);ro.observe(host);fit();
 const skyTimer=setInterval(()=>{if(model){applySky(new Date().getHours()+new Date().getMinutes()/60);frame()}},5*60000);

 function playOpening(){
  return new Promise(res=>{let resolve=res;
   if(reduced()){coverPivot.visible=false;resolve();return}
   const safety=setTimeout(()=>{if(opening){opening=null;coverPivot.visible=false;world.visible=true;camBase.y=portrait?10.2:8;camBase.z=portrait?5:6.9;if(lastModel){firstBuild=false;update(lastModel)}resolve()}},4600);
   const done=resolve;resolve=()=>{clearTimeout(safety);done()};
   coverPivot.visible=true;coverPivot.rotation.z=0;world.visible=false;walk.t=null;
   let t=0;const startY=camBase.y,startZ=camBase.z;camBase.y=13.5;camBase.z=3.8;
   opening=dt=>{t+=dt;
    const c=clamp(t/1.3,0,1);coverPivot.rotation.z=-Math.PI*(1-Math.pow(1-c,3));
    if(t>.8&&!world.visible){world.visible=true;firstBuild=true;known=new Set();if(lastModel)update(lastModel)}
    const k=clamp((t-.35)/2.5,0,1),e=easeInOut(k);camBase.y=13.5+(startY-13.5)*e;camBase.z=3.8+(startZ-3.8)*e;
    if(c>=1)coverPivot.visible=false;
    if(t>=2.9){camBase.y=startY;camBase.z=startZ;opening=null;resolve();return false}
    return true};
   frame();
  });
 }
 let lastModel=null;
 return {
  update(m){if(lastModel&&lastModel.kind!==m.kind){firstBuild=true;known=new Set();walk.t=null}lastModel=m;update(m)},
  playOpening,
  celebrate(){hop=1;frame()},
  speak,
  /** What would be picked at host-relative CSS pixel (x,y) — QA/diagnostics. */
  pickAt(x,y){const r=renderer.domElement.getBoundingClientRect();return hitObj({clientX:r.left+x,clientY:r.top+y})?.userData.pick?.kind||null},
  locate(kind){let root=null;for(const o of pickables){if(o.userData.pick?.kind===kind){root=o.userData.root;break}}if(!root)return null;const s=screenOf(root,kind==='xiaoya'?.6:.15);return {x:s.x,y:s.y}},
  dispose(){cancelAnimationFrame(raf);clearInterval(skyTimer);io.disconnect();ro.disconnect();document.removeEventListener('visibilitychange',onVis);clearWorld();Object.values(mats).forEach(m=>m.dispose());composer.dispose?.();pmrem.dispose();renderer.dispose();renderer.domElement.remove();tip.remove();say.remove()},
  canvas:renderer.domElement
 };
}
