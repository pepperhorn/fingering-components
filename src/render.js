/*
 * render.js — turns (instrument layout + fingering spec) into SVG.
 *
 * The layout describes WHERE every key sits and WHAT SHAPE it is.
 * The fingering only describes WHICH keys are down. That split is what
 * keeps fingering data terse enough to hand-write or generate.
 */

import { drawKey, DEFS, LINE } from './keys.js';
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
  // explicit per-key override always wins
  for (const [id, st] of Object.entries(fingering.states || {})) put(id, st);
  return states;
}

/* Group keys by panel so the rear (thumb-side) view can be drawn separately. */
function byPanel(layout) {
  const panels = layout.panels?.length ? layout.panels : [{ id: 'front' }];
  return panels.map((p) => ({
    ...p,
    keys: layout.keys.filter((k) => (k.panel || 'front') === p.id),
  }));
}

/**
 * One fingering diagram (no title). Returns an SVG <g> fragment plus size.
 */
export function diagramBody(rawLayout, fingering) {
  const layout = resolveLayout(rawLayout);
  const states = resolveStates(layout, fingering);
  const parts = [];

  for (const panel of byPanel(layout)) {
    const [ox, oy] = panel.origin || [0, 0];
    const body = panel.keys
      .map((k) => drawKey({ ...k, state: states[k.id] }))
      .join('');
    let frame = '';
    if (panel.id !== 'front' && panel.frame !== false && panel.box) {
      const [x, y, w, h] = panel.box;
      frame = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="none"`
            + ` stroke="${LINE}" stroke-width="0.8" stroke-opacity="0.35" stroke-dasharray="3 2.5"/>`
            + (panel.label
                ? `<text x="${x + w / 2}" y="${y - 3}" text-anchor="middle" font-size="7"`
                + ` fill="${LINE}" fill-opacity="0.7" font-family="var(--fc-font, Georgia, serif)">${panel.label}</text>`
                : '');
    }
    parts.push(`<g transform="translate(${ox} ${oy})">${frame}${body}</g>`);
  }
  return parts.join('');
}

/**
 * A single labelled diagram as a standalone SVG.
 */
export function renderFingering(layout, fingering, opts = {}) {
  const [, , w, h] = layout.viewBox;
  const titleH = opts.title === false ? 0 : 26;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h + titleH}" width="${opts.width || w}">`
    + DEFS
    + (titleH
        ? `<text x="${w / 2}" y="17" text-anchor="middle" font-size="17"`
        + ` font-family="var(--fc-font, Georgia, serif)" fill="${LINE}">${label(fingering)}</text>`
        : '')
    + `<g transform="translate(0 ${titleH})">${diagramBody(layout, fingering)}</g>`
    + `</svg>`;
}

function label(f) {
  return (f.label ?? f.note ?? '').replace(/b\b/g, '\u266d').replace(/#/g, '\u266f');
}

/**
 * A full chart sheet: many fingerings in a grid.
 * fingerings: [{ note, label?, note_text?, down: [...] }, ...]
 */
export function renderChart(layout, fingerings, opts = {}) {
  const cols = opts.columns || 9;
  const [, , cw, ch] = layout.viewBox;
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
      ? `<text x="${cw / 2}" y="29" text-anchor="middle" font-size="8" fill="${LINE}" fill-opacity="0.75"`
      + ` font-family="var(--fc-font, Georgia, serif)">${f.note_text}</text>`
      : '';
    return `<g transform="translate(${cx} ${cy})">${note}`
      + `<text x="${cw / 2}" y="19" text-anchor="middle" font-size="19"`
      + ` font-family="var(--fc-font, Georgia, serif)" fill="${LINE}">${label(f)}</text>`
      + `<g transform="translate(0 ${titleH})">${diagramBody(layout, f)}</g></g>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -14 ${W} ${H + 14}" width="${opts.width || W}">`
    + DEFS + cells + `</svg>`;
}

export { resolveLayout, contentBounds } from './layout.js';

export default { renderFingering, renderChart, resolveStates, diagramBody };
