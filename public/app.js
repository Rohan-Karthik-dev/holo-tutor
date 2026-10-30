// Holo Tutor — screens, hands-free voice loop, whiteboard, quizzes, progress,
// lesson history with recaps, photo tutoring and holo mode.
import { Tutor } from './tutor.js';
import { findImage, loadRefImage, wikiSearchUrl } from './media.js';
import { CAN_WEB_IMAGES, cloudVoice } from './brain.js';
import { askBrain, askJSON, findVideos, CAN_EMBED, checkBrain, errorHint, locateFace, CAN_CAMERA, KEY_NEEDED, getKey, setKey, MIC_NOTE } from './brain.js';
import { SUBJECTS, LEVELS, subjectName, splitReply, quizPrompt, recapPrompt, qotdPrompt, QOTD_FALLBACK, twinDistillPrompt } from './prompt.js';
import { moveMouth, isRig } from './lips.js';
import { T, langBase } from './i18n.js';
import { Account, AVATARS } from './account.js';
import { TWIN_CATS, loadTwin, twinStrength, twinStage, catCounts, nextTwinQuestion, twinMaterial, cleanProfile } from './twin.js';
import { FUN_CATS, BADGES, loadFun, levelOf, levelTitle, xpForLevel, funStreak, funDayKey, funMessage, funTrivia, funChatEnded, funDaily } from './funprog.js';

// ---------- settings ----------
const qs = new URLSearchParams(location.search);
await Account.boot(); // signed in: check the session and bring down this learner's newest data first
// Learner data is kept per account (see account.js); device settings are shared.
const store = {
  get(k, d) { try { const v = localStorage.getItem('holotutor.' + Account.key(k)); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('holotutor.' + Account.key(k), JSON.stringify(v)); } catch {} Account.changed(k); },
  del(k) { try { localStorage.removeItem('holotutor.' + Account.key(k)); } catch {} Account.changed(k); },
};
const prefs = {
  kind: store.get('kind', 'globe'),
  voiceStyle: store.get('voiceStyle', 'Warm'),
  orient: store.get('orient', 'Mirror'),
  bright: store.get('bright', 90),
  voiceOnly: store.get('voiceOnly', true),
  awake: store.get('awake', true),
  rig: store.get('rig', null) || store.get('mouth', null), // the face rig of the tutor photo
  admin: store.get('admin', true), // testing console
  voiceEngine: store.get('voiceEngine', 'auto'), // 'auto' | 'device' | 'cloud'
  photoLook: store.get('photoLook', 'real'),
  faceFrame: store.get('faceFrame', 'face'), // 'face' = just the face, filling the screen; 'head' = head and shoulders // 'real' = natural colour, 'holo' = cyan hologram
  subject: store.get('subject', 'any'),
  level: store.get('level', 'High school'),
  lang: store.get('lang', 'en-IN'),
  bargeIn: store.get('bargeIn', true),
  wake: store.get('wake', false),
  rate: store.get('rate', 1),
  showcase: store.get('showcase', false),
  voiceName: store.get('voiceName', ''), // a chosen device voice ('' = pick the best English one)
  muted: store.get('muted', false),        // tutor answers in text only, the face still mouths the words // exhibition mode: invites people over when nobody is talking
};
const savePref = (k, v) => { prefs[k] = v; store.set(k, v); };
// URL parameters override the saved settings for this visit (e.g. ?wake=1 at a showcase).
const cfg = {
  get lang() { return 'en-IN'; }, // English only (Indian English voice and speech recognition)
  get wake() { return qs.has('wake') ? qs.get('wake') === '1' : prefs.wake; },
  get bargeIn() { return qs.has('bargein') ? qs.get('bargein') !== '0' : prefs.bargeIn; },
  get rate() { return Number(qs.get('rate')) || prefs.rate; },
  get showcase() { return qs.has('showcase') ? qs.get('showcase') === '1' : prefs.showcase; },
};
let facePhoto = store.get('photo', null);

const VOICE_STYLES = { Warm: { pitch: 0.92, rate: 0.95 }, Clear: { pitch: 1, rate: 1 }, Lively: { pitch: 1.12, rate: 1.07 } };
const ORIENTS = ['Normal', 'Mirror', 'Flip', '180°'];
const ORIENT_CSS = { Normal: 'none', Mirror: 'scaleX(-1)', Flip: 'scaleY(-1)', '180°': 'rotate(180deg)' };
const ORIENT_SAY = { Normal: 'Normal view.', Mirror: 'Mirrored.', Flip: 'Flipped upside down.', '180°': 'Rotated half a turn.' };
const KIND_NAME = { globe: 'Globe guide', photo: 'Your tutor', human: 'Holo human' };
const LEVEL_SHORT = { Primary: 'Primary', 'Middle school': 'Middle', 'High school': 'High school', College: 'College' };
const SUBJ_ICON = {
  any: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  maths: 'M3 13h3l3 7 5-16h7 M15 9l4 6 M19 9l-4 6',
  physics: 'M12 12m-1.6 0a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0 -3.2 0 M12 3c4 0 6 4 6 9s-2 9-6 9-6-4-6-9 2-9 6-9z M3.5 7.5c2-3.5 6.5-2.5 10.8 0s7.7 6 5.7 9.5-6.5 2.5-10.8 0-7.7-6-5.7-9.5z',
  chemistry: 'M9 3h6 M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3 M7.5 14h9',
  biology: 'M5 19c0-8 6-14 14-14 0 8-6 14-14 14z M5 19l8-8',
  english: 'M4 19V5a2 2 0 0 1 2-2h13v15H6a2 2 0 0 0-2 2 2 2 0 0 0 2 2h13 M8 7h7',
  history: 'M3 10l9-6 9 6z M5 21h14 M6 10v11 M10 10v11 M14 10v11 M18 10v11',
  geography: 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0 M3 12h18 M12 3c3 3 3 15 0 18 M12 3c-3 3-3 15 0 18',
  coding: 'M8 7l-5 5 5 5 M16 7l5 5-5 5 M14 4l-4 16',
  fun: 'M6 9h12a4 4 0 0 1 4 4v1a3 3 0 0 1-5.4 1.8L15 14H9l-1.6 1.8A3 3 0 0 1 2 14v-1a4 4 0 0 1 4-4z M7 11v3 M5.5 12.5h3',
};
const icon = (id, size = 22) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${SUBJ_ICON[id] || SUBJ_ICON.any}"></path></svg>`;

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const LETTERS = 'ABCD';

// ---------- dates ----------
const dayKey = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const fmtTime = (t) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
function fmtWhen(t) {
  const k = dayKey(t);
  if (k === dayKey()) return 'Today, ' + fmtTime(t);
  if (k === dayKey(Date.now() - 864e5)) return 'Yesterday, ' + fmtTime(t);
  return new Date(t).toLocaleDateString([], { day: 'numeric', month: 'short' }) + ', ' + fmtTime(t);
}
function ago(t) {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return m + ' min ago';
  const h = Math.round(m / 60);
  if (h < 24) return h + (h === 1 ? ' hour ago' : ' hours ago');
  const d = Math.round(h / 24);
  return d + (d === 1 ? ' day ago' : ' days ago');
}

// ---------- tutors ----------
const sessT = new Tutor($('#sessCanvas'));
const liveT = new Tutor($('#liveCanvas'));
setInterval(() => $('#liveWrap').classList.toggle('talking', Boolean(liveT.speaking)), 120); // voice bars under the board
const prevT = new Tutor($('#facePrev'));
const quizT = new Tutor($('#quizCanvas'));
const recapT = new Tutor($('#recapCanvas'));
prevT.setKind('photo');
const tutors = [sessT, liveT, prevT, quizT, recapT];
const face = {
  setState: (s) => tutors.forEach((t) => t.setState(s)),
  speak: (x, r) => tutors.forEach((t) => t.speak(x, r)),
  sync: (i) => tutors.forEach((t) => t.sync(i)),
  stop: () => tutors.forEach((t) => t.stopSpeaking()),
};
// ---------- fun chat or study ----------
let mode = 'study';
const sessSubject = () => (mode === 'fun' || mode === 'twin' ? mode : prefs.subject);
function setMode(m) {
  m = m === 'fun' || m === 'twin' ? m : 'study';
  if (m === mode) return false;
  if (lesson) endLesson(); else resetConversation();
  mode = m;
  document.body.classList.toggle('funmode', m === 'fun');
  document.body.classList.toggle('twinmode', m === 'twin');
  $('#boardLabel').textContent = m === 'fun' ? 'FUN FACTS' : 'WHITEBOARD';
  applyKind();
  return true;
}
function applyKind() {
  [sessT, liveT, quizT].forEach((t) => t.setKind(prefs.kind));
  const subj = mode === 'fun' ? ' · Fun chat' : prefs.subject !== 'any' ? ' · ' + subjectName(prefs.subject) : '';
  $('#tutorName').textContent = mode === 'fun' ? 'Holo Buddy' : mode === 'twin' ? `${twinFirst()}'s AI twin` : KIND_NAME[prefs.kind] + subj;
  $$('.card').forEach((c) => c.setAttribute('aria-checked', String(c.dataset.kind === prefs.kind)));
  const needPhoto = prefs.kind === 'photo' && !facePhoto;
  $('#homeCtaText').textContent = needPhoto ? 'Add a photo' : qs.get('mode') === 'holo' ? 'Start in holo mode' : 'Start learning';
}
async function applyPhoto() {
  for (const t of tutors) { t.setFrame(prefs.faceFrame); await t.setPhoto(facePhoto, prefs.rig, prefs.photoLook); }
  $('#cardPhoto').hidden = !facePhoto; $('#cardPhotoIcon').style.display = facePhoto ? 'none' : '';
  if (facePhoto) $('#cardPhoto').src = facePhoto;
  $('#photoDesc').textContent = facePhoto ? 'Your photo, as a talking hologram. Tap to change it.' : 'Upload a photo — a parent, teacher or you — and it speaks back.';
}

// ---------- progress & lesson history (kept on this device) ----------
const prog = Object.assign({ days: [], lessons: 0, questions: 0, quiz: { asked: 0, correct: 0 }, subjects: {}, weak: {} }, store.get('progress', {}));
const saveProg = () => store.set('progress', prog);
// Fun mode keeps its own progress: XP, levels, streak, badges (see funprog.js).
const funP = loadFun(store.get('funprog', null));
const saveFun = () => store.set('funprog', funP);
function markDay() { const k = dayKey(); if (!prog.days.includes(k)) { prog.days.push(k); prog.days = prog.days.slice(-180); } }
function streak() {
  const set = new Set(prog.days);
  let n = 0, t = Date.now();
  if (!set.has(dayKey(t))) t -= 864e5; // today not started yet: count up to yesterday
  while (set.has(dayKey(t))) { n++; t -= 864e5; }
  return n;
}
function noteTopic(subject, topic) {
  if (!topic) return;
  const s = (prog.subjects[subject || 'any'] ||= { topics: {} });
  s.topics[topic] = (s.topics[topic] || 0) + 1;
}
const getLessons = () => store.get('lessons', []);
function putLesson(L) {
  const all = getLessons().filter((x) => x.id !== L.id);
  all.unshift(L);
  all.sort((a, b) => b.start - a.start);
  store.set('lessons', all.slice(0, 40));
}
const findLesson = (id) => getLessons().find((x) => x.id === id);

let lesson = null; // the lesson in progress
function lessonEnsure() {
  if (!lesson) lesson = { id: Date.now().toString(36), start: Date.now(), end: Date.now(), subject: sessSubject(), level: prefs.level, kind: prefs.kind, topic: '', turns: [], board: [] };
}
function lessonRecord(q, raw) {
  lessonEnsure();
  const r = splitReply(raw);
  lesson.turns.push({ q: q.slice(0, 600), a: r.spoken.slice(0, 1200) });
  lesson.turns = lesson.turns.slice(-40);
  if (r.board.length) lesson.board = r.board;
  if (r.topic) lesson.topic = r.topic;
  lesson.end = Date.now();
  if (lesson.subject === 'twin') { /* talking to your twin doesn't count as study or fun */ }
  else if (lesson.subject === 'fun') { const ev = funMessage(funP, q, r.topic); saveFun(); celebrate(ev); }
  else { markDay(); prog.questions++; noteTopic(lesson.subject, r.topic); saveProg(); }
  putLesson(lesson);
}
function endLesson() {
  if (!lesson) return;
  const L = lesson; lesson = null;
  resetConversation();
  if (!L.turns.length) return;
  if (L.subject === 'fun') { funChatEnded(funP); saveFun(); } else if (L.subject !== 'twin') { prog.lessons++; saveProg(); }
  putLesson(L);
  makeRecap(L.id);
}
const recapBusy = new Set();
async function makeRecap(id) {
  const L = findLesson(id);
  if (!L || L.recap || recapBusy.has(id) || !L.turns.length) return;
  recapBusy.add(id);
  try {
    const j = await askJSON(recapPrompt({ topic: L.topic, turns: L.turns, lang: cfg.lang }));
    const cur = findLesson(id) || L;
    cur.recap = {
      title: String(j.title || '').slice(0, 60),
      summary: String(j.summary || '').slice(0, 800),
      points: (Array.isArray(j.points) ? j.points : []).map(String).filter(Boolean).slice(0, 5),
      next: String(j.next || '').slice(0, 60),
    };
    if (!cur.topic && cur.recap.title) cur.topic = cur.recap.title;
    if (!cur.recap.summary) throw new Error('empty recap');
    putLesson(cur);
  } catch (err) {
    console.warn('Recap failed', err);
    const cur = findLesson(id); if (cur) { cur.recapFailed = true; putLesson(cur); }
  } finally {
    recapBusy.delete(id);
    if (view === 'recap' && recapId === id) renderRecap();
    if (view === 'history') renderHistory();
  }
}
window.addEventListener('pagehide', () => { if (lesson?.turns.length) putLesson(lesson); saveProg(); });

// ---------- screens ----------
const VIEWS = ['auth', 'train', 'mode', 'home', 'photo', 'session', 'setup', 'live', 'subject', 'quiz', 'history', 'recap', 'progress', 'settings'];
const VOICE_VIEWS = ['session', 'live', 'quiz', 'train'];
const LESSON_VIEWS = ['session', 'live', 'setup', 'quiz', 'progress']; // peeking at progress keeps the chat going
let view = 'mode', setupReturn = 'home', subjectReturn = 'home';
function show(v) {
  const prev = view;
  if (v === prev) return;
  if (v === 'setup' && prev !== 'live') setupReturn = prev;
  if (v === 'subject') subjectReturn = prev === 'subject' ? 'home' : prev;
  if (v === 'progress' && prev !== 'progress' && !progFrom) progTab = mode === 'fun' ? 'fun' : 'study';
  if (prev === 'progress' && v !== 'progress') progFrom = null;
  if (v === 'home' && mode === 'fun') setMode('study'); // Home is the study home
  view = v;
  VIEWS.forEach((n) => { $('#v-' + n).hidden = n !== v; });
  document.body.dataset.view = v;
  $$('#tabs button').forEach((b) => { if (b.dataset.tab === v) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  if (v === 'live') enterLive(); else if (prev === 'live') exitLive();
  if (videoOpen && (v !== 'session' || holoMedia === 'video')) closeVideo(false);
  if (!LESSON_VIEWS.includes(v) && lesson) endLesson();
  if (VOICE_VIEWS.includes(v)) startVoice();
  else if (VOICE_VIEWS.includes(prev) || busy) stopVoice();
  ({ train: () => { renderTrain(); setTimeout(enterTrain, 300); }, auth: renderAuth, mode: () => { $('#modeGreet').textContent = greetText() + (Account.firstName ? `, ${Account.firstName}` : ''); renderAccount(); }, home: renderHome, history: renderHistory, progress: renderProgress, settings: renderSettings, subject: renderSubject, recap: renderRecap, setup: renderSetup }[v] || (() => {}))();
  if (v === 'photo') { renderPhotoScreen(); lipStatus(RIG_STATUS[prefs.rig?.how] || RIG_STATUS.guess); }
  if ((v === 'photo' || (v === 'session' && prefs.kind === 'photo')) && facePhoto && !mapped(prefs.rig)) remapFace();
  if (v === 'session') setTimeout(scrollChat, 0);
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-go]');
  if (b) show(b.dataset.go);
});

// ---------- home ----------
function greetText() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
function renderHome() {
  $('#greet').textContent = greetText() + (Account.firstName ? `, ${Account.firstName}` : '');
  renderQotd();
  $('#subjChipIcon').innerHTML = icon(prefs.subject);
  $('#subjChipText').textContent = `${subjectName(prefs.subject)} · ${prefs.level}`;
  const st = streak();
  $('#homeStreak').hidden = st < 1;
  $('#homeStreakText').textContent = `${st}-day streak`;
  const last = getLessons()[0];
  $('#resumeCard').hidden = !last;
  if (last) {
    $('#resumeTopic').textContent = last.topic || 'Your last lesson';
    $('#resumeMeta').textContent = `${subjectName(last.subject)} · ${ago(last.end || last.start)}`;
    $('#resumeCard').onclick = () => openRecap(last.id);
  }
  applyKind();
}
$('#pickFun').addEventListener('click', () => { setMode('fun'); show('session'); });
$('#pickTwin').addEventListener('click', () => show('train'));
$('#pickStudy').addEventListener('click', () => { setMode('study'); show('home'); });
$('#funCard').addEventListener('click', () => { setMode('fun'); show('session'); });
$('#sessBack').addEventListener('click', () => show(mode === 'fun' ? 'mode' : mode === 'twin' ? 'train' : 'home'));
$$('.card').forEach((c) => c.addEventListener('click', () => {
  if (prefs.kind !== c.dataset.kind) { savePref('kind', c.dataset.kind); resetConversation(); }
  applyKind();
  if (c.dataset.kind === 'photo' && facePhoto) show('photo');
}));
$('#homeCta').addEventListener('click', () => {
  if (KEY_NEEDED && !getKey()) { $('#warn').hidden = false; $('#warn').textContent = 'Add your Anthropic API key below first.'; $('#keyInput').focus(); return; }
  if (prefs.kind === 'photo' && !facePhoto) show('photo');
  else show(qs.get('mode') === 'holo' ? 'live' : 'session');
});

// ---------- subject & level ----------
function renderSubject() {
  const grid = $('#subjGrid');
  if (!grid.children.length) {
    SUBJECTS.filter((s) => !s.hidden).forEach((s) => {
      const b = el('button', 'subj'); b.type = 'button'; b.setAttribute('role', 'radio'); b.dataset.subj = s.id;
      b.innerHTML = icon(s.id, 26); b.append(el('span', '', s.name));
      b.addEventListener('click', () => { savePref('subject', s.id); renderSubject(); });
      grid.append(b);
    });
    LEVELS.forEach((l) => {
      const b = el('button', '', LEVEL_SHORT[l]); b.type = 'button'; b.setAttribute('role', 'radio'); b.dataset.level = l;
      b.addEventListener('click', () => { savePref('level', l); renderSubject(); });
      $('#levelSeg').append(b);
    });
  }
  $$('#subjGrid .subj').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.subj === prefs.subject)));
  $$('#levelSeg button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.level === prefs.level)));
}
$('#subjBack').addEventListener('click', () => show(subjectReturn));
$('#subjDone').addEventListener('click', () => { applyKind(); show(subjectReturn); });

