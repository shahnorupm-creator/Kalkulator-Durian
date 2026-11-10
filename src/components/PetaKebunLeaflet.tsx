'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface PinKebun {
  id: string;
  nama: string;
  daerah: string;
  negeri: string;
  lat: number;
  long: number;
  ekar: number;
  pokok: number;
  mt: number;
}

interface PetaKebunLeafletProps {
  pin: PinKebun[];
  tinggi?: number;
}

// Ikon penanda mudah (bulatan hijau) tanpa bergantung pada aset imej Leaflet lalai
// yang selalunya gagal dimuat dalam bundler.
const ikonKebun = L.divIcon({
  className: '',
  html: '<div style="width:16px;height:16px;border-radius:9999px;background:#114B39;border:2px solid #ffffff;box-shadow:0 1px 3px rgba(0,0,0,0.4)"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
  popupAnchor: [0, -8],
});

export default function PetaKebunLeaflet({ pin, tinggi = 380 }: PetaKebunLeafletProps) {
  const bekasRef = useRef<HTMLDivElement>(null);
  const petaRef = useRef<L.Map | null>(null);
  const lapisanRef = useRef<L.LayerGroup | null>(null);

  // Mulakan peta sekali sahaja.
  useEffect(() => {
    if (!bekasRef.current || petaRef.current) return;
    const peta = L.map(bekasRef.current, {
      center: [4.2, 109.5], // tengah Malaysia
      zoom: 6,
      scrollWheelZoom: true,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; Penyumbang OpenStreetMap',
      maxZoom: 19,
    }).addTo(peta);
    lapisanRef.current = L.layerGroup().addTo(peta);
    petaRef.current = peta;

    return () => {
      peta.remove();
      petaRef.current = null;
      lapisanRef.current = null;
    };
  }, []);

  // Kemas kini penanda apabila senarai pin berubah.
  useEffect(() => {
    const peta = petaRef.current;
    const lapisan = lapisanRef.current;
    if (!peta || !lapisan) return;

    lapisan.clearLayers();
    if (pin.length === 0) {
      peta.setView([4.2, 109.5], 6);
      return;
    }

    const titik: L.LatLngTuple[] = [];
    pin.forEach(item => {
      const penanda = L.marker([item.lat, item.long], { icon: ikonKebun });
      penanda.bindPopup(
        `<div style="min-width:150px">
          <div style="font-weight:700;color:#114B39">${item.nama}</div>
          <div style="font-size:11px;color:#555">${item.daerah}, ${item.negeri}</div>
          <div style="font-size:11px;color:#555;margin-top:2px">${item.ekar} ekar &middot; ${item.pokok.toLocaleString()} pokok</div>
          <div style="font-size:11px;font-weight:700;color:#C98A2C;margin-top:2px">${item.mt.toFixed(2)} MT</div>
        </div>`
      );
      penanda.addTo(lapisan);
      titik.push([item.lat, item.long]);
    });

    if (titik.length === 1) {
      peta.setView(titik[0], 15);
    } else {
      peta.fitBounds(L.latLngBounds(titik), { padding: [50, 50], maxZoom: 14 });
    }
  }, [pin]);

  return <div ref={bekasRef} style={{ height: tinggi, width: '100%', borderRadius: 12, zIndex: 0 }} />;
}
