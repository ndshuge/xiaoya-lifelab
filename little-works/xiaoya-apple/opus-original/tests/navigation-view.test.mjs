import test from 'node:test';
import assert from 'node:assert/strict';
import {VIEW_IDS,normalizeView,rememberedScale} from '../navigation-view.mjs';
test('five stable destinations and old scale preferences',()=>{
 assert.deepEqual(VIEW_IDS,['day','week','line','pocket','journal']);
 assert.equal(normalizeView({scale:'week'}),'week');
 for(const view of VIEW_IDS)assert.equal(normalizeView({view,scale:'week'}),view);
 for(const bad of [null,{},[],{view:'unknown',scale:'week'},{scale:'bad'}])assert.equal(normalizeView(bad),'day');
 assert.equal(rememberedScale('pocket','line'),'line');
 assert.equal(rememberedScale('journal','oops'),'day');
 assert.equal(rememberedScale('week','day'),'week');
});
