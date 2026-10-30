// Holo Tutor — accounts for the server version (no extra packages).
// Sign up / sign in with email and password, a session cookie, and per-account
// sync of the learner's data (progress, badges, lesson history, settings).
//
// Passwords: scrypt with a random salt per user, compared in constant time.
// Sessions: a random 32-byte token in an HttpOnly, SameSite=Lax cookie; only its
// SHA-256 is stored on the server. Data lives in DATA_DIR (default ./data) as JSON.
import { randomBytes, scrypt as scryptCb, timingSafeEqual, createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb);
const DATA_DIR = process.env.DATA_DIR || fileURLToPath(new URL('./data/', import.meta.url));
const SESSION_DAYS = 30;
const MAX_SYNC = 4 * 1024 * 1024; // the learner's data, including a face photo
const COOKIE = 'ht_session';

let db = null; // { users: {id: user}, byEmail: {email: id}, sessions: {tokenHash: {uid, exp}} }
const sha = (s) => createHash('sha256').update(s).digest('hex');
const now = () => Date.now();

async function load() {
  if (db) return db;
  await mkdir(join(DATA_DIR, 'userdata'), { recursive: true });
  try { db = JSON.parse(await readFile(join(DATA_DIR, 'accounts.json'), 'utf8')); } catch { db = {}; }
  db.users ||= {}; db.byEmail ||= {}; db.sessions ||= {};
  return db;
}
let saving = Promise.resolve();
function save() { // atomic: write a temp file, then rename over the old one
  saving = saving.then(async () => {
    const f = join(DATA_DIR, 'accounts.json'), tmp = f + '.' + process.pid + '.tmp';
    await writeFile(tmp, JSON.stringify(db), { mode: 0o600 });
    await rename(tmp, f);
  }).catch((e) => console.error('accounts save failed', e));
  return saving;
}

async function hashPassword(password, salt) { return (await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 })).toString('hex'); }

// --- tiny rate limit for sign-in attempts: 10 tries per 15 minutes per IP + email ---
const tries = new Map();
function limited(key) {
  const t = now(), list = (tries.get(key) || []).filter((x) => t - x < 15 * 60e3);
  tries.set(key, list);
  return list.length >= 10;
}
function noteTry(key) { const l = tries.get(key) || []; l.push(now()); tries.set(key, l); }

function cookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('='); if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
const secure = (req) => req.headers['x-forwarded-proto'] === 'https' || req.socket?.encrypted;
function setSession(req, res, token, maxAge) {
  res.setHeader('set-cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure(req) ? '; Secure' : ''}`);
}
async function newSession(req, res, uid) {
  const token = randomBytes(32).toString('base64url');
  db.sessions[sha(token)] = { uid, exp: now() + SESSION_DAYS * 864e5 };
  for (const [k, s] of Object.entries(db.sessions)) if (s.exp < now()) delete db.sessions[k]; // tidy up
  await save();
  setSession(req, res, token, SESSION_DAYS * 86400);
}
export async function currentUser(req) {
  await load();
  const token = cookies(req)[COOKIE];
  if (!token) return null;
  const s = db.sessions[sha(token)];
  if (!s || s.exp < now()) return null;
  return db.users[s.uid] || null;
}
const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, avatar: u.avatar || '🧑‍🚀', created: u.created });

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
function clean(body) {
  return {
    name: String(body?.name || '').trim().replace(/\s+/g, ' ').slice(0, 40),
    email: String(body?.email || '').trim().toLowerCase().slice(0, 254),
    password: String(body?.password || ''),
    avatar: String(body?.avatar || '').slice(0, 16),
  };
}

