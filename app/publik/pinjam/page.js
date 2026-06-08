'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import {
  Camera, CheckCircle, X, Phone, Upload, CreditCard,
  CalendarCheck, Package, ChevronLeft,
  Building2, User, School
} from 'lucide-react'
import { InventarisGrid } from '@/components/InventarisGrid'

const DURASI_OPTIONS = [
  { label: '1 jam',    value: 0.04 },
  { label: '2 jam',    value: 0.08 },
  { label: '3 jam',    value: 0.13 },
  { label: '1 hari',   value: 1    },
  { label: '2 hari',   value: 2    },
  { label: '3 hari',   value: 3    },
  { label: '1 minggu', value: 7    },
  { label: 'Custom',   value: 0    },
]

const MAX_FILE_BYTES = 5 * 1024 * 1024

function addDays(dateStr, days) {
  if (!dateStr || !days) return ''
  const d = new Date(dateStr)
  d.setDate(d.getDate() + Number(days))
  return d.toISOString().split('T')[0]
}

// ── Step Indicator ────────────────────────────────────────────
function StepIndicator({ current, steps }) {
  return (
    <div className="flex items-center">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center flex-1 last:flex-none">
          <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all flex-shrink-0 ${
            i < current ? 'bg-purple-600 text-white'
            : i === current ? 'bg-purple-600 text-white ring-4 ring-purple-100'
            : 'bg-slate-100 text-slate-400'
          }`}>
            {i < current ? <CheckCircle className="w-4 h-4" /> : i + 1}
          </div>
          <p className={`ml-1.5 text-xs font-medium hidden sm:block truncate ${i === current ? 'text-slate-800' : 'text-slate-400'}`}>{step}</p>
          {i < steps.length - 1 && (
            <div className={`flex-1 mx-2 h-0.5 min-w-3 ${i < current ? 'bg-purple-600' : 'bg-slate-100'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────
export default function PublikPinjamPage() {
  const supabase = createClient()
  const [step, setStep] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [inventaris, setInventaris] = useState([])
  const [loadingInv, setLoadingInv] = useState(true)
  const [customDurasi, setCustomDurasi] = useState(false)
  const [prevBorrowers, setPrevBorrowers] = useState([])
  const [loadingPrev, setLoadingPrev] = useState(false)

  const [form, setForm] = useState({
    jenis_acara: '',
    nama_kegiatan: '',
    asal_organisasi: '',
    tanggal: '',
    nama_peminjam: '',
    no_telepon: '',
    selected_items: [],
    catatan_barang: '',
    durasi_hari: 1,
    perkiraan_kembali: '',
    lampiran_bukti: null,
    foto_identitas: null,
  })

  const handleJenisChange = async (j) => {
    set('jenis_acara', j)
    set('asal_organisasi', '')
    setPrevBorrowers([])
    if (j === 'Organisasi' || j === 'Eksternal') {
      setLoadingPrev(true)
      const { data } = await supabase
        .from('peminjaman')
        .select('asal_organisasi')
        .eq('jenis_acara', j)
        .not('asal_organisasi', 'is', null)
        .order('created_at', { ascending: false })
        .limit(200)
      const seen = new Set()
      const unique = []
      ;(data || []).forEach(d => {
        const k = (d.asal_organisasi || '').trim()
        if (k && !seen.has(k)) { seen.add(k); unique.push(k) }
      })
      setPrevBorrowers(unique)
      setLoadingPrev(false)
    }
  }

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

  const toggleItem = id => setForm(f => ({
    ...f,
    selected_items: f.selected_items.includes(id)
      ? f.selected_items.filter(x => x !== id)
      : [...f.selected_items, id]
  }))

  const isSekolah    = form.jenis_acara === 'Sekolah'
  const isOrganisasi = form.jenis_acara === 'Organisasi'
  const needsPhone   = !isSekolah
  const needsDocs    = !isSekolah
  const identityLabel = isOrganisasi ? 'Foto Kartu Siswa / Kartu Anggota' : 'Foto KTP / Kartu Identitas'
  const steps = ['Jenis & Kegiatan', 'Data Peminjam', 'Pilih Alat', 'Dokumen']

  useEffect(() => {
    const fetchInv = async () => {
      setLoadingInv(true)
      const { data: items } = await supabase.from('inventaris').select('*').order('kategori').order('nama_alat')
      const { data: aktif } = await supabase.from('peminjaman').select('id, nama_kegiatan, perkiraan_kembali, items_dipinjam').in('status', ['approved', 'active'])
      const busyMap = {}
      if (aktif) aktif.forEach(p => {
        if (Array.isArray(p.items_dipinjam)) p.items_dipinjam.forEach(id => {
          busyMap[id] = { nama_kegiatan: p.nama_kegiatan, perkiraan_kembali: p.perkiraan_kembali }
        })
      })
      setInventaris((items || []).map(item => ({
        ...item,
        status: busyMap[item.id] ? 'Dipinjam' : item.status,
        _peminjamanAktif: busyMap[item.id] || null,
      })))
      setLoadingInv(false)
    }
    fetchInv()
  }, [])

  const validateStep = () => {
    if (step === 0) return !!form.jenis_acara && !!form.nama_kegiatan && !!form.tanggal &&
      (!isOrganisasi || !!form.asal_organisasi) &&
      (form.jenis_acara !== 'Eksternal' || !!form.asal_organisasi)
    if (step === 1) return !!form.nama_peminjam && (!needsPhone || (!!form.no_telepon && form.no_telepon.replace(/\D/g, '').length >= 8))
    if (step === 2) return form.selected_items.length > 0
    return true
  }

  const handleNext = () => {
    if (!validateStep()) {
      if (step === 2 && form.selected_items.length === 0) alert('Pilih minimal 1 alat')
      else alert('Harap lengkapi semua field yang wajib (*)')
      return
    }
    setStep(s => s + 1)
  }

  const selectedNamas = form.selected_items.map(id => inventaris.find(i => i.id === id)?.nama_alat).filter(Boolean)

  const handleSubmit = async () => {
    if (needsDocs) {
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
      if (error) { alert('Gagal upload: ' + error.message); return null }
      return supabase.storage.from('lampiran').getPublicUrl(path).data?.publicUrl
    }

    const identitas_url = needsDocs ? await uploadFile(form.foto_identitas, 'id') : null
    const lampiran_url  = needsDocs ? await uploadFile(form.lampiran_bukti, 'bukti') : null

    const detail = selectedNamas.join('\n') + (form.catatan_barang ? `\n\nCatatan: ${form.catatan_barang}` : '')

    try {
      const { error } = await supabase.from('peminjaman').insert({
        jenis_acara: form.jenis_acara,
        nama_kegiatan: form.nama_kegiatan,
        asal_organisasi: form.asal_organisasi || null,
        tanggal: form.tanggal,
        nama_peminjam: form.nama_peminjam,
        no_telepon: needsPhone ? form.no_telepon : null,
        detail_barang: detail,
        items_dipinjam: form.selected_items,
        durasi_hari: Number(form.durasi_hari),
        perkiraan_kembali: form.perkiraan_kembali || null,
        lampiran_bukti: lampiran_url,
        foto_identitas: identitas_url,
        status: 'pending',
        created_by: null,
      })
      if (error) throw error
      setSubmitted(true)
    } catch (e) {
      alert('Gagal mengirim peminjaman: ' + e.message)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Success screen ─────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-xl text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Permintaan Terkirim!</h2>
          <p className="text-slate-500 text-sm mb-6">Peminjaman kamu sudah masuk dan menunggu persetujuan admin CC. Tunggu konfirmasi ya!</p>
          <div className="bg-slate-50 rounded-xl p-4 text-left text-xs space-y-1.5 mb-6">
            <p className="font-semibold text-slate-700 text-sm mb-2">Ringkasan</p>
            <p className="text-slate-500">Kegiatan: <span className="text-slate-700 font-medium">{form.nama_kegiatan}</span></p>
            <p className="text-slate-500">Peminjam: <span className="text-slate-700 font-medium">{form.nama_peminjam}</span></p>
            <p className="text-slate-500">Alat: <span className="text-slate-700 font-medium">{selectedNamas.join(', ')}</span></p>
          </div>
          <a href="/login" className="block w-full py-2.5 bg-purple-600 text-white font-semibold rounded-xl text-sm hover:bg-purple-700 transition-colors">
            Kembali ke Halaman Utama
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 shadow-sm sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <a href="/login" className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100">
            <ChevronLeft className="w-5 h-5" />
          </a>
          <div className="flex-1">
            <p className="font-bold text-slate-900 text-sm">Form Peminjaman Alat</p>
            <p className="text-xs text-slate-400">Creative Corner · Akses Tamu</p>
          </div>
          <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
            <Camera className="w-4 h-4 text-white" />
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {/* Step indicator */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <StepIndicator current={step} steps={steps} />
        </div>

        {/* Step content */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-5">

          {/* ── STEP 0: Jenis & Kegiatan ── */}
          {step === 0 && <>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Jenis Kegiatan *</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { j: 'Sekolah',    icon: '🏫', desc: 'Kegiatan resmi sekolah' },
                  { j: 'Organisasi', icon: '🎯', desc: 'Ekskul / Organisasi' },
                  { j: 'Eksternal',  icon: '🌐', desc: 'Pribadi / Luar sekolah' },
                ].map(({ j, icon, desc }) => (
                  <button key={j} type="button" onClick={() => handleJenisChange(j)}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${form.jenis_acara === j ? 'border-purple-500 bg-purple-50' : 'border-slate-200 hover:border-purple-300'}`}>
                    <div className="text-2xl mb-1">{icon}</div>
                    <p className={`text-sm font-semibold ${form.jenis_acara === j ? 'text-purple-700' : 'text-slate-700'}`}>{j}</p>
                    <p className="text-xs text-slate-400 mt-0.5 leading-tight">{desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {(isOrganisasi || form.jenis_acara === 'Eksternal') && (
              <div className="space-y-3">
                {/* Previous borrowers dropdown */}
                {loadingPrev ? (
                  <p className="text-xs text-slate-400">Memuat riwayat peminjam...</p>
                ) : prevBorrowers.length > 0 ? (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Pernah Pinjam Sebelumnya?
                    </label>
                    <select
                      defaultValue=""
                      onChange={e => { if (e.target.value) set('asal_organisasi', e.target.value) }}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                    >
                      <option value="">-- Baru / Belum pernah pinjam --</option>
                      {prevBorrowers.map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-400 mt-1">Pilih dari riwayat, atau biarkan dan isi manual di bawah</p>
                  </div>
                ) : null}

                {/* Manual input */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    {prevBorrowers.length > 0
                      ? (isOrganisasi ? 'Konfirmasi / Edit Nama Organisasi *' : 'Konfirmasi / Edit Instansi *')
                      : (isOrganisasi ? 'Nama Organisasi / Ekskul *' : 'Instansi / Pihak *')
                    }
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input value={form.asal_organisasi} onChange={e => set('asal_organisasi', e.target.value)}
                      placeholder={isOrganisasi ? 'cth: OSIS SMA N 1 Solo / Ekskul Fotografi' : 'cth: Pribadi / PT. Contoh Indonesia'}
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {isOrganisasi ? '🎯 Nama lengkap organisasi atau ekskul yang meminjam' : '🌐 Nama instansi, komunitas, atau "Pribadi" jika perorangan'}
                  </p>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nama Kegiatan *</label>
              <input value={form.nama_kegiatan} onChange={e => set('nama_kegiatan', e.target.value)}
                placeholder="cth: Dokumentasi Pentas Seni 2026"
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tanggal Pemakaian *</label>
              <input type="date" value={form.tanggal} onChange={e => set('tanggal', e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </>}

          {/* ── STEP 1: Data Peminjam ── */}
          {step === 1 && <>
            {form.jenis_acara && (
              <div className={`flex items-center gap-2 p-3 rounded-xl text-sm font-medium ${
                isSekolah ? 'bg-blue-50 text-blue-700' : isOrganisasi ? 'bg-orange-50 text-orange-700' : 'bg-purple-50 text-purple-700'
              }`}>
                {isSekolah ? <School className="w-4 h-4 flex-shrink-0" /> : <Building2 className="w-4 h-4 flex-shrink-0" />}
                <span className="truncate">
                  {form.jenis_acara}{form.asal_organisasi ? ` · ${form.asal_organisasi}` : ''} — {form.nama_kegiatan}
                </span>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nama Lengkap Peminjam *</label>
              <input value={form.nama_peminjam} onChange={e => set('nama_peminjam', e.target.value)}
                placeholder="cth: Satrio Wibowo"
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {needsPhone && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nomor WhatsApp *</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={form.no_telepon}
                    onChange={e => set('no_telepon', e.target.value.replace(/[^\d+\s-]/g, ''))}
                    placeholder="cth: 08123456789"
                    pattern="[0-9+\s\-]{8,15}"
                    className="w-full pl-10 pr-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                {form.no_telepon && form.no_telepon.replace(/\D/g, '').length < 8
                  ? <p className="text-xs text-red-500 mt-1">⚠️ Nomor terlalu pendek (min. 8 digit)</p>
                  : <p className="text-xs text-slate-400 mt-1">📱 Untuk dihubungi jika ada keperluan mendesak</p>
                }
              </div>
            )}

            {isSekolah && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <p className="text-sm font-semibold text-blue-800 mb-1">ℹ️ Kegiatan Sekolah</p>
                <p className="text-xs text-blue-600">Peminjaman sekolah tidak memerlukan nomor telepon dan dokumen identitas.</p>
              </div>
            )}
          </>}

          {/* ── STEP 2: Pilih Alat ── */}
          {step === 2 && <>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Lama Peminjaman *</label>
              <div className="grid grid-cols-4 gap-1.5 mb-2">
                {DURASI_OPTIONS.map(opt => (
                  <button key={opt.label} type="button"
                    onClick={() => {
                      if (opt.value === 0) { setCustomDurasi(true) }
                      else { setCustomDurasi(false); set('durasi_hari', opt.value) }
                    }}
                    className={`py-2 px-1 rounded-xl border-2 text-xs font-semibold transition-all text-center ${
                      (opt.value === 0 && customDurasi) || (!customDurasi && form.durasi_hari === opt.value)
                        ? 'border-purple-500 bg-purple-50 text-purple-700'
                        : 'border-slate-200 text-slate-600 hover:border-purple-300'
                    }`}>{opt.label}
                  </button>
                ))}
              </div>
              {customDurasi && (
                <div className="flex items-center gap-3 mb-2">
                  <input type="number" min="1" max="365" value={form.durasi_hari} onChange={e => set('durasi_hari', e.target.value)}
                    className="w-24 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 text-center font-bold"
                  />
                  <span className="text-sm text-slate-600">hari</span>
                </div>
              )}
              {form.tanggal && form.durasi_hari > 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 flex items-center gap-3">
                  <CalendarCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-emerald-600">Perkiraan kembali:</p>
                    <p className="text-sm font-bold text-emerald-700">
                      {new Date(form.perkiraan_kembali + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 pt-4">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold text-slate-700">Pilih Alat *</label>
                {form.selected_items.length > 0 && (
                  <span className="text-xs font-bold bg-purple-600 text-white px-2.5 py-1 rounded-full">
                    {form.selected_items.length} dipilih
                  </span>
                )}
              </div>
              {loadingInv ? (
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
                rows={2} placeholder="cth: Baterai harap disiapkan sudah terisi penuh"
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              />
            </div>
          </>}

          {/* ── STEP 3: Dokumen ── */}
          {step === 3 && <>
            {isSekolah ? (
              <div className="text-center py-4">
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="w-7 h-7 text-green-500" />
                </div>
                <h4 className="font-bold text-slate-800 text-lg mb-1">Siap Dikirim!</h4>
                <p className="text-slate-500 text-sm">Kegiatan sekolah tidak memerlukan upload dokumen.</p>
              </div>
            ) : (
              <>
                <div className={`flex items-center gap-2 p-3 rounded-xl text-sm ${isOrganisasi ? 'bg-orange-50 text-orange-700' : 'bg-purple-50 text-purple-700'}`}>
                  <CreditCard className="w-4 h-4 flex-shrink-0" />
                  <span>Dokumen berikut <strong>wajib</strong> diupload untuk peminjaman {form.jenis_acara}</span>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    {identityLabel} <span className="text-red-500">*</span>
                  </label>
                  <label className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                    form.foto_identitas ? 'border-green-400 bg-green-50' : 'border-red-200 bg-red-50/30 hover:border-purple-400 hover:bg-purple-50'
                  }`}>
                    {form.foto_identitas ? (
                      <><CheckCircle className="w-7 h-7 text-green-500 mb-1" />
                        <p className="text-sm font-medium text-green-700">{form.foto_identitas.name}</p>
                        <p className="text-xs text-green-500">Klik untuk ganti</p>
                      </>
                    ) : (
                      <><CreditCard className="w-7 h-7 text-red-300 mb-1" />
                        <p className="text-sm text-slate-500 font-medium">Klik untuk upload <span className="text-red-500">(wajib)</span></p>
                        <p className="text-xs text-slate-400 mt-0.5">JPG, PNG · Maks. 5MB</p>
                      </>
                    )}
                    <input type="file" accept="image/*" className="hidden" onChange={e => {
                      const f = e.target.files[0]
                      if (f && f.size > MAX_FILE_BYTES) { alert('File melebihi 5MB!'); return }
                      set('foto_identitas', f || null)
                    }} />
                  </label>
                  <p className="text-xs text-slate-400 mt-1">
                    {isOrganisasi ? '📷 Foto kartu siswa atau kartu anggota ekskul' : '📷 Foto KTP atau kartu identitas yang berlaku'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Surat Peminjaman / Bukti Kegiatan <span className="text-red-500">*</span>
                  </label>
                  <label className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                    form.lampiran_bukti ? 'border-green-400 bg-green-50' : 'border-red-200 bg-red-50/30 hover:border-blue-400 hover:bg-blue-50'
                  }`}>
                    {form.lampiran_bukti ? (
                      <><CheckCircle className="w-7 h-7 text-green-500 mb-1" />
                        <p className="text-sm font-medium text-green-700">{form.lampiran_bukti.name}</p>
                        <p className="text-xs text-green-500">Klik untuk ganti</p>
                      </>
                    ) : (
                      <><Upload className="w-7 h-7 text-red-300 mb-1" />
                        <p className="text-sm text-slate-500 font-medium">Upload surat <span className="text-red-500">(wajib)</span></p>
                        <p className="text-xs text-slate-400 mt-0.5">JPG, PNG, PDF · Maks. 5MB</p>
                      </>
                    )}
                    <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => {
                      const f = e.target.files[0]
                      if (f && f.size > MAX_FILE_BYTES) { alert('File melebihi 5MB!'); return }
                      set('lampiran_bukti', f || null)
                    }} />
                  </label>
                  <p className="text-xs text-slate-400 mt-1">📄 Surat resmi, screenshot undangan, atau bukti kegiatan lainnya</p>
                </div>
              </>
            )}

            {/* Ringkasan */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <p className="font-semibold text-slate-700 text-sm mb-3">📋 Ringkasan Peminjaman</p>
              <div className="space-y-1.5 text-xs mb-3">
                {[
                  ['Jenis', form.jenis_acara],
                  ...(form.asal_organisasi ? [['Dari', form.asal_organisasi]] : []),
                  ['Kegiatan', form.nama_kegiatan],
                  ['Peminjam', form.nama_peminjam],
                  ...(form.no_telepon ? [['No. HP', form.no_telepon]] : []),
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
                <p className="text-xs font-semibold text-slate-500 mb-1.5">Alat dipinjam ({selectedNamas.length}):</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedNamas.map((nama, i) => (
                    <span key={i} className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-lg font-medium">{nama}</span>
                  ))}
                </div>
              </div>
            </div>
          </>}
        </div>

        {/* Navigation */}
        <div className="bg-white rounded-2xl px-5 py-4 shadow-sm border border-slate-100 flex items-center justify-between">
          <button onClick={step === 0 ? () => window.location.href = '/login' : () => setStep(s => s - 1)}
            className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 font-medium">
            {step === 0 ? '← Login' : '← Kembali'}
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
              {submitting ? 'Mengirim...' : '✓ Kirim'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
