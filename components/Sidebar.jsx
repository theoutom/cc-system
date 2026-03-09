'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import {
  Camera, LayoutDashboard, Package, RotateCcw, Eye,
  Calendar, Box, Users, LogOut, ChevronDown, Menu, X
} from 'lucide-react'
import { useState } from 'react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/peminjaman', label: 'Peminjaman', icon: Package },
  { href: '/pengembalian', label: 'Pengembalian', icon: RotateCcw },
  { href: '/pemantauan', label: 'Pemantauan', icon: Eye },
  { href: '/jadwal', label: 'Jadwal', icon: Calendar },
]

const adminItems = [
  { href: '/admin/inventaris', label: 'Inventaris Alat', icon: Box },
  { href: '/admin/akun', label: 'Kelola Akun', icon: Users },
]

export default function Sidebar({ user, role }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const isActive = (href) => pathname === href || pathname.startsWith(href + '/')

  const NavLink = ({ href, label, icon: Icon }) => (
    <Link
      href={href}
      onClick={() => setOpen(false)}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
        isActive(href)
          ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
          : 'text-slate-400 hover:text-white hover:bg-white/10'
      }`}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      {label}
    </Link>
  )

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
        <div className="w-9 h-9 bg-purple-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-purple-500/30">
          <Camera className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-white font-bold text-sm leading-tight">Creative Corner</p>
          <p className="text-slate-500 text-xs">Studio Management</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
        {navItems.map(item => (
          <NavLink key={item.href} {...item} />
        ))}

        {role === 'admin' && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <p className="px-3 text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Admin</p>
            {adminItems.map(item => (
              <NavLink key={item.href} {...item} />
            ))}
          </div>
        )}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-2 mb-2">
          <div className="w-8 h-8 bg-purple-700 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">
              {user?.nama?.charAt(0)?.toUpperCase() || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{user?.nama || 'User'}</p>
            <p className="text-slate-500 text-xs capitalize">{role || 'anggota'}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-colors duration-150"
        >
          <LogOut className="w-4 h-4" />
          Keluar
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 w-9 h-9 bg-slate-800 rounded-lg flex items-center justify-center text-white shadow-lg"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/60" onClick={() => setOpen(false)}>
          <div className="w-64 h-full bg-slate-900" onClick={e => e.stopPropagation()}>
            <button onClick={() => setOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 bg-slate-900 flex-col h-screen sticky top-0 flex-shrink-0">
        <SidebarContent />
      </aside>
    </>
  )
}
