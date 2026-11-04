import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ID, INDEX_UUID} from '../scripts/core.js';
import {readingPosition, searchExcerpt, searchResultsHTML} from '../scripts/reading.js';
import {orderedPages, reorderedUUIDs, mergeVisibleOrder} from '../scripts/ordering.js';
import {pageNotes, getNote, makePageNote, normalizePageNote, validNoteId, newNoteId} from '../scripts/notes.js';
import {normalizeCover, coverDetails} from '../scripts/cover.js';
const rows=[{uuid:'a1',journalUuid:'a',name:'A1',tag:'Quest'}, {uuid:'a2',journalUuid:'a',name:'A2',tag:''}, {uuid:'b1',journalUuid:'b',name:'B1',tag:'Quest'}];
test('reading state is scoped to a book and only restores accessible targets/tabs',()=>{
 const user={getFlag:()=>({one:{uuid:'a1',tab:'tag:quest'},two:{uuid:'b1',tab:'all'}})};
 assert.deepEqual(readingPosition(user,'one',rows),{uuid:'a1',tab:'tag:quest'});
 assert.deepEqual(readingPosition(user,'two',rows),{uuid:'b1',tab:'all'});
 for(const result of [readingPosition(user,'one',rows,true),readingPosition(user,'one',rows.slice(1)),readingPosition(user,'three',rows)])assert.deepEqual(result,{uuid:INDEX_UUID,tab:'all'});
});
test('search snippets are bounded and results cannot inject markup',()=>{
 const snippet=searchExcerpt('a'.repeat(400)+' silver key '+'b'.repeat(400),'silver');assert.ok(snippet.startsWith('…'));assert.ok(snippet.endsWith('…'));assert.ok(snippet.includes('silver key'));assert.ok(snippet.length<180);
 const html=searchResultsHTML([{uuid:'a" onclick="bad()',name:'<img src=x>',journal:'<script>',excerpt:'<b>secret</b>'}]);assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;b&gt;secret&lt;/b&gt;'));assert.ok(!html.includes(' onclick="'));
});
test('manual ordering preserves grouped journals and appends new pages',()=>{
 assert.deepEqual(orderedPages(rows,['b1','a2','a1']).map(r=>r.uuid),['b1','a2','a1']);
 assert.deepEqual(orderedPages([...rows,{uuid:'a3',journalUuid:'a'}],['b1','a2']).map(r=>r.uuid),['b1','a2','a1','a3']);
 assert.deepEqual(reorderedUUIDs(rows,'b','a','journal'),['b1','a1','a2']);
 assert.deepEqual(reorderedUUIDs(rows,'a1','a2','page',true),['a2','a1','b1']);
 assert.throws(()=>reorderedUUIDs(rows,'a1','b1','page'));
 assert.deepEqual(mergeVisibleOrder(['a1','hidden','a2'],['a1','hidden','a2','b1'],['b1','a2','a1']),['b1','hidden','a2','a1']);
});
test('multiple notes retain the old primary note and validate independent identifiers',()=>{
 const raw={text:'Old primary',position:{x:.2,y:.5},positionSpace:'content',rotation:9};
 const flags={notes:{Page:raw},extraNotes:{Page:{nfirst:{text:'Second'},nsecond:{text:'Third'},constructor:{text:'Invalid'}}}};
 const page={uuid:'Page'},book={getFlag:(_scope,key)=>flags[key]};
 const notes=pageNotes(page,book);assert.deepEqual(notes.map(n=>n.id),['primary','nfirst','nsecond']);assert.equal(notes[0].text,raw.text);assert.deepEqual(notes[0].position,raw.position);
 assert.equal(getNote(page,book,'nsecond').text,'Third');assert.equal(getNote(page,book,'missing'),null);assert.ok(validNoteId(newNoteId()));
 for(const id of ['__proto__','constructor','a.b','primary.child',''])assert.equal(validNoteId(id),false);
});
test('resizable note data accepts bounded dimensions and rejects corrupt values',()=>{
 const note=makePageNote('Clue',{id:'gm',name:'GM'},1234,'sticky','',{size:{width:300,height:220}});assert.deepEqual(note.size,{width:300,height:220});
 for(const size of [{width:500,height:200},{width:200,height:20},{width:Infinity,height:200},{width:'200',height:200}]){
  assert.throws(()=>makePageNote('Clue',{id:'gm',name:'GM'},1234,'sticky','',{size}));assert.equal(normalizePageNote({text:'Clue',size}).size,undefined);
 }
});
test('cover content normalizes plain text and rejects executable image schemes',()=>{
 const cover=normalizeCover({title:'  My\nbook ',subtitle:'x'.repeat(200),image:'javascript:alert(1)',emblem:'data:text/html,evil'});
 assert.equal(cover.title,'My book');assert.equal(cover.subtitle.length,160);assert.equal(cover.image,'');assert.equal(cover.emblem,'');
 assert.equal(coverDetails({},'Journal','gothic').title,'Journal');assert.ok(coverDetails({},'Journal','gothic').image.endsWith('gothic-cover.svg'));
 assert.equal(coverDetails({title:'Custom',image:'worlds/my-world/cover.webp'},'Journal','classic').image,'worlds/my-world/cover.webp');
});

test('reading-only hooks include flattened/expanded flags and statistics without hiding permission updates', async()=>{
 const {isReadingPositionUpdate}=await import('../scripts/reading.js');
 assert.equal(isReadingPositionUpdate({_id:'u',_stats:{modifiedTime:1},[`flags.${ID}.reading.b`]:{uuid:'page'}}),true);
 assert.equal(isReadingPositionUpdate({'_stats.modifiedTime':1,[`flags.${ID}.reading.b`]:{uuid:'page'}}),true);
 assert.equal(isReadingPositionUpdate({_id:'u',_stats:{modifiedTime:1},flags:{[ID]:{reading:{b:{uuid:'page'}}}}}),true);
 for(const update of [null,{}, {_stats:{}},{flags:{}},{flags:{[ID]:{}}},{flags:{[ID]:{reading:{},bookmarks:{}}}}, {role:1,flags:{[ID]:{reading:{}}}}, {permissions:{},[`flags.${ID}.reading.b`]:{}}])assert.equal(isReadingPositionUpdate(update),false);
});
