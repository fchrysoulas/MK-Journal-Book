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
 const plays=()=>page.evaluate(()=>soundEvents.filter(e=>e.event==='play').map(e=>e.src));
 const clear=()=>page.evaluate(()=>{window.soundEvents=[]});
 const idle=()=>page.waitForFunction(()=>!book._opening&&!book._closing&&!book._turnPending);
 await page.evaluate(async()=>{game.user=fixtures.gm;await game.modules.get('mk-journal-book').api.addJournal('JournalEntry.J');await book.render({force:true});await book.close({animate:false,sound:false});soundEvents=[];await game.settings.set('mk-journal-book','flipDuration',200)});
 // Open sound is delayed until unfolding, plays once, and refresh does not replay it.
 await page.evaluate(()=>{window.openDone=book.render({force:true});void book.render({force:true})});
 await page.waitForSelector('.mkjb-open-layer');assert.equal((await plays()).length,0);
 await page.evaluate(()=>openDone);await idle();
 assert.deepEqual((await plays()).map(s=>s.split('/').at(-1)),['book-open.wav']);
 await page.evaluate(()=>book.render({force:true}));await page.locator('[data-mkjb-action="refresh"]').click();await page.waitForTimeout(100);assert.equal((await plays()).length,1);
 await clear();await page.locator('[data-mkjb-action="previous"]').evaluate(el=>el.click());assert.equal((await plays()).length,0);
 await page.locator('[data-mkjb-action="next"]').click();await page.waitForSelector('.mkjb-turn-layer');await page.evaluate(()=>book.handleAction('next'));await idle();
 assert.deepEqual((await plays()).map(s=>s.split('/').at(-1)),['page-flip.wav']);
 await clear();await page.evaluate(()=>{window.closing=book.close();void book.close()});await page.evaluate(()=>closing);await idle();
 assert.deepEqual((await plays()).map(s=>s.split('/').at(-1)),['book-close.wav']);
 await clear();await page.evaluate(()=>book.turnPage('next'));await page.waitForTimeout(30);assert.deepEqual(await plays(),[]);
 // Reduced motion and instant animations retain sound; client mute and blank paths silence it.
 await page.emulateMedia({reducedMotion:'reduce'});await clear();await page.evaluate(()=>book.render({force:true}));await page.waitForTimeout(30);assert.equal((await plays()).length,1);
 await page.evaluate(async()=>{await game.settings.set('mk-journal-book','soundVolume',70);await game.settings.set('mk-journal-book','flipSound','worlds/campaign/paper.ogg');soundEvents=[]});
 await page.locator('[data-mkjb-action="next"]').click();await page.waitForTimeout(80);
 assert.deepEqual(await plays(),['worlds/campaign/paper.ogg']);assert.equal(await page.evaluate(()=>soundEvents.find(e=>e.event==='play').volume),.7);
 await page.evaluate(async()=>{await game.settings.set('mk-journal-book','soundsEnabled',false);soundEvents=[]});
 await page.evaluate(async()=>{await book.close();await book.render({force:true});await book.turnPage('next')});await page.waitForTimeout(70);assert.deepEqual(await plays(),[]);
 await page.evaluate(async()=>{await game.settings.set('mk-journal-book','soundsEnabled',true);await game.settings.set('mk-journal-book','flipSound','');soundEvents=[];await book.turnPage('previous')});await page.waitForTimeout(80);assert.deepEqual(await plays(),[]);
 await page.evaluate(async()=>{await book.close({animate:false,sound:false});game.audio.locked=true;soundEvents=[];await book.render({force:true});game.audio.locked=false});await page.waitForTimeout(70);assert.deepEqual(await plays(),[]);
 // Sound:false suppresses explicit API operations without changing reader preferences.
 await page.evaluate(async()=>{soundEvents=[];await book.close({sound:false});await book.render({force:true,sound:false})});await page.waitForTimeout(50);assert.deepEqual(await plays(),[]);
 // A close during the opening hold cancels its delayed audio; only close is heard.
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.evaluate(async()=>{await book.close({animate:false,sound:false});soundEvents=[];window.openDone=book.render({force:true})});await page.waitForSelector('.mkjb-open-layer');
 await page.evaluate(()=>book.close());await page.evaluate(()=>openDone);await page.waitForTimeout(500);
 assert.deepEqual((await plays()).map(s=>s.split('/').at(-1)),['book-close.wav']);
 // A slow load cannot start after its owning action is cancelled.
 await page.evaluate(async()=>{await game.settings.set('mk-journal-book','flipDuration',0);window.soundLoadGate=new Promise(r=>window.releaseSoundLoad=r);soundEvents=[];await book.render({force:true});await book.close({sound:false});releaseSoundLoad();window.soundLoadGate=null});await page.waitForTimeout(100);assert.deepEqual(await plays(),[]);
 // Missing files and rejected playback never reject book operations or leave the UI inert.
 for(const failure of ['failSoundLoad','failSoundPlay']){
  await page.evaluate(async failure=>{window[failure]=true;await book.render({force:true});await book.turnPage('next')},failure);await page.waitForTimeout(100);
  assert.equal(await page.evaluate(()=>book.rendered&&!book.element.inert),true);
  await page.evaluate(async failure=>{await book.close();window[failure]=false},failure);
 }
 // Revoked native-book access stops audio without playing a close sound.
 await page.evaluate(async()=>{
  window.ownedBook=await CONFIG.JournalEntry.documentClass.create({name:'Audio book',flags:{core:{sheetClass:'mk-journal-book.MKJournalBookSheet'},'mk-journal-book':{book:true,pages:[fixtures.harbor.uuid],tagVersion:1}},ownership:{default:0,alice:3}});
  game.user=fixtures.alice;window.book=ownedBook.sheet;await book.render({force:true});soundEvents=[];ownedBook.ownership.alice=0;Hooks.call('updateJournalEntry',ownedBook);
 });await page.waitForTimeout(80);assert.equal(await page.locator('.mk-journal-book').count(),0);assert.deepEqual(await plays(),[]);
 // Decode all three actual WAVs with the browser audio engine; assert signal and headroom.
 const decoded=await page.evaluate(async()=>{
  const context=new AudioContext();const results=[];
  try{for(const file of ['book-open.wav','book-close.wav','page-flip.wav']){
   const response=await fetch('../assets/sounds/'+file);if(!response.ok)throw new Error('Missing '+file);
   const buffer=await context.decodeAudioData(await response.arrayBuffer());const data=buffer.getChannelData(0);
   let peak=0,sum=0;for(const x of data){peak=Math.max(peak,Math.abs(x));sum+=x*x}
   results.push({file,duration:buffer.duration,peak,rms:Math.sqrt(sum/data.length)});
  }}finally{await context.close()}return results;
 });
 assert.equal(decoded.length,3);for(const sound of decoded){assert.ok(sound.duration>.3&&sound.duration<1);assert.ok(sound.peak>.1&&sound.peak<.95);assert.ok(sound.rms>.02)}
 assert.deepEqual(errors,[]);
 console.log('PASS: local open/close/flip sounds; delayed opening, repeat guards, silent refresh, disabled navigation, mute/volume/custom/blank paths, reduced motion, explicit silence, locked audio, interrupted/slow loads, playback failures, permission revocation and browser decoding of all WAV assets.');
 } finally {await browser.close();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1});
