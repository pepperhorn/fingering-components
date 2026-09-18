# Fingering chart components

SVG key shapes and a JSON spec for building fingering charts across woodwind
(and, with the same primitives, valved brass) instruments.

The design splits into three layers, and the split is the whole point:

| Layer | Answers | Changes when |
| --- | --- | --- |
| **Shapes** (`src/keys.js`) | what a key looks like | never, more or less |
| **Layout** (`instruments/*.json`) | where each key sits, what it's called | you add an instrument |
| **Fingering** (`fingerings/*.json`) | which keys are down for this note | constantly |

Because the layout owns geometry, a fingering is just a list of key ids. That
makes the note-by-note data terse enough to hand-write, diff in git, or
generate from a spreadsheet.

```
{ "note": "Bb", "octave": 1, "down": ["lh1","lh2","lh3","rh1","rh2","rh3","lh-bb"] }
```

## Try it

```bash
node verify.mjs        # validates every layout and every fingering reference
node build-preview.mjs # rebuilds preview.html
open preview.html      # shape legend, state legend, rendered charts
```

No dependencies and no build step — plain ES modules, and the JSON is plain
JSON. `build-preview.mjs` only exists to inline everything into one file you
can open from the filesystem.

## Shapes

| Shape | Used for |
| --- | --- |
| `circle` | tone holes, pearl touchpieces, ring keys, thumb holes |
| `oval` | bis key, alternate F♯, side touchpieces, rollers |
| `pill` | side keys, trill keys, thumb levers |
| `bar` | long lever bars (flute B♭ bar, clarinet linkage) |
| `spatula` | pinky tables — sax LH G♯/C♯/B/B♭ and RH E♭/C, clarinet levers, flute foot |
| `lever` | stemmed side/trill levers; `size` sm/md/lg, rod stem with pivot (`stemStyle: "line"` for the hairline) |
| `roller` | paired rollers between spatulas |
| `teardrop` (alias `drop`) | sax palm keys, and any bulb-and-taper touchpiece |
| `taper` | long, slim tapered drop — engraved-chart palm keys |
| `leaf` | almond pad, widest in the middle — realistic palm keys |
| `bean` | curved, optionally tapered capsule — side keys, clarinet throat A/G♯, sax low B♭ |
| `plate` | rectangle with per-corner `radii` — tiles into pinky tables |
| `dome` | half-ellipse on a flat base — table end caps, split-circle pinky pair |
| `cylinder` | roller seen side-on — sits between pinky keys |
| `pin` | teardrop hung from a pivot pearl on an arm |
| `lh-hook` (alias `hook`) | lobe pointing left, rod down its right side — clarinet RH pinky and trill keys |
| `rh-hook` | mirrored hook, rod on the left — clarinet LH pinky F/C |

