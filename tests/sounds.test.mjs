import {test, afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BOOK_SOUNDS, BookSounds, soundVolume, registerSoundSettings} from '../scripts/sounds.js';
let controllers=[];
afterEach(()=>{controllers.forEach(c=>c.stop());controllers=[]});
function setup({load=async()=>{},play=async()=>{}}={}){
 const values={soundsEnabled:true,soundVolume:40,openSound:'open.wav',closeSound:'close.wav',flipSound:'flip.wav'};
 const events=[];const definitions=new Map();
 globalThis.game={audio:{locked:false,globalMute:false,interface:{}},settings:{get:(_id,key)=>values[key],register:(_id,key,options)=>definitions.set(key,options)}};
 globalThis.foundry={data:{fields:{NumberField:class {constructor(options){this.options=options}},FilePathField:class {constructor(options){this.options=options}}}},audio:{Sound:class {
  constructor(src,options){this.src=src;events.push({event:'create',src,context:options.context})}
  async load(options){events.push({event:'load',src:this.src,options});await load()}
  async play(options){events.push({event:'play',src:this.src,options});await play()}
  stop(){events.push({event:'stop',src:this.src})}
 }}};
 const controller=new BookSounds();controllers.push(controller);
 return {values,events,controller,definitions};
}
const settle=()=>new Promise(resolve=>setTimeout(resolve,10));
test('volume honors zero, clamps bounds and rejects corrupt stored values',()=>{
 assert.equal(soundVolume(0),0);assert.equal(soundVolume(40),.4);assert.equal(soundVolume(500),1);assert.equal(soundVolume(-10),0);
 for(const value of [NaN,Infinity,'60',null,undefined])assert.equal(soundVolume(value),.4);
});
test('bundled effects are valid, distinct PCM WAV files',()=>{
 const files=Object.values(BOOK_SOUNDS).map(({file})=>readFileSync(new URL('../assets/sounds/'+file,import.meta.url)));
 for(const data of files){assert.equal(data.toString('ascii',0,4),'RIFF');assert.equal(data.toString('ascii',8,12),'WAVE');assert.equal(data.readUInt16LE(20),1);assert.equal(data.readUInt16LE(22),1);assert.equal(data.readUInt32LE(24),44100);assert.equal(data.readUInt16LE(34),16);assert.ok(data.length>30000)}
 assert.equal(new Set(files.map(data=>data.toString('base64'))).size,3);
});
test('audio preferences are personal, paths are world audio file pickers',()=>{
 const {definitions}=setup();registerSoundSettings();
 assert.equal(definitions.get('soundsEnabled').scope,'client');assert.equal(definitions.get('soundVolume').scope,'client');
 assert.deepEqual(definitions.get('soundVolume').type.options,{nullable:false,integer:true,min:0,max:100,step:5});
 for(const {key,file} of Object.values(BOOK_SOUNDS)){const setting=definitions.get(key);assert.equal(setting.scope,'world');assert.deepEqual(setting.type.options.categories,['AUDIO']);assert.equal(setting.type.options.blank,true);assert.ok(setting.default.endsWith('/'+file))}
});
test('plays one local non-looping effect and stops it before the next',async()=>{
 const {controller,events}=setup();controller.play('open');await settle();controller.play('flip');await settle();
 assert.deepEqual(events.filter(e=>e.event==='play').map(e=>[e.src,e.options.volume,e.options.loop]),[['open.wav',.4,false],['flip.wav',.4,false]]);
 assert.equal(events.filter(e=>e.event==='stop'&&e.src==='open.wav').length,1);
 assert.ok(events.filter(e=>e.event==='create').every(e=>e.context===game.audio.interface));
});
test('disabled, muted, blank, unsafe, unknown and locked sounds stay silent',async()=>{
 const {controller,events,values}=setup();
 for(const patch of [{soundsEnabled:false},{soundVolume:0},{openSound:''},{openSound:'javascript:alert(1)'},{openSound:'data:audio/wav;base64,AA'}]){
  Object.assign(values,{soundsEnabled:true,soundVolume:40,openSound:'open.wav'},patch);controller.play('open');await settle();
 }
 Object.assign(values,{soundsEnabled:true,soundVolume:40,openSound:'open.wav'});game.audio.locked=true;controller.play('open');game.audio.locked=false;
 game.audio.globalMute=true;controller.play('open');game.audio.globalMute=false;controller.play('__proto__');await settle();assert.equal(events.length,0);
});
test('cancelled delays and loads cannot play stale effects',async()=>{
 let resolve;const gate=new Promise(r=>resolve=r);const {controller,events}=setup({load:()=>gate});
 controller.play('open',{delay:30});controller.stop();await new Promise(r=>setTimeout(r,40));assert.equal(events.length,0);
 controller.play('open');controller.stop();resolve();await settle();assert.equal(events.some(e=>e.event==='play'),false);
});
test('changing sound settings stops existing audio even after a book is closed',async()=>{
 const {controller,events,definitions}=setup();registerSoundSettings();controller.play('close');await settle();definitions.get('soundsEnabled').onChange(false);
 assert.equal(events.filter(e=>e.event==='stop').length,1);
});
test('audio load/play errors are contained and release the active sound',async()=>{
 const warn=console.warn;console.warn=()=>{};
 try{for(const stage of ['load','play']){const {controller,events}=setup({[stage]:async()=>{throw new Error('Unavailable audio')}});controller.play('open');await settle();assert.ok(events.some(e=>e.event==='stop'));assert.equal(controller._sound,null)}}finally{console.warn=warn}
});
test('separate books do not share audio instances',async()=>{
 const {controller,events}=setup();const other=new BookSounds();controllers.push(other);controller.play('open');other.play('open');await settle();controller.stop();
 assert.equal(events.filter(e=>e.event==='play').length,2);assert.notEqual(other._sound,null);
});
