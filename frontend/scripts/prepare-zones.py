"""Prepare local zones without modifying source coordinates or requiring GIS packages.

Usage: python3 scripts/prepare-zones.py CITY.geojson TLC.zip LOOKUP.csv
See public/data/README.md for official source URLs and identifier reconciliation.
"""
import csv
import json
from pathlib import Path
import struct
import sys
import zipfile


def read_dbf(archive):
    """Read official DBF attributes so GeoJSON polygons retain original TLC IDs."""
    with zipfile.ZipFile(archive) as source:
        data = source.read(next(name for name in source.namelist() if name.endswith('.dbf')))
    count = struct.unpack_from('<I', data, 4)[0]
    header_size, record_size = struct.unpack_from('<HH', data, 8)
    fields = []
    for offset in range(32, header_size - 1, 32):
        field = data[offset:offset + 32]
        fields.append((field[:11].split(b'\0')[0].decode(), field[16]))
    records = []
    for index in range(count):
        record = data[header_size + index * record_size:header_size + (index + 1) * record_size]
        if record[0:1] == b'*':
            continue
        position = 1
        row = {}
        for name, width in fields:
            row[name] = record[position:position + width].decode().strip()
            position += width
        records.append(row)
    return records


def main():
    """Match official polygon attributes, verify lookup coverage, and write the asset."""
    geojson_path, archive_path, lookup_path = sys.argv[1:]
    source = json.loads(Path(geojson_path).read_text())
    with open(lookup_path, newline='') as lookup_file:
        lookup = {int(row['LocationID']): row for row in csv.DictReader(lookup_file)
                  if row['Borough'] == 'Manhattan'}
    records = [row for row in read_dbf(archive_path) if row['borough'] == 'Manhattan']
    features = []
    for feature in source['features']:
        props = feature['properties']
        if props['borough'] != 'Manhattan':
            continue
        # The city export collapses island IDs 104/105 into 103. Restore IDs by
        # matching both original geometric attributes, never by guessing location.
        matches = [row for row in records if row['zone'] == props['zone']
                   and abs(float(row['Shape_Area']) - float(props['shape_area'])) < 1e-14
                   and abs(float(row['Shape_Leng']) - float(props['shape_leng'])) < 1e-12]
        if len(matches) != 1:
            raise ValueError(f'Expected one TLC attribute match: {props}')
        zone_id = int(matches[0]['LocationID'])
        if zone_id not in lookup or lookup[zone_id]['Zone'] != props['zone']:
            raise ValueError(f'Lookup mismatch for zone {zone_id}')
        features.append({'type': 'Feature', 'id': zone_id,
                         'properties': {'id': zone_id, 'name': lookup[zone_id]['Zone'], 'borough': 'Manhattan'},
                         'geometry': feature['geometry']})
    ids = [feature['id'] for feature in features]
    if len(ids) != len(set(ids)) or set(ids) != set(lookup):
        raise ValueError('Zone IDs must be unique and exactly match the Manhattan lookup entries')
    output = Path(__file__).resolve().parents[1] / 'public/data/manhattan-zones.geojson'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({'type': 'FeatureCollection', 'features': sorted(features, key=lambda f: f['id'])}, separators=(',', ':')) + '\n')
    print(f'Wrote {len(features)} verified Manhattan zones to {output}')


if __name__ == '__main__':
    main()
