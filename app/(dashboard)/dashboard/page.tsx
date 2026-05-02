'use client'
import { useEffect, useState } from 'react'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

function KpiCard({ label, value, sub, color }: any) {
  return (
    <div className="bg-ace-card border border-ace-border rounded-xl p-5">
      <p className="text-ace-muted text-sm mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color || 'text-white'}`}>{value}</p>
      {sub && <p className="text-ace-muted text-xs mt-1">{sub}</p>}
    </div>
  )
}

const fmt = (n: number) => `$${Math.abs(n).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function DashboardPage() {
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [txns, setTxns] = useState<any[]>([])
  const [subs, setSubs] = useState<any[]>([])
  const [trendData, setTrendData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [t, s] = await Promise.all([
        fetch(`/api/transactions?month=${month}`).then(r => r.json()),
        fetch('/api/subscriptions?status=active').then(r => r.json()),
      ])
      setTxns(t || [])
      setSubs(s || [])

      // Build 6-month trend
      const trend = []
      for (let i = 5; i >= 0; i--) {
        const d = subMonths(new Date(), i)
        const m = format(d, 'yyyy-MM')
        const res = await fetch(`/api/transactions?month=${m}`).then(r => r.json())
        const inc = (res || []).filter((x: any) => x.type === 'income').reduce((a: number, x: any) => a + x.amount, 0)
        const exp = (res || []).filter((x: any) => x.type === 'expense').reduce((a: number, x: any) => a + x.amount, 0)
        trend.push({ month: format(d, 'MMM'), income: inc, expenses: exp, savings: inc - exp })
      }
      setTrendData(trend)
      setLoading(false)
    }
    load()
  }, [month])

  const income = txns.filter(t => t.type === 'income').reduce((a, t) => a + t.amount, 0)
  const expenses = txns.filter(t => t.type === 'expense').reduce((a, t) => a + t.amount, 0)
  const savings = income - expenses
  const savingsRate = income > 0 ? (savings / income) * 100 : 0

  // Category breakdown for pie
  const catMap: Record<string, number> = {}
  txns.filter(t => t.type === 'expense').forEach(t => {
    const n = t.category_name || 'Other'
    catMap[n] = (catMap[n] || 0) + t.amount
  })
  const pieData = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value }))
  const PIE_COLORS = ['#00d4ff', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#a855f7']

  // Monthly sub cost
  const subCost = subs.reduce((a: number, s: any) => {
    const mults: Record<string, number> = { weekly: 4.33, fortnightly: 2.17, monthly: 1, quarterly: 1/3, annually: 1/12 }
    return a + s.amount * (mults[s.billing_cycle] || 1)
  }, 0)

  // Upcoming subs
  const upcomingSubs = [...subs]
    .filter((s: any) => new Date(s.next_billing_date) <= new Date(Date.now() + 14 * 86400000))
    .sort((a: any, b: any) => a.next_billing_date.localeCompare(b.next_billing_date))
    .slice(0, 5)

  const recent = txns.slice(0, 8)

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Overview</h1>
          <p className="text-ace-muted text-sm">Your financial snapshot</p>
        </div>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)}
          className="bg-ace-card border border-ace-border text-ace-text rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-ace-cyan/50" />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard label="Total Income" value={fmt(income)} color="text-ace-green" sub={`${month}`} />
        <KpiCard label="Total Expenses" value={fmt(expenses)} color="text-ace-red" sub={`${txns.filter(t=>t.type==='expense').length} transactions`} />
        <KpiCard label="Net Savings" value={fmt(savings)} color={savings >= 0 ? 'text-ace-cyan' : 'text-ace-red'} sub={savings >= 0 ? 'On track' : 'Over budget'} />
        <KpiCard label="Savings Rate" value={`${savingsRate.toFixed(1)}%`} color="text-ace-purple" sub={`Monthly subs: ${fmt(subCost)}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Trend Chart */}
        <div className="lg:col-span-2 bg-ace-card border border-ace-border rounded-xl p-5">
          <h2 className="text-white font-semibold mb-4">6-Month Trend</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trendData}>
              <XAxis dataKey="month" stroke="#64748b" tick={{ fontSize: 12 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 12 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#12121e', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8 }}
                labelStyle={{ color: '#e2e8f0' }}
                formatter={(v: any) => [`$${Number(v).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`, '']}
              />
              <Line type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2} dot={false} name="Income" />
              <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} dot={false} name="Expenses" />
              <Line type="monotone" dataKey="savings" stroke="#00d4ff" strokeWidth={2} dot={false} name="Savings" strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex gap-6 mt-2 justify-center">
            {[['Income','#10b981'],['Expenses','#ef4444'],['Savings','#00d4ff']].map(([l,c]) => (
              <div key={l} className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 rounded" style={{ backgroundColor: c }} />
                <span className="text-ace-muted text-xs">{l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pie Chart */}
        <div className="bg-ace-card border border-ace-border rounded-xl p-5">
          <h2 className="text-white font-semibold mb-4">Expenses by Category</h2>
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2} dataKey="value">
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#12121e', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8 }}
                    formatter={(v: any) => [`$${Number(v).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`, '']}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {pieData.slice(0, 5).map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: PIE_COLORS[i] }} />
                      <span className="text-ace-muted truncate max-w-[100px]">{d.name}</span>
                    </div>
                    <span className="text-ace-text">{fmt(d.value)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-40 text-ace-muted text-sm">No expenses this month</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Transactions */}
        <div className="bg-ace-card border border-ace-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold">Recent Transactions</h2>
            <a href="/transactions" className="text-ace-cyan text-xs hover:underline">View all</a>
          </div>
          <div className="space-y-2">
            {recent.length === 0 && <p className="text-ace-muted text-sm py-4 text-center">No transactions yet</p>}
            {recent.map((t: any) => (
              <div key={t.id} className="flex items-center gap-3 py-2 border-b border-ace-border/50 last:border-0">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                  style={{ backgroundColor: (t.category_color || '#8b5cf6') + '20', color: t.category_color || '#8b5cf6' }}>
                  {t.type === 'income' ? '+' : '-'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-ace-text text-sm truncate">{t.description}</p>
                  <p className="text-ace-muted text-xs">{t.category_name || 'Uncategorised'} · {t.date}</p>
                </div>
                <span className={`text-sm font-semibold flex-shrink-0 ${t.type === 'income' ? 'text-ace-green' : 'text-ace-red'}`}>
                  {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming Subscriptions */}
        <div className="bg-ace-card border border-ace-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold">Upcoming Subscriptions</h2>
            <a href="/subscriptions" className="text-ace-cyan text-xs hover:underline">Manage</a>
          </div>
          {upcomingSubs.length === 0 && <p className="text-ace-muted text-sm py-4 text-center">No upcoming payments in 14 days</p>}
          <div className="space-y-2">
            {upcomingSubs.map((s: any) => (
              <div key={s.id} className="flex items-center gap-3 py-2 border-b border-ace-border/50 last:border-0">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                  style={{ backgroundColor: (s.color || '#8b5cf6') + '20', color: s.color || '#8b5cf6' }}>↺</div>
                <div className="flex-1 min-w-0">
                  <p className="text-ace-text text-sm">{s.name}</p>
                  <p className="text-ace-muted text-xs">Due {s.next_billing_date} · {s.billing_cycle}</p>
                </div>
                <span className="text-ace-orange text-sm font-semibold">{fmt(s.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
