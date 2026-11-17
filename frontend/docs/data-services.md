# Demand and weather services

The data and calculations are connected to Demand Explorer through query hooks;
Overview integration remains pending. Application consumers should import the
adapters from `src/services/index.ts`; they should not import mock generators.

## Interfaces and requests

All methods return promises and accept an optional `AbortSignal`. Cancellation and
source failures reject the request; they do not silently turn into empty datasets.

| Service | Method | Result |
| --- | --- | --- |
| Zones | `getZones(signal?)` | Locally stored Manhattan `ZoneCollection` |
| Clock | `getCurrentTime(signal?)` | `{ asOf, timeZone }` |
| Demand | `getHourlyDemand({ date, zoneId }, signal?)` | Individual `zoneHours` and derived chart `hours`, plus request and clock metadata |
| Demand | `getSummary({ startDate, endDate }, signal?)` | Range totals, daily totals, zone totals/ranking, busiest day, evaluation, and clock metadata |
| Demand | `getEvaluation({ startDate, endDate }, signal?)` | Evaluation for individual zone-hours in that range and clock metadata |
| Weather | `getHourlyWeather(date, signal?)` | One shared Manhattan hourly weather series |

`date`, `startDate`, and `endDate` are strict `YYYY-MM-DD` New York calendar dates.
Ranges include both endpoints. Reversed ranges, invalid dates, and unknown zone
IDs reject with an error. `zoneId: null` explicitly selects All Zones, which means
the same 69 Manhattan zones as the map. A numeric ID selects one of those zones.

Demand responses contain full-hour forecasts for every interval, even when actuals
are unavailable. `zoneHours` contains individual rows for the requested coverage;
`hours` aggregates those same rows for the chart. On a single-zone request, their
values match. All Zones chart rows have `zoneId: null` and must not be counted as
additional observations alongside `zoneHours`.

```ts
import { clockService, demandService, weatherService } from '../services'
import { getCompletedDateRange } from '../lib/time'

const clock = await clockService.getCurrentTime()
const park = await demandService.getHourlyDemand({ date: '2025-01-15', zoneId: 43 })
const allZones = await demandService.getHourlyDemand({ date: '2025-01-15', zoneId: null })
const weather = await weatherService.getHourlyWeather('2025-01-15')
const overview = await demandService.getSummary(getCompletedDateRange(7, clock.asOf))
```

## Fixed demo time and observation availability

The default snapshot is January 15, 2025, 17:30 New York time, represented as
`2025-01-15T22:30:00Z`. There is no timer, advancing replay, or system-clock
dependency. To change the default, copy `.env.example` to `.env.local`, edit
`VITE_DEMO_NOW` to an ISO timestamp **including an offset or Z**, and restart Vite.
This Vite setting is baked into production builds. Invalid timestamps are rejected.

Each observation is a discriminated union:

```ts
{ status: 'complete', pickups: 80 }
{ status: 'partial', pickups: 35, observedThrough: '2025-01-15T22:30:00Z' }
{ status: 'unavailable', pickups: null }
```

Intervals use `[start, end)`: an interval ending at the snapshot is complete; one
starting at the snapshot has partial observations of zero. Future actuals are
`null`, never fabricated zero. For a fixed zone-hour, the latent full-hour actual
is deterministic. Partial counts are its floored elapsed-time proportion, so they
increase monotonically toward the same full count. Forecasts do not change when
the clock changes. A future query never exposes that latent full-hour actual.

An aggregate is complete only if every contributing row is complete. If some
observations exist but coverage is incomplete, it remains partial. If no contributing
observations exist, it is unavailable. Never compare partial actuals against a
full-hour forecast to report an error or performance metric.

## Time zones and daylight-saving transitions

`HourlyInterval.start` and `.end` are UTC instants and identify the interval.
`date`, `hour`, `utcOffset`, and `label` describe New York time. Join demand to
weather using `interval.start`; do not use just the numeric local hour.

| New York date | Elapsed hours | Behavior |
| --- | --- | --- |
| 2025-01-15 | 24 | Normal calendar day |
| 2025-03-09 | 23 | No interval starts at local 02:00 |
| 2025-11-02 | 25 | Local 01:00 occurs at both 05:00Z and 06:00Z |

Labels include UTC offsets. When a clock change occurs inside an interval, its
label includes both offsets, such as `01:00–03:00 (UTC-05:00 → UTC-04:00)`.
Every generated interval still represents exactly one elapsed hour. Preset ranges
use the 7 or 30 completed **local calendar days** before the snapshot's New York date.

## Totals, eligibility, and rankings

- `predictedPickups` covers the full selected range.
- `observedPickups` sums all available counts, including partial observations.
- `completedObservedPickups` sums completed observations only.
- Each total also reports completed, partial, and unavailable **zone-hour** counts.
- `null` observed totals mean no observations. A completed observation of zero
  remains a valid zero and contributes to the sample count.
- MAE and WAPE use individual completed zone-hours ending at or before `asOf`.
  Derived All Zones rows, partial rows, future rows, and unavailable rows are excluded.
- `evaluation.totalPredictedPickups` and `.totalActualPickups` cover the same eligible
  pairs. They can differ from the full-range dashboard totals above.
- `MAE = sum(abs(actual - predicted)) / sampleCount`, in pickups per zone-hour.
- `WAPE = sum(abs(actual - predicted)) / sum(actual) * 100`, in percent.
  With no samples both metrics are null; with zero summed actuals WAPE is null
  while MAE can still be valid. UI consumers should show null metrics as N/A.
