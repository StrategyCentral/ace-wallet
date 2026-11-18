import type Database from 'better-sqlite3'

type Db = Database.Database
type Id = number | string | null | undefined

// Tables whose rows belong to a single user via user_id.
const USER_OWNED = new Set(['accounts', 'categories', 'income_streams', 'shopping_lists', 'transactions'])

export function ownsRow(db: Db, table: string, id: Id, userId: number): boolean {
  if (!USER_OWNED.has(table)) throw new Error(`ownsRow: table not allowed: ${table}`)
  if (id === null || id === undefined || id === '') return false
  return !!db.prepare(`SELECT 1 FROM ${table} WHERE id = ? AND user_id = ?`).get(id, userId)
}

export function isBusinessMember(db: Db, businessId: Id, userId: number): boolean {
  if (businessId === null || businessId === undefined || businessId === '') return false
  return !!db.prepare('SELECT 1 FROM business_members WHERE business_id = ? AND user_id = ?').get(businessId, userId)
}

/**
 * Checks that every foreign id the client sent belongs to the caller.
 * Empty values are allowed (they are stored as NULL). Returns an error
 * message, or null when everything is owned.
 */
export function checkRefs(db: Db, userId: number, refs: {
  business_id?: Id; account_id?: Id; category_id?: Id; income_stream_id?: Id
}): string | null {
  if (refs.business_id && !isBusinessMember(db, refs.business_id, userId)) return 'Business not found'
  if (refs.account_id && !ownsRow(db, 'accounts', refs.account_id, userId)) return 'Account not found'
  if (refs.category_id && !ownsRow(db, 'categories', refs.category_id, userId)) return 'Category not found'
  if (refs.income_stream_id && !ownsRow(db, 'income_streams', refs.income_stream_id, userId)) return 'Income stream not found'
  return null
}
