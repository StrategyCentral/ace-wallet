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
  const business_id = searchParams.get('business_id')
  const db = getDb()
  let query = `SELECT i.*, b.name as business_name FROM integrations i JOIN businesses b ON b.id = i.business_id WHERE i.user_id = ?`
  const params: (string | number)[] = [user.userId]
  if (business_id) { query += ' AND i.business_id = ?'; params.push(business_id) }
  const integrations = db.prepare(query).all(...params)
  // Mask credentials
  const safe = integrations.map((i: Record<string, unknown>) => {
    const creds = JSON.parse(i.credentials as string || '{}')
    const masked: Record<string, string> = {}
    Object.keys(creds).forEach(k => {
      const v = String(creds[k])
      masked[k] = v.length > 8 ? v.slice(0, 4) + '****' + v.slice(-4) : '****'
    })
    return { ...i, credentials: masked, credentials_set: Object.keys(creds).length > 0 }
  })
  return NextResponse.json({ integrations: safe })
}

export async function POST(req: NextRequest) {
  const user = getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { business_id, platform, credentials, sync_from_date } = await req.json()
  if (!business_id || !platform || !credentials) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  const db = getDb()
  const member = db.prepare("SELECT role FROM business_members WHERE business_id = ? AND user_id = ?").get(business_id, user.userId) as { role: string } | undefined
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  db.prepare(`
    INSERT INTO integrations (user_id, business_id, platform, credentials, sync_from_date, is_active)
    VALUES (?, ?, ?, ?, ?, 1)
    ON CONFLICT(business_id, platform) DO UPDATE SET credentials=excluded.credentials, sync_from_date=excluded.sync_from_date, is_active=1
  `).run(user.userId, business_id, platform, JSON.stringify(credentials), sync_from_date || null)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const user = getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await req.json()
  const db = getDb()
  db.prepare('DELETE FROM integrations WHERE id = ? AND user_id = ?').run(id, user.userId)
  return NextResponse.json({ ok: true })
}
