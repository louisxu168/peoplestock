# Person file schema

Every person is one JSON file: `data/people/<id>.json`. Add the id to `data/people/index.json` to list them on the site.
The best way to learn the format is to read `data/people/jensen.json` next to this page.

All money is **USD**. All dates are strings: `"YYYY"`, `"YYYY-MM"` or `"YYYY-MM-DD"`.
All human-readable text is bilingual: `{ "en": "...", "zh": "..." }`. English is required, Chinese is welcome.

## Top level

| Field | Meaning |
|---|---|
| `id` | lowercase slug, same as the file name |
| `name` | `{en, zh}` |
| `ticker` | 3–5 capital letters, a made-up "life ticker" (e.g. `MUSK`) |
| `born` | birth date, day precision |
| `color` | avatar color, one of `#B8F25B #7CC4FF #FFD84D #FF9EC4 #FF9F43 #C9B8FF` |
| `initials` | two letters |
| `tagline` | one line `{en, zh}` |
| `tags` | 3–4 short `{en, zh}` tags |
| `privates` | holdings with no daily quote (see below) |
| `stocks` | listed holdings priced from real daily data (see below) |
| `options` | optional, a large option grant (see `musk.json`) |
| `human` | human-capital step targets |
| `audience` | audience size anchors |
| `media` | media baseline anchors |
| `chapters` | 5–7 life chapters |
| `events` | the event library, usually 25–45 events |

An **anchor list** is `[["date", value], ...]` sorted by date.

## Financial capital

`stocks[]`: `{ sym, label, from, own, shares }`

- `sym` is the Yahoo Finance symbol. `from` is the first trading day (the IPO date).
- `own` is an anchor list of the ownership fraction (0.13 = 13%), linearly interpolated.
- `shares` is an anchor list of total shares outstanding **on today's split-adjusted basis**, because prices are split-adjusted. Example: a company with 100M shares in 2000 that later split 2-for-1 and 4-for-1 has 800M adjusted shares in 2000.
- Stake value on any day = `own × shares × close`. **Sanity check:** the latest value must land near the stake value published by Forbes or Bloomberg.

`privates[]`: `{ label, from?, until?, anchors }`

- `anchors` is the USD value of the stake itself (not the company), log-interpolated between anchors.
- Use it for pre-IPO equity, cash from exits, private companies and diversified wealth (a family office, cash from past share sales).
- `until` the day before an IPO, so the stock takes over without a jump: make the last private anchor equal to the stake value at the IPO price.
- Before the first anchor the value is 0, so start the first list early (first job, first savings).

## Human capital

`human`: step targets for "present value of future earning power". The model climbs toward each step over roughly a year.
Typical scale: `3e5` at birth in a rich country, `1.5e6` after a strong degree, `5e6` founder of a funded startup, `1e7–3e7` public-company CEO, `1e8–3e8` globally famous operator.

## Attention

- `audience`: people reached (social followers plus regular media audience). It should grow smoothly.
- `media`: relative baseline of media coverage. `1` = known in the industry, `10` = national figure, `40+` = constant global headlines.

## Chapters

`chapters[]`: `{ from, t, desc }`. The first one starts at `born`. Each chapter ends where the next begins.
Titles are short (2–4 words), like a table of contents.

## Events

```json
{
  "d": "2018-08-07", "p": "day",
  "cat": "crisis", "dir": -1, "mag": 5, "rep": -0.06,
  "s": { "en": "\"Funding secured\"", "zh": "\"资金已到位\"" },
  "t": { "en": "\"Funding secured\" tweet, sued by the SEC", "zh": "…" },
  "summary": { "en": "What happened, 1–2 sentences, in your own words.", "zh": "…" },
  "why": { "en": "How the model scores it and why.", "zh": "…" },
  "fin": { "en": "Optional: how financial capital reflects it.", "zh": "…" },
  "src": [ { "name": "SEC · Press release 2018-226", "url": "https://…", "type": "filing" } ]
}
```

| Field | Rule |
|---|---|
| `d`, `p` | date and its precision: `day`, `month` or `year`. Do not fake precision. If you only know the year, use `"p": "year"`. |
| `cat` | `origin`, `education`, `career`, `wealth`, `milestone`, `reputation`, `crisis` |
| `dir` | `1` good for the person, `-1` bad, `0` neutral or mixed |
| `mag` | 1–5. 1 = footnote, 3 = notable, 5 = life-defining. Keep 5s rare (4–8 per person). |
| `rep` | shock to the reputation coefficient, between `-0.06` and `+0.06`. It decays with a 2.5-year half-life. Use `0` when the effect is fully in the stock price. |
| `s` | label drawn on the chart, at most ~16 Latin characters or ~8 Chinese characters |
| `src` | at least one source. `type` is `wiki`, `news`, `filing` or `market`. Prefer primary sources (SEC filings, company releases). Every URL must be real and checked. |

### Rules that keep the data honest

1. **No double counting.** If the market priced an event (earnings, a tweet that moved the stock), the stock already carries it. Only use `rep` for what the price cannot see.
2. **No invented causes.** If you cannot source why something happened, leave it out. The model flags unexplained price moves by itself.
3. **Public life only.** No health, family tragedy, relationships or rumors, unless the person made it a public business matter. Public figures only.
4. **Your own words.** Summaries are written fresh, not copied from the source.
5. **Estimates are labeled.** Ownership, private valuations and audience numbers are estimates from public reporting. Say so in `why` when it matters.
