import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = getDb()
  const lists = db.prepare('SELECT * FROM shopping_lists WHERE user_id = ? ORDER BY created_at DESC').all(user.userId)
  return NextResponse.json(lists)
}

export async function POST(req: NextRequest) {
  const user = getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { name, store } = await req.json()
  const db = getDb()
  const result = db.prepare('INSERT INTO shopping_lists (user_id, name, store) VALUES (?,?,?)').run(user.userId, name, store || null)
  return NextResponse.json({ id: result.lastInsertRowid, success: true })
}

export async function PATCH(req: NextRequest) {
  const user = getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, status } = await req.json()
  const db = getDb()
  const completedAt = status === 'completed' ? new Date().toISOString() : null
  db.prepare('UPDATE shopping_lists SET status = ?, completed_at = ? WHERE id = ? AND user_id = ?').run(status, completedAt, id, user.userId)
  return NextResponse.json({ success: true })
}
