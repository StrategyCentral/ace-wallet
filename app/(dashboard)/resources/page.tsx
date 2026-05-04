'use client'

const STEPS = [
  { n: 1, title: 'Schedule Date Night', desc: 'Set a regular time each month to review finances with your partner (or yourself). No phones, just the numbers.', icon: '📅', action: null },
  { n: 2, title: 'Set Up Your Buckets', desc: 'Open separate accounts for Daily Expenses, Splurge, Smile, Fire Extinguisher, Super, and Invest. Automate transfers on pay day.', icon: '🪣', action: '/buckets' },
  { n: 3, title: 'Domino Your Debts', desc: 'List debts smallest to largest. Pay minimums on all, attack the smallest with everything extra. Roll freed payments forward.', icon: '🎳', action: '/debts' },
  { n: 4, title: 'Buy Your Home', desc: 'Build your home deposit using the Smile and Fire Extinguisher accounts. Aim for 20% to avoid LMI.', icon: '🏠', action: null },
  { n: 5, title: 'Boost Super to 15%', desc: 'Once debts are cleared, redirect that payment power into superannuation. Use a low-fee industry fund.', icon: '🏦', action: null },
  { n: 6, title: 'Blast the Mortgage', desc: 'Every extra dollar goes onto the mortgage. An offset account is your best friend here.', icon: '💥', action: null },
  { n: 7, title: 'Get the Kids Sorted', desc: 'Open a savings account for each child. Review insurance — life, TPD, and income protection.', icon: '👨‍👩‍👧', action: null },
  { n: 8, title: 'Nail Your Retirement Number', desc: 'Calculate how much you need to live comfortably. 80% of current income × 20 years is a starting point.', icon: '🎯', action: null },
  { n: 9, title: 'Have the Money Talk', desc: "Talk to ageing parents about their finances, will, power of attorney, and wishes. It's a gift, not a burden.", icon: '💬', action: null },
  { n: 10, title: 'Leave a Legacy', desc: 'Update your own will. Decide what you want your money to do after you are gone.', icon: '🌟', action: null },
]

const RESOURCES = [
  {
    category: 'Barefoot Investor',
    items: [
      { title: 'Barefoot Investor Website', desc: 'Scott Pape\'s official site — articles, resources, and updates', url: 'https://www.barefootinvestor.com', icon: '👣' },
      { title: 'Free Resources', desc: 'Free scripts, spreadsheets, and tools from Scott Pape', url: 'https://www.barefootinvestor.com/resources', icon: '🛠️' },
      { title: 'Barefoot Blueprint Newsletter', desc: 'Weekly financial column — practical money advice', url: 'https://www.barefootinvestor.com', icon: '📧' },
    ]
  },
  {
    category: 'Australian Investing',
    items: [
      { title: 'Vanguard Australia', desc: 'Low-cost index funds (the Barefoot-recommended approach)', url: 'https://www.vanguard.com.au', icon: '📈' },
      { title: 'Moneysmart — ASIC', desc: 'Australian government financial guidance, calculators, and tools', url: 'https://moneysmart.gov.au', icon: '🏛️' },
      { title: 'ATO — Super Information', desc: 'Superannuation rules, contribution limits, and tax info', url: 'https://www.ato.gov.au/individuals-and-families/super-for-individuals-and-families', icon: '📋' },
      { title: 'Compare the Market — Super', desc: 'Compare superannuation funds by fee and performance', url: 'https://www.comparethemarket.com.au/superannuation', icon: '🔍' },
    ]
  },
  {
    category: 'Budgeting & Tools',
    items: [
      { title: 'Moneysmart Budget Planner', desc: 'Free Australian government budget calculator', url: 'https://moneysmart.gov.au/budgeting/budget-planner', icon: '💰' },
      { title: 'Moneysmart Compound Interest', desc: 'See how compound interest grows your money over time', url: 'https://moneysmart.gov.au/saving/compound-interest-calculator', icon: '⚡' },
      { title: 'Moneysmart Mortgage Calculator', desc: 'Compare loans, extra repayments, and offset scenarios', url: 'https://moneysmart.gov.au/home-loans/mortgage-calculator', icon: '🏠' },
      { title: 'Finder — Credit Cards', desc: 'Compare Australian credit card rates and fees', url: 'https://www.finder.com.au/credit-cards', icon: '💳' },
    ]
  },
  {
    category: 'Insurance',
    items: [
      { title: 'Moneysmart — Insurance', desc: 'Guide to life, TPD, income protection, and trauma cover', url: 'https://moneysmart.gov.au/insurance', icon: '🛡️' },
      { title: 'Life Insurance Comparison', desc: 'Compare life insurance policies and premiums', url: 'https://www.comparethemarket.com.au/life-insurance', icon: '❤️' },
    ]
  },
]

