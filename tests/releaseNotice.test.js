// D:/FoundryVTT/Data/modules/dynamic-webs/tests/releaseNotice.test.js
// Purpose: Protect private GM-only delivery, repeat suppression and failure recovery.
import test from 'node:test';
import assert from 'node:assert/strict';
import {showReleaseNotice,RELEASE_NOTICE_KEY} from '../scripts/ui/releaseNotice.js';

function setup(t,{failCreate=false,failFlag=false,cancelCreate=false}={}) {
  const saved={game:globalThis.game,CONFIG:globalThis.CONFIG,console:globalThis.console};
  t.after(()=>Object.assign(globalThis,saved));
  const flags=new Map(),messages=[],calls=[],warnings=[];
  const user={id:'gm-1',isGM:true,getFlag:(_scope,key)=>flags.get(key),
    async setFlag(_scope,key,value){if(failFlag)throw Error('flag unavailable');flags.set(key,value);}};
  globalThis.game={user,modules:new Map(),messages:{contents:messages}};
  globalThis.console={...console,warn:(...args)=>warnings.push(args)};
  globalThis.CONFIG={ChatMessage:{documentClass:{async create(data){
    calls.push(data);
    if(failCreate)throw Error('chat unavailable');
    if(cancelCreate)return null;
    const message={...data,author:{id:data.user},getFlag:(scope,key)=>data.flags[scope][key]};
    messages.push(message);return message;
  }}}};
  return {user,flags,messages,calls,warnings,recover(){failCreate=false;failFlag=false;cancelCreate=false;}};
}

test('standalone GM gets one self-whisper; repeat ready and concurrent calls do not duplicate it',async t=>{
  const h=setup(t);
  const results=await Promise.all([showReleaseNotice(),showReleaseNotice()]);
  assert.deepEqual(results,[true,true]);
  assert.equal(h.calls.length,1);
  assert.deepEqual(h.calls[0].whisper,['gm-1']);
  assert.equal(h.calls[0].user,'gm-1');
  assert.equal(h.calls[0].blind,false);
  assert.match(h.calls[0].content,/Both modules work independently/);
  assert.equal(h.flags.get(RELEASE_NOTICE_KEY),true);
  h.messages.length=0;
  assert.equal(await showReleaseNotice(),false);
  assert.equal(h.calls.length,1);
});
test('a second GM has an independent receipt',async t=>{
  const h=setup(t);await showReleaseNotice();
  const otherFlags=new Map();
  game.user={id:'gm-2',isGM:true,getFlag:(_s,k)=>otherFlags.get(k),setFlag:async(_s,k,v)=>otherFlags.set(k,v)};
  assert.equal(await showReleaseNotice(),true);
  assert.deepEqual(h.calls[1].whisper,['gm-2']);
});
test('failed creation is not marked delivered and retries safely',async t=>{
  const h=setup(t,{failCreate:true});
  assert.equal(await showReleaseNotice(),false);
  assert.equal(h.flags.has(RELEASE_NOTICE_KEY),false);
  assert.equal(h.warnings.length,1);
  h.recover();assert.equal(await showReleaseNotice(),true);
});
test('cancelled creation is not marked delivered',async t=>{
  const h=setup(t,{cancelCreate:true});await showReleaseNotice();
  assert.equal(h.flags.has(RELEASE_NOTICE_KEY),false);
});
test('flag failure recovers from a private existing message without resending',async t=>{
  const h=setup(t,{failFlag:true});assert.equal(await showReleaseNotice(),false);
  h.recover();assert.equal(await showReleaseNotice(),false);
  assert.equal(h.calls.length,1);
  assert.equal(h.flags.get(RELEASE_NOTICE_KEY),true);
});

test('players receive no whisper and no delivery flag; a later GM promotion can receive it',async t=>{
  const h=setup(t);
  h.user.isGM=false;
  h.user.getFlag=()=>{throw Error('Player receipt must not be read');};
  assert.equal(await showReleaseNotice(),false);
  assert.equal(h.calls.length,0);
  assert.equal(h.flags.size,0);
  assert.equal(h.warnings.length,0);
  h.user.isGM=true;
  h.user.getFlag=(_scope,key)=>h.flags.get(key);
  assert.equal(await showReleaseNotice(),true);
  assert.deepEqual(h.calls[0].whisper,['gm-1']);
});

test('missing or non-boolean GM status cannot trigger the notice',async t=>{
  const h=setup(t);
  for (const status of [undefined,null,0,1,'true']) {
    h.user.isGM=status;
    assert.equal(await showReleaseNotice(),false);
  }
  game.user=null;
  assert.equal(await showReleaseNotice(),false);
  assert.equal(h.calls.length,0);
  assert.equal(h.flags.size,0);
});
