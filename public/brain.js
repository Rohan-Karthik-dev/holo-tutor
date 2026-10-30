// How the app reaches Claude: through this app's own server (server.js),
// which holds the API key and the tutor's instructions.
import { landmarkFace, rigFromPoints } from './lips.js';
import { parseJSONText } from './prompt.js';

export const MIC_NOTE = '';
export const KEY_NEEDED = false;
export function getKey() { return ''; }
export function setKey() {}
export const CAN_CAMERA = true;

// history: [{role, text, image?: {dataURL, blob}}]; onText receives the whole answer so far.
export async function askBrain(history, { onText, signal, context }) {
  const recent = history.slice(-20);
  const messages = recent.map((m, i) => ({
    role: m.role,
    text: m.text,
    image: m.image && i >= recent.length - 4 ? m.image.dataURL : undefined,
    hadImage: Boolean(m.image),
  }));
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages, context }),
    signal,
  });
  if (!res.ok) {
    let msg = ''; try { msg = (await res.json()).error; } catch {}
    throw Object.assign(new Error(msg || `Server error ${res.status}`), { code: /API_KEY/.test(msg) ? 'no_key' : 'server' });
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '', full = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const evt = buf.slice(0, idx); buf = buf.slice(idx + 2);
      for (const line of evt.split('\n')) {
        if (!line.startsWith('data:')) continue;
        let data; try { data = JSON.parse(line.slice(5).trim()); } catch { continue; }
        if (data.type === 'content_block_delta' && data.delta?.type === 'text_delta') { full += data.delta.text; onText(full); }
        else if (data.type === 'error') throw new Error(data.error?.message || 'stream error');
      }
    }
  }
  return full;
}

// Returns a warning to show, or '' when everything is ready.
export async function checkBrain() {
  try {
    const h = await (await fetch('/api/health')).json();
    return h.hasKey ? '' : 'The server has no ANTHROPIC_API_KEY set, so answers will fail until it is.';
  } catch { return 'Can\'t reach the Holo Tutor server.'; }
}

export function errorHint(err) {
  return err.code === 'no_key' ? 'The server has no API key set yet.' : 'Please try asking again.';
}

// Finds the lips in the tutor's face photo: on-device face landmarks first, Claude as a fallback.
export async function locateFace(photo) {
  const m = await landmarkFace(photo.image);
  if (m) return m;
  try {
    const r = await fetch('/api/locate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ image: photo.dataURL }) });
    return r.ok ? rigFromPoints(await r.json()) : null;
  } catch { return null; }
}

// One-shot JSON answers (quizzes, recaps).
export async function askJSON(prompt) {
  const r = await fetch('/api/json', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt }) });
  if (!r.ok) throw Object.assign(new Error('server ' + r.status), { code: 'server' });
  return parseJSONText((await r.json()).text);
}

// Short video references for a topic: [{id?, url, title, channel?, minutes?, why, query?}]
export async function findVideos(ctx) {
  const r = await fetch('/api/videos', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(ctx) });
  if (!r.ok) throw new Error('server ' + r.status);
  return (await r.json()).videos || [];
}
export const CAN_EMBED = true;

export const CAN_WEB_IMAGES = true; // reference pictures load straight from Wikipedia

// Cloud voice through this server (needs GOOGLE_TTS_KEY on the server).
let ttsAvail = null;
export const cloudVoice = {
  keyed: false,
  available() { return (ttsAvail ||= fetch('/api/health').then((r) => r.json()).then((h) => Boolean(h.tts)).catch(() => false)); },
  async synth(text, opts) {
    const r = await fetch('/api/tts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, ...opts }) });
    if (!r.ok) throw new Error('voice ' + r.status);
    return r.blob();
  },
};

// Accounts: 'server' = email and password accounts that sync through this app's server;
// 'local' = learner profiles saved on this device (no server).
export const AUTH = 'server';