- `busiestDay` uses completed actuals; it is null without eligible observations.
  Ties select the earlier date. Zone totals sort by completed actuals descending,
  then zone ID; unknown completed actuals sort last. To display a busiest-zone
  list or actual-demand map, use only zones with `completedZoneHours > 0`.
  Current-day rankings may therefore represent incomplete calendar-day coverage.

For example, predictions `[100, 50]` against actuals `[80, 70]` have equal totals,
but MAE is 20 pickups/zone-hour and WAPE is approximately 26.67%. Subtracting
aggregate totals would conceal those errors.

The calculation functions expect each individual `(zoneId, interval.start)` pair
once. Mock generation guarantees uniqueness and rejects duplicated input zone IDs.
They deliberately ignore derived All Zones rows; they do not deduplicate arbitrary
repeated individual observations from an incorrectly assembled dataset.

## Determinism and weather assumptions

Demand uses fixed weekday/weekend hourly profiles, zone-specific volumes,
commuting/nightlife/park behavior, seasonal variation, and stateless hashes of
zone/date/interval keys. Forecast errors use a separate deterministic hash. Results
do not depend on render order, request order, `Math.random()`, or the real clock.

Weather is separate from demand. It uses seasonal and diurnal temperature variation,
deterministic wet periods, and plausible precipitation/wind values, with explicit
°C, mm, and km/h fields. Both historical and future requests read this same series:
the project assumes observed weather is a perfectly accurate simulated forecast.
This is synthetic data, not fitted to or imported from the supplied weather CSV or
taxi parquet. Those source datasets remain untouched and outside the browser bundle.

## Function responsibilities

| Function | Responsibility and interaction |
| --- | --- |
| `parseDate` | Strictly parse a local date and reject invalid calendar values. Shared by generators and range logic. |
| `getDayIntervals` | Walk elapsed hours between New York midnights and attach unambiguous labels. Shared by demand and weather. |
| `getDatesInRange` | Validate and enumerate inclusive calendar dates, including leap days and DST dates. |
| `getCompletedDateRange` | Derive the completed-day preset boundaries from the snapshot's New York date. |
| `deterministicFraction` | Map a string key to a stable fraction without mutable random state. Shared only by mock generators. |
| `createMockClockService` / `getCurrentTime` | Validate one configured instant, then return that fixed snapshot; reject cancelled requests. |
| `observeHour` | Private demand helper that reveals complete, partial, or unavailable observations at the snapshot. |
| `generateDemand` | Produce unique individual zone-hour records from fixed profiles and hashes, then apply observation availability. |
| `generateDemandRange` | Yield one day's records at a time to keep raw range observations out of retained summary state. |
| `generateWeather` | Generate the shared Manhattan series, using the same interval boundaries as demand. |
| `aggregateHourlyDemand` | Filter to individual rows and optional zone selection; sum per unique start instant, preserving observation completeness. |
| `emptyEvaluation` / `emptyTotals` | Create fresh internal accumulator objects for metrics and totals. No shared mutable state. |
| `isCompleted` | Apply the same completed-pair rule to evaluation, completed totals, and rankings. |
| `addEvaluation` / `finishEvaluation` | Accumulate eligible absolute errors and paired totals, then calculate metrics with explicit null handling. |
| `calculateEvaluation` | Evaluate an iterable of individual observations against one snapshot using those shared helpers. |
| `addTotals` | Add full forecasts and visible actual counts while separately tracking completed coverage. |
| `summarizeDemand` | Build daily/zone/global totals and evaluation in one pass; derive deterministic completed-observation rankings. |
| `createMockDemandService` / `loadContext` | Compose zone and clock dependencies; load one shared snapshot and coverage per request, forwarding cancellation. |
| `getHourlyDemand` | Validate selection, generate its individual records, and derive the chart series from exactly those records. |
| `getSummary` | Generate a range as an iterable and compute its summary without keeping all raw range rows. |
| `getEvaluation` | Calculate the same range's evaluation independently using the shared generation and eligibility logic. |
| `getHourlyWeather` | Expose the independent weather generator through the asynchronous, cancellable service contract. |

## Future HTTP integration

Replace adapters at `src/services/index.ts` with implementations of the same
interfaces. For example, HTTP routes could map to `/api/zones`, `/api/clock`,
`/api/demand/hourly?date=2025-01-15&zoneId=43`, `/api/demand/summary`,
`/api/demand/evaluation`, and `/api/weather/hourly?date=2025-01-15`.
These are proposed integration mappings, not an implemented backend.

The JSON structure should follow the TypeScript response types, including explicit
observation availability. An illustrative selected-zone response looks like:

```json
{
  "date": "2025-01-15",
  "zoneId": 43,
  "asOf": "2025-01-15T22:30:00Z",
  "timeZone": "America/New_York",
  "zoneHours": [{
    "zoneId": 43,
    "interval": {
      "start": "2025-01-15T22:00:00Z",
      "end": "2025-01-15T23:00:00Z",
      "date": "2025-01-15",
      "hour": 17,
      "utcOffset": "-05:00",
      "label": "17:00–18:00 (UTC-05:00)"
    },
    "predictedPickups": 100,
    "observation": {
      "status": "partial",
      "pickups": 35,
      "observedThrough": "2025-01-15T22:30:00Z"
    }
  }],
  "hours": []
}
```

The example abbreviates both arrays: actual responses include every interval,
and single-zone `hours` contains the same values as `zoneHours`. Numbers above
illustrate the schema rather than claiming to be a specific generated fixture.
No backend, Kafka client, fallback service, replay controls, or extra caching layer
is introduced in this increment.
