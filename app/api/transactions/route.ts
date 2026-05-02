import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month') // YYYY-MM
  const type = searchParams.get('type')
  const db = getDb()

  let q = `SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon
    FROM transactions t LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.user_id = ?`
  const params: any[] = [user.userId]

  if (month) { q += ' AND strftime(\'%Y-%m\', t.date) = ?'; params.push(month) }
  if (type) { q += ' AND t.type = ?'; params.push(type) }
  q += ' ORDER BY t.date DESC, t.id DESC'

  const rows = db.prepare(q).all(...params)
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const user = getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json()
    const { type, amount, description, category_id, date, recurring, recur_interval, notes } = body
    const db = getDb()
    const result = db.prepare(
      'INSERT INTO transactions (user_id, type, amount, description, category_id, date, recurring, recur_interval, notes) VALUES (?,?,?,?,?,?,?,?,?)'
    ).run(user.userId, type, amount, description, category_id || null, date, recurring ? 1 : 0, recur_interval || null, notes || null)
    return NextResponse.json({ id: result.lastInsertRowid, success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const user = getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await req.json()
  const db = getDb()
  db.prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?').run(id, user.userId)
  return NextResponse.json({ success: true })
}
