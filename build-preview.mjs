import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(path.join(root, p), 'utf8');

const strip = (src) => src
  .replace(/^\s*import[^;]+;\s*$/gm, '')
  .replace(/^export\s*\{[^}]*\}\s*from[^;]+;\s*$/gm, '')   // re-exports
  .replace(/^export default[^;]+;\s*$/gm, '')
  .replace(/^export /gm, '');

const lib = ['src/keys.js', 'src/layout.js', 'src/render.js'].map((f) => strip(read(f))).join('\n');

const instruments = {};
for (const f of readdirSync(path.join(root, 'instruments')).sort()) {
  instruments[f.replace('.json', '')] = JSON.parse(read(`instruments/${f}`));
}
const data = {};
for (const f of readdirSync(path.join(root, 'fingerings')).sort()) {
  data[f.replace('.json', '')] = JSON.parse(read(`fingerings/${f}`));
}

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Fingering chart components</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root {
    --fc-ink: #141b22;
    --fc-ink-2: #6f8193;
    --fc-highlight: #e2553b;
    --fc-line: #9aa6b2;
    --fc-key: #eef1f4;
    --fc-accent: #141b22;
    --fc-text: #141b22;
    --fc-paper: #ffffff;
    --fc-font: Poppins, system-ui, sans-serif;
    --rule: #e3e7eb;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 24px 18px 72px;
    background: var(--fc-paper); color: var(--fc-ink);
    font-family: var(--fc-font); line-height: 1.5;
  }
  .wrap { max-width: 980px; margin: 0 auto; }
  h1 { font-size: 1.55rem; font-weight: 600; letter-spacing: -0.01em; margin: 0 0 4px; }
  .sub { margin: 0 0 26px; font-size: .92rem; opacity: .72; max-width: 60ch; }
  h2 { font-size: 1.05rem; font-weight: 600; margin: 34px 0 10px; padding-bottom: 6px; border-bottom: 1px solid var(--rule); }
  p.hint { font-size: .85rem; opacity: .7; margin: 0 0 14px; max-width: 62ch; }
  .legend { display: grid; grid-template-columns: repeat(auto-fill, minmax(128px, 1fr)); gap: 14px 10px; }
  #states { grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); }
  .legend figure { margin: 0; text-align: center; }
  .legend figcaption { font-size: .74rem; opacity: .75; margin-top: 4px; }
  .scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; padding-bottom: 6px; }
  .scroll svg { display: block; }
  .gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 18px; align-items: end; }
  .gallery figure { margin: 0; text-align: center; }
  .gallery figcaption { font-size: .76rem; opacity: .8; margin-top: 6px; }
  .gallery svg { max-width: 100%; height: auto; }
  code { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: .82em; background: rgba(31,51,64,.06); padding: 1px 4px; border-radius: 3px; }
  pre { background: rgba(31,51,64,.05); padding: 12px 14px; border-radius: 6px; overflow-x: auto; font-size: .78rem; line-height: 1.45;
        font-family: ui-monospace, Menlo, Consolas, monospace; }
</style>
</head>
<body>
<div class="wrap">
  <h1>Fingering chart components</h1>
  <p class="sub">Shapes and states are the vocabulary; each instrument is a layout of named keys; each note is just a list of which keys are down.</p>

  <h2>Key shapes</h2>
  <div class="legend" id="shapes"></div>

  <h2>Key states</h2>
  <div class="legend" id="states"></div>

  <h2>Saxophone, written range</h2>
  <p class="hint">Generated from <code>instruments/saxophone.json</code> and <code>fingerings/saxophone.json</code>. Scroll sideways on a narrow screen.</p>
  <div class="scroll" id="sax"></div>

  <h2>Flute, first octave</h2>
  <p class="hint">Generated from <code>instruments/flute.json</code> and <code>fingerings/flute.json</code>: upright, then <code>orient: 'horizontal'</code>.</p>
  <div class="scroll" id="flute"></div>
  <div class="scroll" id="flute-h"></div>

  <h2>Clarinet</h2>
  <p class="hint">Generated from <code>instruments/clarinet.json</code> and <code>fingerings/clarinet.json</code>: upright, then <code>orient: 'horizontal'</code>.</p>
  <div class="scroll" id="clarinet"></div>
  <div class="scroll" id="clarinet-h"></div>

  <h2>Nuvo Dood</h2>
  <p class="hint">Generated from <code>instruments/nuvo-dood.json</code> and <code>fingerings/nuvo-dood.json</code>. A pad with a light dot is half-open: finger on the pad, vent hole uncovered.</p>
  <div class="scroll" id="dood"></div>

  <h2>Empty layouts</h2>
  <p class="hint">Every key in each instrument, all open — the sheet you fill in.</p>
  <div class="gallery" id="gallery"></div>

  <h2>Recorder, first octave</h2>
  <div class="scroll" id="recorder"></div>

  <h2>Writing a fingering</h2>
  <pre id="sample"></pre>
