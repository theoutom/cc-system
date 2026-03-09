'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Users, Shield, User, X, Plus, Search } from 'lucide-react'

export default function AkunPage() {
  const supabase = createClient()
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState(null)
  const [search, setSearch] = useState('')
  const [showInvite, setShowInvite] = useState(false)
  const [inviteForm, setInviteForm] = useState({ email: '', nama: '', password: '', role: 'anggota' })
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user)
    const { data: p } = await supabase.from('profiles').select('*').order('created_at')
    setProfiles(p || [])
    setLoading(false)
  }

  const handleRoleChange = async (id, role) => {
    if (id === currentUser?.id) { alert('Tidak bisa mengubah role diri sendiri!'); return }
    await supabase.from('profiles').update({ role }).eq('id', id)
    fetchData()
  }

  const handleInvite = async () => {
    if (!inviteForm.email || !inviteForm.nama || !inviteForm.password) {
      alert('Harap isi semua field!')
      return
    }
    setSubmitting(true)
    setMsg('')

    const { data, error } = await supabase.auth.admin?.createUser({
      email: inviteForm.email,
      password: inviteForm.password,
      user_metadata: { nama: inviteForm.nama },
      email_confirm: true,
    })

    if (error) {
      setMsg('Gagal membuat akun: ' + error.message + '. Gunakan Supabase Dashboard untuk membuat user baru.')
    } else {
      if (inviteForm.role === 'admin') {
        await supabase.from('profiles').update({ role: 'admin', nama: inviteForm.nama }).eq('id', data.user.id)
      }
      setMsg('Akun berhasil dibuat!')
      setInviteForm({ email: '', nama: '', password: '', role: 'anggota' })
      fetchData()
    }
    setSubmitting(false)
  }

  const filtered = profiles.filter(p =>
    p.nama?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Kelola Akun</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manajemen akun anggota Creative Corner</p>
        </div>
        <button onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> Tambah Anggota
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-4 h-4 text-purple-600" />
            <p className="text-sm font-medium text-purple-800">Admin</p>
          </div>
          <p className="text-2xl font-bold text-purple-700">{profiles.filter(p => p.role === 'admin').length}</p>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <User className="w-4 h-4 text-slate-600" />
            <p className="text-sm font-medium text-slate-700">Anggota</p>
          </div>
          <p className="text-2xl font-bold text-slate-700">{profiles.filter(p => p.role === 'anggota').length}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Cari anggota..."
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      {/* List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <p className="text-center py-10 text-slate-400 text-sm">Memuat...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Tidak ada anggota ditemukan</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filtered.map(p => (
              <div key={p.id} className="px-5 py-4 flex items-center gap-4">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-purple-700 font-bold text-sm">{p.nama?.charAt(0)?.toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-slate-800 text-sm">{p.nama}</p>
                    {p.id === currentUser?.id && (
                      <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">Anda</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Bergabung: {new Date(p.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
                <select
                  value={p.role}
                  onChange={e => handleRoleChange(p.id, e.target.value)}
                  disabled={p.id === currentUser?.id}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium border cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    p.role === 'admin'
                      ? 'bg-purple-100 text-purple-700 border-purple-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  <option value="anggota">Anggota</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info banner */}
      <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
        <p className="font-medium mb-1">💡 Cara Tambah Anggota</p>
        <p className="text-xs text-blue-600">Untuk menambah anggota baru, buka <strong>Supabase Dashboard → Authentication → Users → Add User</strong>. Setelah user dibuat, ubah nama di profil dan sesuaikan role di sini.</p>
      </div>

      {/* Invite Modal */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900">Tambah Anggota Baru</h3>
              <button onClick={() => { setShowInvite(false); setMsg('') }} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {msg && (
                <div className={`p-3 rounded-lg text-sm ${msg.startsWith('Gagal') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                  {msg}
                </div>
              )}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
                ⚠️ Fitur ini memerlukan Supabase Service Role Key. Disarankan membuat user langsung dari Supabase Dashboard untuk keamanan.
              </div>
              {[
                { key: 'nama', label: 'Nama Lengkap', type: 'text', placeholder: 'cth: Vania Putri' },
                { key: 'email', label: 'Email', type: 'email', placeholder: 'email@sekolah.com' },
                { key: 'password', label: 'Password', type: 'password', placeholder: 'min. 6 karakter' },
              ].map(({ key, label, type, placeholder }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
                  <input type={type} value={inviteForm[key]} onChange={e => setInviteForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                <div className="flex gap-2">
                  {['anggota', 'admin'].map(r => (
                    <button key={r} type="button" onClick={() => setInviteForm(f => ({ ...f, role: r }))}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors capitalize ${inviteForm.role === r ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-slate-600 border-slate-200 hover:border-purple-300'}`}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex gap-3 justify-end">
              <button onClick={() => { setShowInvite(false); setMsg('') }} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Batal</button>
              <button onClick={handleInvite} disabled={submitting}
                className="px-5 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium disabled:opacity-50">
                {submitting ? 'Membuat...' : 'Buat Akun'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
