'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Camera, Lock, Mail, Eye, EyeOff, UserX } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 10000)
    )

    try {
      const { error } = await Promise.race([
        supabase.auth.signInWithPassword({ email, password }),
        timeout,
      ])

      if (error) {
        if (error.message?.includes('Invalid login')) {
          setError('Email atau password salah. Periksa kembali.')
        } else {
          setError('Login gagal: ' + error.message)
        }
        setLoading(false)
      } else {
        window.location.href = '/dashboard'
      }
    } catch (err) {
      if (err.message === 'timeout') {
        setError(
          'Koneksi ke server timeout. Kemungkinan penyebab:\n' +
          '1. Project Supabase sedang pause — buka supabase.com/dashboard dan klik Restore\n' +
          '2. URL atau API Key di Vercel salah — cek Settings → Environment Variables'
        )
      } else {
        setError('Terjadi kesalahan: ' + err.message)
      }
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-600 rounded-2xl mb-4 shadow-lg shadow-purple-500/30">
            <Camera className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Creative Corner</h1>
          <p className="text-slate-400 mt-1 text-sm">Sistem Manajemen Studio CC</p>
        </div>

        {/* Form */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-xl font-semibold text-white mb-6">Masuk ke Sistem</h2>

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg text-sm mb-5 whitespace-pre-line leading-relaxed">
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="nama@sekolah.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 text-white font-semibold rounded-lg transition-colors duration-200 shadow-lg shadow-purple-500/30 text-sm"
            >
              {loading ? 'Memproses...' : 'Masuk'}
            </button>
          </form>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-slate-500 text-xs">atau</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Guest access */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <p className="text-slate-400 text-xs text-center mb-3 font-medium">
            Mau pinjam / kembalikan alat tanpa akun?
          </p>
          <div className="grid grid-cols-2 gap-2">
            <a href="/publik/pinjam"
              className="flex items-center justify-center gap-2 py-2.5 px-4 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl text-sm font-medium transition-colors">
              📦 Pinjam Alat
            </a>
            <a href="/publik/kembali"
              className="flex items-center justify-center gap-2 py-2.5 px-4 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl text-sm font-medium transition-colors">
              🔄 Kembalikan
            </a>
          </div>
          <p className="text-slate-600 text-xs text-center mt-3">
            Akses tamu tidak memerlukan akun
          </p>
        </div>
      </div>
    </div>
  )
}
