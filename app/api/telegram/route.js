import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabaseServer'

export async function POST(request) {
  try {
    const isCron = request.headers.get('x-cron-secret') === process.env.CRON_SECRET
    
    if (!isCron) {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      }
    }

    const { message } = await request.json()
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    const chatId = process.env.TELEGRAM_CHAT_ID

    if (!botToken || !chatId) {
      console.warn('Telegram credentials not configured.')
      return NextResponse.json({ success: false, error: 'Not configured' }, { status: 500 })
    }

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown'
      })
    })

    const data = await response.json()
    return NextResponse.json({ success: data.ok, data })
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
