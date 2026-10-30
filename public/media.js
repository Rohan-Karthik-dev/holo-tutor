// Holo Tutor — reference pictures from Wikipedia / Wikimedia Commons (free,
// no key needed), and a check for light-background diagrams so they can be
// flipped to light-on-dark for the hologram.
const cache = new Map();

export const wikiSearchUrl = (q) => 'https://en.wikipedia.org/w/index.php?search=' + encodeURIComponent(q);

// Returns { src, title, page, width, height } or null.
export async function findImage(query) {
  const q = String(query || '').trim().slice(0, 100);
  if (!q) return null;
  if (cache.has(q)) return cache.get(q);
  const p = (async () => {
    const url = 'https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=0&gsrlimit=6'
      + '&prop=pageimages|info&piprop=thumbnail&pithumbsize=960&inprop=url&gsrsearch=' + encodeURIComponent(q);
    const r = await fetch(url);
    if (!r.ok) return null;
    const pages = Object.values((await r.json())?.query?.pages || {}).sort((a, b) => (a.index || 0) - (b.index || 0));
    const hit = pages.find((pg) => pg.thumbnail?.source && pg.thumbnail.width >= 180 && !/flag_of|coat_of_arms|logo|icon/i.test(pg.thumbnail.source));
    if (!hit) return null;
    return { src: hit.thumbnail.source, width: hit.thumbnail.width, height: hit.thumbnail.height, title: hit.title, page: hit.fullurl || 'https://en.wikipedia.org/wiki/' + encodeURIComponent(hit.title) };
  })().catch(() => null);
  cache.set(q, p);
  return p;
}

// Loads an image (CORS-enabled) and reports whether its edges are mostly light,
// i.e. a diagram on a white page.
export function loadRefImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => {
      let light = false;
      try {
        const c = document.createElement('canvas'); c.width = 24; c.height = 24;
        const x = c.getContext('2d'); x.drawImage(img, 0, 0, 24, 24);
        const d = x.getImageData(0, 0, 24, 24).data;
        let sum = 0, n = 0;
        for (let yy = 0; yy < 24; yy++) for (let xx = 0; xx < 24; xx++) {
          if (xx > 2 && xx < 21 && yy > 2 && yy < 21) continue; // border pixels only
          const i = (yy * 24 + xx) * 4; sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; n++;
        }
        light = sum / n > 205;
      } catch {}
      resolve({ img, light });
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
