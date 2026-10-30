// Holo Tutor — makes an uploaded face photo talk.
// The photo is drawn as a fine triangle mesh in WebGL and the mesh is bent by a
// "face rig" (mouth corners, inner lips, jaw, chin, eyes found on the photo):
// the jaw and lower lip drop, the upper lip lifts, the corners stretch or pucker
// with each sound, and the eyelids close when the tutor blinks. The mouth
// opening (dark inside, teeth, tongue) is then painted between the moved lips.

const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

function quad(x1, y1, x2, y2, x3, y3) {
  const d = (x1 - x2) * (x1 - x3) * (x2 - x3) || 1e-6;
  const A = (x3 * (y2 - y1) + x2 * (y1 - y3) + x1 * (y3 - y2)) / d;
  const B = (x3 * x3 * (y1 - y2) + x2 * x2 * (y3 - y1) + x1 * x1 * (y2 - y3)) / d;
  const C = (x2 * x3 * (x2 - x3) * y1 + x3 * x1 * (x3 - x1) * y2 + x1 * x2 * (x1 - x2) * y3) / d;
  return [A, B, C];
}

// Turns a rig (fractions of the image) into the numbers the warp needs.
export function rigParams(rig, aspect) {
  const mx = (rig.ml.x + rig.mr.x) / 2;
  const mw = Math.max(0.01, Math.abs(rig.mr.x - rig.ml.x) / 2);
  const cx = (rig.ui.x + rig.li.x) / 2, cy = (rig.ui.y + rig.li.y) / 2;
  const [a, b, c] = quad(rig.ml.x, rig.ml.y, cx, cy, rig.mr.x, rig.mr.y);
  const seamC = (a * mx + b) * mx + c;
  const mwY = mw * aspect;
  const lipThick = Math.max(0.004, (rig.lo.y - rig.uo.y) / 2);
  const chinY = Math.max(rig.chin.y, seamC + mwY * 0.8);
  return {
    a, b, c, mx, mw, seamC, chinY, lipThick,
    D: Math.min(mwY * 0.85, (chinY - seamC) * 0.6) * 0.6, // talking-size opening, not a yawn
    band: Math.max(0.0025, lipThick * 0.12),
    upperBand: Math.max(0.006, (rig.ui.y - rig.uo.y) * 1.6),
    jawCx: (rig.jl.x + rig.jr.x) / 2,
    jawHalf: Math.max(mw * 1.5, Math.abs(rig.jr.x - rig.jl.x) / 2),
    eyes: (rig.eyes || []).slice(0, 2),
  };
}

