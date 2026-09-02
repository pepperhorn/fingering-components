/*
 * layout.js — resolves a layout's positioning shorthand into absolute
 * key geometry, once, before anything is drawn.
 *
 * Three ways to place a key, in increasing order of convenience:
 *
 *   1. absolute      x, y                       — the centre point
 *   2. cluster       cluster + dx/dy or flow    — relative to a cluster anchor
 *   3. relative      relativeTo + place + gap   — butted against another key
 *
 * Plus `align`, which changes WHICH POINT of the shape sits on the
 * coordinate, so spatulas of different sizes can share an edge.
 */

import { bbox } from './keys.js';

const RAD = Math.PI / 180;
const cache = new WeakMap();

/* Which point of the shape the coordinate refers to.
   "center" (default), or any combination of top/bottom/left/right. */
function alignShift(k) {
  const a = k.align || 'center';
  if (a === 'center') return [0, 0];
  const [w, h] = bbox(k);
  let sx = 0, sy = 0;
  if (a.includes('left')) sx = w / 2;
  if (a.includes('right')) sx = -w / 2;
  if (a.includes('top')) sy = h / 2;
  if (a.includes('bottom')) sy = -h / 2;
  return [sx, sy];
}

/* Auto-position for cluster members that don't give explicit dx/dy. */
function flowOffset(flow, i) {
  const f = flow || {};
  if (f.shape === 'arc') {
    const deg = (f.startAngle ?? 0) + i * (f.step ?? 18);
    const R = f.radius ?? 30;
    return {
      dx: Math.cos(deg * RAD) * R,
      dy: Math.sin(deg * RAD) * R,
      rot: f.rotateMembers ? (deg + (f.memberRotate ?? 0)) * (f.tilt ?? 1) : 0,
    };
  }
  const axis = f.axis ?? 'y';
  const pitch = f.pitch ?? 16;
  const drift = (f.drift ?? 0) * i;                       // steady lean
  const stagger = (f.stagger ?? 0) * (i % 2 ? 1 : 0);     // alternating offset
  const cross = drift + stagger;
  return axis === 'x'
    ? { dx: i * pitch, dy: cross, rot: 0 }
    : { dx: cross, dy: i * pitch, rot: 0 };
}

function placeRelative(k, ref) {
  const [w, h] = bbox(k);
  const [rw, rh] = bbox(ref);
  const gap = k.gap ?? 0;
  const [ox, oy] = k.offset || [0, 0];
  switch (k.place) {
    case 'below': return [ref.x + ox, ref.y + rh / 2 + gap + h / 2 + oy];
    case 'above': return [ref.x + ox, ref.y - rh / 2 - gap - h / 2 + oy];
    case 'right': return [ref.x + rw / 2 + gap + w / 2 + ox, ref.y + oy];
    case 'left':  return [ref.x - rw / 2 - gap - w / 2 + ox, ref.y + oy];
    default:      return [ref.x + ox, ref.y + oy];
  }
}

/**
 * Returns { keys, byId } with every key carrying absolute x, y and a final rot.
 * Result is cached per layout object.
 */
export function resolveLayout(layout) {
  if (cache.has(layout)) return cache.get(layout);

  const clusters = Object.fromEntries((layout.clusters || []).map((c) => [c.id, c]));
  const counters = {};

  // merge defaults so bbox() sees real geometry
  const keys = layout.keys.map((k) => {
    const c = k.cluster ? clusters[k.cluster] : null;
    if (k.cluster && !c) throw new Error(`${layout.id}: key "${k.id}" names unknown cluster "${k.cluster}"`);
    return { ...(layout.defaults?.[k.shape || c?.defaults?.shape] || {}), ...(c?.defaults || {}), ...k };
  });
  const byId = Object.fromEntries(keys.map((k) => [k.id, k]));

  const settle = (k) => {
    const c = k.cluster ? clusters[k.cluster] : null;
    let x, y, rot = k.rot || 0;

    if (c) {
      const [ax, ay] = c.anchor || [0, 0];
      let dx, dy;
      if (k.dx != null || k.dy != null) {
        dx = k.dx || 0; dy = k.dy || 0;
      } else {
        const i = k.index ?? (counters[c.id] = (counters[c.id] ?? -1) + 1);
        const f = flowOffset(c.flow, i);
        dx = f.dx; dy = f.dy; rot += f.rot;
      }
      // per-key nudge on top of the flow position
      dx += k.ddx || 0; dy += k.ddy || 0;
      // rotate the whole cluster about its anchor
      const t = (c.rotate || 0) * RAD;
      x = ax + dx * Math.cos(t) - dy * Math.sin(t);
      y = ay + dx * Math.sin(t) + dy * Math.cos(t);
      rot += c.rotate || 0;
    } else if (k.relativeTo) {
      const ref = byId[k.relativeTo];
      if (!ref) throw new Error(`${layout.id}: key "${k.id}" references unknown key "${k.relativeTo}"`);
      if (ref.x == null) return false;                 // ref not settled yet
      [x, y] = placeRelative(k, ref);
      rot += k.inheritRotation === false ? 0 : (ref.rot || 0);
    } else {
      x = k.x ?? 0; y = k.y ?? 0;
    }

    const [sx, sy] = alignShift(k);
    k.x = x + sx; k.y = y + sy; k.rot = rot;
    return true;
  };

  // absolute + cluster keys first, then relative keys until they settle
  const pending = [];
  for (const k of keys) {
    if (k.relativeTo && !k.cluster) pending.push(k);
    else settle(k);
  }
  for (let pass = 0; pending.length && pass <= keys.length; pass++) {
    for (let i = pending.length - 1; i >= 0; i--) if (settle(pending[i])) pending.splice(i, 1);
  }
  if (pending.length) {
    throw new Error(`${layout.id}: circular relativeTo chain (${pending.map((k) => k.id).join(', ')})`);
  }

  const resolved = { ...layout, keys, byId, clusters };
  cache.set(layout, resolved);
  return resolved;
}

/** Bounding box of every key, so viewBox can be checked or auto-fitted. */
export function contentBounds(layout, pad = 6) {
  const { keys } = resolveLayout(layout);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const k of keys) {
    const panel = (layout.panels || []).find((p) => p.id === (k.panel || 'front'));
    const [ox, oy] = panel?.origin || [0, 0];
    const [w, h] = bbox(k);
    const r = Math.hypot(w, h) / 2;   // rotation-safe
    x0 = Math.min(x0, k.x + ox - r); x1 = Math.max(x1, k.x + ox + r);
    y0 = Math.min(y0, k.y + oy - r); y1 = Math.max(y1, k.y + oy + r);
  }
  return [x0 - pad, y0 - pad, x1 - x0 + pad * 2, y1 - y0 + pad * 2];
}
