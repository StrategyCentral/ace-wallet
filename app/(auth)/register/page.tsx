'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({ email: '', name: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const res = await fetch('/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error || 'Registration failed'); return }
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-ace-bg">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-ace-cyan to-ace-purple flex items-center justify-center text-white font-bold text-xl">₳</div>
            <span className="text-2xl font-bold text-white">ACE <span className="text-ace-cyan">Wallet</span></span>
          </div>
          <p className="text-ace-muted">Create your account</p>
        </div>
        <div className="bg-ace-card border border-ace-border rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && <div className="bg-ace-red/10 border border-ace-red/30 text-ace-red text-sm rounded-lg px-4 py-3">{error}</div>}
            <div>
              <label className="block text-sm text-ace-muted mb-1.5">Name</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full bg-ace-bg border border-ace-border rounded-lg px-4 py-2.5 text-ace-text focus:outline-none focus:border-ace-cyan/50 transition-colors"
                placeholder="Your name" required />
            </div>
            <div>
              <label className="block text-sm text-ace-muted mb-1.5">Email</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full bg-ace-bg border border-ace-border rounded-lg px-4 py-2.5 text-ace-text focus:outline-none focus:border-ace-cyan/50 transition-colors"
                placeholder="you@example.com" required />
            </div>
            <div>
              <label className="block text-sm text-ace-muted mb-1.5">Password</label>
              <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className="w-full bg-ace-bg border border-ace-border rounded-lg px-4 py-2.5 text-ace-text focus:outline-none focus:border-ace-cyan/50 transition-colors"
                placeholder="••••••••" required minLength={6} />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-gradient-to-r from-ace-cyan to-ace-purple text-white font-semibold py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50">
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
          <p className="text-center text-ace-muted text-sm mt-6">
            Have an account? <a href="/login" className="text-ace-cyan hover:underline">Sign in</a>
          </p>
        </div>
      </div>
    </div>
  )
}
