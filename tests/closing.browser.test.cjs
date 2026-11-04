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
 const id='mk-journal-book';
 await page.evaluate(async()=>{game.user=fixtures.gm;await game.modules.get('mk-journal-book').api.addJournal('JournalEntry.J');await game.settings.set('mk-journal-book','flipDuration',600);await book.render({force:true})});
 async function pauseClose(time){await page.evaluate(time=>{window.closeAnimations=document.querySelector('.mkjb-close-layer').getAnimations({subtree:true});for(const animation of closeAnimations){animation.pause();animation.currentTime=time}},time);await page.waitForTimeout(30)}
 async function finishClose(){await page.evaluate(()=>closeAnimations.forEach(animation=>animation.finish()));await page.waitForFunction(()=>!book.rendered&&!book._closing)}
 async function reopen(){await page.evaluate(async()=>{window.book=await game.modules.get('mk-journal-book').api.open({legacy:true})});await page.waitForSelector('.mkjb-journal-index')}
 // Each preset folds to its own front cover, holds, and is removed exactly once.
 for(const preset of ['classic','gothic','field','arcane','nautical']){
  await page.evaluate(async preset=>{await game.settings.set('mk-journal-book','bookStyle',preset);await game.settings.set('mk-journal-book','bookTitle',"A Captain's <Chronicle>");await book.render({force:true})},preset);
  await page.waitForFunction(()=>document.querySelector('.mkjb-cover-preload')?.complete&&document.querySelector('.mkjb-cover-preload')?.naturalWidth>0);
  const calls=await page.evaluate(()=>window.closeCalls?.length??0);
  await page.locator('.mkjb-book > .mkjb-right .mkjb-page-title').waitFor({state:'visible'});
  const beforeTitle=await page.locator('.mkjb-book > .mkjb-right .mkjb-page-title').boundingBox();
  assert.ok(beforeTitle, 'Original page title should be visible before closing '+preset);
  await page.locator('[data-mkjb-action="close"]').click();await page.waitForSelector('.mkjb-close-layer',{state:'attached'});
  await pauseClose(0);
  const duringTitle=await page.locator('.mkjb-close-stationary .mkjb-page-title').boundingBox();
  assert.ok(Math.abs(beforeTitle.width-duringTitle.width)<1&&Math.abs(beforeTitle.height-duringTitle.height)<1);
  await pauseClose(220);
  assert.equal(await page.evaluate(()=>book.element.inert&&book._closing),true);
  assert.equal(await page.locator('.mkjb-tabs').evaluate(el=>getComputedStyle(el).visibility),'hidden');
  assert.equal(await page.locator('.mkjb-close-layer').evaluate(el=>el.inert&&el.getAttribute('aria-hidden')==='true'),true);
  assert.equal(await page.locator('.mkjb-close-layer [id],.mkjb-close-layer iframe,.mkjb-close-layer video,.mkjb-close-layer audio').count(),0);
  assert.equal(await page.locator('.mkjb-close-sheet').evaluate(el=>el.getAnimations()[0].effect.getTiming().duration),600);
  assert.equal(await page.locator('.mkjb-close-layer').evaluate(el=>el.getAnimations()[0].effect.getTiming().duration),1000);
  await page.evaluate(()=>{window.sameClose=book._closeAnimation;void book.close({closeKey:true})});
  assert.equal(await page.evaluate(()=>book._closeAnimation===sameClose),true);
  if(process.env.MKJB_PREVIEW_DIR&&preset==='classic')await page.screenshot({path:path.join(process.env.MKJB_PREVIEW_DIR,'book-v070-closing-fold.png')});
  await pauseClose(700);
  assert.equal(await page.locator('.mkjb-cover-title').textContent(),"A Captain's <Chronicle>");
  assert.equal(await page.locator('.mkjb-cover-title chronicle').count(),0);
  assert.ok((await page.locator('.mkjb-close-cover').evaluate(el=>getComputedStyle(el).backgroundImage)).includes(preset+'-cover.svg'));
  assert.equal(await page.locator('.mkjb-close-layer').evaluate(el=>getComputedStyle(el).opacity),'1');
  if(process.env.MKJB_PREVIEW_DIR)await page.screenshot({path:path.join(process.env.MKJB_PREVIEW_DIR,`book-v070-cover-${preset}.png`)});
  await pauseClose(920);assert.ok(Number(await page.locator('.mkjb-close-layer').evaluate(el=>getComputedStyle(el).opacity))<.6);
  await finishClose();assert.equal(await page.locator('.mk-journal-book,.mkjb-close-layer').count(),0);
  assert.equal(await page.evaluate(()=>closeCalls.length),calls+1);
  assert.equal(await page.evaluate(()=>closeCalls.at(-1).options.animate),false);
  await reopen();assert.equal(await page.evaluate(()=>book.element.inert),false);
 }
 // A close interrupts page turns, while a late enrichment cannot replace its cover.
 await page.locator('[data-mkjb-action="next"]').click();await page.waitForSelector('.mkjb-turn-layer');
 await page.evaluate(()=>{window.lateRender=book._renderHTML();void book.close()});await pauseClose(220);
 assert.equal(await page.locator('.mkjb-turn-layer').count(),0);assert.equal(await page.evaluate(()=>book._turnPending),false);
 await page.evaluate(async()=>book._replaceHTML(await lateRender,book.element.querySelector('.window-content')));
 assert.equal(await page.locator('.mkjb-close-layer').count(),1);
 // Source permission/content updates synchronously discard animated copies.
 assert.equal(await page.evaluate(()=>{Hooks.call('updateJournalEntryPage');return !document.querySelector('.mkjb-close-layer')&&!document.querySelector('.mkjb-content')}),true);
 await page.waitForFunction(()=>!book._closing&&!book.rendered);await reopen();
 // Explicit API reopen waits for the close, then restores the index and controls.
 await page.evaluate(()=>{void book.close()});await pauseClose(100);
 await page.evaluate(()=>{window.reopened=false;void game.modules.get('mk-journal-book').api.open({legacy:true}).then(app=>{window.book=app;window.reopened=true})});
 assert.equal(await page.evaluate(()=>reopened),false);
 await page.evaluate(()=>closeAnimations.forEach(animation=>animation.finish()));await page.waitForFunction(()=>reopened);
 assert.equal(await page.locator('.mkjb-journal-index').count(),1);assert.equal(await page.evaluate(()=>book.element.inert),false);
 // Escape-style close follows the same animation; animate:false bypasses it.
 await page.evaluate(()=>{void book.close({closeKey:true})});await pauseClose(200);
 await page.evaluate(()=>book.close({animate:false}));assert.equal(await page.locator('.mk-journal-book').count(),0);await reopen();
 await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>book.close());
 assert.equal(await page.locator('.mkjb-close-layer,.mk-journal-book').count(),0);await page.emulateMedia({reducedMotion:'no-preference'});await reopen();
 await page.evaluate(async()=>{await game.settings.set('mk-journal-book','flipDuration',0);await book.close()});
 assert.equal(await page.locator('.mkjb-close-layer,.mk-journal-book').count(),0);await reopen();
 await page.evaluate(async()=>{await game.settings.set('mk-journal-book','flipDuration',600);window.nativeAnimate=Element.prototype.animate;Element.prototype.animate=()=>{throw new Error('Animation unavailable')};try{await book.close()}finally{Element.prototype.animate=nativeAnimate}});
 assert.equal(await page.locator('.mkjb-close-layer,.mk-journal-book').count(),0);
 // Book ownership revocation never waits for a decorative closing animation.
 await page.evaluate(async()=>{
  game.user=fixtures.gm;
  window.privateBook=await CONFIG.JournalEntry.documentClass.create({name:'Private Book',flags:{core:{sheetClass:'mk-journal-book.MKJournalBookSheet'},'mk-journal-book':{book:true,pages:[fixtures.harbor.uuid],tagVersion:1,tags:{}}},ownership:{default:0,alice:3}});
  game.user=fixtures.alice;window.book=await game.modules.get('mk-journal-book').api.open({bookUUID:privateBook.uuid});
 });
 await page.evaluate(()=>{void book.close()});await pauseClose(200);
 assert.equal(await page.evaluate(()=>{privateBook.ownership.alice=0;Hooks.call('updateJournalEntry',privateBook);return !document.querySelector('.mkjb-close-layer')}),true);
 await page.waitForFunction(()=>!book._closing&&!book.rendered);assert.equal(await page.locator('.mk-journal-book').count(),0);
 assert.deepEqual(errors,[]);
 console.log('PASS: closing fold, five front covers, title escaping, cover hold and fade, repeat-close guard, inert snapshots, turn cancellation, stale renders, privacy revocation, queued reopen, reduced motion, zero duration and animation failure cleanup.');
 } finally {await browser.close();server.close()}
})().catch(err=>{console.error(err);process.exit(1)});
