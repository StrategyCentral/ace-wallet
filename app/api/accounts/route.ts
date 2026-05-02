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
  const accounts = db.prepare(`
    SELECT a.*, b.name as business_name
    FROM accounts a
    LEFT JOIN businesses b ON b.id = a.business_id
    WHERE a.user_id = ?
    ORDER BY a.is_default DESC, a.created_at ASC
  `).all(user.userId)
  return NextResponse.json({ accounts })
}

export async function POST(req: NextRequest) {
  const user = getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { name, account_type, type, currency, balance, color, institution, last_four, notes, business_id } = await req.json()
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })
  const db = getDb()
  const id = (db.prepare(`
    INSERT INTO accounts (user_id, business_id, name, account_type, type, currency, balance, color, institution, last_four, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(user.userId, business_id || null, name, account_type || 'personal', type || 'checking',
    currency || 'AUD', balance || 0, color || '#8b5cf6', institution || '', last_four || '', notes || '')).lastInsertRowid
  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id)
  return NextResponse.json({ account })
}

export async function PATCH(req: NextRequest) {
  const user = getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, name, account_type, type, currency, balance, color, institution, last_four, notes, business_id } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
  const db = getDb()
  db.prepare(`UPDATE accounts SET name=?, account_type=?, type=?, currency=?, balance=?, color=?, institution=?, last_four=?, notes=?, business_id=? WHERE id=? AND user_id=?`)
    .run(name, account_type || 'personal', type || 'checking', currency || 'AUD', balance || 0,
      color || '#8b5cf6', institution || '', last_four || '', notes || '', business_id || null, id, user.userId)
  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id)
  return NextResponse.json({ account })
}

export async function DELETE(req: NextRequest) {
  const user = getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await req.json()
  const db = getDb()
  db.prepare('DELETE FROM accounts WHERE id = ? AND user_id = ?').run(id, user.userId)
  return NextResponse.json({ ok: true })
}
