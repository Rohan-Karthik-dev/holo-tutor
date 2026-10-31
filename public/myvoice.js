// Holo Tutor — "My voice": the tutor speaks in a voice like yours.
//  · Voice match (free, works offline): record yourself reading a short passage; the app
//    measures your pitch and pace, picks the closest voice on this device (male/female,
//    accent) and tunes its pitch and speed to you.
//  · Voice clone (optional, needs an ElevenLabs key): the same recording is sent to
//    ElevenLabs once to make a copy of your voice; the tutor then speaks with it.
// The recording itself is only kept in memory while you're on the screen.

export const READ_ALOUD = 'Hi, this is my voice. I love learning new things, like how the stars shine, why the sky is blue, and how numbers help us build bridges and games. When I explain something, I like to take my time, keep it simple, and make it fun. My favourite way to learn is by asking questions, trying things out, and laughing when I get them wrong. Yesterday I read about volcanoes, rainforests and the deepest parts of the ocean, and I still have so many questions. Thanks for listening, and let\'s learn something amazing together today!';

// ---------- recording ----------
// Records from the microphone until stop() (or maxSec). Calls onLevel(0..1, seconds) while recording.
export async function startRecording({ maxSec = 60, onLevel } = {}) {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser can\'t record audio here. Upload a recording instead.');
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  await ctx.resume?.();
  const src = ctx.createMediaStreamSource(stream);
  const proc = ctx.createScriptProcessor(4096, 1, 1);
  const chunks = []; let n = 0, stopped = false, resolveDone;
  const done = new Promise((r) => { resolveDone = r; });
  proc.onaudioprocess = (e) => {
    if (stopped) return;
    const d = e.inputBuffer.getChannelData(0);
    chunks.push(new Float32Array(d)); n += d.length;
    let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] * d[i];
    onLevel?.(Math.min(1, Math.sqrt(s / (d.length / 4)) * 5), n / ctx.sampleRate);
    if (n / ctx.sampleRate >= maxSec) stop();
  };
  src.connect(proc); proc.connect(ctx.destination);
  function stop() {
    if (stopped) return done;
    stopped = true;
    try { proc.disconnect(); src.disconnect(); } catch {}
    stream.getTracks().forEach((t) => t.stop());
    const all = new Float32Array(n); let o = 0;
    for (const c of chunks) { all.set(c, o); o += c.length; }
    const rate = ctx.sampleRate;
    ctx.close?.();
    resolveDone({ samples: all, rate });
    return done;
  }
  return { stop, done };
}
// An uploaded recording (any format the browser can play) → mono samples.
export async function decodeFile(file) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  try {
    const buf = await ctx.decodeAudioData(await file.arrayBuffer());
    const ch = buf.numberOfChannels, len = buf.length, out = new Float32Array(len);
    for (let c = 0; c < ch; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) out[i] += d[i] / ch; }
    return { samples: out, rate: buf.sampleRate };
  } finally { ctx.close?.(); }
}

// ---------- analysis ----------
// Pitch (median of voiced frames, by autocorrelation) and pace (syllable-like loudness peaks per second).
export function analyzeVoice({ samples, rate }) {
  const hop = Math.round(rate * 0.01), win = Math.round(rate * 0.04);
  const rms = [];
  for (let i = 0; i + win < samples.length; i += hop) {
    let s = 0; for (let j = 0; j < win; j += 2) s += samples[i + j] * samples[i + j];
    rms.push(Math.sqrt(s / (win / 2)));
  }
  if (rms.length < 50) throw new Error('That recording is too short. Speak for at least 5 seconds.');
  const sorted = rms.slice().sort((a, b) => a - b);
  const noise = sorted[Math.floor(sorted.length * 0.15)], loud = sorted[Math.floor(sorted.length * 0.95)];
  if (loud < 0.01) throw new Error('I couldn\'t hear anything. Check the microphone and speak a little louder.');
  const thr = noise + (loud - noise) * 0.25;
  // pitch on voiced frames
  const minLag = Math.floor(rate / 400), maxLag = Math.ceil(rate / 65), f0s = [];
  for (let k = 0; k < rms.length; k += 3) {
    if (rms[k] < thr) continue;
    const st = k * hop, N = Math.min(win * 1.5 | 0, samples.length - st - maxLag);
    if (N < win) continue;
    let e0 = 0; for (let j = 0; j < N; j++) e0 += samples[st + j] * samples[st + j];
    let best = 0, bestLag = 0;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let s = 0, e1 = 0;
      for (let j = 0; j < N; j += 2) { s += samples[st + j] * samples[st + j + lag]; e1 += samples[st + j + lag] * samples[st + j + lag]; }
      const r = s / Math.sqrt(e0 / 2 * e1 + 1e-12);
      if (r > best) { best = r; bestLag = lag; }
    }
    if (best > 0.55 && bestLag) f0s.push(rate / bestLag);
  }
  if (f0s.length < 8) throw new Error('I couldn\'t make out your voice clearly. Try somewhere quieter, a little closer to the mic.');
  f0s.sort((a, b) => a - b);
  // drop octave errors at the edges, then take the middle
  const f0 = f0s[Math.floor(f0s.length / 2)];
  // pace: smoothed loudness peaks while speaking
  const sm = rms.map((_, i) => { let s = 0, c = 0; for (let j = Math.max(0, i - 3); j <= Math.min(rms.length - 1, i + 3); j++) { s += rms[j]; c++; } return s / c; });
  let peaks = 0, last = -99, speechFrames = 0;
  for (let i = 1; i < sm.length - 1; i++) {
    if (sm[i] > thr) speechFrames++;
    if (sm[i] > thr && sm[i] >= sm[i - 1] && sm[i] > sm[i + 1] && i - last > 12) { peaks++; last = i; }
  }
  const speechSec = Math.max(1, speechFrames / 100);
  const pace = Math.min(8, Math.max(2, peaks / speechSec));
  return { f0: Math.round(f0), pace: Math.round(pace * 10) / 10, seconds: Math.round(samples.length / rate), gender: f0 < 160 ? 'Male' : 'Female' };
}

