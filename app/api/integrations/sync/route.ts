import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

function getUser(req: NextRequest) {
  const token = req.cookies.get('ace_token')?.value
  if (!token) return null
  return verifyToken(token)
}

async function syncStripe(integrationId: number, businessId: number, creds: Record<string, string>, db: ReturnType<typeof getDb>) {
  const { secret_key } = creds
  if (!secret_key) return { error: 'Missing secret_key' }
  try {
    const res = await fetch('https://api.stripe.com/v1/charges?limit=100', {
      headers: { Authorization: `Bearer ${secret_key}` }
    })
    if (!res.ok) return { error: `Stripe API error: ${res.status}` }
    const data = await res.json()
    let imported = 0
    for (const charge of (data.data || [])) {
      if (charge.status !== 'succeeded') continue
      try {
        db.prepare(`INSERT OR IGNORE INTO platform_transactions 
          (integration_id, business_id, external_id, platform, type, amount, currency, description, customer_email, date, raw_data)
          VALUES (?, ?, ?, 'stripe', 'sale', ?, ?, ?, ?, ?, ?)`
        ).run(integrationId, businessId, charge.id,
          charge.amount / 100, (charge.currency || 'aud').toUpperCase(),
          charge.description || charge.statement_descriptor || 'Stripe sale',
          charge.billing_details?.email || '',
          new Date(charge.created * 1000).toISOString().split('T')[0],
          JSON.stringify({ id: charge.id, amount: charge.amount, currency: charge.currency }))
        imported++
      } catch {}
    }
    return { imported }
  } catch (e: unknown) {
    return { error: String(e) }
  }
}

async function syncPayPal(integrationId: number, businessId: number, creds: Record<string, string>, db: ReturnType<typeof getDb>) {
  const { client_id, client_secret } = creds
  if (!client_id || !client_secret) return { error: 'Missing client_id or client_secret' }
  try {
    const tokenRes = await fetch('https://api-m.paypal.com/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${client_id}:${client_secret}`).toString('base64')}`
      },
      body: 'grant_type=client_credentials'
    })
    if (!tokenRes.ok) return { error: 'PayPal auth failed' }
    const { access_token } = await tokenRes.json()
    const end = new Date().toISOString()
    const start = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    const txRes = await fetch(
      `https://api-m.paypal.com/v1/reporting/transactions?start_date=${start}&end_date=${end}&fields=all&page_size=100`,
      { headers: { Authorization: `Bearer ${access_token}` } }
    )
    if (!txRes.ok) return { error: 'PayPal transactions fetch failed' }
    const txData = await txRes.json()
    let imported = 0
    for (const tx of (txData.transaction_details || [])) {
      const info = tx.transaction_info
      if (!info || parseFloat(info.transaction_amount?.value) <= 0) continue
      try {
        db.prepare(`INSERT OR IGNORE INTO platform_transactions
          (integration_id, business_id, external_id, platform, type, amount, currency, description, customer_email, date, raw_data)
          VALUES (?, ?, ?, 'paypal', 'sale', ?, ?, ?, ?, ?, ?)`
        ).run(integrationId, businessId, info.transaction_id,
          parseFloat(info.transaction_amount?.value || '0'),
          info.transaction_amount?.currency_code || 'AUD',
          info.transaction_subject || 'PayPal payment',
          tx.payer_info?.email_address || '',
          (info.transaction_initiation_date || '').split('T')[0],
          JSON.stringify(info))
        imported++
      } catch {}
    }
    return { imported }
  } catch (e: unknown) {
    return { error: String(e) }
  }
}

