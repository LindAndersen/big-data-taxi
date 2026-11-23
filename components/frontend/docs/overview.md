# Overview

Overview uses the existing mock services, types, QueryClient, date helpers, cards,
Recharts, and MapLibre map. No dependencies or backend infrastructure were added.

## Timeframes and data flow

The default is Last 7 days. Last 7/30 days use completed New York calendar days
before the fixed demo snapshot. With the default clock, those are January 8–14,
2025, and December 16, 2024–January 14, 2025. Both endpoints are inclusive.

Custom dates are draft form values until Apply range is pressed. Invalid dates and
reversed ranges cannot replace the applied range or trigger a summary query. The
currently applied range remains visible above the form. Partial edits do not
present old data under a new range.

`useOverviewData` requests one `getSummary(range, signal)` response, keyed by its
start/end dates and snapshot. That response drives all cards, both charts, the
ranking, and the map. No per-day service fan-out or extra application cache is
introduced. Loading, retryable failure, and a truly empty dataset are separate
states. Future-only forecasts are not treated as an empty dataset.

## Statistics and evaluation

- Predicted pickups cover the full selected date range.
- Observed pickups sum available observations, including current partial counts.
  The card and coverage note identify incomplete/unavailable coverage.
- MAE and WAPE use completed **individual zone-hour** pairs only. Partial and
  unavailable intervals and derived All Zones rows never enter evaluation.
- MAE is measured in pickups per zone-hour; WAPE is a percentage of summed
  actual pickups. No generic accuracy percentage is used.
- No samples produce N/A. A zero actual denominator produces N/A WAPE while MAE
  can remain valid. Zero actual counts are valid observations, not missing data.
- Busiest day uses completed observed pickups. Current-day rankings may therefore
  have partial calendar-day coverage, as the explanatory text states.

The demand chart shows full-day forecast lines and completed-day actual lines.
Incomplete observed days appear as separate hollow points. This display is not
used to calculate forecast error.

The demand chart's Y-axis follows the minimum/maximum of the visible series, with
10% padding. Flat/nearly flat data has at least 0.5% of the maximum (or one pickup)
of padding, and the lower bound stays nonnegative. Full pickup-count tick labels
keep close values distinguishable. The MAE bar chart retains its zero baseline.

The error chart reads each date's `evaluation.mae`. To support it, the existing
summary calculation now accumulates daily evaluation alongside the overall totals,
using the same eligibility rule. `DailyDemandTotals.evaluation` is the only addition
to the data-service response contract. Global metrics remain calculated over all
eligible pairs, not averages of daily metrics.

## Busiest zones and geographic overview

The Top 10 list and map both use completed observed pickups across the range;
partial observations do not enter these rankings. Their relative ordering comes
from the existing summary calculation. Actual zero totals remain eligible if
completed observations exist.

The existing map shows cumulative counts for the range, with a relative color scale
whose maximum is the busiest zone's count. Its caption explicitly says relative
demand within this range, rather than claiming Explorer's fixed daily scale.
The shared `ZoneMapMetric` presentation prop adds optional `scaleDescription` for
this purpose; Explorer's existing description stays the default.

Selecting a ranked row, the zone selector, or a map polygon changes the geographic
highlight/camera only. It does not filter the Manhattan-wide cards or charts.
Back/Reset clears the highlight. Future-only ranges have no observed ranking and a
neutral map, while their forecasts remain visible in cards and the demand chart.

## Function responsibilities

| Function | Responsibility |
| --- | --- |
| `Overview` | Load/retry the shared fixed clock before initializing the page. |
| `OverviewContent` | Own the applied range, initialize the seven-day preset, and compose all analytical views from one query. |
| `useOverviewData` | Query/cache the existing range-summary service and forward cancellation. |
| `RangeControls` | Manage preset selection and uncommitted custom dates while showing the applied range. |
| `applyCustom` | Validate both date fields and ordering, then apply the complete range together. |
| `SummaryCards` | Format full-range forecast/available actual totals, zone-hour MAE/WAPE, and busiest-day results with units and null handling. |
| `DemandTrend` | Plot daily forecasts and distinguish completed versus incomplete observed days. |
| `EvaluationTrend` | Plot true zone-hour MAE by date or show no-eligible-observations content. |
| `GeographicOverview` | Load names/geometry; link completed-observation rankings, selector, and map through a local highlight state. |
| `formatOverviewDay` | Format calendar-date axis/card labels without a UTC date shift. |
| `getOverviewMapMetric` | Convert completed zone totals into the relative range map values, maximum, and labels. |
| `summarizeDemand` | Retain its existing one-pass aggregation and additionally accumulate/finalize each day's evaluation. |
| `TaxiZoneMap` | Honor a caller-provided scale description while preserving existing map behavior. |

## Explorer availability adjustment

`useExplorerData` determines observed availability from the daily observed map's
entries, including valid zeros. If Observed is requested but unavailable, its
effective metric is Predicted. `ExplorerContent` renders that effective selection
and disables/greys the Observed button. No effect or additional stored state is
required. The existing preference remains available when returning to an observed
date; the user can still explicitly choose Predicted.

## Verification

Existing numerical tests now also verify known per-day MAE values and additive
daily absolute errors. Overview integration tests cover default/preset ranges,
custom validation and application, mixed and future-only ranges, service metrics,
map/ranking selection without global filtering, retry, and empty data. Explorer
tests cover the unavailable-Observed automatic switch and valid observed zeros.

WebGL and responsive chart measurement are tested in the browser; jsdom tests
replace only those surfaces while using the actual services and chart logic.