// How far a point of the photo moves for the current mouth/eye state.
// side: 0 = force "above the lips", 1 = force "below the lips", undefined = blend.
export function displace(P, x, y, st, side) {
  // Only the lips and the skin right around them move; nothing beyond about
  // 1.6 mouth-widths from the centre, so the cheeks, jaw and face never twist.
  const seam = (P.a * x + P.b) * x + P.c;
  const below = side === undefined ? smooth(seam - P.band, seam + P.band, y) : side;
  const dxm = Math.abs(x - P.mx) / P.mw;
  const sgn = Math.sign(x - P.mx);
  const taper = 1 - smooth(0.55, 1.05, dxm);                   // the lips themselves
  const lipBot = seam + P.lipThick * 2.2;                       // just under the lower lip
  const Lb = Math.max(P.D * 2.6, P.lipThick * 6);               // how far below the skin is still stretched
  const u = smooth(0, 1, (y - lipBot) / Lb);
  const fall = 1 - u;
  const wideT = 1 - smooth(0.6, 1.5, dxm);
  const hB = taper + (wideT - taper) * Math.min(1, Math.max(0, (y - seam) / (P.lipThick * 2.2 + 1e-6)));
  let dy = st.open * P.D * below * hB * fall;
  const above = (1 - below) * smooth(seam - P.upperBand, seam - P.band, y);
  dy -= st.open * P.D * 0.12 * taper * above;
  const rx = (x - P.mx) / (P.mw * 1.3), ry = (y - seam) / (P.lipThick * 2.2 + P.band);
  const rad = Math.exp(-(rx * rx + ry * ry));
  const cm = Math.min(1, dxm) * rad;
  let dx = (st.wide - 0.5) * P.mw * 0.2 * sgn * cm;
  const sx = (x - P.mx) / (P.mw * 1.2), sy = (y - seam) / (P.lipThick * 3 + P.band);
  const cw = smooth(0.35, 1.0, dxm) * Math.exp(-(sx * sx + sy * sy)) * (st.smile || 0) * 0.6;
  dy -= P.lipThick * 1.1 * cw;
  dx += P.mw * 0.05 * sgn * cw;
  const lzv = (y - seam) / (P.lipThick * 2.6 + P.band);
  const lz = Math.exp(-lzv * lzv) * taper;
  const r = st.round || 0, p = st.press || 0, f = st.fv || 0;
  dx -= (r * 0.24 + p * 0.04) * P.mw * sgn * cm;
  // press (m/b/p) and f/v squeeze the lips toward the line where they meet; they never cross it,
  // so the lips can't overlap each other
  dy += P.lipThick * lz * ((1 - below) * (-r * 0.2) + below * (r * 0.6)) - (y - seam) * lz * (p * 0.3 + below * f * 0.4);
  const region = 1 - smooth(1.05, 1.6, dxm);
  dx *= region; dy *= region;
  for (const e of P.eyes) { const [ex, ey] = eyeMove(e, x, y, st); dx += ex; dy += ey; }
  return [dx, dy];
}
// Eyes: the iris follows the gaze inside the eye opening, the brow lifts, the lids blink.
function eyeMove(e, x, y, st) {
  if (!e?.rx) return [0, 0];
  const u = (x - e.x) / e.rx, v = (y - e.y) / e.ry;
  const inside = (1 - smooth(0.25, 0.95, u * u + v * v)) * (1 - (st.blink || 0));
  let dx = (st.gx || 0) * e.rx * 0.28 * inside;
  let dy = (st.gy || 0) * e.ry * 0.25 * inside;
  const bu = (x - e.x) / (e.rx * 1.5), bv = (y - (e.y - e.ry * 2.4)) / (e.ry * 1.6);
  dy -= (st.brow || 0) * e.ry * 0.55 * Math.exp(-(bu * bu + bv * bv));
  dy += eyeLid(e, x, y, st.blink);
  return [dx, dy];
}
// The upper lid slides down to a line just below the eye's middle; the skin
// above it stretches, the brow stays put, and the lower lid rises a little.
function eyeLid(e, x, y, blink) {
  if (!blink || !e?.rx) return 0;
  const hw = 1 - smooth(1.05, 1.5, Math.abs(x - e.x) / e.rx);
  const target = e.y + e.ry * 0.55, L = e.ry * 2.1, K = e.ry * 0.5;
  if (y <= target) {
    const d = target - y;
    return blink * hw * (d <= L ? d : L * (1 - smooth(0, 1, (d - L) / K)));
  }
  const d = y - target, Lb = e.ry * 0.9, Kb = e.ry * 1.0; // the lower lid rises to meet it
  return -blink * hw * (d <= Lb ? d : Lb * (1 - smooth(0, 1, (d - Lb) / Kb)));
}

