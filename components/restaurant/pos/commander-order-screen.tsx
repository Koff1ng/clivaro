"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  taxRate: number;
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

// ─── Constants ────────────────────────────────────────────────────────────────

const PRODUCTS_PER_PAGE = 12;
const PRODUCT_COLS = 4;

// ─── Component ────────────────────────────────────────────────────────────────

export function CommanderOrderScreen({
  tableName, sessionId, waiterName, waiterToken, tenantId,
  onOrderSent, onBack,
}: CommanderOrderScreenProps) {
  // State
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

  const searchRef = useRef<HTMLInputElement>(null);

  // ── Fetch categories ────────────────────────────────────────────────────

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/pos/products?limit=500");
      if (!res.ok) return;
      const data = await res.json();
      const prods: Product[] = Array.isArray(data.products) ? data.products : [];
      const cats = new Set<string>();
      prods.forEach((p: any) => {
        if (p.category) cats.add(p.category);
      });
      setCategories(Array.from(cats).sort());
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  // ── Fetch products ──────────────────────────────────────────────────────

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

  // ── Cart actions ────────────────────────────────────────────────────────

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
      const newCart = [...prev, { productId: p.id, productName: p.name, quantity: qty, unitPrice: p.price, notes: "" }];
      setSelectedCartIdx(newCart.length - 1);
      return newCart;
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
    if (!confirm("Eliminar todos los productos de la comanda?")) return;
    setCart([]);
    setSelectedCartIdx(-1);
  };

  // ── Send to kitchen ─────────────────────────────────────────────────────

  const handleSend = async () => {
    if (cart.length === 0) return;
    setSending(true);
    setError(null);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-tenant-id": tenantId,
      "x-waiter-token": waiterToken,
    };

    try {
      const orderRes = await fetch("/api/restaurant/orders", {
        method: "POST",
        headers,
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
        headers,
      });
      if (!kitchenRes.ok) {
        const kd = await kitchenRes.json();
        throw new Error(kd.error || "No se pudo enviar a cocina");
      }

      setCart([]);
      setSelectedCartIdx(-1);
      onOrderSent();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  // ── Computed ────────────────────────────────────────────────────────────

  const totalPages = Math.max(1, Math.ceil(products.length / PRODUCTS_PER_PAGE));
  const pagedProducts = products.slice(productPage * PRODUCTS_PER_PAGE, (productPage + 1) * PRODUCTS_PER_PAGE);
  const cartTotal = cart.reduce((s, l) => s + l.quantity * l.unitPrice, 0);

  // Fill grid to always show PRODUCTS_PER_PAGE cells
  const gridCells: (Product | null)[] = [
    ...pagedProducts,
    ...Array(Math.max(0, PRODUCTS_PER_PAGE - pagedProducts.length)).fill(null),
  ];

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", height: "100%", fontFamily: "'Segoe UI', Arial, sans-serif", fontSize: 12, background: "#3D2B00", color: "#1a0a00", overflow: "hidden" }}>

      {/* ══ LEFT: ORDER PANEL ══════════════════════════════════════ */}
      <div style={{ width: 360, display: "flex", flexDirection: "column", background: "#E8D5B0", borderRight: "3px solid #A07030", flexShrink: 0 }}>

        {/* Top buttons row */}
        <div style={{ display: "flex", gap: 2, padding: "4px 4px", background: "#C8A050", borderBottom: "2px solid #A07030", flexWrap: "wrap" }}>
          {[
            { label: "RESUMEN", icon: "\uD83D\uDCCB", act: () => {}, dis: cart.length === 0 },
            { label: "ENVIAR\nCOCINA", icon: "\u2705", act: handleSend, dis: cart.length === 0 || sending, primary: true },
            { label: "CANCELAR", icon: "\u274C", act: onBack, dis: false },
          ].map((b) => (
            <button key={b.label} onClick={b.act} disabled={b.dis}
              style={{
                flex: 1, minWidth: 70, padding: "6px 4px",
                background: b.primary ? (b.dis ? "#8B6914" : "#2E7D32") : (b.dis ? "#b8902a" : "linear-gradient(180deg,#F5D060 0%,#D4A030 100%)"),
                color: b.primary ? "#fff" : (b.dis ? "#8B6914" : "#3D2B00"),
                border: `1px solid ${b.dis ? "#9a7525" : "#9a7525"}`,
                borderRadius: 4, fontWeight: 800, fontSize: 10, cursor: b.dis ? "not-allowed" : "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
                opacity: b.dis ? 0.5 : 1,
              }}
            >
              <span style={{ fontSize: 16 }}>{b.icon}</span>
              {b.label.split("\n").map((l, i) => <span key={i}>{l}</span>)}
            </button>
          ))}
        </div>

        {/* Quantity control */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 8px", background: "#F0E0B0", borderBottom: "1px solid #C8A050" }}>
          <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} style={{ width: 32, height: 32, borderRadius: 6, background: "#C0392B", color: "#fff", border: "none", fontWeight: 900, fontSize: 16, cursor: "pointer" }}>-</button>
          <div style={{ flex: 0, minWidth: 60, textAlign: "center", fontSize: 22, fontWeight: 900, color: "#3D2B00", background: "#fff", border: "2px solid #C8A050", borderRadius: 6, padding: "2px 8px" }}>{quantity.toFixed(2)}</div>
          <button onClick={() => setQuantity((q) => q + 1)} style={{ width: 32, height: 32, borderRadius: 6, background: "#2E7D32", color: "#fff", border: "none", fontWeight: 900, fontSize: 16, cursor: "pointer" }}>+</button>
          <div style={{ flex: 1 }} />
          <button onClick={removeSelected} disabled={selectedCartIdx < 0} style={{ padding: "4px 10px", background: selectedCartIdx >= 0 ? "#C0392B" : "#b8902a", color: "#fff", border: "none", borderRadius: 4, fontWeight: 700, fontSize: 10, cursor: selectedCartIdx >= 0 ? "pointer" : "not-allowed", opacity: selectedCartIdx >= 0 ? 1 : 0.4 }}>
            ELIMINAR
          </button>
          <button onClick={clearCart} disabled={cart.length === 0} style={{ padding: "4px 10px", background: cart.length > 0 ? "#8B0000" : "#b8902a", color: "#fff", border: "none", borderRadius: 4, fontWeight: 700, fontSize: 10, cursor: cart.length > 0 ? "pointer" : "not-allowed", opacity: cart.length > 0 ? 1 : 0.4 }}>
            LIMPIAR
          </button>
        </div>

        {/* Order list header */}
        <div style={{ display: "flex", background: "#C8A050", borderBottom: "1px solid #A07030" }}>
          {[{ label: "#", w: 30 }, { label: "CANT.", w: 50 }, { label: "DESCRIPCION", w: 0, flex: 1 }, { label: "IMPORTE", w: 70 }].map((col) => (
            <div key={col.label} style={{ width: col.w || undefined, flex: (col as any).flex, padding: "4px 6px", fontWeight: 800, fontSize: 10, color: "#3D2B00", borderRight: "1px solid #A07030", textAlign: col.label === "IMPORTE" ? "right" : "left" }}>{col.label}</div>
          ))}
        </div>

        {/* Order items */}
        <div style={{ flex: 1, overflow: "auto", background: "#fff" }}>
          {cart.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "#8B6914", fontSize: 11 }}>
              Seleccione productos del panel derecho
            </div>
          ) : cart.map((line, idx) => (
            <div
              key={`${line.productId}-${idx}`}
              onClick={() => setSelectedCartIdx(idx)}
              style={{
                display: "flex", borderBottom: "1px solid #E8D5B0", cursor: "pointer",
                background: selectedCartIdx === idx ? "#1565C0" : idx % 2 === 0 ? "#FFF8E7" : "#fff",
                color: selectedCartIdx === idx ? "#fff" : "#1a0a00",
              }}
            >
              <div style={{ width: 30, padding: "6px", textAlign: "center", fontWeight: 700, borderRight: "1px solid #E8D5B0" }}>{idx + 1}</div>
              <div style={{ width: 50, padding: "6px", textAlign: "center", fontWeight: 700, borderRight: "1px solid #E8D5B0" }}>{line.quantity}</div>
              <div style={{ flex: 1, padding: "6px", borderRight: "1px solid #E8D5B0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }}>{line.productName}</div>
              <div style={{ width: 70, padding: "6px", textAlign: "right", fontWeight: 700 }}>${(line.quantity * line.unitPrice).toFixed(2)}</div>
            </div>
          ))}
        </div>

        {/* Total bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#C8A050", borderTop: "2px solid #A07030" }}>
          <div style={{ fontWeight: 900, fontSize: 13, color: "#3D2B00" }}>TOTAL:</div>
          <div style={{ fontWeight: 900, fontSize: 20, color: "#C0392B" }}>${cartTotal.toFixed(2)}</div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ padding: "6px 12px", background: "#FFEBEE", color: "#C0392B", fontSize: 11, fontWeight: 700, borderTop: "1px solid #C0392B" }}>
            {error}
          </div>
        )}

        {/* Mesa / Mesero info */}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", background: "#3D2B00", color: "#F5C518", fontSize: 10, fontWeight: 700 }}>
          <span>Mesa: {tableName}</span>
          <span>{waiterName}</span>
        </div>
      </div>

      {/* ══ RIGHT: PRODUCT PANEL ═══════════════════════════════════ */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Category tabs row 1 */}
        <div style={{ display: "flex", gap: 2, padding: "4px 4px", background: "#C8A050", borderBottom: "2px solid #A07030", flexWrap: "wrap" }}>
          <button
            onClick={() => { setSelectedCategory(""); setSearchQuery(""); }}
            style={{
              padding: "8px 12px", borderRadius: 4, fontWeight: 800, fontSize: 11, cursor: "pointer",
              border: `2px solid ${!selectedCategory ? "#E87722" : "#A07030"}`,
              background: !selectedCategory ? "#E87722" : "#F5D060",
              color: !selectedCategory ? "#fff" : "#3D2B00",
              minWidth: 80,
            }}
          >
            TODOS
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => { setSelectedCategory(cat); setSearchQuery(""); }}
              style={{
                padding: "8px 12px", borderRadius: 4, fontWeight: 800, fontSize: 11, cursor: "pointer",
                border: `2px solid ${selectedCategory === cat ? "#E87722" : "#A07030"}`,
                background: selectedCategory === cat ? "#E87722" : "#F5D060",
                color: selectedCategory === cat ? "#fff" : "#3D2B00",
                minWidth: 80, whiteSpace: "nowrap",
              }}
            >
              {cat.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Search bar */}
        <div style={{ display: "flex", gap: 4, padding: "4px 6px", background: "#E8D5B0", borderBottom: "1px solid #C8A050" }}>
          <input
            ref={searchRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar producto..."
            style={{ flex: 1, padding: "6px 10px", border: "2px solid #C8A050", borderRadius: 6, fontSize: 13, fontWeight: 600, background: "#fff", color: "#3D2B00", outline: "none" }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} style={{ padding: "4px 10px", background: "#C0392B", color: "#fff", border: "none", borderRadius: 4, fontWeight: 700, cursor: "pointer" }}>X</button>
          )}
        </div>

        {/* Product grid */}
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: `repeat(${PRODUCT_COLS}, 1fr)`, gridTemplateRows: "repeat(3, 1fr)", gap: 4, padding: 6, background: "#4a3010", overflow: "hidden" }}>
          {loadingProducts ? (
            <div style={{ gridColumn: "1 / -1", gridRow: "1 / -1", display: "flex", alignItems: "center", justifyContent: "center", color: "#F5C518", fontWeight: 700, fontSize: 14 }}>
              Cargando...
            </div>
          ) : pagedProducts.length === 0 ? (
            <div style={{ gridColumn: "1 / -1", gridRow: "1 / -1", display: "flex", alignItems: "center", justifyContent: "center", color: "#A07030", fontWeight: 700, fontSize: 13 }}>
              {searchQuery ? "Sin resultados" : "Sin productos en esta categoria"}
            </div>
          ) : gridCells.map((product, idx) => (
            <button
              key={product ? product.id : `empty-${idx}`}
              onClick={() => product && addProduct(product)}
              disabled={!product}
              style={{
                background: product ? "#F5D060" : "#5a3c10",
                border: product ? "2px solid #C8A050" : "1px solid #4a3010",
                borderRadius: 8, cursor: product ? "pointer" : "default",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 4, padding: 6, overflow: "hidden", transition: "all 0.1s",
                opacity: product ? 1 : 0.3,
              }}
              onMouseOver={(e) => { if (product) { e.currentTarget.style.background = "#E87722"; e.currentTarget.style.color = "#fff"; } }}
              onMouseOut={(e) => { if (product) { e.currentTarget.style.background = "#F5D060"; e.currentTarget.style.color = "#3D2B00"; } }}
            >
              {product && (
                <>
                  <span style={{ fontSize: 13, fontWeight: 800, textAlign: "center", lineHeight: 1.2, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any, wordBreak: "break-word" }}>
                    {product.name}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 900, color: "#C0392B" }}>${product.price.toFixed(2)}</span>
                </>
              )}
            </button>
          ))}
        </div>

        {/* Pagination */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px", background: "#C8A050", borderTop: "2px solid #A07030", flexShrink: 0 }}>
          <button
            onClick={() => setProductPage((p) => Math.max(0, p - 1))}
            disabled={productPage === 0}
            style={{
              padding: "8px 20px", borderRadius: 6, fontWeight: 900, fontSize: 14, cursor: productPage === 0 ? "not-allowed" : "pointer",
              background: productPage === 0 ? "#D4B870" : "#E87722", color: productPage === 0 ? "#A07030" : "#fff",
              border: "2px solid #A07030", display: "flex", alignItems: "center", gap: 6,
            }}
          >
            &#8592; RETROCEDER
          </button>
          <span style={{ fontWeight: 700, fontSize: 11, color: "#3D2B00" }}>
            {productPage + 1} / {totalPages} &middot; {products.length} productos
          </span>
          <button
            onClick={() => setProductPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={productPage >= totalPages - 1}
            style={{
              padding: "8px 20px", borderRadius: 6, fontWeight: 900, fontSize: 14, cursor: productPage >= totalPages - 1 ? "not-allowed" : "pointer",
              background: productPage >= totalPages - 1 ? "#D4B870" : "#E87722", color: productPage >= totalPages - 1 ? "#A07030" : "#fff",
              border: "2px solid #A07030", display: "flex", alignItems: "center", gap: 6,
            }}
          >
            AVANZAR &#8594;
          </button>
        </div>
      </div>
    </div>
  );
}
