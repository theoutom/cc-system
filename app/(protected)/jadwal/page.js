'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Calendar, Plus, X, Edit2, Save, Trash2, MessageSquare } from 'lucide-react'
import { differenceInDays, parseISO, format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'

const TABS = [
  { key: 'feed', label: 'Feed & Ucapan', table: 'jadwal_feed' },
  { key: 'aftermovie', label: 'Aftermovie', table: 'jadwal_aftermovie' },
  { key: 'dokumentasi', label: 'Dokumentasi', table: 'jadwal_dokumentasi' },
  { key: 'thumbnail', label: 'Thumbnail', table: 'jadwal_thumbnail' },
]

const STATUS_OPTIONS = ['Belum Dibuat', 'Proses', 'Selesai']
const ANGGOTA = ['Lionel', 'Ubai', 'Nana', 'Vania', 'Satrio', 'Miko', 'Ino']

function getDeadlineStyle(deadline, status) {
  if (status === 'Selesai') return { bg: 'bg-slate-100', text: 'text-slate-500', label: 'Selesai' }
  if (!deadline) return { bg: 'bg-gray-50', text: 'text-gray-400', label: 'No deadline' }
  const days = differenceInDays(parseISO(deadline), new Date())
  if (days < 0) return { bg: 'bg-gray-200', text: 'text-gray-600', label: `${Math.abs(days)}h lalu`, row: 'bg-gray-50 opacity-70' }
  if (days === 0) return { bg: 'bg-green-500', text: 'text-white', label: 'Hari ini!', row: 'bg-green-50' }
  if (days <= 3) return { bg: 'bg-red-500', text: 'text-white', label: `${days}h lagi`, row: 'bg-red-50' }
  if (days <= 7) return { bg: 'bg-orange-500', text: 'text-white', label: `${days}h lagi`, row: 'bg-orange-50' }
  if (days <= 14) return { bg: 'bg-yellow-400', text: 'text-yellow-900', label: `${days}h lagi` }
  return { bg: 'bg-slate-100', text: 'text-slate-600', label: `${days}h lagi` }
}

export default function JadwalPage() {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState('feed')
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editRow, setEditRow] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [showCatatan, setShowCatatan] = useState(null)
  const [catatanText, setCatatanText] = useState('')

  const [form, setForm] = useState({
    tanggal: '', keterangan: '', deadline: '', pembuat: '',
    status: 'Belum Dibuat', catatan: '', link_asset: '',
    cam1_operator: '', cam1_status: 'Belum',
    cam2_operator: '', cam2_status: 'Belum',
    gimbal_operator: '',
  })

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    const results = {}
    await Promise.all(TABS.map(async t => {
      const { data: rows } = await supabase.from(t.table).select('*').order('tanggal', { ascending: true })
      results[t.key] = rows || []
    }))
    setData(results)
    setLoading(false)
  }

  const currentTab = TABS.find(t => t.key === activeTab)
  const rows = data[activeTab] || []

  const resetForm = () => setForm({
    tanggal: '', keterangan: '', deadline: '', pembuat: '',
    status: 'Belum Dibuat', catatan: '', link_asset: '',
    cam1_operator: '', cam1_status: 'Belum',
    cam2_operator: '', cam2_status: 'Belum',
    gimbal_operator: '',
  })

  const handleSubmit = async () => {
    if (!form.keterangan) { alert('Keterangan wajib diisi!'); return }
    setSubmitting(true)

    const payload = {
      tanggal: form.tanggal || null,
      keterangan: form.keterangan,
      deadline: form.deadline || null,
      status: form.status,
      catatan: form.catatan || null,
    }

    if (activeTab === 'feed') payload.link_asset = form.link_asset || null
    if (activeTab !== 'dokumentasi') payload.pembuat = form.pembuat || null
    if (activeTab === 'dokumentasi') {
      payload.cam1_operator = form.cam1_operator || null
      payload.cam1_status = form.cam1_status
      payload.cam2_operator = form.cam2_operator || null
      payload.cam2_status = form.cam2_status
      payload.gimbal_operator = form.gimbal_operator || null
    }

    if (editRow) {
      await supabase.from(currentTab.table).update(payload).eq('id', editRow.id)
    } else {
      const maxNo = rows.length > 0 ? Math.max(...rows.map(r => r.no || 0)) : 0
      await supabase.from(currentTab.table).insert({ ...payload, no: maxNo + 1 })
    }

    resetForm()
    setShowForm(false)
    setEditRow(null)
    setSubmitting(false)
    fetchAll()
  }

  const handleEdit = (row) => {
    setEditRow(row)
    setForm({
      tanggal: row.tanggal || '',
      keterangan: row.keterangan || '',
      deadline: row.deadline || '',
      pembuat: row.pembuat || '',
      status: row.status || 'Belum Dibuat',
      catatan: row.catatan || '',
      link_asset: row.link_asset || '',
      cam1_operator: row.cam1_operator || '',
      cam1_status: row.cam1_status || 'Belum',
      cam2_operator: row.cam2_operator || '',
      cam2_status: row.cam2_status || 'Belum',
      gimbal_operator: row.gimbal_operator || '',
    })
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Hapus jadwal ini?')) return
    await supabase.from(currentTab.table).delete().eq('id', id)
    fetchAll()
  }

  const handleStatusChange = async (id, newStatus) => {
    await supabase.from(currentTab.table).update({ status: newStatus }).eq('id', id)
    fetchAll()
  }

  const saveCatatan = async () => {
    await supabase.from(currentTab.table).update({ catatan: catatanText }).eq('id', showCatatan.id)
    setShowCatatan(null)
    fetchAll()
  }

  const statusStyle = {
    'Selesai': 'bg-green-100 text-green-700',
    'Proses': 'bg-blue-100 text-blue-700',
    'Belum Dibuat': 'bg-slate-100 text-slate-600',
    'Belum': 'bg-slate-100 text-slate-600',
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Jadwal Konten</h1>
        <p className="text-slate-500 text-sm mt-0.5">Kelola jadwal konten Creative Corner</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-xl w-fit">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === t.key ? 'bg-white shadow text-purple-700' : 'text-slate-500 hover:text-slate-700'}`}>
            {t.label}
            <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${activeTab === t.key ? 'bg-purple-100 text-purple-600' : 'bg-slate-200 text-slate-500'}`}>
              {(data[t.key] || []).length}
            </span>
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <p className="text-xs text-slate-500 font-medium">Warna deadline:</p>
        {[
          { bg: 'bg-white border border-slate-200', label: 'Jauh (>14h)' },
          { bg: 'bg-yellow-400', label: 'Tinggal 2 mgg' },
          { bg: 'bg-orange-500', label: 'Tinggal 1 mgg' },
          { bg: 'bg-red-500', label: 'Tinggal 3 hari' },
          { bg: 'bg-green-500', label: 'Hari ini!' },
          { bg: 'bg-gray-400', label: 'Sudah lewat' },
        ].map(({ bg, label }) => (
          <div key={label} className="flex items-center gap-1">
            <div className={`w-3 h-3 rounded-full ${bg}`} />
            <span className="text-xs text-slate-500">{label}</span>
          </div>
        ))}
      </div>

      {/* Add button */}
      <div className="flex justify-end mb-4">
        <button onClick={() => { resetForm(); setEditRow(null); setShowForm(true) }}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> Tambah Jadwal
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <p className="text-center py-10 text-slate-400 text-sm">Memuat...</p>
        ) : rows.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Belum ada jadwal untuk kategori ini</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-4 py-3 font-medium text-slate-600 w-8">No</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Keterangan</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Tanggal</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Deadline</th>
                  {activeTab === 'dokumentasi' ? (
                    <>
                      <th className="text-left px-4 py-3 font-medium text-slate-600">Cam 1</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-600">Cam 2</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-600">Gimbal</th>
                    </>
                  ) : (
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Pembuat</th>
                  )}
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map(row => {
                  const dl = getDeadlineStyle(row.deadline, row.status)
                  return (
                    <tr key={row.id} className={`hover:bg-slate-50/50 ${dl.row || ''}`}>
                      <td className="px-4 py-3 text-slate-400 text-xs">{row.no}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{row.keterangan}</p>
                        {row.catatan && <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">📝 {row.catatan}</p>}
                        {activeTab === 'feed' && row.link_asset && (
                          <a href={row.link_asset} target="_blank" rel="noreferrer" className="text-xs text-purple-600 hover:underline">Lihat Asset</a>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">
                        {row.tanggal ? format(parseISO(row.tanggal), 'dd MMM yyyy', { locale: localeId }) : '-'}
                      </td>
                      <td className="px-4 py-3">
                        {row.deadline ? (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${dl.bg} ${dl.text}`}>
                            {dl.label}
                          </span>
                        ) : '-'}
                      </td>
                      {activeTab === 'dokumentasi' ? (
                        <>
                          <td className="px-4 py-3">
                            <p className="text-xs text-slate-700">{row.cam1_operator || '-'}</p>
                            {row.cam1_status && <span className={`text-xs px-1.5 py-0.5 rounded font-medium mt-0.5 inline-block ${statusStyle[row.cam1_status]}`}>{row.cam1_status}</span>}
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs text-slate-700">{row.cam2_operator || '-'}</p>
                            {row.cam2_status && <span className={`text-xs px-1.5 py-0.5 rounded font-medium mt-0.5 inline-block ${statusStyle[row.cam2_status]}`}>{row.cam2_status}</span>}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-700">{row.gimbal_operator || '-'}</td>
                        </>
                      ) : (
                        <td className="px-4 py-3 text-slate-700 text-xs">{row.pembuat || '-'}</td>
                      )}
                      <td className="px-4 py-3">
                        <select value={row.status || 'Belum Dibuat'}
                          onChange={e => handleStatusChange(row.id, e.target.value)}
                          className={`text-xs px-2 py-1 rounded-lg font-medium border-0 cursor-pointer ${statusStyle[row.status] || statusStyle['Belum Dibuat']}`}>
                          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => { setShowCatatan(row); setCatatanText(row.catatan || '') }}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Catatan">
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleEdit(row)}
                            className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded" title="Edit">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(row.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded" title="Hapus">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900">{editRow ? 'Edit' : 'Tambah'} Jadwal — {currentTab.label}</h3>
              <button onClick={() => { setShowForm(false); setEditRow(null) }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Keterangan / Nama Konten *</label>
                <input value={form.keterangan} onChange={e => setForm(f => ({ ...f, keterangan: e.target.value }))}
                  placeholder="cth: Ucapan Hari Kartini"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Post</label>
                  <input type="date" value={form.tanggal} onChange={e => setForm(f => ({ ...f, tanggal: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Deadline</label>
                  <input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              {/* Dokumentasi: multiple assignees */}
              {activeTab === 'dokumentasi' ? (
                <div className="space-y-3">
                  {[
                    { key: 'cam1_operator', statusKey: 'cam1_status', label: 'Cam 1 Operator' },
                    { key: 'cam2_operator', statusKey: 'cam2_status', label: 'Cam 2 Operator' },
                    { key: 'gimbal_operator', label: 'Gimbal Operator' },
                  ].map(({ key, statusKey, label }) => (
                    <div key={key} className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
                        <select value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
                          <option value="">— Pilih —</option>
                          {ANGGOTA.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                      </div>
                      {statusKey && (
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                          <select value={form[statusKey]} onChange={e => setForm(f => ({ ...f, [statusKey]: e.target.value }))}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
                            {['Belum', 'Proses', 'Selesai'].map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Pembuat</label>
                    <select value={form.pembuat} onChange={e => setForm(f => ({ ...f, pembuat: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
                      <option value="">— Pilih —</option>
                      {ANGGOTA.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                    <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
                      {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {activeTab === 'feed' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Link Logo / Asset</label>
                  <input value={form.link_asset} onChange={e => setForm(f => ({ ...f, link_asset: e.target.value }))}
                    placeholder="https://drive.google.com/..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Catatan</label>
                <textarea value={form.catatan} onChange={e => setForm(f => ({ ...f, catatan: e.target.value }))}
                  rows={2} placeholder="Catatan tambahan..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex gap-3 justify-end">
              <button onClick={() => { setShowForm(false); setEditRow(null) }}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Batal</button>
              <button onClick={handleSubmit} disabled={submitting}
                className="px-5 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium disabled:opacity-50">
                {submitting ? 'Menyimpan...' : editRow ? 'Simpan Perubahan' : 'Tambah Jadwal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Catatan modal */}
      {showCatatan && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900">Catatan</h3>
              <button onClick={() => setShowCatatan(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm font-medium text-slate-600 mb-2">{showCatatan.keterangan}</p>
              <textarea value={catatanText} onChange={e => setCatatanText(e.target.value)}
                rows={4} placeholder="Tulis catatan di sini..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              />
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex gap-3 justify-end">
              <button onClick={() => setShowCatatan(null)} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Batal</button>
              <button onClick={saveCatatan} className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium">Simpan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
