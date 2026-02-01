'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CustomerForm } from '@/components/crm/customer-form'
import { useDebounce } from '@/lib/hooks/use-debounce'
import { formatCurrency } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'
import { useThermalPrint } from '@/lib/hooks/use-thermal-print'
import { useSession } from 'next-auth/react'
import { Search, Plus, Minus, User, ShoppingCart, X, DollarSign, CreditCard, ArrowLeftRight, Check, Printer, Copy, Bookmark, FolderOpen, Keyboard, UserPlus, Phone, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PERMISSIONS } from '@/lib/permissions'
import { InvoicePrint } from '@/components/sales/invoice-print'

interface CartItem {
  productId: string
  variantId?: string | null
  productName: string
  sku: string
  quantity: number
  unitPrice: number
  discount: number
  taxRate: number
  subtotal: number
  preparationNotes?: string
}

interface Product {
  id: string
  name: string
  sku: string
  barcode: string | null
  price: number
  taxRate: number
  trackStock: boolean
  stockLevels: Array<{ warehouseId: string; quantity: number }>
}

type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER'

type SplitPaymentLine = {
  id: string
  method: PaymentMethod
  amount: string
}

type ParkedSale = {
  id: string
  name: string
  createdAt: string
  cart: CartItem[]
  customer: any | null
  warehouseId: string
}

type DiscountOverride = {
  token: string
  expiresAt: number
  authorizedName: string
}

type OfflineQueuedSale = {
  id: string
  createdAt: string
  status: 'PENDING' | 'SENT' | 'FAILED'
  attempts?: number
  lastAttemptAt?: string
  syncedAt?: string
  lastError?: string
  lastErrorCode?: string
  conflicts?: any[]
  serverInvoiceId?: string | null
  serverInvoiceNumber?: string | null
  payload: any
  receipt: {
    provisionalInvoiceNumber: string
    number?: string
    issuedAt?: string
    items: any[]
    customer: any | null
    paymentMode: 'SINGLE' | 'SPLIT'
    paymentMethod: PaymentMethod
    cashReceived?: number | null
    payments?: Array<{ method: PaymentMethod; amount: number }>
    change?: number
    subtotal: number
    tax: number
    total: number
  }
}

async function fetchCategories() {
  const res = await fetch('/api/pos/categories')
  if (!res.ok) throw new Error('Failed to fetch categories')
  const data = await res.json()
  return data.categories || []
}

async function fetchProducts(category?: string, search?: string) {
  const params = new URLSearchParams()
  if (category) params.append('category', category)
  if (search) params.append('search', search)
  const res = await fetch(`/api/pos/products?${params}`)
  const data = await res.json().catch(() => ({} as any))
  if (!res.ok) {
    const msg = data?.error || `Error al buscar productos (${res.status})`
    const err: any = new Error(msg)
    err.status = res.status
    throw err
  }
  return data.products || []
}

async function fetchCustomers(search?: string) {
  const params = new URLSearchParams()
  if (search) params.append('search', search)
  params.append('limit', '10')
  const res = await fetch(`/api/customers?${params}`)
  if (!res.ok) throw new Error('Failed to fetch customers')
  const data = await res.json()
  return data.customers || []
}

async function fetchWarehouses() {
  const res = await fetch('/api/warehouses')
  if (!res.ok) throw new Error('Failed to fetch warehouses')
  return res.json()
}

async function fetchActiveShift() {
  const res = await fetch('/api/cash/shifts?active=true')
  if (!res.ok) throw new Error('Failed to fetch shift')
  const data = await res.json()
  return data.shifts?.[0] || null
}

async function fetchSettings() {
  const res = await fetch('/api/settings')
  if (!res.ok) return null
  const data = await res.json()
  return data.settings || null
}

async function openShift(startingCash: number) {
  const res = await fetch('/api/cash/shifts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'open', startingCash }),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || 'Failed to open shift')
  }
  return res.json()
}

