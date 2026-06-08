import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabaseServer'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const adminClient = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const { email, password, nama, role } = await request.json()

  if (!email || !password || !nama) {
    return NextResponse.json({ error: 'Email, password, dan nama wajib diisi' }, { status: 400 })
  }

  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    user_metadata: { nama },
    email_confirm: true,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await adminClient
    .from('profiles')
    .update({ nama, ...(role === 'admin' ? { role: 'admin' } : {}) })
    .eq('id', data.user.id)

  return NextResponse.json({ success: true })
}
