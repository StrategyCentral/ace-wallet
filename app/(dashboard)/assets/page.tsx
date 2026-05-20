'use client'
import { useEffect, useState, useMemo, useCallback } from 'react'

interface Asset {
  id: number; name: string; type: string; scope: string; business_id: number | null
  business_name: string; purchase_price: number; current_value: number; quantity: number
  ticker_symbol: string; currency: string; date_acquired: string
  alert_above: number | null; alert_below: number | null; notes: string; color: string
}
interface Business { id: number; name: string }

const ASSET_TYPES = [
  { value: 'crypto', label: '₿ Crypto', icon: '₿' },
  { value: 'shares', label: '📈 Shares/Stocks', icon: '📈' },
  { value: 'real_estate', label: '🏠 Real Estate', icon: '🏠' },
  { value: 'vehicle', label: '🚗 Vehicle', icon: '🚗' },
  { value: 'artwork', label: '🎨 Artwork', icon: '🎨' },
  { value: 'overpaid_rent', label: '🏢 Overpaid Rent', icon: '🏢' },
  { value: 'collectible', label: '💎 Collectible', icon: '💎' },
  { value: 'cash_reserve', label: '💵 Cash Reserve', icon: '💵' },
  { value: 'other', label: '📋 Other', icon: '📋' },
]
const COLORS = ['#10b981','#00d4ff','#8b5cf6','#f59e0b','#ef4444','#ec4899','#06b6d4','#84cc16']

const defaultForm = {
  name: '', type: 'other', scope: 'personal', business_id: '', purchase_price: '', current_value: '',
  quantity: '1', ticker_symbol: '', currency: 'AUD', date_acquired: '', alert_above: '', alert_below: '',
  notes: '', color: '#10b981',
}

// Live price cache
const priceCache: Record<string, { price: number; ts: number }> = {}

async function fetchLivePrice(ticker: string, type: string): Promise<number | null> {
  if (!ticker) return null
  const key = `${type}:${ticker}`
  const cached = priceCache[key]
  if (cached && Date.now() - cached.ts < 60000) return cached.price // 1 min cache

  try {
    if (type === 'crypto') {
      const id = ticker.toLowerCase()
      const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=aud`)
      if (!res.ok) return null
      const data = await res.json()
      const price = data[id]?.aud
      if (price) { priceCache[key] = { price, ts: Date.now() }; return price }
    }
    if (type === 'shares') {
      // Use Yahoo Finance v8 quote endpoint
      const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`)
      if (!res.ok) return null
      const data = await res.json()
      const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice
      if (price) { priceCache[key] = { price, ts: Date.now() }; return price }
    }
  } catch { /* silent */ }
  return null
}

