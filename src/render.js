/*
 * render.js — turns (instrument layout + fingering spec) into SVG.
 *
 * The layout describes WHERE every key sits and WHAT SHAPE it is.
 * The fingering only describes WHICH keys are down. That split is what
 * keeps fingering data terse enough to hand-write or generate.
 */

import { drawKey, DEFS, LINE, KEY, TEXT, FONT } from './keys.js';
import { resolveLayout } from './layout.js';

/* Resolve a fingering spec into a state for every key in the layout. */
export function resolveStates(layout, fingering = {}) {
  const states = {};
  for (const k of layout.keys) states[k.id] = k.default ?? 'open';

  const put = (ids, state) => {
    if (!ids) return;
    for (const id of [].concat(ids)) {
      if (!(id in states)) throw new Error(`${layout.id}: unknown key "${id}"`);
      states[id] = state;
    }
  };

  put(fingering.down, 'closed');
  put(fingering.half, 'half');
  put(fingering.quarter, 'quarter');
  put(fingering.threeQuarter, 'three-q');
  put(fingering.ring, 'ring');
  put(fingering.optional, 'optional');
  put(fingering.trill, 'trill');
  put(fingering.absent, 'na');
  put(fingering.highlight, 'highlight');
  // explicit per-key override always wins
  for (const [id, st] of Object.entries(fingering.states || {})) put(id, st);
  // `showWith: [ids]` keys are guides that appear only while one of those keys
  // is in use (e.g. marks for the trombone positions the slide has passed)
  for (const k of layout.keys) {
    if (!k.showWith) continue;
    const on = k.showWith.some((id) => states[id] && states[id] !== 'open' && states[id] !== 'na');
    states[k.id] = on ? 'open' : 'na';
  }
  return states;
}

/* Two-tone modes: which keys take the second pressed colour. */
const TONES = {
  hand: (k) => (k.hand === 'R' ? 2 : 1),
};

/*
 * Layout variants — named, additive overrides kept inside the layout, e.g.
 * "variants": { "palm-bean": { "clusters": { "palm": {...} }, "keys": { "palm-d": {...} } } }
 * Unknown or missing names return the layout unchanged.
 */
const variantCache = new WeakMap();
export function withVariant(layout, name) {
  // several variants stack in order: "palm-leaf side-levers" or ["palm-leaf", "side-levers"]
  const names = Array.isArray(name) ? name : String(name ?? '').split(/[\s,]+/).filter(Boolean);
  if (names.length > 1) return names.reduce((l, n) => withVariant(l, n), layout);
  name = names[0];
  const v = name && layout.variants?.[name];
  if (!v) return layout;
  let byName = variantCache.get(layout);
  if (!byName) variantCache.set(layout, (byName = {}));
  if (byName[name]) return byName[name];
  const merge = (list, patch = {}) => (list || []).map((x) => (patch[x.id]
    ? { ...x, ...patch[x.id], ...(x.defaults || patch[x.id].defaults ? { defaults: { ...x.defaults, ...patch[x.id].defaults } } : {}) }
    : x));
  return (byName[name] = {
    ...layout,
    clusters: merge(layout.clusters, v.clusters),
    keys: merge(layout.keys, v.keys),
    // a variant may add guide lines (e.g. an instrument body outline)
    ...(v.guides ? { guides: [...(layout.guides || []), ...v.guides] } : {}),
  });
}

/* Group keys by panel so the rear (thumb-side) view can be drawn separately. */
function byPanel(layout) {
  const panels = layout.panels?.length ? layout.panels : [{ id: 'front' }];
  return panels.map((p) => ({
    ...p,
    keys: layout.keys.filter((k) => (k.panel || 'front') === p.id),
  }));
}

/*
 * Key tag — a short label drawn with a key (e.g. a trombone slide position
 * number). `tag` is the text, `tagAt: [dx, dy]` its offset from the key
 * centre. Tags stay upright when the diagram is turned horizontal.
 */
