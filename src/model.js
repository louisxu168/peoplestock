/* PeopleStock valuation model. Pure functions, no DOM: runs in the browser and in Node.
 *
 *   life market cap = financial capital + human capital + reputation capital   (all USD)
 *
 * See docs/METHODOLOGY.md for the reasoning behind every constant in this file.
 */
(() => {
'use strict';
const PS = (globalThis.PS = globalThis.PS || {});

// ───────────── constants (the whole "algorithm" is these numbers + the code below) ─────────────
const C = PS.CONST = {
  USD_PER_AUDIENCE: 150,      // reputation capital per person reached, before the sentiment coefficient
  REP_HALFLIFE: 630,          // trading days (~2.5 years) for a reputation shock to halve
  REP_CLAMP: [0.5, 1.6],      // bounds of the reputation coefficient
  REP_SMOOTH: 15,             // days of smoothing on the coefficient, so no single day jumps
  HUMAN_SMOOTH: 150,          // trading days for human capital to climb toward a new step
  AUDIENCE_SMOOTH: 40,        // trading days of smoothing on audience growth
  PRIVATE_NOISE: [0.97, 0.006], // AR(1) persistence and daily sigma of simulated wobble on private holdings
  ATTENTION_WEIGHTS: { audience: 0.35, media: 0.40, search: 0.25 },
  ANOMALY_THRESHOLD: 0.09,    // |daily change| that gets flagged when no sourced event explains it
  ANOMALY_MAX: 8,
  ANOMALY_GAP: 60,            // trading days between two flagged anomalies
};

// ───────────── utils ─────────────
const DAY = 86400000;
const parseDate = PS.parseDate = (s) => {
  const [y, m = 1, d = 1] = String(s).split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY);
};
const dnToDate = PS.dnToDate = (dn) => new Date(dn * DAY);
const dnKey = (dn) => { const d = dnToDate(dn); return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate(); };
const keyToDn = (k) => Math.round(Date.UTC(Math.floor(k / 10000), Math.floor(k / 100) % 100 - 1, k % 100) / DAY);
const pad = (n) => String(n).padStart(2, '0');
const fmtDn = PS.fmtDn = (dn, tf = 'D') => {
  const d = dnToDate(dn); const y = d.getUTCFullYear(), m = pad(d.getUTCMonth() + 1), dd = pad(d.getUTCDate());
  return tf === 'Y' ? `${y}` : tf === 'M' ? `${y}-${m}` : `${y}-${m}-${dd}`;
};
const moneyIn = PS.moneyIn = (lang, v, short = false) => {
  const s = v < 0 ? '-' : ''; v = Math.abs(v);
  if (lang === 'zh') {
    if (v >= 1e12) return `${s}$${(v / 1e12).toFixed(short ? 2 : 3)}万亿`;
    if (v >= 1e8) return `${s}$${(v / 1e8).toLocaleString('en-US', { maximumFractionDigits: v >= 1e10 ? 0 : 1 })}亿`;
    if (v >= 1e4) return `${s}$${(v / 1e4).toLocaleString('en-US', { maximumFractionDigits: v >= 1e6 ? 0 : 1 })}万`;
    return `${s}$${Math.round(v).toLocaleString('en-US')}`;
  }
  const f = (x, u) => `${s}$${x >= 100 ? x.toFixed(short ? 0 : 1) : x >= 10 ? x.toFixed(1) : x.toFixed(2)}${u}`;
  if (v >= 1e12) return f(v / 1e12, 'T');
  if (v >= 1e9) return f(v / 1e9, 'B');
  if (v >= 1e6) return f(v / 1e6, 'M');
  if (v >= 1e3) return f(v / 1e3, 'K');
  return `${s}$${Math.round(v)}`;
};
const pct = PS.pct = (x, d = 2) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(d)}%`;

function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function gauss(r) { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
const hashSeed = (s) => { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

const prepAnchors = (a) => a.map(([d, v]) => [parseDate(d), v]).sort((x, y) => x[0] - y[0]);
function interp(anc, dn, mode = 'geo', before = 'clamp') {
  if (dn <= anc[0][0]) return before === 'zero' && dn < anc[0][0] ? 0 : anc[0][1];
  const last = anc[anc.length - 1];
  if (dn >= last[0]) return last[1];
  let i = 1; while (anc[i][0] < dn) i++;
  const [d0, v0] = anc[i - 1], [d1, v1] = anc[i];
  const t = (dn - d0) / (d1 - d0);
  if (mode === 'geo' && v0 > 0 && v1 > 0) return Math.exp(Math.log(v0) + (Math.log(v1) - Math.log(v0)) * t);
  if (mode === 'geo' && v0 === 0) return v1 * t * t * t * t; // growing from nothing: slow start, not a straight line
  return v0 + (v1 - v0) * t;
}
function stepVal(anc, dn) { let v = anc[0][1]; for (const [d, x] of anc) { if (d <= dn) v = x; else break; } return v; }

// ───────────── model ─────────────
/**
 * @param P       person file (data/people/<id>.json)
 * @param prices  { SYM: [[yyyymmdd, o, h, l, c], ...] }
 * @returns { P, days[], events[], chapters[], today }
 */
PS.buildPerson = function buildPerson(P, prices) {
  const idx = {};
  let today = 0;
  const syms = [...P.stocks.map((s) => s.sym), ...(P.options ? [P.options.sym] : [])];
  for (const sym of syms) {
    if (!prices[sym]) throw new Error(`${P.id}: no price data for ${sym}. Run: python scripts/fetch_prices.py`);
    if (!idx[sym]) { const m = new Map(); for (const r of prices[sym]) m.set(r[0], r); idx[sym] = m; }
    const rows = prices[sym]; today = Math.max(today, keyToDn(rows[rows.length - 1][0]));
  }
  const born = parseDate(P.born);
  const privates = P.privates.map((p) => ({ ...p, anc: prepAnchors(p.anchors), from: p.from ? parseDate(p.from) : -1e9, until: p.until ? parseDate(p.until) : 1e9 }));
  const stocks = P.stocks.map((s) => ({ ...s, from: parseDate(s.from), ownA: prepAnchors(s.own), shA: prepAnchors(s.shares) }));
  const opt = P.options ? { ...P.options, from: parseDate(P.options.from || '1900'), vestA: prepAnchors(P.options.vest), facA: prepAnchors(P.options.factor) } : null;
  const humanA = prepAnchors(P.human), audA = prepAnchors(P.audience), medA = prepAnchors(P.media);
  const events = P.events.map((e) => ({ ...e, dn: parseDate(e.d) })).sort((a, b) => a.dn - b.dn);

  const rnd = mulberry32(hashSeed(P.id));
  const days = [];
  let H = humanA[0][1], aud = 0, sent = 1, noise = 0, prev = null, evPtr = 0;
  const active = [];

  for (let dn = born; dn <= today; dn++) {
    const wd = dnToDate(dn).getUTCDay();
    if (wd === 0 || wd === 6) continue;
    const key = dnKey(dn);
    const live = stocks.filter((s) => dn >= s.from);
    let rows = null;
    if (live.length) {
      rows = live.map((s) => idx[s.sym].get(key));
      if (rows.some((r) => !r)) continue; // market holiday
    }
    while (evPtr < events.length && events[evPtr].dn <= dn) { active.push({ ev: events[evPtr], k: days.length }); evPtr++; }

    // human capital: step target, smooth climb
    H += (stepVal(humanA, dn) - H) / C.HUMAN_SMOOTH;

    // reputation capital: smoothed audience × $/head × sentiment coefficient
    aud += (interp(audA, dn, 'geo') - aud) / C.AUDIENCE_SMOOTH;
    let sStar = 1;
    for (const a of active) if (a.ev.rep) sStar += a.ev.rep * Math.pow(0.5, (days.length - a.k) / C.REP_HALFLIFE);
    sStar = Math.max(C.REP_CLAMP[0], Math.min(C.REP_CLAMP[1], sStar));
    sent += (sStar - sent) / C.REP_SMOOTH;
    const R = aud * C.USD_PER_AUDIENCE * sent;

    // financial capital, part 1: holdings without a daily quote
    noise = noise * C.PRIVATE_NOISE[0] + gauss(rnd) * C.PRIVATE_NOISE[1];
    const parts = [];
    let priv = 0;
    for (const p of privates) {
      if (dn < p.from || dn > p.until) continue;
      const v = interp(p.anc, dn, 'geo', 'zero') * Math.exp(noise);
      if (v > 0) { priv += v; parts.push([p.label, v]); }
    }
    // part 2: listed stock = ownership × shares × real daily OHLC
    let sO = 0, sC = 0, hiX = 0, loX = 0;
    live.forEach((s, i) => {
      const k = interp(s.ownA, dn, 'lin') * interp(s.shA, dn, 'lin');
      const [, o, h, l, c] = rows[i];
      sO += k * o; sC += k * c; hiX += k * (h - Math.max(o, c)); loX += k * (Math.min(o, c) - l);
      parts.push([s.label, k * c]);
    });
    // part 3: a large option grant, valued at intrinsic value
    let oO = 0, oC = 0;
    if (opt && dn >= opt.from) {
      const r = idx[opt.sym].get(key);
      if (r) {
        const n = opt.n * Math.max(0, Math.min(1, interp(opt.vestA, dn, 'lin'))) * stepVal(opt.facA, dn);
        oO = n * Math.max(0, r[1] - opt.strike); oC = n * Math.max(0, r[4] - opt.strike);
        if (oC > 0) parts.push([opt.label, oC]);
      }
    }
    const NS = priv + H + R;
    const Cl = sC + oC + NS;
    let O, Hi, Lo;
    if (live.length) {
      O = sO + oO + (prev ? prev.ns : NS);
      Hi = Math.max(O, Cl) + hiX; Lo = Math.min(O, Cl) - loX;
    } else {
      O = prev ? prev.c : Cl;
      Hi = Math.max(O, Cl) * (1 + Math.abs(gauss(rnd)) * 0.003);
      Lo = Math.min(O, Cl) * (1 - Math.abs(gauss(rnd)) * 0.003);
    }
    const d = { dn, o: O, h: Hi, l: Lo, c: Cl, ns: NS, stk: sC + oC, fin: sC + oC + priv, hum: H, rep: R, sent, aud, parts, listed: live.length > 0 };
    days.push(d); prev = d;
  }

  // ── attention (drawn as volume) ──
  const n = days.length;
  const media = new Float64Array(n), search = new Float64Array(n);
  const idxOf = (dn) => { let lo = 0, hi = n - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (days[m].dn < dn) lo = m + 1; else hi = m; } return lo; };
  for (let i = 0; i < n; i++) { const b = interp(medA, days[i].dn, 'lin'); media[i] = b; search[i] = b * 0.6; }
  for (const e of events) {
    const k0 = idxOf(e.dn); const base = Math.max(interp(medA, e.dn, 'lin'), 0.4);
    // a vague date spreads the pulse out instead of pretending it happened on one day
    const prec = e.p === 'year' ? [0.25, 60] : e.p === 'month' ? [0.5, 18] : [1, 8];
    const A = base * Math.pow(e.mag, 1.6) * 0.9 * prec[0];
    for (let k = k0; k < Math.min(n, k0 + prec[1] * 6); k++) {
      const t = k - k0;
      media[k] += A * Math.exp(-t / prec[1]);
      search[k] += A * 1.4 * Math.exp(-t / (prec[1] / 2));
    }
  }
  let mxA = 1e-9, mxM = 1e-9, mxS = 1e-9;
  for (let i = 0; i < n; i++) { mxA = Math.max(mxA, days[i].aud); mxM = Math.max(mxM, media[i]); mxS = Math.max(mxS, search[i]); }
  const Wt = C.ATTENTION_WEIGHTS;
  for (let i = 0; i < n; i++) {
    const a = days[i].aud / mxA, m = media[i] / mxM, s = search[i] / mxS;
    days[i].va = a; days[i].vm = m; days[i].vs = s;
    days[i].v = 100 * (Wt.audience * a + Wt.media * m + Wt.search * s);
  }

  // ── unexplained moves: flagged, never explained by guesswork ──
  const manualDays = events.filter((e) => e.p === 'day').map((e) => idxOf(e.dn));
  const cands = [];
  for (let i = 1; i < n; i++) {
    if (!days[i].listed || !days[i - 1].listed) continue;
    const ch = days[i].c / days[i - 1].c - 1;
    if (Math.abs(ch) < C.ANOMALY_THRESHOLD) continue;
    if (manualDays.some((k) => Math.abs(k - i) <= 3)) continue;
    cands.push({ i, ch });
  }
  cands.sort((a, b) => Math.abs(b.ch) - Math.abs(a.ch));
  const picked = [];
  for (const c of cands) { if (picked.length >= C.ANOMALY_MAX) break; if (picked.every((p) => Math.abs(p.i - c.i) > C.ANOMALY_GAP)) picked.push(c); }
  const marketSrc = (dn) => P.stocks.filter((s) => dn >= parseDate(s.from)).map((s) => ({ name: `Yahoo Finance · ${s.sym}`, url: `https://finance.yahoo.com/quote/${s.sym}/history`, type: 'market' }));
  const name = (lang) => P.name[lang] || P.name.en;
  const autoEvents = picked.map((c) => {
    const d = days[c.i], p = days[c.i - 1];
    const stockDelta = d.stk - p.stk;
    const share = Math.round(Math.min(1, Math.abs(stockDelta) / Math.max(1, Math.abs(d.c - p.c))) * 100);
    const syms = P.stocks.filter((s) => d.dn >= parseDate(s.from)).map((s) => s.sym).join(' / ');
    const near = events.filter((e) => e.p !== 'day' && Math.abs(e.dn - d.dn) <= (e.p === 'year' ? 365 : 31));
    const T = (e, l) => (e.t[l] || e.t.en || e.t.zh);
    const hintEn = near.length ? ` Possibly related (unverified): ${near.map((e) => `"${T(e, 'en')}"`).join(', ')}. That event is only dated to the ${near[0].p}, so the link cannot be confirmed.` : '';
    const hintZh = near.length ? `可能关联（待核实）：${near.map((e) => `「${T(e, 'zh')}」`).join('、')}，该事件只有${near[0].p === 'year' ? '年' : '月'}级日期精度，暂不能确认就是这一天。` : '';
    return {
      d: fmtDn(d.dn), dn: d.dn, p: 'day', auto: true, cat: 'anomaly', dir: c.ch > 0 ? 1 : -1, mag: Math.min(5, Math.max(1, Math.round(Math.abs(c.ch) * 25))), rep: 0,
      s: { en: `${pct(c.ch, 1)} in a day`, zh: `单日 ${pct(c.ch, 1)}` },
      t: { en: `${pct(c.ch, 1)} in one day: unexplained move`, zh: `单日 ${pct(c.ch, 1)}：未找到原因的异动` },
      summary: {
        en: `Life market cap moved ${pct(c.ch, 1)} on this day. About ${share}% of the move came from the price of ${syms}. No sourced event has been matched to it yet.${hintEn}`,
        zh: `当日人生市值变动 ${pct(c.ch, 1)}，约 ${share}% 来自 ${syms} 的股价变化。目前还没有为这次异动匹配到已核实的事件。${hintZh}`,
      },
      why: { en: 'Flagged from price data alone. No score is added and no cause is guessed. Know why it happened? Open a pull request with a source.', zh: '只根据行情数据标记，不加主观分数，也不猜原因。知道原因？欢迎带着来源提 PR。' },
      fin: { en: `Financial capital moved about ${moneyIn('en', stockDelta)} that day`, zh: `当日金融资本变动约 ${moneyIn('zh', stockDelta)}` },
      src: marketSrc(d.dn),
    };
  });
  let ath = 0; for (let i = 1; i < n; i++) if (days[i].c > days[ath].c) ath = i;
  const off = pct(days[n - 1].c / days[ath].c - 1, 1);
  const athEv = {
    d: fmtDn(days[ath].dn), dn: days[ath].dn, p: 'day', auto: true, ath: true, cat: 'milestone', dir: 1, mag: 3, rep: 0,
    s: { en: 'All-time high', zh: '历史最高' },
    t: { en: `All-time high: ${moneyIn('en', days[ath].c, true)}`, zh: `人生市值历史最高点：${moneyIn('zh', days[ath].c, true)}` },
    summary: { en: `By this model, ${name('en')}'s life market cap closed at its highest ever on this day. It now sits ${off} from that peak.`, zh: `按模型计算，${name('zh')}的人生市值在这一天收于历史最高点。当前较高点 ${off}。` },
    why: { en: 'Marked automatically by the model.', zh: '由模型自动标注。' },
    src: marketSrc(days[ath].dn),
  };
  const all = [...events, ...autoEvents, athEv].sort((a, b) => a.dn - b.dn);

  // ── numbering + measured aftermath of every event ──
  all.forEach((e, i) => {
    e.idx = i; e.no = i + 1; e.k = Math.min(n - 1, idxOf(e.dn));
    e.mediaPeak = 0; for (let k = e.k; k < Math.min(n, e.k + 10); k++) e.mediaPeak = Math.max(e.mediaPeak, days[k].vm);
    const base = days[Math.max(0, e.k - 1)].c;
    e.cv = days[e.k].c;
    e.d30 = e.k + 21 < n ? days[e.k + 21].c / base - 1 : null;   // 21 trading days ≈ 30 calendar days
    e.d1y = e.k + 252 < n ? days[e.k + 252].c / base - 1 : null; // 252 trading days ≈ 1 year
  });
  const chapters = (P.chapters || []).map((c, i) => ({ i, from: parseDate(c.from), t: c.t, desc: c.desc }));
  chapters.forEach((c, i) => {
    c.to = i + 1 < chapters.length ? chapters[i + 1].from : today;
    c.evs = all.filter((e) => e.dn >= c.from && (e.dn < c.to || i === chapters.length - 1)).length;
  });

  return { P, days, events: all, chapters, born, today, cache: {} };
};

