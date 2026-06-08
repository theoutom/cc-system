'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { ChevronLeft, ChevronRight, X, CalendarDays } from 'lucide-react'

const STATUS_COLOR = {
  pending:  { bg: 'bg-amber-400',  text: 'text-white', label: 'Menunggu' },
  approved: { bg: 'bg-blue-500',   text: 'text-white', label: 'Disetujui' },
  active:   { bg: 'bg-green-500',  text: 'text-white', label: 'Aktif' },
  returned: { bg: 'bg-slate-400',  text: 'text-white', label: 'Kembali' },
  rejected: { bg: 'bg-red-400',    text: 'text-white', label: 'Ditolak' },
}

const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']

function parseDate(str) {
  if (!str) return null
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function toYMD(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}

export default function KalenderPage() {
  const supabase = createClient()
  const today = new Date()

  const [year, setYear]   = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [data, setData]   = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [filterStatus, setFilterStatus] = useState('Semua')

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      const { data: rows } = await supabase
        .from('peminjaman')
        .select('id, nama_kegiatan, nama_peminjam, jenis_acara, status, tanggal, perkiraan_kembali, jam_peminjaman, jam_pengembalian, detail_barang, token')
        .not('status', 'eq', 'rejected')
        .order('tanggal', { ascending: true })
      setData(rows || [])
      setLoading(false)
    }
    fetch()
  }, [])

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  // Build calendar grid: 6 weeks
  const gridDays = useMemo(() => {
    const first = new Date(year, month, 1)
    const startDow = first.getDay()
    const days = []
    for (let i = 0; i < 42; i++) {
      const d = new Date(year, month, 1 - startDow + i)
      days.push(d)
    }
    return days
  }, [year, month])

  // Map each peminjaman to a set of date strings it spans
  const eventsByDate = useMemo(() => {
    const map = {}
    const filtered = filterStatus === 'Semua' ? data : data.filter(d => d.status === filterStatus)
    filtered.forEach(row => {
      const start = parseDate(row.tanggal)
      const end   = parseDate(row.perkiraan_kembali) || start
      if (!start) return
      const cur = new Date(start)
      while (cur <= end) {
        const key = toYMD(cur)
        if (!map[key]) map[key] = []
        map[key].push(row)
        cur.setDate(cur.getDate() + 1)
      }
    })
    return map
  }, [data, filterStatus])

  const todayYMD = toYMD(today)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Kalender Peminjaman</h1>
        <p className="text-slate-500 text-sm mt-0.5">Jadwal peminjaman alat dalam tampilan kalender</p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {/* Month nav */}
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
          <button onClick={prevMonth} className="p-1 rounded-lg hover:bg-slate-100 transition-colors">
            <ChevronLeft className="w-4 h-4 text-slate-600" />
          </button>
          <span className="text-sm font-bold text-slate-800 w-36 text-center">
            {MONTHS[month]} {year}
          </span>
          <button onClick={nextMonth} className="p-1 rounded-lg hover:bg-slate-100 transition-colors">
            <ChevronRight className="w-4 h-4 text-slate-600" />
          </button>
        </div>

        {/* Today button */}
        <button onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()) }}
          className="text-sm font-medium px-3 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm transition-colors text-slate-600">
          Hari Ini
        </button>

        {/* Status filter */}
        <div className="flex gap-1.5 ml-auto flex-wrap">
          {['Semua', 'pending', 'approved', 'active', 'returned'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                filterStatus === s
                  ? s === 'Semua'
                    ? 'bg-slate-800 text-white border-slate-800'
                    : `${STATUS_COLOR[s]?.bg} ${STATUS_COLOR[s]?.text} border-transparent`
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
              }`}>
              {s === 'Semua' ? 'Semua' : STATUS_COLOR[s]?.label}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-4">
        {['pending','approved','active','returned'].map(s => (
          <div key={s} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className={`w-3 h-3 rounded-sm ${STATUS_COLOR[s].bg}`} />
            {STATUS_COLOR[s].label}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-slate-100">
          {DAYS.map(d => (
            <div key={d} className={`py-2 text-center text-xs font-bold ${d === 'Min' ? 'text-red-400' : 'text-slate-400'}`}>
              {d}
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-7">
            {gridDays.map((date, i) => {
              const ymd     = toYMD(date)
              const isThisMonth = date.getMonth() === month
              const isToday = ymd === todayYMD
              const events  = eventsByDate[ymd] || []
              const isSun   = date.getDay() === 0

              return (
                <div key={i}
                  className={`min-h-[90px] border-b border-r border-slate-50 p-1.5 ${
                    !isThisMonth ? 'bg-slate-50/50' : ''
                  }`}
                >
                  {/* Date number */}
                  <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold mb-1 ${
                    isToday
                      ? 'bg-purple-600 text-white'
                      : isSun
                        ? isThisMonth ? 'text-red-400' : 'text-red-200'
                        : isThisMonth ? 'text-slate-700' : 'text-slate-300'
                  }`}>
                    {date.getDate()}
                  </div>

                  {/* Events */}
                  <div className="space-y-0.5">
                    {events.slice(0, 3).map((ev, j) => {
                      const c = STATUS_COLOR[ev.status]
                      return (
                        <button key={j} onClick={() => setSelected(ev)}
                          className={`w-full text-left text-xs px-1.5 py-0.5 rounded font-medium truncate leading-tight ${c.bg} ${c.text} hover:opacity-80 transition-opacity`}>
                          {ev.nama_kegiatan}
                        </button>
                      )
                    })}
                    {events.length > 3 && (
                      <p className="text-xs text-slate-400 px-1">+{events.length - 3} lagi</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100">
              <div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLOR[selected.status]?.bg} ${STATUS_COLOR[selected.status]?.text} mb-1 inline-block`}>
                  {STATUS_COLOR[selected.status]?.label}
                </span>
                <h3 className="font-bold text-slate-900 text-base leading-tight">{selected.nama_kegiatan}</h3>
              </div>
              <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg hover:bg-slate-100 ml-3">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-2.5 text-sm">
              {[
                ['Peminjam', selected.nama_peminjam],
                ['Jenis', selected.jenis_acara],
                ['Tanggal', `${selected.tanggal}${selected.jam_peminjaman ? ' · ' + selected.jam_peminjaman.slice(0,5) : ''}`],
                ['Kembali', selected.perkiraan_kembali
                  ? `${selected.perkiraan_kembali}${selected.jam_pengembalian ? ' · ' + selected.jam_pengembalian.slice(0,5) : ''}`
                  : 'Tidak ditentukan'],
                ...(selected.token ? [['Token', selected.token]] : []),
              ].map(([k, v]) => (
                <div key={k} className="flex gap-3">
                  <span className="text-slate-400 w-20 flex-shrink-0 text-xs pt-0.5">{k}</span>
                  <span className={`text-slate-800 font-medium text-xs ${k === 'Token' ? 'font-mono tracking-widest bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-lg' : ''}`}>{v}</span>
                </div>
              ))}
              <div>
                <span className="text-slate-400 text-xs block mb-1">Alat</span>
                <p className="text-slate-700 text-xs leading-relaxed bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                  {selected.detail_barang?.split('\n').filter(l => !l.startsWith('Catatan')).join(', ') || '-'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
