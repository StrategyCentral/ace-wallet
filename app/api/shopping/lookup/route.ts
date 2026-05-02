import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { lookupProductByGtin, lookupAllPrices } from '@/lib/price-lookup'

export async function GET(req: NextRequest) {
  const user = getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const gtin = searchParams.get('gtin')
  const name = searchParams.get('name')

  if (!gtin && !name) return NextResponse.json({ error: 'gtin or name required' }, { status: 400 })

  let productInfo = null
  let searchName = name || ''

  if (gtin) {
    productInfo = await lookupProductByGtin(gtin)
    if (productInfo) searchName = productInfo.name
  }

  const prices = searchName ? await lookupAllPrices(searchName) : {}

  return NextResponse.json({ product: productInfo, prices, searchName })
}
