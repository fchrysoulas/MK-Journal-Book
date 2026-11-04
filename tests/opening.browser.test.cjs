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
 const page=await browser.newPage({viewport:{width:1360,height:900}});
 const errors=[];page.on('pageerror',err=>errors.push(err.message));
 await page.goto('http://127.0.0.1:8765/tests/runtime.html');await page.waitForFunction(()=>window.testReady);
 await page.evaluate(async()=>{game.user=fixtures.gm;await game.modules.get('mk-journal-book').api.addJournal('JournalEntry.J');await game.settings.set('mk-journal-book','flipDuration',600);await book.render({force:true})});
 async function pauseOpen(time){await page.evaluate(time=>{window.openAnimations=document.querySelector('.mkjb-open-layer').getAnimations({subtree:true});for(const animation of openAnimations){animation.pause();animation.currentTime=time}},time);await page.waitForTimeout(30)}
 async function startOpen(){await page.evaluate(()=>{window.openingDone=false;window.pendingOpening=book.render({force:true}).then(()=>window.openingDone=true)});await page.waitForSelector('.mkjb-open-layer',{state:'attached'})}
 async function finishOpen(){await page.evaluate(()=>openAnimations.forEach(animation=>animation.finish()));await page.waitForFunction(()=>openingDone&&!book._opening);await page.waitForSelector('.mkjb-journal-index')}
 const initialPosition=await page.locator('.mk-journal-book').boundingBox();
 for(const preset of ['classic','gothic','field','arcane','nautical']){
  await page.evaluate(async preset=>{await book.close({animate:false});await game.settings.set('mk-journal-book','bookStyle',preset);await game.settings.set('mk-journal-book','bookTitle',"The Captain's <Chronicle>")},preset);
  await startOpen();await pauseOpen(260);
  assert.equal(await page.evaluate(()=>book.element.inert&&book._opening&&!openingDone),true);
  assert.equal(await page.locator('.mkjb-tabs').evaluate(el=>getComputedStyle(el).visibility),'hidden');
  assert.equal(await page.locator('.mkjb-book > .mkjb-left').evaluate(el=>getComputedStyle(el).visibility),'hidden');
  assert.equal(await page.locator('.mkjb-open-layer').evaluate(el=>getComputedStyle(el).opacity),'1');
  assert.equal(await page.locator('.mkjb-close-sheet').evaluate(el=>el.getAnimations()[0].effect.getTiming().delay),400);
  assert.equal(await page.locator('.mkjb-close-sheet').evaluate(el=>el.getAnimations()[0].effect.getTiming().duration),600);
  assert.ok((await page.locator('.mkjb-close-cover').evaluate(el=>getComputedStyle(el).backgroundImage)).includes(preset+'-cover.svg'));
  assert.equal(await page.locator('.mkjb-cover-title').textContent(),"The Captain's <Chronicle>");
  assert.equal(await page.locator('.mkjb-cover-title chronicle').count(),0);
  assert.equal(await page.locator('.mkjb-open-layer').evaluate(el=>el.inert&&el.getAttribute('aria-hidden')==='true'),true);
  assert.equal(await page.locator('.mkjb-open-layer [id],.mkjb-open-layer iframe,.mkjb-open-layer video').count(),0);
  if(process.env.MKJB_PREVIEW_DIR)await page.screenshot({path:path.join(process.env.MKJB_PREVIEW_DIR,`book-v070-opening-${preset}.png`)});
  await page.evaluate(()=>{window.currentOpening=book._openAnimation;window.currentSelection=book.selectedUUID;void book.render({force:true});void book.handleAction('next')});
  assert.equal(await page.evaluate(()=>book._openAnimation===currentOpening&&book.selectedUUID===currentSelection),true);assert.equal(await page.locator('.mkjb-open-layer').count(),1);
  await pauseOpen(650);
  if(process.env.MKJB_PREVIEW_DIR&&preset==='classic')await page.screenshot({path:path.join(process.env.MKJB_PREVIEW_DIR,'book-v070-opening-unfold.png')});
  await finishOpen();
  assert.equal(await page.locator('.mkjb-open-layer').count(),0);assert.equal(await page.evaluate(()=>book.element.inert),false);
  assert.equal(await page.locator('.mkjb-tabs').evaluate(el=>getComputedStyle(el).visibility),'visible');
  assert.deepEqual(await page.locator('.mk-journal-book').boundingBox(),initialPosition);
  const token=await page.evaluate(()=>book._openToken);
  await page.locator('[data-mkjb-action="next"]').click();await page.waitForFunction(()=>!book._turnPending);assert.equal(await page.locator('.mkjb-journal-index').count(),0);
  await page.locator('[data-mkjb-action="index"]').click();await page.waitForSelector('.mkjb-journal-index');
  await page.evaluate(()=>book.render({force:true}));assert.equal(await page.evaluate(()=>book._openToken),token);assert.equal(await page.locator('.mkjb-open-layer').count(),0);
 }
 // Closing an opening book cancels it immediately and cannot leave an invisible window.
 await page.evaluate(()=>book.close({animate:false}));await startOpen();await pauseOpen(520);
 await page.evaluate(()=>book.close({closeKey:true}));await page.evaluate(()=>pendingOpening);
 assert.equal(await page.locator('.mk-journal-book,.mkjb-open-layer,.mkjb-close-layer').count(),0);
 // Source changes clear snapshots synchronously, then refresh live content without replaying.
 await startOpen();await pauseOpen(260);
 assert.equal(await page.evaluate(()=>{Hooks.call('updateJournalEntryPage');return !document.querySelector('.mkjb-open-layer')&&!document.querySelector('.mkjb-content')}),true);
 await page.waitForSelector('.mkjb-journal-index');assert.equal(await page.evaluate(()=>book._opening||book.element.inert),false);
 // Native journal sheets use the same sequence, including compact windows and denied access.
 await page.evaluate(async()=>{
  await book.close({animate:false});
  window.ownedBook=await CONFIG.JournalEntry.documentClass.create({name:'An Owned Chronicle',flags:{core:{sheetClass:'mk-journal-book.MKJournalBookSheet'},'mk-journal-book':{book:true,pages:[fixtures.harbor.uuid],style:'gothic',tagVersion:1,tags:{}}},ownership:{default:0,alice:3}});
  game.user=fixtures.alice;window.book=ownedBook.sheet;
 });
 await page.setViewportSize({width:800,height:600});await startOpen();await pauseOpen(260);
 assert.equal(await page.locator('.mkjb-cover-title').textContent(),'An Owned Chronicle');
 assert.ok(!(await page.locator('.mkjb-open-layer').textContent()).includes('SECRET_MARKER'));
 if(process.env.MKJB_PREVIEW_DIR)await page.screenshot({path:path.join(process.env.MKJB_PREVIEW_DIR,'book-v070-opening-compact.png')});
 assert.equal(await page.evaluate(()=>{ownedBook.ownership.alice=0;Hooks.call('updateJournalEntry',ownedBook);return !document.querySelector('.mkjb-open-layer')}),true);
 await page.waitForFunction(()=>!book.rendered&&!book._opening);await page.evaluate(()=>pendingOpening);assert.equal(await page.locator('.mk-journal-book').count(),0);
 await page.evaluate(()=>{game.user=fixtures.gm});
 // Reduced motion, duration zero and explicit animate:false bypass opening entirely.
 await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>book.render({force:true}));assert.equal(await page.locator('.mkjb-open-layer').count(),0);assert.equal(await page.evaluate(()=>book.element.inert),false);
 await page.evaluate(()=>book.close({animate:false}));await page.emulateMedia({reducedMotion:'no-preference'});
 await page.evaluate(async()=>{await game.settings.set('mk-journal-book','flipDuration',0);await book.render({force:true})});assert.equal(await page.locator('.mkjb-open-layer').count(),0);
 await page.evaluate(async()=>{await book.close({animate:false});await game.settings.set('mk-journal-book','flipDuration',600);await book.render({force:true,animate:false})});assert.equal(await page.locator('.mkjb-open-layer').count(),0);
 // A failed animation falls back to the readable book, with controls restored.
 await page.evaluate(async()=>{await book.close({animate:false});window.nativeAnimate=Element.prototype.animate;Element.prototype.animate=()=>{throw new Error('Animation unavailable')};try{await book.render({force:true})}finally{Element.prototype.animate=nativeAnimate}});
 assert.equal(await page.locator('.mkjb-journal-index').isVisible(),true);assert.equal(await page.evaluate(()=>book.element.inert||book._opening),false);
 // Closing during cover decoding cannot start an animation after the window is gone.
 await page.evaluate(async()=>{await book.close({animate:false});window.nativeDecode=HTMLImageElement.prototype.decode;HTMLImageElement.prototype.decode=()=>new Promise(()=>{});window.pendingDecodeOpen=book.render({force:true})});
 await page.waitForSelector('.mkjb-opening-pending',{state:'attached'});
 assert.equal(await page.locator('.mkjb-journal-index').isVisible(),false);
 await page.evaluate(async()=>{await book.close({animate:false});await pendingDecodeOpen;HTMLImageElement.prototype.decode=nativeDecode});assert.equal(await page.locator('.mk-journal-book,.mkjb-open-layer').count(),0);
 assert.deepEqual(errors,[]);
 console.log('PASS: opening fade/hold/unfold, all presets, native sheets, compact layout, escaped cover title, geometry, repeat-render guard, navigation/refresh without replay, interruption, source/book permissions, instant/reduced motion, failure recovery and pending-decode cancellation.');
 } finally {await browser.close();server.close()}
})().catch(err=>{console.error(err);process.exit(1)});
