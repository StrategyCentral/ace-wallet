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
  const assignments = db.prepare(`
    SELECT ba.*, a.name as account_name, a.balance, a.currency, a.color as account_color, a.type as account_kind
    FROM bucket_assignments ba
    JOIN accounts a ON a.id = ba.account_id
    WHERE ba.user_id = ?
  `).all(user.userId)
  return NextResponse.json({ assignments })
}

export async function POST(req: NextRequest) {
  const user = getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { account_id, bucket } = await req.json()
  if (!account_id || !bucket) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  const db = getDb()
  db.prepare(`
    INSERT INTO bucket_assignments (user_id, account_id, bucket)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id, account_id) DO UPDATE SET bucket=excluded.bucket
  `).run(user.userId, account_id, bucket)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const user = getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { account_id } = await req.json()
  const db = getDb()
  db.prepare('DELETE FROM bucket_assignments WHERE user_id = ? AND account_id = ?').run(user.userId, account_id)
  return NextResponse.json({ ok: true })
}
