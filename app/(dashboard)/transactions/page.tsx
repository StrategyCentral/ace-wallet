'use client'
import { useEffect, useState, useRef } from 'react'

interface Transaction {
  id: number; type: string; amount: number; description: string; date: string
  category_id: number; category_name: string; color: string; notes: string
  scope: string; business_id: number | null; account_id: number | null; income_stream_id: number | null
  is_tax_deductible: number; gst_inclusive: number; business_name: string; account_name: string; stream_name: string
  currency: string; recurring: number; recur_interval: string
}
interface Category { id: number; name: string; type: string; color: string }
interface Business { id: number; name: string }
interface Account { id: number; name: string; account_type: string }
interface Stream { id: number; name: string; business_id: number | null }
interface ImportRow {
  date: string; description: string; amount: number; type: 'income' | 'expense'
  category_id: number | null; category_name: string | null; matched: boolean
  original_description: string; approved: boolean; scope?: string
}

const now = new Date()
const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

const INTERVALS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly', label: 'Fortnightly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annually', label: 'Annually' },
]

const BILLING_CYCLES = ['weekly','fortnightly','monthly','quarterly','annually']

function parseCSV(text: string): { date: string; description: string; amount: number }[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []
  const header = lines[0].toLowerCase()
  const cols = header.split(',').map(c => c.replace(/"/g, '').trim())

  // Try to detect column positions
  const dateIdx = cols.findIndex(c => /date/.test(c))
  const descIdx = cols.findIndex(c => /desc|narr|memo|particular|reference|detail/i.test(c))
  const amtIdx = cols.findIndex(c => /amount|value|sum/i.test(c))
  const debitIdx = cols.findIndex(c => /debit/i.test(c))
  const creditIdx = cols.findIndex(c => /credit/i.test(c))

  const rows: { date: string; description: string; amount: number }[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // Parse CSV respecting quotes
    const vals: string[] = []
    let current = ''
    let inQuotes = false
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue }
      if (ch === ',' && !inQuotes) { vals.push(current.trim()); current = ''; continue }
      current += ch
    }
    vals.push(current.trim())

    let rawDate = dateIdx >= 0 ? vals[dateIdx] : vals[0]
    const desc = descIdx >= 0 ? vals[descIdx] : vals[1] || ''
    
    let amount = 0
    if (debitIdx >= 0 && creditIdx >= 0) {
      const debit = parseFloat(vals[debitIdx]?.replace(/[^0-9.\-]/g, '') || '0')
      const credit = parseFloat(vals[creditIdx]?.replace(/[^0-9.\-]/g, '') || '0')
      amount = credit > 0 ? credit : -Math.abs(debit)
    } else if (amtIdx >= 0) {
      amount = parseFloat(vals[amtIdx]?.replace(/[^0-9.\-]/g, '') || '0')
    } else {
      amount = parseFloat(vals[2]?.replace(/[^0-9.\-]/g, '') || '0')
    }

    if (!rawDate || !desc || isNaN(amount)) continue

    // Normalise date: try DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD
    let isoDate = rawDate
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(rawDate)) {
      const [a, b, y] = rawDate.split('/')
      // Assume DD/MM/YYYY (AU format)
      isoDate = `${y}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`
    } else if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(rawDate)) {
      const [a, b, y] = rawDate.split('/')
      isoDate = `20${y}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`
    }

    rows.push({ date: isoDate, description: desc, amount })
  }
  return rows
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [streams, setStreams] = useState<Stream[]>([])
  const [month, setMonth] = useState(defaultMonth)
  const [filter, setFilter] = useState<'all'|'income'|'expense'|'business'|'recurring'>('all')
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    type: 'expense', amount: '', description: '', category_id: '', date: new Date().toISOString().split('T')[0],
    scope: 'personal', business_id: '', account_id: '', income_stream_id: '',
    is_tax_deductible: false, gst_inclusive: false, notes: '', currency: 'AUD',
    recurring: false, recur_interval: 'monthly',
  })

  // Import state
  const [showImport, setShowImport] = useState(false)
  const [importRows, setImportRows] = useState<ImportRow[]>([])
  const [importCats, setImportCats] = useState<Category[]>([])
  const [importLoading, setImportLoading] = useState(false)
  const [importStep, setImportStep] = useState<'upload'|'review'>('upload')
  const [importScope, setImportScope] = useState('personal')
  const [importAccountId, setImportAccountId] = useState('')
  const [importSaved, setImportSaved] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  // Subscription modal state
  const [showSubModal, setShowSubModal] = useState(false)
  const [subForm, setSubForm] = useState({
    name: '', amount: '', billing_cycle: 'monthly',
    next_billing_date: '', category: 'Subscriptions', color: '#8b5cf6',
    url: '', scope: 'personal', business_id: '', is_tax_deductible: false,
  })
  const [subSaving, setSubSaving] = useState(false)

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
    setError('')
    setForm({
      type: 'expense', amount: '', description: '', category_id: '', date: new Date().toISOString().split('T')[0],
      scope: 'personal', business_id: '', account_id: '', income_stream_id: '',
      is_tax_deductible: false, gst_inclusive: false, notes: '', currency: 'AUD',
      recurring: false, recur_interval: 'monthly',
    })
    setShowModal(true)
  }

  async function handleSave() {
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/transactions', {
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
          recurring: form.recurring ? 1 : 0,
          recur_interval: form.recurring ? form.recur_interval : null,
        })
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || `Save failed (${res.status})`)
        setLoading(false)
        return
      }
      setShowModal(false)
      await fetchAll()
    } catch (e: any) {
      setError(e.message || 'Network error — check your connection')
    }
    setLoading(false)
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this transaction?')) return
    await fetch('/api/transactions', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    fetchAll()
  }

  // ── Import handlers ──
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportLoading(true)
    const text = await file.text()
    const parsed = parseCSV(text)
    if (parsed.length === 0) {
      setError('Could not parse any rows from the file. Please check the CSV format.')
      setImportLoading(false)
      return
    }

    // Send to API for category matching
    try {
      const res = await fetch('/api/transactions/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: parsed, scope: importScope, account_id: importAccountId ? parseInt(importAccountId) : null })
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Import failed'); setImportLoading(false); return }
      setImportRows((data.rows as ImportRow[]).map(r => ({ ...r, approved: true })))
      setImportCats(data.categories || categories)
      setImportStep('review')
    } catch (e: any) {
      setError(e.message || 'Import network error')
    }
    setImportLoading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleImportSave() {
    setImportLoading(true)
    try {
      const res = await fetch('/api/transactions/import', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: importRows.filter(r => r.approved),
          scope: importScope,
          account_id: importAccountId ? parseInt(importAccountId) : null,
        })
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Save failed'); setImportLoading(false); return }
      setImportSaved(data.saved || 0)
      setImportStep('upload')
      setImportRows([])
      setShowImport(false)
      await fetchAll()
    } catch (e: any) {
      setError(e.message || 'Save error')
    }
    setImportLoading(false)
  }

  function setRowCategory(idx: number, catId: number) {
    setImportRows(prev => prev.map((r, i) => {
      if (i !== idx) return r
      const cat = importCats.find(c => c.id === catId)
      return { ...r, category_id: catId, category_name: cat?.name || null, matched: true }
    }))
  }

  function toggleRowApproval(idx: number) {
    setImportRows(prev => prev.map((r, i) => i === idx ? { ...r, approved: !r.approved } : r))
  }

  // ── Subscription from transaction ──
  function openSubFromTx(t: Transaction) {
    // Calculate next billing date: one month from the transaction date
    const txDate = new Date(t.date)
    txDate.setMonth(txDate.getMonth() + 1)
    const nextDate = txDate.toISOString().split('T')[0]

    setSubForm({
      name: t.description, amount: String(t.amount),
      billing_cycle: 'monthly', next_billing_date: nextDate,
      category: t.category_name || 'Subscriptions', color: t.color || '#8b5cf6',
      url: '', scope: t.scope || 'personal',
      business_id: t.business_id ? String(t.business_id) : '',
      is_tax_deductible: t.is_tax_deductible === 1,
    })
    setShowSubModal(true)
  }

  async function handleSubSave() {
    setSubSaving(true)
    try {
      const res = await fetch('/api/subscriptions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...subForm,
          amount: parseFloat(subForm.amount) || 0,
          business_id: subForm.scope === 'business' && subForm.business_id ? Number(subForm.business_id) : null,
          is_tax_deductible: subForm.is_tax_deductible ? 1 : 0,
        })
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to create subscription'); setSubSaving(false); return }
      setShowSubModal(false)
    } catch (e: any) {
      setError(e.message || 'Network error')
    }
    setSubSaving(false)
  }

  const filteredCats = categories.filter(c => c.type === form.type)

  const visibleTx = transactions.filter(t => {
    if (filter === 'all') return true
    if (filter === 'business') return t.scope === 'business'
    if (filter === 'recurring') return t.recurring === 1
    return t.type === filter
  })

  const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const bizIncome = transactions.filter(t => t.type === 'income' && t.scope === 'business').reduce((s, t) => s + t.amount, 0)
  const bizExpenses = transactions.filter(t => t.type === 'expense' && t.scope === 'business').reduce((s, t) => s + t.amount, 0)

  const approvedCount = importRows.filter(r => r.approved).length
  const matchedCount = importRows.filter(r => r.matched).length

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Error toast */}
      {error && (
        <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl flex items-center justify-between">
          <span className="text-sm">{error}</span>
          <button onClick={() => setError('')} className="ml-3 text-red-400 hover:text-red-300">✕</button>
        </div>
      )}

      {/* Success toast for imports */}
      {importSaved > 0 && (
        <div className="mb-4 bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-xl flex items-center justify-between">
          <span className="text-sm">Imported {importSaved} transactions successfully</span>
          <button onClick={() => setImportSaved(0)} className="ml-3 text-green-400 hover:text-green-300">✕</button>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Transactions</h1>
          <p className="text-ace-muted text-sm mt-1">Track all income and expenses</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan" />
          <button onClick={() => { setError(''); setImportStep('upload'); setImportRows([]); setShowImport(true) }}
            className="px-4 py-2 bg-ace-purple/20 text-ace-purple border border-ace-purple/30 rounded-lg font-semibold text-sm hover:bg-ace-purple/30 transition-colors">
            ↑ Import
          </button>
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
        {[['all','All'],['income','Income'],['expense','Expenses'],['business','Business'],['recurring','Recurring']].map(([v,l]) => (
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
              <div key={t.id} className="flex items-center justify-between px-5 py-3 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: t.color || (t.type === 'income' ? '#10b981' : '#ef4444') }} />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-white text-sm font-medium">{t.description}</p>
                      {t.recurring === 1 && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-ace-purple/20 text-ace-purple border border-ace-purple/30">
                          ↺ {t.recur_interval}
                        </span>
                      )}
                    </div>
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
                <div className="flex items-center gap-3">
                  <span className={`font-semibold text-sm ${t.type === 'income' ? 'text-green-400' : 'text-red-400'}`}>
                    {t.type === 'income' ? '+' : '-'}{t.currency || 'AUD'} {t.amount.toLocaleString()}
                  </span>
                  {/* Subscription button */}
                  <button onClick={() => openSubFromTx(t)} title="Create subscription from this transaction"
                    className="text-ace-muted hover:text-ace-purple transition-colors text-sm p-1 rounded hover:bg-ace-purple/10">
                    ↺
                  </button>
                  <button onClick={() => handleDelete(t.id)} className="text-ace-muted hover:text-red-400 transition-colors text-lg leading-none">×</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══════════════ Add Transaction Modal ═══════════════ */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-ace-card border border-ace-border rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-white font-bold text-lg mb-5">Add Transaction</h2>

            {error && (
              <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-400 px-3 py-2 rounded-lg text-sm">{error}</div>
            )}

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
                  <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" min="0.01" step="0.01"
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

              {/* Date + Recurring */}
              <div>
                <label className="text-ace-muted text-sm block mb-1">Date</label>
                <div className="flex items-center gap-3">
                  <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    className="flex-1 bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan" />
                  <label className="flex items-center gap-2 cursor-pointer select-none whitespace-nowrap">
                    <div onClick={() => setForm(f => ({ ...f, recurring: !f.recurring }))}
                      className={`w-9 h-5 rounded-full transition-colors relative ${form.recurring ? 'bg-ace-purple' : 'bg-white/10'}`}>
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${form.recurring ? 'left-4' : 'left-0.5'}`} />
                    </div>
                    <span className="text-ace-muted text-sm">Recurring</span>
                  </label>
                </div>
              </div>

              {form.recurring && (
                <div className="bg-ace-purple/5 border border-ace-purple/20 rounded-xl p-4">
                  <label className="text-ace-muted text-sm block mb-2">Repeats every</label>
                  <div className="flex flex-wrap gap-2">
                    {INTERVALS.map(i => (
                      <button key={i.value} onClick={() => setForm(f => ({ ...f, recur_interval: i.value }))}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${form.recur_interval === i.value
                          ? 'bg-ace-purple/20 text-ace-purple border-ace-purple/40'
                          : 'bg-ace-bg border-ace-border text-ace-muted hover:text-white'}`}>
                        {i.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-ace-muted text-xs mt-2">
                    Starting {form.date} — next due dates will show on your Overview
                  </p>
                </div>
              )}

              {/* Category */}
              <div>
                <label className="text-ace-muted text-sm block mb-1">Category</label>
                <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
                  className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan">
                  <option value="">Select…</option>
                  {filteredCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
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
              <button onClick={() => { setShowModal(false); setError('') }} className="flex-1 py-2 text-sm border border-ace-border rounded-lg text-ace-muted hover:text-white transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={loading || !form.amount || !form.description}
                className="flex-1 py-2 text-sm bg-ace-cyan text-black rounded-lg font-semibold hover:bg-ace-cyan/80 transition-colors disabled:opacity-50">
                {loading ? 'Saving…' : 'Add Transaction'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ Import Modal ═══════════════ */}
      {showImport && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-ace-card border border-ace-border rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">

            {importStep === 'upload' && (
              <>
                <h2 className="text-white font-bold text-lg mb-2">Import Bank Statement</h2>
                <p className="text-ace-muted text-sm mb-5">Upload a CSV export from your bank. We'll auto-detect categories based on your previous allocations.</p>

                <div className="space-y-4 mb-6">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-ace-muted text-sm block mb-1">Default Scope</label>
                      <div className="flex gap-1 bg-ace-bg border border-ace-border rounded-lg p-1">
                        {['personal','business'].map(s => (
                          <button key={s} onClick={() => setImportScope(s)}
                            className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-all ${importScope === s ? 'bg-ace-cyan/20 text-ace-cyan' : 'text-ace-muted'}`}>
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                    {accounts.length > 0 && (
                      <div>
                        <label className="text-ace-muted text-sm block mb-1">Account</label>
                        <select value={importAccountId} onChange={e => setImportAccountId(e.target.value)}
                          className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan">
                          <option value="">No account</option>
                          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="border-2 border-dashed border-ace-border rounded-xl p-8 text-center hover:border-ace-cyan/40 transition-colors cursor-pointer"
                    onClick={() => fileRef.current?.click()}>
                    <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
                    <div className="text-3xl mb-3">📄</div>
                    <p className="text-white font-medium mb-1">Drop your bank CSV here</p>
                    <p className="text-ace-muted text-xs">Supports most AU bank exports (CommBank, ANZ, Westpac, NAB, etc.)</p>
                    {importLoading && <p className="text-ace-cyan text-sm mt-3">Processing…</p>}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setShowImport(false)} className="flex-1 py-2 text-sm border border-ace-border rounded-lg text-ace-muted hover:text-white transition-colors">Cancel</button>
                </div>
              </>
            )}

            {importStep === 'review' && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-white font-bold text-lg">Review Import</h2>
                    <p className="text-ace-muted text-sm">
                      {importRows.length} rows found · {matchedCount} auto-matched · {approvedCount} selected
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { const allApproved = importRows.every(r => r.approved); setImportRows(prev => prev.map(r => ({ ...r, approved: !allApproved }))) }}
                      className="px-3 py-1.5 text-xs border border-ace-border rounded-lg text-ace-muted hover:text-white transition-colors">
                      {importRows.every(r => r.approved) ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                </div>

                <div className="space-y-2 mb-6 max-h-[50vh] overflow-y-auto">
                  {importRows.map((row, idx) => (
                    <div key={idx} className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
                      row.approved
                        ? 'bg-ace-bg border-ace-border'
                        : 'bg-ace-bg/50 border-ace-border/50 opacity-50'
                    }`}>
                      {/* Approve checkbox */}
                      <input type="checkbox" checked={row.approved} onChange={() => toggleRowApproval(idx)}
                        className="w-4 h-4 rounded accent-ace-cyan flex-shrink-0" />

                      {/* Date */}
                      <span className="text-ace-muted text-xs w-20 flex-shrink-0">{row.date}</span>

                      {/* Description */}
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm truncate">{row.description}</p>
                      </div>

                      {/* Amount */}
                      <span className={`text-sm font-semibold flex-shrink-0 w-24 text-right ${row.type === 'income' ? 'text-green-400' : 'text-red-400'}`}>
                        {row.type === 'income' ? '+' : '-'}${row.amount.toFixed(2)}
                      </span>

                      {/* Category select */}
                      <select value={row.category_id || ''} onChange={e => setRowCategory(idx, parseInt(e.target.value))}
                        className={`bg-ace-bg border rounded-lg px-2 py-1.5 text-sm w-36 flex-shrink-0 focus:outline-none focus:border-ace-cyan ${
                          row.matched ? 'border-green-500/30 text-green-400' : 'border-ace-orange/30 text-ace-orange'
                        }`}>
                        <option value="">Uncategorised</option>
                        {(importCats.length > 0 ? importCats : categories)
                          .filter(c => c.type === row.type)
                          .map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3">
                  <button onClick={() => { setImportStep('upload'); setImportRows([]) }}
                    className="flex-1 py-2 text-sm border border-ace-border rounded-lg text-ace-muted hover:text-white transition-colors">
                    Back
                  </button>
                  <button onClick={handleImportSave} disabled={importLoading || approvedCount === 0}
                    className="flex-1 py-2 text-sm bg-ace-cyan text-black rounded-lg font-semibold hover:bg-ace-cyan/80 transition-colors disabled:opacity-50">
                    {importLoading ? 'Saving…' : `Import ${approvedCount} Transaction${approvedCount !== 1 ? 's' : ''}`}
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}

      {/* ═══════════════ Subscription Modal (from transaction) ═══════════════ */}
      {showSubModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-ace-card border border-ace-border rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-white font-bold text-lg mb-2">Create Subscription</h2>
            <p className="text-ace-muted text-sm mb-5">This will add a recurring subscription to your Subscriptions tab.</p>

            <div className="space-y-4">
              <div>
                <label className="text-ace-muted text-sm block mb-1">Name</label>
                <input value={subForm.name} onChange={e => setSubForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Netflix"
                  className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-ace-muted text-sm block mb-1">Amount</label>
                  <input type="number" value={subForm.amount} onChange={e => setSubForm(f => ({ ...f, amount: e.target.value }))}
                    min="0.01" step="0.01"
                    className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan" />
                </div>
                <div>
                  <label className="text-ace-muted text-sm block mb-1">Billing Cycle</label>
                  <select value={subForm.billing_cycle} onChange={e => setSubForm(f => ({ ...f, billing_cycle: e.target.value }))}
                    className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan">
                    {BILLING_CYCLES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-ace-muted text-sm block mb-1">Next Billing Date</label>
                <input type="date" value={subForm.next_billing_date} onChange={e => setSubForm(f => ({ ...f, next_billing_date: e.target.value }))}
                  className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan" />
              </div>

              <div>
                <label className="text-ace-muted text-sm block mb-1">Website URL (for logo)</label>
                <input value={subForm.url} onChange={e => setSubForm(f => ({ ...f, url: e.target.value }))} placeholder="https://netflix.com"
                  className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-ace-muted text-sm block mb-1">Category</label>
                  <input value={subForm.category} onChange={e => setSubForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan" />
                </div>
                <div>
                  <label className="text-ace-muted text-sm block mb-1">Scope</label>
                  <div className="flex gap-1 bg-ace-bg border border-ace-border rounded-lg p-1">
                    {['personal','business'].map(s => (
                      <button key={s} onClick={() => setSubForm(f => ({ ...f, scope: s }))}
                        className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-all ${subForm.scope === s ? 'bg-ace-cyan/20 text-ace-cyan' : 'text-ace-muted'}`}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {subForm.scope === 'business' && businesses.length > 0 && (
                <div>
                  <label className="text-ace-muted text-sm block mb-1">Business</label>
                  <select value={subForm.business_id} onChange={e => setSubForm(f => ({ ...f, business_id: e.target.value }))}
                    className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan">
                    <option value="">Select business…</option>
                    {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              )}

              <label className="flex items-center gap-2 text-sm text-ace-muted cursor-pointer">
                <input type="checkbox" checked={subForm.is_tax_deductible} onChange={e => setSubForm(f => ({ ...f, is_tax_deductible: e.target.checked }))}
                  className="w-4 h-4 rounded accent-ace-cyan" />
                Tax-deductible
              </label>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowSubModal(false)} className="flex-1 py-2 text-sm border border-ace-border rounded-lg text-ace-muted hover:text-white transition-colors">Cancel</button>
              <button onClick={handleSubSave} disabled={subSaving || !subForm.name || !subForm.amount || !subForm.next_billing_date}
                className="flex-1 py-2 text-sm bg-gradient-to-r from-ace-cyan to-ace-purple text-white rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
                {subSaving ? 'Saving…' : 'Create Subscription'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
