import {test} from 'node:test';
import assert from 'node:assert/strict';
import {INDEX_UUID, flipDuration} from '../scripts/core.js';
import {normalizeBookmarks, updatedBookmarks, visibleBookmarks, ribbonColor, savedBookmarks} from '../scripts/bookmarks.js';
test('duration accepts instant turns and clamps corrupt settings',()=>{
 assert.equal(flipDuration(0),0);assert.equal(flipDuration(1280),1280);assert.equal(flipDuration(-100),0);assert.equal(flipDuration(9000),3000);assert.equal(flipDuration(NaN),520);assert.equal(flipDuration(undefined),520);
});
test('bookmark colors reject CSS injection and normalize hex',()=>{
 assert.equal(ribbonColor('#ABCDEF'),'#abcdef');assert.equal(ribbonColor('red;display:none'),'#a34b49');assert.equal(ribbonColor('url(x)'),'#a34b49');
});
test('bad stored bookmarks are ignored and duplicates are not rendered',()=>{
 assert.deepEqual(normalizeBookmarks(null),[]);assert.equal(normalizeBookmarks([null,{uuid:2},{uuid:'p',label:'  Place  '},{uuid:'p'}]).length,1);assert.equal(normalizeBookmarks([{uuid:'p',label:'x'.repeat(100)}])[0].label.length,60);
});
test('bookmark title and number follow current readable membership',()=>{
 const saved=[{uuid:'p',label:'Custom label',color:'#4e6f9a'},{uuid:'secret',label:'Hidden title'}];
 assert.deepEqual(visibleBookmarks(saved,[{uuid:'p',name:'Renamed page'}]).map(b=>[b.label,b.pageNumber]),[['Custom label',2]]);
 assert.equal(visibleBookmarks(saved,[]).length,0);
});
test('bookmark numbering updates after preceding pages change',()=>{
 const saved=[{uuid:'b'}];assert.equal(visibleBookmarks(saved,[{uuid:'a',name:'A'},{uuid:'b',name:'B'}])[0].pageNumber,3);assert.equal(visibleBookmarks(saved,[{uuid:'b',name:'B'}])[0].pageNumber,2);
});
test('the index can be bookmarked in an empty book',()=>assert.equal(visibleBookmarks([{uuid:INDEX_UUID}],[])[0].pageNumber,1));
test('editing and removal preserve other bookmarks and their order',()=>{
 const saved=[{uuid:'a',label:'A'},{uuid:'b',label:'B'}];const changed=updatedBookmarks(saved,{uuid:'a',label:'New',color:'#4f755b'});
 assert.deepEqual(changed.map(b=>b.uuid),['a','b']);assert.equal(changed[0].label,'New');assert.equal(saved[0].label,'A');assert.deepEqual(updatedBookmarks(changed,{uuid:'a'},true).map(b=>b.uuid),['b']);
});
test('personal bookmarks are isolated by user and destination book',()=>{
 const user={getFlag:()=>({one:[{uuid:'a'}],two:[{uuid:'b'}]})};assert.equal(savedBookmarks(user,'one')[0].uuid,'a');assert.equal(savedBookmarks(user,'two')[0].uuid,'b');assert.deepEqual(savedBookmarks({getFlag:()=>undefined},'one'),[]);
});
