import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'

// Fail closed: no JWT_SECRET means no token is ever signed or accepted.
function getSecret(): string | null {
  const s = process.env.JWT_SECRET
  if (!s) {
    console.error('[auth] JWT_SECRET is not set; refusing to sign or verify tokens')
    return null
  }
  return s
}

export interface TokenPayload {
  userId: number
  email: string
  role: string
}

export const AUTH_COOKIE = 'ace_token'

export function authCookieOptions(maxAge = 60 * 60 * 24 * 7) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge,
    path: '/',
  }
}

export function signToken(payload: TokenPayload): string {
  const secret = getSecret()
  if (!secret) throw new Error('Server auth is not configured')
  return jwt.sign(payload, secret, { expiresIn: '7d', algorithm: 'HS256' })
}

export function verifyToken(token: string): TokenPayload | null {
  const secret = getSecret()
  if (!secret) return null
  try {
    return jwt.verify(token, secret, { algorithms: ['HS256'] }) as TokenPayload
  } catch {
    return null
  }
}

export function getAuthUser(): TokenPayload | null {
  try {
    const cookieStore = cookies()
    const token = cookieStore.get(AUTH_COOKIE)?.value
    if (!token) return null
    return verifyToken(token)
  } catch {
    return null
  }
}
