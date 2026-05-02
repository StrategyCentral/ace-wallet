import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const db = getDb()
  let q = 'SELECT * FROM subscriptions WHERE user_id = ?'
  const params: any[] = [user.userId]
  if (status) { q += ' AND status = ?'; params.push(status) }
  q += ' ORDER BY next_billing_date'
  return NextResponse.json(db.prepare(q).all(...params))
}

export async function POST(req: NextRequest) {
  const user = getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json()
    const { name, amount, billing_cycle, next_billing_date, category, color, url, notes } = body
    const db = getDb()
    const result = db.prepare(
      'INSERT INTO subscriptions (user_id, name, amount, billing_cycle, next_billing_date, category, color, url, notes) VALUES (?,?,?,?,?,?,?,?,?)'
    ).run(user.userId, name, amount, billing_cycle, next_billing_date, category || 'Subscriptions', color || '#8b5cf6', url || null, notes || null)
    return NextResponse.json({ id: result.lastInsertRowid, success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const user = getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const { id, status, ...rest } = body
  const db = getDb()
  if (status) {
    db.prepare('UPDATE subscriptions SET status = ? WHERE id = ? AND user_id = ?').run(status, id, user.userId)
  }
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const user = getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await req.json()
  const db = getDb()
  db.prepare('DELETE FROM subscriptions WHERE id = ? AND user_id = ?').run(id, user.userId)
  return NextResponse.json({ success: true })
}
