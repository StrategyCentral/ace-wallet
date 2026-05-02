import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'

const JWT_SECRET = process.env.JWT_SECRET || 'ace-wallet-secret-change-me'

export interface TokenPayload {
  userId: number
  email: string
  role: string
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload
  } catch {
    return null
  }
}

export function getAuthUser(): TokenPayload | null {
  try {
    const cookieStore = cookies()
    const token = cookieStore.get('ace_token')?.value
    if (!token) return null
    return verifyToken(token)
  } catch {
    return null
  }
}
