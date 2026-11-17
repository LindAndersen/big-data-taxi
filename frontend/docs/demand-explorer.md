# Demand Explorer

The existing layout, map, Recharts graph, date controls, and hourly panel are
preserved. This interaction update adds a daily view and separates map metrics
from optional hourly detail. Overview remains unchanged.

## State and data flow

- `ExplorerContent` owns shared date/zone selection and nullable `intervalStart`
  in the existing reducer. A separate map metric state starts at `observed`.
- `createExplorerSelection` initializes the fixed clock's New York date with no
  hour selected. Date changes reset the hour; zone changes preserve it. Selecting
  Today when already on that date does not reset an existing hour.
- `useExplorerData` still requests one All Zones demand day and separate weather.
  It reuses `summarizeDemand` for daily totals and derives zone-specific graph and
  panel values from those same individual records. No new API, request, cache,
  simulation state, or dependency is introduced.
- The daily map memo depends on the daily summary and metric only. It does not
  depend on the selected zone/hour. Zone changes affect its selected outline and
  camera; hour changes affect neither its values nor camera.
- Daily weather aggregates every available elapsed interval on the selected date.
  Hourly weather continues to match the selected UTC start instant.

## Daily map metrics

The accessible Observed/Predicted toggle changes the choropleth only. Its selection
persists when navigating dates and does not alter the graph or information panel.

| Metric / date | Values and period |
| --- | --- |
| Predicted, any date | Full-day forecast totals, 00:00–24:00 New York |
| Observed, historical date | Completed observations over the selected calendar day |
| Observed, current date | Cumulative observations, including the current partial hour, from midnight through the fixed snapshot |
| Observed, future date | No observed values; neutral zones and an explicit unavailable label |

Future dates remain on Observed unless the user chooses Predicted. The map still
supports zone selection when observations are unavailable. Missing values are not
converted to zero. Hover details include the daily value and its observation period.

Both metrics and all dates share a fixed **pickups-per-zone-per-day** color scale.
The five existing colors represent 0–2,000, 2,000–4,000, 4,000–6,000,
6,000–8,000, and 8,000+ pickups. The legend ends at 10,000+; high counts saturate
in the last band, while hover details always retain their exact counts. This visual
scale is a presentation threshold, not mock demand data or a backend limit.

`ZoneMapMetric` retains its values/maximum/label and adds a period label. The
shared map no longer appends an hourly unit. Overview's map without a metric
retains its existing behavior.

## Optional hourly selection

- The graph starts without a highlight and the panel shows daily information.
- Click anywhere inside an interval to select it; click the selected interval
  again to deselect it. Clear hour selection also returns to daily details.
- Clear is placed below the graph so showing it does not move the plot or its hit
  regions. Clearing returns keyboard focus to the first interval without selecting it.
- The existing full-height HTML bands remain aligned with the Recharts plot:
  left 52px, right 16px, top 16px, bottom 36px, with an equal-width band for every
  elapsed interval. No separate hour picker is introduced.
- Arrow/Home/End keys explicitly select a target interval, even when it is already
  selected; they do not inadvertently toggle it off. Enter/Space use normal button
  activation. Date changes clear the selection; zone and metric changes do not.
- DST days retain 23 or 25 intervals. Repeated hours have distinct UTC identities
  and labels. Changing dates no longer needs a nearest-hour or offset-preservation rule.
- Narrow screens scroll the chart within its card rather than overflowing the page.

## Daily and hourly information

The daily panel shows selected zone/date, elapsed-hour count, full-day predictions,
observed daily pickups (or today's observations so far), and a daily weather summary.
Weather includes temperature range, summed precipitation, mean wind speed, and
conditions present during the day. Full-day weather is explicitly labeled even
when current-day demand observations are incomplete. If weather hours are missing,
its available/expected coverage is shown instead of claiming a complete summary.

A daily actual-minus-predicted difference is only available when every expected
zone-hour has completed observations: 23/24/25 intervals multiplied by the selected
coverage's zone count. Missing, partial, and future observations cannot be compared
with the full-day forecast. Current-day totals show their midnight-to-snapshot
period and an explanation of the unavailable comparison.

Selecting an hour reuses the existing hourly information panel and its weather
presentation. Completed hours may be compared even during the current day; partial
hours still say Observed so far and have no forecast difference. Graph highlighting
and this hourly panel are the only views controlled by `intervalStart`.

## Function responsibilities

| Function | Responsibility |
| --- | --- |
| `createExplorerSelection` | Initialize New York date, All Zones, and null hour. |
| `explorerReducer` | Set/clear a valid hour, preserve it across zones, and clear it when the date changes. |
| `getDailyDifference` | Guard full-day comparisons using expected completed zone-hour coverage. |
| `getDailyMapMetric` | Select daily predicted/completed/cumulative values, omit unavailable observations, and attach fixed scale and period labels. |
| `summarizeDailyWeather` | Filter to the date; calculate temperature range, precipitation sum, wind mean, conditions, and DST-aware coverage. |
| `useExplorerData` | Fetch existing services; memoize daily summaries/map independently of the hour and expose daily/hourly panel data. |
| `ExplorerContent` | Compose the metric toggle, date/zone controls, graph, and appropriate daily/hourly panel. |
| `HourlyChart` | Keep full-plot selection bands; toggle on click, support explicit keyboard selection, and offer Clear below the plot. |
| `navigateHour` | Move focus and select a valid target without toggle semantics. |
| `DailyInformation` | Present full-day forecasts against properly labeled available actuals and completed-only differences. |
| `HourInformation` | Preserve hourly demand/comparison logic while reusing shared weather rendering. |
| `WeatherInformation` | Render daily or hourly weather and its loading/error/empty states; its local formatter displays metric values to one decimal. |
| `TaxiZoneMap` | Preserve geometry/selection lifecycle; apply daily metric fills and show observation period in legend/hover content. |

`getDateMode`, `formatExplorerDate`, `getCompletedDifference`, date/zone controls,
service contracts, and mock generators retain their existing responsibilities.

## Verification

Reducer tests cover initial null selection, clearing, date resets, zone preservation,
and distinct DST instants. Calculation tests cover daily map totals, shared scales,
future missing observations versus zero, completed-only daily comparisons, weather
aggregation, missing weather, and 23/25-hour days.

Component tests use real data services and the real chart, replacing only WebGL
and container measurement. They verify initial daily/Observed mode, selected-hour
map independence, metric toggle independence, future neutral maps, both deselection
methods, keyboard navigation, date resets, historical daily comparisons, partial
hour safeguards, DST dates, and the existing loading/error/retry/empty states.
Browser checks verify actual map rendering and the interactive daily/hourly flow.
