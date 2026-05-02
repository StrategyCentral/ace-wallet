'use client'
import { useEffect, useState } from 'react'

interface Stream { id: number; name: string; description: string; color: string; business_name: string; is_active: number }
interface Business { id: number; name: string }

const COLORS = ['#00d4ff','#10b981','#8b5cf6','#f59e0b','#ef4444','#ec4899','#06b6d4','#84cc16','#fb923c','#d946ef']
const defaultForm = { name: '', description: '', color: '#00d4ff', business_id: '' }

export default function IncomeStreamsPage() {
  const [streams, setStreams] = useState<Stream[]>([])
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Stream | null>(null)
  const [form, setForm] = useState(defaultForm)
  const [loading, setLoading] = useState(false)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [sr, br] = await Promise.all([fetch('/api/income-streams'), fetch('/api/businesses')])
    const sd = await sr.json(); const bd = await br.json()
    setStreams(sd.streams || []); setBusinesses(bd.businesses || [])
  }

  async function handleSave() {
    setLoading(true)
    const body = { ...form, business_id: form.business_id ? parseInt(form.business_id) : null, ...(editing ? { id: editing.id } : {}) }
    await fetch('/api/income-streams', { method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setShowModal(false); fetchAll(); setLoading(false)
  }

  async function toggleActive(s: Stream) {
    await fetch('/api/income-streams', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: s.id, name: s.name, description: s.description, color: s.color, is_active: s.is_active ? 0 : 1 }) })
    fetchAll()
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this income stream?')) return
    await fetch('/api/income-streams', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    fetchAll()
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Income Streams</h1>
          <p className="text-ace-muted text-sm mt-1">Tag income transactions to track where your money comes from</p>
        </div>
        <button onClick={() => { setEditing(null); setForm(defaultForm); setShowModal(true) }}
          className="px-4 py-2 bg-ace-cyan text-black rounded-lg font-semibold text-sm hover:bg-ace-cyan/80 transition-colors">+ Add Stream</button>
      </div>

      {streams.length === 0 ? (
        <div className="text-center py-16 text-ace-muted">
          <div className="text-4xl mb-4">📊</div>
          <p>No income streams yet. Create streams to track different revenue sources.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {streams.map(s => (
            <div key={s.id} className={`bg-ace-card border rounded-xl p-4 transition-all ${s.is_active ? 'border-ace-border' : 'border-ace-border opacity-50'}`}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                  <h3 className="text-white font-semibold text-sm">{s.name}</h3>
                </div>
                <button onClick={() => toggleActive(s)} className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${s.is_active ? 'border-green-500/30 text-green-400 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30' : 'border-ace-border text-ace-muted hover:border-green-500/30 hover:text-green-400'}`}>
                  {s.is_active ? 'Active' : 'Inactive'}
                </button>
              </div>
              {s.description && <p className="text-ace-muted text-xs mb-2">{s.description}</p>}
              {s.business_name && <p className="text-ace-muted text-xs mb-3">🏢 {s.business_name}</p>}
              <div className="flex gap-2">
                <button onClick={() => { setEditing(s); setForm({ name: s.name, description: s.description || '', color: s.color, business_id: '' }); setShowModal(true) }}
                  className="flex-1 py-1 text-xs border border-ace-border rounded-lg text-ace-muted hover:text-white transition-colors">Edit</button>
                <button onClick={() => handleDelete(s.id)} className="flex-1 py-1 text-xs border border-red-500/30 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-ace-card border border-ace-border rounded-xl p-6 w-full max-w-md">
            <h2 className="text-white font-bold text-lg mb-5">{editing ? 'Edit Stream' : 'Add Income Stream'}</h2>
            <div className="space-y-4">
              <div>
                <label className="text-ace-muted text-sm block mb-1">Stream Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Shopify Sales"
                  className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan" />
              </div>
              <div>
                <label className="text-ace-muted text-sm block mb-1">Description</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description"
                  className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan" />
              </div>
              {businesses.length > 0 && (
                <div>
                  <label className="text-ace-muted text-sm block mb-1">Business</label>
                  <select value={form.business_id} onChange={e => setForm(f => ({ ...f, business_id: e.target.value }))}
                    className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan">
                    <option value="">Personal / No business</option>
                    {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="text-ace-muted text-sm block mb-2">Colour</label>
                <div className="flex flex-wrap gap-2">
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
