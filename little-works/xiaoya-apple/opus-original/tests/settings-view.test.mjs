import test from 'node:test';
import assert from 'node:assert/strict';
import {renderSettingsHome,buildSectionPatch} from '../settings-view.mjs';
const cur={semester:{name:'西交秋季',start:'2026-09-01',end:'2027-01-15',custom:7},settings:{reminderEnabled:true,quietStart:'22:30',quietEnd:'08:00',reminderGap:30,quiet:false,reducedMotion:false,other:'keep'}};
const fd=x=>new Map(Object.entries(x));
test('settings root has six navigation destinations and no editable inputs',()=>{
 const html=renderSettingsHome({modeLabel:'私人',semesterLabel:'西交秋季',reminderLabel:'开启',modelLabel:'未连接'});
 assert.equal((html.match(/data-settings-section=/g)||[]).length,6);
 assert.doesNotMatch(html,/<input|<textarea|保存全部设置|API Key/);
});
test('each patch writes only owned fields and keeps omitted advanced reminder parameters',()=>{
 const remind=buildSectionPatch('reminders',fd({}),cur);
 assert.deepEqual(remind,{settings:{reminderEnabled:false,quietStart:'22:30',quietEnd:'08:00',reminderGap:30}});
 assert.equal('semester' in remind,false);
 const look=buildSectionPatch('appearance',fd({quiet:'on'}),cur);
 assert.deepEqual(look,{settings:{quiet:true,reducedMotion:false}});
 assert.equal('reminderGap' in look.settings,false);
 const sem=buildSectionPatch('semester',fd({semName:'新学期',semStart:'2026-09-01',semEnd:'2027-01-15'}),cur);
 assert.deepEqual(sem,{semester:{name:'新学期',start:'2026-09-01',end:'2027-01-15'}});
 assert.equal('settings' in sem,false);
 assert.throws(()=>buildSectionPatch('semester',fd({semName:'',semStart:'2026-09-01',semEnd:''}),cur));
 assert.throws(()=>buildSectionPatch('what',fd({}),cur));
});
