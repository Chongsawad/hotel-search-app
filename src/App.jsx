// Phuket Hotels Vite React App - Entry point
import React, { useState, useMemo, useRef, useEffect } from "react";
import initSqlJs from "sql.js";
import { MapPin, ChevronDown, ChevronUp, List, Map, Phone, Mail, Globe, Facebook, Instagram, X, ArrowLeftRight } from "lucide-react";


export default function App() {
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
      const res = await fetch("/hotels.sqlite");
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

  const [keyword, setKeyword] = useState("");
  const [priceMin, setPriceMin] = useState(1500);
  const [priceMax, setPriceMax] = useState(200000);
  const [view, setView] = useState("list");
  const [openRooms, setOpenRooms] = useState({});
  const [sortOrder, setSortOrder] = useState("asc");
  const [openContact, setOpenContact] = useState({});
  const [modalImage, setModalImage] = useState(null);
  // Compare hotel state
  const [compareHotels, setCompareHotels] = useState([]);
  const [showCompareModal, setShowCompareModal] = useState(false);

  const keywordInputRef = useRef(null);
  const priceMinInputRef = useRef(null);
  const priceMaxInputRef = useRef(null);
  const [priceMinFocused, setPriceMinFocused] = useState(false);
  const [priceMaxFocused, setPriceMaxFocused] = useState(false);

  // Filtering logic
  const filteredHotels = useMemo(() => {
    const filtered = hotels.filter((hotel) => {
      const hotelMatch =
        hotel.nameTh?.includes(keyword) ||
        hotel.nameEn?.toLowerCase().includes(keyword.toLowerCase());

      const minRoomPrice = hotel.rooms.length > 0
        ? Math.min(...hotel.rooms.map(r => r.price))
        : Infinity;

      const minOK = priceMin === "" ? true : minRoomPrice >= priceMin;
      const maxOK = priceMax === "" ? true : minRoomPrice <= priceMax;
      const priceMatch = minOK && maxOK;

      return hotelMatch && priceMatch;
    });

    // Sort by minimum room price according to sortOrder
    return filtered.sort((a, b) => {
      if (sortOrder === "asc" || sortOrder === "desc") {
        // Sort by min room price
        const aMin = a.rooms.length > 0 ? Math.min(...a.rooms.map(r => r.price)) : Infinity;
        const bMin = b.rooms.length > 0 ? Math.min(...b.rooms.map(r => r.price)) : Infinity;
        return sortOrder === "asc" ? aMin - bMin : bMin - aMin;
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
  }, [hotels, keyword, priceMin, priceMax, sortOrder]);

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
      <div className="max-w-5xl mx-auto py-6 px-2">
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
        {/* Min/Max/Sort/Toggle as horizontal scroll bar below */}
        <div className="flex gap-2 mb-4 items-center overflow-x-auto scrollbar-hide py-1">
          {/* Min Price */}
          <div className="relative w-36 flex-shrink-0">
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
          <div className="relative w-36 flex-shrink-0">
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
          {/* Sort Order */}
          <div className="w-40 flex-shrink-0">
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
            </select>
          </div>
          {/* List/Map Toggle */}
          <div className="flex gap-1 ml-2 flex-shrink-0">
            <button
              className={view === "list" ? "bg-black text-white rounded-xl px-3 py-2" : "bg-white text-black border rounded-xl px-3 py-2"}
              onClick={() => setView("list")}
            >
              <List className="w-4 h-4 mr-1 inline" /> รายชื่อ
            </button>
            <button
              className={view === "map" ? "bg-black text-white rounded-xl px-3 py-2" : "bg-white text-black border rounded-xl px-3 py-2"}
              onClick={() => setView("map")}
            >
              <Map className="w-4 h-4 mr-1 inline" /> แผนที่
            </button>
          </div>
        </div>
        <div className="mb-2 text-sm text-gray-700">
          พบ {filteredHotels.length.toLocaleString()} โรงแรม
        </div>
        {view === "list" ? ( 
          <div className="grid gap-4">
            {filteredHotels.length === 0 ? (
              <div className="text-center py-10 text-gray-400">ไม่พบข้อมูลโรงแรม</div>
            ) : (
              filteredHotels.map((hotel) => (
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
                      </div>
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
                                    <a href={h.bizContactWebsite} target="_blank" rel="noopener noreferrer" className="underline text-blue-600">{h.bizContactWebsite}</a>
                                  </div>
                                )}
                                {h.bizContactFacebook && (
                                  <div className="flex items-center gap-2 text-sm">
                                    <Facebook className="w-4 h-4 text-gray-600" />
                                    <a href={h.bizContactFacebook} target="_blank" rel="noopener noreferrer" className="underline text-blue-600">Facebook</a>
                                  </div>
                                )}
                                {h.contactLine && (
                                  <div className="flex items-center gap-2 text-sm">
                                    {/* No icon in lucide-react for Line, use custom svg or text */}
                                    <span className="w-4 h-4 text-gray-600 font-bold">LINE</span>
                                    <a href={h.contactLine} target="_blank" rel="noopener noreferrer" className="underline text-blue-600">Line</a>
                                  </div>
                                )}
                                {h.bizContactInstagram && (
                                  <div className="flex items-center gap-2 text-sm">
                                    <Instagram className="w-4 h-4 text-gray-600" />
                                    <a href={h.bizContactInstagram} target="_blank" rel="noopener noreferrer" className="underline text-blue-600">Instagram</a>
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
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <MapView hotels={filteredHotels} />
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

// Simple map view using Leaflet (placeholder)
function MapView({ hotels }) {
  return (
    <div className="h-96 w-full rounded-2xl bg-gray-200 flex items-center justify-center">
      <span className="text-gray-500">(Map view is not implemented in this preview, but should plot {hotels.length} hotels by coordinates.)</span>
    </div>
  );
}
