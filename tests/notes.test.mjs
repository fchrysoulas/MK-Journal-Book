import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ID, collectPages} from '../scripts/core.js';
import {NOTE_MAX_LENGTH, NOTE_TITLE_MAX_LENGTH, noteText, noteTitle, noteKey, normalizePageNote, pageNote, makePageNote, NOTE_STYLES, resolveNoteStyle, noteStyleOptions, noteRotation, notePlacement} from '../scripts/notes.js';
import {renderBook} from '../scripts/view.js';
import {bookCreationData} from '../scripts/journals.js';
const user={id:'gm',name:'GM',isGM:true};
const uuid='JournalEntry.J.JournalEntryPage.P';
const raw={text:'Remember the silver key.',authorId:'gm',authorName:'GM',updatedAt:1700000000000};
function source(){
 const page={uuid,name:'Harbor',type:'text',getFlag:(_id,key)=>key==='note'?raw:key==='included'?true:undefined,testUserPermission:()=>true};
 const journal={uuid:'JournalEntry.J',name:'Coast',pages:[page],testUserPermission:()=>true};page.parent=journal;
 const flags={book:true,pages:[uuid],tagVersion:1,notes:{[noteKey(uuid)]:raw}};
 const book={documentName:'JournalEntry',getFlag:(_id,key)=>flags[key],testUserPermission:()=>true};
 return {page,journal,book,flags};
}
test('note text preserves line breaks, normalizes text and bounds corrupt stored data',()=>{
 assert.equal(noteText('  Cafe\u0301\r\nBring\u0000 a key.  '),'Café\nBring a key.');assert.equal(noteText('x'.repeat(3000)).length,NOTE_MAX_LENGTH);assert.equal(noteText({}),'');
 for(const value of [null,[],{},'note',{text:'  '},{text:42}])assert.equal(normalizePageNote(value),null);
});
test('note metadata uses the saving user and valid timestamps',()=>{
 assert.deepEqual(makePageNote(' A clue ',user,1234),{text:'A clue',title:'Page note',style:'parchment',position:null,positionSpace:'page',rotation:null,authorId:'gm',authorName:'GM',updatedAt:1234});
 assert.equal(makePageNote('',user),null);assert.throws(()=>makePageNote({},user));assert.throws(()=>makePageNote('x'.repeat(2001),user));
 const note=normalizePageNote({text:'clue',authorId:[],authorName:{},updatedAt:Infinity});assert.equal(note.authorId,'');assert.equal(note.authorName,'');assert.equal(note.updatedAt,null);
});
test('a new book starts with empty notes metadata',()=>{
 assert.deepEqual(bookCreationData({},null,user,[]).flags[ID].notes,{});
});
test('notes are independent per book and do not inherit legacy source notes',()=>{
 const {page,book}=source();assert.equal(pageNote(page,book).text,raw.text);
 const other={getFlag:()=>({[noteKey(uuid)]:{...raw,text:'Other book'}})};assert.equal(pageNote(page,other).text,'Other book');
 assert.equal(pageNote(page,{getFlag:()=>undefined}),null);assert.equal(pageNote(page).text,raw.text);
});
test('permission and membership filtering precede note retrieval',()=>{
 const {page,journal,book,flags}=source();const visible=()=>collectPages([journal],user,book).map(row=>pageNote(row.page,book));assert.equal(visible().length,1);
 flags.pages=[];assert.deepEqual(visible(),[]);flags.pages=[uuid];page.testUserPermission=()=>false;assert.deepEqual(visible(),[]);
});
test('note text and author metadata render as literal text, never markup',()=>{
 const row={uuid,name:'Harbor',tag:'',journal:'Coast',content:'<p>Source</p>',note:{...raw,text:'</div><script>evil()</script>\n@UUID[secret]',authorName:'<img src=x onerror=evil()>'}};
 const html=renderBook({title:'Book',pages:[row],filtered:[row],leaves:[row],tab:'all',isGM:true});
 assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img src=x'));assert.ok(html.includes('@UUID[secret]'));
 assert.ok(html.includes('data-mkjb-action="note"'));assert.ok(html.includes('title="Last edited by &lt;img'));assert.ok(html.includes(new Date(raw.updatedAt).toLocaleString()));assert.ok(!html.includes('mkjb-note-meta'));
});