// The closest device voice and the pitch/speed to give it.
export function matchVoice(a, voices, genderOf, preferLang = 'en-IN') {
  const en = voices.filter((v) => /^en/i.test(v.lang));
  const pool = en.length ? en : voices;
  const same = pool.filter((v) => genderOf(v) === a.gender);
  const cands = same.length ? same : pool;
  const region = (v) => String(v.lang || '').replace('_', '-').toLowerCase();
  const score = (v) => (region(v) === preferLang.toLowerCase() ? 4 : region(v).startsWith('en-in') ? 3 : 0)
    + (navigator.onLine !== false && (v.localService === false || /network/i.test(v.name)) ? 1 : 0)
    + (/natural|neural|enhanced|premium/i.test(v.name) ? 1 : 0);
  const voice = cands.slice().sort((x, y) => score(y) - score(x))[0] || null;
  const ref = (voice ? genderOf(voice) || a.gender : a.gender) === 'Male' ? 118 : 205; // typical pitch of such a voice
  const pitch = Math.min(1.3, Math.max(0.75, Math.pow(a.f0 / ref, 0.8)));
  const rate = Math.min(1.2, Math.max(0.85, a.pace / 4.6));
  return { voiceName: voice ? voice.voiceURI || voice.name : '', voiceLabel: voice?.name || '', gender: a.gender, exact: same.length > 0, pitch: Math.round(pitch * 100) / 100, rate: Math.round(rate * 100) / 100, f0: a.f0, pace: a.pace };
}

// ---------- WAV (for the clone upload: every service accepts it) ----------
export function toWav({ samples, rate }, target = 22050, maxSec = 120) {
  const ratio = rate / target, len = Math.min(Math.floor(samples.length / ratio), target * maxSec);
  const out = new DataView(new ArrayBuffer(44 + len * 2));
  const w = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); out.setUint32(4, 36 + len * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true);
  out.setUint32(24, target, true); out.setUint32(28, target * 2, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true);
  w(36, 'data'); out.setUint32(40, len * 2, true);
  let peak = 0; for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
  const gain = peak > 0 ? Math.min(4, 0.9 / peak) : 1;
  for (let i = 0; i < len; i++) {
    const s = Math.max(-1, Math.min(1, samples[Math.floor(i * ratio)] * gain));
    out.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([out], { type: 'audio/wav' });
}

// ---------- ElevenLabs voice clone ----------
const EL = 'https://api.elevenlabs.io/v1';
const EL_KEY = 'holotutor.elKey';
export const voiceClone = {
  getKey() { try { return localStorage.getItem(EL_KEY) || ''; } catch { return ''; } },
  setKey(k) { try { if (k) localStorage.setItem(EL_KEY, k); else localStorage.removeItem(EL_KEY); } catch {} },
  async call(path, init = {}) {
    let r;
    try { r = await fetch(EL + path, { ...init, headers: { 'xi-api-key': this.getKey(), ...(init.headers || {}) } }); }
    catch { throw new Error('Can\'t reach ElevenLabs. Check your internet connection.'); }
    if (!r.ok) {
      let msg = ''; try { const j = await r.json(); msg = j.detail?.message || j.detail?.status || (typeof j.detail === 'string' ? j.detail : ''); } catch {}
      if (r.status === 401) throw new Error('ElevenLabs didn\'t accept that key. Check it in Settings → My voice.');
      if (/can_not_use_instant_voice_cloning|subscription|upgrade/i.test(msg)) throw new Error('Your ElevenLabs plan doesn\'t include voice cloning. It needs the Starter plan or higher.');
      throw new Error(`ElevenLabs error ${r.status}${msg ? ': ' + msg : ''}`);
    }
    return r;
  },
  async create(name, wavBlob) {
    const fd = new FormData();
    fd.append('name', String(name || 'My voice').slice(0, 60));
    fd.append('description', 'Made with Holo Tutor from the owner\'s own recording.');
    fd.append('remove_background_noise', 'true');
    fd.append('files', wavBlob, 'my-voice.wav');
    const j = await (await this.call('/voices/add', { method: 'POST', body: fd })).json();
    if (!j.voice_id) throw new Error('ElevenLabs didn\'t return a voice.');
    return j.voice_id;
  },
  async remove(id) { try { await this.call('/voices/' + encodeURIComponent(id), { method: 'DELETE' }); } catch {} },
  async synth(id, text, rate = 1) {
    const r = await this.call(`/text-to-speech/${encodeURIComponent(id)}?output_format=mp3_44100_64`, {
      method: 'POST', headers: { 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({ text: String(text).slice(0, 2500), model_id: 'eleven_flash_v2_5', voice_settings: { stability: 0.5, similarity_boost: 0.85, speed: Math.min(1.2, Math.max(0.7, rate)) } }),
    });
    return r.blob();
  },
};
