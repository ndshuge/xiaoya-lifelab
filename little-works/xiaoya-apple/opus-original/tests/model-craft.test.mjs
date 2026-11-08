import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.min.js';
import {createSailboat,mergeRigidParts} from '../model-craft.mjs';
import {coastRadii,coastRadius,createLandform} from '../island-landform.mjs';
import {islandLayout,insideLand} from '../island-layout.mjs';
const materials=new Map(),M=(key,color,opts)=>{if(!materials.has(key))materials.set(key,new T.MeshStandardMaterial({color,...opts}));return materials.get(key)};
const triangles=root=>{let count=0;root.traverse(o=>{if(o.isMesh)count+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3});return count};

test('rigid batching retains multi-material faces, triangle count, bounds and joint hierarchy',()=>{
 const root=new T.Group(),hinge=new T.Group();hinge.name='hinge';hinge.position.set(.3,.2,.1);root.add(hinge);
 const shape=new T.Shape();shape.moveTo(-.2,0);shape.lineTo(.2,0);shape.lineTo(.15,.3);shape.closePath();
 const a=M('a',0xffffff),b=M('b',0x777777),face=new T.Mesh(new T.ExtrudeGeometry(shape,{depth:.03,bevelEnabled:false}),[a,b]);hinge.add(face);hinge.add(new T.Mesh(new T.BoxGeometry(.1,.1,.1),a));root.updateMatrixWorld(true);
 const before=new T.Box3().setFromObject(root),count=triangles(root);mergeRigidParts(root);root.updateMatrixWorld(true);
 const after=new T.Box3().setFromObject(root);assert.ok(before.min.distanceTo(after.min)<1e-6&&before.max.distanceTo(after.max)<1e-6);assert.equal(triangles(root),count);assert.equal(root.getObjectByName('hinge'),hinge);
 const roles=new Set();root.traverse(o=>{if(o.isMesh)roles.add(o.material)});assert.ok(roles.has(a)&&roles.has(b));
});

test('the same closed coastal samples locate both the beach and sea shading',()=>{
 const samples=coastRadii();assert.equal(samples.length,64);for(let i=0;i<64;i++){assert.ok(samples[i]>=.952&&samples[i]<1.12);assert.ok(Math.abs(coastRadius(i/64*Math.PI*2)-samples[i])<1e-10);}assert.ok(Math.abs(coastRadius(0)-coastRadius(Math.PI*2))<1e-10);
});

test('the sculpted island supports the existing walkable ground and both feet in every layout',()=>{
 const ray=new T.Raycaster(),down=new T.Vector3(0,-1,0);
 for(const n of [7,9])for(const portrait of [false,true]){
  const bounds=islandLayout(n,portrait),land=createLandform(bounds,M);land.updateMatrixWorld(true);
  for(let x=-bounds.rx;x<bounds.rx;x+=.32)for(let z=-bounds.rz;z<bounds.rz;z+=.32){
   if(!insideLand({x,z},bounds,.29))continue;
   for(const [dx,dz] of [[0,0],[.15,0],[-.15,0],[0,.15],[0,-.15]]){ray.set(new T.Vector3(x+dx,1,z+dz),down);const hit=ray.intersectObject(land,true)[0];assert.ok(hit,'solid ground under foot');assert.ok(Math.abs(hit.point.y-.34)<1e-6,'foot remains on the meadow');}
  }
 }
});

test('sailboats have submerged hull volume, raised freeboard and finite rigged canvas in both tiers',()=>{
 for(const lite of [false,true]){
  const boat=createSailboat(M,lite);boat.updateMatrixWorld(true);const box=new T.Box3().setFromObject(boat),scale=lite?.85:1;
  assert.ok(box.min.y<-.09*scale);assert.ok(box.max.y>.7*scale);assert.ok(box.max.z-box.min.z>.7*scale);assert.ok(boat.userData.sail.isGroup);assert.ok(triangles(boat)<9000);
  boat.traverse(o=>{if(!o.isMesh)return;for(const name of ['position','normal'])for(const n of o.geometry.attributes[name].array)assert.ok(Number.isFinite(n));});
 }
});