// The mouth movement, shared by the vertex shader (moves the photo) and the fragment shader
// (finds the opening between the moved lips). side: <0 blend across the lip line, 0 above, 1 below.
const MOUTH_GLSL = `
uniform vec3 u_seam; uniform vec4 u_m; uniform vec2 u_ub; uniform vec3 u_s; uniform vec4 u_f; uniform vec4 u_v;
vec2 mouthMove(float x, float y, float side) {
  float open = u_s.x; float wide = u_s.y;
  float mx = u_m.x; float mw = u_m.y; float D = u_m.z; float band = u_m.w;
  float seam = (u_seam.x * x + u_seam.y) * x + u_seam.z;
  float below = side < 0.0 ? smoothstep(seam - band, seam + band, y) : side;
  float dxm = abs(x - mx) / mw;
  float sg = sign(x - mx);
  float lt = u_ub.y;
  float taper = 1.0 - smoothstep(0.55, 1.05, dxm);
  float lipBot = seam + lt * 2.2;
  float Lb = max(D * 2.6, lt * 6.0);
  float fall = 1.0 - smoothstep(0.0, 1.0, (y - lipBot) / Lb);
  float wideT = 1.0 - smoothstep(0.6, 1.5, dxm);
  float hB = mix(taper, wideT, clamp((y - seam) / (lt * 2.2 + 1e-6), 0.0, 1.0));
  float dy = open * D * below * hB * fall;
  float above = (1.0 - below) * smoothstep(seam - u_ub.x, seam - band, y);
  dy -= open * D * 0.12 * taper * above;
  float rx = (x - mx) / (mw * 1.3); float ry = (y - seam) / (lt * 2.2 + band);
  float rad = exp(-(rx * rx + ry * ry));
  float cm = min(1.0, dxm) * rad;
  float dx = (wide - 0.5) * mw * 0.2 * sg * cm;
  float sx = (x - mx) / (mw * 1.2); float sy = (y - seam) / (lt * 3.0 + band);
  float cw = smoothstep(0.35, 1.0, dxm) * exp(-(sx * sx + sy * sy)) * u_f.w * 0.6;
  dy -= lt * 1.1 * cw;
  dx += mw * 0.05 * sg * cw;
  float lzv = (y - seam) / (lt * 2.6 + band);
  float lz = exp(-lzv * lzv) * taper;
  dx -= (u_v.x * 0.24 + u_v.y * 0.04) * mw * sg * cm;
  dy += lt * lz * ((1.0 - below) * (-u_v.x * 0.2) + below * (u_v.x * 0.6)) - (y - seam) * lz * (u_v.y * 0.3 + below * u_v.z * 0.4);
  float region = 1.0 - smoothstep(1.05, 1.6, dxm);
  return vec2(dx, dy) * region;
}`;
const VERT = `
attribute vec2 a_uv;
uniform vec4 u_e1; uniform vec4 u_e2; uniform vec4 u_crop; uniform float u_vlid;
varying vec2 v_uv;
${MOUTH_GLSL}
float eyeLid(vec4 e, float x, float y, float blink) {
  if (e.z <= 0.0 || blink <= 0.0) return 0.0;
  float hw = 1.0 - smoothstep(1.05, 1.5, abs(x - e.x) / e.z);
  float target = e.y + e.w * 0.55; float L = e.w * 2.1; float K = e.w * 0.5;
  if (y <= target) {
    float d = target - y;
    return blink * hw * (d <= L ? d : L * (1.0 - smoothstep(0.0, 1.0, (d - L) / K)));
  }
  float d2 = y - target; float Lb = e.w * 0.9; float Kb = e.w * 1.0;
  return -blink * hw * (d2 <= Lb ? d2 : Lb * (1.0 - smoothstep(0.0, 1.0, (d2 - Lb) / Kb)));
}
vec2 eyeMove(vec4 e, float x, float y, float blink) {
  if (e.z <= 0.0) return vec2(0.0);
  float u = (x - e.x) / e.z; float v = (y - e.y) / e.w;
  float inside = (1.0 - smoothstep(0.25, 0.95, u * u + v * v)) * (1.0 - blink);
  vec2 d = vec2(u_f.x * e.z * 0.28, u_f.y * e.w * 0.25) * inside;
  float bu = (x - e.x) / (e.z * 1.5); float bv = (y - (e.y - e.w * 2.4)) / (e.w * 1.6);
  d.y -= u_f.z * e.w * 0.55 * exp(-(bu * bu + bv * bv));
  d.y += eyeLid(e, x, y, blink) * u_vlid; // older phones: the simple squash blink
  return d;
}
void main() {
  float x = a_uv.x; float y = a_uv.y; float blink = u_s.z;
  vec2 d = mouthMove(x, y, -1.0) + eyeMove(u_e1, x, y, blink) + eyeMove(u_e2, x, y, blink);
  vec2 q = (a_uv + d - u_crop.xy) / u_crop.zw;
  v_uv = a_uv;
  gl_Position = vec4(q.x * 2.0 - 1.0, 1.0 - q.y * 2.0, 0.0, 1.0);
}`;
const FRAG = `
precision mediump float;
uniform sampler2D u_tex; varying vec2 v_uv;
void main() { gl_FragColor = texture2D(u_tex, v_uv); }`;
// The photo opens where the lips part. For each pixel we work out where the edge of the
// upper lip and the edge of the lower lip moved to, and make the photo see-through between
// them, so the inside of the mouth (painted underneath) shows. The real lips are the edge of
// the opening: nothing can spill past them, whatever the face looks like.
// Blinking: the upper eyelid slides down over the eye like a shutter. The skin just above the
// eye stretches down to cover it, the lash line rides on the lid's edge, a soft shadow falls
// under the lid, and the eye itself is never squashed.
const FRAG_HOLE = `
precision highp float;
uniform sampler2D u_tex; uniform vec4 u_crop; uniform vec2 u_size; uniform float u_hole;
uniform vec4 u_e1; uniform vec4 u_e2;
varying vec2 v_uv;
${MOUTH_GLSL}
vec2 lid(vec4 e, vec2 uv, float b, inout float shade) {
  if (e.z <= 0.0 || b <= 0.001) return uv;
  float rx = e.z * 1.3; float ry = e.w * 1.25;            // a little larger than the found eye
  float u = (uv.x - e.x) / rx;
  if (abs(u) >= 1.0) return uv;
  float sh = pow(1.0 - u * u, 0.55);                        // almond shape
  b *= 1.0 - smoothstep(0.45, 1.0, abs(u));                 // ease the lid into the corners: no hard rim
  float ytop = e.y - ry * sh;                               // lash line at rest
  float ybot = e.y + ry * 0.8 * sh;                         // lower lid line
  float yLid = ytop + b * (ybot - ytop);                    // where the lid's edge is now
  float S = e.w * 0.8;                                      // lid skin that slides down (stops well below the eyebrow)
  float y0 = ytop - S;
  if (uv.y > yLid) {                                        // the eye below the lid: shadowed near the edge
    shade = max(shade, b * 0.45 * sh * (1.0 - smoothstep(0.0, ry * 0.45, uv.y - yLid)) * (1.0 - smoothstep(ybot, ybot + ry * 0.2, uv.y)));
    return uv;
  }
  if (uv.y < y0) return uv;
  float t = (uv.y - y0) / (S + (yLid - ytop));             // 0..1 down the moving lid
  shade = max(shade, b * 0.12 * sh * smoothstep(0.55, 0.9, t)); // the lid's own soft shading
  // The lash line keeps its natural thickness along the lid's edge; only the smooth skin above it stretches.
  float lash = e.w * 0.3;
  float edgeTop = yLid - lash;
  if (uv.y >= edgeTop) return vec2(uv.x, ytop - lash + (uv.y - edgeTop));
  return vec2(uv.x, y0 + (uv.y - y0) / max(edgeTop - y0, 1e-5) * (S - lash));
}
void main() {
  float shade = 0.0;
  vec2 uv = lid(u_e1, v_uv, u_s.z, shade);
  uv = lid(u_e2, uv, u_s.z, shade);
  vec4 c = texture2D(u_tex, uv);
  c.rgb *= 1.0 - shade;
  if (u_hole > 0.0) {
    vec2 p = vec2(u_crop.x + gl_FragCoord.x / u_size.x * u_crop.z, u_crop.y + (1.0 - gl_FragCoord.y / u_size.y) * u_crop.w);
    float seam = (u_seam.x * p.x + u_seam.y) * p.x + u_seam.z;
    float yT = seam + mouthMove(p.x, seam, 0.0).y;   // where the upper lip's edge is now
    float yB = seam + mouthMove(p.x, seam, 1.0).y;   // where the lower lip's edge is now
    float e = 0.7 * u_crop.w / u_size.y;              // about a pixel, for a soft edge
    float hole = smoothstep(yT - e, yT + e, p.y) * (1.0 - smoothstep(yB - e, yB + e, p.y));
    hole *= smoothstep(e, 3.0 * e, yB - yT);         // only once the lips have really parted
    c *= 1.0 - hole;
  }
  gl_FragColor = c;
}`;

