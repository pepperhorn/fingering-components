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

// --- skill-level ranges -------------------------------------------------
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const midi = (s) => {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(s);
  if (!m) throw new Error(`bad pitch "${s}"`);
  return (Number(m[3]) + 1) * 12 + PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
};
const fmidi = (fg) => midi(`${fg.note}${fg.octave}`);
// which fingering sheets belong to an instrument (+ horn)
const sheetsFor = (id, horn) => readdirSync('fingerings')
  .map((f) => J(`fingerings/${f}`))
  .filter((d) => d.instrument === id && (!d.horn || !horn || d.horn === horn));
// chromatic notes an instrument genuinely cannot finger (reported, not fatal)
const RANGE_GAPS_OK = {};
const LEVELS = ['beginner', 'intermediate', 'pro'];
for (const f of readdirSync('instruments')) {
  const inst = J(`instruments/${f}`);
  const hornIds = inst.horns ? Object.keys(inst.horns) : [undefined];
  for (const horn of hornIds) {
    const r = (horn && inst.horns[horn].ranges) || inst.ranges;
    if (!r) throw new Error(`${inst.id}${horn ? `/${horn}` : ''}: "ranges" is required`);
    const span = LEVELS.map((l) => {
      if (!r[l]) throw new Error(`${inst.id}: ranges.${l} missing`);
      const lo = midi(r[l].low), hi = midi(r[l].high);
      if (lo > hi) throw new Error(`${inst.id}: ranges.${l} low > high`);
      return [lo, hi];
    });
    for (let i = 1; i < span.length; i++) {
      if (span[i][0] > span[i - 1][0] || span[i][1] < span[i - 1][1])
        throw new Error(`${inst.id}${horn ? `/${horn}` : ''}: ranges.${LEVELS[i - 1]} must sit inside ranges.${LEVELS[i]}`);
    }
    const sheets = sheetsFor(inst.id, horn);
    if (!sheets.length) continue;          // layout without fingering data yet
    const have = new Set(sheets.flatMap((d) => d.fingerings.filter((fg) => fg.note).map(fmidi)));
    const [lo, hi] = span[2];
    const gaps = [];
    for (let m = lo; m <= hi; m++) if (!have.has(m)) gaps.push(m);
    const allowed = new Set(RANGE_GAPS_OK[`${inst.id}${horn ? `/${horn}` : ''}`] || []);
    const bad = gaps.filter((m) => !allowed.has(m));
    if (bad.length) throw new Error(`${inst.id}${horn ? `/${horn}` : ''}: pro range has no fingering for midi ${bad.join(', ')}`);
    console.log(`${(inst.id + (horn ? `/${horn}` : '')).padEnd(22)} ranges ok`);
  }
}

// --- register names -----------------------------------------------------
// Ordered half-open bands at written pitch: each runs from its "from" up to
// (not including) the next one's, the last to the top of the instrument.
// Consumers drop the octave digit ("High G", not "G5"), so a band must never
// be wide enough to hold two notes of the same pitch class — see the
// collision check below.
const REGISTER_NAMES = ['Lowest', 'Low', 'Middle', 'High', 'Altissimo'];
const PITCH_CLASS = (m) => ((m % 12) + 12) % 12;
for (const f of readdirSync('instruments')) {
  const inst = J(`instruments/${f}`);
  const hornIds = inst.horns ? Object.keys(inst.horns) : [undefined];
  for (const horn of hornIds) {
    const who = `${inst.id}${horn ? `/${horn}` : ''}`;
    // a horn may carry its own registers beside its own ranges (tin whistles do)
    const regs = (horn && inst.horns[horn].registers) || inst.registers;
    if (!Array.isArray(regs) || !regs.length)
      throw new Error(`${who}: "registers" is required (an ordered, non-empty list of bands)`);
    const from = regs.map((b) => {
      if (!REGISTER_NAMES.includes(b.name))
        throw new Error(`${who}: register name "${b.name}" must be one of ${REGISTER_NAMES.join(', ')}`);
      try { return midi(b.from); }
      catch { throw new Error(`${who}: register "${b.name}" has a bad written pitch "${b.from}"`); }
    });
    for (let i = 1; i < from.length; i++)
      if (from[i] <= from[i - 1])
        throw new Error(`${who}: registers must ascend; ${regs[i].name} "${regs[i].from}" is not above ${regs[i - 1].name} "${regs[i - 1].from}"`);
    const sheets = sheetsFor(inst.id, horn);
    if (!sheets.length) continue;          // layout without fingering data yet
    const lo = Math.min(...sheets.flatMap((d) => d.fingerings.filter((fg) => fg.note).map(fmidi)));
    if (from[0] !== lo)
      throw new Error(`${who}: the first register starts at "${regs[0].from}" (midi ${from[0]}), but the lowest fingering is midi ${lo}`);

    // A register name is rendered without the octave digit ("High G"), so two
    // fingerings in the same band that share a pitch class would print the
    // same name for two different notes. Walk the real fingerings and prove
    // it cannot happen.
    const bandOf = (m) => { let i = -1; while (i + 1 < from.length && from[i + 1] <= m) i++; return i; };
    const seen = regs.map(() => new Map());   // band index -> pitch class -> "C5"
    const clashes = [];
    for (const d of sheets)
      for (const fg of d.fingerings) {
        if (!fg.note) continue;
        const m = fmidi(fg), i = bandOf(m), spelled = `${fg.note}${fg.octave}`;
        if (i < 0)
          throw new Error(`${who}: ${spelled} is below the first register (${regs[0].name} "${regs[0].from}"), so it has no register name`);
        const pc = PITCH_CLASS(m), had = seen[i].get(pc);
        if (had) clashes.push(`${regs[i].name} ${fg.note}: ${had} and ${spelled}`);
        else seen[i].set(pc, spelled);
      }
    if (clashes.length)
      throw new Error(
        `${who}: register bands collide — these notes would render the same register name:\n` +
        clashes.map((c) => `    ${c}`).join('\n') +
        `\n  Bands: ${regs.map((b) => `${b.name} ${b.from}`).join(' | ')}` +
        `\n  A band must span less than an octave; anchor the bands on C (the written octave) so each name is unique.`
      );

    const named = regs.map((b, i) => `${b.name} ${[...seen[i].values()].length}`).join(', ');
    console.log(`${who.padEnd(22)} registers ok   ${regs.map((b) => `${b.name} ${b.from}`).join(' | ')}   (no collisions: ${named})`);
  }
}
