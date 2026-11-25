/* UI strings. English is the default; add a language by adding one more block. */
(() => {
'use strict';
const PS = (globalThis.PS = globalThis.PS || {});

// Set this to your repository so "edit on GitHub" links work.
PS.REPO = 'https://github.com/louisxu168/peoplestock';

const STR = {
  en: {
    tagline: 'Every life is a chart',
    nav_home: 'Leaderboard', nav_compare: 'Compare by age', nav_method: 'Methodology', nav_github: 'GitHub',
    color_green: 'Green = up', color_red: 'Red = up',
    loading: 'Loading price data and building every life…',
    load_fail: 'Could not load the data. If you just cloned the repo, run <code>python scripts/fetch_prices.py</code> first, then serve the folder with <code>python -m http.server</code>.',
    hero_title: 'Every life is a chart.',
    hero_sub: 'PeopleStock draws the lives of public figures as candlestick charts. Real stock prices are the anchor, sourced life events are the story, and every number can be traced. Open data, open algorithm.',
    idx_total: 'Total life market cap', idx_people: '{n} people tracked', idx_up: 'Biggest riser today', idx_down: 'Biggest faller today', idx_asof: 'Prices as of {d}',
    lb_title: 'Leaderboard', lb_hint: 'Click a column to sort · click a row to open the chart',
    col_person: 'Person', col_cap: 'Life market cap', col_day: 'Today', col_1y: '1 year', col_cagr: 'CAGR since listing', col_mdd: 'Max drawdown', col_ath: 'From peak', col_rep: 'Reputation share', col_age: 'Age', col_2y: 'Last 2 years',
    feed_title: 'Latest sourced events', feed_hint: 'Newest first, across everyone',
    add_person: 'Add a person', add_person_sub: 'One JSON file per person. Open a pull request.',
    // person page
    born: 'born {d}', meta: '{c} chapters · {e} sourced events · {s} sources · updated {d}',
    st_cap: 'Life market cap', st_today: 'today {a} · 1y {b}', st_ath: 'All-time high', st_ath_sub: '{d} · {p} from peak',
    st_cagr: 'CAGR since listing', st_cagr_sub: 'since {y} · {m}×', st_mdd: 'Max drawdown',
    st_best: 'Best 30 days after an event', st_worst: 'Worst 30 days after an event',
    chapters: 'Chapters', whole_life: 'Whole life', now: 'now',
    k_label: 'Candles', tf_auto: 'Auto', tf_D: 'Daily', tf_W: 'Weekly', tf_M: 'Monthly', tf_Y: 'Yearly', auto_suffix: ' (auto)',
    log: 'Log', lin: 'Linear', play: '▶ Play this life', pause: '❚❚ Pause',
    close: 'Close', change: 'Change', attention: 'Attention', cap: 'Life market cap',
    prelisting: 'Estimated era · no public quote', listed_from: '▶ Listed · real daily prices',
    hidden: '+{n} smaller events hidden · zoom in', click_no: 'Click a number to open its dossier',
    more: '… {n} more', chapter_n: 'Chapter {n}', chapter_tip: '{n} events · click to zoom into this chapter',
    compo: 'Made of', fin: 'Financial', hum: 'Human', rep: 'Reputation', sentiment: 'Reputation coefficient',
    tbl_title: 'Life events', showing_all: 'Showing the whole life · <b>{n}</b> events',
    showing_range: 'Chart shows <b>{a} → {b}</b> · <b>{n}</b> events in view', back_all: '⟲ Back to whole life',
    f_all: 'All', f_up: '▲ Good', f_down: '▼ Bad', f_early: 'Origin · school', f_auto: '? Unexplained', f_range: '⌗ Only what the chart shows',
    c_date: 'Date', c_event: 'Event', c_mag: 'Size', c_cv: 'Cap then', c_d30: '30 days later', c_d1y: '1 year later', c_att: 'Attention', c_ev: 'Evidence',
    tbl_empty: 'No matching events in this range. Drag or zoom out the chart.',
    tbl_note: '"30 days / 1 year later" is how the life market cap actually moved after the event. It includes the whole market and everything else that happened, so it shows what followed, not what the event alone caused. Values before the first listing come from interpolation.',
    dossier: 'Dossier', dz_impact: 'How big was it', dz_30: '30 days later', dz_1y: '1 year later', dz_rep: 'Reputation shock',
    dz_then: 'cap then {v}', dz_mkt: 'includes the market', dz_half: 'half-life ~2.5 years',
    dz_why: 'How the model scores it', dz_att: 'Attention, 60 days before and after', dz_src: 'Evidence',
    a_aud: 'audience', a_media: 'media', a_search: 'search', a_event: 'event',
    good: '▲ Good', bad: '▼ Bad', neutral: '● Neutral', unresolved: 'Needs research',
    dz_pos: '{i} of {n}', dz_zoom: '🔍 Zoom here', dz_all: '⟲ All', dz_edit: 'Something wrong or missing? Edit this file on GitHub',
    p_year: '{y}', p_month: '{y}-{m}',
    cat_origin: 'Origin', cat_education: 'Education', cat_career: 'Career', cat_wealth: 'Wealth', cat_milestone: 'Milestone', cat_reputation: 'Reputation', cat_crisis: 'Crisis', cat_anomaly: 'Unexplained',
    ty_wiki: 'WIKI', ty_news: 'NEWS', ty_filing: 'FILING', ty_market: 'PRICES',
    // compare
    cmp_title: 'Compare lives', cmp_sub: 'Line everyone up at the same age and see who was where.',
    cmp_age: 'By age', cmp_year: 'By year', cmp_pick: 'Pick people', cmp_at_age: 'At age {a}', cmp_in_year: 'In {y}',
    cmp_tbl: 'Life market cap at the same age', cmp_agecol: 'Age', cmp_not_yet: '—',
    cmp_note: 'Values before a person\'s first listing are estimates interpolated from public reporting.',
    // methodology
    m_title: 'How is a life priced?', m_ver: 'model v0.3',
    m_formula: 'Life market cap = <b class="c-fin">financial capital</b> + <b class="c-hum">human capital</b> + <b class="c-rep">reputation capital</b>',
    m_fin_h: 'Financial capital · the anchor', m_fin: 'Listed holdings = ownership × shares outstanding × the real daily price (split-adjusted). Private holdings are interpolated between funding rounds on a log scale, with a small simulated wobble.',
    m_hum_h: 'Human capital · future earning power', m_hum: 'The present value of what a person can still earn. Degrees and career steps set a target, and the value climbs toward it over about a year. It never jumps overnight.',
    m_rep_h: 'Reputation capital · compounding and decay', m_rep: 'Smoothed audience × $150 per person × a reputation coefficient. Each event nudges the coefficient up or down, and the nudge fades with a 2.5-year half-life.',
    m_att_h: 'Attention · drawn as volume', m_att: '35% audience + 40% media + 25% search. Events add a pulse that fades in days. Follower growth is smoothed, so nobody gains a million fans in a day.',
    m_anti: '<b>No double counting.</b> If the market already priced an event, the stock carries it and reputation only counts what the price cannot see. Big moves with no sourced event are flagged as <span class="tag tag-auto">unexplained</span>. <b>The model never invents a cause.</b>',
    m_more: 'Read the full methodology',
    disclaimer: 'PeopleStock is an estimate built from public reporting. Ownership, private valuations and audience sizes are approximations. It is not anyone\'s real net worth and it is not investment advice. Only public figures and public events are covered: health, family and private life are never scored.',
    foot: 'PeopleStock · open data, open algorithm · prices as of {d}',
  },
  zh: {
    tagline: '每个人的一生都是一张 K 线',
    nav_home: '排行榜', nav_compare: '同龄对比', nav_method: '算法', nav_github: 'GitHub',
    color_green: '绿涨红跌', color_red: '红涨绿跌',
    loading: '正在加载行情并计算每个人的一生…',
    load_fail: '数据加载失败。如果你刚克隆仓库，请先运行 <code>python scripts/fetch_prices.py</code>，再用 <code>python -m http.server</code> 打开。',
    hero_title: '每个人的一生，都是一张 K 线。',
    hero_sub: '人生股市把公众人物的一生画成 K 线图：真实股价做锚点，有来源的人生事件做注脚，每个数字都能查到出处。数据开源，算法开源。',
    idx_total: '人生总市值', idx_people: '已收录 {n} 人', idx_up: '今日涨幅最大', idx_down: '今日跌幅最大', idx_asof: '行情截至 {d}',
    lb_title: '排行榜', lb_hint: '点表头排序 · 点一行打开 K 线',
    col_person: '人物', col_cap: '人生市值', col_day: '今日', col_1y: '近一年', col_cagr: '上市以来年化', col_mdd: '最大回撤', col_ath: '距最高点', col_rep: '声誉占比', col_age: '年龄', col_2y: '近两年',
    feed_title: '最新事件', feed_hint: '所有人物，按时间倒序',
    add_person: '添加人物', add_person_sub: '每个人一个 JSON 文件，欢迎提 PR。',
    born: '{d} 出生', meta: '{c} 个人生章节 · {e} 个已核实事件 · {s} 条来源 · 更新于 {d}',
    st_cap: '人生市值', st_today: '今日 {a} · 近一年 {b}', st_ath: '历史最高', st_ath_sub: '{d} · 距高点 {p}',
    st_cagr: '上市以来年化复利', st_cagr_sub: '{y} 年起 · {m} 倍', st_mdd: '最大回撤',
    st_best: '事件后 30 天涨最多', st_worst: '事件后 30 天跌最多',
    chapters: '章节', whole_life: '全部人生', now: '今',
    k_label: 'K 线', tf_auto: '自动', tf_D: '日线', tf_W: '周线', tf_M: '月线', tf_Y: '年线', auto_suffix: '（自动）',
    log: '对数', lin: '线性', play: '▶ 播放人生', pause: '❚❚ 暂停',
    close: '收', change: '涨跌', attention: '关注度', cap: '人生市值',
    prelisting: '估值插值期 · 无公开报价', listed_from: '▶ 上市 · 真实日线',
    hidden: '+{n} 个小事件已收起 · 放大查看', click_no: '点击编号查看调研档案',
    more: '… 还有 {n} 个', chapter_n: '第 {n} 章', chapter_tip: '{n} 个事件 · 点击放大到这一章',
    compo: '构成', fin: '金融资本', hum: '人力资本', rep: '声誉资本', sentiment: '口碑系数',
    tbl_title: '人生事件表', showing_all: '显示全部人生 · <b>{n}</b> 个事件',
    showing_range: '图表正显示 <b>{a} → {b}</b> · 其中 <b>{n}</b> 个事件', back_all: '⟲ 回到全部人生',
    f_all: '全部', f_up: '▲ 利好', f_down: '▼ 利空', f_early: '起点 · 学业', f_auto: '? 未解释异动', f_range: '⌗ 只看图表范围',
    c_date: '日期', c_event: '事件', c_mag: '强度', c_cv: '当时市值', c_d30: '30 天后', c_d1y: '1 年后', c_att: '关注度', c_ev: '证据',
    tbl_empty: '这个范围内没有符合筛选的事件。拖动或缩小图表看看。',
    tbl_note: '「30 天 / 1 年后」是事件发生后人生市值的实际变化，包含大盘等其他因素，只表示之后发生了什么，不代表全部由这件事造成。上市前的数值来自估值插值。',
    dossier: '调研档案', dz_impact: '影响有多大', dz_30: '30 天后', dz_1y: '1 年后', dz_rep: '口碑冲击',
    dz_then: '当时 {v}', dz_mkt: '含大盘等因素', dz_half: '半衰期约 2.5 年',
    dz_why: '评分逻辑', dz_att: '前后 60 天关注度', dz_src: '证据链',
    a_aud: '受众', a_media: '媒体', a_search: '搜索', a_event: '事件',
    good: '▲ 利好', bad: '▼ 利空', neutral: '● 中性', unresolved: '待调研',
    dz_pos: '第 {i} / {n} 个', dz_zoom: '🔍 放大到这里', dz_all: '⟲ 全部', dz_edit: '发现错误或遗漏？在 GitHub 上修改这个文件',
    p_year: '{y} 年', p_month: '{y} 年 {m} 月',
    cat_origin: '起点', cat_education: '学业', cat_career: '事业', cat_wealth: '财富', cat_milestone: '里程碑', cat_reputation: '声誉', cat_crisis: '危机', cat_anomaly: '未解释异动',
    ty_wiki: '百科', ty_news: '新闻', ty_filing: '监管文件', ty_market: '行情',
    cmp_title: '同龄对比', cmp_sub: '把所有人按同一年龄对齐，看看谁在哪个位置。',
    cmp_age: '按年龄', cmp_year: '按年份', cmp_pick: '选择人物', cmp_at_age: '{a} 岁时', cmp_in_year: '{y} 年',
    cmp_tbl: '同一年龄时的人生市值', cmp_agecol: '年龄', cmp_not_yet: '—',
    cmp_note: '上市之前的数值是根据公开报道插值得到的估算。',
    m_title: '人生市值怎么算？', m_ver: '模型 v0.3',
    m_formula: '人生市值 = <b class="c-fin">金融资本</b> + <b class="c-hum">人力资本</b> + <b class="c-rep">声誉资本</b>',
    m_fin_h: '金融资本 · 锚点', m_fin: '上市公司持股 = 持股比例 × 总股本 × 当日真实股价（拆股复权）。非上市资产按历次融资估值做对数插值，并叠加小幅模拟波动。',
    m_hum_h: '人力资本 · 未来赚钱能力', m_hum: '未来收入能力的现值。学历和职业里程碑设定目标值，实际值用大约一年的时间平滑爬升，不会一夜跳变。',
    m_rep_h: '声誉资本 · 复利与衰减', m_rep: '平滑后的受众规模 × 每人 $150 × 口碑系数。每个事件给口碑系数一个正负冲击，按约两年半的半衰期衰减。',
    m_att_h: '关注度 · 画成成交量', m_att: '35% 受众 + 40% 媒体 + 25% 搜索。事件带来几天内衰减的脉冲；粉丝增长做了平滑，不会一天涨一百万粉。',
    m_anti: '<b>防重复计算：</b>事件如果已经体现在股价里，金融资本已经反映，声誉部分只计市场没定价的部分。找不到已核实事件的大幅波动标为 <span class="tag tag-auto">未解释异动</span>，<b>模型从不编造原因</b>。',
    m_more: '阅读完整算法说明',
    disclaimer: '人生股市是基于公开报道的估算。持股比例、私有估值、受众规模均为近似值，不代表任何人的真实资产，也不构成投资建议。只收录公众人物和公开事件，健康、家庭和私人生活不计分。',
    foot: '人生股市 · 数据开源，算法开源 · 行情截至 {d}',
  },
};

const store = (() => { try { return window.localStorage; } catch { return null; } })();
const nav = typeof navigator !== 'undefined' ? navigator.language || 'en' : 'en';
const forced = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('lang') : null; // ?lang=en | ?lang=zh
PS.lang = (STR[forced] && forced) || (store && store.getItem('ps.lang')) || (nav.toLowerCase().startsWith('zh') ? 'zh' : 'en');
const savedColor = store && store.getItem('ps.redUp');
PS.redUp = savedColor != null ? savedColor === '1' : PS.lang === 'zh';
PS.save = () => { if (store) { store.setItem('ps.lang', PS.lang); store.setItem('ps.redUp', PS.redUp ? '1' : '0'); } };

PS.t = (k, vars) => {
  let s = (STR[PS.lang] && STR[PS.lang][k]) ?? STR.en[k] ?? k;
  if (vars) for (const v in vars) s = s.replace(`{${v}}`, vars[v]);
  return s;
};
// pick the current language out of a {en, zh} object, falling back to whichever exists
PS.L = (o) => o == null ? '' : typeof o === 'string' ? o : (o[PS.lang] || o.en || o.zh || '');
PS.money = (v, short) => PS.moneyIn(PS.lang, v, short);
PS.applyI18n = (root = document) => {
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.innerHTML = PS.t(el.dataset.i18n); });
  document.documentElement.lang = PS.lang === 'zh' ? 'zh-CN' : 'en';
};
})();
