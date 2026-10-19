// D:/FoundryVTT/Data/modules/dynamic-webs/scripts/ui/releaseNotice.js
// Purpose: Deliver one private v1 introduction per GM in each world without requiring the companion module.
import {reportDiagnostic} from '../diagnostics/diagnosticReporter.js';
import {COMPANION} from './optionalCompanion.js';

export const RELEASE_NOTICE_KEY = 'v1CompanionNotice';
const pending = new WeakMap();

/** Called once at ready. A user flag survives browsers and deleted chat history. */
export function showReleaseNotice() {
  const game = globalThis.game;
  const user = game?.user;
  if (user?.isGM !== true || !user?.id || typeof user.getFlag !== 'function' || typeof user.setFlag !== 'function') {
    return Promise.resolve(false);
  }
  if (pending.has(user)) return pending.get(user);
  const task = deliverNotice(game, user).catch(error => {
    reportDiagnostic({code:'release-notice.failed',severity:'warn',
      message:'The private Dynamic Webs introduction could not be delivered or recorded.',
      context:{userId:user.id},error,
      nextAction:'It will retry after reloading. Dynamic Webs remains available.'});
    return false;
  }).finally(() => pending.delete(user));
  pending.set(user,task);
  return task;
}

async function deliverNotice(game,user) {
  if (user.getFlag('dynamic-webs',RELEASE_NOTICE_KEY)) return false;
  // If saving the user flag failed after creating the message, recover without
  // sending another copy. Only accept a private message authored by this user.
  const previous = game.messages?.contents?.some(message =>
    message.getFlag?.('dynamic-webs',RELEASE_NOTICE_KEY) === user.id &&
    (message.author?.id ?? message.user?.id ?? message.user) === user.id &&
    message.whisper?.length === 1 &&
    (message.whisper[0]?.id ?? message.whisper[0]) === user.id);
  if (!previous) {
    const Message = globalThis.CONFIG?.ChatMessage?.documentClass ??
      globalThis.foundry?.documents?.ChatMessage ?? globalThis.ChatMessage;
    if (typeof Message?.create !== 'function') throw new Error('Chat messages are unavailable.');
    const message = await Message.create({
      user:user.id, whisper:[user.id], blind:false,
      speaker:{alias:'Dynamic Webs'},
      content:'<h3>Welcome to Dynamic Webs 1.0</h3>' +
        '<p>Dynamic Webs was designed to work with Ambient Critters: small critters can become caught in webs, and spiders can interact with them.</p>' +
        '<p>Both modules work independently. Ambient Critters is free and entirely optional.</p>' +
        `<p><a href="${COMPANION.url}" target="_blank" rel="noopener noreferrer">Explore Ambient Critters</a></p>`,
      flags:{'dynamic-webs':{[RELEASE_NOTICE_KEY]:user.id}}
    });
    if (!message) throw new Error('The private message was not created.');
  }
  await user.setFlag('dynamic-webs',RELEASE_NOTICE_KEY,true);
  return !previous;
}
