import { readFileSync, readdirSync } from 'node:fs';
import { renderChart, renderFingering, resolveStates } from './src/render.js';
const J = p => JSON.parse(readFileSync(p,'utf8'));
for (const f of readdirSync('instruments')) {
  const inst = J(`instruments/${f}`);
  const ids = new Set(inst.keys.map(k=>k.id));
  if (ids.size !== inst.keys.length) throw new Error(`${inst.id}: duplicate key ids`);
  // uniform pitch schema: transpose everywhere; horns agree with the default
  if (!Number.isInteger(inst.transpose)) throw new Error(`${inst.id}: "transpose" (semitones written → sounding) is required`);
  if ('transposing' in inst) throw new Error(`${inst.id}: "transposing" is replaced by "transpose"`);
  if (inst.horns) {
    if (!inst.horns[inst.horn]) throw new Error(`${inst.id}: default "horn" must name one of "horns"`);
    if (inst.horns[inst.horn].transpose !== inst.transpose) throw new Error(`${inst.id}: "transpose" must match the default horn`);
    for (const [h, v] of Object.entries(inst.horns)) if (!Number.isInteger(v.transpose)) throw new Error(`${inst.id}: horn ${h} needs "transpose"`);
  }
  const svg = renderFingering(inst, {label:'test'});
  console.log(inst.id.padEnd(14), inst.keys.length, 'keys,', svg.length, 'chars');
}
for (const f of readdirSync('fingerings')) {
  const d = J(`fingerings/${f}`);
  const inst = J(`instruments/${d.instrument}.json`);
  if (d.pitch !== 'written') throw new Error(`${f}: fingerings are stored at written pitch ("pitch": "written")`);
  if (d.horn && !inst.horns?.[d.horn]) throw new Error(`${f}: horn "${d.horn}" is not in ${d.instrument}'s horns`);
  d.fingerings.forEach((fg) => { if (fg.note && !Number.isInteger(fg.octave)) throw new Error(`${f}: ${fg.note} needs an integer written "octave"`); });
  d.fingerings.forEach(fg => { resolveStates(inst, fg); (fg.alternates||[]).forEach(a=>resolveStates(inst,a)); });
  const svg = renderChart(inst, d.fingerings, {columns:9});
  console.log(d.instrument.padEnd(14), d.fingerings.length, 'fingerings ok,', svg.length, 'chars');
}