class FaceWarp {
  constructor() {
    this.canvas = document.createElement('canvas');
    const gl = this.canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: true });
    this.ok = false;
    if (!gl) return;
    this.gl = gl;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const link = (fs) => {
      const pr = gl.createProgram();
      gl.attachShader(pr, sh(gl.VERTEX_SHADER, VERT));
      gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
      return pr;
    };
    let prog;
    try { prog = link(FRAG_HOLE); this.holes = true; } catch (err) { prog = link(FRAG); this.holes = false; } // phones without high precision: paint the mouth on top instead
    gl.useProgram(prog);
    this.prog = prog;
    // A fine grid over the whole photo.
    const C = 150, R = 200, verts = [], idx = []; // fine enough for crisp lip shapes (30k vertices)
    for (let j = 0; j <= R; j++) for (let i = 0; i <= C; i++) verts.push(i / C, j / R);
    for (let j = 0; j < R; j++) for (let i = 0; i < C; i++) {
      const a = j * (C + 1) + i, b = a + 1, c = a + C + 1, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
    this.count = idx.length;
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a_uv');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    this.u = {};
    ['u_seam', 'u_m', 'u_j', 'u_ub', 'u_s', 'u_e1', 'u_e2', 'u_crop', 'u_f', 'u_v', 'u_tex', 'u_size', 'u_hole', 'u_vlid'].forEach((n) => { this.u[n] = gl.getUniformLocation(prog, n); });
    this.src = null;
    this.ok = true;
  }

  render(src, P, st, crop, w, h) {
    const gl = this.gl;
    if (gl.isContextLost()) return null;
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    gl.viewport(0, 0, w, h);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    if (this.src !== src) { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); this.src = src; }
    const u = this.u, e = (i) => P.eyes[i] || { x: 0, y: 0, rx: 0, ry: 0 };
    gl.uniform3f(u.u_seam, P.a, P.b, P.c);
    gl.uniform4f(u.u_m, P.mx, P.mw, P.D, P.band);
    gl.uniform4f(u.u_j, P.jawCx, P.jawHalf, P.seamC, P.chinY);
    gl.uniform2f(u.u_ub, P.upperBand, P.lipThick);
    gl.uniform3f(u.u_s, st.open, st.wide, st.blink);
    gl.uniform4f(u.u_e1, e(0).x, e(0).y, e(0).rx, e(0).ry);
    gl.uniform4f(u.u_e2, e(1).x, e(1).y, e(1).rx, e(1).ry);
    gl.uniform4f(u.u_crop, crop.x, crop.y, crop.w, crop.h);
    gl.uniform4f(u.u_f, st.gx || 0, st.gy || 0, st.brow || 0, st.smile || 0);
    gl.uniform4f(u.u_v, st.round || 0, st.press || 0, st.fv || 0, st.tongue || 0);
    gl.uniform1i(u.u_tex, 0);
    if (u.u_size) gl.uniform2f(u.u_size, w, h);
    gl.uniform1f(u.u_vlid, this.holes ? 0 : 1);
    if (u.u_hole) gl.uniform1f(u.u_hole, st.open > 0.05 ? 1 : 0);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
    return this.canvas;
  }
}

