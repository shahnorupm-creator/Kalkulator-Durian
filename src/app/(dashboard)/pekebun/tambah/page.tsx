'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

export default function TambahPekebunPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);

  const [form, setForm] = useState({
    nama: '',
    daerah: '',
    mukim: '',
    alamatKebun: '',
    lat: '',
    long: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const getLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolokasi tidak disokong oleh pelayar ini.');
      return;
    }

    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm({
          ...form,
          lat: position.coords.latitude.toFixed(6),
          long: position.coords.longitude.toFixed(6),
        });
        setGettingLocation(false);
        toast.success('Lokasi berjaya diperolehi!');
      },
      (error) => {
        setGettingLocation(false);
        if (error.code === error.PERMISSION_DENIED) {
          toast.error('Kebenaran lokasi ditolak.');
        } else {
          toast.error('Gagal mendapatkan lokasi.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!form.nama.trim() || !form.daerah.trim()) {
      toast.error('Sila isi nama dan daerah pekebun.');
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'users', user.uid, 'pekebun'), {
        ...form,
        createdAt: serverTimestamp(),
      });
      toast.success('Pekebun berjaya ditambah!');
      router.push('/pekebun');
    } catch (error) {
      console.error('Error adding pekebun:', error);
      toast.error('Gagal menambah pekebun. Sila cuba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={() => router.back()} className="text-forest text-xl">
          ←
        </button>
        <h2 className="text-xl font-bold text-forest">Tambah Pekebun</h2>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nama Pekebun *
          </label>
          <input
            type="text"
            name="nama"
            value={form.nama}
            onChange={handleChange}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-forest"
            placeholder="Contoh: Ahmad bin Hassan"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Daerah *
          </label>
          <input
            type="text"
            name="daerah"
            value={form.daerah}
            onChange={handleChange}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-forest"
            placeholder="Contoh: Raub"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Mukim
          </label>
          <input
            type="text"
            name="mukim"
            value={form.mukim}
            onChange={handleChange}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-forest"
            placeholder="Contoh: Mukim Sg. Klau"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Alamat Kebun
          </label>
          <textarea
            name="alamatKebun"
            value={form.alamatKebun}
            onChange={handleChange}
            rows={2}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-forest resize-none"
            placeholder="Alamat penuh kebun"
          />
        </div>

        {/* Lat/Long with auto-fill */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Latitude
            </label>
            <input
              type="text"
              name="lat"
              value={form.lat}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-forest"
              placeholder="3.8000"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Longitude
            </label>
            <input
              type="text"
              name="long"
              value={form.long}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-forest"
              placeholder="101.7000"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={getLocation}
          disabled={gettingLocation}
          className="w-full py-2 text-sm text-forest border border-forest rounded-lg hover:bg-forest/5 transition-colors disabled:opacity-50"
        >
          {gettingLocation ? '📡 Mendapatkan lokasi...' : '📍 Guna Lokasi Semasa'}
        </button>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-forest text-white py-3 rounded-lg font-semibold hover:bg-moss transition-colors disabled:opacity-50"
        >
          {loading ? 'Menyimpan...' : 'Simpan Pekebun'}
        </button>
      </form>
    </div>
  );
}
