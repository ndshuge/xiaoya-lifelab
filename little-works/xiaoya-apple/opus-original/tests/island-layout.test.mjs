import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.min.js';
import {islandLayout,clearPoint,clearSegment,nearestOpenPoint,planIslandPath,flagRows,flagState} from '../island-layout.mjs';
import {createPaperKit} from '../paper-kit.mjs';
import {createCoastalLife} from '../coastal-life.mjs';
test('week and season lots stay separated in both responsive layouts',()=>{
 for(const n of [7,9])for(const portrait of [false,true]){const b=islandLayout(n,portrait);assert.equal(b.points.length,n);for(let i=0;i<n;i++)for(let j=0;j<i;j++)assert.ok(Math.hypot(b.points[i].x-b.points[j].x,b.points[i].z-b.points[j].z)>1.6);}
});
test('empty, busy and attention flags use the actual records and cap rows without dropping the overflow count',()=>{
 assert.equal(flagState({}),'empty');assert.equal(flagState({items:[{title:'Math'}]}),'busy');assert.equal(flagState({due:[{urgent:true,done:false}]}),'attention');assert.equal(flagState({due:[{urgent:true,done:true}]}),'empty');
 const d={items:Array.from({length:12},(_,i)=>({kind:'course',id:'c'+i,title:'课'+i,start:'10:00'}))};const rows=flagRows(d,3);assert.equal(rows.length,3);assert.equal(rows[2].count,10);assert.equal(rows[0].id,'c0');
});
test('walking route goes around props with clearance along the entire segment',()=>{
 const b=islandLayout(7,false),o=[{x:0,z:0,r:.65},{x:1.1,z:.6,r:.35}],a={x:-2.5,z:0},target={x:2.5,z:0};const route=planIslandPath(a,target,b,o,.25);assert.ok(route.length>1);
 let p=a;for(const q of route){assert.ok(clearSegment(p,q,b,o,.25));p=q;}assert.ok(Math.hypot(p.x-target.x,p.z-target.z)<.25);
});
test('target inside a building or outside the shore resolves to safe land',()=>{
 const b=islandLayout(7,true),o=[{x:0,z:0,r:.6}];for(const p of [{x:0,z:0},{x:80,z:50}]){const safe=nearestOpenPoint(p,b,o);assert.ok(safe);assert.ok(clearPoint(safe,b,o));}
});
test('an isolated destination still approaches its reachable edge without crossing a prop',()=>{
 const b=islandLayout(7,true),o=[{x:-.71,z:.86,r:.32},{x:-.323,z:.963,r:.43},{x:-1.32,z:.91,r:.28},{x:1.07,z:.86,r:.32},{x:1.457,z:.963,r:.43},{x:.18,z:2.58,r:.32},{x:.655,z:2.733,r:.32},{x:1.16,z:2.01,r:.24},{x:-1.5,z:2.01,r:.24}];
 const start={x:-.38,z:2.15},target={x:-1.7,z:1.4},route=planIslandPath(start,target,b,o,.29);assert.ok(route.length);let at=start;for(const next of route){assert.ok(clearSegment(at,next,b,o,.29));at=next;}assert.ok(Math.hypot(at.x-target.x,at.z-target.z)<Math.hypot(start.x-target.x,start.z-target.z)-.1);
});
const mats=new Map(),material=(k,color,opts)=>{if(!mats.has(k))mats.set(k,new T.MeshStandardMaterial({color,...opts}));return mats.get(k)};
test('lighthouse extends vertically in nested stages, retaining every piece size',()=>{
 const l=createPaperKit({material,windowMat:new T.MeshStandardMaterial(),lampMats:[]}).lighthouse('urgent');let prior=-Infinity;
 for(const u of [0,.15,.3,.5,.75,1]){l.userData.fold(u);l.updateMatrixWorld(true);const top=new T.Box3().setFromObject(l).max.y;assert.ok(top>=prior-1e-9);prior=top;for(const stage of l.userData.stages){assert.equal(stage.rotation.x,0);assert.deepEqual(stage.scale.toArray(),[1,1,1]);}}
 assert.ok(prior>.6);
});
test('boats remain offshore through their route and reduced motion freezes the environment',()=>{
 const b=islandLayout(7,false),life=createCoastalLife({bounds:b,lite:true,heightAt:()=>.34,obstacles:[],material});
 for(let time=0;time<300;time+=2){life.tick(time,0,false);assert.ok(life.diagnostics().boatClearance>1.17);}
 life.tick(12,0,true);const first=JSON.stringify(life.diagnostics());life.tick(50,0,true);assert.equal(JSON.stringify(life.diagnostics()),first);assert.equal(life.diagnostics().rabbits,2);
});
