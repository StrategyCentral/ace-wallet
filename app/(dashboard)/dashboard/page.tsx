'use client'
import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

interface Transaction { id: number; type: string; amount: number; description: string; date: string; scope: string; business_id: number | null; category_name?: string; color?: string }
interface UpcomingBill { id: number; description: string; amount: number; currency: string; type: string; recur_interval: string; next_due_date: string; days_until: number; color: string; category_name: string; scope: string; business_name: string }
interface Subscription { id: number; name: string; amount: number; currency: string; billing_cycle: string; next_billing_date: string; color: string; status: string; scope: string }
interface Business { id: number; name: string; color: string; currency: string }
interface Account { id: number; name: string; balance: number; currency: string; account_type: string; color: string }

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function DashboardPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [upcomingBills, setUpcomingBills] = useState<UpcomingBill[]>([])
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [tr, sr, br, ar, ur] = await Promise.all([
      fetch('/api/transactions'),
      fetch('/api/subscriptions'),
      fetch('/api/businesses'),
      fetch('/api/accounts'),
      fetch('/api/transactions/upcoming'),
    ])
    const [td, sd, bd, ad, ud] = await Promise.all([tr.json(), sr.json(), br.json(), ar.json(), ur.json()])
    setTransactions(td.transactions || [])
    setSubscriptions(sd.subscriptions || [])
    setBusinesses(bd.businesses || [])
    setAccounts(ad.accounts || [])
    setUpcomingBills(ud.upcoming || [])
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

  const expensePie: Record<string, { total: number; color: string }> = {}
  monthPersonal.filter(t => t.type === 'expense').forEach(t => {
    const cat = t.category_name || 'Other'
    if (!expensePie[cat]) expensePie[cat] = { total: 0, color: t.color || '#8b5cf6' }
    expensePie[cat].total += t.amount
  })
  const pieData = Object.entries(expensePie).map(([name, v]) => ({ name, value: v.total, color: v.color })).sort((a, b) => b.value - a.value).slice(0, 6)

  const businessSummaries = businesses.map(b => {
    const bizTx = transactions.filter(t => t.business_id === b.id && t.date?.startsWith(currentMonth))
    const income = bizTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expenses = bizTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    return { ...b, income, expenses, profit: income - expenses }
  })

  // Merge upcoming recurring bills + subscriptions into one list
  const upcomingSubscriptions = subscriptions
    .filter(s => s.status === 'active')
    .map(s => {
      const due = new Date(s.next_billing_date)
      const daysUntil = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      return { id: `sub-${s.id}`, name: s.name, amount: s.amount, currency: s.currency,
        interval: s.billing_cycle, next_due_date: s.next_billing_date, days_until: daysUntil,
        color: s.color, type: 'subscription' as const, scope: s.scope }
    })
    .filter(s => s.days_until <= 60)

  const upcomingRecurring = upcomingBills.map(b => ({
    id: `tx-${b.id}`, name: b.description, amount: b.amount, currency: b.currency,
    interval: b.recur_interval, next_due_date: b.next_due_date, days_until: b.days_until,
    color: b.color || '#8b5cf6', type: b.type as 'income' | 'expense', scope: b.scope
  }))

  const allUpcoming = [...upcomingSubscriptions, ...upcomingRecurring]
    .sort((a, b) => a.days_until - b.days_until)
    .slice(0, 8)

  const totalAccountBalance = accounts.reduce((s, a) => s + a.balance, 0)
  const personalBalance = accounts.filter(a => a.account_type === 'personal').reduce((s, a) => s + a.balance, 0)
  const businessBalance = accounts.filter(a => a.account_type === 'business').reduce((s, a) => s + a.balance, 0)

  const fmt = (n: number, cur = 'AUD') => `${cur} ${Math.abs(n).toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

  function daysBadge(days: number) {
    if (days <= 0) return <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">Today</span>
    if (days <= 3) return <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">{days}d</span>
    if (days <= 7) return <span className="text-xs px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">{days}d</span>
    if (days <= 14) return <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">{days}d</span>
    return <span className="text-xs px-1.5 py-0.5 rounded bg-white/5 text-ace-muted border border-ace-border">{days}d</span>
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen text-ace-muted">Loading…</div>

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Overview</h1>
        <p className="text-ace-muted text-sm">{MONTH_NAMES[now.getMonth()]} {now.getFullYear()}</p>
      </div>

      {/* Net Worth bar */}
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
              <div key={a.id} className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
                style={{ backgroundColor: a.color + '15', border: `1px solid ${a.color}30`, color: a.color }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: a.color }} />
                {a.name}: {fmt(a.balance, a.currency)}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Personal KPIs */}
      <div>
        <h2 className="text-ace-muted text-xs font-semibold uppercase tracking-wider mb-3">Personal — This Month</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Income', value: fmt(personalIncome), color: 'text-green-400', sub: 'this month' },
            { label: 'Expenses', value: fmt(personalExpenses), color: 'text-red-400', sub: 'this month' },
            { label: 'Net Savings', value: (personalSavings < 0 ? '-' : '') + fmt(personalSavings), color: personalSavings >= 0 ? 'text-ace-cyan' : 'text-red-400', sub: 'this month' },
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
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold" style={{ backgroundColor: b.color + '20', color: b.color }}>{b.name[0]}</div>
                  <h3 className="text-white font-semibold text-sm">{b.name}</h3>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div><p className="text-ace-muted">Revenue</p><p className="text-green-400 font-semibold">{fmt(b.income, b.currency)}</p></div>
                  <div><p className="text-ace-muted">Expenses</p><p className="text-red-400 font-semibold">{fmt(b.expenses, b.currency)}</p></div>
                  <div><p className="text-ace-muted">Profit</p><p className={`font-semibold ${b.profit >= 0 ? 'text-ace-cyan' : 'text-red-400'}`}>{(b.profit < 0 ? '-' : '') + fmt(b.profit, b.currency)}</p></div>
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

      {/* Upcoming Bills — full width */}
      <div className="bg-ace-card border border-ace-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">Upcoming Bills</h3>
          <span className="text-ace-muted text-xs">Next 60 days</span>
        </div>
        {allUpcoming.length === 0 ? (
          <p className="text-ace-muted text-sm">No upcoming bills. Add recurring transactions or subscriptions to see them here.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {allUpcoming.map(item => (
              <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-ace-bg border border-ace-border">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: item.type === 'income' ? '#10b981' : item.type === 'subscription' ? item.color : '#ef4444' }} />
                  <div className="min-w-0">
                    <p className="text-white text-xs font-medium truncate">{item.name}</p>
                    <p className="text-ace-muted text-xs">{item.next_due_date} · {item.interval}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-2">
                  <span className={`text-xs font-semibold ${item.type === 'income' ? 'text-green-400' : 'text-red-400'}`}>
                    {item.type === 'income' ? '+' : '-'}{item.currency} {item.amount.toLocaleString()}
                  </span>
                  {daysBadge(item.days_until)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
    </div>
  )
}
