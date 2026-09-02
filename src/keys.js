/*
 * keys.js — SVG key-shape primitives for woodwind/brass fingering charts.
 *
 * Every key on every instrument is drawn by one of these shape functions.
 * A shape function receives a resolved key object (geometry + state) and
 * returns an SVG fragment string.
 *
 * Geometry convention: x,y is always the CENTRE of the shape.
 */

let uid = 0;
const nextId = (p) => `${p}-${(uid++).toString(36)}`;

export const INK = 'var(--fc-ink, #2b3a45)';
export const LINE = 'var(--fc-line, #2b3a45)';
export const PAPER = 'var(--fc-paper, #ffffff)';

/* ------------------------------------------------------------------ */
/* States                                                              */
/* ------------------------------------------------------------------ */
/*
 * open        outline only — hole uncovered / key not pressed
 * closed      solid fill — hole covered / key pressed
 * half        half covered (recorder & whistle half-holing, thumb pinch)
 * quarter     a quarter covered (fine thumb pinch)
 * three-q     three-quarters covered
 * ring        ring/plateau touched but hole stays open (clarinet, open-hole flute)
 * optional    dashed — may be added, e.g. tuning or stability keys
 * alt         hatched — alternate/secondary fingering member
 * trill       small caret above the key — flick/trill action
 * na          not present on this instrument variant — drawn ghosted or skipped
 */
export const STATES = [
  'open', 'closed', 'half', 'quarter', 'three-q',
  'ring', 'optional', 'alt', 'trill', 'na',
];

const FILL_FRACTION = { half: 0.5, quarter: 0.25, 'three-q': 0.75 };

function strokeFor(state) {
  if (state === 'optional') return `stroke="${LINE}" stroke-width="1.1" stroke-dasharray="2.4 1.8"`;
  if (state === 'na') return `stroke="${LINE}" stroke-width="0.8" stroke-opacity="0.22"`;
  return `stroke="${LINE}" stroke-width="1.1"`;
}

/* Wraps a geometry element so it can be partially filled by clipping. */
function partial(geomOpen, geomFilled, box, fraction, from) {
  const id = nextId('clip');
  const [x, y, w, h] = box;
  let r;
  switch (from) {
    case 'top':   r = `x="${x}" y="${y}" width="${w}" height="${h * fraction}"`; break;
    case 'left':  r = `x="${x}" y="${y}" width="${w * fraction}" height="${h}"`; break;
    case 'right': r = `x="${x + w * (1 - fraction)}" y="${y}" width="${w * fraction}" height="${h}"`; break;
    default:      r = `x="${x}" y="${y + h * (1 - fraction)}" width="${w}" height="${h * fraction}"`;
  }
  return `<defs><clipPath id="${id}"><rect ${r}/></clipPath></defs>`
       + `${geomOpen}<g clip-path="url(#${id})">${geomFilled}</g>`;
}

const HATCH_ID = 'fc-hatch';
export const DEFS = `<defs><pattern id="${HATCH_ID}" width="3" height="3" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><line x1="0" y1="0" x2="0" y2="3" stroke="${LINE}" stroke-width="1.4"/></pattern></defs>`;

function fillFor(state) {
  if (state === 'closed') return INK;
  if (state === 'alt') return `url(#${HATCH_ID})`;
  return 'none';
}

/* Builds the standard open/closed/partial treatment for any geometry. */
function paint(state, box, geom, fillDir) {
  const stroke = strokeFor(state);
  if (state === 'na') return geom(`fill="none" ${stroke}`);
  if (state === 'ring') {
    // touched but open: heavy outer ring, thin inner echo
    return geom(`fill="none" stroke="${LINE}" stroke-width="3"`)
         + geom(`fill="${PAPER}" stroke="none"`, 0.42);
  }
  const frac = FILL_FRACTION[state];
  if (frac) {
    return partial(
      geom(`fill="none" ${stroke}`),
      geom(`fill="${INK}" stroke="none"`),
      box, frac, fillDir || 'bottom',
    );
  }
  return geom(`fill="${fillFor(state)}" ${stroke}`);
}

/* ------------------------------------------------------------------ */
/* Shape primitives                                                    */
/* ------------------------------------------------------------------ */

/** Round tone hole or pearl touchpiece. Sax/flute/clarinet stacks, recorder holes. */
export function circle(k) {
  const r = k.r ?? 9;
  const geom = (attr, shrink = 1) =>
    `<circle cx="${k.x}" cy="${k.y}" r="${r * shrink}" ${attr}/>`;
  return paint(k.state, [k.x - r, k.y - r, r * 2, r * 2], geom, k.fillFrom);
}

/** Ellipse. Bis key, side keys, rollers, small auxiliary touchpieces. */
export function oval(k) {
  const rx = k.rx ?? 7, ry = k.ry ?? 4;
  const geom = (attr, shrink = 1) =>
    `<ellipse cx="${k.x}" cy="${k.y}" rx="${rx * shrink}" ry="${ry * shrink}" ${attr}/>`;
  return paint(k.state, [k.x - rx, k.y - ry, rx * 2, ry * 2], geom, k.fillFrom);
}

/** Rounded rectangle. Palm keys, side keys, trill keys, thumb plates. */
export function pill(k) {
  const w = k.w ?? 8, h = k.h ?? 16;
  const rad = k.rad ?? Math.min(w, h) / 2;
  const geom = (attr, shrink = 1) => {
    const ww = w * shrink, hh = h * shrink;
    return `<rect x="${k.x - ww / 2}" y="${k.y - hh / 2}" width="${ww}" height="${hh}" rx="${rad * shrink}" ${attr}/>`;
  };
  return paint(k.state, [k.x - w / 2, k.y - h / 2, w, h], geom, k.fillFrom);
}

