import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

function getUser(req: NextRequest) {
  const token = req.cookies.get('ace_token')?.value
  if (!token) return null
  return verifyToken(token)
}

function getNextOccurrence(startDate: string, interval: string): Date {
  const start = new Date(startDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let next = new Date(start)

  // Advance until next >= today
  let safety = 0
  while (next < today && safety < 500) {
    switch (interval) {
      case 'weekly':      next.setDate(next.getDate() + 7); break
      case 'fortnightly': next.setDate(next.getDate() + 14); break
      case 'monthly':     next.setMonth(next.getMonth() + 1); break
      case 'quarterly':   next.setMonth(next.getMonth() + 3); break
      case 'annually':    next.setFullYear(next.getFullYear() + 1); break
      default:            next.setMonth(next.getMonth() + 1)
    }
    safety++
  }
  return next
}

export async function GET(req: NextRequest) {
  const user = getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getDb()
  const recurring = db.prepare(`
    SELECT t.*, c.name as category_name, c.color,
      b.name as business_name, a.name as account_name
    FROM transactions t
    LEFT JOIN categories c ON c.id = t.category_id
    LEFT JOIN businesses b ON b.id = t.business_id
    LEFT JOIN accounts a ON a.id = t.account_id
    WHERE t.user_id = ? AND t.recurring = 1
    ORDER BY t.date DESC
  `).all(user.userId) as Record<string, unknown>[]

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const in60days = new Date(today)
  in60days.setDate(in60days.getDate() + 60)

  const upcoming = recurring
    .map(t => {
      const startDate = (t.recur_start_date as string) || (t.date as string)
      const interval = (t.recur_interval as string) || 'monthly'
      const nextDate = getNextOccurrence(startDate, interval)
      const daysUntil = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      return { ...t, next_due_date: nextDate.toISOString().split('T')[0], days_until: daysUntil }
    })
    .filter(t => t.days_until <= 60)
    .sort((a, b) => a.days_until - b.days_until)

  return NextResponse.json({ upcoming })
}
