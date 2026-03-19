"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "@/components/ui/toast";
import {
  Plus, Pencil, X, DollarSign, Receipt, Printer,
  UserCheck, Ban, RefreshCw, LogOut, Search, Coins,
  Clock, ChefHat, AlertTriangle, CreditCard, Banknote,
  ArrowLeftRight, Check
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════════ */

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
  waiterName: string;
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

interface Waiter { id: string; name: string; code: string; }
interface Product { id: string; name: string; sku: string; price: number; taxRate: number; }
interface CartLine { productId: string; productName: string; quantity: number; unitPrice: number; notes: string; }

type ModalType =
  | null | "open" | "captura" | "cobrar" | "factura"
  | "propina" | "mesero" | "cancelFolio" | "confirmCancelLine";

/* ═══════════════════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════════════════ */

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function fmtCur(n: number) {
  return `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function elapsedBadge(min: number) {
  if (min < 30) return "bg-emerald-600/20 text-emerald-400 border-emerald-600/30";
  if (min < 60) return "bg-amber-600/20 text-amber-400 border-amber-600/30";
  return "bg-red-600/20 text-red-400 border-red-600/30";
}

function statusColor(status: string) {
  switch (status) {
    case "SERVED": return "text-emerald-400";
    case "COOKING": return "text-amber-400";
    case "CANCELLED": return "text-red-400 line-through";
    case "READY": return "text-sky-400";
    default: return "text-slate-400";
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "PENDING": return "PENDIENTE";
    case "COOKING": return "COCINA";
    case "READY": return "LISTO";
    case "SERVED": return "SERVIDO";
    case "CANCELLED": return "CANCELADO";
    default: return status;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════════
   PRINT
   ═══════════════════════════════════════════════════════════════════════════════ */

function printReceipt(sel: OpenSession, paymentMethod?: string) {
  const activeLines = sel.lines.filter((l) => l.status !== "CANCELLED");
  const w = window.open("", "_blank", "width=350,height=600");
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Courier New',monospace;width:280px;padding:10px;font-size:11px;color:#000}
    .c{text-align:center} .b{font-weight:bold} .line{border-top:1px dashed #000;margin:6px 0}
    .row{display:flex;justify-content:space-between} .r{text-align:right}
    table{width:100%;border-collapse:collapse} td{padding:2px 0;vertical-align:top}
    .big{font-size:16px} .sm{font-size:9px;color:#555}
  </style></head><body>
    <div class="c b big">CLIVARO ERP</div>
    <div class="c sm">Sistema Punto de Venta</div>
    <div class="line"></div>
    <div class="row"><span class="b">Mesa:</span><span>${sel.tableNumber}</span></div>
    <div class="row"><span class="b">Mesero:</span><span>${sel.waiterName}</span></div>
    <div class="row"><span class="b">Fecha:</span><span>${new Date().toLocaleString("es-MX")}</span></div>
    ${paymentMethod ? `<div class="row"><span class="b">Pago:</span><span>${paymentMethod}</span></div>` : ""}
    <div class="line"></div>
    <table><tr class="b"><td>Cant</td><td>Descripcion</td><td class="r">Importe</td></tr>
    ${activeLines.map((l) => `<tr><td>${l.quantity}</td><td>${l.productName}${l.notes ? ` <span class="sm">[${l.notes}]</span>` : ""}</td><td class="r">${fmtCur(l.quantity * l.unitPrice)}</td></tr>`).join("")}
    </table>
    <div class="line"></div>
    <div class="row"><span>Subtotal:</span><span>${fmtCur(sel.subtotal)}</span></div>
    <div class="row"><span>Impuestos:</span><span>${fmtCur(sel.taxAmount || 0)}</span></div>
    ${sel.tipAmount > 0 ? `<div class="row"><span>Propina:</span><span>${fmtCur(sel.tipAmount)}</span></div>` : ""}
    <div class="line"></div>
    <div class="row b big"><span>TOTAL:</span><span>${fmtCur(sel.total + sel.tipAmount)}</span></div>
    <div class="line"></div>
    <div class="c sm" style="margin-top:8px">Gracias por su preferencia</div>
    <script>setTimeout(()=>{window.print()},300)</script>
  </body></html>`);
  w.document.close();
}

