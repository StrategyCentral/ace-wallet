import { NextResponse } from 'next/server'
import { authCookieOptions } from '@/lib/auth'

export async function POST() {
  const res = NextResponse.json({ success: true })
  res.cookies.set('ace_token', '', authCookieOptions(0))
  return res
}
