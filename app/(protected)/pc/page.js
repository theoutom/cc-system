'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { differenceInSeconds, addHours, isAfter } from 'date-fns'
import { Monitor, Clock, PlayCircle, StopCircle, Plus, X, AlertTriangle } from 'lucide-react'

export default function PCPage() {
  const supabase = createClient()
  const [sessions, setSessions] = useState([])
  const [pcs, setPcs] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [showRegisterForm, setShowRegisterForm] = useState(false)
  const [registerForm, setRegisterForm] = useState({ no_pc: '', nama_pc: '', client_key: '' })
  const [registering, setRegistering] = useState(false)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ nama_pengguna: '', tujuan: '', durasi_jam: 1, no_pc: 1 })
  const [submitting, setSubmitting] = useState(false)
  const [now, setNow] = useState(new Date())
  const [actionModal, setActionModal] = useState(null) // { id, type: 'extend' | 'stop' }
  const [extendHours, setExtendHours] = useState(1)

  useEffect(() => {
    fetchData()
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const fetchData = async () => {
    setLoading(true)
    
    // Fetch registered PCs from daftar_pc
    const { data: pcList, error: pcErr } = await supabase
      .from('daftar_pc')
      .select('*')
      .order('no_pc')
      
    if (pcErr) {
      console.error('Failed to fetch daftar_pc, using fallbacks:', pcErr)
      setPcs([
        { no_pc: 1, nama_pc: 'PC 01', client_key: 'cc-pc1-key-secret' },
        { no_pc: 2, nama_pc: 'PC 02', client_key: 'cc-pc2-key-secret' },
        { no_pc: 3, nama_pc: 'PC 03', client_key: 'cc-pc3-key-secret' },
        { no_pc: 4, nama_pc: 'PC 04', client_key: 'cc-pc4-key-secret' }
      ])
    } else {
      setPcs(pcList || [])
    }

    const { data } = await supabase
      .from('penggunaan_pc')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    setSessions(data || [])
    setLoading(false)
  }

  const openRegisterForm = () => {
    const randomKey = 'cc-pc-' + Math.random().toString(36).substring(2, 8) + '-key'
    const maxPcNum = pcs.reduce((max, p) => p.no_pc > max ? p.no_pc : max, 0)
    setRegisterForm({
      no_pc: maxPcNum + 1,
      nama_pc: `PC ${String(maxPcNum + 1).padStart(2, '0')}`,
      client_key: randomKey
    })
    setShowRegisterForm(true)
  }

  const handleRegisterPC = async () => {
    const pcNum = parseInt(registerForm.no_pc)
    if (isNaN(pcNum) || !registerForm.nama_pc || !registerForm.client_key) {
      alert('Isi semua field pendaftaran dengan benar!')
      return
    }
    setRegistering(true)
    try {
      const { error } = await supabase.from('daftar_pc').insert({
        no_pc: pcNum,
        nama_pc: registerForm.nama_pc,
        client_key: registerForm.client_key
      })
      if (error) throw error
      
      alert(`PC ${pcNum} berhasil didaftarkan!`)
      setShowRegisterForm(false)
      setRegisterForm({ no_pc: '', nama_pc: '', client_key: '' })
      fetchData()
    } catch (e) {
      alert('Gagal mendaftarkan PC: ' + e.message)
    } finally {
      setRegistering(false)
    }
  }

  const handleStart = async () => {
    if (!form.nama_pengguna || !form.tujuan || form.durasi_jam < 1) {
      alert('Isi semua field dengan benar')
      return
    }
    setSubmitting(true)
    
    const activeSessions = sessions.filter(s => s.status === 'Aktif' || s.status === 'Overdue')

    const usedPCs = activeSessions.map(s => s.no_pc)
    if (usedPCs.includes(form.no_pc)) {
      alert(`PC ${form.no_pc} sedang digunakan, silakan pilih PC lain.`)
      setSubmitting(false)
      return
    }

    const start = new Date()
    const end = addHours(start, form.durasi_jam)

    try {
      const { error } = await supabase.from('penggunaan_pc').insert({
        nama_pengguna: form.nama_pengguna,
        tujuan: form.tujuan,
        durasi_jam: form.durasi_jam,
        waktu_mulai: start.toISOString(),
        waktu_selesai: end.toISOString(),
        no_pc: form.no_pc,
        status: 'Aktif'
      })
      if (error) throw error
      
      // Notify Telegram
      await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `🖥 *PC Digunakan*\n👤 Oleh: ${form.nama_pengguna}\n🎯 Tujuan: ${form.tujuan}\n⏳ Durasi: ${form.durasi_jam} jam`
        })
      })

      setShowForm(false)
      setForm({ nama_pengguna: '', tujuan: '', durasi_jam: 1 })
      fetchData()
    } catch (e) {
      alert('Gagal memulai: ' + e.message)
    }
    setSubmitting(false)
  }

  const handleStop = async (id, pengguna) => {
    try {
      const { error } = await supabase.from('penggunaan_pc').update({ status: 'Selesai' }).eq('id', id)
      if (error) throw error

      await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `⏹ *PC Selesai*\n👤 Oleh: ${pengguna}\n✅ Sesi diakhiri.`
        })
      })

      setActionModal(null)
      fetchData()
    } catch (e) {
      alert('Gagal menghentikan: ' + e.message)
    }
  }

  const handleExtend = async (id) => {
    const session = sessions.find(s => s.id === id)
    if (!session) return

    const baseTime = isAfter(new Date(), new Date(session.waktu_selesai)) ? new Date() : new Date(session.waktu_selesai)
    const newEnd = addHours(baseTime, extendHours)
    
    try {
      const { error } = await supabase.from('penggunaan_pc').update({ 
        durasi_jam: session.durasi_jam + extendHours,
        waktu_selesai: newEnd.toISOString(),
        status: 'Aktif'
      }).eq('id', id)
      if (error) throw error

      await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `⏳ *PC Diperpanjang*\n👤 Oleh: ${session.nama_pengguna}\n➕ Tambahan: ${extendHours} jam`
        })
      })

      setActionModal(null)
      setExtendHours(1)
      fetchData()
    } catch (e) {
      alert('Gagal perpanjang: ' + e.message)
    }
  }

  const formatTime = (seconds) => {
    if (seconds <= 0) return '00:00:00'
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0')
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0')
    const s = (seconds % 60).toString().padStart(2, '0')
    return `${h}:${m}:${s}`
  }

  const activeSessions = sessions.filter(s => s.status === 'Aktif' || s.status === 'Overdue')
  const historySessions = sessions.filter(s => s.status === 'Selesai')

  return (
    <div>
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Monitor PC CC</h1>
          <p className="text-slate-500 text-sm mt-0.5">Sistem billing pemakaian komputer (Daftarkan PC tanpa batas)</p>
        </div>
        <div className="flex gap-2">
          <button onClick={openRegisterForm}
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors">
            Daftarkan PC Baru
          </button>
          <button onClick={() => {
            if (pcs.length > 0) {
              const activeSessions = sessions.filter(s => s.status === 'Aktif' || s.status === 'Overdue')
              const usedPCs = activeSessions.map(s => s.no_pc)
              const firstFreePC = pcs.find(p => !usedPCs.includes(p.no_pc))
              setForm({ nama_pengguna: '', tujuan: '', durasi_jam: 1, no_pc: firstFreePC ? firstFreePC.no_pc : pcs[0].no_pc })
            }
            setShowForm(true)
          }} disabled={pcs.length === 0}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
            <Plus className="w-4 h-4" /> Mulai PC Baru
          </button>
        </div>
      </div>

      {/* Active Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {pcs.map(pc => {
          const pcNum = pc.no_pc
          const session = activeSessions.find(s => s.no_pc === pcNum)
          
          if (!session) {
            return (
              <div key={pcNum} className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center text-slate-400 h-52 relative group">
                <Monitor className="w-8 h-8 mb-2 opacity-30" />
                <p className="font-semibold">{pc.nama_pc || `PC ${pcNum}`}</p>
                <p className="text-[10px] text-slate-400 mt-1 select-all font-mono bg-slate-100 px-1.5 py-0.5 rounded">Key: {pc.client_key}</p>
                <button onClick={() => { setForm({ nama_pengguna: '', tujuan: '', durasi_jam: 1, no_pc: pcNum }); setShowForm(true); }}
                  className="mt-3 text-xs bg-purple-100 text-purple-700 hover:bg-purple-200 px-3 py-1.5 rounded-lg font-medium transition-colors opacity-0 group-hover:opacity-100">
                  Mulai Sesi
                </button>
              </div>
            )
          }

          const end = new Date(session.waktu_selesai)
          const diffSeconds = differenceInSeconds(end, now)
          const isOverdue = diffSeconds <= 0 || session.status === 'Overdue'

          return (
            <div key={session.id} className={`bg-white rounded-2xl p-5 border shadow-sm flex flex-col h-52 ${
              isOverdue ? 'border-red-300 ring-4 ring-red-50' : 'border-purple-200 ring-4 ring-purple-50'
            }`}>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                    isOverdue ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                  }`}>
                    {isOverdue ? 'WAKTU HABIS' : 'AKTIF'}
                  </span>
                  <p className="text-xs text-slate-400 font-bold mt-1">{pc.nama_pc || `PC ${pcNum}`}</p>
                  <p className="font-bold text-slate-800 line-clamp-1">{session.nama_pengguna}</p>
                </div>
                <Monitor className={`w-5 h-5 ${isOverdue ? 'text-red-500' : 'text-purple-600'}`} />
              </div>
              
              <div className="mt-auto">
                <p className="text-xs text-slate-500 font-medium mb-1 line-clamp-1">{session.tujuan}</p>
                <div className={`font-mono text-3xl font-black ${isOverdue ? 'text-red-600 animate-pulse' : 'text-slate-800'}`}>
                  {formatTime(isOverdue ? 0 : diffSeconds)}
                </div>
                
                <div className="flex gap-2 mt-3">
                  <button onClick={() => setActionModal({ id: session.id, type: 'extend', nama: session.nama_pengguna })}
                    className="flex-1 text-xs py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg font-semibold transition-colors">
                    Perpanjang
                  </button>
                  <button onClick={() => setActionModal({ id: session.id, type: 'stop', nama: session.nama_pengguna })}
                    className="flex-1 text-xs py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg font-semibold transition-colors">
                    Stop Sesi
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* History */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Riwayat Penggunaan Hari Ini</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-4 py-3 font-medium text-slate-600">Pengguna</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Tujuan</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Durasi</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Mulai</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Selesai</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {historySessions.slice(0, 10).map(s => (
                <tr key={s.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-medium text-slate-800">{s.nama_pengguna}</td>
                  <td className="px-4 py-3 text-slate-600">{s.tujuan}</td>
                  <td className="px-4 py-3 text-slate-600">{s.durasi_jam} Jam</td>
                  <td className="px-4 py-3 text-slate-600">{new Date(s.waktu_mulai).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}</td>
                  <td className="px-4 py-3 text-slate-600">{new Date(s.waktu_selesai).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Start */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">Mulai PC</h3>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Pilih Nomor PC</label>
                <select value={form.no_pc} onChange={e => setForm({...form, no_pc: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none">
                  {pcs.map(pc => (
                    <option key={pc.no_pc} value={pc.no_pc}>{pc.nama_pc || `PC ${pc.no_pc}`}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Nama Pengguna</label>
                <input value={form.nama_pengguna} onChange={e => setForm({...form, nama_pengguna: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Keperluan / Tujuan</label>
                <input value={form.tujuan} onChange={e => setForm({...form, tujuan: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none" 
                  placeholder="Misal: Edit Video Aftermovie" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Durasi (Jam)</label>
                <div className="flex items-center gap-3">
                  <input type="range" min="1" max="12" value={form.durasi_jam} onChange={e => setForm({...form, durasi_jam: parseInt(e.target.value)})} 
                    className="flex-1 accent-purple-600" />
                  <span className="font-bold text-purple-700 bg-purple-50 px-3 py-1 rounded-lg w-16 text-center">{form.durasi_jam} J</span>
                </div>
              </div>
            </div>

            <button onClick={handleStart} disabled={submitting}
              className="w-full mt-6 py-2.5 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 disabled:opacity-50">
              {submitting ? 'Menyiapkan...' : 'Mulai Sekarang'}
            </button>
          </div>
        </div>
      )}

      {/* Modal Register PC */}
      {showRegisterForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">Daftarkan PC Baru</h3>
              <button onClick={() => setShowRegisterForm(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Nomor PC</label>
                <input type="number" min="1" value={registerForm.no_pc} onChange={e => setRegisterForm({...registerForm, no_pc: parseInt(e.target.value) || ''})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Nama PC</label>
                <input value={registerForm.nama_pc} onChange={e => setRegisterForm({...registerForm, nama_pc: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none" 
                  placeholder="Misal: PC Game 01" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Client Key / Pairing Code</label>
                <div className="flex gap-2">
                  <input value={registerForm.client_key} onChange={e => setRegisterForm({...registerForm, client_key: e.target.value})}
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-mono text-xs" />
                  <button onClick={() => setRegisterForm({...registerForm, client_key: 'cc-pc-' + Math.random().toString(36).substring(2, 8) + '-key'})}
                    className="text-xs bg-slate-100 hover:bg-slate-200 px-3.5 py-2 rounded-xl text-slate-700 font-medium">
                    Acak
                  </button>
                </div>
              </div>
            </div>

            <button onClick={handleRegisterPC} disabled={registering}
              className="w-full mt-6 py-2.5 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 disabled:opacity-50">
              {registering ? 'Mendaftarkan...' : 'Daftarkan PC'}
            </button>
          </div>
        </div>
      )}

      {/* Modal Actions */}
      {actionModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xs p-6 shadow-2xl">
            <h3 className="font-bold text-lg mb-2 text-center">
              {actionModal.type === 'extend' ? 'Perpanjang Waktu' : 'Hentikan Sesi?'}
            </h3>
            <p className="text-center text-sm text-slate-500 mb-6">
              PC: <span className="font-bold text-slate-800">{actionModal.nama}</span>
            </p>

            {actionModal.type === 'extend' ? (
              <>
                <div className="flex items-center justify-center gap-4 mb-6">
                  <button onClick={() => setExtendHours(Math.max(1, extendHours - 1))} className="w-10 h-10 bg-slate-100 rounded-full font-bold text-xl hover:bg-slate-200">-</button>
                  <span className="text-3xl font-black text-blue-600 w-16 text-center">{extendHours}</span>
                  <button onClick={() => setExtendHours(extendHours + 1)} className="w-10 h-10 bg-slate-100 rounded-full font-bold text-xl hover:bg-slate-200">+</button>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setActionModal(null)} className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold">Batal</button>
                  <button onClick={() => handleExtend(actionModal.id)} className="flex-1 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700">+ Tambah</button>
                </div>
              </>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setActionModal(null)} className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold">Batal</button>
                <button onClick={() => handleStop(actionModal.id, actionModal.nama)} className="flex-1 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700">Ya, Hentikan</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
