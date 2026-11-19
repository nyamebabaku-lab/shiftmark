import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const pin = L.divIcon({
  className: '',
  html: '<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;background:#0891b2;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,.35)"></div>',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

/** Drag the pin (or tap the map) to set the office; the circle shows the clock-in area. */
export default function MapPicker({ lat, lng, radius, onChange, className = 'h-72' }) {
  const box = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const circle = useRef(null);
  const cb = useRef(onChange);
  cb.current = onChange;
  const start = lat != null ? [lat, lng] : [5.6037, -0.187]; // Accra

  useEffect(() => {
    const m = L.map(box.current, { zoomControl: true, attributionControl: true }).setView(start, lat != null ? 17 : 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m);
    marker.current = L.marker(start, { draggable: true, icon: pin }).addTo(m);
    circle.current = L.circle(start, { radius: radius || 150, color: '#0891b2', weight: 2, fillOpacity: 0.12 }).addTo(m);
    marker.current.on('drag', (e) => circle.current.setLatLng(e.latlng));
    marker.current.on('dragend', (e) => { const p = e.target.getLatLng(); cb.current(p.lat, p.lng); });
    m.on('click', (e) => { marker.current.setLatLng(e.latlng); circle.current.setLatLng(e.latlng); cb.current(e.latlng.lat, e.latlng.lng); });
    map.current = m;
    setTimeout(() => m.invalidateSize(), 200);
    return () => m.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!map.current || lat == null) return;
    const p = [lat, lng];
    marker.current.setLatLng(p);
    circle.current.setLatLng(p);
  }, [lat, lng]);
  useEffect(() => { circle.current?.setRadius(radius || 150); }, [radius]);
  useEffect(() => {
    if (map.current && lat != null && !map.current.getBounds().contains([lat, lng])) map.current.setView([lat, lng], 17);
  }, [lat, lng]);

  return <div ref={box} className={`z-0 w-full overflow-hidden rounded-xl ${className}`} />;
}
