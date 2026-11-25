// Validate every person file. Usage: node scripts/validate.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'data', 'people');
const CATS = ['origin', 'education', 'career', 'wealth', 'milestone', 'reputation', 'crisis'];
const TYPES = ['wiki', 'news', 'filing', 'market'];
const DATE = /^\d{4}(-\d{2}(-\d{2})?)?$/;
let errors = 0, warnings = 0;
const err = (id, msg) => { errors++; console.log(`  ✗ ${id}: ${msg}`); };
const warn = (id, msg) => { warnings++; console.log(`  ! ${id}: ${msg}`); };

const text = (id, where, o, required = true) => {
  if (o == null) { if (required) err(id, `${where}: missing`); return; }
  if (typeof o !== 'object' || !o.en || !String(o.en).trim()) err(id, `${where}: needs a non-empty "en"`);
};
const anchors = (id, where, a) => {
  if (!Array.isArray(a) || !a.length) return err(id, `${where}: needs at least one anchor`);
  let prev = '';
  for (const [d, v] of a) {
    if (!DATE.test(d)) err(id, `${where}: bad date ${d}`);
    if (typeof v !== 'number' || !(v >= 0)) err(id, `${where}: bad value at ${d}`);
    const k = d.padEnd(10, '-01'.repeat(2)).slice(0, 10);
    if (k < prev) err(id, `${where}: anchors not sorted at ${d}`);
    prev = k;
  }
};

const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
for (const id of index) {
  const file = path.join(dir, `${id}.json`);
  if (!fs.existsSync(file)) { err(id, 'listed in index.json but the file is missing'); continue; }
  let P;
  try { P = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { err(id, `invalid JSON: ${e.message}`); continue; }
  console.log(`${id}`);
  if (P.id !== id) err(id, `"id" must be "${id}"`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(P.born || '')) err(id, 'born must be YYYY-MM-DD');
  if (!/^[A-Z]{2,5}$/.test(P.ticker || '')) err(id, 'ticker must be 2–5 capital letters');
  text(id, 'name', P.name); text(id, 'tagline', P.tagline);
  (P.tags || []).forEach((x, i) => text(id, `tags[${i}]`, x));
  for (const k of ['human', 'audience', 'media']) anchors(id, k, P[k]);
  (P.privates || []).forEach((p, i) => { text(id, `privates[${i}].label`, p.label); anchors(id, `privates[${i}].anchors`, p.anchors); });
  if (!P.stocks?.length) err(id, 'needs at least one listed stock as an anchor');
  (P.stocks || []).forEach((s, i) => {
    text(id, `stocks[${i}].label`, s.label);
    if (!s.sym) err(id, `stocks[${i}]: missing sym`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.from || '')) err(id, `stocks[${i}].from must be YYYY-MM-DD`);
    anchors(id, `stocks[${i}].own`, s.own); anchors(id, `stocks[${i}].shares`, s.shares);
    if ((s.own || []).some(([, v]) => v > 1)) err(id, `stocks[${i}].own is a fraction (0.13 = 13%)`);
  });
  if (!P.chapters || P.chapters.length < 3) err(id, 'needs at least 3 chapters');
  (P.chapters || []).forEach((c, i) => { text(id, `chapters[${i}].t`, c.t); text(id, `chapters[${i}].desc`, c.desc); if (!DATE.test(c.from)) err(id, `chapters[${i}].from bad date`); });
  if (!P.events || P.events.length < 10) err(id, 'needs at least 10 events');
  let fives = 0;
  (P.events || []).forEach((e, i) => {
    const w = `events[${i}] (${e.d})`;
    if (!DATE.test(e.d || '')) err(id, `${w}: bad date`);
    if (!['day', 'month', 'year'].includes(e.p)) err(id, `${w}: p must be day/month/year`);
    if (e.p === 'day' && !/^\d{4}-\d{2}-\d{2}$/.test(e.d)) err(id, `${w}: day precision needs a full date`);
    if (!CATS.includes(e.cat)) err(id, `${w}: cat must be one of ${CATS.join(', ')}`);
    if (![-1, 0, 1].includes(e.dir)) err(id, `${w}: dir must be -1, 0 or 1`);
    if (!(Number.isInteger(e.mag) && e.mag >= 1 && e.mag <= 5)) err(id, `${w}: mag must be 1–5`);
    if (!(typeof e.rep === 'number' && Math.abs(e.rep) <= 0.06)) err(id, `${w}: rep must be between -0.06 and 0.06`);
    for (const k of ['s', 't', 'summary', 'why']) text(id, `${w}.${k}`, e[k]);
    text(id, `${w}.fin`, e.fin, false);
    if (e.s?.en && e.s.en.length > 20) warn(id, `${w}: chart label "${e.s.en}" is long (${e.s.en.length} chars)`);
    if (!Array.isArray(e.src) || !e.src.length) err(id, `${w}: needs at least one source`);
    (e.src || []).forEach((s) => { if (!s.name || !/^https?:\/\//.test(s.url || '') || !TYPES.includes(s.type)) err(id, `${w}: bad source ${JSON.stringify(s).slice(0, 80)}`); });
    if (e.mag === 5) fives++;
  });
  if (fives > 8) warn(id, `${fives} events have mag 5; the rubric asks for 4–8`);
}
console.log(`\n${index.length} people, ${errors} errors, ${warnings} warnings`);
process.exit(errors ? 1 : 0);