async function syncWooCommerce(integrationId: number, businessId: number, creds: Record<string, string>, db: ReturnType<typeof getDb>) {
  const { store_url, consumer_key, consumer_secret } = creds
  if (!store_url || !consumer_key || !consumer_secret) return { error: 'Missing credentials' }
  try {
    const auth = Buffer.from(`${consumer_key}:${consumer_secret}`).toString('base64')
    const res = await fetch(`${store_url.replace(/\/$/, '')}/wp-json/wc/v3/orders?per_page=100&status=completed`, {
      headers: { Authorization: `Basic ${auth}` }
    })
    if (!res.ok) return { error: `WooCommerce error: ${res.status}` }
    const orders = await res.json()
    let imported = 0
    for (const order of (orders || [])) {
      try {
        db.prepare(`INSERT OR IGNORE INTO platform_transactions
          (integration_id, business_id, external_id, platform, type, amount, currency, description, customer_name, customer_email, date, raw_data)
          VALUES (?, ?, ?, 'woocommerce', 'sale', ?, ?, ?, ?, ?, ?, ?)`
        ).run(integrationId, businessId, String(order.id),
          parseFloat(order.total || '0'),
          order.currency?.toUpperCase() || 'AUD',
          `WooCommerce Order #${order.id}`,
          `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`.trim(),
          order.billing?.email || '',
          (order.date_created || '').split('T')[0],
          JSON.stringify({ id: order.id, total: order.total, status: order.status }))
        imported++
      } catch {}
    }
    return { imported }
  } catch (e: unknown) {
    return { error: String(e) }
  }
}

async function syncShopify(integrationId: number, businessId: number, creds: Record<string, string>, db: ReturnType<typeof getDb>) {
  const { shop_domain, access_token } = creds
  if (!shop_domain || !access_token) return { error: 'Missing shop_domain or access_token' }
  try {
    const res = await fetch(
      `https://${shop_domain.replace(/\/$/, '')}/admin/api/2024-01/orders.json?status=paid&limit=100`,
      { headers: { 'X-Shopify-Access-Token': access_token } }
    )
    if (!res.ok) return { error: `Shopify error: ${res.status}` }
    const { orders } = await res.json()
    let imported = 0
    for (const order of (orders || [])) {
      try {
        db.prepare(`INSERT OR IGNORE INTO platform_transactions
          (integration_id, business_id, external_id, platform, type, amount, currency, description, customer_name, customer_email, date, raw_data)
          VALUES (?, ?, ?, 'shopify', 'sale', ?, ?, ?, ?, ?, ?, ?)`
        ).run(integrationId, businessId, String(order.id),
          parseFloat(order.total_price || '0'),
          order.currency?.toUpperCase() || 'AUD',
          `Shopify Order #${order.order_number}`,
          `${order.billing_address?.first_name || ''} ${order.billing_address?.last_name || ''}`.trim(),
          order.email || '',
          (order.created_at || '').split('T')[0],
          JSON.stringify({ id: order.id, total: order.total_price, number: order.order_number }))
        imported++
      } catch {}
    }
    return { imported }
  } catch (e: unknown) {
    return { error: String(e) }
  }
}

export async function POST(req: NextRequest) {
  const user = getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { integration_id } = await req.json()
  if (!integration_id) return NextResponse.json({ error: 'integration_id required' }, { status: 400 })
  const db = getDb()
  const integration = db.prepare('SELECT * FROM integrations WHERE id = ? AND user_id = ?').get(integration_id, user.userId) as Record<string, unknown> | undefined
  if (!integration) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const creds = JSON.parse(integration.credentials as string || '{}')
  let result: { imported?: number; error?: string } = {}

  switch (integration.platform) {
    case 'stripe': result = await syncStripe(integration.id as number, integration.business_id as number, creds, db); break
    case 'paypal': result = await syncPayPal(integration.id as number, integration.business_id as number, creds, db); break
    case 'woocommerce': result = await syncWooCommerce(integration.id as number, integration.business_id as number, creds, db); break
    case 'shopify': result = await syncShopify(integration.id as number, integration.business_id as number, creds, db); break
    default: result = { error: 'Unknown platform' }
  }

  if (!result.error) {
    db.prepare('UPDATE integrations SET last_sync = ? WHERE id = ?').run(new Date().toISOString(), integration_id)
  }

  return NextResponse.json(result)
}
