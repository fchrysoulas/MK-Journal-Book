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
  const data={name:'The Coast Chronicle',flags:{core:{sheetClass:'mk-journal-book.MKJournalBookSheet'},'mk-journal-book':{book:true,pages:fixtures.journal.pages.slice(0,6).map(p=>p.uuid),tagVersion:1,notes:{}}},ownership:{default:2,alice:3}};
  window.atlas=await CONFIG.JournalEntry.documentClass.create(data);window.other=await CONFIG.JournalEntry.documentClass.create({...data,name:'Other book'});
  window.book=await game.modules.get('mk-journal-book').api.open({bookUUID:atlas.uuid});
 });
 const settle=async()=>{await page.waitForTimeout(130);await page.waitForFunction(()=>!book._opening&&!book._turnPending)};
 await page.evaluate(async()=>{
  await game.modules.get('mk-journal-book').api.setNote(fixtures.harbor.uuid,'A note carried by the turning paper.',atlas.uuid,{title:'Clue',position:{x:.7,y:.45},rotation:12});
  window.noteId=await game.modules.get('mk-journal-book').api.addNote(fixtures.harbor.uuid,'Second note',atlas.uuid,{style:'sticky',size:{width:240,height:130},position:{x:.3,y:.65},rotation:-8});
  await book.render({force:true});
 });await settle();
 // Foundry can paint during post-render work. Never reveal the destination spread early.
 const bounds=await page.locator('.mkjb-book').boundingBox();
 const clip={x:bounds.x+60,y:bounds.y+90,width:bounds.width/2-110,height:bounds.height-180};
 const before=await page.screenshot({clip});
 await page.evaluate(async()=>{await game.settings.set('mk-journal-book','flipDuration',1200);window.mkTestPostRenderDelay=700;window.pendingTurn=book.turnPage('next')});
 await page.waitForFunction(()=>document.querySelector('.mkjb-book > .mkjb-left')?.dataset.mkjbLeaf===fixtures.journal.pages[1].uuid);
 const pending=await page.screenshot({clip});
 assert.ok(before.equals(pending),'Outgoing spread must stay visible during asynchronous post-render work');
 if(process.env.MKJB_PREVIEW_DIR)await page.screenshot({path:path.join(process.env.MKJB_PREVIEW_DIR,'flip-v0141-preparing.png')});
 await page.waitForSelector('.mkjb-turn-layer');
 assert.equal(await page.locator('.mkjb-turn-preparation').count(),0);
 await page.evaluate(()=>{window.flip=document.querySelector('.mkjb-turn-sheet').getAnimations()[0];flip.pause();flip.currentTime=0});
 assert.equal(await page.evaluate(()=>flip.effect.getTiming().duration),1200);
 const transforms=[];
 for(const time of [120,420,760,1100]){
  await page.evaluate(time=>{flip.currentTime=time},time);await page.waitForTimeout(40);
  transforms.push(await page.locator('.mkjb-turn-sheet').evaluate(el=>getComputedStyle(el).transform));
  assert.equal(await page.evaluate(()=>book._turnPending),true);
  if(process.env.MKJB_PREVIEW_DIR)await page.screenshot({path:path.join(process.env.MKJB_PREVIEW_DIR,`flip-v0141-${time}.png`)});
 }
 assert.equal(new Set(transforms).size,4,'The page must move through distinct intermediate positions');
 await page.evaluate(()=>flip.finish());await page.evaluate(()=>pendingTurn);
 assert.equal(await page.locator('.mkjb-turn-layer,.mkjb-turn-preparation,.mkjb-preparing-turn').count(),0);
 // Reading-state writes cannot truncate slow animations, even with expanded Foundry updates.
 await page.evaluate(()=>{
  window.mkTestPostRenderDelay=0;if(game.user.flags['mk-journal-book']?.reading)delete game.user.flags['mk-journal-book'].reading[atlas.id];window.savedSetFlag=game.user.setFlag;window.readingWrites=0;
  game.user.setFlag=async(scope,key,value)=>{if(key.startsWith('reading.'))readingWrites++;const result=await savedSetFlag(scope,key,value);Hooks.call('updateUser',game.user,{_id:game.user.id,_stats:{modifiedTime:Date.now()},flags:{[scope]:{reading:{[atlas.id]:value}}}});return result};
  window.pendingTurn=book.turnPage('previous');
 });
 await page.waitForSelector('.mkjb-turn-backward');await page.waitForTimeout(650);
 assert.equal(await page.evaluate(()=>readingWrites),0,'Save reading position only after the visual turn finishes');
 assert.equal(await page.evaluate(()=>book._turnPending),true);assert.equal(await page.locator('.mkjb-turn-layer').count(),1);
 const token=await page.evaluate(()=>book._turnToken);
 await page.evaluate(()=>Hooks.call('updateUser',game.user,{_id:game.user.id,_stats:{modifiedTime:Date.now()},flags:{'mk-journal-book':{reading:{[atlas.id]:{uuid:'mk-journal-book-index',tab:'all'}}}}}));
 assert.equal(await page.evaluate(()=>book._turnToken),token,'Expanded reading-only hooks must not cancel a turn');
 await page.evaluate(()=>pendingTurn);await page.waitForTimeout(480);assert.equal(await page.evaluate(()=>readingWrites),1);
 await page.evaluate(()=>{game.user.setFlag=savedSetFlag});
 // Both directions and all book presets retain the configured visual duration.
 for(const preset of ['classic','gothic','field','arcane','nautical']){
  await page.evaluate(async preset=>{await atlas.setFlag('mk-journal-book','style',preset);await game.settings.set('mk-journal-book','flipDuration',800)},preset);await settle();
  for(const direction of ['next','previous']){
   await page.evaluate(direction=>{window.pendingTurn=book.turnPage(direction)},direction);await page.waitForSelector('.mkjb-turn-layer');
   await page.evaluate(()=>{window.flip=document.querySelector('.mkjb-turn-sheet').getAnimations()[0];flip.pause();flip.currentTime=400});
   assert.equal(await page.evaluate(()=>flip.effect.getTiming().duration),800);
   assert.notEqual(await page.locator('.mkjb-turn-sheet').evaluate(el=>getComputedStyle(el).transform),'none');
   assert.equal(await page.locator('.mkjb-turn-sheet').evaluate(el=>getComputedStyle(el).transformStyle),'preserve-3d');
   await page.evaluate(()=>flip.finish());await page.evaluate(()=>pendingTurn);
  }
 }
 // Permission updates clear held snapshots immediately, including during slow renders.
 await page.evaluate(()=>{game.user=fixtures.bob;Hooks.call('updateUser')});await settle();
 await page.evaluate(()=>{window.mkTestPostRenderDelay=600;window.pendingTurn=book.turnPage('next')});await page.waitForSelector('.mkjb-turn-preparation');
 await page.evaluate(()=>{fixtures.harbor.permissions.bob=0;Hooks.call('updateJournalEntryPage')});
 assert.equal(await page.locator('.mkjb-turn-preparation,.mkjb-turn-layer').count(),0);
 await page.evaluate(()=>pendingTurn);await page.waitForTimeout(700);
 assert.ok(!(await page.locator('.mkjb-shell').textContent()).includes('A note carried'));
 // An animation failure falls back cleanly; instant/reduced-motion settings remain instant.
 await page.evaluate(async()=>{game.user=fixtures.gm;window.mkTestPostRenderDelay=0;await book.handleAction('index')});await settle();
 await page.evaluate(async()=>{const native=Element.prototype.animate;Element.prototype.animate=function(...args){if(this.classList.contains('mkjb-turn-sheet'))throw new Error('Animation unavailable');return native.apply(this,args)};try{await book.turnPage('next')}finally{Element.prototype.animate=native}});
 assert.equal(await page.locator('.mkjb-turn-layer,.mkjb-turn-preparation,.mkjb-preparing-turn').count(),0);assert.equal(await page.evaluate(()=>book._turnPending),false);
 await page.evaluate(async()=>{await game.settings.set('mk-journal-book','flipDuration',0);await book.turnPage('previous')});await settle();assert.equal(await page.locator('.mkjb-turn-preparation,.mkjb-turn-layer').count(),0);
 await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(async()=>{await game.settings.set('mk-journal-book','flipDuration',1200);await book.turnPage('next')});await settle();assert.equal(await page.locator('.mkjb-turn-preparation,.mkjb-turn-layer').count(),0);
 assert.deepEqual(errors,[]);
 console.log('PASS: outgoing-spread continuity across delayed renders, progressive frames, deferred reading saves, expanded hook metadata, forward/backward timing across five styles, private snapshot cleanup, failure cleanup and instant/reduced-motion behavior.');
 } finally {await browser.close();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1});
