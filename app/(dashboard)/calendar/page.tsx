'use client'
import { useEffect, useState } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO, addMonths, subMonths, addDays, addWeeks, addYears } from 'date-fns'

const fmt = (n: number) => `$${n.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`

function getProjectedDates(sub: any, from: Date, to: Date): Date[] {
  const dates: Date[] = []
  let d = parseISO(sub.next_billing_date)
  // go back to find first occurrence in range
  while (d > to) {
    if (sub.billing_cycle === 'weekly') d = addDays(d, -7)
    else if (sub.billing_cycle === 'fortnightly') d = addDays(d, -14)
    else if (sub.billing_cycle === 'monthly') d = addMonths(d, -1)
    else if (sub.billing_cycle === 'quarterly') d = addMonths(d, -3)
    else if (sub.billing_cycle === 'annually') d = addYears(d, -1)
    else break
  }
  while (d <= to) {
    if (d >= from) dates.push(new Date(d))
    if (sub.billing_cycle === 'weekly') d = addDays(d, 7)
    else if (sub.billing_cycle === 'fortnightly') d = addDays(d, 14)
    else if (sub.billing_cycle === 'monthly') d = addMonths(d, 1)
    else if (sub.billing_cycle === 'quarterly') d = addMonths(d, 3)
    else if (sub.billing_cycle === 'annually') d = addYears(d, 1)
    else break
  }
  return dates
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [txns, setTxns] = useState<any[]>([])
  const [subs, setSubs] = useState<any[]>([])
  const [selected, setSelected] = useState<Date | null>(null)

  const monthStr = format(currentDate, 'yyyy-MM')
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startDow = monthStart.getDay() // 0=Sun

  useEffect(() => {
    Promise.all([
      fetch(`/api/transactions?month=${monthStr}`).then(r => r.json()),
      fetch('/api/subscriptions?status=active').then(r => r.json()),
    ]).then(([t, s]) => { setTxns(t || []); setSubs(s || []) })
  }, [monthStr])

  // Build day data
  const dayData: Record<string, { txns: any[], projectedSubs: any[], income: number, expenses: number }> = {}

  days.forEach(d => {
    const key = format(d, 'yyyy-MM-dd')
    dayData[key] = { txns: [], projectedSubs: [], income: 0, expenses: 0 }
  })

  txns.forEach(t => {
    if (dayData[t.date]) {
      dayData[t.date].txns.push(t)
      if (t.type === 'income') dayData[t.date].income += t.amount
      else dayData[t.date].expenses += t.amount
    }
  })

  subs.forEach(s => {
    getProjectedDates(s, monthStart, monthEnd).forEach(d => {
      const key = format(d, 'yyyy-MM-dd')
      if (dayData[key]) dayData[key].projectedSubs.push(s)
    })
  })

  const selectedKey = selected ? format(selected, 'yyyy-MM-dd') : null
  const selectedData = selectedKey ? dayData[selectedKey] : null

  // Monthly projections
  const projectedSubCost = subs.reduce((a: number, s: any) => {
    const dates = getProjectedDates(s, monthStart, monthEnd)
    return a + dates.length * s.amount
  }, 0)
  const totalIncome = Object.values(dayData).reduce((a, d) => a + d.income, 0)
  const totalExpenses = Object.values(dayData).reduce((a, d) => a + d.expenses, 0)

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Calendar</h1>
          <p className="text-ace-muted text-sm">Expense timeline and projections</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setCurrentDate(d => subMonths(d, 1))} className="w-8 h-8 rounded-lg bg-ace-card border border-ace-border text-ace-muted hover:text-white flex items-center justify-center transition-colors">‹</button>
          <span className="text-white font-semibold w-36 text-center">{format(currentDate, 'MMMM yyyy')}</span>
          <button onClick={() => setCurrentDate(d => addMonths(d, 1))} className="w-8 h-8 rounded-lg bg-ace-card border border-ace-border text-ace-muted hover:text-white flex items-center justify-center transition-colors">›</button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-ace-card border border-ace-border rounded-xl p-4">
          <p className="text-ace-muted text-xs mb-1">Income</p>
          <p className="text-ace-green font-bold">{fmt(totalIncome)}</p>
        </div>
        <div className="bg-ace-card border border-ace-border rounded-xl p-4">
          <p className="text-ace-muted text-xs mb-1">Expenses</p>
          <p className="text-ace-red font-bold">{fmt(totalExpenses)}</p>
        </div>
        <div className="bg-ace-card border border-ace-border rounded-xl p-4">
          <p className="text-ace-muted text-xs mb-1">Projected Subs</p>
          <p className="text-ace-orange font-bold">{fmt(projectedSubCost)}</p>
        </div>
        <div className="bg-ace-card border border-ace-border rounded-xl p-4">
          <p className="text-ace-muted text-xs mb-1">Net Projected</p>
          <p className={`font-bold ${totalIncome - totalExpenses - projectedSubCost >= 0 ? 'text-ace-cyan' : 'text-ace-red'}`}>
            {fmt(totalIncome - totalExpenses - projectedSubCost)}
          </p>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Calendar Grid */}
        <div className="flex-1 bg-ace-card border border-ace-border rounded-xl overflow-hidden">
          <div className="grid grid-cols-7 border-b border-ace-border">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
              <div key={d} className="py-2 text-center text-ace-muted text-xs font-medium">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {/* Empty cells before month start */}
            {Array.from({ length: startDow }).map((_, i) => (
              <div key={`empty-${i}`} className="h-20 border-b border-r border-ace-border/30" />
            ))}
            {days.map(day => {
              const key = format(day, 'yyyy-MM-dd')
              const data = dayData[key]
              const isToday = isSameDay(day, new Date())
              const isSelected = selected && isSameDay(day, selected)
              const hasIncome = data.income > 0
              const hasExpenses = data.expenses > 0
              const hasSubs = data.projectedSubs.length > 0

              return (
                <div key={key}
                  onClick={() => setSelected(isSameDay(day, selected||new Date(-1)) ? null : day)}
                  className={`h-20 border-b border-r border-ace-border/30 p-1.5 cursor-pointer transition-colors ${isSelected ? 'bg-ace-cyan/10' : 'hover:bg-white/3'}`}>
                  <div className={`text-xs font-medium w-5 h-5 rounded-full flex items-center justify-center mb-1 ${isToday ? 'bg-ace-cyan text-black' : 'text-ace-muted'}`}>
                    {format(day, 'd')}
                  </div>
                  <div className="flex flex-wrap gap-0.5">
                    {hasIncome && <div className="w-1.5 h-1.5 rounded-full bg-ace-green" title="Income" />}
                    {hasExpenses && <div className="w-1.5 h-1.5 rounded-full bg-ace-red" title="Expense" />}
                    {hasSubs && <div className="w-1.5 h-1.5 rounded-full bg-ace-orange" title="Subscription due" />}
                  </div>
                  {data.income > 0 && <p className="text-ace-green text-[9px] leading-tight">+{fmt(data.income)}</p>}
                  {data.expenses > 0 && <p className="text-ace-red text-[9px] leading-tight">-{fmt(data.expenses)}</p>}
                </div>
              )
            })}
          </div>
          <div className="p-3 flex gap-4 border-t border-ace-border/30">
            {[['Income','bg-ace-green'],['Expense','bg-ace-red'],['Subscription due','bg-ace-orange']].map(([l,c]) => (
              <div key={l} className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${c}`} />
                <span className="text-ace-muted text-xs">{l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Day detail panel */}
        <div className="w-72 bg-ace-card border border-ace-border rounded-xl p-4 flex-shrink-0">
          {!selectedData ? (
            <div className="flex items-center justify-center h-full text-ace-muted text-sm">
              Click a day to see details
            </div>
          ) : (
            <>
              <h3 className="text-white font-semibold mb-4">{selectedKey && format(parseISO(selectedKey), 'EEEE, d MMMM')}</h3>
              {selectedData.txns.length === 0 && selectedData.projectedSubs.length === 0 && (
                <p className="text-ace-muted text-sm">No activity on this day</p>
              )}
              {selectedData.txns.length > 0 && (
                <div className="mb-4">
                  <p className="text-ace-muted text-xs uppercase tracking-wide mb-2">Transactions</p>
                  <div className="space-y-2">
                    {selectedData.txns.map((t: any) => (
                      <div key={t.id} className="flex justify-between items-center">
                        <div>
                          <p className="text-ace-text text-sm">{t.description}</p>
                          <p className="text-ace-muted text-xs">{t.category_name || 'Uncategorised'}</p>
                        </div>
                        <span className={`text-sm font-semibold ${t.type==='income'?'text-ace-green':'text-ace-red'}`}>
                          {t.type==='income'?'+':'-'}{fmt(t.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedData.projectedSubs.length > 0 && (
                <div>
                  <p className="text-ace-muted text-xs uppercase tracking-wide mb-2">Subscriptions Due</p>
                  <div className="space-y-2">
                    {selectedData.projectedSubs.map((s: any) => (
                      <div key={s.id} className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md flex items-center justify-center text-xs" style={{ backgroundColor: (s.color||'#8b5cf6')+'20', color: s.color||'#8b5cf6' }}>↺</div>
                          <p className="text-ace-text text-sm">{s.name}</p>
                        </div>
                        <span className="text-ace-orange text-sm font-semibold">{fmt(s.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