function tagFor(k, o) {
  if (k.tag == null) return '';
  const [dx, dy] = k.tagAt || [0, 0];
  const x = k.x + dx, y = k.y + dy;
  const turn = o === 'horizontal' ? ` transform="rotate(90 ${x} ${y})"` : '';
  return `<text class="fc-tag" x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-size="${k.tagSize ?? 9}"`
    + ` font-weight="600" font-family="${FONT}" fill="${TEXT}"${turn}>${k.tag}</text>`;
}

/**
 * One fingering diagram (no title). Returns an SVG <g> fragment plus size.
 */
export function diagramBody(rawLayout, fingering, opts = {}) {
  const layout = resolveLayout(withVariant(rawLayout, opts.variant));
  const tone = TONES[opts.twoTone] || (() => 1);
  const states = resolveStates(layout, fingering);
  const parts = [];

  for (const panel of byPanel(layout)) {
    const [ox, oy] = panel.origin || [0, 0];
    // each key carries its id and state so CSS (looks, apps) can target it
    const body = panel.keys
      // `hint: true` keys (visual aids) only draw with the `hints` render option
      .filter((k) => !k.hint || opts.hints)
      .map((k) => {
        const svg = drawKey({ ...k, state: states[k.id], tone: tone(k) });
        return svg && `<g class="fc-key" data-key="${k.id}" data-state="${states[k.id]}">${svg}${tagFor(k, opts.orient)}</g>`;
      })
      .join('');
    let frame = '';
    if (panel.id !== 'front' && panel.frame !== false && panel.box) {
      const [x, y, w, h] = panel.box;
      frame = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="${KEY}" fill-opacity="0.55"`
            + ` stroke="${LINE}" stroke-width="0.7" stroke-opacity="0.5"/>`
            + (panel.label
                ? `<text x="${x + w / 2}" y="${y - 3.5}" text-anchor="middle" font-size="5.5" font-weight="600"`
                + ` letter-spacing="0.6" fill="${LINE}" font-family="${FONT}">${String(panel.label).toUpperCase()}</text>`
                : '');
    }
    const guides = (panel.id === 'front' ? layout.guides || [] : [])
      .map((g) => `<line class="fc-guide" x1="${g.x1}" y1="${g.y1}" x2="${g.x2}" y2="${g.y2}" stroke="${LINE}"`
        + ` stroke-width="${g.width ?? 1.2}" stroke-linecap="round"`
        // `dash: "dotted"` (or a dasharray) for paths of travel, e.g. a trombone slide
        + (g.dash ? ` stroke-dasharray="${g.dash === 'dotted' ? '.01 2.6' : g.dash}"` : '') + `/>`).join('');
    parts.push(`<g transform="translate(${ox} ${oy})">${frame}${guides}${body}</g>`);
  }
  const out = parts.join('');
  return opts.look ? `<g class="fc-look-${opts.look}">${out}</g>` : out;
}

/*
 * Looks — whole-diagram treatments for app use (falling-tile targets,
 * backdrops). `ghost` fades everything (--fc-ghost); `dotted` draws unpressed
 * keys as dotted, unfilled outlines and leaves pressed keys solid.
 */
export const LOOK_CSS = '<style>'
  + '.fc-look-ghost{opacity:var(--fc-ghost,.28)}'
  + '.fc-look-dotted .fc-key:not([data-state="closed"]):not([data-state="highlight"]) *,.fc-look-dotted .fc-guide'
  + '{stroke-dasharray:.01 2.4;stroke-linecap:round;stroke-width:1.5}'
  + '.fc-look-dotted .fc-key[data-state="open"] *{fill:none}'
  + '</style>';

/*
 * Orientation. 'horizontal' lays the instrument on its side, mouthpiece
 * left: the diagram turns a quarter anticlockwise and width/height swap.
 */
function orient(body, w, h, o) {
  if (o !== 'horizontal') return [body, w, h];
  return [`<g transform="translate(0 ${w}) rotate(-90)">${body}</g>`, h, w];
}

/**
 * A single labelled diagram as a standalone SVG.
 */
export function renderFingering(layout, fingering, opts = {}) {
  const [, , vw, vh] = layout.viewBox;
  const [body, w, h] = orient(diagramBody(layout, fingering, opts), vw, vh, opts.orient);
  const titleH = opts.title === false ? 0 : 26;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h + titleH}" width="${opts.width || w}">`
    + DEFS + (opts.look ? LOOK_CSS : '')
    + (titleH
        ? `<text x="${w / 2}" y="17" text-anchor="middle" font-size="16" font-weight="600"`
        + ` font-family="${FONT}" fill="${TEXT}">${label(fingering, layout, opts)}</text>`
        : '')
    + `<g transform="translate(0 ${titleH})">${body}</g>`
    + `</svg>`;
}

/*
 * Pitch. Fingerings are always written pitch. A layout's `transpose` is the
 * semitones from written to sounding (B♭ trumpet -2, soprano recorder +12);
 * `horns` names versions of a shared layout with their own transpose, and
 * `horn` is the default one (e.g. saxophone: soprano/alto/tenor/baritone).
 */
const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const LETTER = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function transposeFor(layout, horn) {
  const h = layout.horns?.[horn ?? layout.horn];
  return h ? h.transpose : (layout.transpose ?? 0);
}

/** Sounding note of a written fingering: { note, octave } (octave null if the fingering has none). */
export function sounding(layout, f, opts = {}) {
  const semis = transposeFor(layout, opts.horn);
  if (!f.note || !semis) return { note: f.note, octave: f.octave ?? null };
  const acc = f.note.slice(1);
  const pc = LETTER[f.note[0]] + (acc === '#' ? 1 : acc === 'b' ? -1 : 0);
  const abs = (f.octave ?? 4) * 12 + pc + semis;
  // flat-key horns (B♭, E♭, F) and flat-spelled notes read in flats
  const names = acc === 'b' || [3, 5, 10].includes(((semis % 12) + 12) % 12) ? FLATS : SHARPS;
  return { note: names[((abs % 12) + 12) % 12], octave: f.octave == null ? null : Math.floor(abs / 12) };
}

/* Title: an explicit label wins; otherwise the note, sounding if opts.pitch is "concert". */
function label(f, layout, opts = {}) {
  const note = f.label ?? (opts.pitch === 'concert' && layout ? sounding(layout, f, opts).note : f.note) ?? '';
  return note.replace(/b\b/g, '\u266d').replace(/#/g, '\u266f');
}

/**
 * A full chart sheet: many fingerings in a grid.
 * fingerings: [{ note, label?, note_text?, down: [...] }, ...]
 */
export function renderChart(layout, fingerings, opts = {}) {
  const cols = opts.columns || 9;
  const [, , vw, vh] = layout.viewBox;
  const [, cw, ch] = orient('', vw, vh, opts.orient);
  const gapX = opts.gapX ?? 16;
  const gapY = opts.gapY ?? 34;
  const titleH = 30;
  const cellH = ch + titleH;
  const rows = Math.ceil(fingerings.length / cols);
  const W = cols * cw + (cols - 1) * gapX;
  const H = rows * cellH + (rows - 1) * gapY;

  const cells = fingerings.map((f, i) => {
    const cx = (i % cols) * (cw + gapX);
    const cy = Math.floor(i / cols) * (cellH + gapY);
    const note = f.note_text
      ? `<text x="${cw / 2}" y="29" text-anchor="middle" font-size="6.5" font-weight="500" fill="${LINE}"`
      + ` font-family="${FONT}">${f.note_text}</text>`
      : '';
    return `<g transform="translate(${cx} ${cy})">${note}`
      + `<text x="${cw / 2}" y="19" text-anchor="middle" font-size="17" font-weight="600"`
      + ` font-family="${FONT}" fill="${TEXT}">${label(f, layout, opts)}</text>`
      + `<g transform="translate(0 ${titleH})">${orient(diagramBody(layout, f, opts), vw, vh, opts.orient)[0]}</g></g>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -14 ${W} ${H + 14}" width="${opts.width || W}">`
    + DEFS + (opts.look ? LOOK_CSS : '') + cells + `</svg>`;
}

export { resolveLayout, contentBounds } from './layout.js';

export default { renderFingering, renderChart, resolveStates, diagramBody, sounding, transposeFor };
