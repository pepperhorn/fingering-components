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

export const INK = 'var(--fc-ink, #16212b)';          // pressed / covered
export const LINE = 'var(--fc-line, #8795a3)';        // key outline
export const KEY = 'var(--fc-key, #eef1f4)';          // unpressed key surface
export const ACCENT = 'var(--fc-accent, #16212b)';    // ring, trill, alt hatching
export const INK2 = 'var(--fc-ink-2, #5b7fa6)';       // second tone (two-tone mode)
export const HIGHLIGHT = 'var(--fc-highlight, #e2553b)'; // called-out keys
export const PAPER = 'var(--fc-paper, #ffffff)';
export const TEXT = 'var(--fc-text, #16212b)';
export const FONT = 'var(--fc-font, Poppins, system-ui, sans-serif)';
const SW = 'var(--fc-stroke, 1.4)';                   // outline weight

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
 * highlight   pressed and called out (the key that changes, a new key to learn)
 */
export const STATES = [
  'open', 'closed', 'half', 'quarter', 'three-q',
  'ring', 'optional', 'alt', 'trill', 'na', 'highlight',
];

const FILL_FRACTION = { half: 0.5, quarter: 0.25, 'three-q': 0.75 };

function strokeFor(state, INK) {
  if (state === 'highlight') return `stroke="${HIGHLIGHT}" stroke-width="${SW}" stroke-linejoin="round"`;
  if (state === 'optional') return `stroke="${INK}" stroke-width="${SW}" stroke-dasharray="2.2 1.8" stroke-linecap="round"`;
  if (state === 'na') return `stroke="${LINE}" stroke-width="0.8" stroke-opacity="0.3"`;
  if (state === 'closed') return `stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"`;
  return `stroke="${LINE}" stroke-width="${SW}" stroke-linejoin="round"`;
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
export const DEFS = `<defs><pattern id="${HATCH_ID}" width="3" height="3" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><line x1="0" y1="0" x2="0" y2="3" stroke="${ACCENT}" stroke-width="1.4"/></pattern></defs>`;

function fillFor(state, INK) {
  if (state === 'closed') return INK;
  if (state === 'highlight') return HIGHLIGHT;
  if (state === 'alt') return `url(#${HATCH_ID})`;
  if (state === 'na' || state === 'optional') return 'none';
  return KEY;
}

/* Builds the standard open/closed/partial treatment for any geometry. */
function paint(k, box, geom, fillDir) {
  const state = k.state;
  const INK = inkFor(k);
  const stroke = strokeFor(state, INK);
  if (state === 'na') return geom(`fill="none" ${stroke}`);
  if (state === 'ring') {
    // touched but open: solid annulus, open centre
    return geom(`fill="${ACCENT}" stroke="${ACCENT}" stroke-width="${SW}"`)
         + geom(`fill="var(--fc-ring-hole, ${KEY})" stroke="none"`, 0.5);
  }
  const frac = FILL_FRACTION[state];
  if (frac) {
    return partial(
      geom(`fill="${KEY}" ${stroke}`),
      geom(`fill="${INK}" stroke="none"`),
      box, frac, fillDir || 'bottom',
    );
  }
  return geom(`fill="${fillFor(state, INK)}" ${stroke}`);
}

/* Pressed colour: second tone for keys marked tone 2 (e.g. the right hand). */
const inkFor = (k) => (k.tone === 2 ? INK2 : INK);

/* ------------------------------------------------------------------ */
/* Shape primitives                                                    */
/* ------------------------------------------------------------------ */

/**
 * Round tone hole or pearl touchpiece. Sax/flute/clarinet stacks, recorder holes.
 * `ringed: true` adds the metal ring of a ring key (clarinet, open-hole flute):
 * a thin concentric outline `ringGap` outside the hole.
 */
export function circle(k) {
  const r = k.r ?? 9;
  const geom = (attr, shrink = 1) =>
    `<circle cx="${k.x}" cy="${k.y}" r="${r * shrink}" ${attr}/>`;
  const hole = paint(k, [k.x - r, k.y - r, r * 2, r * 2], geom, k.fillFrom);
  if (!k.ringed || k.state === 'na') return hole;
  const pressed = k.state === 'closed' || k.state === 'highlight';
  const ring = `<circle cx="${k.x}" cy="${k.y}" r="${r + (k.ringGap ?? 2.4)}" fill="none"`
    + ` stroke="${pressed ? (k.state === 'highlight' ? HIGHLIGHT : inkFor(k)) : LINE}" stroke-width="${pressed ? 1.8 : 1}"/>`;
  return ring + hole;
}

/** Ellipse. Bis key, side keys, rollers, small auxiliary touchpieces. */
export function oval(k) {
  const rx = k.rx ?? 6.5, ry = k.ry ?? 3.8;
  const geom = (attr, shrink = 1) =>
    `<ellipse cx="${k.x}" cy="${k.y}" rx="${rx * shrink}" ry="${ry * shrink}" ${attr}/>`;
  return paint(k, [k.x - rx, k.y - ry, rx * 2, ry * 2], geom, k.fillFrom);
}

/** Rounded rectangle. Palm keys, side keys, trill keys, thumb plates. */
export function pill(k) {
  const w = k.w ?? 8, h = k.h ?? 16;
  const rad = k.rad ?? Math.min(w, h) / 2;
  const geom = (attr, shrink = 1) => {
    const ww = w * shrink, hh = h * shrink;
    return `<rect x="${k.x - ww / 2}" y="${k.y - hh / 2}" width="${ww}" height="${hh}" rx="${rad * shrink}" ${attr}/>`;
  };
  return paint(k, [k.x - w / 2, k.y - h / 2, w, h], geom, k.fillFrom);
}

/**
 * Plate — a rectangle with its own radius on each corner, [tl, tr, br, bl].
 * Plates tile: give neighbours small inner radii and large outer ones and a
 * group reads as a single table cut into keys, like the sax LH pinky table.
 */
export function plate(k) {
  const w = k.w ?? 16, h = k.h ?? 14;
  const r = [].concat(k.radii ?? k.rad ?? 3);
  const [tl, tr, br, bl] = [0, 1, 2, 3].map((i) => Math.min(r[i] ?? r[0], w / 2, h / 2));
  const n = (v) => Math.round(v * 100) / 100;
  const geom = (attr, s = 1) => {
    const ww = w * s, hh = h * s, x = k.x - ww / 2, y = k.y - hh / 2;
    const [a, b, c, d] = [tl * s, tr * s, br * s, bl * s];
    return `<path d="M ${n(x + a)} ${n(y)} H ${n(x + ww - b)} A ${n(b)} ${n(b)} 0 0 1 ${n(x + ww)} ${n(y + b)}`
      + ` V ${n(y + hh - c)} A ${n(c)} ${n(c)} 0 0 1 ${n(x + ww - c)} ${n(y + hh)}`
      + ` H ${n(x + d)} A ${n(d)} ${n(d)} 0 0 1 ${n(x)} ${n(y + hh - d)}`
      + ` V ${n(y + a)} A ${n(a)} ${n(a)} 0 0 1 ${n(x + a)} ${n(y)} Z" ${attr}/>`;
  };
  return paint(k, [k.x - w / 2, k.y - h / 2, w, h], geom, k.fillFrom);
}

/**
 * Dome — half an ellipse on a flat base. Points up by default (flat side
 * down); `dir: "down"` flips it. Two domes base-to-base make the split circle
 * used for the sax low E♭ / C pair; a dome caps each end of the LH table.
 */
export function dome(k) {
  const w = k.w ?? 16, h = k.h ?? 8;
  const n = (v) => Math.round(v * 100) / 100;
  const geom = (attr, s = 1) => {
    const rx = (w / 2) * s, ry = h * s, yb = k.y + (h / 2) * s;
    return `<path d="M ${n(k.x - rx)} ${n(yb)} A ${n(rx)} ${n(ry)} 0 0 1 ${n(k.x + rx)} ${n(yb)} Z" stroke-linejoin="round" ${attr}/>`;
  };
  return paint(k, [k.x - w / 2, k.y - h / 2, w, h], geom, k.fillFrom);
}

/**
 * Pin — a key body hung from a pivot pearl: a small grey knob, a thin arm,
 * and a teardrop body (bulb at the bottom). The clarinet register key and
 * throat A. `w`/`h` size the body; `knob` is the pearl radius; `kdx` moves
 * the pearl sideways so the arm runs across then down (clarinet G♯ lever).
 */
export function pin(k) {
  const w = k.w ?? 8, h = k.h ?? 16, kr = k.knob ?? 2.6, kdx = k.kdx ?? 0, gap = k.armLen ?? 4;
  const tipY = k.y - h / 2, ky = tipY - gap - kr;
  const kx = k.x + kdx;
  const arm = kdx
    ? `M ${kx} ${ky} H ${k.x} V ${tipY + 1}`
    : `M ${kx} ${ky + kr} V ${tipY + 1}`;
  const deco = `<path d="${arm}" fill="none" stroke="${LINE}" stroke-width="${SW}" stroke-linecap="round" stroke-linejoin="round"/>`
    + `<circle cx="${kx}" cy="${ky}" r="${kr}" fill="var(--fc-pearl, ${LINE})" stroke="${LINE}" stroke-width="${SW}"/>`;
  return deco + teardrop({ ...k, w, h, tipRound: k.tipRound ?? 1.2 });
}

/**
 * Hook — a pinky lobe that turns down into a stem: rounded outer end,
 * straight top, and at the inner end a stem dropping `stem` below the lobe.
 * Stack several for the clarinet RH pinky keys. Lobe points left by
 * default; `flip: true` points it right.
 */
export function hook(k) {
  const w = k.w ?? 16, h = k.h ?? 7, st = k.stem ?? 12, sw = k.stemW ?? 3;
  const n = (v) => Math.round(v * 100) / 100;
  const geom = (attr, s = 1) => {
    const W = w * s, Hh = h * s, S = st * s, SW2 = sw * s, r = Hh / 2;
    const x0 = k.x - W / 2, x1 = k.x + W / 2, top = k.y - Hh / 2, bot = k.y + Hh / 2;
    const rr = Math.min(r, SW2);
    const d = `M ${n(x0 + r)} ${n(top)} H ${n(x1 - rr)} A ${n(rr)} ${n(rr)} 0 0 1 ${n(x1)} ${n(top + rr)}`
      + ` V ${n(bot + S)} H ${n(x1 - SW2)} V ${n(bot)} H ${n(x0 + r)} A ${n(r)} ${n(r)} 0 0 1 ${n(x0 + r)} ${n(top)} Z`;
    const flip = k.flip ? ` transform="translate(${n(2 * k.x)} 0) scale(-1 1)"` : '';
    return `<path d="${d}"${flip} stroke-linejoin="round" ${attr}/>`;
  };
  return paint(k, [k.x - w / 2, k.y - h / 2, w, h + st], geom, k.fillFrom ?? 'left');
}

/** Long thin bar. Clarinet lever bars, flute Bb bar, low-B footjoint. */
export function bar(k) {
  return pill({ ...k, w: k.w ?? 20, h: k.h ?? 5 });
}

/** Pinky spatula / paddle. Sax LH table + RH Eb-C, clarinet & flute levers. */
export function spatula(k) {
  return pill({ ...k, w: k.w ?? 15, h: k.h ?? 13, rad: k.rad ?? 4 });
}

/* Lever key sizes: touchpiece w/h, rod length and rod thickness. */
export const LEVER_SIZES = {
  sm: { w: 5, h: 9, stem: 6, rod: 2 },
  md: { w: 6, h: 12, stem: 7, rod: 2.4 },
  lg: { w: 8, h: 16, stem: 9, rod: 3 },
};

/**
 * Small stemmed lever — side/trill levers where the stem shows articulation.
 * `size` picks sm / md / lg (explicit w, h, stem, rod still win). The stem is
 * drawn as a rod with a pivot post at its far end; `stemStyle: "line"` gives
 * the original hairline stem and `pivot: false` drops the post.
 */
export function lever(k) {
  const z = LEVER_SIZES[k.size] || LEVER_SIZES.md;
  const w = k.w ?? z.w, h = k.h ?? z.h, sl = k.stem ?? z.stem, t = k.rod ?? z.rod;
  const dir = k.stemDir ?? 'left';
  const x0 = dir === 'left' ? k.x - w / 2 - sl : k.x + w / 2;   // rod start
  const x1 = dir === 'left' ? k.x - w / 2 : k.x + w / 2 + sl;   // rod end
  let stem;
  if (k.stemStyle === 'line') {
    stem = `<line x1="${x0}" y1="${k.y}" x2="${x1}" y2="${k.y}" stroke="${LINE}" stroke-width="${SW}" stroke-linecap="round"/>`;
  } else {
    // rod runs a little under the touchpiece so the join reads as solid
    const tuck = w * 0.3;
    const rx0 = dir === 'left' ? x0 : x0 - tuck, rx1 = dir === 'left' ? x1 + tuck : x1;
    stem = `<rect x="${rx0}" y="${k.y - t / 2}" width="${rx1 - rx0}" height="${t}" rx="${t / 2}"`
         + ` fill="${KEY}" stroke="${LINE}" stroke-width="${SW}"/>`;
    if (k.pivot !== false) {
      const px = dir === 'left' ? x0 : x1;
      stem += `<circle cx="${px}" cy="${k.y}" r="${t * 0.9}" fill="${KEY}" stroke="${LINE}" stroke-width="${SW}"/>`;
    }
  }
  return stem + pill({ ...k, w, h });
}

/**
 * Cylinder — a roller seen side-on: a capsule with a band line near each end
 * so it reads as something that turns. Sits between neighbouring pinky keys
 * (sax LH B | C♯, RH E♭ | C). Upright by default; tilt with `rot`.
 */
export function cylinder(k) {
  const w = k.w ?? 3.2, h = k.h ?? 7;
  const r = w / 2;
  // rollers are bright metal, not key surface: paper fill unless pressed
  const body = k.state === 'open'
    ? pill({ ...k, w, h, rad: r }).replace(`fill="${KEY}"`, `fill="var(--fc-roller, ${PAPER})"`)
    : pill({ ...k, w, h, rad: r });
  if (k.state === 'na') return body;
  const band = (y) => `<path d="M ${k.x - r} ${y} Q ${k.x} ${y + r * 0.7} ${k.x + r} ${y}" fill="none"`
    + ` stroke="${LINE}" stroke-width="0.8" stroke-linecap="round"/>`;
  return body + band(k.y - h / 2 + r * 1.1) + band(k.y + h / 2 - r * 1.6);
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
  return paint(k, [k.x - w / 2, k.y - h / 2, w, h], geom, k.fillFrom);
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

/**
 * Bean — a curved, optionally tapered capsule. The realistic touchpiece for
 * sax palm keys and the clarinet throat A / G♯ keys. `w` is thickness, `h`
 * overall length, `bend` how far the middle bows sideways (negative bows
 * left), `taper` the top-end thickness as a fraction of the bottom end.
 * Points up by default; aim it with `dir` or `rot` like any other shape.
 */
export function bean(k) {
  const w = k.w ?? 8, h = k.h ?? 20, bend = k.bend ?? 2.5, taper = k.taper ?? 1;
  const geom = (attr, s = 1) => `<path d="${beanPath(k.x, k.y, w * s, h * s, bend * s, taper)}" ${attr}/>`;
  const x0 = Math.min(0, bend) - w / 2, x1 = Math.max(0, bend) + w / 2;
  return paint(k, [k.x + x0, k.y - h / 2, x1 - x0, h], geom, k.fillFrom);
}

function beanPath(cx, cy, w, h, bend, taper) {
  const hw = (t) => (w / 2) * (taper + (1 - taper) * t);
  return sweptPath(cx, cy, h - w / 2 - hw(0), bend, hw, w / 2 - hw(0));
}

/*
 * Outline of a round-capped stroke swept along a bowed centreline.
 * `L` is the centreline length (cap centre to cap centre), `hw(t)` the
 * half-width at t (0 = top, 1 = bottom), `shift` nudges the centreline
 * down so unequal caps still centre the shape's full length on cy.
 */
function sweptPath(cx, cy, L, bend, hw, shift = 0) {
  const n = (v) => Math.round(v * 100) / 100;
  L = Math.max(L, 0.01);
  const N = 24, C = 10;
  const y0 = cy - L / 2 + shift / 2;
  const at = (t) => [cx + 4 * bend * t * (1 - t), y0 + L * t];
  const tan = (t) => { const dx = 4 * bend * (1 - 2 * t), m = Math.hypot(dx, L); return [dx / m, L / m]; };
  const side = (t, sgn) => {                          // sgn 1 = right of travel, -1 = left
    const [px, py] = at(t), [tx, ty] = tan(t), r = hw(t) * sgn;
    return [px + ty * r, py - tx * r];
  };
  const cap = (t, sgn) => {                           // half-turn from one side to the other
    const [px, py] = at(t), [tx, ty] = tan(t), r = hw(t);
    const a0 = Math.atan2(-tx * sgn, ty * sgn);
    const pts = [];
    for (let i = 1; i < C; i++) {
      const a = a0 + (i / C) * Math.PI;
      pts.push([px + Math.cos(a) * r, py + Math.sin(a) * r]);
    }
    return pts;
  };
  const pts = [];
  for (let i = 0; i <= N; i++) pts.push(side(i / N, 1));
  pts.push(...cap(1, 1));
  for (let i = N; i >= 0; i--) pts.push(side(i / N, -1));
  pts.push(...cap(0, -1));
  return 'M ' + pts.map(([x, y]) => `${n(x)} ${n(y)}`).join(' L ') + ' Z';
}

/**
 * Leaf — an almond pad: widest in the middle, easing to rounded ends. The
 * realistic sax palm key (and any long oblong touchpiece). `w` is the widest
 * point, `h` overall length, `end` how round the ends are (0 = pointed,
 * 1 = elliptical), `bend` a gentle sideways bow.
 */
export function leaf(k) {
  const w = k.w ?? 8, h = k.h ?? 22, end = k.end ?? 0.45, bend = k.bend ?? 1;
  const geom = (attr, s = 1) => `<path d="${leafPath(k.x, k.y, w * s, h * s, end, bend * s)}" ${attr}/>`;
  const x0 = Math.min(0, bend) - w / 2, x1 = Math.max(0, bend) + w / 2;
  return paint(k, [k.x + x0, k.y - h / 2, x1 - x0, h], geom, k.fillFrom);
}

function leafPath(cx, cy, w, h, end, bend) {
  const n = (v) => Math.round(v * 100) / 100;
  const R = w / 2, H = h / 2, ex = R * end * 1.1, sy = H * 0.55;
  // one quarter as a cubic: tip (0,-H) → shoulder (R,0); mirrored for the rest
  const q = (t) => {
    const u = 1 - t;
    return [3 * u * u * t * ex + 3 * u * t * t * R + t * t * t * R,
            u * u * u * -H + 3 * u * u * t * -H + 3 * u * t * t * -sy];
  };
  const N = 14, pts = [];
  for (let i = 0; i <= N; i++) pts.push(q(i / N));
  const right = [...pts, ...pts.slice(0, -1).reverse().map(([x, y]) => [x, -y])];
  const left = right.slice(1, -1).reverse().map(([x, y]) => [-x, y]);
  const bow = ([x, y]) => [cx + x + bend * (1 - (y / H) ** 2), cy + y];
  return 'M ' + [...right, ...left].map(bow).map(([x, y]) => `${n(x)} ${n(y)}`).join(' L ') + ' Z';
}

/**
 * Tapered drop — a small bulb drawn out into a long, slim, slightly leaning
 * tail. The engraved-chart sax palm key. `w` is the bulb diameter, `h` the
 * overall length, `tip` the tip radius, `bend` the lean of the tail and
 * `curve` how quickly the tail thins (1 = straight sides, higher = slimmer).
 * Tip points up by default; aim with `dir` or `rot`.
 */
export function taper(k) {
  const w = k.w ?? 8, h = k.h ?? 24, tip = k.tip ?? 0.9, bend = k.bend ?? 1.2, curve = k.curve ?? 1.6;
  const R = w / 2;
  const hw = (s) => (t) => (tip + (R - tip) * Math.pow(t, curve)) * s;
  const geom = (attr, s = 1) =>
    `<path d="${sweptPath(k.x, k.y, (h - R - tip) * s, bend * s, hw(s), (R - tip) * s)}" ${attr}/>`;
  const x0 = Math.min(0, bend) - R, x1 = Math.max(0, bend) + R;
  return paint(k, [k.x + x0, k.y - h / 2, x1 - x0, h], geom, k.fillFrom);
}

export const SHAPES = { circle, oval, pill, bar, spatula, lever, roller, teardrop, drop: teardrop, bean, taper, plate, leaf, dome, cylinder, pin, hook };

/** Unrotated width/height of a key — used for alignment and relative placement. */
export function bbox(k) {
  switch (k.shape) {
    case 'circle': { const r = (k.r ?? 9) + (k.ringed ? (k.ringGap ?? 2.4) : 0); return [r * 2, r * 2]; }
    case 'oval': { const rx = k.rx ?? 6.5, ry = k.ry ?? 3.8; return [rx * 2, ry * 2]; }
    case 'roller': { const rx = k.rx ?? 6, ry = k.ry ?? 3.2; return [rx * 2, ry * 2]; }
    case 'bar': return [k.w ?? 20, k.h ?? 5];
    case 'spatula': return [k.w ?? 15, k.h ?? 13];
    case 'lever': { const z = LEVER_SIZES[k.size] || LEVER_SIZES.md; return [k.w ?? z.w, k.h ?? z.h]; }
    case 'teardrop': case 'drop': return [k.w ?? 11, k.h ?? 20];
    case 'taper': return [(k.w ?? 8) + Math.abs(k.bend ?? 1.2), k.h ?? 24];
    case 'leaf': return [(k.w ?? 8) + Math.abs(k.bend ?? 1), k.h ?? 22];
    case 'pin': return [k.w ?? 8, (k.h ?? 16) + 2 * (k.knob ?? 2.6) + (k.armLen ?? 4)];
    case 'hook': return [k.w ?? 16, (k.h ?? 7) + (k.stem ?? 12)];
    case 'cylinder': return [k.w ?? 3.2, k.h ?? 7];
    case 'dome': return [k.w ?? 16, k.h ?? 8];
    case 'plate': return [k.w ?? 16, k.h ?? 14];
    case 'bean': return [(k.w ?? 8) + Math.abs(k.bend ?? 2.5), k.h ?? 20];
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
    const top = k.r ?? (k.ry ?? (k.h ?? 9) / 2);
    out += `<path d="M ${k.x - 3.2} ${k.y - top - 3} l 3.2 -3.6 l 3.2 3.6" fill="none" stroke="${ACCENT}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  const rot = (k.rot || 0) + (DIR_ROT[k.dir] ?? 0);
  if (rot) {
    out = `<g transform="rotate(${rot} ${k.x} ${k.y})">${out}</g>`;
  }
  return out;
}
