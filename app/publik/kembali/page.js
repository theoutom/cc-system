'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Search, ChevronLeft, Camera, CheckCircle, Package, Hash } from 'lucide-react'

const TOKEN_RE = /^[A-Z2-9]{6}$/i

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
  const [selectedReturn, setSelectedReturn] = useState([])

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
    supabase.from('inventaris').select('id, nama_alat').then(({ data }) => setInventaris(data || []))
  }, [])

  const resolveNama = (id) => inventaris.find(i => i.id === id)?.nama_alat || id
  const resolveNamas = (ids) => (ids || []).map(id => resolveNama(id)).filter(Boolean)

  const handleSearch = async () => {
    if (!query.trim()) return
    setSearching(true)
    setSearched(true)

    const q = query.trim()

    // Token search
    if (TOKEN_RE.test(q)) {
      const { data } = await supabase
        .from('peminjaman').select('*')
        .in('status', ['approved', 'active'])
        .eq('token', q.toUpperCase())
      if (data && data.length === 1) {
        selectPeminjaman(data[0])
        setSearching(false)
        return
      }
    }

    // Name / kegiatan search
    const { data } = await supabase
      .from('peminjaman').select('*')
      .in('status', ['approved', 'active'])
      .or(`nama_peminjam.ilike.%${q}%,nama_kegiatan.ilike.%${q}%`)
      .order('tanggal', { ascending: false })

    setResults(data || [])
    setSearching(false)
  }

  const selectPeminjaman = (pem) => {
    setSelected(pem)
    const alreadyReturned = pem.items_dikembalikan || []
    const pending = (pem.items_dipinjam || []).filter(id => !alreadyReturned.includes(id))
    setSelectedReturn(pending)
  }

  const toggleReturn = (id) => {
    setSelectedReturn(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const handleSubmit = async () => {
    if (!form.nama_pengembali) { alert('Nama pengembali wajib diisi'); return }
    if (!form.tanggal_pengembalian || !form.jam_pengembalian) { alert('Tanggal dan jam wajib diisi'); return }
    if (selectedReturn.length === 0) { alert('Pilih minimal 1 item yang dikembalikan!'); return }
    setSubmitting(true)

    const namaAlat = resolveNamas(selectedReturn)
    const alreadyReturned = selected.items_dikembalikan || []
    const pendingItems = (selected.items_dipinjam || []).filter(id => !alreadyReturned.includes(id))
    const isPartial = selectedReturn.length < pendingItems.length

    try {
      const { error } = await supabase.from('pengembalian').insert({
        peminjaman_id: selected.id,
        nama_pengembali: form.nama_pengembali,
        tanggal_pengembalian: form.tanggal_pengembalian,
        jam_pengembalian: form.jam_pengembalian,
        detail_barang_kembali: namaAlat.join('\n') + (form.catatan ? `\n\nCatatan: ${form.catatan}` : ''),
        items_dikembalikan: selectedReturn,
        is_partial: isPartial,
      })
      if (error) throw error
      setSubmitted(true)
    } catch (e) {
      alert('Gagal mencatat pengembalian: ' + e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const jenisColor = {
    Sekolah:    'bg-blue-50 text-blue-600 border-blue-100',
    Organisasi: 'bg-orange-50 text-orange-600 border-orange-100',
    Eksternal:  'bg-purple-50 text-purple-600 border-purple-100',
  }

  const Header = ({ onBack }) => (
    <div className="bg-white border-b border-slate-100 shadow-sm sticky top-0 z-10">
      <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <p className="font-bold text-slate-900 text-sm">Pengembalian Alat</p>
          <p className="text-xs text-slate-400">Creative Corner · Akses Tamu</p>
        </div>
        <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
          <Camera className="w-4 h-4 text-white" />
        </div>
      </div>
    </div>
  )

  // ── Success screen ─────────────────────────────────────────
  if (submitted) {
    const alreadyReturned = (selected?.items_dikembalikan || []).length + selectedReturn.length
    const total = (selected?.items_dipinjam || []).length
    const isPartial = alreadyReturned < total
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-xl text-center">
          <div className={`w-16 h-16 ${isPartial ? 'bg-amber-100' : 'bg-green-100'} rounded-full flex items-center justify-center mx-auto mb-4`}>
            <CheckCircle className={`w-8 h-8 ${isPartial ? 'text-amber-500' : 'text-green-500'}`} />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            {isPartial ? 'Sebagian Dikembalikan!' : 'Pengembalian Tercatat!'}
          </h2>
          <p className="text-slate-500 text-sm mb-2">
            {selectedReturn.length} dari {total} item berhasil dicatat dikembalikan.
            {isPartial && <><br/><strong className="text-amber-600">{total - alreadyReturned} item</strong> masih perlu dikembalikan.</>}
          </p>
          <p className="text-slate-400 text-xs mb-6">
            Pastikan alat dikembalikan ke tempatnya dalam kondisi baik 📦
          </p>
          <a href="/login" className="block w-full py-2.5 bg-purple-600 text-white font-semibold rounded-xl text-sm hover:bg-purple-700 transition-colors">
            Kembali ke Halaman Utama
          </a>
        </div>
      </div>
    )
  }

  // ── Form pengembalian ──────────────────────────────────────
  if (selected) {
    const alreadyReturned = selected.items_dikembalikan || []
    const pendingItems = (selected.items_dipinjam || []).filter(id => !alreadyReturned.includes(id))

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50">
        <Header onBack={() => setSelected(null)} />

        <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
          {/* Info kegiatan */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Kegiatan yang Dikembalikan</p>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${jenisColor[selected.jenis_acara]}`}>
                {selected.jenis_acara}
              </span>
              <p className="font-semibold text-slate-800 text-sm">{selected.nama_kegiatan}</p>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
              <span>👤 {selected.nama_peminjam}</span>
              {selected.tanggal && <span>📅 {selected.tanggal}</span>}
              {selected.perkiraan_kembali && <span>🔄 Est. kembali: <strong>{selected.perkiraan_kembali}</strong></span>}
            </div>
            {alreadyReturned.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <p className="text-xs font-semibold text-green-600 mb-1">✓ Sudah dikembalikan sebelumnya:</p>
                <div className="flex flex-wrap gap-1">
                  {alreadyReturned.map((id, i) => (
                    <span key={i} className="text-xs bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded-lg line-through opacity-60">
                      {resolveNama(id)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Item selector */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <p className="text-sm font-bold text-slate-700 mb-3">Pilih Item yang Dikembalikan Sekarang *</p>
            <div className="space-y-2">
              {pendingItems.map(id => {
                const checked = selectedReturn.includes(id)
                return (
                  <label key={id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 cursor-pointer transition-all ${
                      checked ? 'border-green-400 bg-green-50' : 'border-slate-200 hover:border-green-300'
                    }`}>
                    <input type="checkbox" checked={checked} onChange={() => toggleReturn(id)}
                      className="w-4 h-4 accent-green-600" />
                    <span className={`text-sm font-medium flex-1 ${checked ? 'text-green-800' : 'text-slate-700'}`}>
                      {resolveNama(id)}
                    </span>
                    {checked && <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />}
                  </label>
                )
              })}
            </div>
            {selectedReturn.length < pendingItems.length && selectedReturn.length > 0 && (
              <p className="text-xs text-amber-600 mt-2.5 font-medium bg-amber-50 px-3 py-2 rounded-lg">
                ⚠ {pendingItems.length - selectedReturn.length} item belum dipilih — bisa dikembalikan nanti
              </p>
            )}
          </div>

          {/* Form detail */}
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
                rows={2} placeholder="cth: SD Card ada goresan kecil"
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              />
            </div>
          </div>

          <button onClick={handleSubmit} disabled={submitting || selectedReturn.length === 0}
            className="w-full py-3 bg-green-600 text-white font-bold rounded-2xl hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50 text-sm">
            {submitting ? 'Menyimpan...' : selectedReturn.length < pendingItems.length
              ? `✓ Kembalikan ${selectedReturn.length} Item`
              : '✓ Konfirmasi Pengembalian Semua'}
          </button>
        </div>
      </div>
    )
  }

  // ── Search screen ─────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50">
      <Header onBack={() => window.location.href = '/login'} />

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <p className="text-sm font-bold text-slate-700 mb-1">Cari Peminjaman</p>
          <p className="text-xs text-slate-400 mb-4">Masukkan <strong>token</strong> atau nama peminjam / kegiatan</p>

          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="Token (6 huruf) atau nama peminjam..."
                className="w-full pl-10 pr-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <button onClick={handleSearch} disabled={searching || !query.trim()}
              className="px-4 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 disabled:opacity-50 transition-colors">
              {searching ? '...' : 'Cari'}
            </button>
          </div>

          <div className="flex items-center gap-2 bg-purple-50 border border-purple-100 rounded-xl px-3 py-2">
            <Hash className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
            <p className="text-xs text-purple-600">Token diberikan oleh admin CC saat peminjaman disetujui</p>
          </div>
        </div>

        {searched && (
          <div className="space-y-2">
            {results.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 text-center">
                <Package className="w-10 h-10 mx-auto mb-3 text-slate-200" />
                <p className="text-slate-500 font-medium text-sm">Tidak ditemukan</p>
                <p className="text-slate-400 text-xs mt-1">Coba dengan token atau nama lain</p>
              </div>
            ) : (
              <>
                <p className="text-xs text-slate-400 font-medium px-1">{results.length} peminjaman aktif ditemukan</p>
                {results.map(row => {
                  const namaAlat = resolveNamas(row.items_dipinjam)
                  const returned = row.items_dikembalikan || []
                  const isPartial = returned.length > 0 && returned.length < (row.items_dipinjam || []).length
                  return (
                    <button key={row.id} onClick={() => selectPeminjaman(row)}
                      className="w-full bg-white rounded-2xl p-4 shadow-sm border border-slate-100 text-left hover:border-purple-300 hover:bg-purple-50/20 transition-all">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${jenisColor[row.jenis_acara]}`}>
                            {row.jenis_acara}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          {isPartial && <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">Partial</span>}
                          <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">Aktif</span>
                        </div>
                      </div>
                      <p className="font-semibold text-slate-800 text-sm mb-1">{row.nama_kegiatan}</p>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400 mb-2">
                        <span>👤 {row.nama_peminjam}</span>
                        {row.perkiraan_kembali && <span>🔄 {row.perkiraan_kembali}</span>}
                      </div>
                      {isPartial && (
                        <p className="text-xs text-amber-600 font-medium">{returned.length}/{(row.items_dipinjam||[]).length} item sudah dikembalikan</p>
                      )}
                      {!isPartial && namaAlat.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {namaAlat.slice(0, 3).map((n, i) => (
                            <span key={i} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg">{n}</span>
                          ))}
                          {namaAlat.length > 3 && <span className="text-xs text-slate-400">+{namaAlat.length - 3} lagi</span>}
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
            <Hash className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p className="text-slate-400 text-sm font-medium mb-1">Punya token pengembalian?</p>
            <p className="text-slate-300 text-xs">Ketik 6 karakter token yang diberikan admin CC, atau cari dengan nama peminjam</p>
          </div>
        )}
      </div>
    </div>
  )
}
