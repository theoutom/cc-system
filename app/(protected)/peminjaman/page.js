'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { InventarisGrid } from '@/components/InventarisGrid'
import {
  Plus, X, Upload, Package, Phone, CalendarCheck,
  User, CreditCard, School, Search, ChevronDown, CheckCircle,
  AlertCircle, Info, Lock, Clock, Building2, Mail, MessageCircle, Bell
} from 'lucide-react'

const JENIS = ['Sekolah', 'Organisasi', 'Eksternal']

const STATUS_CONFIG = {
  pending:  { label: 'Menunggu Approval', bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-400'  },
  approved: { label: 'Disetujui',         bg: 'bg-blue-50',   text: 'text-blue-700',   dot: 'bg-blue-500'   },
  active:   { label: 'Aktif',             bg: 'bg-green-50',  text: 'text-green-700',  dot: 'bg-green-500'  },
  returned: { label: 'Dikembalikan',      bg: 'bg-slate-50',  text: 'text-slate-500',  dot: 'bg-slate-300'  },
  rejected: { label: 'Ditolak',           bg: 'bg-red-50',    text: 'text-red-600',    dot: 'bg-red-400'    },
}

const DURASI_OPTIONS = [
  { label: '1 hari',   value: 1  },
  { label: '2 hari',   value: 2  },
  { label: '3 hari',   value: 3  },
  { label: '1 minggu', value: 7  },
  { label: '2 minggu', value: 14 },
  { label: 'Custom',   value: 0  },
]

const MAX_FILE_BYTES = 5 * 1024 * 1024

function addDays(dateStr, days) {
  if (!dateStr || !days) return ''
  const d = new Date(dateStr)
  d.setDate(d.getDate() + Number(days))
  return d.toISOString().split('T')[0]
}

function StatusBadge({ status }) {
  const s = STATUS_CONFIG[status] || STATUS_CONFIG.pending
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}

function StepIndicator({ current, steps }) {
  return (
    <div className="flex items-center">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center flex-1 last:flex-none">
          <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all flex-shrink-0 ${
            i < current  ? 'bg-purple-600 text-white'
            : i === current ? 'bg-purple-600 text-white ring-4 ring-purple-100'
            : 'bg-slate-100 text-slate-400'
          }`}>
            {i < current ? <CheckCircle className="w-4 h-4" /> : i + 1}
          </div>
          <p className={`ml-1.5 text-xs font-medium hidden sm:block truncate ${i === current ? 'text-slate-800' : 'text-slate-400'}`}>
            {step}
          </p>
          {i < steps.length - 1 && (
            <div className={`flex-1 mx-2 h-0.5 min-w-4 ${i < current ? 'bg-purple-600' : 'bg-slate-100'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Form Peminjaman ─────────────────────────────────────────
function PeminjamanForm({ onClose, onSuccess }) {
  const supabase = createClient()
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [customDurasi, setCustomDurasi] = useState(false)
  const [rawInventaris, setRawInventaris] = useState([])
  const [activePem, setActivePem]         = useState([])
  const [loadingInventaris, setLoadingInventaris] = useState(true)
  const [jadwalList, setJadwalList] = useState([])
  const [prevBorrowers, setPrevBorrowers] = useState([])
  const [loadingPrev, setLoadingPrev]     = useState(false)

  const [form, setForm] = useState({
    jenis_acara: 'Sekolah',
    nama_kegiatan: '',
    asal_organisasi: '',
    tanggal: '',
    jam_peminjaman: '',
    jam_acara: '',
    nama_peminjam: '',
    no_telepon: '',
    email_peminjam: '',
    selected_items: [],
    catatan_barang: '',
    durasi_hari: 1,
    perkiraan_kembali: '',
    jam_pengembalian: '',
    lampiran_bukti: null,
    foto_identitas: null,
    jadwal_id: null,
  })

  const inventaris = useMemo(() => {
    const reqStart = form.tanggal
    const reqEnd   = form.perkiraan_kembali || form.tanggal
    const busyMap  = {}
    activePem.forEach(p => {
      const pStart = p.tanggal
      const pEnd   = p.perkiraan_kembali || p.tanggal
      if (!pStart) return
      const overlaps = reqStart && reqEnd
        ? reqStart <= pEnd && reqEnd >= pStart
        : true
      if (overlaps && Array.isArray(p.items_dipinjam)) {
        p.items_dipinjam.forEach(id => {
          if (!busyMap[id]) busyMap[id] = { nama_kegiatan: p.nama_kegiatan, tanggal: pStart, perkiraan_kembali: pEnd }
        })
      }
    })
    return rawInventaris.map(item => ({
      ...item,
      status: busyMap[item.id] ? 'Dipinjam' : item.status,
      _peminjamanAktif: busyMap[item.id] || null,
    }))
  }, [rawInventaris, activePem, form.tanggal, form.perkiraan_kembali])

  const set = (key, val) => setForm(f => {
    const updated = { ...f, [key]: val }
    if (key === 'tanggal' || key === 'durasi_hari') {
      updated.perkiraan_kembali = addDays(
        key === 'tanggal' ? val : f.tanggal,
        key === 'durasi_hari' ? val : f.durasi_hari
      )
    }
    return updated
  })

  const toggleItem = (id) => {
    setForm(f => ({
      ...f,
      selected_items: f.selected_items.includes(id)
        ? f.selected_items.filter(x => x !== id)
        : [...f.selected_items, id]
    }))
  }

  const isSekolah    = form.jenis_acara === 'Sekolah'
  const isOrganisasi = form.jenis_acara === 'Organisasi'
  const needsPhone   = !isSekolah
  const identityLabel = isOrganisasi ? 'Foto Kartu Siswa / Kartu Anggota' : 'Foto KTP / Kartu Identitas'
  const steps = ['Jenis & Kegiatan', 'Detail Peminjam', 'Pilih Alat', 'Dokumen']

  useEffect(() => {
    const fetchInventaris = async () => {
      setLoadingInventaris(true)
      const { data: items } = await supabase.from('inventaris').select('*').order('kategori').order('nama_alat')
      const { data: peminjamanAktif } = await supabase
        .from('peminjaman')
        .select('id, nama_kegiatan, tanggal, perkiraan_kembali, items_dipinjam')
        .in('status', ['approved', 'active'])

      setRawInventaris(items || [])
      setActivePem(peminjamanAktif || [])

      const today = new Date().toISOString().split('T')[0]
      const { data: jadwal } = await supabase
        .from('jadwal_dokumentasi')
        .select('id, nama_kegiatan, tanggal, waktu_kegiatan')
        .gte('tanggal', today)
        .order('tanggal', { ascending: true })
      setJadwalList(jadwal || [])
      setLoadingInventaris(false)
    }
    fetchInventaris()
  }, [])

  const validateStep = () => {
    if (step === 0 && (!form.jenis_acara || !form.nama_kegiatan || !form.tanggal)) return false
    if (step === 0 && (isOrganisasi || form.jenis_acara === 'Eksternal') && !form.asal_organisasi) return false
    if (step === 1 && !form.nama_peminjam) return false
    if (step === 1 && needsPhone && !form.no_telepon) return false
    if (step === 1 && needsPhone && form.no_telepon.replace(/\D/g, '').length < 8) return false
    if (step === 2 && form.selected_items.length === 0) return false
    return true
  }

  const handleNext = () => {
    if (!validateStep()) {
      if (step === 2 && form.selected_items.length === 0) alert('Pilih minimal 1 alat untuk dipinjam')
      else alert('Harap lengkapi semua field yang wajib (*)')
      return
    }
    setStep(s => s + 1)
  }

  const selectedNamas = form.selected_items
    .map(id => inventaris.find(i => i.id === id)?.nama_alat)
    .filter(Boolean)

  const handleSubmit = async () => {
    if (!isSekolah) {
      if (!form.foto_identitas) { alert(`${identityLabel} wajib diupload!`); return }
      if (!form.lampiran_bukti) { alert('Surat peminjaman wajib diupload!'); return }
    }
    setSubmitting(true)

    const uploadFile = async (file, prefix) => {
      if (!file) return null
      if (file.size > MAX_FILE_BYTES) { alert(`File ${file.name} melebihi 5MB!`); return null }
      const ext = file.name.split('.').pop()
      const path = `${prefix}-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('lampiran').upload(path, file)
      if (error) { alert('Gagal upload file: ' + error.message); return null }
      return supabase.storage.from('lampiran').getPublicUrl(path).data?.publicUrl
    }

    const lampiran_url  = !isSekolah ? await uploadFile(form.lampiran_bukti, 'bukti') : null
    const identitas_url = !isSekolah ? await uploadFile(form.foto_identitas, 'id')    : null

    const detail = selectedNamas.join('\n') + (form.catatan_barang ? `\n\nCatatan: ${form.catatan_barang}` : '')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('peminjaman').insert({
        jenis_acara: form.jenis_acara,
        nama_kegiatan: form.nama_kegiatan,
        asal_organisasi: form.asal_organisasi || null,
        tanggal: form.tanggal,
        jam_peminjaman: form.jam_peminjaman || null,
        jam_acara: form.jam_acara || null,
        jam_pengembalian: form.jam_pengembalian || null,
        nama_peminjam: form.nama_peminjam,
        no_telepon: needsPhone ? form.no_telepon : null,
        email_peminjam: form.email_peminjam || null,
        detail_barang: detail,
        items_dipinjam: form.selected_items,
        durasi_hari: Number(form.durasi_hari),
        perkiraan_kembali: form.perkiraan_kembali || null,
        lampiran_bukti: lampiran_url,
        foto_identitas: identitas_url,
        status: 'pending',
        created_by: user?.id,
        jadwal_id: form.jadwal_id || null,
      })
      if (error) throw error
      onSuccess()
    } catch (e) {
      alert('Gagal menyimpan peminjaman: ' + e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[95vh]">

        <div className="px-6 pt-5 pb-4 border-b border-slate-100">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h3 className="font-bold text-slate-900 text-lg">Form Peminjaman Alat</h3>
              <p className="text-xs text-slate-400 mt-0.5">Lengkapi semua informasi dengan benar</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg mt-0.5">
              <X className="w-5 h-5" />
            </button>
          </div>
          <StepIndicator current={step} steps={steps} />
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* STEP 0 */}
          {step === 0 && <>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Jenis Kegiatan *</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { j: 'Sekolah',    icon: '🏫', desc: 'Kegiatan resmi sekolah' },
                  { j: 'Organisasi', icon: '🎯', desc: 'Ekskul / Organisasi' },
                  { j: 'Eksternal',  icon: '🌐', desc: 'Pribadi / Luar sekolah' },
                ].map(({ j, icon, desc }) => (
                  <button key={j} type="button" onClick={async () => {
                    set('jenis_acara', j)
                    set('asal_organisasi', '')
                    setPrevBorrowers([])
                    if (j === 'Organisasi' || j === 'Eksternal') {
                      setLoadingPrev(true)
                      const { data } = await supabase.from('peminjaman')
                        .select('asal_organisasi').eq('jenis_acara', j)
                        .not('asal_organisasi', 'is', null).order('created_at', { ascending: false }).limit(200)
                      const seen = new Set(); const unique = []
                      ;(data || []).forEach(d => { const k = (d.asal_organisasi || '').trim(); if (k && !seen.has(k)) { seen.add(k); unique.push(k) } })
                      setPrevBorrowers(unique)
                      setLoadingPrev(false)
                    }
                  }}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${form.jenis_acara === j ? 'border-purple-500 bg-purple-50' : 'border-slate-200 hover:border-purple-300'}`}>
                    <div className="text-2xl mb-1">{icon}</div>
                    <p className={`text-sm font-semibold ${form.jenis_acara === j ? 'text-purple-700' : 'text-slate-700'}`}>{j}</p>
                    <p className="text-xs text-slate-400 mt-0.5 leading-tight">{desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                🔗 Tautkan ke Jadwal Dokumentasi
                <span className="ml-1.5 text-xs font-normal text-slate-400">(opsional)</span>
              </label>
              {jadwalList.length === 0 ? (
                <p className="text-xs text-slate-400 py-2">Tidak ada jadwal dokumentasi mendatang</p>
              ) : (
                <select
                  value={form.jadwal_id || ''}
                  onChange={e => {
                    const id = e.target.value || null
                    const jadwal = jadwalList.find(j => j.id === id)
                    set('jadwal_id', id)
                    if (jadwal) {
                      set('nama_kegiatan', jadwal.nama_kegiatan || form.nama_kegiatan)
                      if (jadwal.tanggal) set('tanggal', jadwal.tanggal)
                    }
                  }}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                >
                  <option value="">— Tidak tautkan ke jadwal —</option>
                  {jadwalList.map(j => (
                    <option key={j.id} value={j.id}>
                      📅 {j.tanggal ? new Date(j.tanggal).toLocaleDateString('id-ID', {day:'numeric',month:'short',year:'numeric'}) : '—'}{j.waktu_kegiatan ? ` ${j.waktu_kegiatan.slice(0,5)}` : ''} — {j.nama_kegiatan || 'Tanpa nama'}
                    </option>
                  ))}
                </select>
              )}
              {form.jadwal_id && (
                <p className="text-xs text-purple-600 mt-1 flex items-center gap-1">
                  ✅ Peminjaman ini akan terhubung ke jadwal dokumentasi
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nama Kegiatan *</label>
              <input value={form.nama_kegiatan} onChange={e => set('nama_kegiatan', e.target.value)}
                placeholder="cth: Peskil Day 1 Kelas XII"
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {(isOrganisasi || form.jenis_acara === 'Eksternal') && (
              <div className="space-y-2">
                {loadingPrev ? (
                  <p className="text-xs text-slate-400">Memuat riwayat...</p>
                ) : prevBorrowers.length > 0 && (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Pernah Pinjam Sebelumnya?</label>
                    <select defaultValue=""
                      onChange={e => { if (e.target.value) set('asal_organisasi', e.target.value) }}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white">
                      <option value="">-- Baru / Belum pernah pinjam --</option>
                      {prevBorrowers.map(name => <option key={name} value={name}>{name}</option>)}
                    </select>
                    <p className="text-xs text-slate-400 mt-1">Pilih dari riwayat, atau isi manual di bawah</p>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    {isOrganisasi ? 'Nama Organisasi / Ekskul *' : 'Instansi / Pihak *'}
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input value={form.asal_organisasi} onChange={e => set('asal_organisasi', e.target.value)}
                      placeholder={isOrganisasi ? 'cth: OSIS SMA N 1 Solo / Ekskul Fotografi' : 'cth: Pribadi / PT. Contoh Indonesia'}
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tanggal Pemakaian *</label>
              <input type="date" value={form.tanggal} onChange={e => set('tanggal', e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Jam Pengambilan Alat</label>
                <input type="time" value={form.jam_peminjaman} onChange={e => set('jam_peminjaman', e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Jam Mulai Acara</label>
                <input type="time" value={form.jam_acara} onChange={e => set('jam_acara', e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          </>}

          {/* STEP 1 */}
          {step === 1 && <>
            <div className={`flex items-center gap-2 p-3 rounded-xl text-sm font-medium ${
              isSekolah ? 'bg-blue-50 text-blue-700' : isOrganisasi ? 'bg-orange-50 text-orange-700' : 'bg-purple-50 text-purple-700'
            }`}>
              {isSekolah ? <School className="w-4 h-4 flex-shrink-0" /> : <User className="w-4 h-4 flex-shrink-0" />}
              <span>{form.jenis_acara} — {form.nama_kegiatan} · {form.tanggal}</span>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nama Lengkap Peminjam *</label>
              <input value={form.nama_peminjam} onChange={e => set('nama_peminjam', e.target.value)}
                placeholder="cth: Satrio & Vania"
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <p className="text-xs text-slate-400 mt-1">Boleh lebih dari satu nama jika meminjam bersama</p>
            </div>

            {needsPhone && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nomor WhatsApp / Telepon *</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={form.no_telepon}
                    onChange={e => set('no_telepon', e.target.value.replace(/[^\d+\s-]/g, ''))}
                    placeholder="cth: 08123456789"
                    className="w-full pl-10 pr-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                {form.no_telepon && form.no_telepon.replace(/\D/g, '').length < 8 && (
                  <p className="text-xs text-red-500 mt-1">⚠️ Nomor terlalu pendek (min. 8 digit)</p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Email <span className="text-slate-400 font-normal">(opsional)</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  inputMode="email"
                  value={form.email_peminjam}
                  onChange={e => set('email_peminjam', e.target.value)}
                  placeholder="cth: nama@email.com"
                  className="w-full pl-10 pr-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">Untuk kirim notifikasi via email setelah approve/reject</p>
            </div>

            {isSekolah && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <p className="text-sm font-semibold text-blue-800 mb-1">ℹ️ Kegiatan Sekolah</p>
                <p className="text-xs text-blue-600">Peminjaman untuk kegiatan sekolah tidak memerlukan nomor telepon dan dokumen identitas.</p>
              </div>
            )}
          </>}

          {/* STEP 2 */}
          {step === 2 && <>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Lama Peminjaman *</label>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {DURASI_OPTIONS.map(opt => (
                  <button key={opt.label} type="button"
                    onClick={() => {
                      if (opt.value === 0) { setCustomDurasi(true) }
                      else { setCustomDurasi(false); set('durasi_hari', opt.value) }
                    }}
                    className={`py-2.5 px-3 rounded-xl border-2 text-xs font-semibold transition-all ${
                      (opt.value === 0 && customDurasi) || (!customDurasi && form.durasi_hari === opt.value)
                        ? 'border-purple-500 bg-purple-50 text-purple-700'
                        : 'border-slate-200 text-slate-600 hover:border-purple-300'
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
              {customDurasi && (
                <div className="flex items-center gap-3 mb-3">
                  <input type="number" min="1" max="365" value={form.durasi_hari}
                    onChange={e => set('durasi_hari', e.target.value)}
                    className="w-24 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 text-center font-bold"
                  />
                  <span className="text-sm text-slate-600 font-medium">hari</span>
                </div>
              )}
              {form.tanggal && form.durasi_hari > 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 flex items-center gap-3 mb-2">
                  <CalendarCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-emerald-600">Perkiraan tanggal kembali:</p>
                    <p className="text-sm font-bold text-emerald-700">
                      {new Date(form.perkiraan_kembali + 'T00:00:00').toLocaleDateString('id-ID', {
                        weekday: 'short', day: 'numeric', month: 'long', year: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Jam Pengembalian Alat</label>
                <input type="time" value={form.jam_pengembalian} onChange={e => set('jam_pengembalian', e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <p className="text-xs text-slate-400 mt-1">Jam pengembalian alat pada tanggal perkiraan di atas</p>
              </div>
            </div>

            <div className="border-t border-slate-100" />

            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold text-slate-700">Pilih Alat yang Dipinjam *</label>
                {form.selected_items.length > 0 && (
                  <span className="text-xs font-bold bg-purple-600 text-white px-2.5 py-1 rounded-full">
                    {form.selected_items.length} dipilih
                  </span>
                )}
              </div>
              {loadingInventaris ? (
                <div className="flex items-center justify-center py-10">
                  <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                  <p className="ml-3 text-sm text-slate-400">Memuat daftar alat...</p>
                </div>
              ) : (
                <InventarisGrid inventaris={inventaris} selectedIds={form.selected_items} onToggle={toggleItem} />
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Catatan Tambahan <span className="text-slate-400 font-normal">(opsional)</span>
              </label>
              <textarea value={form.catatan_barang} onChange={e => set('catatan_barang', e.target.value)}
                rows={2}
                placeholder="cth: Baterai harap disiapkan sudah terisi penuh"
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              />
            </div>
          </>}

          {/* STEP 3 */}
          {step === 3 && <>
            {isSekolah ? (
              <div className="text-center py-4">
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="w-7 h-7 text-green-500" />
                </div>
                <h4 className="font-bold text-slate-800 text-lg mb-1">Semua Data Lengkap!</h4>
                <p className="text-slate-500 text-sm mb-4">Kegiatan sekolah tidak memerlukan upload dokumen.</p>
              </div>
            ) : (
              <>
                <div className={`flex items-center gap-2 p-3 rounded-xl text-sm ${isOrganisasi ? 'bg-orange-50 text-orange-700' : 'bg-purple-50 text-purple-700'}`}>
                  <CreditCard className="w-4 h-4 flex-shrink-0" />
                  <span>Dokumen berikut <strong>wajib</strong> diupload untuk peminjam <strong>{form.jenis_acara}</strong></span>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    {identityLabel} <span className="text-red-500">*</span>
                  </label>
                  <label className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                    form.foto_identitas ? 'border-green-400 bg-green-50' : 'border-red-200 bg-red-50/30 hover:border-purple-400 hover:bg-purple-50'
                  }`}>
                    {form.foto_identitas ? (
                      <><CheckCircle className="w-7 h-7 text-green-500 mb-1.5" />
                        <p className="text-sm font-medium text-green-700">{form.foto_identitas.name}</p>
                        <p className="text-xs text-green-500">Klik untuk ganti</p>
                      </>
                    ) : (
                      <><CreditCard className="w-7 h-7 text-red-300 mb-1.5" />
                        <p className="text-sm text-slate-500 font-medium">Klik untuk upload <span className="text-red-500">(wajib)</span></p>
                        <p className="text-xs text-slate-400 mt-0.5">JPG, PNG · Maks. 5MB</p>
                      </>
                    )}
                    <input type="file" accept="image/*" className="hidden"
                      onChange={e => {
                        const f = e.target.files[0]
                        if (f && f.size > MAX_FILE_BYTES) { alert('File melebihi 5MB!'); return }
                        set('foto_identitas', f || null)
                      }} />
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Surat Peminjaman / Bukti Kegiatan <span className="text-red-500">*</span>
                  </label>
                  <label className={`flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                    form.lampiran_bukti ? 'border-green-400 bg-green-50' : 'border-red-200 bg-red-50/30 hover:border-blue-400 hover:bg-blue-50'
                  }`}>
                    {form.lampiran_bukti ? (
                      <><CheckCircle className="w-6 h-6 text-green-500 mb-1" /><p className="text-xs font-medium text-green-700">{form.lampiran_bukti.name}</p></>
                    ) : (
                      <><Upload className="w-6 h-6 text-red-300 mb-1" />
                        <p className="text-xs text-slate-500 font-medium">Upload surat <span className="text-red-500">(wajib)</span></p>
                        <p className="text-xs text-slate-400 mt-0.5">JPG, PNG, PDF · Maks. 5MB</p>
                      </>
                    )}
                    <input type="file" accept="image/*,.pdf" className="hidden"
                      onChange={e => {
                        const f = e.target.files[0]
                        if (f && f.size > MAX_FILE_BYTES) { alert('File melebihi 5MB!'); return }
                        set('lampiran_bukti', f || null)
                      }} />
                  </label>
                </div>
              </>
            )}

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <p className="font-semibold text-slate-700 text-sm mb-3">📋 Ringkasan Peminjaman</p>
              <div className="space-y-1.5 text-xs mb-3">
                {[
                  ['Kegiatan', `${form.nama_kegiatan} (${form.jenis_acara})`],
                  ...(form.asal_organisasi ? [['Dari', form.asal_organisasi]] : []),
                  ['Peminjam', form.nama_peminjam],
                  ...(needsPhone ? [['No. HP', form.no_telepon]] : []),
                  ...(form.email_peminjam ? [['Email', form.email_peminjam]] : []),
                  ['Tanggal', form.tanggal],
                  ...(form.jam_peminjaman ? [['Jam Ambil', form.jam_peminjaman]] : []),
                  ...(form.jam_acara ? [['Jam Acara', form.jam_acara]] : []),
                  ['Durasi', `${form.durasi_hari} hari`],
                  ['Est. kembali', `${form.perkiraan_kembali}${form.jam_pengembalian ? ' · ' + form.jam_pengembalian : ''}`],
                ].map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <span className="text-slate-400 w-24 flex-shrink-0">{k}</span>
                    <span className="text-slate-700 font-medium">{v}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-200 pt-3">
                <p className="text-xs font-semibold text-slate-500 mb-1.5">Alat ({selectedNamas.length} item):</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedNamas.map((nama, i) => (
                    <span key={i} className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-lg font-medium">{nama}</span>
                  ))}
                </div>
              </div>
            </div>
          </>}

        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between flex-shrink-0">
          <button onClick={step === 0 ? onClose : () => setStep(s => s - 1)}
            className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 font-medium">
            {step === 0 ? 'Batal' : '← Kembali'}
          </button>
          <div className="flex items-center gap-1.5">
            {[0,1,2,3].map(i => (
              <div key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-5 bg-purple-600' : i < step ? 'w-3 bg-purple-300' : 'w-3 bg-slate-200'}`} />
            ))}
          </div>
          {step < 3 ? (
            <button onClick={handleNext}
              className="px-5 py-2 text-sm bg-purple-600 text-white rounded-xl hover:bg-purple-700 font-semibold">
              Lanjut →
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={submitting}
              className="px-5 py-2 text-sm bg-green-600 text-white rounded-xl hover:bg-green-700 font-semibold disabled:opacity-50">
              {submitting ? 'Menyimpan...' : '✓ Kirim Peminjaman'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────
export default function PeminjamanPage() {
  const supabase = createClient()
  const [data, setData]             = useState([])
  const [inventaris, setInventaris] = useState([])
  const [loading, setLoading]       = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [profile, setProfile]       = useState(null)
  const [filterJenis, setFilterJenis]   = useState('Semua')
  const [filterStatus, setFilterStatus] = useState('Semua')
  const [search, setSearch]         = useState('')
  const [expanded, setExpanded]     = useState(null)
  const [daftarHitam, setDaftarHitam] = useState([])

  useEffect(() => { fetchData(); fetchProfile(); fetchInventaris(); fetchDaftarHitam() }, [])

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(p)
    }
  }

  const fetchInventaris = async () => {
    const { data: items } = await supabase.from('inventaris').select('id, nama_alat, kategori, denda_per_hari')
    setInventaris(items || [])
  }

  const fetchDaftarHitam = async () => {
    const { data } = await supabase.from('daftar_hitam').select('nama')
    setDaftarHitam((data || []).map(d => d.nama.toLowerCase()))
  }

  const isBlacklisted = (row) => daftarHitam.includes((row.nama_peminjam || '').toLowerCase())

  const tomorrow = (() => {
    const d = new Date(); d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  })()

  const h1List = data.filter(d =>
    ['approved', 'active'].includes(d.status) &&
    d.perkiraan_kembali === tomorrow
  )

  const formatWAPhone = (no) => {
    if (!no) return null
    const digits = no.replace(/\D/g, '')
    if (digits.startsWith('0')) return '62' + digits.slice(1)
    if (digits.startsWith('62')) return digits
    return '62' + digits
  }

  const sendWAReminder = (row) => {
    const waPhone = formatWAPhone(row.no_telepon)
    if (!waPhone) return
    const kembali = `${row.perkiraan_kembali}${row.jam_pengembalian ? ' pukul ' + row.jam_pengembalian.slice(0,5) : ''}`
    const text = `Halo ${row.nama_peminjam},

Pengingat dari tim CC — alat yang kamu pinjam untuk kegiatan *${row.nama_kegiatan}* harus dikembalikan *besok, ${kembali}*.${row.token ? `

Token pengembalian: *${row.token}*` : ''}

Mohon dikembalikan tepat waktu ya. Terima kasih! 🙏`
    window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(text)}`, '_blank')
  }

  const fetchData = async () => {
    setLoading(true)
    const { data: pem } = await supabase
      .from('peminjaman').select('*').order('created_at', { ascending: false })
    setData(pem || [])
    setLoading(false)
  }

  const getKonflikItems = (row) => {
    if (!Array.isArray(row.items_dipinjam) || row.items_dipinjam.length === 0) return []
    const reqStart = row.tanggal
    const reqEnd   = row.perkiraan_kembali || row.tanggal
    return data.filter(other =>
      other.id !== row.id &&
      ['approved', 'active'].includes(other.status) &&
      Array.isArray(other.items_dipinjam) &&
      other.items_dipinjam.some(id => row.items_dipinjam.includes(id)) &&
      (() => {
        const oStart = other.tanggal
        const oEnd   = other.perkiraan_kembali || other.tanggal
        return reqStart <= oEnd && reqEnd >= oStart
      })()
    )
  }

  const handleApprove = async (id, action) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('peminjaman').update({
        status: action === 'approve' ? 'approved' : 'rejected',
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
      }).eq('id', id)
      if (error) throw error
      fetchData()
    } catch (e) {
      alert('Gagal memperbarui status: ' + e.message)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Yakin hapus data ini?')) return
    try {
      const { error } = await supabase.from('peminjaman').delete().eq('id', id)
      if (error) throw error
      fetchData()
    } catch (e) {
      alert('Gagal menghapus: ' + e.message)
    }
  }

  const sendEmail = (row, type) => {
    const to = row.email_peminjam || ''
    const tgl = row.tanggal || '-'
    const kembali = row.perkiraan_kembali
      ? `${row.perkiraan_kembali}${row.jam_pengembalian ? ' pukul ' + row.jam_pengembalian.slice(0,5) : ''}`
      : '-'

    let subject, body
    if (type === 'approved') {
      subject = `[CC] Peminjaman Disetujui — ${row.nama_kegiatan}`
      body = `Halo ${row.nama_peminjam},

Peminjaman alat kamu telah DISETUJUI oleh admin CC.

Detail peminjaman:
- Kegiatan : ${row.nama_kegiatan}
- Tanggal  : ${tgl}${row.jam_peminjaman ? ' pukul ' + row.jam_peminjaman.slice(0,5) : ''}
- Alat     : ${row.detail_barang?.split('\n').filter(l => !l.startsWith('Catatan')).join(', ') || '-'}
- Kembali  : ${kembali}
${row.token ? `- Token pengembalian: ${row.token}` : ''}

Harap ambil alat sesuai jadwal dan kembalikan tepat waktu.
Simpan token pengembalian di atas untuk proses pengembalian alat.

Salam,
Tim CC`
    } else if (type === 'rejected') {
      subject = `[CC] Peminjaman Ditolak — ${row.nama_kegiatan}`
      body = `Halo ${row.nama_peminjam},

Mohon maaf, peminjaman alat kamu DITOLAK oleh admin CC.

Detail peminjaman:
- Kegiatan : ${row.nama_kegiatan}
- Tanggal  : ${tgl}
- Alat     : ${row.detail_barang?.split('\n').filter(l => !l.startsWith('Catatan')).join(', ') || '-'}

Jika ada pertanyaan, silakan hubungi admin CC secara langsung.

Salam,
Tim CC`
    } else if (type === 'reminder') {
      subject = `[CC] Pengingat Pengembalian Alat — ${row.nama_kegiatan}`
      body = `Halo ${row.nama_peminjam},

Ini adalah pengingat bahwa alat yang dipinjam harus dikembalikan pada:
${kembali}

Detail peminjaman:
- Kegiatan : ${row.nama_kegiatan}
- Alat     : ${row.detail_barang?.split('\n').filter(l => !l.startsWith('Catatan')).join(', ') || '-'}
${row.token ? `- Token pengembalian: ${row.token}` : ''}

Harap kembalikan tepat waktu untuk menghindari denda.

Salam,
Tim CC`
    }

    const mailto = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    window.open(mailto, '_blank')
  }

  const getOverdueInfo = (row) => {
    if (!row.perkiraan_kembali) return null
    if (!['approved', 'active'].includes(row.status)) return null
    const today = new Date(); today.setHours(0,0,0,0)
    const due = new Date(row.perkiraan_kembali + 'T00:00:00')
    const diff = Math.floor((today - due) / 86400000)
    if (diff > 0)  return { days: diff, label: `Terlambat ${diff} hari`, isOver: true }
    if (diff === 0) return { days: 0, label: 'Jatuh tempo hari ini', isOver: false, isToday: true }
    if (diff >= -2) return { days: diff, label: `${-diff} hari lagi`, isOver: false, isNear: true }
    return null
  }

  const calcFine = (row) => {
    const info = getOverdueInfo(row)
    if (!info?.isOver || !Array.isArray(row.items_dipinjam)) return 0
    const totalDenda = row.items_dipinjam.reduce((sum, id) => {
      const item = inventaris.find(i => i.id === id)
      return sum + (item?.denda_per_hari || 0)
    }, 0)
    return totalDenda * info.days
  }

  const filtered = data.filter(d => {
    const j = filterJenis === 'Semua' || d.jenis_acara === filterJenis
    const s = filterStatus === 'Semua'
      ? true
      : filterStatus === 'Terlambat'
        ? (['approved','active'].includes(d.status) && d.perkiraan_kembali && new Date(d.perkiraan_kembali + 'T00:00:00') < new Date())
        : d.status === filterStatus
    const q = !search ||
      d.nama_kegiatan?.toLowerCase().includes(search.toLowerCase()) ||
      d.nama_peminjam?.toLowerCase().includes(search.toLowerCase())
    return j && s && q
  })

  const pendingCount  = data.filter(d => d.status === 'pending').length
  const overdueCount  = data.filter(d => ['approved','active'].includes(d.status) && d.perkiraan_kembali && new Date(d.perkiraan_kembali + 'T00:00:00') < new Date()).length
  const jenisColor = {
    Sekolah:    'bg-blue-50 text-blue-600 border-blue-100',
    Organisasi: 'bg-orange-50 text-orange-600 border-orange-100',
    Eksternal:  'bg-purple-50 text-purple-600 border-purple-100',
  }

  const resolveNamas = (ids) => {
    if (!Array.isArray(ids) || ids.length === 0) return null
    return ids.map(id => inventaris.find(i => i.id === id)?.nama_alat).filter(Boolean)
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Peminjaman</h1>
          <p className="text-slate-500 text-sm mt-0.5">Kelola peminjaman alat studio Creative Corner</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {pendingCount > 0 && profile?.role === 'admin' && (
            <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1.5 rounded-lg text-xs font-semibold">
              <AlertCircle className="w-3.5 h-3.5" />
              {pendingCount} menunggu approval
            </div>
          )}
          {overdueCount > 0 && (
            <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-700 px-3 py-1.5 rounded-lg text-xs font-semibold">
              <Clock className="w-3.5 h-3.5" />
              {overdueCount} terlambat
            </div>
          )}
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-colors">
            <Plus className="w-4 h-4" /> Buat Peminjaman
          </button>
        </div>
      </div>

      {/* H-1 Reminder Panel */}
      {h1List.length > 0 && profile?.role === 'admin' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="w-4 h-4 text-amber-600" />
            <p className="text-sm font-bold text-amber-800">
              Pengingat H-1 — {h1List.length} peminjaman jatuh tempo besok ({tomorrow})
            </p>
          </div>
          <div className="space-y-2">
            {h1List.map(row => (
              <div key={row.id} className="bg-white border border-amber-100 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{row.nama_kegiatan}</p>
                  <p className="text-xs text-slate-500">
                    {row.nama_peminjam}
                    {row.jam_pengembalian ? ` · Kembali pukul ${row.jam_pengembalian.slice(0,5)}` : ''}
                    {row.token ? ` · Token: ${row.token}` : ''}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {row.no_telepon && (
                    <button onClick={() => sendWAReminder(row)}
                      className="flex items-center gap-1.5 text-xs bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 px-3 py-1.5 rounded-lg font-medium transition-colors">
                      <MessageCircle className="w-3.5 h-3.5" /> WA
                    </button>
                  )}
                  {row.email_peminjam && (
                    <button onClick={() => sendEmail(row, 'reminder')}
                      className="flex items-center gap-1.5 text-xs bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 px-3 py-1.5 rounded-lg font-medium transition-colors">
                      <Mail className="w-3.5 h-3.5" /> Email
                    </button>
                  )}
                  {!row.no_telepon && !row.email_peminjam && (
                    <span className="text-xs text-slate-400 italic">Tidak ada kontak</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 mb-5">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-44">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Cari kegiatan atau peminjam..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {['Semua','Sekolah','Organisasi','Eksternal'].map(j => (
              <button key={j} onClick={() => setFilterJenis(j)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filterJenis === j ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {j}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {['Semua','pending','approved','returned','rejected','Terlambat'].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  filterStatus === s
                    ? s === 'Terlambat' ? 'bg-red-600 text-white' : 'bg-slate-700 text-white'
                    : s === 'Terlambat' ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}>
                {s === 'Semua' ? 'Semua Status' : s === 'Terlambat' ? `🔴 Terlambat${overdueCount > 0 ? ` (${overdueCount})` : ''}` : STATUS_CONFIG[s]?.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center text-slate-400">
            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm">Memuat data...</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-100 shadow-sm">
          <Package className="w-12 h-12 mx-auto mb-3 text-slate-200" />
          <p className="text-slate-400 font-medium">Tidak ada data ditemukan</p>
          <p className="text-slate-300 text-sm mt-1">Ubah filter atau buat peminjaman baru</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(row => {
            const isOpen = expanded === row.id
            const namaAlat = resolveNamas(row.items_dipinjam)
            const overdueInfo = getOverdueInfo(row)
            const fine = calcFine(row)
            const blacklisted = isBlacklisted(row)
            const konflikList = row.status === 'pending' ? getKonflikItems(row) : []
            return (
              <div key={row.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden ${overdueInfo?.isOver ? 'border-red-200' : overdueInfo?.isToday || overdueInfo?.isNear ? 'border-amber-200' : 'border-slate-100'}`}>
                <div className="px-5 py-4 flex items-center gap-4 cursor-pointer hover:bg-slate-50/60 transition-colors"
                  onClick={() => setExpanded(isOpen ? null : row.id)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${jenisColor[row.jenis_acara]}`}>
                        {row.jenis_acara}
                      </span>
                      {row.asal_organisasi && (
                        <span className="text-xs text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded-full">
                          🏢 {row.asal_organisasi}
                        </span>
                      )}
                      {overdueInfo?.isOver && (
                        <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {overdueInfo.label}
                          {fine > 0 && ` · Denda Rp${fine.toLocaleString('id-ID')}`}
                        </span>
                      )}
                      {(overdueInfo?.isToday || overdueInfo?.isNear) && (
                        <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                          ⚠ {overdueInfo.label}
                        </span>
                      )}
                      {blacklisted && (
                        <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                          🚫 Daftar Hitam
                        </span>
                      )}
                      {konflikList.length > 0 && (
                        <span className="text-xs font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                          ⚠️ Konflik Alat
                        </span>
                      )}
                      <p className="font-semibold text-slate-800 text-sm">{row.nama_kegiatan}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                      <span>👤 {row.nama_peminjam}</span>
                      <span>📅 {row.tanggal}</span>
                      {row.durasi_hari && <span>⏱ {row.durasi_hari} hari</span>}
                      {row.jam_peminjaman && (
                        <span>⬆️ Ambil: <strong className="text-slate-600">{row.jam_peminjaman.slice(0,5)}</strong></span>
                      )}
                      {row.perkiraan_kembali && (
                        <span>🔄 Est. kembali: <strong className="text-slate-600">
                          {row.perkiraan_kembali}{row.jam_pengembalian ? ` · ${row.jam_pengembalian.slice(0,5)}` : ''}
                        </strong></span>
                      )}
                      {namaAlat && namaAlat.length > 0 && (
                        <span className="text-purple-500 font-medium">
                          📦 {namaAlat.slice(0, 2).join(', ')}{namaAlat.length > 2 ? ` +${namaAlat.length - 2} alat` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <StatusBadge status={row.status} />
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </div>
                </div>

                {isOpen && (
                  <div className="px-5 pb-5 border-t border-slate-50 pt-4">
                    <div className="grid sm:grid-cols-2 gap-5">
                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Alat Dipinjam</p>
                        {namaAlat && namaAlat.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {namaAlat.map((nama, i) => (
                              <span key={i} className="text-xs bg-purple-50 text-purple-700 border border-purple-100 px-2.5 py-1 rounded-lg font-medium">{nama}</span>
                            ))}
                          </div>
                        ) : (
                          <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans bg-slate-50 rounded-xl p-3 leading-relaxed border border-slate-100">
                            {row.detail_barang}
                          </pre>
                        )}
                        {row.detail_barang?.includes('Catatan:') && (
                          <p className="text-xs text-slate-500 mt-2 italic bg-amber-50 px-3 py-2 rounded-lg border border-amber-100">
                            📝 {row.detail_barang.split('Catatan:')[1]?.trim()}
                          </p>
                        )}
                      </div>
                      <div className="space-y-4">
                        {row.asal_organisasi && (
                          <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Dari</p>
                            <p className="text-sm text-slate-700">🏢 {row.asal_organisasi}</p>
                          </div>
                        )}
                        {(row.no_telepon || row.email_peminjam) && (
                          <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Kontak</p>
                            {row.no_telepon && <p className="text-sm text-slate-700">📱 {row.no_telepon}</p>}
                            {row.email_peminjam && (
                              <p className="text-sm text-slate-700 mt-0.5">📧 {row.email_peminjam}</p>
                            )}
                          </div>
                        )}
                        {row.email_peminjam && profile?.role === 'admin' && (
                          <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Notifikasi Email</p>
                            <div className="flex flex-wrap gap-2">
                              {row.status === 'approved' && (
                                <button onClick={() => sendEmail(row, 'approved')}
                                  className="flex items-center gap-1.5 text-xs bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 px-3 py-1.5 rounded-lg font-medium transition-colors">
                                  <Mail className="w-3.5 h-3.5" /> Email Persetujuan
                                </button>
                              )}
                              {row.status === 'rejected' && (
                                <button onClick={() => sendEmail(row, 'rejected')}
                                  className="flex items-center gap-1.5 text-xs bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 px-3 py-1.5 rounded-lg font-medium transition-colors">
                                  <Mail className="w-3.5 h-3.5" /> Email Penolakan
                                </button>
                              )}
                              {['approved', 'active'].includes(row.status) && (
                                <button onClick={() => sendEmail(row, 'reminder')}
                                  className="flex items-center gap-1.5 text-xs bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 px-3 py-1.5 rounded-lg font-medium transition-colors">
                                  <Mail className="w-3.5 h-3.5" /> Email Pengingat
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                        {(row.jam_peminjaman || row.jam_acara || row.jam_pengembalian) && (
                          <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Jadwal Waktu</p>
                            <div className="bg-slate-50 rounded-xl border border-slate-100 divide-y divide-slate-100">
                              {row.jam_peminjaman && (
                                <div className="flex items-center justify-between px-3 py-2">
                                  <span className="text-xs text-slate-500">⬆️ Jam pengambilan alat</span>
                                  <span className="text-xs font-bold text-slate-700">{row.jam_peminjaman.slice(0,5)}</span>
                                </div>
                              )}
                              {row.jam_acara && (
                                <div className="flex items-center justify-between px-3 py-2">
                                  <span className="text-xs text-slate-500">🎬 Jam mulai acara</span>
                                  <span className="text-xs font-bold text-slate-700">{row.jam_acara.slice(0,5)}</span>
                                </div>
                              )}
                              {row.jam_pengembalian && (
                                <div className="flex items-center justify-between px-3 py-2">
                                  <span className="text-xs text-slate-500">⬇️ Jam pengembalian alat</span>
                                  <span className="text-xs font-bold text-emerald-700">{row.jam_pengembalian.slice(0,5)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        {(row.foto_identitas || row.lampiran_bukti) && (
                          <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Dokumen</p>
                            <div className="flex flex-wrap gap-2">
                              {row.foto_identitas && (
                                <a href={row.foto_identitas} target="_blank" rel="noreferrer"
                                  className="group block w-24 rounded-xl overflow-hidden border-2 border-purple-100 hover:border-purple-400 transition-all">
                                  {/\.(jpg|jpeg|png|webp|gif)$/i.test(row.foto_identitas) ? (
                                    <img src={row.foto_identitas} alt="Identitas"
                                      className="w-full h-20 object-cover group-hover:scale-105 transition-transform" />
                                  ) : (
                                    <div className="w-full h-20 bg-purple-50 flex flex-col items-center justify-center">
                                      <CreditCard className="w-6 h-6 text-purple-400 mb-1" />
                                      <span className="text-xs text-purple-500 font-medium">PDF</span>
                                    </div>
                                  )}
                                  <p className="text-xs text-center text-purple-600 font-medium py-1 bg-purple-50">Identitas</p>
                                </a>
                              )}
                              {row.lampiran_bukti && (
                                <a href={row.lampiran_bukti} target="_blank" rel="noreferrer"
                                  className="group block w-24 rounded-xl overflow-hidden border-2 border-blue-100 hover:border-blue-400 transition-all">
                                  {/\.(jpg|jpeg|png|webp|gif)$/i.test(row.lampiran_bukti) ? (
                                    <img src={row.lampiran_bukti} alt="Lampiran"
                                      className="w-full h-20 object-cover group-hover:scale-105 transition-transform" />
                                  ) : (
                                    <div className="w-full h-20 bg-blue-50 flex flex-col items-center justify-center">
                                      <Upload className="w-6 h-6 text-blue-400 mb-1" />
                                      <span className="text-xs text-blue-500 font-medium">PDF</span>
                                    </div>
                                  )}
                                  <p className="text-xs text-center text-blue-600 font-medium py-1 bg-blue-50">Lampiran</p>
                                </a>
                              )}
                            </div>
                          </div>
                        )}
                        {row.token && (
                          <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Token Pengembalian</p>
                            <div className="flex items-center gap-2">
                              <code className="text-base font-bold tracking-[0.25em] bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-lg">
                                {row.token}
                              </code>
                              <span className="text-xs text-slate-400">Gunakan di /kembali</span>
                            </div>
                          </div>
                        )}
                        {overdueInfo?.isOver && (
                          <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-1">
                            <p className="text-xs font-bold text-red-700">🔴 {overdueInfo.label}</p>
                            {fine > 0 ? (
                              <>
                                <p className="text-xs text-red-600">Total denda: <strong>Rp{fine.toLocaleString('id-ID')}</strong></p>
                                <p className="text-xs text-red-400">({overdueInfo.days} hari × total denda per hari dari alat yang dipinjam)</p>
                              </>
                            ) : (
                              <p className="text-xs text-red-400">Tidak ada denda yang dikonfigurasi untuk alat ini.</p>
                            )}
                          </div>
                        )}
                        {(overdueInfo?.isToday || overdueInfo?.isNear) && !overdueInfo?.isOver && (
                          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                            <p className="text-xs font-semibold text-amber-700">⚠ {overdueInfo.label}</p>
                            <p className="text-xs text-amber-500 mt-0.5">Harap segera koordinasi pengembalian alat.</p>
                          </div>
                        )}
                        {blacklisted && (
                          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                            <p className="text-xs font-bold text-red-700">🚫 Peminjam dalam Daftar Hitam</p>
                            <p className="text-xs text-red-500 mt-0.5">Pertimbangkan kembali sebelum menyetujui peminjaman ini.</p>
                          </div>
                        )}
                        {konflikList.length > 0 && (
                          <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 space-y-1.5">
                            <p className="text-xs font-bold text-orange-700">⚠️ Konflik Jadwal Alat</p>
                            <p className="text-xs text-orange-600">Alat yang diminta sudah disetujui untuk peminjaman lain pada tanggal yang sama:</p>
                            {konflikList.map(k => (
                              <div key={k.id} className="text-xs bg-white border border-orange-100 rounded-lg px-2.5 py-1.5">
                                <p className="font-semibold text-slate-700">{k.nama_kegiatan}</p>
                                <p className="text-slate-400">{k.tanggal}{k.perkiraan_kembali && k.perkiraan_kembali !== k.tanggal ? ` s/d ${k.perkiraan_kembali}` : ''} · {k.nama_peminjam}</p>
                              </div>
                            ))}
                          </div>
                        )}
                        {profile?.role === 'admin' && (
                          <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Aksi Admin</p>
                            <div className="flex gap-2 flex-wrap">
                              {row.status === 'pending' && <>
                                <button onClick={() => handleApprove(row.id, 'approve')}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 transition-colors">
                                  <CheckCircle className="w-3.5 h-3.5" /> Approve
                                </button>
                                <button onClick={() => handleApprove(row.id, 'reject')}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-semibold hover:bg-red-600 transition-colors">
                                  <X className="w-3.5 h-3.5" /> Tolak
                                </button>
                              </>}
                              <button onClick={() => handleDelete(row.id)}
                                className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-200 transition-colors">
                                Hapus
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showForm && (
        <PeminjamanForm
          onClose={() => setShowForm(false)}
          onSuccess={() => { setShowForm(false); fetchData(); fetchInventaris() }}
        />
      )}
    </div>
  )
}
