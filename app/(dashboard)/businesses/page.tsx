'use client'
import { useEffect, useState } from 'react'
import { COUNTRY_OPTIONS } from '@/lib/tax'

interface Business {
  id: number; name: string; abn: string; country: string; currency: string
  tax_framework: string; industry: string; color: string; my_role: string; member_count: number
}

const defaultForm = { name: '', abn: '', tax_id: '', country: 'AU', currency: 'AUD', tax_framework: 'AU_GST', industry: '', color: '#00d4ff' }

export default function BusinessesPage() {
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Business | null>(null)
  const [form, setForm] = useState(defaultForm)
  const [loading, setLoading] = useState(false)

  useEffect(() => { fetchBusinesses() }, [])

  async function fetchBusinesses() {
    const res = await fetch('/api/businesses')
    const data = await res.json()
    setBusinesses(data.businesses || [])
  }

  function openAdd() { setEditing(null); setForm(defaultForm); setShowModal(true) }
  function openEdit(b: Business) {
    setEditing(b)
    setForm({ name: b.name, abn: b.abn || '', tax_id: '', country: b.country, currency: b.currency, tax_framework: b.tax_framework, industry: b.industry || '', color: b.color })
    setShowModal(true)
  }

  async function handleSave() {
    setLoading(true)
    const method = editing ? 'PATCH' : 'POST'
    const body = editing ? { ...form, id: editing.id } : form
    await fetch('/api/businesses', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setShowModal(false); fetchBusinesses(); setLoading(false)
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this business? All associated data will be removed.')) return
    await fetch('/api/businesses', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    fetchBusinesses()
  }

  function handleCountryChange(c: string) {
    const opt = COUNTRY_OPTIONS.find(o => o.value === c)
    setForm(f => ({ ...f, country: c, currency: opt?.currency || f.currency, tax_framework: opt?.framework || f.tax_framework }))
  }

  const TAX_FRAMEWORKS = ['AU_GST','UK_VAT','US_SALES_TAX','NZ_GST','CA_GST','SG_GST','EU_VAT','NONE']

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Businesses</h1>
          <p className="text-ace-muted text-sm mt-1">Manage your businesses and their tax settings</p>
        </div>
        <button onClick={openAdd} className="px-4 py-2 bg-ace-cyan text-black rounded-lg font-semibold text-sm hover:bg-ace-cyan/80 transition-colors">+ Add Business</button>
      </div>

      {businesses.length === 0 ? (
        <div className="text-center py-16 text-ace-muted">
          <div className="text-4xl mb-4">🏢</div>
          <p>No businesses yet. Add your first business to start tracking business finances.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {businesses.map(b => (
            <div key={b.id} className="bg-ace-card border border-ace-border rounded-xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg"
                    style={{ backgroundColor: b.color + '33', border: `2px solid ${b.color}` }}>
                    {b.name[0].toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">{b.name}</h3>
                    <p className="text-ace-muted text-xs">{b.industry || 'No industry set'}</p>
                  </div>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-ace-cyan/10 text-ace-cyan border border-ace-cyan/20">{b.my_role}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                <div className="bg-white/5 rounded-lg p-2">
                  <span className="text-ace-muted block">Country</span>
                  <span className="text-white">{COUNTRY_OPTIONS.find(o => o.value === b.country)?.label || b.country}</span>
                </div>
                <div className="bg-white/5 rounded-lg p-2">
                  <span className="text-ace-muted block">Tax Framework</span>
                  <span className="text-white">{b.tax_framework}</span>
                </div>
                <div className="bg-white/5 rounded-lg p-2">
                  <span className="text-ace-muted block">Currency</span>
                  <span className="text-white">{b.currency}</span>
                </div>
                <div className="bg-white/5 rounded-lg p-2">
                  <span className="text-ace-muted block">Members</span>
                  <span className="text-white">{b.member_count}</span>
                </div>
              </div>
              {b.abn && <p className="text-ace-muted text-xs mb-3">ABN: {b.abn}</p>}
              <div className="flex gap-2">
                <button onClick={() => openEdit(b)} className="flex-1 py-1.5 text-xs border border-ace-border rounded-lg text-ace-muted hover:text-white hover:border-white/30 transition-colors">Edit</button>
                {b.my_role === 'owner' && businesses.length > 1 && (
                  <button onClick={() => handleDelete(b.id)} className="flex-1 py-1.5 text-xs border border-red-500/30 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors">Delete</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-ace-card border border-ace-border rounded-xl p-6 w-full max-w-lg">
            <h2 className="text-white font-bold text-lg mb-5">{editing ? 'Edit Business' : 'Add Business'}</h2>
            <div className="space-y-4">
              <div>
                <label className="text-ace-muted text-sm block mb-1">Business Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="My Business Pty Ltd"
                  className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-ace-muted text-sm block mb-1">ABN / Tax ID</label>
                  <input value={form.abn} onChange={e => setForm(f => ({ ...f, abn: e.target.value }))} placeholder="12 345 678 901"
                    className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan" />
                </div>
                <div>
                  <label className="text-ace-muted text-sm block mb-1">Industry</label>
                  <input value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))} placeholder="e.g. eCommerce"
                    className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan" />
                </div>
              </div>
              <div>
                <label className="text-ace-muted text-sm block mb-1">Country</label>
                <select value={form.country} onChange={e => handleCountryChange(e.target.value)}
                  className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan">
                  {COUNTRY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-ace-muted text-sm block mb-1">Currency</label>
                  <input value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                    className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan" />
                </div>
                <div>
                  <label className="text-ace-muted text-sm block mb-1">Tax Framework</label>
                  <select value={form.tax_framework} onChange={e => setForm(f => ({ ...f, tax_framework: e.target.value }))}
                    className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan">
                    {TAX_FRAMEWORKS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-ace-muted text-sm block mb-1">Brand Colour</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                    className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0" />
                  <span className="text-ace-muted text-sm">{form.color}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2 text-sm border border-ace-border rounded-lg text-ace-muted hover:text-white transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={loading || !form.name}
                className="flex-1 py-2 text-sm bg-ace-cyan text-black rounded-lg font-semibold hover:bg-ace-cyan/80 transition-colors disabled:opacity-50">
                {loading ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
