'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Box, Plus, X, Edit2, Trash2, Search, Lock, Info } from 'lucide-react'

const KATEGORI = ['Kamera', 'Lensa', 'Aksesori', 'Lighting', 'Audio', 'Lainnya']
const KONDISI = ['Baik', 'Rusak Ringan', 'Rusak Berat']
const STATUS_INV = ['Tersedia', 'Dipinjam']

export default function InventarisPage() {
  const supabase = createClient()
  const [data, setData] = useState([])
  const [peminjamanMap, setPeminjamanMap] = useState({}) // inventaris_id -> info peminjaman
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editRow, setEditRow] = useState(null)
  const [search, setSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ nama_alat: '', kategori: 'Aksesori', kondisi: 'Baik', status: 'Tersedia', catatan: '' })

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    const { data: inv } = await supabase.from('inventaris').select('*').order('kategori').order('nama_alat')

    // Fetch peminjaman aktif untuk tampilkan info peminjam
    const { data: aktif } = await supabase
      .from('peminjaman')
      .select('id, nama_kegiatan, nama_peminjam, asal_organisasi, tanggal, perkiraan_kembali, items_dipinjam, status')
      .in('status', ['pending', 'approved', 'active'])

    // Build map: inventaris_id → info peminjaman
    const map = {}
    if (aktif) {
      aktif.forEach(p => {
        if (Array.isArray(p.items_dipinjam)) {
          p.items_dipinjam.forEach(itemId => {
            if (!map[itemId]) map[itemId] = []
            map[itemId].push(p)
          })
        }
      })
    }

    setData(inv || [])
    setPeminjamanMap(map)
    setLoading(false)
  }

  const handleSubmit = async () => {
    if (!form.nama_alat) { alert('Nama alat wajib diisi!'); return }
    setSubmitting(true)
    if (editRow) {
      await supabase.from('inventaris').update(form).eq('id', editRow.id)
    } else {
      await supabase.from('inventaris').insert(form)
    }
    setForm({ nama_alat: '', kategori: 'Aksesori', kondisi: 'Baik', status: 'Tersedia', catatan: '' })
    setShowForm(false)
    setEditRow(null)
    setSubmitting(false)
    fetchData()
  }

  const handleEdit = (row) => {
    setEditRow(row)
    setForm({ nama_alat: row.nama_alat, kategori: row.kategori || 'Aksesori', kondisi: row.kondisi || 'Baik', status: row.status || 'Tersedia', catatan: row.catatan || '' })
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Hapus alat ini dari inventaris?')) return
    await supabase.from('inventaris').delete().eq('id', id)
    fetchData()
  }

  const handleToggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'Tersedia' ? 'Dipinjam' : 'Tersedia'
    await supabase.from('inventaris').update({ status: newStatus }).eq('id', id)
    fetchData()
  }

  const filtered = data.filter(d =>
    d.nama_alat?.toLowerCase().includes(search.toLowerCase()) ||
    d.kategori?.toLowerCase().includes(search.toLowerCase())
  )

  const grouped = KATEGORI.reduce((acc, k) => {
    const items = filtered.filter(d => d.kategori === k)
    if (items.length > 0) acc[k] = items
    return acc
  }, {})
  const lainnya = filtered.filter(d => !KATEGORI.includes(d.kategori))
  if (lainnya.length > 0) grouped['Lainnya'] = lainnya

  const kondisiColor = { 'Baik': 'text-green-600', 'Rusak Ringan': 'text-amber-600', 'Rusak Berat': 'text-red-600' }

  // Status nyata: cek dari peminjamanMap (ada pending/approved = sedang dipakai/akan dipakai)
  const getRealStatus = (item) => {
    const loans = peminjamanMap[item.id]
    if (!loans || loans.length === 0) return item.status
    const approved = loans.find(l => l.status === 'approved' || l.status === 'active')
    if (approved) return 'Dipinjam'
    const pending = loans.find(l => l.status === 'pending')
    if (pending) return 'Pending'
    return item.status
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inventaris Alat</h1>
          <p className="text-slate-500 text-sm mt-0.5">Kelola daftar peralatan studio Creative Corner</p>
        </div>
        <button onClick={() => { setForm({ nama_alat: '', kategori: 'Aksesori', kondisi: 'Baik', status: 'Tersedia', catatan: '' }); setEditRow(null); setShowForm(true) }}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> Tambah Alat
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-700">{data.filter(d => getRealStatus(d) === 'Tersedia').length}</p>
          <p className="text-xs text-green-600 mt-1 font-medium">Tersedia</p>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-red-600">{data.filter(d => getRealStatus(d) === 'Dipinjam').length}</p>
          <p className="text-xs text-red-500 mt-1 font-medium">Dipinjam</p>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{data.filter(d => getRealStatus(d) === 'Pending').length}</p>
          <p className="text-xs text-amber-500 mt-1 font-medium">Pending Approval</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Cari nama atau kategori alat..."
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      {/* Grouped list */}
      {loading ? <p className="text-center py-10 text-slate-400 text-sm">Memuat...</p> : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([kategori, items]) => (
            <div key={kategori} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                <Box className="w-4 h-4 text-purple-600" />
                <h3 className="font-semibold text-slate-700 text-sm">{kategori}</h3>
                <span className="ml-auto text-xs text-slate-400">{items.length} item</span>
              </div>
              <div className="divide-y divide-slate-50">
                {items.map(item => {
                  const realStatus = getRealStatus(item)
                  const loans = peminjamanMap[item.id] || []
                  const activeLoan = loans.find(l => l.status === 'approved' || l.status === 'active')
                  const pendingLoan = loans.find(l => l.status === 'pending')
                  const shownLoan = activeLoan || pendingLoan

                  return (
                    <div key={item.id} className={`px-5 py-3 ${shownLoan ? 'bg-slate-50/50' : ''}`}>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-slate-800">{item.nama_alat}</p>
                            <span className={`text-xs font-medium ${kondisiColor[item.kondisi]}`}>{item.kondisi}</span>
                          </div>
                          {item.catatan && <p className="text-xs text-slate-400 mt-0.5">📝 {item.catatan}</p>}
                        </div>

                        {/* Status badge — real-time dari peminjaman */}
                        <div className="flex-shrink-0">
                          {realStatus === 'Dipinjam' ? (
                            <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-semibold bg-red-100 text-red-700">
                              <Lock className="w-3 h-3" /> Dipinjam
                            </span>
                          ) : realStatus === 'Pending' ? (
                            <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-semibold bg-amber-100 text-amber-700">
                              ⏳ Pending
                            </span>
                          ) : (
                            <button onClick={() => handleToggleStatus(item.id, item.status)}
                              className="text-xs px-3 py-1 rounded-full font-medium transition-colors cursor-pointer bg-green-100 text-green-700 hover:bg-green-200">
                              Tersedia
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button onClick={() => handleEdit(item)} className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(item.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Info peminjam — tampil jika ada peminjaman aktif/pending */}
                      {shownLoan && (
                        <div className={`mt-2 ml-0 pl-3 border-l-2 text-xs space-y-0.5 ${
                          activeLoan ? 'border-red-300' : 'border-amber-300'
                        }`}>
                          <p className={`font-semibold ${activeLoan ? 'text-red-600' : 'text-amber-600'}`}>
                            {activeLoan ? '🔒 Sedang dipinjam' : '⏳ Menunggu approval'}
                          </p>
                          <p className="text-slate-500">
                            📌 {shownLoan.nama_kegiatan}
                            {shownLoan.asal_organisasi && ` · ${shownLoan.asal_organisasi}`}
                          </p>
                          <p className="text-slate-500">👤 {shownLoan.nama_peminjam}</p>
                          <div className="flex gap-3 flex-wrap">
                            <p className="text-slate-400">📅 {shownLoan.tanggal}</p>
                            {shownLoan.perkiraan_kembali && (
                              <p className="text-slate-400">🔄 Kembali: <span className="font-medium text-slate-600">
                                {new Date(shownLoan.perkiraan_kembali + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </span></p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900">{editRow ? 'Edit' : 'Tambah'} Alat</h3>
              <button onClick={() => { setShowForm(false); setEditRow(null) }} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nama Alat *</label>
                <input value={form.nama_alat} onChange={e => setForm(f => ({ ...f, nama_alat: e.target.value }))}
                  placeholder="cth: Canon EOS M6 Mark II"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { key: 'kategori', label: 'Kategori', options: KATEGORI },
                  { key: 'kondisi', label: 'Kondisi', options: KONDISI },
                  { key: 'status', label: 'Status', options: STATUS_INV },
                ].map(({ key, label, options }) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
                    <select value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
                      {options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Catatan</label>
                <input value={form.catatan} onChange={e => setForm(f => ({ ...f, catatan: e.target.value }))}
                  placeholder="Kondisi khusus, nomor seri, dll."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex gap-3 justify-end">
              <button onClick={() => { setShowForm(false); setEditRow(null) }} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Batal</button>
              <button onClick={handleSubmit} disabled={submitting}
                className="px-5 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium disabled:opacity-50">
                {submitting ? 'Menyimpan...' : editRow ? 'Simpan' : 'Tambah'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


export default function InventarisPage() {
  const supabase = createClient()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editRow, setEditRow] = useState(null)
  const [search, setSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ nama_alat: '', kategori: 'Aksesori', kondisi: 'Baik', status: 'Tersedia', catatan: '' })

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    const { data: inv } = await supabase.from('inventaris').select('*').order('kategori').order('nama_alat')
    setData(inv || [])
    setLoading(false)
  }

  const handleSubmit = async () => {
    if (!form.nama_alat) { alert('Nama alat wajib diisi!'); return }
    setSubmitting(true)
    if (editRow) {
      await supabase.from('inventaris').update(form).eq('id', editRow.id)
    } else {
      await supabase.from('inventaris').insert(form)
    }
    setForm({ nama_alat: '', kategori: 'Aksesori', kondisi: 'Baik', status: 'Tersedia', catatan: '' })
    setShowForm(false)
    setEditRow(null)
    setSubmitting(false)
    fetchData()
  }

  const handleEdit = (row) => {
    setEditRow(row)
    setForm({ nama_alat: row.nama_alat, kategori: row.kategori || 'Aksesori', kondisi: row.kondisi || 'Baik', status: row.status || 'Tersedia', catatan: row.catatan || '' })
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Hapus alat ini dari inventaris?')) return
    await supabase.from('inventaris').delete().eq('id', id)
    fetchData()
  }

  const handleToggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'Tersedia' ? 'Dipinjam' : 'Tersedia'
    await supabase.from('inventaris').update({ status: newStatus }).eq('id', id)
    fetchData()
  }

  const filtered = data.filter(d =>
    d.nama_alat?.toLowerCase().includes(search.toLowerCase()) ||
    d.kategori?.toLowerCase().includes(search.toLowerCase())
  )

  const grouped = KATEGORI.reduce((acc, k) => {
    const items = filtered.filter(d => d.kategori === k)
    if (items.length > 0) acc[k] = items
    return acc
  }, {})
  const lainnya = filtered.filter(d => !KATEGORI.includes(d.kategori))
  if (lainnya.length > 0) grouped['Lainnya'] = lainnya

  const kondisiColor = { 'Baik': 'text-green-600', 'Rusak Ringan': 'text-amber-600', 'Rusak Berat': 'text-red-600' }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inventaris Alat</h1>
          <p className="text-slate-500 text-sm mt-0.5">Kelola daftar peralatan studio Creative Corner</p>
        </div>
        <button onClick={() => { setForm({ nama_alat: '', kategori: 'Aksesori', kondisi: 'Baik', status: 'Tersedia', catatan: '' }); setEditRow(null); setShowForm(true) }}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> Tambah Alat
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-700">{data.filter(d => d.status === 'Tersedia').length}</p>
          <p className="text-xs text-green-600 mt-1 font-medium">Tersedia</p>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-red-600">{data.filter(d => d.status === 'Dipinjam').length}</p>
          <p className="text-xs text-red-500 mt-1 font-medium">Dipinjam</p>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-slate-700">{data.length}</p>
          <p className="text-xs text-slate-500 mt-1 font-medium">Total Alat</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Cari nama atau kategori alat..."
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      {/* Grouped list */}
      {loading ? <p className="text-center py-10 text-slate-400 text-sm">Memuat...</p> : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([kategori, items]) => (
            <div key={kategori} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                <Box className="w-4 h-4 text-purple-600" />
                <h3 className="font-semibold text-slate-700 text-sm">{kategori}</h3>
                <span className="ml-auto text-xs text-slate-400">{items.length} item</span>
              </div>
              <div className="divide-y divide-slate-50">
                {items.map(item => (
                  <div key={item.id} className="px-5 py-3 flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-800">{item.nama_alat}</p>
                        <span className={`text-xs font-medium ${kondisiColor[item.kondisi]}`}>{item.kondisi}</span>
                      </div>
                      {item.catatan && <p className="text-xs text-slate-400 mt-0.5">{item.catatan}</p>}
                    </div>
                    <button onClick={() => handleToggleStatus(item.id, item.status)}
                      className={`text-xs px-3 py-1 rounded-full font-medium transition-colors cursor-pointer ${
                        item.status === 'Tersedia' ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'
                      }`}>
                      {item.status}
                    </button>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleEdit(item)} className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(item.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900">{editRow ? 'Edit' : 'Tambah'} Alat</h3>
              <button onClick={() => { setShowForm(false); setEditRow(null) }} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nama Alat *</label>
                <input value={form.nama_alat} onChange={e => setForm(f => ({ ...f, nama_alat: e.target.value }))}
                  placeholder="cth: Canon EOS M6 Mark II"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { key: 'kategori', label: 'Kategori', options: KATEGORI },
                  { key: 'kondisi', label: 'Kondisi', options: KONDISI },
                  { key: 'status', label: 'Status', options: STATUS_INV },
                ].map(({ key, label, options }) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
                    <select value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
                      {options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Catatan</label>
                <input value={form.catatan} onChange={e => setForm(f => ({ ...f, catatan: e.target.value }))}
                  placeholder="Kondisi khusus, nomor seri, dll."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex gap-3 justify-end">
              <button onClick={() => { setShowForm(false); setEditRow(null) }} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Batal</button>
              <button onClick={handleSubmit} disabled={submitting}
                className="px-5 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium disabled:opacity-50">
                {submitting ? 'Menyimpan...' : editRow ? 'Simpan' : 'Tambah'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
