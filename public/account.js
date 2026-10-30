// Holo Tutor — sign in / create account.
//  · Server version: email + password accounts (see auth.js); the learner's data syncs to the
//    account, so signing in on another phone brings back progress, badges and history.
//  · Standalone file / preview (no server): learner profiles saved on this device, each with
//    an avatar and an optional 4-digit PIN. Good for a family phone or a holo box at a showcase.
// Each account keeps its own copy of the learner's data; device settings (holo box, voice
// engine, API keys) stay shared.
import { AUTH } from './brain.js';

const LS = (k) => 'holotutor.' + k;
const lsGet = (k, d = null) => { try { const v = localStorage.getItem(LS(k)); return v == null ? d : JSON.parse(v); } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(LS(k), JSON.stringify(v)); } catch {} };
const lsDel = (k) => { try { localStorage.removeItem(LS(k)); } catch {} };

// What belongs to a learner (synced, per account) vs. to the device (shared).
export const DATA_KEYS = ['progress', 'funprog', 'lessons', 'qotd', 'twin', 'photo', 'rig', 'mouth', 'kind', 'photoLook', 'faceFrame', 'subject', 'level', 'voiceStyle', 'rate', 'bargeIn', 'wake'];
export const AVATARS = ['🧑‍🚀', '🦊', '🐼', '🦄', '🐯', '🤖', '🐙', '🦉', '🐬', '🦖', '🌟', '🎧'];

let active = lsGet('account', null); // { type: 'server'|'local', id, name, avatar, email? }
if (active && active.type !== AUTH) active = null; // a profile from the other kind of build
const nsKey = (k) => (active && DATA_KEYS.includes(k) ? `u.${active.id}.${k}` : k);

export const Account = {
  mode: AUTH,
  get active() { return active; },
  get firstName() { return active?.name ? active.name.split(' ')[0] : ''; },
  get guest() { return !active && lsGet('guest', false); },
  needsSignIn() { return !active && !lsGet('guest', false); },
  key: nsKey,                                    // storage key for app data
  continueAsGuest() { lsSet('guest', true); },
  profiles() { return lsGet('profiles', []); },  // local learner profiles
  changed: () => {},                              // set below: app calls it after saving learner data
};

// ---------- syncing (server accounts) ----------
let pushTimer = 0, pushing = false;
function collect() {
  const data = {};
  for (const k of DATA_KEYS) { const v = lsGet(nsKey(k)); if (v !== null) data[k] = v; }
  return data;
}
async function push() {
  if (!active || active.type !== 'server' || pushing) return;
  pushing = true;
  try {
    const updated = Date.now();
    const r = await fetch('/api/sync', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ data: collect(), updated }) });
    if (r.ok) lsSet(nsKey('syncedAt'), updated);
    else if (r.status === 401) signedOutElsewhere();
  } catch {} finally { pushing = false; }
}
Account.changed = (k) => {
  if (!active || active.type !== 'server' || (k && !DATA_KEYS.includes(k))) return;
  lsSet(`u.${active.id}.dirtyAt`, Date.now());
  clearTimeout(pushTimer); pushTimer = setTimeout(push, 2500);
};
Account.flush = () => { clearTimeout(pushTimer); return push(); };
function writeData(data) { for (const k of DATA_KEYS) { if (data && k in data) lsSet(nsKey(k), data[k]); } }
function signedOutElsewhere() { lsDel('account'); active = null; }

// Runs before the app reads its saved data: checks the session and brings down the newest copy.
Account.boot = async () => {
  if (!active || active.type !== 'server') return;
  const timeout = (ms) => new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms));
  try {
    const me = await Promise.race([fetch('/api/auth/me'), timeout(4000)]);
    if (me.status === 401) { signedOutElsewhere(); return; }
    if (!me.ok) return; // server trouble: carry on with what's on this device
    const { user } = await me.json();
    active = { ...active, name: user.name, avatar: user.avatar, email: user.email }; lsSet('account', active);
    const r = await Promise.race([fetch('/api/sync'), timeout(5000)]);
    if (!r.ok) return;
    const remote = await r.json();
    const localAt = Math.max(lsGet(`u.${active.id}.syncedAt`, 0) || 0, lsGet(`u.${active.id}.dirtyAt`, 0) || 0);
    if (remote?.data && (remote.updated || 0) > localAt) { writeData(remote.data); lsSet(`u.${active.id}.syncedAt`, remote.updated); }
    else if (localAt > (remote?.updated || 0)) push(); // this device has newer changes
  } catch { /* offline: use the copy on this device */ }
};

