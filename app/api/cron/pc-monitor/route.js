import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET(request) {
  // Verifikasi request berasal dari Vercel Cron (opsional, tapi disarankan)
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const adminClient = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // Cari sesi yang aktif tapi waktunya sudah lewat sekarang
    const now = new Date().toISOString()
    const { data: overdues, error: fetchErr } = await adminClient
      .from('penggunaan_pc')
      .select('id, nama_pengguna, tujuan, waktu_selesai')
      .eq('status', 'Aktif')
      .lt('waktu_selesai', now)

    if (fetchErr) throw fetchErr

    if (overdues && overdues.length > 0) {
      const ids = overdues.map(o => o.id)
      
      // Update status menjadi Overdue
      const { error: updateErr } = await adminClient
        .from('penggunaan_pc')
        .update({ status: 'Overdue' })
        .in('id', ids)

      if (updateErr) throw updateErr

      // Kirim notifikasi Telegram untuk tiap PC yang overdue
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `https://${request.headers.get('host')}`
      for (const o of overdues) {
        await fetch(`${baseUrl}/api/telegram`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: `⚠️ *WAKTU HABIS*\n🖥 PC digunakan oleh: ${o.nama_pengguna}\nSegera cek ke studio!`
          })
        }).catch(err => console.error('Telegram err:', err))
      }
    }

    return NextResponse.json({ success: true, processed: overdues?.length || 0 })
  } catch (error) {
    console.error('Cron PC error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
