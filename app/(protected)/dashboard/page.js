import { createClient } from '@/lib/supabaseServer'
import { Package, AlertCircle, Box, TrendingUp, Clock, Bell } from 'lucide-react'

function calcOverdue(perkiraan_kembali) {
  if (!perkiraan_kembali) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(perkiraan_kembali + 'T00:00:00')
  const diff = Math.floor((today - due) / 86400000)
  return diff
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const today = new Date().toISOString().split('T')[0]
  const tomorrowDate = new Date(); tomorrowDate.setDate(tomorrowDate.getDate() + 1)
  const tomorrow = tomorrowDate.toISOString().split('T')[0]

  const [
    { count: totalPeminjaman },
    { count: aktif },
    { count: pending },
    { data: recentPeminjaman },
    { data: inventarisStat },
    { data: activePeminjaman },
    { data: h1Raw },
  ] = await Promise.all([
    supabase.from('peminjaman').select('*', { count: 'exact', head: true }),
    supabase.from('peminjaman').select('*', { count: 'exact', head: true }).in('status', ['approved', 'active']),
    supabase.from('peminjaman').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('peminjaman').select('*').order('created_at', { ascending: false }).limit(5),
    supabase.from('inventaris').select('status, in_maintenance'),
    supabase.from('peminjaman')
      .select('id, nama_kegiatan, nama_peminjam, jenis_acara, perkiraan_kembali, tanggal')
      .in('status', ['approved', 'active'])
      .not('perkiraan_kembali', 'is', null)
      .order('perkiraan_kembali', { ascending: true }),
    supabase.from('peminjaman')
      .select('id, nama_kegiatan, nama_peminjam, jam_pengembalian, no_telepon, email_peminjam')
      .in('status', ['approved', 'active'])
      .eq('perkiraan_kembali', tomorrow),
  ])

  const tersedia  = inventarisStat?.filter(i => i.status === 'Tersedia' && !i.in_maintenance).length || 0
  const dipinjam  = inventarisStat?.filter(i => i.status === 'Dipinjam').length || 0
  const maint     = inventarisStat?.filter(i => i.in_maintenance).length || 0

  const overdueList   = (activePeminjaman || []).filter(p => (calcOverdue(p.perkiraan_kembali) || 0) > 0)
  const nearDueList   = (activePeminjaman || []).filter(p => {
    const d = calcOverdue(p.perkiraan_kembali)
    return d !== null && d <= 0 && d >= -2
  })
  const overdueCount  = overdueList.length
  const h1List        = h1Raw || []

  const stats = [
    { label: 'Total Peminjaman',   value: totalPeminjaman || 0, icon: Package,      light: 'bg-blue-50 text-blue-600'   },
    { label: 'Sedang Dipinjam',    value: aktif || 0,           icon: TrendingUp,   light: 'bg-amber-50 text-amber-600' },
    { label: 'Menunggu Approval',  value: pending || 0,         icon: AlertCircle,  light: 'bg-red-50 text-red-600'     },
    { label: 'Terlambat Kembali',  value: overdueCount,         icon: Clock,        light: overdueCount > 0 ? 'bg-red-100 text-red-700' : 'bg-green-50 text-green-600' },
    { label: 'Jatuh Tempo Besok',  value: h1List.length,        icon: Bell,         light: h1List.length > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-50 text-slate-400' },
  ]

  const statusColor = {
    pending:  'bg-yellow-100 text-yellow-700',
    approved: 'bg-blue-100 text-blue-700',
    active:   'bg-green-100 text-green-700',
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

      {/* Near-deadline warning banner */}
      {nearDueList.length > 0 && (
        <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-sm font-semibold text-amber-700 mb-1">⚠ Hampir Jatuh Tempo</p>
          <div className="flex flex-wrap gap-2">
            {nearDueList.map(p => {
              const d = calcOverdue(p.perkiraan_kembali)
              const label = d === 0 ? 'Jatuh tempo hari ini!' : `${Math.abs(d)} hari lagi`
              return (
                <span key={p.id} className="text-xs bg-amber-100 text-amber-800 px-2.5 py-1 rounded-lg font-medium">
                  {p.nama_kegiatan} · {p.nama_peminjam} · <strong>{label}</strong>
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* H-1 reminder banner */}
      {h1List.length > 0 && (
        <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="w-4 h-4 text-amber-600" />
            <p className="text-sm font-bold text-amber-800">Pengingat H-1 — {h1List.length} peminjaman jatuh tempo besok ({tomorrow})</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {h1List.map(p => (
              <span key={p.id} className="text-xs bg-amber-100 text-amber-800 px-2.5 py-1 rounded-lg font-medium">
                {p.nama_kegiatan} · {p.nama_peminjam}
                {p.jam_pengembalian ? ` · ${p.jam_pengembalian.slice(0,5)}` : ''}
                {(p.no_telepon || p.email_peminjam) ? ' ✉️' : ' — tidak ada kontak'}
              </span>
            ))}
          </div>
          <p className="text-xs text-amber-600 mt-2">Kirim pengingat via halaman <strong>Peminjaman</strong> → panel H-1.</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, light }) => (
          <div key={label} className={`bg-white rounded-xl p-5 shadow-sm border ${label === 'Terlambat Kembali' && value > 0 ? 'border-red-200' : 'border-slate-100'}`}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-slate-500">{label}</p>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${light}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>
            <p className={`text-3xl font-bold ${label === 'Terlambat Kembali' && value > 0 ? 'text-red-600' : 'text-slate-900'}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
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
            <div className="flex gap-3 mb-5 flex-wrap">
              <div className="flex-1 bg-green-50 rounded-xl p-4 text-center min-w-[70px]">
                <p className="text-2xl font-bold text-green-600">{tersedia}</p>
                <p className="text-xs text-green-700 mt-1 font-medium">Tersedia</p>
              </div>
              <div className="flex-1 bg-red-50 rounded-xl p-4 text-center min-w-[70px]">
                <p className="text-2xl font-bold text-red-500">{dipinjam}</p>
                <p className="text-xs text-red-600 mt-1 font-medium">Dipinjam</p>
              </div>
              {maint > 0 && (
                <div className="flex-1 bg-orange-50 rounded-xl p-4 text-center min-w-[70px]">
                  <p className="text-2xl font-bold text-orange-500">{maint}</p>
                  <p className="text-xs text-orange-600 mt-1 font-medium">Maintenance</p>
                </div>
              )}
              <div className="flex-1 bg-slate-50 rounded-xl p-4 text-center min-w-[70px]">
                <p className="text-2xl font-bold text-slate-600">{inventarisStat?.length || 0}</p>
                <p className="text-xs text-slate-500 mt-1 font-medium">Total</p>
              </div>
            </div>
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

      {/* Overdue list */}
      {overdueList.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-red-200">
          <div className="px-5 py-4 border-b border-red-100 flex items-center gap-2">
            <Clock className="w-4 h-4 text-red-500" />
            <h2 className="font-semibold text-red-700">Peminjaman Terlambat ({overdueList.length})</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {overdueList.map(p => {
              const days = calcOverdue(p.perkiraan_kembali)
              return (
                <div key={p.id} className="px-5 py-3.5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{p.nama_kegiatan}</p>
                    <p className="text-xs text-slate-400">{p.nama_peminjam} · Est. kembali: {p.perkiraan_kembali}</p>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-700 whitespace-nowrap">
                    🔴 {days} hari terlambat
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
