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
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') // 'unpaid', 'paid', 'all'
  const scope = searchParams.get('scope')

  let query = `SELECT b.*, c.name as category_name, c.color as cat_color, biz.name as business_name
    FROM bills b
    LEFT JOIN categories c ON c.id = b.category_id
    LEFT JOIN businesses biz ON biz.id = b.business_id
    WHERE b.user_id = ?`
  const params: (string | number)[] = [user.userId]

  if (status === 'unpaid') { query += ` AND b.is_paid = 0` }
  else if (status === 'paid') { query += ` AND b.is_paid = 1` }
  if (scope) { query += ` AND b.scope = ?`; params.push(scope) }

  query += ` ORDER BY b.is_paid ASC, b.is_urgent DESC, b.due_date ASC`
  const bills = db.prepare(query).all(...params)
  return NextResponse.json({ bills })
}

export async function POST(req: NextRequest) {
  const user = getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const { name, amount, currency, scope, business_id, category_id, due_date,
    is_recurring, recur_interval, is_urgent, notes, color } = body
  if (!name || !amount || !due_date) return NextResponse.json({ error: 'Name, amount, and due date required' }, { status: 400 })
  const db = getDb()
  const id = (db.prepare(`
    INSERT INTO bills (user_id, business_id, name, amount, currency, scope, category_id, due_date,
      is_recurring, recur_interval, is_urgent, notes, color)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    user.userId, scope === 'business' && business_id ? business_id : null,
    name, amount, currency || 'AUD', scope || 'personal',
    category_id || null, due_date,
    is_recurring ? 1 : 0, recur_interval || null,
    is_urgent ? 1 : 0, notes || null, color || '#f59e0b'
  )).lastInsertRowid
  const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(id)
  return NextResponse.json({ bill })
}

export async function PATCH(req: NextRequest) {
  const user = getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const { id, name, amount, currency, scope, business_id, category_id, due_date,
    is_recurring, recur_interval, is_urgent, is_paid, paid_date, matched_transaction_id, notes, color } = body
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
  const db = getDb()
  db.prepare(`
    UPDATE bills SET name=?, amount=?, currency=?, scope=?, business_id=?, category_id=?, due_date=?,
      is_recurring=?, recur_interval=?, is_urgent=?, is_paid=?, paid_date=?, matched_transaction_id=?, notes=?, color=?
    WHERE id=? AND user_id=?
  `).run(
    name, amount, currency || 'AUD', scope || 'personal',
    scope === 'business' && business_id ? business_id : null,
    category_id || null, due_date,
    is_recurring ? 1 : 0, recur_interval || null,
    is_urgent ? 1 : 0, is_paid ? 1 : 0,
    is_paid ? (paid_date || new Date().toISOString().split('T')[0]) : null,
    matched_transaction_id || null, notes || null, color || '#f59e0b',
    id, user.userId
  )
  const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(id)
  return NextResponse.json({ bill })
}

export async function DELETE(req: NextRequest) {
  const user = getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await req.json()
  const db = getDb()
  db.prepare('DELETE FROM bills WHERE id = ? AND user_id = ?').run(id, user.userId)
  return NextResponse.json({ ok: true })
}
