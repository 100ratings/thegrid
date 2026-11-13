import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {frame,createLayout,validateFrame} from '../public/engine.js';
const source=(await readFile(new URL('../worker/index.js',import.meta.url),'utf8')).replace("import { DurableObject } from 'cloudflare:workers';",'').replace("import {frame,validateFrame} from '../public/engine.js';",'').replace('export default {','const handler = {').replace('export class GridShow','class GridShow');
class FakeDO{constructor(ctx,env){this.ctx=ctx;this.env=env;}}
const GridShow=new Function('DurableObject','frame','validateFrame','WebSocketRequestResponsePair',source+'; return GridShow;')(FakeDO,frame,validateFrame,class{});
function socket(role='spectator'){let attachment={role,lastPublish:0};return {messages:[],send(s){this.messages.push(JSON.parse(s));},serializeAttachment(v){attachment=v;},deserializeAttachment(){return attachment;},close(){}};}
async function harness(saved){const sockets=[];let stored=saved;const ctx={storage:{async get(){return stored;},async put(k,v){stored=structuredClone(v);}},getWebSockets(){return sockets;},setWebSocketAutoResponse(){},blockConcurrencyWhile(fn){this.ready=fn();}};const show=new GridShow(ctx,{});await ctx.ready;return {show,ctx,sockets,stored:()=>stored};}
const layout=createLayout(2,'girafa',()=>.41);
test('one command fans out the same committed frame to 1000 spectators and confirms only after storage',async()=>{
 const h=await harness();const controller=socket('controller');h.sockets.push(controller,...Array.from({length:1000},()=>socket()));
 await h.show.webSocketMessage(controller,JSON.stringify({type:'publish',id:'a',frame:frame(2,layout)}));
 assert.equal(h.stored().revision,1);for(const ws of h.sockets)assert.deepEqual(ws.messages[0],h.stored());assert.equal(controller.messages.at(-1).type,'ack');
});
test('state survives a reconstructed instance and includes the current frame for late arrivals',async()=>{
 const h=await harness({type:'state',frame:frame(5,layout),revision:18});assert.deepEqual(h.show.snapshot.frame,frame(5,layout));assert.equal(h.show.snapshot.revision,18);
});
test('spectator messages and malformed frames cannot publish state',async()=>{
 const h=await harness();await h.show.webSocketMessage(socket(),JSON.stringify({type:'publish',id:'a',frame:frame(7,layout)}));assert.equal(h.show.snapshot.revision,0);
 const ws=socket('controller');await h.show.webSocketMessage(ws,JSON.stringify({type:'publish',id:'b',frame:{stage:7,layout:[],visible:[7]}}));assert.equal(ws.messages[0].type,'error');assert.equal(h.show.snapshot.revision,0);
});
test('failed persistence neither broadcasts nor acknowledges success',async()=>{
 const h=await harness();h.ctx.storage.put=async()=>{throw Error('disk');};const ws=socket('controller');const spectator=socket();h.sockets.push(ws,spectator);
 await h.show.webSocketMessage(ws,JSON.stringify({type:'publish',id:'failed',frame:frame(2,layout)}));assert.equal(h.show.snapshot.revision,0);assert.equal(spectator.messages.length,0);assert.equal(ws.messages[0].type,'error');assert.equal(ws.messages[0].id,'failed');
});
test('undo publishes the exact old arrangement with an increasing revision',async()=>{
 const h=await harness();const ws=socket('controller');h.sockets.push(ws);
 for(const [id,stage] of [[1,5],[2,4],[3,5]]){ws.serializeAttachment({role:'controller',lastPublish:0});await h.show.webSocketMessage(ws,JSON.stringify({type:'publish',id:String(id),frame:frame(stage,layout)}));assert.deepEqual(h.show.snapshot.frame,frame(stage,layout));assert.equal(h.show.snapshot.revision,id);}
});
