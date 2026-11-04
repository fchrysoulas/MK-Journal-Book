import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ID, normalizeTag, tagKey, tagTabs, pageTag, collectPages, filterPages} from '../scripts/core.js';
import {bookCreationData} from '../scripts/journals.js';
import {renderBook} from '../scripts/view.js';
const user={id:'gm',isGM:true};
function fixture({old=false, tag, category='locations'}={}) {
 const page={uuid:'JournalEntry.J.JournalEntryPage.P',name:'Harbor',type:'text',getFlag:(_scope,key)=>({category})[key],testUserPermission:()=>true};
 const journal={uuid:'JournalEntry.J',name:'Coast',pages:[page],getFlag:()=>undefined,testUserPermission:()=>true};page.parent=journal;
 const flags=old?{book:true,pages:[page.uuid],categories:{}}:bookCreationData({},null,user,[]).flags[ID];flags.pages=[page.uuid];
 if(tag!==undefined)flags.tags={[page.uuid.replaceAll('.','~')]:tag};
 const book={documentName:'JournalEntry',getFlag:(_scope,key)=>flags[key],testUserPermission:()=>true};
 return {page,journal,book,flags};
}
test('tags normalize whitespace, Unicode and length; invalid stored values are harmless',()=>{
 assert.equal(normalizeTag('  Side\n  quests  '),'Side quests');assert.equal(tagKey(' Cafe\u0301 '),tagKey('CAFÉ'));assert.equal(normalizeTag('x'.repeat(80)).length,40);assert.equal(normalizeTag({bad:true}),'');
});
test('custom tags are counted and sorted without duplicate case variants',()=>{
 const tabs=tagTabs([{tag:'Quests'},{tag:'quests'},{tag:'Clues'},{tag:''}]);
 assert.deepEqual(tabs.map(t=>[t.key,t.count]),[['all',4],['tag:clues',1],['tag:quests',2]]);
 assert.equal(filterPages([{tag:'QUESTS'},{tag:'Clues'}],'tag:quests').length,1);
});
test('empty book has only All; unused fixed categories never appear',()=>{
 assert.deepEqual(tagTabs([]).map(t=>t.key),['all']);assert.deepEqual(tagTabs([{tag:'Ships'}]).map(t=>t.key),['all','tag:ships']);
});
test('reserved names and object keys are safe custom tags',()=>{
 const names=['All','untagged','__proto__','constructor','A.B'];
 for(const name of names)assert.equal(tagTabs([{tag:name}])[1].key,`tag:${name.toLowerCase()}`);
 assert.equal(tagKey('All'),'tag:all');assert.equal(tagKey(''),'untagged');
});
test('new books have optional per-book tags and ignore source/folder categories',()=>{
 const {page,book}=fixture();assert.equal(pageTag(page,book),'');assert.equal(book.getFlag(ID,'tagVersion'),1);
});
test('old books preserve category fallback until explicitly cleared',()=>{
 const {page,book,flags}=fixture({old:true});assert.equal(pageTag(page,book),'Locations');
 flags.categories[page.uuid.replaceAll('.','~')]='characters';assert.equal(pageTag(page,book),'Characters');
 flags.tags={[page.uuid.replaceAll('.','~')]:''};assert.equal(pageTag(page,book),'');
});
test('one page has independent tags in two books without editing the source',()=>{
 const a=fixture({tag:'Quests'}),b=fixture({tag:'Clues'});assert.equal(pageTag(a.page,a.book),'Quests');assert.equal(pageTag(a.page,b.book),'Clues');assert.equal(a.page.getFlag(ID,'tag'),undefined);
});
test('unselected, denied and removed pages do not expose their tags or counts',()=>{
 const {page,journal,book,flags}=fixture({tag:'Secret plans'});page.testUserPermission=()=>false;
 assert.deepEqual(tagTabs(collectPages([journal],user,book)).map(t=>t.key),['all']);
 page.testUserPermission=()=>true;flags.pages=[];assert.equal(collectPages([journal],user,book).length,0);
});
test('tag names are escaped in tabs, metadata and management buttons',()=>{
 const row={uuid:'p',name:'Page',journal:'J',tag:'\"><img src=x onerror=alert(1)>',content:''};
 const html=renderBook({title:'Book',pages:[row],filtered:[row],leaves:[row],tab:'all',isGM:true});
 assert.ok(!html.includes('<img src=x'));assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('data-mkjb-category'));
 assert.ok(html.includes('aria-label="Page tags"'));assert.ok(html.includes('data-mkjb-action="tag"'));
});
