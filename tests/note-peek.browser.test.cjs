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


 const paper=()=>page.locator('.mkjb-right .mkjb-page-note'),sheet=()=>page.locator('.mkjb-right .mkjb-note-sheet'),text=()=>page.locator('.mkjb-right .mkjb-note-text');
 const settle=async()=>{await page.waitForFunction(()=>!book._notePending);await page.waitForTimeout(150)};
 await page.evaluate(()=>game.modules.get('mk-journal-book').api.setNote(fixtures.harbor.uuid,'Ask Mara about the silver key.\nMeet by the watchtower at dusk.',atlas.uuid,{title:'A clue',rotation:0}));await settle();
 const original=await page.evaluate(()=>JSON.stringify(book.pages[0].note));
 const contentBefore=await page.locator('.mkjb-content p').first().boundingBox();
 const point=async()=>{const b=await text().boundingBox();return {x:b.x+b.width/2,y:b.y+b.height*.6}};
 const hoverText=async()=>{const p=await point();await page.mouse.move(p.x,p.y)};
 const origin=await point(),full=await sheet().boundingBox();
 await page.mouse.move(origin.x,origin.y);await page.waitForTimeout(320);
 assert.equal(await paper().evaluate(el=>el.classList.contains('mkjb-note-peeking')),true);
 const middle=await sheet().boundingBox();assert.ok(middle.height>full.height*.2,'fold must animate slowly');
 if(process.env.MKJB_PREVIEW_DIR)await page.screenshot({path:path.join(process.env.MKJB_PREVIEW_DIR,'book-v0130-note-folding.png')});
 await page.waitForTimeout(1000);const folded=await sheet().boundingBox();assert.ok(folded.height<full.height*.2);assert.ok(middle.height>folded.height);
 // The original hit footprint keeps the note folded, with no hover/unhover loop.
 await page.mouse.move(origin.x+3,origin.y+3);await page.waitForTimeout(1500);assert.equal(await paper().evaluate(el=>el.classList.contains('mkjb-note-peeking')),true);
 assert.equal(await page.evaluate(({x,y})=>!!document.elementFromPoint(x,y)?.closest('.mkjb-page-note'),origin),false);
 await page.evaluate(()=>{window.peekClick=null;document.addEventListener('click',event=>{window.peekClick=!!event.target.closest('.mkjb-page-note')},{once:true})});await page.mouse.click(origin.x,origin.y);assert.equal(await page.evaluate(()=>window.peekClick),false);
 assert.deepEqual(await page.locator('.mkjb-content p').first().boundingBox(),contentBefore);
 assert.equal(await page.evaluate(()=>JSON.stringify(book.pages[0].note)),original);
 if(process.env.MKJB_PREVIEW_DIR)await page.screenshot({path:path.join(process.env.MKJB_PREVIEW_DIR,'book-v0130-note-folded.png')});
 await page.mouse.move(10,10);await page.waitForTimeout(1300);assert.equal(await paper().evaluate(el=>el.classList.contains('mkjb-note-peeking')),false);assert.ok(Math.abs((await sheet().boundingBox()).height-full.height)<1);
 // Hovering controls does not fold the note; they also restore a folded note.
 const controls=await page.locator('.mkjb-note-controls').boundingBox();await hoverText();await page.waitForTimeout(1300);await page.mouse.move(controls.x+controls.width/2,controls.y+controls.height/2);await page.waitForTimeout(1300);assert.equal(await paper().evaluate(el=>el.classList.contains('mkjb-note-peeking')),false);
 await page.locator('.mkjb-note-edit').click();assert.equal(await page.locator('dialog').count(),1);await page.locator('dialog [data-cancel]').click();await page.mouse.move(10,10);
 // Keyboard access and reduced motion reveal the same underlying page.
 await text().focus();await page.keyboard.press('Space');await page.waitForTimeout(1300);assert.equal(await paper().evaluate(el=>el.classList.contains('mkjb-note-peeking')),true);await page.keyboard.press('Escape');await page.waitForTimeout(1300);assert.equal(await paper().evaluate(el=>el.classList.contains('mkjb-note-peeking')),false);
 await page.emulateMedia({reducedMotion:'reduce'});await hoverText();await page.waitForTimeout(100);assert.equal(await sheet().evaluate(el=>getComputedStyle(el).transitionDuration),'0s');assert.equal(await paper().evaluate(el=>el.classList.contains('mkjb-note-peeking')),true);await page.mouse.move(10,10);await page.emulateMedia({reducedMotion:'no-preference'});
 for(const style of ['parchment','sticky','torn']){
  await page.evaluate(style=>game.modules.get('mk-journal-book').api.setNote(fixtures.harbor.uuid,'A folded reminder.',atlas.uuid,{style}),style);await settle();await hoverText();await page.waitForTimeout(1300);assert.equal(await paper().evaluate(el=>el.classList.contains('mkjb-note-peeking')),true);await page.mouse.move(10,10);await page.waitForTimeout(1300);
 }
 // Navigation snapshots and closing never keep a transient hover fold.
 await hoverText();await page.waitForTimeout(1300);await page.evaluate(async()=>{await game.settings.set('mk-journal-book','flipDuration',900);void book.turnPage('next')});await page.waitForSelector('.mkjb-turn-layer');assert.equal(await page.locator('.mkjb-turn-layer .mkjb-note-peeking').count(),0);await page.waitForFunction(()=>!book._turnPending);
 await page.mouse.move(10,10);await page.evaluate(async()=>{await game.settings.set('mk-journal-book','flipDuration',0);await book.handleAction('index')});await settle();await hoverText();await page.waitForTimeout(1300);await page.evaluate(()=>book.close({animate:false,sound:false}));await page.mouse.move(10,10);await page.evaluate(()=>book.render({force:true}));await settle();assert.equal(await paper().evaluate(el=>el.classList.contains('mkjb-note-peeking')),false);
 // Readers can peek, and doing so never requires ownership or writes metadata.
 await page.evaluate(()=>{game.user=fixtures.bob;Hooks.call('updateUser')});await settle();assert.equal(await page.locator('[data-mkjb-note-move]').count(),0);const readerNote=await page.evaluate(()=>JSON.stringify(book.pages[0].note));await hoverText();await page.waitForTimeout(1300);assert.equal(await paper().evaluate(el=>el.classList.contains('mkjb-note-peeking')),true);assert.equal(await page.evaluate(()=>JSON.stringify(book.pages[0].note)),readerNote);
 // Refresh/revocation clears the visual fold and detaches its pointer handlers.
 await page.mouse.move(10,10);await page.evaluate(()=>book.refresh());await settle();assert.equal(await paper().evaluate(el=>el.classList.contains('mkjb-note-peeking')),false);
 await hoverText();await page.waitForTimeout(1300);await page.evaluate(()=>{fixtures.harbor.permissions.bob=0;Hooks.call('updateJournalEntryPage')});assert.equal(await page.locator('.mkjb-note-peeking').count(),0);await settle();assert.equal(await paper().count(),0);
 // Older coordinates remain anchored to the content area until moved, without rewriting flags.
 await page.evaluate(async()=>{game.user=fixtures.gm;await game.modules.get('mk-journal-book').api.setNote(fixtures.harbor.uuid,'Legacy position',atlas.uuid,{position:{x:.4,y:.6},positionSpace:'content',rotation:8})});await settle();
 assert.equal(await paper().evaluate(el=>{const p=el.getBoundingClientRect(),b=el.closest('[data-mkjb-leaf]').querySelector('.mkjb-page-body').getBoundingClientRect();return p.left>=b.left-1&&p.right<=b.right+1&&p.top>=b.top-1&&p.bottom<=b.bottom+1}),true);
 assert.equal(await page.evaluate(()=>book.pages[0].note.positionSpace),'content');
 assert.deepEqual(errors,[]);console.log('PASS: slow hover folding, stable hit footprint, click-through text, unchanged layout/metadata, control access, keyboard reveal, reduced motion, all three styles, reader access, cleanup and legacy coordinate preservation.');
 } finally {await browser.close();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1});
