// Shared modelling utilities. They never own input, camera, UI or archive state.
import * as T from './vendor/three/three.module.min.js';

/** Merge only rigid children of each joint; retain the articulated scene graph. */
export function mergeRigidParts(root){
 root.traverse(parent=>{
  if(!parent.isGroup)return;
  const buckets=new Map(),removed=[];
  for(const mesh of [...parent.children]){
   if(!mesh.isMesh||mesh.isInstancedMesh||mesh.isSkinnedMesh||mesh.userData.keepMesh)continue;
   mesh.updateMatrix();
   const geo=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();geo.applyMatrix4(mesh.matrix);
   if(!geo.attributes.normal)geo.computeVertexNormals();
   const groups=Array.isArray(mesh.material)?geo.groups:[{start:0,count:geo.attributes.position.count,materialIndex:0}];
   for(const range of groups){
    const mat=Array.isArray(mesh.material)?mesh.material[range.materialIndex]:mesh.material;if(!mat)continue;
    const key=mat.uuid+':'+mesh.castShadow+':'+mesh.receiveShadow;
    if(!buckets.has(key))buckets.set(key,{mat,cast:mesh.castShadow,receive:mesh.receiveShadow,position:[],normal:[],uv:[],sources:new Set()});
    const b=buckets.get(key);b.sources.add(mesh);
    for(let i=range.start;i<range.start+range.count;i++){
     for(const axis of ['X','Y','Z']){b.position.push(geo.attributes.position['get'+axis](i));b.normal.push(geo.attributes.normal['get'+axis](i));}
     b.uv.push(geo.attributes.uv?.getX(i)||0,geo.attributes.uv?.getY(i)||0);
    }
   }
   geo.dispose();removed.push(mesh);
  }
  for(const b of buckets.values()){
   const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(b.position,3));geo.setAttribute('normal',new T.Float32BufferAttribute(b.normal,3));geo.setAttribute('uv',new T.Float32BufferAttribute(b.uv,2));geo.computeBoundingSphere();
   const mesh=new T.Mesh(geo,b.mat);mesh.name='rigid-details';mesh.castShadow=b.cast;mesh.receiveShadow=b.receive;parent.add(mesh);
  }
  const discarded=new Set();for(const mesh of removed){parent.remove(mesh);discarded.add(mesh.geometry);}discarded.forEach(g=>g.dispose());
 });return root;
}

export function roundedPlate(w,h,d,r=.005){
 r=Math.min(r,w/5,h/5,d/3);const x=-w/2,y=-h/2,s=new T.Shape();
 s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);
 return new T.ExtrudeGeometry(s,{depth:d-2*r,bevelEnabled:true,bevelSize:r*.6,bevelThickness:r,bevelSegments:1,curveSegments:3}).translate(0,0,-d/2+r);
}

