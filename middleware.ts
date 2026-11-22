import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC = ['/login', '/register', '/api/auth/login', '/api/auth/register']

function b64urlToBytes(s: string): ArrayBuffer {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)
  const bin = atob(b64)
  const buf = new ArrayBuffer(bin.length)
  const out = new Uint8Array(buf)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return buf
}

// Edge-compatible HS256 verify (Web Crypto). Fails closed without JWT_SECRET.
async function verifyToken(token: string): Promise<boolean> {
  const secret = process.env.JWT_SECRET
  if (!secret) return false
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return false
    const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[0])))
    if (header.alg !== 'HS256') return false
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
    const ok = await crypto.subtle.verify(
      'HMAC', key, b64urlToBytes(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`))
    if (!ok) return false
    const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1])))
    if (payload.exp && payload.exp < Date.now() / 1000) return false
    return true
  } catch {
    return false
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (PUBLIC.some(p => pathname.startsWith(p))) return NextResponse.next()
  if (pathname === '/') return NextResponse.redirect(new URL('/dashboard', request.url))

  const token = request.cookies.get('ace_token')?.value
  if (!token || !(await verifyToken(token))) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)'],
}
