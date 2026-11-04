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





 await page.evaluate(()=>{window.mkTestNativeDecode=HTMLImageElement.prototype.decode;HTMLImageElement.prototype.decode=()=>Promise.resolve()});
 const cases=[
  {style:'parchment',position:null,positionSpace:'page',rotation:null,detached:true,scale:0},
  {style:'sticky',position:{x:.75,y:.65},positionSpace:'page',rotation:12,detached:true,scale:.65},
  {style:'torn',position:{x:.2,y:.8},positionSpace:'content',rotation:-14,detached:false,scale:.7}
 ];
 const capture=()=>page.evaluate(()=>['left','right'].map((side,index)=>{
  const live=document.querySelector(`.mkjb-book > .mkjb-${side} .mkjb-page-note`),copy=document.querySelector(`.${index?'mkjb-close-stationary':'mkjb-close-inside'} .mkjb-page-note`);
  const value=el=>el?{left:el.style.left,top:el.style.top,transform:el.style.transform}:null;
  return {live:value(live),copy:value(copy)};
 }));
 for(const preset of ['classic','gothic','field','arcane','nautical'])for(const [index,options]of cases.entries()){
  await page.evaluate(async({preset,options,index})=>{
   window.mkTestMountScale=0;window.mkTestDetachedFirstRender=false;await game.settings.set('mk-journal-book','flipDuration',0);
   await atlas.setFlag('mk-journal-book','style',preset);
   for(const source of fixtures.journal.pages.slice(0,3))await game.modules.get('mk-journal-book').api.setNote(source.uuid,'Start at the saved position.\nStay still when the animation ends.',atlas.uuid,{style:options.style,title:'Opening check',position:options.position,positionSpace:options.positionSpace,rotation:options.rotation});
   await book.close({animate:false,sound:false});await game.settings.set('mk-journal-book','flipDuration',600);
   window.mkTestDetachedFirstRender=options.detached;window.mkTestMountScale=options.scale;
   if(index===2)book.selectedUUID=fixtures.journal.pages[1].uuid;
   window.pendingOpen=book.render({force:true});
  },{preset,options,index});
  await page.waitForSelector('.mkjb-open-layer',{state:'attached'});
  await page.evaluate(()=>{window.animations=document.querySelector('.mkjb-open-layer').getAnimations({subtree:true});for(const a of animations){a.pause();a.currentTime=400}});await page.waitForTimeout(50);
  const first=await capture();
  for(const pair of first){assert.deepEqual(pair.copy,pair.live,`First snapshot differs: ${preset}/${options.style}`);if(pair.copy){assert.ok(pair.copy.left&&pair.copy.top,'Initial note coordinates must already exist')}}
  // Window pop-in transforms must not affect the note's layout coordinates.
  await page.evaluate(()=>{window.mkTestMountScale=0;book.element.style.removeProperty('transform');for(const a of animations)a.currentTime=1000});await page.waitForTimeout(40);
  const snapshotRects=await page.evaluate(()=>['.mkjb-close-inside','.mkjb-close-stationary'].map(selector=>{const el=document.querySelector(selector+' .mkjb-page-note');if(!el)return null;const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}}));
  if(process.env.MKJB_PREVIEW_DIR&&preset==='classic'&&index===1)await page.screenshot({path:path.join(process.env.MKJB_PREVIEW_DIR,'book-v0132-note-opening-position.png')});
  await page.evaluate(()=>animations.forEach(a=>a.finish()));await page.evaluate(()=>pendingOpen);
  await page.evaluate(()=>book.render({force:true}));
  const after=await page.evaluate(()=>['left','right'].map(side=>{const el=document.querySelector(`.mkjb-book > .mkjb-${side} .mkjb-page-note`);if(!el)return null;const r=el.getBoundingClientRect();return {left:el.style.left,top:el.style.top,transform:el.style.transform,rect:{x:r.x,y:r.y,width:r.width,height:r.height}}}));
  for(let side=0;side<2;side++){
   if(!after[side]){assert.equal(first[side].copy,null);continue}
   const {rect,...position}=after[side];assert.deepEqual(first[side].copy,position,`Note jumps after opening: ${preset}/${options.style}`);
   for(const key of ['x','y','width','height'])assert.ok(Math.abs(snapshotRects[side][key]-rect[key])<1,`Snapshot and live note ${key} differ: ${preset}/${options.style}`);
  }
 }
 await page.evaluate(()=>{HTMLImageElement.prototype.decode=mkTestNativeDecode;window.mkTestDetachedFirstRender=false;window.mkTestMountScale=0});
 assert.deepEqual(errors,[]);console.log('PASS: initial opening snapshots match final note positions for detached HTML, cached covers, scaled windows, automatic/full-page/legacy placements, both leaves, all five presets and three note styles.');
 } finally {await browser.close();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1});
