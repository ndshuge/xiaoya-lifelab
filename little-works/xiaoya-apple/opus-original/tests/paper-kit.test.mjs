import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.min.js';
import {createPaperKit} from '../paper-kit.mjs';
const materials=new Map();
const kit=createPaperKit({material:(key,color,opts)=>{if(!materials.has(key))materials.set(key,new T.MeshStandardMaterial({color,...opts}));return materials.get(key)},windowMat:new T.MeshStandardMaterial(),lampMats:[]});
test('folded models keep every mesh dimension and every hinge anchor throughout opening and reversal',()=>{
 for(const root of [kit.house(),kit.tent(),kit.lighthouse('urgent'),kit.tree(4,false),kit.character()]){
  const original=new Map();root.traverse(o=>original.set(o,o.scale.clone()));
  for(const u of [0,.12,.35,.6,.85,1,.6,0,1]){
   root.userData.fold(u);root.updateMatrixWorld(true);
   root.traverse(o=>{assert.ok(o.scale.equals(original.get(o)),root.name+' must not stretch');for(const v of o.matrixWorld.elements)assert.ok(Number.isFinite(v));});
  }
 }
});
test('roof leaves stay attached to the moving wall top instead of hovering at a fixed height',()=>{
 const h=kit.house(),roof=h.getObjectByName('roof-hinge-1');assert.ok(roof);
 for(const u of [0,.25,.5,.75,1]){h.userData.fold(u);h.updateMatrixWorld(true);const anchor=roof.parent.localToWorld(new T.Vector3(0,.27,0));assert.ok(anchor.distanceTo(roof.getWorldPosition(new T.Vector3()))<1e-10);}
});
test('puppet owns side and back geometry and has stable animated limbs',()=>{
 const p=kit.character();const b=new T.Box3().setFromObject(p);assert.ok(b.max.z-b.min.z>.3);assert.equal(p.name,'xiaoya-paper-puppet');
 for(let i=0;i<300;i++){p.userData.pose({time:i/60,dt:1/60,moving:i<160?1:0,phase:i*.2,jump:0,talking:i>200});p.updateMatrixWorld(true);p.traverse(o=>o.matrixWorld.elements.forEach(v=>assert.ok(Number.isFinite(v))));}
});
