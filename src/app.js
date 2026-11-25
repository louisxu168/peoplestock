/* PeopleStock UI: leaderboard, person page (chart + event table + dossier), compare-by-age. */
(() => {
'use strict';
const PS = globalThis.PS;
const { t, L, pct, fmtDn, dnToDate } = PS;
const money = (v, s) => PS.money(v, s);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const pad = (n) => String(n).padStart(2, '0');
const pctShort = (x) => Math.abs(x) >= 10 ? `${x >= 0 ? '+' : ''}${(x * 100).toFixed(0)}%` : pct(x, 1);
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const MODELS = {}; let ORDER = [], TODAY = 0;
const state = {
  route: 'home', pid: null, view: [0, 1], tfMode: 'auto', scale: 'log',
  hover: -1, mouse: null, hlEv: null, selEv: null, filter: 'all', onlyRange: false,
  sort: { k: 'no', d: 1 }, playing: false,
  lb: { k: 'cap', d: -1 }, cmp: { ids: [], mode: 'age', hover: null },
};
const UP = () => PS.redUp ? '#FF3B3B' : '#12B76A';
const DOWN = () => PS.redUp ? '#12B76A' : '#FF3B3B';
const colOf = (x) => x >= 0 ? UP() : DOWN();
const CAT_COLOR = { origin: '#E9E3D4', education: '#7CC4FF', career: '#B8F25B', wealth: '#FFD84D', milestone: '#FF9F43', reputation: '#FF9EC4', crisis: '#C9B8FF', anomaly: '#ddd' };
const TY_COLOR = { wiki: '#E9E3D4', news: '#FFD84D', filing: '#7CC4FF', market: '#B8F25B' };
const CHAP_FILL = ['#FFF1B8', '#DDF0FF', '#E5F8C8', '#FFE1EE', '#EDE5FF', '#FFE5CC', '#E9E3D4'];
const LINE = ['#111111', '#FF3B3B', '#1c7ed6', '#12B76A', '#FF9F43', '#9b5de5', '#d6336c', '#0ca678', '#868e96'];
const FONT = '"Space Grotesk", "Microsoft YaHei", sans-serif';
let candles = [], tf = 'M';
const canvas = $('chart'), ctx = canvas.getContext('2d'), wrap = $('chartWrap'), tip = $('tooltip');
const M_ = () => MODELS[state.pid];
const avatar = (P, cls = '') => `<div class="avatar ${cls}" style="background:${P.color}">${P.initials}</div>`;

function evColors(e) {
  if (e.ath) return ['#FFD84D', '#111'];
  if (e.auto) return ['#E6E6E6', '#111'];
  if (e.dir > 0) return [UP(), '#fff'];
  if (e.dir < 0) return [DOWN(), '#fff'];
  return ['#FFD84D', '#111'];
}
const noBox = (e) => { const [bg, fg] = evColors(e); return `<span class="no" style="background:${bg};color:${fg}">${e.ath ? '★' : e.no}</span>`; };
const fmtEvDate = (e) => e.p === 'year' ? e.d.slice(0, 4) : e.p === 'month' ? e.d.slice(0, 7) : e.d;
const fmtPrecision = (e) => e.p === 'year' ? t('p_year', { y: e.d.slice(0, 4) }) : e.p === 'month' ? t('p_month', { y: e.d.slice(0, 4), m: e.d.slice(5, 7) }) : e.d;
const chgCell = (v, short = true) => v == null ? '<span class="muted">—</span>' : `<span style="color:${colOf(v)}">${short ? pctShort(v) : pct(v, 1)}</span>`;

function getCandles(M, f) {
  if (!M.cache[f]) {
    const cs = PS.aggregate(M.days, f);
    cs.evCi = M.events.map((e) => { let lo = 0, hi = cs.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (cs[m].e < e.dn) lo = m + 1; else hi = m; } return lo; });
    M.cache[f] = cs;
  }
  return M.cache[f];
}

// ═════════════════════════ boot + routing ═════════════════════════
async function boot() {
  PS.applyI18n(); syncChrome();
  try {
    const get = (u) => fetch(u).then((r) => { if (!r.ok) throw new Error(u); return r.json(); });
    const ids = await get('data/people/index.json');
    const people = await Promise.all(ids.map((id) => get(`data/people/${id}.json`)));
    const syms = [...new Set(people.flatMap((P) => [...P.stocks.map((s) => s.sym), ...(P.options ? [P.options.sym] : [])]))];
    const rows = await Promise.all(syms.map((s) => get(`data/prices/${encodeURIComponent(s)}.json`)));
    const prices = Object.fromEntries(syms.map((s, i) => [s, rows[i]]));
    for (const P of people) { MODELS[P.id] = PS.buildPerson(P, prices); MODELS[P.id].S = PS.stats(MODELS[P.id]); TODAY = Math.max(TODAY, MODELS[P.id].today); }
    ORDER = ids.slice().sort((a, b) => MODELS[b].S.last.c - MODELS[a].S.last.c);
  } catch (err) {
    console.error(err); $('boot').innerHTML = t('load_fail'); return;
  }
  $('boot').hidden = true; syncChrome();
  state.cmp.ids = ORDER.slice(0, 4);
  window.addEventListener('hashchange', route);
  new ResizeObserver(resize).observe(wrap);
  new ResizeObserver(drawCompare).observe($('cmpWrap'));
  route();
  if (document.fonts) document.fonts.ready.then(() => { if (state.route === 'person') render(); if (state.route === 'compare') drawCompare(); });
}

function route() {
  stopPlay();
  const [path, query = ''] = location.hash.replace(/^#\/?/, '').split('?');
  const q = new URLSearchParams(query), seg = path.split('/');
  state.route = seg[0] === 'p' && MODELS[seg[1]] ? 'person' : seg[0] === 'compare' ? 'compare' : 'home';
  $('viewHome').hidden = state.route !== 'home'; $('viewPerson').hidden = state.route !== 'person'; $('viewCompare').hidden = state.route !== 'compare';
  $('navHome').classList.toggle('on', state.route === 'home'); $('navCompare').classList.toggle('on', state.route === 'compare');
  if (state.route === 'person') {
    const first = state.pid !== seg[1];
    if (first) selectPerson(seg[1]); else renderPersonAll();
    if (q.get('ev')) { const k = q.get('ev'); const evs = M_().events, e = evs.find((x) => String(x.no) === k) || evs.find((x) => [x.t.en, x.t.zh, x.s.en, x.s.zh].some((v) => v && v.includes(k))); if (e) { state.selEv = e; renderDossier(); state.view = clampView(eventWindow(e)); render(); scrollRow(e); } }
    if (q.get('ch')) { const c = M_().chapters[+q.get('ch') - 1]; if (c) { const s = c.to - c.from; state.view = clampView([c.from - s * 0.04, c.to + s * 0.06]); render(); } }
  } else if (state.route === 'compare') {
    if (q.get('ids')) state.cmp.ids = q.get('ids').split(',').filter((id) => MODELS[id]);
    if (q.get('mode')) state.cmp.mode = q.get('mode') === 'year' ? 'year' : 'age';
    renderCompare();
  } else renderHome();
  renderPeople();
  window.scrollTo(0, 0);
}

function syncChrome() {
  $('langToggle').textContent = PS.lang === 'zh' ? 'EN' : '中文';
  $('colorToggle').textContent = t(PS.redUp ? 'color_red' : 'color_green');
  $('scaleBtn').textContent = t(state.scale === 'log' ? 'log' : 'lin');
  $('playBtn').textContent = t(state.playing ? 'pause' : 'play');
  $('foot').textContent = TODAY ? t('foot', { d: fmtDn(TODAY) }) : '';
  if (PS.REPO) { $('ghLink').hidden = false; $('ghLink').href = PS.REPO; $('methodLink').hidden = false; $('methodLink').href = `${PS.REPO}/blob/main/docs/METHODOLOGY.md`; }
  document.title = PS.lang === 'zh' ? 'PeopleStock · 人生股市' : 'PeopleStock · every life is a chart';
}
function rerenderAll() {
  PS.applyI18n(); syncChrome(); renderPeople();
  if (state.route === 'home') renderHome(); else if (state.route === 'compare') renderCompare(); else renderPersonAll();
}
$('langToggle').onclick = () => { PS.lang = PS.lang === 'zh' ? 'en' : 'zh'; PS.save(); rerenderAll(); };
$('colorToggle').onclick = () => { PS.redUp = !PS.redUp; PS.save(); rerenderAll(); };

function renderPeople() {
  $('people').innerHTML = ORDER.map((id) => {
    const P = MODELS[id].P;
    return `<a class="person${state.route === 'person' && id === state.pid ? ' on' : ''}" href="#/p/${id}" title="${esc(L(P.name))}">${avatar(P)}<span class="nm">${esc(L(P.name))}</span></a>`;
  }).join('');
}

// ═════════════════════════ home ═════════════════════════
function renderHome() {
  const all = ORDER.map((id) => MODELS[id]);
  const total = all.reduce((s, M) => s + M.S.last.c, 0);
  const prevTotal = all.reduce((s, M) => s + M.S.last.c / (1 + M.S.ch), 0);
  const up = all.reduce((a, M) => (M.S.ch > a.S.ch ? M : a)), down = all.reduce((a, M) => (M.S.ch < a.S.ch ? M : a));
  const mover = (M, k) => `<a class="stat click" href="#/p/${M.P.id}"><div class="k">${t(k)}</div><div class="v" style="color:${colOf(M.S.ch)}">${pct(M.S.ch, 1)}</div><div class="s">${esc(L(M.P.name))} · ${money(M.S.last.c, true)}</div></a>`;
  $('homeStats').innerHTML = `<div class="stat hero"><div class="k">${t('idx_total')}</div><div class="v">${money(total, true)}</div><div class="s">${pct(total / prevTotal - 1, 1)} · ${t('idx_people', { n: all.length })} · ${t('idx_asof', { d: fmtDn(TODAY) })}</div></div>${mover(up, 'idx_up')}${mover(down, 'idx_down')}`;

  const cols = [['rank', '#'], ['name', t('col_person')], ['cap', t('col_cap')], ['ch', t('col_day')], ['chY', t('col_1y')], ['cagr', t('col_cagr')], ['mdd', t('col_mdd')], ['fromAth', t('col_ath')], ['repShare', t('col_rep')], ['age', t('col_age')], [null, t('col_2y')]];
  const val = (M, k) => k === 'cap' ? M.S.last.c : k === 'name' ? L(M.P.name) : M.S[k];
  const { k, d } = state.lb;
  const rows = [...all].sort((a, b) => { const x = val(a, k), y = val(b, k); return (typeof x === 'string' ? x.localeCompare(y) : x - y) * d; });
  $('lbTable').innerHTML = `<thead><tr>${cols.map(([ck, l]) => `<th class="${ck && ck !== 'rank' ? 'sort' : ''}${k === ck ? ' on' : ''}${ck && !['rank', 'name'].includes(ck) ? ' r' : ''}" ${ck && ck !== 'rank' ? `data-k="${ck}"` : ''}>${l}${ck && ck !== 'rank' ? `<span class="ar">${k === ck ? (d > 0 ? '▲' : '▼') : '↕'}</span>` : ''}</th>`).join('')}</tr></thead><tbody>` +
    rows.map((M, i) => { const S = M.S, P = M.P; return `<tr class="row in" data-id="${P.id}">
      <td class="c-no"><span class="no" style="background:#fff">${ORDER.indexOf(P.id) + 1}</span></td>
      <td><div class="lb-who">${avatar(P)}<div><div class="nm">${esc(L(P.name))}</div><div class="tk">$${P.ticker} · ${esc(L(P.tags[0]))}</div></div></div></td>
      <td class="num"><b>${money(S.last.c, true)}</b></td>
      <td class="chg">${chgCell(S.ch, false)}</td><td class="chg">${chgCell(S.chY)}</td><td class="chg">${chgCell(S.cagr, false)}</td>
      <td class="chg">${chgCell(S.mdd)}</td><td class="chg">${chgCell(S.fromAth)}</td>
      <td class="num">${(S.repShare * 100).toFixed(S.repShare < 0.1 ? 1 : 0)}%</td><td class="num">${Math.floor(S.age)}</td>
      <td><canvas class="spark" width="220" height="56"></canvas></td></tr>`; }).join('') + '</tbody>';
  $('lbTable').querySelectorAll('th.sort').forEach((th) => th.onclick = () => { const c = th.dataset.k; state.lb = state.lb.k === c ? { k: c, d: -state.lb.d } : { k: c, d: c === 'name' ? 1 : -1 }; renderHome(); });
  $('lbTable').querySelectorAll('tr.row').forEach((tr) => {
    tr.onclick = () => { location.hash = `#/p/${tr.dataset.id}`; };
    const d = MODELS[tr.dataset.id].days.slice(-504), c2 = tr.querySelector('canvas').getContext('2d');
    const mn = Math.min(...d.map((x) => x.c)), mx = Math.max(...d.map((x) => x.c));
    c2.lineWidth = 3; c2.strokeStyle = colOf(d[d.length - 1].c - d[0].c); c2.lineJoin = 'round'; c2.beginPath();
    d.forEach((x, i) => { const X = 4 + i / (d.length - 1) * 212, Y = 52 - (x.c - mn) / (mx - mn || 1) * 48; i ? c2.lineTo(X, Y) : c2.moveTo(X, Y); });
    c2.stroke();
  });

  const feed = all.flatMap((M) => M.events.filter((e) => !e.auto).map((e) => ({ e, M }))).sort((a, b) => b.e.dn - a.e.dn).slice(0, 14);
  $('feed').innerHTML = feed.map(({ e, M }) => `<a class="feed-item" href="#/p/${M.P.id}?ev=${e.no}">
      ${avatar(M.P)}<div><div class="fd">${fmtEvDate(e)} · ${esc(L(M.P.name))}</div><div class="ft">${esc(L(e.t))}</div></div>
      <span class="fc">${chgCell(e.d30)}</span></a>`).join('') +
    (PS.REPO ? `<a class="feed-item feed-add" href="${PS.REPO}/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener"><div class="avatar" style="background:#fff">＋</div><div><div class="ft">${t('add_person')}</div><div class="fd">${t('add_person_sub')}</div></div></a>` : '');
}

// ═════════════════════════ person: view window ═════════════════════════
function lifeSpan() { const d = M_().days; return [d[0].dn, M_().today]; }
function fullView() { const [a, b] = lifeSpan(), s = b - a; return [a - s * 0.012, b + s * 0.025]; }
function clampView([a, b]) {
  const [L0, L1] = lifeSpan(), life = L1 - L0;
  const span = clamp(b - a, 30, life * 1.06);
  const c = (a + b) / 2; a = c - span / 2; b = c + span / 2;
  const lo = L0 - span * 0.06, hi = L1 + span * 0.08;
  if (a < lo) { b += lo - a; a = lo; }
  if (b > hi) { a -= b - hi; b = hi; }
  return [a, b];
}
function curTf() {
  if (state.tfMode !== 'auto') return state.tfMode;
  const span = state.view[1] - state.view[0];
  return span > 365 * 12 ? 'M' : span > 365 * 2.2 ? 'W' : 'D';
}
function prepare() { tf = curTf(); candles = getCandles(M_(), tf); }
// candle i covers the fractional index range [i-0.5, i+0.5]
function idxOf(dn) {
  const n = candles.length, per = (candles[n - 1].e - candles[0].s + 1) / n;
  if (dn <= candles[0].s) return (dn - candles[0].s) / per - 0.5;
  if (dn > candles[n - 1].e) return n - 0.5 + (dn - candles[n - 1].e - 1) / per;
  let lo = 0, hi = n - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (candles[m].s <= dn) lo = m; else hi = m - 1; }
  const c = candles[lo], end = lo + 1 < n ? candles[lo + 1].s : c.e + 1;
  return lo - 0.5 + (dn - c.s) / (end - c.s);
}
function dnOf(x) {
  const n = candles.length, per = (candles[n - 1].e - candles[0].s + 1) / n;
  if (x < -0.5) return candles[0].s + (x + 0.5) * per;
  if (x >= n - 0.5) return candles[n - 1].e + 1 + (x - n + 0.5) * per;
  const i = clamp(Math.floor(x + 0.5), 0, n - 1), c = candles[i], end = i + 1 < n ? candles[i + 1].s : c.e + 1;
  return c.s + (x - (i - 0.5)) * (end - c.s);
}
let anim = 0;
function setView(v, animate = false) {
  v = clampView(v); cancelAnimationFrame(anim);
  if (!animate) { state.view = v; render(); return; }
  const from = [...state.view], t0 = performance.now(), ms = 650;
  const c0 = (from[0] + from[1]) / 2, c1 = (v[0] + v[1]) / 2, s0 = from[1] - from[0], s1 = v[1] - v[0];
  const step = (now) => {
    let p = Math.min(1, (now - t0) / ms); p = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    const c = c0 + (c1 - c0) * p, s = Math.exp(Math.log(s0) + (Math.log(s1) - Math.log(s0)) * p);
    state.view = [c - s / 2, c + s / 2]; render();
    if (p < 1) anim = requestAnimationFrame(step);
  };
  anim = requestAnimationFrame(step);
}
function zoomBy(k, frac = 0.5) { const [a, b] = state.view, s = b - a, at = a + s * frac, ns = s * k; setView([at - frac * ns, at + (1 - frac) * ns], true); }
function eventWindow(e) { const half = e.p === 'year' ? 365 * 3.2 : e.p === 'month' ? 365 * 1.1 : 190; return [e.dn - half * 0.85, e.dn + half * 1.15]; }

// ═════════════════════════ person: header + chapters ═════════════════════════
function renderEntry() {
  const M = M_(), P = M.P, S = M.S;
  const nSrc = M.events.reduce((s, e) => s + e.src.length, 0), verified = M.events.filter((e) => !e.auto).length;
  const mult = S.mult >= 100 ? Math.round(S.mult).toLocaleString('en-US') : S.mult.toFixed(1);
  const other = PS.lang === 'zh' ? P.name.en : P.name.zh;
  $('entry').innerHTML = `
    <div class="entry-who">${avatar(P)}
      <div>
        <div class="entry-name"><span class="big">${esc(L(P.name))}</span>${other && other !== L(P.name) ? `<span class="en">${esc(other)}</span>` : ''}<span class="sym">$${P.ticker}</span></div>
        <div class="entry-tag">${esc(L(P.tagline))}</div>
        <div class="entry-meta">${t('born', { d: P.born })} · ${t('meta', { c: M.chapters.length, e: verified, s: nSrc, d: fmtDn(M.today) })}</div>
      </div>
    </div>
    <div class="stats">
      <div class="stat hero"><div class="k">${t('st_cap')}</div><div class="v">${money(S.last.c, true)}</div><div class="s">${t('st_today', { a: pct(S.ch, 1), b: pct(S.chY, 0) })}</div></div>
      <div class="stat click" id="stAth"><div class="k">${t('st_ath')}</div><div class="v">${money(S.ath.cv, true)}</div><div class="s">${t('st_ath_sub', { d: S.ath.d, p: pct(S.fromAth, 0) })}</div></div>
      <div class="stat"><div class="k">${t('st_cagr')}</div><div class="v">${pct(S.cagr, 1)}</div><div class="s">${t('st_cagr_sub', { y: dnToDate(S.fl.dn).getUTCFullYear(), m: mult })}</div></div>
      <div class="stat click" id="stDd"><div class="k">${t('st_mdd')}</div><div class="v" style="color:${DOWN()}">${pct(S.mdd, 0)}</div><div class="s">${fmtDn(S.pk.dn, 'M')} → ${fmtDn(S.tr.dn, 'M')}</div></div>
      <div class="stat click" id="stBest"><div class="k">${t('st_best')}</div><div class="v" style="color:${colOf(S.best.d30)}">${pctShort(S.best.d30)}</div><div class="s">#${S.best.no} ${esc(L(S.best.s))}</div></div>
      <div class="stat click" id="stWorst"><div class="k">${t('st_worst')}</div><div class="v" style="color:${colOf(S.worst.d30)}">${pctShort(S.worst.d30)}</div><div class="s">#${S.worst.no} ${esc(L(S.worst.s))}</div></div>
    </div>`;
  $('stAth').onclick = () => selectEvent(S.ath, { zoom: true });
  $('stBest').onclick = () => selectEvent(S.best, { zoom: true });
  $('stWorst').onclick = () => selectEvent(S.worst, { zoom: true });
  $('stDd').onclick = () => { const s = S.tr.dn - S.pk.dn; setView([S.pk.dn - s * 0.3, S.tr.dn + s * 0.5], true); };
}
const chapYears = (c) => `${dnToDate(c.from).getUTCFullYear()}–${c.i === M_().chapters.length - 1 ? t('now') : dnToDate(c.to).getUTCFullYear()}`;
function renderChapters() {
  $('chapters').innerHTML = `<span class="lbl">${t('chapters')}</span><span class="chap" data-c="all">${t('whole_life')}</span>` +
    M_().chapters.map((c) => `<span class="chap" data-c="${c.i}" title="${esc(L(c.desc))}"><span class="n">${c.i + 1}</span>${esc(L(c.t))}<span class="yr">${chapYears(c)}</span></span>`).join('');
  $('chapters').querySelectorAll('.chap').forEach((el) => el.onclick = () => { stopPlay(); goChapter(el.dataset.c); });
}
function goChapter(c) {
  if (c === 'all') { setView(fullView(), true); return; }
  const ch = M_().chapters[+c], s = ch.to - ch.from;
  setView([ch.from - s * 0.04, ch.to + s * 0.06], true);
}
function currentChapter() {
  const [a, b] = state.view, [L0, L1] = lifeSpan();
  if (b - a > (L1 - L0) * 0.85) return 'all';
  for (const c of M_().chapters) { const s = c.to - c.from; if (a >= c.from - s * 0.15 && b <= c.to + s * 0.2 && (b - a) > s * 0.6) return String(c.i); }
  return null;
}

// ═════════════════════════ person: chart ═════════════════════════
const PAD = { l: 10, r: 84, t: 34, b: 26 };
let geom = null, flagHits = [], chapHits = [];
function resize() {
  if (state.route !== 'person') return;
  const r = wrap.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  if (!r.width) return;
  canvas.width = r.width * dpr; canvas.height = r.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  render();
}
function yAxisTicks(min, max, log) {
  const ticks = [];
  if (log) {
    for (let e = Math.floor(Math.log10(min)) - 1; e <= Math.ceil(Math.log10(max)); e++)
      for (const s of [1, 2, 5]) { const v = s * 10 ** e; if (v >= min && v <= max) ticks.push(v); }
    if (ticks.length > 9) return ticks.filter((v) => /^1/.test(v.toExponential()));
    if (ticks.length >= 4) return ticks;
    ticks.length = 0;
  }
  const raw = (max - min) / 6, mag = 10 ** Math.floor(Math.log10(raw)), st = [1, 2, 2.5, 5, 10].map((x) => x * mag).find((x) => x >= raw);
  for (let v = Math.ceil(min / st) * st; v <= max; v += st) ticks.push(v);
  return ticks;
}
const overlaps = (r, list) => list.some((q) => r.x0 < q.x1 && r.x1 > q.x0 && r.y0 < q.y1 && r.y1 > q.y0);
function tagBox(c, x, y, text, bg, fg) {
  c.font = 'bold 11px "JetBrains Mono", monospace';
  const w = c.measureText(text).width + 10;
  c.fillStyle = bg; c.fillRect(x, y - 10, w, 20);
  c.strokeStyle = '#111'; c.lineWidth = 1.5; c.strokeRect(x, y - 10, w, 20);
  c.fillStyle = fg; c.textBaseline = 'middle'; c.textAlign = 'left'; c.fillText(text, x + 5, y + 1);
}

function draw() {
  const W = wrap.clientWidth, H = wrap.clientHeight;
  ctx.clearRect(0, 0, W, H);
  if (!candles.length || W < 50) return;
  const M = M_();
  const plotW = W - PAD.l - PAD.r;
  const volH = Math.round((H - PAD.t - PAD.b) * 0.16);
  const priceH = H - PAD.t - PAD.b - volH - 12;
  const v0 = idxOf(state.view[0]), v1 = idxOf(state.view[1]);
  const cw = plotW / (v1 - v0);
  const xOf = (i) => PAD.l + (i - v0) * cw;
  const xOfDn = (dn) => PAD.l + (idxOf(dn) - v0) * cw;
  const iFrom = clamp(Math.floor(v0), 0, candles.length - 1), iTo = clamp(Math.ceil(v1), 0, candles.length - 1);
  let mn = Infinity, mx = -Infinity, vmx = 0;
  for (let i = iFrom; i <= iTo; i++) { mn = Math.min(mn, candles[i].l); mx = Math.max(mx, candles[i].h); vmx = Math.max(vmx, candles[i].v); }
  const log = state.scale === 'log';
  const f = log ? Math.log : (x) => x;
  let a = f(mn), b = f(mx); const padY = (b - a) * 0.14 || 1; a -= padY * (log ? 0.7 : 0.3); b += padY * 1.3;
  if (!log) a = Math.max(0, a);
  const yOf = (v) => PAD.t + priceH - (f(Math.max(v, 1e-9)) - a) / (b - a) * priceH;
  const volTop = PAD.t + priceH + 12;
  const yVol = (v) => volTop + volH - (v / (vmx || 1)) * volH;
  geom = { xOf, yOf, cw, v0, plotW, priceH, volTop, volH, W, H };

  // chapter strip + faint chapter boundaries
  chapHits = [];
  ctx.save(); ctx.beginPath(); ctx.rect(PAD.l, 0, plotW, H); ctx.clip();
  const curCh = currentChapter();
  M.chapters.forEach((c, i) => {
    const x0 = Math.max(PAD.l, xOfDn(c.from)), x1 = Math.min(PAD.l + plotW, xOfDn(c.to));
    if (x1 <= x0) return;
    const on = curCh === String(i);
    ctx.fillStyle = on ? '#111' : CHAP_FILL[i % CHAP_FILL.length]; ctx.fillRect(x0, 6, x1 - x0, 20);
    ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5; ctx.strokeRect(x0 + 0.75, 6.75, x1 - x0 - 1.5, 18.5);
    ctx.font = `bold 11px ${FONT}`; ctx.textBaseline = 'middle';
    let label = `${i + 1} ${L(c.t)}`;
    if (ctx.measureText(label).width > x1 - x0 - 12) label = `${i + 1}`;
    if (ctx.measureText(label).width < x1 - x0 - 8) { ctx.fillStyle = on ? '#fff' : '#111'; ctx.fillText(label, x0 + 6, 16.5); }
    chapHits.push({ c: i, x0, x1, y0: 6, y1: 26 });
    if (i > 0 && xOfDn(c.from) > PAD.l) {
      ctx.strokeStyle = 'rgba(17,17,17,.18)'; ctx.setLineDash([2, 4]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x0, 28); ctx.lineTo(x0, PAD.t + priceH); ctx.stroke(); ctx.setLineDash([]);
    }
  });
  ctx.restore();

  // estimated era before the first listing
  const fsIdx = candles.findIndex((c) => c.listed), hatchEnd = fsIdx < 0 ? candles.length : fsIdx;
  if (hatchEnd > iFrom) {
    const x0 = Math.max(PAD.l, xOf(iFrom) - cw / 2), x1 = Math.min(PAD.l + plotW, xOf(hatchEnd) - cw / 2);
    if (x1 > x0) {
      ctx.save(); ctx.beginPath(); ctx.rect(x0, PAD.t, x1 - x0, priceH); ctx.clip();
      ctx.fillStyle = '#FBF8F0'; ctx.fillRect(x0, PAD.t, x1 - x0, priceH);
      ctx.strokeStyle = '#EFE9D9'; ctx.lineWidth = 1.5;
      for (let x = x0 - priceH; x < x1; x += 9) { ctx.beginPath(); ctx.moveTo(x, PAD.t + priceH); ctx.lineTo(x + priceH, PAD.t); ctx.stroke(); }
      ctx.restore();
      ctx.font = `bold 10px ${FONT}`; ctx.textBaseline = 'alphabetic';
      if (x1 - x0 > 220) { ctx.fillStyle = '#9a927f'; ctx.fillText(t('prelisting'), x0 + 8, PAD.t + priceH - 8); }
      if (fsIdx > 0 && fsIdx >= iFrom && fsIdx <= iTo) {
        const x = xOf(fsIdx) - cw / 2; ctx.strokeStyle = '#111'; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x, PAD.t); ctx.lineTo(x, PAD.t + priceH); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = '#111'; ctx.fillText(t('listed_from'), x + 5, PAD.t + priceH - 8);
      }
    }
  }

  // highlight bands
  const band = (e, col) => {
    if (!e) return; const ci = candles.evCi[e.idx]; if (ci < iFrom || ci > iTo) return;
    const w = Math.max(cw, 8), x = xOf(ci); ctx.fillStyle = col; ctx.fillRect(x - w / 2, PAD.t, w, priceH + 12 + volH);
  };
  band(state.selEv, 'rgba(255,216,77,.45)');
  if (state.hlEv !== state.selEv) band(state.hlEv, 'rgba(255,216,77,.28)');

  // grid + y labels
  ctx.font = '11px "JetBrains Mono", monospace'; ctx.textBaseline = 'middle';
  for (const tk of yAxisTicks(log ? Math.exp(a) : a, log ? Math.exp(b) : b, log)) {
    const y = yOf(tk); if (y < PAD.t || y > PAD.t + priceH) continue;
    ctx.strokeStyle = '#EEE9DC'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(PAD.l, y); ctx.lineTo(PAD.l + plotW, y); ctx.stroke();
    ctx.fillStyle = '#555'; ctx.fillText(money(tk, true), PAD.l + plotW + 8, y);
  }
  ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
  for (const [x0, y0, x1, y1] of [[PAD.l + plotW, PAD.t, PAD.l + plotW, H - PAD.b], [PAD.l, PAD.t - 2, PAD.l + plotW, PAD.t - 2], [PAD.l, volTop - 6, PAD.l + plotW, volTop - 6], [PAD.l, H - PAD.b, PAD.l + plotW, H - PAD.b]]) { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }

  ctx.save(); ctx.beginPath(); ctx.rect(PAD.l, PAD.t - 2, plotW, H); ctx.clip();
  // x labels
  ctx.fillStyle = '#111'; ctx.textBaseline = 'alphabetic'; ctx.font = '11px "JetBrains Mono", monospace';
  const spanDays = (candles[iTo].e - candles[iFrom].s) || 1;
  const pxPerDay = plotW * ((iTo - iFrom + 1) / (v1 - v0)) / spanDays;
  const yearStep = [1, 2, 5, 10, 20].find((s) => s * 365 * pxPerDay > 64) || 20;
  const monthMode = 365 * pxPerDay > 64 * 3;
  let lastX = -1e9, lastLabel = '';
  for (let i = iFrom; i <= iTo; i++) {
    const d = dnToDate(candles[i].s), y = d.getUTCFullYear(), m = d.getUTCMonth();
    let label = null;
    if (monthMode) { const mk = `${y}-${m}`; const step = 30 * pxPerDay > 60 ? 1 : 30 * pxPerDay > 30 ? 3 : 6; if (mk !== lastLabel && m % step === 0) { label = m === 0 ? `${y}` : PS.lang === 'zh' ? `${pad(m + 1)}月` : d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }); lastLabel = mk; } }
    else if (y % yearStep === 0 && `${y}` !== lastLabel) { label = `${y}`; lastLabel = `${y}`; }
    if (label) {
      const x = xOf(i);
      if (x - lastX < 46 || x < PAD.l + 16 || x > PAD.l + plotW - 16) continue;
      ctx.strokeStyle = '#F3EFE5'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, PAD.t); ctx.lineTo(x, PAD.t + priceH); ctx.stroke();
      ctx.fillText(label, x - ctx.measureText(label).width / 2, H - 8); lastX = x;
    }
  }
  // attention bars
  for (let i = iFrom; i <= iTo; i++) {
    const c = candles[i], x = xOf(i), y = yVol(c.v), w = Math.max(1, cw * 0.7);
    ctx.fillStyle = c.c >= c.o ? UP() : DOWN(); ctx.globalAlpha = 0.85; ctx.fillRect(x - w / 2, y, w, volTop + volH - y); ctx.globalAlpha = 1;
    if (w >= 5) { ctx.strokeStyle = '#111'; ctx.lineWidth = 1; ctx.strokeRect(x - w / 2, y, w, volTop + volH - y); }
  }
  ctx.font = `bold 10px ${FONT}`; ctx.fillStyle = '#111'; ctx.fillText(t('attention'), PAD.l + 6, volTop + 10);
  // candles
  for (let i = iFrom; i <= iTo; i++) {
    const c = candles[i], x = xOf(i), w = Math.max(1, Math.min(cw * 0.72, 22));
    const yo = yOf(c.o), yc = yOf(c.c);
    ctx.strokeStyle = '#111'; ctx.lineWidth = cw > 3 ? 1.2 : 1;
    ctx.beginPath(); ctx.moveTo(x, yOf(c.h)); ctx.lineTo(x, yOf(c.l)); ctx.stroke();
    const top = Math.min(yo, yc), bh = Math.max(1.2, Math.abs(yc - yo));
    ctx.fillStyle = c.c >= c.o ? UP() : DOWN(); ctx.fillRect(x - w / 2, top, w, bh);
    if (w >= 3.5) { ctx.lineWidth = 1.2; ctx.strokeRect(x - w / 2, top, w, bh); }
  }
  if (cw < 2.2) {
    ctx.strokeStyle = '#111'; ctx.lineWidth = 1.4; ctx.beginPath();
    for (let i = iFrom; i <= iTo; i++) { const x = xOf(i), y = yOf(candles[i].c); i === iFrom ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
    ctx.stroke();
  }

  // numbered flags: the same number as the table row
  flagHits = []; geom.hidden = 0;
  const shown = new Set(filteredEvents());
  const inView = M.events.filter((e) => shown.has(e) && candles.evCi[e.idx] >= iFrom && candles.evCi[e.idx] <= iTo);
  const prio = (e) => (e === state.selEv ? 1e6 : 0) + (e === state.hlEv ? 5e5 : 0) + (e.ath ? 450 : 0) + e.mag * 100 - (e.auto ? 180 : 0) - e.idx * 0.01;
  const placed = [], rects = [];
  ctx.font = 'bold 10.5px "JetBrains Mono", monospace';
  for (const e of [...inView].sort((x, y) => prio(y) - prio(x))) {
    const ci = candles.evCi[e.idx], c = candles[ci], x = xOf(ci), below = e.dir < 0;
    const sel = e === state.selEv, hl = e === state.hlEv;
    const s = sel ? 22 : 18, bw = Math.max(s, ctx.measureText(e.ath ? '★' : String(e.no)).width + 9);
    let ok = null;
    for (let k = 0; k < 4 && !ok; k++) {
      const y = clamp(below ? yOf(c.l) + 10 + k * (s + 3) : yOf(c.h) - 10 - s - k * (s + 3), PAD.t + 2, PAD.t + priceH - s - 2);
      const r = { x0: x - bw / 2 - 1, x1: x + bw / 2 + 1, y0: y - 1, y1: y + s + 1 };
      if (!overlaps(r, rects) || ((sel || hl) && k === 3)) ok = { e, x, y, s, bw, below, c, sel, hl, r };
    }
    if (!ok) { geom.hidden++; continue; }
    placed.push(ok); rects.push(ok.r);
  }
  const labelMin = cw >= 6 ? 1 : cw >= 2.5 ? 3 : 4;
  ctx.font = `bold 11px ${FONT}`;
  const labels = [];
  for (const p of placed) {
    const e = p.e;
    if (!(p.sel || p.hl || (e.mag >= labelMin && (!e.auto || e.ath)))) continue;
    const text = L(e.s), tw = ctx.measureText(text).width + 10, lh = 17, cy = p.y + p.s / 2;
    const cands = [
      [p.x + p.bw / 2 + 3, cy - lh / 2], [p.x - p.bw / 2 - 3 - tw, cy - lh / 2],
      [p.x - tw / 2, p.below ? p.y + p.s + 3 : p.y - lh - 3],
      [p.x + p.bw / 2 + 3, p.below ? cy + lh / 2 + 4 : cy - lh * 1.5 - 4], [p.x - p.bw / 2 - 3 - tw, p.below ? cy + lh / 2 + 4 : cy - lh * 1.5 - 4],
    ].map(([x, y]) => ({ x0: x, x1: x + tw, y0: y, y1: y + lh }))
      .filter((r) => r.x0 >= PAD.l + 2 && r.x1 <= PAD.l + plotW - 2 && r.y0 >= PAD.t + 2 && r.y1 <= PAD.t + priceH - 2);
    const r = cands.find((q) => !overlaps(q, rects)) || ((p.sel || p.hl) ? cands[0] : null);
    if (!r) continue;
    labels.push({ p, r, text, top: p.sel || p.hl }); rects.push(r);
  }
  placed.sort((x, y) => (x.sel ? 1 : 0) - (y.sel ? 1 : 0) || (x.hl ? 1 : 0) - (y.hl ? 1 : 0));
  for (const p of placed) {
    ctx.strokeStyle = '#111'; ctx.lineWidth = 1; ctx.setLineDash([2, 2]);
    ctx.beginPath(); ctx.moveTo(p.x, p.below ? yOf(p.c.l) + 2 : yOf(p.c.h) - 2); ctx.lineTo(p.x, p.below ? p.y : p.y + p.s); ctx.stroke(); ctx.setLineDash([]);
  }
  const drawLabel = ({ r, p, text }) => {
    ctx.fillStyle = p.sel ? '#111' : p.hl ? '#FFF6CC' : 'rgba(255,255,255,.92)';
    ctx.fillRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
    ctx.strokeStyle = '#111'; ctx.lineWidth = 1.2; ctx.strokeRect(r.x0 + 0.5, r.y0 + 0.5, r.x1 - r.x0 - 1, r.y1 - r.y0 - 1);
    ctx.fillStyle = p.sel ? '#fff' : '#111'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.font = `bold 11px ${FONT}`;
    ctx.fillText(text, r.x0 + 5, (r.y0 + r.y1) / 2 + 0.5);
  };
  labels.filter((q) => !q.top).forEach(drawLabel);
  for (const p of placed) {
    const { e, x, y, s, bw } = p; const [bg, fg] = evColors(e);
    if (p.sel || p.hl) { ctx.fillStyle = '#111'; ctx.fillRect(x - bw / 2 + 3, y + 3, bw, s); }
    ctx.fillStyle = bg; ctx.fillRect(x - bw / 2, y, bw, s);
    ctx.strokeStyle = '#111'; ctx.lineWidth = p.sel ? 2.5 : 2; ctx.strokeRect(x - bw / 2, y, bw, s);
    ctx.fillStyle = fg; ctx.font = `bold ${p.sel ? 12 : 10.5}px "JetBrains Mono", monospace`; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    ctx.fillText(e.ath ? '★' : String(e.no), x, y + s / 2 + 0.5); ctx.textAlign = 'left';
    flagHits.push({ e, x0: x - bw / 2 - 2, x1: x + bw / 2 + 2, y0: y - 2, y1: y + s + 2 });
  }
  labels.filter((q) => q.top).forEach(drawLabel);
  for (const q of labels) flagHits.push({ e: q.p.e, ...q.r });
  ctx.restore();
  if (geom.hidden > 0) {
    ctx.font = `bold 10px ${FONT}`; ctx.textBaseline = 'alphabetic';
    const s = t('hidden', { n: geom.hidden }), tw = ctx.measureText(s).width;
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fillRect(PAD.l + plotW - tw - 14, volTop + 1, tw + 10, 13);
    ctx.fillStyle = '#6b665c'; ctx.fillText(s, PAD.l + plotW - tw - 9, volTop + 11);
  }

  // last price tag
  const last = candles[candles.length - 1];
  if (candles.length - 1 <= iTo && xOf(candles.length - 1) <= PAD.l + plotW) {
    const y = yOf(last.c), col = last.c >= last.o ? UP() : DOWN();
    ctx.setLineDash([3, 3]); ctx.strokeStyle = col; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD.l, y); ctx.lineTo(PAD.l + plotW, y); ctx.stroke(); ctx.setLineDash([]);
    tagBox(ctx, PAD.l + plotW + 2, y, money(last.c, true), col, '#fff');
  }
  // crosshair
  if (state.hover >= 0 && state.hover < candles.length && state.mouse) {
    const c = candles[state.hover], x = xOf(state.hover), my = state.mouse.y, inPrice = my > PAD.t && my < PAD.t + priceH;
    ctx.strokeStyle = '#111'; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(x, PAD.t); ctx.lineTo(x, H - PAD.b); ctx.stroke();
    if (inPrice) { ctx.beginPath(); ctx.moveTo(PAD.l, my); ctx.lineTo(PAD.l + plotW, my); ctx.stroke(); }
    ctx.setLineDash([]);
    if (inPrice) { const v = a + (PAD.t + priceH - my) / priceH * (b - a); tagBox(ctx, PAD.l + plotW + 2, my, money(log ? Math.exp(v) : v, true), '#111', '#fff'); }
    const lbl = fmtDn(c.s, tf);
    ctx.font = 'bold 11px "JetBrains Mono", monospace';
    const tw = ctx.measureText(lbl).width + 12;
    ctx.fillStyle = '#111'; ctx.fillRect(x - tw / 2, H - PAD.b + 2, tw, 20);
    ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.fillText(lbl, x - tw / 2 + 6, H - PAD.b + 12);
  }
}

