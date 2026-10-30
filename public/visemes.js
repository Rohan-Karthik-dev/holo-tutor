// Holo Tutor — mouth shapes (visemes) from the text being spoken, for English,
// Hindi (Devanagari) and Telugu. Each shape:
//   open  — jaw/lip opening 0..1        wide  — lip corners spread 0..1 (0.5 neutral)
//   round — lips rounded/pushed (oo, o) press — lips pressed together (m, b, p)
//   fv    — lower lip tucked under upper teeth (f, v)
//   tongue— tongue tip up behind/between teeth (l, t, d, n, th)
const V = (open, wide, round = 0, press = 0, fv = 0, tongue = 0) => ({ open, wide, round, press, fv, tongue });
export const SHAPES = {
  rest: V(0.03, 0.5),
  pause: V(0, 0.48),
  aa: V(0.85, 0.62),
  eh: V(0.5, 0.78),
  ee: V(0.3, 1),
  oh: V(0.6, 0.22, 0.8),
  oo: V(0.28, 0.08, 1),
  mbp: V(0, 0.45, 0, 1),
  fv: V(0.1, 0.56, 0, 0, 1),
  th: V(0.2, 0.6, 0, 0, 0, 0.9),
  ltdn: V(0.24, 0.6, 0, 0, 0, 1),
  sz: V(0.13, 0.86),
  shch: V(0.22, 0.28, 0.65),
  r: V(0.3, 0.36, 0.45),
  kg: V(0.36, 0.55),
  space: V(0.07, 0.52),
};

const EN_DIGRAPH = { th: 'th', sh: 'shch', ch: 'shch', ee: 'ee', ea: 'ee', oo: 'oo', ou: 'oh', ow: 'oh', ph: 'fv', wh: 'oo', ng: 'kg', ck: 'kg', qu: 'oo' };
const EN = {
  a: 'aa', e: 'eh', i: 'ee', o: 'oh', u: 'oo', y: 'ee', w: 'oo', r: 'r',
  m: 'mbp', b: 'mbp', p: 'mbp', f: 'fv', v: 'fv',
  l: 'ltdn', t: 'ltdn', d: 'ltdn', n: 'ltdn',
  s: 'sz', z: 'sz', c: 'kg', x: 'sz', j: 'shch',
  k: 'kg', g: 'kg', h: 'kg', q: 'kg',
};
// Hindi (Devanagari) and Telugu letters and vowel signs.
const INDIC = {};
const set = (chars, shape) => { for (const c of chars) INDIC[c] = shape; };
set('पफबभमపఫబభమ', 'mbp');
set('वవ', 'oo');
set('तथदधनटठडढणलळతథదధనటఠడఢణలళ', 'ltdn');
set('रరఱ', 'r');
set('सशषసశష', 'sz');
set('चछजझచఛజఝ', 'shch');
set('कखगघङहకఖగఘఙహ', 'kg');
set('यయ', 'ee');
set('अआाఅఆా', 'aa');
set('इईिीఇఈిీ', 'ee');
set('उऊुूఉఊుూ', 'oo');
set('एऐेैఎఏఐెేై', 'eh');
set('ओऔोौఒఓఔొోౌ', 'oh');
set('ंँःంఁః', 'ltdn');
set('्్', 'space');

// Builds the shape timeline for a sentence: one shape per character index.
export function shapesFor(text) {
  const t = String(text || '').toLowerCase();
  const out = new Array(t.length);
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (/\s/.test(c)) { out[i] = 'space'; continue; }
    if (/[,;:.!?।—-]/u.test(c)) { out[i] = 'pause'; continue; }
    const di = EN_DIGRAPH[t.slice(i, i + 2)];
    if (di) { out[i] = di; if (i + 1 < t.length) out[++i] = di; continue; }
    if (/[0-9]/.test(c)) { out[i] = ['eh', 'ltdn']; continue; } // numbers are spoken as words
    const sh = EN[c] || INDIC[c] || (/\p{L}/u.test(c) ? 'kg' : 'space');
    // An Indic consonant with no vowel sign after it carries an "a" sound: consonant, then open.
    out[i] = INDIC_CONS.test(c) && !INDIC_SIGN.test(t[i + 1] || '') ? [sh, 'aa'] : sh;
  }
  return natural(t, out);
}
// English spelling isn't sound: silent letters keep the previous shape, and between words the
// mouth moves straight on to the next word's first sound instead of closing every time.
const SILENT_PAIRS = { gh: 0, kn: 0, wr: 0, mb: 1, wh: 1 }; // which letter of the pair is silent
function natural(t, out) {
  for (let i = 0; i < t.length; i++) {
    const pair = t.slice(i, i + 2);
    if (pair in SILENT_PAIRS) { const k = i + SILENT_PAIRS[pair]; if (pair === 'gh') { out[i] = out[i + 1] = out[i - 1] || 'space'; i++; continue; } if (k > 0) out[k] = k === i ? out[i + 1] : out[i]; }
    // a final silent "e" (make, time, there): no extra vowel
    if (t[i] === 'e' && /[a-z]/.test(t[i - 1] || '') && !/[a-z]/.test(t[i + 1] || '') && /[a-z]{3}$/.test(t.slice(Math.max(0, i - 3), i)) && !/[aeiouy]/.test(t[i - 1])) out[i] = out[i - 1];
  }
  for (let i = 0; i < out.length; i++) {
    if (out[i] !== 'space') continue;
    let j = i + 1; while (j < out.length && out[j] === 'space') j++;
    const nx = out[j], prev = out[i - 1];
    if (!nx || nx === 'pause' || !prev || prev === 'pause') continue; // keep a real rest at the edges
    const n0 = Array.isArray(nx) ? nx[0] : nx;
    out[i] = n0 === 'mbp' || n0 === 'fv' ? 'space' : [Array.isArray(prev) ? prev[1] : prev, n0];
  }
  return out;
}
const INDIC_CONS = /[\u0915-\u0939\u0C15-\u0C39]/u;               // Devanagari and Telugu consonants
const INDIC_SIGN = /[\u093C-\u094D\u0C3C-\u0C4D\u0C55\u0C56]/u;   // vowel signs, virama, nukta
