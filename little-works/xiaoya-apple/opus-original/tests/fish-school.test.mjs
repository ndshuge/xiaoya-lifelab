import test from 'node:test';
import assert from 'node:assert/strict';
import {createFishSchool} from '../fish-school.mjs';

const bounds={rx:3.8,rz:2.5};
const norm=p=>Math.hypot(p.x/bounds.rx,p.z/bounds.rz);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);

test('a deterministic school lives in water, not on island or outside view',()=>{
  const a=createFishSchool(bounds,8),b=createFishSchool(bounds,8);
  assert.deepEqual(a.sample(3),b.sample(3));
  for (const t of [0,1.7,12,120]) {
    const fish=a.sample(t);assert.equal(fish.length,8);
    for(const f of fish) {
      assert.ok(norm(f)>1.075 && norm(f)<1.95,'outside coast: '+norm(f));
      assert.ok(Number.isFinite(f.heading) && f.size>0 && f.size<.4);
    }
  }
  assert.ok(distance(a.sample(0)[0],a.sample(4)[0])>.1,'the fish actually swim');
});

test('tap scares nearby fish, fades out, and ignores land or distant water',()=>{
  const school=createFishSchool(bounds,10),t=4;
  const before=school.sample(t),touch=before[0];
  assert.equal(school.scare(0,0,t),false);
  assert.equal(school.scare(100,100,t),false);
  assert.equal(school.scare(touch.x,touch.z,t),true);
  const now=school.sample(t+.05),normal=createFishSchool(bounds,10).sample(t+.05);
  assert.ok(distance(now[0],normal[0])>.08,'fish flees from touch');
  for(const f of now)assert.ok(norm(f)>1.075&&norm(f)<1.95);
  const done=school.sample(t+6),expected=createFishSchool(bounds,10).sample(t+6);
  assert.ok(distance(done[0],expected[0])<.01,'school returns to its route');
  assert.ok(school.diagnostics().scares>=1);
});

test('invalid time, coordinates and fish counts are bounded',()=>{
  const s=createFishSchool(bounds,100);
  assert.ok(s.sample(1).length<=20);
  assert.equal(s.scare(NaN,2,1),false);
  assert.equal(s.scare(2,2,Infinity),false);
  assert.ok(s.sample(-100).every(f=>Number.isFinite(f.x+f.z+f.heading)));
});