function render() {
  if (state.route !== 'person') return;
  prepare(); draw(); syncRange();
  if (state.hover < 0) { const i = clamp(Math.floor(idxOf(state.view[1]) - 0.5), 0, candles.length - 1); updateLegend(i); renderCompo(candles[i]); }
}

// chart interaction
let drag = null;
const pos = (e, el = canvas) => { const r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
const hitIn = (list, x, y) => list.find((h) => x >= h.x0 && x <= h.x1 && y >= h.y0 && y <= h.y1);
canvas.addEventListener('mousedown', (e) => { if (!geom) return; const p = pos(e); drag = { x: p.x, y: p.y, v0: idxOf(state.view[0]), v1: idxOf(state.view[1]), cw: geom.cw, moved: false }; });
window.addEventListener('mouseup', (e) => {
  if (drag && !drag.moved && e.target === canvas) {
    const hit = hitIn(flagHits, drag.x, drag.y), ch = hitIn(chapHits, drag.x, drag.y);
    if (hit) { stopPlay(); selectEvent(hit.e, { zoom: false }); } else if (ch) { stopPlay(); goChapter(String(ch.c)); }
  }
  drag = null;
});
canvas.addEventListener('mousemove', (e) => {
  if (!geom) return;
  const { x, y } = pos(e);
  if (drag) {
    const dx = x - drag.x; if (Math.abs(dx) > 3) { drag.moved = true; stopPlay(); }
    if (drag.moved) { cancelAnimationFrame(anim); state.view = clampView([dnOf(drag.v0 - dx / drag.cw), dnOf(drag.v1 - dx / drag.cw)]); }
  }
  state.mouse = { x, y };
  const i = Math.round((x - PAD.l) / geom.cw + geom.v0);
  state.hover = i >= 0 && i < candles.length && x < geom.W - PAD.r && y > PAD.t ? i : -1;
  const hit = hitIn(flagHits, x, y), ch = hitIn(chapHits, x, y);
  canvas.style.cursor = hit || ch ? 'pointer' : drag?.moved ? 'grabbing' : 'crosshair';
  setHl(hit ? hit.e : null, false);
  render(); updateHoverUI(ch);
});
canvas.addEventListener('mouseleave', () => { state.hover = -1; state.mouse = null; tip.style.display = 'none'; setHl(null, false); render(); });
canvas.addEventListener('wheel', (e) => {
  e.preventDefault(); stopPlay(); cancelAnimationFrame(anim);
  const [a, b] = state.view, s = b - a, mx = pos(e).x;
  const frac = clamp((mx - PAD.l) / geom.plotW, 0, 1), at = dnOf(geom.v0 + (mx - PAD.l) / geom.cw);
  const ns = s * (e.deltaY > 0 ? 1.18 : 1 / 1.18);
  state.view = clampView([at - frac * ns, at + (1 - frac) * ns]); render();
}, { passive: false });
canvas.addEventListener('dblclick', (e) => { stopPlay(); zoomBy(0.4, clamp((pos(e).x - PAD.l) / geom.plotW, 0, 1)); });

function updateLegend(i) {
  const c = candles[i]; if (!c) return;
  const prev = candles[i - 1], ch = prev ? c.c / prev.c - 1 : 0;
  $('legend').innerHTML = `<span><b>$${M_().P.ticker}</b> · ${t('tf_' + tf)}${state.tfMode === 'auto' ? t('auto_suffix') : ''}</span><span>${fmtDn(c.s, tf)}</span>
    <span>${t('close')} <b style="color:${colOf(c.c - c.o)}">${money(c.c, true)}</b></span>
    <span>${t('change')} <b style="color:${colOf(ch)}">${pct(ch)}</b></span><span>${t('attention')} <b>${c.v.toFixed(1)}</b></span>`;
}
function placeTip(el, box, m) {
  el.style.display = 'block';
  const W = box.clientWidth, tw = el.offsetWidth;
  let x = m.x + 16; if (x + tw > W - 90) x = m.x - tw - 16;
  el.style.left = Math.max(4, x) + 'px'; el.style.top = clamp(m.y + 14, 4, box.clientHeight - el.offsetHeight - 8) + 'px';
}
function updateHoverUI(chHit) {
  const i = state.hover;
  if (chHit) {
    const c = M_().chapters[chHit.c];
    tip.innerHTML = `<div class="t-date">${t('chapter_n', { n: c.i + 1 })} · ${chapYears(c)}</div><div style="font-weight:700;font-size:14px">${esc(L(c.t))}</div><div style="margin-top:4px;line-height:1.5">${esc(L(c.desc))}</div><div class="muted" style="margin-top:5px">${t('chapter_tip', { n: c.evs })}</div>`;
  } else if (i < 0) { tip.style.display = 'none'; return; }
  else {
    const c = candles[i]; updateLegend(i); renderCompo(c);
    const shown = new Set(filteredEvents());
    const evs = M_().events.filter((e) => candles.evCi[e.idx] === i && shown.has(e));
    const prev = candles[i - 1], ch = prev ? c.c / prev.c - 1 : 0;
    tip.innerHTML = `<div class="t-date">${fmtDn(c.s, tf)}${tf !== 'D' && c.e !== c.s ? ' → ' + fmtDn(c.e) : ''}</div>
      <div class="t-row"><span>${t('cap')}</span><b>${money(c.c, true)}</b></div>
      <div class="t-row"><span>${t('change')}</span><b style="color:${colOf(ch)}">${pct(ch)}</b></div>
      <div class="t-row"><span>${t('attention')}</span><b>${c.v.toFixed(1)}</b></div>
      ${evs.length ? `<div class="t-ev">${evs.slice(0, 4).map((e) => `<div>${noBox(e)}<span>${esc(L(e.t))}</span></div>`).join('')}${evs.length > 4 ? `<div class="muted">${t('more', { n: evs.length - 4 })}</div>` : ''}<div class="muted" style="font-weight:400;margin-top:5px">${t('click_no')}</div></div>` : ''}`;
  }
  placeTip(tip, wrap, state.mouse);
}
function renderCompo(c) {
  if (!c) return;
  const segs = [['fin', c.fin, 'var(--fin)'], ['hum', c.hum, 'var(--hum)'], ['rep', c.rep, 'var(--rep)']];
  const tot = c.fin + c.hum + c.rep;
  const parts = esc([...c.parts].sort((x, y) => y[1] - x[1]).map(([l, v]) => `${L(l)} ${money(v, true)}`).join('\n'));
  $('compo').innerHTML = `<span class="lbl">${t('compo')} · ${fmtDn(c.e ?? c.dn)}</span>
    <div class="bar" title="${parts}">${segs.map(([, v, col]) => `<div style="width:${v / tot * 100}%;background:${col}"></div>`).join('')}</div>
    ${segs.map(([k, v, col]) => `<span class="it" title="${k === 'fin' ? parts : k === 'rep' ? `${t('sentiment')} ${c.sent.toFixed(3)}` : ''}"><span class="dot" style="background:${col}"></span>${t(k)} <b>${money(v, true)}</b> ${(v / tot * 100).toFixed(v / tot < 0.01 ? 2 : 0)}%</span>`).join('')}`;
}

// ═════════════════════════ person: event table ═════════════════════════
function filteredEvents() {
  const f = state.filter;
  return M_().events.filter((e) => f === 'all' ? true : f === 'up' ? e.dir > 0 && !e.auto : f === 'down' ? e.dir < 0 && !e.auto
    : f === 'auto' ? e.auto && !e.ath : f === 'early' ? (e.cat === 'origin' || e.cat === 'education') : e.cat === f);
}
const inRange = (e) => e.dn >= state.view[0] && e.dn <= state.view[1];
function renderFilters() {
  const F = [['all', t('f_all')], ['up', t('f_up')], ['down', t('f_down')], ...['milestone', 'wealth', 'career', 'reputation', 'crisis'].map((c) => [c, t('cat_' + c)]), ['early', t('f_early')], ['auto', t('f_auto')]];
  $('filters').innerHTML = F.map(([k, l]) => `<span class="chip${state.filter === k ? ' on' : ''}" data-k="${k}">${l}</span>`).join('') +
    `<span class="chip${state.onlyRange ? ' on' : ''}" data-k="range" style="margin-left:auto">${t('f_range')}</span>`;
  $('filters').querySelectorAll('.chip').forEach((el) => el.onclick = () => {
    if (el.dataset.k === 'range') state.onlyRange = !state.onlyRange; else state.filter = el.dataset.k;
    renderFilters(); renderTable(); render();
  });
}
let rowEls = new Map(), tableKey = '';
function sortedRows() {
  let evs = filteredEvents();
  if (state.onlyRange) evs = evs.filter(inRange);
  const { k, d } = state.sort;
  const val = (e) => k === 'att' ? e.mediaPeak : e[k];
  return [...evs].sort((x, y) => { const a = val(x), b = val(y); if (a == null && b == null) return x.no - y.no; if (a == null) return 1; if (b == null) return -1; return (a - b) * d || x.no - y.no; });
}
function evidence(e) {
  const types = new Set(e.src.map((s) => s.type));
  let score = Math.min(3, e.src.length) + (types.has('filing') || types.has('market') ? 1 : 0) + (e.p === 'day' ? 1 : 0);
  if (e.auto && !e.ath) score = 2;
  score = clamp(score, 1, 5);
  return '★'.repeat(score) + '☆'.repeat(5 - score);
}
function renderTable() {
  const COLS = [['no', '#', 'c-no'], [null, t('c_date'), 'c-date'], [null, t('c_event'), 'c-t'], ['mag', t('c_mag'), ''], ['cv', t('c_cv'), 'r'], ['d30', t('c_d30'), 'r'], ['d1y', t('c_d1y'), 'r'], ['att', t('c_att'), 'att'], [null, t('c_ev'), '']];
  const rows = sortedRows();
  tableKey = rows.map((e) => e.idx).join(',');
  const head = `<thead><tr>${COLS.map(([k, l, cls]) => `<th class="${cls}${k ? ' sort' : ''}${state.sort.k === k ? ' on' : ''}" ${k ? `data-k="${k}"` : ''}>${l}${k ? `<span class="ar">${state.sort.k === k ? (state.sort.d > 0 ? '▲' : '▼') : '↕'}</span>` : ''}</th>`).join('')}</tr></thead>`;
  const body = rows.length ? rows.map((e) => `<tr class="row" data-i="${e.idx}">
      <td class="c-no">${noBox(e)}</td><td class="c-date">${fmtEvDate(e)}</td>
      <td class="c-t"><div class="tt"><span class="cat" style="background:${CAT_COLOR[e.cat] || '#fff'}" title="${t('cat_' + e.cat)}"></span>${esc(L(e.t))}</div></td>
      <td><span class="mag">${'■'.repeat(e.mag)}${'□'.repeat(5 - e.mag)}</span></td>
      <td class="num">${money(e.cv, true)}</td><td class="chg">${chgCell(e.d30)}</td><td class="chg">${chgCell(e.d1y)}</td>
      <td class="att"><div class="att-bar"><div style="width:${(e.mediaPeak * 100).toFixed(0)}%"></div></div></td>
      <td><span class="stars">${evidence(e)}</span></td></tr>`).join('')
    : `<tr class="empty"><td colspan="${COLS.length}">${t('tbl_empty')}</td></tr>`;
  $('evTable').innerHTML = head + `<tbody>${body}</tbody>`;
  rowEls = new Map();
  $('evTable').querySelectorAll('tr.row').forEach((tr) => {
    const e = M_().events[+tr.dataset.i]; rowEls.set(e, tr);
    tr.onclick = () => { stopPlay(); selectEvent(e, { zoom: true, scroll: false }); };
    tr.onmouseenter = () => setHl(e, true);
  });
  $('evTable').onmouseleave = () => setHl(null, true);
  $('evTable').querySelectorAll('th.sort').forEach((th) => th.onclick = () => { const k = th.dataset.k; state.sort = state.sort.k === k ? { k, d: -state.sort.d } : { k, d: k === 'no' ? 1 : -1 }; renderTable(); });
  syncRows();
}
function syncRows() {
  for (const [e, tr] of rowEls) {
    const inr = inRange(e);
    tr.classList.toggle('in', inr); tr.classList.toggle('out', !inr);
    tr.classList.toggle('on', e === state.selEv); tr.classList.toggle('hl', e === state.hlEv);
  }
}
function scrollRow(e) {
  const tr = rowEls.get(e), box = $('tblWrap'); if (!tr) return;
  const head = box.querySelector('thead').offsetHeight, top = tr.offsetTop - head, bottom = tr.offsetTop + tr.offsetHeight;
  if (top < box.scrollTop) box.scrollTop = top - 4; else if (bottom > box.scrollTop + box.clientHeight) box.scrollTop = bottom - box.clientHeight + 4;
}
function setHl(e, fromTable) {
  if (state.hlEv === e) return;
  state.hlEv = e; syncRows();
  if (e && !fromTable) scrollRow(e);
  if (fromTable) draw();
}
function syncRange() {
  const [a, b] = state.view, [L0, L1] = lifeSpan();
  const n = filteredEvents().filter(inRange).length;
  $('rangeNote').innerHTML = b - a > (L1 - L0) * 0.85 ? t('showing_all', { n })
    : `${t('showing_range', { a: fmtDn(Math.max(a, L0), 'M'), b: fmtDn(Math.min(b, L1), 'M'), n })} <span class="lnk" id="rnAll">${t('back_all')}</span>`;
  const ra = $('rnAll'); if (ra) ra.onclick = () => { stopPlay(); setView(fullView(), true); };
  if (state.onlyRange && sortedRows().map((e) => e.idx).join(',') !== tableKey) renderTable();
  syncRows();
  const cc = currentChapter();
  document.querySelectorAll('#chapters .chap').forEach((el) => el.classList.toggle('on', el.dataset.c === cc));
}

// ═════════════════════════ person: dossier ═════════════════════════
function renderDossier() {
  const M = M_(), e = state.selEv, box = $('dossier');
  if (!e) { box.innerHTML = ''; return; }
  const seq = filteredEvents(), posI = seq.indexOf(e);
  const repTxt = e.rep ? `${e.rep > 0 ? '+' : ''}${(e.rep * 100).toFixed(0)}%` : '0';
  const ch = M.chapters.filter((c) => e.dn >= c.from).pop();
  box.innerHTML = `
    <div class="dz-head"><span class="t">${noBox(e)} ${t('dossier')}</span>
      <span class="dz-nav"><button class="btn btn-small" id="evPrev" title="←">←</button><button class="btn btn-small" id="evNext" title="→">→</button></span></div>
    <div class="dz-body">
      <div class="dz-tags">
        ${ch ? `<span class="tag" style="background:${CHAP_FILL[ch.i % CHAP_FILL.length]}">${ch.i + 1} · ${esc(L(ch.t))}</span>` : ''}
        <span class="tag" style="background:${CAT_COLOR[e.cat] || '#fff'}">${t('cat_' + e.cat)}</span>
        <span class="tag">${fmtPrecision(e)}</span>
        <span class="tag" style="background:${e.dir > 0 ? UP() : e.dir < 0 ? DOWN() : '#fff'};color:${e.dir ? '#fff' : '#111'}">${t(e.dir > 0 ? 'good' : e.dir < 0 ? 'bad' : 'neutral')} ${'■'.repeat(e.mag)}</span>
        ${e.auto && !e.ath ? `<span class="tag tag-auto">${t('unresolved')}</span>` : ''}
      </div>
      <div class="dz-title">${esc(L(e.t))}</div>
      <div class="dz-text">${esc(L(e.summary))}</div>
      <div class="dz-sec"><div class="dz-label">${t('dz_impact')}</div>
        <div class="impact">
          <div>${t('dz_30')}<b>${chgCell(e.d30)}</b><span class="muted">${t('dz_then', { v: money(e.cv, true) })}</span></div>
          <div>${t('dz_1y')}<b>${chgCell(e.d1y)}</b><span class="muted">${t('dz_mkt')}</span></div>
          <div>${t('dz_rep')}<b>${repTxt}</b><span class="muted">${t('dz_half')}</span></div>
        </div>
        ${e.fin ? `<div class="dz-fin">💰 ${esc(L(e.fin))}</div>` : ''}
      </div>
      <div class="dz-sec"><div class="dz-label">${t('dz_why')}</div><div class="dz-text">${esc(L(e.why))}</div></div>
      <div class="dz-sec"><div class="dz-label">${t('dz_att')}</div><canvas class="dz-spark" id="dzSpark"></canvas>
        <div class="muted" style="display:flex;gap:12px;margin-top:4px"><span>■ ${t('a_aud')}</span><span style="color:#d6336c">■ ${t('a_media')}</span><span style="color:#1c7ed6">■ ${t('a_search')}</span></div></div>
      <div class="dz-sec"><div class="dz-label">${t('dz_src')} · <span class="stars">${evidence(e)}</span></div>
        <div class="src">${e.src.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener"><span class="ty" style="background:${TY_COLOR[s.type] || '#fff'}">${t('ty_' + s.type)}</span><span>${esc(s.name)}</span><span class="arrow">↗</span></a>`).join('')}</div></div>
      ${PS.REPO ? `<div class="dz-sec"><a class="shot" href="${PS.REPO}/blob/main/data/people/${M.P.id}.json" target="_blank" rel="noopener">✎ ${t('dz_edit')}</a></div>` : ''}
      <div class="dz-foot"><span class="muted">${posI >= 0 ? t('dz_pos', { i: posI + 1, n: seq.length }) : ''}</span>
        <span style="display:flex;gap:6px"><button class="btn btn-small" id="dzZoom">${t('dz_zoom')}</button><button class="btn btn-small" id="dzAll">${t('dz_all')}</button></span></div>
    </div>`;
  $('evPrev').onclick = () => { stopPlay(); stepEvent(-1); };
  $('evNext').onclick = () => { stopPlay(); stepEvent(1); };
  $('dzZoom').onclick = () => { stopPlay(); setView(eventWindow(e), true); };
  $('dzAll').onclick = () => { stopPlay(); setView(fullView(), true); };
  drawSpark(e);
}
function drawSpark(e) {
  const cv = $('dzSpark'); if (!cv) return;
  const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
  cv.width = w * dpr; cv.height = h * dpr; const c = cv.getContext('2d'); c.scale(dpr, dpr);
  const days = M_().days, k0 = Math.max(0, e.k - 60), k1 = Math.min(days.length - 1, e.k + 60), seg = days.slice(k0, k1 + 1);
  if (seg.length < 2) return;
  const mx = Math.max(...seg.map((d) => Math.max(d.va, d.vm, d.vs))) || 1;
  const line = (key, col) => { c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); seg.forEach((d, i) => { const x = 4 + i / (seg.length - 1) * (w - 8), y = h - 6 - d[key] / mx * (h - 12); i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.stroke(); };
  const ex = 4 + (e.k - k0) / (seg.length - 1) * (w - 8);
  c.fillStyle = '#FFF4C2'; c.fillRect(ex - 2, 0, 4, h);
  line('va', '#111'); line('vm', '#d6336c'); line('vs', '#1c7ed6');
  c.font = `bold 9px ${FONT}`; c.fillStyle = '#111'; c.fillText(t('a_event'), ex + 4, 10);
}

// selection + story mode
function selectEvent(e, { zoom = false, scroll = true } = {}) {
  state.selEv = e; renderDossier(); syncRows();
  if (scroll) scrollRow(e);
  if (zoom || !inRange(e)) setView(eventWindow(e), true); else draw();
}
function stepEvent(dir) {
  const evs = filteredEvents(); if (!evs.length) return;
  let i = evs.indexOf(state.selEv); i = i < 0 ? 0 : clamp(i + dir, 0, evs.length - 1);
  selectEvent(evs[i], { zoom: true });
}
let playTimer = 0;
const playSeq = () => filteredEvents().filter((e) => !e.auto && e.mag >= 4);
function playStep() {
  const seq = playSeq(); if (!seq.length) { stopPlay(); return; }
  const i = seq.indexOf(state.selEv);
  const next = i < 0 ? seq.find((e) => !state.selEv || e.dn > state.selEv.dn) || seq[0] : seq[i + 1];
  if (!next) { stopPlay(); setView(fullView(), true); return; }
  selectEvent(next, { zoom: true });
}
function startPlay() {
  const seq = playSeq(); if (!seq.length) return;
  if (state.selEv === seq[seq.length - 1] || !seq.includes(state.selEv)) state.selEv = null;
  state.playing = true; $('playBtn').classList.add('on'); $('playBtn').textContent = t('pause');
  playStep(); playTimer = setInterval(playStep, 3600);
}
function stopPlay() {
  if (!state.playing) return;
  state.playing = false; clearInterval(playTimer);
  $('playBtn').classList.remove('on'); $('playBtn').textContent = t('play');
}

function renderPersonAll() { renderEntry(); renderChapters(); renderFilters(); renderTable(); renderDossier(); resize(); }
function selectPerson(id) {
  state.pid = id; state.hlEv = null; state.filter = 'all'; state.hover = -1;
  const evs = MODELS[id].events;
  state.selEv = [...evs].reverse().find((e) => !e.auto && e.mag >= 5) || evs[evs.length - 1];
  state.view = fullView();
  renderPersonAll(); scrollRow(state.selEv);
}
$('zoomIn').onclick = () => { stopPlay(); zoomBy(0.5); };
$('zoomOut').onclick = () => { stopPlay(); zoomBy(2); };
$('tfSel').onchange = (e) => { state.tfMode = e.target.value; render(); };
$('scaleBtn').onclick = () => { state.scale = state.scale === 'log' ? 'lin' : 'log'; syncChrome(); render(); };
$('playBtn').onclick = () => state.playing ? stopPlay() : startPlay();
window.addEventListener('keydown', (e) => {
  if (state.route !== 'person' || ['SELECT', 'INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
  if (e.key === 'ArrowLeft') { stopPlay(); stepEvent(-1); e.preventDefault(); }
  else if (e.key === 'ArrowRight') { stopPlay(); stepEvent(1); e.preventDefault(); }
  else if (e.key === '+' || e.key === '=') zoomBy(0.5);
  else if (e.key === '-') zoomBy(2);
  else if (e.key === 'Escape') { stopPlay(); setView(fullView(), true); }
  else if (e.key === ' ') { e.preventDefault(); state.playing ? stopPlay() : startPlay(); }
});

// ═════════════════════════ compare ═════════════════════════
const cmpCanvas = $('cmpChart'), cctx = cmpCanvas.getContext('2d'), cmpWrap = $('cmpWrap'), cmpTip = $('cmpTip');
const lineColor = (id) => LINE[ORDER.indexOf(id) % LINE.length];
function series(id) {
  const M = MODELS[id];
  if (!M.series) M.series = getCandles(M, 'M').map((c) => ({ age: (c.e - M.born) / 365.25, year: 1970 + c.e / 365.25, c: c.c }));
  return M.series;
}
function valueAt(id, x, mode) {
  const s = series(id), key = mode;
  if (x < s[0][key] || x > s[s.length - 1][key] + 0.09) return null;
  let lo = 0, hi = s.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (s[m][key] < x) lo = m + 1; else hi = m; }
  return s[lo].c;
}
function renderCompare() {
  const C = state.cmp;
  $('cmpMode').querySelectorAll('button').forEach((b) => { b.classList.toggle('on', b.dataset.m === C.mode); b.onclick = () => { C.mode = b.dataset.m; C.hover = null; renderCompare(); }; });
  $('cmpPick').innerHTML = ORDER.map((id) => { const on = C.ids.includes(id); return `<span class="chip pick${on ? ' on' : ''}" data-id="${id}" style="${on ? `background:${lineColor(id)};border-color:#111;color:#fff` : ''}">${esc(L(MODELS[id].P.name))}</span>`; }).join('');
  $('cmpPick').querySelectorAll('.chip').forEach((el) => el.onclick = () => { const id = el.dataset.id; C.ids = C.ids.includes(id) ? C.ids.filter((x) => x !== id) : [...C.ids, id]; renderCompare(); });
  const ids = ORDER.filter((id) => C.ids.includes(id));
  const ages = [15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 80, 90].filter((a) => ids.some((id) => MODELS[id].S.age >= a));
  $('cmpTable').innerHTML = `<thead><tr><th>${t('cmp_agecol')}</th>${ids.map((id) => `<th class="r"><span class="dot" style="background:${lineColor(id)}"></span> ${esc(L(MODELS[id].P.name))}</th>`).join('')}</tr></thead><tbody>` +
    ages.map((a) => { const vals = ids.map((id) => valueAt(id, a, 'age')); const mx = Math.max(...vals.filter((v) => v != null));
      return `<tr class="row in" style="cursor:default"><td class="c-date"><b>${a}</b></td>${vals.map((v) => `<td class="num">${v == null ? `<span class="muted">${t('cmp_not_yet')}</span>` : v === mx && ids.length > 1 ? `<b class="best">${money(v, true)}</b>` : money(v, true)}</td>`).join('')}</tr>`; }).join('') + '</tbody>';
  drawCompare();
}
function drawCompare() {
  if (state.route !== 'compare') return;
  const r = cmpWrap.getBoundingClientRect(), dpr = window.devicePixelRatio || 1; if (!r.width) return;
  cmpCanvas.width = r.width * dpr; cmpCanvas.height = r.height * dpr; cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = r.width, H = r.height, P = { l: 12, r: 120, t: 16, b: 28 }, plotW = W - P.l - P.r, plotH = H - P.t - P.b;
  const C = state.cmp, ids = ORDER.filter((id) => C.ids.includes(id)), key = C.mode;
  cctx.clearRect(0, 0, W, H); if (!ids.length) return;
  let x0 = Infinity, x1 = -Infinity, mn = Infinity, mx = -Infinity;
  for (const id of ids) { const s = series(id); x0 = Math.min(x0, s[0][key]); x1 = Math.max(x1, s[s.length - 1][key]); for (const p of s) { mn = Math.min(mn, p.c); mx = Math.max(mx, p.c); } }
  if (key === 'age') x0 = 0;
  const la = Math.log(mn) - 0.3, lb = Math.log(mx) + 0.5;
  const X = (v) => P.l + (v - x0) / (x1 - x0) * plotW, Y = (v) => P.t + plotH - (Math.log(v) - la) / (lb - la) * plotH;
  state.cmp.geom = { P, plotW, x0, x1 };
  cctx.font = '11px "JetBrains Mono", monospace'; cctx.textBaseline = 'middle';
  for (const tk of yAxisTicks(Math.exp(la), Math.exp(lb), true)) { const y = Y(tk); cctx.strokeStyle = '#EEE9DC'; cctx.lineWidth = 1; cctx.beginPath(); cctx.moveTo(P.l, y); cctx.lineTo(P.l + plotW, y); cctx.stroke(); cctx.fillStyle = '#555'; cctx.textAlign = 'left'; cctx.fillText(money(tk, true), P.l + plotW + 8, y); }
  const step = key === 'age' ? 10 : 10;
  cctx.textAlign = 'center'; cctx.textBaseline = 'alphabetic'; cctx.fillStyle = '#111';
  for (let v = Math.ceil(x0 / step) * step; v <= x1; v += step) { const x = X(v); cctx.strokeStyle = '#F3EFE5'; cctx.beginPath(); cctx.moveTo(x, P.t); cctx.lineTo(x, P.t + plotH); cctx.stroke(); cctx.fillText(key === 'age' ? (PS.lang === 'zh' ? `${v} 岁` : `age ${v}`) : `${v}`, x, H - 9); }
  cctx.strokeStyle = '#111'; cctx.lineWidth = 2; cctx.beginPath(); cctx.moveTo(P.l, P.t + plotH); cctx.lineTo(P.l + plotW, P.t + plotH); cctx.lineTo(P.l + plotW, P.t); cctx.stroke();
  const ends = [];
  for (const id of ids) {
    const s = series(id); cctx.strokeStyle = lineColor(id); cctx.lineWidth = 2.5; cctx.lineJoin = 'round'; cctx.beginPath();
    s.forEach((p, i) => { const x = X(p[key]), y = Y(p.c); i ? cctx.lineTo(x, y) : cctx.moveTo(x, y); }); cctx.stroke();
    const last = s[s.length - 1]; ends.push({ id, x: X(last[key]), y: Y(last.c) });
  }
  // end labels, nudged apart
  ends.sort((a, b) => a.y - b.y); for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 20 && Math.abs(ends[i].x - ends[i - 1].x) < 110) ends[i].y = ends[i - 1].y + 20;
  cctx.textAlign = 'left';
  for (const e of ends) {
    cctx.fillStyle = lineColor(e.id); cctx.beginPath(); cctx.arc(e.x, Y(series(e.id).at(-1).c), 4, 0, 7); cctx.fill();
    const name = L(MODELS[e.id].P.name); cctx.font = `bold 11px ${FONT}`;
    const lx = Math.min(e.x + 8, W - cctx.measureText(name).width - 14), w = cctx.measureText(name).width + 10;
    cctx.fillStyle = lineColor(e.id); cctx.fillRect(lx, e.y - 9, w, 18); cctx.strokeStyle = '#111'; cctx.lineWidth = 1.5; cctx.strokeRect(lx, e.y - 9, w, 18);
    cctx.fillStyle = '#fff'; cctx.textBaseline = 'middle'; cctx.fillText(name, lx + 5, e.y + 0.5);
  }
  if (C.hover != null) {
    const x = X(C.hover); cctx.strokeStyle = '#111'; cctx.lineWidth = 1; cctx.setLineDash([4, 3]); cctx.beginPath(); cctx.moveTo(x, P.t); cctx.lineTo(x, P.t + plotH); cctx.stroke(); cctx.setLineDash([]);
    for (const id of ids) { const v = valueAt(id, C.hover, key); if (v == null) continue; cctx.fillStyle = lineColor(id); cctx.strokeStyle = '#111'; cctx.lineWidth = 1.5; cctx.beginPath(); cctx.arc(x, Y(v), 4.5, 0, 7); cctx.fill(); cctx.stroke(); }
  }
}
cmpCanvas.addEventListener('mousemove', (e) => {
  const g = state.cmp.geom; if (!g) return;
  const m = pos(e, cmpCanvas), C = state.cmp;
  const x = g.x0 + clamp((m.x - g.P.l) / g.plotW, 0, 1) * (g.x1 - g.x0);
  C.hover = x; drawCompare();
  const rows = ORDER.filter((id) => C.ids.includes(id)).map((id) => [id, valueAt(id, x, C.mode)]).filter((r) => r[1] != null).sort((a, b) => b[1] - a[1]);
  cmpTip.innerHTML = `<div class="t-date">${C.mode === 'age' ? t('cmp_at_age', { a: x.toFixed(1) }) : t('cmp_in_year', { y: Math.floor(x) })}</div>` +
    rows.map(([id, v]) => `<div class="t-row"><span><span class="dot" style="background:${lineColor(id)}"></span> ${esc(L(MODELS[id].P.name))}</span><b>${money(v, true)}</b></div>`).join('');
  placeTip(cmpTip, cmpWrap, m);
});
cmpCanvas.addEventListener('mouseleave', () => { state.cmp.hover = null; cmpTip.style.display = 'none'; drawCompare(); });

PS.app = { MODELS, state };
boot();
})();