let shared;
export function faceWarp() {
  if (shared === undefined) {
    try { shared = new FaceWarp(); if (!shared.ok) shared = null; } catch (err) { console.warn('Face warp unavailable', err); shared = null; }
  }
  return shared;
}

// Paints the inside of the mouth UNDER the photo (used when the photo can open itself):
// a generous dark area between the moved lip lines, a tongue, and teeth tucked up under the
// upper lip. The photo drawn on top decides what shows, so this never spills past the lips.
export function paintCavity(o, rig, P, st, toPx, look = 'holo') {
  const col = MOUTH_COLORS[look] || MOUTH_COLORS.holo;
  const up = rig.upper.map(([x, y]) => { const d = displace(P, x, y, st, 0); return toPx(x + d[0], y + d[1]); });
  const lo = rig.lower.map(([x, y]) => { const d = displace(P, x, y, st, 1); return toPx(x + d[0], y + d[1]); });
  const n = up.length, mid = Math.floor(n / 2);
  const lipPx = Math.abs(toPx(0, P.lipThick)[1] - toPx(0, 0)[1]);
  const up0 = rig.upper.map(([x, y]) => toPx(x, y)), lo0 = rig.lower.map(([x, y]) => toPx(x, y));
  const realTeeth = lo0[mid][1] - up0[mid][1] > Math.max(2, lipPx * 0.35); // the photo already shows its own teeth
  const pad = lipPx * 0.8 + 2;
  const top = up.map(([x, y]) => [x, y - pad]), bot = lo.map(([x, y]) => [x, y + pad]);
  const width = Math.abs(up[n - 1][0] - up[0][0]), gap = bot[mid][1] - top[mid][1];
  const path = new Path2D();
  path.moveTo(up[0][0] - pad, up[0][1]);
  top.forEach(([x, y]) => path.lineTo(x, y));
  path.lineTo(up[n - 1][0] + pad, up[n - 1][1]);
  bot.slice().reverse().forEach(([x, y]) => path.lineTo(x, y));
  path.closePath();
  o.save();
  const cx = (up[mid][0] + lo[mid][0]) / 2, cy = (up[mid][1] + lo[mid][1]) / 2;
  const g = o.createRadialGradient(cx, cy, 0, cx, cy, Math.max(width * 0.55, gap));
  g.addColorStop(0, col.deep); g.addColorStop(1, col.inside);
  o.fillStyle = g; o.fill(path); o.clip(path);
  const tg = st.tongue || 0, gh = Math.max(1, lo[mid][1] - up[mid][1]);
  o.fillStyle = col.tongue;
  o.beginPath();
  o.ellipse(lo[mid][0], lo[mid][1] - gh * (0.02 + 0.45 * tg), width * (0.3 - 0.06 * tg), gh * (0.3 + 0.15 * tg) + 1, 0, 0, Math.PI * 2);
  o.fill();
  if (!realTeeth) { // upper teeth, tucked up under the upper lip
    const th = Math.min(gh * 0.42, width * 0.11) + pad;
    const i0 = Math.round((n - 1) * 0.16), i1 = Math.round((n - 1) * 0.84);
    o.beginPath();
    o.moveTo(top[i0][0], top[i0][1]);
    for (let i = i0 + 1; i <= i1; i++) o.lineTo(top[i][0], top[i][1]);
    for (let i = i1; i >= i0; i--) { const s = Math.sin(((i - i0) / (i1 - i0)) * Math.PI); o.lineTo(top[i][0], top[i][1] + th * (0.5 + 0.5 * s)); }
    o.closePath();
    o.fillStyle = col.teeth; o.fill();
    const tgr = o.createLinearGradient(0, up[mid][1], 0, up[mid][1] + gh * 0.42);
    tgr.addColorStop(0, 'rgba(0,0,0,0.35)'); tgr.addColorStop(0.4, 'rgba(0,0,0,0)');
    o.fillStyle = tgr; o.fill();
    if (st.open > 0.42) { // lower teeth on big vowels
      o.fillStyle = col.lowTeeth;
      o.beginPath();
      o.moveTo(bot[i0][0], bot[i0][1]);
      for (let i = i0 + 1; i <= i1; i++) o.lineTo(bot[i][0], bot[i][1]);
      for (let i = i1; i >= i0; i--) { const s = Math.sin(((i - i0) / (i1 - i0)) * Math.PI); o.lineTo(bot[i][0], bot[i][1] - (pad + gh * 0.16 * Math.min(1, (st.open - 0.42) * 3)) * s); }
      o.closePath(); o.fill();
    }
  }
  o.restore();
}
// f/v without a gap: the top teeth rest on the lower lip (drawn over the photo).
export function paintFvTeeth(o, rig, P, st, toPx, look = 'holo') {
  if ((st.fv || 0) <= 0.25) return;
  const col = MOUTH_COLORS[look] || MOUTH_COLORS.holo;
  const up = rig.upper.map(([x, y]) => { const d = displace(P, x, y, st, 0); return toPx(x + d[0], y + d[1]); });
  const lo0 = rig.lower.map(([x, y]) => toPx(x, y)), up0 = rig.upper.map(([x, y]) => toPx(x, y));
  const n = up.length, mid = Math.floor(n / 2);
  const lipPx = Math.abs(toPx(0, P.lipThick)[1] - toPx(0, 0)[1]);
  if (lo0[mid][1] - up0[mid][1] > Math.max(2, lipPx * 0.35)) return; // the photo shows its own teeth
  const h = Math.max(1.5, lipPx * 0.5), i0 = Math.round((n - 1) * 0.25), i1 = Math.round((n - 1) * 0.75);
  o.save(); o.globalAlpha = Math.min(1, (st.fv - 0.25) * 2);
  o.beginPath(); o.moveTo(up[i0][0], up[i0][1]);
  for (let i = i0 + 1; i <= i1; i++) o.lineTo(up[i][0], up[i][1]);
  for (let i = i1; i >= i0; i--) { const s = Math.sin(((i - i0) / (i1 - i0)) * Math.PI); o.lineTo(up[i][0], up[i][1] + h * s); }
  o.closePath(); o.fillStyle = col.teeth; o.fill(); o.restore();
}

