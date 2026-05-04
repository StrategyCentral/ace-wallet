'use client'
import { useEffect, useState, useMemo } from 'react'

interface Debt {
  id: number; name: string; type: string; balance: number; original_balance: number
  interest_rate: number; minimum_payment: number; due_day: number; lender: string
  color: string; is_paid_off: number; paid_off_date: string
}

const DEBT_TYPES = [
  { value: 'credit_card', label: '💳 Credit Card' },
  { value: 'personal_loan', label: '💰 Personal Loan' },
  { value: 'car_loan', label: '🚗 Car Loan' },
  { value: 'student_loan', label: '🎓 Student Loan' },
  { value: 'mortgage', label: '🏠 Mortgage' },
  { value: 'buy_now_pay_later', label: '🛍️ Buy Now Pay Later' },
  { value: 'medical', label: '🏥 Medical' },
  { value: 'other', label: '📋 Other' },
]

const DEBT_COLORS = ['#ef4444','#f97316','#f59e0b','#ec4899','#a855f7','#06b6d4','#64748b','#84cc16']

const defaultForm = { name: '', type: 'credit_card', balance: '', interest_rate: '', minimum_payment: '', due_day: '1', lender: '', color: '#ef4444' }

// Domino snowball calculator
function calcDomino(debts: Debt[], monthlyAttack: number) {
  if (debts.length === 0 || monthlyAttack <= 0) return []

  // Sort smallest balance first (domino order)
  const sorted = [...debts].filter(d => !d.is_paid_off).sort((a, b) => a.balance - b.balance)
  if (sorted.length === 0) return []

  // Clone balances
  const state = sorted.map(d => ({
    id: d.id, name: d.name, color: d.color, interest_rate: d.interest_rate,
    balance: d.balance, minimum_payment: d.minimum_payment,
    paidOffMonth: 0, interestPaid: 0,
  }))

  let month = 0
  let availableAttack = monthlyAttack
  const MAX_MONTHS = 600 // 50 years cap

  while (state.some(d => d.balance > 0) && month < MAX_MONTHS) {
    month++

    // Apply interest to all remaining debts
    state.forEach(d => {
      if (d.balance > 0) {
        const monthlyRate = d.interest_rate / 100 / 12
        const interest = d.balance * monthlyRate
        d.balance += interest
        d.interestPaid += interest
      }
    })

    // Pay minimums on all, then attack smallest
    let remainingAttack = availableAttack
    state.forEach((d, i) => {
      if (d.balance <= 0) return
      const isFirst = state.findIndex(x => x.balance > 0) === i
      const payment = isFirst ? Math.min(d.balance, Math.max(d.minimum_payment, remainingAttack)) : Math.min(d.balance, d.minimum_payment)
      d.balance = Math.max(0, d.balance - payment)
      if (isFirst) remainingAttack -= payment
    })

    // Check payoffs
    state.forEach(d => {
      if (d.balance <= 0 && d.paidOffMonth === 0) {
        d.paidOffMonth = month
        // Free up minimum payment for next debt
        availableAttack += d.minimum_payment
      }
    })
  }

  return state.map(d => ({ ...d, paidOffMonth: d.paidOffMonth || month }))
}