// ---------- upload face ----------
function renderPhotoScreen() {
  const has = Boolean(facePhoto);
  $('#dropEmpty').hidden = has; $('#facePrev').hidden = !has; $('#faceTools').hidden = !has;
  $('#drop').classList.toggle('has', has);
  $('#photoCta').disabled = !has;
  $$('#voiceSeg button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.voice === prefs.voiceStyle)));
  $$('#lookSeg button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.look === prefs.photoLook)));
  $$('#frameSeg button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.frame === prefs.faceFrame)));
  placeMouthDot();
}
const RIG_STATUS = {
  auto: 'Face mapped: lips, jaw and eyes move as I talk. Tap the mouth if it needs adjusting.',
  ai: 'Face mapped: lips, jaw and eyes move as I talk. Tap the mouth if it needs adjusting.',
  manual: 'Mouth placed. Tap again to adjust.',
  guess: 'Tap the middle of the mouth so the lips move in the right place.',
};
// Markers on the preview: the line between the mouth corners and a ring on each eye.
function placeMouthDot() {
  const mark = $('#mouthDot'), eyes = [$('#eyeMark0'), $('#eyeMark1')];
  const R = prevT.photo?.rig;
  const a = R && prevT.toScreen(R.ml.x, R.ml.y), b = R && prevT.toScreen(R.mr.x, R.mr.y);
  if (!facePhoto || !a || !b || view !== 'photo') { mark.hidden = true; eyes.forEach((e) => { e.hidden = true; }); return; }
  mark.hidden = false;
  mark.style.left = a.x + 'px'; mark.style.top = a.y + 'px';
  mark.style.width = Math.hypot(b.x - a.x, b.y - a.y) + 'px';
  mark.style.transform = `rotate(${Math.atan2(b.y - a.y, b.x - a.x)}rad)`;
  mark.classList.toggle('auto', R.how === 'auto' || R.how === 'ai');
  eyes.forEach((e, i) => {
    const E = R.eyes?.[i];
    const c = E && prevT.toScreen(E.x, E.y), edge = E && prevT.toScreen(E.x + E.rx, E.y);
    e.hidden = !c;
    if (!c) return;
    const rad = Math.max(8, (edge.x - c.x) * 1.25);
    e.style.left = c.x - rad + 'px'; e.style.top = c.y - rad * 0.6 + 'px';
    e.style.width = rad * 2 + 'px'; e.style.height = rad * 1.2 + 'px';
  });
}
(function markerLoop() { if (view === 'photo') placeMouthDot(); requestAnimationFrame(markerLoop); })();
function lipStatus(text) { $('#lipStatus').textContent = text; }
// A photo saved before full face mapping existed gets mapped once, in the background.
const mapped = (r) => isRig(r) && (r.how === 'auto' || r.how === 'ai' || r.how === 'manual') && r.eyes?.length === 2;
let remapping = false;
async function remapFace() {
  if (remapping || !facePhoto) return;
  remapping = true;
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = facePhoto; });
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    c.getContext('2d').drawImage(img, 0, 0);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85));
    const mine = facePhoto;
    const found = await locateFace({ image: c, dataURL: facePhoto, blob });
    if (found && mine === facePhoto && !mapped(prefs.rig)) {
      setRig(found);
      if (view === 'photo') lipStatus(RIG_STATUS[found.how] || RIG_STATUS.auto);
    }
  } catch {} finally { remapping = false; }
}
function setFrame(f) {
  savePref('faceFrame', f);
  tutors.forEach((t) => t.setFrame(f));
  $$('#frameSeg button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.frame === f)));
}
$$('#frameSeg button').forEach((b) => b.addEventListener('click', () => setFrame(b.dataset.frame)));
function setLook(look) {
  savePref('photoLook', look);
  tutors.forEach((t) => t.setLook(look));
  $$('#lookSeg button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.look === look)));
}
$$('#lookSeg button').forEach((b) => b.addEventListener('click', () => setLook(b.dataset.look)));
function setRig(rig) {
  savePref('rig', rig);
  tutors.forEach((t) => t.setRig(rig));
}
async function loadFace(file) {
  if (!file) return;
  let img;
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 1536 / Math.max(bmp.width, bmp.height)); // sharp enough to fill the screen
    img = document.createElement('canvas');
    img.width = Math.round(bmp.width * k); img.height = Math.round(bmp.height * k);
    img.getContext('2d').drawImage(bmp, 0, 0, img.width, img.height);
  } catch { lipStatus('That image couldn\'t be opened. Try a JPEG or PNG.'); return; }
  facePhoto = img.toDataURL('image/jpeg', 0.88);
  store.set('photo', facePhoto);
  savePref('rig', null);
  await applyPhoto();
  renderPhotoScreen();
  // Map the face automatically, then let the new tutor say hello so you can see it move.
  lipStatus('Mapping the face…');
  $('#drop').classList.add('scanning');
  const blob = await new Promise((r) => img.toBlob(r, 'image/jpeg', 0.85));
  const mine = facePhoto;
  const found = await locateFace({ image: img, dataURL: facePhoto, blob });
  if (mine !== facePhoto) return;
  $('#drop').classList.remove('scanning');
  if (found) {
    setRig(found);
    lipStatus(RIG_STATUS[found.how] || RIG_STATUS.auto);
    speakOnce('Hello! I\'m your new holo tutor. Watch my lips and eyes as I talk to you.');
  } else {
    lipStatus('Couldn\'t find a face. Tap the middle of the mouth to place the lips.');
  }
}
$('#faceFile').addEventListener('change', (e) => { loadFace(e.target.files[0]); e.target.value = ''; });
$('#faceFile2').addEventListener('change', (e) => { loadFace(e.target.files[0]); e.target.value = ''; });
$('#facePrev').addEventListener('click', (e) => {
  const R = prevT.photo?.rig; if (!R) return;
  const box = e.currentTarget.getBoundingClientRect();
  const n = prevT.toImage(e.clientX - box.left, e.clientY - box.top);
  if (!n || n.x < 0 || n.x > 1 || n.y < 0 || n.y > 1) return;
  setRig(moveMouth(R, n.x, n.y));
  lipStatus(RIG_STATUS.manual);
  speakOnce('Like this?');
});
function setVoiceStyle(v) { savePref('voiceStyle', v); renderPhotoScreen(); renderSettings(); }
$$('#voiceSeg button').forEach((b) => b.addEventListener('click', () => setVoiceStyle(b.dataset.voice)));
$('#testVoice').addEventListener('click', () => speakOnce('Hi! I\'m your new holo tutor. What shall we learn today?'));
$('#photoCta').addEventListener('click', () => { savePref('kind', 'photo'); resetConversation(); applyKind(); show('session'); });
window.addEventListener('resize', () => { if (view === 'photo') requestAnimationFrame(placeMouthDot); });

// ---------- holo box setup & holo mode ----------
function renderSetup() {
  $$('#orientSeg button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.orient === prefs.orient)));
  $('#bright').value = prefs.bright; $('#brightVal').textContent = prefs.bright + '%';
  $('#swVoice').setAttribute('aria-checked', String(prefs.voiceOnly));
  $('#swAwake').setAttribute('aria-checked', String(prefs.awake));
  $('#swShowcase').setAttribute('aria-checked', String(prefs.showcase));
  $('#liveWrap').style.transform = ORIENT_CSS[prefs.orient];
  $('#liveWrap').style.opacity = prefs.bright / 100;
  $('#liveExit').hidden = prefs.voiceOnly;
}
$$('#orientSeg button').forEach((b) => b.addEventListener('click', () => { savePref('orient', b.dataset.orient); renderSetup(); }));
$('#bright').addEventListener('input', (e) => { savePref('bright', Number(e.target.value)); renderSetup(); });
$('#swVoice').addEventListener('click', () => { savePref('voiceOnly', !prefs.voiceOnly); renderSetup(); });
$('#swAwake').addEventListener('click', () => { savePref('awake', !prefs.awake); renderSetup(); keepAwake(); });
$('#swShowcase').addEventListener('click', () => { savePref('showcase', !prefs.showcase); renderSetup(); lastActivity = Date.now(); });
$('#setupBack').addEventListener('click', () => show(setupReturn === 'setup' ? 'home' : setupReturn));
$('#enterHolo').addEventListener('click', () => show('live'));
async function enterLive() {
  renderSetup();
  materialize();
  try { await document.documentElement.requestFullscreen?.(); } catch {}
}
function exitLive() { if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); }
$('#liveExit').addEventListener('click', () => show('session'));
let lastTap = 0;
$('#v-live').addEventListener('click', (e) => { // double-tap to leave, even in voice-only
  if (e.target.closest('#liveExit')) return;
  const now = Date.now();
  if (now - lastTap < 400) show('session');
  lastTap = now;
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && view === 'live') show('session'); });
function cycleOrient() {
  savePref('orient', ORIENTS[(ORIENTS.indexOf(prefs.orient) + 1) % ORIENTS.length]);
  renderSetup();
  say(ORIENT_SAY[prefs.orient]);
}
let wakeLock = null;
async function keepAwake() {
  try {
    if (prefs.awake && VOICE_VIEWS.includes(view)) wakeLock = await navigator.wakeLock?.request('screen');
    else { await wakeLock?.release(); wakeLock = null; }
  } catch {}
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') keepAwake(); });

// ---------- whiteboard ----------
let boardLines = [], boardTopic = '';
const isMath = (s) => /[=±√π²³⁴⁵⁶⁷⁸⁹⁰₀₁₂₃₄₅₆₇₈₉∑∫≈≠≤≥×÷^∞°]/.test(s) || /\d\s*[+\-*/]\s*\d/.test(s);
function boardLineEl(line) {
  if (line.includes('→')) {
    const p = el('div', 'bl flow');
    line.split('→').map((t) => t.trim()).filter(Boolean).forEach((t, i) => {
      const w = el('span', 'stepwrap');
      if (i) w.append(el('span', 'arrow', '→'));
      w.append(el('span', 'step', t));
      p.append(w);
    });
    return p;
  }
  const kind = /^\s*(∴|therefore\b|answer\s*:|ans\s*[:.]|अतः|इसलिए|उत्तर\s*:|కాబట్టి|జవాబు\s*:)/iu.test(line) ? 'math final' : /^\s*(given|find|दिया|ज्ञात|ఇవ్వబడింది|కనుగొనాలి)\b/iu.test(line) ? 'text given' : isMath(line) ? 'math' : 'text';
  return el('p', 'bl ' + kind, line);
}
function fillBoard(container, lines, keep = 0) {
  while (container.children.length > keep) container.lastChild.remove();
  lines.slice(keep).forEach((l) => container.append(boardLineEl(l)));
}
// Holo mode: while the tutor explains with the board, the board fills the glass and
// the face hides. "Show face" brings the face back (until the next explanation's board),
// "show board" brings the board back.
let holoView = 'face', faceLock = false, answerBoard = false; // answerBoard: this answer is using the board
function renderLiveBoard() {
  const box = $('#liveBoard');
  if (holoView === 'board') {
    box.replaceChildren();
    if (boardTopic) box.append(el('p', 'livetopic', boardTopic));
    boardLines.forEach((l) => box.append(boardLineEl(l))); // the whole working, shrunk to fit the glass
    fitLiveBoard();
  } else box.replaceChildren(); // face view: just the tutor, nothing else on the glass
}
function fitLiveBoard() {
  const box = $('#liveBoard');
  let k = 1;
  box.style.setProperty('--fit', k);
  while (k > 0.4 && box.scrollHeight > box.clientHeight + 2) { k -= 0.06; box.style.setProperty('--fit', k.toFixed(2)); }
}
window.addEventListener('resize', () => { if (holoView === 'board') fitLiveBoard(); });
function setHoloView(v) {
  holoView = v === 'board' && boardLines.length ? 'board' : 'face';
  $('#liveWrap').classList.toggle('boardmode', holoView === 'board');
  renderLiveBoard();
}
function updateBoard(lines, topic) {
  if (topic) boardTopic = topic;
  if (lines.length) {
    const same = boardLines.length <= lines.length && boardLines.every((l, i) => l === lines[i]);
    if (!same) faceLock = false; // a new explanation: back to the board
    fillBoard($('#boardLines'), lines, same ? boardLines.length : 0);
    boardLines = lines.slice();
    const bd = $('#board'); requestAnimationFrame(() => { bd.scrollTop = bd.scrollHeight; }); // follow the working as it's written
    answerBoard = true;
  }
  setHoloView(answerBoard && !faceLock ? 'board' : 'face');
  $('#boardTopic').textContent = boardTopic;
  const has = boardLines.length > 0;
  $('#board').hidden = !has;
  $('#v-session .sess').classList.toggle('hasboard', has);
}
function clearBoard() {
  boardLines = []; boardTopic = '';
  $('#boardLines').innerHTML = ''; $('#liveBoard').innerHTML = '';
  faceLock = false;
  updateBoard([], '');
}
$('#quizBtn').addEventListener('click', () => quizFromLesson());
$('#videoBtn').addEventListener('click', () => showVideos());

// ---------- video references ----------
let videoList = [], videoOpen = false;
const PLAY_SVG = '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"></path></svg>';
const SEARCH_SVG = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6"></circle><path d="M20 20l-4.5-4.5"></path></svg>';
function videoCard(v, i) {
  const playable = Boolean(v.id && CAN_EMBED);
  const c = el(playable ? 'button' : 'a', 'vcard');
  if (playable) { c.type = 'button'; c.addEventListener('click', () => playVideo(v)); }
  else { c.href = v.url; c.target = '_blank'; c.rel = 'noopener'; }
  const th = el('span', 'vthumb');
  if (v.id) { const img = el('img'); img.alt = ''; img.loading = 'lazy'; img.src = `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`; img.onerror = () => img.remove(); th.append(img); }
  th.insertAdjacentHTML('beforeend', v.id ? PLAY_SVG : SEARCH_SVG);
  const tx = el('span', 'vtext');
  const meta = v.id ? [v.channel, v.minutes ? v.minutes + ' min' : ''].filter(Boolean).join(' · ') || 'YouTube' : 'Search on YouTube';
  tx.append(el('span', 'vtitle', (i != null ? `${i + 1}. ` : '') + v.title), el('span', 'vmeta', meta));
  if (v.why) tx.append(el('span', 'vwhy', v.why));
  c.append(th, tx);
  return c;
}
async function showVideos(topicAsked) {
  const topic = (topicAsked || currentTopic() || '').trim();
  if (!topic) { say('Sure! What should the video be about?', { bubble: true }); return; }
  interrupt();
  const m = addMsg('tutor'); m.el.classList.add('pending', 'videomsg');
  say(T(cfg.lang).findVideo(topic));
  let list = [];
  try { list = await findVideos({ topic, subject: lesson?.subject || sessSubject(), level: prefs.level, lang: cfg.lang }); } catch (err) { console.warn('Videos failed', err); }
  m.el.classList.remove('pending');
  if (!list.length) {
    m.set('I couldn\'t find videos just now.');
    whenIdle(() => say('Sorry, I couldn\'t find videos just now. Try again in a moment.'));
    return;
  }
  videoList = list;
  m.el.innerHTML = '';
  const real = Boolean(list[0].id);
  m.el.append(el('span', '', real ? `Short videos on ${topic}` : `Watch on YouTube: ${topic}`));
  const wrap = el('div', 'vcards'); list.forEach((v, i) => wrap.append(videoCard(v, i))); m.el.append(wrap);
  scrollChat();
  if (view === 'live') { // list them on the hologram too
    const ol = el('ol', 'hololist');
    list.forEach((v, i) => { const li = el('li'); li.append(el('span', 'n', String(i + 1)), el('span', '', v.title)); ol.append(li); });
    const box = el('div', 'holomedia'); box.append(el('p', 'holocaption', real ? 'Short videos' : 'YouTube searches'), ol);
    setHoloMedia(box, 'list');
  }
  lessonEnsure(); lesson.videos = list; if (lesson.turns.length) putLesson(lesson);
  const n = list.length;
  whenIdle(() => say(real && CAN_EMBED ? T(cfg.lang).foundVideos(n)
    : `Here ${n > 1 ? 'are' : 'is'} ${n} YouTube search${n > 1 ? 'es' : ''} for ${topic}. Tap one to open it.`));
}
function playVideo(v) {
  if (!v) return;
  if (!v.id || !CAN_EMBED) { say('Tap the video to open it on YouTube.'); return; }
  interrupt();
  videoOpen = true;
  const src = `https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;
  if (view === 'live') { // play it as a floating hologram, oriented for the glass
    const f = el('div', 'holoframe video');
    const ifr = el('iframe'); ifr.src = src; ifr.allow = 'autoplay; encrypted-media; picture-in-picture'; ifr.title = v.title;
    f.append(ifr);
    const box = el('div', 'holomedia'); box.append(f, el('p', 'holocaption', v.title));
    setHoloMedia(box, 'video');
    return;
  }
  $('#playerTitle').textContent = v.title;
  $('#playerMeta').textContent = [v.channel, v.minutes ? v.minutes + ' min' : ''].filter(Boolean).join(' · ');
  $('#playerOpen').href = v.url;
  const f = el('iframe');
  f.src = src;
  f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
  f.allowFullscreen = true; f.title = v.title;
  $('#playerFrame').replaceChildren(f);
  $('#player').hidden = false;
  $('#status').textContent = 'Say “close video” when done';
}
function closeVideo(speak = true) {
  if (!videoOpen) return;
  videoOpen = false;
  if (holoMedia === 'video') setHoloMedia(null);
  $('#playerFrame').replaceChildren();
  $('#player').hidden = true;
  if (speak && VOICE_VIEWS.includes(view)) say(T(cfg.lang).afterVideo);
  else resumeIdle();
}
$('#playerClose').addEventListener('click', () => closeVideo());

// ---------- holographic media & reference pictures ----------
let holoMedia = null, imageSeq = 0; // what floats above the tutor in holo mode: 'image' | 'video' | 'list'
function setHoloMedia(node, kind) {
  const box = $('#liveMedia');
  box.replaceChildren();
  holoMedia = node ? kind : null;
  box.hidden = !node;
  $('#liveWrap').classList.toggle('hasmedia', Boolean(node));
  if (node) box.append(node);
}
const PIC_SVG = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"></rect><circle cx="9" cy="10" r="1.8"></circle><path d="M21 16l-5-5-8 8"></path></svg>';
async function showImage(query, { announce = false } = {}) {
  query = String(query || '').trim();
  if (!query) return;
  const mine = ++imageSeq;
  if (!CAN_WEB_IMAGES) { // the preview can't load pictures from other sites: link to them instead
    const m = addMsg('tutor'); m.el.classList.add('imgmsg'); m.el.innerHTML = '';
    const a = el('a', 'vcard'); a.href = wikiSearchUrl(query); a.target = '_blank'; a.rel = 'noopener';
    const th = el('span', 'vthumb'); th.innerHTML = PIC_SVG;
    const tx = el('span', 'vtext'); tx.append(el('span', 'vtitle', 'Picture: ' + query), el('span', 'vmeta', 'Opens on Wikipedia'));
    a.append(th, tx); m.el.append(a); scrollChat();
    if (announce) say('Tap the link to see the picture.');
    return;
  }
  const found = await findImage(query);
  const loaded = found && await loadRefImage(found.src);
  if (mine !== imageSeq) return;
  if (!found || !loaded) { if (announce) say(`I couldn't find a picture of ${query}.`); return; }
  const m = addMsg('tutor'); m.el.classList.add('imgmsg'); m.el.innerHTML = '';
  const img = el('img'); img.src = found.src; img.alt = found.title;
  const cap = el('a', 'imgcap', 'Wikipedia · ' + found.title); cap.href = found.page; cap.target = '_blank'; cap.rel = 'noopener';
  m.el.append(img, cap); scrollChat();
  if (holoMedia !== 'video') {
    const f = el('div', 'holoframe' + (loaded.light ? ' invert' : '')); // white diagrams become light-on-dark for the glass
    const hi = el('img'); hi.src = found.src; hi.alt = ''; f.append(hi);
    const box = el('div', 'holomedia'); box.append(f, el('p', 'holocaption', found.title));
    setHoloMedia(box, 'image');
  }
  if (lesson) { lesson.image = { src: found.src, title: found.title, page: found.page }; }
  if (announce) say(T(cfg.lang).picture(found.title));
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && videoOpen) closeVideo(); });

