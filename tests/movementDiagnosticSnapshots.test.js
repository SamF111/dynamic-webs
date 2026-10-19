// D:/FoundryVTT/Data/modules/dynamic-webs/tests/movementDiagnosticSnapshots.test.js
// Purpose: Preserve the public diagnostic observer contract while removing redundant copies.
import test from 'node:test';
import assert from 'node:assert/strict';
import {WebMovementInteractionService} from '../scripts/interactions/WebMovementInteractionService.js';

test('retained diagnostic snapshots are immutable ordinary objects, independent across queries and reentrant observers', () => {
  const service = new WebMovementInteractionService({webRuntimeService:{queryStrands:()=>[]}});
  const snapshots=[];
  const request={from:{x:0,y:0},to:{x:0,y:0}};
  service.queryMovement({...request, diagnosticObserver:outer=>{
    snapshots.push(outer);
    assert.equal(Object.getPrototypeOf(outer.phases),Object.prototype);
    assert.equal(Object.getPrototypeOf(outer.counters),Object.prototype);
    assert.ok(Object.isFrozen(outer) && Object.isFrozen(outer.phases) && Object.isFrozen(outer.counters));
    assert.throws(()=>{outer.counters.queryCount=99;},TypeError);
    const retained=JSON.stringify(outer);
    service.queryMovement({...request,to:{x:1,y:0},diagnosticObserver:inner=>snapshots.push(inner)});
    assert.equal(JSON.stringify(outer),retained);
  }});
  assert.equal(snapshots.length,2);
  assert.notEqual(snapshots[0].phases,snapshots[1].phases);
  assert.notEqual(snapshots[0].counters,snapshots[1].counters);
  assert.equal(snapshots[0].counters.zeroDisplacementQueryCount,1);
  assert.equal(snapshots[1].counters.zeroDisplacementQueryCount,0);
  assert.equal(snapshots[1].counters.nonZeroDisplacementQueryCount,1);
  assert.deepEqual(Object.keys(snapshots[0].phases),['requestNormalisation','spatialNormalisation','spatialCandidateCollection','spatialCandidateFilterSort','preciseGeometry','resultConstruction','spatialTelemetry','queryTotal']);
  assert.equal(Object.keys(snapshots[0].counters).length,19);
  assert.equal(service.queryMovement(request),service.queryMovement({...request,diagnosticObserver(){throw Error('observer failure');}}));
});
