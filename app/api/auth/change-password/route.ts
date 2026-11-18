import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getDb } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import { rateLimit, clientIp } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const user = getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!rateLimit(`chpw:${user.userId}:${clientIp(req.headers)}`, 5, 15 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many attempts. Try again in 15 minutes.' }, { status: 429 })
  }
  let body: { current_password?: string; new_password?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  const current = String(body.current_password || '')
  const next = String(body.new_password || '')
  if (!current || !next) return NextResponse.json({ error: 'Current and new password are required' }, { status: 400 })
  if (next.length < 12) return NextResponse.json({ error: 'New password must be at least 12 characters' }, { status: 400 })
  if (next.length > 200) return NextResponse.json({ error: 'New password is too long' }, { status: 400 })
  if (next === current) return NextResponse.json({ error: 'New password must be different' }, { status: 400 })

  const db = getDb()
  const row = db.prepare('SELECT id, password_hash FROM users WHERE id = ?').get(user.userId) as { id: number; password_hash: string } | undefined
  if (!row) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ok = await bcrypt.compare(current, row.password_hash)
  if (!ok) return NextResponse.json({ error: 'Current password is wrong' }, { status: 400 })

  const hash = await bcrypt.hash(next, 10)
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, row.id)
  return NextResponse.json({ success: true })
}
