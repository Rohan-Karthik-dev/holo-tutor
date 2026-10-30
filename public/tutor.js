// Holo Tutor — the three tutor renderers, drawn on canvas in light-on-black
// (black vanishes in a Pepper's ghost pane), sharing one lip-sync engine.
//   globe : spinning wireframe globe; a voice ring and nodes pulse with speech
//   human : wireframe "holo human" head with blinking eyes and a moving mouth
//   photo : an uploaded face, turned into a cyan hologram; its jaw, lips and
//           eyelids move through a face-rig warp (see face.js)
// Lip sync: visemes estimated from the sentence being spoken, re-synced on the
// browser's word-boundary events when it sends them, and opened/closed by the
// actual loudness of the voice when it plays as audio (see Tutor.level).
import { rigParams, faceWarp, paintMouth, paintCavity, paintFvTeeth, faceOutline } from './face.js';
import { isRig, rigFromMouth, completeRig } from './lips.js';
import { SHAPES, shapesFor } from './visemes.js';
const MOUTH_KEYS = ['open', 'wide', 'round', 'press', 'fv', 'tongue'];

const CYAN = '79,227,255';
const TAU = Math.PI * 2;

function loadImage(src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
}

// Grayscale + contrast, then tint toward the hologram cyan with bright highlights.
function fitCanvas(img, max = 640) {
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c;
}
// Natural look: the real photo, lifted a touch so it reads well on black glass.
function naturalize(src) {
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const x = c.getContext('2d');
  x.filter = 'brightness(1.08) contrast(1.06) saturate(1.05)';
  x.drawImage(src, 0, 0);
  return c;
}
function holoize(src) {
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const x = c.getContext('2d');
  x.drawImage(src, 0, 0);
  const data = x.getImageData(0, 0, c.width, c.height);
  const p = data.data;
  for (let i = 0; i < p.length; i += 4) {
    const lum = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
    let v = Math.min(255, Math.max(0, (lum - 128) * 1.3 + 140)) / 255;
    v = Math.pow(v, 0.9);
    const hi = v * v * 70;
    p[i] = Math.min(255, 79 * v + hi);
    p[i + 1] = Math.min(255, 227 * v + hi);
    p[i + 2] = Math.min(255, 255 * v + hi);
    p[i + 3] = 255;
  }
  x.putImageData(data, 0, 0);
  return c;
}

