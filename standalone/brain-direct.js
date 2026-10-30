// Standalone build: talks to the Claude API straight from the browser with the
// person's own API key (kept only in this browser). No server needed, so the page
// can be hosted anywhere with HTTPS (Netlify Drop, GitHub Pages) and the mic works.
import { landmarkFace, rigFromPoints, FACE_PROMPT } from '../public/lips.js';
import { ttsRequest, googleSynth } from '../public/tts.js';
import { tutorSystem, parseJSONText, videoPrompt, videoQueryPrompt, cleanVideos, searchResultUrls, WEB_SEARCH_TOOL } from '../public/prompt.js';
export const CAN_CAMERA = true;
export const MIC_NOTE = '';
export const KEY_NEEDED = true;
const KEY_NAME = 'holotutor.apiKey';
const MODEL = 'claude-sonnet-5-5';
export function getKey() { try { return localStorage.getItem(KEY_NAME) || ''; } catch { return ''; } }
export function setKey(k) { try { if (k) localStorage.setItem(KEY_NAME, k); else localStorage.removeItem(KEY_NAME); } catch {} }


function toMessages(history) {
  const recent = history.slice(-20);
  const out = [];
  recent.forEach((m, i) => {
    const role = m.role === 'assistant' ? 'assistant' : 'user';
    const content = [];
    if (role === 'user' && m.image && i >= recent.length - 4) {
      const match = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/.exec(m.image.dataURL);
      if (match) content.push({ type: 'image', source: { type: 'base64', media_type: match[1], data: match[2] } });
    }
    let text = (m.text || '').trim();
    if (m.image && !content.length) text += ' [The student showed a photo at this point.]';
    content.push({ type: 'text', text: text || (content.length ? 'Please look at this.' : '...') });
    const prev = out[out.length - 1];
    if (prev && prev.role === role) prev.content.push(...content); else out.push({ role, content });
  });
  while (out.length && out[0].role !== 'user') out.shift();
  while (out.length && out[out.length - 1].role !== 'user') out.pop();
  return out;
}

export async function askBrain(history, { onText, signal, context }) {
  const key = getKey();
  if (!key) throw Object.assign(new Error('no key'), { code: 'no_key' });
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', signal,
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model: MODEL, max_tokens: 1500, system: tutorSystem(context), messages: toMessages(history), stream: true }),
  });
  if (!res.ok) {
    const code = res.status === 401 ? 'bad_key' : res.status === 429 ? 'rate_limited' : 'server';
    throw Object.assign(new Error('API ' + res.status), { code });
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

export async function checkBrain() { return getKey() ? '' : 'Add your Anthropic API key below to start.'; }

export function errorHint(err) {
  return err.code === 'no_key' ? 'Add your API key on the home screen first.'
    : err.code === 'bad_key' ? 'That API key was refused. Check it on the home screen.'
    : err.code === 'rate_limited' ? 'Give me a few seconds, then ask again.'
    : 'Check your internet connection and ask again.';
}

function parseJSON(t) { const m = /\{[\s\S]*\}/.exec(t || ''); try { return m ? JSON.parse(m[0]) : null; } catch { return null; } }

export async function locateFace(photo) {
  const m = await landmarkFace(photo.image);
  if (m || !getKey()) return m;
  try {
    const data = /^data:(image\/[a-z]+);base64,(.+)$/.exec(photo.dataURL);
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': getKey(), 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: MODEL, max_tokens: 1400, messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: data[1], data: data[2] } },
        { type: 'text', text: FACE_PROMPT },
      ] }] }),
    });
    if (!res.ok) return null;
    const j = await res.json();
    return rigFromPoints(parseJSON(j.content?.map((c) => c.text || '').join('')));
  } catch { return null; }
}

export async function askJSON(prompt) {
  const key = getKey();
  if (!key) throw Object.assign(new Error('no key'), { code: 'no_key' });
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({ model: MODEL, max_tokens: 2500, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw Object.assign(new Error('API ' + res.status), { code: res.status === 401 ? 'bad_key' : 'server' });
  const j = await res.json();
  return parseJSONText((j.content || []).map((c) => c.text || '').join(''));
}

async function direct(body) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': getKey(), 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({ model: MODEL, max_tokens: 1500, ...body }),
  });
  if (!res.ok) throw new Error('API ' + res.status);
  return res.json();
}
export async function findVideos(ctx) {
  if (!getKey()) throw Object.assign(new Error('no key'), { code: 'no_key' });
  try {
    const j = await direct({ messages: [{ role: 'user', content: videoPrompt(ctx) }], tools: [WEB_SEARCH_TOOL] });
    const text = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
    const videos = cleanVideos(parseJSONText(text), searchResultUrls(j.content));
    if (videos.length) return videos;
  } catch (e) { console.warn('Video search failed', e); }
  const j = await direct({ messages: [{ role: 'user', content: videoQueryPrompt(ctx) }] });
  return cleanVideos(parseJSONText((j.content || []).map((c) => c.text || '').join('')));
}
export const CAN_EMBED = true;

export const CAN_WEB_IMAGES = true; // reference pictures load straight from Wikipedia

// Cloud voice straight from the browser with a Google Cloud Text-to-Speech key (kept on this device).
const TTS_KEY_NAME = 'holotutor.ttsKey';
export const cloudVoice = {
  keyed: true,
  getKey() { try { return localStorage.getItem(TTS_KEY_NAME) || ''; } catch { return ''; } },
  setKey(k) { try { if (k) localStorage.setItem(TTS_KEY_NAME, k); else localStorage.removeItem(TTS_KEY_NAME); } catch {} },
  async available() { return Boolean(this.getKey()); },
  async synth(text, opts) { return new Blob([await googleSynth(this.getKey(), ttsRequest(text, opts))], { type: 'audio/mpeg' }); },
};

// Accounts: 'server' = email and password accounts that sync through this app's server;
// 'local' = learner profiles saved on this device (no server).
export const AUTH = 'local';
