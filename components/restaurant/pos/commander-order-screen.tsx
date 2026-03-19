"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ArrowLeft, Send, Trash2, X, Search, ChevronLeft, ChevronRight,
  Plus, Minus, ShoppingCart
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════════ */

interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  taxRate: number;
  category?: string;
}

interface OrderLine {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  notes: string;
}

interface CommanderOrderScreenProps {
  tableName: string;
  sessionId: string;
  waiterName: string;
  waiterToken: string;
  tenantId: string;
  onOrderSent: () => void;
  onBack: () => void;
}

/* ═══════════════════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════════════════ */

const PRODUCTS_PER_PAGE = 12;

/* ═══════════════════════════════════════════════════════════════════════════════
   PRINT COMANDA
   ═══════════════════════════════════════════════════════════════════════════════ */

function printComanda(tableName: string, waiterName: string, items: OrderLine[]) {
  const w = window.open("", "_blank", "width=320,height=500");
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Courier New',monospace;width:260px;padding:8px;font-size:12px;color:#000}
    .c{text-align:center} .b{font-weight:bold} .line{border-top:1px dashed #000;margin:5px 0}
    .item{padding:4px 0;border-bottom:1px dotted #ccc}
    .notes{font-style:italic;font-size:10px;color:#666;margin-left:16px}
    .big{font-size:18px}
  </style></head><body>
    <div class="c b big">*** COMANDA ***</div>
    <div class="line"></div>
    <div class="b">Mesa: ${tableName}</div>
    <div>Mesero: ${waiterName}</div>
    <div style="font-size:10px;color:#555">${new Date().toLocaleString("es-MX")}</div>
    <div class="line"></div>
    ${items.map((i) => `<div class="item"><span class="b">${i.quantity}x</span> ${i.productName}${i.notes ? `<div class="notes">${i.notes}</div>` : ""}</div>`).join("")}
    <div class="line"></div>
    <div class="c b big">PREPARAR</div>
    <script>setTimeout(()=>{window.print()},300)</script>
  </body></html>`);
  w.document.close();
}

/* ═══════════════════════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════════════════════ */

export function CommanderOrderScreen({
  tableName, sessionId, waiterName, waiterToken, tenantId,
  onOrderSent, onBack,
}: CommanderOrderScreenProps) {
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [productPage, setProductPage] = useState(0);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [cart, setCart] = useState<OrderLine[]>([]);
  const [selectedCartIdx, setSelectedCartIdx] = useState<number>(-1);
  const [quantity, setQuantity] = useState(1);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);

  /* ═══════════════════════════════════════════════════════════════════════════
     FETCH CATEGORIES
     ═══════════════════════════════════════════════════════════════════════════ */

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/pos/products?limit=500");
      if (!res.ok) return;
      const data = await res.json();
      const prods: any[] = Array.isArray(data.products) ? data.products : [];
      const cats = new Set<string>();
      prods.forEach((p) => { if (p.category) cats.add(p.category); });
      setCategories(Array.from(cats).sort());
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  /* ═══════════════════════════════════════════════════════════════════════════
     FETCH PRODUCTS
     ═══════════════════════════════════════════════════════════════════════════ */

  const fetchProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (selectedCategory) params.set("category", selectedCategory);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      const res = await fetch(`/api/pos/products?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setProducts(Array.isArray(data.products) ? data.products : []);
      setProductPage(0);
    } catch { setProducts([]); }
    finally { setLoadingProducts(false); }
  }, [selectedCategory, searchQuery]);

  useEffect(() => {
    const t = setTimeout(fetchProducts, searchQuery ? 300 : 0);
    return () => clearTimeout(t);
  }, [fetchProducts, searchQuery]);

  /* ═══════════════════════════════════════════════════════════════════════════
     CART
     ═══════════════════════════════════════════════════════════════════════════ */

  const addProduct = (p: Product) => {
    const qty = quantity || 1;
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.productId === p.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], quantity: updated[idx].quantity + qty };
        setSelectedCartIdx(idx);
        return updated;
      }
      const nc = [...prev, { productId: p.id, productName: p.name, quantity: qty, unitPrice: p.price, notes: "" }];
      setSelectedCartIdx(nc.length - 1);
      return nc;
    });
    setQuantity(1);
  };

  const removeSelected = () => {
    if (selectedCartIdx < 0 || selectedCartIdx >= cart.length) return;
    setCart((prev) => prev.filter((_, i) => i !== selectedCartIdx));
    setSelectedCartIdx(-1);
  };

  const clearCart = () => {
    if (cart.length === 0) return;
    setShowClearConfirm(true);
  };

  const confirmClearCart = () => {
    setCart([]);
    setSelectedCartIdx(-1);
    setShowClearConfirm(false);
  };

  /* ═══════════════════════════════════════════════════════════════════════════
     SEND TO KITCHEN
     ═══════════════════════════════════════════════════════════════════════════ */

  const handleSend = async () => {
    if (cart.length === 0) return;
    setSending(true);
    setError(null);

    const hdrs: Record<string, string> = {
      "Content-Type": "application/json",
      "x-tenant-id": tenantId,
      "x-waiter-token": waiterToken,
    };

    try {
      const orderRes = await fetch("/api/restaurant/orders", {
        method: "POST", headers: hdrs,
        body: JSON.stringify({
          sessionId,
          items: cart.map((l) => ({ productId: l.productId, quantity: l.quantity, unitPrice: l.unitPrice, notes: l.notes || null })),
        }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error || "No se pudo crear la orden");

      const kitchenRes = await fetch(`/api/restaurant/orders/${orderData.id}/send-kitchen`, { method: "POST", headers: hdrs });
      if (!kitchenRes.ok) {
        const kd = await kitchenRes.json();
        throw new Error(kd.error || "No se pudo enviar a cocina");
      }

      printComanda(tableName, waiterName, cart);
      setCart([]);
      setSelectedCartIdx(-1);
      onOrderSent();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  /* ═══════════════════════════════════════════════════════════════════════════
     COMPUTED
     ═══════════════════════════════════════════════════════════════════════════ */

  const totalPages = Math.max(1, Math.ceil(products.length / PRODUCTS_PER_PAGE));
  const pagedProducts = products.slice(productPage * PRODUCTS_PER_PAGE, (productPage + 1) * PRODUCTS_PER_PAGE);
  const cartTotal = cart.reduce((s, l) => s + l.quantity * l.unitPrice, 0);

  const gridCells: (Product | null)[] = [
    ...pagedProducts,
    ...Array(Math.max(0, PRODUCTS_PER_PAGE - pagedProducts.length)).fill(null),
  ];

  /* ═══════════════════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════════════════ */

  return (
    <div className="flex h-full bg-slate-950 text-white font-sans overflow-hidden select-none">

      {/* Confirm clear cart */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowClearConfirm(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="bg-slate-800 border-b border-slate-700 px-5 py-3">
              <h3 className="text-white font-bold text-sm">Limpiar comanda</h3>
            </div>
            <div className="p-5">
              <p className="text-slate-300 text-sm mb-4 text-center">¿Eliminar todos los productos de la comanda?</p>
              <div className="flex gap-2">
                <button onClick={() => setShowClearConfirm(false)} className="flex-1 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm font-semibold text-slate-300 hover:bg-slate-700">No</button>
                <button onClick={confirmClearCart} className="flex-1 py-2 bg-red-600 rounded-lg text-sm font-bold text-white hover:bg-red-700">Limpiar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ LEFT: ORDER PANEL ═══════════════════════════════════════════════ */}
      <div className="w-[340px] flex-shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col">

        {/* Action buttons */}
        <div className="flex gap-1.5 p-2 bg-slate-800 border-b border-slate-700">
          <button onClick={onBack} className="flex items-center gap-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-[11px] font-semibold text-slate-300 hover:bg-slate-600">
            <ArrowLeft className="w-3.5 h-3.5" /> Volver
          </button>
          <button onClick={handleSend} disabled={cart.length === 0 || sending} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 rounded-lg text-[11px] font-bold text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed">
            <Send className="w-3.5 h-3.5" /> {sending ? "Enviando..." : "Enviar a Cocina"}
          </button>
        </div>

        {/* Quantity controls */}
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-900 border-b border-slate-800">
          <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="w-8 h-8 flex items-center justify-center bg-red-600/20 border border-red-600/30 rounded-lg text-red-400 font-bold hover:bg-red-600/30">
            <Minus className="w-4 h-4" />
          </button>
          <div className="w-16 text-center text-xl font-black text-amber-400 bg-slate-800 border border-slate-700 rounded-lg py-1">{quantity}</div>
          <button onClick={() => setQuantity((q) => q + 1)} className="w-8 h-8 flex items-center justify-center bg-emerald-600/20 border border-emerald-600/30 rounded-lg text-emerald-400 font-bold hover:bg-emerald-600/30">
            <Plus className="w-4 h-4" />
          </button>
          <span className="flex-1" />
          <button onClick={removeSelected} disabled={selectedCartIdx < 0} className="flex items-center gap-1 px-2 py-1.5 bg-red-600/20 border border-red-600/30 rounded-lg text-[10px] font-bold text-red-400 hover:bg-red-600/30 disabled:opacity-30">
            <Trash2 className="w-3 h-3" /> Eliminar
          </button>
          <button onClick={clearCart} disabled={cart.length === 0} className="flex items-center gap-1 px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-[10px] font-semibold text-slate-400 hover:bg-slate-700 disabled:opacity-30">
            <X className="w-3 h-3" /> Limpiar
          </button>
        </div>

        {/* Order list header */}
        <div className="flex bg-slate-800 text-amber-500/70 text-[10px] font-bold uppercase tracking-wider border-b border-slate-700">
          <div className="w-8 px-2 py-1.5 text-center">#</div>
          <div className="w-12 px-2 py-1.5 text-center">Cant</div>
          <div className="flex-1 px-2 py-1.5">Producto</div>
          <div className="w-16 px-2 py-1.5 text-right">Importe</div>
        </div>

        {/* Order items */}
        <div className="flex-1 overflow-y-auto">
          {cart.length === 0 ? (
            <div className="p-6 text-center text-slate-600 text-xs">
              <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-30" />
              Seleccione productos del panel derecho
            </div>
          ) : cart.map((line, idx) => (
            <div key={`${line.productId}-${idx}`} onClick={() => setSelectedCartIdx(idx)} className={`flex cursor-pointer border-b border-slate-800/60 ${selectedCartIdx === idx ? "bg-amber-600/15 border-l-2 border-l-amber-500" : "hover:bg-slate-800/30"}`}>
              <div className="w-8 px-2 py-2 text-center text-slate-500 text-xs font-semibold">{idx + 1}</div>
              <div className="w-12 px-2 py-2 text-center text-white text-xs font-bold">{line.quantity}</div>
              <div className="flex-1 px-2 py-2 text-xs text-white font-medium truncate">{line.productName}</div>
              <div className="w-16 px-2 py-2 text-right text-xs text-white font-bold">${(line.quantity * line.unitPrice).toFixed(2)}</div>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-t border-slate-700">
          <span className="text-sm font-bold text-slate-400">TOTAL</span>
          <span className="text-xl font-black text-amber-400">${cartTotal.toFixed(2)}</span>
        </div>

        {/* Error */}
        {error && (
          <div className="px-3 py-2 bg-red-600/10 border-t border-red-600/30 text-red-400 text-[11px] font-semibold">{error}</div>
        )}

        {/* Footer info */}
        <div className="flex justify-between px-3 py-2 bg-slate-950 border-t border-slate-800 text-[10px] font-semibold">
          <span className="text-amber-500">Mesa {tableName}</span>
          <span className="text-slate-500">{waiterName}</span>
        </div>
      </div>

      {/* ═══ RIGHT: PRODUCT PANEL ═══════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Category tabs */}
        <div className="flex gap-1.5 p-2 bg-slate-900 border-b border-slate-800 flex-wrap">
          <button onClick={() => { setSelectedCategory(""); setSearchQuery(""); }} className={`px-3 py-2 rounded-lg text-[11px] font-bold border ${!selectedCategory ? "bg-amber-600 border-amber-700 text-white" : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600"}`}>
            TODOS
          </button>
          {categories.map((cat) => (
            <button key={cat} onClick={() => { setSelectedCategory(cat); setSearchQuery(""); }} className={`px-3 py-2 rounded-lg text-[11px] font-bold border whitespace-nowrap ${selectedCategory === cat ? "bg-amber-600 border-amber-700 text-white" : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600"}`}>
              {cat.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="px-3 py-2 bg-slate-900/50 border-b border-slate-800">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input ref={searchRef} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar producto..." className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-8 py-2 text-sm text-white outline-none focus:border-amber-500 placeholder:text-slate-600" />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Product grid */}
        <div className="flex-1 grid grid-cols-4 grid-rows-3 gap-2 p-3 overflow-hidden">
          {loadingProducts ? (
            <div className="col-span-4 row-span-3 flex items-center justify-center text-amber-500 font-semibold text-sm animate-pulse">Cargando...</div>
          ) : pagedProducts.length === 0 ? (
            <div className="col-span-4 row-span-3 flex items-center justify-center text-slate-600 font-semibold text-sm">
              {searchQuery ? "Sin resultados" : "Sin productos en esta categoría"}
            </div>
          ) : gridCells.map((product, idx) => (
            <button key={product ? product.id : `empty-${idx}`} onClick={() => product && addProduct(product)} disabled={!product} className={`rounded-xl border flex flex-col items-center justify-center gap-1.5 p-2 overflow-hidden ${product ? "bg-slate-800 border-slate-700 cursor-pointer hover:bg-amber-600/20 hover:border-amber-600/40 active:scale-[0.97]" : "bg-slate-900/50 border-slate-900 cursor-default opacity-20"}`}>
              {product && (
                <>
                  <span className="text-xs font-bold text-center text-white leading-tight line-clamp-2">{product.name}</span>
                  <span className="text-sm font-black text-amber-400">${product.price.toFixed(2)}</span>
                </>
              )}
            </button>
          ))}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-3 py-2 bg-slate-900 border-t border-slate-800 flex-shrink-0">
          <button onClick={() => setProductPage((p) => Math.max(0, p - 1))} disabled={productPage === 0} className="flex items-center gap-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs font-bold text-slate-300 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed">
            <ChevronLeft className="w-4 h-4" /> Anterior
          </button>
          <span className="text-xs font-semibold text-slate-500">
            {productPage + 1} / {totalPages} · {products.length} productos
          </span>
          <button onClick={() => setProductPage((p) => Math.min(totalPages - 1, p + 1))} disabled={productPage >= totalPages - 1} className="flex items-center gap-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs font-bold text-slate-300 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed">
            Siguiente <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
