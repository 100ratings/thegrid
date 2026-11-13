import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ANIMALS,ALL,MASKS,parity,createLayout,frame,validateFrame,TARGET} from '../public/engine.js';
function neighbors(i,visible){return visible.filter(j=>Math.abs(Math.floor(i/5)-Math.floor(j/5))+Math.abs(i%5-j%5)===1);}
function after(starts,steps,mask){let positions=new Set(starts);for(let n=0;n<steps;n++)positions=new Set([...positions].flatMap(i=>neighbors(i,mask)));return positions;}
function seeded(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};}
test('all 80 category/force combinations, 40 shuffles each, retain 20 unique images and every allowed start',()=>{
 for(let category=0;category<4;category++)for(const animal of ANIMALS)for(let seed=1;seed<=40;seed++){
  const layout=createLayout(category,animal.id,seeded(seed));assert.equal(new Set(layout).size,20);assert.equal(layout[TARGET],animal.id);
  const starts=ANIMALS.filter(a=>a.category===category).map(a=>layout.indexOf(a.id));assert.ok(starts.every(i=>parity(i)===1));
  for(const count of [2,4,6,8,20,50]){const positions=after(starts,count,ALL);assert.ok([...positions].every(i=>MASKS[3].includes(i)));}
 }
});
test('every possible legal odd count/path preserves the next elimination and converges to the force',()=>{
 // Exact reachable-set fixed point: once a set repeats for the same odd parity,
 // every longer odd count is proven, including arbitrarily large counts
 let possible=new Set(ALL.filter(i=>parity(i)===1));
 for(let stage=3;stage<=6;stage++){
  const mask=MASKS[stage],next=MASKS[stage+1];const seen=new Set();let positions=possible;const union=new Set();
  for(let step=1;;step++){
   positions=after(positions,1,mask);assert.ok(positions.size>0);
   if(step%2===1){for(const i of positions){assert.ok(next.includes(i),`unsafe elimination at stage ${stage}, count ${step}, cell ${i}`);union.add(i);}
    const key=[...positions].sort((a,b)=>a-b).join(',');if(seen.has(key))break;seen.add(key);
   }
  }
  possible=union;
 }
 assert.deepEqual([...possible],[TARGET]);
});
test('every intermediate layout keeps legal moves from every possible occupied cell',()=>{
 for(let stage=2;stage<7;stage++){
  for(const i of MASKS[stage])assert.ok(neighbors(i,MASKS[stage]).length>0);
 }
});
test('frames reject malformed payloads and round-trip each stage for exact undo',()=>{
 const layout=createLayout(0,'zebra',seeded(42));for(let stage=0;stage<=7;stage++){const f=frame(stage,layout);assert.ok(validateFrame(f));assert.deepEqual(JSON.parse(JSON.stringify(f)),frame(stage,layout));}
 assert.equal(validateFrame({stage:99}),false);const bad=frame(2,layout);bad.layout[0]=bad.layout[1];assert.equal(validateFrame(bad),false);
 const badMask=frame(3,layout);badMask.visible.push(0);assert.equal(validateFrame(badMask),false);
});
