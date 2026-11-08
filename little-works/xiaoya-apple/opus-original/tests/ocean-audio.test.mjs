import test from 'node:test';
import assert from 'node:assert/strict';
import {createOceanAudio} from '../ocean-audio.mjs';

function fakeWebAudio(){
 const stats={contexts:0,resumes:0,suspends:0,closes:0,starts:0,stops:0,ticks:null};
 class Node{
  connect(){return this}
  disconnect(){}
  start(){stats.starts++}
  stop(){stats.stops++}
 }
 class Context{
  constructor(){stats.contexts++;this.sampleRate=8000;this.currentTime=0;this.destination={};this.state='suspended'}
  createBuffer(channels,length){assert.equal(channels,1);return {getChannelData:()=>new Float32Array(length)}}
  createBufferSource(){return Object.assign(new Node(),{loop:false})}
  createBiquadFilter(){return Object.assign(new Node(),{type:'',frequency:{value:0},Q:{value:0}})}
  createGain(){return Object.assign(new Node(),{gain:{value:0,setTargetAtTime(){}}})}
  async resume(){stats.resumes++;this.state='running'}
  async suspend(){stats.suspends++;this.state='suspended'}
  async close(){stats.closes++;this.state='closed'}
 }
 return {Context,stats};
}

test('silent until explicit start, then one resumable audio graph',async()=>{
 const {Context,stats}=fakeWebAudio();
 const audio=createOceanAudio({Context,setIntervalFn(fn){stats.ticks=fn;return 7},clearIntervalFn(){stats.ticks=null}});
 assert.equal(audio.isPlaying(),false);
 assert.equal(stats.contexts,0);
 assert.equal(await audio.start(),true);
 assert.equal(audio.isPlaying(),true);
 assert.equal(stats.contexts,1);
 assert.equal(stats.starts,1);
 assert.equal(typeof stats.ticks,'function');
 stats.ticks();
 await audio.stop();
 assert.equal(audio.isPlaying(),false);
 assert.equal(stats.suspends,1);
 assert.equal(stats.ticks,null);
 await audio.start();
 assert.equal(stats.contexts,1,'reuses a context after pause');
 assert.equal(stats.resumes,2);
 await audio.dispose();
 assert.equal(stats.closes,1);
 assert.equal(stats.stops,1);
 assert.equal(audio.isPlaying(),false);
});

test('unavailable Web Audio remains silent without throwing',async()=>{
 const audio=createOceanAudio({Context:null});
 assert.equal(await audio.start(),false);
 assert.equal(audio.isPlaying(),false);
 await audio.stop();
 await audio.dispose();
});
