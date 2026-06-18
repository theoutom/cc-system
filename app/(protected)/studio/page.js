'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Calendar as BigCalendar, dateFnsLocalizer } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay, addHours, parseISO, isAfter } from 'date-fns'
import { id } from 'date-fns/locale/id'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { Plus, X, Trash2, CalendarCheck2 } from 'lucide-react'

const locales = {
  'id': id,
}

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { locale: id }),
  getDay,
  locales,
})

export default function StudioPage() {
  const supabase = createClient()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  
  const now = new Date()
  // Default waktu mulai: jam terdekat berikutnya
  const defaultStart = new Date()
  defaultStart.setMinutes(0, 0, 0)
  defaultStart.setHours(defaultStart.getHours() + 1)
  
  const [form, setForm] = useState({
    nama_peminjam: '',
    tujuan: '',
    tanggal: format(defaultStart, 'yyyy-MM-dd'),
    jam_mulai: format(defaultStart, 'HH:mm'),
    durasi_jam: 1
  })

  useEffect(() => {
    fetchUser()
    fetchEvents()
  }, [])

  const fetchUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setCurrentUser(p)
      setForm(prev => ({ ...prev, nama_peminjam: p?.nama || '' }))
    }
  }

  const fetchEvents = async () => {
    setLoading(true)
    const { data } = await supabase.from('jadwal_studio').select('*')
    if (data) {
      setEvents(data.map(d => ({
        id: d.id,
        title: `${d.nama_peminjam} - ${d.tujuan}`,
        start: new Date(d.waktu_mulai),
        end: new Date(d.waktu_selesai),
        resource: d
      })))
    }
    setLoading(false)
  }

  const handleSubmit = async () => {
    if (!form.nama_peminjam || !form.tujuan || !form.tanggal || !form.jam_mulai) {
      alert('Mohon isi semua data')
      return
    }

    const startDateTime = new Date(`${form.tanggal}T${form.jam_mulai}:00`)
    const endDateTime = addHours(startDateTime, form.durasi_jam)

    // Validasi overlap
    const isOverlap = events.some(e => {
      return (startDateTime < e.end && endDateTime > e.start)
    })

    if (isOverlap) {
      alert('Maaf, studio sudah dibooking pada jam tersebut.')
      return
    }

    try {
      const { error } = await supabase.from('jadwal_studio').insert({
        nama_peminjam: form.nama_peminjam,
        tujuan: form.tujuan,
        waktu_mulai: startDateTime.toISOString(),
        waktu_selesai: endDateTime.toISOString(),
        created_by: (await supabase.auth.getUser()).data.user?.id
      })
      if (error) throw error

      setShowForm(false)
      fetchEvents()
    } catch (e) {
      alert('Gagal membooking: ' + e.message)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Yakin batalkan booking ini?')) return
    try {
      const { error } = await supabase.from('jadwal_studio').delete().eq('id', id)
      if (error) throw error
      setSelectedEvent(null)
      fetchEvents()
    } catch (e) {
      alert('Gagal menghapus: ' + e.message)
    }
  }

  const CustomToolbar = (toolbar) => {
    const goToBack = () => toolbar.onNavigate('PREV')
    const goToNext = () => toolbar.onNavigate('NEXT')
    const goToCurrent = () => toolbar.onNavigate('TODAY')
    return (
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          <button onClick={goToBack} className="px-3 py-1.5 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50">Sebelumnnya</button>
          <button onClick={goToCurrent} className="px-3 py-1.5 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50">Hari Ini</button>
          <button onClick={goToNext} className="px-3 py-1.5 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50">Selanjutnya</button>
        </div>
        <h2 className="text-lg font-bold text-slate-800 capitalize">{toolbar.label}</h2>
        <div className="flex bg-slate-100 p-1 rounded-lg">
          {['month', 'week', 'day', 'agenda'].map(view => (
            <button key={view} onClick={() => toolbar.onView(view)} 
              className={`px-3 py-1 text-sm font-medium capitalize rounded-md ${toolbar.view === view ? 'bg-white shadow text-purple-600' : 'text-slate-500 hover:text-slate-700'}`}>
              {view === 'month' ? 'Bulan' : view === 'week' ? 'Minggu' : view === 'day' ? 'Hari' : 'Agenda'}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col min-h-[85vh]">
      <div className="mb-6 flex justify-between items-end flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Kalender Studio</h1>
          <p className="text-slate-500 text-sm mt-0.5">Booking dan pantau pemakaian ruang studio CC</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
          <CalendarCheck2 className="w-4 h-4" /> Booking Studio
        </button>
      </div>

      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex-1 overflow-hidden min-h-[600px]">
        {loading ? (
          <div className="h-full flex items-center justify-center text-slate-400">Memuat Kalender...</div>
        ) : (
          <BigCalendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            culture="id"
            onSelectEvent={(e) => setSelectedEvent(e)}
            components={{ toolbar: CustomToolbar }}
            eventPropGetter={() => ({
              className: 'bg-purple-100 border-l-4 border-purple-500 text-purple-800 font-medium text-xs px-1 rounded-sm',
              style: { color: '#6b21a8' }
            })}
          />
        )}
      </div>

      {/* Booking Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">Booking Studio</h3>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Nama Peminjam</label>
                <input value={form.nama_peminjam} onChange={e => setForm({...form, nama_peminjam: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Keperluan / Tujuan</label>
                <input value={form.tujuan} onChange={e => setForm({...form, tujuan: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none" 
                  placeholder="Misal: Take Video Sambutan" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Tanggal</label>
                  <input type="date" value={form.tanggal} onChange={e => setForm({...form, tanggal: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Jam Mulai</label>
                  <input type="time" value={form.jam_mulai} onChange={e => setForm({...form, jam_mulai: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Durasi (Jam)</label>
                <select value={form.durasi_jam} onChange={e => setForm({...form, durasi_jam: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm">
                  {[1, 2, 3, 4, 5, 6].map(h => (
                    <option key={h} value={h}>{h} Jam</option>
                  ))}
                </select>
              </div>
            </div>

            <button onClick={handleSubmit}
              className="w-full mt-6 py-2.5 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700">
              Booking Sekarang
            </button>
          </div>
        </div>
      )}

      {/* Event Details Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 mb-2 inline-block">BOOKED</span>
                <h3 className="font-bold text-lg leading-tight">{selectedEvent.resource.tujuan}</h3>
              </div>
              <button onClick={() => setSelectedEvent(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
            </div>
            
            <div className="space-y-3 mt-4 text-sm text-slate-700">
              <div className="flex gap-2">
                <span className="text-slate-400 w-20">Oleh</span>
                <span className="font-semibold">{selectedEvent.resource.nama_peminjam}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-slate-400 w-20">Tanggal</span>
                <span className="font-medium">{format(selectedEvent.start, 'EEEE, d MMMM yyyy', { locale: id })}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-slate-400 w-20">Waktu</span>
                <span className="font-medium">{format(selectedEvent.start, 'HH:mm')} - {format(selectedEvent.end, 'HH:mm')}</span>
              </div>
            </div>

            {/* Hapus hanya jika admin atau pembuat */}
            {(currentUser?.role === 'admin' || currentUser?.id === selectedEvent.resource.created_by) && (
              <button onClick={() => handleDelete(selectedEvent.id)}
                className="w-full mt-6 py-2 border-2 border-red-100 text-red-600 font-bold rounded-xl hover:bg-red-50 flex items-center justify-center gap-2">
                <Trash2 className="w-4 h-4" /> Batalkan Booking
              </button>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