// ---------- chat ----------
const history = [];   // {role, text (raw reply), image?: {dataURL, blob}}
let lastAnswer = '';
const chatEl = $('#chat');
function scrollChat() { chatEl.scrollTop = chatEl.scrollHeight; }
function emptyHint() {
  chatEl.innerHTML = '';
  const p = el('p', 'empty-hint');
  p.textContent = noVoice && MIC_NOTE ? MIC_NOTE
    : mode === 'fun' ? 'Ask for a joke or a riddle, talk movies and shows, or get gaming tips. Say “quiz me” for trivia, or “let\'s study” when you\'re ready to learn.'
    : rec && !noVoice ? 'Just ask out loud, and talk over me anytime. I\'ll write the key points on the whiteboard. Say “quiz me” when you\'re ready to test yourself.'
    : 'Type a question below, or share a photo of your work with the camera button.';
  chatEl.append(p);
}
function addMsg(role, text = '', img) {
  chatEl.querySelector('.empty-hint')?.remove();
  const d = el('div', 'msg ' + role);
  if (img) { const i = el('img'); i.src = img; i.alt = 'Photo you shared'; d.append(i); }
  const s = el('span', '', text); d.append(s);
  chatEl.append(d); scrollChat();
  return { el: d, set(t) { s.textContent = t; scrollChat(); } };
}
function resetConversation() {
  history.length = 0; lastAnswer = ''; greeted = false;
  clearBoard();
  emptyHint();
}

// ---------- status ----------
let paused = false;
function setStatus(state) {
  admState(state);
  face.setState(state === 'paused' || state === 'typing' ? 'idle' : state);
  document.body.dataset.state = state;
  document.body.classList.toggle('duplex', cfg.bargeIn && !noVoice && !paused);
  const awakeNeeded = cfg.wake && Date.now() > awakeUntil;
  const talkOver = cfg.bargeIn && !noVoice && !paused;
  $('#status').textContent = {
    listening: awakeNeeded ? 'Say “Hey Tutor”…' : 'Just speak…',
    thinking: 'Thinking…',
    speaking: talkOver ? 'Talk anytime to interrupt' : 'Tap mic to stop',
    paused: 'Paused · tap to talk',
    typing: dictate ? dictTip() : (noVoice ? 'Tap the mic for voice typing' : 'Type below'),
    idle: 'Ready',
  }[state] || '';
  const short = { listening: 'Hands-free · listening', thinking: 'Thinking', speaking: talkOver ? 'Speaking · still listening' : 'Speaking', paused: 'Paused', typing: 'Typing mode', idle: 'Ready' }[state] || '';
  $('#liveStateText').textContent = short;
  $('#quizState').textContent = short;
  const done = quiz?.done;
  $('#qStatus').textContent = {
    listening: awakeNeeded ? 'Say “Hey Tutor”…' : done ? 'Say “try again” or “back to lesson”' : 'Say A, B, C or D — or tap',
    thinking: 'Thinking…',
    speaking: talkOver ? (done ? 'Talk anytime' : 'Answer anytime') : 'Speaking…',
    paused: 'Paused',
    typing: done ? 'Tap a button below' : 'Tap an answer',
    idle: done ? 'Tap a button below' : 'Tap an answer',
  }[state] || '';
  $('#vdStateText').textContent = { listening: hearing ? 'Hearing you' : 'Listening', thinking: 'Thinking', speaking: prefs.muted ? 'Speaking · muted' : 'Speaking', paused: 'Mic paused', typing: dictate ? 'Voice typing' : noVoice ? 'Text mode' : 'Typing', idle: 'Ready' }[state] || 'Ready';
  $('#stopBtn').disabled = !busy;
  $('#replayBtn').disabled = !lastAnswer;
  const mb = $('#muteBtn'); mb.setAttribute('aria-pressed', String(prefs.muted)); mb.classList.toggle('on', prefs.muted);
  mb.setAttribute('aria-label', prefs.muted ? 'Unmute the tutor' : 'Mute the tutor\'s voice'); mb.title = prefs.muted ? 'Unmute' : 'Mute';
  $('#muteIcon').innerHTML = prefs.muted ? '<path d="M4 9h4l5-4v14l-5-4H4z"></path><path d="M17 9l5 6M22 9l-5 6"></path>' : '<path d="M4 9h4l5-4v14l-5-4H4z"></path><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"></path>';
  const mic = $('#micBtn');
  mic.setAttribute('aria-pressed', String(state === 'listening'));
  mic.setAttribute('aria-label', state === 'listening' ? 'Pause listening' : busy ? 'Stop the tutor' : rec ? 'Start listening' : 'Type instead');
  const playing = view === 'recap' && busy;
  $('#rcPlayText').textContent = playing ? 'Stop' : 'Replay recap';
  $('#rcPlayIcon').innerHTML = playing ? '<rect x="6" y="6" width="12" height="12" rx="2"></rect>' : '<path d="M8 5v14l11-7z"></path>';
}