export function POSScreen() {
  const { toast } = useToast()
  const { data: session } = useSession()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerDialog, setShowCustomerDialog] = useState(false)
  const [showAddCustomer, setShowAddCustomer] = useState(false)
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('')
  const [paymentMode, setPaymentMode] = useState<'SINGLE' | 'SPLIT'>('SINGLE')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH')
  const [cashReceived, setCashReceived] = useState('')
  const [splitPayments, setSplitPayments] = useState<SplitPaymentLine[]>([
    { id: 'p1', method: 'CASH', amount: '' },
  ])
  const [showShiftDialog, setShowShiftDialog] = useState(false)
  const [startingCash, setStartingCash] = useState('0')
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Hold / Parked tickets
  const [parkedSales, setParkedSales] = useState<ParkedSale[]>([])
  const [showParkDialog, setShowParkDialog] = useState(false)
  const [showParkedDialog, setShowParkedDialog] = useState(false)
  const [parkName, setParkName] = useState('')

  // Preparation Notes
  const [showPreparationNotesDialog, setShowPreparationNotesDialog] = useState(false)
  const [preparationNotesItem, setPreparationNotesItem] = useState<{ productId: string; variantId?: string | null; currentNotes?: string } | null>(null)
  const [preparationNotesInput, setPreparationNotesInput] = useState('')

  const queryClient = useQueryClient()
  const userPermissions: string[] = ((session?.user as any)?.permissions as string[]) || []
  const canApplyDiscounts = userPermissions.includes(PERMISSIONS.APPLY_DISCOUNTS) || (session?.user as any)?.isSuperAdmin
  const [discountOverride, setDiscountOverride] = useState<DiscountOverride | null>(null)
  const [showDiscountOverrideDialog, setShowDiscountOverrideDialog] = useState(false)
  const [overrideUsername, setOverrideUsername] = useState('')
  const [overridePassword, setOverridePassword] = useState('')
  const [pendingDiscountChange, setPendingDiscountChange] = useState<{ productId: string; variantId?: string | null; value: number } | null>(null)
  const isOverrideValid = !!discountOverride && discountOverride.expiresAt > Date.now()
  const canDiscountNow = canApplyDiscounts || isOverrideValid

  // Offline queue
  const [isOnline, setIsOnline] = useState(true)
  const [offlineQueue, setOfflineQueue] = useState<OfflineQueuedSale[]>([])
  const [showOfflineQueue, setShowOfflineQueue] = useState(false)
  const [syncingQueue, setSyncingQueue] = useState(false)
  const [offlineFix, setOfflineFix] = useState<{
    sourceQueuedId: string
    stockByKey: Record<string, number>
    conflictsByKey: Record<string, any>
  } | null>(null)

  const parkedStorageKey = useMemo(() => {
    const tenantId = (session?.user as any)?.tenantId || 'no-tenant'
    const userId = (session?.user as any)?.id || 'no-user'
    return `pos:parked:${tenantId}:${userId}`
  }, [session])

  const discountOverrideKey = useMemo(() => {
    const tenantId = (session?.user as any)?.tenantId || 'no-tenant'
    const userId = (session?.user as any)?.id || 'no-user'
    return `pos:discountOverride:${tenantId}:${userId}`
  }, [session])

  const offlineQueueKey = useMemo(() => {
    const tenantId = (session?.user as any)?.tenantId || 'no-tenant'
    const userId = (session?.user as any)?.id || 'no-user'
    return `pos:offlineQueue:${tenantId}:${userId}`
  }, [session])

  // Check for active shift
  const { data: activeShift, refetch: refetchShift } = useQuery({
    queryKey: ['active-shift'],
    queryFn: fetchActiveShift,
    staleTime: 30 * 1000, // 30 seconds - shift status changes
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
  })

  useEffect(() => {
    // Solo mostrar el diálogo si NO hay turno activo
    if (!activeShift) {
      setShowShiftDialog(true)
    } else {
      // Si hay turno activo, asegurarse de que el diálogo esté cerrado
      setShowShiftDialog(false)
    }
  }, [activeShift])

  // Load parked tickets
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(parkedStorageKey)
      const parsed = raw ? (JSON.parse(raw) as ParkedSale[]) : []
      setParkedSales(Array.isArray(parsed) ? parsed : [])
    } catch {
      setParkedSales([])
    }
  }, [parkedStorageKey])

  const persistParked = useCallback((next: ParkedSale[]) => {
    setParkedSales(next)
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(parkedStorageKey, JSON.stringify(next))
    } catch {
      // ignore
    }
  }, [parkedStorageKey])

  // Load discount override
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(discountOverrideKey)
      const parsed = raw ? (JSON.parse(raw) as DiscountOverride) : null
      if (parsed && typeof parsed.expiresAt === 'number' && parsed.expiresAt > Date.now()) {
        setDiscountOverride(parsed)
      } else {
        window.localStorage.removeItem(discountOverrideKey)
        setDiscountOverride(null)
      }
    } catch {
      setDiscountOverride(null)
    }
  }, [discountOverrideKey])

  const persistOverride = useCallback((ov: DiscountOverride | null) => {
    setDiscountOverride(ov)
    if (typeof window === 'undefined') return
    try {
      if (!ov) window.localStorage.removeItem(discountOverrideKey)
      else window.localStorage.setItem(discountOverrideKey, JSON.stringify(ov))
    } catch {
      // ignore
    }
  }, [discountOverrideKey])

  // Online/offline state
  useEffect(() => {
    if (typeof window === 'undefined') return
    const update = () => setIsOnline(navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  // Load offline queue
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(offlineQueueKey)
      const parsed = raw ? (JSON.parse(raw) as OfflineQueuedSale[]) : []
      setOfflineQueue(Array.isArray(parsed) ? parsed : [])
    } catch {
      setOfflineQueue([])
    }
  }, [offlineQueueKey])

  const persistOfflineQueue = useCallback((next: OfflineQueuedSale[]) => {
    setOfflineQueue(next)
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(offlineQueueKey, JSON.stringify(next))
    } catch {
      // ignore
    }
  }, [offlineQueueKey])

  const keyOfStock = useCallback((productId: string, variantId?: string | null) => {
    return `${productId}::${variantId || ''}`
  }, [])

  const scanBufferRef = useRef<string>('')
  const scanStartTsRef = useRef<number>(0)
  const scanLastTsRef = useRef<number>(0)
  const scanTimerRef = useRef<any>(null)

  const parseSyncError = useCallback((resStatus: number, data: any, fallbackMessage?: string) => {
    const message = String(data?.error || fallbackMessage || 'Error')
    const code = String(data?.code || '')
    const conflicts = Array.isArray(data?.conflicts) ? data.conflicts : []

    if (conflicts.length > 0) {
      return { message, code: code || 'CONFLICT', conflicts }
    }

    // Heuristics fallback
    if (message.toLowerCase().includes('stock insuficiente')) {
      return {
        message,
        code: 'STOCK_INSUFFICIENT',
        conflicts: [{ type: 'STOCK', message }],
      }
    }
    if (resStatus === 403 || message.toLowerCase().includes('permiso')) {
      return {
        message,
        code: code || 'PERMISSION_DENIED',
        conflicts: [{ type: 'PERMISSION', message, permission: data?.permission }],
      }
    }
    if (resStatus === 400) {
      return { message, code: code || 'VALIDATION_ERROR', conflicts: [{ type: 'VALIDATION', message }] }
    }
    return { message, code: code || 'UNKNOWN', conflicts: [{ type: 'UNKNOWN', message }] }
  }, [])

  const removeQueuedSale = useCallback((id: string) => {
    persistOfflineQueue(offlineQueue.filter((x) => x.id !== id))
  }, [offlineQueue, persistOfflineQueue])

  const addCartLine = useCallback((line: {
    productId: string
    variantId?: string | null
    productName: string
    sku: string
    unitPrice: number
    taxRate: number
    trackStock: boolean
    stockLevels: Array<{ warehouseId: string; quantity: number }>
  }) => {
    const warehouseStock = line.stockLevels.find((sl) => sl.warehouseId === selectedWarehouse)
    const availableStock = warehouseStock?.quantity ?? 0
    const key = keyOfStock(line.productId, line.variantId || null)

    const existing = cart.find((item) => keyOfStock(item.productId, (item.variantId as any) || null) === key)
    if (existing) {
      const newQty = existing.quantity + 1
      if (line.trackStock && warehouseStock && newQty > availableStock) {
        toast(`Stock insuficiente. Disponible: ${availableStock}`, 'warning')
        return
      }
      updateCartItemQuantity(existing.productId, newQty, existing.variantId || null)
    } else {
      const subtotal = line.unitPrice * (1 + (line.taxRate || 0) / 100)
      setCart([
        ...cart,
        {
          productId: line.productId,
          variantId: line.variantId || null,
          productName: line.productName,
          sku: line.sku,
          quantity: 1,
          unitPrice: line.unitPrice,
          discount: 0,
          taxRate: line.taxRate || 0,
          subtotal,
        },
      ])
    }

    setSearchQuery('')
    searchInputRef.current?.focus()
  }, [cart, keyOfStock, selectedWarehouse, toast])

  const scanLookup = useCallback(async (raw: string) => {
    const code = String(raw || '').trim()
    if (!code) throw new Error('Código vacío')
    if (!selectedWarehouse) throw new Error('Seleccione un almacén antes de escanear')

    const res = await fetch(
      `/api/pos/scan?code=${encodeURIComponent(code)}&warehouseId=${encodeURIComponent(selectedWarehouse)}`
    )
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.error || 'Producto no encontrado')
    return data
  }, [selectedWarehouse])

  const handleBarcodeScan = useCallback(async (raw: string, opts?: { silent?: boolean }) => {
    try {
      const data = await scanLookup(raw)

      if (data.kind === 'VARIANT') {
        const displayName = `${data.product.name} • ${data.variant.name}`
        const sku = data.variant.sku || data.product.sku
        const unitPrice = typeof data.variant.price === 'number' ? data.variant.price : data.product.price
        addCartLine({
          productId: data.product.id,
          variantId: data.variant.id,
          productName: displayName,
          sku,
          unitPrice,
          taxRate: data.product.taxRate,
          trackStock: data.product.trackStock,
          stockLevels: data.stockLevels || [],
        })
      } else {
        addCartLine({
          productId: data.product.id,
          variantId: null,
          productName: data.product.name,
          sku: data.product.sku,
          unitPrice: data.product.price,
          taxRate: data.product.taxRate,
          trackStock: data.product.trackStock,
          stockLevels: data.stockLevels || [],
        })
      }
    } catch (e: any) {
      if (!opts?.silent) {
        toast(e?.message || 'Producto no encontrado', 'error')
      }
      throw e
    }
  }, [addCartLine, scanLookup, toast])

  // Barcode scanner (keyboard wedge): capture fast key bursts ending with Enter
  useEffect(() => {
    if (typeof window === 'undefined') return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return

      const target = e.target as HTMLElement | null
      const typing = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || (target as any).isContentEditable)
      const isSearchInput = typeof document !== 'undefined' && document.activeElement === searchInputRef.current

      const key = e.key
      const now = Date.now()

      // reset buffer if user is typing slowly
      const gap = now - (scanLastTsRef.current || 0)
      if (gap > 120) {
        scanBufferRef.current = ''
        scanStartTsRef.current = 0
      }
      scanLastTsRef.current = now

      if (key === 'Enter') {
        const code = scanBufferRef.current
        scanBufferRef.current = ''
        const start = scanStartTsRef.current || 0
        scanStartTsRef.current = 0
        if (scanTimerRef.current) clearTimeout(scanTimerRef.current)
        scanTimerRef.current = null

        // Only treat as scan when it really looks like a scanner burst:
        // - digits-only (retail EAN/UPC style) to avoid breaking normal search typing
        // - length >= 6 (supports internal codes) and typed very fast
        const duration = start ? now - start : 999999
        const avgMs = code?.length ? duration / code.length : 999999
        const looksLikeBarcode = !!code && /^\d{6,}$/.test(code) && duration <= 500 && avgMs <= 60

        // If user is typing in other inputs (cash, discount, etc.), never hijack Enter.
        // If typing in search input, only hijack when it clearly looks like a barcode.
        if (looksLikeBarcode && (!typing || isSearchInput)) {
          e.preventDefault()
          e.stopPropagation()
          handleBarcodeScan(code)
        }
        return
      }

      // Don't collect keystrokes from other input fields (prevents breaking forms)
      if (typing && !isSearchInput) return

      if (key.length === 1 && /[0-9A-Za-z]/.test(key)) {
        if (!scanBufferRef.current) {
          scanStartTsRef.current = now
        }
        scanBufferRef.current += key
        if (scanTimerRef.current) clearTimeout(scanTimerRef.current)
        scanTimerRef.current = setTimeout(() => {
          scanBufferRef.current = ''
          scanStartTsRef.current = 0
        }, 200)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      if (scanTimerRef.current) clearTimeout(scanTimerRef.current)
    }
  }, [handleBarcodeScan])

  const loadQueuedSaleToPOS = useCallback((id: string) => {
    const item = offlineQueue.find((x) => x.id === id)
    if (!item) return

    setCart(item.receipt.items || [])
    setSelectedCustomer(item.receipt.customer || null)
    setSelectedWarehouse(item.payload?.warehouseId || selectedWarehouse)
    setOfflineFix(null)

    if (item.payload?.payments?.length) {
      setPaymentMode('SPLIT')
      setSplitPayments(
        item.payload.payments.map((p: any, idx: number) => ({
          id: `p${idx + 1}`,
          method: p.method,
          amount: String(p.amount),
        }))
      )
    } else {
      setPaymentMode('SINGLE')
      setPaymentMethod(item.payload?.paymentMethod || 'CASH')
      setCashReceived(item.payload?.cashReceived ? String(item.payload.cashReceived) : '')
    }

    // PRO: if failed with conflicts, fetch current stock for fast fixes and keep conflict context
    const conflictsByKey: Record<string, any> = {}
      ; (item.conflicts || []).forEach((c: any) => {
        if (c?.type === 'STOCK' && c?.productId) {
          const k = keyOfStock(String(c.productId), c?.variantId || null)
          conflictsByKey[k] = c
        }
      })

    if (isOnline && item.payload?.warehouseId && item.receipt.items?.length) {
      const toCheck = item.receipt.items.map((ci: any) => ({ productId: ci.productId, variantId: ci.variantId || null }))
      fetch('/api/inventory/stock-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ warehouseId: item.payload.warehouseId, items: toCheck }),
      })
        .then((r) => r.json().then((j) => ({ ok: r.ok, status: r.status, json: j })))
        .then(({ ok, json }) => {
          if (!ok) return
          setOfflineFix({
            sourceQueuedId: item.id,
            stockByKey: json?.stock || {},
            conflictsByKey,
          })
        })
        .catch(() => {
          // ignore
        })
    } else if (Object.keys(conflictsByKey).length) {
      setOfflineFix({
        sourceQueuedId: item.id,
        stockByKey: {},
        conflictsByKey,
      })
    }

    removeQueuedSale(id)
    setShowOfflineQueue(false)
    toast('Venta cargada al POS para corrección', 'success')
    searchInputRef.current?.focus()
  }, [offlineQueue, removeQueuedSale, selectedWarehouse, toast, isOnline, keyOfStock])

  const syncSingleQueuedSale = useCallback(async (id: string) => {
    if (!isOnline) {
      toast('No hay conexión a internet', 'warning')
      return
    }
    const item = offlineQueue.find((x) => x.id === id)
    if (!item) return

    const now = new Date().toISOString()
    const attempts = Number(item.attempts || 0) + 1

    // Optimistic update: mark attempt
    persistOfflineQueue(
      offlineQueue.map((x) => (x.id === id ? { ...x, status: 'PENDING', attempts, lastAttemptAt: now, lastError: undefined } : x))
    )

    try {
      const res = await fetch('/api/pos/sale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const parsed = parseSyncError(res.status, data, 'Sync failed')
        throw Object.assign(new Error(parsed.message), { _sync: parsed })
      }

      // Success: remove from queue
      removeQueuedSale(id)

      // refresh common views
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      queryClient.invalidateQueries({ queryKey: ['pos-products'] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['activity-feed'] })
      queryClient.invalidateQueries({ queryKey: ['stock-levels'] })
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] })
      queryClient.invalidateQueries({ queryKey: ['low-stock'] })
      refetchShift()

      toast(`Venta sincronizada: ${data?.invoiceNumber || 'OK'}`, 'success')
    } catch (e: any) {
      const sync = e?._sync
      const msg = String(sync?.message || e?.message || 'Error')
      persistOfflineQueue(
        offlineQueue.map((x) =>
          x.id === id
            ? { ...x, status: 'FAILED', attempts, lastAttemptAt: now, lastError: msg, lastErrorCode: sync?.code, conflicts: sync?.conflicts }
            : x
        )
      )
      toast(`No se pudo sincronizar: ${msg}`, 'error')
    }
  }, [isOnline, offlineQueue, persistOfflineQueue, removeQueuedSale, queryClient, refetchShift, toast])

  // Debounce search to avoid excessive queries (live while typing, but safer vs rate-limit)
  const debouncedSearchQuery = useDebounce(searchQuery, 250)

  const { data: categories = [] } = useQuery({
    queryKey: ['pos-categories'],
    queryFn: fetchCategories,
    staleTime: 10 * 60 * 1000, // 10 minutes - categories rarely change
    gcTime: 30 * 60 * 1000,
  })

  const {
    data: products = [],
    isLoading: loadingProducts,
    isFetching: fetchingProducts,
    isError: productsIsError,
    error: productsError,
    refetch: refetchProducts,
  } = useQuery({
    queryKey: ['pos-products', selectedCategory, debouncedSearchQuery],
    queryFn: () => fetchProducts(selectedCategory || undefined, debouncedSearchQuery || undefined),
    staleTime: 5 * 1000,
    gcTime: 2 * 60 * 1000,
    placeholderData: (prev) => prev,
    refetchOnWindowFocus: false,
    retry: (failureCount, err: any) => {
      const status = err?.status
      if (status === 401 || status === 403 || status === 429) return false
      return failureCount < 1
    },
  })

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: fetchWarehouses,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000,
  })

  useEffect(() => {
    if (warehouses.length > 0 && !selectedWarehouse) {
      setSelectedWarehouse(warehouses[0].id)
    }
  }, [warehouses, selectedWarehouse])

  const { data: settings } = useQuery({
    queryKey: ['pos-settings'],
    queryFn: fetchSettings,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })

  // Debounce customer search
  const debouncedCustomerSearch = useDebounce(customerSearch, 300)

  const { data: customerResults = [] } = useQuery({
    queryKey: ['customer-search', debouncedCustomerSearch],
    queryFn: () => fetchCustomers(debouncedCustomerSearch),
    enabled: debouncedCustomerSearch.length > 2 && showCustomerDialog,
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 2 * 60 * 1000,
  })

  const openShiftMutation = useMutation({
    mutationFn: (cash: number) => openShift(cash),
    onSuccess: () => {
      setShowShiftDialog(false)
      setStartingCash('0')
      refetchShift()
    },
    onError: (error: any) => {
      console.error('Error opening shift:', error)
      toast(`Error al abrir turno: ${error.message || 'Error desconocido'}`, 'error')
    },
  })

  const [saleResult, setSaleResult] = useState<any>(null)
  const [showReceipt, setShowReceipt] = useState(false)
  const [autoPrintPending, setAutoPrintPending] = useState(false)
  const [voiding, setVoiding] = useState(false)
  const { print: printThermal } = useThermalPrint({ targetId: 'pos-thermal-print', widthMm: 80 })

  const computeTotalsFromCart = useCallback((items: CartItem[]) => {
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100)), 0)
    const tax = items.reduce((sum, item) => {
      const base = item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100)
      return sum + (base * (item.taxRate || 0) / 100)
    }, 0)
    return { subtotal, tax, total: subtotal + tax }
  }, [])

  const enqueueOfflineSale = useCallback((payload: any) => {
    const now = new Date()
    const id = `${now.getTime()}`
    const totals = computeTotalsFromCart(cart)
    const normalizedSplit = splitPayments
      .map((p) => ({ method: p.method, amount: parseFloat(p.amount || '0') }))
      .filter((p) => !isNaN(p.amount) && p.amount > 0)
    const paidTotal = normalizedSplit.reduce((sum, p) => sum + p.amount, 0)

    const provisionalInvoiceNumber = `OFF-${now.getTime()}`
    const queued: any = {
      id,
      createdAt: now.toISOString(),
      status: 'PENDING',
      attempts: 0,
      payload,
      receipt: {
        provisionalInvoiceNumber,
        number: provisionalInvoiceNumber,
        issuedAt: now.toISOString(),
        items: cart.map(item => ({
          ...item,
          product: { name: item.productName, sku: item.sku }
        })),
        customer: selectedCustomer,
        paymentMode,
        paymentMethod,
        payments: paymentMode === 'SPLIT' ? normalizedSplit : undefined,
        cashReceived: paymentMode === 'SINGLE' && paymentMethod === 'CASH' ? parseFloat(cashReceived || '0') : null,
        change: paymentMode === 'SPLIT' ? Math.max(0, paidTotal - totals.total) : undefined,
        subtotal: totals.subtotal,
        tax: totals.tax,
        total: totals.total,
      },
    }
    const next = [queued, ...offlineQueue].slice(0, 50)
    persistOfflineQueue(next)

    // Show provisional receipt + clear cart for next customer
    setSaleResult({
      invoiceId: null,
      invoiceNumber: provisionalInvoiceNumber,
      number: provisionalInvoiceNumber,
      issuedAt: now.toISOString(),
      total: totals.total,
      subtotal: totals.subtotal,
      tax: totals.tax,
      change: queued.receipt.change || 0,
      offline: true,
      queuedId: id,
      items: cart.map(item => ({
        ...item,
        product: { name: item.productName, sku: item.sku }
      })),
      customer: selectedCustomer,
      paymentMode,
      paymentMethod,
      payments: paymentMode === 'SPLIT' ? normalizedSplit : null,
      paidTotal: paymentMode === 'SPLIT' ? paidTotal : null,
      cashReceived: paymentMode === 'SINGLE' && paymentMethod === 'CASH' ? parseFloat(cashReceived || '0') : null,
    })
    setShowReceipt(true)
    // Auto-print disabled - user must click print button manually
    // setAutoPrintPending(true)

    setCart([])
    setSearchQuery('')
    setCashReceived('')
    setSelectedCustomer(null)
    setPaymentMode('SINGLE')
    setPaymentMethod('CASH')
    setSplitPayments([{ id: 'p1', method: 'CASH', amount: '' }])
    searchInputRef.current?.focus()

    toast('Sin internet: venta guardada y pendiente de sincronizar', 'warning')
  }, [
    cart,
    cashReceived,
    computeTotalsFromCart,
    offlineQueue,
    paymentMethod,
    paymentMode,
    persistOfflineQueue,
    selectedCustomer,
    splitPayments,
    toast,
  ])

  const syncOfflineQueue = useCallback(async () => {
    if (!isOnline) {
      toast('No hay conexión a internet', 'warning')
      return
    }
    if (offlineQueue.length === 0) {
      toast('No hay ventas pendientes', 'success')
      return
    }
    if (syncingQueue) return
    setSyncingQueue(true)
    try {
      // oldest-first
      const ordered = [...offlineQueue].reverse()
      const kept: OfflineQueuedSale[] = []
      let okCount = 0
      for (const item of ordered) {
        try {
          const attempts = Number(item.attempts || 0) + 1
          const lastAttemptAt = new Date().toISOString()
          const res = await fetch('/api/pos/sale', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.payload),
          })
          const data = await res.json().catch(() => ({}))
          if (!res.ok) {
            const parsed = parseSyncError(res.status, data, 'Sync failed')
            kept.push({
              ...item,
              status: 'FAILED',
              attempts,
              lastAttemptAt,
              lastError: parsed.message,
              lastErrorCode: parsed.code,
              conflicts: parsed.conflicts,
            })
            continue
          }
          // success: drop from queue
          okCount += 1
        } catch (e: any) {
          const msg = e?.message || 'Error'
          kept.push({
            ...item,
            status: 'FAILED',
            attempts: Number(item.attempts || 0) + 1,
            lastAttemptAt: new Date().toISOString(),
            lastError: msg,
            lastErrorCode: 'UNKNOWN',
            conflicts: [{ type: 'UNKNOWN', message: msg }],
          })
        }
      }
      // keep only failed/pending items (oldest-first kept, but store newest-first for UI)
      persistOfflineQueue(kept.reverse())

      // refresh common views
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      queryClient.invalidateQueries({ queryKey: ['pos-products'] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['activity-feed'] })
      queryClient.invalidateQueries({ queryKey: ['stock-levels'] })
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] })
      queryClient.invalidateQueries({ queryKey: ['low-stock'] })
      refetchShift()

      if (kept.length === 0) {
        toast('Sincronización completada', 'success')
      } else {
        toast(`Sincronización: OK ${okCount} · quedan ${kept.length} pendiente(s)`, 'warning')
      }
    } finally {
      setSyncingQueue(false)
    }
  }, [isOnline, offlineQueue, syncingQueue, persistOfflineQueue, queryClient, refetchShift, toast])

  // Auto-sync when connection returns
  useEffect(() => {
    if (isOnline && offlineQueue.length > 0) {
      // fire and forget
      syncOfflineQueue()
    }
  }, [isOnline]) // intentionally omit deps to avoid loops

  const saleMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/pos/sale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create sale')
      }
      return res.json()
    },
    onSuccess: (data) => {
      // Store sale result and show receipt
      const normalizedSplit = splitPayments
        .map((p) => ({ method: p.method, amount: parseFloat(p.amount || '0') }))
        .filter((p) => !isNaN(p.amount) && p.amount > 0)
      const paidTotal = normalizedSplit.reduce((sum, p) => sum + p.amount, 0)

      setSaleResult({
        ...data,
        number: data.invoiceNumber,
        issuedAt: new Date().toISOString(),
        items: cart.map(item => ({
          ...item,
          product: { name: item.productName, sku: item.sku }
        })),
        customer: selectedCustomer,
        paymentMode,
        paymentMethod,
        payments: paymentMode === 'SPLIT' ? normalizedSplit : null,
        paidTotal: paymentMode === 'SPLIT' ? paidTotal : null,
        cashReceived: paymentMode === 'SINGLE' && paymentMethod === 'CASH' ? parseFloat(cashReceived) : null,
        change: data.change || 0,
      })
      setShowReceipt(true)
      setAutoPrintPending(true)

      // Clear cart and reset form
      setCart([])
      setSearchQuery('')
      setCashReceived('')
      setSelectedCustomer(null)
      setPaymentMode('SINGLE')
      setPaymentMethod('CASH')
      setSplitPayments([{ id: 'p1', method: 'CASH', amount: '' }])

      // Focus search for next sale
      if (searchInputRef.current) {
        searchInputRef.current.focus()
      }

      // Invalidate queries to refresh data
      // Invalidar todas las queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-monthly-report'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-top-products'] })
      queryClient.invalidateQueries({ queryKey: ['pos-products'] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['activity-feed'] })
      queryClient.invalidateQueries({ queryKey: ['stock-levels'] })
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] })
      queryClient.invalidateQueries({ queryKey: ['low-stock'] })
      refetchShift()
    },
    onError: (error: any, variables: any) => {
      // Network/offline: queue sale
      const msg = String(error?.message || '')
      if (!isOnline || msg.toLowerCase().includes('failed to fetch')) {
        enqueueOfflineSale(variables)
        return
      }
      toast(`Error al procesar la venta: ${error.message || 'Error desconocido'}`, 'error')
      console.error('Sale error:', error)
    },
  })

  const addToCart = (product: Product) => {
    addCartLine({
      productId: product.id,
      variantId: null,
      productName: product.name,
      sku: product.sku,
      unitPrice: product.price,
      taxRate: product.taxRate,
      trackStock: product.trackStock,
      stockLevels: product.stockLevels || [],
    })
  }

  const updateCartItemQuantity = (productId: string, quantity: number, variantId?: string | null) => {
    setCart(cart.map(item => {
      if (item.productId === productId && (item.variantId || null) === (variantId || null)) {
        const newQty = Math.max(1, quantity)
        const subtotal = newQty * item.unitPrice * (1 - item.discount / 100) * (1 + item.taxRate / 100)
        return { ...item, quantity: newQty, subtotal }
      }
      return item
    }))
  }

  const updateCartItemDiscount = (productId: string, discount: number, variantId?: string | null) => {
    setCart(cart.map(item => {
      if (item.productId === productId && (item.variantId || null) === (variantId || null)) {
        const clamped = Math.max(0, Math.min(100, discount))
        const subtotal = item.quantity * item.unitPrice * (1 - clamped / 100) * (1 + item.taxRate / 100)
        return { ...item, discount: clamped, subtotal }
      }
      return item
    }))
  }

  const removeFromCart = (productId: string, variantId?: string | null) => {
    setCart(cart.filter(item => !(item.productId === productId && (item.variantId || null) === (variantId || null))))
  }

  const updateCartItemNotes = useCallback((productId: string, preparationNotes: string, variantId?: string | null) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.productId !== productId || item.variantId !== (variantId || null)) return item
        return { ...item, preparationNotes: preparationNotes || undefined }
      })
    )
  }, [])

  const openPreparationNotesDialog = useCallback((item: CartItem) => {
    setPreparationNotesItem({ productId: item.productId, variantId: item.variantId || null, currentNotes: item.preparationNotes || '' })
    setPreparationNotesInput(item.preparationNotes || '')
    setShowPreparationNotesDialog(true)
  }, [])

  const savePreparationNotes = useCallback(() => {
    if (!preparationNotesItem) return
    updateCartItemNotes(preparationNotesItem.productId, preparationNotesInput.trim(), preparationNotesItem.variantId)
    setShowPreparationNotesDialog(false)
    setPreparationNotesItem(null)
    setPreparationNotesInput('')
    toast('Notas guardadas', 'success')
  }, [preparationNotesItem, preparationNotesInput, updateCartItemNotes, toast])

  const calculateTotals = () => {
    const subtotal = cart.reduce((sum, item) => {
      const itemSubtotal = item.quantity * item.unitPrice * (1 - item.discount / 100)
      return sum + itemSubtotal
    }, 0)
    const tax = cart.reduce((sum, item) => {
      const itemSubtotal = item.quantity * item.unitPrice * (1 - item.discount / 100)
      return sum + (itemSubtotal * item.taxRate / 100)
    }, 0)
    return { subtotal, tax, total: subtotal + tax }
  }

  const handleCheckout = () => {
    // Validations
    if (cart.length === 0) {
      toast('El carrito está vacío', 'warning')
      return
    }

    if (!selectedWarehouse) {
      toast('Seleccione un almacén', 'warning')
      return
    }

    // Todos los métodos de pago requieren turno de caja abierto (quedan registrados en el cierre)
    if (!activeShift) {
      toast('Debes abrir un turno de caja primero', 'warning')
      setShowShiftDialog(true)
      return
    }

    if (paymentMode === 'SINGLE' && paymentMethod === 'CASH') {
      const total = calculateTotals().total
      const received = parseFloat(cashReceived || '0')

      if (!cashReceived || isNaN(received) || received < total) {
        toast(`El efectivo recibido (${formatCurrency(received)}) debe ser mayor o igual al total (${formatCurrency(total)})`, 'warning')
        return
      }
    }

    // Validate cart items
    const validItems = cart.map(item => {
      if (!item.productId || !item.quantity || !item.unitPrice) {
        throw new Error(`Item inválido: ${item.productName}`)
      }
      return {
        productId: item.productId,
        variantId: item.variantId || null,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        discount: Number(item.discount || 0),
        taxRate: Number(item.taxRate || 0),
      }
    })

    // Prepare sale data
    const saleData: any = {
      customerId: selectedCustomer?.id,
      warehouseId: selectedWarehouse,
      items: validItems,
      discount: 0,
    }

    const hasDiscounts = validItems.some((it: any) => (it.discount || 0) > 0)
    if (hasDiscounts && !canApplyDiscounts && isOverrideValid && discountOverride?.token) {
      saleData.discountOverrideToken = discountOverride.token
    }

    if (paymentMode === 'SPLIT') {
      const normalized = splitPayments
        .map((p) => ({ method: p.method, amount: parseFloat(p.amount || '0') }))
        .filter((p) => !isNaN(p.amount) && p.amount > 0)

      if (normalized.length === 0) {
        toast('Agrega al menos un pago válido', 'warning')
        return
      }

      const total = calculateTotals().total
      const paid = normalized.reduce((sum, p) => sum + p.amount, 0)
      if (paid < total) {
        toast(`Falta pagar: ${formatCurrency(total - paid)}`, 'warning')
        return
      }

      saleData.payments = normalized
    } else {
      saleData.paymentMethod = paymentMethod
      // Add cash received only if payment is CASH
      if (paymentMethod === 'CASH') {
        const received = parseFloat(cashReceived || '0')
        if (!isNaN(received) && received > 0) {
          saleData.cashReceived = received
        }
      }
    }

    // Add cash received only if payment is CASH (legacy)
    if (paymentMode === 'SINGLE' && paymentMethod === 'CASH') {
      const received = parseFloat(cashReceived || '0')
      if (!isNaN(received) && received > 0) {
        saleData.cashReceived = received
      }
    }

    if (!isOnline) {
      enqueueOfflineSale(saleData)
      return
    }

    saleMutation.mutate(saleData)
  }

  const totals = calculateTotals()
  const splitPaid = splitPayments
    .map((p) => parseFloat(p.amount || '0'))
    .filter((n) => !isNaN(n) && n > 0)
    .reduce((sum, n) => sum + n, 0)

  const change = paymentMode === 'SPLIT'
    ? Math.max(0, splitPaid - totals.total)
    : (paymentMethod === 'CASH' && cashReceived
      ? Math.max(0, parseFloat(cashReceived) - totals.total)
      : 0)

  // Focus search on mount
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [])

  // Auto-print disabled - user must click print button manually
  // useEffect(() => {
  //   if (showReceipt && autoPrintPending && typeof window !== 'undefined') {
  //     const id = setTimeout(() => {
  //       try {
  //         printThermal()
  //       } catch {
  //         toast('No se pudo iniciar la impresión automática', 'error')
  //       } finally {
  //         setAutoPrintPending(false)
  //       }
  //     }, 300)
  //     return () => clearTimeout(id)
  //   }
  // }, [showReceipt, autoPrintPending, printThermal, toast])

  // Buscar por teclado: Enter agrega (SKU/código exacto si existe; si no, agrega el primer resultado por nombre)
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return
    const q = (searchQuery || '').trim()
    if (!q) return
    e.preventDefault()

    // Prefer exact match by SKU/barcode (fast + deterministic)
    void handleBarcodeScan(q, { silent: true })
      .catch(() => {
        // Fallback (nombre): si hay resultados filtrados, agrega el primero
        if (products.length > 0) addToCart(products[0])
      })
  }

  // Hold helpers
  const parkCurrentSale = useCallback(() => {
    if (cart.length === 0) {
      toast('No hay productos para parkear', 'warning')
      return
    }
    setParkName(`Ticket ${parkedSales.length + 1}`)
    setShowParkDialog(true)
  }, [cart.length, parkedSales.length, toast])

  const confirmPark = useCallback(() => {
    if (cart.length === 0) {
      setShowParkDialog(false)
      return
    }
    const name = (parkName || '').trim() || `Ticket ${parkedSales.length + 1}`
    const next: ParkedSale[] = [
      {
        id: `${Date.now()}`,
        name,
        createdAt: new Date().toISOString(),
        cart,
        customer: selectedCustomer,
        warehouseId: selectedWarehouse,
      },
      ...parkedSales,
    ].slice(0, 20) // límite simple para evitar crecer infinito
    persistParked(next)
    setShowParkDialog(false)
    setCart([])
    setSelectedCustomer(null)
    setSearchQuery('')
    setCashReceived('')
    setPaymentMode('SINGLE')
    setPaymentMethod('CASH')
    setSplitPayments([{ id: 'p1', method: 'CASH', amount: '' }])
    toast(`Venta parqueada: ${name}`, 'success')
    searchInputRef.current?.focus()
  }, [cart, parkName, parkedSales, persistParked, selectedCustomer, selectedWarehouse, toast])

  const resumeParked = useCallback((id: string) => {
    const found = parkedSales.find(p => p.id === id)
    if (!found) return
    setCart(found.cart || [])
    setSelectedCustomer(found.customer || null)
    setSelectedWarehouse(found.warehouseId || selectedWarehouse)
    // remover al cargar (evita duplicados y confusión)
    persistParked(parkedSales.filter(p => p.id !== id))
    setShowParkedDialog(false)
    toast(`Ticket cargado: ${found.name}`, 'success')
    searchInputRef.current?.focus()
  }, [parkedSales, persistParked, selectedWarehouse, toast])

  const deleteParked = useCallback((id: string) => {
    persistParked(parkedSales.filter(p => p.id !== id))
  }, [parkedSales, persistParked])

  // Keyboard shortcuts (mostrador)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || (target as any).isContentEditable)

      // Ctrl+K -> focus search
      if (e.ctrlKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
        return
      }

      // F4 -> checkout (aunque esté escribiendo)
      if (e.key === 'F4') {
        e.preventDefault()
        handleCheckout()
        return
      }

      // Ctrl+P -> park ticket (no imprimir)
      if (e.ctrlKey && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        parkCurrentSale()
        return
      }

      // No interferir con escritura normal
      if (typing) return
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleCheckout, parkCurrentSale])

  if (!activeShift && !showShiftDialog) {
    return null
  }

  return (
    <div className="h-[calc(100vh-60px)] flex flex-col bg-background">
      {/* Shift Dialog - Solo mostrar si NO hay turno activo */}
      <Dialog open={showShiftDialog && !activeShift} onOpenChange={(open) => {
        if (!open && !activeShift) {
          // Prevent closing if no shift is open
          return
        }
        setShowShiftDialog(open)
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Abrir Turno de Caja</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Efectivo Inicial</label>
              <Input
                type="number"
                step="0.01"
                value={startingCash}
                onChange={(e) => setStartingCash(e.target.value)}
                placeholder="0.00"
                autoFocus
              />
            </div>
            <Button
              className="w-full"
              onClick={() => openShiftMutation.mutate(parseFloat(startingCash) || 0)}
              disabled={openShiftMutation.isPending}
            >
              {openShiftMutation.isPending ? 'Abriendo...' : 'Abrir Turno'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Panel - Products */}
        <div className="w-full lg:w-2/3 flex flex-col border-r bg-background">
          {/* Warehouse Selector and Search Bar */}
          <div className="p-4 border-b bg-background space-y-3">
            {/* Warehouse Selector */}
            {warehouses.length > 1 && (
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium whitespace-nowrap">Almacén:</label>
                <select
                  value={selectedWarehouse}
                  onChange={(e) => setSelectedWarehouse(e.target.value)}
                  className="px-3 py-2 border rounded-md bg-background text-sm flex-1"
                >
                  {warehouses.map((wh: any) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                ref={searchInputRef}
                placeholder="Buscar por nombre, SKU o código de barras... (Enter para agregar)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="pl-10 h-12 text-lg"
                autoFocus
              />
            </div>
          </div>

          {/* Categories */}
          <div className="p-4 border-b bg-muted/50 overflow-x-auto">
            <div className="flex gap-2">
              <Button
                variant={selectedCategory === '' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory('')}
              >
                Todos
              </Button>
              {categories.map((cat: string) => (
                <Button
                  key={cat}
                  variant={selectedCategory === cat ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </Button>
              ))}
            </div>
          </div>

          {/* Products Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {productsIsError ? (
              <div className="text-center text-gray-500 py-12 space-y-3">
                <div className="font-medium text-foreground">No se pudieron cargar los productos</div>
                <div className="text-sm text-gray-500">
                  {(productsError as any)?.message || 'Intenta nuevamente'}
                </div>
                <Button variant="outline" onClick={() => refetchProducts()}>
                  Reintentar
                </Button>
              </div>
            ) : loadingProducts ? (
              <div className="text-center text-gray-500 py-12">Cargando productos...</div>
            ) : products.length === 0 ? (
              <div className="text-center text-gray-500 py-12">
                {searchQuery ? 'No se encontraron productos' : 'Selecciona una categoría o busca un producto'}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {products.map((product: Product) => {
                  const warehouseStock = product.stockLevels.find(sl => sl.warehouseId === selectedWarehouse)
                  const availableStock = warehouseStock?.quantity || 0
                  const hasStock = !product.trackStock || availableStock > 0

                  return (
                    <button
                      key={product.id}
                      onClick={() => hasStock && addToCart(product)}
                      disabled={!hasStock}
                      className={`p-4 border rounded-lg text-left hover:bg-muted transition-colors ${!hasStock ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                        }`}
                    >
                      <div className="font-semibold text-sm mb-1">{product.name}</div>
                      <div className="text-xs text-gray-500 mb-2">{product.sku}</div>
                      <div className="text-lg font-bold text-blue-600">{formatCurrency(product.price)}</div>
                      {product.trackStock && (
                        <div className="text-xs text-gray-400 mt-1">
                          Stock: {availableStock}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
            {fetchingProducts && !loadingProducts && !productsIsError && (
              <div className="text-center text-xs text-gray-400 mt-4">
                Actualizando resultados...
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Cart & Payment */}
        <div className="w-full lg:w-1/3 flex flex-col bg-background min-h-0 border-t lg:border-t-0">
          {/* Customer Selection - Compact */}
          <div className="p-2 border-b flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <span className="text-sm text-muted-foreground truncate">
                {selectedCustomer ? selectedCustomer.name : 'Cliente General'}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCustomerDialog(true)}
              className="h-7 px-2 flex-shrink-0"
            >
              {selectedCustomer ? 'Cambiar' : 'Seleccionar'}
            </Button>
          </div>

          {/* Cart */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="p-2 border-b bg-muted/50 flex-shrink-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  <h3 className="font-semibold text-sm">Carrito ({cart.length})</h3>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant={offlineQueue.length > 0 ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => setShowOfflineQueue(true)}
                    title={isOnline ? 'Ventas pendientes de sincronizar' : 'Sin conexión'}
                  >
                    Pendientes ({offlineQueue.length})
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => setShowParkedDialog(true)}
                    title="Tickets parqueados"
                  >
                    <FolderOpen className="h-4 w-4 mr-1" />
                    Tickets
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={parkCurrentSale}
                    title="Parkear venta (Ctrl+P)"
                  >
                    <Bookmark className="h-4 w-4 mr-1" />
                    Parkear
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 min-h-0">
              {cart.length === 0 ? (
                <div className="text-center text-gray-500 py-12">
                  <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>El carrito está vacío</p>
                  <p className="text-sm mt-2">Agrega productos desde el panel izquierdo</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {cart.map((item) => {
                    const conflictKey = keyOfStock(String(item.productId), item.variantId || null)
                    const conflict = offlineFix?.conflictsByKey?.[conflictKey]
                    const stockKey = keyOfStock(String(item.productId), item.variantId || null)
                    const availableNow = offlineFix?.stockByKey?.[stockKey]
                    const hasStockConflict = conflict?.type === 'STOCK'
                    const suggestedQty =
                      typeof availableNow === 'number'
                        ? Math.max(0, Math.floor(availableNow))
                        : typeof conflict?.available === 'number'
                          ? Math.max(0, Math.floor(conflict.available))
                          : null

                    return (
                      <div
                        key={item.productId}
                        className={[
                          'border rounded-lg p-3 bg-background shadow-sm hover:shadow transition-shadow',
                          hasStockConflict ? 'border-red-300 bg-red-50/40' : '',
                        ].join(' ')}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1 min-w-0 pr-2">
                            <div className="font-semibold text-sm mb-0.5 truncate">{item.productName}</div>
                            <div className="text-xs text-gray-500">SKU: {item.sku}</div>
                            <div className="text-xs text-gray-600 mt-0.5">
                              {formatCurrency(item.unitPrice)} c/u
                            </div>
                            {hasStockConflict && (
                              <div className="mt-2 rounded-md border border-red-200 bg-background p-2">
                                <div className="text-xs font-semibold text-red-700">Conflicto: stock insuficiente</div>
                                <div className="text-xs text-red-700 mt-0.5">
                                  Disponible: <span className="font-semibold">{typeof availableNow === 'number' ? availableNow : conflict?.available ?? '—'}</span>{' '}
                                  · Solicitado: <span className="font-semibold">{conflict?.requested ?? item.quantity}</span>
                                </div>
                                <div className="mt-2 flex items-center gap-2">
                                  {typeof suggestedQty === 'number' && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 px-2"
                                      onClick={() => updateCartItemQuantity(item.productId, suggestedQty, item.variantId || null)}
                                    >
                                      Ajustar a {suggestedQty}
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-red-700 hover:bg-red-100"
                                    onClick={() => removeFromCart(item.productId, item.variantId || null)}
                                  >
                                    Quitar item
                                  </Button>
                                </div>
                              </div>
                            )}
                            <div className="mt-2 flex items-center gap-2">
                              <span className="text-[11px] text-gray-500">Descuento %</span>
                              <Input
                                type="number"
                                step="1"
                                min={0}
                                max={100}
                                value={String(item.discount ?? 0)}
                                onChange={(e) => {
                                  const v = parseFloat(e.target.value || '0')
                                  const next = isNaN(v) ? 0 : v
                                  if (!canDiscountNow && next > 0) {
                                    setPendingDiscountChange({ productId: item.productId, variantId: item.variantId || null, value: next })
                                    setShowDiscountOverrideDialog(true)
                                    return
                                  }
                                  updateCartItemDiscount(item.productId, next, item.variantId || null)
                                }}
                                disabled={!canDiscountNow}
                                className="h-7 w-20 text-xs"
                              />
                              {!canDiscountNow && (
                                <span className="text-[11px] text-gray-400">Sin permiso</span>
                              )}
                            </div>
                            {/* Preparation Notes Button */}
                            <div className="mt-2 flex items-center gap-2">
                              <Button
                                variant={item.preparationNotes ? 'default' : 'outline'}
                                size="sm"
                                className={`h-7 px-2 text-xs ${item.preparationNotes ? 'bg-orange-500 hover:bg-orange-600' : ''}`}
                                onClick={() => openPreparationNotesDialog(item)}
                                title="Notas de preparación"
                              >
                                <MessageSquare className="h-3.5 w-3.5 mr-1" />
                                {item.preparationNotes ? 'Editar notas' : 'Agregar notas'}
                              </Button>
                              {item.preparationNotes && (
                                <span className="text-[10px] text-orange-600 font-medium truncate max-w-[120px]" title={item.preparationNotes}>
                                  {item.preparationNotes}
                                </span>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFromCart(item.productId, item.variantId || null)}
                            className="h-7 w-7 p-0 flex-shrink-0 hover:bg-red-50 hover:text-red-600"
                            title="Eliminar del carrito"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => updateCartItemQuantity(item.productId, item.quantity - 1, item.variantId || null)}
                              disabled={item.quantity <= 1}
                              title="Disminuir cantidad"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </Button>
                            <div className="w-10 text-center">
                              <span className="text-base font-semibold">{item.quantity}</span>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => updateCartItemQuantity(item.productId, item.quantity + 1, item.variantId || null)}
                              title="Aumentar cantidad"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <div className="text-right">
                            <div className="text-base font-bold text-blue-600">
                              {formatCurrency(item.subtotal)}
                            </div>
                            {item.discount > 0 && (
                              <div className="text-xs text-green-600">
                                -{item.discount}%
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Payment Section - Improved UX */}
          <div className="border-t bg-gradient-to-b from-muted/30 to-background p-4 flex-shrink-0 space-y-4">
            {/* Totals - Prominent */}
            <div className="bg-card rounded-lg border-2 border-primary/20 p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Subtotal</span>
                <span className="text-sm font-medium">{formatCurrency(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">IVA</span>
                <span className="text-sm font-medium">{formatCurrency(totals.tax)}</span>
              </div>
              <div className="border-t pt-2 mt-2">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold">Total</span>
                  <span className="text-2xl font-bold text-blue-600">{formatCurrency(totals.total)}</span>
                </div>
              </div>
              {paymentMode === 'SINGLE' && paymentMethod === 'CASH' && change > 0 && (
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="text-sm font-semibold text-green-600">Cambio</span>
                  <span className="text-lg font-bold text-green-600">{formatCurrency(change)}</span>
                </div>
              )}
            </div>

            {/* Payment Mode Toggle */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Método de Pago</span>
              <Button
                variant={paymentMode === 'SPLIT' ? 'default' : 'outline'}
                size="sm"
                className="h-8 px-3"
                onClick={() => setPaymentMode(paymentMode === 'SPLIT' ? 'SINGLE' : 'SPLIT')}
              >
                {paymentMode === 'SPLIT' ? 'Mixto' : 'Simple'}
              </Button>
            </div>

            {/* Payment Methods */}
            {paymentMode === 'SINGLE' ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant={paymentMethod === 'CASH' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPaymentMethod('CASH')}
                    className="flex flex-col items-center gap-1 h-14 py-2"
                  >
                    <DollarSign className="h-5 w-5" />
                    <span className="text-xs font-medium">Efectivo</span>
                  </Button>
                  <Button
                    variant={paymentMethod === 'CARD' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPaymentMethod('CARD')}
                    className="flex flex-col items-center gap-1 h-14 py-2"
                  >
                    <CreditCard className="h-5 w-5" />
                    <span className="text-xs font-medium">Tarjeta</span>
                  </Button>
                  <Button
                    variant={paymentMethod === 'TRANSFER' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPaymentMethod('TRANSFER')}
                    className="flex flex-col items-center gap-1 h-14 py-2"
                  >
                    <ArrowLeftRight className="h-5 w-5" />
                    <span className="text-xs font-medium">Transferencia</span>
                  </Button>
                </div>
                {paymentMethod === 'CASH' && (
                  <div>
                    <label className="text-xs font-medium text-foreground mb-1.5 block">Efectivo Recibido</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      placeholder="0.00"
                      className="h-10 text-base font-semibold"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleCheckout()
                        }
                      }}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">Pagos Mixtos</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => {
                      setSplitPayments((prev) => [
                        ...prev,
                        { id: `p${Date.now()}`, method: 'CARD', amount: '' },
                      ])
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Agregar
                  </Button>
                </div>
                <div className="space-y-2">
                  {splitPayments.map((p) => (
                    <div key={p.id} className="flex items-center gap-2">
                      <select
                        value={p.method}
                        onChange={(e) => {
                          const nextMethod = e.target.value as PaymentMethod
                          setSplitPayments((prev) => prev.map((x) => (x.id === p.id ? { ...x, method: nextMethod } : x)))
                        }}
                        className="h-10 rounded-md border border-input bg-background px-3 text-sm flex-1"
                      >
                        <option value="CASH">Efectivo</option>
                        <option value="CARD">Tarjeta</option>
                        <option value="TRANSFER">Transferencia</option>
                      </select>
                      <Input
                        type="number"
                        step="0.01"
                        value={p.amount}
                        onChange={(e) => {
                          const val = e.target.value
                          setSplitPayments((prev) => prev.map((x) => (x.id === p.id ? { ...x, amount: val } : x)))
                        }}
                        placeholder="0.00"
                        className="h-10 text-sm flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-10 w-10 p-0"
                        onClick={() => setSplitPayments((prev) => prev.filter((x) => x.id !== p.id))}
                        disabled={splitPayments.length <= 1}
                        title="Quitar"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="bg-muted rounded-lg p-3 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Pagado:</span>
                    <span className={splitPaid >= totals.total ? 'text-green-600 font-bold' : 'text-orange-600 font-semibold'}>
                      {formatCurrency(splitPaid)}
                    </span>
                  </div>
                  {splitPaid < totals.total && (
                    <div className="flex justify-between text-sm">
                      <span className="text-orange-600">Falta:</span>
                      <span className="text-orange-600 font-bold">{formatCurrency(totals.total - splitPaid)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Discount Authorization - Only if needed */}
            {!canApplyDiscounts && !isOverrideValid && (
              <Button
                variant="outline"
                size="sm"
                className="w-full h-9 text-xs"
                onClick={() => setShowDiscountOverrideDialog(true)}
              >
                Autorizar Descuentos
              </Button>
            )}

            {/* Checkout Button - Prominent */}
            <Button
              className="w-full h-12 text-base font-bold shadow-lg"
              onClick={handleCheckout}
              disabled={
                cart.length === 0 ||
                saleMutation.isPending ||
                !activeShift ||
                (paymentMode === 'SPLIT' && splitPaid < totals.total)
              }
              title={
                !activeShift
                  ? 'Debes abrir un turno de caja para procesar cualquier pago'
                  : undefined
              }
            >
              {saleMutation.isPending ? (
                'Procesando...'
              ) : (
                <>
                  <Check className="h-5 w-5 mr-2" />
                  Finalizar Venta
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Customer Selection Dialog */}
      <Dialog open={showCustomerDialog} onOpenChange={setShowCustomerDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Seleccionar Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre, NIT o teléfono..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="pl-9"
                  autoFocus
                />
              </div>

              {customerResults.length > 0 ? (
                <div className="border rounded-lg max-h-60 overflow-y-auto divide-y shadow-sm">
                  {customerResults.map((customer: any) => (
                    <button
                      key={customer.id}
                      onClick={() => {
                        setSelectedCustomer(customer)
                        setShowCustomerDialog(false)
                        setCustomerSearch('')
                      }}
                      className="w-full text-left p-3 hover:bg-muted transition-colors"
                    >
                      <div className="font-medium text-sm">{customer.name}</div>
                      <div className="flex gap-2 mt-0.5">
                        {customer.taxId && (
                          <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100 font-medium">
                            NIT: {customer.taxId}
                          </span>
                        )}
                        {customer.phone && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Phone className="h-2.5 w-2.5" />
                            {customer.phone}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              ) : customerSearch.length > 2 ? (
                <div className="p-8 text-center border-2 border-dashed rounded-lg bg-muted/30">
                  <UserPlus className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                  <p className="text-sm font-medium mb-1">No se encontró el cliente</p>
                  <p className="text-xs text-muted-foreground mb-4">¿Deseas registrarlo como nuevo?</p>
                  <Button
                    size="sm"
                    onClick={() => {
                      setShowCustomerDialog(false)
                      setShowAddCustomer(true)
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Registrar "{customerSearch}"
                  </Button>
                </div>
              ) : (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Ingresa al menos 3 caracteres para buscar
                </div>
              )}
            </div>

            <div className="flex gap-2 border-t pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setSelectedCustomer(null)
                  setShowCustomerDialog(false)
                  setCustomerSearch('')
                }}
              >
                Venta sin Cliente
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  setShowCustomerDialog(false)
                  setShowAddCustomer(true)
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Cliente
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Customer Dialog */}
      <Dialog open={showAddCustomer} onOpenChange={setShowAddCustomer}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Registrar Nuevo Cliente</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <CustomerForm
              customer={customerSearch ? {
                // Heuristic: if it looks like a number, it might be taxId
                name: /^\d+$/.test(customerSearch) ? '' : customerSearch,
                taxId: /^\d+$/.test(customerSearch) ? customerSearch : ''
              } : null}
              onSuccess={() => {
                setShowAddCustomer(false)
                setCustomerSearch('')
                queryClient.invalidateQueries({ queryKey: ['customer-search'] })
                toast('Cliente registrado correctamente', 'success')
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-b">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-2">
                <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <DialogTitle className="text-2xl font-bold text-green-700 dark:text-green-400">
                ¡Venta Completada!
              </DialogTitle>
              {saleResult?.offline && (
                <div className="mt-2 inline-block px-3 py-1 text-xs font-semibold text-orange-700 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400 rounded-full">
                  PENDIENTE DE SINCRONIZAR
                </div>
              )}
            </div>
          </DialogHeader>
          {saleResult && (
            <div className="space-y-0">
              {/* Receipt Header */}
              <div className="px-6 pt-6 pb-4 text-center bg-gradient-to-b from-muted/50 to-background">
                <div className="text-2xl font-bold text-foreground mb-1">
                  {settings?.companyName || 'Sin Nombre de Empresa'}
                </div>
                {settings?.companyNit && (
                  <div className="text-sm text-muted-foreground font-medium">
                    NIT: {settings.companyNit}
                  </div>
                )}
                {settings?.companyAddress && (
                  <div className="text-xs text-muted-foreground mt-2">
                    {settings.companyAddress}
                  </div>
                )}
                {settings?.companyPhone && (
                  <div className="text-xs text-muted-foreground">
                    Tel: {settings.companyPhone}
                  </div>
                )}
              </div>

              {/* Sale Info */}
              <div className="px-6 py-4 space-y-3 bg-card">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="flex flex-col">
                    <span className="text-muted-foreground text-xs mb-1">Factura</span>
                    <span className="font-semibold text-foreground">{saleResult.invoiceNumber}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-muted-foreground text-xs mb-1">Fecha</span>
                    <span className="font-medium text-foreground">{new Date().toLocaleString('es-CO', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}</span>
                  </div>
                </div>
                {saleResult.customer && (
                  <div className="flex flex-col pt-2 border-t">
                    <span className="text-muted-foreground text-xs mb-1">Cliente</span>
                    <span className="font-medium text-foreground">{saleResult.customer.name}</span>
                  </div>
                )}
                <div className="flex flex-col pt-2 border-t">
                  <span className="text-muted-foreground text-xs mb-1">Método de Pago</span>
                  {saleResult.paymentMode === 'SPLIT' && Array.isArray(saleResult.payments) ? (
                    <div>
                      <span className="font-medium text-foreground">Mixto</span>
                      <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                        {saleResult.payments.map((p: any, idx: number) => (
                          <div key={idx}>
                            {p.method === 'CASH' ? 'Efectivo' : p.method === 'CARD' ? 'Tarjeta' : 'Transferencia'}: {formatCurrency(p.amount)}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <span className="font-medium text-foreground">
                      {saleResult.paymentMethod === 'CASH' ? 'Efectivo' :
                        saleResult.paymentMethod === 'CARD' ? 'Tarjeta' : 'Transferencia'}
                    </span>
                  )}
                </div>
              </div>

              {/* Receipt Body for UI */}
              <div className="px-6 py-4 space-y-6">
                <div id="pos-thermal-print" className="hidden">
                  <InvoicePrint invoice={saleResult} settings={settings} />
                </div>

                {/* Items Summary in UI */}
                <div className="border-t border-b py-4 bg-muted/20 -mx-6 px-6">
                  <div className="text-sm font-semibold mb-3 text-foreground">Productos</div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {saleResult.items.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-start text-sm py-1">
                        <span className="flex-1 text-foreground">{item.productName || item.product?.name} <span className="text-muted-foreground">x{item.quantity}</span></span>
                        <span className="font-medium text-foreground ml-4">{formatCurrency(item.subtotal)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Totals in UI */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-lg font-semibold text-foreground">Total</span>
                    <span className="text-2xl font-bold text-primary">{formatCurrency(saleResult.total)}</span>
                  </div>
                  {(saleResult.paymentMethod === 'CASH' || saleResult.paymentMode === 'SINGLE') && saleResult.cashReceived && (
                    <>
                      <div className="flex justify-between text-sm pt-1">
                        <span className="text-muted-foreground">Recibido</span>
                        <span className="font-medium text-foreground">{formatCurrency(saleResult.cashReceived)}</span>
                      </div>
                      {saleResult.change > 0 && (
                        <div className="flex justify-between items-center pt-2 border-t">
                          <span className="text-base font-semibold text-green-600">Cambio</span>
                          <span className="text-lg font-bold text-green-600">{formatCurrency(saleResult.change)}</span>
                        </div>
                      )}
                    </>
                  )}
                  {saleResult.paymentMode === 'SPLIT' && saleResult.change > 0 && (
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="text-base font-semibold text-green-600">Cambio</span>
                      <span className="text-lg font-bold text-green-600">{formatCurrency(saleResult.change)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="px-6 py-4 border-t bg-muted/30">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      printThermal()
                    }}
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Imprimir
                  </Button>
                  <Button
                    variant="destructive"
                    className="w-full"
                    disabled={voiding || !saleResult?.invoiceId}
                    onClick={async () => {
                      const reason = prompt('Motivo de anulación/devolución (obligatorio):') || ''
                      if (reason.trim().length < 3) {
                        toast('Motivo inválido', 'warning')
                        return
                      }
                      if (!confirm(`¿Anular la factura ${saleResult.invoiceNumber}?`)) return
                      try {
                        setVoiding(true)
                        const res = await fetch(`/api/invoices/${saleResult.invoiceId}/void`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ reason }),
                        })
                        const payload = await res.json().catch(() => ({}))
                        if (!res.ok) throw new Error(payload?.error || 'No se pudo anular')
                        toast('Venta anulada correctamente', 'success')
                        queryClient.invalidateQueries({ queryKey: ['invoices'] })
                        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
                        queryClient.invalidateQueries({ queryKey: ['activity-feed'] })
                        queryClient.invalidateQueries({ queryKey: ['stock-levels'] })
                        queryClient.invalidateQueries({ queryKey: ['inventory-movements'] })
                        setShowReceipt(false)
                        setSaleResult(null)
                      } catch (e: any) {
                        toast(e?.message || 'Error al anular', 'error')
                      } finally {
                        setVoiding(false)
                      }
                    }}
                  >
                    {voiding ? 'Anulando…' : 'Anular'}
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      // Copy receipt info
                      const receiptText = `
Ferretería - Punto de Venta
Factura: ${saleResult.invoiceNumber}
Fecha: ${new Date().toLocaleString('es-CO')}
${saleResult.customer ? `Cliente: ${saleResult.customer.name}` : ''}
Total: ${formatCurrency(saleResult.total)}
${saleResult.change > 0 ? `Cambio: ${formatCurrency(saleResult.change)}` : ''}
                    `.trim()
                      navigator.clipboard.writeText(receiptText)
                      toast('Información copiada al portapapeles', 'success')
                    }}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar
                  </Button>
                  <Button
                    className="w-full"
                    onClick={() => {
                      setShowReceipt(false)
                      setSaleResult(null)
                    }}
                  >
                    Continuar
                  </Button>
                </div>
              </div>
          )}
            </DialogContent>
      </Dialog>

      {/* Park Sale Dialog */}
      <Dialog open={showParkDialog} onOpenChange={setShowParkDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Parkear Venta</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-gray-600">
              Guarda el carrito actual como ticket para retomarlo después.
            </div>
            <div>
              <label className="text-xs font-medium">Nombre del ticket</label>
              <Input
                value={parkName}
                onChange={(e) => setParkName(e.target.value)}
                placeholder="Ej: Cliente Juan / Obra X"
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowParkDialog(false)}>
                Cancelar
              </Button>
              <Button className="flex-1" onClick={confirmPark}>
                <Bookmark className="h-4 w-4 mr-2" />
                Guardar Ticket
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Parked Tickets Dialog */}
      <Dialog open={showParkedDialog} onOpenChange={setShowParkedDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Tickets Parqueados</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {parkedSales.length === 0 ? (
              <div className="text-sm text-gray-600">No hay tickets guardados.</div>
            ) : (
              <div className="border rounded-lg divide-y max-h-[420px] overflow-y-auto">
                {parkedSales.map((p) => (
                  <div key={p.id} className="p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{p.name}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(p.createdAt).toLocaleString('es-CO')} · {p.cart?.length || 0} items
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => resumeParked(p.id)}>
                        <FolderOpen className="h-4 w-4 mr-2" />
                        Cargar
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => deleteParked(p.id)} title="Eliminar ticket">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Offline Queue Dialog */}
      <Dialog open={showOfflineQueue} onOpenChange={setShowOfflineQueue}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ventas pendientes</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <div className="text-muted-foreground">
                Estado: {isOnline ? 'Conectado' : 'Sin conexión'} · Pendientes: <b>{offlineQueue.length}</b>
              </div>
              <Button
                variant="outline"
                onClick={() => syncOfflineQueue()}
                disabled={!isOnline || syncingQueue || offlineQueue.length === 0}
              >
                {syncingQueue ? 'Sincronizando…' : 'Sincronizar'}
              </Button>
            </div>

            {offlineQueue.length === 0 ? (
              <div className="text-sm text-gray-600">No hay ventas pendientes.</div>
            ) : (
              <div className="border rounded-lg divide-y max-h-[420px] overflow-y-auto">
                {offlineQueue.map((s) => (
                  <div key={s.id} className="p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{s.receipt.provisionalInvoiceNumber}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(s.createdAt).toLocaleString('es-CO')} · {s.receipt.items?.length || 0} items · Total {formatCurrency(s.receipt.total)}
                      </div>
                      <div className="text-[11px] text-gray-400 mt-1">
                        Intentos: {Number(s.attempts || 0)}{s.lastAttemptAt ? ` · Último: ${new Date(s.lastAttemptAt).toLocaleString('es-CO')}` : ''}
                      </div>
                      {s.status === 'FAILED' && (
                        <div className="text-xs text-red-600 mt-1">
                          Error: {s.lastError || 'No se pudo sincronizar'}
                        </div>
                      )}
                      {s.status === 'FAILED' && (s.conflicts?.[0]?.type === 'STOCK') && (
                        <div className="text-xs text-amber-700 mt-1">
                          Conflicto de stock detectado. Pulsa <span className="font-semibold">Cargar</span> para corregir.
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-xs font-semibold">
                        {s.status === 'FAILED' ? (
                          <span className="text-red-600">FALLÓ</span>
                        ) : (
                          <span className="text-orange-600">PENDIENTE</span>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => syncSingleQueuedSale(s.id)}
                        disabled={!isOnline || syncingQueue}
                      >
                        Reintentar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => loadQueuedSaleToPOS(s.id)}
                      >
                        Cargar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeQueuedSale(s.id)}
                        title="Eliminar de la cola"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Preparation Notes Dialog */}
      <Dialog open={showPreparationNotesDialog} onOpenChange={setShowPreparationNotesDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Notas de Preparación</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Agrega instrucciones especiales para este producto (ej: "sin cebolla", "extra queso", "bien cocido")
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Instrucciones</label>
              <textarea
                className="w-full min-h-[100px] p-3 rounded-md border border-input bg-background text-sm resize-none"
                placeholder="Ej: Sin cebolla, extra queso..."
                value={preparationNotesInput}
                onChange={(e) => setPreparationNotesInput(e.target.value)}
                maxLength={200}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.ctrlKey) {
                    savePreparationNotes()
                  }
                }}
              />
              <div className="text-xs text-gray-500 text-right">
                {preparationNotesInput.length}/200 caracteres
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => {
                setShowPreparationNotesDialog(false)
                setPreparationNotesItem(null)
                setPreparationNotesInput('')
              }}>
                Cancelar
              </Button>
              <Button onClick={savePreparationNotes}>
                <Check className="h-4 w-4 mr-2" />
                Guardar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Discount Override Dialog */}
      <Dialog open={showDiscountOverrideDialog} onOpenChange={setShowDiscountOverrideDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Autorizar descuento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Ingresa credenciales de un usuario con permisos para autorizar descuentos. La autorización dura <b>5 minutos</b>.
            </div>
            <div className="space-y-2">
              <div>
                <label className="text-xs font-medium">Usuario / Email</label>
                <Input value={overrideUsername} onChange={(e) => setOverrideUsername(e.target.value)} autoFocus />
              </div>
              <div>
                <label className="text-xs font-medium">Contraseña</label>
                <Input type="password" value={overridePassword} onChange={(e) => setOverridePassword(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowDiscountOverrideDialog(false)
                  setOverridePassword('')
                  setPendingDiscountChange(null)
                }}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1"
                disabled={!overrideUsername.trim() || !overridePassword.trim()}
                onClick={async () => {
                  try {
                    const res = await fetch('/api/pos/discount-override', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ username: overrideUsername, password: overridePassword }),
                    })
                    const data = await res.json().catch(() => ({}))
                    if (!res.ok) throw new Error(data?.error || 'No se pudo autorizar')
                    const expiresAt = Date.now() + (Number(data.expiresInSeconds || 300) * 1000)
                    persistOverride({
                      token: data.token,
                      expiresAt,
                      authorizedName: data.authorizedBy?.name || 'Autorizado',
                    })
                    toast('Descuento autorizado', 'success')
                    setShowDiscountOverrideDialog(false)
                    setOverridePassword('')
                    const pending = pendingDiscountChange
                    setPendingDiscountChange(null)
                    if (pending) {
                      updateCartItemDiscount(pending.productId, pending.value, pending.variantId || null)
                    }
                  } catch (e: any) {
                    toast(e?.message || 'Error al autorizar', 'error')
                  }
                }}
              >
                Autorizar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

