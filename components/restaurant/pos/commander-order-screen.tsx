"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ArrowLeft, Send, Trash2, X, Search, ChevronLeft, ChevronRight,
  Plus, Minus, ShoppingCart, UtensilsCrossed,
} from "lucide-react";

/* ======================================================================
   TYPES
   ====================================================================== */

interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  taxRate: number;
  category: string;
  description?: string;
  printerStation?: string;
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

const GRID_SIZE = 12;

/* ======================================================================
   PRINT
   ====================================================================== */

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

/* ======================================================================
   COMPONENT
   ====================================================================== */

export function CommanderOrderScreen({
  tableName, sessionId, waiterName, waiterToken, tenantId,
  onOrderSent, onBack,
}: CommanderOrderScreenProps) {

  // ── Product catalog state ──
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [productPage, setProductPage] = useState(0);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // ── Cart ──
  const [cart, setCart] = useState<OrderLine[]>([]);
  const [selectedCartIdx, setSelectedCartIdx] = useState<number>(-1);
  const [quantity, setQuantity] = useState(1);

  // ── Send ──
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);

  /* ====================================================================
     AUTH HEADERS (supports both waiter token and session)
     ==================================================================== */

  const authHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...(waiterToken && tenantId
      ? { "x-tenant-id": tenantId, "x-waiter-token": waiterToken }
      : {}),
  };

  /* ====================================================================
     FETCH ALL PRODUCTS ON MOUNT
     ==================================================================== */

  const fetchMenu = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const params = new URLSearchParams({ limit: "500" });
      const headers: Record<string, string> = {};
      if (waiterToken && tenantId) {
        headers["x-tenant-id"] = tenantId;
        headers["x-waiter-token"] = waiterToken;
      }
      const res = await fetch(`/api/restaurant/menu?${params}`, { headers });
      if (!res.ok) throw new Error("No se pudo cargar el menu");
      const data = await res.json();
      const prods: Product[] = Array.isArray(data.products) ? data.products : [];
      setAllProducts(prods);
      setCategories(Array.isArray(data.categories) ? data.categories : []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingProducts(false);
    }
  }, [waiterToken, tenantId]);

  useEffect(() => { fetchMenu(); }, [fetchMenu]);

  /* ====================================================================
     FILTERED + PAGED PRODUCTS
     ==================================================================== */

  const filteredProducts = allProducts.filter((p) => {
    const matchCat = !selectedCategory || p.category === selectedCategory;
    const matchSearch = !searchQuery.trim() ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / GRID_SIZE));
  const pagedProducts = filteredProducts.slice(productPage * GRID_SIZE, (productPage + 1) * GRID_SIZE);

  // Keep page in bounds when filter changes
  useEffect(() => { setProductPage(0); }, [selectedCategory, searchQuery]);

  const gridCells: (Product | null)[] = [
    ...pagedProducts,
    ...Array(Math.max(0, GRID_SIZE - pagedProducts.length)).fill(null),
  ];

  /* ====================================================================
     CART ACTIONS
     ==================================================================== */

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

  const updateCartQty = (idx: number, delta: number) => {
    setCart((prev) => prev.map((l, i) => {
      if (i !== idx) return l;
      const newQty = Math.max(1, l.quantity + delta);
      return { ...l, quantity: newQty };
    }));
  };

  const updateNotes = (idx: number, notes: string) => {
    setCart((prev) => prev.map((l, i) => i === idx ? { ...l, notes } : l));
  };

  /* ====================================================================
     SEND TO KITCHEN
     ==================================================================== */

  const handleSend = async () => {
    if (cart.length === 0) return;
    setSending(true);
    setError(null);
    try {
      const orderRes = await fetch("/api/restaurant/orders", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          sessionId,
          items: cart.map((l) => ({
            productId: l.productId,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            notes: l.notes || null,
          })),
        }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error || "No se pudo crear la orden");

      const kitchenRes = await fetch(`/api/restaurant/orders/${orderData.id}/send-kitchen`, {
        method: "POST",
        headers: authHeaders,
      });
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

  const cartTotal = cart.reduce((s, l) => s + l.quantity * l.unitPrice, 0);

  /* ====================================================================
     RENDER
     ==================================================================== */

  return (
    <div className="flex h-full bg-slate-950 text-white font-sans overflow-hidden select-none">

      {/* Confirm clear cart */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowClearConfirm(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
            <div className="bg-slate-800 border-b border-slate-700 px-5 py-3 rounded-t-2xl">
              <h3 className="text-white font-bold text-sm">Limpiar comanda</h3>
            </div>
            <div className="p-5">
              <p className="text-slate-300 text-sm mb-4 text-center">Eliminar todos los productos de la comanda?</p>
              <div className="flex gap-2">
                <button onClick={() => setShowClearConfirm(false)} className="flex-1 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm font-semibold text-slate-300 hover:bg-slate-700">No</button>
                <button onClick={() => { setCart([]); setSelectedCartIdx(-1); setShowClearConfirm(false); }} className="flex-1 py-2 bg-red-600 rounded-lg text-sm font-bold text-white hover:bg-red-700">Limpiar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          LEFT: ORDER PANEL
          ════════════════════════════════════════════════════════════ */}
      <div className="w-[300px] flex-shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col">

        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-800 border-b border-slate-700">
          <button onClick={onBack} className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-[11px] font-semibold text-slate-300 hover:bg-slate-600">
            <ArrowLeft className="w-3.5 h-3.5" /> Volver
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-black text-amber-400 truncate">Mesa {tableName}</div>
            <div className="text-[10px] text-slate-500 truncate">{waiterName}</div>
          </div>
        </div>

        {/* Quantity controls */}
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-900 border-b border-slate-800">
          <span className="text-[10px] text-slate-500 font-semibold">CANT:</span>
          <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="w-7 h-7 flex items-center justify-center bg-red-600/20 border border-red-600/30 rounded-lg text-red-400 font-bold hover:bg-red-600/30">
            <Minus className="w-3.5 h-3.5" />
          </button>
          <div className="w-12 text-center text-xl font-black text-amber-400 bg-slate-800 border border-slate-700 rounded-lg py-0.5">{quantity}</div>
          <button onClick={() => setQuantity((q) => q + 1)} className="w-7 h-7 flex items-center justify-center bg-emerald-600/20 border border-emerald-600/30 rounded-lg text-emerald-400 font-bold hover:bg-emerald-600/30">
            <Plus className="w-3.5 h-3.5" />
          </button>
          <span className="flex-1" />
          <button onClick={removeSelected} disabled={selectedCartIdx < 0} className="flex items-center gap-1 px-2 py-1 bg-red-600/20 border border-red-600/30 rounded-lg text-[10px] font-bold text-red-400 hover:bg-red-600/30 disabled:opacity-30">
            <Trash2 className="w-3 h-3" /> Quitar
          </button>
          <button onClick={() => cart.length > 0 && setShowClearConfirm(true)} disabled={cart.length === 0} className="flex items-center gap-1 px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-[10px] font-semibold text-slate-400 hover:bg-slate-700 disabled:opacity-30">
            <X className="w-3 h-3" />
          </button>
        </div>

        {/* Column headers */}
        <div className="flex bg-slate-800/60 text-amber-500/70 text-[10px] font-bold uppercase tracking-wider border-b border-slate-800">
          <div className="w-8 px-2 py-1.5 text-center">#</div>
          <div className="w-10 px-1 py-1.5 text-center">Cant</div>
          <div className="flex-1 px-2 py-1.5">Producto</div>
          <div className="w-16 px-2 py-1.5 text-right">Importe</div>
        </div>

        {/* Cart lines */}
        <div className="flex-1 overflow-y-auto">
          {cart.length === 0 ? (
            <div className="p-6 text-center text-slate-600 text-xs">
              <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-30" />
              Seleccione productos del panel derecho
            </div>
          ) : cart.map((line, idx) => (
            <div key={`${line.productId}-${idx}`} className={`border-b border-slate-800/60 cursor-pointer ${selectedCartIdx === idx ? "bg-amber-600/15 border-l-2 border-l-amber-500" : "hover:bg-slate-800/30"}`}
              onClick={() => setSelectedCartIdx(idx)}>
              <div className="flex">
                <div className="w-8 px-2 py-2 text-center text-slate-500 text-xs font-semibold">{idx + 1}</div>
                <div className="w-10 px-1 py-2">
                  <div className="flex flex-col items-center gap-0.5">
                    <button onClick={(e) => { e.stopPropagation(); updateCartQty(idx, 1); }} className="text-emerald-400 hover:text-emerald-300 text-[10px] leading-none">▲</button>
                    <span className="text-white text-xs font-bold">{line.quantity}</span>
                    <button onClick={(e) => { e.stopPropagation(); updateCartQty(idx, -1); }} className="text-red-400 hover:text-red-300 text-[10px] leading-none">▼</button>
                  </div>
                </div>
                <div className="flex-1 px-1 py-2 min-w-0">
                  <div className="text-xs text-white font-medium truncate">{line.productName}</div>
                  {selectedCartIdx === idx && (
                    <input
                      value={line.notes}
                      onChange={(e) => updateNotes(idx, e.target.value)}
                      placeholder="Notas..."
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1 w-full bg-slate-800 border border-slate-600 rounded px-1.5 py-0.5 text-[10px] text-white outline-none focus:border-amber-500"
                    />
                  )}
                </div>
                <div className="w-16 px-2 py-2 text-right text-xs text-white font-bold">${(line.quantity * line.unitPrice).toFixed(2)}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Total + Send */}
        <div className="flex items-center justify-between px-3 py-2.5 bg-slate-800 border-t border-slate-700">
          <div>
            <div className="text-[10px] text-slate-500 font-semibold">TOTAL</div>
            <div className="text-lg font-black text-amber-400">${cartTotal.toFixed(2)}</div>
          </div>
          <button onClick={handleSend} disabled={cart.length === 0 || sending}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 rounded-xl text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed">
            <Send className="w-4 h-4" /> {sending ? "Enviando..." : "Enviar"}
          </button>
        </div>

        {error && (
          <div className="px-3 py-2 bg-red-600/10 border-t border-red-600/30 text-red-400 text-[11px] font-semibold">{error}</div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════
          RIGHT: PRODUCT PANEL
          ════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Category tabs */}
        <div className="flex-shrink-0 overflow-x-auto bg-slate-900 border-b border-slate-800">
          <div className="flex gap-1 p-2 min-w-max">
            <button
              onClick={() => { setSelectedCategory(""); setSearchQuery(""); }}
              className={`px-3 py-2 rounded-lg text-[11px] font-bold border whitespace-nowrap flex items-center gap-1 ${!selectedCategory && !searchQuery ? "bg-amber-600 border-amber-700 text-white" : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600"}`}>
              <UtensilsCrossed className="w-3 h-3" /> TODOS
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => { setSelectedCategory(cat); setSearchQuery(""); }}
                className={`px-3 py-2 rounded-lg text-[11px] font-bold border whitespace-nowrap ${selectedCategory === cat ? "bg-amber-600 border-amber-700 text-white" : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600"}`}>
                {cat.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="px-3 py-2 bg-slate-900/80 border-b border-slate-800 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              ref={searchRef}
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setSelectedCategory(""); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (filteredProducts.length === 1) {
                    addProduct(filteredProducts[0]);
                    setSearchQuery("");
                  }
                }
              }}
              placeholder="Buscar..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-7 py-1.5 text-sm text-white outline-none focus:border-amber-500 placeholder:text-slate-600"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Product grid */}
        <div className="flex-1 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 p-3 overflow-y-auto">
          {loadingProducts ? (
            <div className="col-span-4 row-span-3 flex flex-col items-center justify-center gap-2 text-amber-500 text-sm">
              <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              Cargando menu...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="col-span-4 row-span-3 flex flex-col items-center justify-center gap-2 text-slate-600">
              <UtensilsCrossed className="w-10 h-10 opacity-30" />
              <span className="font-semibold text-sm">{searchQuery ? "Sin resultados" : "Sin productos en esta categoría"}</span>
            </div>
          ) : gridCells.map((product, idx) => (
            <button
              key={product ? product.id : `empty-${idx}`}
              onClick={() => product && addProduct(product)}
              disabled={!product}
              className={`rounded-xl border flex flex-col items-center justify-center gap-1 p-2 overflow-hidden transition-all ${product
                ? "bg-slate-800 border-slate-700 cursor-pointer hover:bg-amber-600/15 hover:border-amber-600/40 active:scale-[0.97]"
                : "bg-slate-900/30 border-slate-900 cursor-default"
              }`}>
              {product && (
                <>
                  <span className="text-[11px] font-bold text-center text-white leading-tight line-clamp-2">{product.name}</span>
                  <span className="text-sm font-black text-amber-400">${product.price.toFixed(2)}</span>
                </>
              )}
            </button>
          ))}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-3 py-2 bg-slate-900 border-t border-slate-800 flex-shrink-0">
          <button onClick={() => setProductPage((p) => Math.max(0, p - 1))} disabled={productPage === 0}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs font-bold text-slate-300 hover:bg-slate-700 disabled:opacity-30">
            <ChevronLeft className="w-3.5 h-3.5" /> Ant.
          </button>
          <span className="text-[10px] font-semibold text-slate-500">
            {productPage + 1}/{totalPages} &middot; {filteredProducts.length} productos
            {selectedCategory && <span className="text-amber-500 ml-1">· {selectedCategory}</span>}
          </span>
          <button onClick={() => setProductPage((p) => Math.min(totalPages - 1, p + 1))} disabled={productPage >= totalPages - 1}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs font-bold text-slate-300 hover:bg-slate-700 disabled:opacity-30">
            Sig. <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