function printComanda(tableName: string, waiterName: string, items: CartLine[]) {
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
   REUSABLE UI
   ═══════════════════════════════════════════════════════════════════════════════ */

function Backdrop({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}

function ModalCard({ title, children, width = "max-w-md", onClose }: { title: string; children: React.ReactNode; width?: string; onClose: () => void }) {
  return (
    <div className={`bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full ${width} overflow-hidden`}>
      <div className="bg-slate-800 border-b border-slate-700 px-5 py-3 flex items-center justify-between">
        <h3 className="text-white font-bold text-sm tracking-wide">{title}</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-white text-lg font-bold leading-none">&times;</button>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════════════════════ */

export const CashierBillingConsole: React.FC = () => {
  const { toast } = useToast();

  // ── Core state ──
  const [sessions, setSessions] = useState<OpenSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<OpenSession | null>(null);
  const [searchText, setSearchText] = useState("");
  const [hasActiveShift, setHasActiveShift] = useState<boolean | null>(null);
  const [modal, setModal] = useState<ModalType>(null);

  // ── Selected line (product row) ──
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);

  // ── Abrir Cuenta ──
  const [waiters, setWaiters] = useState<Waiter[]>([]);
  const [newTableName, setNewTableName] = useState("");
  const [pickedWaiter, setPickedWaiter] = useState("");
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);
  const tableInputRef = useRef<HTMLInputElement>(null);

  // ── Captura ──
  const [productSearch, setProductSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [capturaCart, setCapturaCart] = useState<CartLine[]>([]);
  const [sendingOrder, setSendingOrder] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // ── Cobrar ──
  const [payMethod, setPayMethod] = useState<"cash" | "card" | "transfer">("cash");
  const [cashReceived, setCashReceived] = useState("");
  const [billing, setBilling] = useState(false);
  const [billSuccess, setBillSuccess] = useState(false);

  // ── Factura ──
  const [issuingInvoice, setIssuingInvoice] = useState(false);

  // ── Propina ──
  const [tipInput, setTipInput] = useState("");
  const [savingTip, setSavingTip] = useState(false);

  // ── Cambiar Mesero ──
  const [changingWaiter, setChangingWaiter] = useState(false);

  // ── Cancel ──
  const [cancellingLine, setCancellingLine] = useState(false);
  const [cancellingFolio, setCancellingFolio] = useState(false);

  // Derived: selected line object
  const selectedLine = sel?.lines.find((l) => l.id === selectedLineId) ?? null;
  const isCancellable = selectedLine && (selectedLine.status === "PENDING" || selectedLine.status === "COOKING");

  // Reset line selection when account changes
  useEffect(() => { setSelectedLineId(null); }, [sel?.id]);

  /* ═══════════════════════════════════════════════════════════════════════════
     DATA FETCHING
     ═══════════════════════════════════════════════════════════════════════════ */

  const checkShift = useCallback(async () => {
    try {
      const res = await fetch("/api/cash/shifts?active=true");
      if (!res.ok) { setHasActiveShift(false); return; }
      const d = await res.json();
      setHasActiveShift(Array.isArray(d.shifts) && d.shifts.length > 0);
    } catch { setHasActiveShift(false); }
  }, []);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/pos/cashier/open-accounts");
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Error cargando cuentas");
      const arr: OpenSession[] = Array.isArray(d.accounts) ? d.accounts : [];
      setSessions(arr);
      setSel((prev) => {
        if (prev) { const r = arr.find((s) => s.id === prev.id); return r ?? (arr[0] ?? null); }
        return arr[0] ?? null;
      });
    } catch (err: any) {
      toast(err.message, "error");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchSessions();
    checkShift();
    const iv = setInterval(fetchSessions, 20_000);
    return () => clearInterval(iv);
  }, [fetchSessions, checkShift]);

  /* ═══════════════════════════════════════════════════════════════════════════
     ABRIR CUENTA
     ═══════════════════════════════════════════════════════════════════════════ */

  const nextTableNumber = useCallback(() => {
    const used = new Set(sessions.map((s) => s.tableNumber));
    for (let i = 1; i <= 999; i++) { if (!used.has(String(i))) return String(i); }
    return String(sessions.length + 1);
  }, [sessions]);

  const handleOpenClick = async () => {
    if (hasActiveShift === false) { toast("Abra un turno de caja primero", "error"); return; }
    setOpenError(null);
    setNewTableName(nextTableNumber());
    try {
      const res = await fetch("/api/restaurant/waiters");
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Error cargando meseros");
      const wl: Waiter[] = Array.isArray(d) ? d : [];
      setWaiters(wl);
      setPickedWaiter(wl[0]?.id ?? "");
    } catch (err: any) { toast(err.message, "error"); return; }
    setModal("open");
    setTimeout(() => tableInputRef.current?.select(), 80);
  };

  const handleConfirmOpen = async () => {
    const name = newTableName.trim();
    if (!name || !pickedWaiter) return;
    setOpening(true);
    setOpenError(null);
    try {
      const res = await fetch("/api/restaurant/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableName: name, waiterId: pickedWaiter }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "No se pudo abrir");
      toast(`${d.reused ? "Cuenta existente" : "Cuenta abierta"}: Mesa ${name}`, "success");
      setModal(null);
      await fetchSessions();
    } catch (err: any) { setOpenError(err.message); }
    finally { setOpening(false); }
  };

  /* ═══════════════════════════════════════════════════════════════════════════
     CAPTURA
     ═══════════════════════════════════════════════════════════════════════════ */

  const handleCapturaClick = () => {
    if (hasActiveShift === false) { toast("Abra un turno de caja primero", "error"); return; }
    if (!sel) { toast("Seleccione una cuenta", "warning"); return; }
    setCapturaCart([]);
    setProductSearch("");
    setProducts([]);
    setModal("captura");
    setTimeout(() => searchRef.current?.focus(), 100);
  };

  const searchProducts = useCallback(async (q: string) => {
    if (!q.trim()) { setProducts([]); return; }
    try {
      const res = await fetch(`/api/pos/products?search=${encodeURIComponent(q)}&limit=20`);
      const d = await res.json();
      setProducts(Array.isArray(d.products) ? d.products : []);
    } catch { setProducts([]); }
  }, []);

  useEffect(() => {
    if (modal !== "captura") return;
    const t = setTimeout(() => searchProducts(productSearch), 250);
    return () => clearTimeout(t);
  }, [productSearch, searchProducts, modal]);

  const addToCaptura = (p: Product) => {
    setCapturaCart((prev) => {
      const ex = prev.find((l) => l.productId === p.id);
      if (ex) return prev.map((l) => l.productId === p.id ? { ...l, quantity: l.quantity + 1 } : l);
      return [...prev, { productId: p.id, productName: p.name, quantity: 1, unitPrice: p.price, notes: "" }];
    });
  };

  const removeFromCaptura = (pid: string) => setCapturaCart((prev) => prev.filter((l) => l.productId !== pid));

  const updateCapturaQty = (pid: string, delta: number) => {
    setCapturaCart((prev) => prev.map((l) => {
      if (l.productId !== pid) return l;
      const nq = Math.max(1, l.quantity + delta);
      return { ...l, quantity: nq };
    }));
  };

  const handleSendCaptura = async () => {
    if (!sel || capturaCart.length === 0) return;
    setSendingOrder(true);
    try {
      const res = await fetch("/api/restaurant/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sel.id,
          items: capturaCart.map((l) => ({
            productId: l.productId, quantity: l.quantity,
            unitPrice: l.unitPrice, notes: l.notes || null,
          })),
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Error creando orden");
      const kr = await fetch(`/api/restaurant/orders/${d.id}/send-kitchen`, { method: "POST" });
      if (!kr.ok) { const kd = await kr.json(); throw new Error(kd.error || "Error enviando a cocina"); }
      printComanda(sel.tableNumber, sel.waiterName, capturaCart);
      toast("Comanda enviada a cocina", "success");
      setModal(null);
      await fetchSessions();
    } catch (err: any) { toast(err.message, "error"); }
    finally { setSendingOrder(false); }
  };

  /* ═══════════════════════════════════════════════════════════════════════════
     CANCELAR PRODUCTO (selected line, in-app confirm)
     ═══════════════════════════════════════════════════════════════════════════ */

  const handleCancelLineClick = () => {
    if (!selectedLine || !isCancellable) { toast("Seleccione un producto cancelable de la tabla", "warning"); return; }
    setModal("confirmCancelLine");
  };

  const handleConfirmCancelLine = async () => {
    if (!selectedLineId) return;
    setCancellingLine(true);
    try {
      const res = await fetch(`/api/restaurant/kds/items/${selectedLineId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Error cancelando");
      toast("Producto cancelado", "success");
      setSelectedLineId(null);
      setModal(null);
      await fetchSessions();
    } catch (err: any) { toast(err.message, "error"); }
    finally { setCancellingLine(false); }
  };

  /* ═══════════════════════════════════════════════════════════════════════════
     COBRAR
     ═══════════════════════════════════════════════════════════════════════════ */

  const handleCobrarClick = () => {
    if (!sel) return;
    setPayMethod("cash");
    setCashReceived("");
    setBillSuccess(false);
    setModal("cobrar");
  };

  const handleConfirmCobrar = async () => {
    if (!sel) return;
    setBilling(true);
    try {
      const res = await fetch(`/api/restaurant/sessions/${sel.id}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Error cerrando cuenta");
      const methodLabel = payMethod === "cash" ? "Efectivo" : payMethod === "card" ? "Tarjeta" : "Transferencia";
      printReceipt(sel, methodLabel);
      setBillSuccess(true);
      toast(`Mesa ${sel.tableNumber} cobrada`, "success");
      await fetchSessions();
    } catch (err: any) { toast(err.message, "error"); }
    finally { setBilling(false); }
  };

  /* ═══════════════════════════════════════════════════════════════════════════
     FACTURA (Alegra)
     ═══════════════════════════════════════════════════════════════════════════ */

  const handleFacturaClick = () => { if (!sel) return; setModal("factura"); };

  const handleEmitFactura = async () => {
    if (!sel) return;
    setIssuingInvoice(true);
    try {
      const res = await fetch("/api/restaurant/invoices/issue-alegra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sel.id }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Error emitiendo factura");
      toast(`Factura ${d.number || d.alegraId} emitida`, "success");
      setModal(null);
    } catch (err: any) { toast(err.message, "error"); }
    finally { setIssuingInvoice(false); }
  };

  /* ═══════════════════════════════════════════════════════════════════════════
     PROPINA
     ═══════════════════════════════════════════════════════════════════════════ */

  const handlePropinaClick = () => { if (!sel) return; setTipInput(String(sel.tipAmount || 0)); setModal("propina"); };

  const handleSaveTip = async () => {
    if (!sel) return;
    setSavingTip(true);
    try {
      const res = await fetch(`/api/restaurant/sessions/${sel.id}/tip`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipAmount: parseFloat(tipInput) || 0 }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Error guardando propina");
      toast("Propina actualizada", "success");
      setModal(null);
      await fetchSessions();
    } catch (err: any) { toast(err.message, "error"); }
    finally { setSavingTip(false); }
  };

  /* ═══════════════════════════════════════════════════════════════════════════
     CAMBIAR MESERO
     ═══════════════════════════════════════════════════════════════════════════ */

  const handleMeseroClick = async () => {
    if (!sel) return;
    try {
      const res = await fetch("/api/restaurant/waiters");
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Error cargando meseros");
      setWaiters(Array.isArray(d) ? d : []);
    } catch (err: any) { toast(err.message, "error"); return; }
    setPickedWaiter("");
    setModal("mesero");
  };

  const handleConfirmMesero = async () => {
    if (!sel || !pickedWaiter) return;
    setChangingWaiter(true);
    try {
      const res = await fetch(`/api/restaurant/sessions/${sel.id}/update`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ waiterId: pickedWaiter }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Error cambiando mesero");
      toast("Mesero actualizado", "success");
      setModal(null);
      await fetchSessions();
    } catch (err: any) { toast(err.message, "error"); }
    finally { setChangingWaiter(false); }
  };

  /* ═══════════════════════════════════════════════════════════════════════════
     CANCELAR FOLIO
     ═══════════════════════════════════════════════════════════════════════════ */

  const handleCancelFolioClick = () => { if (!sel) return; setModal("cancelFolio"); };

  const handleConfirmCancelFolio = async () => {
    if (!sel) return;
    setCancellingFolio(true);
    try {
      const res = await fetch(`/api/restaurant/sessions/${sel.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Error cancelando folio");
      toast(`Folio Mesa ${sel.tableNumber} cancelado`, "success");
      setModal(null);
      await fetchSessions();
    } catch (err: any) { toast(err.message, "error"); }
    finally { setCancellingFolio(false); }
  };

  /* ═══════════════════════════════════════════════════════════════════════════
     IMPRIMIR
     ═══════════════════════════════════════════════════════════════════════════ */

  const handlePrint = () => { if (!sel) return; printReceipt(sel); };

  /* ═══════════════════════════════════════════════════════════════════════════
     COMPUTED
     ═══════════════════════════════════════════════════════════════════════════ */

  const filtered = sessions.filter((s) => {
    if (!searchText) return true;
    const q = searchText.toLowerCase();
    return s.tableNumber.toLowerCase().includes(q) || s.waiterName.toLowerCase().includes(q);
  });

  const subtotal = sel?.subtotal ?? 0;
  const taxAmount = sel?.taxAmount ?? 0;
  const total = sel?.total ?? 0;
  const tip = sel?.tipAmount ?? 0;
  const grandTotal = total + tip;
  const change = payMethod === "cash" ? Math.max(0, (parseFloat(cashReceived) || 0) - grandTotal) : 0;
  const cashOk = payMethod !== "cash" || (parseFloat(cashReceived) || 0) >= grandTotal;

  /* ═══════════════════════════════════════════════════════════════════════════
     LOADING
     ═══════════════════════════════════════════════════════════════════════════ */

  if (loading) {
    return (
      <div className="h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-amber-500 font-bold text-lg animate-pulse">Cargando punto de venta...</div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════════════════ */

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-white font-sans overflow-hidden select-none">

      {/* ══════════════════════════════════════════════════════════════════════
         MODALS
         ══════════════════════════════════════════════════════════════════════ */}

      {/* ABRIR CUENTA */}
      {modal === "open" && (
        <Backdrop onClose={() => setModal(null)}>
          <ModalCard title="ABRIR CUENTA" onClose={() => setModal(null)}>
            {openError && <div className="bg-red-600/10 border border-red-600/30 rounded-lg p-3 mb-3 text-red-400 text-xs font-semibold">{openError}</div>}
            <label className="block text-xs font-semibold text-slate-400 mb-1">Número de mesa</label>
            <input ref={tableInputRef} value={newTableName} onChange={(e) => setNewTableName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleConfirmOpen(); }} autoFocus className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-2xl font-black text-center text-amber-400 outline-none focus:border-amber-500 mb-3" placeholder="1, 2, VIP..." />
            <label className="block text-xs font-semibold text-slate-400 mb-1">Mesero</label>
            <select value={pickedWaiter} onChange={(e) => setPickedWaiter(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-amber-500 mb-4">
              {waiters.length === 0 && <option value="">Sin meseros registrados</option>}
              {waiters.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
            </select>
            <div className="flex gap-2">
              <button onClick={() => setModal(null)} className="flex-1 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-sm font-semibold text-slate-300 hover:bg-slate-700">Cancelar</button>
              <button onClick={handleConfirmOpen} disabled={!newTableName.trim() || !pickedWaiter || opening} className="flex-1 py-2.5 bg-amber-600 rounded-lg text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed">{opening ? "Abriendo..." : "Abrir"}</button>
            </div>
          </ModalCard>
        </Backdrop>
      )}

      {/* CAPTURA */}
      {modal === "captura" && (
        <Backdrop onClose={() => setModal(null)}>
          <ModalCard title={`CAPTURA — Mesa ${sel?.tableNumber}`} width="max-w-2xl" onClose={() => setModal(null)}>
            <div className="flex gap-4" style={{ minHeight: 340 }}>
              {/* Product search */}
              <div className="flex-1 flex flex-col gap-2">
                <input ref={searchRef} value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Buscar producto..." className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-amber-500" />
                <div className="overflow-y-auto flex-1 border border-slate-700 rounded-lg">
                  {products.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 text-xs">{productSearch ? "Sin resultados" : "Escribe para buscar..."}</div>
                  ) : products.map((p) => (
                    <div key={p.id} onClick={() => addToCaptura(p)} className="px-3 py-2 cursor-pointer border-b border-slate-800 flex justify-between items-center hover:bg-slate-800/50">
                      <div><div className="font-semibold text-xs text-white">{p.name}</div><div className="text-[10px] text-slate-500">{p.sku}</div></div>
                      <div className="font-bold text-amber-400 text-sm">{fmtCur(p.price)}</div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Cart */}
              <div className="w-56 flex flex-col gap-2">
                <div className="text-xs font-bold text-slate-400">ORDEN ({capturaCart.reduce((s, l) => s + l.quantity, 0)})</div>
                <div className="flex-1 overflow-y-auto border border-slate-700 rounded-lg">
                  {capturaCart.length === 0 ? (
                    <div className="p-4 text-center text-slate-500 text-[10px]">Click un producto</div>
                  ) : capturaCart.map((l) => (
                    <div key={l.productId} className="px-2 py-1.5 border-b border-slate-800 flex items-center gap-1">
                      <div className="flex items-center gap-1 mr-1">
                        <button onClick={() => updateCapturaQty(l.productId, -1)} className="w-5 h-5 flex items-center justify-center rounded bg-slate-700 text-slate-300 text-xs font-bold hover:bg-slate-600">-</button>
                        <span className="text-xs font-bold text-white w-5 text-center">{l.quantity}</span>
                        <button onClick={() => updateCapturaQty(l.productId, 1)} className="w-5 h-5 flex items-center justify-center rounded bg-slate-700 text-slate-300 text-xs font-bold hover:bg-slate-600">+</button>
                      </div>
                      <div className="flex-1 min-w-0"><div className="font-semibold text-[11px] text-white truncate">{l.productName}</div><div className="text-[10px] text-slate-500">{fmtCur(l.quantity * l.unitPrice)}</div></div>
                      <button onClick={() => removeFromCaptura(l.productId)} className="text-red-400 hover:text-red-300 font-bold text-sm leading-none">&times;</button>
                    </div>
                  ))}
                </div>
                <div className="text-right font-bold text-amber-400 text-sm">{fmtCur(capturaCart.reduce((s, l) => s + l.quantity * l.unitPrice, 0))}</div>
                <button onClick={() => setModal(null)} className="py-2 bg-slate-800 border border-slate-600 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-700">Cancelar</button>
                <button onClick={handleSendCaptura} disabled={capturaCart.length === 0 || sendingOrder} className="py-2 bg-emerald-600 rounded-lg text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed">{sendingOrder ? "Enviando..." : "Enviar a Cocina"}</button>
              </div>
            </div>
          </ModalCard>
        </Backdrop>
      )}

      {/* CONFIRMAR CANCELAR PRODUCTO */}
      {modal === "confirmCancelLine" && selectedLine && (
        <Backdrop onClose={() => setModal(null)}>
          <ModalCard title="CANCELAR PRODUCTO" onClose={() => setModal(null)}>
            <div className="text-center mb-4">
              <div className="w-12 h-12 rounded-full bg-red-600/20 flex items-center justify-center mx-auto mb-3"><X className="w-6 h-6 text-red-400" /></div>
              <p className="text-white text-sm font-semibold mb-1">¿Cancelar este producto?</p>
              <div className="bg-slate-800 rounded-lg p-3 mt-3">
                <div className="text-amber-400 font-bold text-sm">{selectedLine.productName}</div>
                <div className="text-slate-400 text-xs mt-1">Cantidad: {selectedLine.quantity} · {fmtCur(selectedLine.quantity * selectedLine.unitPrice)}</div>
                <div className={`text-xs font-bold mt-1 ${statusColor(selectedLine.status)}`}>{statusLabel(selectedLine.status)}</div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setModal(null)} className="flex-1 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-sm font-semibold text-slate-300 hover:bg-slate-700">Volver</button>
              <button onClick={handleConfirmCancelLine} disabled={cancellingLine} className="flex-1 py-2.5 bg-red-600 rounded-lg text-sm font-bold text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed">{cancellingLine ? "Cancelando..." : "Cancelar Producto"}</button>
            </div>
          </ModalCard>
        </Backdrop>
      )}

      {/* COBRAR */}
      {modal === "cobrar" && sel && (
        <Backdrop onClose={() => !billing && setModal(null)}>
          <ModalCard title={`COBRAR — Mesa ${sel.tableNumber}`} onClose={() => !billing && setModal(null)}>
            {billSuccess ? (
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-emerald-600/20 flex items-center justify-center mx-auto mb-3"><Check className="w-8 h-8 text-emerald-400" /></div>
                <p className="text-emerald-400 font-bold text-lg mb-1">Cuenta cobrada</p>
                <p className="text-slate-400 text-sm">Mesa {sel.tableNumber} · {fmtCur(grandTotal)}</p>
                <button onClick={() => setModal(null)} className="mt-4 w-full py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-sm font-semibold text-slate-300 hover:bg-slate-700">Cerrar</button>
              </div>
            ) : (
              <>
                <div className="text-center mb-4">
                  <div className="text-slate-400 text-xs font-semibold mb-1">TOTAL A COBRAR</div>
                  <div className="text-4xl font-black text-amber-400">{fmtCur(grandTotal)}</div>
                  {tip > 0 && <div className="text-xs text-slate-500 mt-1">Incluye propina: {fmtCur(tip)}</div>}
                </div>
                <div className="text-xs font-semibold text-slate-400 mb-2">Método de pago</div>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {([
                    { key: "cash" as const, label: "Efectivo", Icon: Banknote },
                    { key: "card" as const, label: "Tarjeta", Icon: CreditCard },
                    { key: "transfer" as const, label: "Transferencia", Icon: ArrowLeftRight },
                  ]).map((m) => (
                    <button key={m.key} onClick={() => { setPayMethod(m.key); setCashReceived(""); }} className={`flex flex-col items-center gap-1 py-3 rounded-lg border text-xs font-semibold ${payMethod === m.key ? "bg-amber-600/20 border-amber-500 text-amber-400" : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"}`}>
                      <m.Icon className="w-5 h-5" />{m.label}
                    </button>
                  ))}
                </div>
                {payMethod === "cash" && (
                  <div className="mb-4">
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Efectivo recibido</label>
                    <input value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} type="number" step="0.01" min="0" className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-lg font-bold text-center text-white outline-none focus:border-amber-500" placeholder="0.00" autoFocus />
                    {(parseFloat(cashReceived) || 0) >= grandTotal && grandTotal > 0 && (
                      <div className="mt-2 text-center"><span className="text-xs text-slate-500">Cambio: </span><span className="text-lg font-bold text-emerald-400">{fmtCur(change)}</span></div>
                    )}
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={() => setModal(null)} disabled={billing} className="flex-1 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-sm font-semibold text-slate-300 hover:bg-slate-700 disabled:opacity-40">Cancelar</button>
                  <button onClick={handleConfirmCobrar} disabled={billing || !cashOk} className="flex-1 py-2.5 bg-emerald-600 rounded-lg text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed">{billing ? "Procesando..." : "Confirmar Pago"}</button>
                </div>
              </>
            )}
          </ModalCard>
        </Backdrop>
      )}

      {/* FACTURA */}
      {modal === "factura" && sel && (
        <Backdrop onClose={() => setModal(null)}>
          <ModalCard title={`FACTURA — Mesa ${sel.tableNumber}`} onClose={() => setModal(null)}>
            <div className="text-center mb-4">
              <Receipt className="w-10 h-10 text-amber-500 mx-auto mb-2" />
              <p className="text-slate-400 text-xs mb-1">Emitir factura electrónica vía Alegra</p>
              <div className="text-2xl font-black text-amber-400 mt-2">{fmtCur(grandTotal)}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setModal(null)} className="flex-1 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-sm font-semibold text-slate-300 hover:bg-slate-700">Cancelar</button>
              <button onClick={handleEmitFactura} disabled={issuingInvoice} className="flex-1 py-2.5 bg-amber-600 rounded-lg text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed">{issuingInvoice ? "Emitiendo..." : "Emitir Factura"}</button>
            </div>
          </ModalCard>
        </Backdrop>
      )}

      {/* PROPINA */}
      {modal === "propina" && sel && (
        <Backdrop onClose={() => setModal(null)}>
          <ModalCard title={`PROPINA — Mesa ${sel.tableNumber}`} onClose={() => setModal(null)}>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Monto de propina</label>
            <input value={tipInput} onChange={(e) => setTipInput(e.target.value)} type="number" step="0.01" min="0" className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-lg font-bold text-center text-white outline-none focus:border-amber-500 mb-4" autoFocus />
            <div className="flex gap-2">
              <button onClick={() => setModal(null)} className="flex-1 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-sm font-semibold text-slate-300 hover:bg-slate-700">Cancelar</button>
              <button onClick={handleSaveTip} disabled={savingTip} className="flex-1 py-2.5 bg-amber-600 rounded-lg text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed">{savingTip ? "Guardando..." : "Guardar"}</button>
            </div>
          </ModalCard>
        </Backdrop>
      )}

      {/* CAMBIAR MESERO */}
      {modal === "mesero" && sel && (
        <Backdrop onClose={() => setModal(null)}>
          <ModalCard title={`CAMBIAR MESERO — Mesa ${sel.tableNumber}`} onClose={() => setModal(null)}>
            <p className="text-xs text-slate-400 mb-2">Mesero actual: <span className="text-white font-semibold">{sel.waiterName}</span></p>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Nuevo mesero</label>
            <select value={pickedWaiter} onChange={(e) => setPickedWaiter(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-amber-500 mb-4">
              <option value="">Seleccionar...</option>
              {waiters.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
            </select>
            <div className="flex gap-2">
              <button onClick={() => setModal(null)} className="flex-1 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-sm font-semibold text-slate-300 hover:bg-slate-700">Cancelar</button>
              <button onClick={handleConfirmMesero} disabled={!pickedWaiter || changingWaiter} className="flex-1 py-2.5 bg-amber-600 rounded-lg text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed">{changingWaiter ? "Cambiando..." : "Cambiar"}</button>
            </div>
          </ModalCard>
        </Backdrop>
      )}

      {/* CANCELAR FOLIO */}
      {modal === "cancelFolio" && sel && (
        <Backdrop onClose={() => setModal(null)}>
          <ModalCard title={`CANCELAR FOLIO — Mesa ${sel.tableNumber}`} onClose={() => setModal(null)}>
            <div className="text-center mb-4">
              <div className="w-12 h-12 rounded-full bg-red-600/20 flex items-center justify-center mx-auto mb-3"><AlertTriangle className="w-6 h-6 text-red-400" /></div>
              <p className="text-white text-sm font-semibold">¿Cancelar esta cuenta completamente?</p>
              <p className="text-slate-500 text-xs mt-1">Se cancelarán todos los productos pendientes y se cerrará la mesa sin cobro.</p>
              <div className="bg-slate-800 rounded-lg p-3 mt-3 text-left">
                <div className="flex justify-between text-xs"><span className="text-slate-400">Mesa:</span><span className="text-white font-bold">{sel.tableNumber}</span></div>
                <div className="flex justify-between text-xs mt-1"><span className="text-slate-400">Mesero:</span><span className="text-white">{sel.waiterName}</span></div>
                <div className="flex justify-between text-xs mt-1"><span className="text-slate-400">Items:</span><span className="text-white">{sel.itemsCount}</span></div>
                <div className="flex justify-between text-xs mt-1"><span className="text-slate-400">Total que se pierde:</span><span className="text-red-400 font-bold">{fmtCur(total)}</span></div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setModal(null)} className="flex-1 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-sm font-semibold text-slate-300 hover:bg-slate-700">Volver</button>
              <button onClick={handleConfirmCancelFolio} disabled={cancellingFolio} className="flex-1 py-2.5 bg-red-600 rounded-lg text-sm font-bold text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed">{cancellingFolio ? "Cancelando..." : "Cancelar Folio"}</button>
            </div>
          </ModalCard>
        </Backdrop>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
         TOOLBAR
         ══════════════════════════════════════════════════════════════════════ */}
      <div className="bg-slate-900 border-b border-slate-800 px-3 py-2 flex-shrink-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-amber-500 font-black text-base tracking-wider mr-2">CLIVARO POS</span>
          {hasActiveShift === false && <span className="bg-red-600/20 text-red-400 border border-red-600/30 rounded-full px-2.5 py-0.5 text-[10px] font-bold">SIN TURNO</span>}
          {hasActiveShift === true && <span className="bg-emerald-600/20 text-emerald-400 border border-emerald-600/30 rounded-full px-2.5 py-0.5 text-[10px] font-bold">TURNO ACTIVO</span>}
          <span className="flex-1" />
          {selectedLine && (
            <span className="bg-amber-600/20 text-amber-400 border border-amber-600/30 rounded px-2 py-0.5 text-[10px] font-bold truncate max-w-[200px]">
              Sel: {selectedLine.productName}
            </span>
          )}
          <span className="text-slate-500 text-[10px] font-semibold">{sessions.length} cuentas</span>
        </div>
        {/* Row 1 */}
        <div className="flex gap-1.5 flex-wrap">
          {[
            { label: "Abrir Cuenta", Icon: Plus, act: handleOpenClick, dis: false },
            { label: "Captura", Icon: Pencil, act: handleCapturaClick, dis: !sel, accent: true },
            { label: "Cancelar Prod", Icon: X, act: handleCancelLineClick, dis: !sel || !isCancellable },
            { label: "Cobrar", Icon: DollarSign, act: handleCobrarClick, dis: !sel, success: true },
            { label: "Factura", Icon: Receipt, act: handleFacturaClick, dis: !sel },
            { label: "Imprimir", Icon: Printer, act: handlePrint, dis: !sel },
          ].map((btn) => (
            <button key={btn.label} onClick={btn.act} disabled={btn.dis} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border ${btn.dis ? "opacity-30 cursor-not-allowed bg-slate-800 border-slate-800 text-slate-600" : (btn as any).success ? "bg-emerald-600 border-emerald-700 text-white hover:bg-emerald-700" : (btn as any).accent ? "bg-amber-600 border-amber-700 text-white hover:bg-amber-700" : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"}`}>
              <btn.Icon className="w-3.5 h-3.5" />{btn.label}
            </button>
          ))}
        </div>
        {/* Row 2 */}
        <div className="flex gap-1.5 flex-wrap mt-1">
          {[
            { label: "Cambiar Mesero", Icon: UserCheck, act: handleMeseroClick, dis: !sel },
            { label: "Propina", Icon: Coins, act: handlePropinaClick, dis: !sel },
            { label: "Cancelar Folio", Icon: Ban, act: handleCancelFolioClick, dis: !sel, danger: true },
            { label: "Refrescar", Icon: RefreshCw, act: () => { fetchSessions(); checkShift(); }, dis: false },
            { label: "Salir", Icon: LogOut, act: () => window.history.back(), dis: false },
          ].map((btn) => (
            <button key={btn.label} onClick={btn.act} disabled={btn.dis} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border ${btn.dis ? "opacity-30 cursor-not-allowed bg-slate-800 border-slate-800 text-slate-600" : (btn as any).danger ? "bg-red-600/20 border-red-600/30 text-red-400 hover:bg-red-600/30" : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"}`}>
              <btn.Icon className="w-3.5 h-3.5" />{btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
         BODY
         ══════════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT: Accounts List */}
        <div className="w-56 flex-shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col">
          <div className="p-2 border-b border-slate-800">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Buscar mesa..." className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-7 pr-2 py-1.5 text-xs text-white outline-none focus:border-amber-500 placeholder:text-slate-600" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-6 text-center text-slate-600 text-xs">Sin cuentas abiertas</div>
            ) : filtered.map((s) => {
              const isSel = sel?.id === s.id;
              return (
                <div key={s.id} onClick={() => setSel(s)} className={`px-3 py-2.5 cursor-pointer border-b border-slate-800/60 flex justify-between items-center ${isSel ? "bg-amber-600/15 border-l-2 border-l-amber-500" : "hover:bg-slate-800/50"}`}>
                  <div>
                    <div className={`font-bold text-sm ${isSel ? "text-amber-400" : "text-white"}`}>Mesa {s.tableNumber}</div>
                    <div className="text-[10px] text-slate-500">{s.waiterName} · {s.itemsCount} items</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-xs text-white">{fmtCur(s.total)}</div>
                    <span className={`text-[9px] font-semibold inline-block px-1.5 py-0.5 rounded border ${elapsedBadge(s.elapsedMinutes)}`}>{s.elapsedMinutes}m</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="p-2 border-t border-slate-800 text-center text-[10px] font-semibold text-slate-500">{sessions.length} cuenta{sessions.length !== 1 ? "s" : ""}</div>
        </div>

        {/* RIGHT: Detail View */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">

          {/* Info bar */}
          {sel && (
            <div className="bg-slate-900/50 border-b border-slate-800 px-4 py-2 flex items-center gap-4 flex-shrink-0 text-xs">
              <div className="flex items-center gap-1.5"><span className="text-slate-500 font-semibold">Mesa:</span><span className="text-amber-400 font-bold text-sm">{sel.tableNumber}</span></div>
              <div className="flex items-center gap-1.5"><UserCheck className="w-3 h-3 text-slate-500" /><span className="text-white font-semibold">{sel.waiterName}</span></div>
              <div className="flex items-center gap-1.5"><Clock className="w-3 h-3 text-slate-500" /><span className="text-slate-300">{fmtTime(sel.openedAt)}</span></div>
              <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${elapsedBadge(sel.elapsedMinutes)}`}>{sel.elapsedMinutes} min</span>
              <div className="flex items-center gap-1.5"><ChefHat className="w-3 h-3 text-slate-500" /><span className="text-slate-300">{sel.itemsCount} items</span></div>
            </div>
          )}

          {/* Items table */}
          <div className="flex-1 overflow-auto">
            {sel ? (
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-900 sticky top-0 z-10">
                    {["#", "Cant", "Descripción", "Precio", "Importe", "Estado", ""].map((h, i) => (
                      <th key={i} className={`px-3 py-2 text-amber-500/70 font-bold text-[10px] uppercase tracking-wider border-b border-slate-800 ${h === "Descripción" ? "text-left" : "text-right"} ${i === 0 ? "w-8" : i === 6 ? "w-9" : ""}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sel.lines.length === 0 ? (
                    <tr><td colSpan={7} className="py-12 text-center text-slate-600 text-xs">Sin productos — use <span className="text-amber-500 font-semibold">Captura</span> para agregar</td></tr>
                  ) : sel.lines.map((line, idx) => {
                    const isLineSel = selectedLineId === line.id;
                    const cancellable = line.status === "PENDING" || line.status === "COOKING";
                    return (
                      <tr key={line.id} onClick={() => setSelectedLineId(isLineSel ? null : line.id)} className={`border-b border-slate-900 cursor-pointer ${isLineSel ? "bg-amber-600/10 ring-1 ring-inset ring-amber-500/40" : idx % 2 === 0 ? "bg-slate-950" : "bg-slate-900/30"} hover:bg-slate-800/30`}>
                        <td className="px-3 py-2.5 text-right text-slate-600 font-semibold">{idx + 1}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-white">{line.quantity}</td>
                        <td className="px-3 py-2.5 text-left">
                          <span className={`font-medium ${isLineSel ? "text-amber-300" : "text-white"}`}>{line.productName}</span>
                          {line.notes && <span className="ml-1.5 text-[10px] text-amber-500/70 italic">[{line.notes}]</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right text-slate-400">{fmtCur(line.unitPrice)}</td>
                        <td className="px-3 py-2.5 text-right text-white font-semibold">{fmtCur(line.quantity * line.unitPrice)}</td>
                        <td className={`px-3 py-2.5 text-center text-[10px] font-bold ${statusColor(line.status)}`}>{statusLabel(line.status)}</td>
                        <td className="px-2 py-2.5 text-center">
                          {cancellable && (
                            <button onClick={(e) => { e.stopPropagation(); setSelectedLineId(line.id); setModal("confirmCancelLine"); }} disabled={cancellingLine} className="bg-red-600/20 text-red-400 border border-red-600/30 rounded px-1.5 py-0.5 text-[10px] font-bold hover:bg-red-600/30 disabled:opacity-40">&times;</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-3">
                <div className="text-4xl opacity-20">🍽️</div>
                <div className="text-slate-500 font-semibold text-sm">Seleccione una cuenta o abra una nueva</div>
              </div>
            )}
          </div>

          {/* Footer: Totals */}
          <div className="bg-slate-900 border-t border-slate-800 px-4 py-2.5 flex items-center justify-between flex-shrink-0">
            <div className="flex gap-5 text-xs">
              <div><span className="text-slate-500 font-semibold">Subtotal: </span><span className="text-white font-bold">{fmtCur(subtotal)}</span></div>
              <div><span className="text-slate-500 font-semibold">Impuestos: </span><span className="text-white font-bold">{fmtCur(taxAmount)}</span></div>
              {tip > 0 && <div><span className="text-slate-500 font-semibold">Propina: </span><span className="text-amber-400 font-bold">{fmtCur(tip)}</span></div>}
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-[10px] text-slate-500 font-semibold">TOTAL</div>
                <div className="text-xl font-black text-amber-400">{fmtCur(grandTotal)}</div>
              </div>
              <button onClick={handleCobrarClick} disabled={!sel || billing} className="px-6 py-2.5 bg-emerald-600 rounded-xl text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-30 disabled:cursor-not-allowed">
                COBRAR
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
