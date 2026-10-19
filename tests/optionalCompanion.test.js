// D:/FoundryVTT/Data/modules/dynamic-webs/tests/optionalCompanion.test.js
// Purpose: Verify optional links work standalone and never treat an inactive installation as missing.
import test from 'node:test';
import assert from 'node:assert/strict';
import {activateOptionalCompanionLink,COMPANION} from '../scripts/ui/optionalCompanion.js';
test('standalone settings show one safe link and remove it if the companion is installed',t=>{
 const previous=globalThis.game;t.after(()=>{globalThis.game=previous;});
 globalThis.game={modules:new Map()};let inserted=null;
 const doc={createElement:tag=>({tag,children:[],setAttribute(k,v){this[k]=v;},append(...items){this.children.push(...items);},remove(){inserted=null;}})};
 const parent={insertBefore:element=>{inserted=element;}};
 const row={ownerDocument:doc,parentNode:parent,closest:()=>null};
 const root={querySelector:selector=>selector.startsWith('[data-')?inserted:{closest:()=>row}};
 assert.equal(activateOptionalCompanionLink(root),true);
 assert.equal(inserted.children[0].href,COMPANION.url);
 assert.equal(inserted.children[0].rel,'noopener noreferrer');
 assert.match(inserted.children[1].textContent,/independently/);
 assert.equal(activateOptionalCompanionLink(root),false);
 game.modules.set(COMPANION.id,{active:false});
 assert.equal(activateOptionalCompanionLink(root),false);
 assert.equal(inserted,null);
 game.modules.get(COMPANION.id).active=true;
 assert.equal(activateOptionalCompanionLink(root),false);
 assert.equal(activateOptionalCompanionLink({querySelector:()=>null}),false);
});
