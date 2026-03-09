import { createClient } from '@/lib/supabaseServer'
import { Package, RotateCcw, AlertCircle, Calendar, Box, TrendingUp } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = createClient()

  const [
    { count: totalPeminjaman },
    { count: aktif },
    { count: pending },
    { data: recentPeminjaman },
    { data: inventarisStat },
  ] = await Promise.all([
    supabase.from('peminjaman').select('*', { count: 'exact', head: true }),
    supabase.from('peminjaman').select('*', { count: 'exact', head: true }).in('status', ['approved', 'active']),
    supabase.from('peminjaman').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('peminjaman').select('*').order('created_at', { ascending: false }).limit(5),
    supabase.from('inventaris').select('status'),
  ])

  const tersedia = inventarisStat?.filter(i => i.status === 'Tersedia').length || 0
  const dipinjam = inventarisStat?.filter(i => i.status === 'Dipinjam').length || 0

  const stats = [
    { label: 'Total Peminjaman', value: totalPeminjaman || 0, icon: Package, color: 'bg-blue-500', light: 'bg-blue-50 text-blue-600' },
    { label: 'Sedang Dipinjam', value: aktif || 0, icon: TrendingUp, color: 'bg-amber-500', light: 'bg-amber-50 text-amber-600' },
    { label: 'Menunggu Approval', value: pending || 0, icon: AlertCircle, color: 'bg-red-500', light: 'bg-red-50 text-red-600' },
    { label: 'Alat Tersedia', value: tersedia, icon: Box, color: 'bg-green-500', light: 'bg-green-50 text-green-600' },
  ]

  const statusColor = {
    pending: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-blue-100 text-blue-700',
    active: 'bg-green-100 text-green-700',
    returned: 'bg-slate-100 text-slate-600',
    rejected: 'bg-red-100 text-red-700',
  }
  const statusLabel = {
    pending: 'Menunggu', approved: 'Disetujui', active: 'Aktif',
    returned: 'Dikembalikan', rejected: 'Ditolak',
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">Selamat datang di Sistem Creative Corner</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, light }) => (
          <div key={label} className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-slate-500">{label}</p>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${light}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Peminjaman */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Peminjaman Terbaru</h2>
            <Package className="w-4 h-4 text-slate-400" />
          </div>
          <div className="divide-y divide-slate-50">
            {recentPeminjaman?.length === 0 && (
              <p className="text-slate-400 text-sm text-center py-8">Belum ada data</p>
            )}
            {recentPeminjaman?.map(p => (
              <div key={p.id} className="px-5 py-3.5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-800">{p.nama_kegiatan}</p>
                  <p className="text-xs text-slate-400">{p.nama_peminjam} · {p.jenis_acara}</p>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor[p.status]}`}>
                  {statusLabel[p.status]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Inventaris status */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Status Inventaris</h2>
            <Box className="w-4 h-4 text-slate-400" />
          </div>
          <div className="p-5">
            <div className="flex gap-4 mb-5">
              <div className="flex-1 bg-green-50 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-green-600">{tersedia}</p>
                <p className="text-xs text-green-700 mt-1 font-medium">Tersedia</p>
              </div>
              <div className="flex-1 bg-red-50 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-red-500">{dipinjam}</p>
                <p className="text-xs text-red-600 mt-1 font-medium">Dipinjam</p>
              </div>
              <div className="flex-1 bg-slate-50 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-slate-600">{(inventarisStat?.length || 0)}</p>
                <p className="text-xs text-slate-500 mt-1 font-medium">Total Alat</p>
              </div>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-slate-100 rounded-full h-2.5">
              <div
                className="bg-green-500 h-2.5 rounded-full transition-all"
                style={{ width: `${inventarisStat?.length ? (tersedia / inventarisStat.length) * 100 : 0}%` }}
              />
            </div>
            <p className="text-xs text-slate-400 mt-2 text-right">
              {inventarisStat?.length ? Math.round((tersedia / inventarisStat.length) * 100) : 0}% alat tersedia
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