test('optional titles retain legacy labels, allow blank titles and sanitize stored input',()=>{
 assert.equal(normalizePageNote(raw).title,'Page note');assert.equal(normalizePageNote({...raw,title:''}).title,'');
 assert.equal(noteTitle('  Cafe\u0301\n\u0000 clues  '),'Café clues');assert.equal(noteTitle('x'.repeat(100)).length,NOTE_TITLE_MAX_LENGTH);
 assert.equal(makePageNote('Clue',user,1234,'torn','  Leads  ').title,'Leads');assert.equal(makePageNote('Clue',user,1234,'torn','').title,'');
 assert.throws(()=>makePageNote('Clue',user,1234,'torn',{}));assert.throws(()=>makePageNote('Clue',user,1234,'torn','x'.repeat(81)));
});

test('custom titles are escaped and untitled reader notes omit the heading',()=>{
 const row={uuid,name:'Harbor',tag:'',journal:'Coast',content:'',note:{...raw,title:'<img src=x onerror=evil()>'}};
 const render=()=>renderBook({title:'Book',pages:[row],filtered:[row],leaves:[row],tab:'all',isGM:false});
 assert.ok(render().includes('mkjb-note-title">&lt;img'));assert.ok(!render().includes('<img src=x'));
 row.note.title='';assert.ok(!render().includes('mkjb-note-heading'));assert.ok(!render().includes('mkjb-note-meta'));assert.ok(render().includes('title="Last edited by GM'));
});
test('readers see the parchment and view action without edit controls',()=>{
 const row={uuid,name:'Harbor',tag:'',journal:'Coast',content:'',note:raw};
 const html=renderBook({title:'Book',pages:[row],filtered:[row],leaves:[row],tab:'all',isGM:false});
 assert.ok(html.includes('class="mkjb-page-note mkjb-note-style-parchment mkjb-note-positioned"'));assert.ok(html.includes('data-mkjb-action="view-note"'));assert.ok(!html.includes('data-mkjb-action="note"'));assert.ok(!html.includes('class="mkjb-note-edit"'));
});

test('note styles preserve valid choices and safely default old or corrupt notes',()=>{
 assert.deepEqual(Object.keys(NOTE_STYLES),['parchment','sticky','torn']);
 for(const style of Object.keys(NOTE_STYLES))assert.equal(makePageNote('Clue',user,1234,style).style,style);
 for(const style of [undefined,null,'__proto__','constructor','\" onclick=\"evil()']){
  assert.equal(resolveNoteStyle(style),'parchment');assert.equal(normalizePageNote({...raw,style}).style,'parchment');
 }
 assert.equal(normalizePageNote(raw).style,'parchment');assert.throws(()=>makePageNote('Clue',user,1234,'unknown'));
 assert.ok(noteStyleOptions('sticky').includes('value="sticky" selected'));assert.ok(!noteStyleOptions('evil()').includes('evil()'));
});

test('note layout metadata validates writes and safely ignores corrupt stored values',()=>{
 assert.deepEqual(makePageNote('Clue',user,1234,'torn','Leads',{position:{x:0,y:1},rotation:-20}).position,{x:0,y:1});
 for(const position of [{x:-1,y:0},{x:0,y:Infinity},{x:'.5',y:0},[],{}]){
  assert.equal(normalizePageNote({...raw,position}).position,null);
  assert.throws(()=>makePageNote('Clue',user,1234,'torn','',{position}));
 }
 for(const rotation of [21,-21,NaN,'20deg;display:none']){
  assert.equal(normalizePageNote({...raw,rotation}).rotation,null);
  assert.throws(()=>makePageNote('Clue',user,1234,'torn','',{rotation}));
 }
 assert.equal(noteRotation(normalizePageNote({...raw,style:'torn'})),-.7);assert.equal(noteRotation({...raw,rotation:0}),0);
 assert.equal(normalizePageNote(raw).positionSpace,'content');assert.equal(makePageNote('Clue',user).positionSpace,'page');assert.equal(normalizePageNote(raw).position,null);assert.equal(normalizePageNote(raw).rotation,null);
});

test('rotated note placement stays inside small and large pages at every corner',()=>{
 for(const [width,height] of [[450,400],[270,160],[230,80]])for(const rotation of [-20,0,20])for(const x of [0,.5,1])for(const y of [0,.5,1]){
  const paperWidth=220,paperHeight=230,result=notePlacement(width,height,paperWidth,paperHeight,rotation,{x,y});
  const angle=rotation*Math.PI/180,cos=Math.abs(Math.cos(angle)),sin=Math.abs(Math.sin(angle));
  const w=(paperWidth*cos+paperHeight*sin)*result.scale,h=(paperWidth*sin+paperHeight*cos)*result.scale;
  const left=result.left+paperWidth/2-w/2,top=result.top+paperHeight/2-h/2;
  assert.ok(left>=9.99&&top>=9.99&&left+w<=width-9.99&&top+h<=height-9.99);
 }
});
