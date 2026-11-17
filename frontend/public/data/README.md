# Manhattan taxi-zone geometry

`manhattan-zones.geojson` contains 69 Manhattan features. Polygon coordinates are
retained from the official NYC Open Data export in WGS84 longitude/latitude.
The complete file is served locally; runtime requests to third-party mapping
services are not required.

Sources, retrieved November 17, 2026:

- NYC Open Data, NYC Taxi Zones: https://data.cityofnewyork.us/Transportation/NYC-Taxi-Zones/8meu-9t5y
- GeoJSON export: https://data.cityofnewyork.us/api/geospatial/8meu-9t5y?method=export&format=GeoJSON
- Original TLC shapefile and DBF attributes: https://d37ci6vzurychx.cloudfront.net/misc/taxi_zones.zip
- Source directory: https://www.nyc.gov/site/tlc/about/tlc-trip-record-data.page
- Supplied `data/taxi_zone_lookup.csv` for identifiers and display names.

## Identifier reconciliation

The city GeoJSON export assigns `locationid: 103` to three separate island
features. The original TLC DBF identifies them individually as 103, 104, and
105, matching the supplied lookup table. The preparation script restores these
IDs by uniquely matching the original zone name, shape area, and shape length.
It does not alter or invent coordinates. Each of the 69 lookup IDs is represented
exactly once, preventing overlapping selections and double-counted aggregates.

## Reproduce

Download both official files above, then run from `frontend`:

```sh
python3 scripts/prepare-zones.py /path/to/zones.geojson /path/to/taxi_zones.zip ../../data/taxi_zone_lookup.csv
```

Python's standard library is sufficient. Source datasets are not included in the
application bundle. NYC source attribution is also displayed on the map.
