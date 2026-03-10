'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import {
  Calendar, Plus, X, Edit2, Trash2, Filter,
  Download, ChevronLeft, ChevronRight, Clock,
  Camera, TableIcon, Star
} from 'lucide-react'
import { differenceInDays, parseISO, format, startOfMonth, endOfMonth,
         eachDayOfInterval, isSameDay, addMonths, subMonths } from 'date-fns'
import { id as localeId } from 'date-fns/locale'

const TABS = [
  { key: 'feed',        label: 'Feed & Ucapan', table: 'jadwal_feed' },
  { key: 'aftermovie',  label: 'Aftermovie',    table: 'jadwal_aftermovie' },
  { key: 'dokumentasi', label: 'Dokumentasi',   table: 'jadwal_dokumentasi' },
  { key: 'thumbnail',   label: 'Thumbnail',     table: 'jadwal_thumbnail' },
]

const ANGGOTA = ['Lionel', 'Ubai', 'Nana', 'Vania', 'Satrio', 'Miko', 'Ino']
const STATUS_OPTIONS = ['Belum Dibuat', 'Proses', 'Selesai']

const DOKT_ROLES = [
  { key: 'cam1_operator',        label: 'Cam 1',       icon: '📷' },
  { key: 'cam2_operator',        label: 'Cam 2',       icon: '📷' },
  { key: 'cam_video_operator',   label: 'Cam Video',   icon: '🎬' },
  { key: 'live_report_operator', label: 'Live Report', icon: '📡' },
]

const MONTHS_ID = ['Januari','Februari','Maret','April','Mei','Juni',
                   'Juli','Agustus','September','Oktober','November','Desember']

function dlStyle(deadline, status) {
  if (status === 'Selesai') return { bg: 'bg-slate-100', text: 'text-slate-500', label: 'Selesai' }
  if (!deadline) return { bg: 'bg-gray-50', text: 'text-gray-400', label: '—' }
  const days = differenceInDays(parseISO(deadline), new Date())
  if (days < 0)   return { bg: 'bg-gray-200',   text: 'text-gray-600',   label: `${Math.abs(days)}h lalu`, row: 'opacity-60' }
  if (days === 0) return { bg: 'bg-green-500',  text: 'text-white',      label: 'Hari ini!',  row: 'bg-green-50' }
  if (days <= 3)  return { bg: 'bg-red-500',    text: 'text-white',      label: `${days}h lagi`, row: 'bg-red-50' }
  if (days <= 7)  return { bg: 'bg-orange-500', text: 'text-white',      label: `${days}h lagi`, row: 'bg-orange-50' }
  if (days <= 14) return { bg: 'bg-yellow-400', text: 'text-yellow-900', label: `${days}h lagi` }
  return { bg: 'bg-slate-100', text: 'text-slate-600', label: `${days}h lagi` }
}

function fmt(d) {
  if (!d) return '—'
  try { return format(parseISO(d), 'd MMM yyyy', { locale: localeId }) } catch { return d }
}

function fmtTime(t) { return t ? t.slice(0,5) : '—' }

// Dropdown + manual input
function RoleInput({ label, icon, value, onChange }) {
  const isManual = value && !ANGGOTA.includes(value)
  const [mode, setMode] = useState(isManual ? 'manual' : 'drop')
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">{icon} {label}</label>
      <div className="flex gap-1">
        <select
          value={mode === 'manual' ? '__m__' : (value || '')}
          onChange={e => {
            if (e.target.value === '__m__') { setMode('manual'); onChange('') }
            else { setMode('drop'); onChange(e.target.value) }
          }}
          className={`px-2 py-2 border border-slate-200 rounded-lg text-sm
            focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white
            ${mode === 'manual' ? 'w-[120px] flex-none' : 'flex-1'}`}
        >
          <option value="">— Pilih —</option>
          {ANGGOTA.map(a => <option key={a} value={a}>{a}</option>)}
          <option value="__m__">✏️ Manual...</option>
        </select>
        {mode === 'manual' && (
          <input type="text" value={value} onChange={e => onChange(e.target.value)}
            placeholder="Nama..."
            className="flex-1 px-2 py-2 border border-purple-300 rounded-lg text-sm
              focus:outline-none focus:ring-2 focus:ring-purple-400" />
        )}
      </div>
    </div>
  )
}

