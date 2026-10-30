// Maps the tutor's face photo: builds a "face rig" (mouth corners, inner and
// outer lips, chin, jaw, forehead and both eyes) as fractions of the image.
// First choice: MediaPipe Face Landmarker (478 points, runs on the device).
// Fallback: Claude marks the points from the photo. Last resort: a tap on the mouth.
const MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MP_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
let landmarkerP = null;

function getLandmarker() {
  if (!landmarkerP) {
    landmarkerP = (async () => {
      const vision = await import(`${MP}/vision_bundle.mjs`);
      const files = await vision.FilesetResolver.forVisionTasks(`${MP}/wasm`);
      return vision.FaceLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: MP_MODEL },
        runningMode: 'IMAGE',
        numFaces: 1,
      });
    })();
    landmarkerP.catch(() => { landmarkerP = null; });
  }
  return landmarkerP;
}

// MediaPipe face-mesh indices: inner lip outline, left corner to right corner.
const UPPER_IN = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308];
const LOWER_IN = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308];

export async function landmarkFace(image) {
  try {
    const lm = await getLandmarker();
    const face = lm.detect(image).faceLandmarks?.[0];
    return face ? rigFromLandmarks(face) : null;
  } catch (err) {
    console.warn('Face landmarks unavailable', err);
    return null;
  }
}

// Face outline, clockwise from the forehead; the forehead points are pushed up a
// little so the hairline isn't cut off.
const FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
function expandFrom(f, i) {
  const cx = (f[234].x + f[454].x) / 2, cy = (f[10].y + f[152].y) / 2;
  const up = f[i].y < cy ? 1.1 : 1.02;
  return [cx + (f[i].x - cx) * 1.03, cy + (f[i].y - cy) * up];
}
export function rigFromLandmarks(f) {
  const p = (i) => ({ x: f[i].x, y: f[i].y });
  const eye = (a, b, t, bt) => ({ x: (f[a].x + f[b].x) / 2, y: (f[t].y + f[bt].y) / 2, rx: Math.abs(f[a].x - f[b].x) / 2, ry: Math.max(Math.abs(f[bt].y - f[t].y) / 2, 0.002) });
  return {
    v: 2, how: 'auto',
    ml: p(61), mr: p(291), uo: p(0), ui: p(13), li: p(14), lo: p(17),
    upper: UPPER_IN.map((i) => [f[i].x, f[i].y]),
    lower: LOWER_IN.map((i) => [f[i].x, f[i].y]),
    chin: p(152), jl: p(234), jr: p(454), top: p(10),
    oval: FACE_OVAL.map((i) => expandFrom(f, i)),
    eyes: [eye(33, 133, 159, 145), eye(362, 263, 386, 374)],
  };
}

// 11 points along a curve through the two mouth corners and a middle point.
function lipCurve(l, m, r, n = 11) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    // quadratic Bézier passing through m at t = 0.5
    const cx = 2 * m.x - (l.x + r.x) / 2, cy = 2 * m.y - (l.y + r.y) / 2;
    out.push([(1 - t) * (1 - t) * l.x + 2 * (1 - t) * t * cx + t * t * r.x, (1 - t) * (1 - t) * l.y + 2 * (1 - t) * t * cy + t * t * r.y]);
  }
  return out;
}

export const FACE_PROMPT = 'Find the main person\'s face in this photo and mark these points. ' +
  'Coordinates are fractions from 0 to 1 of the image width (x, from the left edge) and height (y, from the top edge). "left" and "right" mean as seen in the image. ' +
  'Reply with JSON only, no other text: ' +
  '{"found":true,"mouth":{"left_corner":{"x":0,"y":0},"right_corner":{"x":0,"y":0},"upper_lip_top":{"x":0,"y":0},"upper_lip_bottom":{"x":0,"y":0},"lower_lip_top":{"x":0,"y":0},"lower_lip_bottom":{"x":0,"y":0}},' +
  '"chin":{"x":0,"y":0},"face_left":{"x":0,"y":0},"face_right":{"x":0,"y":0},"forehead_top":{"x":0,"y":0},' +
  '"left_eye":{"outer_corner":{"x":0,"y":0},"inner_corner":{"x":0,"y":0},"top_lid":{"x":0,"y":0},"bottom_lid":{"x":0,"y":0}},' +
  '"right_eye":{"outer_corner":{"x":0,"y":0},"inner_corner":{"x":0,"y":0},"top_lid":{"x":0,"y":0},"bottom_lid":{"x":0,"y":0}}} ' +
  'upper_lip_bottom and lower_lip_top are the middle of the line where the lips meet (the same point if the mouth is closed). ' +
  'Also add "upper_inner" and "lower_inner" inside "mouth": 5 points each, left to right, tracing the inner edge of the upper lip and of the lower lip from corner to corner (on a smile with teeth showing, the edges where lips meet teeth). ' +
  'face_left and face_right are the edges of the face at mouth height. If there is no clear face, reply {"found":false}.';

