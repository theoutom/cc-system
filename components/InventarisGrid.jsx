'use client'
import { useState } from 'react'
import { X, CheckCircle, Lock, Camera, Layers, Tag, Package, Wrench } from 'lucide-react'

const KATEGORI_ICON = {
  'Kamera':   <Camera className="w-5 h-5" />,
  'Lensa':    <Layers className="w-5 h-5" />,
  'Aksesori': <Tag className="w-5 h-5" />,
}

export function getPrefix(nama) {
  const m = nama.match(/^(.+?)\s+#?\d+$/)
  return m ? m[1].trim() : null
}

export function groupItems(items) {
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

function UnitPickerPopup({ group, selectedIds, onToggle, onClose }) {
  const availableCount = group.units.filter(u => u.status === 'Tersedia' && !u.in_maintenance).length
  const selectedInGroup = group.units.filter(u => selectedIds.includes(u.id))

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="px-5 pt-5 pb-4 border-b border-slate-100">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-bold text-slate-900 text-base">{group.prefix}</h4>
              <p className="text-xs text-slate-400 mt-0.5">
                {availableCount} dari {group.units.length} unit tersedia
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-500 rounded-full transition-all"
              style={{ width: `${(availableCount / group.units.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="px-5 py-4 space-y-2 max-h-72 overflow-y-auto">
          {group.units.map(unit => {
            const isBusy       = unit.status === 'Dipinjam'
            const isMaintenance = !!unit.in_maintenance
            const isDisabled   = isBusy || isMaintenance
            const isSelected   = selectedIds.includes(unit.id)
            const info         = unit._peminjamanAktif
            const unitNum      = unit.nama_alat.match(/#?(\d+)$/)?.[1]
            return (
              <button
                key={unit.id}
                type="button"
                disabled={isDisabled}
                onClick={() => !isDisabled && onToggle(unit.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                  isMaintenance
                    ? 'border-orange-100 bg-orange-50 cursor-not-allowed opacity-75'
                    : isBusy
                      ? 'border-slate-100 bg-slate-50 cursor-not-allowed opacity-75'
                      : isSelected
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-slate-200 bg-white hover:border-purple-300 hover:bg-purple-50/30'
                }`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                  isMaintenance ? 'bg-orange-100 text-orange-400'
                  : isBusy     ? 'bg-red-100 text-red-400'
                  : isSelected ? 'bg-purple-600 text-white'
                               : 'bg-slate-100 text-slate-600'
                }`}>
                  {unitNum || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${isDisabled ? 'text-slate-400' : isSelected ? 'text-purple-800' : 'text-slate-700'}`}>
                    Unit #{unitNum}
                  </p>
                  <span className={`inline-block text-xs px-1.5 py-0.5 rounded-md font-medium mt-0.5 ${
                    unit.kondisi === 'Baik'
                      ? 'bg-green-100 text-green-700'
                      : unit.kondisi === 'Rusak Ringan'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-red-100 text-red-600'
                  }`}>
                    {unit.kondisi}
                  </span>
                  {unit.catatan && (
                    <p className="text-xs text-slate-400 mt-0.5">📝 {unit.catatan}</p>
                  )}
                  {isMaintenance && (
                    <p className="text-xs text-orange-500 font-medium mt-0.5">🔧 Maintenance</p>
                  )}
                  {!isMaintenance && isBusy && info && (
                    <div className="mt-1">
                      <p className="text-xs text-red-400 font-medium">🔒 {info.nama_kegiatan}</p>
                      {info.perkiraan_kembali && (
                        <p className="text-xs text-slate-400">
                          Kembali: {new Date(info.perkiraan_kembali + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                  )}
                  {!isMaintenance && isBusy && !info && (
                    <p className="text-xs text-red-400 font-medium mt-0.5">🔒 Sedang dipinjam</p>
                  )}
                </div>
                {isSelected && <CheckCircle className="w-5 h-5 text-purple-600 flex-shrink-0" />}
              </button>
            )
          })}
        </div>

        <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            {selectedInGroup.length > 0
              ? <span className="font-semibold text-purple-700">{selectedInGroup.length} unit dipilih</span>
              : 'Belum ada unit dipilih'}
          </p>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition-colors"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  )
}

export function InventarisGrid({ inventaris, selectedIds, onToggle }) {
  const [filterKategori, setFilterKategori] = useState('Semua')
  const [openGroup, setOpenGroup]           = useState(null)

  const kategoris = ['Semua', ...new Set(inventaris.map(i => i.kategori))]
  const filtered  = inventaris.filter(item =>
    filterKategori === 'Semua' || item.kategori === filterKategori
  )
  const byKategori = filtered.reduce((acc, item) => {
    const k = item.kategori || 'Lainnya'
    if (!acc[k]) acc[k] = []
    acc[k].push(item)
    return acc
  }, {})

  return (
    <>
      <div>
        <div className="flex gap-1.5 flex-wrap mb-4">
          {kategoris.map(k => (
            <button
              key={k}
              type="button"
              onClick={() => setFilterKategori(k)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                filterKategori === k ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {k}
            </button>
          ))}
        </div>

        <div className="space-y-5">
          {Object.entries(byKategori).map(([kategori, items]) => {
            const cardItems = groupItems(items)
            return (
              <div key={kategori}>
                <div className="flex items-center gap-1.5 mb-2.5">
                  <span className="text-slate-400">{KATEGORI_ICON[kategori] || <Tag className="w-4 h-4" />}</span>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">{kategori}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {cardItems.map(card => {
                    if (card.type === 'single') {
                      const item         = card.item
                      const isSelected   = selectedIds.includes(item.id)
                      const isBusy       = item.status === 'Dipinjam'
                      const isMaintenance = !!item.in_maintenance
                      const isDisabled   = isBusy || isMaintenance
                      const info         = item._peminjamanAktif
                      return (
                        <button
                          key={item.id}
                          type="button"
                          disabled={isDisabled}
                          onClick={() => !isDisabled && onToggle(item.id)}
                          className={`relative text-left p-3 rounded-xl border-2 transition-all ${
                            isMaintenance
                              ? 'border-orange-200 bg-orange-50 opacity-75 cursor-not-allowed'
                              : isBusy
                                ? 'border-slate-200 bg-slate-50 opacity-80 cursor-not-allowed'
                                : isSelected
                                  ? 'border-purple-500 bg-purple-50 shadow-sm'
                                  : 'border-slate-200 bg-white hover:border-purple-300 hover:bg-purple-50/30'
                          }`}
                        >
                          {isSelected && (
                            <div className="absolute top-2 right-2 w-5 h-5 bg-purple-600 rounded-full flex items-center justify-center">
                              <CheckCircle className="w-3.5 h-3.5 text-white" />
                            </div>
                          )}
                          {isMaintenance && (
                            <div className="absolute top-2 right-2 w-5 h-5 bg-orange-400 rounded-full flex items-center justify-center">
                              <Wrench className="w-3 h-3 text-white" />
                            </div>
                          )}
                          {!isMaintenance && isBusy && (
                            <div className="absolute top-2 right-2 w-5 h-5 bg-red-400 rounded-full flex items-center justify-center">
                              <Lock className="w-3 h-3 text-white" />
                            </div>
                          )}
                          <p className={`text-sm font-semibold leading-tight pr-6 ${
                            isDisabled ? 'text-slate-400' : isSelected ? 'text-purple-800' : 'text-slate-700'
                          }`}>
                            {item.nama_alat}
                          </p>
                          <span className={`inline-block mt-1.5 text-xs px-1.5 py-0.5 rounded-md font-medium ${
                            item.kondisi === 'Baik'
                              ? 'bg-green-100 text-green-700'
                              : item.kondisi === 'Rusak Ringan'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-red-100 text-red-600'
                          }`}>
                            {item.kondisi}
                          </span>
                          {item.catatan && (
                            <p className="text-xs text-slate-400 mt-1 leading-tight">📝 {item.catatan}</p>
                          )}
                          {isMaintenance && (
                            <p className="text-xs text-orange-500 font-semibold mt-1">🔧 Maintenance</p>
                          )}
                          {!isMaintenance && isBusy && info && (
                            <div className="mt-2 space-y-0.5">
                              <p className="text-xs text-red-500 font-semibold">🔒 Sedang Dipinjam</p>
                              <p className="text-xs text-slate-400 leading-tight">📌 {info.nama_kegiatan}</p>
                              {info.perkiraan_kembali && (
                                <p className="text-xs text-slate-400">
                                  🔄 Kembali: {new Date(info.perkiraan_kembali + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </p>
                              )}
                            </div>
                          )}
                        </button>
                      )
                    }

                    const { prefix, units } = card
                    const availableUnits    = units.filter(u => u.status === 'Tersedia' && !u.in_maintenance)
                    const selectedUnits     = units.filter(u => selectedIds.includes(u.id))
                    const allBusy           = availableUnits.length === 0
                    const hasSelected       = selectedUnits.length > 0
                    return (
                      <button
                        key={prefix}
                        type="button"
                        disabled={allBusy}
                        onClick={() => !allBusy && setOpenGroup(prefix)}
                        className={`relative text-left p-3 rounded-xl border-2 transition-all ${
                          allBusy
                            ? 'border-slate-200 bg-slate-50 opacity-80 cursor-not-allowed'
                            : hasSelected
                              ? 'border-purple-500 bg-purple-50 shadow-sm'
                              : 'border-slate-200 bg-white hover:border-purple-300 hover:bg-purple-50/30'
                        }`}
                      >
                        {hasSelected && (
                          <div className="absolute top-2 right-2 min-w-5 h-5 px-1 bg-purple-600 rounded-full flex items-center justify-center">
                            <span className="text-white text-xs font-bold">{selectedUnits.length}</span>
                          </div>
                        )}
                        {allBusy && (
                          <div className="absolute top-2 right-2 w-5 h-5 bg-red-400 rounded-full flex items-center justify-center">
                            <Lock className="w-3 h-3 text-white" />
                          </div>
                        )}
                        <p className={`text-sm font-semibold leading-tight pr-6 ${
                          allBusy ? 'text-slate-400' : hasSelected ? 'text-purple-800' : 'text-slate-700'
                        }`}>
                          {prefix}
                        </p>
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {units.map(u => {
                            const isSel    = selectedIds.includes(u.id)
                            const isBusy   = u.status === 'Dipinjam'
                            const isMaint  = !!u.in_maintenance
                            const num      = u.nama_alat.match(/#?(\d+)$/)?.[1]
                            return (
                              <span
                                key={u.id}
                                className={`inline-flex items-center justify-center w-6 h-6 rounded-lg text-xs font-bold ${
                                  isMaint  ? 'bg-orange-100 text-orange-400'
                                  : isBusy ? 'bg-red-100 text-red-400'
                                  : isSel  ? 'bg-purple-600 text-white'
                                           : 'bg-slate-100 text-slate-500'
                                }`}
                              >
                                {num}
                              </span>
                            )
                          })}
                        </div>
                        <p className={`text-xs mt-1.5 font-medium ${allBusy ? 'text-red-400' : 'text-slate-400'}`}>
                          {allBusy
                            ? '🔒 Tidak tersedia'
                            : hasSelected
                              ? `${selectedUnits.length} dipilih · ${availableUnits.length} tersedia`
                              : `${availableUnits.length} dari ${units.length} tersedia · ketuk untuk pilih`}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-8 text-slate-400">
            <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Tidak ada alat di kategori ini</p>
          </div>
        )}
      </div>

      {openGroup && (() => {
        const group = {
          prefix: openGroup,
          units: inventaris.filter(i => getPrefix(i.nama_alat) === openGroup),
        }
        return (
          <UnitPickerPopup
            group={group}
            selectedIds={selectedIds}
            onToggle={onToggle}
            onClose={() => setOpenGroup(null)}
          />
        )
      })()}
    </>
  )
}
