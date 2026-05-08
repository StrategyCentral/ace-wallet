import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

interface ImportRow {
  date: string
  description: string
  amount: number
  type: 'income' | 'expense'
  category_id: number | null
  category_name: string | null
  matched: boolean          // was a category mapping found?
  original_description: string
}

// Normalise a description for fuzzy matching
function normalise(desc: string): string {
  return desc
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/[^A-Z0-9 ]/g, '')
    .trim()
}

// POST /api/transactions/import  — parse CSV rows + auto-match categories
export async function POST(req: NextRequest) {
  const user = getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { rows, scope, account_id } = await req.json() as {
    rows: { date: string; description: string; amount: number }[]
    scope?: string
    account_id?: number
  }

  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'No rows provided' }, { status: 400 })
  }

  const db = getDb()

  // Fetch all saved category mappings for this user
  const mappings = db.prepare(
    'SELECT * FROM category_mappings WHERE user_id = ? ORDER BY times_used DESC'
  ).all(user.userId) as { id: number; description_pattern: string; category_id: number; scope: string; type: string }[]

  // Fetch all categories for labelling
  const categories = db.prepare('SELECT id, name, type, color FROM categories WHERE user_id = ?').all(user.userId) as
    { id: number; name: string; type: string; color: string }[]
  const catMap = new Map(categories.map(c => [c.id, c]))

  // Match each row
  const matched: ImportRow[] = rows.map(row => {
    const norm = normalise(row.description)
    const type = row.amount >= 0 ? 'income' as const : 'expense' as const
    const absAmount = Math.abs(row.amount)

    // Try exact normalised match first, then substring match
    let mapping = mappings.find(m => normalise(m.description_pattern) === norm)
    if (!mapping) {
      mapping = mappings.find(m => norm.includes(normalise(m.description_pattern)) || normalise(m.description_pattern).includes(norm))
    }

    const cat = mapping ? catMap.get(mapping.category_id) : null

    return {
      date: row.date,
      description: row.description,
      original_description: row.description,
      amount: absAmount,
      type,
      category_id: cat ? cat.id : null,
      category_name: cat ? cat.name : null,
      matched: !!mapping,
    }
  })

  return NextResponse.json({ rows: matched, categories })
}

// PUT /api/transactions/import  — save approved rows + update category mappings
export async function PUT(req: NextRequest) {
  const user = getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { rows, scope, account_id } = await req.json() as {
    rows: {
      date: string; description: string; amount: number; type: string
      category_id: number | null; scope?: string; approved: boolean
    }[]
    scope?: string
    account_id?: number
  }

  if (!rows || !Array.isArray(rows)) {
    return NextResponse.json({ error: 'No rows' }, { status: 400 })
  }

  const db = getDb()
  const insertTx = db.prepare(`
    INSERT INTO transactions (user_id, type, amount, description, category_id, date, scope, account_id, currency, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'AUD', 'Imported from bank statement')
  `)

  const upsertMapping = db.prepare(`
    INSERT INTO category_mappings (user_id, description_pattern, category_id, scope, type, times_used, last_used)
    VALUES (?, ?, ?, ?, ?, 1, datetime('now'))
    ON CONFLICT(user_id, description_pattern)
    DO UPDATE SET category_id = excluded.category_id, scope = excluded.scope, type = excluded.type,
      times_used = times_used + 1, last_used = datetime('now')
  `)

  const approved = rows.filter(r => r.approved !== false)
  let saved = 0

  const runAll = db.transaction(() => {
    for (const row of approved) {
      const rowScope = row.scope || scope || 'personal'
      insertTx.run(
        user.userId, row.type, Math.abs(row.amount), row.description,
        row.category_id || null, row.date, rowScope, account_id || null
      )

      // Save / update the category mapping for future imports
      if (row.category_id) {
        const norm = normalise(row.description)
        if (norm.length > 2) {
          upsertMapping.run(user.userId, norm, row.category_id, rowScope, row.type)
        }
      }
      saved++
    }
  })

  runAll()

  return NextResponse.json({ success: true, saved })
}