/** Long thin bar. Clarinet lever bars, flute Bb bar, low-B footjoint. */
export function bar(k) {
  return pill({ ...k, w: k.w ?? 20, h: k.h ?? 5 });
}

/** Pinky spatula / paddle. Sax LH table + RH Eb-C, clarinet & flute levers. */
export function spatula(k) {
  return pill({ ...k, w: k.w ?? 15, h: k.h ?? 13, rad: k.rad ?? 4 });
}

/** Small stemmed lever — side/trill levers where the stem shows articulation. */
export function lever(k) {
  const w = k.w ?? 6, h = k.h ?? 12, sl = k.stem ?? 7;
  const dir = k.stemDir ?? 'left';
  const sx = dir === 'left' ? k.x - w / 2 - sl : k.x + w / 2;
  const stem = `<line x1="${sx}" y1="${k.y}" x2="${dir === 'left' ? k.x - w / 2 : k.x + w / 2 + sl}" y2="${k.y}" stroke="${LINE}" stroke-width="1.1"/>`;
  return stem + pill({ ...k, w, h });
}

/** Rocker for paired rollers (sax low C#/B/Bb, bass clarinet). */
export function roller(k) {
  return oval({ ...k, rx: k.rx ?? 6, ry: k.ry ?? 3.2 });
}

/**
 * Teardrop / pear touchpiece — sax palm keys, and any lever with a bulb at one
 * end tapering to a point. Tip points UP by default; use `dir` (up/right/down/
 * left) or `rot` to aim it. `w` is the bulb diameter, `h` the overall length,
 * `tipRound` how blunt the point is.
 */
export function teardrop(k) {
  const w = k.w ?? 11, h = k.h ?? 20;
  const path = (s = 1) => dropPath(k.x, k.y, w * s, h * s, (k.tipRound ?? 1.6) * s);
  const geom = (attr, s = 1) => `<path d="${path(s)}" ${attr}/>`;
  return paint(k.state, [k.x - w / 2, k.y - h / 2, w, h], geom, k.fillFrom);
}

function dropPath(cx, cy, w, h, tipRound) {
  const R = w / 2;
  const Cy = cy + h / 2 - R;          // bulb centre
  const Py = cy - h / 2;              // apex
  const d = Cy - Py;                  // apex distance from bulb centre
  const n = (v) => Math.round(v * 100) / 100;
  if (d <= R * 1.05) {                // too stubby to taper — draw the bulb
    return `M ${n(cx - R)} ${n(cy)} a ${n(R)} ${n(R)} 0 1 0 ${n(R * 2)} 0 a ${n(R)} ${n(R)} 0 1 0 ${n(-R * 2)} 0 Z`;
  }
  const a = Math.acos(R / d);         // half-angle to the tangent points
  const tx = R * Math.sin(a), ty = R * Math.cos(a);
  const T1 = [cx + tx, Cy - ty];      // right tangent point
  const T2 = [cx - tx, Cy - ty];      // left tangent point
  // back off along each straight edge so the apex can be rounded
  const back = Math.min(tipRound, d * 0.3);
  const len = Math.hypot(T1[0] - cx, T1[1] - Py);
  const f = back / len;
  const P1 = [cx + (T1[0] - cx) * f, Py + (T1[1] - Py) * f];
  const P2 = [cx + (T2[0] - cx) * f, Py + (T2[1] - Py) * f];
  return `M ${n(T2[0])} ${n(T2[1])} L ${n(P2[0])} ${n(P2[1])}`
       + ` Q ${n(cx)} ${n(Py)} ${n(P1[0])} ${n(P1[1])}`
       + ` L ${n(T1[0])} ${n(T1[1])}`
       + ` A ${n(R)} ${n(R)} 0 1 1 ${n(T2[0])} ${n(T2[1])} Z`;
}

export const SHAPES = { circle, oval, pill, bar, spatula, lever, roller, teardrop, drop: teardrop };

/** Unrotated width/height of a key — used for alignment and relative placement. */
export function bbox(k) {
  switch (k.shape) {
    case 'circle': { const r = k.r ?? 9; return [r * 2, r * 2]; }
    case 'oval': { const rx = k.rx ?? 6.5, ry = k.ry ?? 3.8; return [rx * 2, ry * 2]; }
    case 'roller': { const rx = k.rx ?? 6, ry = k.ry ?? 3.2; return [rx * 2, ry * 2]; }
    case 'bar': return [k.w ?? 20, k.h ?? 5];
    case 'spatula': return [k.w ?? 15, k.h ?? 13];
    case 'lever': return [k.w ?? 6, k.h ?? 12];
    case 'teardrop': case 'drop': return [k.w ?? 11, k.h ?? 20];
    default: return [k.w ?? 8, k.h ?? 16];
  }
}

/** Compass directions for shapes that have a point or a stem. */
export const DIR_ROT = { up: 0, 'up-right': 45, right: 90, 'down-right': 135, down: 180, 'down-left': -135, left: -90, 'up-left': -45 };

/** Draw one key. Unknown shapes fall back to a circle so a chart never breaks. */
export function drawKey(k) {
  if (k.state === 'na' && k.hideWhenNA !== false) return '';
  const fn = SHAPES[k.shape] || circle;
  let out = fn(k);
  if (k.state === 'trill') {
    out += `<path d="M ${k.x - 3} ${k.y - (k.r ?? k.h ?? 9) - 3} l 3 -3.4 l 3 3.4" fill="none" stroke="${LINE}" stroke-width="1.1" stroke-linecap="round"/>`;
  }
  const rot = (k.rot || 0) + (DIR_ROT[k.dir] ?? 0);
  if (rot) {
    out = `<g transform="rotate(${rot} ${k.x} ${k.y})">${out}</g>`;
  }
  return out;
}
