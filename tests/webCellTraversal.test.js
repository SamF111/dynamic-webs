// D:/FoundryVTT/Data/modules/dynamic-webs/tests/webCellTraversal.test.js
// Purpose: protect spatial cell traversal boundaries, duplicates and immediate
// geometry changes without depending on Ambient Critters or a browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import {WebSpatialIndex} from '../scripts/spatial/WebSpatialIndex.js';

function web(id,x,y,width=40,height=20) {
  return {id,sceneId:'scene',populationId:'population',kind:'wall-span',levelId:'base',
    elevationBand:{bottom:0,top:9},bounds:{x,y,width,height},regionIds:[],regionTags:[],perches:[],
    strands:[{id:`${id}:strand`,kind:'capture',collisionWidthPx:4,points:[{x,y},{x:x+width,y:y+height}]}]};
}

test('direct cell traversal agrees with broad single-cell candidates over boundaries and negative coordinates',()=>{
  const webs=[web('negative',-210,-205),web('origin',-10,-10),web('boundary',200,200),web('long',-300,20,1000,0)];
  const narrow=new WebSpatialIndex({cellSizePx:20});
  const broad=new WebSpatialIndex({cellSizePx:1000000});
  narrow.rebuild(webs); broad.rebuild(webs);
  let seed=19;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  for(let i=0;i<300;i++) {
    const bounds={x:Math.floor(random()*1000)-400,y:Math.floor(random()*600)-300,width:random()*210,height:random()*210};
    const options={categories:['wall-span'],elevation:0,limit:i%3===0?1:1000};
    assert.deepEqual(narrow.queryStrands(bounds,options),broad.queryStrands(bounds,options));
    const visited=[]; const diagnostics={};
    narrow.visitStrands(bounds,options,entry=>visited.push(entry.strandId),diagnostics);
    assert.deepEqual(visited,narrow.queryStrands(bounds,options).map(entry=>entry.strandId));
    assert.equal(new Set(visited).size,visited.length);
  }
});

test('a missed query immediately observes rebuild, destruction, restoration and clear',()=>{
  const index=new WebSpatialIndex({cellSizePx:20});
  const bounds={x:0,y:0,width:50,height:50}; const options={categories:['wall-span'],intactOnly:true};
  index.rebuild([web('distant',1000,1000)]);
  assert.equal(index.queryStrands(bounds,options).length,0);
  index.rebuild([web('near',10,10)]);
  assert.equal(index.queryStrands(bounds,options).length,1);
  index.setWebIntact('near',false);
  assert.equal(index.queryStrands(bounds,options).length,0);
  assert.equal(index.queryStrands(bounds,{...options,intactOnly:false}).length,1);
  index.setWebIntact('near',true);
  assert.equal(index.queryStrands(bounds,options).length,1);
  index.clear();
  assert.equal(index.queryStrands(bounds,options).length,0);
});

test('multi-cell duplicates and empty visits retain diagnostic accounting',()=>{
  const index=new WebSpatialIndex({cellSizePx:20});
  index.rebuild([web('long',-100,0,400,0)]);
  const diagnostics={}; const visited=[];
  assert.equal(index.visitStrands({x:-100,y:-2,width:400,height:4},{},entry=>visited.push(entry.strandId),diagnostics),1);
  assert.deepEqual(visited,['long:strand']);
  assert.ok(diagnostics.duplicateRejectedCandidateCount>0);
  assert.equal(diagnostics.cellCandidateCount,1);
  const empty={};
  assert.equal(index.visitStrands({x:5000,y:5000,width:10,height:10},{},()=>assert.fail('unexpected visit'),empty),0);
  assert.equal(empty.cellCandidateCount,0);
  assert.equal(empty.duplicateRejectedCandidateCount,0);
  assert.equal(index.lastQuery.candidateCount,0);
  assert.throws(()=>index.queryStrands({x:NaN,y:0,width:10,height:10}),TypeError);
});