`circle` also takes `ringed: true` (a ring key's metal ring) and `hole: true`
(an open tone hole whose centre stays empty until covered; themable with
`--fc-hole`).

Geometry is per-key and optional: `r`, `rx`/`ry`, `w`/`h`, `rad`, `rot`.
Family defaults live in the layout's `defaults` block, keyed by shape name.

`teardrop` takes `w` (bulb diameter), `h` (overall length), and `tipRound`
(how blunt the point is — drop it toward 0 for a needle, raise it for a pear).
The tip points up by default; `dir` aims it (`up`, `down`, `left`, `right`, or
the four diagonals) and stacks with any `rot`. `dir` works on every shape, so
`lever` and `bar` can use it too. If `h` gets close to `w` the taper has
nowhere to go and the shape falls back to a plain bulb rather than breaking.

Partial fills follow the shape: a `half` teardrop fills from the bulb end up,
which is what you want when a chart shows a palm key only partly depressed.

## Themes, highlight and two-tone

Colours are CSS custom properties: `--fc-ink` (pressed), `--fc-line`
(outline), `--fc-key` (unpressed surface), `--fc-accent`, `--fc-highlight`,
`--fc-ink-2` (second tone), `--fc-text`, `--fc-font`, `--fc-stroke`. The
`highlight` state calls a key out; `{ twoTone: 'hand' }` draws right-hand
keys in `--fc-ink-2`. Setting `--fc-key: none; --fc-stroke: 1.1` with a serif
font gives the original outline look.

## Orientation and looks

`renderFingering` and `renderChart` take `orient: 'horizontal'` (the
instrument on its side, mouthpiece left; labels stay upright) and
`look: 'ghost'` (whole diagram faded via `--fc-ghost`) or `look: 'dotted'`
(unpressed keys as dotted, unfilled outlines; pressed keys stay solid). Every
key is wrapped in `<g class="fc-key" data-key="…" data-state="…">`, so an app
can restyle or animate individual keys — e.g. dotted fingerings falling onto
a ghosted instrument, piano-tiles style.

## Layout variants

A layout can carry named, additive overrides under `variants`. Pass one or
several: `renderChart(sax, notes, { variant: 'palm-taper side-levers' })`.
The saxophone defaults to leaf palm keys and ships `palm-teardrop`, `palm-bean`, `palm-taper`, `side-levers`,
`side-pills`, `high-fs-single`, `rh-table-stacked`, `lh-table-domes`, `rh-table-domes`,
`lh-table-spatulas` and `rh-table-spatulas`; the clarinet ships
`throat-pills` and `ring-keys`.

## States

| State | Meaning |
| --- | --- |
| `open` | uncovered / not pressed (outline) |
| `closed` | covered / pressed (solid) |
| `half` | half-holed — recorder and whistle |
| `quarter`, `three-q` | finer thumb pinch gradations |
| `ring` | ring or plateau touched, hole stays open (clarinet, open-hole flute) |
| `optional` | dashed — may be added for tuning or stability |
| `alt` | hatched — belongs to an alternate fingering being shown alongside |
| `trill` | caret above the key — flick or trill action |
| `na` | key absent on this variant (hidden by default) |

`fillFrom` on a key sets which edge partial fills grow from
(`bottom` default, or `top` / `left` / `right`).

## Positioning: where to tweak

Three ways to place a key. Absolute coordinates still work everywhere — the
other two are for the cases where the *relationship between shapes* is what
you're actually adjusting, like a pinky table.

### 1. Absolute — `x`, `y`

The centre point, in viewBox units. Fine for the stacks and one-off keys.

### 2. Cluster — `cluster` + `flow`

A cluster owns an anchor, an optional rotation, shape defaults, and a flow rule
that positions its members. Keys join by naming it. This is the level you want
for pinky tables: nudge the anchor and every lever moves together, change
`rotate` and the whole table leans.

```jsonc
{
  "id": "lh-table",
  "anchor": [23, 188],       // origin for member offsets
  "rotate": -7,              // degrees, about the anchor; members inherit it
  "flow": { "axis": "y", "pitch": 15.5, "drift": -1.4 },
  "defaults": { "shape": "spatula", "w": 15, "h": 13, "rad": 5 }
}
```

Flow rules:

| Field | Effect |
| --- | --- |
| `axis` | `x` or `y` — the direction members march in |
| `pitch` | centre-to-centre spacing along that axis |
| `drift` | steady cross-axis lean, per step — a column that slides sideways |
| `stagger` | alternating cross-axis offset — the sax palm keys |
| `shape: "arc"` | fan members around the anchor instead of in a line |
| `radius`, `startAngle`, `step` | arc geometry; negative `step` reverses direction |
| `rotateMembers` | tilt each member tangentially to the arc |
| `memberRotate` | constant added to that tilt |
| `tilt` | multiplier on the tilt, 0–1, when the full tangent is too dramatic |

Member order in the `keys` array sets flow index. Override with `index` to
leave a gap (sax `side-e` sits at index 3, skipping 2), or with `dx`/`dy` to
opt out of the flow entirely. `ddx`/`ddy` nudge a single member without
leaving the flow — that's how the sax low B and B♭ step further left than
G♯ and C♯.

Arc clusters are what the clarinet lever groups want. The anchor is the pivot
*outside* the fan, so the levers curve away from the body:

```jsonc
{
  "id": "lh-table",
  "anchor": [66, 176],
  "flow": { "shape": "arc", "radius": 46, "startAngle": 195, "step": -16,
            "rotateMembers": true, "memberRotate": -180, "tilt": 0.5 }
}
```

### 3. Relative — `relativeTo` + `place`

Butt one key against another's edge. Gaps stay correct when you resize either
shape, which absolute coordinates don't.

```jsonc
{ "id": "lh2", "relativeTo": "lh1", "place": "below", "gap": 10 }
{ "id": "bis", "relativeTo": "lh1", "place": "below", "gap": 0, "offset": [16, 0] }
```

`place` is `above` / `below` / `left` / `right` / `same`. `gap` is edge-to-edge
and may be negative to overlap. `offset` is a free `[x, y]` nudge applied after
placement. Rotation is inherited from the reference unless
`inheritRotation: false`. Chains resolve in any order; a cycle throws.

### `align` — which point of the shape sits on the coordinate

Default is `center`. Set `top`, `bottom`, `left`, `right`, or a combination
like `top-left`, and the coordinate becomes that edge or corner instead. Use it
when spatulas of different heights need to share an edge rather than a centre
line.

### Checking your work

`contentBounds(layout)` returns the bounding box of every key, rotation-safe.
Compare it against `viewBox` after moving things, or use it to auto-fit.

```js
import { contentBounds, resolveLayout } from './src/render.js';
contentBounds(clarinet);              // [x, y, w, h]
resolveLayout(saxophone).byId['lh-b'] // final absolute x, y, rot
```

## Layout schema

```jsonc
{
  "id": "saxophone",
  "name": "Saxophone",
  "family": "single-reed",
  "viewBox": [0, 0, 108, 286],
  "defaults": { "circle": { "r": 9 }, "pill": { "w": 8, "h": 15 } },
  "panels": [
    { "id": "front" },
    // a rear panel is how the thumb side gets drawn: flute's two back keys,
    // clarinet's thumb hole + register key, recorder's thumb hole
    { "id": "rear", "label": "back", "origin": [92, 26], "box": [0, 0, 36, 66] }
  ],
  "keys": [
    {
      "id": "lh1",              // stable, referenced by every fingering
      "label": "Left 1 (B)",    // human-readable, used for accessibility
      "shape": "circle",
      "x": 41, "y": 44,         // centre point, in viewBox units
      "panel": "front",         // omit for front
      "hand": "L",              // L | R  — for teaching overlays and filtering
      "digit": "1",             // 1..4 | thumb | palm
      "group": "lh-stack",      // for highlighting a whole cluster
      "default": "open"         // e.g. flute rh-eb defaults to closed
    }
  ]
}
```

## Fingering schema

Everything not named is `open` (or the key's `default`).

```jsonc
{
  "note": "Bb",
  "octave": 1,
  "note_text": "alternate B♭ fingerings",  // small annotation under the label
  "down": ["lh1", "bis"],
  "half": ["thumb"],
  "ring": ["lh2"],
  "optional": ["rh-eb"],
  "trill": ["trill-d"],
  "states": { "lh3": "alt" },              // explicit override, wins over the above
  "alternates": [ { "down": ["lh1", "side-bb"] } ]
}
```

## Rendering

```js
import { renderFingering, renderChart } from './src/render.js';
import sax from './instruments/saxophone.json' with { type: 'json' };
import data from './fingerings/saxophone.json' with { type: 'json' };

renderChart(sax, data.fingerings, { columns: 9 });   // full sheet, SVG string
renderFingering(sax, data.fingerings[0]);            // single diagram
```

React wrappers are in `src/react.jsx` — `<Fingering>`, `<Chart>`, and
`<FingeringEditor>` (click a key to cycle its state, so charts get authored by
clicking rather than by typing key ids).

Theme through CSS custom properties: `--fc-ink`, `--fc-line`, `--fc-paper`,
`--fc-font`.

## Instruments

| File | Status |
| --- | --- |
| `saxophone.json` | complete — 23 keys, teardrop palm keys, written range B♭ to F♯ in `fingerings/` |
| `flute.json` | complete — includes both rear thumb keys, trill keys, B-foot |
| `clarinet.json` | complete — 17-key Boehm, rear thumb hole + register, both pinky clusters |
| `recorder.json` | complete — thumb plus 7 holes, 6 and 7 doubled |
| `tin-whistle.json` | complete — six holes, no thumb |
| `nuvo-toot.json` | **provisional** — hole and key count needs checking against the instrument |
| `nuvo-dood.json` | **provisional** — hole count needs checking against the instrument |

Fingering data exists for saxophone (full normal range) and recorder (first
octave naturals). Sax altissimo is deliberately excluded: it varies by horn,
mouthpiece and player, so it belongs in a per-player overlay rather than the
shared chart.

## Extending to brass

The same layer split works — replace the layout with three or four `circle`
valves (or `pill` trombone positions), keep `open` / `closed` / `half`, and
nothing in the renderer changes.

## Files

```
src/keys.js          shape primitives, states, bounding boxes
src/layout.js        clusters, flows, alignment, relative placement
src/render.js        resolved layout + fingering -> SVG
src/react.jsx        React wrappers, including a click-to-author editor
instruments/*.json   key layouts
fingerings/*.json    note data
build-simple.mjs     generates the hole-based layouts on a shared grid
build-preview.mjs    bundles everything into preview.html
verify.mjs           validates every layout and every fingering reference
```
