// Small in-memory fixed-window rate limiter (per process). Good enough for a
// single Railway replica; resets on deploy.
type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

export function clientIp(headers: Headers): string {
  const cf = headers.get('cf-connecting-ip')
  if (cf) return cf.trim()
  const xff = headers.get('x-forwarded-for')
  if (xff) {
    const hops = xff.split(',').map(s => s.trim()).filter(Boolean)
    if (hops.length) return hops[hops.length - 1] // right-most hop = added by our proxy
  }
  return headers.get('x-real-ip')?.trim() || 'unknown'
}

/** Returns true when the call is allowed, false when over the limit. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  if (buckets.size > 10000) {
    buckets.forEach((b, k) => { if (b.resetAt <= now) buckets.delete(k) })
  }
  const b = buckets.get(key)
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  b.count++
  return b.count <= limit
}
