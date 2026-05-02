'use client'
import { useEffect, useState } from 'react'
import { format, addDays } from 'date-fns'

const fmt = (n: number) => `$${n.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`

function monthlyEq(s: any) {
  const m: Record<string,number> = { weekly: 4.33, fortnightly: 2.17, monthly: 1, quarterly: 1/3, annually: 1/12 }
  return s.amount * (m[s.billing_cycle] || 1)
}

export default function SubscriptionsPage() {
  const [subs, setSubs] = useState<any[]>([])
  const [filter, setFilter] = useState<'active'|'paused'|'cancelled'|'all'>('active')
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', amount: '', billing_cycle: 'monthly', next_billing_date: format(addDays(new Date(),30),'yyyy-MM-dd'), category: 'Subscriptions', color: '#8b5cf6', url: '', notes: '' })

  async function load() {
    const url = filter === 'all' ? '/api/subscriptions' : `/api/subscriptions?status=${filter}`
    const d = await fetch(url).then(r => r.json())
    setSubs(d || [])
  }
  useEffect(() => { load() }, [filter])

  async function save() {
    setSaving(true)
    await fetch('/api/subscriptions', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({...form, amount: parseFloat(form.amount)}) })
    setSaving(false); setShowModal(false)
    setForm({ name: '', amount: '', billing_cycle: 'monthly', next_billing_date: format(addDays(new Date(),30),'yyyy-MM-dd'), category: 'Subscriptions', color: '#8b5cf6', url: '', notes: '' })
    load()
  }

  async function updateStatus(id: number, status: string) {
    await fetch('/api/subscriptions', { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id, status }) })
    load()
  }

  async function del(id: number) {
    if (!confirm('Delete subscription?')) return
    await fetch('/api/subscriptions', { method: 'DELETE', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id }) })
    load()
  }

  const active = subs.filter(s => s.status === 'active')
  const totalMonthly = active.reduce((a, s) => a + monthlyEq(s), 0)
  const totalAnnual = totalMonthly * 12

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Subscriptions</h1>
          <p className="text-ace-muted text-sm">Manage recurring payments</p>
        </div>
        <button onClick={() => setShowModal(true)} className="bg-gradient-to-r from-ace-cyan to-ace-purple text-white text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity">
          + Add Subscription
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-ace-card border border-ace-border rounded-xl p-4">
          <p className="text-ace-muted text-xs mb-1">Monthly Cost</p>
          <p className="text-ace-orange text-xl font-bold">{fmt(totalMonthly)}</p>
        </div>
        <div className="bg-ace-card border border-ace-border rounded-xl p-4">
          <p className="text-ace-muted text-xs mb-1">Annual Cost</p>
          <p className="text-white text-xl font-bold">{fmt(totalAnnual)}</p>
        </div>
        <div className="bg-ace-card border border-ace-border rounded-xl p-4">
          <p className="text-ace-muted text-xs mb-1">Active Subscriptions</p>
          <p className="text-ace-purple text-xl font-bold">{active.length}</p>
        </div>
      </div>

      <div className="flex gap-2 mb-5">
        {(['active','paused','cancelled','all'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm capitalize transition-all ${filter === f ? 'bg-ace-cyan/10 text-ace-cyan border border-ace-cyan/20' : 'bg-ace-card border border-ace-border text-ace-muted hover:text-white'}`}>
            {f}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {subs.length === 0 && <p className="text-ace-muted text-sm col-span-2 text-center py-12">No subscriptions found</p>}
        {subs.map(s => {
          const daysUntil = Math.ceil((new Date(s.next_billing_date).getTime() - Date.now()) / 86400000)
          return (
            <div key={s.id} className="bg-ace-card border border-ace-border rounded-xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold"
                    style={{ backgroundColor: (s.color||'#8b5cf6')+'20', color: s.color||'#8b5cf6' }}>
                    {s.name[0]}
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">{s.name}</h3>
                    <p className="text-ace-muted text-xs">{s.category} · {s.billing_cycle}</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${
                  s.status === 'active' ? 'text-ace-green bg-ace-green/10 border-ace-green/20' :
                  s.status === 'paused' ? 'text-ace-orange bg-ace-orange/10 border-ace-orange/20' :
                  'text-ace-muted bg-ace-muted/10 border-ace-muted/20'
                }`}>{s.status}</span>
              </div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-white text-xl font-bold">{fmt(s.amount)}</p>
                  <p className="text-ace-muted text-xs">{fmt(monthlyEq(s))}/mo equiv.</p>
                </div>
                <div className="text-right">
                  <p className="text-ace-text text-sm">{s.next_billing_date}</p>
                  <p className={`text-xs ${daysUntil <= 3 ? 'text-ace-red' : daysUntil <= 7 ? 'text-ace-orange' : 'text-ace-muted'}`}>
                    {daysUntil < 0 ? `${Math.abs(daysUntil)}d overdue` : daysUntil === 0 ? 'Due today' : `in ${daysUntil} days`}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {s.status === 'active' && <button onClick={() => updateStatus(s.id,'paused')} className="flex-1 py-1.5 text-xs rounded-lg border border-ace-orange/20 text-ace-orange hover:bg-ace-orange/10 transition-colors">Pause</button>}
                {s.status === 'paused' && <button onClick={() => updateStatus(s.id,'active')} className="flex-1 py-1.5 text-xs rounded-lg border border-ace-green/20 text-ace-green hover:bg-ace-green/10 transition-colors">Resume</button>}
                {s.status !== 'cancelled' && <button onClick={() => updateStatus(s.id,'cancelled')} className="flex-1 py-1.5 text-xs rounded-lg border border-ace-red/20 text-ace-red hover:bg-ace-red/10 transition-colors">Cancel</button>}
                {s.status === 'cancelled' && <button onClick={() => updateStatus(s.id,'active')} className="flex-1 py-1.5 text-xs rounded-lg border border-ace-green/20 text-ace-green hover:bg-ace-green/10 transition-colors">Reactivate</button>}
                <button onClick={() => del(s.id)} className="px-3 py-1.5 text-xs rounded-lg border border-ace-border text-ace-muted hover:text-ace-red transition-colors">✕</button>
              </div>
            </div>
          )
        })}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-ace-card border border-ace-border rounded-2xl p-6 w-full max-w-md max-h-screen overflow-y-auto">
            <h2 className="text-white font-bold text-lg mb-5">Add Subscription</h2>
            <div className="space-y-4">
              <input placeholder="Name (e.g. Netflix)" value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))}
                className="w-full bg-ace-bg border border-ace-border rounded-lg px-4 py-2.5 text-ace-text text-sm focus:outline-none focus:border-ace-cyan/50" />
              <input type="number" placeholder="Amount (AUD)" value={form.amount} onChange={e => setForm(f=>({...f,amount:e.target.value}))}
                className="w-full bg-ace-bg border border-ace-border rounded-lg px-4 py-2.5 text-ace-text text-sm focus:outline-none focus:border-ace-cyan/50" min="0" step="0.01" />
              <select value={form.billing_cycle} onChange={e => setForm(f=>({...f,billing_cycle:e.target.value}))}
                className="w-full bg-ace-bg border border-ace-border rounded-lg px-4 py-2.5 text-ace-text text-sm focus:outline-none focus:border-ace-cyan/50">
                {['weekly','fortnightly','monthly','quarterly','annually'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <div>
                <label className="block text-xs text-ace-muted mb-1">Next Billing Date</label>
                <input type="date" value={form.next_billing_date} onChange={e => setForm(f=>({...f,next_billing_date:e.target.value}))}
                  className="w-full bg-ace-bg border border-ace-border rounded-lg px-4 py-2.5 text-ace-text text-sm focus:outline-none focus:border-ace-cyan/50" />
              </div>
              <input placeholder="URL (optional)" value={form.url} onChange={e => setForm(f=>({...f,url:e.target.value}))}
                className="w-full bg-ace-bg border border-ace-border rounded-lg px-4 py-2.5 text-ace-text text-sm focus:outline-none focus:border-ace-cyan/50" />
              <div className="flex gap-3">
                <input placeholder="Category" value={form.category} onChange={e => setForm(f=>({...f,category:e.target.value}))}
                  className="flex-1 bg-ace-bg border border-ace-border rounded-lg px-4 py-2.5 text-ace-text text-sm focus:outline-none focus:border-ace-cyan/50" />
                <div className="flex items-center gap-2">
                  <label className="text-xs text-ace-muted">Colour</label>
                  <input type="color" value={form.color} onChange={e => setForm(f=>({...f,color:e.target.value}))}
                    className="w-10 h-10 rounded-lg border border-ace-border bg-ace-bg cursor-pointer" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-lg border border-ace-border text-ace-muted text-sm hover:text-white transition-colors">Cancel</button>
              <button onClick={save} disabled={saving || !form.name || !form.amount}
                className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-ace-cyan to-ace-purple text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity">
                {saving ? 'Saving...' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
