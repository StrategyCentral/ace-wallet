'use client'
import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

interface Transaction { id: number; type: string; amount: number; description: string; date: string; scope: string; business_id: number | null; category_name?: string; color?: string }
interface Subscription { id: number; name: string; amount: number; currency: string; billing_cycle: string; next_billing_date: string; color: string; status: string; scope: string }
interface Business { id: number; name: string; color: string; currency: string }
interface Account { id: number; name: string; balance: number; currency: string; account_type: string; color: string }
interface Stream { id: number; name: string; color: string }

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function DashboardPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [streams, setStreams] = useState<Stream[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [tr, sr, br, ar, stmr] = await Promise.all([
      fetch('/api/transactions'),
      fetch('/api/subscriptions'),
      fetch('/api/businesses'),
      fetch('/api/accounts'),
      fetch('/api/income-streams'),
    ])
    const [td, sd, bd, ad, stmd] = await Promise.all([tr.json(), sr.json(), br.json(), ar.json(), stmr.json()])
    setTransactions(td.transactions || [])
    setSubscriptions(sd.subscriptions || [])
    setBusinesses(bd.businesses || [])
    setAccounts(ad.accounts || [])
    setStreams(stmd.streams || [])
    setLoading(false)
  }

  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const personalTx = transactions.filter(t => t.scope === 'personal' || !t.scope)
  const monthPersonal = personalTx.filter(t => t.date?.startsWith(currentMonth))
  const personalIncome = monthPersonal.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const personalExpenses = monthPersonal.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const personalSavings = personalIncome - personalExpenses
  const savingsRate = personalIncome > 0 ? (personalSavings / personalIncome) * 100 : 0

  // Build 6-month trend for personal
  const trendData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const monthTx = personalTx.filter(t => t.date?.startsWith(key))
    return {
      name: MONTH_NAMES[d.getMonth()],
      income: monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
      expenses: monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    }
  })

  // Expense pie
  const expensePie: Record<string, { total: number; color: string }> = {}
  monthPersonal.filter(t => t.type === 'expense').forEach(t => {
    const cat = t.category_name || 'Other'
    if (!expensePie[cat]) expensePie[cat] = { total: 0, color: t.color || '#8b5cf6' }
    expensePie[cat].total += t.amount
  })
  const pieData = Object.entries(expensePie).map(([name, v]) => ({ name, value: v.total, color: v.color })).sort((a, b) => b.value - a.value).slice(0, 6)

  // Upcoming subscriptions
  const upcoming = subscriptions.filter(s => s.status === 'active').sort((a, b) => new Date(a.next_billing_date).getTime() - new Date(b.next_billing_date).getTime()).slice(0, 5)

  // Business summaries
  const businessSummaries = businesses.map(b => {
    const bizTx = transactions.filter(t => t.business_id === b.id && t.date?.startsWith(currentMonth))
    const income = bizTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expenses = bizTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    return { ...b, income, expenses, profit: income - expenses }
  })

  const totalAccountBalance = accounts.reduce((s, a) => s + a.balance, 0)
  const personalBalance = accounts.filter(a => a.account_type === 'personal').reduce((s, a) => s + a.balance, 0)
  const businessBalance = accounts.filter(a => a.account_type === 'business').reduce((s, a) => s + a.balance, 0)

  const fmt = (n: number, cur = 'AUD') => `${cur} ${Math.abs(n).toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

  if (loading) return <div className="flex items-center justify-center min-h-screen text-ace-muted">Loading…</div>

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Overview</h1>
        <p className="text-ace-muted text-sm">{MONTH_NAMES[now.getMonth()]} {now.getFullYear()}</p>
      </div>

      {/* Total balance bar */}
      <div className="bg-ace-card border border-ace-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white font-semibold">Net Worth</h2>
          <p className="text-2xl font-bold text-ace-cyan">{fmt(totalAccountBalance)}</p>
        </div>
        <div className="flex gap-4 text-sm">
          <span className="text-ace-muted">Personal: <span className="text-white font-medium">{fmt(personalBalance)}</span></span>
          {businesses.length > 0 && <span className="text-ace-muted">Business: <span className="text-white font-medium">{fmt(businessBalance)}</span></span>}
        </div>
        {accounts.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {accounts.map(a => (
              <div key={a.id} className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full" style={{ backgroundColor: a.color + '15', border: `1px solid ${a.color}30`, color: a.color }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: a.color }} />
                {a.name}: {fmt(a.balance, a.currency)}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Personal KPI cards */}
      <div>
        <h2 className="text-ace-muted text-xs font-semibold uppercase tracking-wider mb-3">Personal — This Month</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Income', value: fmt(personalIncome), color: 'text-green-400', sub: 'this month' },
            { label: 'Expenses', value: fmt(personalExpenses), color: 'text-red-400', sub: 'this month' },
            { label: 'Net Savings', value: (personalSavings >= 0 ? '' : '-') + fmt(personalSavings), color: personalSavings >= 0 ? 'text-ace-cyan' : 'text-red-400', sub: 'this month' },
            { label: 'Savings Rate', value: `${savingsRate.toFixed(0)}%`, color: savingsRate >= 20 ? 'text-green-400' : savingsRate >= 10 ? 'text-yellow-400' : 'text-red-400', sub: 'of income' },
          ].map(k => (
            <div key={k.label} className="bg-ace-card border border-ace-border rounded-xl p-4">
              <p className="text-ace-muted text-xs mb-1">{k.label}</p>
              <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
              <p className="text-ace-muted text-xs mt-0.5">{k.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Business panels */}
      {businesses.length > 0 && (
        <div>
          <h2 className="text-ace-muted text-xs font-semibold uppercase tracking-wider mb-3">Business — This Month</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {businessSummaries.map(b => (
              <div key={b.id} className="bg-ace-card border border-ace-border rounded-xl p-4" style={{ borderLeftColor: b.color, borderLeftWidth: 3 }}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold" style={{ backgroundColor: b.color + '20', color: b.color }}>
                    {b.name[0]}
                  </div>
                  <h3 className="text-white font-semibold text-sm">{b.name}</h3>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-ace-muted">Revenue</p>
                    <p className="text-green-400 font-semibold">{fmt(b.income, b.currency)}</p>
                  </div>
                  <div>
                    <p className="text-ace-muted">Expenses</p>
                    <p className="text-red-400 font-semibold">{fmt(b.expenses, b.currency)}</p>
                  </div>
                  <div>
                    <p className="text-ace-muted">Profit</p>
                    <p className={`font-semibold ${b.profit >= 0 ? 'text-ace-cyan' : 'text-red-400'}`}>{(b.profit < 0 ? '-' : '') + fmt(b.profit, b.currency)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts row */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-ace-card border border-ace-border rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4">6-Month Trend (Personal)</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={trendData}>
              <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} labelStyle={{ color: '#fff' }} />
              <Line type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2} dot={false} name="Income" />
              <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} dot={false} name="Expenses" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-ace-card border border-ace-border rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4">Expenses</h3>
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={35} outerRadius={60} dataKey="value" paddingAngle={2}>
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} formatter={(v: number) => [`AUD ${v.toLocaleString()}`, '']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1 mt-2">
                {pieData.slice(0, 4).map(d => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} /><span className="text-ace-muted">{d.name}</span></div>
                    <span className="text-white">AUD {d.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </>
          ) : <p className="text-ace-muted text-sm text-center py-8">No expenses this month</p>}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent transactions */}
        <div className="bg-ace-card border border-ace-border rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4">Recent Transactions</h3>
          {transactions.slice(0, 6).length === 0
            ? <p className="text-ace-muted text-sm">No transactions yet</p>
            : <div className="space-y-2">
                {transactions.slice(0, 6).map(t => (
                  <div key={t.id} className="flex items-center justify-between py-1.5 border-b border-ace-border last:border-0">
                    <div>
                      <p className="text-white text-sm">{t.description}</p>
                      <p className="text-ace-muted text-xs">{t.date} {t.scope === 'business' && <span className="text-ace-purple">• biz</span>}</p>
                    </div>
                    <span className={`font-semibold text-sm ${t.type === 'income' ? 'text-green-400' : 'text-red-400'}`}>
                      {t.type === 'income' ? '+' : '-'}AUD {t.amount.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
          }
        </div>

        {/* Upcoming subscriptions */}
        <div className="bg-ace-card border border-ace-border rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4">Upcoming Bills</h3>
          {upcoming.length === 0
            ? <p className="text-ace-muted text-sm">No subscriptions set up</p>
            : <div className="space-y-2">
                {upcoming.map(s => {
                  const due = new Date(s.next_billing_date)
                  const days = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                  return (
                    <div key={s.id} className="flex items-center justify-between py-1.5 border-b border-ace-border last:border-0">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                        <div>
                          <p className="text-white text-sm">{s.name}</p>
                          <p className="text-ace-muted text-xs">{days <= 0 ? 'Due today' : `${days}d`} • {s.billing_cycle} {s.scope === 'business' && <span className="text-ace-purple">• biz</span>}</p>
                        </div>
                      </div>
                      <span className="text-red-400 font-semibold text-sm">{s.currency} {s.amount.toLocaleString()}</span>
                    </div>
                  )
                })}
              </div>
          }
        </div>
      </div>
    </div>
  )
}
