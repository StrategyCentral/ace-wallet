'use client'
import { useEffect, useState, useMemo } from 'react'

interface Debt {
  id: number; name: string; type: string; balance: number; original_balance: number
  interest_rate: number; minimum_payment: number; due_day: number; lender: string
  color: string; is_paid_off: number; paid_off_date: string
  scope: string; business_id: number | null
  interest_free_months: number; annual_fee: number; monthly_fee: number
  fee_interest_rate: number; payment_allocation: string; promo_end_date: string
  accrued_fees: number
}
interface Business { id: number; name: string }

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

const defaultForm = {
  name: '', type: 'credit_card', balance: '', interest_rate: '', minimum_payment: '',
  due_day: '1', lender: '', color: '#ef4444', scope: 'personal', business_id: '',
  interest_free_months: '', annual_fee: '', monthly_fee: '', fee_interest_rate: '',
  payment_allocation: 'purchase_first', promo_end_date: '', accrued_fees: '',
}

// Enhanced Domino snowball calculator with fee-stacking logic
function calcDomino(debts: Debt[], monthlyAttack: number) {
  if (debts.length === 0 || monthlyAttack <= 0) return []
  const sorted = [...debts].filter(d => !d.is_paid_off).sort((a, b) => a.balance - b.balance)
  if (sorted.length === 0) return []

  const state = sorted.map(d => ({
    id: d.id, name: d.name, color: d.color,
    interest_rate: d.interest_rate,
    // Split balance into principal and accrued fees for fee-stacking debts
    principal: d.balance - (d.accrued_fees || 0),
    fees: d.accrued_fees || 0,
    minimum_payment: d.minimum_payment,
    monthly_fee: d.monthly_fee || 0,
    annual_fee: d.annual_fee || 0,
    fee_interest_rate: d.fee_interest_rate || 0,
    payment_allocation: d.payment_allocation || 'purchase_first',
    interest_free_months: d.interest_free_months || 0,
    paidOffMonth: 0,
    interestPaid: 0,
    feesPaid: 0,
    totalPaid: 0,
  }))

  let month = 0
  let availableAttack = monthlyAttack
  const MAX_MONTHS = 600

  while (state.some(d => (d.principal + d.fees) > 0.01) && month < MAX_MONTHS) {
    month++

    state.forEach(d => {
      if (d.principal + d.fees <= 0.01) return

      // Add monthly fee
      if (d.monthly_fee > 0) {
        d.fees += d.monthly_fee
        d.feesPaid += d.monthly_fee
      }
      // Add annual fee (once per 12 months)
      if (d.annual_fee > 0 && month % 12 === 0) {
        d.fees += d.annual_fee
        d.feesPaid += d.annual_fee
      }

      // Apply interest based on allocation type
      const monthlyRate = d.interest_rate / 100 / 12
      const feeRate = (d.fee_interest_rate > 0 ? d.fee_interest_rate : d.interest_rate) / 100 / 12

      if (month > d.interest_free_months) {
        // Interest on principal
        const principalInterest = d.principal * monthlyRate
        d.principal += principalInterest
        d.interestPaid += principalInterest
      }

      // Interest ALWAYS applies to fees (this is the Latitude trick)
      if (d.fees > 0) {
        const feeInterest = d.fees * feeRate
        d.fees += feeInterest
        d.interestPaid += feeInterest
      }
    })

    // Pay minimums on all, then attack smallest
    let remaining = availableAttack
    state.forEach((d, i) => {
      if (d.principal + d.fees <= 0.01) return
      const totalOwed = d.principal + d.fees
      const isTarget = state.findIndex(x => (x.principal + x.fees) > 0.01) === i
      const payment = isTarget ? Math.min(totalOwed, Math.max(d.minimum_payment, remaining)) : Math.min(totalOwed, d.minimum_payment)

      // Apply payment based on allocation strategy
      let applied = payment
      if (d.payment_allocation === 'purchase_first') {
        // Payments go to principal first, fees keep growing (the predatory way)
        const toPrincipal = Math.min(d.principal, applied)
        d.principal -= toPrincipal
        applied -= toPrincipal
        d.fees = Math.max(0, d.fees - applied)
      } else if (d.payment_allocation === 'fees_first') {
        const toFees = Math.min(d.fees, applied)
        d.fees -= toFees
        applied -= toFees
        d.principal = Math.max(0, d.principal - applied)
      } else {
        // Proportional
        const ratio = totalOwed > 0 ? d.principal / totalOwed : 0.5
        const toPrincipal = Math.min(d.principal, applied * ratio)
        const toFees = Math.min(d.fees, applied * (1 - ratio))
        d.principal -= toPrincipal
        d.fees -= toFees
      }

      d.totalPaid += payment
      if (isTarget) remaining -= payment
    })

    // Check payoffs
    state.forEach(d => {
      if ((d.principal + d.fees) <= 0.01 && d.paidOffMonth === 0) {
        d.paidOffMonth = month
        d.principal = 0
        d.fees = 0
        availableAttack += d.minimum_payment
      }
    })
  }

  return state.map(d => ({ ...d, balance: d.principal + d.fees, paidOffMonth: d.paidOffMonth || month }))
}

