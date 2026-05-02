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
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  const db = getDb()
  let q = 'SELECT * FROM categories WHERE user_id = ?'
  const params: (string | number)[] = [user.userId]
  if (type) { q += ' AND type = ?'; params.push(type) }
  q += ' ORDER BY name'
  return NextResponse.json({ categories: db.prepare(q).all(...params) })
}

export async function POST(req: NextRequest) {
  const user = getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { name, type, color, icon, budget_limit, is_tax_deductible } = await req.json()
  const db = getDb()
  const result = db.prepare(
    'INSERT INTO categories (user_id, name, type, color, icon, budget_limit, is_tax_deductible) VALUES (?,?,?,?,?,?,?)'
  ).run(user.userId, name, type, color || '#8b5cf6', icon || 'tag', budget_limit || 0, is_tax_deductible ? 1 : 0)
  return NextResponse.json({ id: result.lastInsertRowid, success: true })
}

export async function PATCH(req: NextRequest) {
  const user = getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, name, color, icon, budget_limit, is_tax_deductible } = await req.json()
  const db = getDb()
  db.prepare('UPDATE categories SET name=?, color=?, icon=?, budget_limit=?, is_tax_deductible=? WHERE id=? AND user_id=?')
    .run(name, color || '#8b5cf6', icon || 'tag', budget_limit || 0, is_tax_deductible ? 1 : 0, id, user.userId)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const user = getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await req.json()
  const db = getDb()
  db.prepare('DELETE FROM categories WHERE id = ? AND user_id = ?').run(id, user.userId)
  return NextResponse.json({ ok: true })
}
