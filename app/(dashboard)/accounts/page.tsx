'use client'
import { useEffect, useState } from 'react'

interface Account {
  id: number; name: string; account_type: string; type: string; currency: string
  balance: number; color: string; institution: string; last_four: string; business_name: string; is_default: number
}
interface Business { id: number; name: string }

const ACCOUNT_TYPES = ['checking','savings','credit','loan','cash','crypto','investment']
const defaultForm = { name: '', account_type: 'personal', type: 'checking', currency: 'AUD', balance: '', color: '#8b5cf6', institution: '', last_four: '', notes: '', business_id: '' }

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [form, setForm] = useState(defaultForm)
  const [loading, setLoading] = useState(false)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [ar, br] = await Promise.all([fetch('/api/accounts'), fetch('/api/businesses')])
    const ad = await ar.json(); const bd = await br.json()
    setAccounts(ad.accounts || []); setBusinesses(bd.businesses || [])
  }

  function openAdd() { setEditing(null); setForm(defaultForm); setShowModal(true) }
  function openEdit(a: Account) {
    setEditing(a)
    setForm({ name: a.name, account_type: a.account_type, type: a.type, currency: a.currency,
      balance: String(a.balance), color: a.color, institution: a.institution || '', last_four: a.last_four || '', notes: '', business_id: '' })
    setShowModal(true)
  }

  async function handleSave() {
    setLoading(true)
    const body = { ...form, balance: parseFloat(form.balance) || 0, business_id: form.business_id ? parseInt(form.business_id) : null, ...(editing ? { id: editing.id } : {}) }
    await fetch('/api/accounts', { method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setShowModal(false); fetchAll(); setLoading(false)
  }

  async function handleDelete(id: number) {
    if (!confirm('Remove this account?')) return
    await fetch('/api/accounts', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    fetchAll()
  }

  const personal = accounts.filter(a => a.account_type === 'personal')
  const business = accounts.filter(a => a.account_type === 'business')

  const typeIcons: Record<string, string> = { checking: '🏦', savings: '💰', credit: '💳', loan: '📋', cash: '💵', crypto: '₿', investment: '📈' }

  function AccountCard({ a }: { a: Account }) {
    return (
      <div className="bg-ace-card border border-ace-border rounded-xl p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl" style={{ backgroundColor: a.color + '22', border: `2px solid ${a.color}` }}>
              {typeIcons[a.type] || '🏦'}
            </div>
            <div>
              <h3 className="text-white font-semibold text-sm">{a.name}</h3>
              <p className="text-ace-muted text-xs">{a.institution || a.type} {a.last_four ? `••••${a.last_four}` : ''}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-white font-bold">{a.currency} {a.balance.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</p>
            {a.is_default === 1 && <span className="text-xs text-ace-cyan">Default</span>}
          </div>
        </div>
        {a.business_name && <p className="text-ace-muted text-xs mb-3">🏢 {a.business_name}</p>}
        <div className="flex gap-2">
          <button onClick={() => openEdit(a)} className="flex-1 py-1 text-xs border border-ace-border rounded-lg text-ace-muted hover:text-white transition-colors">Edit</button>
          <button onClick={() => handleDelete(a.id)} className="flex-1 py-1 text-xs border border-red-500/30 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors">Remove</button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Accounts</h1>
          <p className="text-ace-muted text-sm mt-1">Bank accounts, cards, and wallets</p>
        </div>
        <button onClick={openAdd} className="px-4 py-2 bg-ace-cyan text-black rounded-lg font-semibold text-sm hover:bg-ace-cyan/80 transition-colors">+ Add Account</button>
      </div>

      {personal.length > 0 && (
        <div className="mb-6">
          <h2 className="text-ace-muted text-sm font-semibold uppercase tracking-wider mb-3">Personal</h2>
          <div className="grid gap-3 md:grid-cols-2">{personal.map(a => <AccountCard key={a.id} a={a} />)}</div>
        </div>
      )}
      {business.length > 0 && (
        <div className="mb-6">
          <h2 className="text-ace-muted text-sm font-semibold uppercase tracking-wider mb-3">Business</h2>
          <div className="grid gap-3 md:grid-cols-2">{business.map(a => <AccountCard key={a.id} a={a} />)}</div>
        </div>
      )}
      {accounts.length === 0 && (
        <div className="text-center py-16 text-ace-muted">
          <div className="text-4xl mb-4">🏦</div>
          <p>No accounts yet. Add your bank accounts and cards to track balances.</p>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-ace-card border border-ace-border rounded-xl p-6 w-full max-w-md">
            <h2 className="text-white font-bold text-lg mb-5">{editing ? 'Edit Account' : 'Add Account'}</h2>
            <div className="space-y-3">
              <div>
                <label className="text-ace-muted text-sm block mb-1">Account Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. NAB Savings"
                  className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-ace-muted text-sm block mb-1">Type</label>
                  <select value={form.account_type} onChange={e => setForm(f => ({ ...f, account_type: e.target.value }))}
                    className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan">
                    <option value="personal">Personal</option>
                    <option value="business">Business</option>
                  </select>
                </div>
                <div>
                  <label className="text-ace-muted text-sm block mb-1">Account Kind</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                    className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan">
                    {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              {form.account_type === 'business' && businesses.length > 0 && (
                <div>
                  <label className="text-ace-muted text-sm block mb-1">Business</label>
                  <select value={form.business_id} onChange={e => setForm(f => ({ ...f, business_id: e.target.value }))}
                    className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan">
                    <option value="">Select business…</option>
                    {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-ace-muted text-sm block mb-1">Currency</label>
                  <input value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                    className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan" />
                </div>
                <div>
                  <label className="text-ace-muted text-sm block mb-1">Current Balance</label>
                  <input type="number" value={form.balance} onChange={e => setForm(f => ({ ...f, balance: e.target.value }))} placeholder="0.00"
                    className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-ace-muted text-sm block mb-1">Bank / Institution</label>
                  <input value={form.institution} onChange={e => setForm(f => ({ ...f, institution: e.target.value }))} placeholder="e.g. ANZ"
                    className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan" />
                </div>
                <div>
                  <label className="text-ace-muted text-sm block mb-1">Last 4 Digits</label>
                  <input value={form.last_four} onChange={e => setForm(f => ({ ...f, last_four: e.target.value }))} placeholder="1234" maxLength={4}
                    className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan" />
                </div>
              </div>
              <div>
                <label className="text-ace-muted text-sm block mb-1">Colour</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0" />
                  <span className="text-ace-muted text-sm">{form.color}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
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
