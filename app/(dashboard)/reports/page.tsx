'use client'
import { useEffect, useState } from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { getTaxConfig, getBASPeriods, type TaxFramework } from '@/lib/tax'

interface Business { id: number; name: string; tax_framework: string; currency: string }

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const COLORS = ['#00d4ff','#8b5cf6','#10b981','#f59e0b','#ef4444','#ec4899','#06b6d4','#84cc16','#fb923c','#d946ef']

export default function ReportsPage() {
  const [tab, setTab] = useState<'pl'|'tax'>('pl')
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [selectedBiz, setSelectedBiz] = useState<string>('')
  const [year, setYear] = useState(new Date().getFullYear())
  const [plData, setPlData] = useState<{ summary: { totalIncome: number; totalExpenses: number; grossProfit: number; totalTax: number; margin: number }; monthly: { month: string; income: number; expenses: number; profit: number }[]; incomeByStream: { name: string; total: number }[]; expensesByCategory: { name: string; total: number }[] } | null>(null)
  const [taxData, setTaxData] = useState<{ business: { name: string; tax_framework: string }; taxConfig: { label: string; reportLabel: string; collectLabel: string; paidLabel: string; netLabel: string }; period: { date_from: string; date_to: string }; summary: { totalIncome: number; taxCollected: number; totalExpenses: number; taxPaid: number; netTax: number; deductibleExpenses: number }; deductibleByCategory: { category: string; total: number }[] } | null>(null)
  const [dateFrom, setDateFrom] = useState(`${new Date().getFullYear()}-07-01`)
  const [dateTo, setDateTo] = useState(`${new Date().getFullYear() + 1}-06-30`)
  const [loading, setLoading] = useState(false)

  useEffect(() => { fetchBusinesses() }, [])
  useEffect(() => { if (selectedBiz) fetchReports() }, [selectedBiz, year, tab, dateFrom, dateTo])

  async function fetchBusinesses() {
    const res = await fetch('/api/businesses')
    const data = await res.json()
    setBusinesses(data.businesses || [])
    if (data.businesses?.length > 0) setSelectedBiz(String(data.businesses[0].id))
  }

  async function fetchReports() {
    setLoading(true)
    if (tab === 'pl') {
      const res = await fetch(`/api/reports/pl?business_id=${selectedBiz}&year=${year}`)
      const data = await res.json()
      setPlData(data)
    } else {
      const res = await fetch(`/api/reports/tax?business_id=${selectedBiz}&date_from=${dateFrom}&date_to=${dateTo}`)
      const data = await res.json()
      setTaxData(data)
    }
    setLoading(false)
  }

  const curBiz = businesses.find(b => String(b.id) === selectedBiz)
  const taxConfig = curBiz ? getTaxConfig(curBiz.tax_framework as TaxFramework) : null
  const currency = curBiz?.currency || 'AUD'
  const fmt = (n: number) => `${currency} ${n.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Reports</h1>
          <p className="text-ace-muted text-sm mt-1">P&L, tax summaries and business performance</p>
        </div>
        {businesses.length > 1 && (
          <select value={selectedBiz} onChange={e => setSelectedBiz(e.target.value)}
            className="bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ace-cyan">
            {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
      </div>

      {businesses.length === 0 && (
        <div className="text-center py-16 text-ace-muted">
          <div className="text-4xl mb-4">📊</div>
          <p>Add a business first to generate reports.</p>
        </div>
      )}

      {businesses.length > 0 && (
        <>
          {/* Tab bar */}
          <div className="flex gap-1 bg-ace-bg border border-ace-border rounded-xl p-1 mb-6 w-fit">
            <button onClick={() => setTab('pl')} className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'pl' ? 'bg-ace-card text-white' : 'text-ace-muted hover:text-white'}`}>P&amp;L Report</button>
            <button onClick={() => setTab('tax')} className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'tax' ? 'bg-ace-card text-white' : 'text-ace-muted hover:text-white'}`}>
              {taxConfig ? taxConfig.reportLabel : 'Tax Report'}
            </button>
          </div>

          {/* P&L Tab */}
          {tab === 'pl' && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <label className="text-ace-muted text-sm">Year:</label>
                <select value={year} onChange={e => setYear(parseInt(e.target.value))}
                  className="bg-ace-bg border border-ace-border rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-ace-cyan">
                  {[year - 1, year, year + 1].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>

              {loading && <div className="text-ace-muted text-sm py-8 text-center">Loading…</div>}
              {!loading && plData && (
                <>
                  {/* KPI cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {[
                      { label: 'Total Revenue', value: fmt(plData.summary.totalIncome), color: 'text-green-400' },
                      { label: 'Total Expenses', value: fmt(plData.summary.totalExpenses), color: 'text-red-400' },
                      { label: 'Gross Profit', value: fmt(plData.summary.grossProfit), color: plData.summary.grossProfit >= 0 ? 'text-ace-cyan' : 'text-red-400' },
                      { label: 'Profit Margin', value: `${plData.summary.margin.toFixed(1)}%`, color: plData.summary.margin >= 0 ? 'text-ace-purple' : 'text-red-400' },
                    ].map(k => (
                      <div key={k.label} className="bg-ace-card border border-ace-border rounded-xl p-4">
                        <p className="text-ace-muted text-xs mb-1">{k.label}</p>
                        <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Monthly chart */}
                  <div className="bg-ace-card border border-ace-border rounded-xl p-5 mb-6">
                    <h3 className="text-white font-semibold mb-4">Monthly P&L</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={plData.monthly.map((m, i) => ({ name: MONTH_NAMES[parseInt(m.month) - 1], revenue: m.income, expenses: m.expenses, profit: m.profit }))}>
                        <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} labelStyle={{ color: '#fff' }} />
                        <Bar dataKey="revenue" fill="#10b981" radius={[3,3,0,0]} name="Revenue" />
                        <Bar dataKey="expenses" fill="#ef4444" radius={[3,3,0,0]} name="Expenses" />
                        <Bar dataKey="profit" fill="#00d4ff" radius={[3,3,0,0]} name="Profit" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Income by stream */}
                    {plData.incomeByStream.length > 0 && (
                      <div className="bg-ace-card border border-ace-border rounded-xl p-5">
                        <h3 className="text-white font-semibold mb-4">Revenue by Stream</h3>
                        <div className="space-y-2">
                          {plData.incomeByStream.map((s, i) => {
                            const pct = plData.summary.totalIncome > 0 ? (s.total / plData.summary.totalIncome) * 100 : 0
                            return (
                              <div key={s.name}>
                                <div className="flex items-center justify-between text-sm mb-1">
                                  <span className="text-white">{s.name}</span>
                                  <span className="text-ace-muted">{fmt(s.total)} <span className="text-xs">({pct.toFixed(0)}%)</span></span>
                                </div>
                                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Expenses by category */}
                    {plData.expensesByCategory.length > 0 && (
                      <div className="bg-ace-card border border-ace-border rounded-xl p-5">
                        <h3 className="text-white font-semibold mb-4">Expenses by Category</h3>
                        <div className="space-y-2">
                          {plData.expensesByCategory.slice(0, 8).map((c, i) => {
                            const pct = plData.summary.totalExpenses > 0 ? (c.total / plData.summary.totalExpenses) * 100 : 0
                            return (
                              <div key={c.name}>
                                <div className="flex items-center justify-between text-sm mb-1">
                                  <span className="text-white">{c.name}</span>
                                  <span className="text-ace-muted">{fmt(c.total)}</span>
                                </div>
                                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {plData.summary.totalIncome === 0 && plData.summary.totalExpenses === 0 && (
                    <div className="text-center py-12 text-ace-muted">
                      <div className="text-4xl mb-3">📭</div>
                      <p>No business transactions found for {year}. Add transactions with &quot;Business&quot; scope to see your P&L.</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Tax Tab */}
          {tab === 'tax' && (
            <div>
              {taxConfig && (
                <div className="bg-ace-cyan/5 border border-ace-cyan/20 rounded-xl p-4 mb-5 text-sm">
                  <p className="text-ace-cyan font-medium">{taxConfig.label} ({taxConfig.reportLabel}) — {taxConfig.rateDisplay}</p>
                  <p className="text-ace-muted mt-1">{taxConfig.notes}</p>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 mb-6">
                <div className="flex items-center gap-2">
                  <label className="text-ace-muted text-sm">From:</label>
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                    className="bg-ace-bg border border-ace-border rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-ace-cyan" />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-ace-muted text-sm">To:</label>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                    className="bg-ace-bg border border-ace-border rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-ace-cyan" />
                </div>
                {curBiz?.tax_framework === 'AU_GST' && (
                  <div className="flex flex-wrap gap-2">
                    {getBASPeriods(new Date().getFullYear() - 1).map(p => (
                      <button key={p.label} onClick={() => { setDateFrom(p.start); setDateTo(p.end) }}
                        className="px-3 py-1 text-xs bg-ace-bg border border-ace-border rounded-lg text-ace-muted hover:text-white hover:border-white/30 transition-colors">
                        {p.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {loading && <div className="text-ace-muted text-sm py-8 text-center">Loading…</div>}
              {!loading && taxData && taxData.summary && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                    {[
                      { label: taxData.taxConfig.collectLabel, value: fmt(taxData.summary.taxCollected), color: 'text-green-400' },
                      { label: taxData.taxConfig.paidLabel, value: fmt(taxData.summary.taxPaid), color: 'text-red-400' },
                      { label: taxData.taxConfig.netLabel, value: fmt(taxData.summary.netTax), color: taxData.summary.netTax >= 0 ? 'text-orange-400' : 'text-green-400' },
                      { label: 'Total Income', value: fmt(taxData.summary.totalIncome), color: 'text-white' },
                      { label: 'Total Expenses', value: fmt(taxData.summary.totalExpenses), color: 'text-white' },
                      { label: 'Tax Deductible', value: fmt(taxData.summary.deductibleExpenses), color: 'text-ace-cyan' },
                    ].map(k => (
                      <div key={k.label} className="bg-ace-card border border-ace-border rounded-xl p-4">
                        <p className="text-ace-muted text-xs mb-1">{k.label}</p>
                        <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
                      </div>
                    ))}
                  </div>

                  {taxData.deductibleByCategory.length > 0 && (
                    <div className="bg-ace-card border border-ace-border rounded-xl p-5">
                      <h3 className="text-white font-semibold mb-4">Deductible Expenses by Category</h3>
                      <div className="space-y-2">
                        {taxData.deductibleByCategory.map((c, i) => {
                          const pct = taxData.summary.deductibleExpenses > 0 ? (c.total / taxData.summary.deductibleExpenses) * 100 : 0
                          return (
                            <div key={c.category}>
                              <div className="flex items-center justify-between text-sm mb-1">
                                <span className="text-white">{c.category || 'Uncategorised'}</span>
                                <span className="text-ace-muted">{fmt(c.total)}</span>
                              </div>
                              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-sm text-yellow-300">
                    ⚠️ This is a summary only. Consult a qualified accountant before lodging your {taxData.taxConfig?.reportLabel || 'tax return'}.
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
