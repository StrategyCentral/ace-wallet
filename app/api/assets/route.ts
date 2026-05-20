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
  const assets = db.prepare(
    'SELECT a.*, b.name as business_name FROM assets a LEFT JOIN businesses b ON b.id = a.business_id WHERE a.user_id = ? ORDER BY a.current_value DESC'
  ).all(user.userId)
  return NextResponse.json({ assets })
}

export async function POST(req: NextRequest) {
  const user = getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const { name, type, scope, business_id, purchase_price, current_value, quantity,
    ticker_symbol, currency, date_acquired, alert_above, alert_below, notes, color } = body
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })
  const db = getDb()
  const id = (db.prepare(`
    INSERT INTO assets (user_id, business_id, name, type, scope, purchase_price, current_value, quantity,
      ticker_symbol, currency, date_acquired, alert_above, alert_below, notes, color)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    user.userId, scope === 'business' && business_id ? business_id : null,
    name, type || 'other', scope || 'personal',
    purchase_price || 0, current_value || 0, quantity || 1,
    ticker_symbol || null, currency || 'AUD', date_acquired || null,
    alert_above || null, alert_below || null, notes || null, color || '#10b981'
  )).lastInsertRowid
  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(id)
  return NextResponse.json({ asset })
}

export async function PATCH(req: NextRequest) {
  const user = getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const { id, name, type, scope, business_id, purchase_price, current_value, quantity,
    ticker_symbol, currency, date_acquired, alert_above, alert_below, notes, color } = body
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
  const db = getDb()
  db.prepare(`
    UPDATE assets SET name=?, type=?, scope=?, business_id=?, purchase_price=?, current_value=?, quantity=?,
      ticker_symbol=?, currency=?, date_acquired=?, alert_above=?, alert_below=?, notes=?, color=?
    WHERE id=? AND user_id=?
  `).run(
    name, type || 'other', scope || 'personal',
    scope === 'business' && business_id ? business_id : null,
    purchase_price || 0, current_value || 0, quantity || 1,
    ticker_symbol || null, currency || 'AUD', date_acquired || null,
    alert_above || null, alert_below || null, notes || null, color || '#10b981',
    id, user.userId
  )
  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(id)
  return NextResponse.json({ asset })
}

export async function DELETE(req: NextRequest) {
  const user = getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await req.json()
  const db = getDb()
  db.prepare('DELETE FROM assets WHERE id = ? AND user_id = ?').run(id, user.userId)
  return NextResponse.json({ ok: true })
}