// headline numbers for the leaderboard and the entry header
PS.stats = function stats(M) {
  const d = M.days, n = d.length, last = d[n - 1];
  const fl = Math.max(0, d.findIndex((x) => x.listed));
  const yrs = (last.dn - d[fl].dn) / 365.25;
  const cagr = Math.pow(last.c / d[fl].c, 1 / yrs) - 1;
  let peak = fl, mdd = 0, pk = fl, tr = fl;
  for (let i = fl; i < n; i++) { if (d[i].c > d[peak].c) peak = i; const dd = d[i].c / d[peak].c - 1; if (dd < mdd) { mdd = dd; pk = peak; tr = i; } }
  const manual = M.events.filter((e) => !e.auto && e.d30 != null);
  const best = manual.reduce((a, e) => (e.d30 > a.d30 ? e : a), manual[0]);
  const worst = manual.reduce((a, e) => (e.d30 < a.d30 ? e : a), manual[0]);
  const ath = M.events.find((e) => e.ath);
  return {
    last, ch: last.c / d[n - 2].c - 1, chY: last.c / d[Math.max(0, n - 253)].c - 1,
    fl: d[fl], cagr, mult: last.c / d[fl].c, mdd, pk: d[pk], tr: d[tr], best, worst, ath,
    fromAth: last.c / ath.cv - 1, repShare: last.rep / last.c,
    age: (M.today - M.born) / 365.25,
  };
};

