import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.min.js';
import {createPaperKit} from '../paper-kit.mjs';
test('a deadline lighthouse carries its own low-cost, folded lantern beam',()=>{
 const cache=new Map(),lampMats=[];
 const M=(key,color)=>{if(!cache.has(key))cache.set(key,new T.MeshStandardMaterial({color}));return cache.get(key)};
 const kit=createPaperKit({material:M,windowMat:M('window',0xffffff),lampMats});
 const light=kit.lighthouse('urgent');
 const beam=light.userData.beam;
 assert.ok(beam,'beam is attached to the existing lighthouse, not a replacement tower');
 assert.equal(beam.visible,false,'beam starts hidden in daytime');
 assert.ok(beam.material.transparent);
 assert.ok(beam.material.uniforms.uAlpha);
 assert.ok(beam.geometry.getAttribute('position').count<=8,'one triangle fan is enough');
 for(const u of [0,.3,.65,1]){light.userData.fold(u);light.updateMatrixWorld(true);assert.ok(beam.getWorldPosition(new T.Vector3()).y>=0);}
});
