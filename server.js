// Holo Tutor — Phase 1 server
// Serves the web app and proxies tutoring requests to Claude (streaming),
// so the API key never reaches the phone.
//
//   ANTHROPIC_API_KEY=sk-ant-... node server.js
//
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { FACE_PROMPT } from './public/lips.js';
import { ttsRequest, googleSynth } from './public/tts.js';
import { handleAuth } from './auth.js';
import { tutorSystem, videoPrompt, videoQueryPrompt, cleanVideos, searchResultUrls, parseJSONText, WEB_SEARCH_TOOL } from './public/prompt.js';

const ROOT = fileURLToPath(new URL('./public/', import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY || '';
const MODEL = process.env.HOLO_MODEL || 'claude-sonnet-5-5';
const TTS_KEY = process.env.GOOGLE_TTS_KEY || ''; // optional: cloud voice for phones without Telugu/Hindi voices
const MAX_BODY = 12 * 1024 * 1024; // photos are resized client-side to ~1024px


const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
};

function sendJSON(res, status, obj) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error('too_large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// Client history -> Anthropic messages. Merges same-role neighbours so the
// conversation always alternates, and keeps images only where the client sent them.
function toAnthropic(raw) {
  const out = [];
  for (const m of (Array.isArray(raw) ? raw : []).slice(-24)) {
    const role = m?.role === 'assistant' ? 'assistant' : 'user';
    const content = [];
    if (role === 'user' && typeof m.image === 'string') {
      const match = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(m.image);
      if (match) content.push({ type: 'image', source: { type: 'base64', media_type: match[1], data: match[2] } });
    }
    let text = String(m?.text ?? '').slice(0, 4000).trim();
    if (m?.hadImage && !content.length) text += ' [The student showed a photo at this point.]';
    if (!text) text = content.length ? 'Please look at this.' : '...';
    content.push({ type: 'text', text });
    const prev = out[out.length - 1];
    if (prev && prev.role === role) prev.content.push(...content);
    else out.push({ role, content });
  }
  while (out.length && out[0].role !== 'user') out.shift();
  while (out.length && out[out.length - 1].role !== 'user') out.pop();
  return out;
}

function cleanContext(c) {
  const str = (v) => (typeof v === 'string' ? v.slice(0, 40) : undefined);
  return { subject: str(c?.subject), level: str(c?.level), lang: str(c?.lang), mode: str(c?.mode), name: str(c?.name)?.replace(/[^\p{L}\p{M}\s'.-]/gu, '').slice(0, 30),
    twin: c?.mode === 'twin' && c?.twin ? { name: String(c.twin.name || '').slice(0, 40), text: String(c.twin.text || '').slice(0, 9000) } : undefined };
}

// One-shot JSON tasks (quizzes, lesson recaps): returns the model's text for the client to parse.
async function handleJSON(req, res) {
  if (!API_KEY) return sendJSON(res, 500, { error: 'The server has no ANTHROPIC_API_KEY set.' });
  let body;
  try { body = JSON.parse(await readBody(req)); } catch (e) { return sendJSON(res, e.message === 'too_large' ? 413 : 400, { error: 'Bad request' }); }
  const prompt = String(body.prompt || '').slice(0, 12000);
  if (!prompt) return sendJSON(res, 400, { error: 'No prompt.' });
  const content = [];
  const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(body.image || '');
  if (m) content.push({ type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } });
  content.push({ type: 'text', text: prompt });
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 2500, messages: [{ role: 'user', content }] }),
  });
  if (!r.ok) return sendJSON(res, 502, { error: `AI service error (${r.status}).` });
  const j = await r.json();
  return sendJSON(res, 200, { text: (j.content || []).map((c) => c.text || '').join('') });
}

// Short video references: real YouTube videos found with web search, checked against
// the search results; falls back to suggested YouTube searches.
async function claudeJSON(body) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 1500, ...body }),
  });
  if (!r.ok) throw new Error('AI service error ' + r.status + ' ' + (await r.text()).slice(0, 300));
  return r.json();
}
async function handleVideos(req, res) {
  if (!API_KEY) return sendJSON(res, 500, { error: 'The server has no ANTHROPIC_API_KEY set.' });
  let body;
  try { body = JSON.parse(await readBody(req)); } catch { return sendJSON(res, 400, { error: 'Bad request' }); }
  const ctx = { topic: String(body.topic || '').slice(0, 80), subject: String(body.subject || '').slice(0, 30), level: String(body.level || '').slice(0, 30), lang: String(body.lang || '').slice(0, 10) };
  if (!ctx.topic) return sendJSON(res, 400, { error: 'No topic.' });
  try {
    const j = await claudeJSON({ messages: [{ role: 'user', content: videoPrompt(ctx) }], tools: [WEB_SEARCH_TOOL] });
    const text = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
    const videos = cleanVideos(parseJSONText(text), searchResultUrls(j.content));
    if (videos.length) return sendJSON(res, 200, { videos, kind: 'videos' });
  } catch (e) { console.warn('Video search failed:', e.message); }
  try {
    const j = await claudeJSON({ messages: [{ role: 'user', content: videoQueryPrompt(ctx) }] });
    const videos = cleanVideos(parseJSONText((j.content || []).map((c) => c.text || '').join('')));
    return sendJSON(res, 200, { videos, kind: 'searches' });
  } catch (e) { return sendJSON(res, 502, { error: 'Could not find videos.' }); }
}

