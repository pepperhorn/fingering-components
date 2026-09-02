/* Generates layouts for the hole-based (mostly keyless) instruments.
   Keeps hole spacing consistent across the family so charts sit side by side. */
import { writeFileSync } from 'node:fs';

const X = 40;          // centre line of the front holes
const TOP = 44;        // first front hole
const STEP = 27;       // hole spacing
const DBL = 9;         // horizontal offset for double holes

function holes(spec) {
  const out = [];
  spec.forEach((h, i) => {
    const y = TOP + i * STEP;
    const hand = i < 3 ? 'L' : 'R';
    const digit = String((i % 3) + 1);
    if (h.double) {
      out.push({ id: `h${i + 1}a`, label: `Hole ${i + 1} (upper)`, shape: 'circle', r: 6, x: X - DBL, y, hand, digit, group: `h${i + 1}` });
      out.push({ id: `h${i + 1}b`, label: `Hole ${i + 1} (lower)`, shape: 'circle', r: 6, x: X + DBL, y, hand, digit, group: `h${i + 1}` });
    } else {
      out.push({ id: `h${i + 1}`, label: `Hole ${i + 1}`, shape: 'circle', r: h.r ?? 9, x: X, y, hand, digit, group: `h${i + 1}` });
    }
  });
  return out;
}

function build({ id, name, family, note, count, doubles = [], thumb = true, extraKeys = [] }) {
  const spec = Array.from({ length: count }, (_, i) => ({ double: doubles.includes(i + 1) }));
  const front = holes(spec);
  const height = TOP + (count - 1) * STEP + 34;
  const layout = {
    id, name, family,
    ...(note ? { note } : {}),
    viewBox: [0, 0, thumb ? 118 : 80, height],
    defaults: { circle: { r: 9 }, pill: { w: 8, h: 14 } },
    panels: thumb
      ? [{ id: 'front' }, { id: 'rear', label: 'back', origin: [78, 34], box: [0, 0, 34, 40] }]
      : [{ id: 'front' }],
    keys: [
      ...(thumb ? [{ id: 'thumb', label: 'Thumb hole', shape: 'circle', r: 8, x: 17, y: 20, panel: 'rear', hand: 'L', digit: 'thumb', group: 'rear' }] : []),
      ...front,
      ...extraKeys,
    ],
  };
  writeFileSync(new URL(`./instruments/${id}.json`, import.meta.url), JSON.stringify(layout, null, 2) + '\n');
  console.log('wrote', id, layout.keys.length, 'keys');
}

build({
  id: 'recorder',
  name: 'Recorder (baroque fingering)',
  family: 'recorder',
  note: 'Thumb takes half/quarter states for pinching. Holes 6 and 7 are double on most baroque instruments; treat h6a/h6b and h7a/h7b as one hole on a German-fingering or single-hole instrument.',
  count: 7,
  doubles: [6, 7],
});

build({
  id: 'tin-whistle',
  name: 'Tin whistle',
  family: 'fipple',
  note: 'Six holes, no thumb hole. Second octave is produced by overblowing, not by a key, so octave is carried in the fingering metadata rather than as a key state.',
  count: 6,
  thumb: false,
});

build({
  id: 'nuvo-toot',
  name: 'Nuvo TooT',
  family: 'fipple',
  note: 'PROVISIONAL LAYOUT — confirm against the instrument in hand before publishing. Modelled as recorder-style: thumb plus six front holes, with two keyed touchpieces on the lower joint.',
  count: 6,
  extraKeys: [
    { id: 'key-1', label: 'Lower key 1', shape: 'pill', w: 8, h: 14, x: 60, y: 152, hand: 'R', digit: '3', group: 'keys' },
    { id: 'key-2', label: 'Lower key 2', shape: 'pill', w: 8, h: 14, x: 60, y: 178, hand: 'R', digit: '4', group: 'keys' },
  ],
});

build({
  id: 'nuvo-dood',
  name: 'Nuvo Dood',
  family: 'single-reed',
  note: 'PROVISIONAL LAYOUT — confirm hole count against the instrument in hand before publishing. Modelled as thumb plus five front holes with a simplified reed mouthpiece.',
  count: 5,
});
