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
  const debts = db.prepare(
    'SELECT d.*, b.name as business_name FROM debts d LEFT JOIN businesses b ON b.id = d.business_id WHERE d.user_id = ? ORDER BY d.is_paid_off ASC, d.balance ASC'
  ).all(user.userId)
  return NextResponse.json({ debts })
}

export async function POST(req: NextRequest) {
  const user = getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { name, type, balance, interest_rate, minimum_payment, due_day, lender, color,
    scope, business_id, interest_free_months, annual_fee, monthly_fee, fee_interest_rate,
    payment_allocation, promo_end_date, accrued_fees } = await req.json()
  if (!name || !balance || !minimum_payment) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  const db = getDb()
  const id = (db.prepare(`
    INSERT INTO debts (user_id, name, type, balance, original_balance, interest_rate, minimum_payment,
      due_day, lender, color, scope, business_id, interest_free_months, annual_fee, monthly_fee,
      fee_interest_rate, payment_allocation, promo_end_date, accrued_fees)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    user.userId, name, type || 'other', balance, balance, interest_rate || 0,
    minimum_payment, due_day || 1, lender || '', color || '#ef4444',
    scope || 'personal', scope === 'business' && business_id ? business_id : null,
    interest_free_months || 0, annual_fee || 0, monthly_fee || 0,
    fee_interest_rate || 0, payment_allocation || 'purchase_first',
    promo_end_date || null, accrued_fees || 0
  )).lastInsertRowid
  const debt = db.prepare('SELECT * FROM debts WHERE id = ?').get(id)
  return NextResponse.json({ debt })
}

export async function PATCH(req: NextRequest) {
  const user = getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, name, type, balance, interest_rate, minimum_payment, due_day, lender, color, is_paid_off,
    scope, business_id, interest_free_months, annual_fee, monthly_fee, fee_interest_rate,
    payment_allocation, promo_end_date, accrued_fees } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
  const db = getDb()
  const paid_off_date = is_paid_off ? new Date().toISOString().split('T')[0] : null
  db.prepare(`UPDATE debts SET name=?, type=?, balance=?, interest_rate=?, minimum_payment=?, due_day=?,
    lender=?, color=?, is_paid_off=?, paid_off_date=?, scope=?, business_id=?,
    interest_free_months=?, annual_fee=?, monthly_fee=?, fee_interest_rate=?,
    payment_allocation=?, promo_end_date=?, accrued_fees=?
    WHERE id=? AND user_id=?`)
    .run(name, type || 'other', balance, interest_rate || 0, minimum_payment, due_day || 1,
      lender || '', color || '#ef4444', is_paid_off ? 1 : 0, paid_off_date,
      scope || 'personal', scope === 'business' && business_id ? business_id : null,
      interest_free_months || 0, annual_fee || 0, monthly_fee || 0,
      fee_interest_rate || 0, payment_allocation || 'purchase_first',
      promo_end_date || null, accrued_fees || 0,
      id, user.userId)
  const debt = db.prepare('SELECT * FROM debts WHERE id = ?').get(id)
  return NextResponse.json({ debt })
}

export async function DELETE(req: NextRequest) {
  const user = getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await req.json()
  const db = getDb()
  db.prepare('DELETE FROM debts WHERE id = ? AND user_id = ?').run(id, user.userId)
  return NextResponse.json({ ok: true })
}
