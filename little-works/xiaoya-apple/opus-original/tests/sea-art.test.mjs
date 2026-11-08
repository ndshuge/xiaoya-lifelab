import test from 'node:test';
import assert from 'node:assert/strict';
import {seaArtFragment} from '../sea-art-glsl.mjs';

test('seabed shader is bounded, transparent-looking, and keeps the paper sea palette',()=>{
 const desktop=seaArtFragment({fishCount:12,lite:false});
 assert.match(desktop.head,/uniform vec4 uFish\[12\]/);
 assert.match(desktop.head,/uniform vec4 uTaps\[3\]/);
 assert.match(desktop.head,/float (caustic|caustics)/);
 assert.match(desktop.head,/sand|seabed/i);
 assert.match(desktop.head,/grass|kelp/i);
 assert.match(desktop.head,/uniform vec4 uBeacon/,'optional lighthouse has no draw pass');
 assert.match(desktop.head,/lighthouseSweep/,'only the illuminated water receives the beam');
 assert.match(desktop.head,/for\s*\(int i=0;i<12;i\+\+\)/);
 assert.match(desktop.color,/seaArtColor/);
 assert.match(desktop.color,/tapFoam/);
 assert.equal((desktop.head.match(/\{/g)||[]).length,(desktop.head.match(/\}/g)||[]).length,'GLSL function braces must close');
 assert.ok(desktop.head.length<8500);
});

test('mobile lite avoids expensive rock pass while still showing fish and sand',()=>{
 const lite=seaArtFragment({fishCount:6,lite:true});
 assert.match(lite.head,/uFish\[6\]/);
 assert.doesNotMatch(lite.head,/reefRock\(/);
 assert.match(lite.color,/seaArtColor/);
 assert.equal(typeof lite.head,'string');
});

test('invalid shader fish counts are rejected to avoid unbounded GPU loops',()=>{
 assert.throws(()=>seaArtFragment({fishCount:0,lite:false}),/fishCount/);
 assert.throws(()=>seaArtFragment({fishCount:100,lite:false}),/fishCount/);
});
