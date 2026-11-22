import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import { ownsRow } from '@/lib/ownership'

// Items are owned through their list: every query joins shopping_lists on user_id.
const OWNED_ITEM = 'id = ? AND list_id IN (SELECT id FROM shopping_lists WHERE user_id = ?)'

export async function GET(req: NextRequest) {
  const user = getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const list_id = searchParams.get('list_id')
  if (!list_id) return NextResponse.json({ error: 'list_id required' }, { status: 400 })
  const db = getDb()
  if (!ownsRow(db, 'shopping_lists', list_id, user.userId)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const items = db.prepare('SELECT * FROM shopping_items WHERE list_id = ? ORDER BY created_at').all(list_id)
  return NextResponse.json(items)
}

export async function POST(req: NextRequest) {
  const user = getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { list_id, gtin, name, brand, quantity, unit } = await req.json()
  const db = getDb()
  if (!ownsRow(db, 'shopping_lists', list_id, user.userId)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const result = db.prepare(
    'INSERT INTO shopping_items (list_id, gtin, name, brand, quantity, unit) VALUES (?,?,?,?,?,?)'
  ).run(list_id, gtin || null, name, brand || null, quantity || 1, unit || 'each')
  return NextResponse.json({ id: result.lastInsertRowid, success: true })
}

export async function PATCH(req: NextRequest) {
  const user = getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const { id, checked_off, price_woolworths, price_coles, price_aldi, price_iga, best_store, best_price, last_price_check } = body
  const db = getDb()
  if (checked_off !== undefined) {
    db.prepare(`UPDATE shopping_items SET checked_off = ? WHERE ${OWNED_ITEM}`).run(checked_off ? 1 : 0, id, user.userId)
  }
  if (price_woolworths !== undefined || price_coles !== undefined) {
    db.prepare(`UPDATE shopping_items SET price_woolworths=?, price_coles=?, price_aldi=?, price_iga=?, best_store=?, best_price=?, last_price_check=? WHERE ${OWNED_ITEM}`)
      .run(price_woolworths, price_coles, price_aldi, price_iga, best_store, best_price, last_price_check, id, user.userId)
  }
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const user = getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await req.json()
  const db = getDb()
  db.prepare(`DELETE FROM shopping_items WHERE ${OWNED_ITEM}`).run(id, user.userId)
  return NextResponse.json({ success: true })
}