function NameBadge({ name, myName }) {
  if (!name) return <span className="text-slate-300 text-xs">—</span>
  const isMe = myName && name.toLowerCase() === myName.toLowerCase()
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
      ${isMe ? 'bg-purple-100 text-purple-700 ring-1 ring-purple-300' : 'bg-slate-100 text-slate-600'}`}>
      {isMe && <Star className="w-2.5 h-2.5 fill-purple-500 text-purple-500" />}
      {name}
    </span>
  )
}

function defaultForm() {
  return {
    tanggal:'', deadline:'', status:'Belum Dibuat', catatan:'',
    keterangan:'', pembuat:'', link_asset:'',
    nama_kegiatan:'', waktu_kegiatan:'',
    cam1_operator:'', cam2_operator:'',
    cam_video_operator:'', live_report_operator:'',
  }
}

export default function JadwalPage() {
  const supabase = createClient()
  const [activeTab, setActiveTab]   = useState('feed')
  const [data, setData]             = useState({})
  const [loading, setLoading]       = useState(true)
  const [profile, setProfile]       = useState(null)
  const [showForm, setShowForm]     = useState(false)
  const [editRow, setEditRow]       = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm]             = useState(defaultForm())
  const [viewMode, setViewMode]     = useState('table')
  const [filterBulan, setFilterBulan] = useState('')
  const [calMonth, setCalMonth]     = useState(new Date())
  const [peminjamanByJadwal, setPeminjamanByJadwal] = useState({})

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: p } = await supabase.from('profiles').select('nama,role').eq('id', user.id).single()
        setProfile(p)
      }
      await fetchAll()
    }
    init()
  }, [])

  const fetchAll = async () => {
    setLoading(true)
    const results = {}
    await Promise.all(TABS.map(async t => {
      const { data: rows } = await supabase.from(t.table).select('*').order('tanggal', { ascending: true })
      results[t.key] = rows || []
    }))
    setData(results)

    // Fetch relasi peminjaman → jadwal
    const { data: linked } = await supabase
      .from('peminjaman')
      .select('jadwal_id, status, nama_peminjam')
      .not('jadwal_id', 'is', null)
    if (linked) {
      const map = {}
      linked.forEach(p => {
        if (!map[p.jadwal_id]) map[p.jadwal_id] = []
        map[p.jadwal_id].push(p)
      })
      setPeminjamanByJadwal(map)
    }

    setLoading(false)
  }

  const isAdmin    = profile?.role === 'admin'
  const myName     = profile?.nama || ''
  const currentTab = TABS.find(t => t.key === activeTab)
  const allRows    = data[activeTab] || []

  const rows = activeTab === 'dokumentasi' && filterBulan
    ? allRows.filter(r => r.tanggal?.startsWith(filterBulan))
    : allRows

  // Jadwal terdekat dimana user bertugas
  const myUpcoming = (data['dokumentasi'] || []).filter(r => {
    if (!myName) return false
    const as = [r.cam1_operator, r.cam2_operator, r.cam_video_operator, r.live_report_operator]
    if (!as.some(a => a && a.toLowerCase() === myName.toLowerCase())) return false
    return !r.tanggal || differenceInDays(parseISO(r.tanggal), new Date()) >= 0
  }).slice(0, 3)

  const handleSubmit = async () => {
    const isD = activeTab === 'dokumentasi'
    if (isD && !form.nama_kegiatan) { alert('Nama kegiatan wajib diisi!'); return }
    if (!isD && !form.keterangan)   { alert('Keterangan wajib diisi!'); return }
    setSubmitting(true)

    const payload = isD ? {
      nama_kegiatan:        form.nama_kegiatan,
      keterangan:           form.nama_kegiatan,   // backward compat — kolom lama
      tanggal:              form.tanggal || null,
      waktu_kegiatan:       form.waktu_kegiatan || null,
      cam1_operator:        form.cam1_operator || null,
      cam2_operator:        form.cam2_operator || null,
      cam_video_operator:   form.cam_video_operator || null,
      live_report_operator: form.live_report_operator || null,
      catatan:              form.catatan || null,
      status:               'Belum Dibuat',
    } : {
      keterangan: form.keterangan,
      tanggal:    form.tanggal || null,
      deadline:   form.deadline || null,
      pembuat:    form.pembuat || null,
      status:     form.status,
      catatan:    form.catatan || null,
      ...(activeTab === 'feed' ? { link_asset: form.link_asset || null } : {}),
    }

    if (editRow) {
      await supabase.from(currentTab.table).update(payload).eq('id', editRow.id)
    } else {
      const maxNo = allRows.length > 0 ? Math.max(...allRows.map(r => r.no || 0)) : 0
      await supabase.from(currentTab.table).insert({ ...payload, no: maxNo + 1 })
    }

    setForm(defaultForm()); setShowForm(false); setEditRow(null); setSubmitting(false)
    fetchAll()
  }

  const handleEdit = (row) => {
    setEditRow(row)
    setForm({
      tanggal:              row.tanggal || '',
      deadline:             row.deadline || '',
      status:               row.status || 'Belum Dibuat',
      catatan:              row.catatan || '',
      keterangan:           row.keterangan || '',
      pembuat:              row.pembuat || '',
      link_asset:           row.link_asset || '',
      nama_kegiatan:        row.nama_kegiatan || '',
      waktu_kegiatan:       row.waktu_kegiatan || '',
      cam1_operator:        row.cam1_operator || '',
      cam2_operator:        row.cam2_operator || '',
      cam_video_operator:   row.cam_video_operator || '',
      live_report_operator: row.live_report_operator || '',
    })
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Hapus jadwal ini?')) return
    await supabase.from(currentTab.table).delete().eq('id', id)
    fetchAll()
  }

  // Kalender
  const calDays  = eachDayOfInterval({ start: startOfMonth(calMonth), end: endOfMonth(calMonth) })
  const firstDow = startOfMonth(calMonth).getDay()
  const doktRows = data['dokumentasi'] || []
  const getForDay = (day) => doktRows.filter(r => r.tanggal && isSameDay(parseISO(r.tanggal), day))

  const statusStyle = { 'Selesai':'bg-green-100 text-green-700', 'Proses':'bg-blue-100 text-blue-700', 'Belum Dibuat':'bg-slate-100 text-slate-600' }

  return (
    <div>
      <style>{`@media print{.no-print{display:none!important}.print-only{display:block!important}}`}</style>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Jadwal Konten</h1>
        <p className="text-slate-500 text-sm mt-0.5">Kelola jadwal konten Creative Corner</p>
      </div>

      {/* Banner jadwal terdekat */}
      {activeTab === 'dokumentasi' && myName && myUpcoming.length > 0 && (
        <div className="mb-5 p-4 bg-purple-50 border border-purple-200 rounded-xl no-print">
          <p className="text-sm font-semibold text-purple-700 mb-2 flex items-center gap-1.5">
            <Star className="w-4 h-4 fill-purple-500" />
            Jadwal Terdekatmu — {myName}
          </p>
          <div className="flex flex-wrap gap-2">
            {myUpcoming.map(r => (
              <div key={r.id} className="bg-white border border-purple-200 rounded-lg px-3 py-2 text-xs shadow-sm">
                <p className="font-semibold text-slate-800">{r.nama_kegiatan || '—'}</p>
                <p className="text-slate-500 mt-0.5">📅 {fmt(r.tanggal)}{r.waktu_kegiatan && <> · 🕐 {fmtTime(r.waktu_kegiatan)}</>}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {DOKT_ROLES.map(role =>
                    r[role.key]?.toLowerCase() === myName.toLowerCase()
                      ? <span key={role.key} className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium">{role.icon} {role.label}</span>
                      : null
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-xl w-fit no-print">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${activeTab === t.key ? 'bg-white shadow text-purple-700' : 'text-slate-500 hover:text-slate-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3 no-print">
        <div className="flex items-center gap-2 flex-wrap">
          {activeTab === 'dokumentasi' && (
            <>
              <div className="flex items-center gap-1.5">
                <Filter className="w-4 h-4 text-slate-400" />
                <select value={filterBulan} onChange={e => setFilterBulan(e.target.value)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
                  <option value="">Semua Bulan</option>
                  {Array.from({length:12},(_,i) => {
                    const m = String(i+1).padStart(2,'0')
                    const y = new Date().getFullYear()
                    return <option key={m} value={`${y}-${m}`}>{MONTHS_ID[i]} {y}</option>
                  })}
                </select>
              </div>

              <div className="flex bg-slate-100 rounded-lg p-0.5">
                {[{v:'table',icon:<TableIcon className="w-3.5 h-3.5"/>,l:'Tabel'},{v:'calendar',icon:<Calendar className="w-3.5 h-3.5"/>,l:'Kalender'}].map(({v,icon,l}) => (
                  <button key={v} onClick={() => setViewMode(v)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all
                      ${viewMode===v ? 'bg-white shadow text-purple-700' : 'text-slate-500'}`}>
                    {icon} {l}
                  </button>
                ))}
              </div>

              <button onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50">
                <Download className="w-3.5 h-3.5" /> Export / Print
              </button>
            </>
          )}
        </div>

        {isAdmin && (
          <button onClick={() => { setForm(defaultForm()); setEditRow(null); setShowForm(true) }}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700 transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Tambah Jadwal
          </button>
        )}
      </div>

      {/* ── CONTENT ── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : activeTab !== 'dokumentasi' ? (

        /* Tab lain */
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
          {rows.length === 0 ? (
            <div className="p-16 text-center">
              <Calendar className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 font-medium">Belum ada jadwal</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 w-8">#</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Keterangan</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Tanggal</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Deadline</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Pembuat</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
                    {isAdmin && <th className="px-4 py-3 w-20"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {rows.map((row, idx) => {
                    const d = dlStyle(row.deadline, row.status)
                    const isMe = myName && row.pembuat?.toLowerCase() === myName.toLowerCase()
                    return (
                      <tr key={row.id} className={`hover:bg-slate-50 transition-colors ${isMe?'bg-purple-50/40':''} ${d.row||''}`}>
                        <td className="px-4 py-3 text-slate-400 text-xs">{idx+1}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-800">{row.keterangan}</p>
                          {row.catatan && <p className="text-slate-400 text-xs mt-0.5">{row.catatan}</p>}
                          {activeTab==='feed' && row.link_asset && (
                            <a href={row.link_asset} target="_blank" rel="noreferrer" className="text-purple-500 text-xs hover:underline">🔗 Lihat asset</a>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{fmt(row.tanggal)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${d.bg} ${d.text}`}>{d.label}</span>
                        </td>
                        <td className="px-4 py-3"><NameBadge name={row.pembuat} myName={myName} /></td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusStyle[row.status]||'bg-slate-100 text-slate-600'}`}>{row.status}</span>
                        </td>
                        {isAdmin && (
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleEdit(row)} className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded"><Edit2 className="w-3.5 h-3.5"/></button>
                              <button onClick={() => handleDelete(row.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5"/></button>
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      ) : viewMode === 'calendar' ? (

        /* Kalender Dokumentasi */
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 no-print">
            <button onClick={() => setCalMonth(m => subMonths(m,1))} className="p-2 hover:bg-slate-100 rounded-lg"><ChevronLeft className="w-4 h-4 text-slate-600"/></button>
            <h3 className="font-semibold text-slate-800">{format(calMonth,'MMMM yyyy',{locale:localeId})}</h3>
            <button onClick={() => setCalMonth(m => addMonths(m,1))} className="p-2 hover:bg-slate-100 rounded-lg"><ChevronRight className="w-4 h-4 text-slate-600"/></button>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-7 mb-2">
              {['Min','Sen','Sel','Rab','Kam','Jum','Sab'].map(d => (
                <div key={d} className="text-center text-xs font-semibold text-slate-400 py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({length:firstDow}).map((_,i) => <div key={`e${i}`} className="aspect-square"/>)}
              {calDays.map(day => {
                const events = getForDay(day)
                const hasMine = myName && events.some(e => [e.cam1_operator,e.cam2_operator,e.cam_video_operator,e.live_report_operator].some(a => a?.toLowerCase()===myName.toLowerCase()))
                const isToday = isSameDay(day, new Date())
                return (
                  <div key={day.toISOString()}
                    className={`aspect-square rounded-xl p-1 flex flex-col overflow-hidden
                      ${isToday ? 'bg-purple-600 text-white' : hasMine ? 'bg-purple-50 ring-1 ring-purple-300' : 'hover:bg-slate-50'}`}>
                    <span className={`text-xs font-semibold leading-none mb-1 ${isToday?'text-white':'text-slate-700'}`}>
                      {format(day,'d')}
                    </span>
                    {events.slice(0,2).map(e => (
                      <div key={e.id} title={e.nama_kegiatan||e.keterangan}
                        className={`text-[9px] leading-tight px-1 py-0.5 rounded truncate font-medium
                          ${isToday?'bg-white/20 text-white':hasMine?'bg-purple-200 text-purple-800':'bg-slate-100 text-slate-600'}`}>
                        {e.nama_kegiatan||e.keterangan}
                      </div>
                    ))}
                    {events.length>2 && <span className="text-[9px] text-slate-400 pl-1">+{events.length-2}</span>}
                  </div>
                )
              })}
            </div>
          </div>
          <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex flex-wrap gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-purple-600 inline-block"/> Hari ini</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-purple-50 ring-1 ring-purple-300 inline-block"/> Tugasmu</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-100 inline-block"/> Kegiatan lain</span>
          </div>
        </div>

      ) : (

        /* Tabel Dokumentasi */
        <div>
          {rows.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center">
              <Camera className="w-10 h-10 text-slate-200 mx-auto mb-3"/>
              <p className="text-slate-400 font-medium">Belum ada jadwal dokumentasi</p>
              {isAdmin && <p className="text-slate-300 text-sm mt-1">Klik + Tambah Jadwal untuk mulai</p>}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[780px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 w-8">#</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600">Nama Kegiatan</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 w-28">Tanggal</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 w-20">Waktu</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600">📷 Cam 1</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600">📷 Cam 2</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600">🎬 Video</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600">📡 Live</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600">🔗 Peminjaman</th>
                      {isAdmin && <th className="px-4 py-3 w-20 no-print"></th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {rows.map((row, idx) => {
                      const as = [row.cam1_operator,row.cam2_operator,row.cam_video_operator,row.live_report_operator]
                      const isMine = myName && as.some(a => a?.toLowerCase()===myName.toLowerCase())
                      return (
                        <tr key={row.id}
                          className={`hover:bg-slate-50 transition-colors ${isMine?'bg-purple-50/60 hover:bg-purple-50':''}`}>
                          <td className="px-4 py-3 text-slate-400 text-xs">{idx+1}</td>
                          <td className="px-4 py-3">
                            <p className={`font-semibold ${isMine?'text-purple-800':'text-slate-800'}`}>
                              {isMine && <Star className="w-3 h-3 fill-purple-500 text-purple-500 inline mr-1 mb-0.5"/>}
                              {row.nama_kegiatan || row.keterangan || '—'}
                            </p>
                            {row.catatan && <p className="text-slate-400 text-xs mt-0.5 truncate max-w-[200px]">{row.catatan}</p>}
                          </td>
                          <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{fmt(row.tanggal)}</td>
                          <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                            <span className="flex items-center gap-1">
                              {row.waktu_kegiatan && <Clock className="w-3 h-3 text-slate-400"/>}
                              {fmtTime(row.waktu_kegiatan)}
                            </span>
                          </td>
                          <td className="px-4 py-3"><NameBadge name={row.cam1_operator} myName={myName}/></td>
                          <td className="px-4 py-3"><NameBadge name={row.cam2_operator} myName={myName}/></td>
                          <td className="px-4 py-3"><NameBadge name={row.cam_video_operator} myName={myName}/></td>
                          <td className="px-4 py-3"><NameBadge name={row.live_report_operator} myName={myName}/></td>
                          <td className="px-4 py-3">
                            {(peminjamanByJadwal[row.id] || []).length > 0 ? (
                              <div className="flex flex-col gap-1">
                                {(peminjamanByJadwal[row.id] || []).map((p, i) => {
                                  const colors = {
                                    pending:  'bg-amber-100 text-amber-700',
                                    approved: 'bg-blue-100 text-blue-700',
                                    active:   'bg-green-100 text-green-700',
                                    returned: 'bg-slate-100 text-slate-500',
                                    rejected: 'bg-red-100 text-red-600',
                                  }
                                  const labels = { pending:'Menunggu', approved:'Disetujui', active:'Aktif', returned:'Selesai', rejected:'Ditolak' }
                                  return (
                                    <span key={i} className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${colors[p.status] || 'bg-slate-100 text-slate-600'}`}>
                                      📋 {labels[p.status] || p.status}
                                    </span>
                                  )
                                })}
                              </div>
                            ) : (
                              <span className="text-slate-300 text-xs">—</span>
                            )}
                          </td>
                          {isAdmin && (
                            <td className="px-4 py-3 no-print">
                              <div className="flex items-center gap-1">
                                <button onClick={() => handleEdit(row)} className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded"><Edit2 className="w-3.5 h-3.5"/></button>
                                <button onClick={() => handleDelete(row.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5"/></button>
                              </div>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {myName && (
                <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex items-center gap-2">
                  <Star className="w-3.5 h-3.5 fill-purple-500 text-purple-500"/>
                  <span className="text-xs text-slate-500">
                    Baris di-highlight = jadwal dimana <strong>{myName}</strong> bertugas
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── FORM MODAL ── */}
      {showForm && isAdmin && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h3 className="font-semibold text-slate-900">
                {editRow?'Edit':'Tambah'} Jadwal — <span className="text-purple-600">{currentTab.label}</span>
              </h3>
              <button onClick={() => { setShowForm(false); setEditRow(null) }} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5"/>
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {activeTab === 'dokumentasi' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nama Kegiatan <span className="text-red-500">*</span></label>
                    <input value={form.nama_kegiatan} onChange={e => setForm(f => ({...f, nama_kegiatan: e.target.value}))}
                      placeholder="cth: Pelantikan OSIS 2024"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"/>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Kegiatan</label>
                      <input type="date" value={form.tanggal} onChange={e => setForm(f => ({...f, tanggal: e.target.value}))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"/>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Waktu Kegiatan</label>
                      <input type="time" value={form.waktu_kegiatan} onChange={e => setForm(f => ({...f, waktu_kegiatan: e.target.value}))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"/>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-slate-700 mb-2">Penugasan Kru</p>
                    <div className="grid grid-cols-2 gap-3">
                      {DOKT_ROLES.map(role => (
                        <RoleInput key={role.key} label={role.label} icon={role.icon}
                          value={form[role.key]}
                          onChange={val => setForm(f => ({...f, [role.key]: val}))}/>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Catatan</label>
                    <textarea value={form.catatan} onChange={e => setForm(f => ({...f, catatan: e.target.value}))}
                      rows={2} placeholder="Lokasi, instruksi khusus, dll..."
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"/>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Keterangan / Nama Konten <span className="text-red-500">*</span></label>
                    <input value={form.keterangan} onChange={e => setForm(f => ({...f, keterangan: e.target.value}))}
                      placeholder="cth: Ucapan Hari Kartini"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"/>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Post</label>
                      <input type="date" value={form.tanggal} onChange={e => setForm(f => ({...f, tanggal: e.target.value}))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"/>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Deadline</label>
                      <input type="date" value={form.deadline} onChange={e => setForm(f => ({...f, deadline: e.target.value}))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"/>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Pembuat</label>
                      <select value={form.pembuat} onChange={e => setForm(f => ({...f, pembuat: e.target.value}))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
                        <option value="">— Pilih —</option>
                        {ANGGOTA.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                      <select value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value}))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
                        {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  {activeTab === 'feed' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Link Logo / Asset</label>
                      <input value={form.link_asset} onChange={e => setForm(f => ({...f, link_asset: e.target.value}))}
                        placeholder="https://drive.google.com/..."
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"/>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Catatan</label>
                    <textarea value={form.catatan} onChange={e => setForm(f => ({...f, catatan: e.target.value}))}
                      rows={2} placeholder="Catatan tambahan..."
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"/>
                  </div>
                </>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex gap-3 justify-end">
              <button onClick={() => { setShowForm(false); setEditRow(null) }}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Batal</button>
              <button onClick={handleSubmit} disabled={submitting}
                className="px-5 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium disabled:opacity-50 transition-colors">
                {submitting ? 'Menyimpan...' : editRow ? 'Simpan Perubahan' : 'Tambah Jadwal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