function smartSellAdvice(asset: Asset, livePrice: number | null): { advice: string; color: string; urgency: string } | null {
  const val = livePrice != null ? livePrice * asset.quantity : asset.current_value
  const cost = asset.purchase_price * asset.quantity
  if (cost <= 0) return null

  const gainPct = ((val - cost) / cost) * 100
  const holdDays = asset.date_acquired ? Math.floor((Date.now() - new Date(asset.date_acquired).getTime()) / 86400000) : null

  // Alert triggers
  if (asset.alert_above && livePrice && livePrice >= asset.alert_above) {
    return { advice: `Price hit your alert target of $${asset.alert_above.toLocaleString()}. Consider taking profits.`, color: 'text-green-400', urgency: 'high' }
  }
  if (asset.alert_below && livePrice && livePrice <= asset.alert_below) {
    return { advice: `Price dropped below your alert at $${asset.alert_below.toLocaleString()}. Review position — cut losses or hold?`, color: 'text-red-400', urgency: 'high' }
  }

  // General advice
  if (gainPct > 100) {
    return { advice: `Up ${gainPct.toFixed(0)}% — consider selling half to lock in profits and let the rest ride.`, color: 'text-green-400', urgency: 'medium' }
  }
  if (gainPct > 50 && holdDays && holdDays > 365) {
    return { advice: `Solid ${gainPct.toFixed(0)}% gain over ${Math.floor(holdDays / 365)}y. CGT discount applies (AU) — good time to review.`, color: 'text-green-400', urgency: 'low' }
  }
  if (gainPct < -30) {
    return { advice: `Down ${Math.abs(gainPct).toFixed(0)}%. Consider tax-loss harvesting or averaging down if thesis holds.`, color: 'text-red-400', urgency: 'medium' }
  }
  if (asset.type === 'vehicle' && holdDays && holdDays > 1095) {
    return { advice: `Owned 3+ years — depreciation accelerating. Consider selling before next big service interval.`, color: 'text-yellow-400', urgency: 'low' }
  }
  return null
}

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Asset | null>(null)
  const [form, setForm] = useState(defaultForm)
  const [loading, setLoading] = useState(false)
  const [livePrices, setLivePrices] = useState<Record<number, number>>({})
  const [priceLoading, setPriceLoading] = useState(false)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [ar, br] = await Promise.all([fetch('/api/assets'), fetch('/api/businesses')])
    const [ad, bd] = await Promise.all([ar.json(), br.json()])
    setAssets(ad.assets || [])
    setBusinesses(bd.businesses || [])
  }

  // Fetch live prices for crypto/shares
  const refreshPrices = useCallback(async () => {
    const tickered = assets.filter(a => a.ticker_symbol && (a.type === 'crypto' || a.type === 'shares'))
    if (tickered.length === 0) return
    setPriceLoading(true)
    const prices: Record<number, number> = {}
    await Promise.all(tickered.map(async a => {
      const p = await fetchLivePrice(a.ticker_symbol, a.type)
      if (p != null) prices[a.id] = p
    }))
    setLivePrices(prev => ({ ...prev, ...prices }))
    setPriceLoading(false)
  }, [assets])

  useEffect(() => { refreshPrices() }, [refreshPrices])

  function openAdd() { setEditing(null); setForm(defaultForm); setShowModal(true) }
  function openEdit(a: Asset) {
    setEditing(a)
    setForm({
      name: a.name, type: a.type, scope: a.scope, business_id: a.business_id ? String(a.business_id) : '',
      purchase_price: String(a.purchase_price), current_value: String(a.current_value),
      quantity: String(a.quantity), ticker_symbol: a.ticker_symbol || '',
      currency: a.currency, date_acquired: a.date_acquired || '',
      alert_above: a.alert_above != null ? String(a.alert_above) : '',
      alert_below: a.alert_below != null ? String(a.alert_below) : '',
      notes: a.notes || '', color: a.color,
    })
    setShowModal(true)
  }

  async function handleSave() {
    setLoading(true)
    const body = {
      ...form,
      purchase_price: parseFloat(form.purchase_price) || 0,
      current_value: parseFloat(form.current_value) || 0,
      quantity: parseFloat(form.quantity) || 1,
      alert_above: form.alert_above ? parseFloat(form.alert_above) : null,
      alert_below: form.alert_below ? parseFloat(form.alert_below) : null,
      business_id: form.scope === 'business' && form.business_id ? parseInt(form.business_id) : null,
      ...(editing ? { id: editing.id } : {}),
    }
    await fetch('/api/assets', {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setShowModal(false); await fetchAll(); setLoading(false)
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this asset?')) return
    await fetch('/api/assets', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    fetchAll()
  }

  const totalValue = assets.reduce((s, a) => {
    const lp = livePrices[a.id]
    return s + (lp != null ? lp * a.quantity : a.current_value)
  }, 0)
  const totalCost = assets.reduce((s, a) => s + (a.purchase_price * a.quantity), 0)
  const totalGain = totalValue - totalCost
  const gainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0

  const personalAssets = assets.filter(a => a.scope === 'personal')
  const businessAssets = assets.filter(a => a.scope === 'business')

  const typeIcon = (type: string) => ASSET_TYPES.find(t => t.value === type)?.icon || '📋'
  const typeLabel = (type: string) => ASSET_TYPES.find(t => t.value === type)?.label || type

  const fmt = (n: number) => `AUD ${Math.abs(n).toLocaleString('en-AU', { maximumFractionDigits: 0 })}`

  // Check for triggered alerts
  const triggeredAlerts = assets.filter(a => {
    const lp = livePrices[a.id]
    if (!lp) return false
    return (a.alert_above && lp >= a.alert_above) || (a.alert_below && lp <= a.alert_below)
  })

  const needsTicker = form.type === 'crypto' || form.type === 'shares'

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Assets</h1>
          <p className="text-ace-muted text-sm mt-1">Track what you own — crypto, shares, property, vehicles, and more</p>
        </div>
        <div className="flex gap-2">
          {assets.some(a => a.ticker_symbol) && (
            <button onClick={refreshPrices} disabled={priceLoading}
              className="px-3 py-2 bg-ace-bg border border-ace-border rounded-lg text-ace-muted text-sm hover:text-white transition-colors disabled:opacity-50">
              {priceLoading ? '⟳ Loading…' : '⟳ Refresh Prices'}
            </button>
          )}
          <button onClick={openAdd} className="px-4 py-2 bg-green-500 text-white rounded-lg font-semibold text-sm hover:bg-green-600 transition-colors">+ Add Asset</button>
        </div>
      </div>

      {/* Description banner */}
      <div className="bg-ace-purple/5 border border-ace-purple/20 rounded-xl p-4 mb-6">
        <p className="text-ace-muted text-sm">
          Add assets you are accumulating — overpaid rent with extra money sitting there, crypto, real estate, cars, artwork, or whatever you like.
          For shares and crypto, add a ticker symbol to get <span className="text-ace-cyan font-medium">live price feeds</span>.
          Set <span className="text-ace-orange font-medium">Alert When</span> thresholds to get notified when an asset needs attention.
        </p>
      </div>

      {/* Alert banner */}
      {triggeredAlerts.length > 0 && (
        <div className="mb-6 space-y-2">
          {triggeredAlerts.map(a => {
            const lp = livePrices[a.id]!
            const isAbove = a.alert_above && lp >= a.alert_above
            return (
              <div key={a.id} className={`flex items-center justify-between px-4 py-3 rounded-xl border ${isAbove ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                <div className="flex items-center gap-3">
                  <span className="text-xl">{isAbove ? '🚀' : '⚠️'}</span>
                  <div>
                    <p className="text-white text-sm font-medium">{a.name} — Alert Triggered!</p>
                    <p className="text-ace-muted text-xs">
                      {isAbove ? `Price ($${lp.toLocaleString()}) hit your target above $${a.alert_above!.toLocaleString()}` :
                        `Price ($${lp.toLocaleString()}) dropped below your threshold of $${a.alert_below!.toLocaleString()}`}
                    </p>
                  </div>
                </div>
                <span className={`text-sm font-bold ${isAbove ? 'text-green-400' : 'text-red-400'}`}>
                  AUD {lp.toLocaleString('en-AU', { maximumFractionDigits: 2 })}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* KPIs */}
      {assets.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Value', value: fmt(totalValue), color: 'text-green-400' },
            { label: 'Total Cost', value: fmt(totalCost), color: 'text-white' },
            { label: 'Total Gain/Loss', value: (totalGain < 0 ? '-' : '+') + fmt(totalGain), color: totalGain >= 0 ? 'text-green-400' : 'text-red-400' },
            { label: 'Return', value: `${gainPct >= 0 ? '+' : ''}${gainPct.toFixed(1)}%`, color: gainPct >= 0 ? 'text-green-400' : 'text-red-400' },
          ].map(k => (
            <div key={k.label} className="bg-ace-card border border-ace-border rounded-xl p-4">
              <p className="text-ace-muted text-xs mb-1">{k.label}</p>
              <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Asset cards */}
      {assets.length === 0 ? (
        <div className="bg-ace-card border border-ace-border rounded-xl p-12 text-center text-ace-muted">
          <div className="text-5xl mb-4">💰</div>
          <p className="font-medium text-white text-lg">No assets yet</p>
          <p className="text-sm mt-1">Add your first asset to start tracking your wealth</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Personal assets */}
          {personalAssets.length > 0 && (
            <div>
              <h2 className="text-ace-muted text-xs font-semibold uppercase tracking-wider mb-3">Personal Assets</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {personalAssets.map(a => <AssetCard key={a.id} asset={a} livePrice={livePrices[a.id]} onEdit={openEdit} onDelete={handleDelete} typeIcon={typeIcon} fmt={fmt} />)}
              </div>
            </div>
          )}
          {/* Business assets */}
          {businessAssets.length > 0 && (
            <div>
              <h2 className="text-ace-muted text-xs font-semibold uppercase tracking-wider mb-3">Business Assets</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {businessAssets.map(a => <AssetCard key={a.id} asset={a} livePrice={livePrices[a.id]} onEdit={openEdit} onDelete={handleDelete} typeIcon={typeIcon} fmt={fmt} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ Add/Edit Modal ═══ */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-ace-card border border-ace-border rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-white font-bold text-lg mb-5">{editing ? 'Edit Asset' : 'Add Asset'}</h2>
            <div className="space-y-4">
              <div>
                <label className="text-ace-muted text-sm block mb-1">Asset Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Bitcoin, My House, Tesla shares"
                  className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-ace-muted text-sm block mb-1">Type</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                    className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan">
                    {ASSET_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-ace-muted text-sm block mb-1">Scope</label>
                  <div className="flex gap-1 bg-ace-bg border border-ace-border rounded-lg p-1">
                    {['personal','business'].map(s => (
                      <button key={s} onClick={() => setForm(f => ({ ...f, scope: s }))}
                        className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-all ${form.scope === s ? 'bg-ace-cyan/20 text-ace-cyan' : 'text-ace-muted'}`}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {form.scope === 'business' && businesses.length > 0 && (
                <div>
                  <label className="text-ace-muted text-sm block mb-1">Business</label>
                  <select value={form.business_id} onChange={e => setForm(f => ({ ...f, business_id: e.target.value }))}
                    className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan">
                    <option value="">Select business…</option>
                    {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              )}

              {needsTicker && (
                <div>
                  <label className="text-ace-muted text-sm block mb-1">
                    {form.type === 'crypto' ? 'CoinGecko ID (e.g. bitcoin, ethereum, solana)' : 'Ticker Symbol (e.g. AAPL, TSLA, BHP.AX)'}
                  </label>
                  <input value={form.ticker_symbol} onChange={e => setForm(f => ({ ...f, ticker_symbol: e.target.value }))}
                    placeholder={form.type === 'crypto' ? 'bitcoin' : 'TSLA'}
                    className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan" />
                  <p className="text-ace-muted text-xs mt-1">Used for live price feed — leave empty to use manual value</p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-ace-muted text-sm block mb-1">Purchase Price</label>
                  <input type="number" value={form.purchase_price} onChange={e => setForm(f => ({ ...f, purchase_price: e.target.value }))} placeholder="0"
                    className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan" />
                </div>
                <div>
                  <label className="text-ace-muted text-sm block mb-1">Current Value</label>
                  <input type="number" value={form.current_value} onChange={e => setForm(f => ({ ...f, current_value: e.target.value }))} placeholder="0"
                    className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan" />
                </div>
                <div>
                  <label className="text-ace-muted text-sm block mb-1">Quantity</label>
                  <input type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} placeholder="1" step="any"
                    className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan" />
                </div>
              </div>

              <div>
                <label className="text-ace-muted text-sm block mb-1">Date Acquired</label>
                <input type="date" value={form.date_acquired} onChange={e => setForm(f => ({ ...f, date_acquired: e.target.value }))}
                  className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan" />
              </div>

              {/* Alert When */}
              <div className="bg-ace-orange/5 border border-ace-orange/20 rounded-xl p-4">
                <h3 className="text-white font-medium text-sm mb-3">🔔 Alert When</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-ace-muted text-xs block mb-1">Price goes above</label>
                    <input type="number" value={form.alert_above} onChange={e => setForm(f => ({ ...f, alert_above: e.target.value }))} placeholder="No alert"
                      className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-orange" />
                  </div>
                  <div>
                    <label className="text-ace-muted text-xs block mb-1">Price drops below</label>
                    <input type="number" value={form.alert_below} onChange={e => setForm(f => ({ ...f, alert_below: e.target.value }))} placeholder="No alert"
                      className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-orange" />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-ace-muted text-sm block mb-1">Notes</label>
                <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes"
                  className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan" />
              </div>

              <div>
                <label className="text-ace-muted text-sm block mb-2">Colour</label>
                <div className="flex gap-2">
                  {COLORS.map(c => (
                    <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${form.color === c ? 'border-white scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2 text-sm border border-ace-border rounded-lg text-ace-muted hover:text-white transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={loading || !form.name}
                className="flex-1 py-2 text-sm bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition-colors disabled:opacity-50">
                {loading ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Asset Card component ──
function AssetCard({ asset, livePrice, onEdit, onDelete, typeIcon, fmt }: {
  asset: Asset; livePrice?: number; onEdit: (a: Asset) => void; onDelete: (id: number) => void
  typeIcon: (t: string) => string; fmt: (n: number) => string
}) {
  const val = livePrice != null ? livePrice * asset.quantity : asset.current_value
  const cost = asset.purchase_price * asset.quantity
  const gain = val - cost
  const gainPct = cost > 0 ? (gain / cost) * 100 : 0

  const advice = smartSellAdvice(asset, livePrice ?? null)

  return (
    <div className="bg-ace-card border border-ace-border rounded-xl p-4 hover:border-ace-border/50 transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
            style={{ backgroundColor: asset.color + '20' }}>
            {typeIcon(asset.type)}
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm">{asset.name}</h3>
            <p className="text-ace-muted text-xs">
              {ASSET_TYPES.find(t => t.value === asset.type)?.label?.replace(/^[^\s]+\s/, '') || asset.type}
              {asset.ticker_symbol && <span className="text-ace-cyan ml-1">· {asset.ticker_symbol.toUpperCase()}</span>}
              {asset.business_name && <span className="text-ace-purple ml-1">· {asset.business_name}</span>}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-white font-bold text-sm">{fmt(val)}</p>
          {livePrice != null && (
            <p className="text-ace-cyan text-xs">Live: ${livePrice.toLocaleString('en-AU', { maximumFractionDigits: 2 })}</p>
          )}
        </div>
      </div>

      {/* Gain/Loss bar */}
      <div className="flex items-center justify-between text-xs mb-2">
        <span className="text-ace-muted">Cost: {fmt(cost)}</span>
        <span className={`font-semibold ${gain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {gain >= 0 ? '+' : '-'}{fmt(gain)} ({gainPct >= 0 ? '+' : ''}{gainPct.toFixed(1)}%)
        </span>
      </div>

      {/* Alert indicators */}
      {(asset.alert_above || asset.alert_below) && (
        <div className="flex gap-2 mb-2">
          {asset.alert_above && (
            <span className="text-xs px-2 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">
              ↑ Alert above ${asset.alert_above.toLocaleString()}
            </span>
          )}
          {asset.alert_below && (
            <span className="text-xs px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
              ↓ Alert below ${asset.alert_below.toLocaleString()}
            </span>
          )}
        </div>
      )}

      {/* Smart sell advice */}
      {advice && (
        <div className="bg-ace-bg/50 border border-ace-border rounded-lg p-2 mb-2">
          <p className={`text-xs ${advice.color}`}>
            💡 {advice.advice}
          </p>
        </div>
      )}

      {/* Quantity + Date */}
      <div className="flex items-center justify-between text-xs text-ace-muted mb-3">
        {asset.quantity !== 1 && <span>Qty: {asset.quantity.toLocaleString()}</span>}
        {asset.date_acquired && <span>Acquired: {asset.date_acquired}</span>}
      </div>

      <div className="flex gap-2">
        <button onClick={() => onEdit(asset)} className="text-xs px-2 py-1 border border-ace-border rounded text-ace-muted hover:text-white transition-colors">Edit</button>
        <button onClick={() => onDelete(asset.id)} className="text-xs px-2 py-1 border border-red-500/20 rounded text-red-400 hover:bg-red-500/10 transition-colors">Delete</button>
      </div>
    </div>
  )
}
