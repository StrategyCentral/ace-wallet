import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const db = getDb()
  let q = `SELECT s.*, b.name AS business_name
           FROM subscriptions s
           LEFT JOIN businesses b ON b.id = s.business_id
           WHERE s.user_id = ?`
  const params: any[] = [user.userId]
  if (status) { q += ' AND s.status = ?'; params.push(status) }
  q += ' ORDER BY s.next_billing_date'
  return NextResponse.json(db.prepare(q).all(...params))
}

export async function POST(req: NextRequest) {
  const user = getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json()
    const {
      name, amount, billing_cycle, next_billing_date, category, color, url, notes,
      scope, business_id, is_tax_deductible
    } = body
    const db = getDb()
    const result = db.prepare(
      `INSERT INTO subscriptions
        (user_id, name, amount, billing_cycle, next_billing_date, category, color, url, notes, scope, business_id, is_tax_deductible)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
    ).run(
      user.userId,
      name,
      amount,
      billing_cycle,
      next_billing_date,
      category || 'Subscriptions',
      color || '#8b5cf6',
      url || null,
      notes || null,
      scope === 'business' ? 'business' : 'personal',
      scope === 'business' && business_id ? Number(business_id) : null,
      is_tax_deductible ? 1 : 0
    )
    return NextResponse.json({ id: result.lastInsertRowid, success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const user = getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json()
    const { id, ...rest } = body
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    const db = getDb()

    // Status-only update (Pause / Resume / Cancel / Reactivate)
    if (rest.status && Object.keys(rest).length === 1) {
      db.prepare('UPDATE subscriptions SET status = ? WHERE id = ? AND user_id = ?')
        .run(rest.status, id, user.userId)
      return NextResponse.json({ success: true })
    }

    // Full edit — only allow known columns
    const allowed = [
      'name','amount','billing_cycle','next_billing_date','category','color',
      'url','notes','scope','business_id','is_tax_deductible','status'
    ]
    const sets: string[] = []
    const params: any[] = []
    for (const key of allowed) {
      if (key in rest) {
        let value: any = (rest as any)[key]
        if (key === 'scope') value = value === 'business' ? 'business' : 'personal'
        if (key === 'business_id') value = value ? Number(value) : null
        if (key === 'is_tax_deductible') value = value ? 1 : 0
        sets.push(`${key} = ?`)
        params.push(value)
      }
    }
    // Auto-clear business_id when scope flips to personal
    if (rest.scope === 'personal' && !('business_id' in rest)) {
      sets.push('business_id = ?'); params.push(null)
    }
    if (!sets.length) return NextResponse.json({ success: true })
    params.push(id, user.userId)
    db.prepare(`UPDATE subscriptions SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`).run(...params)
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const user = getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await req.json()
  const db = getDb()
  db.prepare('DELETE FROM subscriptions WHERE id = ? AND user_id = ?').run(id, user.userId)
  return NextResponse.json({ success: true })
}