PS.aggregate = function aggregate(days, tf) {
  if (tf === 'D') return days.map((d) => ({ ...d, s: d.dn, e: d.dn }));
  const keyFn = tf === 'W' ? (dn) => dn - ((dnToDate(dn).getUTCDay() + 6) % 7)
    : tf === 'M' ? (dn) => { const d = dnToDate(dn); return d.getUTCFullYear() * 12 + d.getUTCMonth(); }
    : (dn) => dnToDate(dn).getUTCFullYear();
  const out = []; let cur = null, ck = null, vs = 0, cnt = 0;
  for (const d of days) {
    const k = keyFn(d.dn);
    if (k !== ck) {
      if (cur) { cur.v = vs / cnt; out.push(cur); }
      cur = { ...d, s: d.dn, e: d.dn }; ck = k; vs = 0; cnt = 0;
    } else {
      cur.h = Math.max(cur.h, d.h); cur.l = Math.min(cur.l, d.l); cur.c = d.c; cur.e = d.dn;
      cur.fin = d.fin; cur.hum = d.hum; cur.rep = d.rep; cur.parts = d.parts; cur.listed = d.listed; cur.sent = d.sent; cur.dn = d.dn;
    }
    vs += d.v; cnt++;
  }
  if (cur) { cur.v = vs / cnt; out.push(cur); }
  return out;
};
})();
