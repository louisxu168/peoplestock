# Contributing

PeopleStock works like a wiki: every person is one JSON file, and every change is a pull request that others can discuss.

## Three good first contributions

1. **Explain an unexplained move.** Grey numbered flags on a chart are days with a big move and no sourced event. Find out what happened, add the event with a source.
2. **Fix a score or a date.** If you think an event is over- or under-rated, change it and say why in the PR.
3. **Add a person.** Copy the structure of `data/people/jensen.json` and follow [docs/SCHEMA.md](docs/SCHEMA.md).

## Before you open a pull request

```bash
python scripts/fetch_prices.py     # needed once, and when you add a new stock symbol
node scripts/validate.mjs          # checks every person file
python -m http.server 8765         # look at your change at http://localhost:8765
```

For a new person, add their id to `data/people/index.json` and check that the latest life market cap is close to a published estimate (Forbes or Bloomberg). Put that comparison in the PR description.

## Who can be added

- **Public figures only.** People who chose a public role and have substantial public reporting about them.
- For now the model needs a **listed stock as an anchor**. Founders and major shareholders of public companies fit best.
- No private individuals, no minors.

## Scoring rubric

| `mag` | Meaning | Example |
|---|---|---|
| 1 | Footnote | a degree, an early job |
| 2 | Minor | a mid-sized acquisition |
| 3 | Notable | a major product launch, a bad earnings day |
| 4 | Major | an IPO-scale milestone, a near-death moment for the company |
| 5 | Life-defining | founding the company, the event people will remember them for |

Keep 5s rare: four to eight per person.

`rep` (reputation shock) runs from −0.06 to +0.06. Use ±0.01–0.02 for ordinary good or bad press, ±0.03–0.04 for something widely covered, ±0.05–0.06 only for a defining moment. Use `0` when the effect is fully in the stock price.

## Content rules

1. **Every event needs a source** that a reader can open. Prefer filings and company releases, then major news, then Wikipedia.
2. **Write summaries in your own words.** Do not paste text from articles.
3. **Public life only.** No health, family, relationships or rumors. A divorce or a death is included only as the public financial or corporate fact it produced.
4. **Neutral language.** Describe what is established. Contested claims are described as contested, with a source.
5. **Do not fake precision.** If you only know the year, set `"p": "year"`.
6. **English is required, Chinese is welcome.** Text fields are `{ "en": "...", "zh": "..." }`.

## Disagreements

Scores are judgments. When two contributors disagree, the PR thread is the place to settle it, with sources. Maintainers will prefer the version with better evidence and the more conservative score.

## Requests from people covered here

If you are covered on PeopleStock and believe something is inaccurate or should not be included, open an issue. Corrections and removals of this kind take priority.
