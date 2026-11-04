const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'), path=require('node:path'), http=require('node:http');
(async()=>{
 const server=http.createServer((req,res)=>{
  const root=path.resolve(__dirname,'..');
  const filename=path.join(root,decodeURIComponent(req.url.split('?')[0]));
  if(!filename.startsWith(root+path.sep)){res.writeHead(403);return res.end()}
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[path.extname(filename)]||'application/octet-stream');
  fs.readFile(filename,(err,data)=>{if(err){res.statusCode=404;res.end('missing')}else res.end(data)});
 });await new Promise(r=>server.listen(8765,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 try {

 const page=await browser.newPage({viewport:{width:1360,height:900}});const errors=[];page.on('pageerror',err=>errors.push(err.message));
 await page.goto('http://127.0.0.1:8765/tests/runtime.html');await page.waitForFunction(()=>window.testReady);
 await page.evaluate(async()=>{
  await book.close({animate:false,sound:false});game.user=fixtures.gm;await game.settings.set('mk-journal-book','flipDuration',0);
  const data={name:'The Coast Chronicle',flags:{core:{sheetClass:'mk-journal-book.MKJournalBookSheet'},'mk-journal-book':{book:true,pages:fixtures.journal.pages.slice(0,3).map(p=>p.uuid),tagVersion:1,notes:{}}},ownership:{default:2,alice:3}};
  window.atlas=await CONFIG.JournalEntry.documentClass.create(data);window.other=await CONFIG.JournalEntry.documentClass.create({...data,name:'Other book'});
  window.book=await game.modules.get('mk-journal-book').api.open({bookUUID:atlas.uuid});
 });

 const paper=()=>page.locator('.mkjb-right .mkjb-page-note');
 const handle=()=>page.locator('.mkjb-right [data-mkjb-note-move]');
 const note=()=>page.evaluate(()=>book.pages[0].note);
 const settle=async()=>{await page.waitForFunction(()=>!book._notePending);await page.waitForTimeout(120)};
 const api=async options=>{await page.evaluate(async options=>{const current=book.pages[0].note;await game.modules.get('mk-journal-book').api.setNote(fixtures.harbor.uuid,current?.text??'Ask Mara about the silver key.',atlas.uuid,options)},options);await settle()};
 const drag=async(dx,dy,release=true)=>{const rect=await handle().boundingBox();await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await page.mouse.down();await page.mouse.move(rect.x+rect.width/2+dx,rect.y+rect.height/2+dy,{steps:8});if(release){await page.mouse.up();await settle()}};
 const withinPage=async()=>assert.equal(await paper().evaluate(el=>{const p=el.getBoundingClientRect(),b=el.closest('.mkjb-note-area').getBoundingClientRect();return p.left>=b.left-1&&p.top>=b.top-1&&p.right<=b.right+1&&p.bottom<=b.bottom+1}),true);
 await api({style:'parchment',title:'Mara’s clue'});
 assert.equal((await note()).position,null);
 const bookBefore=await page.evaluate(()=>({...book.position}));
 await drag(-120,110);
 const placed=await note();assert.ok(placed.position&&placed.position.x<.9&&placed.position.y>.1);assert.equal(placed.title,'Mara’s clue');await withinPage();
 assert.deepEqual(await page.evaluate(()=>({...book.position})),bookBefore);
 assert.equal(await page.evaluate(()=>other.sheet.pages[0].note),null);
 // The note stays on the paper while the journal text scrolls underneath it.
 const beforeScroll=await paper().boundingBox();await page.locator('.mkjb-right .mkjb-content').evaluate(el=>el.scrollTop=100);const afterScroll=await paper().boundingBox();assert.ok(Math.abs(afterScroll.y-beforeScroll.y)<1);
 // Editable tilt and title persist without resetting a dragged position.
 await page.locator('.mkjb-right .mkjb-note-toggle').click();await page.locator('dialog [name="noteRotation"]').fill('14');await page.locator('dialog [name="noteTitle"]').fill('Follow the lanterns');await page.locator('dialog button[type="submit"]').click();await settle();
 assert.equal((await note()).rotation,14);assert.deepEqual((await note()).position,placed.position);assert.equal(await page.locator('.mkjb-note-title').textContent(),'Follow the lanterns');
 assert.ok((await paper().getAttribute('style')).includes('rotate(14deg)'));await withinPage();
 for(const preset of ['classic','gothic','field','arcane','nautical'])for(const style of ['parchment','sticky','torn']){
  await page.evaluate(preset=>atlas.setFlag('mk-journal-book','style',preset),preset);await api({style});await withinPage();assert.equal((await note()).rotation,14);
 }
 if(process.env.MKJB_PREVIEW_DIR)await page.screenshot({path:path.join(process.env.MKJB_PREVIEW_DIR,'book-v0130-note-moved.png')});
 await page.evaluate(async()=>{await book.close({animate:false});await book.render({force:true})});await settle();assert.deepEqual((await note()).position,placed.position);assert.equal((await note()).rotation,14);
 // Keyboard movement keeps focus after the document refresh; Shift makes a finer step.
 await handle().focus();const keyboardStart=(await note()).position;
 await page.keyboard.press('ArrowLeft');await settle();assert.equal((await note()).position.x,Math.max(0,keyboardStart.x-.05));assert.equal(await handle().evaluate(el=>el===document.activeElement),true);
 await page.keyboard.press('Shift+ArrowDown');await settle();assert.equal((await note()).position.y,Math.min(1,keyboardStart.y+.01));
 // Clamp every corner and adapt to a compact window without changing stored coordinates.
 await drag(-1500,-1500);await withinPage();assert.deepEqual((await note()).position,{x:0,y:0});assert.equal((await note()).positionSpace,'page');assert.equal(await paper().evaluate(el=>el.getBoundingClientRect().top<el.closest('[data-mkjb-leaf]').querySelector('.mkjb-page-title').getBoundingClientRect().top),true);
 await drag(1500,1500);await withinPage();assert.deepEqual((await note()).position,{x:1,y:1});assert.equal(await paper().evaluate(el=>el.getBoundingClientRect().bottom>el.closest('[data-mkjb-leaf]').querySelector('.mkjb-content').getBoundingClientRect().bottom),true);
 await page.setViewportSize({width:800,height:600});await page.evaluate(()=>book.setPosition({left:15,top:15,width:770,height:540}));await page.waitForTimeout(100);await withinPage();assert.deepEqual((await note()).position,{x:1,y:1});
 if(process.env.MKJB_PREVIEW_DIR)await page.screenshot({path:path.join(process.env.MKJB_PREVIEW_DIR,'book-v0130-note-compact.png')});
 await page.setViewportSize({width:1360,height:900});await page.evaluate(()=>book.setPosition({left:120,top:60,width:1120,height:780}));await settle();
 // Cancelled gestures never save. Reset returns automatic placement within the reading area.
 const beforeCancel=await note();await drag(-100,-60,false);await page.keyboard.press('Escape');await page.mouse.up();await settle();assert.deepEqual(await note(),beforeCancel);await withinPage();
 await page.locator('.mkjb-right .mkjb-note-toggle').click();await page.locator('dialog [name="resetNoteLayout"]').check();await page.locator('dialog button[type="submit"]').click();await settle();
 assert.equal((await note()).position,null);assert.equal((await note()).rotation,null);assert.equal(await page.locator('.mkjb-note-area > .mkjb-page-note').count(),1);
 await drag(-100,60,false);await page.keyboard.press('Escape');await page.mouse.up();await settle();assert.equal((await note()).position,null);assert.equal(await page.locator('.mkjb-note-area > .mkjb-page-note').count(),1);
 // A cancelled pointer and a concurrent edit cannot accidentally save the dragged draft.
 const clean=await note();await drag(-100,70,false);await handle().dispatchEvent('pointercancel',{pointerId:1});await page.mouse.up();await settle();assert.deepEqual(await note(),clean);
 await drag(-100,70,false);await page.evaluate(()=>game.modules.get('mk-journal-book').api.setNote(fixtures.harbor.uuid,'A newer clue',atlas.uuid));await page.mouse.up();await settle();assert.equal((await note()).text,'A newer clue');assert.equal((await note()).position,null);
 // Tilting an unmoved note also keeps all of the rotated paper within its page.
 await api({rotation:-20});await withinPage();assert.equal(await page.locator('.mkjb-note-positioned').count(),1);
 await api({position:{x:.3,y:.6},rotation:12});
 await page.evaluate(()=>game.modules.get('mk-journal-book').api.setNote(fixtures.harbor.uuid,'Text-only update',atlas.uuid));await settle();assert.deepEqual((await note()).position,{x:.3,y:.6});assert.equal((await note()).rotation,12);
 // Page-flip snapshots retain the applied layout and angle.
 await page.evaluate(()=>game.settings.set('mk-journal-book','flipDuration',900));await page.locator('[data-mkjb-action="next"]').click();await page.waitForSelector('.mkjb-turn-layer');assert.ok((await page.locator('.mkjb-turn-layer .mkjb-note-positioned').getAttribute('style')).includes('rotate(12deg)'));await page.waitForFunction(()=>!book._turnPending);
 await page.evaluate(()=>game.settings.set('mk-journal-book','flipDuration',0));await page.locator('[data-mkjb-action="index"]').click();await settle();
 // Player owners can move notes; losing ownership mid-gesture cancels the write.
 await page.evaluate(()=>{game.user=fixtures.alice;Hooks.call('updateUser')});await settle();await drag(-30,-20);const ownerNote=await note();assert.equal(ownerNote.authorId,'alice');
 await drag(70,50,false);await page.evaluate(()=>{atlas.ownership.alice=2;Hooks.call('updateJournalEntry',atlas)});await page.mouse.up();await settle();assert.deepEqual(await note(),ownerNote);assert.equal(await page.locator('[data-mkjb-note-move]').count(),0);await withinPage();
 assert.equal(await page.evaluate(async()=>{try{await game.modules.get('mk-journal-book').api.setNote(fixtures.harbor.uuid,'Denied',atlas.uuid,{position:{x:0,y:0}});return false}catch{return true}}),true);
 // Closing a book during a gesture discards that gesture and releases capture/listeners.
 await page.evaluate(()=>{game.user=fixtures.gm;Hooks.call('updateUser')});await settle();const beforeClose=await note();await drag(60,40,false);await page.evaluate(()=>book.close({animate:false,sound:false}));await page.mouse.up();await page.evaluate(()=>book.render({force:true}));await settle();assert.deepEqual(await note(),beforeClose);await withinPage();
 assert.deepEqual(errors,[]);console.log('PASS: drag, tilt, keyboard movement, resize bounds, scroll anchoring, all note/book styles, title preservation, reopen, reset, Escape/pointer cancellation, concurrent changes, snapshots, permissions and close cleanup.');
 } finally {await browser.close();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1});