export function createSailboat(M,lite=false){
 const root=new T.Group();root.name='coastal-sailboat';
 const ivory=M('vessel-ivory',0xeee5cf,{map:null,roughness:.84}),wood=M('vessel-teak',0xa67e51,{map:null,roughness:.88}),hull=M('vessel-hull',0x426e72,{map:null,roughness:.58}),ink=M('vessel-shadow',0x405b59,{map:null}),rope=M('vessel-rope',0xc7ba96,{map:null});
 const add=(parent,geo,mat,x=0,y=0,z=0)=>{const mesh=new T.Mesh(geo,mat);mesh.position.set(x,y,z);mesh.receiveShadow=true;parent.add(mesh);return mesh};
 const box=(w,h,d,mat,x,y,z)=>add(root,roundedPlate(w,h,d,.004),mat,x,y,z);
 const contour=(a,scale=1)=>new T.Vector2(Math.sin(a)*.17*(.87-.21*Math.cos(a))*scale,(-Math.cos(a)*.4-.03)*scale);
 const n=40,rings=[{s:.38,y:-.105},{s:.76,y:-.06},{s:.94,y:.012},{s:1,y:.073}],positions=[];
 const vertex=(ring,j)=>{const p=contour(j/n*Math.PI*2,ring.s);return [p.x,ring.y,p.y]};
 for(let k=0;k<rings.length-1;k++)for(let j=0;j<n;j++){
  const a=vertex(rings[k],j),b=vertex(rings[k],j+1),c=vertex(rings[k+1],j),d=vertex(rings[k+1],j+1);
  positions.push(...a,...c,...b,...b,...c,...d);
 }
 for(let j=0;j<n;j++)positions.push(0,rings[0].y,0,...vertex(rings[0],j),...vertex(rings[0],j+1));
 const hullGeo=new T.BufferGeometry();hullGeo.setAttribute('position',new T.Float32BufferAttribute(positions,3));hullGeo.computeVertexNormals();add(root,hullGeo,hull);
 const deckShape=new T.Shape();for(let i=0;i<=n;i++){const p=contour(i/n*Math.PI*2,.96);i?deckShape.lineTo(p.x,-p.y):deckShape.moveTo(p.x,-p.y);}
 const hole=new T.Path();hole.moveTo(-.065,-.035);hole.lineTo(.065,-.035);hole.lineTo(.065,-.225);hole.lineTo(-.065,-.225);hole.closePath();deckShape.holes.push(hole);
 const deckGeo=new T.ShapeGeometry(deckShape).rotateX(-Math.PI/2);add(root,deckGeo,wood,0,.072,0);
 box(.13,.012,.19,ink,0,.035,.13);
 for(const z of [.055,.19])box(.25,.015,.026,ivory,0,.079,z);
 const rimPoints=Array.from({length:n+1},(_,i)=>{const p=contour(i/n*Math.PI*2,.99);return new T.Vector3(p.x,.08,p.y)});
 add(root,new T.TubeGeometry(new T.CatmullRomCurve3(rimPoints),48,.006,5,false),ivory);
 for(let i=0;i<5;i++)box(.002,.002,.10,rope,(i-2)*.025,.074,-.22);
 box(.10,.026,.10,wood,0,.087,-.24);
 const rod=(parent,a,b,r,mat)=>{const axis=new T.Vector3().subVectors(b,a),mesh=add(parent,new T.CylinderGeometry(r,r,axis.length(),6),mat);mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),axis.normalize());return mesh};
 rod(root,new T.Vector3(0,.073,-.04),new T.Vector3(0,.79,-.04),.008,wood);
 for(const at of [[0,.083,-.4],[-.14,.083,.25],[.14,.083,.25]])rod(root,new T.Vector3(0,.76,-.04),new T.Vector3(...at),.002,rope);
 const sail=new T.Group();sail.name='billowed-sails';sail.position.set(0,.2,-.04);sail.rotation.y=Math.PI/2;root.add(sail);
 const fabric=(side,colour)=>{
  const mat=M('vessel-canvas-'+side,colour,{map:null,roughness:.94,side:T.DoubleSide}),N=lite?6:10,pos=[];
  const point=(u,v)=>new T.Vector3(side*(.013+.245*u*(1-v*.12)),.04+.50*v,.065*Math.sin(Math.PI*u)*Math.sin(Math.PI*(u+v)));
  const tri=(a,b,c)=>pos.push(...a.toArray(),...b.toArray(),...c.toArray());
  for(let i=0;i<N;i++)for(let j=0;j<N-i;j++){
   const u=j/N,v=i/N;tri(point(u,v),point(u+1/N,v),point(u,v+1/N));
   if(i+j<N-1)tri(point(u+1/N,v),point(u+1/N,v+1/N),point(u,v+1/N));
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.computeVertexNormals();add(sail,geo,mat);
  for(const v of [.15,.38,.62]){
   const pts=Array.from({length:7},(_,i)=>point((1-v)*i/6,v).add(new T.Vector3(0,0,.0015)));
   add(sail,new T.TubeGeometry(new T.CatmullRomCurve3(pts),8,.0015,3,false),rope);
  }
  rod(sail,point(0,0),point(1,0),.003,wood);
 };
 fabric(1,0xf0e9d4);fabric(-1,0xc8896e);
 root.userData.sail=sail;root.userData.modelCraft='lofted-hull-and-canvas';root.scale.setScalar(lite?.85:1);
 return mergeRigidParts(root);
}
