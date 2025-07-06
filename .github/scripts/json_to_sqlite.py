import sys
import json
import sqlite3

def main():
    if len(sys.argv) != 3:
        print("Usage: python json_to_sqlite.py input.json output.sqlite")
        sys.exit(1)
    json_file = sys.argv[1]
    sqlite_file = sys.argv[2]

    with open(json_file, encoding="utf-8") as f:
        data = json.load(f)

    # Support both {"data":{"data":[...]}} and flat {"data":[...]} format
    hotels = data.get('data', {}).get('data')
    if hotels is None:
        hotels = data.get('data')
    if hotels is None:
        print("Invalid JSON structure: no 'data' field found.")
        sys.exit(2)

    conn = sqlite3.connect(sqlite_file)
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS hotels (
            id TEXT PRIMARY KEY,
            nameTh TEXT,
            nameEn TEXT,
            addressNo TEXT,
            road TEXT,
            district TEXT,
            subDistrict TEXT,
            province TEXT,
            postalCode TEXT,
            regionScope TEXT,
            contactMobilePhoneNo TEXT,
            contactEmail TEXT,
            bizContactWebsite TEXT,
            bizContactFacebook TEXT,
            bizContactInstagram TEXT,
            contactLine TEXT,
            locationLat REAL,
            locationLng REAL,
            images TEXT,
            rooms TEXT,
            businessType TEXT
        )
    """)

    for hotel in hotels:
        c.execute("""
            INSERT OR REPLACE INTO hotels (
                id, nameTh, nameEn, addressNo, road, district, subDistrict, province, postalCode,
                regionScope, contactMobilePhoneNo, contactEmail, bizContactWebsite, bizContactFacebook,
                bizContactInstagram, contactLine, locationLat, locationLng, images, rooms, businessType
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            hotel.get('id'),
            hotel.get('nameTh'),
            hotel.get('nameEn'),
            hotel.get('addressNo'),
            hotel.get('road'),
            hotel.get('district'),
            hotel.get('subDistrict'),
            hotel.get('province'),
            hotel.get('postalCode'),
            hotel.get('regionScope'),
            hotel.get('contactMobilePhoneNo'),
            hotel.get('contactEmail'),
            hotel.get('bizContactWebsite'),
            hotel.get('bizContactFacebook'),
            hotel.get('bizContactInstagram'),
            hotel.get('contactLine'),
            hotel.get('location', {}).get('coordinates', [None, None])[1] if hotel.get('location') else None,
            hotel.get('location', {}).get('coordinates', [None, None])[0] if hotel.get('location') else None,
            json.dumps(hotel.get('images', []), ensure_ascii=False),
            json.dumps(hotel.get('rooms', []), ensure_ascii=False),
            json.dumps(hotel.get('businessType', []), ensure_ascii=False)
        ))

    conn.commit()
    conn.close()
    print(f"Converted {len(hotels)} records to {sqlite_file}")

if __name__ == "__main__":
    main()