export class Tutor {
  constructor(canvas) {
    Object.assign(this, {
      c: canvas, ctx: canvas.getContext('2d'), kind: 'globe', state: 'idle', intensity: 1,
      open: 0, wide: 0.5, round: 0, press: 0, fv: 0, tongue: 0, shapes: [], env: 0, text: '', ptr: 0, cps: 14, speaking: false,
      blink: 0, blinkAt: performance.now() + 1800, gx: 0, gy: 0, gtx: 0, gty: 0, gazeAt: 0,
      brow: 0, energy: 0.2, spin: 0, photo: null, rect: null, prev: performance.now(),
      // human-like behaviour: blinks, smile, head motion
      blinkStart: -1, blinkAmp: 1, blinkNext: performance.now() + 1200 + Math.random() * 1500, doubleNext: false, lastDouble: false,
      smile: 0.35, nod: 0, nodV: 0, lastChar: -1, glanceUntil: 0,
      seed: [Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28],
      head: { tilt: 0, nod: 0, sway: 0, breath: 1 },
    });
    this.off = document.createElement('canvas');
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
    const loop = (t) => { this.frame(t); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }

  resize() {
    const r = this.c.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
    this.c.width = Math.round(this.w * dpr); this.c.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  setKind(k) { this.kind = k; }
  setIntensity(v) { this.intensity = v; }
  setState(s) { this.state = s; this.gazeAt = 0; }
  speak(text, rate = 1) {
    // People often blink as they start a phrase.
    if (!this.speaking && this.blinkStart < 0 && Math.random() < 0.35) this.blinkNext = performance.now() + 60;
    this.text = (text || '').toLowerCase(); this.shapes = shapesFor(this.text); this.ptr = 0; this.lastChar = -1; this.cps = 14 * rate; this.speaking = true;
  }
  sync(i) { if (typeof i === 'number' && i >= 0) this.ptr = i; }
  stopSpeaking() {
    // A small nod at the end of a sentence, and sometimes a blink.
    if (this.speaking) { this.nodV += 1.1; if (this.blinkStart < 0 && Math.random() < 0.4) this.blinkNext = performance.now() + 120; }
    this.speaking = false;
  }

  // Seconds until the next blink: irregular, like a person (about 15–20 a minute).
  blinkGap() {
    const base = this.state === 'thinking' ? 4.2 : this.state === 'listening' ? 3.4 : this.speaking ? 2.6 : 3.2;
    const g = base * Math.exp((Math.random() + Math.random() + Math.random() - 1.5) * 0.7);
    return Math.min(9000, Math.max(900, g * 1000));
  }
  startBlink(now) {
    this.blinkStart = now;
    this.blinkAmp = this.state === 'thinking' && Math.random() < 0.3 ? 0.55 : 1; // half blinks while thinking
    this.doubleNext = !this.lastDouble && Math.random() < 0.16;
    this.lastDouble = false;
  }
  // look: 'real' (the photo in natural colour) or 'holo' (cyan hologram with scanlines).
  async setPhoto(src, rig, look = this.look || 'real') {
    if (!src) { this.photo = null; return; }
    const img = await loadImage(src);
    const orig = fitCanvas(img, 1600);
    this.photo = { orig, aspect: orig.width / orig.height };
    this.setLook(look);
    this.setRig(rig);
  }
  // frame: 'face' (just the face, filling the screen) or 'head' (head and shoulders).
  setFrame(f) { this.framing = f === 'head' ? 'head' : 'face'; }
  setLook(look) {
    this.look = look === 'holo' ? 'holo' : 'real';
    const ph = this.photo; if (!ph) return;
    ph.canvas = this.look === 'holo' ? holoize(ph.orig) : naturalize(ph.orig);
  }
  // rig: a face rig from lips.js, or an old {x, y, w} mouth spot. Missing eyes are
  // estimated from the face's proportions and snapped to the pupils, so it always blinks.
  setRig(rig) {
    const ph = this.photo;
    if (!ph) return;
    const base = isRig(rig) ? rig : rigFromMouth(rig, ph.aspect);
    ph.rig = completeRig(base, ph.orig);
    ph.params = rigParams(ph.rig, ph.aspect);
  }
  // Screen point (CSS px in the canvas) <-> photo fractions.
  toImage(px, py) {
    const v = this.view; if (!v) return null;
    return { x: v.crop.x + ((px - v.x) / v.w) * v.crop.w, y: v.crop.y + ((py - v.y) / v.h) * v.crop.h };
  }
  toScreen(nx, ny) {
    const v = this.view; if (!v) return null;
    return { x: v.x + ((nx - v.crop.x) / v.crop.w) * v.w, y: v.y + ((ny - v.crop.y) / v.crop.h) * v.h };
  }

  // The mouth shape to aim for now, blended a little toward the next sound (coarticulation).
  shapeAt(pos) {
    const i = Math.floor(pos);
    if (i >= this.shapes.length) return SHAPES.pause;
    let s = this.shapes[i];
    if (Array.isArray(s)) s = s[pos - i < 0.45 ? 0 : 1];
    return SHAPES[s] || SHAPES.kg;
  }
  target() {
    if (!this.speaking) return SHAPES.rest;
    const a = this.shapeAt(this.ptr), b = this.shapeAt(this.ptr + 0.6);
    const t = {};
    for (const k of MOUTH_KEYS) t[k] = a[k] * 0.75 + b[k] * 0.25;
    // Lips must really meet for m/b/p and really touch the teeth for f/v.
    if (a.press > 0.5) { t.press = 1; t.open = 0; }
    if (a.fv > 0.5) t.fv = 1;
    // Follow the voice's real loudness when it is known: quiet = closed, loud = wide open.
    const lv = Tutor.level?.();
    if (lv != null && this.speaking) {
      this.env += (lv - this.env) * 0.5;
      if (this.env < 0.035) { t.open *= 0.15; t.round *= 0.5; }
      else t.open *= Math.min(1.25, Math.max(0.6, 0.55 + this.env * 1.8));
    }
    return t;
  }

  frame(now) {
    const dt = Math.min(64, now - this.prev); this.prev = now;
    if (this.speaking) this.ptr += (dt * this.cps) / 1000;
    // Ease each mouth feature toward its target: lips close quickly, open a bit slower.
    const tg = this.target();
    for (const key of MOUTH_KEYS) {
      const closing = key === 'press' || key === 'fv' ? tg[key] > this[key] : tg[key] < this[key];
      const tau = closing ? 32 : key === 'open' ? 55 : 70;
      this[key] += (tg[key] - this[key]) * (1 - Math.exp(-dt / tau));
    }

    // Blink: fast close (75 ms), short hold, slower open (170 ms).
    if (this.blinkStart < 0 && now >= this.blinkNext) this.startBlink(now);
    if (this.blinkStart >= 0) {
      const d = now - this.blinkStart;
      const b = d < 75 ? (d / 75) ** 2 : d < 115 ? 1 : d < 285 ? (1 - (d - 115) / 170) ** 2 : 0;
      this.blink = b * this.blinkAmp;
      if (d >= 285) {
        this.blinkStart = -1; this.blink = 0;
        if (this.doubleNext) { this.doubleNext = false; this.lastDouble = true; this.blinkNext = now + 90 + Math.random() * 90; }
        else this.blinkNext = now + this.blinkGap();
      }
    }

    // Gaze: quick saccades between fixations, mostly at the viewer while talking or listening.
    if (now > this.gazeAt) {
      let tx, ty, hold;
      if (this.state === 'thinking') { tx = 0.55 * (Math.random() < 0.5 ? -1 : 1); ty = -0.6 - Math.random() * 0.2; hold = 1200 + Math.random() * 1500; }
      else if (this.speaking || this.state === 'speaking') {
        const away = Math.random() < 0.28;
        tx = away ? (0.35 + Math.random() * 0.35) * (Math.random() < 0.5 ? -1 : 1) : (Math.random() - 0.5) * 0.12;
        ty = away ? -0.1 - Math.random() * 0.25 : (Math.random() - 0.5) * 0.08;
        hold = away ? 500 + Math.random() * 700 : 1200 + Math.random() * 2200;
      } else if (this.state === 'listening') { tx = (Math.random() - 0.5) * 0.14; ty = (Math.random() - 0.5) * 0.1; hold = 1500 + Math.random() * 2500; }
      else { tx = (Math.random() - 0.5) * 0.9; ty = (Math.random() - 0.5) * 0.45; hold = 1000 + Math.random() * 2500; }
      if (Math.hypot(tx - this.gtx, ty - this.gty) > 0.35 && this.blinkStart < 0 && Math.random() < 0.35) this.blinkNext = now; // blink with big eye moves
      this.gtx = tx; this.gty = ty;
      this.gazeAt = now + hold;
    }
    const g = 1 - Math.exp(-dt / 35);
    const jitter = Math.sin(now / 97) * Math.sin(now / 263) * 0.015; // tiny fixation drift
    this.gx += (this.gtx + jitter - this.gx) * g; this.gy += (this.gty - this.gy) * g;

    // Eyebrows stay still; a soft smile at rest and while listening.
    const chunk = this.text, frac = chunk.length ? this.ptr / chunk.length : 0;
    const emph = this.speaking ? (chunk.includes('?') && frac > 0.55 ? 0.5 : 0) + (chunk.includes('!') ? 0.3 : 0) : 0;
    const browT = 0; // eyebrows stay still
    this.brow += (browT - this.brow) * (1 - Math.exp(-dt / 160));
    const smileT = this.state === 'thinking' ? 0.05 : this.speaking ? (chunk.includes('!') ? 0.5 : 0.22) : this.state === 'listening' ? 0.55 : 0.4;
    this.smile += (smileT - this.smile) * (1 - Math.exp(-dt / 300));

    // Head: small nods on commas and sentence ends (a damped spring), slow tilt, breathing.
    if (this.speaking) {
      const ci = Math.floor(this.ptr);
      if (ci !== this.lastChar && ci < chunk.length) { if (/[,;:]/.test(chunk[ci])) this.nodV += 0.45; this.lastChar = ci; }
    }
    const sd = dt / 1000;
    this.nodV += (-70 * this.nod - 10 * this.nodV) * sd;
    this.nod += this.nodV * sd;
    const ts = now / 1000, [s1, s2, s3] = this.seed;
    this.head = {
      tilt: 0.02 * Math.sin(ts * 0.31 + s1) + 0.011 * Math.sin(ts * 0.77 + s2) + (this.state === 'thinking' ? 0.03 : 0) + (this.state === 'listening' ? 0.015 : 0),
      nod: this.nod - this.open * 0.15 * (this.speaking ? 1 : 0),
      sway: 0.012 * Math.sin(ts * 0.23 + s3) + this.gx * 0.012,
      breath: 1 + 0.004 * Math.sin(ts * 1.6),
    };
    const eT = this.speaking ? 0.5 + this.open * 0.8 : this.state === 'listening' ? 0.4 : this.state === 'thinking' ? 0.6 : 0.18;
    this.energy += (eT - this.energy) * (1 - Math.exp(-dt / 200));
    this.spin += (dt / 1000) * (0.45 + this.energy * 1.3);

    if (this.c.getClientRects().length === 0) return; // hidden: skip drawing
    this.draw(now / 1000);
  }

  draw(t) {
    const { ctx, w, h } = this;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.globalAlpha = this.intensity * (0.92 + 0.08 * Math.sin(t * 37) * Math.sin(t * 3.1));
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    let b;
    if (this.kind === 'photo' && this.photo) b = this.drawPhoto(t);
    else if (this.kind === 'human' || this.kind === 'photo') b = this.drawHuman(t);
    else b = this.drawGlobe(t);
    this.drawCues(t, b);
    ctx.restore();
  }

  glow(blur) { this.ctx.shadowColor = `rgba(${CYAN},0.9)`; this.ctx.shadowBlur = blur; }
  noGlow() { this.ctx.shadowBlur = 0; }

  drawGlobe(t) {
    const { ctx, w, h } = this;
    const G = (a) => `rgba(${CYAN},${a})`;
    const s = Math.min(w, h);
    const R = s * 0.33;
    const cx = w / 2;
    const cy = h / 2 - s * 0.05 + Math.sin(t * 1.25) * s * 0.012;

    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    core.addColorStop(0, 'rgba(0,0,0,0)');
    core.addColorStop(0.72, G(0.06 + this.energy * 0.05));
    core.addColorStop(1, G(0.38 + this.energy * 0.15));
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
    this.glow(s * 0.03);
    ctx.strokeStyle = G(1); ctx.lineWidth = Math.max(1.5, R * 0.016);
    ctx.stroke();

    ctx.lineWidth = Math.max(1, R * 0.0075); ctx.strokeStyle = G(0.55);
    for (const [dy, rx, ry] of [[0, 1, 0.175], [-0.35, 0.94, 0.15], [0.35, 0.94, 0.15], [-0.7, 0.71, 0.1125], [0.7, 0.71, 0.1125]]) {
      ctx.beginPath(); ctx.ellipse(cx, cy + dy * R, rx * R, ry * R, 0, 0, TAU); ctx.stroke();
    }
    ctx.strokeStyle = G(0.8); ctx.lineWidth = Math.max(1, R * 0.009);
    for (let i = 0; i < 6; i++) {
      const rx = Math.abs(Math.cos(this.spin + (i * Math.PI) / 6)) * R;
      ctx.beginPath(); ctx.ellipse(cx, cy, Math.max(0.5, rx), R, 0, 0, TAU); ctx.stroke();
    }

    this.noGlow();
    ctx.fillStyle = '#FFFFFF';
    const base = ctx.globalAlpha;
    [[-0.31, -0.375, 4], [0.39, -0.15, 4], [0.0875, 0.425, 4], [-0.51, 0.225, 3], [0.6, 0.325, 3]].forEach(([x, y, r], i) => {
      const p = 0.5 + 0.5 * Math.sin(t * 2.6 + i * 1.3);
      ctx.globalAlpha = base * (0.35 + 0.65 * p);
      ctx.beginPath(); ctx.arc(cx + x * R, cy + y * R, (r * R / 160) * (1 + 0.6 * p + this.open * 0.9), 0, TAU); ctx.fill();
    });
    ctx.globalAlpha = base;

    ctx.save();
    ctx.translate(cx, cy); ctx.rotate((-18 * Math.PI) / 180);
    ctx.strokeStyle = G(0.35); ctx.lineWidth = Math.max(1, R * 0.006);
    ctx.beginPath(); ctx.ellipse(0, 0, R * 1.34, R * 0.325, 0, 0, TAU); ctx.stroke();
    this.glow(s * 0.02);
    ctx.strokeStyle = G(1); ctx.lineWidth = Math.max(2, R * 0.019);
    ctx.setLineDash([R * 0.25, R * 2.25]);
    ctx.lineDashOffset = -t * R * 0.3 * (1 + this.energy * 2);
    ctx.beginPath(); ctx.ellipse(0, 0, R * 1.34, R * 0.325, 0, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    if (this.open > 0.03) { // the globe's "mouth": a ring that breathes with each sound
      this.glow(s * 0.03);
      ctx.strokeStyle = G(Math.min(1, this.open * 0.8)); ctx.lineWidth = Math.max(1.5, R * 0.012);
      ctx.beginPath(); ctx.arc(cx, cy, R * (1.05 + this.open * 0.12), 0, TAU); ctx.stroke();
    }

    this.noGlow();
    ctx.strokeStyle = G(0.5); ctx.lineWidth = Math.max(1, R * 0.008);
    ctx.beginPath(); ctx.ellipse(cx, cy + R * 1.3, R * 1.2, R * 0.13, 0, 0, TAU); ctx.stroke();
    return { cx, cy, rx: R, ry: R };
  }

  drawHuman(t) {
    const { ctx, w, h } = this;
    const G = (a) => `rgba(${CYAN},${a})`;
    const k = Math.min(w / 420, h / 520) * 0.95;
    const ox = w / 2 - 210 * k;
    const oy = (h - 520 * k) / 2 + Math.sin(t * 1.25) * 6 * k;
    ctx.save();
    ctx.translate(ox, oy); ctx.scale(k, k);
    const H = this.head;
    ctx.translate(210 + H.sway * 420, 336 + H.nod * 10);
    ctx.rotate(H.tilt); ctx.scale(H.breath, H.breath);
    ctx.translate(-210, -336);

    const head = new Path2D();
    head.ellipse(210, 180, 84, 106, 0, 0, TAU);
    const f = ctx.createLinearGradient(0, 74, 0, 286);
    f.addColorStop(0, G(0.14)); f.addColorStop(1, G(0.03));
    ctx.fillStyle = f; ctx.fill(head);

    ctx.save(); ctx.clip(head);
    ctx.strokeStyle = G(0.4); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(210, 180, 44, 106, 0, 0, TAU);
    for (const y of [132, 180, 228]) { ctx.moveTo(120, y); ctx.lineTo(300, y); }
    ctx.stroke();
    ctx.fillStyle = G(0.12);
    ctx.fillRect(120, 74 + ((t * 40) % 212), 180, 3);
    ctx.restore();

    this.glow(12);
    ctx.strokeStyle = G(1); ctx.lineWidth = 3; ctx.stroke(head);

    const lift = this.brow * 8;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(166, 150 - lift); ctx.quadraticCurveTo(182, 142 - lift, 196, 150 - lift);
    ctx.moveTo(224, 150 - lift); ctx.quadraticCurveTo(238, 142 - lift, 254, 150 - lift);
    ctx.moveTo(210, 168); ctx.lineTo(203, 204); ctx.lineTo(215, 206);
    ctx.moveTo(180, 280); ctx.lineTo(176, 336); ctx.moveTo(240, 280); ctx.lineTo(244, 336);
    ctx.moveTo(176, 336); ctx.bezierCurveTo(132, 352, 70, 368, 50, 426); ctx.lineTo(36, 520);
    ctx.moveTo(244, 336); ctx.bezierCurveTo(288, 352, 350, 368, 370, 426); ctx.lineTo(384, 520);
    ctx.stroke();

    this.glow(8);
    ctx.fillStyle = '#FFFFFF';
    const ey = 4.5 * (1 - this.blink * 0.9) * (this.state === 'listening' ? 1.15 : 1);
    for (const x of [181, 239]) {
      ctx.beginPath(); ctx.ellipse(x + this.gx * 3, 168 + this.gy * 2, 11, Math.max(0.6, ey), 0, 0, TAU); ctx.fill();
    }

    const mrx = 18 * (0.72 + 0.5 * this.wide) * (1 - 0.4 * this.round);
    const mry = (2.5 + 15 * this.open + 5 * this.round * this.open) * (1 - 0.8 * this.press);
    if (this.open > 0.12) {
      ctx.beginPath(); ctx.ellipse(210, 234 + this.open * 3, mrx, mry, 0, 0, TAU);
      ctx.fillStyle = 'rgba(0,10,14,0.92)'; ctx.fill();
      ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2.4; ctx.stroke();
    } else { // closed lips with a soft smile
      const sm = this.smile * 5;
      ctx.beginPath();
      ctx.moveTo(210 - mrx, 233 - sm * 0.6);
      ctx.quadraticCurveTo(210, 235 + sm + this.open * 10, 210 + mrx, 233 - sm * 0.6);
      ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2.6 + this.open * 6; ctx.stroke();
    }
    this.noGlow();
    ctx.restore();
    return { cx: ox + 210 * k, cy: oy + 180 * k, rx: 84 * k, ry: 106 * k };
  }

  drawPhoto(t) {
    const { ctx, w, h } = this;
    const ph = this.photo, P = ph.canvas, R = ph.rig, Q = ph.params;
    const iw = P.width, ih = P.height;
    const faceOnly = this.framing !== 'head';
    const rest = { open: 0, wide: 0.5, blink: 0 };
    const outline0 = faceOnly ? faceOutline(R, Q, rest) : null; // resting outline: keeps the framing steady
    // Frame: just the face (outline box + a small margin) filling the stage, or head and shoulders.
    const chinY = R.chin.y;
    const top = R.top ? R.top.y : Math.max(0, chinY - (chinY - R.ui.y) * 3.3);
    let fcx = (R.jl.x + R.jr.x) / 2, fcy = (top + chinY) / 2 + (chinY - top) * 0.05;
    const boxW = w * (faceOnly ? 0.98 : 0.94), boxH = h * (faceOnly ? 0.98 : 0.96);
    let chN, cwN;
    if (faceOnly) {
      const xs = outline0.map((q) => q[0]), ys = outline0.map((q) => q[1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys); // the chin stays put now
      fcx = (x0 + x1) / 2; fcy = (y0 + y1) / 2;
      const fwN = (x1 - x0) * 1.08, fhN = (y1 - y0) * 1.06;
      const pa = boxW / boxH; // fill the stage's shape
      chN = Math.max(fhN, (fwN * iw) / ih / pa);
      cwN = (chN * ih * pa) / iw;
    } else {
      const pa = Math.min(boxW / boxH, 0.9);
      chN = Math.min(1.7, Math.max(0.25, (chinY - top) * 1.6));
      cwN = (chN * ih * pa) / iw;
    }
    const crop = { x: fcx - cwN / 2, y: fcy - chN / 2, w: cwN, h: chN };
    const k = Math.min(boxW / (cwN * iw), boxH / (chN * ih));
    const dw = Math.max(2, cwN * iw * k), dh = Math.max(2, chN * ih * k);
    const dx = (w - dw) / 2, dy = (h - dh) / 2 + Math.sin(t * 1.3) * h * 0.006;
    this.view = { x: dx, y: dy, w: dw, h: dh, crop };
    this.rect = this.view;

    const r = Math.min(2, this.c.width / Math.max(1, w));
    const O = this.off;
    const ow = Math.max(2, Math.round(dw * r)), oh = Math.max(2, Math.round(dh * r));
    if (O.width !== ow || O.height !== oh) { O.width = ow; O.height = oh; }
    const o = O.getContext('2d');
    o.setTransform(1, 0, 0, 1, 0, 0);
    o.globalCompositeOperation = 'source-over';
    o.clearRect(0, 0, ow, oh);
    const st = { open: this.open, wide: this.wide, round: this.round, press: this.press, fv: this.fv, tongue: this.tongue, blink: this.blink, gx: this.gx, gy: this.gy, brow: this.brow, smile: this.smile };
    // The person's own lips move; only the skin right around the mouth follows.
    const warp = faceWarp();
    const g = warp && warp.render(P, Q, st, crop, ow, oh);
    const toPx = (x, y) => [((x - crop.x) / crop.w) * dw, ((y - crop.y) / crop.h) * dh];
    const holes = Boolean(g && warp.holes);
    if (holes && this.open > 0.05) { o.setTransform(r, 0, 0, r, 0, 0); paintCavity(o, R, Q, st, toPx, this.look); o.setTransform(1, 0, 0, 1, 0, 0); }
    if (g) o.drawImage(g, 0, 0); // the photo opens where the lips part, showing the mouth underneath
    else o.drawImage(P, crop.x * iw, crop.y * ih, crop.w * iw, crop.h * ih, 0, 0, ow, oh);
    o.setTransform(r, 0, 0, r, 0, 0);
    const plain = () => o.drawImage(P, crop.x * iw, crop.y * ih, crop.w * iw, crop.h * ih, 0, 0, dw, dh);
    if (holes) paintFvTeeth(o, R, Q, st, toPx, this.look);
    else if (this.open > 0.03 || this.fv > 0.25) paintMouth(o, R, Q, st, toPx, this.look, plain);

    // Hologram look: scanlines and a sweeping scan band.
    if (this.look === 'holo') {
    o.globalCompositeOperation = 'source-atop';
    o.fillStyle = 'rgba(0,0,0,0.16)';
    for (let y = (t * 20) % 4; y < dh; y += 4) o.fillRect(0, y, dw, 1);
    const by = ((t * 0.3) % 1) * (dh + 60) - 30;
    const band = o.createLinearGradient(0, by - 14, 0, by + 14);
    band.addColorStop(0, 'rgba(79,227,255,0)'); band.addColorStop(0.5, 'rgba(79,227,255,0.26)'); band.addColorStop(1, 'rgba(79,227,255,0)');
    o.fillStyle = band; o.fillRect(0, by - 14, dw, 28);
    }

    // Mask: the real face outline (moving with the jaw) with a soft edge, or a soft oval for head and shoulders.
    const [mcx, mcy] = toPx(fcx, fcy);
    const mrx = Math.max(dw * 0.25, (Math.abs(R.jr.x - R.jl.x) / 2) * 1.38 / crop.w * dw);
    const mry = Math.max(dh * 0.25, ((chinY - top) / 2) * 1.22 / crop.h * dh);
    o.globalCompositeOperation = 'destination-in';
    if (faceOnly) {
      const M = this.maskC || (this.maskC = document.createElement('canvas'));
      if (M.width !== ow || M.height !== oh) { M.width = ow; M.height = oh; }
      const m = M.getContext('2d');
      m.setTransform(1, 0, 0, 1, 0, 0); m.clearRect(0, 0, ow, oh);
      m.setTransform(r, 0, 0, r, 0, 0);
      const pts = faceOutline(R, Q, st).map(([x, y]) => toPx(x, y));
      const feather = Math.max(4, dw * 0.035);
      const path = new Path2D();
      pts.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)));
      path.closePath();
      // Draw only the blurred shadow of the shape (shape itself off-canvas): a feathered edge that works everywhere.
      m.save();
      m.shadowColor = '#000'; m.shadowBlur = feather * r; m.shadowOffsetX = 10000 * r;
      m.translate(-10000, 0); m.fillStyle = '#000'; m.fill(path);
      m.restore();
      o.setTransform(1, 0, 0, 1, 0, 0);
      o.drawImage(M, 0, 0);
      o.setTransform(r, 0, 0, r, 0, 0);
      o.globalCompositeOperation = 'source-over';
    } else {
    o.save();
    o.translate(mcx, mcy);
    o.scale(1, mry / mrx);
    const rg = o.createRadialGradient(0, 0, 0, 0, 0, mrx);
    rg.addColorStop(0, '#000'); rg.addColorStop(0.66, '#000'); rg.addColorStop(1, 'rgba(0,0,0,0)');
    o.fillStyle = rg; o.fillRect(-dw * 3, -dh * 6, dw * 6, dh * 12);
    o.restore();
    o.globalCompositeOperation = 'source-over';
    }

    // Head motion pivots at the neck: tilt, nod, sway and breathing.
    const H = this.head;
    const fx = dx + mcx, fy = dy + mcy + mry * 0.75;
    ctx.save();
    ctx.translate(fx + H.sway * dw, fy + H.nod * dh * 0.02);
    ctx.rotate(H.tilt);
    ctx.scale(H.breath, H.breath);
    ctx.translate(-fx, -fy);
    ctx.shadowColor = this.look === 'holo' ? `rgba(${CYAN},0.55)` : 'rgba(255,240,225,0.18)';
    ctx.shadowBlur = Math.min(w, h) * 0.04;
    ctx.drawImage(O, dx, dy, dw, dh);
    ctx.restore();
    this.noGlow();
    return { cx: dx + mcx, cy: dy + mcy, rx: mrx * 0.92, ry: mry * 0.92 };
  }

  drawCues(t, b) {
    const { ctx } = this;
    this.noGlow();
    if (this.state === 'listening') {
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        const p = (t * 0.6 + i / 3) % 1;
        ctx.strokeStyle = `rgba(${CYAN},${(1 - p) * 0.35})`;
        ctx.beginPath(); ctx.ellipse(b.cx, b.cy, b.rx * (1.12 + p * 0.35), b.ry * (1.08 + p * 0.28), 0, 0, TAU); ctx.stroke();
      }
    } else if (this.state === 'thinking') {
      this.glow(10);
      ctx.fillStyle = `rgba(${CYAN},0.95)`;
      for (let i = 0; i < 3; i++) {
        const a = t * 2.4 + i * 0.45;
        ctx.beginPath(); ctx.arc(b.cx + Math.cos(a) * b.rx * 1.25, b.cy + Math.sin(a) * b.ry * 1.15, Math.max(3, b.rx * 0.035), 0, TAU); ctx.fill();
      }
      this.noGlow();
    }
  }
}
