import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

function getUser(req: NextRequest) {
  const token = req.cookies.get('ace_token')?.value
  if (!token) return null
  return verifyToken(token)
}

export async function GET(req: NextRequest) {
  const user = getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = getDb()
  const debts = db.prepare(
    'SELECT * FROM debts WHERE user_id = ? ORDER BY is_paid_off ASC, balance ASC'
  ).all(user.userId)
  return NextResponse.json({ debts })
}

export async function POST(req: NextRequest) {
  const user = getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { name, type, balance, interest_rate, minimum_payment, due_day, lender, color } = await req.json()
  if (!name || !balance || !minimum_payment) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  const db = getDb()
  const id = (db.prepare(`
    INSERT INTO debts (user_id, name, type, balance, original_balance, interest_rate, minimum_payment, due_day, lender, color)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(user.userId, name, type || 'other', balance, balance, interest_rate || 0,
    minimum_payment, due_day || 1, lender || '', color || '#ef4444')).lastInsertRowid
  const debt = db.prepare('SELECT * FROM debts WHERE id = ?').get(id)
  return NextResponse.json({ debt })
}

export async function PATCH(req: NextRequest) {
  const user = getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, name, type, balance, interest_rate, minimum_payment, due_day, lender, color, is_paid_off } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
  const db = getDb()
  const paid_off_date = is_paid_off ? new Date().toISOString().split('T')[0] : null
  db.prepare(`UPDATE debts SET name=?, type=?, balance=?, interest_rate=?, minimum_payment=?, due_day=?, lender=?, color=?, is_paid_off=?, paid_off_date=? WHERE id=? AND user_id=?`)
    .run(name, type || 'other', balance, interest_rate || 0, minimum_payment, due_day || 1,
      lender || '', color || '#ef4444', is_paid_off ? 1 : 0, paid_off_date, id, user.userId)
  const debt = db.prepare('SELECT * FROM debts WHERE id = ?').get(id)
  return NextResponse.json({ debt })
}

export async function DELETE(req: NextRequest) {
  const user = getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await req.json()
  const db = getDb()
  db.prepare('DELETE FROM debts WHERE id = ? AND user_id = ?').run(id, user.userId)
  return NextResponse.json({ ok: true })
}
