import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {BOOK_PRESETS, resolveBookPreset, presetOptions, coverURL} from '../scripts/presets.js';
import {buildJournalIndex, bookSequence} from '../scripts/core.js';
import {renderBook} from '../scripts/view.js';
test('presets have five distinct bundled background assets',()=>{
 assert.equal(Object.keys(BOOK_PRESETS).length,5);assert.equal(new Set(Object.values(BOOK_PRESETS).map(p=>p.image)).size,5);
 for(const [key,preset] of Object.entries(BOOK_PRESETS)){for(const image of [preset.image,preset.cover]){const asset=new URL('../assets/'+image,import.meta.url);assert.equal(existsSync(asset),true);assert.ok(readFileSync(asset,'utf8').includes('<svg'))}assert.ok(coverURL(key).endsWith(preset.cover))}
});
test('book override wins over default; invalid style flags safely inherit',()=>{
 assert.equal(resolveBookPreset('gothic','field'),'gothic');assert.equal(resolveBookPreset(null,'field'),'field');assert.equal(resolveBookPreset('url(evil)','gothic'),'gothic');assert.equal(resolveBookPreset('__proto__','bad'),'classic');assert.ok(presetOptions(null,{inherit:true}).includes('value="default" selected'));
});
test('page-line index keeps identities, names and physical page numbers within each journal',()=>{
 const rows=[{uuid:'p1',name:'Arrival',journal:'Atlas',journalUuid:'a'},{uuid:'p2',name:'Captain',journal:'Atlas',journalUuid:'a'},{uuid:'p3',name:'Arrival',journal:'Atlas',journalUuid:'b'}];
 const index=buildJournalIndex(rows);assert.equal(index.length,2);assert.deepEqual(index[0].pages,[{uuid:'p1',name:'Arrival',pageNumber:2},{uuid:'p2',name:'Captain',pageNumber:3}]);assert.equal(index[1].pages[0].pageNumber,4);
});
test('index escapes page names and preset attributes',()=>{
 const rows=[{uuid:'p',name:'<img src=x onerror=evil()>',journal:'<script>evil()</script>',journalUuid:'a'}];
 const sequence=bookSequence(rows,'all');const html=renderBook({title:'Book',pages:rows,filtered:sequence,leaves:[sequence[0]],tab:'all',isGM:false,preset:'" onmouseover="evil()'});
 assert.ok(html.includes('data-mkjb-style="classic"'));assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img src=x'));assert.ok(html.includes('class="mkjb-index-page"'));assert.ok(!html.includes('data-mkjb-action="appearance"'));
});
