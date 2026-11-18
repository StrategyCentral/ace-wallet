import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getDb } from '@/lib/db'
import { signToken, authCookieOptions } from '@/lib/auth'
import { rateLimit, clientIp } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(`login:${clientIp(req.headers)}`, 10, 15 * 60 * 1000)) {
      return NextResponse.json({ error: 'Too many attempts. Try again in 15 minutes.' }, { status: 429 })
    }
    const { email, password } = await req.json()
    if (!email || !password) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const db = getDb()
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any
    if (!user) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })

    const token = signToken({ userId: user.id, email: user.email, role: user.role })
    const res = NextResponse.json({ success: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } })
    res.cookies.set('ace_token', token, authCookieOptions())
    return res
  } catch (e: any) {
    console.error('[login]', e)
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
