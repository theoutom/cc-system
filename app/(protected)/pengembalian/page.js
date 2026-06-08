'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { RotateCcw, CheckCircle, X, Package, AlertTriangle, Camera } from 'lucide-react'

export default function PengembalianPage() {
  const supabase = createClient()
  const [aktif, setAktif] = useState([])
  const [riwayat, setRiwayat] = useState([])
  const [inventaris, setInventaris] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [selectedReturn, setSelectedReturn] = useState([])
  const [form, setForm] = useState({
    nama_pengembali: '',
    tanggal_pengembalian: '',
    jam_pengembalian: '',
    catatan: '',
    foto_kondisi_file: null,
  })

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    const [{ data: active }, { data: history }, { data: inv }] = await Promise.all([
      supabase.from('peminjaman').select('*')
        .in('status', ['approved', 'active']).order('tanggal', { ascending: true }),
      supabase.from('pengembalian').select('*, peminjaman(*)')
        .order('created_at', { ascending: false }).limit(20),
      supabase.from('inventaris').select('id, nama_alat, kondisi, denda_per_hari'),
    ])
    setAktif(active || [])
    setRiwayat(history || [])
    setInventaris(inv || [])
    setLoading(false)
  }

  const resolveNama = (id) => inventaris.find(i => i.id === id)?.nama_alat || id

  const openForm = (pem) => {
    setSelected(pem)
    const now = new Date()
    setForm({
      nama_pengembali: pem.nama_peminjam,
      tanggal_pengembalian: now.toISOString().split('T')[0],
      jam_pengembalian: now.toTimeString().slice(0, 5),
      catatan: '',
      foto_kondisi_file: null,
    })
    // Default: pilih semua item yang belum dikembalikan
    const belumKembali = (pem.items_dipinjam || []).filter(
      id => !(pem.items_dikembalikan || []).includes(id)
    )
    setSelectedReturn(belumKembali)
    setShowForm(true)
  }

  const toggleReturn = (id) => {
    setSelectedReturn(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const handleSubmit = async () => {
    if (!form.nama_pengembali || !form.tanggal_pengembalian || !form.jam_pengembalian) {
      alert('Harap isi semua field!')
      return
    }
    if (selectedReturn.length === 0) {
      alert('Pilih minimal 1 item yang dikembalikan!')
      return
    }
    setSubmitting(true)

    const namaAlat = selectedReturn.map(id => resolveNama(id))
    const sisaItems = (selected.items_dipinjam || []).filter(
      id => !(selected.items_dikembalikan || []).includes(id) && !selectedReturn.includes(id)
    )
    const isPartial = sisaItems.length > 0

    try {
      let foto_kondisi = null
      if (form.foto_kondisi_file) {
        const f = form.foto_kondisi_file
        if (f.size > 5 * 1024 * 1024) { alert('Foto melebihi 5MB!'); setSubmitting(false); return }
        const ext = f.name.split('.').pop()
        const path = `kondisi-${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage.from('lampiran').upload(path, f)
        if (upErr) throw upErr
        foto_kondisi = supabase.storage.from('lampiran').getPublicUrl(path).data?.publicUrl
      }

      const { error } = await supabase.from('pengembalian').insert({
        peminjaman_id: selected.id,
        nama_pengembali: form.nama_pengembali,
        tanggal_pengembalian: form.tanggal_pengembalian,
        jam_pengembalian: form.jam_pengembalian,
        detail_barang_kembali: namaAlat.join('\n') + (form.catatan ? `\n\nCatatan: ${form.catatan}` : ''),
        items_dikembalikan: selectedReturn,
        is_partial: isPartial,
        foto_kondisi,
      })
      if (error) throw error
    } catch (e) {
      alert('Gagal mencatat pengembalian: ' + e.message)
      setSubmitting(false)
      return
    }

    setShowForm(false)
    setSelected(null)
    setSubmitting(false)
    fetchData()
  }

  const today = new Date().toISOString().split('T')[0]

  const getOverdueInfo = (p) => {
    if (!p.perkiraan_kembali) return null
    const diff = Math.floor((new Date(today) - new Date(p.perkiraan_kembali)) / 86400000)
    if (diff > 0) return { days: diff, label: `Terlambat ${diff} hari`, isOver: true }
    if (diff === 0) return { days: 0, label: 'Jatuh tempo hari ini', isOver: false }
    if (diff >= -2) return { days: diff, label: `${-diff} hari lagi`, isOver: false, warning: true }
    return null
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
            {aktif.map(p => {
              const overdue = getOverdueInfo(p)
              const returned = p.items_dikembalikan || []
              const total = (p.items_dipinjam || []).length
              const partialProgress = returned.length > 0 && returned.length < total
              return (
                <div key={p.id} className={`px-5 py-4 ${overdue?.isOver ? 'bg-red-50/40' : overdue?.warning ? 'bg-amber-50/40' : ''}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          p.jenis_acara === 'Sekolah' ? 'bg-blue-50 text-blue-600' :
                          p.jenis_acara === 'Organisasi' ? 'bg-orange-50 text-orange-600' :
                          'bg-purple-50 text-purple-600'}`}>
                          {p.jenis_acara}
                        </span>
                        <p className="font-medium text-slate-800 text-sm">{p.nama_kegiatan}</p>
                        {overdue?.isOver && (
                          <span className="flex items-center gap-1 text-xs bg-red-100 text-red-700 font-semibold px-2 py-0.5 rounded-full">
                            <AlertTriangle className="w-3 h-3" /> {overdue.label}
                          </span>
                        )}
                        {overdue?.warning && !overdue?.isOver && (
                          <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">
                            ⚠ {overdue.label}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">
                        👤 {p.nama_peminjam}
                        {p.tanggal && ` · 📅 ${p.tanggal}`}
                        {p.perkiraan_kembali && ` · 🔄 Kembali: ${p.perkiraan_kembali}`}
                      </p>
                      {p.token && (
                        <p className="text-xs text-purple-600 font-mono font-bold mt-1">
                          🔑 Token: {p.token}
                        </p>
                      )}
                      {partialProgress && (
                        <div className="mt-1.5">
                          <div className="flex items-center gap-2 mb-0.5">
                            <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                              <div className="h-full bg-green-500 rounded-full" style={{ width: `${(returned.length / total) * 100}%` }} />
                            </div>
                            <span className="text-xs text-slate-500 font-medium">{returned.length}/{total} kembali</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => openForm(p)}
                      className="flex-shrink-0 flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      {partialProgress ? 'Lanjut Kembali' : 'Catat Kembali'}
                    </button>
                  </div>
                </div>
              )
            })}
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
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Tipe</th>
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
                    <td className="px-4 py-3">
                      {r.is_partial
                        ? <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Sebagian</span>
                        : <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Lengkap</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Form */}
      {showForm && selected && (() => {
        const alreadyReturned = selected.items_dikembalikan || []
        const pendingItems = (selected.items_dipinjam || []).filter(id => !alreadyReturned.includes(id))
        const overdue = getOverdueInfo(selected)

        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
                <div>
                  <h3 className="font-semibold text-slate-900">Catat Pengembalian</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{selected.nama_kegiatan}</p>
                </div>
                <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                {overdue?.isOver && (() => {
                  const totalDenda = (selected.items_dipinjam || []).reduce((sum, id) => {
                    const item = inventaris.find(i => i.id === id)
                    return sum + (item?.denda_per_hari || 0)
                  }, 0)
                  const fine = totalDenda * overdue.days
                  return (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-1">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
                        <p className="text-sm font-bold text-red-700">{overdue.label}</p>
                      </div>
                      {fine > 0 && (
                        <p className="text-sm font-semibold text-red-700 pl-6">
                          Estimasi denda: <span className="text-red-600">Rp{fine.toLocaleString('id-ID')}</span>
                        </p>
                      )}
                      <p className="text-xs text-red-400 pl-6">Catat pengembalian dan selesaikan administrasi keterlambatan.</p>
                    </div>
                  )
                })()}

                <div className="bg-slate-50 rounded-lg p-3 text-sm flex items-center gap-3">
                  <div className="flex-1">
                    <p className="font-medium text-slate-700">{selected.nama_peminjam} · {selected.jenis_acara}</p>
                    {selected.token && (
                      <p className="text-xs text-purple-600 font-mono font-bold mt-0.5">🔑 Token: {selected.token}</p>
                    )}
                  </div>
                </div>

                {/* Item selector */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Pilih Item yang Dikembalikan Sekarang *
                  </label>

                  {alreadyReturned.length > 0 && (
                    <div className="mb-2 space-y-1">
                      {alreadyReturned.map(id => (
                        <div key={id} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg opacity-50">
                          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                          <span className="text-sm text-slate-400 line-through">{resolveNama(id)}</span>
                          <span className="text-xs text-green-600 ml-auto">Sudah kembali</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    {pendingItems.map(id => {
                      const checked = selectedReturn.includes(id)
                      return (
                        <label key={id}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 cursor-pointer transition-all ${
                            checked ? 'border-green-400 bg-green-50' : 'border-slate-200 hover:border-green-300'
                          }`}>
                          <input type="checkbox" checked={checked} onChange={() => toggleReturn(id)}
                            className="w-4 h-4 accent-green-600" />
                          <span className={`text-sm font-medium ${checked ? 'text-green-800' : 'text-slate-700'}`}>
                            {resolveNama(id)}
                          </span>
                          {checked && <CheckCircle className="w-4 h-4 text-green-500 ml-auto flex-shrink-0" />}
                        </label>
                      )
                    })}
                  </div>

                  {selectedReturn.length < pendingItems.length && selectedReturn.length > 0 && (
                    <p className="text-xs text-amber-600 mt-2 font-medium">
                      ⚠ {pendingItems.length - selectedReturn.length} item tidak dikembalikan sekarang — status tetap aktif
                    </p>
                  )}
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
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Catatan <span className="text-slate-400 font-normal">(opsional)</span>
                  </label>
                  <textarea value={form.catatan}
                    onChange={e => setForm(f => ({ ...f, catatan: e.target.value }))}
                    rows={2} placeholder="cth: SD Card ada goresan kecil"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                  />

                  <div className="mt-3">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Foto Kondisi Alat <span className="text-slate-400 font-normal">(opsional)</span>
                    </label>
                    <label className={`flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                      form.foto_kondisi_file ? 'border-green-400 bg-green-50' : 'border-slate-200 hover:border-green-400 hover:bg-green-50/30'
                    }`}>
                      {form.foto_kondisi_file ? (
                        <>
                          <CheckCircle className="w-6 h-6 text-green-500 mb-1" />
                          <p className="text-xs font-medium text-green-700">{form.foto_kondisi_file.name}</p>
                          <p className="text-xs text-green-500">Klik untuk ganti</p>
                        </>
                      ) : (
                        <>
                          <Camera className="w-6 h-6 text-slate-300 mb-1" />
                          <p className="text-xs text-slate-400">Foto kondisi alat saat dikembalikan</p>
                          <p className="text-xs text-slate-300 mt-0.5">JPG, PNG · Maks. 5MB</p>
                        </>
                      )}
                      <input type="file" accept="image/*" className="hidden"
                        onChange={e => setForm(f => ({ ...f, foto_kondisi_file: e.target.files[0] || null }))} />
                    </label>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-slate-100 flex gap-3 justify-end flex-shrink-0">
                <button onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
                  Batal
                </button>
                <button onClick={handleSubmit} disabled={submitting || selectedReturn.length === 0}
                  className="px-5 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50">
                  {submitting ? 'Menyimpan...' : selectedReturn.length < pendingItems.length
                    ? `✓ Kembalikan ${selectedReturn.length} Item`
                    : '✓ Konfirmasi Kembali Semua'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
