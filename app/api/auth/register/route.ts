import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getDb } from '@/lib/db'
import { signToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { email, name, password } = await req.json()
    if (!email || !name || !password) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const db = getDb()
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
    if (existing) return NextResponse.json({ error: 'Email already registered' }, { status: 409 })

    const hash = await bcrypt.hash(password, 10)
    const result = db.prepare("INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, 'user')").run(email, name, hash)
    const userId = result.lastInsertRowid as number

    // Seed default categories for new user
    const cats = [
      { name: 'Salary', type: 'income', color: '#10b981', icon: 'briefcase' },
      { name: 'Freelance', type: 'income', color: '#00d4ff', icon: 'laptop' },
      { name: 'Groceries', type: 'expense', color: '#f59e0b', icon: 'shopping-cart' },
      { name: 'Rent / Mortgage', type: 'expense', color: '#ef4444', icon: 'home' },
      { name: 'Utilities', type: 'expense', color: '#f97316', icon: 'zap' },
      { name: 'Transport', type: 'expense', color: '#06b6d4', icon: 'car' },
      { name: 'Dining Out', type: 'expense', color: '#ec4899', icon: 'utensils' },
      { name: 'Entertainment', type: 'expense', color: '#a855f7', icon: 'tv' },
      { name: 'Subscriptions', type: 'expense', color: '#8b5cf6', icon: 'repeat' },
      { name: 'Other', type: 'expense', color: '#475569', icon: 'tag' },
    ]
    const insertCat = db.prepare('INSERT INTO categories (user_id, name, type, color, icon) VALUES (?, ?, ?, ?, ?)')
    cats.forEach(c => insertCat.run(userId, c.name, c.type, c.color, c.icon))

    const token = signToken({ userId, email, role: 'user' })
    const res = NextResponse.json({ success: true })
    res.cookies.set('ace_token', token, { httpOnly: true, secure: false, sameSite: 'lax', maxAge: 60 * 60 * 24 * 7, path: '/' })
    return res
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