// ---------- speech output ----------
// Two voices: the device's own (speechSynthesis) and a cloud voice (Google TTS)
// for devices with no voice for the language, or browsers that can't speak.
const speechQ = []; // [{ text, audio?: Promise<Blob> }]
let speakingNow = false, currentItem = null, watchdog = 0, voice = null;
let deviceBroken = false, cloudOK = false, cloudFails = 0, voiceNoticeShown = false;
const hasDevice = () => 'speechSynthesis' in window && !deviceBroken;
const deviceVoices = () => { try { return speechSynthesis.getVoices(); } catch { return []; } };
function pickVoice() {
  if (!('speechSynthesis' in window)) return;
  const voices = deviceVoices();
  const lang = cfg.lang.toLowerCase(), base = lang.slice(0, 2);
  const good = /natural|neural|enhanced|premium|google/i;
  const chosen = prefs.voiceName && voices.find((v) => v.voiceURI === prefs.voiceName || v.name === prefs.voiceName);
  if (chosen) { voice = chosen; return; }
  voice = voices.find((v) => v.lang.toLowerCase().replace('_', '-') === lang && good.test(v.name))
    || voices.find((v) => v.lang.toLowerCase().replace('_', '-') === lang)
    || voices.find((v) => v.lang.toLowerCase().startsWith(base) && good.test(v.name))
    || voices.find((v) => v.lang.toLowerCase().startsWith(base)) || null;
}
if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.addEventListener?.('voiceschanged', () => { pickVoice(); renderVoiceStatus(); if (view === 'settings') renderVoicePick(); }); }
// The device can speak this language: it has a matching voice (an empty list means "not loaded yet"; trust it for English).
const deviceHasLang = () => hasDevice() && (voice ? langBase(voice.lang) === langBase(cfg.lang) : !deviceVoices().length && langBase(cfg.lang) === 'en');
function useCloud() {
  if (!cloudOK) return false;
  if (prefs.voiceEngine === 'cloud') return true;
  if (prefs.voiceEngine === 'device') return !hasDevice();
  return !deviceHasLang();
}
cloudVoice.available().then((ok) => { cloudOK = ok; renderVoiceStatus(); if (ok) admLog('info', 'cloud voice available'); });
const cleanForSpeech = (t) => t.replace(/https?:\/\/\S+/g, '').replace(/[*_#`>~|<]/g, '').replace(/\s+/g, ' ').trim();
const voiceOpts = () => ({ lang: cfg.lang, style: prefs.voiceStyle, rate: cfg.rate });
function makeUtterance(text) {
  const u = new SpeechSynthesisUtterance(text);
  const st = VOICE_STYLES[prefs.voiceStyle] || VOICE_STYLES.Clear;
  if (voice) { try { u.voice = voice; } catch {} }
  u.lang = voice?.lang || cfg.lang;
  u.rate = st.rate * cfg.rate; u.pitch = st.pitch;
  return u;
}
function enqueueSpeech(text) {
  const t = cleanForSpeech(text);
  if (t) {
    const item = { text: t };
    if (useCloud()) item.audio = cloudVoice.synth(t, voiceOpts()); // start fetching now so sentences play back to back
    else if (langBase(cfg.lang) !== 'en' && deviceVoices().length && !deviceHasLang()) noVoiceNotice(); // still tries, but warn: no voice for this language
    speechQ.push(item);
  }
  pump();
}
const player = new Audio();
player.preload = 'auto';
// Loudness of the cloud voice, read from the audio itself, drives how wide the mouth opens.
let audioCtx = null, analyser = null, levelBuf = null;
function hookAnalyser() {
  try {
    if (analyser) return;
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state !== 'running') { audioCtx.resume?.(); return; } // only route audio through it once it can play
    const src = audioCtx.createMediaElementSource(player);
    analyser = audioCtx.createAnalyser(); analyser.fftSize = 512;
    src.connect(analyser); analyser.connect(audioCtx.destination);
    levelBuf = new Float32Array(analyser.fftSize);
  } catch (e) { admLog('err', 'audio analyser: ' + e.message); }
}
Tutor.level = () => {
  if (!analyser || player.paused || !currentItem?.audio) return null; // device voice: no audio to measure
  analyser.getFloatTimeDomainData(levelBuf);
  let sum = 0; for (let i = 0; i < levelBuf.length; i++) sum += levelBuf[i] * levelBuf[i];
  return Math.min(1, Math.sqrt(sum / levelBuf.length) * 4.5);
};
function pump() {
  if (speakingNow) return;
  const item = speechQ.shift();
  if (item === undefined) { maybeFinish(); return; }
  if (!item.audio && !hasDevice() && !prefs.muted) {
    if (useCloud()) item.audio = cloudVoice.synth(item.text, voiceOpts());
    else { noVoiceNotice(); speechQ.length = 0; maybeFinish(); return; }
  }
  currentItem = item; speakingNow = true;
  const done = () => {
    if (currentItem !== item) return;
    currentItem = null; speakingNow = false; lastSpeechEnd = Date.now(); clearTimeout(watchdog); face.stop(); pump();
  };
  noteSpoken(item.text);
  setStatus('speaking');
  if (prefs.muted) speakSilent(item, done);
  else if (item.audio) playCloud(item, done); else speakDevice(item, done);
}
function playCloud(item, done) {
  watchdog = setTimeout(done, 15000 + item.text.length * 150);
  item.audio.then((blob) => {
    if (currentItem !== item) return;
    cloudFails = 0;
    const url = URL.createObjectURL(blob);
    const finish = () => { URL.revokeObjectURL(url); done(); };
    player.onloadedmetadata = () => {
      const d = player.duration;
      face.speak(item.text, isFinite(d) && d > 0 ? Math.min(2.5, Math.max(0.4, item.text.length / d / 14)) : 1);
    };
    player.onended = finish; player.onerror = finish;
    hookAnalyser(); audioCtx?.resume?.();
    player.src = url;
    player.play().catch((e) => { admLog('err', 'voice playback: ' + e.message); finish(); });
  }).catch((e) => {
    if (currentItem !== item) return;
    admLog('err', 'cloud voice: ' + e.message);
    if (++cloudFails >= 2) { cloudOK = false; renderVoiceStatus(); }
    if (hasDevice()) { item.audio = null; speakDevice(item, done); } else { noVoiceNotice(); done(); }
  });
}
function speakDevice(item, done) {
  const u = makeUtterance(item.text);
  item.u = u; // keep it alive: Chrome can garbage-collect an utterance and never speak it
  let started = false;
  u.onstart = () => { started = true; face.speak(item.text, u.rate); };
  u.onboundary = (e) => { started = true; if (!e.name || e.name === 'word') face.sync(e.charIndex); };
  u.onend = done; u.onerror = (e) => { if (e.error && e.error !== 'interrupted' && e.error !== 'canceled') admLog('err', 'device voice: ' + e.error); done(); };
  // If the device never starts talking, it can't speak here: switch to the cloud voice (or say so).
  const check = setTimeout(() => {
    if (started || currentItem !== item) return;
    deviceBroken = true; renderVoiceStatus();
    admLog('err', 'this device did not speak; ' + (cloudOK ? 'switching to cloud voice' : 'no cloud voice set up'));
    try { speechSynthesis.cancel(); } catch {}
    if (cloudOK) { item.audio = cloudVoice.synth(item.text, voiceOpts()); clearTimeout(watchdog); playCloud(item, done); }
    else { soundBlocked(item.text); done(); }
  }, 3500);
  watchdog = setTimeout(() => { clearTimeout(check); try { speechSynthesis.cancel(); } catch {} done(); }, 5000 + item.text.length * 120);
  face.speak(item.text, u.rate);
  try { if (speechSynthesis.paused) speechSynthesis.resume(); speechSynthesis.speak(u); } catch (e) { admLog('err', 'device voice: ' + e.message); }
}
function speakOnce(text) { enqueueSpeech(text); }
// Muted: no sound, but the face still mouths the words for about as long as they'd take to say.
function speakSilent(item, done) {
  const rate = cfg.rate || 1;
  face.speak(item.text, rate);
  watchdog = setTimeout(done, Math.max(700, (item.text.length / (14 * rate)) * 1000 + 250));
}
function stopSpeech() {
  try { if ('speechSynthesis' in window) speechSynthesis.cancel(); } catch {}
  try { player.pause(); player.removeAttribute('src'); player.load(); } catch {}
}
// Explains, once, why there's no voice and how to fix it.
function noVoiceNotice() {
  if (voiceNoticeShown) return;
  voiceNoticeShown = true;
  const lname = { hi: 'Hindi', te: 'Telugu' }[langBase(cfg.lang)];
  if ('speechSynthesis' in window && !lname) { soundBlocked(lastAnswer); return; }
  const msg = MIC_NOTE ? 'I can\'t speak out loud inside this preview. Open the standalone Holo Tutor in Chrome or Safari to hear me.'
    : lname ? `This phone has no ${lname} voice, so I can't speak yet. Install it: Settings → Text-to-speech → Google → ${lname}. Or add a Google voice key in Settings → Voice.`
    : 'This browser can\'t speak out loud. Try Chrome or Safari, check the volume and silent switch, or add a Google voice key in Settings → Voice.';
  addMsg('tutor', msg).el.classList.add('err');
  admLog('err', msg);
}
function renderVoiceStatus() {
  const st = $('#voiceStatus'); if (!st) return;
  const lname = 'English';
  const dev = !('speechSynthesis' in window) ? 'This browser has no built-in voice.' : deviceBroken ? 'The built-in voice isn\'t working here.' : deviceHasLang() ? `Built-in ${lname} voice: ${voice?.name || 'default'}.` : `No built-in ${lname} voice on this device.`;
  st.textContent = `${dev} Cloud voice: ${cloudOK ? 'ready' : cloudVoice.keyed ? 'add a Google key below' : 'not set up'}. Speaking with: ${useCloud() ? 'cloud voice' : hasDevice() ? 'built-in voice' : 'nothing yet'}.`;
  $$('#engineSeg button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.engine === prefs.voiceEngine)));
}

// ---------- the conversation loop ----------
let busy = false, streamDone = true, reqId = 0, abortCtl = null, awakeUntil = 0, greeted = false, afterSpeech = null, pendingStart = null;
function say(text, { bubble = false, err = false } = {}) {
  admLog('tutor', 'tutor: ' + text);
  busy = true; streamDone = true;
  micWhileBusy();
  if (bubble) { const m = addMsg('tutor', text); if (err) m.el.classList.add('err'); }
  enqueueSpeech(text);
}
// Runs fn once the tutor has finished talking (used to pace the quiz).
function whenIdle(fn) { if (!busy) fn(); else afterSpeech = fn; }
function maybeFinish() {
  if (!busy || !streamDone || speakingNow || speechQ.length) return;
  busy = false;
  if (afterSpeech) { const f = afterSpeech; afterSpeech = null; f(); if (busy) return; }
  resumeIdle();
}
function resumeIdle() {
  if (!VOICE_VIEWS.includes(view)) { setStatus('idle'); return; }
  if (!rec || noVoice) { setStatus('typing'); if (dictate && view === 'session') setTimeout(() => $('#typeInput').focus(), 50); return; }
  if (paused) { setStatus('paused'); return; }
  setStatus('listening'); listen();
}
function interrupt() {
  reqId++;
  afterSpeech = null;
  abortCtl?.abort(); abortCtl = null;
  speechQ.length = 0; currentItem = null; speakingNow = false; clearTimeout(watchdog);
  stopSpeech();
  face.stop();
  $('#countdown').classList.remove('show');
  if (camStream) { closeCamera(); $('#cam').hidden = true; }
  chatEl.querySelector('.msg.pending')?.remove();
  streamDone = true;
  maybeFinish();
  if (!busy) resumeIdle();
}

function splitSentences(buf) {
  const out = []; let rest = buf, m;
  while ((m = /([.!?…]["')\]]?\s+|\n+)/.exec(rest))) {
    const end = m.index + m[0].length;
    const s = rest.slice(0, end).trim(); if (s) out.push(s);
    rest = rest.slice(end);
  }
  return { sentences: out, rest };
}

const lessonContext = () => ({ subject: sessSubject(), level: prefs.level, lang: cfg.lang, mode, name: Account.firstName || undefined, twin: mode === 'twin' ? { name: twin.name, text: twinMaterial(twin, 9000) } : undefined });
async function ask(text, image) {
  const myId = ++reqId;
  imageSeq++;
  if (holoMedia === 'image' || holoMedia === 'list') setHoloMedia(null);
  hideChips(); lastActivity = Date.now(); lastAsked = text;
  faceLock = false; answerBoard = false; setHoloView('face'); // the face listens; the board comes back if this answer explains on it
  busy = true; streamDone = false;
  micWhileBusy();
  setStatus('thinking');
  history.push({ role: 'user', text, image });
  const bubble = addMsg('tutor'); bubble.el.classList.add('pending');
  const ctl = new AbortController(); abortCtl = ctl;
  let full = '', said = '', pending = '', failed = null;
  const onText = (whole) => {
    if (myId !== reqId) return;
    full = whole;
    const r = splitReply(whole);
    if (r.spoken) { bubble.el.classList.remove('pending'); bubble.set(r.spoken); }
    const delta = r.spoken.startsWith(said) ? r.spoken.slice(said.length) : '';
    said = r.spoken; pending += delta;
    const { sentences, rest } = splitSentences(pending);
    pending = rest;
    sentences.forEach(enqueueSpeech);
    if (whole.includes('<') && pending.trim()) { enqueueSpeech(pending); pending = ''; } // spoken part is complete
    if (r.board.length || r.topic) updateBoard(r.board, r.topic);
  };
  try {
    const answer = await askBrain(history, { onText, signal: ctl.signal, context: lessonContext() });
    if (myId === reqId && answer && answer.length > full.length) onText(answer);
  } catch (err) { failed = err; }

  if (myId !== reqId) { history.push({ role: 'assistant', text: full.trim() || '(interrupted)' }); if (full) lessonRecord(text, full); return; }
  abortCtl = null;
  if (failed) {
    history.pop(); bubble.el.remove();
    console.error(failed);
    admLog('err', 'error: ' + (failed.message || failed.code || failed));
    say(`${T(cfg.lang).sorry} ${langBase(cfg.lang) === 'en' ? errorHint(failed) : ''}`.trim(), { bubble: true, err: true });
    return;
  }
  if (pending.trim()) enqueueSpeech(pending);
  const r = splitReply(full + (full.includes('<board>') && !full.includes('</board>') ? '\n</board>' : ''));
  updateBoard(r.board, r.topic);
  if (!r.spoken) bubble.el.remove(); else addHearButton(bubble, r.spoken);
  lastAnswer = r.spoken;
  history.push({ role: 'assistant', text: full.trim() || '(no answer)' });
  lessonRecord(text, full);
  admLog('tutor', 'tutor: ' + (r.spoken || '(no speech)') + (r.board.length ? '  [board: ' + r.board.join(' | ') + ']' : '') + (r.image ? '  [picture: ' + r.image + ']' : '') + (r.topic ? '  [topic: ' + r.topic + ']' : ''));
  if (r.image) showImage(r.image);
  showChips();
  streamDone = true;
  maybeFinish();
}

// ---------- speech input ----------
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null, recRunning = false, micWanted = false, noVoice = !SR, hearing = false, hearingAt = 0, netErrors = 0;
function initRecognition() {
  if (rec || !SR) return;
  rec = new SR();
  // On computers, one long listening session (fewer restarts, and Chrome asks for the mic far
  // less often, e.g. when the app is opened as a file). Android's continuous mode repeats words,
  // so phones restart after each phrase instead.
  rec.lang = cfg.lang; rec.continuous = !/Android/i.test(navigator.userAgent || ''); rec.interimResults = true; rec.maxAlternatives = 1;
  rec.onresult = (e) => {
    let interim = '', final = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) final += r[0].transcript; else interim += r[0].transcript;
    }
    if (interim) { hearing = true; hearingAt = Date.now(); }
    if (interim && !busy) { $('#status').textContent = '“' + interim + '”'; $('#qStatus').textContent = '“' + interim + '”'; showInterim(interim); }
    if (final.trim()) { hideInterim(); netErrors = 0; onHeard(final.trim()); }
  };
  rec.onspeechstart = () => { hearing = true; hearingAt = Date.now(); if (document.body.dataset.state === 'listening') $('#vdStateText').textContent = 'Hearing you'; };
  rec.onspeechend = () => { hearing = false; };
  rec.onstart = () => { if (voiceAlertKind === 'mic') hideVoiceAlert(); };
  rec.onerror = (e) => {
    if (e.error !== 'no-speech' && e.error !== 'aborted') admLog('err', 'mic: ' + e.error);
    hideInterim();
    const fatal = { 'not-allowed': 1, 'service-not-allowed': 1, 'audio-capture': 1, 'language-not-supported': 1 };
    if (fatal[e.error]) {
      micWanted = false; noVoice = true;
      $('#typeRow').hidden = false;
      if (chatEl.querySelector('.empty-hint')) emptyHint();
      if (!busy) setStatus('typing');
      micProblem(e.error);
    } else if (e.error === 'network') {
      // Chrome sends the audio to its speech service: without internet it can't recognise words.
      if (++netErrors >= 2) showVoiceAlert('mic', 'Voice input needs an internet connection here (the browser sends your audio to its speech service). Check your connection, or type below.', 'Type instead', openTyping);
    }
  };
  rec.onend = () => { recRunning = false; hearing = false; if (micWanted) setTimeout(startRec, netErrors ? Math.min(5000, 600 * netErrors) : 150); };
}
function startRec() {
  if (!rec || recRunning || !micWanted || noVoice) return;
  try { rec.start(); recRunning = true; } catch {}
}
function listen() { if (noVoice) return; micWanted = true; startRec(); }
function micWhileBusy() {
  if (cfg.bargeIn && !paused && !noVoice && VOICE_VIEWS.includes(view)) listen(); else mute();
}
const recentSpoken = [];
let lastSpeechEnd = 0;
function noteSpoken(t) { recentSpoken.push(t.toLowerCase()); if (recentSpoken.length > 4) recentSpoken.shift(); }
function isEcho(heard) {
  const words = heard.toLowerCase().match(/[\p{L}\p{M}\p{N}']+/gu) || [];
  if (!words.length) return true;
  const pool = new Set(recentSpoken.concat(speechQ).join(' ').toLowerCase().match(/[\p{L}\p{M}\p{N}']+/gu) || []);
  return words.filter((w) => pool.has(w)).length / words.length >= 0.6;
}
function mute() { micWanted = false; if (rec && recRunning) { try { rec.abort(); } catch {} } }

const STOP_RE = /^(ok(ay)? )?(stop|wait|hold on|pause|be quiet|quiet|enough|shut up)\b/i;
const FACE_RE = /^(?:can you |please |ok |okay )?(?:show (?:me )?(?:your |the )?face|let me see (?:your |the )?face|show (?:yourself|the tutor)|look at me|face|i want to see (?:your|the) face|hide (?:the )?(?:white ?)?board|close (?:the )?(?:white ?)?board)( please)?$/;
const BOARD_RE = /^(?:can you |please |ok |okay )?(?:show (?:me )?(?:the |your )?(?:white ?)?board|back to (?:the )?(?:white ?)?board|(?:white ?)?board|hide (?:your |the )?face)( please)?$/;
// Face or board in holo mode. While the tutor is talking it switches silently and keeps explaining.
function holoViewCommand(s, quiet = false) {
  if (FACE_RE.test(s)) { faceLock = true; setHoloView('face'); if (!quiet) say(T(cfg.lang).faceOn); return true; }
  if (BOARD_RE.test(s)) {
    if (!boardLines.length) { if (!quiet) say(T(cfg.lang).noBoard); return true; }
    faceLock = false; setHoloView('board'); if (!quiet) say(T(cfg.lang).boardOn); return true;
  }
  return false;
}
const WAKE_RE = /^(hey|hi|hello|ok|okay)?[\s,]*(holo |hollow )?tutor\b[\s,.!]*/i;
function onHeard(raw) {
  hideInterim();
  let text = raw.trim();
  if (text && !isEcho(text)) lastActivity = Date.now();
  if (!text) return;
  if (videoOpen) { // the video's own sound is heard too, so only "close video" counts
    if (/\b(close|stop|exit|end|quit|pause|hide)\b.*\b(video|it|this)\b|^(close|stop|back|done|exit|enough)$|बंद|रुको|ఆపు|మూసివేయి|ఆపండి/u.test(norm(text))) closeVideo();
    return;
  }
  if (busy || Date.now() - lastSpeechEnd < 1500) {
    // Full duplex: the mic stays open while the tutor talks. Ignore the tutor's own voice
    // coming back through the speaker; anything else you say cuts in.
    if (STOP_RE.test(text) && text.split(/\s+/).length <= 3) { if (busy) interrupt(); return; }
    const vc = norm(text);
    if (holoViewCommand(vc, true)) return; // face/board: don't cut the explanation
    const quizAnswer = view === 'quiz' && quiz && !quiz.answered && text.split(/\s+/).length <= 3 && parseChoice(text, quiz.qs[quiz.i]) >= 0;
    const videoCmd = view === 'session' && (VIDEO_RE.test(norm(text)) || (videoList.length && PLAY_RE.test(norm(text))));
    if (!quizAnswer && !videoCmd && isEcho(text)) return;
    if (busy) interrupt();
  }
  if (cfg.wake && Date.now() > awakeUntil) {
    const m = WAKE_RE.exec(text);
    if (!m) { setStatus('listening'); return; }
    text = text.slice(m[0].length).trim();
    awakeUntil = Date.now() + 45000;
    if (!text) { say('Yes? I\'m listening.'); return; }
  }
  if (cfg.wake) awakeUntil = Date.now() + 45000;
  handleInput(text);
}
function handleInput(text) {
  admLog(typedNow ? 'typed' : 'heard', (typedNow ? 'typed: ' : 'heard: ') + text); typedNow = false;
  if (view === 'quiz') { quizInput(text); return; }
  if (view === 'train') { trainInput(text); return; }
  if (twinFix && mode === 'twin') { saveCorrection(text); return; }
  text = chipPhrase(text);
  if (handleCommand(text)) return;
  addMsg('you', text);
  ask(text);
}
const norm = (t) => t.toLowerCase().replace(/[^\p{L}\p{M}\p{N}' ]/gu, ' ').replace(/\s+/g, ' ').trim();

const VIDEO_RE = /^(?:can you |please |ok |okay )?(?:show me|find( me)?|play|give me|get me|watch|i want to (?:see|watch)|let'?s watch)(?: a| some| the)? (?:short |quick )?(?:video|videos|clip|clips)(?: (?:on|about|of|for) (.+?))?( please)?$/;
const PLAY_RE = /^(?:play|watch|open|start)(?: the)?(?: (first|second|third|1st|2nd|3rd|one|two|three|1|2|3|last))?(?: one| video)?$/;
function handleCommand(text) {
  const s = norm(text);
  if (STOP_RE.test(s) && s.split(' ').length <= 3) { resumeIdle(); return true; }
  if (/^(please )?(go to |switch to |enter |start |open |turn on )?(the )?(holo|hologram|hollow|holographic)( mode| view)?( please)?$/.test(s)) {
    show('live'); say(T(cfg.lang).holoOn); return true;
  }
  if (/^(please )?(go to |switch to |back to |exit |leave )?(the )?(screen|normal|phone|regular)( mode| view)?( please)?$/.test(s)
    || /^(exit|leave|stop|turn off|close) (the )?(holo|hologram|hollow)( mode)?$/.test(s)) {
    show('session'); say(T(cfg.lang).screenOn); return true;
  }
  if (holoViewCommand(s)) return true;
  if (/^(?:let'?s |i want to |can we )?(?:train|teach)(?: my| the)? (?:ai )?twin(?: please)?$|^train ai(?: mode)?$/.test(s)) { show('train'); return true; }
  if (/^(?:let me |i want to |can i )?(?:talk|chat|speak) (?:to|with) my (?:ai )?twin(?: please)?$/.test(s)) { startTwinChat(); return true; }
  if (/^(?:can you |please |ok |okay )?(?:show |tell me |what'?s |what is |check )?(?:my |me my )?(?:progress|score|scores|points|xp|level|badges|stats|trophies)(?: please)?$|^how am i doing$|^how many (?:points|xp|badges) do i have$/.test(s)) {
    if (mode === 'fun') { say(funSummaryLine()); showToast({ kind: 'summary', emoji: '🏆', title: `Level ${levelOf(funP.xp)} · ${levelTitle(levelOf(funP.xp))}`, sub: `${funP.xp} XP · 🔥 ${funStreak(funP)} · ${BADGES.filter((b) => funP.badges[b.id]).length}/${BADGES.length} badges` }); }
    else say(T(cfg.lang).studySummary(streak(), prog.lessons, prog.quiz.asked ? Math.round((100 * prog.quiz.correct) / prog.quiz.asked) : 0));
    return true;
  }
  if (/^(flip|mirror|rotate)( it| the image| the screen| image| screen)?( please)?$/.test(s)) { cycleOrient(); return true; }
  if (/^(switch|change|flip) (the )?camera$/.test(s)) {
    facing = facing === 'environment' ? 'user' : 'environment';
    say(facing === 'user' ? 'Using the front camera.' : 'Using the back camera.'); return true;
  }
  const im = /^(?:can you |please |ok |okay )?(?:show me|find( me)?|give me|get me|i want to see)(?: a| an| the| some)? (?:picture|photo|image|diagram|drawing|map)s?(?: (?:of|for|showing|about) (.+?))?( please)?$/.exec(s);
  if (im) { showImage(im[2] || currentTopic(), { announce: true }); return true; }
  if (/^(hide|close|remove|clear)( the)? (picture|photo|image|diagram|map|video list|videos|list)$/.test(s)) { setHoloMedia(null); say('Okay.'); return true; }
  const vm = VIDEO_RE.exec(s);
  if (vm) { showVideos(vm[2]); return true; }
  const pm = PLAY_RE.exec(s);
  if (pm && videoList.length) { const k = { first: 0, '1st': 0, one: 0, 1: 0, second: 1, '2nd': 1, two: 1, 2: 1, third: 2, '3rd': 2, three: 2, 3: 2, last: videoList.length - 1 }[pm[1]] ?? 0; playVideo(videoList[Math.min(k, videoList.length - 1)]); return true; }
  if (/^(?:ok |okay )?(?:let'?s|time to|i want to|switch to|go to|start) ?(?:study|studying|learn|learning)(?: mode| time)?( now| please)?$|^study mode$/.test(s)) {
    if (setMode('study')) greeted = true;
    say(T(cfg.lang).studyTime, { bubble: true }); return true;
  }
  if (/^(?:ok |okay )?(?:let'?s (?:have fun|chat|play|have a fun chat|do fun chat)|fun (?:chat|mode|time)|switch to fun(?: chat| mode)?|i want to have fun|time for fun)( now| please)?$/.test(s)) {
    if (setMode('fun')) greeted = true;
    say(T(cfg.lang).funTime, { bubble: true }); return true;
  }
  const qm = /^(?:can you |please |ok |okay )?(?:quiz me|test me|give me a (?:quiz|test)|start a quiz|let'?s do a quiz)(?: (?:on|about) (.+))?( please)?$/.exec(s);
  if (qm) { quizFromLesson(qm[1]); return true; }
  if (/^(start over|new topic|new lesson|reset|clear( the)? (chat|conversation)|forget (that|everything))$/.test(s)) {
    if (lesson) { const L = lesson; lesson = null; if (L.turns.length) { if (L.subject === 'fun') { funChatEnded(funP); saveFun(); } else if (L.subject !== 'twin') { prog.lessons++; saveProg(); } putLesson(L); if (L.subject !== 'twin') makeRecap(L.id); } }
    resetConversation(); greeted = true;
    say(T(cfg.lang).fresh, { bubble: true }); return true;
  }
  if (/^(repeat( that)?|say (that|it) again|again|come again|pardon)( please)?$/.test(s)) {
    say(lastAnswer || 'I haven\'t said anything yet. Ask me a question!'); return true;
  }
  if (/^(read|what'?s on) (the |my )?(white ?)?board$/.test(s)) {
    say(boardLines.length ? 'On the board: ' + boardLines.join('. ') : 'The board is empty so far.'); return true;
  }
  if (/^(help|what can you do|how does this work)$/.test(s)) {
    say('Ask me any question out loud and I\'ll write the key points on the whiteboard. Say "show me a video" for a short video on it, "quiz me" to test yourself, "look at this" to show me your homework, "hologram mode" or "screen mode" to switch views, "repeat" to hear me again, and "start over" for a new topic.', { bubble: true });
    return true;
  }
  if (/\b(look at|see|read|check|scan) (this|that|my (homework|page|book|notes|paper|answer|work|question|diagram|drawing))\b|\btake a (photo|picture)\b|\bshow(ing)? you (this|something)\b/.test(s)) {
    addMsg('you', text);
    capturePhoto(text); return true;
  }
  return false;
}

// ---------- quiz ----------
let quiz = null, quizSeq = 0, quizReturn = 'session';
function currentTopic() { return lesson?.topic || boardTopic || (mode === 'fun' ? 'movies and video games' : prefs.subject !== 'any' ? subjectName(prefs.subject) : ''); }
function quizFromLesson(topicAsked) {
  const topic = (topicAsked || currentTopic() || '').trim();
  if (!topic) { say('Sure! What topic should I quiz you on?', { bubble: view === 'session' }); return; }
  const notes = lesson ? lesson.turns.slice(-4).map((t) => `Student: ${t.q}\nTutor: ${t.a}`).join('\n') + (boardLines.length ? '\nBoard: ' + boardLines.join(' | ') : '') : '';
  startQuiz({ topic, subject: lesson?.subject || sessSubject(), level: prefs.level, notes, from: view === 'live' ? 'session' : view });
}
function shuffleOrder(n) { const a = [...Array(n).keys()]; for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function cleanQuiz(d) {
  const out = [];
  for (const q of (Array.isArray(d?.questions) ? d.questions : [])) {
    const ans = Number(q?.answer);
    if (!q?.q || !Array.isArray(q.options) || q.options.length !== 4 || !Number.isInteger(ans) || ans < 0 || ans > 3) continue;
    const order = shuffleOrder(4);
    const optSay = Array.isArray(q.options_say) && q.options_say.length === 4 ? q.options_say : q.options;
    out.push({
      q: String(q.q), say: String(q.q_say || q.q),
      options: order.map((i) => String(q.options[i])), optSay: order.map((i) => String(optSay[i])),
      answer: order.indexOf(ans), hint: String(q.hint || ''), why: String(q.why || ''), skill: String(q.skill || '').slice(0, 40),
    });
    if (out.length >= 8) break;
  }
  return out;
}
async function startQuiz({ topic, subject, level, notes = '', from = 'session' }) {
  interrupt();
  const mine = ++quizSeq;
  quiz = { topic, subject, level, notes, qs: [], i: 0, results: [], answered: false, done: false, id: mine };
  quizReturn = ['session', 'recap', 'progress'].includes(from) ? from : 'session';
  quizT.setKind(prefs.kind);
  $('#quizTitle').textContent = 'Quiz · ' + topic;
  $('#quizCount').textContent = '';
  $('#quizProg').innerHTML = '';
  $('#quizLoading').hidden = false; $('#quizLoadingText').textContent = 'Writing your quiz…';
  $('#quizQ').hidden = true; $('#quizDone').hidden = true; $('#quizBar').hidden = false;
  if (view !== 'quiz') show('quiz');
  say(T(cfg.lang).quizIntro(topic));
  let qsList = [];
  try { qsList = cleanQuiz(await askJSON(quizPrompt({ topic, subject, level, notes, lang: cfg.lang }))); } catch (err) { console.warn('Quiz failed', err); }
  if (!quiz || quiz.id !== mine) return;
  if (!qsList.length) {
    $('#quizLoadingText').textContent = 'Couldn\'t write the quiz. Say “try again”, or go back.';
    quiz.failed = true;
    whenIdle(() => say('Sorry, I couldn\'t write that quiz just now. Say try again, or go back to the lesson.'));
    return;
  }
  quiz.qs = qsList;
  whenIdle(() => askQuestion());
}
function renderQuizProg() {
  const p = $('#quizProg'); p.innerHTML = '';
  quiz.qs.forEach((_, k) => {
    const r = quiz.results[k];
    p.append(el('i', r ? (r.ok ? 'right' : 'wrong') : k === quiz.i && !quiz.done ? 'now' : ''));
  });
  $('#quizCount').textContent = quiz.done ? '' : `${quiz.i + 1} / ${quiz.qs.length}`;
}
function askQuestion(reread = false) {
  const q = quiz.qs[quiz.i];
  if (!reread) {
    quiz.answered = false;
    $('#quizLoading').hidden = true; $('#quizQ').hidden = false; $('#quizDone').hidden = true; $('#quizBar').hidden = false;
    $('#qText').textContent = q.q;
    $('#qFeedback').textContent = '';
    const box = $('#qOpts'); box.innerHTML = '';
    q.options.forEach((o, k) => {
      const b = el('button', 'qopt'); b.type = 'button';
      b.append(el('span', 'letter', LETTERS[k]), el('span', '', o));
      b.addEventListener('click', () => { if (busy) interrupt(); answerQuiz(k); });
      box.append(b);
    });
    renderQuizProg();
  }
  say(`${T(cfg.lang).question(quiz.i + 1)} ${q.say} ` + q.optSay.map((o, k) => `${LETTERS[k]}: ${o}.`).join(' '));
}
function answerQuiz(k) {
  if (!quiz || quiz.done || quiz.answered || !quiz.qs.length) return;
  quiz.answered = true;
  const q = quiz.qs[quiz.i];
  const ok = k === q.answer;
  quiz.results[quiz.i] = { ok, picked: k };
  $$('#qOpts .qopt').forEach((b, j) => {
    b.disabled = true;
    if (j === q.answer) b.classList.add('right');
    else if (j === k) b.classList.add('wrong');
  });
  renderQuizProg();
  const right = `${LETTERS[q.answer]}, ${q.options[q.answer]}`;
  const shown = ok ? `Correct! ${q.why}` : k < 0 ? `Skipped. The answer is ${right}. ${q.why}` : `Not quite. The answer is ${right}. ${q.why}`;
  $('#qFeedback').textContent = shown;
  const TL = T(cfg.lang);
  const praise = TL.praise[quiz.i % 4];
  const spoken = ok ? `${praise} ${q.why}` : `${k < 0 ? TL.noProblem : TL.notQuite} ${TL.answerIs(LETTERS[q.answer], q.optSay[q.answer])} ${q.why}`;
  interrupt();
  say(spoken);
  whenIdle(() => nextQuestion());
}
function nextQuestion() {
  if (!quiz || quiz.done) return;
  if (quiz.i + 1 >= quiz.qs.length) { finishQuiz(); return; }
  quiz.i++;
  askQuestion();
}
function finishQuiz() {
  quiz.done = true;
  const n = quiz.qs.length, c = quiz.results.filter((r) => r?.ok).length;
  // progress: fun trivia earns XP and badges; study quizzes track accuracy and weak spots by sub-skill
  let funEv = null;
  if (quiz.subject === 'fun') { funEv = funTrivia(funP, c, n); saveFun(); }
  else {
  markDay();
  prog.quiz.asked += n; prog.quiz.correct += c;
  quiz.qs.forEach((q, k) => {
    const key = q.skill || quiz.topic;
    const w = prog.weak[key];
    if (quiz.results[k]?.ok) { if (w) { w.missed -= 1; if (w.missed <= 0) delete prog.weak[key]; } }
    else prog.weak[key] = { subject: quiz.subject, topic: quiz.topic, missed: (w?.missed || 0) + 1, last: Date.now() };
  });
  noteTopic(quiz.subject, quiz.topic);
  saveProg();
  }

  $('#quizQ').hidden = true; $('#quizLoading').hidden = true; $('#quizDone').hidden = false; $('#quizBar').hidden = true;
  renderQuizProg();
  const C = 2 * Math.PI * 52, arc = $('#scoreArc');
  arc.style.strokeDasharray = C; arc.style.strokeDashoffset = C;
  requestAnimationFrame(() => requestAnimationFrame(() => { arc.style.strokeDashoffset = C * (1 - c / n); }));
  $('#scoreText').textContent = `${c} / ${n}`;
  const title = c === n ? 'Perfect score!' : c / n >= 0.7 ? 'Great work!' : c / n >= 0.4 ? 'Good effort!' : 'Let\'s keep practising';
  $('#scoreTitle').textContent = title + (funEv ? ` · +${funEv.gained} XP` : '');
  $('#quizBackLesson').textContent = quiz.subject === 'fun' ? (quizReturn === 'progress' ? 'See my badges' : 'Back to fun chat') : 'Back to lesson';
  if (funEv) setTimeout(() => celebrate(funEv), 600);
  const list = $('#quizReview'); list.innerHTML = '';
  quiz.qs.forEach((q, k) => {
    const ok = quiz.results[k]?.ok;
    const li = el('li', ok ? 'ok' : 'no');
    const t = el('span'); t.append(document.createTextNode(q.q), el('span', 'ans', ok ? q.options[q.answer] : `Answer: ${LETTERS[q.answer]}, ${q.options[q.answer]}`));
    li.append(el('span', 'mark', ok ? '✓' : '✗'), t);
    list.append(li);
  });
  const weak = [...new Set(quiz.qs.filter((q, k) => !quiz.results[k]?.ok).map((q) => q.skill).filter(Boolean))];
  $('#quizWeak').hidden = !weak.length;
  $('#quizWeak').textContent = weak.length ? `Review next: ${weak.slice(0, 2).join(' and ')}. It's saved in your weak spots on the Progress tab.` : '';
  const TL = T(cfg.lang), en = langBase(cfg.lang) === 'en';
  say(`${TL.result(c, n)} ${en ? (/[.!?]$/.test(title) ? title : title + '.') : ''}${weak.length ? TL.reviewNext(weak[0]) : ''}${TL.quizEnd}`);
}
function leaveQuiz() {
  interrupt();
  quiz = null;
  show(quizReturn === 'quiz' ? 'session' : quizReturn);
}
function quizInput(text) {
  const s = norm(text);
  if (!quiz) return;
  if (/\b(end|stop|exit|quit|leave|finish)( the)? quiz\b|^back( to (the )?(lesson|session|class))?$|^(i'?m )?done$/.test(s)) { leaveQuiz(); return; }
  if (quiz.done || quiz.failed) {
    if (/\b(try again|again|another|new quiz|one more|retry)\b/.test(s)) { startQuiz({ topic: quiz.topic, subject: quiz.subject, level: quiz.level, notes: quiz.notes, from: quizReturn }); return; }
    if (/\b(back|lesson|continue|no)\b/.test(s)) { leaveQuiz(); return; }
    say('Say try again for a new quiz, or back to lesson.');
    return;
  }
  if (!quiz.qs.length) return;
  const q = quiz.qs[quiz.i];
  if (/^(hint|give me a hint|a hint|clue|help( me)?|i need (a )?hint)( please)?$/.test(s)) { say(q.hint || 'Think about what the question is really asking.'); return; }
  if (/^(repeat|again|read (it|that) again|say (that|it) again|pardon|what)( please)?$/.test(s)) { quiz.answered ? say($('#qFeedback').textContent) : askQuestion(true); return; }
  if (/^(skip|next|pass|i don'?t know|no idea|not sure)( one| question| please)?$/.test(s)) { if (!quiz.answered) answerQuiz(-1); else nextQuestion(); return; }
  if (quiz.answered) { nextQuestion(); return; }
  const k = parseChoice(text, q);
  if (k >= 0) answerQuiz(k);
  else say(T(cfg.lang).sayChoice);
}
// Understands "B", "option c", "it's the second one", or the option itself ("twenty five").
const NUMWORDS = { zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10', eleven: '11', twelve: '12', twenty: '20', thirty: '30', forty: '40', fifty: '50', hundred: '100', minus: '-', negative: '-' };
const normOpt = (t) => norm(t.replace(/−/g, '-').replace(/-/g, ' minus ')).split(' ').map((w) => NUMWORDS[w] ?? w).join(' ').replace(/(\d+) (\d)\b/g, (m, a, b) => (a.endsWith('0') && a.length >= 2 ? String(+a + +b) : m)).replace(/- (\d)/g, '-$1').trim();
const LETTER_WORDS = { a: 0, ay: 0, eh: 0, hey: 0, b: 1, be: 1, bee: 1, bi: 1, c: 2, see: 2, sea: 2, cee: 2, si: 2, d: 3, dee: 3, de: 3, di: 3 };
function parseChoice(text, q) {
  if (!q) return -1;
  const s = normOpt(text);
  const opts = q.options.map(normOpt);
  const exact = opts.indexOf(s);
  if (exact >= 0) return exact;
  const words = s.split(' ');
  const lead = /^(?:(?:it'?s|its|it is|is|option|answer|letter|the answer is|my answer is|i think|i think it'?s|i choose|i pick|i'?ll go with|go with) )*([a-z]+)$/.exec(s);
  if (lead && LETTER_WORDS[lead[1]] !== undefined && words.length <= 6) return LETTER_WORDS[lead[1]];
  const contains = opts.map((o, k) => (o && (` ${s} `).includes(` ${o} `) ? k : -1)).filter((k) => k >= 0);
  if (contains.length === 1) return contains[0];
  const ord = /\b(first|second|third|fourth|last)\b/.exec(s);
  if (ord) return { first: 0, second: 1, third: 2, fourth: 3, last: 3 }[ord[1]];
  const set = new Set(words);
  const scores = opts.map((o) => { const t = o.split(' ').filter((w) => w.length > 2 || /\d/.test(w)); return t.length ? t.filter((w) => set.has(w)).length / t.length : 0; });
  const best = Math.max(...scores);
  if (best >= 0.75 && scores.filter((x) => x === best).length === 1) return scores.indexOf(best);
  return -1;
}
$('#qHint').addEventListener('click', () => { if (!quiz?.qs.length || quiz.done) return; interrupt(); say(quiz.qs[quiz.i].hint || 'Think about what the question is really asking.'); });
$('#qSkip').addEventListener('click', () => { if (!quiz?.qs.length || quiz.done) return; interrupt(); if (!quiz.answered) answerQuiz(-1); else nextQuestion(); });
$('#quizBack').addEventListener('click', leaveQuiz);
$('#quizBackLesson').addEventListener('click', leaveQuiz);
$('#quizAgain').addEventListener('click', () => { if (quiz) startQuiz({ topic: quiz.topic, subject: quiz.subject, level: quiz.level, notes: quiz.notes, from: quizReturn }); });

// ---------- history & recap ----------
function renderHistory() {
  const list = $('#histList'); list.innerHTML = '';
  const all = getLessons();
  if (!all.length) { list.append(el('div', 'emptystate', 'Your lessons will appear here, each with a short recap you can replay.')); return; }
  const groupOf = (t) => { const k = dayKey(t); if (k === dayKey()) return 'TODAY'; if (k === dayKey(Date.now() - 864e5)) return 'YESTERDAY'; if (Date.now() - t < 7 * 864e5) return 'THIS WEEK'; return 'EARLIER'; };
  let g = '';
  all.forEach((L) => {
    const gg = groupOf(L.start);
    if (gg !== g) { g = gg; list.append(el('h2', 'histgroup', g)); }
    const b = el('button', 'histrow'); b.type = 'button';
    const ic = el('span', 'hicon'); ic.innerHTML = icon(L.subject);
    const tx = el('span', 'htext');
    const mins = Math.max(1, Math.round(((L.end || L.start) - L.start) / 60000));
    tx.append(el('span', 'htitle', L.topic || L.recap?.title || 'Lesson'), el('span', 'hmeta', `${subjectName(L.subject)} · ${KIND_NAME[L.kind] || 'Tutor'}`), el('span', 'hmeta', `${L.turns.length} question${L.turns.length === 1 ? '' : 's'} · ${mins} min`));
    b.append(ic, tx, el('span', 'htime', dayKey(L.start) === dayKey() ? fmtTime(L.start) : new Date(L.start).toLocaleDateString([], { day: 'numeric', month: 'short' })));
    b.addEventListener('click', () => openRecap(L.id));
    list.append(b);
  });
}
let recapId = null;
function openRecap(id) { recapId = id; if (view === 'recap') renderRecap(); else show('recap'); }
function renderRecap() {
  const L = findLesson(recapId);
  if (!L) { show('history'); return; }
  recapT.setKind(L.kind === 'photo' && !facePhoto ? 'human' : L.kind || 'globe');
  $('#rcTitle').textContent = L.topic || L.recap?.title || 'Lesson';
  $('#rcMeta').textContent = `${fmtWhen(L.start)} · ${subjectName(L.subject)} · ${KIND_NAME[L.kind] || 'Tutor'}`;
  const sum = $('#rcSummary');
  if (L.recap?.summary) { sum.textContent = L.recap.summary; sum.classList.remove('pending'); }
  else if (L.recapFailed) { sum.textContent = `We talked about ${L.topic || 'your questions'}. ${L.turns[0]?.a || ''}`.trim(); sum.classList.remove('pending'); }
  else { sum.textContent = 'Writing your recap…'; sum.classList.add('pending'); makeRecap(L.id); }
  const pts = L.recap?.points || [];
  $('#rcPointsWrap').hidden = !pts.length;
  $('#rcPoints').innerHTML = ''; pts.forEach((p) => $('#rcPoints').append(el('li', '', p)));
  $('#rcVideosWrap').hidden = !L.videos?.length;
  if (L.image && CAN_WEB_IMAGES) { const cardImg = el('a', 'vcard'); cardImg.href = L.image.page; cardImg.target = '_blank'; cardImg.rel = 'noopener'; const th = el('span', 'vthumb'); const im2 = el('img'); im2.src = L.image.src; im2.alt = ''; th.append(im2); const tx = el('span', 'vtext'); tx.append(el('span', 'vtitle', L.image.title), el('span', 'vmeta', 'Picture · Wikipedia')); cardImg.append(th, tx); $('#rcVideosWrap').hidden = false; $('#rcVideos').replaceChildren(cardImg, ...(L.videos || []).map((v) => videoCard(v))); }
  else
  $('#rcVideos').replaceChildren(...(L.videos || []).map((v) => videoCard(v)));
  $('#rcBoardWrap').hidden = !L.board?.length;
  fillBoard($('#rcBoard'), L.board || [], 0);
  const tr = $('#rcTranscript'); tr.innerHTML = '';
  L.turns.forEach((t) => { tr.append(el('p', 'you', 'You: ' + t.q), el('p', '', 'Tutor: ' + t.a)); });
  $('#rcNext').textContent = L.recap?.next ? `Next up: ${L.recap.next}` : '';
  setStatus(busy ? 'speaking' : 'idle');
}
$('#rcPlay').addEventListener('click', () => {
  if (busy) { interrupt(); setStatus('idle'); return; }
  const L = findLesson(recapId); if (!L) return;
  const text = L.recap?.summary || $('#rcSummary').textContent;
  if (!text || $('#rcSummary').classList.contains('pending')) return;
  say(text + (L.recap?.points?.length ? ' The key points: ' + L.recap.points.join('. ') + '.' : ''));
  setStatus('speaking');
});
$('#rcQuiz').addEventListener('click', () => {
  const L = findLesson(recapId); if (!L) return;
  const notes = (L.recap?.summary || '') + '\n' + L.turns.slice(-4).map((t) => `Student: ${t.q}\nTutor: ${t.a}`).join('\n');
  startQuiz({ topic: L.topic || L.recap?.title || 'this lesson', subject: L.subject, level: L.level || prefs.level, notes, from: 'recap' });
});
$('#rcContinue').addEventListener('click', () => {
  const L = findLesson(recapId); if (!L) return;
  setMode(L.subject === 'fun' ? 'fun' : 'study');
  if (L.subject && L.subject !== 'fun' && L.subject !== prefs.subject) savePref('subject', L.subject);
  const topic = L.topic || L.recap?.title || 'our last lesson';
  pendingStart = {
    display: `Continue: ${topic}`,
    text: `Let's continue with ${topic}. Last time: ${L.recap?.summary || L.turns.slice(-1)[0]?.a || ''} Give me a quick reminder, then take me one step further.`,
  };
  resetConversation(); applyKind();
  show('session');
});

// ---------- progress ----------
let progTab = 'study', progFrom = null;
function renderProgress() {
  $$('#progSeg button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.p === progTab)));
  $('#funProg').hidden = progTab !== 'fun'; $('#studyProg').hidden = progTab === 'fun';
  $('#v-progress').classList.toggle('isfun', progTab === 'fun');
  $('#progTitle').textContent = progTab === 'fun' ? 'Your fun zone' : 'Your progress';
  $('#progBack').hidden = progFrom !== 'session';
  if (progTab === 'fun') { renderFunProgress(); return; }
  const st = streak();
  $('#streakNum').textContent = st;
  $('#streakSub').textContent = st ? (st === 1 ? 'day streak · come back tomorrow' : 'day streak') : 'Learn something today to start a streak';
  const week = $('#weekDots'); week.innerHTML = '';
  const now = new Date(); const dow = (now.getDay() + 6) % 7; // Monday = 0
  const set = new Set(prog.days);
  'MTWTFSS'.split('').forEach((d, i) => {
    const t = Date.now() - (dow - i) * 864e5;
    const s = el('span', (set.has(dayKey(t)) && i <= dow ? 'on' : '') + (i === dow ? ' today' : ''));
    s.append(el('i'), document.createTextNode(d));
    week.append(s);
  });
  $('#stLessons').textContent = prog.lessons;
  $('#stQuestions').textContent = prog.questions;
  $('#stAcc').textContent = prog.quiz.asked ? Math.round((100 * prog.quiz.correct) / prog.quiz.asked) + '%' : '–';
  const bars = $('#subjBars'); bars.innerHTML = '';
  const rows = Object.entries(prog.subjects).filter(([id]) => id !== 'fun').map(([id, s]) => [id, Object.keys(s.topics).length]).filter(([, n]) => n).sort((a, b) => b[1] - a[1]);
  if (!rows.length) bars.append(el('div', 'emptystate', 'Topics you learn show up here, by subject.'));
  const max = Math.max(1, ...rows.map((r) => r[1]));
  rows.forEach(([id, n]) => {
    const r = el('div', 'sbar');
    const tr = el('div', 'track'); const f = el('div', 'fill'); f.style.width = (100 * n) / max + '%'; tr.append(f);
    r.append(el('span', '', subjectName(id)), tr, el('span', 'n', `${n} topic${n === 1 ? '' : 's'}`));
    bars.append(r);
  });
  const wl = $('#weakList'); wl.innerHTML = '';
  const weak = Object.entries(prog.weak).filter(([, w]) => w.subject !== 'fun').sort((a, b) => b[1].missed - a[1].missed || b[1].last - a[1].last).slice(0, 6);
  if (!weak.length) wl.append(el('div', 'emptystate', 'Questions you miss in quizzes land here, so you can practise them.'));
  weak.forEach(([skill, w]) => {
    const r = el('div', 'weakrow');
    const t = el('span', 'wtext'); t.append(el('span', 'strong', skill), el('span', 'small muted', `${subjectName(w.subject)} · missed ${w.missed}×`));
    const b = el('button', 'pill-outline', 'Practice'); b.type = 'button';
    b.addEventListener('click', () => startQuiz({ topic: skill, subject: w.subject, level: prefs.level, notes: `Focus on ${skill}, part of ${w.topic}.`, from: 'progress' }));
    r.append(t, b); wl.append(r);
  });
}

// ---------- fun progress ----------
function renderFunProgress() {
  renderQotd();
  const f = funP, L = levelOf(f.xp), lo = xpForLevel(L), hi = xpForLevel(L + 1);
  const frac = Math.min(1, (f.xp - lo) / Math.max(1, hi - lo));
  $('#lvNum').textContent = L; $('#lvTitle').textContent = levelTitle(L);
  $('#lvXp').textContent = `${f.xp} XP`;
  $('#lvNext').textContent = `${hi - f.xp} XP to level ${L + 1}`;
  const C = 2 * Math.PI * 52, arc = $('#lvArc');
  arc.style.strokeDasharray = C; arc.style.strokeDashoffset = C;
  $('#xpFill').style.width = '0%';
  requestAnimationFrame(() => requestAnimationFrame(() => { arc.style.strokeDashoffset = C * (1 - frac); $('#xpFill').style.width = (frac * 100).toFixed(1) + '%'; }));
  const st = funStreak(f);
  $('#funStreak').textContent = st;
  $('#funStreakSub').textContent = st ? (st === 1 ? 'day fun streak · come back tomorrow!' : 'day fun streak · keep it going!') : 'Chat today to light the flame';
  $('#funFlame').classList.toggle('lit', st > 0); $('#funFlame').classList.toggle('big', st >= 3);
  const week = $('#funWeek'); week.innerHTML = '';
  const now = new Date(), dow = (now.getDay() + 6) % 7, set = new Set(f.days);
  'MTWTFSS'.split('').forEach((d, i) => {
    const t = Date.now() - (dow - i) * 864e5;
    const sp = el('span', (set.has(funDayKey(t)) && i <= dow ? 'on' : '') + (i === dow ? ' today' : ''));
    sp.append(el('i'), document.createTextNode(d)); week.append(sp);
  });
  $('#fsMsgs').textContent = f.msgs; $('#fsJokes').textContent = f.cats.jokes;
  $('#fsTrivia').textContent = f.trivia.correct; $('#fsBest').textContent = f.trivia.rounds ? f.trivia.best + '%' : '–';
  // what you chat about
  const mix = $('#funMix'); mix.innerHTML = '';
  const cats = Object.entries(f.cats).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const total = cats.reduce((a, [, n]) => a + n, 0);
  if (!total) mix.append(el('div', 'emptystate', 'Ask for jokes, talk movies or games, or play trivia, and your fun mix shows up here.'));
  else {
    const strip = el('div', 'mixstrip');
    cats.forEach(([c, n]) => { const seg = el('i'); seg.style.flexGrow = n; seg.style.background = FUN_CATS[c].color; seg.title = FUN_CATS[c].name; strip.append(seg); });
    mix.append(strip);
    cats.forEach(([c, n], k) => {
      const r = el('div', 'mixrow' + (k === 0 ? ' top' : ''));
      const tr = el('div', 'track'); const fl = el('div', 'fill'); fl.style.width = (100 * n) / cats[0][1] + '%'; fl.style.background = FUN_CATS[c].color; tr.append(fl);
      r.append(el('span', 'me', FUN_CATS[c].emoji), el('span', 'mn', FUN_CATS[c].name + (k === 0 ? ' · your favourite' : '')), tr, el('span', 'n', String(n)));
      mix.append(r);
    });
  }
  // badges
  const grid = $('#badgeGrid'); grid.innerHTML = '';
  const got = BADGES.filter((b) => f.badges[b.id]).length;
  $('#badgeCount').textContent = `${got} / ${BADGES.length}`;
  BADGES.forEach((b) => {
    const have = Boolean(f.badges[b.id]);
    const v = Math.min(b.goal, b.val(f, st));
    const c = el('div', 'badge' + (have ? ' got' : ''));
    c.title = b.desc;
    c.append(el('span', 'bemoji', b.emoji), el('span', 'bname', b.name), el('span', 'bdesc', b.desc));
    if (!have && b.goal > 1) { const bar = el('div', 'bbar'); const i = el('i'); i.style.width = (100 * v) / b.goal + '%'; bar.append(i); c.append(bar, el('span', 'bprog', `${v} / ${b.goal}`)); }
    else if (!have) c.append(el('span', 'bprog', 'Locked'));
    grid.append(c);
  });
  // recently chatted
  const rc = $('#funRecent'); rc.innerHTML = '';
  $('#funRecentBox').hidden = !f.recent.length;
  f.recent.forEach((r) => rc.append(el('span', 'funchip', `${FUN_CATS[r.cat]?.emoji || '✨'} ${r.topic}`)));
}
function updateTrophy() { $('#trophyLv').textContent = 'Lv ' + levelOf(funP.xp); }
function openProgress(tab, from = null) { progTab = tab; progFrom = from; if (view === 'progress') renderProgress(); else show('progress'); }
$$('#progSeg button').forEach((b) => b.addEventListener('click', () => { progTab = b.dataset.p; renderProgress(); }));
$('#funTrophy').addEventListener('click', () => openProgress('fun', 'session'));
$('#progBack').addEventListener('click', () => show('session'));
$('#funChatBtn').addEventListener('click', () => { setMode('fun'); show('session'); });
$('#funTriviaBtn').addEventListener('click', () => {
  setMode('fun');
  const fav = Object.entries(funP.cats).filter(([c]) => ['movies', 'games', 'jokes'].includes(c)).sort((a, b) => b[1] - a[1])[0];
  const topic = fav && fav[1] > 0 ? { movies: 'movies and TV shows', games: 'video games', jokes: 'fun facts' }[fav[0]] : 'movies, games and fun facts';
  startQuiz({ topic, subject: 'fun', level: prefs.level, from: 'progress' });
});

// Celebrations: a popup with confetti and a chime for level-ups and new badges, plus a tiny "+XP".
const toastQ = [];
let toastBusy = false;
function chime(big = false) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const ac = audioCtx; ac.resume?.();
    const notes = big ? [523.25, 659.25, 783.99, 1046.5, 1318.5] : [659.25, 987.77];
    notes.forEach((fq, i) => {
      const o = ac.createOscillator(), g = ac.createGain(), t0 = ac.currentTime + i * (big ? 0.09 : 0.08);
      o.type = 'triangle'; o.frequency.value = fq;
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(big ? 0.09 : 0.06, t0 + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
      o.connect(g).connect(ac.destination); o.start(t0); o.stop(t0 + 0.55);
    });
  } catch {}
}
function showToast(item) { toastQ.push(item); if (!toastBusy) nextToast(); }
function nextToast() {
  const item = toastQ.shift();
  const box = $('#funToast');
  if (!item) { toastBusy = false; box.hidden = true; return; }
  toastBusy = true;
  (view === 'live' ? $('#liveWrap') : document.body).append(box); // in holo mode it's part of the hologram
  box.className = 'funtoast ' + (item.kind || '');
  box.replaceChildren();
  const conf = el('div', 'confetti');
  const COLORS = ['#FFB547', '#FF6B9A', '#4FE3FF', '#7C8CFF', '#5BE3A1', '#FFE36B'];
  for (let i = 0; i < 26; i++) { const c = el('i'); c.style.left = Math.random() * 100 + '%'; c.style.background = COLORS[i % COLORS.length]; c.style.animationDelay = (Math.random() * 0.35).toFixed(2) + 's'; c.style.setProperty('--dx', (Math.random() * 120 - 60).toFixed(0) + 'px'); c.style.setProperty('--r', (Math.random() * 720 - 360).toFixed(0) + 'deg'); conf.append(c); }
  box.append(conf, el('span', 'temoji', item.emoji), el('span', 'ttitle', item.title), el('span', 'tsub', item.sub || ''));
  box.hidden = false;
  chime(item.kind === 'level');
  setTimeout(nextToast, item.kind === 'level' ? 3200 : 2600);
}
function xpPop(n) {
  if (!n || view !== 'session') return;
  const p = el('span', 'xppop', `+${n} XP`);
  $('#funTrophy').append(p);
  setTimeout(() => p.remove(), 1300);
}
function celebrate(ev) {
  if (!ev) return;
  updateTrophy();
  xpPop(ev.gained);
  const TL = T(cfg.lang), lines = [];
  if (ev.levelUp) {
    showToast({ kind: 'level', emoji: '🚀', title: `Level ${ev.levelUp}!`, sub: levelTitle(ev.levelUp) });
    lines.push(TL.levelUp(ev.levelUp, levelTitle(ev.levelUp)));
  }
  ev.unlocked.forEach((b) => showToast({ kind: 'badge', emoji: b.emoji, title: 'Badge unlocked!', sub: b.name }));
  if (ev.unlocked.length) lines.push(TL.badgeGot(ev.unlocked[0].name));
  if (lines.length && mode === 'fun') { const line = lines.join(' '); if (busy) enqueueSpeech(line); else say(line); }
  if (view === 'progress' && progTab === 'fun') renderFunProgress();
}
function funSummaryLine() {
  const L = levelOf(funP.xp);
  return T(cfg.lang).funSummary(L, levelTitle(L), funP.xp, funStreak(funP), BADGES.filter((b) => funP.badges[b.id]).length, BADGES.length);
}
updateTrophy();

// ---------- quick replies: steer the explanation with one tap (or say it) ----------
const CHIPS = {
  study: [['🧒 Simpler', 'Explain that more simply, like I am ten years old.'], ['🔭 Go deeper', 'Go deeper on that, with a bit more detail.'], ['💡 Example', 'Give me a real-life example of that.'], ['❓ Quiz me', 'quiz me']],
  twin: [['👍 Sounds like me', (b) => likeTwin(b)], ['✏️ I\'d say it…', () => fixTwin()], ['🎲 Ask me anything', 'Tell me something about yourself that I might not know.']],
  fun: [['😂 Another!', 'Another one, please!'], ['🤯 Fun fact', 'Tell me a surprising fun fact about that.'], ['🧠 Trivia', 'quiz me'], ['🎲 Surprise me', 'Surprise me with something totally different and fun.']],
};
function showChips() {
  const box = $('#nextChips'); box.replaceChildren();
  if (!history.length) { box.hidden = true; return; }
  CHIPS[mode].forEach(([label, text], i) => {
    const b = el('button', 'nchip', label); b.type = 'button'; b.style.animationDelay = i * 60 + 'ms';
    b.addEventListener('click', () => { unlockAudio(); if (typeof text === 'function') { text(b); return; } if (busy) interrupt(); typedNow = true; handleInput(text); });
    box.append(b);
  });
  box.hidden = false;
}
function hideChips() { $('#nextChips').hidden = true; }
function chipPhrase(text) {
  const s = norm(text);
  if (/^(?:(?:make it|explain (?:it|that)?|say (?:it|that))\s*)?(?:simpler|easier|more simply)(?: please)?$|^i don'?t (?:get|understand) (?:it|that)$/.test(s)) return CHIPS.study[0][1];
  if (/^(?:go )?deeper(?: please)?$|^tell me more$|^more detail(?:s)?(?: please)?$/.test(s)) return mode === 'fun' ? CHIPS.fun[1][1] : CHIPS.study[1][1];
  if (/^(?:give me )?(?:an |a real life |a real-life )?example(?: please)?$/.test(s)) return CHIPS.study[2][1];
  if (/^(?:another|another one|one more)(?: please)?!?$/.test(s)) return CHIPS.fun[0][1];
  if (/^surprise me$/.test(s)) return CHIPS.fun[3][1];
  return text;
}

// ---------- question of the day ----------
let qotd = store.get('qotd', null), qotdLoading = null;
function loadQotd() {
  const day = funDayKey();
  if (qotd?.day === day) return Promise.resolve(qotd);
  return (qotdLoading ||= (async () => {
    let j = null;
    try { j = await askJSON(qotdPrompt({ level: prefs.level, seed: day })); } catch (err) { console.warn('Question of the day failed', err); }
    const ok = j && typeof j.q === 'string' && Array.isArray(j.options) && j.options.length === 4 && Number.isInteger(+j.answer) && +j.answer >= 0 && +j.answer < 4;
    const n = Math.floor(Date.now() / 864e5) % QOTD_FALLBACK.length;
    const base = ok ? { emoji: String(j.emoji || '🧩').slice(0, 8), q: String(j.q).slice(0, 180), options: j.options.map((o) => String(o).slice(0, 60)), answer: +j.answer, why: String(j.why || '').slice(0, 260) } : QOTD_FALLBACK[n];
    qotd = { day, ...base, picked: null };
    store.set('qotd', qotd);
    qotdLoading = null;
    return qotd;
  })());
}
function renderQotd() {
  const boxes = [$('#qotdHome'), $('#qotdFun')];
  if (!qotd || qotd.day !== funDayKey()) {
    boxes.forEach((b) => { b.replaceChildren(el('div', 'qhead', '🧩  QUESTION OF THE DAY'), el('p', 'qq loading', 'Thinking of something amazing…')); });
    loadQotd().then(() => renderQotd());
    return;
  }
  boxes.forEach((box) => {
    box.replaceChildren();
    const done = qotd.picked !== null && qotd.picked !== undefined;
    const head = el('div', 'qhead');
    head.append(el('span', 'qemoji', qotd.emoji), el('span', 'qlabel', 'QUESTION OF THE DAY'), el('span', 'qxp' + (done ? (qotd.picked === qotd.answer ? ' won' : ' tried') : ''), done ? (qotd.picked === qotd.answer ? `+${40} XP ✓` : '+10 XP') : '+40 XP'));
    box.append(head, el('p', 'qq', qotd.q));
    const grid = el('div', 'qopts');
    qotd.options.forEach((o, k) => {
      const b = el('button', 'qo', o); b.type = 'button';
      if (done) { b.disabled = true; if (k === qotd.answer) b.classList.add('right'); else if (k === qotd.picked) b.classList.add('wrong'); }
      b.addEventListener('click', () => answerQotd(k));
      grid.append(b);
    });
    box.append(grid);
    if (done) box.append(el('p', 'qwhy', (qotd.picked === qotd.answer ? '🎉 Correct! ' : '💡 ') + qotd.why), el('p', 'qnext', 'A new question arrives tomorrow.'));
  });
}
function answerQotd(k) {
  if (!qotd || qotd.picked !== null && qotd.picked !== undefined) return;
  qotd.picked = k; store.set('qotd', qotd);
  const right = k === qotd.answer;
  const ev = funDaily(funP, right); saveFun();
  chime(right);
  renderQotd();
  celebrate(ev);
}

// ---------- holo mode effects: materialize, floating particles, a halo that pulses with the voice ----------
function materialize() {
  const w = $('#liveWrap');
  w.classList.remove('materialize'); void w.offsetWidth; w.classList.add('materialize');
  setTimeout(() => w.classList.remove('materialize'), 2200);
  try { // a soft power-up sweep
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const ac = audioCtx; ac.resume?.();
    const o = ac.createOscillator(), g = ac.createGain(), t0 = ac.currentTime + 0.05;
    o.type = 'sine'; o.frequency.setValueAtTime(180, t0); o.frequency.exponentialRampToValueAtTime(880, t0 + 0.9);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.05, t0 + 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.1);
    o.connect(g).connect(ac.destination); o.start(t0); o.stop(t0 + 1.2);
  } catch {}
}
const fx = { parts: [], ripples: [], energy: 0, lastRipple: 0, w: 0, h: 0 };
function fxLoop(t) {
  requestAnimationFrame(fxLoop);
  if (view !== 'live') return;
  const c = $('#liveFx'), wrap = $('#liveWrap');
  const W = wrap.offsetWidth, H = wrap.offsetHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
  if (fx.w !== W || fx.h !== H) { fx.w = W; fx.h = H; c.width = W * dpr; c.height = H * dpr; fx.parts = []; }
  const x = c.getContext('2d');
  x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, W, H);
  const rgb = mode === 'fun' ? '255,190,110' : '79,227,255';
  if (!fx.parts.length) for (let i = 0; i < 46; i++) fx.parts.push({ x: Math.random() * W, y: Math.random() * H, r: 0.6 + Math.random() * 1.8, v: 6 + Math.random() * 16, ph: Math.random() * 6.28 });
  const dt = 1 / 60;
  fx.parts.forEach((p) => {
    p.y -= p.v * dt; p.x += Math.sin(t / 1400 + p.ph) * 0.15;
    if (p.y < -6) { p.y = H + 6; p.x = Math.random() * W; }
    const a = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t / 600 + p.ph));
    x.fillStyle = `rgba(${rgb},${a.toFixed(3)})`;
    x.beginPath(); x.arc(p.x, p.y, p.r, 0, 6.283); x.fill();
  });
  // the halo follows the voice (how open the mouth is), only when the tutor is showing
  const cv = $('#liveCanvas');
  const target = liveT.speaking ? 0.35 + liveT.open * 0.9 : 0;
  fx.energy += (target - fx.energy) * 0.18;
  if (cv.offsetParent === null || wrap.classList.contains('boardmode')) return;
  const cx = cv.offsetLeft + cv.offsetWidth / 2, cy = cv.offsetTop + cv.offsetHeight * 0.48;
  const R = Math.min(cv.offsetWidth, cv.offsetHeight) * 0.36;
  if (fx.energy > 0.02) {
    const g = x.createRadialGradient(cx, cy, R * 0.55, cx, cy, R * (1.05 + fx.energy * 0.25));
    g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(0.75, `rgba(${rgb},${(0.10 * fx.energy).toFixed(3)})`); g.addColorStop(1, `rgba(${rgb},0)`);
    x.fillStyle = g; x.fillRect(cx - R * 1.6, cy - R * 1.6, R * 3.2, R * 3.2);
  }
  if (liveT.speaking && t - fx.lastRipple > 700) { fx.ripples.push({ t0: t }); fx.lastRipple = t; }
  fx.ripples = fx.ripples.filter((r) => t - r.t0 < 1800);
  fx.ripples.forEach((r) => {
    const k = (t - r.t0) / 1800;
    x.strokeStyle = `rgba(${rgb},${(0.35 * (1 - k)).toFixed(3)})`; x.lineWidth = 1.5;
    x.beginPath(); x.ellipse(cx, cy + R * 0.95, R * (0.4 + k * 0.9), R * (0.08 + k * 0.18), 0, 0, 6.283); x.stroke();
  });
}
requestAnimationFrame(fxLoop);

// ---------- showcase mode: invites people over when nobody is talking ----------
let lastActivity = Date.now(), inviteN = 0, inviteHintN = 0;
const INVITE_STUDY = ['Hi there! I\'m a holographic tutor. Come closer and ask me anything!', 'Psst! Want to see something cool? Ask me why the sky is blue.', 'I can explain science, maths, space and more. Just ask me a question!', 'Hello! Ask me how rockets fly, or how volcanoes work.'];
const INVITE_FUN = ['Hey! I\'m Holo Buddy. Come say hi and ask me for a joke!', 'Want a riddle? Come closer and ask me!', 'I know movies, games and jokes. Ask me anything fun!'];
const SHOW_FACTS = ['Did you know? An octopus has three hearts.', 'Did you know? A day on Venus is longer than its year.', 'Did you know? Honey never goes bad. Archaeologists found edible honey in ancient Egyptian tombs.', 'Did you know? Lightning is about five times hotter than the surface of the Sun.', 'Did you know? Bananas are berries, but strawberries are not.', 'Did you know? Your brain uses about as much power as a dim light bulb.', 'Did you know? There are more stars in the universe than grains of sand on all of Earth\'s beaches.', 'Did you know? Sharks were around before trees existed.'];
const HINTS_STUDY = ['Why is the sky blue?', 'How do rockets fly?', 'What is a black hole?', 'Solve 2x + 5 = 17', 'How do plants make food?', 'Why do we dream?'];
const HINTS_FUN = ['Tell me a joke!', 'Give me a riddle', 'Best Minecraft tips?', 'Quiz me on movies', 'Surprise me!'];
function showcaseInvite() {
  const wakeTip = cfg.wake ? ' Just say, hey tutor.' : '';
  const lines = mode === 'fun' ? INVITE_FUN : INVITE_STUDY;
  const line = inviteN % 2 === 1 ? `${SHOW_FACTS[(inviteN >> 1) % SHOW_FACTS.length]} Come and ask me more!` : lines[(inviteN >> 1) % lines.length] + wakeTip;
  inviteN++;
  lastActivity = Date.now();
  say(line);
}
function showcaseTick() {
  const box = $('#liveInvite');
  const on = view === 'live' && cfg.showcase;
  const idle = Date.now() - lastActivity;
  const quiet = !busy && !videoOpen && Date.now() - lastSpeechEnd > 6000;
  if (on && quiet && idle > 15000 && holoView === 'board') setHoloView('face'); // back to the tutor for passers-by
  // a rotating "Ask me…" caption under the tutor while waiting
  const showHint = on && quiet && idle > 6000 && holoView !== 'board' && !holoMedia;
  if (showHint && (box.hidden || Date.now() - (box._at || 0) > 5000)) {
    const hints = mode === 'fun' ? HINTS_FUN : HINTS_STUDY;
    box.replaceChildren(el('span', 'ilabel', cfg.wake ? 'Say “Hey Tutor” and ask:' : 'Ask me:'), el('span', 'itext', `“${hints[inviteHintN++ % hints.length]}”`));
    box.hidden = false; box._at = Date.now();
    box.classList.remove('swap'); void box.offsetWidth; box.classList.add('swap');
  } else if (!showHint) box.hidden = true;
  if (on && quiet && idle > (inviteN ? 35000 : 20000)) showcaseInvite();
}
setInterval(showcaseTick, 1000);

// ---------- accounts: sign in / create account / guest ----------
let authTab = 'signin', authBusy = false, authAvatar = AVATARS[0], authPick = null; // authPick: a learner waiting for their PIN
function renderAccount() {
  const a = Account.active;
  $('#acctChipAv').textContent = a ? a.avatar : '👤';
  $('#acctChipName').textContent = a ? a.name.split(' ')[0] : 'Sign in';
  $('#acctAv').textContent = a ? a.avatar : '👤';
  $('#acctAv').title = a ? 'Tap to change your avatar' : '';
  $('#acctName').textContent = a ? a.name : 'Guest';
  $('#acctSub').textContent = a ? (a.type === 'server' ? `${a.email} · synced to your account` : 'Learner profile on this device') : (Account.mode === 'server' ? 'Sign in to save your progress to an account' : 'Make a learner profile to keep your progress');
  $('#acctAction').textContent = a ? (a.type === 'server' ? 'Sign out' : 'Switch learner') : 'Sign in';
  $('#acctEdit').hidden = !a;
}
function authCreating() {
  const local = Account.mode === 'local';
  return local ? (authTab === 'signup' || !Account.profiles().length) && !authPick : authTab === 'signup';
}
function renderAuth() {
  const local = Account.mode === 'local', profiles = local ? Account.profiles() : [];
  const creating = authCreating(), pinOnly = Boolean(local && authPick);
  $('#authSeg').hidden = local;
  $$('#authSeg button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.auth === authTab)));
  $('#profilePick').hidden = !local || creating || pinOnly;
  $('#authForm').hidden = local && !creating && !pinOnly;
  $('#avatarRow').hidden = !creating;
  $('#fName').hidden = !creating;
  $('#fEmail').hidden = local;
  $('#fPass').hidden = local;
  $('#fPin').hidden = !local;
  $('#pinLabel').textContent = pinOnly ? `PIN for ${authPick.name}` : '4-digit PIN (optional)';
  $('#aPass').autocomplete = creating ? 'new-password' : 'current-password';
  $('#authTitle').textContent = creating ? (local ? 'New learner' : 'Create your account') : pinOnly ? `Hi, ${authPick.name.split(' ')[0]}!` : local ? "Who's learning?" : 'Welcome back';
  $('#authSub').textContent = creating
    ? (local ? 'Pick an avatar and a name. A PIN keeps your progress private on a shared phone.' : 'Your progress, badges and lessons are saved to your account, on any device.')
    : pinOnly ? 'Enter your 4-digit PIN.' : local ? 'Tap your name to carry on where you left off.' : 'Sign in to pick up where you left off.';
  $('#authGoText').textContent = creating ? (local ? 'Start learning' : 'Create account') : pinOnly ? 'Open' : 'Sign in';
  $('#authNote').textContent = local ? 'Learner profiles are saved on this device only.' : creating ? 'We never share your email. Your password is stored safely hashed.' : '';
  $('#authGuest').textContent = pinOnly || (local && creating && profiles.length) ? '← Back' : 'Continue as guest';
  const row = $('#avatarRow'); row.replaceChildren();
  AVATARS.forEach((e) => { const b = el('button', 'avopt', e); b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(e === authAvatar)); b.addEventListener('click', () => { authAvatar = e; renderAuth(); }); row.append(b); });
  if (local) {
    const grid = $('#profileGrid'); grid.replaceChildren();
    profiles.forEach((p) => {
      const t = el('button', 'ptile'); t.type = 'button';
      t.append(el('span', 'pav', p.avatar), el('span', 'pname', p.name));
      if (p.pin) t.append(el('span', 'plock', '🔒'));
      t.addEventListener('click', () => {
        if (!p.pin) { openLearner(p.id); return; }
        authPick = p; authErr(''); $('#aPin').value = ''; renderAuth(); setTimeout(() => $('#aPin').focus(), 0);
      });
      grid.append(t);
    });
    const add = el('button', 'ptile add'); add.type = 'button'; add.append(el('span', 'pav', '＋'), el('span', 'pname', 'Add learner'));
    add.addEventListener('click', () => { authTab = 'signup'; authErr(''); renderAuth(); });
    grid.append(add);
  }
}
function authErr(msg) { const e = $('#authErr'); e.textContent = msg; e.hidden = !msg; }
// Reload so every screen reads the new learner's own data.
const authDone = () => location.replace(location.pathname + location.search);
async function openLearner(id, pin) {
  try { await Account.openProfile(id, pin); authDone(); } catch (err) { authErr(err.message); }
}
$$('#authSeg button').forEach((b) => b.addEventListener('click', () => { authTab = b.dataset.auth; authErr(''); renderAuth(); }));
$('#pwToggle').addEventListener('click', () => { const i = $('#aPass'), showIt = i.type === 'password'; i.type = showIt ? 'text' : 'password'; $('#pwToggle').textContent = showIt ? 'Hide' : 'Show'; });
$('#authForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (authBusy) return;
  const local = Account.mode === 'local', creating = authCreating();
  const name = $('#aName').value.trim(), email = $('#aEmail').value.trim(), password = $('#aPass').value, pin = $('#aPin').value.trim();
  if (!local && !email) return authErr('Please enter your email.');
  if (!local && !password) return authErr('Please enter your password.');
  if (creating && !name) return authErr('Please enter your name.');
  if (!local && creating && password.length < 8) return authErr('Use a password of at least 8 characters.');
  if (local && pin && !/^\d{4}$/.test(pin)) return authErr('The PIN should be 4 digits.');
  authBusy = true; authErr(''); $('#authGo').disabled = true; $('#authGoText').textContent = 'One moment…';
  try {
    if (local && authPick) await Account.openProfile(authPick.id, pin);
    else if (local) await Account.createProfile({ name, avatar: authAvatar, pin });
    else if (creating) await Account.signUp({ name, email, password, avatar: authAvatar });
    else await Account.signIn({ email, password });
    authDone();
  } catch (err) { authErr(err.message); renderAuth(); }
  finally { authBusy = false; $('#authGo').disabled = false; }
});
$('#authGuest').addEventListener('click', () => {
  if (authPick || (Account.mode === 'local' && authTab === 'signup' && Account.profiles().length)) { authPick = null; authTab = 'signin'; authErr(''); renderAuth(); return; }
  Account.continueAsGuest(); show('mode');
});
const goSignIn = () => { authTab = 'signin'; authPick = null; authErr(''); show('auth'); };
$('#acctChip').addEventListener('click', () => (Account.active ? show('settings') : goSignIn()));
$('#acctAction').addEventListener('click', async () => {
  if (!Account.active) return goSignIn();
  $('#acctAction').disabled = true;
  await Account.signOut(); // a server account signs out; a device learner goes back to "Who's learning?"
  authDone();
});
$('#acctAv').addEventListener('click', async () => {
  const a = Account.active; if (!a) return;
  const avatar = AVATARS[(AVATARS.indexOf(a.avatar) + 1) % AVATARS.length];
  try { await Account.updateProfile({ avatar }); renderAccount(); } catch (err) { admLog('err', err.message); }
});
$('#acctEdit').addEventListener('click', async () => {
  const a = Account.active; if (!a) return;
  const name = window.prompt('Your name', a.name);
  if (name === null || !name.trim()) return;
  try { await Account.updateProfile({ name: name.trim() }); renderAccount(); renderHome(); $('#modeGreet').textContent = greetText() + `, ${Account.firstName}`; } catch (err) { admLog('err', err.message); }
});
window.addEventListener('pagehide', () => { Account.flush(); });

// ---------- Train AI mode: teach your hologram twin to talk like you ----------
let twin = loadTwin(store.get('twin', null), Account.active?.name || '');
let curQ = null, ivSkipped = [], lastAsked = '', twinFix = null, twinBuilding = false, sinceBuild = 0;
const saveTwin = () => store.set('twin', twin);
const twinFirst = () => (twin.name || Account.active?.name || 'my').split(' ')[0];
const ACKS = ['Got it!', 'Love that.', 'Nice, noted.', 'That sounds like you.', 'Thanks, I\'m learning.', 'Okay, saved.'];
function renderTrain() {
  const ok = twin.consent;
  $('#twinConsent').hidden = ok; $('#twinMain').hidden = !ok;
  if (!ok) { $('#twinNameIn').value = twin.name || Account.active?.name || ''; return; }
  const pct = twinStrength(twin);
  const C = 2 * Math.PI * 52, arc = $('#twArc');
  arc.style.strokeDasharray = C; arc.style.strokeDashoffset = C * (1 - pct / 100);
  const face = $('#twFace'); face.replaceChildren();
  if (facePhoto) { const i = el('img'); i.src = facePhoto; i.alt = ''; face.append(i); } else face.textContent = Account.active?.avatar || '🧑‍🚀';
  $('#twName').textContent = twin.name; $('#twStage').textContent = twinStage(pct); $('#twPct').textContent = `${pct}% trained`;
  const per = catCounts(twin), cats = $('#twCats'); cats.replaceChildren();
  Object.entries(TWIN_CATS).forEach(([id, c]) => {
    const n = Math.min(3, per[id] || 0);
    const p = el('span', 'twcat' + (n >= 3 ? ' full' : n ? ' some' : ''));
    p.append(el('span', '', `${c.emoji} ${c.name}`), el('b', '', `${n}/3`));
    cats.append(p);
  });
  $('#ivCat').textContent = curQ ? `${TWIN_CATS[curQ.cat].emoji} ${TWIN_CATS[curQ.cat].name}` : '';
  $('#ivQ').textContent = curQ ? curQ.q : 'You answered every question! Add facts or writing below, or talk to your twin.';
  $('#ivMic').textContent = noVoice ? '⌨️ Type your answers' : paused ? '🎙️ Mic paused' : '🎙️ Listening';
  const nl = $('#noteList'); nl.replaceChildren();
  twin.notes.slice().reverse().forEach((n) => {
    const r = el('div', 'noterow'); r.append(el('span', '', n.text));
    const x = el('button', 'notex', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Remove');
    x.addEventListener('click', () => { twin.notes = twin.notes.filter((m) => m !== n); saveTwin(); renderTrain(); });
    r.append(x); nl.append(r);
  });
  $('#sampleCount').textContent = twin.samples.length ? `${twin.samples.length} sample${twin.samples.length > 1 ? 's' : ''} added` : '';
  const pf = $('#twProfile'); pf.replaceChildren();
  const P = twin.profile;
  if (twinBuilding) pf.append(el('p', 'qq loading', 'Learning who you are…'));
  else if (!P) pf.append(el('p', 'small muted', 'Answer a few questions, then tap “Update my twin” to see what it learned about you.'));
  else {
    if (P.summary) pf.append(el('p', 'twsum', P.summary));
    if (P.style) pf.append(el('p', 'twrow', `🗣️ ${P.style}`));
    if (P.phrases.length) { const w = el('div', 'funchips'); P.phrases.forEach((x) => w.append(el('span', 'twchip', `“${x}”`))); pf.append(w); }
    if (P.facts.length) { const ul = el('ul', 'twfacts'); P.facts.slice(0, 8).forEach((f) => ul.append(el('li', '', f))); pf.append(ul); }
    if (P.interests.length) pf.append(el('p', 'twrow', `🎯 ${P.interests.join(' · ')}`));
    if (P.humor) pf.append(el('p', 'twrow', `😄 ${P.humor}`));
  }
  $('#twBuild').disabled = twinBuilding || !twinMaterial({ ...twin, profile: null }).trim();
  const ready = pct >= 10;
  $('#twTalk').disabled = !ready;
  $('#twTalk').textContent = ready ? `💬 Talk to my twin` : '💬 Talk to my twin (answer a few questions first)';
}
function askTwinQ(prefix = '') {
  curQ = nextTwinQuestion(twin, ivSkipped);
  renderTrain();
  if (view !== 'train') return;
  if (curQ) say(`${prefix}${prefix ? ' ' : ''}${curQ.q}`);
  else say(`${prefix} That was the last question. You can talk to your twin now.`.trim());
}
function trainInput(text) {
  const s = norm(text);
  if (!twin.consent) return;
  if (/^(?:skip|next|pass|another(?: one| question)?|next question|i don'?t know)(?: please)?$/.test(s)) { if (curQ) ivSkipped.push(curQ.q); askTwinQ('Okay, another one.'); return; }
  if (/^(?:stop|pause|that'?s enough|i'?m done|done|finish)(?: please| for now)?$/.test(s)) { say('Great work! Tap talk to my twin whenever you like.'); maybeBuildTwin(true); return; }
  if (/(?:talk|chat|speak) (?:to|with) my (?:ai )?twin/.test(s)) { startTwinChat(); return; }
  if (!curQ) { twin.notes.push({ text: text.slice(0, 300), t: Date.now() }); saveTwin(); renderTrain(); say('Saved that as a fact about you.'); return; }
  twin.answers.push({ cat: curQ.cat, q: curQ.q, a: text.slice(0, 1500), t: Date.now() });
  saveTwin(); sinceBuild++;
  maybeBuildTwin();
  const short = text.trim().split(/\s+/).length < 4;
  askTwinQ(short ? `${ACKS[twin.answers.length % ACKS.length]} Longer answers help me sound more like you.` : ACKS[twin.answers.length % ACKS.length]);
}
async function buildTwin() {
  const material = twinMaterial({ ...twin, profile: null });
  if (!material.trim() || twinBuilding) return;
  twinBuilding = true; sinceBuild = 0; if (view === 'train') renderTrain();
  try {
    const p = cleanProfile(await askJSON(twinDistillPrompt({ name: twin.name, material })));
    if (p) { twin.profile = p; twin.built = Date.now(); saveTwin(); }
  } catch (err) { admLog('err', 'twin update failed: ' + (err.message || err)); }
  finally { twinBuilding = false; if (view === 'train') renderTrain(); }
}
function maybeBuildTwin(force = false) { if (force ? sinceBuild > 0 : sinceBuild >= 4) buildTwin(); }
function startTwinChat() {
  if (twinStrength(twin) < 10) { say('Teach me a little more first. Answer a few interview questions.'); show('train'); return; }
  if (sinceBuild > 0 || !twin.profile) buildTwin();
  setMode('twin');
  show('session');
}
function likeTwin(btn) {
  if (!lastAnswer) return;
  twin.liked.push({ q: lastAsked.slice(0, 300), a: lastAnswer.slice(0, 600), t: Date.now() }); twin.liked = twin.liked.slice(-30);
  saveTwin();
  btn.textContent = '👍 Saved, thanks!'; btn.disabled = true;
}
function fixTwin() {
  if (!lastAnswer) return;
  twinFix = { q: lastAsked.slice(0, 300), said: lastAnswer.slice(0, 600) };
  hideChips();
  $('#typeRow').hidden = false; $('#typeInput').placeholder = 'How would you say it?'; $('#typeInput').focus();
  say(noVoice ? 'Type how you would say it.' : 'How would you say it? Tell me in your own words.');
}
function saveCorrection(text) {
  const f = twinFix; twinFix = null;
  twin.corrections.push({ ...f, better: text.slice(0, 800), t: Date.now() }); twin.corrections = twin.corrections.slice(-40);
  saveTwin(); sinceBuild++;
  addMsg('you', '✏️ ' + text);
  $('#typeInput').placeholder = 'Type a question…'; if (!noVoice) $('#typeRow').hidden = true;
  say('Got it! Next time I\'ll say it more like that.');
}
$('#trainBack').addEventListener('click', () => show('mode'));
$('#twinStart').addEventListener('click', () => {
  const name = $('#twinNameIn').value.trim().replace(/\s+/g, ' ').slice(0, 40);
  const err = (m) => { $('#twinConsentErr').textContent = m; $('#twinConsentErr').hidden = !m; };
  if (!name) return err('Whose twin is this? Enter a name.');
  if (!$('#twinOk').checked) return err('Please tick the box to confirm.');
  err(''); unlockAudio();
  twin.name = name; twin.consent = true; saveTwin();
  renderTrain(); askTwinQ(`Hi ${name.split(' ')[0]}! I'll ask you some questions. Answer the way you normally talk.`);
});
$('#ivForm').addEventListener('submit', (e) => { e.preventDefault(); const t = $('#ivInput').value.trim(); if (!t) return; $('#ivInput').value = ''; if (busy) interrupt(); trainInput(t); });
$('#ivSkip').addEventListener('click', () => { if (busy) interrupt(); if (curQ) ivSkipped.push(curQ.q); askTwinQ(); });
$('#ivMic').addEventListener('click', () => { if (noVoice) { $('#ivInput').focus(); return; } paused = !paused; if (paused) mute(); else resumeIdle(); renderTrain(); });
$('#noteForm').addEventListener('submit', (e) => { e.preventDefault(); const t = $('#noteInput').value.trim(); if (!t) return; twin.notes.push({ text: t.slice(0, 300), t: Date.now() }); $('#noteInput').value = ''; saveTwin(); sinceBuild++; renderTrain(); });
$('#sampleAdd').addEventListener('click', () => { const t = $('#sampleInput').value.trim(); if (t.length < 20) { $('#sampleCount').textContent = 'Paste at least a couple of sentences.'; return; } twin.samples.push({ text: t.slice(0, 3000), t: Date.now() }); twin.samples = twin.samples.slice(-6); $('#sampleInput').value = ''; saveTwin(); sinceBuild++; renderTrain(); });
$('#twBuild').addEventListener('click', () => buildTwin());
$('#twTalk').addEventListener('click', () => { unlockAudio(); startTwinChat(); });
$('#twReset').addEventListener('click', () => {
  if (!window.confirm(`Delete ${twin.name}'s twin and everything it learned? This can't be undone.`)) return;
  twin = loadTwin(null, Account.active?.name || ''); store.del('twin'); curQ = null; ivSkipped = [];
  if (mode === 'twin') setMode('study');
  renderTrain();
});
// Entering the train screen: pick up the interview where it left off.
function enterTrain() { if (twin.consent && !busy) askTwinQ(curQ ? '' : `Welcome back! Let's keep training.`); }

// ---------- settings ----------
function unlockAudio() {
  try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume?.(); } catch {}
  primeSpeech(true);
  try { player.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='; player.play().catch(() => {}); } catch {}
}
function renderSettings() {
  renderAccount();
  renderVoicePick();
  renderVoiceStatus();
  $$('#setVoiceSeg button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.voice === prefs.voiceStyle)));
  $('#rateRange').value = prefs.rate; $('#rateVal').textContent = Number(prefs.rate).toFixed(2).replace(/0$/, '') + '×';
  $('#swBarge').setAttribute('aria-checked', String(prefs.bargeIn));
  $('#swWake').setAttribute('aria-checked', String(prefs.wake));
  $('#swAdmin').setAttribute('aria-checked', String(prefs.admin));
}
$$('#setVoiceSeg button').forEach((b) => b.addEventListener('click', () => { setVoiceStyle(b.dataset.voice); speakOnce('This is how I sound.'); }));
$('#rateRange').addEventListener('input', (e) => { savePref('rate', Number(e.target.value)); renderSettings(); });
$('#rateRange').addEventListener('change', () => speakOnce('This is my speaking speed.'));
$('#swBarge').addEventListener('click', () => { savePref('bargeIn', !prefs.bargeIn); renderSettings(); });
$('#swWake').addEventListener('click', () => { savePref('wake', !prefs.wake); renderSettings(); });
let clearTimer = 0;
$('#clearData').addEventListener('click', (e) => {
  const b = e.currentTarget;
  if (!b.classList.contains('confirm')) {
    b.classList.add('confirm'); b.textContent = 'Tap again to clear everything';
    clearTimer = setTimeout(() => { b.classList.remove('confirm'); b.textContent = 'Clear history & progress'; }, 4000);
    return;
  }
  clearTimeout(clearTimer);
  store.del('lessons'); store.del('progress');
  Object.assign(prog, { days: [], lessons: 0, questions: 0, quiz: { asked: 0, correct: 0 }, subjects: {}, weak: {} });
  b.classList.remove('confirm'); b.textContent = 'Cleared';
  setTimeout(() => { b.textContent = 'Clear history & progress'; }, 2000);
});

// ---------- photos of work ----------
let camStream = null, facing = 'environment';
async function openCamera() {
  if (camStream) return;
  camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
  const v = $('#cam'); v.srcObject = camStream; await v.play();
  for (let i = 0; i < 20 && !v.videoWidth; i++) await sleep(100);
}
function closeCamera() { camStream?.getTracks().forEach((t) => t.stop()); camStream = null; $('#cam').srcObject = null; }
function toImage(source, sw, sh, max = 1024) {
  const k = Math.min(1, max / Math.max(sw, sh));
  const c = document.createElement('canvas');
  c.width = Math.round(sw * k); c.height = Math.round(sh * k);
  c.getContext('2d').drawImage(source, 0, 0, c.width, c.height);
  const dataURL = c.toDataURL('image/jpeg', 0.82);
  return new Promise((res) => c.toBlob((blob) => res({ dataURL, blob }), 'image/jpeg', 0.82));
}
async function capturePhoto(prompt) {
  if (!CAN_CAMERA || !navigator.mediaDevices?.getUserMedia) {
    say('The camera isn\'t available here. Tap the camera button next to the mic and pick a photo of your work.', { bubble: true });
    return;
  }
  const myId = ++reqId;
  busy = true; streamDone = false;
  micWhileBusy();
  setStatus('thinking');
  if (view === 'live') show('session');
  try { await openCamera(); }
  catch { say('I couldn\'t open the camera. Allow camera access, or tap the camera button to pick a photo.', { bubble: true, err: true }); return; }
  if (myId !== reqId) return;
  $('#cam').hidden = false;
  speakOnce('Hold it steady in front of the camera.');
  for (const n of [3, 2, 1]) {
    $('#countdown').textContent = n; $('#countdown').classList.add('show');
    await sleep(850);
    if (myId !== reqId) return;
  }
  $('#countdown').classList.remove('show');
  const v = $('#cam');
  const img = await toImage(v, v.videoWidth || 1280, v.videoHeight || 960);
  closeCamera(); v.hidden = true;
  if (chatEl.lastElementChild?.classList.contains('you')) chatEl.lastElementChild.prepend(Object.assign(el('img'), { src: img.dataURL, alt: 'Photo you shared' }));
  ask(prompt, img);
}
$('#workFile').addEventListener('change', async (e) => {
  const file = e.target.files[0]; e.target.value = '';
  if (!file) return;
  if (busy) interrupt();
  try {
    const bmp = await createImageBitmap(file);
    const img = await toImage(bmp, bmp.width, bmp.height);
    const text = $('#typeInput').value.trim() || 'Please look at this and help me understand it.';
    $('#typeInput').value = '';
    addMsg('you', text, img.dataURL);
    ask(text, img);
  } catch { say('I couldn\'t open that image. Try a JPEG or PNG.', { bubble: true, err: true }); }
});

// ---------- session controls ----------
$('#typeRow').addEventListener('submit', (e) => {
  e.preventDefault();
  clearTimeout(dictTimer);
  const t = $('#typeInput').value.trim();
  if (!t) return;
  $('#typeInput').value = '';
  if (busy) interrupt();
  handleInput(t);
});
// ---------- voice typing: for places where the page can't use the mic itself (like the claude.ai preview) ----------
// You speak with the keyboard's or computer's own dictation; when you pause, it sends, and the tutor answers out loud.
let dictate = false, dictTimer = 0, micBlocked = false;
const UA = navigator.userAgent || '';
function dictTip() {
  if (/Android|iPhone|iPad|iPod/i.test(UA)) return 'Tap 🎤 on your keyboard and speak';
  if (/Mac/i.test(UA)) return 'Start dictation, speak, then stop it (Esc) so you can hear me';
  if (/Win/i.test(UA)) return 'Press Windows + H to dictate';
  return 'Use your keyboard\'s dictation to speak';
}
function startDictation() {
  dictate = true;
  if (voiceAlertKind === 'mic') hideVoiceAlert();
  const row = $('#typeRow'), inp = $('#typeInput');
  row.hidden = false; row.classList.add('dictating');
  inp.placeholder = dictTip() + '…';
  inp.focus();
  if (!busy) setStatus('typing');
}
function stopDictation() {
  dictate = false; clearTimeout(dictTimer);
  $('#typeRow').classList.remove('dictating'); $('#typeInput').placeholder = 'Type a question…';
  if (!busy) setStatus('typing');
}
// Sends what was dictated, then takes the cursor out of the box: that ends the computer's or
// phone's dictation, which otherwise keeps listening and mutes other sound (so the answer
// would play silently, or be typed back into the box).
function sendDictation() {
  const inp = $('#typeInput');
  if (!dictate || !inp.value.trim()) return;
  inp.blur();
  $('#typeRow').requestSubmit();
}
function toggleDictation() { if (dictate && !busy) stopDictation(); else { if (busy) interrupt(); startDictation(); } }
$('#typeInput').addEventListener('input', () => {
  if (!dictate) return;
  if (busy) interrupt(); // you started talking: the tutor stops, like talking over it
  clearTimeout(dictTimer);
  if ($('#typeInput').value.trim()) dictTimer = setTimeout(sendDictation, 1800);
});
$('#kbBtn').addEventListener('click', () => {
  const row = $('#typeRow');
  row.hidden = !row.hidden;
  if (!row.hidden) $('#typeInput').focus();
});
$('#micBtn').addEventListener('click', () => {
  if (busy) { interrupt(); return; }
  if (!rec || noVoice) { if (SR && !MIC_NOTE && !micBlocked) { retryMic(); return; } toggleDictation(); return; }
  paused = !paused;
  if (paused) mute();
  resumeIdle();
});

// ---------- making sure the tutor is heard ----------
// Browsers only let a page speak after the person has tapped it, and some (Safari) only count a
// real utterance as "unlocking" speech. Every tap re-arms the voice, and if speaking failed
// earlier, the next tap lets it try again.
let speechPrimedAt = 0;
function primeSpeech(force = false) {
  if (!('speechSynthesis' in window)) return;
  try {
    if (speechSynthesis.paused) speechSynthesis.resume();
    if (deviceBroken) { deviceBroken = false; voiceNoticeShown = false; renderVoiceStatus(); } // give the voice another chance after a tap
    if (!force && Date.now() - speechPrimedAt < 60000) return;
    if (speakingNow) return; // already talking: don't queue anything in front
    speechPrimedAt = Date.now();
    const u = new SpeechSynthesisUtterance('.'); u.volume = 0; u.rate = 2;
    primeSpeech.u = u; speechSynthesis.speak(u);
  } catch {}
}
document.addEventListener('pointerdown', () => primeSpeech(), true);
document.addEventListener('keydown', () => primeSpeech(), true);
// The voice was blocked: one tap plays the answer (a tap always lets the page speak).
function soundBlocked(text) {
  admLog('err', 'the browser blocked speech; offering tap to hear');
  if (voiceAlertKind === 'sound') return;
  showVoiceAlert('sound', 'Your browser blocked the voice. Tap “Hear it” to listen (and check your volume). After that tap, answers should play by themselves.', '🔊 Hear it', () => { primeSpeech(true); if (busy) interrupt(); say(lastAnswer || text); });
}
// A speaker button on each answer: tap to hear that answer again.
function addHearButton(m, text) {
  if (!text) return;
  const b = el('button', 'hearbtn', '🔊'); b.type = 'button'; b.title = 'Hear this answer'; b.setAttribute('aria-label', 'Hear this answer');
  b.addEventListener('click', (e) => { e.stopPropagation(); primeSpeech(true); if (busy) interrupt(); say(text); });
  m.el.append(b);
}

// ---------- voice console: stop, replay, mute, waveform, live transcript, clear problems ----------
function openTyping() { $('#typeRow').hidden = false; $('#typeInput').focus(); }
$('#stopBtn').addEventListener('click', () => { if (busy) interrupt(); });
$('#replayBtn').addEventListener('click', () => {
  if (!lastAnswer) return;
  unlockAudio();
  if (busy) interrupt();
  say(lastAnswer);
});
$('#muteBtn').addEventListener('click', () => {
  savePref('muted', !prefs.muted);
  if (prefs.muted && speakingNow) stopSpeech(); // the current sentence ends now; the rest are mouthed silently
  setStatus(document.body.dataset.state || 'idle');
});
// Live transcript: what you're saying appears in the chat as you speak.
let interimEl = null;
function showInterim(text) {
  if (!interimEl || !interimEl.isConnected) { interimEl = addMsg('you', ''); interimEl.el.classList.add('interim'); }
  interimEl.set(text);
}
function hideInterim() { interimEl?.el.remove(); interimEl = null; }
// Problems, explained in plain words with one thing to do about it.
let voiceAlertKind = '';
function showVoiceAlert(kind, text, btn, action) {
  voiceAlertKind = kind;
  $('#voiceAlertText').textContent = text;
  const b = $('#voiceAlertBtn'); b.hidden = !btn; b.textContent = btn || ''; b.onclick = () => { hideVoiceAlert(); action?.(); };
  $('#voiceAlert').hidden = false;
}
function hideVoiceAlert() { $('#voiceAlert').hidden = true; voiceAlertKind = ''; }
$('#voiceAlertX').addEventListener('click', hideVoiceAlert);
function micProblem(code) {
  if (code === 'not-allowed' || code === 'service-not-allowed') micBlocked = true;
  if (MIC_NOTE) { showVoiceAlert('mic', 'The mic is blocked in this preview. Use voice typing: tap the mic, then speak with your keyboard\'s 🎤. I\'ll send when you pause.', 'Voice typing', () => startDictation()); return; }
  const msg = {
    'not-allowed': 'Microphone access is blocked. Allow the microphone for this page (tap the lock or mic icon by the address bar), then tap Try again.',
    'service-not-allowed': 'This browser won\'t let the page use speech recognition. Try Chrome or Edge, or type below.',
    'audio-capture': 'No microphone was found. Plug one in, or close other apps using it, then tap Try again.',
    'language-not-supported': 'Voice input doesn\'t support this language in this browser. Type below instead.',
  }[code] || 'The microphone stopped working. Tap Try again, or type below.';
  const canRetry = code === 'not-allowed' || code === 'audio-capture';
  showVoiceAlert('mic', msg, canRetry ? 'Try again' : 'Type instead', canRetry ? retryMic : openTyping);
}
function retryMic() {
  if (!SR) { openTyping(); return; }
  noVoice = false; paused = false; netErrors = 0; hideVoiceAlert();
  initRecognition();
  try { navigator.mediaDevices?.getUserMedia?.({ audio: true }).then((st) => { st.getTracks().forEach((t) => t.stop()); resumeIdle(); }).catch(() => micProblem('not-allowed')); } catch { resumeIdle(); }
  if (!navigator.mediaDevices?.getUserMedia) resumeIdle();
}
// Up-front checks: no speech recognition, a blocked mic, or no voice to speak with.
let voiceChecked = false;
function checkVoiceSupport() {
  if (voiceChecked) return; voiceChecked = true;
  if (!SR) showVoiceAlert('mic', 'This browser can\'t listen directly. Use voice typing: tap the mic, then your keyboard\'s 🎤 (or your computer\'s dictation). I\'ll send it when you pause.', 'Voice typing', () => startDictation());
  else navigator.permissions?.query?.({ name: 'microphone' }).then((p) => { if (p.state === 'denied') { noVoice = true; micProblem('not-allowed'); if (!busy) setStatus('typing'); } }).catch(() => {});
  if (!('speechSynthesis' in window) && !cloudOK) setTimeout(() => { if (!cloudOK && !voiceAlertKind) showVoiceAlert('voice', 'This browser can\'t speak out loud, so answers will appear as text.', '', null); }, 1500);
}
// The waveform: follows the tutor's voice while it speaks, your voice while it listens.
const wave = { phase: 0, amp: 0 };
function drawWave(t) {
  requestAnimationFrame(drawWave);
  const c = $('#voiceWave');
  if (!c || c.offsetParent === null) return;
  const w = c.clientWidth, h = c.clientHeight, dpr = Math.min(2, devicePixelRatio || 1);
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
  const x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, h);
  const st = document.body.dataset.state;
  if (hearing && Date.now() - hearingAt > 1500 && !recRunning) hearing = false;
  let target = 0.04, speed = 0.05, col = '120,140,150';
  if (st === 'speaking') { const lv = Tutor.level?.(); target = 0.18 + 0.85 * (lv ?? sessT.open); speed = 0.16; col = mode === 'fun' ? '255,181,71' : mode === 'twin' ? '183,156,255' : '79,227,255'; }
  else if (st === 'listening') { target = hearing ? 0.45 + 0.35 * Math.abs(Math.sin(t / 130)) : 0.1; speed = hearing ? 0.2 : 0.06; col = '91,227,161'; }
  else if (st === 'thinking') { target = 0.22; speed = 0.1; col = '255,181,71'; }
  wave.amp += (target - wave.amp) * 0.15; wave.phase += speed;
  const mid = h / 2;
  [[1, 0.9, 2], [0.6, 1.7, 1.4], [0.35, 2.6, 1]].forEach(([k, f, lw], i) => {
    x.beginPath();
    for (let px = 0; px <= w; px += 2) {
      const u = px / w, env = Math.sin(Math.PI * u); // fades at both ends
      const y = mid + Math.sin(u * Math.PI * 2 * f * 2 + wave.phase * (1 + i * 0.4)) * env * wave.amp * k * (h * 0.45);
      px ? x.lineTo(px, y) : x.moveTo(px, y);
    }
    x.strokeStyle = `rgba(${col},${(0.9 - i * 0.25).toFixed(2)})`; x.lineWidth = lw;
    x.shadowColor = `rgba(${col},0.8)`; x.shadowBlur = i ? 0 : 8;
    x.stroke();
  });
  x.shadowBlur = 0;
}
requestAnimationFrame(drawWave);
// Voice picker (Settings): any voice this device offers, or Auto.
function renderVoicePick() {
  const sel = $('#voicePick'), note = $('#voicePickNote');
  if (!('speechSynthesis' in window)) { sel.replaceChildren(new Option('Not available in this browser', '')); sel.disabled = true; note.textContent = 'This browser has no built-in voices. Answers still appear as text' + (cloudOK ? ', and the cloud voice can speak them.' : '.'); return; }
  const all = deviceVoices();
  const en = all.filter((v) => /^en/i.test(v.lang));
  const list = (en.length ? en : all).slice().sort((a, b) => a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name));
  sel.disabled = false;
  sel.replaceChildren(new Option(`Auto (best English voice${voice && !prefs.voiceName ? ': ' + voice.name : ''})`, ''));
  list.forEach((v) => sel.append(new Option(`${v.name} · ${v.lang}${v.localService === false ? ' · online' : ''}`, v.voiceURI || v.name)));
  sel.value = list.some((v) => (v.voiceURI || v.name) === prefs.voiceName) ? prefs.voiceName : '';
  note.textContent = all.length ? `${list.length} voice${list.length === 1 ? '' : 's'} on this device. Voices marked “online” need internet.` : 'No voices have loaded yet. If this stays empty, this device has no text-to-speech voices installed.';
}
$('#voicePick').addEventListener('change', (e) => { savePref('voiceName', e.target.value); pickVoice(); renderVoiceStatus(); unlockAudio(); if (busy) interrupt(); speakOnce('Hi! This is how I sound now.'); });

// ---------- starting and stopping the voice ----------
function startVoice() {
  initRecognition();
  checkVoiceSupport();
  if (noVoice) $('#typeRow').hidden = false;
  if (!startVoice.unlocked) { // browsers only allow sound after a tap: unlock both voices now
    startVoice.unlocked = true;
    primeSpeech(true);
    try { player.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='; player.play().catch(() => {}); } catch {}
    try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume?.(); } catch {}
  }
  keepAwake();
  if (busy) return;
  if (pendingStart && view === 'session') {
    const p = pendingStart; pendingStart = null; greeted = true;
    addMsg('you', p.display);
    ask(p.text);
    return;
  }
  if (!greeted && (view === 'session' || view === 'live')) {
    greeted = true;
    const TL = T(cfg.lang);
    const hello = mode === 'fun' ? TL.helloFun : mode === 'twin' ? (twin.profile?.greeting || `Hey! I'm ${twinFirst()}'s AI twin.`) : TL.helloStudy(prefs.kind);
    const subj = mode === 'fun' ? TL.askFun : mode === 'twin' ? ' Ask me anything about me.' : TL.askStudy(prefs.subject !== 'any' ? subjectName(prefs.subject) : '');
    const how = noVoice ? ' Type a question, or share a photo of your homework.' : cfg.wake ? ' Say "Hey Tutor" followed by your question.' : '';
    say(hello + subj + how);
    return;
  }
  resumeIdle();
}
function stopVoice() {
  interrupt();
  mute();
  setStatus('idle');
  keepAwake();
}

// ---------- admin console (testing) ----------
let typedNow = false;
const ADM_MAX = 80;
function admLog(cls, text) {
  const box = $('#admLog'); if (!box) return;
  const line = el('div', cls);
  line.append(el('span', 't', new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })), document.createTextNode(text));
  box.append(line);
  while (box.children.length > ADM_MAX) box.firstChild.remove();
  box.scrollTop = box.scrollHeight;
}
function admState(state) {
  const n = $('#admState'); if (!n) return;
  n.textContent = `${view} · ${mode} · ${state || document.body.dataset.state}${noVoice ? ' · mic off' : paused ? ' · paused' : ''}`;
  $('#admMic').textContent = 'Mic: ' + (noVoice ? 'unavailable' : paused ? 'paused' : 'on');
}
const adminOn = () => (qs.has('admin') ? qs.get('admin') !== '0' : prefs.admin);
function applyAdmin() {
  $('#adminBtn').hidden = !adminOn();
  if (!adminOn()) $('#admin').hidden = true;
  $('#swAdmin').setAttribute('aria-checked', String(prefs.admin));
  $('#admKey').hidden = !KEY_NEEDED;
}
function toggleAdmin(open = $('#admin').hidden) {
  if (!adminOn()) return;
  $('#admin').hidden = !open;
  if (open) { admState(); setTimeout(() => $('#admInput').focus(), 0); }
}
// Typed input goes exactly where speech would: commands, quiz answers, or a question.
function admSend(text) {
  text = text.trim(); if (!text) return;
  if (videoOpen) { if (/close|stop|exit|back/i.test(text)) { admLog('typed', 'typed: ' + text); closeVideo(); } else admLog('info', 'video playing: type "close video" first'); return; }
  if (!VOICE_VIEWS.includes(view)) { greeted = true; show('session'); }
  if (busy) interrupt();
  typedNow = true;
  handleInput(text);
}
$('#adminBtn').addEventListener('click', (e) => { e.stopPropagation(); toggleAdmin(); });
$('#admClose').addEventListener('click', () => toggleAdmin(false));
$('#admin').addEventListener('click', (e) => e.stopPropagation()); // don't count as a holo-mode double-tap
$('#admForm').addEventListener('submit', (e) => { e.preventDefault(); const i = $('#admInput'); admSend(i.value); i.value = ''; });
$('#admKey').addEventListener('submit', (e) => { e.preventDefault(); const k = $('#admKeyInput').value.trim(); if (!k) return; setKey(k); $('#admKeyInput').value = ''; admLog('info', 'API key saved on this device'); });
const ADM_PHRASE = { score: 'my progress', face: 'show your face', board: 'show the board', fun: 'fun chat', study: "let's study", quiz: 'quiz me', video: 'show me a video', picture: 'show me a picture', flip: 'flip', repeat: 'repeat' };
$$('.admquick button').forEach((b) => b.addEventListener('click', () => {
  const a = b.dataset.adm;
  if (ADM_PHRASE[a]) { admSend(ADM_PHRASE[a]); return; }
  if (a === 'holo') { greeted = true; show('live'); admLog('info', 'holo mode'); }
  else if (a === 'screen') { show('session'); admLog('info', 'screen mode'); }
  else if (a === 'stop') { interrupt(); admLog('info', 'stopped'); }
  else if (a === 'mic') { if (!rec || noVoice) { admLog('err', 'mic unavailable in this browser or view'); return; } paused = !paused; if (paused) mute(); resumeIdle(); }
  else if (a === 'start') show('mode');
  else if (a === 'invite') { showcaseInvite(); admLog('info', 'showcase invite'); }
  admState();
}));
$('#swAdmin').addEventListener('click', () => { savePref('admin', !prefs.admin); applyAdmin(); });
$$('#engineSeg button').forEach((b) => b.addEventListener('click', () => { savePref('voiceEngine', b.dataset.engine); renderVoiceStatus(); }));
$('#testVoiceBtn').addEventListener('click', () => { startVoice.unlocked || (startVoice.unlocked = false); unlockAudio(); voiceNoticeShown = false; speakOnce(T(cfg.lang).helloStudy(prefs.kind)); });
if (cloudVoice.keyed) {
  $('#ttsKeyBox').hidden = false;
  $('#ttsKeyBox').addEventListener('submit', async (e) => {
    e.preventDefault();
    const k = $('#ttsKeyInput').value.trim();
    cloudVoice.setKey(k); $('#ttsKeyInput').value = '';
    cloudOK = await cloudVoice.available(); cloudFails = 0; renderVoiceStatus();
    admLog('info', k ? 'Google voice key saved' : 'Google voice key removed');
  });
}
document.addEventListener('keydown', (e) => {
  // Shift+D opens or closes the admin console (ignored while typing in a text box)
  const typing = e.target.closest?.('input, textarea, select, [contenteditable="true"]');
  if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && e.code === 'KeyD' && !typing) { e.preventDefault(); toggleAdmin(); }
});
window.addEventListener('error', (e) => admLog('err', 'error: ' + e.message));
window.addEventListener('unhandledrejection', (e) => admLog('err', 'error: ' + (e.reason?.message || e.reason)));

// ---------- boot ----------
applyKind();
applyPhoto();
renderSetup();
renderHome();
emptyHint();
setStatus('idle');
document.body.dataset.view = 'mode';
applyAdmin();
admLog('info', `Holo Tutor ready · ${SR ? 'speech recognition available' : 'no speech recognition in this browser'}`);
$('#modeGreet').textContent = greetText() + (Account.firstName ? `, ${Account.firstName}` : '');
renderAccount();
// First visit: sign in, create an account or continue as a guest (skipped for showcase / holo links).
if (Account.needsSignIn() && !cfg.showcase && qs.get('mode') !== 'holo' && !qs.has('guest')) show('auth');
if (KEY_NEEDED) {
  const box = $('#keyBox'), input = $('#keyInput');
  box.hidden = false;
  const mark = () => { input.placeholder = getKey() ? 'Key saved · paste a new one to replace it' : 'sk-ant-…'; };
  mark();
  box.addEventListener('submit', (e) => {
    e.preventDefault();
    const k = input.value.trim();
    if (!k) return;
    setKey(k); input.value = ''; mark();
    $('#warn').hidden = true;
  });
}
checkBrain().then((w) => { if (w) { $('#warn').hidden = false; $('#warn').textContent = w; } });
