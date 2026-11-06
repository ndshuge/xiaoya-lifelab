// A quiet living shoreline: analytic waves, shallow-water foam, boats, meadow and two rabbits.
// The water uses view-angle reflection and a sun lobe, with no extra reflection render of the scene.
import * as T from './vendor/three/three.module.min.js';
import {nearestOpenPoint,insideLand} from './island-layout.mjs';
const rand=seed=>{let n=seed;return()=>((n=n*16807%2147483647)/2147483647)};
export function waveHeight(x,z,t){return -.025+.025*Math.sin(x*1.6+z*.7-t*1.45)+.015*Math.sin(-x*.9+z*2.9+t*1.2);}
export function createCoastalLife({bounds,lite=false,heightAt,obstacles,material:M}){
 const group=new T.Group();group.name='living-shoreline';
 const shoreRand=rand(11*7919+13),radii=Array.from({length:64},()=>1+(shoreRand()-.5)*.09);
 const uniforms={uTime:{value:0},uNight:{value:0},uCoast:{value:new T.Vector2(bounds.rx,bounds.rz)},uRadii:{value:radii}};
 const ocean=new T.Mesh(new T.PlaneGeometry(40,40,lite?64:112,lite?64:112).rotateX(-Math.PI/2),new T.ShaderMaterial({uniforms,vertexShader:`
 uniform float uTime;uniform vec2 uCoast;varying vec3 vWorld;varying vec2 vSea;
 void main(){vec3 p=position;float shore=length(p.xz/uCoast);float mask=smoothstep(.96,1.2,shore);
 p.y=-.025+mask*(.025*sin(p.x*1.6+p.z*.7-uTime*1.45)+.015*sin(-p.x*.9+p.z*2.9+uTime*1.2));
 vSea=p.xz;vec4 w=modelMatrix*vec4(p,1.);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}
 `,fragmentShader:`
 uniform float uTime,uNight,uRadii[64];uniform vec2 uCoast;varying vec3 vWorld;varying vec2 vSea;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
 float ripple(vec2 p){return noise(p)*.65+noise(mat2(.8,-.6,.6,.8)*p*2.17)*.35;}
 void main(){vec2 p=vSea;float a=atan(p.y/uCoast.y,p.x/uCoast.x),index=mod(a+6.2831853,6.2831853)/6.2831853*64.;int i=int(floor(index));float radius=mix(uRadii[i],uRadii[(i+1)-((i+1)/64)*64],fract(index));float e=length(p/uCoast)/radius;
 float dx=.040*cos(p.x*1.6+p.y*.7-uTime*1.45)-.0135*cos(-p.x*.9+p.y*2.9+uTime*1.2);
 float dz=.0175*cos(p.x*1.6+p.y*.7-uTime*1.45)+.0435*cos(-p.x*.9+p.y*2.9+uTime*1.2);
 vec2 q=p*2.4+vec2(-uTime*.13,uTime*.075);float r=ripple(q);
 dx+=(ripple(q+vec2(.08,0))-r)*.2;dz+=(ripple(q+vec2(0,.08))-r)*.2;
 vec3 n=normalize(vec3(-dx,1.,-dz)),v=normalize(cameraPosition-vWorld),sun=normalize(vec3(-.25,.9,-.55));
 float fres=.025+.65*pow(1.-max(dot(n,v),0.),4.);float spec=pow(max(dot(reflect(-sun,n),v),0.),110.);
 vec3 deep=vec3(.028,.24,.34),shallow=vec3(.17,.54,.55),sky=vec3(.59,.76,.74);
 vec3 col=mix(shallow,deep,smoothstep(1.02,1.9,e));col=mix(col,sky,fres*.8);
 col+=vec3(1.,.87,.62)*spec*(1.-uNight*.65)*.28;
 col+=(r-.5)*vec3(.025,.045,.04);
 float swell=sin(p.x*4.1+p.y*1.35+noise(p*.65)*3.1-uTime*1.35);
 float crest=smoothstep(.91,.997,swell)*smoothstep(.42,.76,noise(p*.9+vec2(uTime*.04,0)));
 col+=crest*vec3(.035,.055,.05)*(1.-uNight*.6);
 float curl=sin(a*19.+sin(a*7.)+uTime*.8)*.007;
 float foam=(1.-smoothstep(.009,.026,abs(e-1.024-curl)))*(.28+.19*sin(a*13.+uTime)*sin(a*29.-uTime*.5));
 foam+=(1.-smoothstep(.004,.013,abs(e-1.09-.009*sin(a*12.-uTime*.55))))*.08;
 col=mix(col,vec3(.81,.89,.79),foam);col*=mix(1.,.34,uNight);
 col=mix(col,vec3(.018,.055,.095),uNight*.3);gl_FragColor=vec4(col,1.);}
 `}));ocean.name='ocean-waves';group.add(ocean);
 const sphere=new T.SphereGeometry(1,16,12),cylinder=new T.CylinderGeometry(1,1,1,10);
 const mesh=(g,geo,mat,x=0,y=0,z=0)=>{const m=new T.Mesh(geo,mat);m.position.set(x,y,z);m.receiveShadow=true;g.add(m);return m};
 const oval=(g,x,y,z,sx,sy,sz,mat)=>{const m=mesh(g,sphere,mat,x,y,z);m.scale.set(sx,sy,sz);return m};
 const box=(g,x,y,z,w,h,d,mat)=>mesh(g,new T.BoxGeometry(w,h,d),mat,x,y,z);
 const ivory=M('shore-ivory',0xf5ecd7),wood=M('shore-wood',0xa37b50),hullMat=M('shore-hull',0x496f78),coral=M('shore-sail-coral',0xc88468),dark=M('shore-dark',0x4d5b48);
 function boat(){
  const g=new T.Group();g.name='coastal-sailboat';
  const s=new T.Shape();s.moveTo(0,-.45);s.bezierCurveTo(-.12,-.35,-.2,-.11,-.17,.2);s.quadraticCurveTo(0,.37,.17,.2);s.bezierCurveTo(.2,-.11,.12,-.35,0,-.45);
  const hullGeo=new T.ExtrudeGeometry(s,{depth:.1,bevelEnabled:true,bevelSegments:2,bevelSize:.025,bevelThickness:.025,curveSegments:14});hullGeo.rotateX(-Math.PI/2);mesh(g,hullGeo,hullMat,0,-.05,0);
  const deck=new T.ShapeGeometry(s);deck.rotateX(-Math.PI/2);const d=mesh(g,deck,wood,0,.06,0);d.scale.setScalar(.88);
  for(const z of [-.18,0,.18])box(g,0,.071,z,.26,.012,.019,ivory);
  const mast=mesh(g,cylinder,wood,0,.39,-.04);mast.scale.set(.012,.64,.012);
  const sail=new T.Group();sail.position.set(0,.19,-.04);sail.rotation.y=Math.PI/2;g.add(sail);
  for(const [side,mat] of [[1,ivory],[-1,coral]]){const shape=new T.Shape();shape.moveTo(side*.015,.05);shape.lineTo(side*.015,.48);shape.quadraticCurveTo(side*.27,.22,side*.25,.06);shape.closePath();const sailMat=mat.clone();sailMat.side=T.DoubleSide;mesh(sail,new T.ShapeGeometry(shape),sailMat);}
  g.userData.sail=sail;g.scale.setScalar(lite?.85:1);return g;
 }
 const boats=[];
 for(let i=0;i<(lite?1:2);i++){const b=boat();group.add(b);boats.push({root:b,phase:1.12+i*2.7});}
 // Low-cost V-shaped wakes follow each hull on the water, rather than tilting with the deck.
 const wakeMat=new T.MeshBasicMaterial({color:0xd0e5db,transparent:true,opacity:.34,side:T.DoubleSide,depthWrite:false});
 const wakes=boats.map(()=>{const s=new T.Shape();s.moveTo(-.12,0);s.lineTo(-.28,.8);s.lineTo(-.25,.8);s.lineTo(-.08,0);s.closePath();s.moveTo(.12,0);s.lineTo(.28,.8);s.lineTo(.25,.8);s.lineTo(.08,0);s.closePath();const geo=new T.ShapeGeometry(s);geo.rotateX(Math.PI/2);const w=mesh(group,geo,wakeMat);return w});
 // Three curved blades per tuft, all tufts in one draw call.
 const pos=[],norm=[];
 for(let blade=0;blade<3;blade++){const a=blade*Math.PI/3,cs=Math.cos(a),sn=Math.sin(a),verts=[[-.016,0,0],[.016,0,0],[.027,.075,.008],[-.016,0,0],[.027,.075,.008],[.01,.145,.018]];
  for(const [x,y,z] of verts){pos.push(x*cs-z*sn,y,x*sn+z*cs);norm.push(-sn,0,cs);}}
 const grassGeo=new T.BufferGeometry();grassGeo.setAttribute('position',new T.Float32BufferAttribute(pos,3));grassGeo.setAttribute('normal',new T.Float32BufferAttribute(norm,3));
 const grassTime={value:0},grassMat=new T.MeshStandardMaterial({color:0xffffff,side:T.DoubleSide,roughness:.96});
 grassMat.onBeforeCompile=sh=>{sh.uniforms.uGrassTime=grassTime;sh.vertexShader='uniform float uGrassTime;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.x+=sin(uGrassTime*1.6+instanceMatrix[3].x*3.)*position.y*.16;')};grassMat.customProgramCacheKey=()=> 'xiaoya-meadow-v2';
 const r=rand(771),sites=[];
 for(let tries=0;tries<1500&&sites.length<(lite?100:200);tries++){const p={x:(r()-.5)*bounds.rx*1.75,z:(r()-.5)*bounds.rz*1.75};if(!insideLand(p,bounds,.15)||obstacles.some(o=>Math.hypot(p.x-o.x,p.z-o.z)<o.r+.28)||Math.abs(p.z)<.15)continue;sites.push(p);}
 const grass=new T.InstancedMesh(grassGeo,grassMat,sites.length),dummy=new T.Object3D();
 sites.forEach((p,i)=>{dummy.position.set(p.x,heightAt(p.x,p.z)+.004,p.z);dummy.scale.setScalar(.55+r()*.55);dummy.rotation.y=r()*6.28;dummy.updateMatrix();grass.setMatrixAt(i,dummy.matrix);grass.setColorAt(i,new T.Color().setHSL(.23+r()*.035,.25+r()*.12,.33+r()*.13));});grass.receiveShadow=true;group.add(grass);
 const rabbits=[];
 for(let i=0;i<2;i++){
  const at=nearestOpenPoint({x:bounds.rx*(i?-.58:.5),z:bounds.rz*.49},bounds,obstacles,.24);if(!at)continue;
  const g=new T.Group();g.name='meadow-rabbit';g.position.set(at.x,heightAt(at.x,at.z)+.018,at.z);g.rotation.y=i?-.6:.9;group.add(g);obstacles.push({...at,r:.24,key:'rabbit-'+i});
  oval(g,0,.1,0,.13,.1,.19,ivory);oval(g,0,.18,.12,.1,.09,.095,ivory);oval(g,0,.1,-.18,.055,.05,.055,ivory);
  for(const side of [-1,1]){oval(g,side*.085,.026,.05,.043,.027,.085,ivory);oval(g,side*.045,.29,.1,.028,.12,.037,ivory);oval(g,side*.047,.295,.127,.013,.075,.007,M('rabbit-ear',0xdcbca2));oval(g,side*.052,.195,.197,.011,.014,.009,dark);}
  oval(g,0,.167,.213,.018,.012,.011,M('rabbit-nose',0xb99b83));rabbits.push({root:g,at,i});
 }
 // Small flying silhouettes over the sea; no flock of foreground props.
 const gulls=[];for(let i=0;i<2;i++){const g=new T.Group();const body=oval(g,0,0,0,.028,.035,.12,ivory),wings=[];for(const side of [-1,1]){const shape=new T.Shape();shape.moveTo(0,0);shape.quadraticCurveTo(side*.2,.03,side*.3,-.065);shape.lineTo(side*.18,-.03);shape.lineTo(0,-.025);const mat=new T.MeshStandardMaterial({color:0xf3eee2,side:T.DoubleSide,roughness:1});const wing=mesh(g,new T.ShapeGeometry(shape),mat);wing.rotation.x=-Math.PI/2;wings.push(wing);}group.add(g);gulls.push({root:g,wings,i});}
 return {group,water:ocean,
  tick(time,night=0,reduced=false){const t=reduced?0:time;uniforms.uTime.value=t;uniforms.uNight.value=night;grassTime.value=t;
   boats.forEach(({root,phase},i)=>{const a=phase+t*.022,rx=bounds.rx+1.15,rz=bounds.rz+1.0,x=Math.cos(a)*rx,z=Math.sin(a)*rz;root.position.set(x,waveHeight(x,z,t)+.015,z);root.rotation.set(Math.sin(t*1.3+i)*.035,Math.atan2(rx*Math.sin(a),-rz*Math.cos(a)),Math.cos(t*1.05+i)*.04);root.userData.sail.rotation.y=Math.PI/2+Math.sin(t*.9+i)*.06;
    const w=wakes[i];w.position.set(x,.012,z);w.rotation.y=root.rotation.y;});
   rabbits.forEach(({root,at,i})=>{root.rotation.y=(i?-.6:.9)+Math.sin(t*.43+i)*.14;root.position.y=heightAt(at.x,at.z)+.018+Math.max(0,Math.sin(t*.7+i)-.9)*.15;});
   gulls.forEach(({root,wings,i})=>{const a=t*.06+i*3.2;root.position.set(Math.cos(a)*(bounds.rx+1.1),1.65+Math.sin(t*.3+i)*.12,Math.sin(a)*(bounds.rz+.8));root.rotation.y=-a;wings.forEach((w,j)=>w.rotation.z=Math.sin(t*4.5+i)*(j?1:-1)*.24);});
  },
  diagnostics(){return {boats:boats.length,rabbits:rabbits.length,gulls:gulls.length,grass:sites.length,boatClearance:Math.min(...boats.map(({root:b})=>Math.hypot(b.position.x/bounds.rx,b.position.z/bounds.rz))),waterTime:uniforms.uTime.value};}
 };
}
