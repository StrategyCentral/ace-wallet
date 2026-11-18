import dns from 'dns'
import net from 'net'

// SSRF guard for server-side fetches of user-supplied URLs.
// - https only
// - every resolved address must be public (no private, loopback, link-local,
//   CGNAT, metadata, multicast or reserved ranges, IPv4 or IPv6)
// - redirects are followed by hand (max 3) and every hop is re-checked
// Known gap: the address is resolved again by fetch (DNS rebinding window).

export class UnsafeUrlError extends Error {}

function ipv4ToInt(ip: string): number {
  return ip.split('.').reduce((acc, o) => (acc << 8) + Number(o), 0) >>> 0
}

const V4_BLOCKS: [string, number][] = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
]

function isBlockedV4(ip: string): boolean {
  const n = ipv4ToInt(ip)
  return V4_BLOCKS.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0
    return (n & mask) === (ipv4ToInt(base) & mask)
  })
}

function expandV6(ip: string): number[] | null {
  let s = ip.split('%')[0].toLowerCase()
  // embedded IPv4 tail (e.g. ::ffff:1.2.3.4)
  const v4 = s.match(/(\d+\.\d+\.\d+\.\d+)$/)
  if (v4) {
    const n = ipv4ToInt(v4[1])
    s = s.slice(0, -v4[1].length) + ((n >>> 16) & 0xffff).toString(16) + ':' + (n & 0xffff).toString(16)
  }
  const [head, tail] = s.split('::')
  const h = head ? head.split(':') : []
  const t = tail !== undefined ? (tail ? tail.split(':') : []) : []
  const missing = 8 - h.length - t.length
  if (tail === undefined && h.length !== 8) return null
  if (missing < 0) return null
  const parts = [...h, ...Array(tail !== undefined ? missing : 0).fill('0'), ...t]
  if (parts.length !== 8) return null
  return parts.map(p => parseInt(p || '0', 16))
}

export function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) return isBlockedV4(ip)
  if (!net.isIPv6(ip)) return true
  const w = expandV6(ip)
  if (!w) return true
  const embeddedV4 = (hi: number, lo: number) => `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`
  if (w.every(x => x === 0)) return true                                    // ::
  if (w.slice(0, 7).every(x => x === 0) && w[7] === 1) return true          // ::1
  if (w.slice(0, 5).every(x => x === 0) && (w[5] === 0xffff || w[5] === 0)) // v4-mapped / v4-compatible
    return isBlockedV4(embeddedV4(w[6], w[7]))
  if (w[0] === 0x64 && w[1] === 0xff9b) return isBlockedV4(embeddedV4(w[6], w[7])) // NAT64
  if (w[0] === 0x2002) return isBlockedV4(embeddedV4(w[1], w[2]))           // 6to4
  if ((w[0] & 0xfe00) === 0xfc00) return true                               // fc00::/7 ULA
  if ((w[0] & 0xffc0) === 0xfe80) return true                               // fe80::/10 link-local
  if ((w[0] & 0xffc0) === 0xfec0) return true                               // fec0::/10 site-local
  if ((w[0] & 0xff00) === 0xff00) return true                               // multicast
  if (w[0] === 0x2001 && w[1] === 0x0db8) return true                       // documentation
  return false
}

export async function assertPublicHttpsUrl(raw: string, opts: { hostSuffix?: string } = {}): Promise<URL> {
  let url: URL
  try { url = new URL(raw) } catch { throw new UnsafeUrlError('Invalid URL') }
  if (url.protocol !== 'https:') throw new UnsafeUrlError('Only https:// URLs are allowed')
  if (url.username || url.password) throw new UnsafeUrlError('Credentials in URL are not allowed')
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (!host) throw new UnsafeUrlError('Invalid host')
  if (opts.hostSuffix && !(host.endsWith(opts.hostSuffix) && host.length > opts.hostSuffix.length)) {
    throw new UnsafeUrlError(`Host must end with ${opts.hostSuffix}`)
  }
  let addrs: { address: string }[]
  if (net.isIP(host)) addrs = [{ address: host }]
  else {
    try { addrs = await dns.promises.lookup(host, { all: true, verbatim: true }) }
    catch { throw new UnsafeUrlError('Host could not be resolved') }
  }
  if (!addrs.length || addrs.some(a => isPrivateAddress(a.address))) {
    throw new UnsafeUrlError('Host resolves to a private or reserved address')
  }
  return url
}

export async function safeFetch(raw: string, init: RequestInit = {}, opts: { hostSuffix?: string; maxRedirects?: number } = {}): Promise<Response> {
  let current = raw
  const max = opts.maxRedirects ?? 3
  for (let i = 0; i <= max; i++) {
    const url = await assertPublicHttpsUrl(current, opts)
    const res = await fetch(url.toString(), { ...init, redirect: 'manual' })
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      current = new URL(res.headers.get('location') as string, url).toString()
      continue
    }
    return res
  }
  throw new UnsafeUrlError('Too many redirects')
}
