'use client'
import { useEffect, useState } from 'react'

interface Account { id: number; name: string; balance: number; currency: string; color: string; account_type: string }
interface Assignment { account_id: number; bucket: string; account_name: string; balance: number; currency: string; account_color: string; account_kind: string }

const BUCKETS = [
  {
    id: 'blow',
    name: 'Blow',
    emoji: '💸',
    target: 60,
    color: '#f59e0b',
    desc: 'Everyday life — bills, groceries, fun money',
    sub: [
      { id: 'blow_daily', name: 'Daily Expenses', desc: 'Bills, groceries, transport, subscriptions', icon: '🏠' },
      { id: 'blow_splurge', name: 'Splurge', desc: 'Your fun money — no guilt, blow it all', icon: '🎉' },
    ]
  },
  {
    id: 'mojo',
    name: 'Mojo',
    emoji: '🛡️',
    target: 20,
    color: '#00d4ff',
    desc: 'Security — emergency fund and goal savings',
    sub: [
      { id: 'mojo_smile', name: 'Smile', desc: 'Saving for something specific (holiday, car, home deposit)', icon: '😊' },
      { id: 'mojo_fire', name: 'Fire Extinguisher', desc: 'Emergency fund (3 months expenses) or debt blaster', icon: '🧯' },
    ]
  },
  {
    id: 'grow',
    name: 'Grow',
    emoji: '🌱',
    target: 20,
    color: '#10b981',
    desc: 'Long-term wealth — super and investments',
    sub: [
      { id: 'grow_super', name: 'Super', desc: 'Superannuation contributions (target 15%)', icon: '🏦' },
      { id: 'grow_invest', name: 'Invest', desc: 'Low-cost index funds for long-term wealth', icon: '📈' },
    ]
  },
]

const BUCKET_LABELS: Record<string, string> = {
  blow_daily: 'Daily Expenses', blow_splurge: 'Splurge',
  mojo_smile: 'Smile', mojo_fire: 'Fire Extinguisher',
  grow_super: 'Super', grow_invest: 'Invest',
}

