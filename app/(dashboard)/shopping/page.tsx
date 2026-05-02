'use client'
import { useEffect, useState } from 'react'

const fmt = (n: number | null | undefined) => n != null ? `$${n.toFixed(2)}` : '—'

const STORE_COLORS: Record<string,string> = {
  Woolworths: '#007D32',
  Coles: '#E31D24',
  Aldi: '#00509E',
  IGA: '#E4002B',
}

export default function ShoppingPage() {
  const [lists, setLists] = useState<any[]>([])
  const [activeList, setActiveList] = useState<any | null>(null)
  const [items, setItems] = useState<any[]>([])
  const [newListName, setNewListName] = useState('')
  const [gtin, setGtin] = useState('')
  const [manualName, setManualName] = useState('')
  const [qty, setQty] = useState('1')
  const [looking, setLooking] = useState(false)
  const [lookupResult, setLookupResult] = useState<any | null>(null)
  const [addingItem, setAddingItem] = useState(false)
  const [priceLoading, setPriceLoading] = useState<number | null>(null)

  async function loadLists() {
    const d = await fetch('/api/shopping/lists').then(r => r.json())
    setLists(d || [])
  }

  async function loadItems(listId: number) {
    const d = await fetch(`/api/shopping/items?list_id=${listId}`).then(r => r.json())
    setItems(d || [])
  }

  useEffect(() => { loadLists() }, [])

  useEffect(() => {
    if (activeList) loadItems(activeList.id)
  }, [activeList])

  async function createList() {
    if (!newListName.trim()) return
    const r = await fetch('/api/shopping/lists', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ name: newListName }) })
    const d = await r.json()
    setNewListName('')
    await loadLists()
    const updated = await fetch('/api/shopping/lists').then(r => r.json())
    const created = updated.find((l: any) => l.id === d.id)
    if (created) setActiveList(created)
  }

  async function lookupProduct() {
    if (!gtin.trim() && !manualName.trim()) return
    setLooking(true); setLookupResult(null)
    const params = gtin ? `gtin=${encodeURIComponent(gtin)}` : `name=${encodeURIComponent(manualName)}`
    const d = await fetch(`/api/shopping/lookup?${params}`).then(r => r.json())
    setLookupResult(d)
    setLooking(false)
    if (d?.product?.name && !manualName) setManualName(d.product.name)
  }

  async function addItem() {
    if (!activeList || !manualName.trim()) return
    setAddingItem(true)
    const r = await fetch('/api/shopping/items', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        list_id: activeList.id,
        gtin: gtin || null,
        name: manualName,
        brand: lookupResult?.product?.brand || null,
        quantity: parseFloat(qty) || 1,
      })
    })
    const newItem = await r.json()

    // Save prices if we have them
    if (lookupResult?.prices && newItem.id) {
      const p = lookupResult.prices
      await fetch('/api/shopping/items', {
        method: 'PATCH', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          id: newItem.id,
          price_woolworths: p.woolworths,
          price_coles: p.coles,
          price_aldi: p.aldi,
          price_iga: p.iga,
          best_store: p.bestStore,
          best_price: p.bestPrice,
          last_price_check: new Date().toISOString(),
        })
      })
    }

    setAddingItem(false); setGtin(''); setManualName(''); setQty('1'); setLookupResult(null)
    loadItems(activeList.id)
  }

  async function refreshPrices(item: any) {
    setPriceLoading(item.id)
    const d = await fetch(`/api/shopping/lookup?name=${encodeURIComponent(item.name)}`).then(r => r.json())
    if (d?.prices) {
      const p = d.prices
      await fetch('/api/shopping/items', {
        method: 'PATCH', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ id: item.id, price_woolworths: p.woolworths, price_coles: p.coles, price_aldi: p.aldi, price_iga: p.iga, best_store: p.bestStore, best_price: p.bestPrice, last_price_check: new Date().toISOString() })
      })
      loadItems(activeList.id)
    }
    setPriceLoading(null)
  }

  async function toggleItem(id: number, checked: boolean) {
    await fetch('/api/shopping/items', { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id, checked_off: !checked }) })
    loadItems(activeList.id)
  }

  async function deleteItem(id: number) {
    await fetch('/api/shopping/items', { method: 'DELETE', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id }) })
    loadItems(activeList.id)
  }

  // Calculate best store total
  const storeTotals: Record<string, number> = {}
  const stores = ['Woolworths','Coles','Aldi','IGA']
  stores.forEach(store => {
    const priceKey = `price_${store.toLowerCase().replace(' ','_')}` as keyof typeof items[0]
    const total = items.reduce((a, item) => {
      const p = item[priceKey]
      return p != null ? a + p * item.quantity : a
    }, 0)
    if (total > 0) storeTotals[store] = total
  })

  const bestStoreTotal = Object.entries(storeTotals).sort((a,b) => a[1]-b[1])[0]

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Shopping Lists</h1>
          <p className="text-ace-muted text-sm">Compare prices across Woolworths, Coles, Aldi & IGA</p>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Lists sidebar */}
        <div className="w-56 flex-shrink-0">
          <div className="bg-ace-card border border-ace-border rounded-xl p-4 mb-3">
            <p className="text-ace-muted text-xs mb-2">New List</p>
            <div className="flex gap-2">
              <input value={newListName} onChange={e => setNewListName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createList()}
                placeholder="List name" className="flex-1 bg-ace-bg border border-ace-border rounded-lg px-3 py-2 text-ace-text text-xs focus:outline-none focus:border-ace-cyan/50 min-w-0" />
              <button onClick={createList} className="px-3 py-2 rounded-lg bg-ace-cyan/10 text-ace-cyan text-xs border border-ace-cyan/20 hover:bg-ace-cyan/20 transition-colors flex-shrink-0">+</button>
            </div>
          </div>
          <div className="space-y-1">
            {lists.map(l => (
              <button key={l.id} onClick={() => setActiveList(l)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all ${activeList?.id === l.id ? 'bg-ace-cyan/10 text-ace-cyan border border-ace-cyan/20' : 'text-ace-muted hover:text-white hover:bg-white/5'}`}>
                <div className="flex items-center justify-between">
                  <span className="truncate">{l.name}</span>
                  <span className={`text-xs ml-1 flex-shrink-0 ${l.status === 'completed' ? 'text-ace-green' : 'text-ace-muted'}`}>
                    {l.status === 'completed' ? '✓' : ''}
                  </span>
                </div>
                <p className="text-xs text-ace-muted/60">{l.created_at?.slice(0,10)}</p>
              </button>
            ))}
            {lists.length === 0 && <p className="text-ace-muted text-xs px-2">No lists yet</p>}
          </div>
        </div>

        {/* Active list */}
        <div className="flex-1 min-w-0">
          {!activeList ? (
            <div className="bg-ace-card border border-ace-border rounded-xl flex items-center justify-center h-64">
              <p className="text-ace-muted">Select or create a shopping list</p>
            </div>
          ) : (
            <>
              <div className="bg-ace-card border border-ace-border rounded-xl p-5 mb-4">
                <h2 className="text-white font-semibold mb-4">{activeList.name}</h2>

                {/* Add item section */}
                <div className="bg-ace-bg border border-ace-border rounded-xl p-4">
                  <p className="text-ace-muted text-xs mb-3 uppercase tracking-wide">Add Item</p>
                  <div className="flex gap-2 mb-3">
                    <input value={gtin} onChange={e => setGtin(e.target.value)}
                      placeholder="Barcode / GTIN" className="w-44 bg-ace-card border border-ace-border rounded-lg px-3 py-2 text-ace-text text-sm focus:outline-none focus:border-ace-cyan/50" />
                    <span className="text-ace-muted self-center text-sm">or</span>
                    <input value={manualName} onChange={e => setManualName(e.target.value)}
                      placeholder="Product name" className="flex-1 bg-ace-card border border-ace-border rounded-lg px-3 py-2 text-ace-text text-sm focus:outline-none focus:border-ace-cyan/50" />
                    <input value={qty} onChange={e => setQty(e.target.value)}
                      type="number" min="1" step="0.1" placeholder="Qty" className="w-16 bg-ace-card border border-ace-border rounded-lg px-3 py-2 text-ace-text text-sm focus:outline-none focus:border-ace-cyan/50" />
                    <button onClick={lookupProduct} disabled={looking || (!gtin && !manualName)}
                      className="px-4 py-2 rounded-lg bg-ace-purple/10 text-ace-purple border border-ace-purple/20 text-sm hover:bg-ace-purple/20 disabled:opacity-50 transition-colors whitespace-nowrap">
                      {looking ? '...' : '🔍 Lookup'}
                    </button>
                  </div>

                  {/* Lookup result */}
                  {lookupResult && (
                    <div className="bg-ace-card border border-ace-border rounded-lg p-3 mb-3">
                      {lookupResult.product && (
                        <div className="flex items-center gap-3 mb-3">
                          {lookupResult.product.imageUrl && (
                            <img src={lookupResult.product.imageUrl} alt="" className="w-12 h-12 object-contain rounded" />
                          )}
                          <div>
                            <p className="text-white text-sm font-medium">{lookupResult.product.name}</p>
                            {lookupResult.product.brand && <p className="text-ace-muted text-xs">{lookupResult.product.brand}</p>}
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-4 gap-2">
                        {[['Woolworths', lookupResult.prices?.woolworths], ['Coles', lookupResult.prices?.coles], ['Aldi', lookupResult.prices?.aldi], ['IGA', lookupResult.prices?.iga]].map(([store, price]) => (
                          <div key={store as string} className={`rounded-lg p-2 text-center border ${lookupResult.prices?.bestStore === store ? 'border-ace-green/40 bg-ace-green/10' : 'border-ace-border bg-ace-bg'}`}>
                            <p className="text-xs text-ace-muted">{store as string}</p>
                            <p className={`text-sm font-bold ${lookupResult.prices?.bestStore === store ? 'text-ace-green' : 'text-ace-text'}`}>{fmt(price as number)}</p>
                            {lookupResult.prices?.bestStore === store && <p className="text-ace-green text-[9px]">BEST</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button onClick={addItem} disabled={addingItem || !manualName.trim()}
                    className="w-full py-2 rounded-lg bg-gradient-to-r from-ace-cyan to-ace-purple text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity">
                    {addingItem ? 'Adding...' : '+ Add to List'}
                  </button>
                </div>
              </div>

              {/* Store price totals */}
              {Object.keys(storeTotals).length > 0 && (
                <div className="bg-ace-card border border-ace-border rounded-xl p-4 mb-4">
                  <p className="text-ace-muted text-xs mb-3 uppercase tracking-wide">Total by Store</p>
                  <div className="grid grid-cols-4 gap-3">
                    {stores.map(store => storeTotals[store] != null && (
                      <div key={store} className={`rounded-xl p-3 text-center border ${bestStoreTotal?.[0] === store ? 'border-ace-green/40 bg-ace-green/10' : 'border-ace-border bg-ace-bg'}`}>
                        <div className="w-6 h-6 rounded-md mx-auto mb-1 flex items-center justify-center text-xs font-bold text-white"
                          style={{ backgroundColor: STORE_COLORS[store] }}>{store[0]}</div>
                        <p className="text-ace-muted text-xs">{store}</p>
                        <p className={`font-bold ${bestStoreTotal?.[0] === store ? 'text-ace-green' : 'text-white'}`}>{fmt(storeTotals[store])}</p>
                        {bestStoreTotal?.[0] === store && <p className="text-ace-green text-[9px]">CHEAPEST</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Items */}
              <div className="bg-ace-card border border-ace-border rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-ace-border">
                      <th className="px-4 py-3 text-left text-xs text-ace-muted">Item</th>
                      <th className="px-3 py-3 text-center text-xs text-ace-muted">Qty</th>
                      <th className="px-3 py-3 text-center text-xs text-ace-muted" style={{color:STORE_COLORS.Woolworths}}>Woolworths</th>
                      <th className="px-3 py-3 text-center text-xs text-ace-muted" style={{color:STORE_COLORS.Coles}}>Coles</th>
                      <th className="px-3 py-3 text-center text-xs text-ace-muted">Aldi</th>
                      <th className="px-3 py-3 text-center text-xs text-ace-muted">IGA</th>
                      <th className="px-3 py-3 text-center text-xs text-ace-muted">Best</th>
                      <th className="px-3 py-3 text-xs text-ace-muted"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 && (
                      <tr><td colSpan={8} className="px-4 py-12 text-center text-ace-muted text-sm">No items yet — add some above</td></tr>
                    )}
                    {items.map(item => (
                      <tr key={item.id} className={`border-b border-ace-border/50 transition-opacity ${item.checked_off ? 'opacity-40' : ''}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <input type="checkbox" checked={!!item.checked_off} onChange={() => toggleItem(item.id, !!item.checked_off)}
                              className="w-4 h-4 rounded accent-cyan-400 cursor-pointer" />
                            <div>
                              <p className={`text-sm text-ace-text ${item.checked_off ? 'line-through' : ''}`}>{item.name}</p>
                              {item.brand && <p className="text-ace-muted text-xs">{item.brand}</p>}
                              {item.gtin && <p className="text-ace-muted text-[10px] font-mono">{item.gtin}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center text-ace-muted text-sm">{item.quantity}</td>
                        <td className="px-3 py-3 text-center">
                          <span className={`text-sm ${item.best_store === 'Woolworths' ? 'text-ace-green font-bold' : 'text-ace-text'}`}>{fmt(item.price_woolworths)}</span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className={`text-sm ${item.best_store === 'Coles' ? 'text-ace-green font-bold' : 'text-ace-text'}`}>{fmt(item.price_coles)}</span>
                        </td>
                        <td className="px-3 py-3 text-center text-ace-muted text-sm">{fmt(item.price_aldi)}</td>
                        <td className="px-3 py-3 text-center text-ace-muted text-sm">{fmt(item.price_iga)}</td>
                        <td className="px-3 py-3 text-center">
                          {item.best_store && <span className="text-xs px-2 py-0.5 rounded-full bg-ace-green/10 text-ace-green border border-ace-green/20">{item.best_store}</span>}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex gap-1 justify-end">
                            <button onClick={() => refreshPrices(item)} disabled={priceLoading === item.id}
                              className="p-1.5 rounded-lg text-ace-muted hover:text-ace-cyan hover:bg-ace-cyan/10 transition-colors text-xs" title="Refresh prices">
                              {priceLoading === item.id ? '...' : '↻'}
                            </button>
                            <button onClick={() => deleteItem(item.id)}
                              className="p-1.5 rounded-lg text-ace-muted hover:text-ace-red hover:bg-ace-red/10 transition-colors text-xs">✕</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
