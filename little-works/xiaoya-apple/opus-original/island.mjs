// 小芽生活小岛 · Three.js r180 (vendored), authored cardstock models and a living shoreline.
// One mast per day/week, with bounded hanging records; colour and ! distinguish schedule states.
// Representative houses/tents retain their folds; the deadline lighthouse telescopes vertically.
// A reference-shaped Xiaoya follows the pointer along collision-checked paths. The meadow is decorative.
// Season view keeps actual completed work, check-ins and recorded mood local to the original archive.
import * as THREE from './vendor/three/three.module.min.js';
import {createPaperKit} from './paper-kit.mjs';
import {islandLayout,insideLand,clearPoint,clearSegment,nearestOpenPoint,planIslandPath,flagState,flagRows} from './island-layout.mjs';
import {createCoastalLife} from './coastal-life.mjs';
import {createLandform} from './island-landform.mjs';
import {canTapWater} from './water-touch.mjs';
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
 renderer.setPixelRatio(Math.min(lite?1.5:2,window.devicePixelRatio||1));
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 renderer.info.autoReset=false;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;
 renderer.domElement.className='island-canvas';renderer.domElement.setAttribute('aria-hidden','true');
 host.append(renderer.domElement);host.dataset.tier=lite?'lite':'full';
 const tip=document.createElement('div');tip.className='island-pop';tip.hidden=true;host.append(tip);
 const say=document.createElement('div');say.className='island-say';say.hidden=true;say.setAttribute('role','status');host.append(say);
 say.addEventListener('click',e=>{if(e.target.closest('[data-island-talk]')){say.hidden=true;onPick({kind:'xiaoya-talk'})}});

 const scene=new THREE.Scene();
 const pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(new RoomEnvironment(),.04).texture;scene.environmentIntensity=.3;
 const camera=new THREE.PerspectiveCamera(30,1,.1,100);
 const hemi=new THREE.HemisphereLight(0xfff6ea,0xb7a98c,1.2);scene.add(hemi);
 const sun=new THREE.DirectionalLight(0xfff0d8,2.8);sun.position.set(-4,7,5);sun.castShadow=true;
 sun.shadow.mapSize.set(lite?1024:2048,lite?1024:2048);Object.assign(sun.shadow.camera,{left:-7,right:7,top:7,bottom:-7,near:1,far:30});sun.shadow.bias=-.0006;sun.shadow.normalBias=.012;sun.shadow.radius=4;scene.add(sun);
 const loader=new THREE.TextureLoader();
 const paper=paperMaps('#f5eedf',7);paper.map.repeat.set(3,2);paper.normal.repeat.set(3,2);
 const fibre=paperMaps('#ffffff',11);fibre.map.repeat.set(2,2);fibre.normal.repeat.set(2,2);
 const P=(color,opts={})=>new THREE.MeshStandardMaterial({color,roughness:.93,metalness:0,map:fibre.map,normalMap:fibre.normal,normalScale:new THREE.Vector2(.13,.13),envMapIntensity:.6,...opts});
 const shadowTex=softShadowTexture();

 // ---------- post-processing ----------
 const composer=new EffectComposer(renderer);
 composer.addPass(new RenderPass(scene,camera));
 const tilt=new ShaderPass(TiltShift);tilt.enabled=false;composer.addPass(tilt);
 const bloom=lite?null:new UnrealBloomPass(new THREE.Vector2(256,256),.28,.5,.92);if(bloom)composer.addPass(bloom);
 const grade=new ShaderPass(Grade);grade.uniforms.grain.value=.006;grade.uniforms.vignette.value=.14;grade.uniforms.saturation.value=1.02;composer.addPass(grade);
 composer.addPass(new OutputPass());

 // ---------- the book ----------
 const book=new THREE.Group();scene.add(book);book.visible=false;
 const pageMat=new THREE.MeshStandardMaterial({color:C.page,roughness:.95,map:paper.map,normalMap:paper.normal,normalScale:new THREE.Vector2(.12,.12)});
 const edgeMat=P(C.pageEdge);
 for(const side of [-1,1]){
  // A page stack: several sheets fanned slightly so the edge reads as paper.
  for(let k=0;k<4;k++){const geo=new THREE.BoxGeometry(5.05-k*.035,.055,6.55-k*.035).toNonIndexed(),colors=[];
   for(let i=0;i<geo.attributes.normal.count;i++){const top=geo.attributes.normal.getY(i)>.5;colors.push(top?1:.86,top?1:.8,top?1:.69)}geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.clearGroups();pageMat.vertexColors=true;
   const p=new THREE.Mesh(geo,pageMat);
   p.position.set(side*(2.56-k*.009),-.045-k*.055,0);p.rotation.z=side*(.018+k*.004);p.receiveShadow=true;p.castShadow=k===0;book.add(p)}
 }
 const spine=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,6.65,20),P(0x627258,{map:null}));spine.rotation.x=Math.PI/2;spine.position.y=-.19;book.add(spine);
 const binding=new THREE.Mesh(new THREE.BoxGeometry(10.5,.13,6.85),P(0x3b5947,{map:null}));binding.position.y=-.34;binding.castShadow=true;book.add(binding);
 const ribbon=new THREE.Shape();ribbon.moveTo(-.11,0);ribbon.lineTo(.11,0);ribbon.lineTo(.11,1);ribbon.lineTo(0,.89);ribbon.lineTo(-.11,1);ribbon.closePath();
 const bookmark=extrudeFlat(ribbon,.015,P(0xb97356,{map:null}),P(0x92553e,{map:null}));bookmark.position.set(-.7,-.06,2.75);book.add(bookmark);
 const coverPivot=new THREE.Group();book.add(coverPivot);
 const coverMat=P(0x3b5a46,{map:null});
 const coverFace=new THREE.MeshStandardMaterial({map:bannerTexture('LifeLab','小芽',{bg:'#3b5a46',fg:'#f4ecd9',accent:'#dc8c69'}),roughness:.8});
 const cover=new THREE.Mesh(new THREE.BoxGeometry(5.25,.12,6.85),[coverMat,coverMat,coverFace,coverMat,coverMat,coverMat]);
 cover.position.set(2.625,.08,0);cover.castShadow=true;coverPivot.add(cover);coverPivot.visible=false;
 const starGeo=new THREE.BufferGeometry();{const p=[],r=seeded(5);for(let i=0;i<140;i++)p.push((r()-.5)*22,4+r()*4,-4-r()*6);starGeo.setAttribute('position',new THREE.Float32BufferAttribute(p,3))}
 const stars=new THREE.Points(starGeo,new THREE.PointsMaterial({color:0xfff6dd,size:.07,transparent:true,opacity:0,depthWrite:false}));scene.add(stars);

 // ---------- dynamic world ----------
 const world=new THREE.Group();scene.add(world);
 const pickables=[],pops=[],flags=[],waves=[],timeUniforms=[];
 let known=new Set(),firstBuild=true,clock=0,last=performance.now(),labelScale=1,night=0;
 const windowMat=new THREE.MeshStandardMaterial({color:C.window,emissive:0x000000,roughness:.9});
 const lampMats=[];
 const mats={};const M=(key,color,opts)=>mats[key]||(mats[key]=P(color,opts));
 let unfold=reduced()?1:0,unfoldTarget=1,unfoldTime=0,folding=!reduced(),disposed=false,posePhase=0,lastHeight=null;
 const foldDuration=2.15;
 function reveal(obj,u){
  const e=easeInOut(clamp(u,0,1));const ground=/^(sea|island:|path)/.test(obj.userData.popKey||'');obj.visible=ground||!!obj.userData.fold||u>0;
  if(obj.userData.fold)obj.userData.fold(e);
  else obj.position.y=obj.userData.baseY-(1-e)*(ground?0:(obj.userData.revealLift??.13));
 }
 function pop(obj,delay,key){
  obj.userData.popKey=key;obj.userData.base=obj.scale.clone();obj.userData.baseRotX=obj.rotation.x;obj.userData.baseY=obj.position.y;
  const isNew=!known.has(key),spawn=!reduced()&&!firstBuild&&isNew?0:1;
  pops.push({obj,delay:delay*.52,dur:.9,spawn,master:true});
  reveal(obj,Math.min(spawn,clamp((unfold*foldDuration-delay*.52)/.9,0,1)));
 }
 function pickable(obj,data){obj.userData.pick=data;obj.traverse(o=>{if(o.isMesh||o.isLineSegments){o.userData.pick=data;o.userData.root=obj;if(o.isMesh)pickables.push(o)}})}

 // Terrain: base island + per-stop contour hills. heightAt() keeps everything sitting on the paper.
 const BASE_TOP=.34,STEP=.045;let hills=[],bounds=islandLayout(7,false),obstacles=[],coastalLife=null,lighthouseSite=null;
 function heightAt(x,z){let h=BASE_TOP;for(const hl of hills){let n=0;for(const r of hl.radii){const dx=(x-hl.x)/(r*1.12),dz=(z-hl.z)/(r*.9);if(dx*dx+dz*dz<1)n++}h=Math.max(h,BASE_TOP+n*STEP)}return h}
 function buildTerrain(k,stops){
  const isl=createLandform(bounds,M);hills=[];
  stops.forEach((at,i)=>{const levels=clamp(at.levels|0,0,2),radii=[];
   for(let l=1;l<=levels;l++){const r=.46-(l-1)*.12;radii.push(r);const layer=extrudeFlat(blobShape(r*1.12,r*.9,i*17+l,24,.09),STEP,M('hill-v2-'+l,l===1?0xc7d7aa:0xd5dfb9),M('hill-edge-v2',0x91a87a));layer.position.set(at.x,BASE_TOP+(l-1)*STEP,at.z);isl.add(layer);}hills.push({x:at.x,z:at.z,radii});
  });world.add(isl);pop(isl,.05,k('island:'+stops.map(s=>s.levels).join('')));
 }
 function buildPath(pts,k){
  curve=new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(p.x,0,p.z)));const g=new THREE.Group();
  const tileMat=M('path',C.path);
  const tiles=new THREE.InstancedMesh(new THREE.BoxGeometry(.12,.025,.085),tileMat,81),dummy=new THREE.Object3D();
  for(let i=0;i<=80;i++){const p=curve.getPointAt(i/80),t=curve.getTangentAt(i/80);dummy.position.set(p.x,heightAt(p.x,p.z)+.014,p.z);dummy.rotation.y=Math.atan2(t.x,t.z)+(i%2?.12:-.08);dummy.updateMatrix();tiles.setMatrixAt(i,dummy.matrix)}
  tiles.castShadow=true;tiles.receiveShadow=true;tiles.instanceMatrix.needsUpdate=true;g.add(tiles);
  world.add(g);pop(g,.3,k('path'));
 }
 // ---------- cut-paper models ----------
 const {house,tent,lighthouse,tree,character}=createPaperKit({material:M,windowMat,lampMats});
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
 function mastTexture(kicker,main,state='empty',small=false){
  const c=document.createElement('canvas');c.width=512;c.height=small?150:210;const g=c.getContext('2d');
  const palette=state==='attention'?['#f5cec3','#b47460']:state==='busy'?['#ffe6a5','#ad9553']:['#fffdf4','#929c84'];
  g.fillStyle=palette[0];g.fillRect(0,0,512,c.height);g.fillStyle=palette[1];g.fillRect(0,0,6,c.height);
  g.globalCompositeOperation='destination-out';g.beginPath();g.moveTo(512,0);g.lineTo(484,c.height/2);g.lineTo(512,c.height);g.fill();g.globalCompositeOperation='source-over';
  g.fillStyle='#6e765b';g.textAlign='left';g.textBaseline='middle';
  if(!small&&kicker.startsWith('周')){g.fillStyle='#3e493a';g.font='600 96px '+FONT;g.fillText(kicker+' '+String(main).replace(' 日',''),27,105,450);}
  else{g.font='500 '+(small?32:66)+'px '+FONT;g.fillText(kicker,27,small?30:45);g.fillStyle='#3e493a';g.font='600 '+(small?75:82)+'px '+FONT;const limit=small?5:10;const text=[...String(main)];g.fillText(text.length>limit?text.slice(0,limit-1).join('')+'…':String(main),27,small?101:141,450);}
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;return tex;
 }
 function addBanner(g,kicker,main,{state='empty',rows=[],data=null,height=1.13}={}){
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.012,.015,height+.17,10),M('mast-wood',0x8e7955,{map:null}));pole.position.y=(height+.17)/2;pole.castShadow=true;g.add(pole);
  const knob=new THREE.Mesh(new THREE.SphereGeometry(.025,8,6),M('mast-cap',0xc3a66f,{map:null}));knob.position.y=height+.17;g.add(knob);
  const labels=[];
  const add=(a,b,state,y,small,pick)=>{const w=small?.76:.86,h=small?.22:.34,geo=new THREE.PlaneGeometry(w,h,8,2);geo.translate(w/2+.015,0,0);const tex=mastTexture(a,b,state,small);
   const banner=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide,transparent:true,alphaTest:.5}));banner.position.set(0,y,0);banner.userData.rest=geo.attributes.position.array.slice();banner.userData.seed=y*3;banner.userData.tooltipLift=.04;g.add(banner);flags.push(banner);labels.push({banner,pick});};
  add(kicker,main,state,height,false,data);
  rows.forEach((r,i)=>add(r.time||r.kicker||'',r.title,r.attention?'attention':'busy',height-.34-i*.245,true,r.pick||null));
  g.userData.labels=labels;return labels;
 }

 let curve=null,stopsCount=7,xiaoya=null,clouds=[];
 const walk={t:null,target:0,wanderAt:0,face:1,stop:0,x:0,z:0,path:[],pointer:null,gaze:null,navAt:0,lastPointer:0,latency:0};
 const faceTex={};
 function face(n){if(!faceTex[n]&&faces[n]){faceTex[n]=loader.load(faces[n]);faceTex[n].colorSpace=THREE.SRGBColorSpace}return faceTex[n]}
 const keepTex=new Set([paper.map,paper.normal,fibre.map,fibre.normal,shadowTex]);
 function clearWorld(){
  for(const o of [...world.children]){world.remove(o);o.traverse(x=>{x.geometry?.dispose();(Array.isArray(x.material)?x.material:[x.material]).forEach(m=>{if(!m||m===windowMat||Object.values(mats).includes(m))return;if(m.map&&!keepTex.has(m.map)&&!Object.values(faceTex).includes(m.map))m.map.dispose();m.dispose?.()})})}
  pops.length=0;pickables.length=0;flags.length=0;lampMats.length=0;waves.length=0;timeUniforms.length=0;
 }
 let model=null,visualKey=null;
 let portrait=false;
 // Stops along an S: left→right on wide screens, far→near on portrait phones.
 function stopPoints(n){bounds=islandLayout(n,portrait);return bounds.points;}
 function addObstacle(obj,r){obstacles.push({x:obj.position.x,z:obj.position.z,r,key:obj.userData.popKey||obj.name});}
 function addFlagObstacle(mast,rows){if(rows.length)obstacles.push({x:mast.position.x+.4,z:mast.position.z,r:.43,flag:mast,key:'hanging-flags'});}
 function placeXiaoya(focusIndex,k){
  const stand=character();stand.scale.setScalar(.66);
  const blob=new THREE.Mesh(new THREE.PlaneGeometry(.58,.4),new THREE.MeshBasicMaterial({map:shadowTex,transparent:true,depthWrite:false}));blob.rotation.x=-Math.PI/2;blob.position.y=.004;stand.add(blob);
  pickable(stand,{kind:'xiaoya',label:'小芽 · 点我'});world.add(stand);xiaoya=stand;
  const home=nearestOpenPoint({x:0,z:bounds.rz*.6},bounds,obstacles,.29);
  if(!clearPoint(walk,bounds,obstacles,.29)||firstBuild){walk.x=home?.x||0;walk.z=home?.z||0;}
  walk.home=home||{x:walk.x,z:walk.z};walk.path=[];walk.gaze=null;walk.pointer=null;walk.planned=null;walk.wanderAt=clock+10;
  lastHeight=null;positionXiaoya(0);stand.rotation.y=-yaw;pop(stand,1.5,k('xiaoya'));
 }
 function positionXiaoya(bob=0){
  if(!xiaoya)return;let h=heightAt(walk.x,walk.z);
  for(let i=0;i<8;i++){const a=i/8*Math.PI*2;h=Math.max(h,heightAt(walk.x+Math.cos(a)*.15,walk.z+Math.sin(a)*.15));}
  h+=.012;lastHeight=lastHeight===null||h>lastHeight?h:lastHeight+(h-lastHeight)*Math.min(1,lastDt*16);xiaoya.position.set(walk.x,lastHeight+bob,walk.z);
 }
 function followGround(e){
  if(!xiaoya||folding||unfold<.98||down)return;
  const r=renderer.domElement.getBoundingClientRect();ptr.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(ptr,camera);
  const at=new THREE.Vector3();if(!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-BASE_TOP),at))return;
  world.worldToLocal(at);walk.gaze={x:at.x,z:at.z,pitch:clamp(-ptr.y*.16,-.18,.18)};walk.lastPointer=clock;walk.eventAt=performance.now();walk.inputPending=true;
  if(!hoverRoot&&insideLand(at,bounds,.35))walk.pointer={x:at.x,z:at.z};else {walk.pointer=null;if(hoverRoot){walk.path=[];walk.planned=null}}
  frame();
 }
 function update(m){
  model=m;const signature=JSON.stringify({...m,speech:undefined,hour:undefined,xiaoyaFace:undefined});
  if(signature===visualKey&&!firstBuild){applySky(m.hour??new Date().getHours());frame();return}
  visualKey=signature;const keys=new Set();clearWorld();obstacles=[];lighthouseSite=null;const k=s=>{keys.add(s);return s};
  tip.hidden=true;say.hidden=true;hoverRoot=null;
  if(m.kind==='season')buildSeason(m,k);else buildWeek(m,k);
  coastalLife=createCoastalLife({bounds,lite,heightAt,obstacles,material:M,beacon:lighthouseSite});world.add(coastalLife.group);
  clouds=[];
  applySky(m.hour??new Date().getHours()+new Date().getMinutes()/60);
  known=keys;firstBuild=false;fit();frame();
 }
 function buildWeek(m,k){
  stopsCount=7;const pts=stopPoints(7);
  buildTerrain(k,pts.map((p,i)=>({...p,levels:Math.min(2,Math.round(m.days[i].items.length/2))})));buildPath(pts,k);
  m.days.forEach((d,i)=>{
   const at=pts[i],mast=new THREE.Group();mast.name='day-mast';mast.position.set(at.x+.18,heightAt(at.x+.18,at.z),at.z);
   const state=flagState(d),dayPick={kind:'day',date:d.key,label:d.label+' '+d.dom+' 日 · '+d.items.length+' 项安排'+(d.due.length?' · '+d.due.length+' 项截止':''),dive:true};mast.userData.state=state;
   const disc=new THREE.Mesh(new THREE.CylinderGeometry(.16,.18,.025,24),M(d.isToday?'today-v2':'day-base-v2',d.isToday?0xe6bc68:0xeee7d2));disc.position.y=.013;disc.receiveShadow=true;mast.add(disc);
   const rows=flagRows(d,portrait?2:3).map(r=>({...r,pick:r.kind==='summary'?dayPick:{kind:r.kind,id:r.id,date:d.key,recurring:r.recurring,occurrenceDate:r.occurrenceDate,label:r.title+(r.time?' · '+r.time:'')}}));
   if(!rows.length&&d.pencilIds.length)rows.push({title:d.pencilIds.length+' 笔铅笔建议',kicker:'待你确认',pick:{kind:'pencil',id:d.pencilIds[0],date:d.key,label:'小芽的铅笔建议',dive:true}});
   rows.forEach(r=>{if(r.attention)r.time='! '+(r.time||'需关注')});
   const labels=addBanner(mast,d.label+(state==='attention'?' !':''),d.dom+' 日',{state,rows,data:dayPick});pickable(mast,dayPick);for(const l of labels)if(l.pick)pickable(l.banner,l.pick);
   world.add(mast);pop(mast,.3+i*.04,k('mast:'+d.key+':'+state));addObstacle(mast,.32);addFlagObstacle(mast,rows);
   // One representative building per lot; the flags and the list retain every actual record.
   const it=d.items[0];if(it){const b=it.kind==='course'?house():tent();b.scale.setScalar(.9);b.position.set(at.x-.43,heightAt(at.x-.43,at.z+.05),at.z+.05);b.rotation.y=-.18;
    pickable(b,{kind:it.kind,id:it.id,date:d.key,recurring:it.recurring,occurrenceDate:it.occurrenceDate,label:it.title+' · '+it.start+'–'+it.end});world.add(b);pop(b,.6+i*.035,k(it.kind+':'+it.id+'@'+d.key));addObstacle(b,.28);}
   d.pencilIds.slice(0,1).forEach(id=>{const stoneObj=stone();stoneObj.scale.setScalar(.65);stoneObj.position.set(at.x-.1,heightAt(at.x-.1,at.z+.44)+.025,at.z+.44);pickable(stoneObj,{kind:'pencil',id,date:d.key,label:'小芽的铅笔建议',dive:true});world.add(stoneObj);pop(stoneObj,.9,k('pencil:'+id));});
  });
  const deadlines=m.days.flatMap(d=>d.due.map(t=>({...t,date:d.key}))).filter(t=>!t.done);
  if(deadlines.length){const t=deadlines.find(x=>x.urgent)||deadlines[0],l=lighthouse(t.urgent?'urgent':'later');l.scale.setScalar(1.65);const at=portrait?{x:bounds.rx*.7,z:bounds.rz*.54}:{x:bounds.rx*.69,z:bounds.rz*.53};l.position.set(at.x,heightAt(at.x,at.z),at.z);lighthouseSite={x:at.x,z:at.z};pickable(l,{kind:'task',id:t.id,label:'灯塔 · '+t.title+' · '+deadlines.length+' 项截止'});world.add(l);pop(l,.8,k('due:'+t.id));addObstacle(l,.33);}
  goalsRim(m.goals,k);placeXiaoya(m.attentionDay??0,k);
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
   g.position.x+=.15;const weekRows=[...(w.done?[{kicker:'真实完成',title:w.done+' 件事项'}]:[]),...(w.checkins?[{kicker:'目标行动',title:w.checkins+' 次'}]:[])];
   addBanner(g,w.teachingWeek?'第 '+w.teachingWeek+' 周':w.isCurrent?'本周':w.isFuture?'未来':'这一周',w.label,{state:w.done||w.checkins||w.intentions?'busy':'empty',rows:weekRows,height:1.1});g.name='week-mast';addFlagObstacle(g,weekRows);
   const parts=[w.done?'完成 '+w.done+' 项':'',w.checkins?'目标行动 '+w.checkins+' 次 · '+w.minutes+' 分钟':'',w.mood!=null?'心情均值 '+w.mood:'',w.isFuture&&w.intentions?'铅笔意向 '+w.intentions+' 次':''].filter(Boolean);
   pickable(g,{kind:'week',start:w.key,label:(w.isCurrent?'本周':w.label+' 这一周')+(parts.length?' · '+parts.join(' · '):' · 还没有记录'),dive:true});
   world.add(g);pop(g,.4+i*.04,k('wk:'+w.key));addObstacle(g,.34);
   if(w.done){const t=tower(Math.min(4,w.done));t.scale.setScalar(.75);const px=at.x-.3,pz=at.z+(i%2?.3:-.3);t.position.set(px,heightAt(px,pz),pz);pickable(t,{kind:'week',start:w.key,label:'完成 '+w.done+' 项',dive:true});world.add(t);pop(t,.65+i*.06,k('tw:'+w.key+':'+w.done))}
   const r=seeded(i*13+3);
   for(let j=0;j<Math.min(2,w.checkins);j++){const f=flower(j%2?C.petal:C.petal2);f.scale.setScalar(.9);const a=r()*Math.PI*2,rr=.25+r()*.2;const px=at.x+.22+Math.cos(a)*rr*.6,pz=at.z+Math.sin(a)*rr*.5;f.position.set(px,heightAt(px,pz),pz);f.rotation.y=r()*Math.PI;world.add(f);pop(f,.8+i*.06+j*.03,k('fl:'+w.key+':'+j))}
   if(w.isFuture&&w.intentions){for(let j=0;j<Math.min(3,w.intentions);j++){const s=stone();const px=at.x+(j-1)*.32,pz=at.z+(i%2?.4:-.4);s.position.set(px,heightAt(px,pz)+.03,pz);world.add(s)}}
  });
  goalsRim(m.goals,k);
  placeXiaoya(Math.max(0,m.weeks.findIndex(w=>w.isCurrent)),k);
 }
 function goalsRim(goals,k){
  goals.slice(0,4).forEach((g,j)=>{const level=g.checkins?clamp(1+Math.floor(g.checkins/2),1,4):0,t=tree(level,!g.checkins);t.scale.setScalar(.92);
   const a=portrait?Math.PI*(.15+j*.24):Math.PI*(1.08+j*.27);const x=Math.cos(a)*bounds.rx*.78,z=Math.sin(a)*bounds.rz*.7;
   t.position.set(x,heightAt(x,z),z);t.rotation.y=j*.5;pickable(t,{kind:'goal',id:g.id,label:g.title+' · '+g.checkins+' 次真实行动'});world.add(t);pop(t,1.1+j*.04,k('goal:'+g.id+':'+level));addObstacle(t,.32);
  });
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
  for(const f of flags)f.material.color.setScalar(1-night*.32);
 }

 // ---------- camera ----------
 let yaw=0,targetYaw=0,parallaxX=0,parallaxY=0,camDist=1,dive=null,driftClock=0,lastDt=0,viewZoom=1,zoomTarget=1;
 const camLook=new THREE.Vector3(0,.15,.35),camLookTarget=camLook.clone();
 function fit(){
  const w=host.clientWidth||1,h=host.clientHeight||1;renderer.setSize(w,h,false);composer.setSize(w,h);camera.aspect=w/h;
  tilt.uniforms.resolution.value.set(w*renderer.getPixelRatio(),h*renderer.getPixelRatio());
  const wantPortrait=camera.aspect<.9;
  if(wantPortrait!==portrait){portrait=wantPortrait;book.rotation.y=portrait?Math.PI/2:0;visualKey=null;camBase.y=portrait?9.6:8;camBase.z=portrait?9.2:6.9;if(model&&!opening){const m=model;known=new Set([...known]);update(m)}}
  const baseLength=Math.hypot(camBase.y,camBase.z),vertical=2*bounds.rz*camBase.y/baseLength+1.8,horizontal=2*bounds.rx+1.7;camDist=Math.max(vertical/(baseLength*.536),horizontal/(baseLength*.536*camera.aspect))*1.03;labelScale=portrait?1.17:1.04;for(const f of flags)f.scale.setScalar(labelScale);
  tilt.uniforms.amount.value=lite?2.2:3.2;tilt.uniforms.band.value=camera.aspect<1?.3:.26;
  camera.updateProjectionMatrix();placeCamera();frame();
 }
 const camBase={y:8,z:6.9};
 function placeCamera(){
  // Slow "breathing" drift, paused while the pointer is over a piece so targets stay put.
  if(!hoverRoot&&!down)driftClock+=lastDt;const drift=reduced()?0:Math.sin(driftClock*.12)*.045;
  let d=camDist*viewZoom,lookX=camLook.x,lookZ=camLook.z;
  if(dive){const u=easeInOut(clamp(dive.t/dive.dur,0,1));d=lerp(camDist,camDist*.42,u);lookX=lerp(camLook.x,dive.to.x,u);lookZ=lerp(camLook.z,dive.to.z,u)}
  const ang=drift+Math.sin(parallaxX*.08)*.15;
  camera.position.set(lookX+Math.sin(ang)*camBase.z*d,camBase.y*d+parallaxY*.2,lookZ+Math.cos(ang)*camBase.z*d-camLook.z*.0);
  camera.lookAt(lookX,camLook.y,lookZ);
  tilt.uniforms.focus.value=.54+(dive?easeInOut(clamp(dive.t/dive.dur,0,1))*-.04:0);
 }
 const ray=new THREE.Raycaster(),ptr=new THREE.Vector2();
 let down=null,hoverRoot=null;
 function waterPoint(e){
  const r=renderer.domElement.getBoundingClientRect();ptr.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(ptr,camera);
  const at=new THREE.Vector3();if(!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),.025),at))return null;
  world.worldToLocal(at);return {x:at.x,z:at.z};
 }
 function hitObj(e){if(folding||unfold<.98)return null;const r=renderer.domElement.getBoundingClientRect();ptr.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(ptr,camera);return ray.intersectObjects(pickables,false)[0]?.object||null}
 function screenOf(obj,lift=.85){const v=new THREE.Vector3();obj.getWorldPosition(v);v.y+=lift;v.project(camera);return {x:(v.x+1)/2*host.clientWidth,y:(1-v.y)/2*host.clientHeight}}
 function showTip(root){
  if(!root){tip.hidden=true;return}
  const p=root.userData.pick;tip.textContent=p.label||'';tip.hidden=!p.label;const s=screenOf(root,root.userData.tooltipLift??.8);
  tip.style.left=clamp(s.x,90,host.clientWidth-90)+'px';tip.style.top=Math.max(8,s.y-8)+'px';
 }
 renderer.domElement.addEventListener('pointerdown',e=>{if(dive||folding)return;down={x:e.clientX,y:e.clientY,yaw:targetYaw,moved:false};renderer.domElement.setPointerCapture?.(e.pointerId)});
 renderer.domElement.addEventListener('pointermove',e=>{
  const r=renderer.domElement.getBoundingClientRect();
  if(down){const dx=e.clientX-down.x;if(Math.abs(dx)>6){down.moved=true;tip.hidden=true;say.hidden=true}targetYaw=clamp(down.yaw+dx/r.width*1.6,-.7,.7);frame();return}
  // No pointer parallax: a camera that follows the mouse moves targets out from under the cursor.
  if(e.pointerType==='mouse'){
   const o=hitObj(e),root=o?.userData.root||null;if(root!==hoverRoot){hoverRoot=root;renderer.domElement.style.cursor=root?'pointer':'grab'}showTip(hoverRoot);followGround(e);frame()}
 });
 renderer.domElement.addEventListener('pointerleave',e=>{hoverRoot=null;tip.hidden=true;
  // A touch pointer leaves after every tap; its deliberate destination must survive that event.
  if(e.pointerType==='mouse'){walk.gaze=null;walk.pointer=null;walk.planned=null;walk.path=[];}frame()});
 renderer.domElement.addEventListener('pointerup',e=>{const d=down;down=null;if(!d||d.moved||dive||folding)return;const o=hitObj(e),p=o?.userData.pick;
  if(!p){
    const at=waterPoint(e);
    if(at&&canTapWater({bounds,x:at.x,z:at.z,dragged:d.moved,reduced:reduced()})){
      if(coastalLife?.tap(at.x,at.z,clock))frame();
    }
    say.hidden=true;followGround(e);if(reduced()&&walk.pointer){const at=nearestOpenPoint(walk.pointer,bounds,obstacles,.29);if(at){walk.x=at.x;walk.z=at.z;positionXiaoya();frame()}}return}
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
 let raf=0,visible=true,hop=0,opening=null,openingResolve=null;
 function frame(){if(!disposed&&!raf&&visible)raf=requestAnimationFrame(tick)}
 const camW=new THREE.Vector3(),tmpQ=new THREE.Quaternion();
 function tick(now){
  raf=0;const wallDt=Math.min(3,Math.max(0,(now-last)/1000)),dt=Math.min(.05,wallDt);last=now;clock+=dt;lastDt=dt;
  let busy=false;
  if(folding&&reduced()){unfold=unfoldTarget;folding=false}
  if(folding){
   const direction=Math.sign(unfoldTarget-unfold);unfold=clamp(unfold+direction*wallDt/foldDuration,0,1);unfoldTime=unfold*foldDuration;
   if(Math.abs(unfoldTarget-unfold)<.002){unfold=unfoldTarget;folding=false}busy=folding;
  }
  for(const p of pops){
   if(p.master){if(p.spawn<1){p.spawn=Math.min(1,p.spawn+wallDt/.65);busy=busy||p.spawn<1}reveal(p.obj,Math.min(p.spawn,clamp((unfold*foldDuration-p.delay)/p.dur,0,1)));}
   else if(!p.done){p.t+=dt;const u=clamp(p.t/p.dur,0,1);reveal(p.obj,u);p.done=u>=1;busy=busy||!p.done;}
  }
  host.dataset.fold=unfold.toFixed(3);if(!scrubbing)foldSlider.value=Math.round(unfold*100);foldToggle.textContent=unfoldTarget===1?'收起':'展开';
  if(opening){busy=opening(wallDt)||busy}
  if(dive){dive.t+=dt;busy=true;if(dive.t>=dive.dur){const p=dive.pick;dive=null;onPick(p)}}
  yaw+=(targetYaw-yaw)*Math.min(1,dt*8);world.rotation.y=yaw;if(Math.abs(targetYaw-yaw)>.001)busy=true;
  viewZoom+=(zoomTarget-viewZoom)*Math.min(1,dt*7);if(Math.abs(viewZoom-zoomTarget)>.001)busy=true;
  camLook.lerp(camLookTarget,1-Math.exp(-dt*10));
  for(const o of pickables){const root=o.userData.root;if(folding||unfold<1||!root||root.userData.baseY===undefined||root===xiaoya)continue;
   const want=root.userData.baseY+(root===hoverRoot?.07:0);if(Math.abs(root.position.y-want)>.001){root.position.y+=(want-root.position.y)*Math.min(1,dt*12);busy=true}}
  camera.getWorldPosition(camW);
  if(!reduced()){
   for(const u of timeUniforms)u.value=clock;
   for(const w of waves){w.m.position.y=w.y+Math.sin(clock*.9+w.phase)*w.amp;w.m.rotation.y=Math.sin(clock*.15+w.phase)*.012}
   for(const [j,c] of clouds.entries()){c.position.x+=dt*.07*(j%2?-1:1);if(c.position.x>4.4)c.position.x=-4.4;if(c.position.x<-4.4)c.position.x=4.4;c.position.y+=Math.sin(clock*.6+j)*.0008}
   for(const f of flags){const a=f.geometry.attributes.position,rest=f.userData.rest;for(let i=0;i<a.count;i++){const x=rest[i*3];a.array[i*3+2]=Math.sin(clock*3.2+x*7+f.userData.seed)*.035*(x/.66)}a.needsUpdate=true}
   for(const lm of lampMats)if(lm.userData.state==='urgent')lm.emissiveIntensity=1.4+Math.sin(clock*5)*1.2;
   if(xiaoya&&!opening&&!folding&&unfold>.98){
    for(const o of obstacles)if(o.flag){const a=-yaw-.26;o.x=o.flag.position.x+.4*Math.cos(a);o.z=o.flag.position.z-.4*Math.sin(a);}
    if(!clearPoint(walk,bounds,obstacles,.29)){const safe=nearestOpenPoint(walk,bounds,obstacles,.29);if(safe){walk.x=safe.x;walk.z=safe.z;walk.path=[];walk.planned=null;}}
    if(walk.pointer&&clock>=walk.navAt){walk.navAt=clock+.09;const target=nearestOpenPoint(walk.pointer,bounds,obstacles,.29);if(target&&(!walk.planned||Math.hypot(target.x-walk.planned.x,target.z-walk.planned.z)>.15)){walk.path=planIslandPath(walk,target,bounds,obstacles,.29);walk.planned=target;}}
    if(!walk.pointer&&clock-walk.lastPointer>8&&clock>walk.wanderAt){walk.wanderAt=clock+9;const h=walk.home,target=nearestOpenPoint({x:h.x+Math.sin(clock)*.45,z:h.z+Math.cos(clock)*.25},bounds,obstacles,.29);if(target)walk.path=planIslandPath(walk,target,bounds,obstacles,.29);}
    let moving=false,heading=xiaoya.rotation.y;
    const dest=walk.path[0];if(dest){const dx=dest.x-walk.x,dz=dest.z-walk.z,dist=Math.hypot(dx,dz),step=Math.min(dist,dt*1.15);
     if(dist>.012){const next={x:walk.x+dx/dist*step,z:walk.z+dz/dist*step};if(clearSegment(walk,next,bounds,obstacles,.29)){walk.x=next.x;walk.z=next.z;posePhase+=step*28;heading=Math.atan2(dx,dz);moving=true;}else{walk.path=[];walk.planned=null;}}
     if(dist<.04)walk.path.shift();}
    positionXiaoya();
    let gazeYaw=0,gazePitch=0;const gaze=walk.gaze;
    if(!moving)heading=Math.atan2(camW.x-xiaoya.position.x,camW.z-xiaoya.position.z)-yaw;
    const delta=THREE.MathUtils.euclideanModulo(heading-xiaoya.rotation.y+Math.PI,Math.PI*2)-Math.PI;xiaoya.rotation.y+=delta*(1-Math.exp(-dt*16));
    if(gaze){const a=Math.atan2(gaze.x-walk.x,gaze.z-walk.z);gazeYaw=THREE.MathUtils.euclideanModulo(a-xiaoya.rotation.y+Math.PI,Math.PI*2)-Math.PI;gazePitch=gaze.pitch;if(walk.inputPending){walk.latency=performance.now()-(walk.eventAt||performance.now());walk.inputPending=false;}}
    const jump=hop>0?Math.sin(hop*Math.PI):0;xiaoya.userData.pose({time:clock,dt,moving:moving?1:0,phase:posePhase,jump,talking:!say.hidden,gazeYaw,gazePitch});if(hop>0)hop=Math.max(0,hop-dt*1.7);placeSay();
   }
   busy=true;
  }else if(xiaoya){positionXiaoya();const a=walk.gaze?Math.atan2(walk.gaze.x-walk.x,walk.gaze.z-walk.z)-xiaoya.rotation.y:0;xiaoya.userData.pose({time:0,dt:1,still:true,gazeYaw:a});}
  coastalLife?.tick(clock,night,reduced());
  // Banners face the camera fully (pitch included) so the lettering stays readable from a top-down phone view;
  // a small yaw keeps them from looking pasted onto the screen.
  for(const f of flags){f.parent.getWorldQuaternion(tmpQ).invert();f.quaternion.copy(tmpQ.multiply(camera.quaternion));f.rotateY(-.26)}
  if(hoverRoot)showTip(hoverRoot);
  grade.uniforms.time.value=clock%10;
  placeCamera();renderer.info.reset();composer.render(dt);
  if((busy||down)&&!disposed)frame();
 }
 const io=new IntersectionObserver(es=>{visible=es[0].isIntersecting&&document.visibilityState==='visible';if(visible){last=performance.now();frame()}});io.observe(host);
 const onVis=()=>{visible=document.visibilityState==='visible';if(visible){last=performance.now();frame()}};document.addEventListener('visibilitychange',onVis);
 const ro=new ResizeObserver(fit);ro.observe(host);fit();
 const skyTimer=setInterval(()=>{if(model){applySky(new Date().getHours()+new Date().getMinutes()/60);frame()}},5*60000);

 function playOpening(){
  if(reduced()){setFold(1);return Promise.resolve()}
  unfold=0;unfoldTarget=1;folding=true;firstBuild=true;known=new Set();if(lastModel)update(lastModel);
  coverPivot.visible=true;const startY=camBase.y,startZ=camBase.z;let elapsed=0;
  return new Promise(resolve=>{openingResolve=resolve;opening=dt=>{
   elapsed+=dt;const u=clamp(elapsed/2.45,0,1),e=easeInOut(u);
   coverPivot.rotation.z=-Math.PI*easeInOut(clamp(elapsed/.9,0,1));coverPivot.visible=elapsed<1;
   camBase.y=startY+1.2*(1-e);camBase.z=startZ-.4*(1-e);
   if(u>=1){opening=null;openingResolve=null;coverPivot.visible=false;camBase.y=startY;camBase.z=startZ;resolve();return false}return true;
  };frame();});
 }
 function setFold(value){
  unfold=unfoldTarget=clamp(value,0,1);folding=false;
  for(const p of pops)if(p.master)reveal(p.obj,clamp((unfold*foldDuration-p.delay)/p.dur,0,1));
  frame();
 }
 const controls=document.createElement('div');controls.className='island-controls';
 controls.innerHTML='<button type="button" data-fold-toggle>收起</button><button type="button" data-fold-replay aria-label="重播纸岛展开">重播</button><button type="button" data-scene-zoom aria-pressed="false">近看</button><label><span class="sr-only">纸岛展开程度</span><input type="range" min="0" max="100" value="0" aria-label="纸岛展开程度"></label>';
 host.append(controls);const foldToggle=controls.querySelector('[data-fold-toggle]'),foldSlider=controls.querySelector('input');let scrubbing=false;
 foldToggle.onclick=()=>{if(opening)return;unfoldTarget=unfoldTarget===1?0:1;if(reduced())setFold(unfoldTarget);else folding=true;tip.hidden=true;say.hidden=true;frame()};
 controls.querySelector('[data-fold-replay]').onclick=()=>{if(opening)return;if(reduced()){setFold(1);return}unfold=0;unfoldTarget=1;folding=true;tip.hidden=true;say.hidden=true;frame()};
 controls.querySelector('[data-scene-zoom]').onclick=e=>{zoomTarget=zoomTarget===1?.55:1;if(zoomTarget===1)camLookTarget.set(0,.15,.35);else if(xiaoya){const at=new THREE.Vector3();xiaoya.getWorldPosition(at);camLookTarget.set(at.x,.42,at.z);}e.currentTarget.textContent=zoomTarget===1?'近看':'全景';e.currentTarget.setAttribute('aria-pressed',zoomTarget===1?'false':'true');if(reduced()){viewZoom=zoomTarget;camLook.copy(camLookTarget)}frame()};
 foldSlider.addEventListener('input',()=>{if(opening)return;scrubbing=true;setFold(Number(foldSlider.value)/100)});foldSlider.addEventListener('change',()=>{scrubbing=false});
 let lastModel=null;
 return {
  update(m){if(lastModel&&lastModel.kind!==m.kind){firstBuild=true;known=new Set();walk.t=null}lastModel=m;update(m)},
  playOpening,
  celebrate(){hop=1;frame()},
  speak,
  /** What would be picked at host-relative CSS pixel (x,y) — QA/diagnostics. */
  pickAt(x,y){const r=renderer.domElement.getBoundingClientRect();return hitObj({clientX:r.left+x,clientY:r.top+y})?.userData.pick?.kind||null},
  locate(kind){let root=null;for(const o of pickables){if(o.userData.pick?.kind===kind){root=o.userData.root;break}}if(!root)return null;const s=screenOf(root,kind==='xiaoya'?.6:.15);return {x:s.x,y:s.y}},
  groundAt(x,z){const v=new THREE.Vector3(x,heightAt(x,z)+.015,z);world.localToWorld(v);v.project(camera);return {x:(v.x+1)/2*host.clientWidth,y:(1-v.y)/2*host.clientHeight,clear:clearPoint({x,z},bounds,obstacles,.29)};},
   waterAt(x,z){const v=new THREE.Vector3(x,-.025,z);world.localToWorld(v);v.project(camera);return {x:(v.x+1)/2*host.clientWidth,y:(1-v.y)/2*host.clientHeight};},
  diagnostics(){return {fold:unfold,folding,yaw,puppet:xiaoya?.name,identity:xiaoya?.userData.identity,navigation:{x:walk.x,z:walk.z,path:walk.path.length,target:walk.pointer,route:walk.path.map(p=>({...p})),gaze:!!walk.gaze,clear:clearPoint(walk,bounds,obstacles,.29),inputLatencyMs:walk.latency,gazeYaw:xiaoya?.getObjectByName('xiaoya-head')?.rotation.y},buildings:world.children.filter(x=>x.name==='fold-house'||x.name==='fold-tent').length,flagPanels:flags.length,masts:world.children.filter(x=>x.name.endsWith('-mast')).length,flagStates:world.children.filter(x=>x.name==='day-mast').map(x=>x.userData.state),obstacles:obstacles.length,coast:coastalLife?.diagnostics(),calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,post:tilt.enabled?'tilt':(bloom?.enabled?'grade+bloom':'grade'),dpr:renderer.getPixelRatio(),objects:pickables.length}},
  dispose(){disposed=true;opening=null;openingResolve?.();openingResolve=null;clearTimeout(speak.t);controls.remove();cancelAnimationFrame(raf);clearInterval(skyTimer);io.disconnect();ro.disconnect();document.removeEventListener('visibilitychange',onVis);clearWorld();Object.values(mats).forEach(m=>m.dispose());scene.background?.dispose?.();scene.environment?.dispose?.();composer.dispose?.();pmrem.dispose();renderer.dispose();renderer.domElement.remove();tip.remove();say.remove()},
  canvas:renderer.domElement
 };
}
