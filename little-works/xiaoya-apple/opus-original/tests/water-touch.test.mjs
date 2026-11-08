import test from 'node:test';
import assert from 'node:assert/strict';
import {canTapWater} from '../water-touch.mjs';
const bounds={rx:4,rz:3};
test('only an intentional, unclaimed tap on the sea affects fish',()=>{
 const opts={bounds,x:5.6,z:0,picked:false,dragged:false,reduced:false};
 assert.equal(canTapWater(opts),true);
 assert.equal(canTapWater({...opts,picked:true}),false,'clicking masts or Xiaoya still works');
 assert.equal(canTapWater({...opts,dragged:true}),false,'rotating the camera never scares fish');
 assert.equal(canTapWater({...opts,reduced:true}),false,'respects reduced motion');
 assert.equal(canTapWater({...opts,x:0,z:0}),false,'not on the island');
 assert.equal(canTapWater({...opts,x:70,z:70}),false,'not beyond visible ocean');
 assert.equal(canTapWater({...opts,x:NaN}),false);
});
