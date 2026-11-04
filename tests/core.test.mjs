import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ID, canReadPage, included, sharedOwnership, categoryOf, collectPages, filterPages, escapeHTML, safeMediaURL, buildJournalIndex, bookSequence, INDEX_UUID} from '../scripts/core.js';
import {renderBook} from '../scripts/view.js';
const gm={id:'gm',isGM:true},alice={id:'a',isGM:false},bob={id:'b',isGM:false};
const users=[gm,alice,bob];
function fixture({type='text',levels={default:2},added=false,pageCategory,journalCategory,folder,name='A page',parentName='A journal'}={}) {
 const permissions={NONE:0,LIMITED:1,OBSERVER:2,OWNER:3};
 const journal={name:parentName,folder,pages:[],getFlag:(_id,key)=>key==='category'?journalCategory:undefined,testUserPermission:(u,l)=>u.isGM||(levels[u.id]??levels.default??0)>=permissions[l]};
 const page={uuid:'JournalEntry.J.JournalEntryPage.P',id:'P',type,name,parent:journal,sort:0,ownership:levels,getFlag:(_id,key)=>key==='included'?added:key==='category'?pageCategory:undefined,testUserPermission:journal.testUserPermission};journal.pages.push(page);return {page,journal};
}
test('visible pages are never automatically included',()=>assert.equal(included(fixture().page,alice),false));
test('GM also sees an empty book until pages are chosen',()=>assert.equal(included(fixture().page,gm),false));
test('explicitly added readable pages are included',()=>assert.equal(included(fixture({added:true}).page,alice),true));
test('revoked page remains inaccessible despite membership',()=>assert.equal(included(fixture({added:true,levels:{default:0}}).page,alice),false));
test('strict boolean membership rejects a category or string',()=>assert.equal(included(fixture({added:'true'}).page,alice),false));
test('limited text does not grant reading',()=>assert.equal(canReadPage(fixture({levels:{default:1}}).page,alice),false));
test('limited image access is readable',()=>assert.equal(canReadPage(fixture({type:'image',levels:{default:1}}).page,alice),true));
test('sharing upgrades default and explicit per-player denials',()=>assert.deepEqual(sharedOwnership(fixture({levels:{default:0,a:0,b:1}}).page,users),{default:2,a:2,b:2}));
test('sharing preserves owner and GM permissions',()=>assert.deepEqual(sharedOwnership(fixture({levels:{default:0,a:3,b:0,gm:0}}).page,users),{default:2,a:3,b:2,gm:0}));
test('sharing preserves inherited Owner access',()=>{const {page}=fixture({levels:{default:-1}});page.testUserPermission=(u,l)=>u.id==='a'&&l==='OWNER';assert.equal(sharedOwnership(page,users).a,3)});
test('sharing does not mutate source ownership before update',()=>{const {page}=fixture({levels:{default:0}});sharedOwnership(page,users);assert.deepEqual(page.ownership,{default:0})});
test('uncategorized pages default to Notes',()=>assert.equal(categoryOf(fixture().page),'notes'));
test('explicit category beats journal category',()=>assert.equal(categoryOf(fixture({pageCategory:'characters',journalCategory:'locations'}).page),'characters'));
test('journal category is inherited',()=>assert.equal(categoryOf(fixture({journalCategory:'locations'}).page),'locations'));
test('folder category does not imply book membership',()=>{const {page}=fixture({folder:{id:'F',name:'Locations'}});assert.equal(categoryOf(page),'locations');assert.equal(included(page,alice),false)});
test('hidden parent title is not revealed for readable chosen page',()=>{const {page,journal}=fixture({added:true,levels:{default:0},parentName:'Secret identity'});page.testUserPermission=()=>true;assert.equal(collectPages([journal],alice)[0].journal,'Shared journal')});
test('tag and case-insensitive title filters',()=>{const rows=[{name:'Harbor',journal:'Coast',tag:'Locations'},{name:'Captain',journal:'Harbor',tag:'Characters'}];assert.equal(filterPages(rows,'all','HARBOR').length,2);assert.equal(filterPages(rows,'tag:locations','coast').length,1)});
test('executable media schemes are rejected',()=>{for(const url of ['javascript:alert(1)','data:text/html,<script>','java\nscript:evil'])assert.equal(safeMediaURL(url),'');assert.equal(safeMediaURL('assets/book.webp'),'assets/book.webp')});
test('metadata is escaped; player view has no management controls',()=>{const page=fixture({name:'<script>alert(1)</script>'}).page;const row={page,name:page.name,journal:'Journal',uuid:page.uuid,tag:'Notes'};const html=renderBook({title:'Book',pages:[row],filtered:[row],leaves:[{...row,content:''}],start:0,tab:'all',isGM:false});assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('data-mkjb-membership'));assert.ok(!html.includes('data-mkjb-action="manage"'));assert.equal(escapeHTML('<'), '&lt;')});

test('index is the first real book page in All',()=>{const rows=[{uuid:'p1',tag:'Notes',journal:'J',journalUuid:'j1'}];const sequence=bookSequence(rows,'all');assert.equal(sequence[0].uuid,INDEX_UUID);assert.equal(sequence[1].uuid,'p1');assert.equal(sequence[0].journals[0].pageNumber,2)});
test('index groups included pages by journal identity',()=>{const rows=[{uuid:'p1',journal:'Same title',journalUuid:'j1'},{uuid:'p2',journal:'Same title',journalUuid:'j1'},{uuid:'p3',journal:'Same title',journalUuid:'j2'}];const index=buildJournalIndex(rows);assert.equal(index.length,2);assert.deepEqual(index.map(j=>[j.count,j.pageNumber,j.uuid]),[[2,2,'p1'],[1,4,'p3']])});
test('empty book still has the index',()=>{const sequence=bookSequence([],'all');assert.equal(sequence.length,1);assert.deepEqual(sequence[0].journals,[])});
test('tag tabs filter content without a persistent index',()=>{const rows=[{uuid:'p1',tag:'Notes'},{uuid:'p2',tag:'Locations'}];assert.deepEqual(bookSequence(rows,'tag:locations'),[rows[1]])});
test('unreadable and unselected journals are absent from index',()=>{const hidden=fixture({added:true,levels:{default:0}}),unselected=fixture(),visible=fixture({added:true});const index=buildJournalIndex(collectPages([hidden.journal,unselected.journal,visible.journal],alice));assert.equal(index.length,1);assert.equal(index[0].count,1)});
