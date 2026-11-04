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
 const noteKey='JournalEntry~J~JournalEntryPage~01';
 const text='Ask Mara about the silver key.\nMeet by the watchtower after dusk.';
 async function editNote(value,selector='.mkjb-right .mkjb-note-toggle'){
  await page.locator(selector).click();await page.locator('dialog [name="pageNote"]').fill(value);await page.locator('dialog button[type="submit"]').click();await page.waitForFunction(()=>!book._notePending);await page.waitForTimeout(100);
 }
 await editNote(text);assert.equal(await page.locator('.mkjb-note-text').textContent(),text);
 assert.equal(await page.locator('.mkjb-note-title').count(),0);assert.equal(await page.locator('.mkjb-note-meta').count(),0);
 assert.equal(await page.locator('.mkjb-note-heading.is-untitled .mkjb-note-edit').count(),1);
 const saved=await page.evaluate(key=>atlas.getFlag('mk-journal-book','notes')[key],noteKey);assert.equal(saved.text,text);assert.equal(saved.authorId,'gm');assert.ok(saved.updatedAt>0);
 const tooltip=await page.evaluate(key=>{const note=atlas.getFlag('mk-journal-book','notes')[key];return `Last edited by ${note.authorName} · ${new Date(note.updatedAt).toLocaleString()}`},noteKey);
 const noteRect=await page.locator('.mkjb-note-text').boundingBox();await page.mouse.move(noteRect.x+noteRect.width/2,noteRect.y+noteRect.height/2);assert.equal(await page.locator('.mkjb-page-note').getAttribute('title'),tooltip);assert.equal(await page.locator('.mkjb-note-text').getAttribute('aria-description'),tooltip);
 // Titles are optional, escaped, saved independently, and prefilled on reopening.
 const customTitle='Mara’s <secret> clues';
 await page.locator('.mkjb-right .mkjb-note-toggle').click();assert.equal(await page.locator('dialog [name="noteTitle"]').inputValue(),'');
 await page.locator('dialog [name="noteTitle"]').fill(customTitle);await page.locator('dialog button[type="submit"]').click();await page.waitForFunction(()=>!book._notePending);await page.waitForTimeout(100);
 assert.equal(await page.locator('.mkjb-note-title').textContent(),customTitle);assert.equal(await page.locator('.mkjb-note-title secret').count(),0);
 await editNote(text);assert.equal(await page.locator('.mkjb-note-title').textContent(),customTitle);
 assert.equal(await page.evaluate(()=>fixtures.harbor.getFlag('mk-journal-book','note')),undefined);assert.equal(await page.evaluate(()=>other.sheet.pages[0].note),null);
 // Both leaves save against their own page identity and keep other notes intact.
 await page.locator('[data-mkjb-action="next"]').click();await page.waitForTimeout(100);
 await editNote('Left page reminder.','.mkjb-left .mkjb-note-toggle');await editNote('Right page reminder.');
 assert.deepEqual(await page.locator('.mkjb-note-text').allTextContents(),['Left page reminder.','Right page reminder.']);
 await page.locator('[data-mkjb-action="index"]').click();await page.waitForTimeout(100);assert.equal(await page.locator('.mkjb-note-text').textContent(),text);
 // All presets contain the parchment with no horizontal overflow.
 for(const preset of ['classic','gothic','field','arcane','nautical']){
  await page.evaluate(preset=>atlas.setFlag('mk-journal-book','style',preset),preset);await page.waitForTimeout(100);
  assert.equal(await page.locator('.mkjb-content').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
  const backgrounds=[];
  for(const style of ['parchment','sticky','torn']){
   await page.locator('.mkjb-right .mkjb-note-toggle').click();
   assert.equal(await page.locator('dialog [name="noteStyle"] option').count(),3);
   await page.locator('dialog [name="noteStyle"]').selectOption(style);await page.locator('dialog button[type="submit"]').click();await page.waitForFunction(()=>!book._notePending);await page.waitForTimeout(100);
   assert.equal(await page.evaluate(key=>atlas.getFlag('mk-journal-book','notes')[key].style,noteKey),style);
   assert.equal(await page.locator('.mkjb-note-text').textContent(),text);
   assert.equal(await page.locator('.mkjb-note-title').textContent(),customTitle);assert.equal(await page.locator('.mkjb-note-meta').count(),0);
   backgrounds.push(await page.locator('.mkjb-note-sheet').evaluate(el=>getComputedStyle(el).backgroundImage));
   assert.equal(await page.locator('.mkjb-page-note').evaluate((el,style)=>el.classList.contains('mkjb-note-style-'+style),style),true);
   if(process.env.MKJB_PREVIEW_DIR)await page.screenshot({path:path.join(process.env.MKJB_PREVIEW_DIR,`book-v0130-note-${preset}-${style}.png`)});
  }
  assert.equal(new Set(backgrounds).size,3);
 }
 await page.evaluate(()=>book.setPosition({left:120,top:60,width:770,height:540}));assert.equal(await page.locator('.mkjb-page-note').evaluate(el=>getComputedStyle(el).float),'none');
 await page.evaluate(()=>book.setPosition({left:120,top:60,width:1120,height:780}));
 await page.evaluate(async()=>{await book.close();await book.render({force:true})});
 await page.locator('.mkjb-right .mkjb-note-toggle').click();assert.equal(await page.locator('dialog [name="noteStyle"]').inputValue(),'torn');assert.equal(await page.locator('dialog [name="noteTitle"]').inputValue(),customTitle);
 await page.locator('dialog [name="noteTitle"]').fill('');await page.locator('dialog button[type="submit"]').click();await page.waitForFunction(()=>!book._notePending);await page.waitForTimeout(100);assert.equal(await page.locator('.mkjb-note-title').count(),0);
 assert.equal(await page.evaluate(()=>book.pages[0].note.title),'');
 assert.equal(await page.evaluate(()=>book.pages[1].note.style),'parchment');
 // Editing can be cancelled; readers see notes but have no writer action.
 await page.locator('.mkjb-right .mkjb-note-toggle').click();await page.locator('dialog [name="pageNote"]').fill('Discard me');await page.locator('dialog [data-cancel]').click();assert.equal(await page.locator('.mkjb-note-text').textContent(),text);
 await page.evaluate(()=>{game.user=fixtures.bob;Hooks.call('updateUser')});await page.waitForTimeout(100);
 assert.equal(await page.locator('.mkjb-note-heading,.mkjb-note-meta').count(),0);assert.equal(await page.locator('.mkjb-note-text').textContent(),text);
 assert.equal(await page.locator('[data-mkjb-action="note"]').count(),0);await page.locator('[data-mkjb-action="view-note"]').click();assert.equal(await page.locator('.mkjb-note-text').evaluate(el=>document.activeElement===el),true);
 assert.equal(await page.evaluate(async()=>{try{await game.modules.get('mk-journal-book').api.setNote(fixtures.harbor.uuid,'Denied',atlas.uuid);return false}catch{return true}}),true);
 // Player owners can save notes without source ownership; plain text is never enriched.
 await page.evaluate(()=>{game.user=fixtures.alice;Hooks.call('updateUser')});await page.waitForTimeout(100);
 await editNote('<img src=x onerror=alert(1)>\n@UUID[JournalEntry.Secret]');
 assert.equal(await page.locator('.mkjb-page-note img,.mkjb-page-note .content-link').count(),0);assert.ok((await page.locator('.mkjb-page-note').getAttribute('title')).startsWith('Last edited by Alice · '));assert.equal(await page.locator('.mkjb-page-note').evaluate(el=>el.classList.contains('mkjb-note-style-torn')),true);
 await editNote('A'.repeat(2000));await page.setViewportSize({width:800,height:600});await page.evaluate(()=>book.setPosition({left:15,top:15,width:770,height:540}));
 assert.equal(await page.locator('.mkjb-content').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
 assert.equal(await page.locator('.mkjb-note-text').evaluate(el=>el.scrollHeight>el.clientHeight&&el.scrollWidth<=el.clientWidth),true);
 if(process.env.MKJB_PREVIEW_DIR)await page.screenshot({path:path.join(process.env.MKJB_PREVIEW_DIR,'book-v0130-note-compact.png')});
 // Saving after membership or owner access changes is rejected.
 await page.locator('.mkjb-right .mkjb-note-toggle').click();await page.locator('dialog [name="pageNote"]').fill('No permission');
 await page.evaluate(()=>{atlas.ownership.alice=2;Hooks.call('updateJournalEntry',atlas)});await page.locator('dialog button[type="submit"]').click();
 assert.equal(await page.evaluate(key=>atlas.getFlag('mk-journal-book','notes')[key].text,noteKey),'A'.repeat(2000));await page.locator('dialog [data-cancel]').click();
 await page.evaluate(()=>{game.user=fixtures.gm;Hooks.call('updateUser')});await page.waitForTimeout(100);
 await page.locator('.mkjb-right .mkjb-note-toggle').click();await page.locator('dialog [name="pageNote"]').fill('Stale draft');
 await page.evaluate(()=>game.modules.get('mk-journal-book').api.setNote(fixtures.harbor.uuid,'Newer note',atlas.uuid));await page.locator('dialog button[type="submit"]').click();
 assert.equal(await page.evaluate(key=>atlas.getFlag('mk-journal-book','notes')[key].text,noteKey),'Newer note');await page.locator('dialog [data-cancel]').click();
 // Removal hides the slip and restores Add Note. Reopening preserves other pages' notes.
 await page.waitForTimeout(100);await page.locator('.mkjb-right .mkjb-note-toggle').click();await page.locator('dialog [name="removeNote"]').check();await page.locator('dialog button[type="submit"]').click();await page.waitForTimeout(100);
 assert.equal(await page.locator('.mkjb-page-note').count(),0);assert.equal(await page.locator('.mkjb-note-toggle span').textContent(),'+ Note');
 await page.evaluate(async()=>{await book.close();await book.render({force:true});await book.turnPage('next')});await page.waitForTimeout(100);assert.equal(await page.locator('.mkjb-page-note').count(),2);
 // Flips carry note artwork as inert snapshots; note scrolling survives a refresh.
 await page.setViewportSize({width:1360,height:900});await page.evaluate(()=>book.setPosition({left:120,top:60,width:1120,height:780}));
 await page.evaluate(async()=>{await game.modules.get('mk-journal-book').api.setNote(fixtures.journal.pages[1].uuid,'Long reminder.\n'.repeat(100),atlas.uuid,{style:'sticky',title:'Watchtower leads'})});await page.waitForTimeout(100);
 await page.locator('.mkjb-left .mkjb-note-text').evaluate(el=>el.scrollTop=80);await page.evaluate(()=>book.render({force:true}));assert.equal(await page.locator('.mkjb-left .mkjb-note-text').evaluate(el=>el.scrollTop),80);
 await page.evaluate(()=>game.settings.set('mk-journal-book','flipDuration',1000));await page.locator('[data-mkjb-action="previous"]').click();await page.waitForSelector('.mkjb-turn-layer');assert.ok(await page.locator('.mkjb-turn-layer .mkjb-page-note.mkjb-note-style-sticky').count()>0);assert.ok((await page.locator('.mkjb-turn-layer .mkjb-note-title').allTextContents()).includes('Watchtower leads'));await page.waitForFunction(()=>!book._turnPending);
 // Revoked source permissions clear its note immediately; removed pages cannot be edited via API.
 await page.evaluate(async()=>{await game.modules.get('mk-journal-book').api.setNote(fixtures.harbor.uuid,'Hidden with source',atlas.uuid);game.user=fixtures.bob;Hooks.call('updateUser')});await page.waitForTimeout(100);
 assert.equal(await page.evaluate(()=>{fixtures.harbor.permissions.bob=0;Hooks.call('updateJournalEntryPage');return !document.querySelector('.mkjb-shell').textContent.includes('Hidden with source')}),true);await page.waitForTimeout(100);assert.ok(!(await page.locator('.mkjb-shell').textContent()).includes('Hidden with source'));
 await page.evaluate(async()=>{game.user=fixtures.gm;await game.modules.get('mk-journal-book').api.removePage(fixtures.harbor.uuid,atlas.uuid)});await page.waitForTimeout(100);
 assert.equal(await page.evaluate(async()=>{try{await game.modules.get('mk-journal-book').api.setNote(fixtures.harbor.uuid,'Not included',atlas.uuid);return false}catch{return true}}),true);
 // Legacy books keep their independent note on the explicitly included source page.
 await page.evaluate(async()=>{await book.close({animate:false,sound:false});await game.settings.set('mk-journal-book','flipDuration',0);await game.modules.get('mk-journal-book').api.addPage(fixtures.harbor.uuid);await fixtures.harbor.setFlag('mk-journal-book','note',{text:'Old note',authorName:'GM',updatedAt:1700000000000});window.book=await game.modules.get('mk-journal-book').api.open({legacy:true})});
 assert.equal(await page.locator('.mkjb-note-title').textContent(),'Page note');
 await page.evaluate(()=>game.modules.get('mk-journal-book').api.setNote(fixtures.harbor.uuid,'Legacy note',undefined,{style:'torn',title:'Legacy clue'}));await page.waitForTimeout(100);
 assert.equal(await page.locator('.mkjb-note-text').textContent(),'Legacy note');assert.equal(await page.locator('.mkjb-page-note').evaluate(el=>el.classList.contains('mkjb-note-style-torn')),true);
 await page.evaluate(()=>game.modules.get('mk-journal-book').api.setNote(fixtures.harbor.uuid,'Legacy edited'));await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>book.pages[0].note.style),'torn');assert.equal(await page.locator('.mkjb-note-title').textContent(),'Legacy clue');
 assert.equal(await page.evaluate(async()=>{try{await game.modules.get('mk-journal-book').api.setNote(fixtures.harbor.uuid,'Invalid',undefined,{style:'unsafe'});return false}catch{return true}}),true);assert.equal(await page.evaluate(()=>other.sheet.pages[0].note),null);
 assert.deepEqual(errors,[]);console.log('PASS: optional custom titles, hover metadata, safe title rendering, saved title and style selection, legacy defaults, three note styles across five presets, title/style flip snapshots and API preservation, page notes on both leaves, book isolation, compact and long notes, owner/reader permissions, edit cancellation/conflicts, removal, reopen, scroll preservation, permission revocation, membership checks and legacy notes.');
 } finally {await browser.close();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1});