// Fallback (no derivatives): paints the inside of the mouth between the person's own (moved) lips: shaded
// cavity, upper and lower teeth, a tongue that lifts for l/t/d/n/th, and teeth
// resting on the lower lip for f/v.
const MOUTH_COLORS = {
  holo: { deep: '#000305', inside: '#02121A', tongue: 'rgba(46, 128, 148, 0.6)', teeth: 'rgba(214, 250, 255, 0.82)', gaps: 'rgba(0, 30, 40, 0.35)', lowTeeth: 'rgba(214, 250, 255, 0.4)' },
  real: { deep: '#1A0708', inside: '#4A1A1C', tongue: 'rgba(176, 78, 86, 0.85)', teeth: 'rgba(246, 241, 230, 0.95)', gaps: 'rgba(120, 100, 90, 0.35)', lowTeeth: 'rgba(236, 228, 214, 0.6)' },
};
export function paintMouth(o, rig, P, st, toPx, look = 'holo', drawPhoto = null) {
  const col = MOUTH_COLORS[look] || MOUTH_COLORS.holo;
  const up = rig.upper.map(([x, y]) => { const d = displace(P, x, y, st, 0); return toPx(x + d[0], y + d[1]); });
  const lo = rig.lower.map(([x, y]) => { const d = displace(P, x, y, st, 1); return toPx(x + d[0], y + d[1]); });
  const n = up.length, mid = Math.floor(n / 2);
  // Taper the opening into the mouth corners so it never spills past the lips.
  const pinch = (a, b) => { for (let i = 0; i < n; i++) {
    const k = Math.min(1, Math.sin((i / (n - 1)) * Math.PI) * 1.5);
    const mx = (a[i][0] + b[i][0]) / 2, my = (a[i][1] + b[i][1]) / 2;
    a[i] = [mx + (a[i][0] - mx) * k, my + (a[i][1] - my) * k]; b[i] = [mx + (b[i][0] - mx) * k, my + (b[i][1] - my) * k];
  } };
  pinch(up, lo);
  const width = Math.abs(up[n - 1][0] - up[0][0]);
  const gap = lo[mid][1] - up[mid][1];
  const lipPx = Math.abs(toPx(0, P.lipThick)[1] - toPx(0, 0)[1]);
  // If the photo already shows teeth (mouth open in the picture), keep the real ones.
  const up0 = rig.upper.map(([x, y]) => toPx(x, y)), lo0 = rig.lower.map(([x, y]) => toPx(x, y));
  pinch(up0, lo0);
  const gap0 = lo0[mid][1] - up0[mid][1];
  const realTeeth = drawPhoto && gap0 > Math.max(2, lipPx * 0.35);
  const i0 = Math.round((n - 1) * 0.14), i1 = Math.round((n - 1) * 0.86); // teeth sit in the middle, not out to the corners
  const upperTeeth = (h) => {
    o.beginPath();
    o.moveTo(up[i0][0], up[i0][1] - 1);
    for (let i = i0 + 1; i <= i1; i++) o.lineTo(up[i][0], up[i][1] - 1);
    for (let i = i1; i >= i0; i--) { const s = Math.sin(((i - i0) / (i1 - i0)) * Math.PI); o.lineTo(up[i][0], up[i][1] + h * (0.35 + 0.65 * s)); }
    o.closePath();
  };
  const teethFill = (h) => {
    const g = o.createLinearGradient(0, up[mid][1], 0, up[mid][1] + h);
    g.addColorStop(0, 'rgba(0,0,0,0.35)'); g.addColorStop(0.35, 'rgba(0,0,0,0)');
    return g;
  };
  if ((st.fv || 0) > 0.25 && gap < lipPx * 1.2 && !realTeeth) {
    o.save();
    o.globalAlpha = Math.min(1, (st.fv - 0.25) * 2);
    upperTeeth(Math.max(1.5, lipPx * 0.6));
    o.fillStyle = col.teeth; o.fill(); o.fillStyle = teethFill(lipPx * 0.6); o.fill();
    o.restore();
    if (gap < 1) return;
  }
  if (gap < 0.8) return;
  const path = new Path2D();
  path.moveTo(up[0][0], up[0][1]);
  for (let i = 1; i < n; i++) path.lineTo(up[i][0], up[i][1]);
  for (let i = n - 1; i >= 0; i--) path.lineTo(lo[i][0], lo[i][1]);
  path.closePath();
  o.save();
  const cx = (up[mid][0] + lo[mid][0]) / 2, cy = (up[mid][1] + lo[mid][1]) / 2;
  const g = o.createRadialGradient(cx, cy, 0, cx, cy, Math.max(width * 0.5, gap));
  g.addColorStop(0, col.deep); g.addColorStop(1, col.inside);
  o.fillStyle = g;
  o.fill(path);
  o.clip(path);
  const tg = st.tongue || 0;
  o.fillStyle = col.tongue;
  o.beginPath();
  o.ellipse(lo[mid][0], lo[mid][1] - gap * (0.05 + 0.45 * tg), width * (0.32 - 0.08 * tg), gap * (0.32 + 0.12 * tg), 0, 0, Math.PI * 2);
  o.fill();
  const th = Math.min(gap * 0.4, width * 0.11, lipPx * 1.1 + 2);
  if (realTeeth) { // the photo's own teeth stay where they were (the upper jaw doesn't move)
    const g0 = new Path2D(); g0.moveTo(up0[0][0], up0[0][1]);
    for (let i = 1; i < n; i++) g0.lineTo(up0[i][0], up0[i][1]);
    for (let i = n - 1; i >= 0; i--) g0.lineTo(lo0[i][0], lo0[i][1]);
    g0.closePath();
    o.save(); o.translate(0, Math.min(0, up[mid][1] - up0[mid][1])); o.clip(g0); drawPhoto(); o.restore(); // rides up with the lip
  } else {
    upperTeeth(th);
    o.fillStyle = col.teeth; o.fill(); o.fillStyle = teethFill(th); o.fill();
    o.strokeStyle = col.gaps; o.lineWidth = Math.max(0.5, width * 0.004);
    for (const f of [0.42, 0.5, 0.58]) {
      const i = Math.round(f * (n - 1));
      o.beginPath(); o.moveTo(up[i][0], up[i][1]); o.lineTo(up[i][0], up[i][1] + th * 0.8); o.stroke();
    }
  }
  if (st.open > 0.42 && !realTeeth) {
    const lt = th * (realTeeth ? 0.35 : 0.55) * Math.min(1, (st.open - 0.42) * 3);
    o.fillStyle = col.lowTeeth;
    o.beginPath();
    o.moveTo(lo[0][0], lo[0][1]);
    for (let i = 1; i < n; i++) o.lineTo(lo[i][0], lo[i][1]);
    for (let i = n - 1; i >= 0; i--) { const s = Math.sin((i / (n - 1)) * Math.PI); o.lineTo(lo[i][0], lo[i][1] - lt * s); }
    o.closePath(); o.fill();
  }
  // soft shade just inside the lips (no hard outline)
  o.save(); o.shadowColor = 'rgba(0,0,0,0.55)'; o.shadowBlur = Math.max(2, Math.min(gap, lipPx) * 0.7);
  o.strokeStyle = 'rgba(0, 0, 0, 0.12)'; o.lineWidth = 1;
  o.stroke(path); o.restore();
  o.restore();
}

