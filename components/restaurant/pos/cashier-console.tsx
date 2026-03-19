"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "@/components/ui/toast";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface AccountLine {
  id: string;
  productId?: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  notes?: string | null;
  status: string;
}

interface OpenSession {
  id: string;
  tableNumber: string;
  zoneName: string;
  zoneId?: string;
  waiterName: string;
  waiterCode?: string;
  status: string;
  openedAt: string;
  elapsedMinutes: number;
  itemsCount: number;
  subtotal: number;
  taxAmount?: number;
  total: number;
  tipAmount: number;
  lines: AccountLine[];
}

interface RestaurantTable {
  id: string;
  name: string;
  status: string;
  zoneId?: string;
}

interface Waiter {
  id: string;
  name: string;
  code: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  taxRate: number;
}

interface CartLine {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  notes: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("es-MX", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
  });
}

function fmtCur(n: number) { return `$${n.toFixed(2)}`; }

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  root: { display: "flex", height: "100vh", background: "#C8A050", fontFamily: "'Segoe UI', Arial, sans-serif", fontSize: 12, overflow: "hidden", color: "#1a0a00" } as React.CSSProperties,
  leftPanel: { width: 210, background: "#E8D5B0", borderRight: "2px solid #A07030", display: "flex", flexDirection: "column", flexShrink: 0 } as React.CSSProperties,
  leftHeader: { background: "#C8A050", color: "#3D2B00", fontWeight: 900, fontSize: 14, padding: "6px 10px", borderBottom: "2px solid #A07030", letterSpacing: 1, textAlign: "center" } as React.CSSProperties,
  leftSection: { padding: "6px 8px", borderBottom: "1px solid #C8A050", background: "#F0E0B0" } as React.CSSProperties,
  labelSm: { fontSize: 11, fontWeight: 700, color: "#5a3c10", marginBottom: 2 } as React.CSSProperties,
  inputSm: { width: "100%", padding: "3px 6px", border: "1px solid #A07030", borderRadius: 3, background: "#fff", fontSize: 11, color: "#1a0a00", boxSizing: "border-box" } as React.CSSProperties,
  accountTable: { flex: 1, overflow: "auto" } as React.CSSProperties,
  accountTableHead: { background: "#C8A050", position: "sticky", top: 0 } as React.CSSProperties,
  th: { padding: "4px 6px", fontWeight: 800, fontSize: 10, color: "#3D2B00", borderRight: "1px solid #A07030", whiteSpace: "nowrap", textAlign: "left" } as React.CSSProperties,
  main: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" } as React.CSSProperties,
  actionBar: { background: "#D4A030", borderBottom: "2px solid #A07030", padding: "4px 6px", display: "flex", gap: 3, flexWrap: "wrap", flexShrink: 0 } as React.CSSProperties,
  detailForm: { background: "#FFF8E7", borderBottom: "1px solid #C8A050", padding: "6px 10px", flexShrink: 0 } as React.CSSProperties,
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 16px" } as React.CSSProperties,
  formRow: { display: "flex", alignItems: "center", gap: 4 } as React.CSSProperties,
  formLabel: { fontSize: 10, fontWeight: 700, color: "#5a3c10", whiteSpace: "nowrap", minWidth: 80 } as React.CSSProperties,
  formValue: { padding: "2px 6px", border: "1px solid #C8A050", borderRadius: 2, background: "#fff", fontSize: 11, color: "#1a0a00", flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } as React.CSSProperties,
  formValueHL: { padding: "2px 6px", border: "1px solid #C8A050", borderRadius: 2, background: "#FFF3CD", fontSize: 11, fontWeight: 700, color: "#1a0a00", flex: 1, minWidth: 0 } as React.CSSProperties,
  itemsWrapper: { flex: 1, overflow: "auto", background: "#fff", borderBottom: "1px solid #C8A050" } as React.CSSProperties,
  itemsTable: { width: "100%", borderCollapse: "collapse" as const, fontSize: 11 } as React.CSSProperties,
  itemsTh: { background: "#C8A050", padding: "4px 8px", fontWeight: 800, color: "#3D2B00", borderRight: "1px solid #A07030", position: "sticky" as const, top: 0, whiteSpace: "nowrap", textAlign: "left" as const } as React.CSSProperties,
  bottom: { display: "flex", background: "#E8D5B0", borderTop: "2px solid #A07030", flexShrink: 0, height: 180 } as React.CSSProperties,
  bottomLeft: { flex: 1, display: "flex", flexDirection: "column", borderRight: "2px solid #A07030", padding: "4px 6px", gap: 4 } as React.CSSProperties,
  bottomBtnRow: { display: "flex", gap: 3 } as React.CSSProperties,
  bottomBtn: { background: "linear-gradient(180deg,#F5D060 0%,#D4A030 100%)", color: "#3D2B00", border: "1px solid #9a7525", borderRadius: 4, padding: "4px 8px", cursor: "pointer", fontWeight: 700, fontSize: 10, letterSpacing: 0.2, display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 1, minWidth: 68, boxShadow: "0 1px 0 #fff4 inset" } as React.CSSProperties,
  bottomRight: { width: 240, background: "#FFF8E7", padding: "8px 12px", display: "flex", flexDirection: "column", gap: 2, justifyContent: "center" } as React.CSSProperties,
  totalRow: { display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #E0C880", paddingBottom: 2 } as React.CSSProperties,
  totalLabel: { fontSize: 11, fontWeight: 700, color: "#5a3c10" } as React.CSSProperties,
  totalValue: { fontSize: 11, fontWeight: 700, color: "#1a0a00" } as React.CSSProperties,
  // Modal
  overlay: { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" } as React.CSSProperties,
  modal: { background: "#FFF8E7", border: "3px solid #A07030", borderRadius: 8, padding: 20, minWidth: 420, maxWidth: 680, maxHeight: "80vh", display: "flex", flexDirection: "column" as const, gap: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" } as React.CSSProperties,
  modalHeader: { background: "#C8A050", color: "#3D2B00", fontWeight: 900, fontSize: 15, padding: "8px 14px", margin: "-20px -20px 0", borderRadius: "5px 5px 0 0", letterSpacing: 1 } as React.CSSProperties,
  tableGrid: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, overflowY: "auto" as const, maxHeight: 240 } as React.CSSProperties,
};

function actionBtn(disabled = false, primary = false): React.CSSProperties {
  return {
    background: disabled ? "#b8902a" : primary ? "#E87722" : "linear-gradient(180deg,#F5D060 0%,#D4A030 100%)",
    color: disabled ? "#8B6914" : "#3D2B00",
    border: `1px solid ${disabled ? "#9a7525" : "#9a7525"}`,
    borderRadius: 4, padding: "4px 8px", cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 700, fontSize: 10, letterSpacing: 0.3,
    display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
    minWidth: 72, boxShadow: disabled ? "none" : "0 1px 0 #fff4 inset", opacity: disabled ? 0.6 : 1,
  };
}

// ─── Main Component ────────────────────────────────────────────────────────────

export const CashierBillingConsole: React.FC = () => {
  const [sessions, setSessions] = useState<OpenSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<OpenSession | null>(null);
  const [searchText, setSearchText] = useState("");
  const [billing, setBilling] = useState(false);
  const [observations, setObservations] = useState("");
  const { toast } = useToast();

  // ── ABRIR CUENTA state ────────────────────────────────────────────────────
  const [showOpenAccount, setShowOpenAccount] = useState(false);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [waiters, setWaiters] = useState<Waiter[]>([]);
  const [pickedTable, setPickedTable] = useState<RestaurantTable | null>(null);
  const [pickedWaiter, setPickedWaiter] = useState<string>("");
  const [opening, setOpening] = useState(false);

  // ── CAPTURA state ─────────────────────────────────────────────────────────
  const [showCaptura, setShowCaptura] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [capturaCart, setCapturaCart] = useState<CartLine[]>([]);
  const [sendingOrder, setSendingOrder] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // ── CANCELAR PROD state ───────────────────────────────────────────────────
  const [cancellingLine, setCancellingLine] = useState<string | null>(null);

  // ── Cash shift state ───────────────────────────────────────────────────
  const [hasActiveShift, setHasActiveShift] = useState<boolean | null>(null);

  // ── Data ──────────────────────────────────────────────────────────────────

  const checkActiveShift = useCallback(async () => {
    try {
      const res = await fetch("/api/cash/shifts?active=true");
      if (!res.ok) { setHasActiveShift(false); return; }
      const data = await res.json();
      const shifts = Array.isArray(data.shifts) ? data.shifts : [];
      setHasActiveShift(shifts.length > 0);
    } catch {
      setHasActiveShift(false);
    }
  }, []);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/pos/cashier/open-accounts");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudieron cargar las cuentas");
      const arr: OpenSession[] = Array.isArray(data.accounts) ? data.accounts : [];
      setSessions(arr);
      setSelectedSession((prev) => {
        if (prev) { const r = arr.find((s) => s.id === prev.id); return r ?? (arr[0] ?? null); }
        return arr[0] ?? null;
      });
    } catch (err: any) {
      toast(err.message || "Error al cargar cuentas", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
    checkActiveShift();
    const iv = setInterval(fetchSessions, 20_000);
    return () => clearInterval(iv);
  }, [fetchSessions, checkActiveShift]);

  // ── Open Account ─────────────────────────────────────────────────────────

  const handleOpenAccountClick = async () => {
    if (hasActiveShift === false) {
      toast("No hay un turno de caja abierto. Abra un turno antes de abrir cuentas.", "error");
      return;
    }
    try {
      const [tablesRes, waitersRes] = await Promise.all([
        fetch("/api/restaurant/tables"),
        fetch("/api/restaurant/waiters"),
      ]);
      const tablesData = await tablesRes.json();
      const waitersData = await waitersRes.json();

      if (!tablesRes.ok) {
        throw new Error(tablesData?.error || `Error cargando mesas (${tablesRes.status})`);
      }
      if (!waitersRes.ok) {
        throw new Error(waitersData?.error || `Error cargando meseros (${waitersRes.status})`);
      }

      const allTables: RestaurantTable[] = Array.isArray(tablesData) ? tablesData : [];
      const availTables = allTables.filter((t: RestaurantTable) => t.status === "AVAILABLE");
      setTables(availTables);
      const waiterList: Waiter[] = Array.isArray(waitersData) ? waitersData : [];
      setWaiters(waiterList);
      setPickedTable(null);
      setPickedWaiter(waiterList.length > 0 ? waiterList[0].id : "");
      setShowOpenAccount(true);
    } catch (err: any) {
      toast(err.message || "Error al cargar mesas/meseros", "error");
    }
  };

  const handleConfirmOpenAccount = async () => {
    if (!pickedTable) { toast("Selecciona una mesa", "warning"); return; }
    if (!pickedWaiter) { toast("Selecciona un mesero", "warning"); return; }
    setOpening(true);
    try {
      const res = await fetch("/api/restaurant/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableId: pickedTable.id, waiterId: pickedWaiter }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo abrir la cuenta");
      toast(`Cuenta abierta: Mesa ${pickedTable.name}`, "success");
      setShowOpenAccount(false);
      await fetchSessions();
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setOpening(false);
    }
  };

  // ── Captura (add products to session) ────────────────────────────────────

  const handleCapturaClick = () => {
    if (hasActiveShift === false) { toast("No hay un turno de caja abierto", "error"); return; }
    if (!selectedSession) { toast("Selecciona una cuenta primero", "warning"); return; }
    setCapturaCart([]);
    setProductSearch("");
    setProducts([]);
    setShowCaptura(true);
    setTimeout(() => searchRef.current?.focus(), 100);
  };

  const searchProducts = useCallback(async (q: string) => {
    if (!q.trim()) { setProducts([]); return; }
    try {
      const res = await fetch(`/api/pos/products?search=${encodeURIComponent(q)}&limit=20`);
      const data = await res.json();
      setProducts(Array.isArray(data.products) ? data.products : []);
    } catch { setProducts([]); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchProducts(productSearch), 250);
    return () => clearTimeout(t);
  }, [productSearch, searchProducts]);

  const addToCaptura = (product: Product) => {
    setCapturaCart((prev) => {
      const ex = prev.find((l) => l.productId === product.id);
      if (ex) return prev.map((l) => l.productId === product.id ? { ...l, quantity: l.quantity + 1 } : l);
      return [...prev, { productId: product.id, productName: product.name, quantity: 1, unitPrice: product.price, notes: "" }];
    });
  };

  const removeFromCaptura = (productId: string) => {
    setCapturaCart((prev) => prev.filter((l) => l.productId !== productId));
  };

  const handleSendCaptura = async () => {
    if (!selectedSession || capturaCart.length === 0) return;
    setSendingOrder(true);
    try {
      const res = await fetch("/api/restaurant/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: selectedSession.id,
          items: capturaCart.map((l) => ({
            productId: l.productId,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            notes: l.notes || null,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo crear la orden");

      // Send to kitchen
      const kitchenRes = await fetch(`/api/restaurant/orders/${data.id}/send-kitchen`, { method: "POST" });
      if (!kitchenRes.ok) {
        const kd = await kitchenRes.json();
        throw new Error(kd.error || "No se pudo enviar a cocina");
      }

      toast("Productos enviados a cocina", "success");
      setShowCaptura(false);
      await fetchSessions();
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setSendingOrder(false);
    }
  };

  // ── Cancel product line ───────────────────────────────────────────────────

  const handleCancelLine = async (lineId: string) => {
    if (!confirm("Cancelar este producto de la cuenta?")) return;
    setCancellingLine(lineId);
    try {
      const res = await fetch(`/api/restaurant/kds/items/${lineId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo cancelar el producto");
      toast("Producto cancelado", "success");
      await fetchSessions();
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setCancellingLine(null);
    }
  };

  // ── Bill ─────────────────────────────────────────────────────────────────

  const handleBill = async () => {
    if (!selectedSession) return;
    if (!confirm(`Cerrar y facturar Mesa ${selectedSession.tableNumber}?`)) return;
    setBilling(true);
    try {
      const res = await fetch(`/api/restaurant/sessions/${selectedSession.id}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ observations }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo cerrar la sesion");
      toast(`Mesa ${selectedSession.tableNumber} cerrada`, "success");
      setObservations("");
      await fetchSessions();
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setBilling(false);
    }
  };

  // ── Computed ──────────────────────────────────────────────────────────────

  const filtered = sessions.filter((s) => {
    if (!searchText) return true;
    const q = searchText.toLowerCase();
    return s.tableNumber.toLowerCase().includes(q) || s.waiterName.toLowerCase().includes(q) || s.zoneName.toLowerCase().includes(q);
  });

  const sel = selectedSession;
  const subtotal = sel?.subtotal ?? 0;
  const taxAmount = sel?.taxAmount ?? 0;
  const tipAmount = sel?.tipAmount ?? 0;
  const total = subtotal + tipAmount;

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ height: "100vh", background: "#C8A050", display: "flex", alignItems: "center", justifyContent: "center", color: "#3D2B00", fontWeight: 700, fontSize: 16, letterSpacing: 2 }}>
        Cargando cuentas...
      </div>
    );
  }

  return (
    <div style={S.root}>

      {/* ══ OPEN ACCOUNT MODAL ══════════════════════════════════════ */}
      {showOpenAccount && (
        <div style={S.overlay} onClick={() => setShowOpenAccount(false)}>
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>
            <div style={S.modalHeader}>ABRIR CUENTA — Seleccionar Mesa y Mesero</div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
              {/* Waiter selector */}
              <div>
                <div style={{ fontWeight: 700, fontSize: 11, color: "#5a3c10", marginBottom: 4 }}>MESERO:</div>
                <select
                  value={pickedWaiter}
                  onChange={(e) => setPickedWaiter(e.target.value)}
                  style={{ ...S.inputSm, height: 30, fontSize: 13 }}
                >
                  {waiters.length === 0 && <option value="">Sin meseros activos</option>}
                  {waiters.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
                </select>
              </div>

              {/* Table grid */}
              <div>
                <div style={{ fontWeight: 700, fontSize: 11, color: "#5a3c10", marginBottom: 4 }}>
                  MESA (disponibles: {tables.length}):
                </div>
                {tables.length === 0 ? (
                  <div style={{ padding: "16px 0", textAlign: "center", color: "#8B6914", fontSize: 12 }}>
                    No hay mesas disponibles
                  </div>
                ) : (
                  <div style={S.tableGrid}>
                    {tables.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setPickedTable(t)}
                        style={{
                          padding: "12px 6px",
                          background: pickedTable?.id === t.id ? "#E87722" : "#F5C518",
                          color: pickedTable?.id === t.id ? "#fff" : "#3D2B00",
                          border: `2px solid ${pickedTable?.id === t.id ? "#E87722" : "#C8A050"}`,
                          borderRadius: 6, fontWeight: 900, fontSize: 16, cursor: "pointer",
                          display: "flex", flexDirection: "column", alignItems: "center",
                        }}
                      >
                        {t.name}
                        <span style={{ fontSize: 9, fontWeight: 600, marginTop: 2, opacity: 0.7 }}>DISPONIBLE</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                <button onClick={() => setShowOpenAccount(false)} style={{ ...S.bottomBtn, minWidth: 80 }}>CANCELAR</button>
                <button
                  onClick={handleConfirmOpenAccount}
                  disabled={!pickedTable || !pickedWaiter || opening}
                  style={{ ...S.bottomBtn, minWidth: 100, background: pickedTable && pickedWaiter ? "#E87722" : "#b8902a", color: "#fff", opacity: (!pickedTable || !pickedWaiter) ? 0.5 : 1 }}
                >
                  {opening ? "Abriendo..." : "ABRIR CUENTA"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ CAPTURA MODAL ═══════════════════════════════════════════ */}
      {showCaptura && (
        <div style={S.overlay} onClick={() => setShowCaptura(false)}>
          <div style={{ ...S.modal, maxWidth: 700, minWidth: 600 }} onClick={(e) => e.stopPropagation()}>
            <div style={S.modalHeader}>CAPTURA — Mesa {sel?.tableNumber} · Agregar Productos</div>

            <div style={{ display: "flex", gap: 12, flex: 1, minHeight: 0, marginTop: 8 }}>
              {/* Left: search */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                <input
                  ref={searchRef}
                  style={{ ...S.inputSm, fontSize: 13, padding: "6px 10px" }}
                  placeholder="Buscar producto por nombre o codigo..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                />
                <div style={{ flex: 1, overflowY: "auto", maxHeight: 300, border: "1px solid #C8A050", borderRadius: 4 }}>
                  {products.length === 0 ? (
                    <div style={{ padding: 16, textAlign: "center", color: "#8B6914", fontSize: 11 }}>
                      {productSearch ? "Sin resultados" : "Escribe para buscar..."}
                    </div>
                  ) : (
                    products.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => addToCaptura(p)}
                        style={{
                          padding: "8px 10px", cursor: "pointer", borderBottom: "1px solid #E8D5B0",
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          background: "#FFF8E7",
                        }}
                        onMouseOver={(e) => (e.currentTarget.style.background = "#F5C518")}
                        onMouseOut={(e) => (e.currentTarget.style.background = "#FFF8E7")}
                      >
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 12 }}>{p.name}</div>
                          <div style={{ fontSize: 10, color: "#8B6914" }}>{p.sku}</div>
                        </div>
                        <div style={{ fontWeight: 800, color: "#C0392B", fontSize: 13 }}>${p.price.toFixed(2)}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Right: cart */}
              <div style={{ width: 240, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 11, color: "#5a3c10" }}>
                  ORDEN ({capturaCart.reduce((s, l) => s + l.quantity, 0)} items):
                </div>
                <div style={{ flex: 1, overflowY: "auto", maxHeight: 280, border: "1px solid #C8A050", borderRadius: 4 }}>
                  {capturaCart.length === 0 ? (
                    <div style={{ padding: 12, textAlign: "center", color: "#8B6914", fontSize: 11 }}>
                      Click en un producto para agregar
                    </div>
                  ) : capturaCart.map((l) => (
                    <div key={l.productId} style={{ padding: "6px 8px", borderBottom: "1px solid #E8D5B0", display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 11 }}>{l.productName}</div>
                        <div style={{ fontSize: 10, color: "#8B6914" }}>{l.quantity} x ${l.unitPrice.toFixed(2)}</div>
                      </div>
                      <button onClick={() => removeFromCaptura(l.productId)} style={{ color: "#C0392B", fontWeight: 900, background: "none", border: "none", cursor: "pointer", fontSize: 14 }}>×</button>
                    </div>
                  ))}
                </div>
                <div style={{ fontWeight: 900, fontSize: 14, color: "#C0392B", textAlign: "right" }}>
                  Total: ${capturaCart.reduce((s, l) => s + l.quantity * l.unitPrice, 0).toFixed(2)}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <button onClick={() => setShowCaptura(false)} style={{ ...S.bottomBtn, width: "100%" }}>CANCELAR</button>
                  <button
                    onClick={handleSendCaptura}
                    disabled={capturaCart.length === 0 || sendingOrder}
                    style={{ ...S.bottomBtn, width: "100%", background: capturaCart.length > 0 ? "#E87722" : "#b8902a", color: "#fff", opacity: capturaCart.length === 0 ? 0.5 : 1 }}
                  >
                    {sendingOrder ? "Enviando..." : "ENVIAR A COCINA"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ LEFT PANEL ══════════════════════════════════════════════ */}
      <div style={S.leftPanel}>
        <div style={S.leftHeader}>COMEDOR</div>
        {hasActiveShift === false && (
          <div style={{ background: "#C0392B", color: "#fff", padding: "4px 8px", fontSize: 9, fontWeight: 700, textAlign: "center", letterSpacing: 0.5 }}>
            SIN TURNO DE CAJA
          </div>
        )}
        {hasActiveShift === true && (
          <div style={{ background: "#2E7D32", color: "#fff", padding: "4px 8px", fontSize: 9, fontWeight: 700, textAlign: "center", letterSpacing: 0.5 }}>
            TURNO ACTIVO
          </div>
        )}
        <div style={S.leftSection}>
          <div style={S.labelSm}>Area activa</div>
          <select style={{ ...S.inputSm, cursor: "pointer" }} defaultValue="TODAS">
            <option value="TODAS">(TODAS)</option>
          </select>
        </div>
        <div style={{ ...S.leftSection, display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={S.labelSm}>Buscar cuenta:</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#5a3c10", background: "#F5C518", borderRadius: 3, padding: "1px 6px" }}>
              Cuentas: {filtered.length}
            </span>
          </div>
          <input style={S.inputSm} value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Mesa o mesero..." />
        </div>

        <div style={S.accountTable}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead style={S.accountTableHead as any}>
              <tr>
                <th style={S.th}>Mesa</th>
                <th style={S.th}>Mesero</th>
                <th style={{ ...S.th, textAlign: "right" }}>Items</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={3} style={{ padding: "16px 8px", textAlign: "center", color: "#8B6914", fontSize: 10 }}>Sin cuentas abiertas</td></tr>
              ) : filtered.map((s, i) => {
                const isSel = sel?.id === s.id;
                return (
                  <tr key={s.id} onClick={() => setSelectedSession(s)} style={{ background: isSel ? "#1565C0" : i % 2 === 0 ? "#FFF8E7" : "#F0E0B0", cursor: "pointer", userSelect: "none" }}>
                    <td style={{ padding: "5px 6px", fontWeight: isSel ? 800 : 600, color: isSel ? "#fff" : "#1a0a00", borderBottom: "1px solid #D4B870" }}>{s.tableNumber}</td>
                    <td style={{ padding: "5px 6px", color: isSel ? "#fff" : "#1a0a00", borderBottom: "1px solid #D4B870", fontSize: 10 }}>{s.waiterName}</td>
                    <td style={{ padding: "5px 6px", textAlign: "right", color: isSel ? "#fff" : "#1a0a00", borderBottom: "1px solid #D4B870", fontWeight: 700 }}>{s.itemsCount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ padding: "6px 8px", display: "flex", gap: 4, borderTop: "2px solid #A07030", background: "#D4B870" }}>
          {["Reserva", "Comis."].map((label) => (
            <button key={label} style={{ ...S.bottomBtn, flex: 1, fontSize: 9, minWidth: 0 }}>{label}</button>
          ))}
        </div>
      </div>

      {/* ══ MAIN CONTENT ════════════════════════════════════════════ */}
      <div style={S.main}>

        {/* Action bar row 1 */}
        <div style={S.actionBar}>
          {[
            { label: "ABRIR\nCUENTA",    icon: "📂", act: handleOpenAccountClick, dis: false },
            { label: "CANCELAR\nPROD.",  icon: "❌", act: () => { if(sel?.lines?.[0]) handleCancelLine(sel.lines[0].id); }, dis: !sel || !sel.lines?.length },
            { label: "CAMBIAR\nCUENTA",  icon: "🔄", act: () => {}, dis: !sel },
            { label: "JUNTAR\nCUENTAS",  icon: "🔗", act: () => {}, dis: !sel },
            { label: "DESCTO.\nGENERAL", icon: "🏷️", act: () => {}, dis: !sel },
            { label: "DIVIDIR\nCUENTA",  icon: "✂️", act: () => {}, dis: !sel },
            { label: "IMPRIMIR\nCUENTA", icon: "🖨️", act: () => toast("Imprimiendo...", "info"), dis: !sel },
            { label: "CERRAR",           icon: "🚪", act: () => window.history.back(), dis: false, primary: true },
          ].map((btn: any) => (
            <button key={btn.label} onClick={btn.act} disabled={btn.dis} style={actionBtn(btn.dis, btn.primary)}>
              <span style={{ fontSize: 16 }}>{btn.icon}</span>
              {btn.label.split("\n").map((l: string, i: number) => <span key={i}>{l}</span>)}
            </button>
          ))}
        </div>

        {/* Action bar row 2 */}
        <div style={{ ...S.actionBar, paddingTop: 2 }}>
          {[
            { label: "CAPTURA",          icon: "📝", act: handleCapturaClick,       dis: !sel },
            { label: "CLIENTE",          icon: "👥", act: () => {},                  dis: !sel },
            { label: "CAMBIAR\nMESERO",  icon: "🔀", act: () => {},                  dis: !sel },
            { label: "TRANSFER.\nPROD.", icon: "↔️", act: () => {},                  dis: !sel },
            { label: "DESCTO.\nPROD.",   icon: "💲", act: () => {},                  dis: !sel },
            { label: "PROPINA\nINCLUIDAS",icon: "💰",act: () => {},                  dis: !sel },
            { label: "PAGAR\nCUENTA",    icon: "✅", act: handleBill,                dis: !sel, primary: true },
            { label: "ACREDITAR\nCUENTA",icon: "📋", act: () => {},                  dis: !sel },
          ].map((btn: any) => (
            <button key={btn.label} onClick={btn.act} disabled={btn.dis || billing} style={actionBtn(btn.dis || billing, btn.primary)}>
              <span style={{ fontSize: 16 }}>{btn.icon}</span>
              {btn.label.split("\n").map((l: string, i: number) => <span key={i}>{l}</span>)}
            </button>
          ))}
        </div>

        {/* Detail form */}
        <div style={S.detailForm}>
          <div style={S.formGrid}>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <div style={S.formRow}><span style={S.formLabel}>CUENTA:</span><span style={S.formValueHL}>{sel?.tableNumber ?? "—"}</span><span style={{ ...S.formLabel, minWidth: 40 }}>AREA:</span><span style={{ ...S.formValue, flex: 2 }}>{sel?.zoneName ?? ""}</span></div>
              <div style={S.formRow}><span style={S.formLabel}>MESA:</span><span style={S.formValue}>{sel?.tableNumber ?? "—"}</span><span style={{ ...S.formLabel, minWidth: 50 }}>MESERO:</span><span style={{ ...S.formValue, flex: 2, fontWeight: 700 }}>{sel?.waiterName ?? ""}</span></div>
              <div style={S.formRow}><span style={S.formLabel}>PERSONAS:</span><span style={{ ...S.formValue, maxWidth: 40 }}>—</span><span style={{ ...S.formLabel, minWidth: 50 }}>RESERVA</span><span style={{ ...S.formValue, flex: 2 }} /></div>
              <div style={S.formRow}><span style={S.formLabel}>CLIENTE:</span><span style={S.formValue} /></div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <div style={S.formRow}><span style={S.formLabel}>ORDEN:</span><span style={S.formValueHL}>{sel?.itemsCount ?? 0}</span></div>
              <div style={S.formRow}><span style={S.formLabel}>APERTURA:</span><span style={{ ...S.formValue, flex: 2, fontSize: 10 }}>{sel ? fmtTime(sel.openedAt) : "—"}</span></div>
              <div style={S.formRow}><span style={S.formLabel}>TIEMPO:</span><span style={S.formValue}>{sel ? `${sel.elapsedMinutes} min` : "—"}</span></div>
              <div style={S.formRow}><span style={S.formLabel}>CIERRE:</span><span style={{ ...S.formValue, flex: 2 }}>{sel?.status === "CLOSED" ? "Cerrada" : "Abierta"}</span></div>
            </div>
          </div>
        </div>

        {/* Items table */}
        <div style={S.itemsWrapper}>
          {sel ? (
            <table style={S.itemsTable}>
              <thead>
                <tr>
                  {["#", "CANT.", "DESCRIPCION", "PRECIO", "IMPORTE", "ESTADO", ""].map((h, i) => (
                    <th key={i} style={{ ...S.itemsTh, textAlign: h === "DESCRIPCION" ? "left" : "right", width: i === 0 ? 30 : i === 6 ? 32 : undefined }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sel.lines.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: "20px", textAlign: "center", color: "#8B6914" }}>Sin productos — use CAPTURA para agregar</td></tr>
                ) : sel.lines.map((line, idx) => (
                  <tr key={line.id} style={{ background: idx % 2 === 0 ? "#FFF8E7" : "#fff", borderBottom: "1px solid #E8D5B0" }}>
                    <td style={{ padding: "4px 8px", textAlign: "right", fontWeight: 700, color: "#1a0a00", borderRight: "1px solid #E8D5B0" }}>{idx + 1}</td>
                    <td style={{ padding: "4px 8px", textAlign: "right", borderRight: "1px solid #E8D5B0" }}>{line.quantity.toFixed(3)}</td>
                    <td style={{ padding: "4px 8px", borderRight: "1px solid #E8D5B0", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {line.productName}
                      {line.notes ? <span style={{ marginLeft: 6, fontSize: 9, color: "#C0392B", fontStyle: "italic" }}>[{line.notes}]</span> : null}
                    </td>
                    <td style={{ padding: "4px 8px", textAlign: "right", borderRight: "1px solid #E8D5B0", fontWeight: 600 }}>{fmtCur(line.unitPrice)}</td>
                    <td style={{ padding: "4px 8px", textAlign: "right", borderRight: "1px solid #E8D5B0", fontWeight: 700 }}>{fmtCur(line.quantity * line.unitPrice)}</td>
                    <td style={{ padding: "4px 8px", textAlign: "center", fontSize: 9, fontWeight: 700, borderRight: "1px solid #E8D5B0", color: line.status === "SERVED" ? "#2E7D32" : line.status === "COOKING" ? "#E65100" : line.status === "CANCELLED" ? "#C0392B" : "#1565C0" }}>{line.status}</td>
                    <td style={{ padding: "2px 4px", textAlign: "center" }}>
                      {line.status === "PENDING" || line.status === "COOKING" ? (
                        <button
                          onClick={() => handleCancelLine(line.id)}
                          disabled={cancellingLine === line.id}
                          style={{ background: "#C0392B", color: "#fff", border: "none", borderRadius: 3, cursor: "pointer", fontSize: 10, padding: "2px 4px", fontWeight: 700 }}
                          title="Cancelar producto"
                        >
                          ✕
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#8B6914", fontSize: 13, fontWeight: 600 }}>
              Seleccione una cuenta del panel izquierdo o use ABRIR CUENTA
            </div>
          )}
        </div>

        {/* Bottom section */}
        <div style={S.bottom}>
          <div style={S.bottomLeft}>
            <div style={{ display: "flex", gap: 4, alignItems: "flex-start" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#5a3c10", whiteSpace: "nowrap", paddingTop: 3 }}>OBSERV:</span>
              <textarea style={{ flex: 1, padding: "3px 6px", border: "1px solid #A07030", borderRadius: 3, background: "#fff", fontSize: 11, resize: "none", height: 36 }} value={observations} onChange={(e) => setObservations(e.target.value)} placeholder="Observaciones..." />
            </div>
            <div style={S.bottomBtnRow}>
              {[
                { label: "CARGO A\nCUENTA",    icon: "💳", dis: !sel },
                { label: "OBSERVA-\nCIONES",   icon: "📝", dis: false },
                { label: "TARJETA\nDSCTO.",    icon: "🏷️", dis: !sel },
                { label: "CAPTURA\nPRODUCTO",  icon: "📝", act: handleCapturaClick, dis: !sel, primary: true },
                { label: "FACTURA\nRAPIDAS",   icon: "⚡", dis: !sel, act: handleBill },
                { label: "ABRIR\nCUENTA",      icon: "📂", act: handleOpenAccountClick, dis: false, primary: false },
                { label: "REIMPRIMIR\nCUENTA", icon: "🖨️", dis: !sel, act: () => toast("Imprimiendo...", "info") },
              ].map((btn: any) => (
                <button key={btn.label} disabled={btn.dis || billing} onClick={btn.act ?? (() => {})} style={{ ...S.bottomBtn, minWidth: 62, fontSize: 9, opacity: btn.dis ? 0.5 : 1, background: btn.primary && !btn.dis ? "#E87722" : undefined, color: btn.primary && !btn.dis ? "#fff" : undefined }}>
                  <span style={{ fontSize: 14 }}>{btn.icon}</span>
                  {btn.label.split("\n").map((l: string, i: number) => <span key={i}>{l}</span>)}
                </button>
              ))}
            </div>
            <div style={S.bottomBtnRow}>
              {[
                { label: "CONSULTA\nCTAS.",    icon: "🔍" },
                { label: "REFRESCAR",          icon: "🔄", act: fetchSessions },
                { label: "PAGO CON\nPUNTOS",   icon: "⭐" },
                { label: "RESUMEN\nCUENTA",    icon: "📊" },
                { label: "REIMPRIMIR\nPRODU.", icon: "🔁" },
                { label: "CANCELAR\nFOLIO",    icon: "🗑️", dis: !sel },
                { label: "VER\nMESAS",         icon: "🗺️" },
              ].map((btn: any) => (
                <button key={btn.label} disabled={btn.dis} onClick={btn.act ?? (() => {})} style={{ ...S.bottomBtn, minWidth: 62, fontSize: 9, opacity: btn.dis ? 0.5 : 1 }}>
                  <span style={{ fontSize: 14 }}>{btn.icon}</span>
                  {btn.label.split("\n").map((l: string, i: number) => <span key={i}>{l}</span>)}
                </button>
              ))}
            </div>
          </div>

          <div style={S.bottomRight}>
            {[
              { label: "SUBTOTAL:", value: fmtCur(subtotal) },
              { label: "-MONEDERO:", value: "$0.00" },
              { label: "-DESCUENTO: 0%", value: "$0.00" },
              { label: "IMPUESTOS:", value: fmtCur(taxAmount) },
              { label: "PROPINA:", value: fmtCur(tipAmount), red: true },
              { label: "CARGO:", value: "$0.00" },
            ].map((row) => (
              <div key={row.label} style={S.totalRow}>
                <span style={S.totalLabel}>{row.label}</span>
                <span style={{ ...S.totalValue, color: row.red ? "#C0392B" : undefined }}>{row.value}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4, paddingTop: 4, borderTop: "2px solid #A07030" }}>
              <span style={{ fontSize: 16, fontWeight: 900, color: "#3D2B00", letterSpacing: 1 }}>TOTAL:</span>
              <span style={{ fontSize: 18, fontWeight: 900, color: "#C0392B" }}>{fmtCur(total)}</span>
            </div>
            <button onClick={handleBill} disabled={!sel || billing} style={{ marginTop: 8, width: "100%", padding: "8px 12px", background: sel && !billing ? "#E87722" : "#b8902a", color: sel && !billing ? "#fff" : "#8B6914", border: "2px solid #9a7525", borderRadius: 5, fontWeight: 900, fontSize: 13, letterSpacing: 1, cursor: sel && !billing ? "pointer" : "not-allowed" }}>
              {billing ? "Procesando..." : "BILLAR / COBRAR"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
