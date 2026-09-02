import { readFileSync, readdirSync } from 'node:fs';
import { renderChart, renderFingering, resolveStates } from './src/render.js';
const J = p => JSON.parse(readFileSync(p,'utf8'));
for (const f of readdirSync('instruments')) {
  const inst = J(`instruments/${f}`);
  const ids = new Set(inst.keys.map(k=>k.id));
  if (ids.size !== inst.keys.length) throw new Error(`${inst.id}: duplicate key ids`);
  const svg = renderFingering(inst, {label:'test'});
  console.log(inst.id.padEnd(14), inst.keys.length, 'keys,', svg.length, 'chars');
}
for (const f of readdirSync('fingerings')) {
  const d = J(`fingerings/${f}`);
  const inst = J(`instruments/${d.instrument}.json`);
  d.fingerings.forEach(fg => { resolveStates(inst, fg); (fg.alternates||[]).forEach(a=>resolveStates(inst,a)); });
  const svg = renderChart(inst, d.fingerings, {columns:9});
  console.log(d.instrument.padEnd(14), d.fingerings.length, 'fingerings ok,', svg.length, 'chars');
}
