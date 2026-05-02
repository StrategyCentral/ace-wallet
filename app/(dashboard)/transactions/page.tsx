'use client'
import { useEffect, useState } from 'react'
import { format } from 'date-fns'

const fmt = (n: number) => `$${Math.abs(n).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function TransactionsPage() {
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [txns, setTxns] = useState<any[]>([])
  const [cats, setCats] = useState<any[]>([])
  const [filter, setFilter] = useState<'all'|'income'|'expense'>('all')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ type: 'expense', amount: '', description: '', category_id: '', date: format(new Date(),'yyyy-MM-dd'), recurring: false, recur_interval: '', notes: '' })
  const [saving, setSaving] = useState(false)

  async function load() {
    const url = `/api/transactions?month=${month}${filter !== 'all' ? `&type=${filter}` : ''}`
    const [t, c] = await Promise.all([
      fetch(url).then(r => r.json()),
      fetch('/api/categories').then(r => r.json()),
    ])
    setTxns(t || [])
    setCats(c || [])
  }
  useEffect(() => { load() }, [month, filter])

  async function save() {
    setSaving(true)
    await fetch('/api/transactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }) })
    setSaving(false); setShowModal(false)
    setForm({ type: 'expense', amount: '', description: '', category_id: '', date: format(new Date(),'yyyy-MM-dd'), recurring: false, recur_interval: '', notes: '' })
    load()
  }

  async function del(id: number) {
    if (!confirm('Delete this transaction?')) return
    await fetch('/api/transactions', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    load()
  }

  const income = txns.filter(t => t.type === 'income').reduce((a, t) => a + t.amount, 0)
  const expenses = txns.filter(t => t.type === 'expense').reduce((a, t) => a + t.amount, 0)
  const filteredCats = cats.filter(c => c.type === form.type)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Transactions</h1>
          <p className="text-ace-muted text-sm">Track all income and expenses</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="bg-gradient-to-r from-ace-cyan to-ace-purple text-white text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity">
          + Add Transaction
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-ace-card border border-ace-border rounded-xl p-4">
          <p className="text-ace-muted text-xs mb-1">Income</p>
          <p className="text-ace-green text-xl font-bold">{fmt(income)}</p>
        </div>
        <div className="bg-ace-card border border-ace-border rounded-xl p-4">
          <p className="text-ace-muted text-xs mb-1">Expenses</p>
          <p className="text-ace-red text-xl font-bold">{fmt(expenses)}</p>
        </div>
        <div className="bg-ace-card border border-ace-border rounded-xl p-4">
          <p className="text-ace-muted text-xs mb-1">Net</p>
          <p className={`text-xl font-bold ${income - expenses >= 0 ? 'text-ace-cyan' : 'text-ace-red'}`}>{fmt(income - expenses)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <input type="month" value={month} onChange={e => setMonth(e.target.value)}
          className="bg-ace-card border border-ace-border text-ace-text rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ace-cyan/50" />
        {(['all','income','expense'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm capitalize transition-all ${filter === f ? 'bg-ace-cyan/10 text-ace-cyan border border-ace-cyan/20' : 'bg-ace-card border border-ace-border text-ace-muted hover:text-white'}`}>
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-ace-card border border-ace-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-ace-border">
              {['Date','Description','Category','Amount',''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs text-ace-muted font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {txns.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-ace-muted text-sm">No transactions found</td></tr>
            )}
            {txns.map(t => (
              <tr key={t.id} className="border-b border-ace-border/50 hover:bg-white/2 transition-colors">
                <td className="px-4 py-3 text-ace-muted text-sm">{t.date}</td>
                <td className="px-4 py-3 text-ace-text text-sm">{t.description}</td>
                <td className="px-4 py-3">
                  {t.category_name && (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs"
                      style={{ backgroundColor: (t.category_color||'#8b5cf6')+'20', color: t.category_color||'#8b5cf6' }}>
                      {t.category_name}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-sm font-semibold ${t.type === 'income' ? 'text-ace-green' : 'text-ace-red'}`}>
                    {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => del(t.id)} className="text-ace-muted hover:text-ace-red transition-colors text-sm">✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-ace-card border border-ace-border rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-white font-bold text-lg mb-5">Add Transaction</h2>
            <div className="space-y-4">
              <div className="flex gap-2">
                {(['expense','income'] as const).map(t => (
                  <button key={t} onClick={() => setForm(f => ({ ...f, type: t, category_id: '' }))}
                    className={`flex-1 py-2 rounded-lg text-sm capitalize transition-all ${form.type === t ? (t === 'income' ? 'bg-ace-green/10 text-ace-green border border-ace-green/20' : 'bg-ace-red/10 text-ace-red border border-ace-red/20') : 'bg-ace-bg border border-ace-border text-ace-muted'}`}>
                    {t}
                  </button>
                ))}
              </div>
              <input placeholder="Description" value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))}
                className="w-full bg-ace-bg border border-ace-border rounded-lg px-4 py-2.5 text-ace-text text-sm focus:outline-none focus:border-ace-cyan/50" />
              <input type="number" placeholder="Amount (AUD)" value={form.amount} onChange={e => setForm(f => ({...f, amount: e.target.value}))}
                className="w-full bg-ace-bg border border-ace-border rounded-lg px-4 py-2.5 text-ace-text text-sm focus:outline-none focus:border-ace-cyan/50" min="0" step="0.01" />
              <input type="date" value={form.date} onChange={e => setForm(f => ({...f, date: e.target.value}))}
                className="w-full bg-ace-bg border border-ace-border rounded-lg px-4 py-2.5 text-ace-text text-sm focus:outline-none focus:border-ace-cyan/50" />
              <select value={form.category_id} onChange={e => setForm(f => ({...f, category_id: e.target.value}))}
                className="w-full bg-ace-bg border border-ace-border rounded-lg px-4 py-2.5 text-ace-text text-sm focus:outline-none focus:border-ace-cyan/50">
                <option value="">Select category</option>
                {filteredCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <textarea placeholder="Notes (optional)" value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))}
                className="w-full bg-ace-bg border border-ace-border rounded-lg px-4 py-2.5 text-ace-text text-sm focus:outline-none focus:border-ace-cyan/50 resize-none h-20" />
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-lg border border-ace-border text-ace-muted hover:text-white text-sm transition-colors">Cancel</button>
              <button onClick={save} disabled={saving || !form.description || !form.amount}
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
