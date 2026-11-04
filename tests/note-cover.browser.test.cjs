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



 const setTime=async time=>{await page.evaluate(time=>{window.animations=document.querySelector('.mkjb-close-layer').getAnimations({subtree:true});for(const a of animations){a.pause();a.currentTime=time}},time);await page.waitForTimeout(40)};
 const toggleNotes=async hidden=>page.locator('.mkjb-close-layer .mkjb-note-area').evaluateAll((els,hidden)=>els.forEach(el=>{if(hidden)el.style.display='none';else el.style.removeProperty('display')}),hidden);
 const compareNotes=async(shouldBeVisible,label)=>{
  const shown=await page.screenshot();await toggleNotes(true);const hidden=await page.screenshot();await toggleNotes(false);
  if(process.env.MKJB_PREVIEW_DIR&&(!shown.equals(hidden)!==shouldBeVisible||label==='classic-sticky-close'))fs.writeFileSync(path.join(process.env.MKJB_PREVIEW_DIR,`book-v0131-${label}.png`),shown);
  assert.equal(!shown.equals(hidden),shouldBeVisible,`Notes must ${shouldBeVisible?'remain on the inside pages':'be fully behind the cover'}: ${label}`);
 };
 const shapes=[['parchment',{x:0,y:1},-20],['sticky',{x:.5,y:.5},12],['torn',{x:1,y:0},20]];
 for(const preset of ['classic','gothic','field','arcane','nautical'])for(const [style,position,rotation]of shapes){
  await page.evaluate(async({preset,style,position,rotation})=>{
   await game.settings.set('mk-journal-book','flipDuration',0);await atlas.setFlag('mk-journal-book','style',preset);
   for(const source of fixtures.journal.pages.slice(0,3))await game.modules.get('mk-journal-book').api.setNote(source.uuid,'The silver key is hidden beneath the lighthouse. Notes belong inside the book.',atlas.uuid,{style,title:'Interior note',position,rotation});
   book.selectedUUID=fixtures.journal.pages[1].uuid;await book.render({force:true});await game.settings.set('mk-journal-book','flipDuration',600);
  },{preset,style,position,rotation});await page.waitForTimeout(100);
  const saved=await page.evaluate(()=>JSON.stringify(atlas.getFlag('mk-journal-book','notes')));
  assert.equal(await page.locator('.mkjb-page-note').count(),2);
  await page.evaluate(()=>{void book.close()});await setTime(0);
  assert.equal(await page.locator('.mkjb-close-layer .mkjb-page-note').count(),2);
  await compareNotes(true,`${preset}-${style}-inside`);
  await setTime(700);await compareNotes(false,`${preset}-${style}-close`);
  assert.equal(await page.locator('.mkjb-close-cover .mkjb-page-note').count(),0);
  await page.evaluate(()=>animations.forEach(a=>a.finish()));await page.waitForFunction(()=>!book.rendered&&!book._closing);
  await page.evaluate(()=>{window.pendingOpening=book.render({force:true})});await page.waitForSelector('.mkjb-open-layer',{state:'attached'});await setTime(260);
  await compareNotes(false,`${preset}-${style}-open-cover`);
  await setTime(1000);await compareNotes(true,`${preset}-${style}-open-inside`);
  await page.evaluate(()=>animations.forEach(a=>a.finish()));await page.evaluate(()=>pendingOpening);
  assert.equal(await page.locator('.mkjb-page-note').count(),1);assert.equal(await page.evaluate(()=>JSON.stringify(atlas.getFlag('mk-journal-book','notes'))),saved);
 }
 assert.deepEqual(errors,[]);console.log('PASS: screenshot comparisons prove notes remain on inside pages, stay behind closed/opening covers across all five book presets and three note styles, preserve edge positions/tilt, and return without data changes.');
 } finally {await browser.close();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1});
