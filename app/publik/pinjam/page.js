'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import {
  Camera, CheckCircle, X, Phone, Upload, CreditCard,
  CalendarCheck, Lock, Tag, Layers, Package, ChevronLeft,
  Building2, User, School
} from 'lucide-react'

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

const KATEGORI_ICON = {
  'Kamera':   <Camera className="w-4 h-4" />,
  'Lensa':    <Layers className="w-4 h-4" />,
  'Aksesori': <Tag className="w-4 h-4" />,
}

function addDays(dateStr, days) {
  if (!dateStr || !days) return ''
  const d = new Date(dateStr)
  d.setDate(d.getDate() + Number(days))
  return d.toISOString().split('T')[0]
}

function getPrefix(nama) {
  const m = nama.match(/^(.+?)\s+#?\d+$/)
  return m ? m[1].trim() : null
}

function groupItems(items) {
  const prefixCount = {}
  items.forEach(item => {
    const p = getPrefix(item.nama_alat)
    if (p) prefixCount[p] = (prefixCount[p] || 0) + 1
  })
  const prefixMap = {}
  const standalone = []
  items.forEach(item => {
    const p = getPrefix(item.nama_alat)
    if (p && prefixCount[p] >= 2) {
      if (!prefixMap[p]) prefixMap[p] = []
      prefixMap[p].push(item)
    } else {
      standalone.push(item)
    }
  })
  const result = []
  standalone.forEach(item => result.push({ type: 'single', item }))
  Object.entries(prefixMap).forEach(([prefix, units]) =>
    result.push({ type: 'group', prefix, units })
  )
  return result
}

// ── Unit Picker Popup ────────────────────────────────────────
function UnitPickerPopup({ group, selectedIds, onToggle, onClose }) {
  const selectedInGroup = group.units.filter(u => selectedIds.includes(u.id))
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="px-5 pt-5 pb-4 border-b border-slate-100">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-bold text-slate-900">{group.prefix}</h4>
              <p className="text-xs text-slate-400 mt-0.5">
                {group.units.filter(u => u.status === 'Tersedia').length} dari {group.units.length} tersedia
              </p>
            </div>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-purple-500 rounded-full transition-all"
              style={{ width: `${(group.units.filter(u => u.status === 'Tersedia').length / group.units.length) * 100}%` }} />
          </div>
        </div>
        <div className="px-5 py-4 space-y-2 max-h-64 overflow-y-auto">
          {group.units.map(unit => {
            const isBusy = unit.status === 'Dipinjam'
            const isSelected = selectedIds.includes(unit.id)
            const num = unit.nama_alat.match(/#?(\d+)$/)?.[1]
            const info = unit._peminjamanAktif
            return (
              <button key={unit.id} type="button" disabled={isBusy}
                onClick={() => !isBusy && onToggle(unit.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                  isBusy ? 'border-slate-100 bg-slate-50 cursor-not-allowed opacity-75'
                  : isSelected ? 'border-purple-500 bg-purple-50'
                  : 'border-slate-200 bg-white hover:border-purple-300'
                }`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                  isBusy ? 'bg-red-100 text-red-400' : isSelected ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}>{num || '?'}</div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${isBusy ? 'text-slate-400' : isSelected ? 'text-purple-800' : 'text-slate-700'}`}>
                    Unit #{num}
                  </p>
                  <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${
                    unit.kondisi === 'Baik' ? 'bg-green-100 text-green-700'
                    : unit.kondisi === 'Rusak Ringan' ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-red-100 text-red-600'
                  }`}>{unit.kondisi}</span>
                  {unit.catatan && <p className="text-xs text-slate-400 mt-0.5">📝 {unit.catatan}</p>}
                  {isBusy && info && (
                    <p className="text-xs text-red-400 mt-1">🔒 {info.nama_kegiatan}
                      {info.perkiraan_kembali && ` · kembali ${new Date(info.perkiraan_kembali + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}`}
                    </p>
                  )}
                </div>
                {isSelected && <CheckCircle className="w-5 h-5 text-purple-600 flex-shrink-0" />}
              </button>
            )
          })}
        </div>
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
          <p className="text-xs text-slate-500">
            {selectedInGroup.length > 0
              ? <span className="font-semibold text-purple-700">{selectedInGroup.length} dipilih</span>
              : 'Belum ada dipilih'}
          </p>
          <button onClick={onClose} className="px-4 py-1.5 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700">
            Selesai
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Inventaris Grid (publik) ─────────────────────────────────
function InventarisGrid({ inventaris, selectedIds, onToggle }) {
  const [filterKat, setFilterKat] = useState('Semua')
  const [openGroup, setOpenGroup] = useState(null)

  const kategoris = ['Semua', ...new Set(inventaris.map(i => i.kategori))]
  const filtered = inventaris.filter(i => filterKat === 'Semua' || i.kategori === filterKat)
  const byKat = filtered.reduce((acc, item) => {
    const k = item.kategori || 'Lainnya'
    if (!acc[k]) acc[k] = []
    acc[k].push(item)
    return acc
  }, {})

  return (
    <>
      <div>
        <div className="flex gap-1.5 flex-wrap mb-3">
          {kategoris.map(k => (
            <button key={k} type="button" onClick={() => setFilterKat(k)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                filterKat === k ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}>{k}</button>
          ))}
        </div>
        <div className="space-y-4">
          {Object.entries(byKat).map(([kat, items]) => {
            const cards = groupItems(items)
            return (
              <div key={kat}>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-slate-400">{KATEGORI_ICON[kat] || <Tag className="w-4 h-4" />}</span>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">{kat}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {cards.map(card => {
                    if (card.type === 'single') {
                      const item = card.item
                      const isSelected = selectedIds.includes(item.id)
                      const isBusy = item.status === 'Dipinjam'
                      const info = item._peminjamanAktif
                      return (
                        <button key={item.id} type="button" disabled={isBusy}
                          onClick={() => !isBusy && onToggle(item.id)}
                          className={`relative text-left p-3 rounded-xl border-2 transition-all ${
                            isBusy ? 'border-slate-200 bg-slate-50 opacity-80 cursor-not-allowed'
                            : isSelected ? 'border-purple-500 bg-purple-50 shadow-sm'
                            : 'border-slate-200 bg-white hover:border-purple-300'
                          }`}>
                          {isSelected && (
                            <div className="absolute top-2 right-2 w-5 h-5 bg-purple-600 rounded-full flex items-center justify-center">
                              <CheckCircle className="w-3.5 h-3.5 text-white" />
                            </div>
                          )}
                          {isBusy && (
                            <div className="absolute top-2 right-2 w-5 h-5 bg-red-400 rounded-full flex items-center justify-center">
                              <Lock className="w-3 h-3 text-white" />
                            </div>
                          )}
                          <p className={`text-sm font-semibold leading-tight pr-6 ${
                            isBusy ? 'text-slate-400' : isSelected ? 'text-purple-800' : 'text-slate-700'
                          }`}>{item.nama_alat}</p>
                          <span className={`inline-block mt-1 text-xs px-1.5 py-0.5 rounded-md font-medium ${
                            item.kondisi === 'Baik' ? 'bg-green-100 text-green-700'
                            : item.kondisi === 'Rusak Ringan' ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-600'
                          }`}>{item.kondisi}</span>
                          {item.catatan && (
                            <p className="text-xs text-slate-400 mt-1 leading-tight">📝 {item.catatan}</p>
                          )}
                          {isBusy && info && (
                            <div className="mt-1.5 text-xs text-red-400 space-y-0.5">
                              <p className="font-semibold">🔒 Dipinjam</p>
                              <p className="text-slate-400">📌 {info.nama_kegiatan}</p>
                              {info.perkiraan_kembali && (
                                <p className="text-slate-400">🔄 Kembali: {new Date(info.perkiraan_kembali + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                              )}
                            </div>
                          )}
                        </button>
                      )
                    }
                    const { prefix, units } = card
                    const avail = units.filter(u => u.status === 'Tersedia')
                    const selUnits = units.filter(u => selectedIds.includes(u.id))
                    const allBusy = avail.length === 0
                    const hasSel = selUnits.length > 0
                    return (
                      <button key={prefix} type="button" disabled={allBusy}
                        onClick={() => !allBusy && setOpenGroup(prefix)}
                        className={`relative text-left p-3 rounded-xl border-2 transition-all ${
                          allBusy ? 'border-slate-200 bg-slate-50 opacity-80 cursor-not-allowed'
                          : hasSel ? 'border-purple-500 bg-purple-50 shadow-sm'
                          : 'border-slate-200 bg-white hover:border-purple-300'
                        }`}>
                        {hasSel && (
                          <div className="absolute top-2 right-2 min-w-5 h-5 px-1 bg-purple-600 rounded-full flex items-center justify-center">
                            <span className="text-white text-xs font-bold">{selUnits.length}</span>
                          </div>
                        )}
                        {allBusy && (
                          <div className="absolute top-2 right-2 w-5 h-5 bg-red-400 rounded-full flex items-center justify-center">
                            <Lock className="w-3 h-3 text-white" />
                          </div>
                        )}
                        <p className={`text-sm font-semibold leading-tight pr-6 ${
                          allBusy ? 'text-slate-400' : hasSel ? 'text-purple-800' : 'text-slate-700'
                        }`}>{prefix}</p>
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {units.map(u => {
                            const isSel = selectedIds.includes(u.id)
                            const isBusy = u.status === 'Dipinjam'
                            const num = u.nama_alat.match(/#?(\d+)$/)?.[1]
                            return (
                              <span key={u.id} className={`inline-flex items-center justify-center w-6 h-6 rounded-lg text-xs font-bold ${
                                isBusy ? 'bg-red-100 text-red-400' : isSel ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-500'
                              }`}>{num}</span>
                            )
                          })}
                        </div>
                        <p className={`text-xs mt-1.5 font-medium ${allBusy ? 'text-red-400' : 'text-slate-400'}`}>
                          {allBusy ? '🔒 Semua dipinjam'
                            : hasSel ? `${selUnits.length} dipilih · ${avail.length} tersedia`
                            : `${avail.length}/${units.length} tersedia · ketuk untuk pilih`}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      {openGroup && (() => {
        const group = {
          prefix: openGroup,
          units: inventaris.filter(i => getPrefix(i.nama_alat) === openGroup)
        }
        return <UnitPickerPopup group={group} selectedIds={selectedIds} onToggle={onToggle} onClose={() => setOpenGroup(null)} />
      })()}
    </>
  )
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
    lampiran_bukti: null,   // surat peminjaman — WAJIB non-sekolah
    foto_identitas: null,   // kartu — WAJIB non-sekolah
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
      (isSekolah || !!(form.jenis_acara === 'Eksternal' && true || isOrganisasi && true))
    if (step === 1) return !!form.nama_peminjam && (!needsPhone || !!form.no_telepon)
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
    // Validasi dokumen wajib jika bukan sekolah
    if (needsDocs) {
      if (!form.foto_identitas) { alert(`${identityLabel} wajib diupload!`); return }
      if (!form.lampiran_bukti) { alert('Surat peminjaman wajib diupload!'); return }
    }
    setSubmitting(true)

    const uploadFile = async (file, prefix) => {
      if (!file) return null
      const ext = file.name.split('.').pop()
      const path = `${prefix}-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('lampiran').upload(path, file)
      if (error) return null
      return supabase.storage.from('lampiran').getPublicUrl(path).data?.publicUrl
    }

    const identitas_url = needsDocs ? await uploadFile(form.foto_identitas, 'id') : null
    const lampiran_url  = needsDocs ? await uploadFile(form.lampiran_bukti, 'bukti') : null

    const detail = selectedNamas.join('\n') + (form.catatan_barang ? `\n\nCatatan: ${form.catatan_barang}` : '')

    await supabase.from('peminjaman').insert({
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

    setSubmitted(true)
    setSubmitting(false)
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
                  <button key={j} type="button" onClick={() => set('jenis_acara', j)}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${form.jenis_acara === j ? 'border-purple-500 bg-purple-50' : 'border-slate-200 hover:border-purple-300'}`}>
                    <div className="text-2xl mb-1">{icon}</div>
                    <p className={`text-sm font-semibold ${form.jenis_acara === j ? 'text-purple-700' : 'text-slate-700'}`}>{j}</p>
                    <p className="text-xs text-slate-400 mt-0.5 leading-tight">{desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Asal organisasi / pihak — muncul jika Organisasi atau Eksternal */}
            {(isOrganisasi || form.jenis_acara === 'Eksternal') && (
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
                <p className="text-xs text-slate-400 mt-1">
                  {isOrganisasi ? '🎯 Nama lengkap organisasi atau ekskul yang meminjam' : '🌐 Nama instansi, komunitas, atau "Pribadi" jika perorangan'}
                </p>
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
                  <input type="tel" value={form.no_telepon} onChange={e => set('no_telepon', e.target.value)}
                    placeholder="cth: 08123456789"
                    className="w-full pl-10 pr-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">📱 Untuk dihubungi jika ada keperluan mendesak</p>
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
              // Sekolah — langsung ringkasan
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

                {/* Foto identitas — WAJIB */}
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
                    <input type="file" accept="image/*" className="hidden" onChange={e => set('foto_identitas', e.target.files[0] || null)} />
                  </label>
                  <p className="text-xs text-slate-400 mt-1">
                    {isOrganisasi ? '📷 Foto kartu siswa atau kartu anggota ekskul' : '📷 Foto KTP atau kartu identitas yang berlaku'}
                  </p>
                </div>

                {/* Surat peminjaman — WAJIB */}
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
                    <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => set('lampiran_bukti', e.target.files[0] || null)} />
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
