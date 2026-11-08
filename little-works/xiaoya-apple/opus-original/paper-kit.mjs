// Authored cardstock models. Every fold has a fixed edge; dimensions stay constant.
import * as T from './vendor/three/three.module.min.js';
import {mergeRigidParts,roundedPlate} from './model-craft.mjs';
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
 const batch=mergeRigidParts;
 const trim=(g,w,h,d,m,x,y,z)=>mesh(roundedPlate(w,h,d),m,g,x,y,z);
 const arch=(w,h)=>{const s=new T.Shape();s.moveTo(-w/2,0);s.lineTo(w/2,0);s.lineTo(w/2,h-w/2);s.absarc(0,h-w/2,w/2,0,Math.PI,false);s.closePath();return s};
 function house(){
  const g=new T.Group();g.name='fold-house';const folds=[];
  box(g,.44,.022,.39,edge,0,.011,0);
  const frontShape=new T.Shape();frontShape.moveTo(-.2,0);frontShape.lineTo(.2,0);frontShape.lineTo(.2,.27);frontShape.lineTo(0,.43);frontShape.lineTo(-.2,.27);frontShape.closePath();
  for(const [z,sign] of [[.17,1],[-.17,-1]]){
   const p=pivot(g,0,.025,z);p.name=sign===1?'front-hinge':'back-hinge';const panel=plate(frontShape,.018,wall,edge);panel.castShadow=true;panel.receiveShadow=true;p.add(panel);
   folds.push(u=>p.rotation.x=-sign*(1-smooth(u))*Math.PI/2);
   if(sign===1){
    mesh(plate(arch(.103,.159),.012,edge).geometry,edge,p,0,0,.016);
    mesh(plate(arch(.077,.143),.010,ink).geometry,ink,p,0,0,.025);
    for(const x of [-.024,0,.024])box(p,.0017,.10,.002,edge,x,.055,.032);
    mesh(new T.SphereGeometry(.005,8,6),M('house-brass',0xbba166,{map:null,roughness:.45}),p,.023,.066,.037);
    mesh(new T.CircleGeometry(.023,16),windowMat,p,0,.325,.012);
    mesh(new T.TorusGeometry(.027,.004,4,16),cream,p,0,.325,.016);
    for(const x of [-.12,.12]){
     box(p,.083,.092,.018,edge,x,.173,.021);box(p,.061,.07,.019,windowMat,x,.173,.033);
     box(p,.004,.073,.007,cream,x,.173,.047);box(p,.065,.004,.007,cream,x,.173,.047);
     trim(p,.098,.013,.045,wall,x,.12,.038);
     box(p,.088,.011,.014,roofEdge,x,.225,.032);
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
   for(let row=0;row<3;row++)for(let col=0;col<5;col++){
    const tile=trim(r,.078,.008,.077,roof,-sign*(.041+row*.078),.015,(col-2)*.079+(row%2?.004:0));tile.castShadow=true;
   }
   folds.push(u=>r.rotation.z=sign*(Math.PI/2-(Math.PI/2+.675)*smooth(clamp((u-.12)/.88))));
  }
  const chimney=pivot(g);box(chimney,.055,.14,.055,wall,.11,.36,-.07);box(chimney,.073,.018,.073,edge,.11,.44,-.07);
  g.userData.fold=u=>{folds.forEach(f=>f(u));chimney.visible=u>.85;};g.userData.fold(1);return batch(g);
 }
 function tent(){
  const g=new T.Group(),cloth=M('paper-tent',0xc87954),seam=M('paper-tent-seam',0xf4d5a8);g.name='fold-tent';box(g,.45,.015,.4,edge,0,.008,0);
  const a=new T.Shape();a.moveTo(-.21,0);a.lineTo(.21,0);a.lineTo(0,.33);a.closePath();
  const front=pivot(g,0,.015,.18);const panel=plate(a,.014,cloth,edge);front.add(panel);
  const door=new T.Shape();door.moveTo(-.06,0);door.lineTo(.06,0);door.lineTo(0,.17);door.closePath();const d=plate(door,.016,ink);d.position.z=.012;front.add(d);
  const sides=[];for(const sign of [-1,1]){const p=pivot(g,sign*.21,.02,0);box(p,.016,.39,.38,cloth,0,.195,0);sides.push({p,sign});}
  box(front,.013,.35,.02,seam,0,.17,.026);
  g.userData.fold=u=>{const e=smooth(u);front.rotation.x=-(1-e)*Math.PI/2;sides.forEach(({p,sign})=>p.rotation.z=sign*(Math.PI/2-e*.99))};g.userData.fold(1);return batch(g);
 }
 function lighthouse(state){
  const g=new T.Group();g.name='telescoping-lighthouse';
  mesh(new T.CylinderGeometry(.17,.19,.035,20),edge,g,0,.017,0);
  const assembly=pivot(g,0,.035,0),middle=pivot(assembly),upper=pivot(middle);
  const red=M(state==='done'?'paper-lh-done':'paper-lh-red',state==='done'?0xa7afa0:0xc97b58);
  mesh(new T.CylinderGeometry(.12,.137,.16,24),wall,assembly,0,.08,0);
  mesh(new T.CylinderGeometry(.099,.112,.15,24),red,middle,0,.075,0);
  mesh(new T.CylinderGeometry(.077,.089,.15,24),wall,upper,0,.075,0);
  const collar=M('lighthouse-collar',0xd5c9a6,{map:null,roughness:.64});
  for(const [stage,r,y] of [[assembly,.134,.017],[assembly,.12,.151],[middle,.11,.012],[middle,.099,.143],[upper,.085,.012]])mesh(new T.TorusGeometry(r,.006,5,28).rotateX(Math.PI/2),collar,stage,0,y,0);
  const door=plate(arch(.054,.09),.009,ink);door.position.set(0,.006,.136);assembly.add(door);
  for(const [stage,r] of [[middle,.111],[upper,.086]]){
   mesh(new T.CircleGeometry(.014,12),windowMat,stage,0,.083,r);
   mesh(new T.TorusGeometry(.017,.003,4,14),collar,stage,0,.083,r+.002);
  }
  const color=state==='urgent'?0xf4a35e:state==='done'?0xc6d4b1:0xffd897;
  const lightMat=new T.MeshStandardMaterial({color,emissive:color,emissiveIntensity:state==='done'?.15:1.6,roughness:.45});lightMat.userData={state,color};lampMats.push(lightMat);
  const lantern=pivot(upper,0,.15,0);
  mesh(new T.CylinderGeometry(.1,.1,.018,20),ink,lantern,0,0,0);
  mesh(new T.CylinderGeometry(.066,.066,.082,20),lightMat,lantern,0,.05,0);
  for(let i=0;i<6;i++){const a=i/6*Math.PI*2;box(lantern,.007,.09,.007,ink,Math.cos(a)*.073,.05,Math.sin(a)*.073);}
  mesh(new T.ConeGeometry(.108,.075,20),roof,lantern,0,.13,0);
  mesh(new T.TorusGeometry(.11,.004,4,28).rotateX(Math.PI/2),collar,lantern,0,-.004,0);
  mesh(new T.TorusGeometry(.107,.003,4,28).rotateX(Math.PI/2),ink,lantern,0,.025,0);
  for(let i=0;i<8;i++){const a=i/8*Math.PI*2;box(lantern,.003,.03,.003,ink,Math.cos(a)*.108,.009,Math.sin(a)*.108);}
  box(lantern,.014,.044,.014,roofEdge,0,.19,0);
  g.userData.stages=[assembly,middle,upper];
  g.userData.fold=u=>{assembly.position.y=.035-.105*(1-smooth(clamp(u*3)));middle.position.y=.015+.125*smooth(clamp((u-.15)/.55));upper.position.y=.012+.12*smooth(clamp((u-.4)/.6));};g.userData.fold(1);return batch(g);
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
  const root=new T.Group();root.name='xiaoya-paper-puppet';root.userData.identity='reference-hood-v2';
  const rig=pivot(root),body=pivot(rig,0,.245,0),head=pivot(rig,0,.655,0);head.name='xiaoya-head';
  const hood=M('puppet-hood-v2',0xa8b780,{roughness:.92}),face=M('puppet-face-v2',0xfff0d8,{map:null,roughness:.88}),eye=M('puppet-eye-v2',0x786a48,{map:null}),blush=M('puppet-blush-v2',0xf0bb93,{map:null}),cloak=M('puppet-cloak-v2',0x849a65);
  const oval=(g,sx,sy,sz,m,x,y,z)=>{const o=mesh(new T.SphereGeometry(1,28,20),m,g,x,y,z);o.scale.set(sx,sy,sz);return o};
  const hoodShape=new T.Shape();hoodShape.moveTo(0,.365);hoodShape.bezierCurveTo(-.28,.35,-.49,-.025,-.405,-.24);hoodShape.bezierCurveTo(-.37,-.32,-.22,-.27,0,-.26);hoodShape.bezierCurveTo(.22,-.27,.37,-.32,.405,-.24);hoodShape.bezierCurveTo(.49,-.025,.28,.35,0,.365);
  const hoodGeo=new T.ExtrudeGeometry(hoodShape,{depth:.19,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.028,bevelThickness:.035,curveSegments:22});hoodGeo.translate(0,0,-.11);
  const hoodShell=mesh(hoodGeo,hood,head);hoodShell.castShadow=true;
  oval(head,.319,.254,.105,face,0,-.014,.112);
  oval(body,.224,.215,.146,face,0,.01,.01);
  // A short leaf cape, rather than a spherical back, matches the drawing's drooping hood.
  oval(rig,.29,.25,.11,cloak,0,.265,-.095);
  const eyes=[];for(const side of [-1,1]){const e=oval(head,.026,.033,.015,eye,side*.13,.035,.214);e.userData.eye=true;e.userData.keepMesh=true;eyes.push(e);
   const shine=mesh(new T.SphereGeometry(1,8,6),face,e,-.3,.35,.90);shine.scale.set(.24,.23,.18);
   oval(head,.052,.035,.009,blush,side*.214,-.047,.199);}
  const smile=new T.CatmullRomCurve3([new T.Vector3(-.043,-.049,.222),new T.Vector3(0,-.06,.229),new T.Vector3(.043,-.049,.222)]);mesh(new T.TubeGeometry(smile,16,.006,6,false),eye,head);
  const arms=[],legs=[],leaves=[];
  for(const side of [-1,1]){
   const arm=pivot(rig,side*.205,.365,.01);oval(arm,.065,.105,.065,face,side*.027,-.065,.02);arm.rotation.z=side*.22;arms.push(arm);
   const leg=pivot(rig,side*.105,.105,0);oval(leg,.102,.085,.125,face,0,-.014,.03);legs.push(leg);
   const leaf=pivot(head,0,.35,-.012);leaf.name=side<0?'large-left-leaf':'small-right-leaf';const shape=new T.Shape();shape.moveTo(0,0);
   if(side<0){shape.bezierCurveTo(-.09,.285,-.48,.43,-.47,.25);shape.bezierCurveTo(-.46,.045,-.13,.05,0,0);}
   else{shape.bezierCurveTo(.045,.18,.33,.31,.32,.19);shape.bezierCurveTo(.30,.035,.12,.005,0,0);}
   const blade=plate(shape,.028,M('puppet-leaf-v2-'+side,side<0?0xa3b67a:0xb0bf87),M('puppet-leaf-edge-v2',0x8ca168));blade.castShadow=true;leaf.add(blade);
   const vein=new T.CatmullRomCurve3([new T.Vector3(0,.01,.018),new T.Vector3(side*.12,.105,.019),new T.Vector3(side*(side<0?.33:.24),side<0?.23:.19,.019)]);mesh(new T.TubeGeometry(vein,12,.004,4,false),M('puppet-vein',0x91a66b),leaf);
   leaf.rotation.y=side*.14;leaves.push(leaf);
  }
  let speed=0,look=0,pitch=0;
  root.userData.pose=({time,dt,moving=0,phase=0,jump=0,talking=false,gazeYaw=0,gazePitch=0,still=false})=>{
   speed+=(moving-speed)*Math.min(1,dt*14);const gait=Math.sin(phase);
   look+=(Math.max(-.7,Math.min(.7,gazeYaw))-look)*(1-Math.exp(-dt*22));pitch+=(Math.max(-.22,Math.min(.2,gazePitch))-pitch)*(1-Math.exp(-dt*22));
   rig.position.y=Math.abs(Math.sin(phase))*speed*.013+jump*.16;
   body.rotation.z=gait*speed*.035;head.rotation.y=look;head.rotation.z=Math.sin(time*1.5)*.016;head.rotation.x=pitch+(talking?-.04:0);
   arms[0].rotation.x=gait*speed*.4;arms[1].rotation.x=-gait*speed*.4;arms[1].rotation.z=talking?-.9-Math.sin(time*5)*.12:.22;
   legs[0].rotation.x=-gait*speed*.3;legs[1].rotation.x=gait*speed*.3;
   leaves.forEach((l,i)=>l.rotation.z=Math.sin(time*2.2-i*.8)*.045+gait*speed*.035);
   const blink=still?0:Math.pow(Math.max(0,Math.cos(time*1.03)),48);eyes.forEach(o=>o.scale.y=.033*(1-blink*.96));
  };
  root.userData.fold=u=>{rig.position.y=-.18*(1-smooth(u));rig.rotation.x=0;};return batch(root);
 }
  return {house,tent,lighthouse,tree,character};
}
