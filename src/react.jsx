/*
 * react.jsx — thin React wrappers. The renderer returns SVG strings, so the
 * wrapper only has to hand them to the DOM and own the CSS custom properties.
 */
import React, { useMemo } from 'react';
import { renderFingering, renderChart, resolveStates } from './render.js';
import { drawKey, DEFS } from './keys.js';
import { resolveLayout } from './layout.js';

const themeVars = (t = {}) => ({
  '--fc-ink': t.ink,
  '--fc-line': t.line,
  '--fc-key': t.key,
  '--fc-accent': t.accent,
  '--fc-text': t.text,
  '--fc-paper': t.paper,
  '--fc-font': t.font,
});

/** One diagram. `fingering` is the terse spec: { label, down: [...] }. */
export function Fingering({ instrument, fingering, title = true, width, theme, ...rest }) {
  const svg = useMemo(
    () => renderFingering(instrument, fingering, { title, width }),
    [instrument, fingering, title, width],
  );
  return <div style={themeVars(theme)} dangerouslySetInnerHTML={{ __html: svg }} {...rest} />;
}

/** A grid of diagrams — a printable chart sheet. */
export function Chart({ instrument, fingerings, columns = 9, width, theme, ...rest }) {
  const svg = useMemo(
    () => renderChart(instrument, fingerings, { columns, width }),
    [instrument, fingerings, columns, width],
  );
  return <div style={themeVars(theme)} dangerouslySetInnerHTML={{ __html: svg }} {...rest} />;
}

/**
 * Editable diagram — click a key to cycle its state. Use this to author
 * fingering data rather than hand-writing key lists.
 */
export function FingeringEditor({ instrument: raw, value, onChange, cycle = ['open', 'closed', 'half', 'ring'], theme }) {
  const instrument = useMemo(() => resolveLayout(raw), [raw]);
  const states = useMemo(() => resolveStates(instrument, value), [instrument, value]);
  const [, , w, h] = instrument.viewBox;

  const bump = (id) => {
    const i = cycle.indexOf(states[id]);
    const next = cycle[(i + 1) % cycle.length];
    onChange({ ...value, states: { ...(value.states || {}), [id]: next } });
  };

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ ...themeVars(theme), width: '100%', maxWidth: w * 1.6 }}>
      <g dangerouslySetInnerHTML={{ __html: DEFS }} />
      {instrument.keys.map((k) => {
        const [ox, oy] = instrument.panels?.find((p) => p.id === (k.panel || 'front'))?.origin || [0, 0];
        const geo = { ...k, state: states[k.id] };   // already resolved
        return (
          <g
            key={k.id}
            transform={`translate(${ox} ${oy})`}
            onClick={() => bump(k.id)}
            style={{ cursor: 'pointer' }}
            role="button"
            tabIndex={0}
            aria-label={`${k.label}: ${states[k.id]}`}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); bump(k.id); } }}
            dangerouslySetInnerHTML={{ __html: drawKey({ ...geo, hideWhenNA: false }) }}
          />
        );
      })}
    </svg>
  );
}
