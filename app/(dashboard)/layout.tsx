'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

const NAV_GROUPS = [
  {
    label: 'Personal',
    items: [
      { href: '/dashboard', label: 'Overview', icon: '▦' },
      { href: '/transactions', label: 'Transactions', icon: '↕' },
      { href: '/subscriptions', label: 'Subscriptions', icon: '↺' },
      { href: '/calendar', label: 'Calendar', icon: '◫' },
      { href: '/shopping', label: 'Shopping', icon: '⊞' },
    ]
  },
  {
    label: 'Finance',
    items: [
      { href: '/buckets', label: 'Buckets', icon: '🪣' },
      { href: '/debts', label: 'Debts', icon: '🎳' },
      { href: '/resources', label: 'Resources', icon: '📚' },
    ]
  },
  {
    label: 'Business',
    items: [
      { href: '/businesses', label: 'Businesses', icon: '🏢' },
      { href: '/accounts', label: 'Accounts', icon: '🏦' },
      { href: '/income-streams', label: 'Income Streams', icon: '📊' },
      { href: '/integrations', label: 'Integrations', icon: '🔗' },
      { href: '/reports', label: 'Reports', icon: '📈' },
    ]
  },
  {
    label: 'System',
    items: [
      { href: '/settings', label: 'Settings', icon: '⚙' },
    ]
  }
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <div className="flex min-h-screen bg-ace-bg">
      <aside className={`flex flex-col border-r border-ace-border bg-ace-card transition-all duration-200 ${collapsed ? 'w-16' : 'w-60'}`} style={{ minHeight: '100vh' }}>
        <div className="flex items-center gap-3 px-4 py-5 border-b border-ace-border">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-ace-cyan to-ace-purple flex items-center justify-center text-white font-bold flex-shrink-0">₳</div>
          {!collapsed && <span className="text-white font-bold text-lg">ACE <span className="text-ace-cyan">Wallet</span></span>}
          <button onClick={() => setCollapsed(c => !c)} className="ml-auto text-ace-muted hover:text-white transition-colors text-xs">
            {collapsed ? '›' : '‹'}
          </button>
        </div>

        <nav className="flex-1 py-4 px-2 overflow-y-auto">
          {NAV_GROUPS.map(group => (
            <div key={group.label} className="mb-4">
              {!collapsed && <p className="text-ace-muted text-xs font-semibold uppercase tracking-wider px-3 mb-1">{group.label}</p>}
              <div className="space-y-0.5">
                {group.items.map(n => {
                  const active = path === n.href || (n.href !== '/dashboard' && path.startsWith(n.href))
                  return (
                    <Link key={n.href} href={n.href}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${active
                        ? 'bg-ace-cyan/10 text-ace-cyan border border-ace-cyan/20'
                        : 'text-ace-muted hover:text-white hover:bg-white/5'}`}>
                      <span className="text-base w-5 text-center flex-shrink-0">{n.icon}</span>
                      {!collapsed && <span>{n.label}</span>}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="px-2 pb-4 border-t border-ace-border pt-3">
          <button onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-ace-muted hover:text-red-400 hover:bg-red-500/5 transition-all">
            <span className="text-base w-5 text-center flex-shrink-0">⇤</span>
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-auto">
        {children}
      </main>
    </div>
  )
}