const CALCULATORS = [
  { title: 'Debt Domino Calculator', desc: 'See your debt-free date using the snowball method', href: '/debts', icon: '🎳', internal: true },
  { title: 'Bucket Allocations', desc: 'Set up and visualise your Blow / Mojo / Grow split', href: '/buckets', icon: '🪣', internal: true },
  { title: 'Compound Interest', desc: 'How much will your savings grow?', href: 'https://moneysmart.gov.au/saving/compound-interest-calculator', icon: '📊', internal: false },
  { title: 'Mortgage Extra Repayments', desc: 'How much interest will you save paying more?', href: 'https://moneysmart.gov.au/home-loans/mortgage-calculator', icon: '🏦', internal: false },
  { title: 'Superannuation Projection', desc: 'What will your super be worth at retirement?', href: 'https://moneysmart.gov.au/super/superannuation-calculator', icon: '🎯', internal: false },
  { title: 'Budget Planner', desc: 'Build a complete household budget', href: 'https://moneysmart.gov.au/budgeting/budget-planner', icon: '💰', internal: false },
]

export default function ResourcesPage() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Resources</h1>
        <p className="text-ace-muted text-sm mt-1">Financial tools, guides, and the Barefoot 10-step roadmap</p>
      </div>

      {/* 10 Steps */}
      <div>
        <h2 className="text-white font-semibold mb-4">The Barefoot 10-Step Roadmap</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {STEPS.map(s => (
            <div key={s.n} className="bg-ace-card border border-ace-border rounded-xl p-4 flex items-start gap-4">
              <div className="w-9 h-9 rounded-xl bg-ace-purple/10 border border-ace-purple/20 flex items-center justify-center text-lg flex-shrink-0">
                {s.icon}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-ace-purple text-xs font-bold">Step {s.n}</span>
                  <h3 className="text-white text-sm font-semibold">{s.title}</h3>
                </div>
                <p className="text-ace-muted text-xs leading-relaxed">{s.desc}</p>
                {s.action && (
                  <a href={s.action} className="inline-block mt-2 text-xs text-ace-cyan hover:underline">Open in app →</a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick calculators */}
      <div>
        <h2 className="text-white font-semibold mb-4">Calculators</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CALCULATORS.map(c => (
            <a key={c.title} href={c.href} target={c.internal ? undefined : '_blank'} rel="noopener noreferrer"
              className="bg-ace-card border border-ace-border rounded-xl p-4 hover:border-ace-cyan/40 hover:bg-ace-cyan/5 transition-all group">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{c.icon}</span>
                <h3 className="text-white text-sm font-semibold group-hover:text-ace-cyan transition-colors">{c.title}</h3>
              </div>
              <p className="text-ace-muted text-xs">{c.desc}</p>
              <p className="text-ace-muted text-xs mt-2">{c.internal ? '→ Built into ACE Wallet' : '↗ Opens Moneysmart'}</p>
            </a>
          ))}
        </div>
      </div>

      {/* Bucket summary card */}
      <div className="bg-gradient-to-r from-ace-purple/10 to-ace-cyan/10 border border-ace-purple/20 rounded-xl p-5">
        <h2 className="text-white font-semibold mb-3">The Bucket System at a Glance</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { bucket: '💸 Blow (60%)', color: '#f59e0b', items: ['Daily Expenses — bills, groceries, transport', 'Splurge — fun money, spend without guilt'] },
            { bucket: '🛡️ Mojo (20%)', color: '#00d4ff', items: ['Smile — saving for a specific goal', 'Fire Extinguisher — 3 months expenses or debt weapon'] },
            { bucket: '🌱 Grow (20%)', color: '#10b981', items: ['Super — target 15% of gross income', 'Invest — low-cost index funds, long game'] },
          ].map(b => (
            <div key={b.bucket} className="bg-ace-card rounded-xl p-4">
              <h3 className="font-semibold mb-3 text-sm" style={{ color: b.color }}>{b.bucket}</h3>
              <ul className="space-y-1.5">
                {b.items.map(item => (
                  <li key={item} className="text-ace-muted text-xs flex items-start gap-1.5">
                    <span style={{ color: b.color }} className="mt-0.5 flex-shrink-0">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="text-ace-muted text-xs mt-4">
          Set up your accounts in the <a href="/buckets" className="text-ace-cyan underline">Buckets</a> section. Automate transfers on pay day so it happens without thinking.
        </p>
      </div>

      {/* External resources */}
      {RESOURCES.map(group => (
        <div key={group.category}>
          <h2 className="text-white font-semibold mb-3">{group.category}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {group.items.map(item => (
              <a key={item.title} href={item.url} target="_blank" rel="noopener noreferrer"
                className="bg-ace-card border border-ace-border rounded-xl p-4 hover:border-ace-cyan/40 hover:bg-ace-cyan/5 transition-all group flex items-start gap-3">
                <span className="text-xl flex-shrink-0">{item.icon}</span>
                <div>
                  <h3 className="text-white text-sm font-semibold group-hover:text-ace-cyan transition-colors">{item.title} ↗</h3>
                  <p className="text-ace-muted text-xs mt-0.5">{item.desc}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      ))}

      <div className="text-ace-muted text-xs border-t border-ace-border pt-4">
        ⚠️ ACE Wallet is a personal finance tool, not a licensed financial adviser. Always consider your own situation and consult a qualified adviser before making major financial decisions.
      </div>
    </div>
  )
}
