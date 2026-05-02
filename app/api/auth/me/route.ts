import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getDb } from '@/lib/db'

export async function GET() {
  const user = getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = getDb()
  const u = db.prepare('SELECT id, email, name, role FROM users WHERE id = ?').get(user.userId) as any
  return NextResponse.json(u)
}