// The face's outline (forehead, cheeks, jaw, chin) in photo fractions, moving with the jaw.
export function faceOutline(rig, P, st) {
  let pts = rig.oval;
  if (!pts?.length) {
    const top = rig.top || { y: rig.ui.y - (rig.chin.y - rig.ui.y) * 2.6 };
    const cx = (rig.jl.x + rig.jr.x) / 2, cy = (top.y + rig.chin.y) / 2;
    const a = Math.abs(rig.jr.x - rig.jl.x) / 2 * 1.05, bt = cy - top.y, bb = rig.chin.y - cy;
    pts = [];
    for (let k = 0; k < 40; k++) {
      const th = (k / 40) * Math.PI * 2, c = Math.cos(th), s = Math.sin(th);
      const lower = s > 0;
      const ex = lower ? 2.4 : 2.1; // squarer forehead, rounder jaw
      const xr = a * Math.sign(c) * Math.pow(Math.abs(c), 2 / ex) * (lower ? 1 - 0.28 * s * s : 1);
      const yr = (lower ? bb : bt) * Math.sign(s) * Math.pow(Math.abs(s), 2 / ex);
      pts.push([cx + xr, cy + yr]);
    }
  }
  return pts.map(([x, y]) => { const d = displace(P, x, y, st); return [x + d[0], y + d[1]]; });
}
