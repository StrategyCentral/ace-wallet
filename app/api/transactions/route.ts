import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { getTaxConfig, type TaxFramework } from '@/lib/tax'

function getUser(req: NextRequest) {
  const token = req.cookies.get('ace_token')?.value
  if (!token) return null
  return verifyToken(token)
}

export async function GET(req: NextRequest) {
  const user = getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month')
  const type = searchParams.get('type')
  const scope = searchParams.get('scope')
  const business_id = searchParams.get('business_id')
  const db = getDb()

  let query = `SELECT t.*, c.name as category_name, c.color, 
    b.name as business_name, a.name as account_name, s.name as stream_name
    FROM transactions t
    LEFT JOIN categories c ON c.id = t.category_id
    LEFT JOIN businesses b ON b.id = t.business_id
    LEFT JOIN accounts a ON a.id = t.account_id
    LEFT JOIN income_streams s ON s.id = t.income_stream_id
    WHERE t.user_id = ?`
  const params: (string | number)[] = [user.userId]

  if (month) { query += ` AND strftime('%Y-%m', t.date) = ?`; params.push(month) }
  if (type && type !== 'all') { query += ` AND t.type = ?`; params.push(type) }
  if (scope) { query += ` AND t.scope = ?`; params.push(scope) }
  if (business_id) { query += ` AND t.business_id = ?`; params.push(business_id) }

  query += ` ORDER BY t.date DESC, t.created_at DESC`
  const transactions = db.prepare(query).all(...params)
  return NextResponse.json({ transactions })
}

export async function POST(req: NextRequest) {
  const user = getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { type, amount, description, category_id, date, notes, scope, business_id, account_id,
    income_stream_id, is_tax_deductible, gst_inclusive, currency } = await req.json()

  if (!type || !amount || !description || !date) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const db = getDb()

  // Calculate tax amount if GST inclusive
  let taxAmount = 0
  if (gst_inclusive && scope === 'business' && business_id) {
    const biz = db.prepare('SELECT tax_framework FROM businesses WHERE id = ?').get(business_id) as { tax_framework: string } | undefined
    if (biz) {
      const config = getTaxConfig(biz.tax_framework as TaxFramework)
      if (config.rate > 0) {
        taxAmount = Math.round((amount - amount / (1 + config.rate)) * 100) / 100
      }
    }
  }

  const id = (db.prepare(`
    INSERT INTO transactions (user_id, type, amount, description, category_id, date, notes, scope, business_id, account_id, income_stream_id, is_tax_deductible, gst_inclusive, tax_amount, currency)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    user.userId, type, amount, description,
    category_id || null, date, notes || '',
    scope || 'personal', business_id || null, account_id || null,
    income_stream_id || null,
    is_tax_deductible ? 1 : 0, gst_inclusive ? 1 : 0, taxAmount,
    currency || 'AUD'
  )).lastInsertRowid

  const transaction = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id)
  return NextResponse.json({ transaction })
}

export async function DELETE(req: NextRequest) {
  const user = getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await req.json()
  const db = getDb()
  db.prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?').run(id, user.userId)
  return NextResponse.json({ ok: true })
}
