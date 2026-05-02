// Price lookup: Open Food Facts (GTIN) + Woolworths/Coles search APIs

export interface ProductInfo {
  name: string
  brand?: string
  imageUrl?: string
  gtin?: string
}

export interface StorePrices {
  woolworths?: number | null
  coles?: number | null
  aldi?: null
  iga?: null
  bestStore?: string
  bestPrice?: number
}

export async function lookupProductByGtin(gtin: string): Promise<ProductInfo | null> {
  try {
    const res = await fetch(`https://world.openfoodfacts.org/product/${gtin}.json`, {
      next: { revalidate: 86400 },
      headers: { 'User-Agent': 'ACEWallet/1.0 (contact@acewallet.com)' },
    })
    if (!res.ok) return null
    const data = await res.json()
    if (data.status !== 1 || !data.product) return null
    const p = data.product
    return {
      name: p.product_name || p.product_name_en || '',
      brand: p.brands?.split(',')[0]?.trim(),
      imageUrl: p.image_url,
      gtin,
    }
  } catch {
    return null
  }
}

export async function lookupPricesWoolworths(searchTerm: string): Promise<number | null> {
  try {
    const encoded = encodeURIComponent(searchTerm)
    const res = await fetch(
      `https://www.woolworths.com.au/apis/ui/Search/products?searchTerm=${encoded}&pageSize=5&pageNumber=1`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          'Accept': 'application/json',
          'Referer': 'https://www.woolworths.com.au/',
        },
        next: { revalidate: 3600 },
      }
    )
    if (!res.ok) return null
    const data = await res.json()
    const products = data?.Products?.[0]?.Products || []
    if (products.length === 0) return null
    const price = products[0]?.Price || products[0]?.WasPrice
    return price ? parseFloat(price) : null
  } catch {
    return null
  }
}

export async function lookupPricesColes(searchTerm: string): Promise<number | null> {
  try {
    const encoded = encodeURIComponent(searchTerm)
    const res = await fetch(
      `https://www.coles.com.au/api/2.0.0/page/products/search?q=${encoded}&page=1`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          'Accept': 'application/json',
          'Ocp-Apim-Subscription-Key': 'ec0e6c6be3c248fb8b50d4bb867ab8e3',
        },
        next: { revalidate: 3600 },
      }
    )
    if (!res.ok) return null
    const data = await res.json()
    const results = data?.catalogGroupView?.[0]?.catalogEntryView || []
    if (results.length === 0) return null
    const price = results[0]?.price?.offerPrice
    return price ? parseFloat(price) : null
  } catch {
    return null
  }
}

export async function lookupAllPrices(searchTerm: string): Promise<StorePrices> {
  const [woolworths, coles] = await Promise.allSettled([
    lookupPricesWoolworths(searchTerm),
    lookupPricesColes(searchTerm),
  ])

  const prices: StorePrices = {
    woolworths: woolworths.status === 'fulfilled' ? woolworths.value : null,
    coles: coles.status === 'fulfilled' ? coles.value : null,
    aldi: null,
    iga: null,
  }

  // Find best price
  const candidates: [string, number][] = []
  if (prices.woolworths) candidates.push(['Woolworths', prices.woolworths])
  if (prices.coles) candidates.push(['Coles', prices.coles])

  if (candidates.length > 0) {
    candidates.sort((a, b) => a[1] - b[1])
    prices.bestStore = candidates[0][0]
    prices.bestPrice = candidates[0][1]
  }

  return prices
}
