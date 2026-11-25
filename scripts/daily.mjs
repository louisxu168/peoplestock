// Daily report: rebuild every life from fresh prices, print the leaderboard,
// and list recent big moves that no sourced event explains.
//
//   node scripts/daily.mjs            # human-readable report
//   node scripts/daily.mjs --json     # machine-readable, used by the GitHub Action to open issues
//
// "Recent" = the last 5 trading days. A move counts when |daily change| >= ANOMALY_THRESHOLD
// and no day-precision event sits within 3 trading days of it.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await import(pathToFileURL(path.join(root, 'src', 'model.js')).href);
const PS = globalThis.PS;
const read = (...p) => JSON.parse(fs.readFileSync(path.join(root, ...p), 'utf8'));

const ids = read('data', 'people', 'index.json');
const prices = {};
for (const f of fs.readdirSync(path.join(root, 'data', 'prices'))) if (f !== 'index.json') prices[f.replace(/\.json$/, '')] = read('data', 'prices', f);

const board = [], moves = [];
for (const id of ids) {
  const M = PS.buildPerson(read('data', 'people', `${id}.json`), prices), S = PS.stats(M), d = M.days, n = d.length;
  board.push({ id, name: M.P.name.en, cap: S.last.c, day: S.ch, year: S.chY, fromAth: S.fromAth, asOf: PS.fmtDn(M.today) });
  const sourced = M.events.filter((e) => !e.auto && e.p === 'day').map((e) => e.k);
  for (let i = Math.max(1, n - 5); i < n; i++) {
    const ch = d[i].c / d[i - 1].c - 1;
    if (Math.abs(ch) < PS.CONST.ANOMALY_THRESHOLD || sourced.some((k) => Math.abs(k - i) <= 3)) continue;
    moves.push({ id, name: M.P.name.en, date: PS.fmtDn(d[i].dn), change: ch, cap: d[i].c, symbols: M.P.stocks.map((s) => s.sym) });
  }
}
board.sort((a, b) => b.cap - a.cap);

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ board, moves }, null, 2));
} else {
  console.log(`PeopleStock daily · prices as of ${board[0].asOf}\n`);
  board.forEach((b, i) => console.log(`${String(i + 1).padStart(2)}. ${b.name.padEnd(18)} ${PS.moneyIn('en', b.cap, true).padStart(8)}  today ${PS.pct(b.day, 1).padStart(7)}  1y ${PS.pct(b.year, 0).padStart(6)}  from peak ${PS.pct(b.fromAth, 0)}`));
  console.log(moves.length ? '\nUnexplained moves in the last 5 trading days (need a sourced event):' : '\nNo unexplained moves in the last 5 trading days.');
  for (const m of moves) console.log(`  ${m.date}  ${m.name}  ${PS.pct(m.change, 1)}  (${m.symbols.join(', ')})`);
}
