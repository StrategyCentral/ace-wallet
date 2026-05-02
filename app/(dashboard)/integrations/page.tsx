'use client'
import { useEffect, useState } from 'react'

interface Integration {
  id: number; platform: string; business_name: string; business_id: number
  credentials_set: boolean; is_active: number; last_sync: string
  credentials: Record<string, string>
}
interface Business { id: number; name: string }

const PLATFORMS = [
  { id: 'stripe', name: 'Stripe', icon: '💳', color: '#635bff', desc: 'Pull payments and payouts from Stripe',
    fields: [{ key: 'secret_key', label: 'Secret Key', placeholder: 'sk_live_...' }] },
  { id: 'paypal', name: 'PayPal', icon: '🅿', color: '#003087', desc: 'Sync PayPal transactions',
    fields: [{ key: 'client_id', label: 'Client ID', placeholder: 'AX...' }, { key: 'client_secret', label: 'Client Secret', placeholder: 'EH...' }] },
  { id: 'woocommerce', name: 'WooCommerce', icon: '🛒', color: '#96588a', desc: 'Pull orders from your WooCommerce store',
    fields: [{ key: 'store_url', label: 'Store URL', placeholder: 'https://yourstore.com' }, { key: 'consumer_key', label: 'Consumer Key', placeholder: 'ck_...' }, { key: 'consumer_secret', label: 'Consumer Secret', placeholder: 'cs_...' }] },
  { id: 'shopify', name: 'Shopify', icon: '🛍️', color: '#96bf48', desc: 'Import paid orders from Shopify',
    fields: [{ key: 'shop_domain', label: 'Shop Domain', placeholder: 'yourstore.myshopify.com' }, { key: 'access_token', label: 'Access Token', placeholder: 'shpat_...' }] },
]

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [showModal, setShowModal] = useState(false)
  const [selectedPlatform, setSelectedPlatform] = useState(PLATFORMS[0])
  const [formBiz, setFormBiz] = useState('')
  const [creds, setCreds] = useState<Record<string, string>>({})
  const [syncFrom, setSyncFrom] = useState('')
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState<number | null>(null)
  const [syncResult, setSyncResult] = useState<Record<number, string>>({})

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [ir, br] = await Promise.all([fetch('/api/integrations'), fetch('/api/businesses')])
    const id = await ir.json(); const bd = await br.json()
    setIntegrations(id.integrations || []); setBusinesses(bd.businesses || [])
  }

  function openAdd(platform: typeof PLATFORMS[0]) {
    setSelectedPlatform(platform)
    setFormBiz(businesses[0]?.id ? String(businesses[0].id) : '')
    setCreds({})
    setSyncFrom('')
    setShowModal(true)
  }

  async function handleSave() {
    setLoading(true)
    await fetch('/api/integrations', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business_id: parseInt(formBiz), platform: selectedPlatform.id, credentials: creds, sync_from_date: syncFrom || null }) })
    setShowModal(false); fetchAll(); setLoading(false)
  }

  async function handleSync(id: number) {
    setSyncing(id)
    setSyncResult(r => ({ ...r, [id]: '…' }))
    const res = await fetch('/api/integrations/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ integration_id: id }) })
    const data = await res.json()
    setSyncResult(r => ({ ...r, [id]: data.error ? `Error: ${data.error}` : `✓ ${data.imported ?? 0} imported` }))
    setSyncing(null); fetchAll()
  }

  async function handleDelete(id: number) {
    if (!confirm('Remove this integration?')) return
    await fetch('/api/integrations', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    fetchAll()
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Integrations</h1>
        <p className="text-ace-muted text-sm mt-1">Connect your sales platforms to automatically import transactions</p>
      </div>

      {/* Platform cards */}
      <div className="grid gap-4 md:grid-cols-2 mb-8">
        {PLATFORMS.map(p => {
          const connected = integrations.filter(i => i.platform === p.id)
          return (
            <div key={p.id} className="bg-ace-card border border-ace-border rounded-xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl" style={{ backgroundColor: p.color + '22', border: `2px solid ${p.color}` }}>
                    {p.icon}
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">{p.name}</h3>
                    <p className="text-ace-muted text-xs">{p.desc}</p>
                  </div>
                </div>
                {connected.length > 0
                  ? <span className="text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">Connected</span>
                  : <span className="text-xs px-2 py-1 rounded-full bg-white/5 text-ace-muted border border-ace-border">Not connected</span>}
              </div>

              {connected.map(c => (
                <div key={c.id} className="bg-white/5 rounded-lg p-3 mb-2 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white font-medium">🏢 {c.business_name}</span>
                    <span className="text-ace-muted">{c.last_sync ? `Synced ${c.last_sync.split('T')[0]}` : 'Never synced'}</span>
                  </div>
                  {syncResult[c.id] && <p className={`mb-2 ${syncResult[c.id].startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>{syncResult[c.id]}</p>}
                  <div className="flex gap-2">
                    <button onClick={() => handleSync(c.id)} disabled={syncing === c.id}
                      className="flex-1 py-1 bg-ace-cyan/10 text-ace-cyan border border-ace-cyan/20 rounded hover:bg-ace-cyan/20 transition-colors disabled:opacity-50">
                      {syncing === c.id ? 'Syncing…' : '↺ Sync Now'}
                    </button>
                    <button onClick={() => handleDelete(c.id)} className="px-3 py-1 border border-red-500/30 text-red-400 rounded hover:bg-red-500/10 transition-colors">✕</button>
                  </div>
                </div>
              ))}

              <button onClick={() => openAdd(p)} disabled={businesses.length === 0}
                className="w-full mt-2 py-2 text-sm border border-ace-border rounded-lg text-ace-muted hover:text-white hover:border-white/30 transition-colors disabled:opacity-40">
                {connected.length > 0 ? '+ Connect another business' : `+ Connect ${p.name}`}
              </button>
            </div>
          )
        })}
      </div>

      {businesses.length === 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 text-sm text-yellow-300">
          You need to create a business first before connecting integrations. Go to <a href="/businesses" className="underline">Businesses</a> to get started.
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-ace-card border border-ace-border rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl" style={{ backgroundColor: selectedPlatform.color + '22', border: `2px solid ${selectedPlatform.color}` }}>
                {selectedPlatform.icon}
              </div>
              <h2 className="text-white font-bold text-lg">Connect {selectedPlatform.name}</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-ace-muted text-sm block mb-1">Business</label>
                <select value={formBiz} onChange={e => setFormBiz(e.target.value)}
                  className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan">
                  {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              {selectedPlatform.fields.map(f => (
                <div key={f.key}>
                  <label className="text-ace-muted text-sm block mb-1">{f.label}</label>
                  <input type="password" value={creds[f.key] || ''} onChange={e => setCreds(c => ({ ...c, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan font-mono" />
                </div>
              ))}
              <div>
                <label className="text-ace-muted text-sm block mb-1">Sync from date (optional)</label>
                <input type="date" value={syncFrom} onChange={e => setSyncFrom(e.target.value)}
                  className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2 text-sm border border-ace-border rounded-lg text-ace-muted hover:text-white transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={loading}
                className="flex-1 py-2 text-sm bg-ace-cyan text-black rounded-lg font-semibold hover:bg-ace-cyan/80 transition-colors disabled:opacity-50">
                {loading ? 'Saving…' : 'Save & Connect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