</div>

<script type="module">
${lib}

const INSTRUMENTS = ${JSON.stringify(instruments)};
const DATA = ${JSON.stringify(data)};

const set = (id, html) => { document.getElementById(id).innerHTML = html; };

/* shape legend: every shape, open and pressed */
const shapeDemos = [
  ['circle', { shape: 'circle', r: 10 }],
  ['circle · ringed', { shape: 'circle', r: 8.5, ringed: true }],
  ['circle · hole', { shape: 'circle', r: 10, hole: true }],
  ['oval', { shape: 'oval', rx: 11, ry: 6 }],
  ['pill', { shape: 'pill', w: 10, h: 22 }],
  ['bar', { shape: 'bar', w: 26, h: 7 }],
  ['spatula', { shape: 'spatula', w: 20, h: 17 }],
  ['plate', { shape: 'plate', w: 18, h: 16, radii: [8, 8, 2, 2] }],
  ['dome', { shape: 'dome', w: 22, h: 11 }],
  ['lever', { shape: 'lever', size: 'lg', x: 36 }],
  ['roller', { shape: 'roller', rx: 9, ry: 4.5 }],
  ['cylinder', { shape: 'cylinder', w: 5, h: 18, rot: 90 }],
  ['teardrop', { shape: 'teardrop', w: 12, h: 24 }],
  ['taper', { shape: 'taper', w: 9, h: 28 }],
  ['leaf', { shape: 'leaf', w: 10, h: 28 }],
  ['bean', { shape: 'bean', w: 9, h: 26, bend: 3 }],
  ['pin', { shape: 'pin', w: 9, h: 18, y: 26 }],
  ['lh-hook', { shape: 'lh-hook', w: 22, h: 9, stem: 10, y: 16 }],
  ['rh-hook', { shape: 'rh-hook', w: 22, h: 9, stem: 10, y: 16 }],
  ['flag', { shape: 'flag', w: 12, h: 32 }],
  ['crook', { shape: 'crook', w: 34, h: 12 }],
  ['paddle', { shape: 'paddle', w: 34, h: 9 }],
  ['ell', { shape: 'ell', w: 20, h: 18 }],
  ['note', { shape: 'note', w: 12, h: 24 }],
  ['saucer', { shape: 'saucer', rx: 12, ry: 6, depth: 3 }],
  ['saucer-top · sm', { shape: 'saucer-top', size: 'sm' }],
  ['saucer-top · md', { shape: 'saucer-top', size: 'md' }],
  ['saucer-top · lg', { shape: 'saucer-top', size: 'lg' }],
  ['stacked', { shape: 'stacked', r: 11 }],
  ['club', { shape: 'club', w: 8, h: 26 }],
];
set('shapes', shapeDemos.map(([name, geo]) =>
  \`<figure>\${['open', 'closed'].map((state) => \`<svg viewBox="0 0 60 40" width="60" height="40">\${DEFS}\${drawKey({ x: 30, y: 20, state, ...geo })}</svg>\`).join('')}<figcaption>\${name}</figcaption></figure>\`
).join(''));

set('states', STATES.map((state) =>
  \`<figure><svg viewBox="0 0 60 44" width="60" height="44">\${DEFS}\${drawKey({ shape: 'circle', x: 30, y: 24, r: 11, state, hideWhenNA: false })}</svg><figcaption>\${state}</figcaption></figure>\`
).join(''));

set('sax', renderChart(INSTRUMENTS.saxophone, DATA.saxophone.fingerings, { columns: 9, width: 1240, variant: '' }));
set('flute', renderChart(INSTRUMENTS.flute, DATA.flute.fingerings, { columns: 12, width: 1000 }));
set('flute-h', renderChart(INSTRUMENTS.flute, DATA.flute.fingerings, { columns: 3, width: 1240, orient: 'horizontal' }));
set('clarinet', renderChart(INSTRUMENTS.clarinet, DATA.clarinet.fingerings, { columns: 9, width: 1000 }));
set('clarinet-h', renderChart(INSTRUMENTS.clarinet, DATA.clarinet.fingerings, { columns: 3, width: 1240, orient: 'horizontal' }));
set('dood', renderChart(INSTRUMENTS['nuvo-dood'], DATA['nuvo-dood'].fingerings, { columns: 15, width: 1100 }));
set('recorder', renderChart(INSTRUMENTS.recorder, DATA.recorder.fingerings, { columns: 10, width: 1060 }));

set('gallery', Object.values(INSTRUMENTS).map((inst) =>
  \`<figure>\${renderFingering(inst, { label: '' }, { title: false, width: 130 })}<figcaption>\${inst.name}</figcaption></figure>\`
).join(''));

document.getElementById('sample').textContent = JSON.stringify(DATA.saxophone.fingerings[0], null, 2);
</script>
</body>
</html>
`;

writeFileSync(path.join(root, 'preview.html'), html);
console.log('preview.html', (html.length / 1024).toFixed(1), 'kB');
