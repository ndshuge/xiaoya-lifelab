import test from 'node:test';
import assert from 'node:assert/strict';
import {createOceanArtShader,shoreDepth} from '../sea-art-glsl.mjs';

test('seabed shader has perceptible sand, grass, reef and animated caustics',()=>{
 const shader=createOceanArtShader({lite:false});
 for(const feature of ['sandBed','grassBed','reefBed','caustics','oceanArt']) assert.ok(shader.includes(feature),feature);
 assert.match(shader,/uTime/);
 assert.match(shader,/vec3 oceanArt\(vec2 p,float e,float uTime,float night\)/);
 assert.ok(shoreDepth(0)<shoreDepth(1) && shoreDepth(1)<shoreDepth(6));
});
test('mobile seabed excludes expensive reef but preserves sand and caustics',()=>{
 const lite=createOceanArtShader({lite:true});
 assert.ok(lite.includes('sandBed'));
 assert.ok(lite.includes('caustics'));
 assert.ok(!lite.includes('reefBed'));
});
