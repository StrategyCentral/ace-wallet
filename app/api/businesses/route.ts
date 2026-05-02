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
  const businesses = db.prepare(`
    SELECT b.*, bm.role as my_role,
      (SELECT COUNT(*) FROM business_members WHERE business_id = b.id) as member_count
    FROM businesses b
    JOIN business_members bm ON bm.business_id = b.id AND bm.user_id = ?
    ORDER BY b.created_at ASC
  `).all(user.userId)
  return NextResponse.json({ businesses })
}

export async function POST(req: NextRequest) {
  const user = getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { name, abn, tax_id, country, currency, tax_framework, industry, color } = await req.json()
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })
  const db = getDb()
  const bizId = (db.prepare(`
    INSERT INTO businesses (owner_id, name, abn, tax_id, country, currency, tax_framework, industry, color)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(user.userId, name, abn || '', tax_id || '', country || 'AU', currency || 'AUD',
    tax_framework || 'AU_GST', industry || '', color || '#00d4ff')).lastInsertRowid
  db.prepare("INSERT INTO business_members (business_id, user_id, role) VALUES (?, ?, 'owner')").run(bizId, user.userId)
  const biz = db.prepare('SELECT * FROM businesses WHERE id = ?').get(bizId)
  return NextResponse.json({ business: biz })
}

export async function PATCH(req: NextRequest) {
  const user = getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, name, abn, tax_id, country, currency, tax_framework, industry, color } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
  const db = getDb()
  const member = db.prepare("SELECT role FROM business_members WHERE business_id = ? AND user_id = ?").get(id, user.userId) as { role: string } | undefined
  if (!member || !['owner', 'admin'].includes(member.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  db.prepare(`UPDATE businesses SET name=?, abn=?, tax_id=?, country=?, currency=?, tax_framework=?, industry=?, color=? WHERE id=?`)
    .run(name, abn || '', tax_id || '', country || 'AU', currency || 'AUD', tax_framework || 'AU_GST', industry || '', color || '#00d4ff', id)
  const biz = db.prepare('SELECT * FROM businesses WHERE id = ?').get(id)
  return NextResponse.json({ business: biz })
}

export async function DELETE(req: NextRequest) {
  const user = getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await req.json()
  const db = getDb()
  const biz = db.prepare('SELECT * FROM businesses WHERE id = ? AND owner_id = ?').get(id, user.userId)
  if (!biz) return NextResponse.json({ error: 'Not found or forbidden' }, { status: 404 })
  db.prepare('DELETE FROM businesses WHERE id = ?').run(id)
  return NextResponse.json({ ok: true })
}