// The traced inner lip edge (5 points, corner to corner) resampled to 11 points; a smooth curve if missing.
function traced(pts, l, m, r, n = 11) {
  const okp = Array.isArray(pts) ? pts.filter((p) => ok(p)).map(P).sort((a, b) => a.x - b.x) : [];
  if (okp.length < 3) return lipCurve(l, m, r, n);
  const line = [l, ...okp.filter((p) => p.x > l.x && p.x < r.x), r];
  const out = [];
  for (let i = 0; i < n; i++) {
    const x = l.x + ((r.x - l.x) * i) / (n - 1);
    let k = 0; while (k < line.length - 2 && line[k + 1].x < x) k++;
    const a = line[k], b = line[k + 1], t = b.x > a.x ? (x - a.x) / (b.x - a.x) : 0;
    out.push([x, a.y + (b.y - a.y) * t]);
  }
  return out;
}
const ok = (p) => p && Number.isFinite(+p.x) && Number.isFinite(+p.y) && +p.x >= 0 && +p.x <= 1 && +p.y >= 0 && +p.y <= 1;
const P = (p) => ({ x: +p.x, y: +p.y });

export function rigFromPoints(j) {
  if (!j || !j.found || !j.mouth) return null;
  const m = j.mouth;
  if (!ok(m.left_corner) || !ok(m.right_corner)) return null;
  let ml = P(m.left_corner), mr = P(m.right_corner);
  if (ml.x > mr.x) [ml, mr] = [mr, ml];
  const w = mr.x - ml.x;
  if (w < 0.02 || w > 0.7) return null;
  const mid = { x: (ml.x + mr.x) / 2, y: (ml.y + mr.y) / 2 };
  const ui = ok(m.upper_lip_bottom) ? P(m.upper_lip_bottom) : mid;
  let li = ok(m.lower_lip_top) ? P(m.lower_lip_top) : ui;
  if (li.y < ui.y) li = { ...ui };
  const uo = ok(m.upper_lip_top) && m.upper_lip_top.y < ui.y ? P(m.upper_lip_top) : { x: ui.x, y: ui.y - w * 0.18 };
  const lo = ok(m.lower_lip_bottom) && m.lower_lip_bottom.y > li.y ? P(m.lower_lip_bottom) : { x: li.x, y: li.y + w * 0.22 };
  const chin = ok(j.chin) && j.chin.y > lo.y ? P(j.chin) : { x: mid.x, y: lo.y + w * 0.9 };
  const jl = ok(j.face_left) && j.face_left.x < ml.x ? P(j.face_left) : { x: ml.x - w * 0.75, y: mid.y };
  const jr = ok(j.face_right) && j.face_right.x > mr.x ? P(j.face_right) : { x: mr.x + w * 0.75, y: mid.y };
  const top = ok(j.forehead_top) && j.forehead_top.y < mid.y ? P(j.forehead_top) : null;
  const eyes = [j.left_eye, j.right_eye].map((e) => {
    if (!e || !ok(e.outer_corner) || !ok(e.inner_corner)) return null;
    const a = P(e.outer_corner), b = P(e.inner_corner);
    const t = ok(e.top_lid) ? P(e.top_lid) : null, bt = ok(e.bottom_lid) ? P(e.bottom_lid) : null;
    const rx = Math.abs(a.x - b.x) / 2;
    const y = t && bt ? (t.y + bt.y) / 2 : (a.y + b.y) / 2;
    const ry = t && bt ? Math.max(Math.abs(bt.y - t.y) / 2, 0.003) : rx * 0.35;
    if (rx < 0.005 || rx > 0.2 || y >= ui.y) return null;
    return { x: (a.x + b.x) / 2, y, rx, ry };
  }).filter(Boolean);
  return { v: 2, how: 'ai', ml, mr, uo, ui, li, lo, upper: traced(m.upper_inner, ml, ui, mr), lower: traced(m.lower_inner, ml, li, mr), chin, jl, jr, top, eyes };
}

