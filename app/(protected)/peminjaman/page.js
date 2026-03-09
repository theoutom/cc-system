'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import {
  Plus, X, Upload, Package, Phone, CalendarCheck,
  User, CreditCard, School, Search, ChevronDown, CheckCircle,
  AlertCircle, Camera, Layers, Battery, MemoryStick, Tag, Info,
  Lock, Clock
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

// Ikon per kategori alat
const KATEGORI_ICON = {
  'Kamera':   <Camera className="w-5 h-5" />,
  'Lensa':    <Layers className="w-5 h-5" />,
  'Aksesori': <Tag className="w-5 h-5" />,
}

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

// ─── Grid Pemilihan Alat ────────────────────────────────────
function InventarisGrid({ inventaris, selectedIds, onToggle }) {
  const [filterKategori, setFilterKategori] = useState('Semua')

  const kategoris = ['Semua', ...new Set(inventaris.map(i => i.kategori))]

  const filtered = inventaris.filter(item =>
    filterKategori === 'Semua' || item.kategori === filterKategori
  )

  // Kelompokkan per kategori
  const grouped = filtered.reduce((acc, item) => {
    const k = item.kategori || 'Lainnya'
    if (!acc[k]) acc[k] = []
    acc[k].push(item)
    return acc
  }, {})

  return (
    <div>
      {/* Filter tab kategori */}
      <div className="flex gap-1.5 flex-wrap mb-4">
        {kategoris.map(k => (
          <button key={k} type="button" onClick={() => setFilterKategori(k)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
              filterKategori === k ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}>
            {k}
          </button>
        ))}
      </div>

      {/* Grid alat per kategori */}
      <div className="space-y-4">
        {Object.entries(grouped).map(([kategori, items]) => (
          <div key={kategori}>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-slate-400">{KATEGORI_ICON[kategori] || <Tag className="w-4 h-4" />}</span>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">{kategori}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {items.map(item => {
                const isSelected = selectedIds.includes(item.id)
                const isBusy = item.status === 'Dipinjam'
                const peminjamanInfo = item._peminjamanAktif

                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={isBusy}
                    onClick={() => !isBusy && onToggle(item.id)}
                    className={`relative text-left p-3 rounded-xl border-2 transition-all ${
                      isBusy
                        ? 'border-slate-200 bg-slate-50 opacity-80 cursor-not-allowed'
                        : isSelected
                          ? 'border-purple-500 bg-purple-50 shadow-sm'
                          : 'border-slate-200 bg-white hover:border-purple-300 hover:bg-purple-50/30'
                    }`}
                  >
                    {/* Checkmark jika terpilih */}
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-5 h-5 bg-purple-600 rounded-full flex items-center justify-center">
                        <CheckCircle className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}

                    {/* Lock jika dipinjam */}
                    {isBusy && (
                      <div className="absolute top-2 right-2 w-5 h-5 bg-red-400 rounded-full flex items-center justify-center">
                        <Lock className="w-3 h-3 text-white" />
                      </div>
                    )}

                    <p className={`text-sm font-semibold leading-tight pr-6 ${
                      isBusy ? 'text-slate-400' : isSelected ? 'text-purple-800' : 'text-slate-700'
                    }`}>
                      {item.nama_alat}
                    </p>

                    {/* Kondisi badge */}
                    <span className={`inline-block mt-1.5 text-xs px-1.5 py-0.5 rounded-md font-medium ${
                      item.kondisi === 'Baik'
                        ? 'bg-green-100 text-green-700'
                        : item.kondisi === 'Rusak Ringan'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-600'
                    }`}>
                      {item.kondisi}
                    </span>

                    {/* Info dipinjam */}
                    {isBusy && (
                      <div className="mt-2 space-y-0.5">
                        <div className="flex items-center gap-1 text-xs text-red-500 font-semibold">
                          <Lock className="w-3 h-3" /> Sedang Dipinjam
                        </div>
                        {peminjamanInfo && (
                          <>
                            <p className="text-xs text-slate-400 leading-tight">
                              📌 {peminjamanInfo.nama_kegiatan}
                            </p>
                            {peminjamanInfo.perkiraan_kembali && (
                              <p className="text-xs text-slate-400 leading-tight">
                                🔄 Est. kembali: <span className="font-semibold text-slate-500">{
                                  new Date(peminjamanInfo.perkiraan_kembali + 'T00:00:00').toLocaleDateString('id-ID', {
                                    day: 'numeric', month: 'short', year: 'numeric'
                                  })
                                }</span>
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-8 text-slate-400">
          <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Tidak ada alat di kategori ini</p>
        </div>
      )}
    </div>
  )
}

// ─── Form Peminjaman ────────────────────────────────────────
function PeminjamanForm({ onClose, onSuccess }) {
  const supabase = createClient()
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [customDurasi, setCustomDurasi] = useState(false)
  const [inventaris, setInventaris] = useState([])
  const [loadingInventaris, setLoadingInventaris] = useState(true)

  const [form, setForm] = useState({
    jenis_acara: 'Sekolah',
    nama_kegiatan: '',
    tanggal: '',
    nama_peminjam: '',
    no_telepon: '',
    selected_items: [],   // array of inventaris IDs
    catatan_barang: '',   // deskripsi opsional
    durasi_hari: 1,
    perkiraan_kembali: '',
    lampiran_bukti: null,
    foto_identitas: null,
  })

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

  // Fetch inventaris + info peminjaman aktif
  useEffect(() => {
    const fetchInventaris = async () => {
      setLoadingInventaris(true)

      // Ambil semua alat
      const { data: items } = await supabase
        .from('inventaris')
        .select('*')
        .order('kategori')
        .order('nama_alat')

      // Ambil peminjaman yang aktif (approved/active, belum dikembalikan)
      const { data: peminjamanAktif } = await supabase
        .from('peminjaman')
        .select('id, nama_kegiatan, perkiraan_kembali, items_dipinjam')
        .in('status', ['approved', 'active'])

      // Buat map: inventaris_id -> info peminjaman
      const busyMap = {}
      if (peminjamanAktif) {
        peminjamanAktif.forEach(p => {
          if (Array.isArray(p.items_dipinjam)) {
            p.items_dipinjam.forEach(itemId => {
              busyMap[itemId] = {
                nama_kegiatan: p.nama_kegiatan,
                perkiraan_kembali: p.perkiraan_kembali,
              }
            })
          }
        })
      }

      // Gabungkan status real-time dari peminjaman aktif
      const enriched = (items || []).map(item => ({
        ...item,
        // Override status jika ada di busyMap (dari peminjaman aktif)
        status: busyMap[item.id] ? 'Dipinjam' : item.status,
        _peminjamanAktif: busyMap[item.id] || null,
      }))

      setInventaris(enriched)
      setLoadingInventaris(false)
    }
    fetchInventaris()
  }, [])

  const validateStep = () => {
    if (step === 0 && (!form.jenis_acara || !form.nama_kegiatan || !form.tanggal)) return false
    if (step === 1 && !form.nama_peminjam) return false
    if (step === 1 && needsPhone && !form.no_telepon) return false
    if (step === 2 && form.selected_items.length === 0) return false
    return true
  }

  const handleNext = () => {
    if (!validateStep()) {
      if (step === 2 && form.selected_items.length === 0) {
        alert('Pilih minimal 1 alat untuk dipinjam')
      } else {
        alert('Harap lengkapi semua field yang wajib (*)')
      }
      return
    }
    setStep(s => s + 1)
  }

  // Buat daftar nama alat terpilih (untuk kolom detail_barang)
  const selectedNamas = form.selected_items
    .map(id => inventaris.find(i => i.id === id)?.nama_alat)
    .filter(Boolean)

  const handleSubmit = async () => {
    setSubmitting(true)
    const { data: { user } } = await supabase.auth.getUser()

    const uploadFile = async (file, prefix) => {
      if (!file) return null
      const ext = file.name.split('.').pop()
      const path = `${prefix}-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('lampiran').upload(path, file)
      if (error) return null
      return supabase.storage.from('lampiran').getPublicUrl(path).data?.publicUrl
    }

    const lampiran_url  = !isSekolah ? await uploadFile(form.lampiran_bukti, 'bukti') : null
    const identitas_url = !isSekolah ? await uploadFile(form.foto_identitas, 'id')    : null

    // Gabung nama alat + catatan opsional
    const detail = selectedNamas.join('\n') + (form.catatan_barang ? `\n\nCatatan: ${form.catatan_barang}` : '')

    await supabase.from('peminjaman').insert({
      jenis_acara: form.jenis_acara,
      nama_kegiatan: form.nama_kegiatan,
      tanggal: form.tanggal,
      nama_peminjam: form.nama_peminjam,
      no_telepon: needsPhone ? form.no_telepon : null,
      detail_barang: detail,
      items_dipinjam: form.selected_items,   // array UUID inventaris
      durasi_hari: Number(form.durasi_hari),
      perkiraan_kembali: form.perkiraan_kembali || null,
      lampiran_bukti: lampiran_url,
      foto_identitas: identitas_url,
      status: 'pending',
      created_by: user?.id,
    })

    setSubmitting(false)
    onSuccess()
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[95vh]">

        {/* Header sticky */}
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

        {/* Body scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* STEP 0 — Jenis & Kegiatan */}
          {step === 0 && <>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Jenis Kegiatan *</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { j: 'Sekolah',    icon: '🏫', desc: 'Kegiatan resmi sekolah' },
                  { j: 'Organisasi', icon: '🎯', desc: 'Ekskul / Organisasi' },
                  { j: 'Eksternal',  icon: '🌐', desc: 'Pribadi / Luar sekolah' },
                ].map(({ j, icon, desc }) => (
                  <button key={j} type="button" onClick={() => set('jenis_acara', j)}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${form.jenis_acara === j ? 'border-purple-500 bg-purple-50' : 'border-slate-200 hover:border-purple-300'}`}>
                    <div className="text-2xl mb-1">{icon}</div>
                    <p className={`text-sm font-semibold ${form.jenis_acara === j ? 'text-purple-700' : 'text-slate-700'}`}>{j}</p>
                    <p className="text-xs text-slate-400 mt-0.5 leading-tight">{desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nama Kegiatan *</label>
              <input value={form.nama_kegiatan} onChange={e => set('nama_kegiatan', e.target.value)}
                placeholder="cth: Peskil Day 1 Kelas XII"
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tanggal Pemakaian *</label>
              <input type="date" value={form.tanggal} onChange={e => set('tanggal', e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </>}

          {/* STEP 1 — Detail Peminjam */}
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
                  <input type="tel" value={form.no_telepon} onChange={e => set('no_telepon', e.target.value)}
                    placeholder="cth: 08123456789"
                    className="w-full pl-10 pr-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">📱 Akan dihubungi jika ada keperluan mendesak</p>
              </div>
            )}

            {isSekolah && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <p className="text-sm font-semibold text-blue-800 mb-1">ℹ️ Kegiatan Sekolah</p>
                <p className="text-xs text-blue-600">Peminjaman untuk kegiatan sekolah tidak memerlukan nomor telepon dan dokumen identitas.</p>
              </div>
            )}
          </>}

          {/* STEP 2 — Pilih Alat */}
          {step === 2 && <>
            {/* Durasi dulu */}
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
                    <p className="text-xs text-emerald-600">Perkiraan kembali:</p>
                    <p className="text-sm font-bold text-emerald-700">
                      {new Date(form.perkiraan_kembali + 'T00:00:00').toLocaleDateString('id-ID', {
                        weekday: 'short', day: 'numeric', month: 'long', year: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-slate-100" />

            {/* Grid alat */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold text-slate-700">
                  Pilih Alat yang Dipinjam *
                </label>
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
                <InventarisGrid
                  inventaris={inventaris}
                  selectedIds={form.selected_items}
                  onToggle={toggleItem}
                />
              )}
            </div>

            {/* Catatan opsional */}
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

          {/* STEP 3 — Dokumen & Ringkasan */}
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
                  <span>Dokumen identitas wajib untuk peminjam <strong>{form.jenis_acara}</strong></span>
                </div>

                {/* Foto identitas */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">{identityLabel} *</label>
                  <label className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                    form.foto_identitas ? 'border-green-400 bg-green-50' : 'border-slate-300 hover:border-purple-400 hover:bg-purple-50'
                  }`}>
                    {form.foto_identitas ? (
                      <><CheckCircle className="w-7 h-7 text-green-500 mb-1.5" />
                        <p className="text-sm font-medium text-green-700">{form.foto_identitas.name}</p>
                        <p className="text-xs text-green-500">Klik untuk ganti</p>
                      </>
                    ) : (
                      <><CreditCard className="w-7 h-7 text-slate-300 mb-1.5" />
                        <p className="text-sm text-slate-500 font-medium">Klik untuk upload foto</p>
                        <p className="text-xs text-slate-400 mt-0.5">JPG, PNG · Maks. 5MB</p>
                      </>
                    )}
                    <input type="file" accept="image/*" className="hidden"
                      onChange={e => set('foto_identitas', e.target.files[0] || null)} />
                  </label>
                </div>

                {/* Lampiran opsional */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Lampiran Bukti Kegiatan <span className="text-slate-400 font-normal">(opsional)</span>
                  </label>
                  <label className={`flex flex-col items-center justify-center w-full h-20 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                    form.lampiran_bukti ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-blue-400 hover:bg-blue-50'
                  }`}>
                    {form.lampiran_bukti
                      ? <><CheckCircle className="w-5 h-5 text-blue-500 mb-1" /><p className="text-xs font-medium text-blue-700">{form.lampiran_bukti.name}</p></>
                      : <><Upload className="w-5 h-5 text-slate-300 mb-1" /><p className="text-xs text-slate-500">Screenshot undangan / surat kegiatan</p></>
                    }
                    <input type="file" accept="image/*,.pdf" className="hidden"
                      onChange={e => set('lampiran_bukti', e.target.files[0] || null)} />
                  </label>
                </div>
              </>
            )}

            {/* Ringkasan alat terpilih */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <p className="font-semibold text-slate-700 text-sm mb-3">📋 Ringkasan Peminjaman</p>
              <div className="space-y-1.5 text-xs mb-3">
                {[
                  ['Kegiatan', `${form.nama_kegiatan} (${form.jenis_acara})`],
                  ['Peminjam', form.nama_peminjam],
                  ...(needsPhone ? [['No. HP', form.no_telepon]] : []),
                  ['Tanggal', form.tanggal],
                  ['Durasi', `${form.durasi_hari} hari`],
                  ['Est. kembali', form.perkiraan_kembali],
                ].map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <span className="text-slate-400 w-24 flex-shrink-0">{k}</span>
                    <span className="text-slate-700 font-medium">{v}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-200 pt-3">
                <p className="text-xs font-semibold text-slate-500 mb-1.5">Alat yang Dipinjam ({selectedNamas.length} item):</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedNamas.map((nama, i) => (
                    <span key={i} className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-lg font-medium">
                      {nama}
                    </span>
                  ))}
                </div>
                {form.catatan_barang && (
                  <p className="text-xs text-slate-500 mt-2 italic">📝 Catatan: {form.catatan_barang}</p>
                )}
              </div>
            </div>
          </>}

        </div>

        {/* Footer navigation */}
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

// ─── Main Page ──────────────────────────────────────────────
export default function PeminjamanPage() {
  const supabase = createClient()
  const [data, setData]           = useState([])
  const [inventaris, setInventaris] = useState([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [profile, setProfile]     = useState(null)
  const [filterJenis, setFilterJenis]   = useState('Semua')
  const [filterStatus, setFilterStatus] = useState('Semua')
  const [search, setSearch]       = useState('')
  const [expanded, setExpanded]   = useState(null)

  useEffect(() => { fetchData(); fetchProfile(); fetchInventaris() }, [])

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(p)
    }
  }

  const fetchInventaris = async () => {
    const { data: items } = await supabase.from('inventaris').select('id, nama_alat, kategori')
    setInventaris(items || [])
  }

  const fetchData = async () => {
    setLoading(true)
    const { data: pem } = await supabase
      .from('peminjaman')
      .select('*')
      .order('created_at', { ascending: false })
    setData(pem || [])
    setLoading(false)
  }

  const handleApprove = async (id, action) => {
    const { data: { user } } = await supabase.auth.getUser()

    // Jika approve: update status peminjaman, lalu update status alat di inventaris
    if (action === 'approve') {
      const pem = data.find(d => d.id === id)

      await supabase.from('peminjaman').update({
        status: 'approved',
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
      }).eq('id', id)

      // Update status alat jadi 'Dipinjam'
      if (Array.isArray(pem?.items_dipinjam) && pem.items_dipinjam.length > 0) {
        await supabase
          .from('inventaris')
          .update({ status: 'Dipinjam' })
          .in('id', pem.items_dipinjam)
      }
    } else {
      await supabase.from('peminjaman').update({
        status: 'rejected',
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
      }).eq('id', id)
    }

    fetchData()
  }

  const handleDelete = async (id) => {
    if (!confirm('Yakin hapus data ini?')) return
    // Kembalikan status alat ke Tersedia dulu
    const pem = data.find(d => d.id === id)
    if (Array.isArray(pem?.items_dipinjam) && pem.items_dipinjam.length > 0) {
      await supabase
        .from('inventaris')
        .update({ status: 'Tersedia' })
        .in('id', pem.items_dipinjam)
    }
    await supabase.from('peminjaman').delete().eq('id', id)
    fetchData()
  }

  const filtered = data.filter(d => {
    const j = filterJenis === 'Semua' || d.jenis_acara === filterJenis
    const s = filterStatus === 'Semua' || d.status === filterStatus
    const q = !search ||
      d.nama_kegiatan?.toLowerCase().includes(search.toLowerCase()) ||
      d.nama_peminjam?.toLowerCase().includes(search.toLowerCase())
    return j && s && q
  })

  const pendingCount = data.filter(d => d.status === 'pending').length
  const jenisColor = {
    Sekolah:    'bg-blue-50 text-blue-600 border-blue-100',
    Organisasi: 'bg-orange-50 text-orange-600 border-orange-100',
    Eksternal:  'bg-purple-50 text-purple-600 border-purple-100',
  }

  // Helper: resolve nama alat dari UUID array
  const resolveNamas = (ids) => {
    if (!Array.isArray(ids) || ids.length === 0) return null
    return ids
      .map(id => inventaris.find(i => i.id === id)?.nama_alat)
      .filter(Boolean)
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
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-colors">
            <Plus className="w-4 h-4" /> Buat Peminjaman
          </button>
        </div>
      </div>

      {/* Filter bar */}
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
            {['Semua','pending','approved','returned','rejected'].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filterStatus === s ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {s === 'Semua' ? 'Semua Status' : STATUS_CONFIG[s]?.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* List */}
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

            return (
              <div key={row.id} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 flex items-center gap-4 cursor-pointer hover:bg-slate-50/60 transition-colors"
                  onClick={() => setExpanded(isOpen ? null : row.id)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${jenisColor[row.jenis_acara]}`}>
                        {row.jenis_acara}
                      </span>
                      <p className="font-semibold text-slate-800 text-sm">{row.nama_kegiatan}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                      <span>👤 {row.nama_peminjam}</span>
                      <span>📅 {row.tanggal}</span>
                      {row.durasi_hari && <span>⏱ {row.durasi_hari} hari</span>}
                      {row.perkiraan_kembali && (
                        <span>🔄 Est. kembali: <strong className="text-slate-600">{row.perkiraan_kembali}</strong></span>
                      )}
                      {/* Preview alat yang dipinjam */}
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
                              <span key={i} className="text-xs bg-purple-50 text-purple-700 border border-purple-100 px-2.5 py-1 rounded-lg font-medium">
                                {nama}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans bg-slate-50 rounded-xl p-3 leading-relaxed border border-slate-100">
                            {row.detail_barang}
                          </pre>
                        )}
                        {/* Catatan */}
                        {row.detail_barang?.includes('Catatan:') && (
                          <p className="text-xs text-slate-500 mt-2 italic bg-amber-50 px-3 py-2 rounded-lg border border-amber-100">
                            📝 {row.detail_barang.split('Catatan:')[1]?.trim()}
                          </p>
                        )}
                      </div>
                      <div className="space-y-4">
                        {row.no_telepon && (
                          <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Kontak</p>
                            <p className="text-sm text-slate-700">📱 {row.no_telepon}</p>
                          </div>
                        )}
                        {row.foto_identitas && (
                          <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Dokumen Identitas</p>
                            <a href={row.foto_identitas} target="_blank" rel="noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-purple-600 bg-purple-50 hover:bg-purple-100 px-3 py-2 rounded-lg font-medium transition-colors">
                              <CreditCard className="w-3.5 h-3.5" /> Lihat Kartu Identitas
                            </a>
                          </div>
                        )}
                        {row.lampiran_bukti && (
                          <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Lampiran</p>
                            <a href={row.lampiran_bukti} target="_blank" rel="noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg font-medium transition-colors">
                              <Upload className="w-3.5 h-3.5" /> Lihat Lampiran
                            </a>
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

      {showForm && <PeminjamanForm onClose={() => setShowForm(false)} onSuccess={() => { setShowForm(false); fetchData(); fetchInventaris() }} />}
    </div>
  )
}