export default function DebtsPage() {
  const [debts, setDebts] = useState<Debt[]>([])
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [showModal, setShowModal] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [editing, setEditing] = useState<Debt | null>(null)
  const [form, setForm] = useState(defaultForm)
  const [loading, setLoading] = useState(false)
  const [monthlyAttack, setMonthlyAttack] = useState('')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [dr, br] = await Promise.all([fetch('/api/debts'), fetch('/api/businesses')])
    const [dd, bd] = await Promise.all([dr.json(), br.json()])
    setDebts(dd.debts || [])
    setBusinesses(bd.businesses || [])
  }

  function openAdd() { setEditing(null); setForm(defaultForm); setShowAdvanced(false); setShowModal(true) }
  function openEdit(d: Debt) {
    setEditing(d)
    setForm({
      name: d.name, type: d.type, balance: String(d.balance), interest_rate: String(d.interest_rate),
      minimum_payment: String(d.minimum_payment), due_day: String(d.due_day), lender: d.lender || '',
      color: d.color, scope: d.scope || 'personal', business_id: d.business_id ? String(d.business_id) : '',
      interest_free_months: d.interest_free_months ? String(d.interest_free_months) : '',
      annual_fee: d.annual_fee ? String(d.annual_fee) : '',
      monthly_fee: d.monthly_fee ? String(d.monthly_fee) : '',
      fee_interest_rate: d.fee_interest_rate ? String(d.fee_interest_rate) : '',
      payment_allocation: d.payment_allocation || 'purchase_first',
      promo_end_date: d.promo_end_date || '',
      accrued_fees: d.accrued_fees ? String(d.accrued_fees) : '',
    })
    setShowAdvanced(!!(d.monthly_fee || d.annual_fee || d.fee_interest_rate || d.interest_free_months))
    setShowModal(true)
  }

  async function handleSave() {
    setLoading(true)
    const body = {
      ...form,
      balance: parseFloat(form.balance) || 0,
      interest_rate: parseFloat(form.interest_rate) || 0,
      minimum_payment: parseFloat(form.minimum_payment) || 0,
      due_day: parseInt(form.due_day) || 1,
      business_id: form.scope === 'business' && form.business_id ? parseInt(form.business_id) : null,
      interest_free_months: parseInt(form.interest_free_months) || 0,
      annual_fee: parseFloat(form.annual_fee) || 0,
      monthly_fee: parseFloat(form.monthly_fee) || 0,
      fee_interest_rate: parseFloat(form.fee_interest_rate) || 0,
      accrued_fees: parseFloat(form.accrued_fees) || 0,
      ...(editing ? { id: editing.id } : {}),
    }
    await fetch('/api/debts', {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setShowModal(false); await fetchAll(); setLoading(false)
  }

  async function markPaidOff(d: Debt) {
    await fetch('/api/debts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...d, id: d.id, is_paid_off: 1 }) })
    fetchAll()
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this debt?')) return
    await fetch('/api/debts', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    fetchAll()
  }

  const activeDebts = debts.filter(d => !d.is_paid_off).sort((a, b) => a.balance - b.balance)
  const paidDebts = debts.filter(d => d.is_paid_off)

  const totalDebt = activeDebts.reduce((s, d) => s + d.balance, 0)
  const totalMin = activeDebts.reduce((s, d) => s + d.minimum_payment, 0)
  const attack = parseFloat(monthlyAttack) || 0

  const dominoResult = useMemo(() => calcDomino(activeDebts, attack), [activeDebts, attack])

  const now = new Date()
  function payoffDate(months: number) {
    const d = new Date(now.getFullYear(), now.getMonth() + months, 1)
    return d.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })
  }

  const totalInterest = dominoResult.reduce((s, d) => s + d.interestPaid, 0)
  const totalFees = dominoResult.reduce((s, d) => s + d.feesPaid, 0)
  const debtFreeMonth = dominoResult.reduce((max, d) => Math.max(max, d.paidOffMonth), 0)

  const typeLabel = (type: string) => DEBT_TYPES.find(t => t.value === type)?.label || type
  const hasFeeStacking = activeDebts.some(d => d.monthly_fee > 0 || d.annual_fee > 0 || d.accrued_fees > 0)

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
                const isTarget = i === 0
                const hasFees = (d.monthly_fee > 0 || d.annual_fee > 0 || d.accrued_fees > 0)
                return (
                  <div key={d.id}
                    className={`bg-ace-card border rounded-xl p-4 transition-all ${isTarget ? 'border-red-500/50 shadow-lg shadow-red-500/10' : 'border-ace-border'}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${isTarget ? 'bg-red-500 text-white' : 'bg-white/10 text-ace-muted'}`}>
                          {i + 1}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-white font-semibold text-sm">{d.name}</h3>
                            {isTarget && <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">🎯 Target</span>}
                            {d.scope === 'business' && <span className="text-xs px-1.5 py-0.5 rounded bg-ace-purple/20 text-ace-purple border border-ace-purple/30">Business</span>}
                          </div>
                          <p className="text-ace-muted text-xs">{typeLabel(d.type)}{d.lender ? ` · ${d.lender}` : ''}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-red-400 font-bold">AUD {d.balance.toLocaleString('en-AU', { maximumFractionDigits: 0 })}</p>
                        <p className="text-ace-muted text-xs">{d.interest_rate}% p.a.</p>
                      </div>
                    </div>

                    {/* Fee stacking warning */}
                    {hasFees && (
                      <div className="bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2 mb-3">
                        <p className="text-red-400 text-xs font-medium">⚠️ Fee-stacking debt</p>
                        <p className="text-ace-muted text-xs mt-0.5">
                          {d.monthly_fee > 0 && `$${d.monthly_fee}/mo fee `}
                          {d.annual_fee > 0 && `+ $${d.annual_fee}/yr fee `}
                          {d.accrued_fees > 0 && `· $${d.accrued_fees.toLocaleString()} in accrued fees `}
                          · Payments go to purchases first — fees compound at {d.fee_interest_rate || d.interest_rate}%
                        </p>
                      </div>
                    )}

                    {/* Progress bar */}
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-2">
                      <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(0, progress)}%`, backgroundColor: d.color }} />
                    </div>
                    <div className="flex justify-between text-xs text-ace-muted mb-3">
                      <span>{Math.max(0, progress).toFixed(0)}% paid off</span>
                      <span>Started: AUD {d.original_balance.toLocaleString('en-AU', { maximumFractionDigits: 0 })}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex gap-3 text-xs text-ace-muted">
                        <span>Min: <span className="text-white">AUD {d.minimum_payment}/mo</span></span>
                        {result && attack > 0 && <span>Done: <span className="text-green-400">{payoffDate(result.paidOffMonth)}</span></span>}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(d)} className="text-xs px-2 py-1 border border-ace-border rounded text-ace-muted hover:text-white transition-colors">Edit</button>
                        <button onClick={() => markPaidOff(d)} className="text-xs px-2 py-1 bg-green-500/10 border border-green-500/20 rounded text-green-400 hover:bg-green-500/20 transition-colors">✓ Paid off</button>
                        <button onClick={() => handleDelete(d.id)} className="text-xs px-2 py-1 border border-red-500/20 rounded text-red-400 hover:bg-red-500/10 transition-colors">Delete</button>
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
                <div className={`grid ${hasFeeStacking ? 'grid-cols-3' : 'grid-cols-2'} gap-3 mb-4`}>
                  <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-center">
                    <p className="text-green-400 text-xl font-bold">{payoffDate(debtFreeMonth)}</p>
                    <p className="text-ace-muted text-xs">Debt-free date</p>
                    <p className="text-green-400/70 text-xs">{debtFreeMonth} months away</p>
                  </div>
                  <div className="bg-ace-cyan/10 border border-ace-cyan/20 rounded-xl p-3 text-center">
                    <p className="text-ace-cyan text-xl font-bold">AUD {totalInterest.toLocaleString('en-AU', { maximumFractionDigits: 0 })}</p>
                    <p className="text-ace-muted text-xs">Est. interest paid</p>
                  </div>
                  {hasFeeStacking && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
                      <p className="text-red-400 text-xl font-bold">AUD {totalFees.toLocaleString('en-AU', { maximumFractionDigits: 0 })}</p>
                      <p className="text-ace-muted text-xs">Fees accumulating</p>
                    </div>
                  )}
                </div>

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

          {/* Fee stacking explainer */}
          {hasFeeStacking && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 mt-4">
              <h3 className="text-white font-semibold text-sm mb-2">⚠️ Fee-stacking debts detected</h3>
              <p className="text-ace-muted text-xs">
                Some of your debts (like Latitude/Gem Visa) charge monthly fees, annual fees, and late fees that <span className="text-red-400 font-medium">compound with interest</span>.
                Payments are applied to purchases first, so fees keep stacking and growing. The calculator accounts for this —
                focus extra payments on these debts to stop the bleeding.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ═══ Add/Edit Modal ═══ */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-ace-card border border-ace-border rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-white font-bold text-lg mb-5">{editing ? 'Edit Debt' : 'Add Debt'}</h2>
            <div className="space-y-4">
              <div>
                <label className="text-ace-muted text-sm block mb-1">Debt Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Latitude Gem Visa"
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-ace-muted text-sm block mb-1">Lender</label>
                  <input value={form.lender} onChange={e => setForm(f => ({ ...f, lender: e.target.value }))} placeholder="e.g. Latitude"
                    className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan" />
                </div>
                <div>
                  <label className="text-ace-muted text-sm block mb-1">Due Day</label>
                  <input type="number" value={form.due_day} onChange={e => setForm(f => ({ ...f, due_day: e.target.value }))} min="1" max="31"
                    className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-ace-muted text-sm block mb-1">Balance (AUD) *</label>
                  <input type="number" value={form.balance} onChange={e => setForm(f => ({ ...f, balance: e.target.value }))} placeholder="1195"
                    className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan" />
                </div>
                <div>
                  <label className="text-ace-muted text-sm block mb-1">Interest % p.a.</label>
                  <input type="number" value={form.interest_rate} onChange={e => setForm(f => ({ ...f, interest_rate: e.target.value }))} placeholder="26.44"
                    className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan" />
                </div>
                <div>
                  <label className="text-ace-muted text-sm block mb-1">Min. Payment *</label>
                  <input type="number" value={form.minimum_payment} onChange={e => setForm(f => ({ ...f, minimum_payment: e.target.value }))} placeholder="30"
                    className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan" />
                </div>
              </div>

              {/* Advanced fee-stacking fields */}
              <button onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-ace-orange text-sm font-medium flex items-center gap-1.5 hover:text-orange-300 transition-colors">
                {showAdvanced ? '▾' : '▸'} Advanced — Fee-stacking / Interest-free deals
              </button>

              {showAdvanced && (
                <div className="bg-ace-orange/5 border border-ace-orange/20 rounded-xl p-4 space-y-4">
                  <p className="text-ace-muted text-xs">For debts like Latitude Gem Visa, Afterpay, or 24-month interest-free purchases where fees and interest work against you.</p>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-ace-muted text-xs block mb-1">Monthly Fee</label>
                      <input type="number" value={form.monthly_fee} onChange={e => setForm(f => ({ ...f, monthly_fee: e.target.value }))} placeholder="1.25"
                        className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-orange" />
                    </div>
                    <div>
                      <label className="text-ace-muted text-xs block mb-1">Annual Fee</label>
                      <input type="number" value={form.annual_fee} onChange={e => setForm(f => ({ ...f, annual_fee: e.target.value }))} placeholder="99"
                        className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-orange" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-ace-muted text-xs block mb-1">Fee Interest Rate % (if different)</label>
                      <input type="number" value={form.fee_interest_rate} onChange={e => setForm(f => ({ ...f, fee_interest_rate: e.target.value }))} placeholder="Same as main rate"
                        className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-orange" />
                    </div>
                    <div>
                      <label className="text-ace-muted text-xs block mb-1">Accrued Fees ($)</label>
                      <input type="number" value={form.accrued_fees} onChange={e => setForm(f => ({ ...f, accrued_fees: e.target.value }))} placeholder="0"
                        className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-orange" />
                      <p className="text-ace-muted text-xs mt-0.5">Fees already stacked on the balance</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-ace-muted text-xs block mb-1">Interest-free Months</label>
                      <input type="number" value={form.interest_free_months} onChange={e => setForm(f => ({ ...f, interest_free_months: e.target.value }))} placeholder="0"
                        className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-orange" />
                    </div>
                    <div>
                      <label className="text-ace-muted text-xs block mb-1">Payment Allocation</label>
                      <select value={form.payment_allocation} onChange={e => setForm(f => ({ ...f, payment_allocation: e.target.value }))}
                        className="w-full bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-orange">
                        <option value="purchase_first">Purchases first (predatory)</option>
                        <option value="fees_first">Fees first (you wish)</option>
                        <option value="proportional">Proportional</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

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
