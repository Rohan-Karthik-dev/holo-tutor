// Preview build: asks Claude straight from the page (the viewer's own Claude account).
import { rigFromPoints, FACE_PROMPT } from '../public/lips.js';
import { tutorSystem, videoQueryPrompt, cleanVideos } from '../public/prompt.js';
export const MIC_NOTE = 'This preview can\'t use the microphone. Open the standalone Holo Tutor for speech-to-speech.';
export const KEY_NEEDED = false;
export function getKey() { return ''; }
export function setKey() {}
export const CAN_CAMERA = false;

const samplePromise = (window.claude?.use ? window.claude.use('sample') : Promise.resolve(null)).catch(() => null);


function buildTurns(history, context) {
  const turns = [];
  const last = history[history.length - 1];
  for (const m of history.slice(-20)) {
    let text = m.text || '...';
    if (m.image) text = (m === last ? '[Photo attached] ' : '[Photo shared earlier] ') + text;
    const prev = turns[turns.length - 1];
    if (prev && prev.role === m.role) prev.content += '\n' + text;
    else turns.push({ role: m.role, content: text });
  }
  while (turns.length && turns[0].role !== 'user') turns.shift();
  if (turns.length) turns[0].content = tutorSystem(context) + (context?.mode === 'twin' ? '\n\nThem: ' : '\n\nStudent: ') + turns[0].content;
  return turns;
}

export async function askBrain(history, { onText, signal, context }) {
  const sample = await samplePromise;
  if (!sample) throw Object.assign(new Error('unavailable'), { code: 'unavailable' });
  const last = history[history.length - 1];
  const opts = { signal, modelTier: 'quick', cache: false, onText: ({ text }) => onText(text) };
  if (last?.image?.blob) opts.images = [last.image.blob];
  const { text } = await sample(buildTurns(history, context), opts);
  return text;
}

export async function checkBrain() {
  const s = await samplePromise;
  return s ? '' : 'Claude isn\'t available in this view, so the tutor can\'t answer here.';
}

export function errorHint(err) {
  return err.code === 'not_granted' ? 'Allow this page to use Claude, then ask again.'
    : err.code === 'rate_limited' ? 'Give me a few seconds, then ask again.'
    : err.code === 'unavailable' ? 'Claude isn\'t available in this view.'
    : 'Please try asking again.';
}

export async function locateFace(photo) {
  const sample = await samplePromise;
  if (!sample || !photo.blob) return null;
  try {
    const j = await sample.json(FACE_PROMPT, { images: [photo.blob], modelTier: 'default' });
    return rigFromPoints(j);
  } catch { return null; }
}

export async function askJSON(prompt) {
  const sample = await samplePromise;
  if (!sample) throw Object.assign(new Error('unavailable'), { code: 'unavailable' });
  return sample.json(prompt, { modelTier: 'quick' });
}

export async function findVideos(ctx) {
  const sample = await samplePromise;
  if (!sample) throw Object.assign(new Error('unavailable'), { code: 'unavailable' });
  return cleanVideos(await sample.json(videoQueryPrompt(ctx), { modelTier: 'quick' }));
}
export const CAN_EMBED = false; // this preview can't show other sites inside the page

export const CAN_WEB_IMAGES = false; // this preview can't load pictures from other sites

// The preview can't reach a cloud voice; it speaks with the device's own voice when there is one.
export const cloudVoice = { keyed: false, available: async () => false, synth: async () => { throw new Error('unavailable'); } };

// Accounts: 'server' = email and password accounts that sync through this app's server;
// 'local' = learner profiles saved on this device (no server).
export const AUTH = 'local';
