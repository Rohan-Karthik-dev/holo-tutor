// Holo Tutor — cloud voice (Google Cloud Text-to-Speech). Used when the device
// has no voice for the language (often Telugu or Hindi), when the browser can't
// speak at all (some in-app browsers), or when "Cloud voice" is chosen.
const STYLE = {
  Warm: { gender: 'FEMALE', pitch: -1.5, rate: 0.95 },
  Clear: { gender: 'MALE', pitch: 0, rate: 1 },
  Lively: { gender: 'FEMALE', pitch: 2, rate: 1.07 },
};

export function ttsRequest(text, { lang = 'en-IN', style = 'Warm', rate = 1 } = {}) {
  const s = STYLE[style] || STYLE.Warm;
  return {
    input: { text: String(text).slice(0, 4500) },
    voice: { languageCode: lang, ssmlGender: s.gender },
    audioConfig: { audioEncoding: 'MP3', speakingRate: Math.min(2, Math.max(0.6, s.rate * (+rate || 1))), pitch: s.pitch },
  };
}

// Returns MP3 bytes as a Uint8Array.
export async function googleSynth(key, body) {
  const r = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize?key=' + encodeURIComponent(key), {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!r.ok) {
    let msg = ''; try { msg = (await r.json()).error?.message || ''; } catch {}
    throw new Error(`Google voice error ${r.status}${msg ? ': ' + msg : ''}`);
  }
  const { audioContent } = await r.json();
  if (!audioContent) throw new Error('Google voice returned no audio');
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(audioContent, 'base64'));
  const bin = atob(audioContent), out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
