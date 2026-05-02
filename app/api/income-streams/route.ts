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
  const streams = db.prepare(`
    SELECT s.*, b.name as business_name
    FROM income_streams s
    LEFT JOIN businesses b ON b.id = s.business_id
    WHERE s.user_id = ?
    ORDER BY s.created_at ASC
  `).all(user.userId)
  return NextResponse.json({ streams })
}

export async function POST(req: NextRequest) {
  const user = getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { name, description, color, icon, business_id } = await req.json()
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })
  const db = getDb()
  const id = (db.prepare(`
    INSERT INTO income_streams (user_id, business_id, name, description, color, icon)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(user.userId, business_id || null, name, description || '', color || '#00d4ff', icon || 'trending-up')).lastInsertRowid
  const stream = db.prepare('SELECT * FROM income_streams WHERE id = ?').get(id)
  return NextResponse.json({ stream })
}

export async function PATCH(req: NextRequest) {
  const user = getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, name, description, color, icon, business_id, is_active } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
  const db = getDb()
  db.prepare(`UPDATE income_streams SET name=?, description=?, color=?, icon=?, business_id=?, is_active=? WHERE id=? AND user_id=?`)
    .run(name, description || '', color || '#00d4ff', icon || 'trending-up', business_id || null, is_active ?? 1, id, user.userId)
  const stream = db.prepare('SELECT * FROM income_streams WHERE id = ?').get(id)
  return NextResponse.json({ stream })
}

export async function DELETE(req: NextRequest) {
  const user = getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await req.json()
  const db = getDb()
  db.prepare('DELETE FROM income_streams WHERE id = ? AND user_id = ?').run(id, user.userId)
  return NextResponse.json({ ok: true })
}
