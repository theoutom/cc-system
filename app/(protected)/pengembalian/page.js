'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { RotateCcw, CheckCircle, X } from 'lucide-react'

export default function PengembalianPage() {
  const supabase = createClient()
  const [aktif, setAktif] = useState([])
  const [riwayat, setRiwayat] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    nama_pengembali: '',
    tanggal_pengembalian: '',
    jam_pengembalian: '',
    detail_barang_kembali: '',
  })

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    const { data: active } = await supabase
      .from('peminjaman').select('*')
      .in('status', ['approved', 'active'])
      .order('tanggal', { ascending: true })

    const { data: history } = await supabase
      .from('pengembalian').select('*, peminjaman(*)')
      .order('created_at', { ascending: false })
      .limit(20)

    setAktif(active || [])
    setRiwayat(history || [])
    setLoading(false)
  }

  const openForm = (pem) => {
    setSelected(pem)
    const now = new Date()
    setForm({
      nama_pengembali: pem.nama_peminjam,
      tanggal_pengembalian: now.toISOString().split('T')[0],
      jam_pengembalian: now.toTimeString().slice(0, 5),
      detail_barang_kembali: pem.detail_barang,
    })
    setShowForm(true)
  }

  const handleSubmit = async () => {
    if (!form.nama_pengembali || !form.tanggal_pengembalian || !form.jam_pengembalian) {
      alert('Harap isi semua field!')
      return
    }
    setSubmitting(true)

    await supabase.from('pengembalian').insert({
      peminjaman_id: selected.id,
      nama_pengembali: form.nama_pengembali,
      tanggal_pengembalian: form.tanggal_pengembalian,
      jam_pengembalian: form.jam_pengembalian,
      detail_barang_kembali: form.detail_barang_kembali,
    })

    await supabase.from('peminjaman').update({ status: 'returned' }).eq('id', selected.id)

    // Kembalikan status alat ke 'Tersedia' otomatis
    if (Array.isArray(selected.items_dipinjam) && selected.items_dipinjam.length > 0) {
      await supabase
        .from('inventaris')
        .update({ status: 'Tersedia' })
        .in('id', selected.items_dipinjam)
    }

    setShowForm(false)
    setSelected(null)
    setSubmitting(false)
    fetchData()
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Pengembalian</h1>
        <p className="text-slate-500 text-sm mt-0.5">Catat pengembalian alat yang sedang dipinjam</p>
      </div>

      {/* Peminjaman Aktif */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 mb-6">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
          <h2 className="font-semibold text-slate-900">Peminjaman Aktif</h2>
          <span className="ml-auto bg-amber-100 text-amber-700 text-xs font-medium px-2 py-0.5 rounded-full">{aktif.length} item</span>
        </div>

        {loading ? (
          <p className="text-center py-10 text-slate-400 text-sm">Memuat...</p>
        ) : aktif.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <CheckCircle className="w-10 h-10 mx-auto mb-3 text-green-400" />
            <p className="text-sm">Semua alat sudah dikembalikan!</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {aktif.map(p => (
              <div key={p.id} className="px-5 py-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      p.jenis_acara === 'Sekolah' ? 'bg-blue-50 text-blue-600' :
                      p.jenis_acara === 'Organisasi' ? 'bg-orange-50 text-orange-600' :
                      'bg-purple-50 text-purple-600'}`}>
                      {p.jenis_acara}
                    </span>
                    <p className="font-medium text-slate-800 text-sm">{p.nama_kegiatan}</p>
                  </div>
                  <p className="text-xs text-slate-500">Peminjam: {p.nama_peminjam} · Tanggal: {p.tanggal}</p>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">{p.detail_barang}</p>
                </div>
                <button
                  onClick={() => openForm(p)}
                  className="flex-shrink-0 flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Catat Kembali
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Riwayat Pengembalian */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Riwayat Pengembalian</h2>
        </div>
        {riwayat.length === 0 ? (
          <p className="text-center py-10 text-slate-400 text-sm">Belum ada riwayat</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Kegiatan</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Pengembali</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Tanggal</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Jam</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {riwayat.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{r.peminjaman?.nama_kegiatan}</p>
                      <p className="text-xs text-slate-400 line-clamp-1">{r.detail_barang_kembali}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{r.nama_pengembali}</td>
                    <td className="px-4 py-3 text-slate-600">{r.tanggal_pengembalian}</td>
                    <td className="px-4 py-3 text-slate-600">{r.jam_pengembalian}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showForm && selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900">Catat Pengembalian</h3>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="bg-slate-50 rounded-lg p-3 text-sm">
                <p className="font-medium text-slate-700">{selected.nama_kegiatan}</p>
                <p className="text-slate-500 text-xs mt-0.5">{selected.nama_peminjam} · {selected.jenis_acara}</p>
              </div>

              {[
                { key: 'nama_pengembali', label: 'Nama Pengembali', type: 'text' },
                { key: 'tanggal_pengembalian', label: 'Tanggal Pengembalian', type: 'date' },
                { key: 'jam_pengembalian', label: 'Jam Pengembalian', type: 'time' },
              ].map(({ key, label, type }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{label} *</label>
                  <input type={type} value={form[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              ))}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Detail Barang yang Dikembalikan</label>
                <textarea value={form.detail_barang_kembali}
                  onChange={e => setForm(f => ({ ...f, detail_barang_kembali: e.target.value }))}
                  rows={4} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex gap-3 justify-end">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
                Batal
              </button>
              <button onClick={handleSubmit} disabled={submitting}
                className="px-5 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50">
                {submitting ? 'Menyimpan...' : '✓ Konfirmasi Kembali'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
