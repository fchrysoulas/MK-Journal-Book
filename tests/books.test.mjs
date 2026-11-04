import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ID, BOOK_SHEET_ID, canReadBook, canManageBook, collectPages, sharedWithPlayers} from '../scripts/core.js';
import {bookCreationData} from '../scripts/journals.js';
const gm={id:'gm',isGM:true},alice={id:'alice',isGM:false},bob={id:'bob',isGM:false};
const users=[gm,alice,bob];
function book(pages=[],levels={default:2,alice:3}) {
 return {documentName:'JournalEntry',getFlag:(_scope,key)=>({book:true,pages,categories:{}})[key],testUserPermission:(u,l)=>u.isGM||(levels[u.id]??levels.default??0)>={OBSERVER:2,OWNER:3}[l]};
}
function source(){
 const page={id:'P',uuid:'JournalEntry.J.JournalEntryPage.P',name:'Page',type:'text',ownership:{default:2},getFlag:()=>undefined,testUserPermission:()=>true};
 const journal={id:'J',uuid:'JournalEntry.J',name:'Source',pages:[page],getFlag:()=>undefined,testUserPermission:()=>true};page.parent=journal;return {page,journal};
}
test('book creation grants selected owner and starts empty',()=>{
 const data=bookCreationData({name:'Atlas',folder:'F',flags:{another:{keep:true}}},'alice',gm,users);
 assert.equal(data.name,'Atlas');assert.equal(data.folder,'F');assert.equal(data.flags.another.keep,true);
 assert.deepEqual(data.ownership,{default:2,alice:3});assert.deepEqual(data.flags[ID].pages,[]);assert.equal(data.flags.core.sheetClass,BOOK_SHEET_ID);
});
test('non-GM creator cannot assign another owner through creation input',()=>assert.deepEqual(bookCreationData({},'bob',alice,users).ownership,{default:2,alice:3}));
test('invalid owner is not saved as a permission key',()=>assert.deepEqual(bookCreationData({},'missing',gm,users).ownership,{default:2}));
test('book ownership separates Observer, Owner and denied readers',()=>{
 const b=book([], {default:0,alice:3,bob:2});assert.equal(canManageBook(b,alice),true);assert.equal(canManageBook(b,bob),false);assert.equal(canReadBook(b,bob),true);assert.equal(canReadBook(book([],{default:0}),bob),false);
});
test('separate books have separate explicitly selected pages',()=>{const {page,journal}=source();assert.equal(collectPages([journal],alice,book([page.uuid])).length,1);assert.equal(collectPages([journal],alice,book()).length,0);assert.equal(collectPages([journal],alice).length,0)});
test('a page UUID never bypasses the book or source permission',()=>{
 const {page,journal}=source();assert.equal(collectPages([journal],bob,book([page.uuid],{default:0})).length,0);page.testUserPermission=()=>false;assert.equal(collectPages([journal],alice,book([page.uuid])).length,0);
});
test('deleted references are harmless and duplicate references render once',()=>{const {page,journal}=source();assert.equal(collectPages([journal],alice,book([page.uuid,page.uuid,'missing'])).length,1)});
test('a player owner may only add content shared with every current and future player',()=>{
 const {page}=source();assert.equal(sharedWithPlayers(page,users),true);page.ownership.default=0;assert.equal(sharedWithPlayers(page,users),false);page.ownership.default=2;page.testUserPermission=u=>u.id!=='bob';assert.equal(sharedWithPlayers(page,users),false);
});
test('shared page default can inherit from its parent journal',()=>{const {page,journal}=source();page.ownership.default=-1;journal.ownership={default:2};assert.equal(sharedWithPlayers(page,users),true);journal.ownership.default=0;assert.equal(sharedWithPlayers(page,users),false)});
test('old per-book categories carry forward as tags without changing the source or another book',()=>{
 const {page,journal}=source(),a=book([page.uuid]),b=book([page.uuid]);const original=a.getFlag;a.getFlag=(scope,key)=>key==='categories'?{[page.uuid.replaceAll('.','~')]:'locations'}:original(scope,key);
 assert.equal(collectPages([journal],alice,a)[0].tag,'Locations');assert.equal(collectPages([journal],alice,b)[0].tag,'Notes');assert.equal(page.getFlag(ID,'category'),undefined);
});
