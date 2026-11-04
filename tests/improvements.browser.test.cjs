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
 const settle=async()=>{await page.waitForTimeout(130);await page.waitForFunction(()=>!book._notePending&&!book._opening&&!book._turnPending)};
 const api=async body=>page.evaluate(body);
 const searchButton='.mkjb-book-controls [data-mkjb-action="search"]';
 const search=async query=>{if(!await page.locator('[data-mkjb-search]').isVisible())await page.locator(searchButton).click();await page.locator('[data-mkjb-search]').fill(query);await page.waitForTimeout(260);await page.waitForFunction(()=>!document.querySelector('.mkjb-search-status').textContent.includes('Searching'))};
 await api(()=>{game.user=fixtures.bob;Hooks.call('updateUser')});await settle();
 await search('silver key');assert.equal(await page.locator('[data-mkjb-search-result]').count(),1);assert.ok((await page.locator('[data-mkjb-search-result]').textContent()).includes('Mara Venn'));
 await page.locator('[data-mkjb-search-result]').click();await settle();assert.equal(await page.locator('.mkjb-right .mkjb-page-title').textContent(),'Mara Venn');
 await search('SECRET_MARKER');assert.equal(await page.locator('[data-mkjb-search-result]').count(),0);
 await search('REVEALED_MARKER');assert.equal(await page.locator('[data-mkjb-search-result]').count(),1);
 await search('PRIVATE_BOB');assert.equal(await page.locator('[data-mkjb-search-result]').count(),0);
 await search('Northern Coast');assert.equal(await page.locator('[data-mkjb-search-result]').count(),6);
 // A late GM enrichment cannot leak secret search text after a user/access change.
 await api(()=>{game.user=fixtures.gm;Hooks.call('updateUser')});await settle();
 await search('SECRET_MARKER');assert.equal(await page.locator('[data-mkjb-search-result]').count(),1);
 await api(()=>{window.savedEnrich=foundry.applications.ux.TextEditor.implementation.enrichHTML;window.enrichGate=new Promise(r=>window.releaseEnrich=r);foundry.applications.ux.TextEditor.implementation.enrichHTML=async html=>{await enrichGate;return html};book.searchQuery='SECRET_MARKER';void book.searchBook();game.user=fixtures.bob;Hooks.call('updateUser');releaseEnrich();foundry.applications.ux.TextEditor.implementation.enrichHTML=savedEnrich});await settle();
 assert.ok(!(await page.locator('.mkjb-search-results').textContent()).includes('SECRET_MARKER'));
 await page.locator('[data-mkjb-search]').press('Escape');await settle();assert.equal(await page.locator('[data-mkjb-search]').isVisible(),false);
 if(process.env.MKJB_PREVIEW_DIR){await search('Northern');await page.screenshot({path:path.join(process.env.MKJB_PREVIEW_DIR,'book-v0140-search.png')});await page.locator('[data-mkjb-search]').press('Escape');await settle();}
 console.log('PASS: full-text/title search, results navigation, secret filtering and async permission changes.');
 // Per-reader, per-book position survives sheet recreation. Explicit targets override memory.
 await api(async()=>{await book.close({animate:false});game.user=fixtures.gm;await game.settings.set('mk-journal-book','alwaysStartAtIndex',false);window.book=await game.modules.get('mk-journal-book').api.open({bookUUID:atlas.uuid,pageUUID:fixtures.journal.pages[3].uuid});await book.close({animate:false});atlas._sheet=null;window.book=await game.modules.get('mk-journal-book').api.open({bookUUID:atlas.uuid})});
 assert.equal(await api(()=>book.selectedUUID),await api(()=>fixtures.journal.pages[3].uuid));
 await api(async()=>{await book.close({animate:false});game.user=fixtures.alice;window.book=await game.modules.get('mk-journal-book').api.open({bookUUID:atlas.uuid})});assert.equal(await api(()=>book.selectedUUID),'mk-journal-book-index');
 await api(async()=>{await book.close({animate:false});game.user=fixtures.gm;window.book=await game.modules.get('mk-journal-book').api.open({bookUUID:atlas.uuid})});assert.equal(await api(()=>book.selectedUUID),await api(()=>fixtures.journal.pages[3].uuid));
 await api(async()=>{await book.close({animate:false});await game.settings.set('mk-journal-book','alwaysStartAtIndex',true);window.book=await game.modules.get('mk-journal-book').api.open({bookUUID:atlas.uuid})});assert.equal(await api(()=>book.selectedUUID),'mk-journal-book-index');
 await api(async()=>{await game.modules.get('mk-journal-book').api.setTag(fixtures.harbor.uuid,'Quest',atlas.uuid);await book.close({animate:false});window.book=await game.modules.get('mk-journal-book').api.open({bookUUID:atlas.uuid,tag:'Quest'})});assert.equal(await api(()=>book.tab),'tag:quest');await api(()=>book.handleAction('index'));await settle();
 const revision=await api(()=>book._revision);await page.waitForTimeout(700);assert.equal(await api(()=>book._revision),revision,'saving the reading position must not cause render loops');
 console.log('PASS: independent reading positions, reopening, explicit targets, index preference and no save/render loop.');
 // Folding preferences, reader pins, live tilt, and resizing a second independent note.
 await api(async()=>{await game.settings.set('mk-journal-book','noteHoverDelay',400);await game.settings.set('mk-journal-book','noteFoldDuration',300);await game.modules.get('mk-journal-book').api.setNote(fixtures.harbor.uuid,'Read this before folding.\nKeep the key safe.',atlas.uuid,{title:'First clue',rotation:0})});await settle();
 const primary=()=>page.locator('.mkjb-right [data-note-id="primary"]');
 const rect=await primary().locator('.mkjb-note-text').boundingBox();await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await page.waitForTimeout(180);assert.equal(await primary().evaluate(el=>el.classList.contains('mkjb-note-peeking')),false);await page.waitForTimeout(350);assert.equal(await primary().evaluate(el=>el.classList.contains('mkjb-note-peeking')),true);assert.equal(await primary().locator('.mkjb-note-sheet').evaluate(el=>getComputedStyle(el).transitionDuration),'0.3s');
 await page.mouse.move(10,10);await page.waitForTimeout(350);await primary().locator('[data-mkjb-note-pin]').click();await primary().locator('.mkjb-note-text').hover();await page.waitForTimeout(650);assert.equal(await primary().evaluate(el=>el.classList.contains('mkjb-note-peeking')),false);assert.equal(await primary().locator('[data-mkjb-note-pin]').getAttribute('aria-pressed'),'true');
 await page.mouse.move(10,10);await primary().locator('.mkjb-note-edit').click();await page.locator('[name="noteRotation"]').evaluate(el=>{el.value='14';el.dispatchEvent(new Event('input',{bubbles:true}))});assert.ok((await primary().getAttribute('style')).includes('rotate(14deg)'));assert.equal(await api(()=>book.pages[0].note.rotation),0);await page.locator('dialog [data-cancel]').click();await settle();assert.ok((await primary().getAttribute('style')).includes('rotate(0deg)'));
 await page.locator('.mkjb-right [data-mkjb-action="add-note"]').click();await page.locator('[name="pageNote"]').fill('Another lead, independent of the first.');await page.locator('[name="noteTitle"]').fill('Second clue');await page.locator('[name="noteStyle"]').selectOption('sticky');await page.locator('dialog button[type="submit"]').click();await settle();
 assert.equal(await page.locator('.mkjb-right .mkjb-page-note').count(),2);const extra=await api(()=>book.pages[0].notes[1].id);const extraPaper=()=>page.locator(`.mkjb-right [data-note-id="${extra}"]`);
 const firstText=await primary().locator('.mkjb-note-text').textContent();
 await extraPaper().locator('.mkjb-note-edit').click();await page.locator('[name="noteRotation"]').evaluate(el=>{el.value='-8';el.dispatchEvent(new Event('input',{bubbles:true}))});await page.locator('dialog button[type="submit"]').click();await settle();assert.equal(await api(()=>book.pages[0].notes[1].rotation),-8);assert.equal(await primary().locator('.mkjb-note-text').textContent(),firstText);
 await extraPaper().locator('[data-mkjb-note-resize]').focus();await page.keyboard.press('ArrowRight');await settle();assert.ok((await api(()=>book.pages[0].notes[1].size.width))>=220);assert.equal(await extraPaper().locator('[data-mkjb-note-resize]').evaluate(el=>el===document.activeElement),true);
 const savedSize=await api(()=>book.pages[0].notes[1].size);const handle=await extraPaper().locator('[data-mkjb-note-resize]').boundingBox();await page.mouse.move(handle.x+10,handle.y+10);await page.mouse.down();await page.mouse.move(handle.x+80,handle.y+55,{steps:6});await page.mouse.up();await settle();assert.ok((await api(()=>book.pages[0].notes[1].size.width))>savedSize.width);
 const persisted=await api(()=>JSON.stringify(book.pages[0].notes));const cancelHandle=await extraPaper().locator('[data-mkjb-note-resize]').boundingBox();await page.mouse.move(cancelHandle.x+10,cancelHandle.y+10);await page.mouse.down();await page.mouse.move(cancelHandle.x+30,cancelHandle.y+30);await page.keyboard.press('Escape');await page.mouse.up();await settle();assert.equal(await api(()=>JSON.stringify(book.pages[0].notes)),persisted);
 await extraPaper().locator('[data-mkjb-note-move]').focus();await page.keyboard.press('ArrowLeft');await settle();assert.equal(await extraPaper().locator('[data-mkjb-note-move]').evaluate(el=>el===document.activeElement),true);
 // Updating a sibling while an editor is open does not overwrite or conflict with that sibling.
 await page.locator('.mkjb-right .mkjb-note-toggle').click();await page.locator('[name="noteId"]').selectOption('primary');await page.locator('dialog button[type="submit"]').click();await page.waitForSelector('[name="pageNote"]');await api(async()=>{const note=book.pages[0].notes[1];await game.modules.get('mk-journal-book').api.setNote(fixtures.harbor.uuid,'Sibling changed',atlas.uuid,{noteId:note.id})});await page.locator('[name="pageNote"]').fill('Primary edited');await page.locator('dialog button[type="submit"]').click();await settle();assert.deepEqual(await api(()=>book.pages[0].notes.map(n=>n.text)),['Primary edited','Sibling changed']);
 await api(()=>{game.user=fixtures.bob;Hooks.call('updateUser')});await settle();assert.equal(await page.locator('[data-mkjb-note-resize],[data-mkjb-note-move]').count(),0);await page.locator('.mkjb-right [data-mkjb-action="view-note"]').click();await primary().locator('[data-mkjb-note-pin]').click();assert.equal(await primary().locator('[data-mkjb-note-pin]').getAttribute('aria-pressed'),'true');
 await api(()=>{game.user=fixtures.gm;Hooks.call('updateUser')});await settle();
 if(process.env.MKJB_PREVIEW_DIR)await page.screenshot({path:path.join(process.env.MKJB_PREVIEW_DIR,'book-v0140-notes.png')});
 console.log('PASS: delayed folding, speed, pins, live/cancelled tilt, multiple notes, pointer/keyboard resizing, cancellation, independent writes and reader permissions.');
 // Add a second journal, then drag whole groups and individual pages without changing membership.
 await api(async()=>{
  window.secondJournal=await CONFIG.JournalEntry.documentClass.create({name:'Zeta Maps',ownership:{default:2}});
  const p=fixtures.add('09','The Coast Map','notes','<p>Map caption</p>',{default:2},'image','../assets/open-book.svg');fixtures.journal.pages.pop();p.parent=secondJournal;p.uuid=`${secondJournal.uuid}.JournalEntryPage.${p.id}`;secondJournal.pages.push(p);window.mapPage=p;
  await game.modules.get('mk-journal-book').api.addJournal(secondJournal.uuid,atlas.uuid);await book.handleAction('index');
 });await settle();
 const membership=await api(()=>JSON.stringify(atlas.getFlag('mk-journal-book','pages')));
 assert.equal(await api(()=>{const dt=new DataTransfer();dt.setData('text/plain',JSON.stringify({type:'JournalEntry',uuid:fixtures.journal.uuid}));document.querySelector('[data-order-kind]').dispatchEvent(new DragEvent('dragover',{bubbles:true,dataTransfer:dt}));const shell=document.querySelector('.mkjb-shell'),accepted=shell.classList.contains('mkjb-drag-over');shell.classList.remove('mkjb-drag-over');return accepted}),true,'index rows must retain the ordinary journal drop target');
 await api(()=>game.user.setFlag('mk-journal-book',`bookmarks.${atlas.id}`,[{uuid:fixtures.harbor.uuid,label:'Harbor',color:'#a34b49'}]));await settle();
 const drag=async(source,target,after=false)=>{await page.evaluate(({source,target,after})=>{const handle=document.querySelector(source),row=document.querySelector(target),dt=new DataTransfer();handle.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:dt}));const r=row.getBoundingClientRect();row.dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer:dt,clientY:r.top+(after?r.height*.9:r.height*.1)}))},{source,target,after});await settle()};
 const secondId=await api(()=>secondJournal.uuid);
 await drag(`[data-order-kind="journal"][data-order-id="${secondId}"] [data-order-handle]`,'[data-order-kind="journal"][data-order-id="JournalEntry.J"]');
 assert.equal(await page.locator('.mkjb-index-heading strong').first().textContent(),'Zeta Maps');assert.equal(await page.locator('.mkjb-ribbon span').textContent(),'3');
 const harborId=await api(()=>fixtures.harbor.uuid),watchId=await api(()=>fixtures.journal.pages[1].uuid);
 await drag(`[data-order-kind="page"][data-order-id="${watchId}"] [data-order-handle]`,`[data-order-kind="page"][data-order-id="${harborId}"]`);
 assert.equal(await page.locator('.mkjb-index-pages').nth(1).locator('.mkjb-index-page-name').first().textContent(),'The Old Watchtower');assert.equal(await page.locator('.mkjb-ribbon span').textContent(),'4');assert.equal(await api(()=>JSON.stringify(atlas.getFlag('mk-journal-book','pages'))),membership);
 await page.locator('[data-mkjb-collapse="JournalEntry.J"]').click();assert.equal(await page.locator('.mkjb-index-pages').nth(1).isVisible(),false);await page.locator('[data-mkjb-collapse="JournalEntry.J"]').click();
 await api(()=>{game.user=fixtures.bob;Hooks.call('updateUser')});await settle();assert.equal(await page.locator('[data-order-handle]').count(),0);await api(()=>{game.user=fixtures.gm;Hooks.call('updateUser')});await settle();
 if(process.env.MKJB_PREVIEW_DIR)await page.screenshot({path:path.join(process.env.MKJB_PREVIEW_DIR,'book-v0140-index.png')});
 console.log('PASS: journal/page drag ordering, bookmark renumbering, membership preservation, collapse and reader permissions.');
 // One-shot presentation is targeted, rejects non-GM requests and rechecks access on receipt.
 await page.locator('[data-mkjb-action="present"]').click();await page.locator('[name="recipient"][value="bob"]').uncheck();await page.locator('dialog button[type="submit"]').click();await settle();assert.deepEqual(await api(()=>game.settings.get('mk-journal-book','pagePresentation').users),['alice']);
 await api(()=>{window.presentation=structuredClone(game.settings.get('mk-journal-book','pagePresentation'));game.user=fixtures.alice});
 assert.equal(await api(async()=>{const {receivePresentation}=await import('../scripts/presentation.js');window.received=null;return receivePresentation(presentation,async options=>window.received=options)}),true);assert.equal(await api(()=>received.bookUUID),await api(()=>atlas.uuid));
 assert.equal(await api(async()=>{const {receivePresentation}=await import('../scripts/presentation.js');return receivePresentation(presentation,async()=>{throw new Error('Must not replay')})}),false);
 assert.equal(await api(async()=>{try{await game.modules.get('mk-journal-book').api.showPage(atlas.uuid,'mk-journal-book-index',['bob']);return false}catch{return true}}),true);
 await api(()=>{atlas.ownership.alice=0;presentation.nonce+='-revoked'});assert.equal(await api(async()=>{const {receivePresentation}=await import('../scripts/presentation.js');return receivePresentation(presentation,async()=>{throw new Error('Must not open revoked book')})}),false);
 await api(()=>{atlas.ownership.alice=3;game.user=fixtures.gm;Hooks.call('updateUser')});await settle();
 console.log('PASS: selected recipients, one-shot delivery, duplicate suppression and GM/recipient permission checks.');
 // Custom covers preview and animate consistently; cancelling leaves flags untouched.
 await page.locator('[data-mkjb-action="appearance"]').click();await page.locator('[name="coverTitle"]').fill('The Coast Atlas');await page.locator('[name="coverSubtitle"]').fill('Notes of the northern company');await page.locator('file-picker[name="coverImage"] input').fill('../assets/gothic-cover.svg');await page.locator('file-picker[name="coverEmblem"] input').fill('../assets/classic-cover.svg');await page.locator('[name="bookStyle"]').selectOption('gothic');assert.equal(await page.locator('.mkjb-cover-preview .mkjb-cover-title').textContent(),'The Coast Atlas');if(process.env.MKJB_PREVIEW_DIR)await page.screenshot({path:path.join(process.env.MKJB_PREVIEW_DIR,'book-v0140-cover.png')});await page.locator('dialog button[type="submit"]').click();await settle();assert.equal(await api(()=>atlas.name),'The Coast Chronicle');assert.equal(await api(()=>atlas.getFlag('mk-journal-book','cover').title),'The Coast Atlas');
 await page.locator('[data-mkjb-action="appearance"]').click();await page.locator('[name="coverTitle"]').fill('Discarded');await page.locator('dialog [data-cancel]').click();assert.equal(await api(()=>atlas.getFlag('mk-journal-book','cover').title),'The Coast Atlas');
 await api(async()=>{await game.settings.set('mk-journal-book','flipDuration',700);void book.close()});await page.waitForSelector('.mkjb-close-cover');assert.equal(await page.locator('.mkjb-close-cover .mkjb-cover-title').textContent(),'The Coast Atlas');assert.equal(await page.locator('.mkjb-close-cover .mkjb-cover-subtitle').textContent(),'Notes of the northern company');await page.waitForFunction(()=>!book.rendered);
 await api(()=>{void book.render({force:true})});await page.waitForSelector('.mkjb-open-layer');assert.equal(await page.locator('.mkjb-close-cover .mkjb-cover-title').textContent(),'The Coast Atlas');await page.waitForFunction(()=>!book._opening);await api(()=>game.settings.set('mk-journal-book','flipDuration',0));
 console.log('PASS: cover title/subtitle/artwork/emblem, live preview, cancellation and opening/closing customization.');
 // Images open locally with zoom, preserve spread and close immediately on access changes.
 await api(async()=>{await book.handleAction('index')});await settle();const spread=await api(()=>book.selectedUUID);
 await page.locator('.mkjb-content img').click();await page.waitForSelector('.mkjb-image-viewer');
 // Loading exposes natural dimensions before the first fitted layout is applied.
 await page.waitForFunction(()=>{
  const image=document.querySelector('.mkjb-image-viewer img');
  return image?.naturalWidth>0&&image.style.width!==''&&image.style.height!=='';
 });
 const fitWidth=await page.locator('.mkjb-image-viewer img').evaluate(el=>el.width);await page.locator('[aria-label="Zoom in"]').click();assert.ok((await page.locator('.mkjb-image-viewer img').evaluate(el=>el.width))>fitWidth);await page.locator('[aria-label="Fit image"]').click();assert.equal(await page.locator('.mkjb-image-viewer img').evaluate(el=>el.width),fitWidth);if(process.env.MKJB_PREVIEW_DIR)await page.screenshot({path:path.join(process.env.MKJB_PREVIEW_DIR,'book-v0140-image.png')});await page.keyboard.press('Escape');assert.equal(await page.locator('.mkjb-image-viewer').count(),0);assert.equal(await api(()=>book.selectedUUID),spread);
 await api(()=>{game.user=fixtures.bob;Hooks.call('updateUser')});await settle();await page.locator('.mkjb-content img').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('.mkjb-image-viewer').count(),1);await api(()=>{mapPage.permissions.bob=0;Hooks.call('updateJournalEntryPage')});assert.equal(await page.locator('.mkjb-image-viewer').count(),0);
 console.log('PASS: image enlargement, zoom/fit, keyboard access, spread preservation and permission revocation cleanup.');
 assert.deepEqual(errors,[]);
 } finally {await browser.close();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1});