// Cloud voice: returns MP3 for one sentence.
async function handleTTS(req, res) {
  if (!TTS_KEY) return sendJSON(res, 501, { error: 'No GOOGLE_TTS_KEY set on the server.' });
  let body;
  try { body = JSON.parse(await readBody(req)); } catch { return sendJSON(res, 400, { error: 'Bad request' }); }
  const text = String(body.text || '').trim();
  if (!text) return sendJSON(res, 400, { error: 'No text.' });
  try {
    const mp3 = await googleSynth(TTS_KEY, ttsRequest(text, { lang: String(body.lang || 'en-IN').slice(0, 10), style: String(body.style || 'Warm'), rate: +body.rate || 1 }));
    res.writeHead(200, { 'content-type': 'audio/mpeg', 'cache-control': 'no-store' });
    res.end(Buffer.from(mp3));
  } catch (e) { console.warn(e.message); sendJSON(res, 502, { error: e.message }); }
}

async function handleChat(req, res) {
  if (!API_KEY) return sendJSON(res, 500, { error: 'The server has no ANTHROPIC_API_KEY set.' });
  let body;
  try { body = JSON.parse(await readBody(req)); }
  catch (e) { return sendJSON(res, e.message === 'too_large' ? 413 : 400, { error: 'Bad request' }); }

  const messages = toAnthropic(body.messages);
  if (!messages.length) return sendJSON(res, 400, { error: 'No question received.' });

  const ctl = new AbortController();
  res.on('close', () => ctl.abort());

  let upstream;
  try {
    upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: ctl.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 1500, system: tutorSystem(cleanContext(body.context)), messages, stream: true }),
    });
  } catch (e) {
    if (ctl.signal.aborted) return;
    return sendJSON(res, 502, { error: 'Could not reach the AI service.' });
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '');
    console.error('Anthropic error', upstream.status, detail.slice(0, 500));
    return sendJSON(res, 502, { error: `AI service error (${upstream.status}).` });
  }

  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache',
    'x-accel-buffering': 'no',
  });
  Readable.fromWeb(upstream.body)
    .on('error', () => res.end())
    .pipe(res);
}

// Fallback lip finder: asks Claude for the mouth corners and lip midpoints in the tutor's face photo.
async function handleLocate(req, res) {
  if (!API_KEY) return sendJSON(res, 500, { error: 'The server has no ANTHROPIC_API_KEY set.' });
  let body;
  try { body = JSON.parse(await readBody(req)); } catch { return sendJSON(res, 400, { error: 'Bad request' }); }
  const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(body.image || '');
  if (!m) return sendJSON(res, 400, { error: 'No image.' });
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 1400, messages: [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } },
      { type: 'text', text: FACE_PROMPT },
    ] }] }),
  });
  if (!r.ok) return sendJSON(res, 502, { error: `AI service error (${r.status}).` });
  const j = await r.json();
  const text = (j.content || []).map((c) => c.text || '').join('');
  const found = /\{[\s\S]*\}/.exec(text);
  try { return sendJSON(res, 200, found ? JSON.parse(found[0]) : { found: false }); }
  catch { return sendJSON(res, 200, { found: false }); }
}

async function serveStatic(req, res) {
  const url = new URL(req.url, 'http://x');
  let p = decodeURIComponent(url.pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = normalize(join(ROOT, p));
  if (!file.startsWith(ROOT.endsWith(sep) ? ROOT : ROOT + sep)) { res.writeHead(403); return res.end(); }
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Not found');
  }
}

http.createServer((req, res) => {
  if (req.url.startsWith('/api/auth/') || req.url.split('?')[0] === '/api/sync') return handleAuth(req, res, { readBody, sendJSON }).catch((e) => {
    console.error(e);
    if (!res.headersSent) sendJSON(res, 500, { error: 'Server error.' }); else res.end();
  });
  if (req.method === 'POST' && req.url === '/api/chat') return handleChat(req, res).catch((e) => {
    console.error(e);
    if (!res.headersSent) sendJSON(res, 500, { error: 'Server error.' }); else res.end();
  });
  if (req.method === 'POST' && req.url === '/api/tts') return handleTTS(req, res).catch((e) => {
    console.error(e);
    if (!res.headersSent) sendJSON(res, 500, { error: 'Server error.' }); else res.end();
  });
  if (req.method === 'POST' && req.url === '/api/videos') return handleVideos(req, res).catch((e) => {
    console.error(e);
    if (!res.headersSent) sendJSON(res, 500, { error: 'Server error.' }); else res.end();
  });
  if (req.method === 'POST' && req.url === '/api/json') return handleJSON(req, res).catch((e) => {
    console.error(e);
    if (!res.headersSent) sendJSON(res, 500, { error: 'Server error.' }); else res.end();
  });
  if (req.method === 'POST' && req.url === '/api/locate') return handleLocate(req, res).catch((e) => {
    console.error(e);
    if (!res.headersSent) sendJSON(res, 500, { error: 'Server error.' }); else res.end();
  });
  if (req.method === 'GET' && req.url === '/api/health') return sendJSON(res, 200, { ok: true, hasKey: Boolean(API_KEY), model: MODEL, tts: Boolean(TTS_KEY) });
  if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res);
  res.writeHead(405); res.end();
}).listen(PORT, () => {
  console.log(`Holo Tutor running on http://localhost:${PORT}  (model: ${MODEL}${API_KEY ? '' : ', NO API KEY SET'})`);
});
