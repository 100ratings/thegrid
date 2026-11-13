import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handleAPI} from '../worker/http.js';
import {createLayout,frame} from '../public/engine.js';
function bucket(){const data=new Map();let seq=0;return {async get(key){const o=data.get(key);return o?{...o,json:async()=>JSON.parse(o.body)}:null;},async put(key,body,options){const existing=data.get(key);const h=options.onlyIf;if(h.get('If-Match')&&h.get('If-Match')!==existing?.httpEtag)return null;if(h.get('If-None-Match')==='*'&&existing)return null;const next={body,httpEtag:`"${++seq}"`};data.set(key,next);return next;}};}
const url='https://test.local/api/show/qa';const layout=createLayout(0,'zebra',()=>.42);
const req=(id,stage,baseRevision)=>new Request(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,frame:frame(stage,layout),baseRevision})});
test('new rooms begin in waiting and 100 simultaneous reads get the same saved frame',async()=>{
 const env={BUCKET:bucket()};const initial=await (await handleAPI(new Request(url),env)).json();assert.equal(initial.frame.stage,0);
 const published=await (await handleAPI(req('first',2,0),env)).json();assert.equal(published.revision,1);
 const results=await Promise.all(Array.from({length:100},async()=>await(await handleAPI(new Request(url),env)).json()));for(const result of results)assert.deepEqual(result,published);
});
test('unchanged polls return an empty 204, changed polls and late arrivals get the current frame',async()=>{
 const env={BUCKET:bucket()};await handleAPI(req('one',4,0),env);
 assert.equal((await handleAPI(new Request(url+'?since=1'),env)).status,204);
 const changed=await(await handleAPI(new Request(url+'?since=0'),env)).json();assert.deepEqual(changed.frame,frame(4,layout));
});
test('retries are idempotent, stale commands cannot overwrite newer state, and undo increments the revision',async()=>{
 const env={BUCKET:bucket()};await handleAPI(req('one',5,0),env);const retry=await(await handleAPI(req('one',5,0),env)).json();assert.equal(retry.revision,1);
 assert.equal((await handleAPI(req('stale',7,0),env)).status,409);
 const undo=await(await handleAPI(req('undo',4,1),env)).json();assert.equal(undo.revision,2);assert.deepEqual(undo.frame,frame(4,layout));
});
test('concurrent controllers cannot both publish against the same base revision',async()=>{
 const env={BUCKET:bucket()};const results=await Promise.all([handleAPI(req('a',2,0),env),handleAPI(req('b',3,0),env)]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
});
test('failed persistence never acknowledges success or advances the stored show',async()=>{
 const b=bucket();b.put=async()=>{throw Error('offline');};const env={BUCKET:b};assert.equal((await handleAPI(req('a',2,0),env)).status,503);assert.equal((await(await handleAPI(new Request(url),env)).json()).revision,0);
});
test('invalid frames, oversized messages and unsupported methods are rejected',async()=>{
 const env={BUCKET:bucket()};const bad=new Request(url,{method:'POST',body:JSON.stringify({id:'x',frame:{stage:8},baseRevision:0})});assert.equal((await handleAPI(bad,env)).status,400);
 assert.equal((await handleAPI(new Request(url,{method:'POST',body:'x'.repeat(7000)}),env)).status,413);
 assert.equal((await handleAPI(new Request(url,{method:'DELETE'}),env)).status,405);
});
