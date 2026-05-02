import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { getTaxConfig } from '@/lib/tax'

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
  const date_from = searchParams.get('date_from') || `${new Date().getFullYear()}-01-01`
  const date_to = searchParams.get('date_to') || `${new Date().getFullYear()}-12-31`

  const db = getDb()

  if (!business_id) return NextResponse.json({ error: 'business_id required' }, { status: 400 })

  const member = db.prepare('SELECT role FROM business_members WHERE business_id = ? AND user_id = ?').get(business_id, user.userId)
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const biz = db.prepare('SELECT * FROM businesses WHERE id = ?').get(business_id) as Record<string, string>
  const taxConfig = getTaxConfig(biz.tax_framework as Parameters<typeof getTaxConfig>[0])

  // GST collected on income (sales)
  const incomeRows = db.prepare(`
    SELECT SUM(amount) as total, SUM(tax_amount) as tax_total
    FROM transactions
    WHERE user_id = ? AND business_id = ? AND type = 'income' AND scope = 'business'
    AND date BETWEEN ? AND ?
  `).get(user.userId, business_id, date_from, date_to) as { total: number; tax_total: number }

  // GST paid on expenses (purchases)
  const expenseRows = db.prepare(`
    SELECT SUM(amount) as total, SUM(tax_amount) as tax_total, SUM(CASE WHEN is_tax_deductible=1 THEN amount ELSE 0 END) as deductible_total
    FROM transactions
    WHERE user_id = ? AND business_id = ? AND type = 'expense' AND scope = 'business'
    AND date BETWEEN ? AND ?
  `).get(user.userId, business_id, date_from, date_to) as { total: number; tax_total: number; deductible_total: number }

  // Deductible expenses by category
  const deductibleRows = db.prepare(`
    SELECT c.name as category, SUM(t.amount) as total
    FROM transactions t
    LEFT JOIN categories c ON c.id = t.category_id
    WHERE t.user_id = ? AND t.business_id = ? AND t.type = 'expense' AND t.is_tax_deductible = 1
    AND t.date BETWEEN ? AND ?
    GROUP BY t.category_id ORDER BY total DESC
  `).all(user.userId, business_id, date_from, date_to) as { category: string; total: number }[]

  const taxCollected = incomeRows?.tax_total || 0
  const taxPaid = expenseRows?.tax_total || 0
  const netTax = taxCollected - taxPaid

  return NextResponse.json({
    business: { id: biz.id, name: biz.name, tax_framework: biz.tax_framework },
    taxConfig: { label: taxConfig.label, rate: taxConfig.rate, reportLabel: taxConfig.reportLabel,
      collectLabel: taxConfig.collectLabel, paidLabel: taxConfig.paidLabel, netLabel: taxConfig.netLabel },
    period: { date_from, date_to },
    summary: {
      totalIncome: incomeRows?.total || 0,
      taxCollected,
      totalExpenses: expenseRows?.total || 0,
      taxPaid,
      netTax,
      deductibleExpenses: expenseRows?.deductible_total || 0,
    },
    deductibleByCategory: deductibleRows,
  })
}