async function api(path, body) {
  let r;
  try { r = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) }); }
  catch { throw new Error("Can't reach the server. Check your connection."); }
  let j = {}; try { j = await r.json(); } catch {}
  if (!r.ok) throw new Error(j.error || `Something went wrong (${r.status}).`);
  return j;
}
// Copies what was done as a guest into a brand-new account, so nothing is lost.
function adoptGuestData(id) {
  for (const k of DATA_KEYS) { const v = lsGet(k); if (v !== null) lsSet(`u.${id}.${k}`, v); }
}
function activate(a) { active = a; lsSet('account', a); lsDel('guest'); }

// ---------- server accounts ----------
Account.signUp = async ({ name, email, password, avatar, keepGuest = true }) => {
  const { user } = await api('/api/auth/signup', { name, email, password, avatar });
  if (keepGuest) adoptGuestData(user.id);
  activate({ type: 'server', id: user.id, name: user.name, avatar: user.avatar, email: user.email });
  await push();
};
Account.signIn = async ({ email, password }) => {
  const { user } = await api('/api/auth/login', { email, password });
  activate({ type: 'server', id: user.id, name: user.name, avatar: user.avatar, email: user.email });
  await Account.boot();
};
Account.signOut = async () => {
  if (active?.type === 'server') {
    await Account.flush();
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch {}
    // a shared phone shouldn't keep someone else's data
    for (const k of [...DATA_KEYS, 'syncedAt', 'dirtyAt']) lsDel(`u.${active.id}.${k}`);
  }
  lsDel('account'); active = null;
};
Account.updateProfile = async ({ name, avatar }) => {
  if (!active) return;
  if (active.type === 'server') {
    const { user } = await api('/api/auth/profile', { name, avatar });
    activate({ ...active, name: user.name, avatar: user.avatar });
  } else {
    const list = Account.profiles().map((p) => (p.id === active.id ? { ...p, name: name || p.name, avatar: avatar || p.avatar } : p));
    lsSet('profiles', list);
    const me = list.find((p) => p.id === active.id);
    activate({ ...active, name: me.name, avatar: me.avatar });
  }
};

// ---------- learner profiles on this device ----------
async function pinHash(pin, salt) {
  const text = `${salt}:${pin}`;
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch { // very old browsers: a simple fallback (the PIN only guards against siblings, not attackers)
    let h = 2166136261; for (const c of text) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return 'f' + h.toString(16);
  }
}
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
Account.createProfile = async ({ name, avatar, pin, keepGuest = true }) => {
  name = String(name || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  if (!name) throw new Error('Please enter a name.');
  if (pin && !/^\d{4}$/.test(pin)) throw new Error('The PIN should be 4 digits.');
  const list = Account.profiles();
  if (list.length >= 12) throw new Error('This device already has 12 learners. Remove one first.');
  if (list.some((p) => p.name.toLowerCase() === name.toLowerCase())) throw new Error('There is already a learner with that name on this device.');
  const salt = newId();
  const p = { id: newId(), name, avatar: avatar || AVATARS[list.length % AVATARS.length], pin: pin ? { salt, hash: await pinHash(pin, salt) } : null, created: Date.now() };
  lsSet('profiles', [...list, p]);
  if (keepGuest && !list.length) adoptGuestData(p.id); // the first learner keeps what was done as a guest
  activate({ type: 'local', id: p.id, name: p.name, avatar: p.avatar });
};
Account.openProfile = async (id, pin) => {
  const p = Account.profiles().find((x) => x.id === id);
  if (!p) throw new Error('That learner was not found.');
  if (p.pin) {
    const t = lsGet('pinTries', {}), mine = (t[id] || []).filter((x) => Date.now() - x < 5 * 60e3);
    if (mine.length >= 5) throw new Error('Too many wrong PINs. Wait 5 minutes.');
    if (await pinHash(String(pin || ''), p.pin.salt) !== p.pin.hash) { mine.push(Date.now()); t[id] = mine; lsSet('pinTries', t); throw new Error('Wrong PIN. Try again.'); }
  }
  activate({ type: 'local', id: p.id, name: p.name, avatar: p.avatar });
};
Account.removeProfile = (id) => {
  lsSet('profiles', Account.profiles().filter((p) => p.id !== id));
  for (const k of DATA_KEYS) lsDel(`u.${id}.${k}`);
  if (active?.id === id) { lsDel('account'); active = null; }
};
