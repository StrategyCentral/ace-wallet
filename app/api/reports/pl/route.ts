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
  const period = searchParams.get('period') || 'monthly'
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))

  const db = getDb()

  // Check access
  if (business_id) {
    const member = db.prepare('SELECT role FROM business_members WHERE business_id = ? AND user_id = ?').get(business_id, user.userId)
    if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const dateFrom = `${year}-01-01`
  const dateTo = `${year}-12-31`

  let incomeQuery = `SELECT strftime('%m', date) as month, SUM(amount) as total, income_stream_id,
    (SELECT name FROM income_streams WHERE id = income_stream_id) as stream_name
    FROM transactions WHERE user_id = ? AND type = 'income' AND scope = 'business' AND date BETWEEN ? AND ?`
  let expenseQuery = `SELECT strftime('%m', date) as month, SUM(amount) as total, category_id,
    (SELECT name FROM categories WHERE id = category_id) as category_name,
    SUM(tax_amount) as tax_total
    FROM transactions WHERE user_id = ? AND type = 'expense' AND scope = 'business' AND date BETWEEN ? AND ?`

  const params: (string | number)[] = [user.userId, dateFrom, dateTo]

  if (business_id) {
    incomeQuery += ' AND business_id = ?'
    expenseQuery += ' AND business_id = ?'
    params.push(business_id)
  }

  incomeQuery += ' GROUP BY month, income_stream_id ORDER BY month'
  expenseQuery += ' GROUP BY month, category_id ORDER BY month'

  const incomeRows = db.prepare(incomeQuery).all(...params) as { month: string; total: number; income_stream_id: number; stream_name: string }[]
  const expenseRows = db.prepare(expenseQuery).all(...params) as { month: string; total: number; category_id: number; category_name: string; tax_total: number }[]

  // Build monthly summary
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'))
  const monthly = months.map(m => {
    const income = incomeRows.filter(r => r.month === m).reduce((s, r) => s + r.total, 0)
    const expenses = expenseRows.filter(r => r.month === m).reduce((s, r) => s + r.total, 0)
    return { month: m, income, expenses, profit: income - expenses }
  })

  // Income by stream
  const streamMap: Record<string, number> = {}
  incomeRows.forEach(r => {
    const key = r.stream_name || 'Untagged'
    streamMap[key] = (streamMap[key] || 0) + r.total
  })

  // Expenses by category
  const catMap: Record<string, number> = {}
  expenseRows.forEach(r => {
    const key = r.category_name || 'Uncategorised'
    catMap[key] = (catMap[key] || 0) + r.total
  })

  const totalIncome = monthly.reduce((s, m) => s + m.income, 0)
  const totalExpenses = monthly.reduce((s, m) => s + m.expenses, 0)
  const grossProfit = totalIncome - totalExpenses
  const totalTax = expenseRows.reduce((s, r) => s + (r.tax_total || 0), 0)

  return NextResponse.json({
    year, period, business_id,
    summary: { totalIncome, totalExpenses, grossProfit, totalTax, margin: totalIncome > 0 ? (grossProfit / totalIncome) * 100 : 0 },
    monthly,
    incomeByStream: Object.entries(streamMap).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total),
    expensesByCategory: Object.entries(catMap).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total),
  })
}
