import test from 'node:test';
import assert from 'node:assert/strict';
import {createFishSchool} from '../fish-school.mjs';

const bounds={rx:3.8,rz:2.5};
const radius=f=>Math.hypot(f.x/bounds.rx,f.z/bounds.rz);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);

test('fish follow stable offshore lanes without entering the paper island',()=>{
  const a=createFishSchool(bounds,8),b=createFishSchool(bounds,8);
  assert.deepEqual(a.sample(2),b.sample(2));
  for(const t of [0,1,10,100]){
    const school=a.sample(t);
    assert.equal(school.length,8);
    for(const f of school){
      assert.ok(radius(f)>1.08 && radius(f)<1.95, 'sea lane = '+radius(f));
      assert.ok(Number.isFinite(f.heading));
      assert.ok(f.size>0 && f.size<.45);
    }
  }
  assert.ok(distance(a.sample(0)[0],a.sample(4)[0])>.1);
});
test('fish cluster into two small schools while circling the island',()=>{
 const f=createFishSchool(bounds,8).sample(2);
 assert.ok(distance(f[0],f[1])<1.45,'neighbors should form a shoal');
 assert.ok(distance(f[0],f[4])>2.4,'distinct shoals occupy different sides');
});
test('water tap scatters nearby fish then fish recover',()=>{
 const school=createFishSchool(bounds,8), t=4;
 const touch=school.sample(t)[0],control=createFishSchool(bounds,8);
 assert.equal(school.scare(0,0,t),false,'island taps are ignored');
 assert.equal(school.scare(100,0,t),false,'far ocean taps are ignored');
 assert.equal(school.scare(touch.x,touch.z,t),true);
 assert.ok(distance(school.sample(t+.1)[0],control.sample(t+.1)[0])>.07);
 assert.ok(school.sample(t+.1).every(f=>radius(f)>1.08));
 assert.ok(distance(school.sample(t+6)[0],control.sample(t+6)[0])<.02);
});
test('fish school stays bounded on mobile and bad input',()=>{
 const s=createFishSchool(bounds,200);
 assert.ok(s.sample(1).length<=12);
 assert.equal(s.scare(NaN,2,1),false);
 assert.equal(s.scare(1,2,Infinity),false);
 assert.ok(s.sample(-100).every(f=>Number.isFinite(f.x+f.z+f.heading)));
});
