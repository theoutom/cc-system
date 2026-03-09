'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Eye, Search, AlertCircle, CheckCircle, Clock } from 'lucide-react'

export default function PemantauanPage() {
  const supabase = createClient()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('belum_kembali')

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    const { data: pem } = await supabase
      .from('peminjaman')
      .select('*, pengembalian(*)')
      .order('created_at', { ascending: false })
    setData(pem || [])
    setLoading(false)
  }

  const belumKembali = data.filter(d => ['approved', 'active', 'pending'].includes(d.status))
  const sudahKembali = data.filter(d => d.status === 'returned')

  const filterData = (arr) => arr.filter(d =>
    d.nama_kegiatan?.toLowerCase().includes(search.toLowerCase()) ||
    d.nama_peminjam?.toLowerCase().includes(search.toLowerCase()) ||
    d.jenis_acara?.toLowerCase().includes(search.toLowerCase())
  )

  const jenisColor = {
    Sekolah: 'bg-blue-50 text-blue-600',
    Organisasi: 'bg-orange-50 text-orange-600',
    Eksternal: 'bg-purple-50 text-purple-600',
  }

  const displayed = filterData(tab === 'belum_kembali' ? belumKembali : sudahKembali)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Pemantauan</h1>
        <p className="text-slate-500 text-sm mt-0.5">Monitor status peminjaman dan pengembalian alat</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-amber-600" />
            <p className="text-sm font-medium text-amber-800">Belum Kembali</p>
          </div>
          <p className="text-3xl font-bold text-amber-700">{belumKembali.length}</p>
        </div>
        <div className="bg-green-50 border border-green-100 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <p className="text-sm font-medium text-green-800">Sudah Kembali</p>
          </div>
          <p className="text-3xl font-bold text-green-700">{sudahKembali.length}</p>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Eye className="w-4 h-4 text-slate-600" />
            <p className="text-sm font-medium text-slate-700">Total</p>
          </div>
          <p className="text-3xl font-bold text-slate-700">{data.length}</p>
        </div>
      </div>

      {/* By category */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {['Sekolah', 'Organisasi', 'Eksternal'].map(j => {
          const total = data.filter(d => d.jenis_acara === j).length
          const aktif = data.filter(d => d.jenis_acara === j && ['approved', 'active', 'pending'].includes(d.status)).length
          return (
            <div key={j} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${jenisColor[j]}`}>{j}</span>
              <div className="mt-3 flex gap-3 text-sm">
                <div><p className="text-xl font-bold text-slate-800">{aktif}</p><p className="text-xs text-slate-400">Aktif</p></div>
                <div><p className="text-xl font-bold text-slate-400">{total}</p><p className="text-xs text-slate-400">Total</p></div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center gap-3">
          {/* Tabs */}
          <div className="flex bg-slate-100 rounded-lg p-1">
            <button onClick={() => setTab('belum_kembali')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${tab === 'belum_kembali' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
              Belum Kembali ({belumKembali.length})
            </button>
            <button onClick={() => setTab('sudah_kembali')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${tab === 'sudah_kembali' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
              Sudah Kembali ({sudahKembali.length})
            </button>
          </div>

          {/* Search */}
          <div className="relative ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Cari kegiatan, peminjam..."
              className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 w-64"
            />
          </div>
        </div>

        {loading ? (
          <p className="text-center py-10 text-slate-400 text-sm">Memuat...</p>
        ) : displayed.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Eye className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Tidak ada data</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Kegiatan</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Peminjam</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Tgl Pinjam</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Jenis</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                  {tab === 'sudah_kembali' && <th className="text-left px-4 py-3 font-medium text-slate-600">Tgl Kembali</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {displayed.map(row => (
                  <tr key={row.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{row.nama_kegiatan}</p>
                      <p className="text-xs text-slate-400 line-clamp-1">{row.detail_barang}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{row.nama_peminjam}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{row.tanggal}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${jenisColor[row.jenis_acara]}`}>
                        {row.jenis_acara}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {tab === 'belum_kembali' ? (
                        <span className="flex items-center gap-1 text-amber-600 text-xs font-medium">
                          <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                          Sedang Dipinjam
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Dikembalikan
                        </span>
                      )}
                    </td>
                    {tab === 'sudah_kembali' && (
                      <td className="px-4 py-3 text-slate-600 text-xs">
                        {row.pengembalian?.[0]?.tanggal_pengembalian || '-'}
                        {row.pengembalian?.[0]?.jam_pengembalian ? ` · ${row.pengembalian[0].jam_pengembalian}` : ''}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