// A rough rig from just the mouth position (a tap, or an old saved mouth spot).
export function rigFromMouth(m, aspect = 0.75) {
  const x = m?.x ?? 0.5, y = m?.y ?? 0.7, w = m?.w ?? 0.22;
  const hY = (w / 2) * aspect; // half mouth width, in height units
  const ml = { x: x - w / 2, y }, mr = { x: x + w / 2, y };
  const ui = { x, y: y - 0.002 }, li = { x, y: y + 0.002 };
  return {
    v: 2, how: m?.how === 'manual' ? 'manual' : 'guess',
    ml, mr, ui, li, uo: { x, y: y - hY * 0.35 }, lo: { x, y: y + hY * 0.45 },
    upper: lipCurve(ml, { x, y: y - 0.004 }, mr), lower: lipCurve(ml, { x, y: y + 0.004 }, mr),
    chin: { x, y: y + hY * 2.1 }, jl: { x: x - w * 1.15, y }, jr: { x: x + w * 1.15, y }, top: { x, y: Math.max(0, y - hY * 5.2) },
    eyes: [],
  };
}

// Moves the mouth (lips and chin) so the middle of the lips lands on (nx, ny).
export function moveMouth(rig, nx, ny) {
  const cx = (rig.ui.x + rig.li.x) / 2, cy = (rig.ui.y + rig.li.y) / 2;
  const dx = nx - cx, dy = ny - cy;
  const mv = (p) => ({ x: p.x + dx, y: p.y + dy });
  return {
    ...rig, how: 'manual',
    ml: mv(rig.ml), mr: mv(rig.mr), ui: mv(rig.ui), li: mv(rig.li), uo: mv(rig.uo), lo: mv(rig.lo), chin: mv(rig.chin),
    upper: rig.upper.map(([x, y]) => [x + dx, y + dy]), lower: rig.lower.map(([x, y]) => [x + dx, y + dy]),
  };
}

export const isRig = (r) => r && r.v === 2 && r.ml && r.mr && Array.isArray(r.upper);

// Adds eyes when the rig has none (a tapped mouth, an older save, or a miss):
// estimates them from the mouth with typical face proportions, then snaps each
// one to the darkest spot nearby (the pupil) when the photo shows one clearly.
export function completeRig(rig, img) {
  if (!rig || rig.eyes?.length === 2) return rig;
  const iw = img?.width || 480, ih = img?.height || 640;
  const mx = ((rig.ml.x + rig.mr.x) / 2) * iw, my = ((rig.ui.y + rig.li.y) / 2) * ih;
  const mwp = Math.max(8, Math.abs(rig.mr.x - rig.ml.x) * iw); // mouth width in pixels
  const est = [-1, 1].map((side) => ({ x: mx + side * 0.63 * mwp, y: my - 1.42 * mwp }));
  let data = null;
  try { if (img?.getContext) data = img.getContext('2d').getImageData(0, 0, iw, ih).data; } catch {}
  const eyes = est.map((e) => {
    let { x, y } = e;
    if (data) {
      const r = Math.round(mwp * 0.32), rv = Math.round(mwp * 0.26);
      const lum = [];
      for (let yy = Math.max(0, Math.round(y - rv)); yy < Math.min(ih, Math.round(y + rv)); yy += 2)
        for (let xx = Math.max(0, Math.round(x - r)); xx < Math.min(iw, Math.round(x + r)); xx += 2) {
          const i = (yy * iw + xx) * 4;
          lum.push([0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2], xx, yy]);
        }
      if (lum.length > 20) {
        lum.sort((a, b) => a[0] - b[0]);
        const n = Math.max(4, Math.round(lum.length * 0.05));
        const dark = lum.slice(0, n), median = lum[Math.floor(lum.length / 2)][0];
        const avg = dark.reduce((s, d) => s + d[0], 0) / n;
        if (median - avg > 40) { x = dark.reduce((s, d) => s + d[1], 0) / n; y = dark.reduce((s, d) => s + d[2], 0) / n; }
      }
    }
    const rx = 0.27 * mwp;
    return { x: x / iw, y: y / ih, rx: rx / iw, ry: (rx * 0.5) / ih };
  });
  if (eyes[0].x > eyes[1].x) eyes.reverse();
  const top = rig.top || { x: mx / iw, y: Math.max(0, (my - 3.3 * mwp) / ih) };
  return { ...rig, eyes, top };
}
