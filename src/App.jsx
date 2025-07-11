// Phuket Hotels Vite React App - Entry point
import React, { useState, useMemo, useRef, useEffect } from "react";
import initSqlJs from "sql.js";
import { MapPin, ChevronDown, ChevronUp, List, Map, Phone, Mail, Globe, Facebook, Instagram, X, ArrowLeftRight } from "lucide-react";
import { GoogleMap, Marker, InfoWindow, useJsApiLoader } from "@react-google-maps/api";

function getAbsoluteUrl(url) {
  if (!url) return "";
  url = url.trim().replace(/^\/+|\/+$/g, "");
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return "https://" + url;
}

// Haversine formula for distance in km between [lng,lat] and {lng,lat}
function calculateDistance([lng1, lat1], ref) {
  if (!ref || typeof ref.lat !== "number" || typeof ref.lng !== "number") return null;
  const toRad = (deg) => deg * Math.PI / 180;
  const R = 6371; // km
  const dLat = toRad(ref.lat - lat1);
  const dLng = toRad(ref.lng - lng1);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(ref.lat)) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}


export default function App() {
  const DEFAULT_FILTERS = {
    keyword: "",
    region: "",
    province: "",
    priceMin: 1500,
    priceMax: 20000,
    sortOrder: "asc",
    filterMode: "hotel"
  };
  const [SQL, setSQL] = useState(null);
  const [db, setDb] = useState(null);
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const SQL = await initSqlJs({
        locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.13.0/${file}`
      });

      if (!mounted) return;
      setSQL(SQL);

      // Fetch the .sqlite file from public
      const res = await fetch("/all.sqlite");
      // const res = await fetch("/hotels.sqlite");
      const buf = await res.arrayBuffer();
      const db = new SQL.Database(new Uint8Array(buf));
      if (!mounted) return;
      setDb(db);

      // Initial: select all hotels
      const resHotels = db.exec("SELECT * FROM hotels");
      console.log("query results ", resHotels.length);

      const hotelsRaw = resHotels[0]?.values?.map(row => {
        const [
          id, nameTh, nameEn, addressNo, road, district, subDistrict, province, postalCode,
          regionScope, contactMobilePhoneNo, contactEmail, bizContactWebsite, bizContactFacebook,
          bizContactInstagram, contactLine, locationLat, locationLng, images, rooms
        ] = row;
        return {
          id,
          nameTh,
          nameEn,
          address: `${addressNo || ""} ${road || ""} ${district || ""} ${subDistrict || ""} ${province || ""} ${postalCode || ""}`.trim(),
          images: images ? JSON.parse(images) : [],
          contact: contactMobilePhoneNo || contactEmail || "-",
          location: locationLat && locationLng ? [locationLng, locationLat] : null,
          rooms: rooms ? JSON.parse(rooms) : [],
          _full: {
            regionScope,
            contactMobilePhoneNo, contactEmail, bizContactWebsite, bizContactFacebook,
            bizContactInstagram, contactLine, addressNo, road, district, subDistrict, province, postalCode
          }
        };
      }) || [];
      setHotels(hotelsRaw);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  const [keyword, setKeyword] = useState(DEFAULT_FILTERS.keyword);
  const [regionFilter, setRegionFilter] = useState(DEFAULT_FILTERS.region);
  const [provinceFilter, setProvinceFilter] = useState(DEFAULT_FILTERS.province);
  const [priceMin, setPriceMin] = useState(DEFAULT_FILTERS.priceMin);
  const [priceMax, setPriceMax] = useState(DEFAULT_FILTERS.priceMax);
  const [view, setView] = useState("list");
  const [openRooms, setOpenRooms] = useState({});
  const [sortOrder, setSortOrder] = useState(DEFAULT_FILTERS.sortOrder);
  const [openContact, setOpenContact] = useState({});
  const [openGallery, setOpenGallery] = useState({});
  const [modalImage, setModalImage] = useState(null);
  // Compare hotel state
  const [compareHotels, setCompareHotels] = useState([]);
  const [showCompareModal, setShowCompareModal] = useState(false);
  // Filter mode: "hotel", "other", "all"
  const [filterMode, setFilterMode] = useState(DEFAULT_FILTERS.filterMode);

  const keywordInputRef = useRef(null);
  const priceMinInputRef = useRef(null);
  const priceMaxInputRef = useRef(null);
  const provinceInputRef = useRef(null);
  const [priceMinFocused, setPriceMinFocused] = useState(false);
  const [priceMaxFocused, setPriceMaxFocused] = useState(false);

  // Pagination state
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  // Reference location state & map picker modal
  const [referenceLocation, setReferenceLocation] = useState(null);
  const [showRefMap, setShowRefMap] = useState(false);

  // Build unique/sorted region and province lists
  const regions = useMemo(
    () => [...new Set(hotels.map(h => h._full?.regionScope).filter(Boolean))].sort(),
    [hotels]
  );
  const provinces = useMemo(
    () => [...new Set(hotels.map(h => h._full?.province).filter(Boolean))].sort((a, b) => a.localeCompare(b, "th")),
    [hotels]
  );


  // Filtering logic
  const filteredHotels = useMemo(() => {
    const filtered = hotels.filter((hotel) => {
      // Region filter
      if (regionFilter && hotel._full?.regionScope !== regionFilter) return false;
      // Province filter
      if (provinceFilter && (!hotel._full?.province || !hotel._full.province.includes(provinceFilter))) return false;

      const hotelMatch =
        hotel.nameTh?.includes(keyword) ||
        hotel.nameEn?.toLowerCase().includes(keyword.toLowerCase());

      // Filter by mode
      if (filterMode === "hotel") {
        // Only items with rooms
        if (!hotel.rooms || hotel.rooms.length === 0) return false;
        // Price filter applies only in hotel mode
        const minRoomPrice = Math.min(...hotel.rooms.map(r => r.price));
        const minOK = priceMin === "" ? true : minRoomPrice >= priceMin;
        const maxOK = priceMax === "" ? true : minRoomPrice <= priceMax;
        if (!(minOK && maxOK)) return false;
      } else if (filterMode === "other") {
        // Only items without rooms
        if (hotel.rooms && hotel.rooms.length > 0) return false;
      } else if (filterMode === "all") {
        // Show all items, no price filter
        // nothing to do
      }
      return hotelMatch;
    });

    // Sort logic
    return filtered.sort((a, b) => {
      if (sortOrder === "asc" || sortOrder === "desc") {
        // Sort by min room price
        const aMin = a.rooms.length > 0 ? Math.min(...a.rooms.map(r => r.price)) : Infinity;
        const bMin = b.rooms.length > 0 ? Math.min(...b.rooms.map(r => r.price)) : Infinity;
        return sortOrder === "asc" ? aMin - bMin : bMin - aMin;
      }
      if (sortOrder === "distance" && referenceLocation) {
        // Sort by distance to referenceLocation
        const aDist = a.location ? calculateDistance(a.location, referenceLocation) : Infinity;
        const bDist = b.location ? calculateDistance(b.location, referenceLocation) : Infinity;
        return aDist - bDist;
      }
      if (sortOrder === "alphaThAsc") {
        return (a.nameTh || "").localeCompare(b.nameTh || "", "th");
      }
      if (sortOrder === "alphaThDesc") {
        return (b.nameTh || "").localeCompare(a.nameTh || "", "th");
      }
      if (sortOrder === "alphaEnAsc") {
        return (a.nameEn || "").localeCompare(b.nameEn || "", "en");
      }
      if (sortOrder === "alphaEnDesc") {
        return (b.nameEn || "").localeCompare(a.nameEn || "", "en");
      }
      return 0;
    });
  }, [hotels, keyword, priceMin, priceMax, sortOrder, regionFilter, provinceFilter, filterMode, referenceLocation]);

  // Automatically set referenceLocation to average of province hotels when provinceFilter changes
  useEffect(() => {
    if (!provinceFilter) return;
    // Find all hotels in province with location
    const provHotels = hotels.filter(h => h._full?.province && h._full.province.includes(provinceFilter) && h.location);
    if (provHotels.length === 0) return;
    // Average lat/lng
    let sumLat = 0, sumLng = 0, count = 0;
    provHotels.forEach(h => {
      if (h.location && typeof h.location[0] === "number" && typeof h.location[1] === "number") {
        sumLng += h.location[0];
        sumLat += h.location[1];
        count++;
      }
    });
    if (count > 0) {
      setReferenceLocation({ lng: sumLng / count, lat: sumLat / count });
    }
  }, [provinceFilter, hotels]);

  // Reset page to 1 when filters or sort change, including region/province
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line
  }, [hotels, keyword, priceMin, priceMax, sortOrder, regionFilter, provinceFilter]);

  // Compare feature logic
  function toggleCompareHotel(hotelId) {
    setCompareHotels((prev) =>
      prev.includes(hotelId)
        ? prev.filter(id => id !== hotelId)
        : prev.length < 3 ? [...prev, hotelId] : prev
    );
  }
  const compareHotelObjects = filteredHotels.filter(h => compareHotels.includes(h.id));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        กำลังโหลดข้อมูลโรงแรมจากฐานข้อมูล...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto py-6 px-2 pb-24">
        {/* Name Search (always full width) */}
        <div className="w-full mb-2">
          <div className="relative">
            <input
              placeholder="ค้นหาโรงแรม หรือ Hotel Name..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="w-full border p-2 rounded-lg pr-8"
              ref={keywordInputRef}
              onKeyDown={e => { if (e.key === "Enter") { keywordInputRef.current && keywordInputRef.current.blur(); } }}
            />
            {keyword !== "" && (
              <button
                type="button"
                onClick={() => {
                  setKeyword("");
                  keywordInputRef.current && keywordInputRef.current.focus();
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                tabIndex={-1}
                aria-label="Clear"
              >
                ×
              </button>
            )}
          </div>
        </div>
        {/* Main Filter Controls Bar */}
        <div className="flex gap-2 w-full items-center overflow-x-auto scrollbar-hide py-1">
          {/* Region filter */}
          <div className="flex-1 min-w-0">
            <select
              value={regionFilter}
              onChange={e => setRegionFilter(e.target.value)}
              className="w-full border p-2 rounded-lg"
            >
              <option value="">ทุกภาค (All regions)</option>
              {regions.map(region => (
                <option value={region} key={region}>{region}</option>
              ))}
            </select>
          </div>
          {/* Province filter */}
          <div className="flex-1 min-w-0">
            <input
              className="w-full border p-2 rounded-lg"
              placeholder="ค้นหาจังหวัด (Province)..."
              value={provinceFilter}
              onChange={e => {
                setProvinceFilter(e.target.value);
                const v = e.target.value;
                if (provinces.includes(v)) {
                  provinceInputRef.current && provinceInputRef.current.blur();
                }
              }}
              list="province-list"
              ref={provinceInputRef}
            />
            <datalist id="province-list">
              {provinces.map(prov => (
                <option value={prov} key={prov}>{prov}</option>
              ))}
            </datalist>
          </div>
        </div>
        <div className="flex gap-2 w-full items-center overflow-x-auto scrollbar-hide py-1">
          {/* Min Price */}
          <div className="flex-1 min-w-0 relative">
            <input
              type="number"
              min={0}
              placeholder="ราคาขั้นต่ำ (Min THB)"
              value={priceMinFocused && priceMin === 0 ? "" : (priceMin || "")}
              onFocus={() => {
                setPriceMinFocused(true);
                if (priceMin === 0) setPriceMin("");
              }}
              onBlur={() => {
                setPriceMinFocused(false);
                if (priceMin === "" || isNaN(priceMin)) setPriceMin(0);
              }}
              onChange={e => setPriceMin(e.target.value === "" ? "" : Number(e.target.value))}
              className="border p-2 rounded-lg w-full pr-8"
              ref={priceMinInputRef}
              onKeyDown={e => { if (e.key === "Enter") { priceMinInputRef.current && priceMinInputRef.current.blur(); } }}
            />
            {priceMin !== "" && priceMin !== 0 && (
              <button
                type="button"
                onClick={() => setPriceMin("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                tabIndex={-1}
                aria-label="Clear"
              >
                ×
              </button>
            )}
          </div>
          {/* Max Price */}
          <div className="flex-1 min-w-0 relative">
            <input
              type="number"
              min={0}
              placeholder="ราคาสูงสุด (Max THB)"
              value={priceMaxFocused && priceMax === 0 ? "" : (priceMax || "")}
              onFocus={() => {
                setPriceMaxFocused(true);
                if (priceMax === 0) setPriceMax("");
              }}
              onBlur={() => {
                setPriceMaxFocused(false);
                if (priceMax === "" || isNaN(priceMax)) setPriceMax(0);
              }}
              onChange={e => setPriceMax(e.target.value === "" ? "" : Number(e.target.value))}
              className="border p-2 rounded-lg w-full pr-8"
              ref={priceMaxInputRef}
              onKeyDown={e => { if (e.key === "Enter") { priceMaxInputRef.current && priceMaxInputRef.current.blur(); } }}
            />
            {priceMax !== "" && priceMax !== 0 && (
              <button
                type="button"
                onClick={() => setPriceMax("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                tabIndex={-1}
                aria-label="Clear"
              >
                ×
              </button>
            )}
          </div>
        </div>
        <div className="flex gap-2 w-full mb-4 items-center overflow-x-auto scrollbar-hide py-1">
          {/* Sort Order */}
          <div className="flex-1 min-w-0">
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="w-full border p-2 rounded-lg"
            >
              <option value="asc">ราคาต่ำสุด</option>
              <option value="desc">ราคาสูงสุด</option>
              <option value="alphaThAsc">ชื่อ (ก-ฮ)</option>
              <option value="alphaThDesc">ชื่อ (ฮ-ก)</option>
              <option value="alphaEnAsc">Name (A-Z)</option>
              <option value="alphaEnDesc">Name (Z-A)</option>
              <option value="distance">ระยะทาง (ใกล้สุด)</option>
            </select>
            {/* Reference location picker - only show if sorting by distance */}
            {sortOrder === "distance" && (
              <>
                <div className="mt-2">
                  <div className="font-medium text-sm mb-1">เลือกตำแหน่งอ้างอิง:</div>
                  <div className="flex items-center gap-2">
                    <button
                      className="border px-3 py-1 rounded-xl bg-white hover:bg-gray-100 text-sm"
                      onClick={() => setShowRefMap(true)}
                    >
                      {referenceLocation ? "เปลี่ยนตำแหน่งอ้างอิง" : "เลือกตำแหน่งอ้างอิงบนแผนที่"}
                    </button>
                    {referenceLocation && (
                      <span className="text-xs text-gray-700">
                        พิกัด: {referenceLocation.lat.toFixed(5)}, {referenceLocation.lng.toFixed(5)}
                        <button
                          className="ml-2 text-gray-400 hover:text-red-500"
                          title="ลบตำแหน่งอ้างอิง"
                          onClick={() => setReferenceLocation(null)}
                        >×</button>
                      </span>
                    )}
                  </div>
                </div>
                {sortOrder === "distance" && !referenceLocation && (
                  <div className="mt-2 px-3 py-2 bg-yellow-50 border border-yellow-300 text-yellow-800 text-sm rounded-xl flex items-center gap-2">
                    <svg className="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z" /></svg>
                    กรุณาเลือกตำแหน่งอ้างอิงบนแผนที่ก่อนใช้งานการเรียงลำดับระยะทาง
                  </div>
                )}
              </>
            )}
          </div>
          {/* Reset Filters Button (styled like List button) */}
          <div className="flex-shrink-0">
            <button
              className="bg-white border border-gray-300 text-black rounded-xl hover:bg-gray-100 transition rounded-xl px-3 py-2"
              onClick={() => {
                setKeyword(DEFAULT_FILTERS.keyword);
                setRegionFilter(DEFAULT_FILTERS.region);
                setProvinceFilter(DEFAULT_FILTERS.province);
                setPriceMin(DEFAULT_FILTERS.priceMin);
                setPriceMax(DEFAULT_FILTERS.priceMax);
                setSortOrder(DEFAULT_FILTERS.sortOrder);
                setFilterMode(DEFAULT_FILTERS.filterMode);
              }}
            >
              รีเซ็ตตัวกรอง
            </button>
          </div>
        </div>

        {/* Filter mode segmented control */}
        <FilterModeSegmented
          filterMode={filterMode}
          setFilterMode={setFilterMode}
        />
        <div className="mb-2 text-sm text-gray-700">
          {filterMode === "hotel"
            ? <>พบ {filteredHotels.length.toLocaleString()} โรงแรม</>
            : filterMode === "other"
              ? <>พบ {filteredHotels.length.toLocaleString()} ธุรกิจอื่น</>
              : <>พบ {filteredHotels.length.toLocaleString()} ทั้งหมด</>
          }
        </div>
        {/* Page size selector */}
        {view === "list" && (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm">แสดง:</span>
            <select
              value={pageSize}
              onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="border rounded p-1"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-sm">รายการต่อหน้า</span>
          </div>
        )}
        {/* Map/List Switch Buttons */}
        <div className="flex items-center gap-2 mb-4">
          <button
            className={`px-4 py-2 rounded-xl border ${view === "list" ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}
            onClick={() => setView("list")}
          >
            <List className="inline-block w-4 h-4 mr-1" /> ตาราง
          </button>
          <button
            className={`px-4 py-2 rounded-xl border ${view === "map" ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}
            onClick={() => setView("map")}
          >
            <Map className="inline-block w-4 h-4 mr-1" /> แผนที่
          </button>
        </div>
        {view === "list" ? ( 
          <div className="grid gap-4">
            {filteredHotels.length === 0 ? (
              <div className="text-center py-10 text-gray-400">ไม่พบข้อมูลโรงแรม</div>
            ) : (
              filteredHotels
                .slice((page - 1) * pageSize, page * pageSize)
                .map((hotel) => (
                <div key={hotel.id} className="rounded-2xl shadow-md hover:shadow-lg bg-white">
                  <div className="flex flex-col md:flex-row gap-4 p-4">
                    <div className="md:w-40 w-full flex-shrink-0">
                      {hotel.images[0] ? (
                        <img
                          src={hotel.images[0]}
                          alt={hotel.nameTh}
                          className="rounded-xl object-cover w-full h-28 md:h-36"
                        />
                      ) : (
                        <div className="rounded-xl bg-gray-200 w-full h-28 md:h-36 flex items-center justify-center text-gray-400 text-xs">
                          ไม่มีรูป
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col flex-1 gap-1">
                      {/* Compare checkbox */}
                      <div className="flex items-center mb-1">
                        <input
                          type="checkbox"
                          checked={compareHotels.includes(hotel.id)}
                          onChange={() => toggleCompareHotel(hotel.id)}
                          className="mr-2 accent-blue-600"
                          id={`compare-${hotel.id}`}
                        />
                        <label htmlFor={`compare-${hotel.id}`} className="text-xs select-none cursor-pointer">
                          เปรียบเทียบ
                        </label>
                      </div>
                      <div className="font-semibold text-lg">{hotel.nameTh || hotel.nameEn}</div>
                      <div className="text-xs text-gray-600 mb-2">{hotel.nameEn}</div>
                      {hotel.rooms.length > 0 ? (
                        <div className="text-sm text-green-700 mb-1">
                          ราคาเริ่มต้น {Math.min(...hotel.rooms.map(r => r.price)).toLocaleString()} ฿
                        </div>
                      ) : null}
                      <div className="flex items-center gap-1 text-sm text-gray-700">
                        <MapPin className="w-4 h-4 text-gray-500" />
                        <span>{hotel.address}</span>
                        {hotel.location ? (
                          <a
                            href={`https://www.google.com/maps?q=${hotel.location[1]},${hotel.location[0]}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 underline text-blue-600 text-xs"
                          >
                            Google Maps
                          </a>
                        ) : null}
                        {/* Show distance if sorting by distance and ref location */}
                        {sortOrder === "distance" && referenceLocation && hotel.location && (
                          <span className="ml-2 text-xs text-blue-700">
                            {(() => {
                              const dist = calculateDistance(hotel.location, referenceLocation);
                              return dist != null && isFinite(dist)
                                ? `ห่าง ${dist.toFixed(2)} กม.`
                                : "";
                            })()}
                          </span>
                        )}
                      </div>
      {/* Modal for reference location map picker - only show if sorting by distance */}
      {sortOrder === "distance" && showRefMap && (
        <ReferenceLocationModal
          referenceLocation={referenceLocation}
          setReferenceLocation={setReferenceLocation}
          onClose={() => setShowRefMap(false)}
        />
      )}
                      <div className="text-xs text-gray-500 mt-1">ติดต่อ: {hotel.contact}</div>
                      <button
                        className="mt-3 w-fit flex items-center border rounded-xl px-3 py-1 text-sm"
                        onClick={() => setOpenContact((s) => ({ ...s, [hotel.id]: !s[hotel.id] }))}
                      >
                        {openContact[hotel.id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        <span className="ml-1">{openContact[hotel.id] ? "ซ่อนข้อมูลติดต่อ" : "ดูข้อมูลติดต่อ"}</span>
                      </button>
                      {openContact[hotel.id] && (
                        <div className="border rounded-xl bg-gray-50 p-3 mt-2 mb-2 flex flex-col gap-1">
                          {/* Contact details, show if available */}
                          {(() => {
                            const h = hotel._full || {};
                            return (
                              <>
                                {h.contactMobilePhoneNo && (
                                  <div className="flex items-center gap-2 text-sm">
                                    <Phone className="w-4 h-4 text-gray-600" />
                                    <span>{h.contactMobilePhoneNo}</span>
                                  </div>
                                )}
                                {h.contactEmail && (
                                  <div className="flex items-center gap-2 text-sm">
                                    <Mail className="w-4 h-4 text-gray-600" />
                                    <span>{h.contactEmail}</span>
                                  </div>
                                )}
                                {h.bizContactWebsite && (
                                  <div className="flex items-center gap-2 text-sm">
                                    <Globe className="w-4 h-4 text-gray-600" />
                                    <a href={getAbsoluteUrl(h.bizContactWebsite)} target="_blank" rel="noopener noreferrer" className="underline text-blue-600">{h.bizContactWebsite}</a>
                                  </div>
                                )}
                                {h.bizContactFacebook && (
                                  <div className="flex items-center gap-2 text-sm">
                                    <Facebook className="w-4 h-4 text-gray-600" />
                                    <a href={getAbsoluteUrl(h.bizContactFacebook)} target="_blank" rel="noopener noreferrer" className="underline text-blue-600">Facebook</a>
                                  </div>
                                )}
                                {h.contactLine && (
                                  <div className="flex items-center gap-2 text-sm">
                                    {/* No icon in lucide-react for Line, use custom svg or text */}
                                    <span className="w-4 h-4 text-gray-600 font-bold">LINE</span>
                                    <a href={getAbsoluteUrl(h.contactLine)} target="_blank" rel="noopener noreferrer" className="underline text-blue-600">Line</a>
                                  </div>
                                )}
                                {h.bizContactInstagram && (
                                  <div className="flex items-center gap-2 text-sm">
                                    <Instagram className="w-4 h-4 text-gray-600" />
                                    <a href={getAbsoluteUrl(h.bizContactInstagram)} target="_blank" rel="noopener noreferrer" className="underline text-blue-600">Instagram</a>
                                  </div>
                                )}
                                {/* Always show address */}
                                <div className="flex items-center gap-2 text-sm">
                                  <MapPin className="w-4 h-4 text-gray-600" />
                                  <span>
                                    {`${h.addressNo || ""} ${h.road || ""} ${h.district || ""} ${h.subDistrict || ""} ${h.province || ""} ${h.postalCode || ""}`.trim()}
                                  </span>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      )}
                      {/* Gallery expand/collapse moved here, below contact details */}
                      {(() => {
                        // If filterMode === "other" and hotel has multiple images, default open
                        const galleryOpen = filterMode === "other" && hotel.images.length > 1 ? true : openGallery[hotel.id];
                        return (
                          <>
                            {hotel.images.length > 1 && (
                              <button
                                className="mt-3 w-fit flex items-center border rounded-xl px-3 py-1 text-sm"
                                onClick={() =>
                                  setOpenGallery(s => ({
                                    ...s,
                                    [hotel.id]: !(filterMode === "other" && hotel.images.length > 1 ? true : openGallery[hotel.id])
                                  }))
                                }
                              >
                                {galleryOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                <span className="ml-1">
                                  {galleryOpen ? "ซ่อนรูปทั้งหมด" : `ดูรูปทั้งหมด (${hotel.images.length})`}
                                </span>
                              </button>
                            )}
                            {galleryOpen && (
                              <div className="flex gap-2 mt-2 overflow-x-auto">
                                {hotel.images.map((img, idx) => (
                                  <img
                                    src={img}
                                    key={img+idx}
                                    alt={hotel.nameTh || hotel.nameEn}
                                    className="h-20 rounded-lg object-cover border cursor-pointer"
                                    onClick={() => setModalImage(img)}
                                  />
                                ))}
                              </div>
                            )}
                          </>
                        );
                      })()}
                      {filterMode !== "other" && (
                        <>
                          <button
                            className="mt-3 w-fit flex items-center border rounded-xl px-3 py-1 text-sm"
                            onClick={() => setOpenRooms((s) => ({ ...s, [hotel.id]: !s[hotel.id] }))}
                          >
                            {openRooms[hotel.id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            <span className="ml-1">{openRooms[hotel.id] ? "ซ่อนห้องพัก" : `ดูห้องพัก (${hotel.rooms.length})`}</span>
                          </button>
                          {openRooms[hotel.id] && (
                            <div className="grid gap-2 mt-3">
                              {hotel.rooms.length === 0 ? (
                                <div className="text-gray-400 text-sm">ไม่มีข้อมูลห้องพัก</div>
                              ) : (
                                hotel.rooms.map((room) => (
                                  <div key={room.id} className="p-2 border rounded-xl bg-gray-50">
                                    <div className="font-medium text-base">{room.name}</div>
                                    <div className="flex items-center gap-3">
                                      <div className="text-sm text-gray-700">ราคา: <span className="font-bold">{room.price?.toLocaleString()} ฿</span></div>
                                      <div className="text-xs text-gray-500">ห้อง: {room.numberOfRoom}</div>
                                    </div>
                                    <div className="flex gap-2 mt-1 overflow-x-auto">
                                      {room.images.map((img, idx) => (
                                        <img
                                          src={img}
                                          key={img+idx}
                                          alt={room.name}
                                          className="h-20 rounded-lg object-cover border cursor-pointer"
                                          onClick={() => setModalImage(img)}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <MapView hotels={filteredHotels} setModalImage={setModalImage} />
        )}
        {/* Pagination controls */}
        {view === "list" && filteredHotels.length > 0 && (
          <div className="flex justify-center items-center gap-2 mt-4">
            <button
              className="px-3 py-1 rounded border text-sm disabled:opacity-50"
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
            >
              ก่อนหน้า
            </button>
            <span className="text-sm">
              หน้า {page} / {Math.ceil(filteredHotels.length / pageSize)}
            </span>
            <span className="text-sm ml-2">ไปหน้า</span>
            <input
              type="number"
              min={1}
              max={Math.ceil(filteredHotels.length / pageSize)}
              value={page}
              onChange={e => {
                let val = Number(e.target.value);
                if (isNaN(val)) val = 1;
                if (val < 1) val = 1;
                if (val > Math.ceil(filteredHotels.length / pageSize)) val = Math.ceil(filteredHotels.length / pageSize);
                setPage(val);
              }}
              className="w-14 px-1 py-1 border rounded text-center text-sm"
              style={{marginLeft: 2, marginRight: 2}}
            />
            <button
              className="px-3 py-1 rounded border text-sm disabled:opacity-50"
              onClick={() => setPage(page + 1)}
              disabled={page >= Math.ceil(filteredHotels.length / pageSize)}
            >
              ถัดไป
            </button>
          </div>
        )}
      </div>
      {/* Modal for enlarged room image */}
      {modalImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50"
          onClick={() => setModalImage(null)}
        >
          <img
            src={modalImage}
            alt=""
            className="max-h-[80vh] max-w-[90vw] rounded-lg shadow-lg border-4 border-white"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
      {/* Modal for hotel compare */}
      {showCompareModal && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-60 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 shadow-xl max-w-3xl w-full relative">
            <button className="absolute right-4 top-4 text-gray-400 hover:text-red-500" onClick={() => setShowCompareModal(false)}>
              <X className="w-6 h-6" />
            </button>
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5" /> เปรียบเทียบโรงแรม
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {compareHotelObjects.map(hotel => (
                <div key={hotel.id} className="bg-gray-50 rounded-xl p-4 flex flex-col items-center text-center">
                  <img src={hotel.images[0]} alt="" className="w-20 h-20 object-cover rounded-md border mb-2" />
                  <div className="font-medium">{hotel.nameTh || hotel.nameEn}</div>
                  <div className="text-xs text-gray-500 mb-2">{hotel.nameEn}</div>
                  <div className="text-green-700 text-sm mb-1">
                    ราคาเริ่มต้น {hotel.rooms.length > 0 ? Math.min(...hotel.rooms.map(r=>r.price)).toLocaleString() : "-"} ฿
                  </div>
                  <div className="text-xs text-gray-500 mb-1">{hotel.address}</div>
                  <div className="text-xs text-gray-500">ห้องพัก: {hotel.rooms.length}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sticky compare bar */}
      {compareHotels.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg py-2 px-4 flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-x-auto">
            {compareHotelObjects.map(hotel => (
              <div key={hotel.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-2 py-1 mr-1">
                <img src={hotel.images[0]} alt="" className="w-10 h-10 object-cover rounded-md border" />
                <span className="text-xs font-medium">{hotel.nameTh || hotel.nameEn}</span>
                <button onClick={() => toggleCompareHotel(hotel.id)} className="text-gray-400 hover:text-red-500">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              className="bg-gray-200 text-gray-800 px-3 py-2 rounded-xl mr-2 font-medium hover:bg-gray-300 transition"
              onClick={() => setCompareHotels([])}
            >
              รีเซ็ต
            </button>
            <button
              className="bg-blue-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 shadow font-medium"
              onClick={() => setShowCompareModal(true)}
            >
              <ArrowLeftRight className="w-4 h-4" />
              เปรียบเทียบ ({compareHotels.length})
            </button>
          </div>
        </div>
      )}
      {/* Sticky footer */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-gray-900 text-gray-100 text-center py-2 text-xs">
        Developed by Chongsawad Saiaram @ 2025
      </div>
    </div>
  );
}

// Responsive height: fills screen below filters, above footer
const mapContainerStyle = {
  width: "100%",
  height: "calc(100vh - 210px)",
  borderRadius: "1rem"
};
const defaultCenter = { lat: 7.8804, lng: 98.3923 }; // Phuket center

function MapView({ hotels, setModalImage }) {
  // For Vite, use import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  });

  const [selected, setSelected] = React.useState(null);
  const [showFloating, setShowFloating] = React.useState(false);
  // Drag state for floating panel
  const [dragOffset, setDragOffset] = React.useState({ x: 0, y: 0 });
  const [dragging, setDragging] = React.useState(false);
  const dragOrigin = React.useRef({ x: 0, y: 0 });

  // Only consider hotels with valid location
  const locHotels = hotels.filter(h => h.location && h.location[1] && h.location[0]);

  // Center state and logic
  // Determine defaultCenter based on locHotels
  const computedDefaultCenter = locHotels.length > 0
    ? { lat: locHotels[0].location[1], lng: locHotels[0].location[0] }
    : defaultCenter;
  const [center, setCenter] = React.useState(computedDefaultCenter);

  // When hotels data changes, reset center to default
  React.useEffect(() => {
    setCenter(
      locHotels.length > 0
        ? { lat: locHotels[0].location[1], lng: locHotels[0].location[0] }
        : defaultCenter
    );
    // Also clear selection and floating panel
    setSelected(null);
    setShowFloating(false);
    // Do NOT reset dragOffset here
    // eslint-disable-next-line
  }, [hotels]);

  // Debug: Print out hotel locations used for markers
  console.log("locHotels for map", locHotels);
  if (locHotels.length === 0) {
    return <div>ไม่มีโรงแรมที่มีข้อมูลพิกัด (No hotel has geolocation)</div>;
  }

  if (!isLoaded) return <div>Loading Map...</div>;

  // Helper for contact details in InfoWindow
  function renderContactDetails(hotel) {
    const h = hotel._full || {};
    return (
      <div className="mt-1 text-xs text-gray-500 space-y-1">
        {h.contactMobilePhoneNo && (
          <div className="flex items-center gap-1">
            <Phone className="inline-block w-3 h-3 text-gray-500" />
            <span>{h.contactMobilePhoneNo}</span>
          </div>
        )}
        {h.contactEmail && (
          <div className="flex items-center gap-1">
            <Mail className="inline-block w-3 h-3 text-gray-500" />
            <span>{h.contactEmail}</span>
          </div>
        )}
        {h.bizContactWebsite && (
          <div className="flex items-center gap-1">
            <Globe className="inline-block w-3 h-3 text-gray-500" />
            <a href={getAbsoluteUrl(h.bizContactWebsite)} target="_blank" rel="noopener noreferrer" className="underline text-blue-600">Website</a>
          </div>
        )}
        {h.bizContactFacebook && (
          <div className="flex items-center gap-1">
            <Facebook className="inline-block w-3 h-3 text-gray-500" />
            <a href={getAbsoluteUrl(h.bizContactFacebook)} target="_blank" rel="noopener noreferrer" className="underline text-blue-600">Facebook</a>
          </div>
        )}
        {h.bizContactInstagram && (
          <div className="flex items-center gap-1">
            <Instagram className="inline-block w-3 h-3 text-gray-500" />
            <a href={getAbsoluteUrl(h.bizContactInstagram)} target="_blank" rel="noopener noreferrer" className="underline text-blue-600">Instagram</a>
          </div>
        )}
        {h.contactLine && (
          <div className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 text-gray-500 font-bold">LINE</span>
            <a href={getAbsoluteUrl(h.contactLine)} target="_blank" rel="noopener noreferrer" className="underline text-blue-600">Line</a>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="relative"
      style={{ width: "100%", height: "100%" }}
      onMouseMove={e => {
        if (dragging) {
          setDragOffset({
            x: e.clientX - dragOrigin.current.x,
            y: e.clientY - dragOrigin.current.y
          });
        }
      }}
      onMouseUp={() => setDragging(false)}
      onMouseLeave={() => setDragging(false)}
    >
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={14}
      >
        {locHotels.map(hotel => (
          <Marker
            key={hotel.id}
            position={{ lat: hotel.location[1], lng: hotel.location[0] }}
            onClick={() => {
              setSelected(hotel);
              setCenter({ lat: hotel.location[1], lng: hotel.location[0] });
            }}
          />
        ))}
        {selected && (
          <InfoWindow
            position={{ lat: selected.location[1], lng: selected.location[0] }}
            onCloseClick={() => {
              setSelected(null);
              setShowFloating(false);
              // Do NOT reset dragOffset here
            }}
          >
            <div>
              {selected.images && selected.images[0] && (
                <img
                  src={selected.images[0]}
                  alt={selected.nameTh || selected.nameEn}
                  className="w-40 h-32 object-cover rounded-lg mb-2 cursor-pointer"
                  onClick={() => setModalImage(selected.images[0])}
                />
              )}
              <strong>{selected.nameTh || selected.nameEn}</strong>
              <div>
                ราคาเริ่มต้น {selected.rooms.length > 0 ? Math.min(...selected.rooms.map(r => r.price)).toLocaleString() : "-"} ฿
              </div>
              {/* Contact details below price, small/gray */}
              {renderContactDetails(selected)}
              <button
                className="mt-2 bg-blue-600 text-white rounded px-2 py-1 text-xs"
                onClick={() => setShowFloating(true)}
              >
                ดูรายละเอียดเพิ่มเติม
              </button>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
      {selected && showFloating && (
        <div
          className="absolute right-4 top-8 z-[1000] bg-white rounded-2xl shadow-lg p-5 w-full max-w-md border"
          style={{
            maxHeight: "80vh",
            overflowY: "auto",
            transform: dragging ? `translate(${dragOffset.x}px, ${dragOffset.y}px)` : undefined
          }}
        >
          <button
            onClick={() => {
              setSelected(null);
              setShowFloating(false);
              setDragOffset({ x: 0, y: 0 });
            }}
            className="absolute top-3 right-3 text-gray-400 hover:text-red-500 text-2xl leading-none"
          >×</button>
          {/* Drag handle header */}
          <div
            className="cursor-move font-semibold text-base pb-1 mb-2 border-b"
            style={{ userSelect: "none" }}
            onMouseDown={e => {
              setDragging(true);
              dragOrigin.current = {
                x: e.clientX - dragOffset.x,
                y: e.clientY - dragOffset.y
              };
            }}
          >
            {selected.nameTh || selected.nameEn}
          </div>
          <div>
            <div className="text-xs text-gray-600 mb-2">{selected.nameEn}</div>
            {selected.rooms.length > 0 && (
              <div className="text-sm text-green-700 mb-1">
                ราคาเริ่มต้น {Math.min(...selected.rooms.map(r => r.price)).toLocaleString()} ฿
              </div>
            )}
            <div className="flex items-center gap-1 text-sm text-gray-700 mb-1">
              <MapPin className="w-4 h-4 text-gray-500" />
              <span>{selected.address}</span>
              {selected.location ? (
                <a
                  href={`https://www.google.com/maps?q=${selected.location[1]},${selected.location[0]}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 underline text-blue-600 text-xs"
                >
                  Google Maps
                </a>
              ) : null}
            </div>
            <div className="text-xs text-gray-500 mb-1">ติดต่อ: {selected.contact}</div>
            <div className="grid gap-2 mt-2">
              {selected.rooms.length === 0 ? (
                <div className="text-gray-400 text-sm">ไม่มีข้อมูลห้องพัก</div>
              ) : (
                selected.rooms.map((room) => (
                  <div key={room.id} className="p-2 border rounded-xl bg-gray-50">
                    <div className="font-medium text-base">{room.name}</div>
                    <div className="flex items-center gap-3">
                      <div className="text-sm text-gray-700">ราคา: <span className="font-bold">{room.price?.toLocaleString()} ฿</span></div>
                      <div className="text-xs text-gray-500">ห้อง: {room.numberOfRoom}</div>
                    </div>
                    <div className="flex gap-2 mt-1 overflow-x-auto">
                      {room.images.map((img, idx) => (
                        <img
                          src={img}
                          key={img+idx}
                          alt={room.name}
                          className="h-16 rounded-lg object-cover border cursor-pointer"
                          onClick={() => setModalImage(img)}
                        />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// Segmented button for filter mode: hotel, other, all
function FilterModeSegmented({ filterMode, setFilterMode }) {
  const [expanded, setExpanded] = React.useState(false);
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-0 mt-2">
          <button
            className={`px-4 py-2 rounded-l-xl border border-r-0 ${filterMode === "all" ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}
            onClick={() => setFilterMode("all")}
            type="button"
          >
            ทั้งหมด (All)
          </button>
          <button
            className={`px-4 py-2 border border-l-0 border-r-0 ${filterMode === "hotel" ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}
            onClick={() => setFilterMode("hotel")}
            type="button"
          >
            โรงแรม (Hotels)
          </button>
          <button
            className={`px-4 py-2 rounded-r-xl border border-l-0 ${filterMode === "other" ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}
            onClick={() => setFilterMode("other")}
            type="button"
          >
            ธุรกิจอื่น (Others)
          </button>
        </div>
        <button
          type="button"
          className="ml-2 flex items-center text-blue-600 text-xs"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
          {expanded ? "ซ่อนรายละเอียด" : "ดูรายละเอียด"}
        </button>
      </div>
      <div className="mt-1 text-xs text-gray-600">
        {!expanded ? (
          <span>
            เลือกประเภทที่ต้องการแสดง: โรงแรมที่มีห้องพัก, ธุรกิจอื่น หรือทั้งหมด
          </span>
        ) : (
          <span>
            <b>โรงแรม (Hotels):</b> แสดงเฉพาะโรงแรมหรือที่พักที่มีข้อมูลห้องพักและราคาห้องพัก (พร้อมตัวกรองราคา)<br />
            <b>ธุรกิจอื่น (Others):</b> แสดงเฉพาะธุรกิจที่ไม่มีข้อมูลห้องพัก เช่น ร้านอาหาร สปา รถเช่า ฯลฯ<br />
            <b>ทั้งหมด (All):</b> แสดงทุกธุรกิจโดยไม่แยกประเภท (ไม่มีตัวกรองราคา)
          </span>
        )}
      </div>
    </div>
  );
}
// Modal for picking reference location
function ReferenceLocationModal({ referenceLocation, setReferenceLocation, onClose }) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  });
  const [tempLoc, setTempLoc] = useState(referenceLocation || { lat: 7.8804, lng: 98.3923 });
  // Center on ref loc, or Phuket
  const center = referenceLocation || { lat: 7.8804, lng: 98.3923 };
  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl p-4 max-w-md w-full relative">
        <button
          className="absolute top-3 right-3 text-gray-400 hover:text-red-500 text-2xl"
          onClick={onClose}
        >×</button>
        <div className="font-bold text-base mb-2">เลือกตำแหน่งอ้างอิงบนแผนที่</div>
        <div className="mb-2 text-xs text-gray-700">
          คลิกบนแผนที่เพื่อเลือกจุดอ้างอิงสำหรับคำนวณระยะทาง
        </div>
        <div style={{ width: "100%", height: 280 }}>
          {isLoaded ? (
            <GoogleMap
              mapContainerStyle={{ width: "100%", height: "100%", borderRadius: "1rem" }}
              center={tempLoc}
              zoom={11}
              onClick={e => {
                setTempLoc({ lat: e.latLng.lat(), lng: e.latLng.lng() });
              }}
            >
              <Marker
                position={tempLoc}
                draggable
                onDragEnd={e => {
                  setTempLoc({ lat: e.latLng.lat(), lng: e.latLng.lng() });
                }}
              />
            </GoogleMap>
          ) : (
            <div className="flex items-center justify-center h-full">Loading Map...</div>
          )}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-gray-700">
            พิกัด: {tempLoc.lat.toFixed(5)}, {tempLoc.lng.toFixed(5)}
          </span>
          <button
            className="ml-auto bg-blue-600 text-white px-4 py-2 rounded-xl font-medium"
            onClick={() => {
              setReferenceLocation(tempLoc);
              onClose();
            }}
          >
            ใช้ตำแหน่งนี้
          </button>
        </div>
      </div>
    </div>
  );
}