export default function BucketsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [totalIncome, setTotalIncome] = useState(0)
  const [incomeInput, setIncomeInput] = useState('')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [ar, br] = await Promise.all([fetch('/api/accounts'), fetch('/api/buckets')])
    const ad = await ar.json(); const bd = await br.json()
    setAccounts(ad.accounts || [])
    setAssignments(bd.assignments || [])
  }

  async function assignBucket(account_id: number, bucket: string) {
    await fetch('/api/buckets', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_id, bucket }) })
    fetchAll()
  }

  async function removeAssignment(account_id: number) {
    await fetch('/api/buckets', { method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_id }) })
    fetchAll()
  }

  const income = parseFloat(incomeInput) || totalIncome

  // Calculate totals per bucket group
  function bucketBalance(bucketIds: string[]) {
    return assignments.filter(a => bucketIds.includes(a.bucket)).reduce((s, a) => s + a.balance, 0)
  }

  const blowBal = bucketBalance(['blow_daily','blow_splurge'])
  const mojoBal = bucketBalance(['mojo_smile','mojo_fire'])
  const growBal = bucketBalance(['grow_super','grow_invest'])
  const totalBal = blowBal + mojoBal + growBal

  const unassigned = accounts.filter(a => !assignments.find(x => x.account_id === a.id))

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Buckets</h1>
        <p className="text-ace-muted text-sm mt-1">The Barefoot Investor bucket system — split every pay cheque across Blow, Mojo, and Grow</p>
      </div>

      {/* Income input for allocation targets */}
      <div className="bg-ace-card border border-ace-border rounded-xl p-5 mb-6">
        <h2 className="text-white font-semibold mb-3">Monthly Take-Home Pay</h2>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <input type="number" value={incomeInput} onChange={e => setIncomeInput(e.target.value)}
              placeholder="Enter your monthly take-home pay…"
              className="w-full bg-ace-bg border border-ace-border rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-ace-cyan" />
          </div>
          {income > 0 && (
            <div className="flex gap-4 text-sm">
              {BUCKETS.map(b => (
                <div key={b.id} className="text-center">
                  <p style={{ color: b.color }} className="font-bold">AUD {Math.round(income * b.target / 100).toLocaleString()}</p>
                  <p className="text-ace-muted text-xs">{b.name} ({b.target}%)</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* The three buckets */}
      <div className="grid md:grid-cols-3 gap-6 mb-6">
        {BUCKETS.map(bucket => {
          const bal = bucketBalance(bucket.sub.map(s => s.id))
          const pct = totalBal > 0 ? (bal / totalBal) * 100 : 0
          const targetAmt = income > 0 ? income * bucket.target / 100 : null
          const bucketAssignments = assignments.filter(a => bucket.sub.map(s => s.id).includes(a.bucket))

          return (
            <div key={bucket.id} className="bg-ace-card border border-ace-border rounded-xl overflow-hidden">
              {/* Bucket header */}
              <div className="p-4 border-b border-ace-border" style={{ backgroundColor: bucket.color + '10' }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{bucket.emoji}</span>
                    <div>
                      <h3 className="text-white font-bold">{bucket.name}</h3>
                      <p className="text-xs" style={{ color: bucket.color }}>Target: {bucket.target}%</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-bold text-lg">AUD {bal.toLocaleString()}</p>
                    <p className="text-xs text-ace-muted">{pct.toFixed(0)}% of total</p>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct / bucket.target * 100, 100)}%`, backgroundColor: bucket.color }} />
                </div>
                {targetAmt && (
                  <p className="text-xs text-ace-muted mt-1">
                    Target: AUD {targetAmt.toLocaleString()} / month
                    {bal < targetAmt ? <span className="text-red-400"> (AUD {(targetAmt - bal).toLocaleString()} short)</span>
                      : <span className="text-green-400"> ✓</span>}
                  </p>
                )}
                <p className="text-xs text-ace-muted mt-1">{bucket.desc}</p>
              </div>

              {/* Sub-buckets */}
              <div className="p-4 space-y-4">
                {bucket.sub.map(sub => {
                  const subAssignments = assignments.filter(a => a.bucket === sub.id)
                  const subBal = subAssignments.reduce((s, a) => s + a.balance, 0)
                  return (
                    <div key={sub.id}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-base">{sub.icon}</span>
                        <div>
                          <p className="text-white text-sm font-medium">{sub.name}</p>
                          <p className="text-ace-muted text-xs">{sub.desc}</p>
                        </div>
                      </div>
                      {subAssignments.length > 0 && (
                        <div className="space-y-1 mb-2">
                          {subAssignments.map(a => (
                            <div key={a.account_id} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: a.account_color }} />
                                <span className="text-white text-xs">{a.account_name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-white text-xs font-medium">AUD {a.balance.toLocaleString()}</span>
                                <button onClick={() => removeAssignment(a.account_id)} className="text-ace-muted hover:text-red-400 text-xs transition-colors">×</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Assign account dropdown */}
                      {unassigned.length > 0 && (
                        <select onChange={e => { if (e.target.value) assignBucket(parseInt(e.target.value), sub.id); e.target.value = '' }}
                          className="w-full bg-ace-bg border border-ace-border rounded-lg px-2 py-1.5 text-ace-muted text-xs focus:outline-none focus:border-ace-cyan">
                          <option value="">+ Assign account…</option>
                          {unassigned.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Barefoot Steps */}
      <div className="bg-ace-card border border-ace-border rounded-xl p-5">
        <h2 className="text-white font-semibold mb-4">The 10 Barefoot Steps</h2>
        <div className="space-y-2">
          {[
            { n: 1, label: 'Schedule a Barefoot Date Night', done: false },
            { n: 2, label: 'Set up your bucket accounts (Blow / Mojo / Grow)', done: assignments.length > 0 },
            { n: 3, label: 'Domino your debts (smallest first)', done: false },
            { n: 4, label: 'Buy your home', done: false },
            { n: 5, label: 'Increase super contributions to 15%', done: false },
            { n: 6, label: 'Blast the mortgage', done: false },
            { n: 7, label: 'Get the kids sorted (savings + insurance)', done: false },
            { n: 8, label: 'Nail your retirement number', done: false },
            { n: 9, label: 'Have the money talk (parents, will, insurance)', done: false },
            { n: 10, label: 'Leave a legacy', done: false },
          ].map(s => (
            <div key={s.n} className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${s.done ? 'bg-green-500/10 border-green-500/20' : 'bg-white/3 border-ace-border'}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${s.done ? 'bg-green-500 text-black' : 'bg-ace-bg border border-ace-border text-ace-muted'}`}>
                {s.done ? '✓' : s.n}
              </div>
              <p className={`text-sm ${s.done ? 'text-green-300' : 'text-ace-muted'}`}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Unassigned accounts reminder */}
      {unassigned.length > 0 && (
        <div className="mt-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-sm text-yellow-300">
          <p className="font-medium mb-1">Unassigned accounts ({unassigned.length})</p>
          <p className="text-xs text-yellow-400/70">Assign these accounts to a bucket using the dropdowns above: {unassigned.map(a => a.name).join(', ')}</p>
        </div>
      )}
    </div>
  )
}
