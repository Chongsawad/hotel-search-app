// Phuket Hotels Vite React App - Entry point
import React, { useState, useMemo } from "react";
import { MapPin, ChevronDown, ChevronUp, List, Map, Phone, Mail, Globe, Facebook, Instagram } from "lucide-react";
import hotelData from "../phuket-hotels.json";

function extractHotels(rawData) {
  return rawData.data.data.map((hotel) => ({
    id: hotel.id,
    nameTh: hotel.nameTh,
    nameEn: hotel.nameEn,
    address: `${hotel.addressNo || ""} ${hotel.road || ""} ${hotel.district || ""} ${hotel.subDistrict || ""} ${hotel.province || ""} ${hotel.postalCode || ""}`.trim(),
    images: hotel.images || [],
    contact: hotel.contactMobilePhoneNo || hotel.contactEmail || "-",
    location: hotel.location?.coordinates,
    rooms: hotel.rooms?.map((room) => ({
      id: room.id,
      name: room.name,
      price: Number(room.price),
      images: room.images || [],
      numberOfRoom: room.numberOfRoom,
    })) || [],
  }));
}

const hotels = extractHotels(hotelData);

export default function App() {
  const [keyword, setKeyword] = useState("");
  const [priceMin, setPriceMin] = useState(0);
  const [priceMax, setPriceMax] = useState(200000);
  const [view, setView] = useState("list");
  const [openRooms, setOpenRooms] = useState({});
  const [sortOrder, setSortOrder] = useState("asc");
  const [openContact, setOpenContact] = useState({});

  // Filtering logic
  const filteredHotels = useMemo(() => {
    const filtered = hotels.filter((hotel) => {
      const hotelMatch =
        hotel.nameTh?.includes(keyword) ||
        hotel.nameEn?.toLowerCase().includes(keyword.toLowerCase());

      const minRoomPrice = hotel.rooms.length > 0
        ? Math.min(...hotel.rooms.map(r => r.price))
        : Infinity;

      const priceMatch = minRoomPrice >= priceMin && minRoomPrice <= priceMax;

      return hotelMatch && priceMatch;
    });

    // Sort by minimum room price according to sortOrder
    return filtered.sort((a, b) => {
      const aMin = a.rooms.length > 0 ? Math.min(...a.rooms.map(r => r.price)) : Infinity;
      const bMin = b.rooms.length > 0 ? Math.min(...b.rooms.map(r => r.price)) : Infinity;
      if (sortOrder === "asc") {
        return aMin - bMin;
      } else {
        return bMin - aMin;
      }
    });
  }, [keyword, priceMin, priceMax, sortOrder]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto py-6 px-2">
        <div className="flex flex-col md:flex-row gap-2 mb-4 items-center">
          <input
            placeholder="ค้นหาโรงแรม หรือ Hotel Name..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="w-full md:w-60 border p-2 rounded-lg"
          />
          <input
            type="number"
            min={0}
            placeholder="ราคาขั้นต่ำ (Min THB)"
            value={priceMin}
            onChange={(e) => setPriceMin(Number(e.target.value))}
            className="w-full md:w-36 border p-2 rounded-lg"
          />
          <input
            type="number"
            min={0}
            placeholder="ราคาสูงสุด (Max THB)"
            value={priceMax}
            onChange={(e) => setPriceMax(Number(e.target.value))}
            className="w-full md:w-36 border p-2 rounded-lg"
          />
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="w-full md:w-36 border p-2 rounded-lg"
          >
            <option value="asc">ต่ำสุด</option>
            <option value="desc">สูงสุด</option>
          </select>
          <div className="flex gap-1 ml-2">
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
                          {hotelData.data.data.find(h => h.id === hotel.id) && (() => {
                            const h = hotelData.data.data.find(h => h.id === hotel.id);
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
                                      className="h-20 rounded-lg object-cover border"
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
