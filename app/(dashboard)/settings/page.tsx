'use client'
import { useEffect, useState } from 'react'

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null)
  const [cats, setCats] = useState<any[]>([])
  const [showCatModal, setShowCatModal] = useState(false)
  const [catForm, setCatForm] = useState({ name: '', type: 'expense', color: '#8b5cf6', icon: 'tag', budget_limit: '' })
  const [saving, setSaving] = useState(false)
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [pwMsg, setPwMsg] = useState('')

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(setUser)
    fetch('/api/categories').then(r => r.json()).then(d => setCats(d.categories || []))
  }, [])

  async function saveCat() {
    setSaving(true)
    await fetch('/api/categories', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({...catForm, budget_limit: parseFloat(catForm.budget_limit)||0}) })
    setSaving(false); setShowCatModal(false)
    setCatForm({ name: '', type: 'expense', color: '#8b5cf6', icon: 'tag', budget_limit: '' })
    fetch('/api/categories').then(r => r.json()).then(d => setCats(d.categories || []))
  }

  const incomeCats = cats.filter(c => c.type === 'income')
  const expenseCats = cats.filter(c => c.type === 'expense')

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-ace-muted text-sm">Manage your account and categories</p>
      </div>

      {/* Account */}
      <div className="bg-ace-card border border-ace-border rounded-xl p-5 mb-6">
        <h2 className="text-white font-semibold mb-4">Account</h2>
        {user && (
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-ace-cyan to-ace-purple flex items-center justify-center text-white font-bold text-lg">
              {user.name?.[0]?.toUpperCase()}
            </div>
            <div>
              <p className="text-white font-medium">{user.name}</p>
              <p className="text-ace-muted text-sm">{user.email}</p>
              <span className="text-xs px-2 py-0.5 rounded-full bg-ace-purple/10 text-ace-purple border border-ace-purple/20 mt-1 inline-block">{user.role}</span>
            </div>
          </div>
        )}
      </div>

      {/* Categories */}
      <div className="bg-ace-card border border-ace-border rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold">Categories</h2>
          <button onClick={() => setShowCatModal(true)} className="text-sm px-3 py-1.5 rounded-lg bg-ace-cyan/10 text-ace-cyan border border-ace-cyan/20 hover:bg-ace-cyan/20 transition-colors">+ Add Category</button>
        </div>
        <div className="space-y-4">
          {[['Income', incomeCats], ['Expense', expenseCats]].map(([label, list]) => (
            <div key={label as string}>
              <p className="text-ace-muted text-xs uppercase tracking-wide mb-2">{label as string}</p>
              <div className="flex flex-wrap gap-2">
                {(list as any[]).map(c => (
                  <div key={c.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border"
                    style={{ backgroundColor: c.color + '15', borderColor: c.color + '30', color: c.color }}>
                    {c.name}
                    {c.budget_limit > 0 && <span className="text-[10px] opacity-60">· ${c.budget_limit}</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* App info */}
      <div className="bg-ace-card border border-ace-border rounded-xl p-5">
        <h2 className="text-white font-semibold mb-3">About</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-ace-muted">App</span><span className="text-ace-text">ACE Wallet</span></div>
          <div className="flex justify-between"><span className="text-ace-muted">Part of</span><span className="text-ace-text">ACE Marketing Suite</span></div>
          <div className="flex justify-between"><span className="text-ace-muted">Currency</span><span className="text-ace-text">AUD</span></div>
          <div className="flex justify-between"><span className="text-ace-muted">Database</span><span className="text-ace-text">SQLite (local)</span></div>
        </div>
      </div>

      {showCatModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-ace-card border border-ace-border rounded-2xl p-6 w-full max-w-sm">
            <h2 className="text-white font-bold text-lg mb-5">Add Category</h2>
            <div className="space-y-4">
              <div className="flex gap-2">
                {(['expense','income'] as const).map(t => (
                  <button key={t} onClick={() => setCatForm(f=>({...f, type:t}))}
                    className={`flex-1 py-2 rounded-lg text-sm capitalize transition-all ${catForm.type === t ? 'bg-ace-cyan/10 text-ace-cyan border border-ace-cyan/20' : 'bg-ace-bg border border-ace-border text-ace-muted'}`}>
                    {t}
                  </button>
                ))}
              </div>
              <input placeholder="Category name" value={catForm.name} onChange={e => setCatForm(f=>({...f,name:e.target.value}))}
                className="w-full bg-ace-bg border border-ace-border rounded-lg px-4 py-2.5 text-ace-text text-sm focus:outline-none focus:border-ace-cyan/50" />
              <input type="number" placeholder="Monthly budget limit (optional)" value={catForm.budget_limit} onChange={e => setCatForm(f=>({...f,budget_limit:e.target.value}))}
                className="w-full bg-ace-bg border border-ace-border rounded-lg px-4 py-2.5 text-ace-text text-sm focus:outline-none focus:border-ace-cyan/50" />
              <div className="flex items-center gap-3">
                <label className="text-ace-muted text-sm">Colour</label>
                <input type="color" value={catForm.color} onChange={e => setCatForm(f=>({...f,color:e.target.value}))}
                  className="w-12 h-10 rounded-lg border border-ace-border bg-ace-bg cursor-pointer" />
                <div className="flex-1 rounded-lg px-3 py-2 text-sm border" style={{ backgroundColor: catForm.color+'20', borderColor: catForm.color+'40', color: catForm.color }}>
                  {catForm.name || 'Preview'}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowCatModal(false)} className="flex-1 py-2.5 rounded-lg border border-ace-border text-ace-muted text-sm hover:text-white transition-colors">Cancel</button>
              <button onClick={saveCat} disabled={saving || !catForm.name}
                className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-ace-cyan to-ace-purple text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity">
                {saving ? 'Saving...' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
