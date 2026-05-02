'use client'
import { useEffect, useState } from 'react'

interface Transaction {
  id: number; type: string; amount: number; description: string; date: string
  category_id: number; category_name: string; color: string; notes: string
  scope: string; business_id: number | null; account_id: number | null; income_stream_id: number | null
  is_tax_deductible: number; gst_inclusive: number; business_name: string; account_name: string; stream_name: string
  currency: string
}
interface Category { id: number; name: string; type: string; color: string }
interface Business { id: number; name: string }
interface Account { id: number; name: string; account_type: string }
interface Stream { id: number; name: string; business_id: number | null }

const now = new Date()
const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [streams, setStreams] = useState<Stream[]>([])
  const [month, setMonth] = useState(defaultMonth)
  const [filter, setFilter] = useState<'all'|'income'|'expense'|'business'>('all')
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    type: 'expense', amount: '', description: '', category_id: '', date: new Date().toISOString().split('T')[0],
    scope: 'personal', business_id: '', account_id: '', income_stream_id: '',
    is_tax_deductible: false, gst_inclusive: false, notes: '', currency: 'AUD'
  })

  useEffect(() => { fetchAll() }, [month])

  async function fetchAll() {
    const [tr, cr, br, ar, sr] = await Promise.all([
      fetch(`/api/transactions?month=${month}`),
      fetch('/api/categories'),
      fetch('/api/businesses'),
      fetch('/api/accounts'),
      fetch('/api/income-streams'),
    ])
    const [td, cd, bd, ad, sd] = await Promise.all([tr.json(), cr.json(), br.json(), ar.json(), sr.json()])
    setTransactions(td.transactions || [])
    setCategories(cd.categories || [])
    setBusinesses(bd.businesses || [])
    setAccounts(ad.accounts || [])
    setStreams(sd.streams || [])
  }

  function openAdd() {
    setForm({ type: 'expense', amount: '', description: '', category_id: '', date: new Date().toISOString().split('T')[0],
      scope: 'personal', business_id: '', account_id: '', income_stream_id: '',
      is_tax_deductible: false, gst_inclusive: false, notes: '', currency: 'AUD' })
    setShowModal(true)
  }

  async function handleSave() {
    setLoading(true)
    await fetch('/api/transactions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        amount: parseFloat(form.amount) || 0,
        category_id: form.category_id ? parseInt(form.category_id) : null,
        business_id: form.business_id ? parseInt(form.business_id) : null,
        account_id: form.account_id ? parseInt(form.account_id) : null,
        income_stream_id: form.income_stream_id ? parseInt(form.income_stream_id) : null,
        is_tax_deductible: form.is_tax_deductible ? 1 : 0,
        gst_inclusive: form.gst_inclusive ? 1 : 0,
      })
    })
    setShowModal(false); fetchAll(); setLoading(false)
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this transaction?')) return
    await fetch('/api/transactions', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    fetchAll()
  }

  const filteredCats = categories.filter(c => c.type === form.type)
  const visibleTx = transactions.filter(t => {
    if (filter === 'all') return true
    if (filter === 'business') return t.scope === 'business'
    return t.type === filter
  })
  const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const bizIncome = transactions.filter(t => t.type === 'income' && t.scope === 'business').reduce((s, t) => s + t.amount, 0)
  const bizExpenses = transactions.filter(t => t.type === 'expense' && t.scope === 'business').reduce((s, t) => s + t.amount, 0)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Transactions</h1>
          <p className="text-ace-muted text-sm mt-1">Track all income and expenses</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan" />
          <button onClick={openAdd} className="px-4 py-2 bg-ace-cyan text-black rounded-lg font-semibold text-sm hover:bg-ace-cyan/80 transition-colors">+ Add</button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Income', value: `AUD ${income.toLocaleString()}`, color: 'text-green-400' },
          { label: 'Expenses', value: `AUD ${expenses.toLocaleString()}`, color: 'text-red-400' },
          { label: 'Biz Revenue', value: `AUD ${bizIncome.toLocaleString()}`, color: 'text-ace-cyan' },
          { label: 'Biz Expenses', value: `AUD ${bizExpenses.toLocaleString()}`, color: 'text-ace-purple' },
        ].map(k => (
          <div key={k.label} className="bg-ace-card border border-ace-border rounded-xl p-4">
            <p className="text-ace-muted text-xs mb-1">{k.label}</p>
            <p className={`text-lg font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-ace-bg border border-ace-border rounded-xl p-1 mb-4 w-fit">
        {[['all','All'],['income','Income'],['expense','Expenses'],['business','Business']].map(([v,l]) => (
          <button key={v} onClick={() => setFilter(v as typeof filter)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${filter === v ? 'bg-ace-card text-white' : 'text-ace-muted hover:text-white'}`}>{l}</button>
        ))}
      </div>

      {/* Transaction list */}
      <div className="bg-ace-card border border-ace-border rounded-xl overflow-hidden">
        {visibleTx.length === 0 ? (
          <div className="text-center py-12 text-ace-muted">
            <div className="text-3xl mb-3">📭</div>
            <p>No transactions for this period</p>
          </div>
        ) : (
          <div className="divide-y divide-ace-border">
            {visibleTx.map(t => (
              <div key={t.id} className="flex items-center justify-between px-5 py-3 hover:bg-white/2 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: t.color || (t.type === 'income' ? '#10b981' : '#ef4444') }} />
                  <div>
                    <p className="text-white text-sm font-medium">{t.description}</p>
                    <div className="flex items-center gap-2 text-xs text-ace-muted flex-wrap">
                      <span>{t.date}</span>
                      {t.category_name && <span>• {t.category_name}</span>}
                      {t.scope === 'business' && <span className="text-ace-purple">• {t.business_name || 'Business'}</span>}
                      {t.account_name && <span>• {t.account_name}</span>}
                      {t.stream_name && <span className="text-ace-cyan">• {t.stream_name}</span>}
                      {t.is_tax_deductible === 1 && <span className="text-yellow-400">• deductible</span>}
                      {t.gst_inclusive === 1 && <span className="text-orange-400">• GST</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`font-semibold text-sm ${t.type === 'income' ? 'text-green-400' : 'text-red-400'}`}>
                    {t.type === 'income' ? '+' : '-'}{t.currency || 'AUD'} {t.amount.toLocaleString()}
                  </span>
                  <button onClick={() => handleDelete(t.id)} className="text-ace-muted hover:text-red-400 transition-colors text-lg leading-none">×</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add transaction modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-ace-card border border-ace-border rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-white font-bold text-lg mb-5">Add Transaction</h2>
            <div className="space-y-4">
              {/* Type + Scope */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-ace-muted text-sm block mb-1">Type</label>
                  <div className="flex gap-1 bg-ace-bg border border-ace-border rounded-lg p-1">
                    {['income','expense'].map(t => (
                      <button key={t} onClick={() => setForm(f => ({ ...f, type: t, category_id: '' }))}
                        className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-all ${form.type === t ? (t === 'income' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400') : 'text-ace-muted'}`}>
                        {t === 'income' ? 'Income' : 'Expense'}
                      </button>
                    ))}
                  </div>
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

              {/* Amount + Currency */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="text-ace-muted text-sm block mb-1">Amount *</label>
                  <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00"
                    className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan" />
                </div>
                <div>
                  <label className="text-ace-muted text-sm block mb-1">Currency</label>
                  <input value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                    className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan" />
                </div>
              </div>

              <div>
                <label className="text-ace-muted text-sm block mb-1">Description *</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What was this for?"
                  className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-ace-muted text-sm block mb-1">Date</label>
                  <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan" />
                </div>
                <div>
                  <label className="text-ace-muted text-sm block mb-1">Category</label>
                  <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
                    className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan">
                    <option value="">Select…</option>
                    {filteredCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Account */}
              {accounts.length > 0 && (
                <div>
                  <label className="text-ace-muted text-sm block mb-1">Account</label>
                  <select value={form.account_id} onChange={e => setForm(f => ({ ...f, account_id: e.target.value }))}
                    className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan">
                    <option value="">No account</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.account_type})</option>)}
                  </select>
                </div>
              )}

              {/* Business fields */}
              {form.scope === 'business' && (
                <>
                  {businesses.length > 0 && (
                    <div>
                      <label className="text-ace-muted text-sm block mb-1">Business</label>
                      <select value={form.business_id} onChange={e => setForm(f => ({ ...f, business_id: e.target.value }))}
                        className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan">
                        <option value="">Select business…</option>
                        {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </div>
                  )}
                  {form.type === 'income' && streams.length > 0 && (
                    <div>
                      <label className="text-ace-muted text-sm block mb-1">Income Stream</label>
                      <select value={form.income_stream_id} onChange={e => setForm(f => ({ ...f, income_stream_id: e.target.value }))}
                        className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan">
                        <option value="">No stream</option>
                        {streams.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm text-ace-muted cursor-pointer">
                      <input type="checkbox" checked={form.is_tax_deductible} onChange={e => setForm(f => ({ ...f, is_tax_deductible: e.target.checked }))}
                        className="w-4 h-4 rounded accent-ace-cyan" />
                      Tax deductible
                    </label>
                    <label className="flex items-center gap-2 text-sm text-ace-muted cursor-pointer">
                      <input type="checkbox" checked={form.gst_inclusive} onChange={e => setForm(f => ({ ...f, gst_inclusive: e.target.checked }))}
                        className="w-4 h-4 rounded accent-ace-cyan" />
                      GST inclusive
                    </label>
                  </div>
                </>
              )}

              <div>
                <label className="text-ace-muted text-sm block mb-1">Notes</label>
                <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes"
                  className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2 text-sm border border-ace-border rounded-lg text-ace-muted hover:text-white transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={loading || !form.amount || !form.description}
                className="flex-1 py-2 text-sm bg-ace-cyan text-black rounded-lg font-semibold hover:bg-ace-cyan/80 transition-colors disabled:opacity-50">
                {loading ? 'Saving…' : 'Add Transaction'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
