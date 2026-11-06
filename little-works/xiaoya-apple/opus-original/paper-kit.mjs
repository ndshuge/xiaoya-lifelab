// Authored cardstock models. Every fold has a fixed edge; dimensions stay constant.
import * as T from './vendor/three/three.module.min.js';
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x)};
export function createPaperKit({material:M,windowMat,lampMats}){
 const mesh=(geo,mat,parent,x=0,y=0,z=0)=>{const o=new T.Mesh(geo,mat);o.position.set(x,y,z);o.receiveShadow=true;parent.add(o);return o};
 const box=(g,w,h,d,m,x=0,y=0,z=0)=>mesh(new T.BoxGeometry(w,h,d),m,g,x,y,z);
 const pivot=(g,x=0,y=0,z=0)=>{const p=new T.Group();p.position.set(x,y,z);g.add(p);return p};
 const wall=M('paper-wall',0xf4e7ca),edge=M('paper-edge',0xc5ad83),roof=M('paper-roof',0x465b60),roofEdge=M('paper-roof-edge',0x2d4148);
 const ink=M('paper-ink',0x35473f,{map:null}),green=M('paper-green',0x7f9c62),cream=M('paper-cream',0xf9eac9);
 function plate(shape,depth,mat,side=mat){return new T.Mesh(new T.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:16}).translate(0,0,-depth/2),[mat,side])}
 // Batch rigid details per joint; moving hinges remain separate objects.
 function batch(root){
  root.traverse(g=>{if(!g.isGroup)return;const buckets=new Map();
   for(const o of [...g.children])if(o.isMesh&&!Array.isArray(o.material)&&!o.isInstancedMesh){const key=o.material.uuid+':'+o.castShadow;const list=buckets.get(key)||[];list.push(o);buckets.set(key,list);}
   for(const list of buckets.values()){if(list.length<2)continue;const arrays={position:[],normal:[],uv:[]};let count=0;
    for(const o of list){o.updateMatrix();const geo=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();geo.applyMatrix4(o.matrix);for(const key of Object.keys(arrays))arrays[key].push(geo.attributes[key].array);count+=geo.attributes.position.count;geo.dispose();}
    const geo=new T.BufferGeometry();for(const [key,parts] of Object.entries(arrays)){const size=key==='uv'?2:3,buf=new Float32Array(count*size);let offset=0;for(const a of parts){buf.set(a,offset);offset+=a.length}geo.setAttribute(key,new T.BufferAttribute(buf,size));}
    const combined=new T.Mesh(geo,list[0].material);combined.castShadow=list[0].castShadow;combined.receiveShadow=true;g.add(combined);for(const o of list){g.remove(o);o.geometry.dispose();}
   }
  });return root;
 }
 function house(){
  const g=new T.Group();g.name='fold-house';const folds=[];
  box(g,.44,.022,.39,edge,0,.011,0);
  const frontShape=new T.Shape();frontShape.moveTo(-.2,0);frontShape.lineTo(.2,0);frontShape.lineTo(.2,.27);frontShape.lineTo(0,.43);frontShape.lineTo(-.2,.27);frontShape.closePath();
  for(const [z,sign] of [[.17,1],[-.17,-1]]){
   const p=pivot(g,0,.025,z);p.name=sign===1?'front-hinge':'back-hinge';const panel=plate(frontShape,.018,wall,edge);panel.castShadow=true;panel.receiveShadow=true;p.add(panel);
   folds.push(u=>p.rotation.x=-sign*(1-smooth(u))*Math.PI/2);
   if(sign===1){
    box(p,.065,.13,.014,ink,0,.065,.016);
    for(const x of [-.12,.12]){
     box(p,.083,.092,.018,edge,x,.173,.021);box(p,.061,.07,.019,windowMat,x,.173,.033);
     box(p,.004,.073,.007,cream,x,.173,.047);box(p,.065,.004,.007,cream,x,.173,.047);
     box(p,.098,.013,.045,wall,x,.12,.038);
    }
    box(p,.105,.017,.06,wall,0,.01,.05);
   }
  }
  for(const sign of [-1,1]){
   const p=pivot(g,sign*.2,.025,0);box(p,.016,.27,.34,wall,0,.135,0);folds.push(u=>p.rotation.z=sign*(1-smooth(u))*Math.PI/2);
   // Each roof leaf remains attached to the top edge of its wall throughout the fold.
   const r=pivot(p,0,.27,0);r.name='roof-hinge-'+sign;
   const span=Math.hypot(.2,.16);const panel=box(r,span,.022,.41,roof,-sign*span/2,0,0);panel.castShadow=true;
   box(r,span,.007,.014,roofEdge,-sign*span/2,.015,.2);
   folds.push(u=>r.rotation.z=sign*(Math.PI/2-(Math.PI/2+.675)*smooth(clamp((u-.12)/.88))));
  }
  const chimney=pivot(g);box(chimney,.055,.14,.055,wall,.11,.36,-.07);box(chimney,.073,.018,.073,edge,.11,.44,-.07);
  g.userData.fold=u=>{folds.forEach(f=>f(u));chimney.visible=u>.85;};g.userData.fold(1);return batch(g);
 }
 function tent(){
  const g=new T.Group(),cloth=M('paper-tent',0xc87954),seam=M('paper-tent-seam',0xf4d5a8);box(g,.45,.015,.4,edge,0,.008,0);
  const a=new T.Shape();a.moveTo(-.21,0);a.lineTo(.21,0);a.lineTo(0,.33);a.closePath();
  const front=pivot(g,0,.015,.18);const panel=plate(a,.014,cloth,edge);front.add(panel);
  const door=new T.Shape();door.moveTo(-.06,0);door.lineTo(.06,0);door.lineTo(0,.17);door.closePath();const d=plate(door,.016,ink);d.position.z=.012;front.add(d);
  const sides=[];for(const sign of [-1,1]){const p=pivot(g,sign*.21,.02,0);box(p,.016,.39,.38,cloth,0,.195,0);sides.push({p,sign});}
  box(front,.013,.35,.02,seam,0,.17,.026);
  g.userData.fold=u=>{const e=smooth(u);front.rotation.x=-(1-e)*Math.PI/2;sides.forEach(({p,sign})=>p.rotation.z=sign*(Math.PI/2-e*.99))};g.userData.fold(1);return g;
 }
 function lighthouse(state){
  const g=new T.Group(),tower=new T.Group();g.add(tower);g.name='fold-lighthouse';
  mesh(new T.CylinderGeometry(.16,.18,.035,12),edge,g,0,.017,0);
  const red=M(state==='done'?'paper-lh-done':'paper-lh-red',state==='done'?0xa7afa0:0xc97b58);
  let y=.035;for(const [r1,r2,h,m] of [[.115,.1,.14,wall],[.1,.085,.085,red],[.085,.073,.1,wall]]){mesh(new T.CylinderGeometry(r2,r1,h,12),m,tower,0,y+h/2,0);y+=h;}
  const color=state==='urgent'?0xf4a35e:state==='done'?0xc6d4b1:0xffd897;
  const lightMat=new T.MeshStandardMaterial({color,emissive:color,emissiveIntensity:state==='done'?.15:1.6,roughness:.45});lightMat.userData={state,color};lampMats.push(lightMat);
  mesh(new T.CylinderGeometry(.074,.074,.09,12),lightMat,tower,0,.405,0);
  for(let i=0;i<6;i++){const a=i/6*Math.PI*2;box(tower,.009,.11,.009,ink,Math.cos(a)*.075,.405,Math.sin(a)*.075);}
  mesh(new T.CylinderGeometry(.106,.106,.015,16),ink,tower,0,.355,0);
  mesh(new T.ConeGeometry(.115,.09,12),roof,tower,0,.5,0);
  box(tower,.018,.065,.018,roofEdge,0,.568,0);
  g.userData.fold=u=>{tower.rotation.x=-(1-smooth(u))*Math.PI/2};return g;
 }
 function tree(level,pencil){
  const g=new T.Group(),h=.44+level*.115;
  if(pencil){const s=new T.Shape();s.moveTo(0,.5);s.lineTo(-.18,.1);s.lineTo(.18,.1);s.closePath();const geo=new T.ShapeGeometry(s);for(const a of [0,Math.PI/2]){const l=new T.LineSegments(new T.EdgesGeometry(geo),new T.LineDashedMaterial({color:0x929b8b,dashSize:.025,gapSize:.018}));l.computeLineDistances();l.rotation.y=a;g.add(l);}const hit=box(g,.3,.5,.3,new T.MeshBasicMaterial({visible:false}),0,.25,0);return g;}
  mesh(new T.CylinderGeometry(.023,.035,h*.5,7),M('paper-trunk',0xa08058),g,0,h*.25,0);
  const fans=[];for(let i=0;i<4;i++){const p=pivot(g,0,h*.12,0),a=i*Math.PI/2;const s=new T.Shape();s.moveTo(0,h*.88);s.lineTo(-h*.3,h*.25);s.lineTo(-h*.16,h*.25);s.lineTo(-h*.37,0);s.lineTo(h*.37,0);s.lineTo(h*.16,h*.25);s.lineTo(h*.3,h*.25);s.closePath();
   const leaf=plate(s,.018,M('paper-tree-'+(i%2),i%2?0xa2b67e:0x839d65),M('paper-leaf-edge',0x607d4c));leaf.castShadow=true;p.add(leaf);fans.push({p,a});}
  g.userData.fold=u=>{const e=smooth(u);g.rotation.x=-(1-e)*Math.PI/2;fans.forEach(({p,a})=>{p.rotation.y=a*e;p.rotation.x=0})};return g;
 }
 function character(){
  const root=new T.Group();root.name='xiaoya-paper-puppet';const rig=pivot(root),body=pivot(rig,0,.22,0),head=pivot(rig,0,.56,0);
  const hood=M('puppet-hood',0x8fa66b),face=M('puppet-face',0xffefd1),eye=M('puppet-eye',0x455541,{map:null}),blush=M('puppet-blush',0xe6b38e,{map:null});
  const oval=(g,sx,sy,sz,m,x,y,z)=>{const o=mesh(new T.SphereGeometry(1,24,16),m,g,x,y,z);o.scale.set(sx,sy,sz);return o};
  oval(body,.16,.22,.125,cream,0,.03,0);
  oval(head,.265,.26,.19,hood,0,0,0);oval(head,.218,.2,.075,face,0,-.012,.158);
  for(const s of [-1,1]){oval(head,.021,.027,.014,eye,s*.082,.015,.229);oval(head,.038,.017,.009,blush,s*.136,-.038,.215);}
  const smile=new T.CatmullRomCurve3([new T.Vector3(-.029,-.039,.235),new T.Vector3(0,-.052,.242),new T.Vector3(.029,-.039,.235)]);mesh(new T.TubeGeometry(smile,12,.005,5,false),eye,head);
  // A folded hood seam gives the back the same authored identity as the face.
  const seam=new T.CatmullRomCurve3([new T.Vector3(0,.23,-.07),new T.Vector3(0,.08,-.19),new T.Vector3(0,-.19,-.1)]);mesh(new T.TubeGeometry(seam,16,.007,5,false),M('puppet-seam',0x6d8651),head);
  const arms=[],legs=[],leaves=[];
  for(const s of [-1,1]){const arm=pivot(rig,s*.155,.38,0);oval(arm,.049,.105,.055,cream,s*.025,-.075,.005);arms.push(arm);
   const leg=pivot(rig,s*.08,.11,0);oval(leg,.065,.07,.09,cream,0,-.045,.03);legs.push(leg);
   const leaf=pivot(head,0,.235,0);const shape=new T.Shape();shape.moveTo(0,0);shape.bezierCurveTo(s*.03,.21,s*.28,.2,s*.26,.12);shape.bezierCurveTo(s*.21,.015,s*.08,-.01,0,0);
   const blade=plate(shape,.021,M('puppet-leaf-'+s,s===1?0xa4b77c:0x7f9d5d),M('puppet-leaf-edge',0x688349));blade.castShadow=true;leaf.rotation.z=s*.18;leaf.rotation.y=s*.22;leaf.add(blade);leaves.push(leaf);
  }
  let speed=0;
  root.userData.pose=({time,dt,moving=0,phase=0,jump=0,talking=false})=>{
   speed+=(moving-speed)*Math.min(1,dt*9);const gait=Math.sin(phase);
   rig.position.y=Math.abs(Math.sin(phase))*speed*.018+jump*.22;
   body.rotation.z=Math.sin(phase)*speed*.045;head.rotation.z=Math.sin(time*1.6)*.025+gait*speed*.025;head.rotation.x=talking?-.06:Math.sin(time*1.3)*.018;
   arms[0].rotation.x=gait*speed*.45;arms[1].rotation.x=-gait*speed*.45;arms[1].rotation.z=talking?-.8-Math.sin(time*5)*.12:-.12;
   legs[0].rotation.x=-gait*speed*.45;legs[1].rotation.x=gait*speed*.45;
   leaves.forEach((l,i)=>{l.rotation.z=(i?1:-1)*.18+Math.sin(time*2.4-i*.8)*.065+gait*speed*.04;});
   const blink=Math.pow(Math.max(0,Math.cos(time*1.15)),32);head.children.filter(o=>o.material===eye&&o.geometry.type==='SphereGeometry').forEach(o=>o.scale.y=.027*(1-blink*.94));
  };
  root.userData.fold=u=>{rig.rotation.x=-(1-smooth(u))*Math.PI/2};return root;
 }
  return {house,tent,lighthouse,tree,character};
}