// Handles /api/auth/* and /api/sync. Returns true when it answered the request.
export async function handleAuth(req, res, { readBody, sendJSON }) {
  const path = req.url.split('?')[0];
  if (!path.startsWith('/api/auth/') && path !== '/api/sync') return false;
  await load();
  const body = async () => { try { return JSON.parse(await readBody(req) || '{}'); } catch { return null; } };
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();

  if (req.method === 'POST' && path === '/api/auth/signup') {
    const b = await body(); if (!b) return sendJSON(res, 400, { error: 'Bad request.' }), true;
    const { name, email, password, avatar } = clean(b);
    if (!name) return sendJSON(res, 400, { error: 'Please enter your name.' }), true;
    if (!EMAIL_RE.test(email)) return sendJSON(res, 400, { error: 'Please enter a valid email address.' }), true;
    if (password.length < 8 || password.length > 200) return sendJSON(res, 400, { error: 'Use a password of at least 8 characters.' }), true;
    if (limited('signup:' + ip)) return sendJSON(res, 429, { error: 'Too many tries. Please wait a few minutes.' }), true;
    noteTry('signup:' + ip);
    if (db.byEmail[email]) return sendJSON(res, 409, { error: 'An account with this email already exists. Try signing in.' }), true;
    const salt = randomBytes(16).toString('hex');
    const user = { id: randomUUID(), name, email, avatar: avatar || '🧑‍🚀', salt, hash: await hashPassword(password, salt), created: now() };
    db.users[user.id] = user; db.byEmail[email] = user.id;
    await newSession(req, res, user.id);
    sendJSON(res, 200, { user: publicUser(user) });
    return true;
  }

  if (req.method === 'POST' && path === '/api/auth/login') {
    const b = await body(); if (!b) return sendJSON(res, 400, { error: 'Bad request.' }), true;
    const { email, password } = clean(b);
    const key = 'login:' + ip + ':' + email;
    if (limited(key)) return sendJSON(res, 429, { error: 'Too many tries. Please wait 15 minutes and try again.' }), true;
    const user = db.users[db.byEmail[email]];
    // hash even when the account doesn't exist, so timing doesn't reveal which emails are registered
    const got = Buffer.from(await hashPassword(password, user?.salt || 'x'.repeat(32)), 'hex');
    const ok = user && timingSafeEqual(got, Buffer.from(user.hash, 'hex'));
    if (!ok) { noteTry(key); return sendJSON(res, 401, { error: 'Wrong email or password.' }), true; }
    tries.delete(key);
    await newSession(req, res, user.id);
    sendJSON(res, 200, { user: publicUser(user) });
    return true;
  }

  if (req.method === 'POST' && path === '/api/auth/logout') {
    const token = cookies(req)[COOKIE];
    if (token) { delete db.sessions[sha(token)]; await save(); }
    setSession(req, res, '', 0);
    sendJSON(res, 200, { ok: true });
    return true;
  }

  const user = await currentUser(req);
  if (req.method === 'GET' && path === '/api/auth/me') {
    sendJSON(res, user ? 200 : 401, user ? { user: publicUser(user) } : { error: 'Not signed in.' });
    return true;
  }
  if (!user) { sendJSON(res, 401, { error: 'Not signed in.' }); return true; }

  if (req.method === 'POST' && path === '/api/auth/profile') {
    const b = await body(); if (!b) return sendJSON(res, 400, { error: 'Bad request.' }), true;
    const { name, avatar } = clean(b);
    if (name) user.name = name;
    if (avatar) user.avatar = avatar;
    await save();
    sendJSON(res, 200, { user: publicUser(user) });
    return true;
  }

  const file = join(DATA_DIR, 'userdata', user.id.replace(/[^a-f0-9-]/gi, '') + '.json');
  if (req.method === 'GET' && path === '/api/sync') {
    try { sendJSON(res, 200, JSON.parse(await readFile(file, 'utf8'))); } catch { sendJSON(res, 200, { data: null, updated: 0 }); }
    return true;
  }
  if (req.method === 'PUT' && path === '/api/sync') {
    const raw = await readBody(req).catch(() => null);
    if (!raw || raw.length > MAX_SYNC) return sendJSON(res, 413, { error: 'Too much data.' }), true;
    let b; try { b = JSON.parse(raw); } catch { return sendJSON(res, 400, { error: 'Bad request.' }), true; }
    if (!b || typeof b.data !== 'object' || Array.isArray(b.data)) return sendJSON(res, 400, { error: 'Bad request.' }), true;
    const out = { data: b.data, updated: Math.min(Number(b.updated) || now(), now()) };
    const tmp = file + '.tmp';
    await writeFile(tmp, JSON.stringify(out), { mode: 0o600 }); await rename(tmp, file);
    sendJSON(res, 200, { ok: true, updated: out.updated });
    return true;
  }
  sendJSON(res, 404, { error: 'Not found.' });
  return true;
}