export default function DebtsPage() {
  const [debts, setDebts] = useState<Debt[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Debt | null>(null)
  const [form, setForm] = useState(defaultForm)
  const [loading, setLoading] = useState(false)
  const [monthlyAttack, setMonthlyAttack] = useState('')
  const [activeDebt, setActiveDebt] = useState<number | null>(null)

  useEffect(() => { fetchDebts() }, [])

  async function fetchDebts() {
    const res = await fetch('/api/debts')
    const data = await res.json()
    setDebts(data.debts || [])
  }

  function openAdd() { setEditing(null); setForm(defaultForm); setShowModal(true) }
  function openEdit(d: Debt) {
    setEditing(d)
    setForm({ name: d.name, type: d.type, balance: String(d.balance), interest_rate: String(d.interest_rate),
      minimum_payment: String(d.minimum_payment), due_day: String(d.due_day), lender: d.lender || '', color: d.color })
    setShowModal(true)
  }

  async function handleSave() {
    setLoading(true)
    const body = {
      ...form, balance: parseFloat(form.balance) || 0, interest_rate: parseFloat(form.interest_rate) || 0,
      minimum_payment: parseFloat(form.minimum_payment) || 0, due_day: parseInt(form.due_day) || 1,
      ...(editing ? { id: editing.id } : {})
    }
    await fetch('/api/debts', { method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setShowModal(false); fetchDebts(); setLoading(false)
  }

  async function markPaidOff(d: Debt) {
    await fetch('/api/debts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...d, id: d.id, is_paid_off: 1 }) })
    fetchDebts()
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this debt?')) return
    await fetch('/api/debts', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    fetchDebts()
  }

  const activeDebts = debts.filter(d => !d.is_paid_off).sort((a, b) => a.balance - b.balance)
  const paidDebts = debts.filter(d => d.is_paid_off)

  const totalDebt = activeDebts.reduce((s, d) => s + d.balance, 0)
  const totalMin = activeDebts.reduce((s, d) => s + d.minimum_payment, 0)
  const attack = parseFloat(monthlyAttack) || 0

  // Run the domino calculator
  const dominoResult = useMemo(() => calcDomino(activeDebts, attack), [activeDebts, attack])

  const now = new Date()
  function payoffDate(months: number) {
    const d = new Date(now.getFullYear(), now.getMonth() + months, 1)
    return d.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })
  }

  const totalInterestSaved = dominoResult.reduce((s, d) => s + d.interestPaid, 0)
  const debtFreeMonth = dominoResult.reduce((max, d) => Math.max(max, d.paidOffMonth), 0)

  const typeLabel = (type: string) => DEBT_TYPES.find(t => t.value === type)?.label || type

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Debts</h1>
          <p className="text-ace-muted text-sm mt-1">Domino debt strategy — smallest first, snowball the payments</p>
        </div>
        <button onClick={openAdd} className="px-4 py-2 bg-red-500 text-white rounded-lg font-semibold text-sm hover:bg-red-600 transition-colors">+ Add Debt</button>
      </div>

      {/* Summary KPIs */}
      {activeDebts.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Debt', value: `AUD ${totalDebt.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`, color: 'text-red-400' },
            { label: 'Debts Active', value: String(activeDebts.length), color: 'text-orange-400' },
            { label: 'Min. Payments', value: `AUD ${totalMin.toLocaleString('en-AU', { maximumFractionDigits: 0 })}/mo`, color: 'text-white' },
            { label: 'Paid Off', value: String(paidDebts.length), color: 'text-green-400' },
          ].map(k => (
            <div key={k.label} className="bg-ace-card border border-ace-border rounded-xl p-4">
              <p className="text-ace-muted text-xs mb-1">{k.label}</p>
              <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left: Debt list */}
        <div>
          <h2 className="text-white font-semibold mb-3">Your Debts — Domino Order</h2>
          {activeDebts.length === 0 ? (
            <div className="bg-ace-card border border-ace-border rounded-xl p-8 text-center text-ace-muted">
              <div className="text-4xl mb-3">🎉</div>
              <p className="font-medium text-white">No active debts!</p>
              <p className="text-sm mt-1">Add debts to use the Domino calculator</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeDebts.map((d, i) => {
                const progress = d.original_balance > 0 ? ((d.original_balance - d.balance) / d.original_balance) * 100 : 0
                const result = dominoResult.find(r => r.id === d.id)
                const isTarget = i === 0 // smallest = current domino target
                return (
                  <div key={d.id}
                    className={`bg-ace-card border rounded-xl p-4 cursor-pointer transition-all ${isTarget ? 'border-red-500/50 shadow-lg shadow-red-500/10' : 'border-ace-border'}`}
                    onClick={() => setActiveDebt(activeDebt === d.id ? null : d.id)}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${isTarget ? 'bg-red-500 text-white' : 'bg-white/10 text-ace-muted'}`}>
                          {i + 1}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-white font-semibold text-sm">{d.name}</h3>
                            {isTarget && <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">🎯 Target</span>}
                          </div>
                          <p className="text-ace-muted text-xs">{typeLabel(d.type)}{d.lender ? ` · ${d.lender}` : ''}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-red-400 font-bold">AUD {d.balance.toLocaleString('en-AU', { maximumFractionDigits: 0 })}</p>
                        <p className="text-ace-muted text-xs">{d.interest_rate}% p.a.</p>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-2">
                      <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, backgroundColor: d.color }} />
                    </div>
                    <div className="flex justify-between text-xs text-ace-muted mb-3">
                      <span>{progress.toFixed(0)}% paid off</span>
                      <span>Started: AUD {d.original_balance.toLocaleString('en-AU', { maximumFractionDigits: 0 })}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex gap-3 text-xs text-ace-muted">
                        <span>Min: <span className="text-white">AUD {d.minimum_payment}/mo</span></span>
                        {result && attack > 0 && <span>Done: <span className="text-green-400">{payoffDate(result.paidOffMonth)}</span></span>}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={e => { e.stopPropagation(); openEdit(d) }} className="text-xs px-2 py-1 border border-ace-border rounded text-ace-muted hover:text-white transition-colors">Edit</button>
                        <button onClick={e => { e.stopPropagation(); markPaidOff(d) }} className="text-xs px-2 py-1 bg-green-500/10 border border-green-500/20 rounded text-green-400 hover:bg-green-500/20 transition-colors">✓ Paid off</button>
                        <button onClick={e => { e.stopPropagation(); handleDelete(d.id) }} className="text-xs px-2 py-1 border border-red-500/20 rounded text-red-400 hover:bg-red-500/10 transition-colors">Delete</button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Paid off debts */}
          {paidDebts.length > 0 && (
            <div className="mt-4">
              <h2 className="text-ace-muted text-xs uppercase tracking-wider mb-2">Conquered 🏆</h2>
              <div className="space-y-2">
                {paidDebts.map(d => (
                  <div key={d.id} className="flex items-center justify-between bg-green-500/5 border border-green-500/20 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-green-400">✓</span>
                      <div>
                        <p className="text-white text-sm">{d.name}</p>
                        <p className="text-ace-muted text-xs">Paid off {d.paid_off_date || ''} · Original: AUD {d.original_balance.toLocaleString('en-AU', { maximumFractionDigits: 0 })}</p>
                      </div>
                    </div>
                    <button onClick={() => handleDelete(d.id)} className="text-ace-muted hover:text-red-400 text-sm">×</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Domino calculator */}
        <div>
          <h2 className="text-white font-semibold mb-3">Domino Calculator</h2>
          <div className="bg-ace-card border border-ace-border rounded-xl p-5 mb-4">
            <p className="text-ace-muted text-sm mb-4">How much can you throw at debt each month? (your &quot;Fire Extinguisher&quot; payment — on top of minimums)</p>
            <div className="mb-4">
              <label className="text-ace-muted text-sm block mb-1">Monthly attack amount (AUD)</label>
              <input type="number" value={monthlyAttack} onChange={e => setMonthlyAttack(e.target.value)}
                placeholder={`Min required: AUD ${totalMin.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`}
                className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-ace-cyan" />
              {attack > 0 && attack < totalMin && (
                <p className="text-red-400 text-xs mt-1">⚠️ This is less than your total minimum payments (AUD {totalMin.toLocaleString('en-AU', { maximumFractionDigits: 0 })})</p>
              )}
            </div>

            {attack >= totalMin && dominoResult.length > 0 && (
              <>
                {/* Result summary */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-center">
                    <p className="text-green-400 text-xl font-bold">{payoffDate(debtFreeMonth)}</p>
                    <p className="text-ace-muted text-xs">Debt-free date</p>
                    <p className="text-green-400/70 text-xs">{debtFreeMonth} months away</p>
                  </div>
                  <div className="bg-ace-cyan/10 border border-ace-cyan/20 rounded-xl p-3 text-center">
                    <p className="text-ace-cyan text-xl font-bold">AUD {totalInterestSaved.toLocaleString('en-AU', { maximumFractionDigits: 0 })}</p>
                    <p className="text-ace-muted text-xs">Est. interest paid</p>
                  </div>
                </div>

                {/* Domino timeline */}
                <h3 className="text-white font-medium text-sm mb-3">Domino payoff order</h3>
                <div className="space-y-2">
                  {dominoResult.map((r, i) => {
                    const debt = activeDebts.find(d => d.id === r.id)
                    if (!debt) return null
                    return (
                      <div key={r.id} className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ backgroundColor: debt.color + '30', color: debt.color }}>{i + 1}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-white font-medium truncate">{r.name}</span>
                            <span className="text-green-400 flex-shrink-0 ml-2">{payoffDate(r.paidOffMonth)}</span>
                          </div>
                          <div className="h-1.5 bg-white/10 rounded-full mt-1 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${(r.paidOffMonth / debtFreeMonth) * 100}%`, backgroundColor: debt.color }} />
                          </div>
                        </div>
                        {i < dominoResult.length - 1 && (
                          <div className="text-ace-muted text-xs flex-shrink-0">→ frees AUD {debt.minimum_payment}/mo</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {activeDebts.length === 0 && (
              <div className="text-center py-6 text-ace-muted text-sm">
                Add your debts on the left to see the Domino plan
              </div>
            )}
          </div>

          {/* How it works */}
          <div className="bg-ace-purple/5 border border-ace-purple/20 rounded-xl p-4">
            <h3 className="text-white font-semibold text-sm mb-3">How the Domino strategy works</h3>
            <ol className="space-y-2 text-xs text-ace-muted">
              <li className="flex gap-2"><span className="text-ace-purple font-bold">1.</span>List all debts — smallest balance to largest</li>
              <li className="flex gap-2"><span className="text-ace-purple font-bold">2.</span>Make minimum payments on every debt</li>
              <li className="flex gap-2"><span className="text-ace-purple font-bold">3.</span>Throw every spare dollar at the smallest debt</li>
              <li className="flex gap-2"><span className="text-ace-purple font-bold">4.</span>When it&apos;s gone, roll that freed-up payment onto the next one</li>
              <li className="flex gap-2"><span className="text-ace-purple font-bold">5.</span>Payments grow like dominoes — each debt falls faster than the last</li>
            </ol>
            <p className="text-ace-purple text-xs mt-3 font-medium">Named the &quot;Fire Extinguisher&quot; by Scott Pape — put it out before it burns you.</p>
          </div>
        </div>
      </div>

      {/* Add/Edit modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-ace-card border border-ace-border rounded-xl p-6 w-full max-w-md">
            <h2 className="text-white font-bold text-lg mb-5">{editing ? 'Edit Debt' : 'Add Debt'}</h2>
            <div className="space-y-4">
              <div>
                <label className="text-ace-muted text-sm block mb-1">Debt Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. ANZ Credit Card"
                  className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-ace-muted text-sm block mb-1">Type</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                    className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan">
                    {DEBT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-ace-muted text-sm block mb-1">Lender</label>
                  <input value={form.lender} onChange={e => setForm(f => ({ ...f, lender: e.target.value }))} placeholder="e.g. ANZ"
                    className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-ace-muted text-sm block mb-1">Balance (AUD) *</label>
                  <input type="number" value={form.balance} onChange={e => setForm(f => ({ ...f, balance: e.target.value }))} placeholder="5000"
                    className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan" />
                </div>
                <div>
                  <label className="text-ace-muted text-sm block mb-1">Interest % p.a.</label>
                  <input type="number" value={form.interest_rate} onChange={e => setForm(f => ({ ...f, interest_rate: e.target.value }))} placeholder="19.9"
                    className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan" />
                </div>
                <div>
                  <label className="text-ace-muted text-sm block mb-1">Min. Payment *</label>
                  <input type="number" value={form.minimum_payment} onChange={e => setForm(f => ({ ...f, minimum_payment: e.target.value }))} placeholder="150"
                    className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan" />
                </div>
              </div>
              <div>
                <label className="text-ace-muted text-sm block mb-2">Colour</label>
                <div className="flex gap-2">
                  {DEBT_COLORS.map(c => (
                    <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${form.color === c ? 'border-white scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2 text-sm border border-ace-border rounded-lg text-ace-muted hover:text-white transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={loading || !form.name || !form.balance || !form.minimum_payment}
                className="flex-1 py-2 text-sm bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-colors disabled:opacity-50">
                {loading ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
