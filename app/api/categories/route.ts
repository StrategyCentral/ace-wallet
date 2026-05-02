import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  const db = getDb()
  let q = 'SELECT * FROM categories WHERE user_id = ?'
  const params: any[] = [user.userId]
  if (type) { q += ' AND type = ?'; params.push(type) }
  q += ' ORDER BY name'
  return NextResponse.json(db.prepare(q).all(...params))
}

export async function POST(req: NextRequest) {
  const user = getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { name, type, color, icon, budget_limit } = await req.json()
  const db = getDb()
  const result = db.prepare('INSERT INTO categories (user_id, name, type, color, icon, budget_limit) VALUES (?,?,?,?,?,?)').run(user.userId, name, type, color || '#8b5cf6', icon || 'tag', budget_limit || 0)
  return NextResponse.json({ id: result.lastInsertRowid, success: true })
}
