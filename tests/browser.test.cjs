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
 const count=()=>page.evaluate(()=>book.pages.length);
 async function drop(data){
  const transfer=await page.evaluateHandle(data=>{const dt=new DataTransfer();dt.setData('text/plain',typeof data==='string'?data:JSON.stringify(data));return dt},data);
  await page.locator('.mkjb-shell').dispatchEvent('drop',{dataTransfer:transfer});await transfer.dispose();
  await page.waitForFunction(()=>!book._dropPending);await page.waitForTimeout(90);
 }
 async function editTag(selector, tag) {
  await page.locator(selector).click();await page.locator('dialog [name="pageTag"]').fill(tag);
  await page.locator('dialog button[type="submit"]').click();await page.waitForFunction(()=>!book._tagPending);await page.waitForTimeout(100);
 }
 assert.equal(await count(),0);
 assert.equal(await page.locator('.mkjb-index,.mkjb-candidate,[data-mkjb-action="manage"]').count(),0);
 await drop({type:'JournalEntry',uuid:'JournalEntry.J'});assert.equal(await count(),0);
 assert.equal(await page.evaluate(async()=>{try{await game.modules.get('mk-journal-book').api.addJournal('JournalEntry.J');return false}catch{return true}}),true);
 await page.evaluate(()=>{game.user=fixtures.gm;Hooks.call('updateUser',game.user)});await page.waitForSelector('.mkjb-drop-hint',{state:'attached'});
 // Individual private page: grant Observer, preserve Owner, don't add siblings.
 await page.evaluate(()=>Object.assign(fixtures.harbor.permissions,{default:0,alice:0,bob:3}));
 await drop({type:'JournalEntryPage',uuid:'JournalEntry.J.JournalEntryPage.01'});
 assert.equal(await count(),1);
 assert.deepEqual(await page.evaluate(()=>lastPageUpdate),{'flags.mk-journal-book.included':true,ownership:{default:2,alice:2,bob:3}});
 assert.equal(await page.locator('.mkjb-content').count(),1);assert.equal(await page.locator('.mkjb-journal-index').count(),1);assert.equal(await page.locator('.mkjb-index-heading').count(),1);
 assert.equal(await page.evaluate(()=>fixtures.journal.pages[7].permissions.default),0);
 // Repeated drops are idempotent. Whole journals publish all current pages in one batch.
 await drop({type:'JournalEntryPage',uuid:'JournalEntry.J.JournalEntryPage.01'});assert.equal(await count(),1);
 await drop({type:'JournalEntry',uuid:'JournalEntry.J'});assert.equal(await count(),8);
 assert.equal(await page.evaluate(()=>batchUpdates.length),8);
 assert.equal(await page.evaluate(()=>fixtures.journal.pages.every(p=>p.testUserPermission(fixtures.alice,'OBSERVER'))),true);
 assert.equal(await page.evaluate(()=>fixtures.harbor.ownership.bob),3);
 assert.deepEqual(await page.locator('.mkjb-page-title').allTextContents(),['Journal Index','The Lantern Harbor']);
 await drop({type:'JournalEntry',uuid:'JournalEntry.J'});assert.equal(await count(),8);
 await page.evaluate(()=>{fixtures.add('09','A later page','notes','<p>Not selected.</p>');Hooks.call('createJournalEntryPage')});await page.waitForTimeout(100);assert.equal(await count(),8);
 // Reject malformed, wrong-type, missing and compendium drops without mutating membership.
 await drop('not json');await drop({type:'Actor',uuid:'Actor.X'});await drop({type:'JournalEntry',uuid:'JournalEntry.missing'});
 await page.evaluate(()=>fixtures.journal.inCompendium=true);await drop({type:'JournalEntry',uuid:'JournalEntry.J'});await page.evaluate(()=>fixtures.journal.inCompendium=false);
 assert.equal(await count(),8);assert.ok(await page.evaluate(()=>messages.some(m=>m.includes('Import'))));
 if(process.env.MKJB_PREVIEW_DIR)await page.screenshot({path:path.join(process.env.MKJB_PREVIEW_DIR,'book-v013-gm.png')});
 // Each side addresses its own page for opening, tagging and removal.
 assert.equal(await page.locator('.mkjb-page-meta [data-mkjb-action="original"]').count(),0);
 assert.equal(await page.locator('.mkjb-right .mkjb-source-link').textContent(),'The Northern Coast');
 await page.locator('.mkjb-right .mkjb-source-link').click();assert.equal(await page.evaluate(()=>openedOriginal.pageId),'01');
 await page.locator('[data-mkjb-action="next"]').click();await page.waitForFunction(()=>!book._turnPending);await page.waitForFunction(()=>document.querySelector('.mkjb-page-title')?.textContent==='The Old Watchtower');
 assert.deepEqual(await page.locator('.mkjb-page-title').allTextContents(),['The Old Watchtower','Mara Venn']);
 await page.locator('.mkjb-left .mkjb-source-link').focus();await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>openedOriginal.pageId),'02');
 await page.locator('.mkjb-right .mkjb-source-link').click();assert.equal(await page.evaluate(()=>openedOriginal.pageId),'03');
 await editTag('.mkjb-right [data-mkjb-action="tag"]','Notes');assert.equal(await page.evaluate(()=>fixtures.journal.pages[2].getFlag('mk-journal-book','tag')),'Notes');
 const ownershipBefore=await page.evaluate(()=>JSON.stringify(fixtures.journal.pages[2].ownership));
 await page.locator('.mkjb-right [data-mkjb-action="remove"]').click();await page.waitForFunction(()=>book.pages.length===7);
 assert.equal(await page.evaluate(()=>JSON.stringify(fixtures.journal.pages[2].ownership)),ownershipBefore);
 assert.equal(await page.evaluate(()=>fixtures.journal.pages[1].getFlag('mk-journal-book','included')),true);
 assert.equal(await page.evaluate(()=>fixtures.journal.pages[2].getFlag('mk-journal-book','included')),false);
 await page.locator('[data-mkjb-tab="tag:locations"]').click();await page.waitForFunction(()=>document.querySelector('.mkjb-page-title')?.textContent==='The Lantern Harbor');
 assert.deepEqual(await page.locator('.mkjb-page-title').allTextContents(),['The Lantern Harbor','The Old Watchtower']);
 assert.equal(await page.locator('[data-mkjb-action="next"]').isDisabled(),true);
 await page.locator('[data-mkjb-tab="all"]').click();await page.waitForTimeout(100);
 // Player rendering: no private blocks, no membership controls, no drop permissions.
 await page.evaluate(()=>{game.user=fixtures.alice;Hooks.call('updateUser',game.user)});await page.waitForFunction(()=>!document.querySelector('[data-mkjb-action="tag"]')&&document.querySelector('.mkjb-content'));
 assert.equal(await page.locator('[data-mkjb-action="remove"]').count(),0);
 const visibleText=await page.locator('.mkjb-book').textContent();assert.ok(!visibleText.includes('SECRET_MARKER'));assert.ok(visibleText.includes('REVEALED_MARKER'));
 await drop({type:'JournalEntryPage',uuid:'JournalEntry.J.JournalEntryPage.09'});assert.equal(await count(),7);
 if(process.env.MKJB_PREVIEW_DIR)await page.screenshot({path:path.join(process.env.MKJB_PREVIEW_DIR,'book-v013-player.png')});
 // Revocation and asynchronous renders must not restore inaccessible text on either side.
 assert.equal(await page.evaluate(()=>{fixtures.harbor.permissions.alice=0;Hooks.call('updateJournalEntryPage');return !document.querySelector('.mkjb-page-title')}),true);
 await page.waitForFunction(()=>book.pages.length===6&&document.querySelector('.mkjb-content'));
 await page.evaluate(async()=>{fixtures.harbor.permissions.alice=2;book.selectedUUID=fixtures.harbor.uuid;const pending=book._renderHTML();fixtures.harbor.permissions.alice=0;book.refresh({invalidate:true});book._replaceHTML(await pending,book.element.querySelector('.window-content'))});
 await page.waitForFunction(()=>document.querySelector('.mkjb-content'));
 assert.ok(!(await page.locator('.mkjb-book').textContent()).includes('The Lantern Harbor'));
 // Index includes each selected parent once, including partial journals, and updates after removal.
 await page.evaluate(async()=>{
  game.user=fixtures.gm;
  const page=fixtures.add('10','Island landing','notes','<p>Island content.</p>');fixtures.journal.pages.pop();
  const second={...fixtures.journal,id:'K',uuid:'JournalEntry.K',name:'The Southern Isles',pages:[page]};
  page.parent=second;page.uuid='JournalEntry.K.JournalEntryPage.10';game.journal.push(second);
  const originalResolver=globalThis.fromUuid;globalThis.fromUuid=async uuid=>uuid===second.uuid?second:uuid===page.uuid?page:originalResolver(uuid);
  window.secondPage=page;await game.modules.get('mk-journal-book').api.addPage(page.uuid);Hooks.call('updateUser');
 });
 await page.waitForTimeout(100);await page.locator('[data-mkjb-action="index"]').click();
 await page.waitForSelector('.mkjb-journal-index');
 assert.equal(await page.locator('.mkjb-index-heading').count(),2);
 assert.equal(await page.locator('.mkjb-index-number').last().textContent(),'9');
 const jump=page.locator('.mkjb-index-heading[data-mkjb-jump="JournalEntry.K.JournalEntryPage.10"]');await jump.click();
 await page.waitForFunction(()=>[...document.querySelectorAll('.mkjb-page-title')].some(el=>el.textContent==='Island landing'));
 assert.equal(await page.locator('.mkjb-journal-index').count(),0);
 await page.locator('[data-mkjb-leaf="JournalEntry.K.JournalEntryPage.10"] [data-mkjb-action="remove"]').click();
 await page.waitForFunction(()=>!secondPage.getFlag('mk-journal-book','included'));
 await page.locator('[data-mkjb-action="index"]').click();await page.waitForSelector('.mkjb-journal-index');
 assert.equal(await page.locator('.mkjb-index-heading').count(),1);
 await page.locator('[data-mkjb-action="next"]').click();await page.waitForFunction(()=>!book._turnPending);await page.waitForFunction(()=>!document.querySelector('.mkjb-journal-index'));
 await page.locator('[data-mkjb-action="previous"]').click();await page.waitForFunction(()=>!book._turnPending);await page.waitForSelector('.mkjb-journal-index');
 assert.equal(await page.locator('.window-header').isVisible(),false);
 assert.equal(await page.locator('.mk-journal-book').evaluate(el=>getComputedStyle(el).position),'fixed');
 assert.equal(await page.locator('.mkjb-shell').evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)');
 // Floating drag moves actual screen coordinates and survives refresh and reopening.
 const beforeDrag=await page.locator('.mk-journal-book').boundingBox(),drag=await page.locator('.mkjb-drag-strip').boundingBox();
 await page.mouse.move(drag.x+30,drag.y+8);await page.mouse.down();await page.mouse.move(drag.x+115,drag.y+43,{steps:5});await page.mouse.up();
 const afterDrag=await page.locator('.mk-journal-book').boundingBox();assert.ok(Math.abs(afterDrag.x-beforeDrag.x-85)<2);assert.ok(Math.abs(afterDrag.y-beforeDrag.y-35)<2);
 await page.locator('[data-mkjb-action="refresh"]').click();await page.waitForTimeout(100);assert.deepEqual(await page.locator('.mk-journal-book').boundingBox(),afterDrag);
 await page.locator('[data-mkjb-action="close"]').click();await page.waitForFunction(()=>!book._closing);await page.evaluate(()=>game.modules.get('mk-journal-book').api.open({legacy:true}));assert.deepEqual(await page.locator('.mk-journal-book').boundingBox(),afterDrag);
 // Compact two-leaf layout and resizer.
 await page.setViewportSize({width:800,height:600});await page.evaluate(()=>book.setPosition({left:15,top:15,width:770,height:570}));
 assert.equal(await page.evaluate(()=>[...document.querySelectorAll('.mkjb-content')].every(el=>el.getBoundingClientRect().height>60)),true);
 assert.equal(await page.evaluate(()=>[...document.querySelectorAll('.mkjb-tab')].every(el=>el.scrollHeight<=el.clientHeight)),true);
 if(process.env.MKJB_PREVIEW_DIR)await page.screenshot({path:path.join(process.env.MKJB_PREVIEW_DIR,'book-v013-compact.png')});
 const resize=await page.locator('[data-mkjb-resize]').boundingBox();await page.mouse.move(resize.x+resize.width/2,resize.y+resize.height/2);await page.mouse.down();await page.mouse.move(resize.x+40,resize.y+30);await page.mouse.up();assert.equal(await page.evaluate(()=>book.element.getBoundingClientRect().width>770),true);
 await page.locator('[data-mkjb-action="close"]').click();await page.waitForFunction(()=>!book._closing);await page.waitForFunction(()=>!document.querySelector('.mk-journal-book'));
 // Page turn animation, repeat clicks, cancellation and reduced-motion behavior.
 await page.evaluate(async()=>{window.book=await game.modules.get('mk-journal-book').api.open({legacy:true});await book.handleAction('index')});await page.waitForTimeout(100);
 await page.locator('[data-mkjb-action="next"]').click();await page.waitForSelector('.mkjb-turn-forward');
 assert.equal(await page.evaluate(()=>book._turnPending),true);
 const selectedDuringTurn=await page.evaluate(()=>book.selectedUUID);await page.evaluate(()=>book.handleAction('next'));
 assert.equal(await page.evaluate(()=>book.selectedUUID),selectedDuringTurn);
 if(process.env.MKJB_PREVIEW_DIR){
  await page.evaluate(()=>{window.turnAnimation=document.querySelector('.mkjb-turn-sheet').getAnimations()[0];turnAnimation.pause();turnAnimation.currentTime=250});
  await page.screenshot({path:path.join(process.env.MKJB_PREVIEW_DIR,'book-v020-flip.png')});
  await page.evaluate(()=>turnAnimation.play());
 }
 await page.waitForFunction(()=>!book._turnPending);assert.equal(await page.locator('.mkjb-turn-layer').count(),0);
 await page.locator('[data-mkjb-action="previous"]').click();await page.waitForSelector('.mkjb-turn-backward');await page.waitForFunction(()=>!book._turnPending);
 assert.equal(await page.locator('.mkjb-journal-index').count(),1);
 await page.locator('[data-mkjb-action="next"]').click();await page.waitForSelector('.mkjb-turn-layer');
 await page.evaluate(()=>Hooks.call('updateJournalEntryPage'));
 assert.equal(await page.locator('.mkjb-turn-layer').count(),0);await page.waitForTimeout(100);
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.locator('[data-mkjb-action="previous"]').click();await page.waitForSelector('.mkjb-journal-index');
 assert.equal(await page.locator('.mkjb-turn-layer').count(),0);assert.equal(await page.evaluate(()=>book._turnPending),false);
 await page.emulateMedia({reducedMotion:'no-preference'});await page.locator('[data-mkjb-action="close"]').click();await page.waitForFunction(()=>!book._closing);
 // Native Create Journal Entry flow, independent book documents and ownership.
 await page.setViewportSize({width:1360,height:900});
 await page.evaluate(()=>{game.user=fixtures.gm;window.createFromDirectory=()=>{window.pendingCreate=CONFIG.JournalEntry.documentClass.createDialog()};createFromDirectory()});
 await page.locator('dialog [name="name"]').fill('Alice’s Atlas');
 await page.locator('dialog [name="journalKind"]').selectOption('book');
 await page.locator('dialog [name="folder"]').selectOption('F');
 await page.locator('dialog [name="bookOwner"]').selectOption('alice');
 if(process.env.MKJB_PREVIEW_DIR)await page.screenshot({path:path.join(process.env.MKJB_PREVIEW_DIR,'book-v020-create.png')});
 await page.locator('dialog button[type="submit"]').click();await page.waitForFunction(()=>createdJournal?.sheet.rendered);
 await page.evaluate(async()=>{window.atlas=await pendingCreate;window.book=atlas.sheet});
 assert.deepEqual(await page.evaluate(()=>({name:atlas.name,folder:atlas.folder,ownership:atlas.ownership,pages:atlas.getFlag('mk-journal-book','pages'),sheet:atlas.getFlag('core','sheetClass')})),{name:'Alice’s Atlas',folder:'F',ownership:{default:2,alice:3},pages:[],sheet:'mk-journal-book.MKJournalBookSheet'});
 assert.equal(await count(),0);assert.equal(await page.locator('.mkjb-kicker').textContent(),'Alice’s Atlas');
 await drop({type:'JournalEntryPage',uuid:'JournalEntry.J.JournalEntryPage.01'});assert.equal(await count(),1);
 assert.equal(await page.locator('.mkjb-journal-index').count(),1);
 await page.evaluate(()=>{createFromDirectory()});await page.locator('dialog [data-cancel]').click();assert.equal(await page.evaluate(()=>pendingCreate),null);
 // Standard journal creation still uses its normal sheet, and compendium requests pass through.
 await page.evaluate(()=>createFromDirectory());await page.locator('dialog [name="name"]').fill('Ordinary Journal');
 await page.locator('dialog button[type="submit"]').click();await page.waitForFunction(()=>normalJournalOpened===createdJournal.id);
 assert.equal(await page.evaluate(()=>createdJournal.getFlag('mk-journal-book','book')),undefined);
 assert.equal(await page.evaluate(()=>CONFIG.JournalEntry.documentClass.createDialog({}, {pack:'a.pack'})),'original');
 await page.evaluate(()=>createFromDirectory());await page.locator('dialog [name="name"]').fill('Bob’s Notes');
 await page.locator('dialog [name="journalKind"]').selectOption('book');await page.locator('dialog [name="bookOwner"]').selectOption('bob');
 await page.locator('dialog button[type="submit"]').click();await page.waitForFunction(()=>createdJournal?.sheet.rendered);
 await page.evaluate(async()=>{window.notebook=await pendingCreate;await atlas.sheet.close();window.book=notebook.sheet});
 await drop({type:'JournalEntryPage',uuid:'JournalEntry.J.JournalEntryPage.02'});
 assert.deepEqual(await page.evaluate(()=>[atlas.sheet.pages.map(p=>p.page.id),notebook.sheet.pages.map(p=>p.page.id)]),[['01'],['02']]);
 assert.notEqual(await page.evaluate(()=>atlas.sheet.options.id),await page.evaluate(()=>notebook.sheet.options.id));
 // Alice owns Atlas but is only an Observer of Bob's Notes.
 await page.evaluate(()=>{game.user=fixtures.alice;Hooks.call('updateUser')});await page.waitForTimeout(100);
 assert.equal(await page.locator('[data-mkjb-action="remove"]').count(),0);
 assert.equal(await page.evaluate(async()=>{try{await game.modules.get('mk-journal-book').api.removePage('JournalEntry.J.JournalEntryPage.02',notebook.uuid);return false}catch{return true}}),true);
 await page.evaluate(async()=>{await notebook.sheet.close();window.book=await game.modules.get('mk-journal-book').api.open({bookUUID:atlas.uuid})});
 assert.equal(await page.locator('[data-mkjb-action="remove"]').count(),1);
 assert.ok(!(await page.locator('.mkjb-book').textContent()).includes('SECRET_MARKER'));
 // Owners can add already-published pages without altering source permissions.
 const sourceOwnership=await page.evaluate(()=>JSON.stringify(fixtures.journal.pages[1].ownership));
 await drop({type:'JournalEntryPage',uuid:'JournalEntry.J.JournalEntryPage.02'});assert.equal(await count(),2);
 assert.equal(await page.evaluate(()=>JSON.stringify(fixtures.journal.pages[1].ownership)),sourceOwnership);
 await editTag('[data-mkjb-action="tag"]','Quests');
 assert.deepEqual(await page.evaluate(()=>[atlas.sheet.pages.find(p=>p.page.id==='02').tag,notebook.sheet.pages[0].tag]),['Quests','']);
 await page.evaluate(()=>{fixtures.journal.pages.find(p=>p.id==='09').permissions.default=0});
 await drop({type:'JournalEntryPage',uuid:'JournalEntry.J.JournalEntryPage.09'});assert.equal(await count(),2);
 assert.ok(await page.evaluate(()=>messages.some(m=>m.includes('Ask a GM'))));
 await drop({type:'JournalEntry',uuid:'JournalEntry.J'});assert.equal(await count(),2); // whole drop rejected before any partial membership write
 await drop({type:'JournalEntry',uuid:await page.evaluate(()=>atlas.uuid)});assert.equal(await count(),2);
 await page.locator('[data-mkjb-action="remove"]').click();await page.waitForFunction(()=>book.pages.length===1);
 assert.equal(await page.evaluate(()=>notebook.sheet.pages.length),1);
 // Native renaming and permission revocation update the existing floating sheet.
 await page.evaluate(async()=>{await atlas.update({name:'The Owner’s Chronicle'});await atlas.sheet.handleAction('index')});await page.waitForTimeout(100);
 assert.equal(await page.locator('.mkjb-kicker').textContent(),'The Owner’s Chronicle');
 if(process.env.MKJB_PREVIEW_DIR)await page.screenshot({path:path.join(process.env.MKJB_PREVIEW_DIR,'book-v020-owner.png')});
 await page.evaluate(()=>{atlas.ownership.alice=2;Hooks.call('updateJournalEntry',atlas)});await page.waitForTimeout(100);assert.equal(await page.locator('[data-mkjb-action="remove"]').count(),0);
 await page.evaluate(()=>{atlas.ownership.alice=0;Hooks.call('updateJournalEntry',atlas)});await page.waitForFunction(()=>!atlas.sheet.rendered);
 assert.equal(await page.locator('.mk-journal-book').count(),0);
 assert.equal(await page.evaluate(async()=>{try{await game.modules.get('mk-journal-book').api.open({bookUUID:atlas.uuid});return false}catch{return true}}),true);
 // Launcher only lists accessible books, preserving the legacy campaign book.
 await page.evaluate(()=>{void game.modules.get('mk-journal-book').api.open()});await page.waitForSelector('dialog');
 assert.deepEqual(await page.locator('dialog option').allTextContents(),['Bob’s Notes','Legacy campaign book']);await page.locator('dialog [data-cancel]').click();
 // Authorized player journal creation assigns that player as Owner.
 await page.evaluate(()=>{fixtures.alice.canCreateJournals=true;createFromDirectory()});
 await page.locator('dialog [name="journalKind"]').selectOption('book');assert.equal(await page.locator('dialog [name="bookOwner"]').count(),0);
 await page.locator('dialog button[type="submit"]').click();await page.waitForFunction(()=>createdJournal?.sheet.rendered);
 assert.equal(await page.evaluate(()=>createdJournal.ownership.alice),3);
 await page.evaluate(()=>createdJournal.sheet.close());
 // Settings drive the real Web Animation duration; launch buttons are no longer injected.
 assert.deepEqual(await page.evaluate(()=>{const option=settingDefinitions.get('flipDuration');return {name:option.name,range:option.type.options,default:option.default,config:option.config}}),{name:'Page flip duration (ms)',range:{nullable:false,integer:true,min:0,max:3000,step:20},default:520,config:true});
 assert.deepEqual(await page.evaluate(()=>{const root=document.createElement('div');root.innerHTML='<header class="directory-header"><button>Create Journal Entry</button></header>';Hooks.call('renderJournalDirectory',{},root);const controls={notes:{tools:{existing:{name:'existing'}}}};Hooks.call('getSceneControlButtons',controls);return {buttonCount:root.querySelectorAll('button').length,tools:Object.keys(controls.notes.tools)}}),{buttonCount:1,tools:['existing']});
 await page.evaluate(async()=>{game.user=fixtures.gm;await game.modules.get('mk-journal-book').api.addJournal('JournalEntry.J',atlas.uuid);window.book=await game.modules.get('mk-journal-book').api.open({bookUUID:atlas.uuid});await game.settings.set('mk-journal-book','flipDuration',1600)});
 await page.locator('[data-mkjb-action="next"]').click();await page.waitForSelector('.mkjb-turn-layer');
 assert.equal(await page.evaluate(()=>document.querySelector('.mkjb-turn-sheet').getAnimations()[0].effect.getTiming().duration),1600);
 await page.evaluate(()=>book.cancelPageTurn());
 await page.evaluate(()=>game.settings.set('mk-journal-book','flipDuration',0));await page.locator('[data-mkjb-action="previous"]').click();await page.waitForSelector('.mkjb-journal-index');assert.equal(await page.locator('.mkjb-turn-layer').count(),0);
 // Observer readers can create personal bookmarks without editing the book or sources.
 await page.evaluate(()=>{game.user=fixtures.bob;Hooks.call('updateUser',game.user)});await page.waitForTimeout(100);
 const unchangedBook=await page.evaluate(()=>JSON.stringify(atlas.flags));
 await page.locator('.mkjb-right [data-mkjb-action="bookmark"]').click();await page.locator('dialog [name="bookmarkLabel"]').fill('Harbor meeting');await page.locator('dialog [name="bookmarkColor"]').fill('#a34b49');await page.locator('dialog button[type="submit"]').click();await page.waitForSelector('[data-mkjb-ribbon]');
 assert.equal(await page.locator('[data-mkjb-ribbon]').count(),1);assert.equal(await page.locator('[data-mkjb-ribbon]').textContent(),'2');
 assert.equal(await page.evaluate(()=>JSON.stringify(atlas.flags)),unchangedBook);
 const firstBookmark=await page.evaluate(()=>fixtures.bob.getFlag('mk-journal-book','bookmarks')[atlas.id][0]);assert.equal(firstBookmark.label,'Harbor meeting');
 await page.locator('[data-mkjb-action="next"]').click();await page.waitForTimeout(100);
 await page.locator('[data-mkjb-ribbon]').click();await page.waitForSelector('.mkjb-journal-index');assert.ok((await page.locator('.mkjb-page-title').allTextContents()).includes('The Lantern Harbor'));
 // Editing the page's existing bookmark updates it instead of making a duplicate.
 await page.locator('.mkjb-right [data-mkjb-action="bookmark"]').click();await page.locator('dialog [name="bookmarkLabel"]').fill('Meet at the harbor');await page.locator('dialog [name="bookmarkColor"]').fill('#4e6f9a');await page.locator('dialog button[type="submit"]').click();await page.waitForTimeout(100);
 assert.equal(await page.locator('[data-mkjb-ribbon]').count(),1);assert.equal(await page.locator('[data-mkjb-ribbon]').evaluate(el=>el.style.getPropertyValue('--ribbon-color')),'#4e6f9a');
 // Add the index and more pages; ribbons stay along the bottom through tag changes.
 await page.locator('.mkjb-left [data-mkjb-action="bookmark"]').click();await page.locator('dialog button[type="submit"]').click();await page.waitForTimeout(100);
 await page.locator('[data-mkjb-action="next"]').click();await page.waitForTimeout(100);
 await page.locator('.mkjb-left [data-mkjb-action="bookmark"]').click();await page.locator('dialog [name="bookmarkColor"]').fill('#4f755b');await page.locator('dialog button[type="submit"]').click();await page.waitForTimeout(100);
 await page.locator('.mkjb-right [data-mkjb-action="bookmark"]').click();await page.locator('dialog [name="bookmarkColor"]').fill('#b0853e');await page.locator('dialog button[type="submit"]').click();await page.waitForTimeout(100);
 assert.equal(await page.locator('[data-mkjb-ribbon]').count(),4);
 await page.locator('[data-mkjb-tab="tag:quests"]').click();await page.waitForTimeout(100);await page.locator('[data-mkjb-ribbon]').first().click();await page.waitForSelector('.mkjb-journal-index');assert.equal(await page.evaluate(()=>book.tab),'all');
 assert.equal(await page.locator('.mkjb-ribbons').evaluate(el=>{const parent=el.closest('.mkjb-book').getBoundingClientRect(),rect=el.getBoundingClientRect();return rect.top>parent.top+parent.height*.9&&rect.bottom>parent.bottom}),true);
 if(process.env.MKJB_PREVIEW_DIR)await page.screenshot({path:path.join(process.env.MKJB_PREVIEW_DIR,'book-v021-ribbons.png')});
 // A reopened sheet uses saved flags; another user and another book see separate bookmarks.
 await page.locator('[data-mkjb-action="close"]').click();await page.waitForFunction(()=>!book._closing);await page.evaluate(async()=>{window.book=await game.modules.get('mk-journal-book').api.open({bookUUID:atlas.uuid})});assert.equal(await page.locator('[data-mkjb-ribbon]').count(),4);
 await page.evaluate(()=>{game.user=fixtures.gm;Hooks.call('updateUser',game.user)});await page.waitForTimeout(100);assert.equal(await page.locator('[data-mkjb-ribbon]').count(),0);
 await page.evaluate(async()=>{game.user=fixtures.bob;await atlas.sheet.close();window.book=await game.modules.get('mk-journal-book').api.open({bookUUID:notebook.uuid})});assert.equal(await page.locator('[data-mkjb-ribbon]').count(),0);
 await page.evaluate(async()=>{await notebook.sheet.close();window.book=await game.modules.get('mk-journal-book').api.open({bookUUID:atlas.uuid})});assert.equal(await page.locator('[data-mkjb-ribbon]').count(),4);
 // Inaccessible pages and their custom labels disappear immediately.
 await page.evaluate(()=>{fixtures.harbor.permissions.bob=0;Hooks.call('updateJournalEntryPage')});await page.waitForTimeout(100);assert.equal(await page.locator('[data-mkjb-ribbon]').count(),3);assert.equal(await page.locator('[title*="Meet at the harbor"]').count(),0);
 await page.evaluate(()=>{fixtures.harbor.permissions.bob=2;Hooks.call('updateJournalEntryPage')});await page.waitForTimeout(100);assert.equal(await page.locator('[data-mkjb-ribbon]').count(),4);
 // Right-click / F2 open editing; removal changes only the personal bookmark list.
 await page.locator('[data-mkjb-ribbon]').first().click({button:'right'});await page.locator('dialog [name="removeBookmark"]').check();await page.locator('dialog button[type="submit"]').click();await page.waitForTimeout(100);assert.equal(await page.locator('[data-mkjb-ribbon]').count(),3);
 await page.locator('[data-mkjb-ribbon]').first().focus();await page.keyboard.press('F2');await page.waitForSelector('dialog');await page.locator('dialog [data-cancel]').click();assert.equal(await page.locator('[data-mkjb-ribbon]').count(),3);
 await page.setViewportSize({width:800,height:600});await page.evaluate(()=>book.setPosition({left:15,top:15,width:770,height:540}));
 assert.equal(await page.locator('.mkjb-ribbons').evaluate(el=>{const r=el.getBoundingClientRect();return r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth}),true);
 if(process.env.MKJB_PREVIEW_DIR)await page.screenshot({path:path.join(process.env.MKJB_PREVIEW_DIR,'book-v021-compact.png')});
 await page.locator('[data-mkjb-action="close"]').click();await page.waitForFunction(()=>!book._closing);
 // Each book preset changes artwork and actual typography, including flip snapshots.
 await page.setViewportSize({width:1360,height:900});
 await page.evaluate(async()=>{game.user=fixtures.gm;window.book=await game.modules.get('mk-journal-book').api.open({bookUUID:atlas.uuid});book.setPosition({left:120,top:60,width:1120,height:780})});
 assert.deepEqual(await page.evaluate(()=>Object.keys(settingDefinitions.get('bookStyle').choices)),['classic','gothic','field','arcane','nautical']);
 const appearance=page.locator('[data-mkjb-action="appearance"]');
 const expectedPresets=[['classic','open-book.svg','16px','34px'],['gothic','gothic-book.svg','17px','36px'],['field','field-book.svg','15px','28px'],['arcane','arcane-book.svg','17px','34px'],['nautical','nautical-book.svg','15px','30px']];
 const fontFamilies=[];
 for(const [preset,asset,bodySize,titleSize] of expectedPresets){
  await appearance.click();await page.locator('dialog [name="bookStyle"]').selectOption(preset);await page.locator('dialog button[type="submit"]').click();
  await page.waitForFunction(preset=>document.querySelector('.mkjb-shell')?.dataset.mkjbStyle===preset,preset);
  assert.equal(await page.evaluate(()=>atlas.getFlag('mk-journal-book','style')),preset);
  assert.ok((await page.locator('.mkjb-book').evaluate(el=>getComputedStyle(el).backgroundImage)).includes(asset));
  assert.equal(await page.locator('.mkjb-content').evaluate(el=>getComputedStyle(el).fontSize),bodySize);
  assert.equal(await page.locator('.mkjb-page-title').first().evaluate(el=>getComputedStyle(el).fontSize),titleSize);
  fontFamilies.push(await page.locator('.mkjb-content').evaluate(el=>getComputedStyle(el).fontFamily));
  assert.equal(await page.locator('.mkjb-page-title').first().evaluate(el=>getComputedStyle(el).scrollbarWidth),'none');
  assert.equal(await page.locator('.mkjb-page-title').first().evaluate(el=>getComputedStyle(el,'::-webkit-scrollbar').display),'none');
  assert.equal(await page.locator('.mkjb-index-page').count(),await count());
  assert.equal(await page.locator('.mkjb-index-page').evaluateAll(nodes=>nodes.every(el=>el.getBoundingClientRect().height<25)),true);
  assert.equal(await page.locator('.mkjb-index-heading').evaluateAll(nodes=>nodes.every(el=>el.getBoundingClientRect().height<30)),true);
  if(process.env.MKJB_PREVIEW_DIR)await page.screenshot({path:path.join(process.env.MKJB_PREVIEW_DIR,`book-v070-${preset}.png`)});
  await page.evaluate(()=>game.settings.set('mk-journal-book','flipDuration',1200));await page.locator('[data-mkjb-action="next"]').click();await page.waitForSelector('.mkjb-turn-layer');
  assert.ok((await page.locator('.mkjb-turn-front').evaluate(el=>getComputedStyle(el).backgroundImage)).includes(asset));
  assert.equal(await page.locator('.mkjb-turn-front .mkjb-content').evaluate(el=>getComputedStyle(el).fontSize),bodySize);
  await page.evaluate(()=>book.cancelPageTurn());await page.locator('[data-mkjb-action="index"]').click();await page.waitForSelector('.mkjb-journal-index');
 }
 assert.equal(new Set(fontFamilies).size,5);
 // The first and last included page lines jump to their exact source page's spread.
 const expectedPages=await page.evaluate(()=>book.pages.map((row,index)=>({uuid:row.uuid,name:row.name,number:String(index+2)})));
 assert.deepEqual(await page.locator('.mkjb-index-page').evaluateAll(nodes=>nodes.map(el=>({uuid:el.dataset.mkjbJump,name:el.querySelector('.mkjb-index-page-name').textContent,number:el.querySelector('.mkjb-index-number').textContent}))),expectedPages);
 const lastTarget=expectedPages.at(-1).uuid;await page.locator('.mkjb-index-page').last().click();await page.waitForFunction(uuid=>[...document.querySelectorAll('[data-mkjb-leaf]')].some(el=>el.dataset.mkjbLeaf===uuid),lastTarget);
 await page.locator('[data-mkjb-action="index"]').click();await page.waitForSelector('.mkjb-journal-index');
 await page.locator('.mkjb-index-page').first().click();await page.waitForSelector('.mkjb-journal-index');
 // Selection survives reopening and is shared by readers; unrelated books stay independent.
 await page.locator('[data-mkjb-action="close"]').click();await page.waitForFunction(()=>!book._closing);await page.evaluate(async()=>{window.book=await game.modules.get('mk-journal-book').api.open({bookUUID:atlas.uuid})});assert.equal(await page.locator('.mkjb-shell').getAttribute('data-mkjb-style'),'nautical');
 await page.evaluate(async()=>{await notebook.setFlag('mk-journal-book','style','classic');await atlas.setFlag('mk-journal-book','style',null);await game.settings.set('mk-journal-book','bookStyle','gothic')});
 await page.waitForFunction(()=>document.querySelector('.mkjb-shell')?.dataset.mkjbStyle==='gothic');assert.equal(await page.evaluate(()=>notebook.sheet.preset),'classic');
 await page.evaluate(()=>{game.user=fixtures.bob;Hooks.call('updateUser',game.user)});await page.waitForTimeout(100);assert.equal(await appearance.count(),0);assert.equal(await page.locator('.mkjb-shell').getAttribute('data-mkjb-style'),'gothic');
 await page.evaluate(()=>book.editAppearance());assert.equal(await page.locator('dialog').count(),0);
 // Per-page index lines continue to respect permission revocation and page removal.
 await page.evaluate(()=>{fixtures.harbor.permissions.bob=0;Hooks.call('updateJournalEntryPage')});await page.waitForTimeout(100);
 assert.equal(await page.locator('.mkjb-index-page[data-mkjb-jump="JournalEntry.J.JournalEntryPage.01"]').count(),0);
 assert.ok(!(await page.locator('.mkjb-journal-index').textContent()).includes('The Lantern Harbor'));
 await page.evaluate(()=>{fixtures.harbor.permissions.bob=2;Hooks.call('updateJournalEntryPage')});await page.waitForTimeout(100);
 // All presets stay usable in a compact window.
 await page.setViewportSize({width:800,height:600});await page.evaluate(()=>{game.user=fixtures.gm;book.setPosition({left:15,top:15,width:770,height:540});Hooks.call('updateUser')});await page.waitForTimeout(100);
 for(const [preset]of expectedPresets){await page.evaluate(async preset=>{await atlas.setFlag('mk-journal-book','style',preset)},preset);await page.waitForFunction(p=>document.querySelector('.mkjb-shell')?.dataset.mkjbStyle===p,preset);assert.equal(await page.locator('.mkjb-journal-index').evaluate(el=>el.clientHeight>150&&el.scrollWidth<=el.clientWidth),true)}
 if(process.env.MKJB_PREVIEW_DIR)await page.screenshot({path:path.join(process.env.MKJB_PREVIEW_DIR,'book-v070-compact.png')});
 await page.locator('[data-mkjb-action="close"]').click();await page.waitForFunction(()=>!book._closing);
 // Create Journal Entry also offers the preset and saves it on the new book.
 await page.evaluate(()=>createFromDirectory());await page.locator('dialog [name="journalKind"]').selectOption('book');await page.locator('dialog [name="bookStyle"]').selectOption('gothic');await page.locator('dialog button[type="submit"]').click();await page.waitForFunction(()=>createdJournal?.sheet.rendered);
 assert.equal(await page.evaluate(()=>createdJournal.getFlag('mk-journal-book','style')),'gothic');assert.equal(await page.locator('.mkjb-shell').getAttribute('data-mkjb-style'),'gothic');await page.evaluate(()=>createdJournal.sheet.close());
 // Custom tags replace fixed categories, persist per book, and filter exact pages.
 await page.setViewportSize({width:1360,height:900});
 await page.evaluate(async()=>{game.user=fixtures.gm;await atlas.update({'ownership.alice':3});window.book=await game.modules.get('mk-journal-book').api.open({bookUUID:atlas.uuid});book.setPosition({left:120,top:60,width:1120,height:780})});
 await editTag('.mkjb-right [data-mkjb-action="tag"]','  Quests  ');
 assert.equal(await page.evaluate(()=>book.pages[0].tag),'Quests');
 await page.evaluate(async()=>{await game.modules.get('mk-journal-book').api.setTag('JournalEntry.J.JournalEntryPage.02','quests',atlas.uuid)});await page.waitForTimeout(100);
 assert.equal(await page.locator('[data-mkjb-tab="tag:quests"]').count(),1);
 assert.equal(await page.locator('[data-mkjb-tab="tag:quests"] small').textContent(),'2');
 assert.equal(await page.evaluate(()=>notebook.sheet.pages[0].tag),'');
 await page.locator('[data-mkjb-tab="tag:quests"]').click();await page.waitForTimeout(100);
 assert.deepEqual(await page.locator('.mkjb-page-title').allTextContents(),['The Lantern Harbor','The Old Watchtower']);
 assert.equal(await page.locator('.mkjb-journal-index').count(),0);
 await page.locator('.mkjb-right [data-mkjb-action="tag"]').click();
 assert.ok((await page.locator('dialog datalist option').evaluateAll(nodes=>nodes.map(node=>node.value))).includes('Quests'));
 await page.locator('dialog [name="pageTag"]').fill('Discarded');await page.locator('dialog [data-cancel]').click();
 assert.equal(await page.evaluate(()=>book.pages[1].tag),'Quests');
 await editTag('.mkjb-right [data-mkjb-action="tag"]','Factions');
 assert.equal(await page.locator('[data-mkjb-tab="tag:quests"] small').textContent(),'1');
 await editTag('.mkjb-left [data-mkjb-action="tag"]','Mysteries');
 assert.equal(await page.evaluate(()=>book.tab),'all');await page.waitForSelector('.mkjb-journal-index');
 assert.equal(await page.locator('[data-mkjb-tab="tag:quests"]').count(),0);
 await editTag('.mkjb-right [data-mkjb-action="tag"]','');
 assert.equal(await page.evaluate(()=>book.pages[0].tag),'');
 assert.equal(await page.locator('[data-mkjb-tab="untagged"]').count(),0);
 assert.equal(await page.locator('.mkjb-index-page').count(),await count());
 assert.equal(await page.locator('[data-mkjb-tab="tag:mysteries"]').count(),0);
 // Many tags scroll along the book edge; long labels remain bounded with full tooltips.
 await page.evaluate(async()=>{
  const tags=['Locations','Factions','Characters','Quests','Clues','Sessions','A particularly long tag for our adventure','GM-only secret tag','Maps'];
  for(const [i,row]of book.pages.entries())await game.modules.get('mk-journal-book').api.setTag(row.uuid,tags[i],atlas.uuid);
 });await page.waitForTimeout(150);
 assert.equal(await page.locator('.mkjb-tab').count(),10);
 assert.equal(await page.locator('.mkjb-tabs').evaluate(el=>el.scrollHeight>el.clientHeight),true);
 await page.locator('[data-mkjb-tab="tag:sessions"]').click();await page.waitForTimeout(100);
 assert.deepEqual(await page.locator('.mkjb-page-title').allTextContents(),['Session I · The Arrival']);
 assert.equal(await page.locator('.mkjb-tab.active').evaluate(el=>{const r=el.getBoundingClientRect(),p=el.parentElement.getBoundingClientRect();return r.top>=p.top&&r.bottom<=p.bottom}),true);
 await page.locator('[data-mkjb-action="index"]').click();await page.waitForSelector('.mkjb-journal-index');
 if(process.env.MKJB_PREVIEW_DIR)await page.screenshot({path:path.join(process.env.MKJB_PREVIEW_DIR,'book-v040-tags.png')});
 // Observer cannot tag; a revoked source tag disappears immediately, including during rendering.
 await page.evaluate(()=>{game.user=fixtures.bob;Hooks.call('updateUser')});await page.waitForTimeout(100);
 assert.equal(await page.locator('[data-mkjb-action="tag"]').count(),0);
 assert.equal(await page.evaluate(async()=>{try{await game.modules.get('mk-journal-book').api.setTag(fixtures.harbor.uuid,'Denied',atlas.uuid);return false}catch{return true}}),true);
 assert.equal(await page.evaluate(()=>{fixtures.journal.pages[7].permissions.bob=0;Hooks.call('updateJournalEntryPage');return !document.querySelector('.mkjb-shell')?.textContent.includes('GM-only secret tag')}),true);
 await page.waitForTimeout(100);assert.equal(await page.locator('[data-mkjb-tab="tag:gm-only secret tag"]').count(),0);
 await page.evaluate(()=>{fixtures.journal.pages[7].permissions.bob=2;Hooks.call('updateJournalEntryPage')});await page.waitForTimeout(100);
 // Owners may tag readable members, but pending edits cannot outlive owner/source access.
 await page.evaluate(()=>{game.user=fixtures.alice;Hooks.call('updateUser')});await page.waitForTimeout(100);
 await editTag('.mkjb-right [data-mkjb-action="tag"]','Ports');
 assert.equal(await page.evaluate(()=>book.pages[0].tag),'Ports');
 await page.locator('.mkjb-right [data-mkjb-action="tag"]').click();await page.locator('dialog [name="pageTag"]').fill('Should not save');
 await page.evaluate(()=>{atlas.ownership.alice=2;Hooks.call('updateJournalEntry',atlas)});await page.locator('dialog button[type="submit"]').click();
 assert.equal(await page.evaluate(()=>book.pages[0].tag),'Ports');await page.locator('dialog [data-cancel]').click();
 await page.evaluate(()=>{game.user=fixtures.gm;Hooks.call('updateUser')});await page.waitForTimeout(100);
 assert.equal(await page.evaluate(async()=>{try{await game.modules.get('mk-journal-book').api.setTag(secondPage.uuid,'Not included',atlas.uuid);return false}catch{return true}}),true);
 // Reopen directly on a tag through the API, then ordinary reopening returns to the index.
 await page.evaluate(async()=>{await book.close();window.book=await game.modules.get('mk-journal-book').api.open({bookUUID:atlas.uuid,tag:'ports'})});
 assert.equal(await page.evaluate(()=>book.tab),'tag:ports');assert.equal(await page.locator('.mkjb-page-title').textContent(),'The Lantern Harbor');
 await page.evaluate(async()=>{await book.close();await book.render({force:true})});await page.waitForSelector('.mkjb-journal-index');
 // Compact scrolling works in every preset, including the bottom-most tag.
 await page.setViewportSize({width:800,height:600});await page.evaluate(()=>book.setPosition({left:15,top:15,width:770,height:540}));
 for(const [preset]of expectedPresets){await page.evaluate(preset=>atlas.setFlag('mk-journal-book','style',preset),preset);await page.waitForTimeout(100);await page.locator('[data-mkjb-tab="tag:sessions"]').click();await page.waitForTimeout(100);assert.equal(await page.locator('.mkjb-content').evaluate(el=>el.clientHeight>60),true);assert.equal(await page.locator('.mkjb-tabs').evaluate(el=>el.scrollWidth<=el.clientWidth),true)}
 if(process.env.MKJB_PREVIEW_DIR)await page.screenshot({path:path.join(process.env.MKJB_PREVIEW_DIR,'book-v040-tags-compact.png')});
 await page.locator('[data-mkjb-action="close"]').click();await page.waitForFunction(()=>!book._closing);
 assert.deepEqual(errors,[]);
 console.log('PASS: dynamic custom tag tabs, per-book tags, case folding, editing, clearing, filtering, scrolling, persistence and permission checks; five book presets, persistent style selection, font/artwork changes, themed flips, compact page-line index and navigation; duration slider and animation timing, personal ribbon bookmarks, editing/removal, permissions, launcher removal; animated page turns, cancellation and reduced motion; native journal creation, owners, independent books, legacy categories, permission revocation, legacy preservation; journal/page drops, sharing, deduplication, no automatic additions, invalid drops, per-leaf actions, spread navigation, privacy, revocation, floating position and compact layout.');
 } finally {await browser.close();server.close()}
})().catch(err=>{console.error(err);process.exit(1)});
