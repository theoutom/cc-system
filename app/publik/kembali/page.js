'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Search, ChevronLeft, Camera, CheckCircle, Package, X, Clock, Upload } from 'lucide-react'

export default function PublikKembaliPage() {
  const supabase = createClient()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searched, setSearched] = useState(false)
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [inventaris, setInventaris] = useState([])

  const [form, setForm] = useState({
    nama_pengembali: '',
    jam_pengembalian: '',
    tanggal_pengembalian: '',
    catatan: '',
  })

  useEffect(() => {
    const now = new Date()
    setForm(f => ({
      ...f,
      tanggal_pengembalian: now.toISOString().split('T')[0],
      jam_pengembalian: now.toTimeString().slice(0, 5),
    }))
    // Fetch inventaris for nama lookup
    supabase.from('inventaris').select('id, nama_alat').then(({ data }) => setInventaris(data || []))
  }, [])

  const handleSearch = async () => {
    if (!query.trim()) return
    setSearching(true)
    setSearched(true)

    const q = query.trim().toLowerCase()
    const { data } = await supabase
      .from('peminjaman')
      .select('*')
      .in('status', ['approved', 'active'])
      .or(`nama_peminjam.ilike.%${q}%,nama_kegiatan.ilike.%${q}%`)
      .order('tanggal', { ascending: false })

    setResults(data || [])
    setSearching(false)
  }

  const resolveNamas = (ids) => {
    if (!Array.isArray(ids) || ids.length === 0) return []
    return ids.map(id => inventaris.find(i => i.id === id)?.nama_alat).filter(Boolean)
  }

  const handleSubmit = async () => {
    if (!form.nama_pengembali) { alert('Nama pengembali wajib diisi'); return }
    if (!form.tanggal_pengembalian || !form.jam_pengembalian) { alert('Tanggal dan jam wajib diisi'); return }
    setSubmitting(true)

    const namaAlat = resolveNamas(selected.items_dipinjam)

    await supabase.from('pengembalian').insert({
      peminjaman_id: selected.id,
      nama_pengembali: form.nama_pengembali,
      tanggal_pengembalian: form.tanggal_pengembalian,
      jam_pengembalian: form.jam_pengembalian,
      detail_barang_kembali: namaAlat.join('\n') + (form.catatan ? `\n\nCatatan: ${form.catatan}` : ''),
    })

    await supabase.from('peminjaman').update({ status: 'returned' }).eq('id', selected.id)

    // Kembalikan status alat ke Tersedia
    if (Array.isArray(selected.items_dipinjam) && selected.items_dipinjam.length > 0) {
      await supabase.from('inventaris').update({ status: 'Tersedia' }).in('id', selected.items_dipinjam)
    }

    setSubmitted(true)
    setSubmitting(false)
  }

  const jenisColor = {
    Sekolah:    'bg-blue-50 text-blue-600 border-blue-100',
    Organisasi: 'bg-orange-50 text-orange-600 border-orange-100',
    Eksternal:  'bg-purple-50 text-purple-600 border-purple-100',
  }

  // ── Success screen ─────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-xl text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Pengembalian Tercatat!</h2>
          <p className="text-slate-500 text-sm mb-2">
            Terima kasih, <strong>{form.nama_pengembali}</strong>! Pengembalian alat untuk kegiatan <strong>{selected?.nama_kegiatan}</strong> sudah berhasil dicatat.
          </p>
          <p className="text-slate-400 text-xs mb-6">Pastikan semua alat sudah dikembalikan ke tempatnya dalam kondisi baik ya 📦</p>
          <a href="/login" className="block w-full py-2.5 bg-purple-600 text-white font-semibold rounded-xl text-sm hover:bg-purple-700 transition-colors">
            Kembali ke Halaman Utama
          </a>
        </div>
      </div>
    )
  }

  // ── Form pengembalian setelah pilih kegiatan ───────────────
  if (selected) {
    const namaAlat = resolveNamas(selected.items_dipinjam)
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50">
        <div className="bg-white border-b border-slate-100 shadow-sm sticky top-0 z-10">
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
            <button onClick={() => setSelected(null)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <p className="font-bold text-slate-900 text-sm">Form Pengembalian</p>
              <p className="text-xs text-slate-400">Creative Corner · Akses Tamu</p>
            </div>
            <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
              <Camera className="w-4 h-4 text-white" />
            </div>
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
          {/* Info kegiatan */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Kegiatan yang Dikembalikan</p>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${jenisColor[selected.jenis_acara]}`}>
                {selected.jenis_acara}
              </span>
              {selected.asal_organisasi && (
                <span className="text-xs text-slate-500 font-medium">· {selected.asal_organisasi}</span>
              )}
              <p className="font-semibold text-slate-800 text-sm">{selected.nama_kegiatan}</p>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400 mb-3">
              <span>👤 {selected.nama_peminjam}</span>
              <span>📅 {selected.tanggal}</span>
              {selected.perkiraan_kembali && <span>🔄 Est. kembali: <strong>{selected.perkiraan_kembali}</strong></span>}
            </div>
            {namaAlat.length > 0 && (
              <div className="border-t border-slate-100 pt-3">
                <p className="text-xs font-semibold text-slate-400 mb-2">Alat yang Dipinjam</p>
                <div className="flex flex-wrap gap-1.5">
                  {namaAlat.map((n, i) => (
                    <span key={i} className="text-xs bg-purple-50 text-purple-700 border border-purple-100 px-2 py-0.5 rounded-lg font-medium">{n}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Form pengembalian */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-4">
            <p className="text-sm font-bold text-slate-700">Detail Pengembalian</p>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nama yang Mengembalikan *</label>
              <input value={form.nama_pengembali} onChange={e => setForm(f => ({ ...f, nama_pengembali: e.target.value }))}
                placeholder="Nama lengkap"
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tanggal Kembali *</label>
                <input type="date" value={form.tanggal_pengembalian}
                  onChange={e => setForm(f => ({ ...f, tanggal_pengembalian: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Jam Kembali *</label>
                <input type="time" value={form.jam_pengembalian}
                  onChange={e => setForm(f => ({ ...f, jam_pengembalian: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Catatan <span className="text-slate-400 font-normal">(opsional)</span>
              </label>
              <textarea value={form.catatan} onChange={e => setForm(f => ({ ...f, catatan: e.target.value }))}
                rows={2} placeholder="cth: SD Card #2 layar ada goresan kecil"
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              />
            </div>
          </div>

          <button onClick={handleSubmit} disabled={submitting}
            className="w-full py-3 bg-green-600 text-white font-bold rounded-2xl hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50 text-sm">
            {submitting ? 'Menyimpan...' : '✓ Konfirmasi Pengembalian'}
          </button>
        </div>
      </div>
    )
  }

  // ── Search screen ─────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50">
      <div className="bg-white border-b border-slate-100 shadow-sm sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <a href="/login" className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100">
            <ChevronLeft className="w-5 h-5" />
          </a>
          <div className="flex-1">
            <p className="font-bold text-slate-900 text-sm">Pengembalian Alat</p>
            <p className="text-xs text-slate-400">Creative Corner · Akses Tamu</p>
          </div>
          <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
            <Camera className="w-4 h-4 text-white" />
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Search */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <p className="text-sm font-bold text-slate-700 mb-1">Cari Peminjaman</p>
          <p className="text-xs text-slate-400 mb-4">Ketuk nama peminjam atau nama kegiatan</p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="Nama peminjam atau kegiatan..."
                className="w-full pl-10 pr-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <button onClick={handleSearch} disabled={searching || !query.trim()}
              className="px-4 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 disabled:opacity-50 transition-colors">
              {searching ? '...' : 'Cari'}
            </button>
          </div>
        </div>

        {/* Results */}
        {searched && (
          <div className="space-y-2">
            {results.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 text-center">
                <Package className="w-10 h-10 mx-auto mb-3 text-slate-200" />
                <p className="text-slate-500 font-medium text-sm">Tidak ditemukan</p>
                <p className="text-slate-400 text-xs mt-1">Pastikan kata kunci sesuai nama peminjam atau kegiatan yang aktif</p>
              </div>
            ) : (
              <>
                <p className="text-xs text-slate-400 font-medium px-1">{results.length} peminjaman aktif ditemukan</p>
                {results.map(row => {
                  const namaAlat = resolveNamas(row.items_dipinjam)
                  return (
                    <button key={row.id} onClick={() => setSelected(row)}
                      className="w-full bg-white rounded-2xl p-4 shadow-sm border border-slate-100 text-left hover:border-purple-300 hover:bg-purple-50/20 transition-all">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${jenisColor[row.jenis_acara]}`}>
                            {row.jenis_acara}
                          </span>
                          {row.asal_organisasi && (
                            <span className="text-xs text-slate-500">· {row.asal_organisasi}</span>
                          )}
                        </div>
                        <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full flex-shrink-0">Aktif</span>
                      </div>
                      <p className="font-semibold text-slate-800 text-sm mb-1">{row.nama_kegiatan}</p>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400 mb-2">
                        <span>👤 {row.nama_peminjam}</span>
                        <span>📅 {row.tanggal}</span>
                        {row.perkiraan_kembali && <span>🔄 {row.perkiraan_kembali}</span>}
                      </div>
                      {namaAlat.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {namaAlat.slice(0, 3).map((n, i) => (
                            <span key={i} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg">{n}</span>
                          ))}
                          {namaAlat.length > 3 && (
                            <span className="text-xs text-slate-400">+{namaAlat.length - 3} lagi</span>
                          )}
                        </div>
                      )}
                      <p className="text-xs text-purple-600 font-semibold mt-2">Ketuk untuk kembalikan →</p>
                    </button>
                  )
                })}
              </>
            )}
          </div>
        )}

        {!searched && (
          <div className="bg-white/60 rounded-2xl p-6 border border-dashed border-slate-200 text-center">
            <Search className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p className="text-slate-400 text-sm">Masukkan nama kamu atau nama kegiatan di atas untuk menemukan peminjaman yang aktif</p>
          </div>
        )}
      </div>
    </div>
  )
}
