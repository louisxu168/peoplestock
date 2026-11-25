# Methodology

Model version: **v0.3**. Everything on this page is implemented in [`src/model.js`](../src/model.js). The constants are in one block at the top of that file.

## The idea

A stock price is a running estimate of what a company is worth. PeopleStock keeps a running estimate for a person, in US dollars, for every trading day of their life:

```
life market cap = financial capital + human capital + reputation capital
```

It is an estimate built from public information. It is not a net-worth statement.

## 1. Financial capital

This is the anchor. For most people on the site it is over 90% of the total.

**Listed holdings.** For each stock the person holds:

```
stake value = ownership fraction × shares outstanding × daily price
```

- Prices are real daily open/high/low/close bars, split-adjusted.
- Ownership and share counts are anchor points taken from filings and reporting, linearly interpolated between anchors.
- The day's high and low of the life candle come from the stock's high and low.

**Holdings without a daily quote** (pre-IPO equity, private companies, cash from exits, diversified wealth). Each has anchor values, usually funding rounds or reported figures. Between anchors the value is interpolated on a log scale. A small simulated wobble is added (AR(1), persistence 0.97, daily sigma 0.6%) so the line does not look falsely precise. The chart shades this era and labels it as estimated.

**Large option grants** are valued at intrinsic value: `max(0, price − strike) × options × vested fraction × legal status`. Legal status lets a court ruling remove or restore the grant on the day of the ruling.

## 2. Human capital

Economists use "human capital" for the present value of a person's future earnings. Here it is a step target that rises with degrees and career milestones. The actual value climbs toward the target with a time constant of 150 trading days, so nothing jumps overnight.

Before a person owns anything, this is what the chart shows.

## 3. Reputation capital

```
reputation capital = smoothed audience × $150 × reputation coefficient
```

- **Audience** is the number of people a person reaches. It is smoothed over 40 trading days, so a new account cannot add a million followers in a day.
- **$150 per person** is a single global constant. It is a modelling choice, not a measured fact. Changing it rescales reputation for everyone equally.
- **The reputation coefficient** starts at 1. Each event adds its `rep` shock (between −0.06 and +0.06). Shocks decay with a half-life of 630 trading days (about 2.5 years). The coefficient is clamped to 0.5–1.6 and smoothed over 15 days.

A steady run of good work compounds. Silence lets old credit fade. A scandal fades too, but slowly.

## 4. Attention (the volume bars)

```
attention = 35% audience + 40% media + 25% search      (each scaled to its lifetime maximum)
```

Each event adds a pulse sized by its magnitude. Media decays over about 8 days and search over about 4. An event dated only to a month or year is spread out over a longer window instead of pretending it happened on one day.

## 5. Rules that keep it honest

**No double counting.** If an event moved the stock, financial capital already contains it. The event's `rep` value covers only what the price cannot see.

**No invented causes.** Any day with a move of 9% or more and no sourced event within three trading days is flagged as *unexplained*. The model attributes it to the stock price and says nothing more. At most 8 are shown per person, at least 60 trading days apart.

**Measured aftermath, not claimed impact.** Each event shows how the life market cap moved 21 trading days (about 30 days) and 252 trading days (1 year) afterwards. That number includes the whole market and everything else that happened. It shows what followed. It does not claim the event caused it.

**Smoothness.** No single event is allowed to create a discontinuity. Changes arrive through the stock price, or through values that are smoothed over weeks to months.

## 6. Known limits

- Ownership fractions, private valuations and audience sizes are approximations. Two careful people can reasonably disagree by 10–20%.
- Taxes, debt, pledged shares and charitable gifts are only reflected where an anchor accounts for them.
- Before a person's first listing there is no daily price, so that era is an interpolation.
- Event magnitudes (1–5) and reputation shocks are judgments. They are written down next to their sources so they can be challenged. See [CONTRIBUTING.md](../CONTRIBUTING.md).
- Stock price data comes from Yahoo Finance and may contain errors.

## 7. Changing the model

Model changes get a version bump and a note here. If you propose one, show the before-and-after numbers for at least three people in your pull request.
