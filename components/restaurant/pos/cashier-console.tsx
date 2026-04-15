"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useToast } from "@/components/ui/toast";
import { useQuery } from '@tanstack/react-query'
import { useEscPosPrint } from '@/lib/hooks/use-escpos-print'
import {
  buildKitchenComanda,
  buildRestaurantReceipt,
} from '@/lib/escpos/restaurant-builder'
import type { ComandaItem, RestaurantReceiptData, RestaurantCompany } from '@/lib/escpos/restaurant-builder'
import {
  Plus, Pencil, X, DollarSign, Receipt, Printer,
  UserCheck, Ban, RefreshCw, LogOut, Search, Coins,
  Clock, ChefHat, AlertTriangle, CreditCard, Banknote,
  ArrowLeftRight, Check, Percent, Scissors,
  Merge, ArrowRightLeft, UserCircle, FileText, Wifi, WifiOff, MessageSquare
} from "lucide-react";

/* ======================================================================
   TYPES
   ====================================================================== */

interface AccountLine {
  id: string;
  productId?: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  originalPrice?: number;
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
interface CustomerResult { id: string; name: string; taxId?: string; phone?: string; email?: string; }

type ModalType =
  | null | "open" | "captura" | "cobrar" | "factura"
  | "propina" | "mesero" | "cancelFolio" | "confirmCancelLine"
  | "cambiarCuenta" | "juntarCuentas" | "desctoGeneral"
  | "dividirCuenta" | "cliente" | "transferirProd" | "desctoProd" | "precuenta";

/* ======================================================================
   HELPERS
   ====================================================================== */

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

/* ======================================================================
   PRINT — Browser fallback (only when ESC/POS is not available)
   ====================================================================== */

function printReceiptBrowser(sel: OpenSession, companyName: string, paymentMethod?: string, discount?: number) {
  const activeLines = sel.lines.filter((l) => l.status !== "CANCELLED");
  const discountAmt = discount || 0;
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
    <div class="c b big">${companyName}</div>
    <div class="line"></div>
    <div class="row"><span class="b">Mesa:</span><span>${sel.tableNumber}</span></div>
    <div class="row"><span class="b">Mesero:</span><span>${sel.waiterName}</span></div>
    <div class="row"><span class="b">Fecha:</span><span>${new Date().toLocaleString("es-CO")}</span></div>
    ${paymentMethod ? `<div class="row"><span class="b">Pago:</span><span>${paymentMethod}</span></div>` : ""}
    <div class="line"></div>
    <table><tr class="b"><td>Cant</td><td>Descripcion</td><td class="r">Importe</td></tr>
    ${activeLines.map((l) => `<tr><td>${l.quantity}</td><td>${l.productName}${l.notes ? ` <span class="sm">[${l.notes}]</span>` : ""}</td><td class="r">${fmtCur(l.quantity * l.unitPrice)}</td></tr>`).join("")}
    </table>
    <div class="line"></div>
    <div class="row"><span>Subtotal:</span><span>${fmtCur(sel.subtotal)}</span></div>
    ${discountAmt > 0 ? `<div class="row"><span>Descuento:</span><span>-${fmtCur(discountAmt)}</span></div>` : ""}
    <div class="row"><span>Impuestos:</span><span>${fmtCur(sel.taxAmount || 0)}</span></div>
    ${sel.tipAmount > 0 ? `<div class="row"><span>Propina:</span><span>${fmtCur(sel.tipAmount)}</span></div>` : ""}
    <div class="line"></div>
    <div class="row b big"><span>TOTAL:</span><span>${fmtCur(sel.total + sel.tipAmount - discountAmt)}</span></div>
    <div class="line"></div>
    <div class="c sm" style="margin-top:8px">Gracias por su preferencia</div>
    <script>setTimeout(()=>{window.print()},300)</script>
  </body></html>`);
  w.document.close();
}

function printComandaBrowser(tableName: string, waiterName: string, items: CartLine[]) {
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
    <div style="font-size:10px;color:#555">${new Date().toLocaleString("es-CO")}</div>
    <div class="line"></div>
    ${items.map((i) => `<div class="item"><span class="b">${i.quantity}x</span> ${i.productName}${i.notes ? `<div class="notes">${i.notes}</div>` : ""}</div>`).join("")}
    <div class="line"></div>
    <div class="c b big">PREPARAR</div>
    <script>setTimeout(()=>{window.print()},300)</script>
  </body></html>`);
  w.document.close();
}

/* ======================================================================
   REUSABLE UI
   ====================================================================== */

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

function ToolBtn({ label, Icon, onClick, disabled, variant = "default" }: {
  label: string; Icon: any; onClick: () => void; disabled?: boolean;
  variant?: "default" | "accent" | "success" | "danger";
}) {
  const base = "flex flex-col items-center justify-center gap-0.5 px-2 py-2 rounded-lg text-[10px] font-semibold border min-w-[72px]";
  const styles = {
    default: "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700",
    accent: "bg-amber-600 border-amber-700 text-white hover:bg-amber-700",
    success: "bg-emerald-600 border-emerald-700 text-white hover:bg-emerald-700",
    danger: "bg-red-600/20 border-red-600/30 text-red-400 hover:bg-red-600/30",
  };
  return (
    <button onClick={onClick} disabled={disabled}
      className={`${base} ${disabled ? "opacity-30 cursor-not-allowed bg-slate-800 border-slate-800 text-slate-600" : styles[variant]}`}>
      <Icon className="w-4 h-4" />
      <span className="leading-tight text-center">{label}</span>
    </button>
  );
}

/* ======================================================================
   COMPONENT
   ====================================================================== */

export const CashierBillingConsole: React.FC = () => {
  const { toast } = useToast();

  // ── Settings & ESC/POS printer ──
  const { data: settingsData } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await fetch('/api/settings')
      if (!res.ok) return null
      const d = await res.json()
      return d.settings
    },
    staleTime: 60_000,
  })

  const parsedCustom = useMemo(() => {
    try {
      if (!settingsData?.customSettings) return null
      return typeof settingsData.customSettings === 'string'
        ? JSON.parse(settingsData.customSettings)
        : settingsData.customSettings
    } catch { return null }
  }, [settingsData?.customSettings])

  const printingConfig = parsedCustom?.printing
  const companyName = settingsData?.companyName || 'Mi Restaurante'
  const companyData: RestaurantCompany = useMemo(() => ({
    name: companyName,
    taxId: settingsData?.companyNit || '',
    address: settingsData?.companyAddress || '',
    phone: settingsData?.companyPhone || '',
    regime: parsedCustom?.identity?.regime || '',
  }), [companyName, settingsData, parsedCustom])

  const {
    status: escposStatus,
    printRaw,
    selectPrinter,
    isPrinting: escposPrinting,
  } = useEscPosPrint({
    useGlobal: true,
    autoConnect: true,
    paperWidth: printingConfig?.ticketDesign?.paperWidth === '58mm' ? 32 : 48,
  })
  const isEscPosReady = escposStatus === 'connected'

  // Smart print functions — ESC/POS first, browser fallback
  const printComanda = useCallback((tableName: string, waiterName: string, items: CartLine[]) => {
    const comandaItems: ComandaItem[] = items.map(i => ({ productName: i.productName, quantity: i.quantity, notes: i.notes || null }))
    if (isEscPosReady) {
      const enc = buildKitchenComanda(tableName, waiterName, comandaItems, { width: printingConfig?.ticketDesign?.paperWidth === '58mm' ? 32 : 48 })
      printRaw(enc).then(ok => { if (ok) toast('Comanda impresa ✔', 'success') })
    } else {
      printComandaBrowser(tableName, waiterName, items)
    }
  }, [isEscPosReady, printRaw, printingConfig, toast])

  const printReceipt = useCallback((session: OpenSession, paymentMethod?: string, discount?: number) => {
    if (isEscPosReady) {
      const receiptData: RestaurantReceiptData = {
        tableNumber: session.tableNumber,
        waiterName: session.waiterName,
        zoneName: session.zoneName,
        items: session.lines.map(l => ({ productName: l.productName, quantity: l.quantity, unitPrice: l.unitPrice, notes: l.notes, status: l.status })),
        subtotal: session.subtotal,
        taxAmount: session.taxAmount || 0,
        total: session.total,
        tipAmount: session.tipAmount,
        discountAmount: discount || 0,
        paymentMethod,
        customerName: (session as any).customerName || null,
        customerTaxId: (session as any).customerTaxId || null,
      }
      const enc = buildRestaurantReceipt(receiptData, companyData, { width: printingConfig?.ticketDesign?.paperWidth === '58mm' ? 32 : 48 })
      printRaw(enc).then(ok => { if (ok) toast('Ticket impreso ✔', 'success') })
    } else {
      printReceiptBrowser(session, companyName, paymentMethod, discount)
    }
  }, [isEscPosReady, printRaw, companyData, companyName, printingConfig, toast])

  // ── Core state ──
  const [sessions, setSessions] = useState<OpenSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<OpenSession | null>(null);
  const [searchText, setSearchText] = useState("");
  const [hasActiveShift, setHasActiveShift] = useState<boolean | null>(null);
  const [modal, setModal] = useState<ModalType>(null);

  // ── Selected line (product row) ──
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);

  // ── Cancel reason ──
  const [cancelReason, setCancelReason] = useState("");

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

  // ── Cobrar / Split payment ──
  const [payEntries, setPayEntries] = useState<{ method: "CASH" | "CARD" | "TRANSFER"; amount: string; reference: string }[]>([{ method: "CASH", amount: "", reference: "" }]);
  const [billing, setBilling] = useState(false);
  const [billSuccess, setBillSuccess] = useState(false);

  // ── Factura ──
  const [issuingInvoice, setIssuingInvoice] = useState(false);
  const [lastInvoiceId, setLastInvoiceId] = useState<string | null>(null);
  const [lastInvoiceNumber, setLastInvoiceNumber] = useState<string | null>(null);

  // ── Propina ──
  const [tipInput, setTipInput] = useState("");
  const [savingTip, setSavingTip] = useState(false);

  // ── Cambiar Mesero ──
  const [changingWaiter, setChangingWaiter] = useState(false);

  // ── Cancel ──
  const [cancellingLine, setCancellingLine] = useState(false);
  const [cancellingFolio, setCancellingFolio] = useState(false);

  // ── Cambiar Cuenta (rename table) ──
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);

  // ── Juntar Cuentas ──
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [merging, setMerging] = useState(false);

  // ── Descto General ──
  const [discountPercent, setDiscountPercent] = useState("");
  const [sessionDiscount, setSessionDiscount] = useState<Record<string, number>>({});

  // ── Dividir Cuenta ──
  const [splitItems, setSplitItems] = useState<Set<string>>(new Set());
  const [splitting, setSplitting] = useState(false);

  // ── Cliente ──
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerResult[]>([]);
  const [sessionCustomer, setSessionCustomer] = useState<Record<string, CustomerResult>>({});

  // ── Transferir Prod ──
  const [transferTargetId, setTransferTargetId] = useState("");
  const [transferring, setTransferring] = useState(false);

  // ── Descto Prod ──
  const [prodDiscountPercent, setProdDiscountPercent] = useState("");
  const [applyingProdDiscount, setApplyingProdDiscount] = useState(false);

  // Derived
  const selectedLine = sel?.lines.find((l) => l.id === selectedLineId) ?? null;
  const isCancellable = selectedLine && (selectedLine.status === "PENDING" || selectedLine.status === "COOKING");
  const activeLines = sel?.lines.filter((l) => l.status !== "CANCELLED") ?? [];
  const discountAmt = sel ? (sessionDiscount[sel.id] || 0) : 0;

  const filtered = sessions.filter((s) => {
    if (!searchText) return true;
    const q = searchText.toLowerCase();
    return s.tableNumber.toLowerCase().includes(q) || s.waiterName.toLowerCase().includes(q);
  });

  const subtotal = sel?.subtotal ?? 0;
  const taxAmount = sel?.taxAmount ?? 0;
  const total = sel?.total ?? 0;
  const tip = sel?.tipAmount ?? 0;
  const grandTotal = total + tip - discountAmt;
  const customer = sel ? sessionCustomer[sel.id] : undefined;

  const payEntriesTotal = payEntries.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const payEntriesOk = payEntriesTotal >= grandTotal && payEntries.every((e) => (parseFloat(e.amount) || 0) > 0);

  useEffect(() => { setSelectedLineId(null); }, [sel?.id]);

  /* ====================================================================
     DATA FETCHING
     ==================================================================== */

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
    const iv = setInterval(fetchSessions, 8_000);
    return () => clearInterval(iv);
  }, [fetchSessions, checkShift]);

  const fetchWaiters = async () => {
    const res = await fetch("/api/restaurant/waiters");
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || "Error cargando meseros");
    const wl: Waiter[] = Array.isArray(d) ? d : [];
    setWaiters(wl);
    return wl;
  };

  /* ====================================================================
     1. ABRIR CUENTA
     ==================================================================== */

  const nextTableNumber = useCallback(() => {
    const used = new Set(sessions.map((s) => s.tableNumber));
    for (let i = 1; i <= 999; i++) { if (!used.has(String(i))) return String(i); }
    return String(sessions.length + 1);
  }, [sessions]);

  const handleOpenClick = async () => {
    if (hasActiveShift === false) { toast("Abra un turno de caja primero", "error"); return; }
    setOpenError(null);
    setNewTableName(nextTableNumber());
    try { const wl = await fetchWaiters(); setPickedWaiter(wl[0]?.id ?? ""); }
    catch (err: any) { toast(err.message, "error"); return; }
    setModal("open");
    setTimeout(() => tableInputRef.current?.select(), 80);
  };

  const handleConfirmOpen = async () => {
    const name = newTableName.trim();
    if (!name || !pickedWaiter) return;
    setOpening(true); setOpenError(null);
    try {
      const res = await fetch("/api/restaurant/sessions", {
        method: "POST", headers: { "Content-Type": "application/json" },
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

  /* ====================================================================
     2. CANCELAR PROD
     ==================================================================== */

  const handleCancelLineClick = () => {
    if (!selectedLine || !isCancellable) { toast("Seleccione un producto cancelable", "warning"); return; }
    setCancelReason("");
    setModal("confirmCancelLine");
  };

  const handleConfirmCancelLine = async () => {
    if (!selectedLineId) return;
    setCancellingLine(true);
    try {
      const res = await fetch(`/api/restaurant/kds/items/${selectedLineId}/status`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Error cancelando"); }
      // Immediately update local state so the product disappears without waiting for the poll
      setSessions((prev) => prev.map((s) => ({
        ...s,
        lines: s.lines.map((l) => l.id === selectedLineId ? { ...l, status: "CANCELLED" } : l),
        itemsCount: s.lines.filter((l) => l.id !== selectedLineId && l.status !== "CANCELLED").length,
      })));
      setSel((prev) => prev ? {
        ...prev,
        lines: prev.lines.map((l) => l.id === selectedLineId ? { ...l, status: "CANCELLED" } : l),
        itemsCount: prev.lines.filter((l) => l.id !== selectedLineId && l.status !== "CANCELLED").length,
      } : prev);
      toast("Producto cancelado", "success");
      setSelectedLineId(null); setModal(null);
    } catch (err: any) { toast(err.message, "error"); }
    finally { setCancellingLine(false); }
  };

  /* ====================================================================
     3. CAMBIAR CUENTA (rename table number)
     ==================================================================== */

  const handleCambiarCuentaClick = () => {
    if (!sel) { toast("Seleccione una cuenta", "warning"); return; }
    setRenameValue(sel.tableNumber);
    setModal("cambiarCuenta");
  };

  const handleConfirmRename = async () => {
    if (!sel || !renameValue.trim()) return;
    setRenaming(true);
    try {
      const res = await fetch(`/api/restaurant/sessions/${sel.id}/update`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableName: renameValue.trim() }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Error renombrando"); }
      toast(`Mesa renombrada a ${renameValue.trim()}`, "success");
      setModal(null);
      await fetchSessions();
    } catch (err: any) { toast(err.message, "error"); }
    finally { setRenaming(false); }
  };

  /* ====================================================================
     4. JUNTAR CUENTAS
     ==================================================================== */

  const handleJuntarClick = () => {
    if (!sel) { toast("Seleccione la cuenta destino", "warning"); return; }
    if (sessions.length < 2) { toast("Se necesitan al menos 2 cuentas", "warning"); return; }
    setMergeTargetId("");
    setModal("juntarCuentas");
  };

  const handleConfirmJuntar = async () => {
    if (!sel || !mergeTargetId) return;
    setMerging(true);
    try {
      const source = sessions.find((s) => s.id === mergeTargetId);
      if (!source) throw new Error("Cuenta no encontrada");
      const transferableItems = source.lines.filter((l) => l.status !== "CANCELLED");
      if (transferableItems.length === 0) throw new Error("La cuenta seleccionada no tiene productos activos");
      const res = await fetch(`/api/restaurant/sessions/${mergeTargetId}/transfer-items`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetSessionId: sel.id, itemIds: transferableItems.map((l) => l.id) }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Error juntando"); }
      await fetch(`/api/restaurant/sessions/${mergeTargetId}/cancel`, { method: "POST" });
      toast(`Cuentas juntadas en Mesa ${sel.tableNumber}`, "success");
      setModal(null);
      await fetchSessions();
    } catch (err: any) { toast(err.message, "error"); }
    finally { setMerging(false); }
  };

  /* ====================================================================
     5. DESCTO GENERAL
     ==================================================================== */

  const handleDesctoGeneralClick = () => {
    if (!sel) { toast("Seleccione una cuenta", "warning"); return; }
    setDiscountPercent("");
    setModal("desctoGeneral");
  };

  const handleApplyDesctoGeneral = () => {
    if (!sel) return;
    const pct = parseFloat(discountPercent) || 0;
    if (pct <= 0 || pct > 100) { toast("Ingrese un porcentaje entre 1 y 100", "warning"); return; }
    const amount = Math.round(sel.total * pct) / 100;
    setSessionDiscount((prev) => ({ ...prev, [sel.id]: amount }));
    toast(`Descuento de ${pct}% (${fmtCur(amount)}) aplicado`, "success");
    setModal(null);
  };

  /* ====================================================================
     6. DIVIDIR CUENTA
     ==================================================================== */

  const handleDividirClick = () => {
    if (!sel) { toast("Seleccione una cuenta", "warning"); return; }
    if (activeLines.length < 2) { toast("Se necesitan al menos 2 productos para dividir", "warning"); return; }
    setSplitItems(new Set());
    setModal("dividirCuenta");
  };

  const toggleSplitItem = (id: string) => {
    setSplitItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleConfirmDividir = async () => {
    if (!sel || splitItems.size === 0) return;
    setSplitting(true);
    try {
      const wl = waiters.length > 0 ? waiters : await fetchWaiters();
      const nextNum = (() => {
        const used = new Set(sessions.map((s) => s.tableNumber));
        for (let i = 1; i <= 999; i++) { if (!used.has(String(i))) return String(i); }
        return String(sessions.length + 1);
      })();
      const createRes = await fetch("/api/restaurant/sessions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableName: nextNum, waiterId: wl[0]?.id ?? sel.waiterName }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error || "No se pudo crear cuenta nueva");
      const res = await fetch(`/api/restaurant/sessions/${sel.id}/transfer-items`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetSessionId: createData.id, itemIds: Array.from(splitItems) }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Error dividiendo"); }
      toast(`Cuenta dividida. Nueva mesa: ${nextNum}`, "success");
      setModal(null);
      await fetchSessions();
    } catch (err: any) { toast(err.message, "error"); }
    finally { setSplitting(false); }
  };

  /* ====================================================================
     7. CAPTURA
     ==================================================================== */

  const handleCapturaClick = () => {
    if (hasActiveShift === false) { toast("Abra un turno de caja primero", "error"); return; }
    if (!sel) { toast("Seleccione una cuenta", "warning"); return; }
    setCapturaCart([]); setProductSearch(""); setProducts([]);
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
      return { ...l, quantity: Math.max(1, l.quantity + delta) };
    }));
  };

  const handleSendCaptura = async () => {
    if (!sel || capturaCart.length === 0) return;
    setSendingOrder(true);
    try {
      const res = await fetch("/api/restaurant/orders", {
        method: "POST", headers: { "Content-Type": "application/json" },
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

  /* ====================================================================
     8. CLIENTE
     ==================================================================== */

  const handleClienteClick = () => {
    if (!sel) { toast("Seleccione una cuenta", "warning"); return; }
    setCustomerSearch(""); setCustomerResults([]);
    setModal("cliente");
  };

  useEffect(() => {
    if (modal !== "cliente") return;
    if (!customerSearch.trim()) { setCustomerResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/pos/cashier/customer-search?search=${encodeURIComponent(customerSearch)}`);
        const d = await res.json();
        setCustomerResults(Array.isArray(d) ? d : []);
      } catch { setCustomerResults([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [customerSearch, modal]);

  const assignCustomer = (c: CustomerResult) => {
    if (!sel) return;
    setSessionCustomer((prev) => ({ ...prev, [sel.id]: c }));
    toast(`Cliente ${c.name} asignado a Mesa ${sel.tableNumber}`, "success");
    setModal(null);
  };

  /* ====================================================================
     9. CAMBIAR MESERO
     ==================================================================== */

  const handleMeseroClick = async () => {
    if (!sel) return;
    try { await fetchWaiters(); } catch (err: any) { toast(err.message, "error"); return; }
    setPickedWaiter(""); setModal("mesero");
  };

  const handleConfirmMesero = async () => {
    if (!sel || !pickedWaiter) return;
    setChangingWaiter(true);
    try {
      const res = await fetch(`/api/restaurant/sessions/${sel.id}/update`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ waiterId: pickedWaiter }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Error cambiando mesero"); }
      toast("Mesero actualizado", "success");
      setModal(null);
      await fetchSessions();
    } catch (err: any) { toast(err.message, "error"); }
    finally { setChangingWaiter(false); }
  };

  /* ====================================================================
     10. TRANSFERIR PROD
     ==================================================================== */

  const handleTransferirClick = () => {
    if (!sel) { toast("Seleccione una cuenta", "warning"); return; }
    if (!selectedLine) { toast("Seleccione un producto de la tabla", "warning"); return; }
    if (selectedLine.status === "CANCELLED") { toast("No se puede transferir un producto cancelado", "warning"); return; }
    if (sessions.length < 2) { toast("Se necesitan al menos 2 cuentas abiertas", "warning"); return; }
    setTransferTargetId("");
    setModal("transferirProd");
  };

  const handleConfirmTransfer = async () => {
    if (!sel || !transferTargetId || !selectedLineId) return;
    setTransferring(true);
    try {
      const res = await fetch(`/api/restaurant/sessions/${sel.id}/transfer-items`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetSessionId: transferTargetId, itemIds: [selectedLineId] }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Error transfiriendo"); }
      const target = sessions.find((s) => s.id === transferTargetId);
      toast(`Producto transferido a Mesa ${target?.tableNumber || "?"}`, "success");
      setSelectedLineId(null); setModal(null);
      await fetchSessions();
    } catch (err: any) { toast(err.message, "error"); }
    finally { setTransferring(false); }
  };

  /* ====================================================================
     11. DESCTO PROD
     ==================================================================== */

  const handleDesctoProdClick = () => {
    if (!sel) { toast("Seleccione una cuenta", "warning"); return; }
    if (!selectedLine) { toast("Seleccione un producto de la tabla", "warning"); return; }
    if (selectedLine.status === "CANCELLED") { toast("No se puede aplicar descuento a producto cancelado", "warning"); return; }
    setProdDiscountPercent("");
    setModal("desctoProd");
  };

  const handleApplyDesctoProd = async () => {
    if (!selectedLine) return;
    const pct = parseFloat(prodDiscountPercent) || 0;
    if (pct <= 0 || pct > 100) { toast("Ingrese un porcentaje entre 1 y 100", "warning"); return; }
    setApplyingProdDiscount(true);
    try {
      const newPrice = Math.round(selectedLine.unitPrice * (1 - pct / 100) * 100) / 100;
      const res = await fetch(`/api/restaurant/orders/items/${selectedLine.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitPrice: newPrice }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Error aplicando descuento"); }
      toast(`Descuento ${pct}% aplicado a ${selectedLine.productName}`, "success");
      setSelectedLineId(null); setModal(null);
      await fetchSessions();
    } catch (err: any) { toast(err.message, "error"); }
    finally { setApplyingProdDiscount(false); }
  };

  /* ====================================================================
     12. PROPINA INCLUIDA
     ==================================================================== */

  const handlePropinaClick = () => { if (!sel) return; setTipInput(String(sel.tipAmount || 0)); setModal("propina"); };

  const handleSaveTip = async () => {
    if (!sel) return;
    setSavingTip(true);
    try {
      const res = await fetch(`/api/restaurant/sessions/${sel.id}/tip`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipAmount: parseFloat(tipInput) || 0 }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Error guardando propina"); }
      toast("Propina actualizada", "success");
      setModal(null);
      await fetchSessions();
    } catch (err: any) { toast(err.message, "error"); }
    finally { setSavingTip(false); }
  };

  /* ====================================================================
     13. PAGAR CUENTA (COBRAR) — multi-payment
     ==================================================================== */

  const addPayEntry = () => {
    setPayEntries((prev) => [...prev, { method: "CASH" as const, amount: "", reference: "" }]);
  };

  const removePayEntry = (idx: number) => {
    setPayEntries((prev) => prev.filter((_, i) => i !== idx));
  };

  const updatePayEntry = (idx: number, field: "method" | "amount" | "reference", value: string) => {
    setPayEntries((prev) => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e));
  };

  const handleCobrarClick = () => {
    if (!sel) return;
    setPayEntries([{ method: "CASH", amount: String(grandTotal.toFixed(2)), reference: "" }]);
    setBillSuccess(false);
    setModal("cobrar");
  };

  const handleConfirmCobrar = async () => {
    if (!sel) return;
    setBilling(true);
    try {
      const customer = sessionCustomer[sel.id];
      const discount = sessionDiscount[sel.id] || 0;
      const payments = payEntries
        .filter((e) => (parseFloat(e.amount) || 0) > 0)
        .map((e) => ({ method: e.method, amount: parseFloat(e.amount), reference: e.reference || null }));
      const res = await fetch(`/api/restaurant/sessions/${sel.id}/close`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: customer?.id || null, discountAmount: discount, payments }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Error cerrando cuenta");
      // Store invoice ID for electronic billing
      if (d.invoice?.id) {
        setLastInvoiceId(d.invoice.id);
        setLastInvoiceNumber(d.invoice.number || null);
      }
      const methodLabel = payments.map((p) => {
        if (p.method === "CASH") return "Efectivo";
        if (p.method === "CARD") return "Tarjeta";
        return "Transferencia";
      }).join(", ");
      printReceipt(sel, methodLabel, discount);
      setBillSuccess(true);
      toast(`Mesa ${sel.tableNumber} cobrada`, "success");
      setSessionDiscount((prev) => { const n = { ...prev }; delete n[sel.id]; return n; });
      setSessionCustomer((prev) => { const n = { ...prev }; delete n[sel.id]; return n; });
      await fetchSessions();
    } catch (err: any) { toast(err.message, "error"); }
    finally { setBilling(false); }
  };

  /* ====================================================================
     14. FACTURA ELECTRÓNICA (Factus / DIAN)
     ==================================================================== */

  const handleFacturaClick = () => { if (!sel) return; setModal("factura"); };

  const handleEmitFactura = async (invoiceId?: string) => {
    const id = invoiceId || lastInvoiceId;
    if (!id) { toast("Primero cobre la cuenta para generar la factura", "warning"); return; }
    setIssuingInvoice(true);
    try {
      const res = await fetch(`/api/invoices/${id}/send-electronic`, {
        method: "POST",
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Error emitiendo factura electrónica");
      toast(`Factura electrónica enviada a la DIAN ✔`, "success");
      setModal(null);
      setLastInvoiceId(null);
      setLastInvoiceNumber(null);
    } catch (err: any) { toast(err.message, "error"); }
    finally { setIssuingInvoice(false); }
  };

  /* ====================================================================
     15. IMPRIMIR CUENTA
     ==================================================================== */

  const handlePrint = () => { if (!sel) return; printReceipt(sel, undefined, discountAmt); };

  /* ====================================================================
     16. CANCELAR FOLIO
     ==================================================================== */

  const handleCancelFolioClick = () => { if (!sel) return; setCancelReason(""); setModal("cancelFolio"); };

  const handleConfirmCancelFolio = async () => {
    if (!sel) return;
    setCancellingFolio(true);
    try {
      const res = await fetch(`/api/restaurant/sessions/${sel.id}/cancel`, { method: "POST" });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Error cancelando folio"); }
      toast(`Folio Mesa ${sel.tableNumber} cancelado`, "success");
      setModal(null);
      await fetchSessions();
    } catch (err: any) { toast(err.message, "error"); }
    finally { setCancellingFolio(false); }
  };

  /* ====================================================================
     LOADING
     ==================================================================== */

  if (loading) {
    return (
      <div className="h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-amber-500 font-bold text-lg animate-pulse">Cargando punto de venta...</div>
      </div>
    );
  }

  /* ====================================================================
     RENDER
     ==================================================================== */

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-white font-sans overflow-hidden select-none">

      {/* ================================================================
         MODALS
         ================================================================ */}

      {/* ABRIR CUENTA */}
      {modal === "open" && (
        <Backdrop onClose={() => setModal(null)}>
          <ModalCard title="ABRIR CUENTA" onClose={() => setModal(null)}>
            {openError && <div className="bg-red-600/10 border border-red-600/30 rounded-lg p-3 mb-3 text-red-400 text-xs font-semibold">{openError}</div>}
            <label className="block text-xs font-semibold text-slate-400 mb-1">Mesa / Cuenta</label>
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

      {/* CANCELAR PRODUCTO */}
      {modal === "confirmCancelLine" && selectedLine && (
        <Backdrop onClose={() => setModal(null)}>
          <ModalCard title="CANCELAR PRODUCTO" onClose={() => setModal(null)}>
            <div className="text-center mb-4">
              <div className="w-12 h-12 rounded-full bg-red-600/20 flex items-center justify-center mx-auto mb-3"><X className="w-6 h-6 text-red-400" /></div>
              <p className="text-white text-sm font-semibold mb-1">Cancelar este producto?</p>
              <div className="bg-slate-800 rounded-lg p-3 mt-3">
                <div className="text-amber-400 font-bold text-sm">{selectedLine.productName}</div>
                <div className="text-slate-400 text-xs mt-1">Cantidad: {selectedLine.quantity} &middot; {fmtCur(selectedLine.quantity * selectedLine.unitPrice)}</div>
                <div className={`text-xs font-bold mt-1 ${statusColor(selectedLine.status)}`}>{statusLabel(selectedLine.status)}</div>
              </div>
            </div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Motivo de cancelación *</label>
            <input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} autoFocus placeholder="Ej: Cliente cambio de opinion, error de captura..." className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-red-500 mb-3 placeholder:text-slate-600" />
            <div className="flex gap-2">
              <button onClick={() => setModal(null)} className="flex-1 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-sm font-semibold text-slate-300 hover:bg-slate-700">Volver</button>
              <button onClick={handleConfirmCancelLine} disabled={cancellingLine || !cancelReason.trim()} className="flex-1 py-2.5 bg-red-600 rounded-lg text-sm font-bold text-white hover:bg-red-700 disabled:opacity-40">{cancellingLine ? "Cancelando..." : "Cancelar Producto"}</button>
            </div>
          </ModalCard>
        </Backdrop>
      )}

      {/* CAMBIAR CUENTA */}
      {modal === "cambiarCuenta" && sel && (
        <Backdrop onClose={() => setModal(null)}>
          <ModalCard title={`CAMBIAR CUENTA \u2014 Mesa ${sel.tableNumber}`} onClose={() => setModal(null)}>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Nuevo nombre de mesa / cuenta</label>
            <input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleConfirmRename(); }} autoFocus className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-2xl font-black text-center text-amber-400 outline-none focus:border-amber-500 mb-4" />
            <div className="flex gap-2">
              <button onClick={() => setModal(null)} className="flex-1 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-sm font-semibold text-slate-300 hover:bg-slate-700">Cancelar</button>
              <button onClick={handleConfirmRename} disabled={!renameValue.trim() || renaming} className="flex-1 py-2.5 bg-amber-600 rounded-lg text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-40">{renaming ? "Cambiando..." : "Cambiar"}</button>
            </div>
          </ModalCard>
        </Backdrop>
      )}

      {/* JUNTAR CUENTAS */}
      {modal === "juntarCuentas" && sel && (
        <Backdrop onClose={() => setModal(null)}>
          <ModalCard title={`JUNTAR CUENTAS \u2192 Mesa ${sel.tableNumber}`} onClose={() => setModal(null)}>
            <p className="text-xs text-slate-400 mb-3">Seleccione la cuenta que desea fusionar con la actual. Todos sus productos se mover&aacute;n aqu&iacute;.</p>
            <div className="space-y-1.5 max-h-60 overflow-y-auto mb-4">
              {sessions.filter((s) => s.id !== sel.id).map((s) => (
                <div key={s.id} onClick={() => setMergeTargetId(s.id)}
                  className={`px-3 py-2.5 rounded-lg border cursor-pointer flex justify-between items-center ${mergeTargetId === s.id ? "bg-amber-600/15 border-amber-500" : "bg-slate-800 border-slate-700 hover:bg-slate-700"}`}>
                  <div>
                    <div className="text-sm font-bold text-white">Mesa {s.tableNumber}</div>
                    <div className="text-[10px] text-slate-500">{s.waiterName} &middot; {s.itemsCount} items</div>
                  </div>
                  <div className="text-sm font-bold text-amber-400">{fmtCur(s.total)}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setModal(null)} className="flex-1 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-sm font-semibold text-slate-300 hover:bg-slate-700">Cancelar</button>
              <button onClick={handleConfirmJuntar} disabled={!mergeTargetId || merging} className="flex-1 py-2.5 bg-amber-600 rounded-lg text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-40">{merging ? "Juntando..." : "Juntar"}</button>
            </div>
          </ModalCard>
        </Backdrop>
      )}

      {/* DESCTO GENERAL */}
      {modal === "desctoGeneral" && sel && (
        <Backdrop onClose={() => setModal(null)}>
          <ModalCard title={`DESCUENTO GENERAL \u2014 Mesa ${sel.tableNumber}`} onClose={() => setModal(null)}>
            <div className="text-center mb-4">
              <Percent className="w-10 h-10 text-amber-500 mx-auto mb-2" />
              <div className="text-xl font-black text-white">{fmtCur(sel.total)}</div>
              <div className="text-xs text-slate-500 mt-1">Total actual de la cuenta</div>
            </div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Porcentaje de descuento</label>
            <div className="flex items-center gap-2 mb-2">
              <input value={discountPercent} onChange={(e) => setDiscountPercent(e.target.value)} type="number" min="1" max="100" step="1" autoFocus className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-lg font-bold text-center text-white outline-none focus:border-amber-500" placeholder="10" onKeyDown={(e) => { if (e.key === "Enter") handleApplyDesctoGeneral(); }} />
              <span className="text-2xl font-bold text-amber-400">%</span>
            </div>
            {(parseFloat(discountPercent) || 0) > 0 && (
              <div className="text-center text-sm text-emerald-400 font-semibold mb-3">
                Descuento: {fmtCur(Math.round(sel.total * (parseFloat(discountPercent) || 0)) / 100)}
              </div>
            )}
            <div className="flex gap-2">
              {discountAmt > 0 && (
                <button onClick={() => { setSessionDiscount((prev) => { const n = { ...prev }; delete n[sel.id]; return n; }); toast("Descuento eliminado", "success"); setModal(null); }} className="py-2.5 px-3 bg-red-600/20 border border-red-600/30 rounded-lg text-sm font-semibold text-red-400 hover:bg-red-600/30">Quitar</button>
              )}
              <button onClick={() => setModal(null)} className="flex-1 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-sm font-semibold text-slate-300 hover:bg-slate-700">Cancelar</button>
              <button onClick={handleApplyDesctoGeneral} className="flex-1 py-2.5 bg-amber-600 rounded-lg text-sm font-bold text-white hover:bg-amber-700">Aplicar</button>
            </div>
          </ModalCard>
        </Backdrop>
      )}

      {/* DIVIDIR CUENTA */}
      {modal === "dividirCuenta" && sel && (
        <Backdrop onClose={() => setModal(null)}>
          <ModalCard title={`DIVIDIR CUENTA \u2014 Mesa ${sel.tableNumber}`} width="max-w-lg" onClose={() => setModal(null)}>
            <p className="text-xs text-slate-400 mb-3">Seleccione los productos que desea mover a una nueva cuenta.</p>
            <div className="space-y-1 max-h-72 overflow-y-auto mb-4 border border-slate-700 rounded-lg">
              {activeLines.map((line) => (
                <div key={line.id} onClick={() => toggleSplitItem(line.id)}
                  className={`px-3 py-2 cursor-pointer flex items-center gap-3 border-b border-slate-800 last:border-0 ${splitItems.has(line.id) ? "bg-amber-600/15" : "hover:bg-slate-800/50"}`}>
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${splitItems.has(line.id) ? "bg-amber-500 border-amber-500" : "border-slate-600"}`}>
                    {splitItems.has(line.id) && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-white truncate">{line.productName}</div>
                    <div className="text-[10px] text-slate-500">{line.quantity} x {fmtCur(line.unitPrice)}</div>
                  </div>
                  <div className="text-xs font-bold text-amber-400">{fmtCur(line.quantity * line.unitPrice)}</div>
                </div>
              ))}
            </div>
            <div className="text-right text-xs text-slate-400 mb-3">
              {splitItems.size} producto{splitItems.size !== 1 ? "s" : ""} seleccionado{splitItems.size !== 1 ? "s" : ""}: <span className="text-amber-400 font-bold">
                {fmtCur(activeLines.filter((l) => splitItems.has(l.id)).reduce((s, l) => s + l.quantity * l.unitPrice, 0))}
              </span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setModal(null)} className="flex-1 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-sm font-semibold text-slate-300 hover:bg-slate-700">Cancelar</button>
              <button onClick={handleConfirmDividir} disabled={splitItems.size === 0 || splitting} className="flex-1 py-2.5 bg-amber-600 rounded-lg text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-40">{splitting ? "Dividiendo..." : "Dividir"}</button>
            </div>
          </ModalCard>
        </Backdrop>
      )}

      {/* CAPTURA */}
      {modal === "captura" && (
        <Backdrop onClose={() => setModal(null)}>
          <ModalCard title={`CAPTURA \u2014 Mesa ${sel?.tableNumber}`} width="max-w-2xl" onClose={() => setModal(null)}>
            <div className="flex gap-4" style={{ minHeight: 340 }}>
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
              <div className="w-56 flex flex-col gap-2">
                <div className="text-xs font-bold text-slate-400">ORDEN ({capturaCart.reduce((s, l) => s + l.quantity, 0)})</div>
                <div className="flex-1 overflow-y-auto border border-slate-700 rounded-lg">
                  {capturaCart.length === 0 ? (
                    <div className="p-4 text-center text-slate-500 text-[10px]">Click un producto</div>
                  ) : capturaCart.map((l) => (
                    <div key={l.productId} className="px-2 py-1.5 border-b border-slate-800">
                      <div className="flex items-center gap-1">
                        <div className="flex items-center gap-1 mr-1">
                          <button onClick={() => updateCapturaQty(l.productId, -1)} className="w-5 h-5 flex items-center justify-center rounded bg-slate-700 text-slate-300 text-xs font-bold hover:bg-slate-600">-</button>
                          <span className="text-xs font-bold text-white w-5 text-center">{l.quantity}</span>
                          <button onClick={() => updateCapturaQty(l.productId, 1)} className="w-5 h-5 flex items-center justify-center rounded bg-slate-700 text-slate-300 text-xs font-bold hover:bg-slate-600">+</button>
                        </div>
                        <div className="flex-1 min-w-0"><div className="font-semibold text-[11px] text-white truncate">{l.productName}</div><div className="text-[10px] text-slate-500">{fmtCur(l.quantity * l.unitPrice)}</div></div>
                        <button onClick={() => removeFromCaptura(l.productId)} className="text-red-400 hover:text-red-300 font-bold text-sm leading-none">&times;</button>
                      </div>
                      <input value={l.notes} onChange={(e) => setCapturaCart(prev => prev.map(c => c.productId === l.productId ? { ...c, notes: e.target.value } : c))} placeholder="Notas: sin cebolla, término medio..." className="mt-1 w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[10px] text-amber-300 outline-none focus:border-amber-500 placeholder:text-slate-600" />
                    </div>
                  ))}
                </div>
                <div className="text-right font-bold text-amber-400 text-sm">{fmtCur(capturaCart.reduce((s, l) => s + l.quantity * l.unitPrice, 0))}</div>
                <button onClick={() => setModal(null)} className="py-2 bg-slate-800 border border-slate-600 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-700">Cancelar</button>
                <button onClick={handleSendCaptura} disabled={capturaCart.length === 0 || sendingOrder} className="py-2 bg-emerald-600 rounded-lg text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-40">{sendingOrder ? "Enviando..." : "Enviar a Cocina"}</button>
              </div>
            </div>
          </ModalCard>
        </Backdrop>
      )}

      {/* CLIENTE */}
      {modal === "cliente" && sel && (
        <Backdrop onClose={() => setModal(null)}>
          <ModalCard title={`CLIENTE \u2014 Mesa ${sel.tableNumber}`} onClose={() => setModal(null)}>
            {customer && (
              <div className="bg-emerald-600/10 border border-emerald-600/30 rounded-lg p-3 mb-3 flex items-center justify-between">
                <div><div className="text-emerald-400 font-bold text-xs">{customer.name}</div><div className="text-[10px] text-slate-500">{customer.taxId || "Sin NIT"}</div></div>
                <button onClick={() => { setSessionCustomer((prev) => { const n = { ...prev }; delete n[sel.id]; return n; }); toast("Cliente desasignado", "success"); }} className="text-red-400 text-xs font-semibold hover:text-red-300">Quitar</button>
              </div>
            )}
            <input value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} placeholder="Buscar por nombre, NIT o telefono..." autoFocus className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-amber-500 mb-3" />
            <div className="max-h-52 overflow-y-auto border border-slate-700 rounded-lg mb-3">
              {customerResults.length === 0 ? (
                <div className="p-4 text-center text-slate-500 text-xs">{customerSearch ? "Sin resultados" : "Escribe para buscar..."}</div>
              ) : customerResults.map((c) => (
                <div key={c.id} onClick={() => assignCustomer(c)} className="px-3 py-2 cursor-pointer border-b border-slate-800 hover:bg-slate-800/50 flex justify-between items-center">
                  <div><div className="font-semibold text-xs text-white">{c.name}</div><div className="text-[10px] text-slate-500">{c.taxId || "Sin NIT"} &middot; {c.phone || ""}</div></div>
                  <UserCircle className="w-4 h-4 text-slate-500" />
                </div>
              ))}
            </div>
            <button onClick={() => setModal(null)} className="w-full py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-sm font-semibold text-slate-300 hover:bg-slate-700">Cerrar</button>
          </ModalCard>
        </Backdrop>
      )}

      {/* TRANSFERIR PROD */}
      {modal === "transferirProd" && sel && selectedLine && (
        <Backdrop onClose={() => setModal(null)}>
          <ModalCard title="TRANSFERIR PRODUCTO" onClose={() => setModal(null)}>
            <div className="bg-slate-800 rounded-lg p-3 mb-3">
              <div className="text-amber-400 font-bold text-sm">{selectedLine.productName}</div>
              <div className="text-slate-400 text-xs mt-1">{selectedLine.quantity} x {fmtCur(selectedLine.unitPrice)} = {fmtCur(selectedLine.quantity * selectedLine.unitPrice)}</div>
            </div>
            <p className="text-xs text-slate-400 mb-2">Seleccione la cuenta destino:</p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto mb-4">
              {sessions.filter((s) => s.id !== sel.id).map((s) => (
                <div key={s.id} onClick={() => setTransferTargetId(s.id)}
                  className={`px-3 py-2 rounded-lg border cursor-pointer flex justify-between items-center ${transferTargetId === s.id ? "bg-amber-600/15 border-amber-500" : "bg-slate-800 border-slate-700 hover:bg-slate-700"}`}>
                  <div className="text-sm font-bold text-white">Mesa {s.tableNumber}</div>
                  <div className="text-xs text-slate-500">{s.waiterName}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setModal(null)} className="flex-1 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-sm font-semibold text-slate-300 hover:bg-slate-700">Cancelar</button>
              <button onClick={handleConfirmTransfer} disabled={!transferTargetId || transferring} className="flex-1 py-2.5 bg-amber-600 rounded-lg text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-40">{transferring ? "Transfiriendo..." : "Transferir"}</button>
            </div>
          </ModalCard>
        </Backdrop>
      )}

      {/* DESCTO PROD */}
      {modal === "desctoProd" && selectedLine && (
        <Backdrop onClose={() => setModal(null)}>
          <ModalCard title="DESCUENTO PRODUCTO" onClose={() => setModal(null)}>
            <div className="bg-slate-800 rounded-lg p-3 mb-3 text-center">
              <div className="text-amber-400 font-bold text-sm">{selectedLine.productName}</div>
              <div className="text-white text-lg font-black mt-1">{fmtCur(selectedLine.unitPrice)}</div>
              <div className="text-[10px] text-slate-500">Precio unitario actual</div>
            </div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Porcentaje de descuento</label>
            <div className="flex items-center gap-2 mb-2">
              <input value={prodDiscountPercent} onChange={(e) => setProdDiscountPercent(e.target.value)} type="number" min="1" max="100" step="1" autoFocus className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-lg font-bold text-center text-white outline-none focus:border-amber-500" placeholder="10" onKeyDown={(e) => { if (e.key === "Enter") handleApplyDesctoProd(); }} />
              <span className="text-2xl font-bold text-amber-400">%</span>
            </div>
            {(parseFloat(prodDiscountPercent) || 0) > 0 && (
              <div className="text-center text-sm mb-3">
                <span className="text-slate-400">Nuevo precio: </span>
                <span className="text-emerald-400 font-bold">{fmtCur(Math.round(selectedLine.unitPrice * (1 - (parseFloat(prodDiscountPercent) || 0) / 100) * 100) / 100)}</span>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setModal(null)} className="flex-1 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-sm font-semibold text-slate-300 hover:bg-slate-700">Cancelar</button>
              <button onClick={handleApplyDesctoProd} disabled={applyingProdDiscount} className="flex-1 py-2.5 bg-amber-600 rounded-lg text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-40">{applyingProdDiscount ? "Aplicando..." : "Aplicar"}</button>
            </div>
          </ModalCard>
        </Backdrop>
      )}

      {/* COBRAR — multi-payment */}
      {modal === "cobrar" && sel && (
        <Backdrop onClose={() => !billing && setModal(null)}>
          <ModalCard title={`PAGAR CUENTA \u2014 Mesa ${sel.tableNumber}`} width="max-w-lg" onClose={() => !billing && setModal(null)}>
            {billSuccess ? (
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-emerald-600/20 flex items-center justify-center mx-auto mb-3"><Check className="w-8 h-8 text-emerald-400" /></div>
                <p className="text-emerald-400 font-bold text-lg mb-1">Cuenta cobrada</p>
                <p className="text-slate-400 text-sm">Mesa {sel.tableNumber} &middot; {fmtCur(grandTotal)}</p>
                {lastInvoiceNumber && <p className="text-slate-500 text-xs mt-1">Factura: {lastInvoiceNumber}</p>}
                <div className="flex gap-2 mt-4">
                  {lastInvoiceId && (
                    <button onClick={() => handleEmitFactura()} disabled={issuingInvoice} className="flex-1 py-2.5 bg-amber-600 rounded-lg text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-40">
                      {issuingInvoice ? "Enviando a DIAN..." : "Emitir Factura Electrónica"}
                    </button>
                  )}
                  <button onClick={() => { setModal(null); setLastInvoiceId(null); setLastInvoiceNumber(null); }} className="flex-1 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-sm font-semibold text-slate-300 hover:bg-slate-700">Cerrar</button>
                </div>
              </div>
            ) : (
              <>
                {/* Summary */}
                <div className="bg-slate-800 rounded-xl p-3 mb-4 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-slate-500 font-semibold">TOTAL A COBRAR</div>
                    <div className="text-3xl font-black text-amber-400">{fmtCur(grandTotal)}</div>
                    <div className="flex gap-3 mt-1 text-[10px] text-slate-500">
                      <span>Subtotal: {fmtCur(subtotal)}</span>
                      {discountAmt > 0 && <span className="text-emerald-400">Dto: -{fmtCur(discountAmt)}</span>}
                      {tip > 0 && <span className="text-amber-400">Propina: {fmtCur(tip)}</span>}
                    </div>
                  </div>
                  {customer && (
                    <div className="text-right">
                      <div className="text-[10px] text-slate-500">CLIENTE</div>
                      <div className="text-xs text-sky-400 font-semibold">{customer.name}</div>
                    </div>
                  )}
                </div>

                {/* Payment entries */}
                <div className="text-xs font-bold text-slate-400 mb-2 flex items-center justify-between">
                  <span>FORMA DE PAGO</span>
                  <button onClick={addPayEntry} className="flex items-center gap-1 text-amber-400 hover:text-amber-300 font-semibold">
                    <Plus className="w-3 h-3" /> Agregar metodo
                  </button>
                </div>

                <div className="space-y-2 mb-3">
                  {payEntries.map((entry, idx) => {
                    const amt = parseFloat(entry.amount) || 0;
                    const isCash = entry.method === "CASH";
                    const change = isCash && amt > grandTotal ? amt - grandTotal : 0;
                    return (
                      <div key={idx} className="bg-slate-800 border border-slate-700 rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-2">
                          {/* Method selector */}
                          <div className="flex gap-1">
                            {([
                              { k: "CASH" as const, label: "Efectivo", Icon: Banknote },
                              { k: "CARD" as const, label: "Tarjeta", Icon: CreditCard },
                              { k: "TRANSFER" as const, label: "Transfer.", Icon: ArrowLeftRight },
                            ]).map(({ k, label, Icon }) => (
                              <button key={k} onClick={() => updatePayEntry(idx, "method", k)}
                                className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-bold ${entry.method === k ? "bg-amber-600/20 border-amber-500 text-amber-400" : "bg-slate-700 border-slate-600 text-slate-400 hover:text-white"}`}>
                                <Icon className="w-3 h-3" />{label}
                              </button>
                            ))}
                          </div>
                          <span className="flex-1" />
                          {payEntries.length > 1 && (
                            <button onClick={() => removePayEntry(idx)} className="text-red-400 hover:text-red-300 text-xs font-bold">&times;</button>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">Monto</label>
                            <input value={entry.amount} onChange={(e) => updatePayEntry(idx, "amount", e.target.value)}
                              type="number" step="0.01" min="0"
                              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-lg font-bold text-center text-white outline-none focus:border-amber-500"
                              placeholder="0.00" autoFocus={idx === 0} />
                          </div>
                          {!isCash && (
                            <div className="flex-1">
                              <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">Referencia (opc.)</label>
                              <input value={entry.reference} onChange={(e) => updatePayEntry(idx, "reference", e.target.value)}
                                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-amber-500"
                                placeholder="# autorización..." />
                            </div>
                          )}
                        </div>
                        {isCash && change > 0 && (
                          <div className="mt-1.5 text-center">
                            <span className="text-[10px] text-slate-500">Cambio: </span>
                            <span className="text-base font-black text-emerald-400">{fmtCur(change)}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Payment total vs grand total */}
                {payEntries.length > 1 && (
                  <div className={`flex justify-between text-sm font-bold mb-3 px-1 ${payEntriesTotal >= grandTotal ? "text-emerald-400" : "text-red-400"}`}>
                    <span>Total ingresado:</span>
                    <span>{fmtCur(payEntriesTotal)} / {fmtCur(grandTotal)}</span>
                  </div>
                )}

                <div className="flex gap-2">
                  <button onClick={() => setModal(null)} disabled={billing} className="flex-1 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-sm font-semibold text-slate-300 hover:bg-slate-700 disabled:opacity-40">Cancelar</button>
                  <button onClick={handleConfirmCobrar} disabled={billing || !payEntriesOk}
                    className="flex-1 py-2.5 bg-emerald-600 rounded-lg text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed">
                    {billing ? "Procesando..." : "Confirmar Pago"}
                  </button>
                </div>
              </>
            )}
          </ModalCard>
        </Backdrop>
      )}

      {/* FACTURA ELECTRÓNICA */}
      {modal === "factura" && sel && (
        <Backdrop onClose={() => setModal(null)}>
          <ModalCard title={`FACTURA ELECTR\u00d3NICA \u2014 Mesa ${sel.tableNumber}`} onClose={() => setModal(null)}>
            <div className="text-center mb-4">
              <FileText className="w-10 h-10 text-amber-500 mx-auto mb-2" />
              <p className="text-slate-400 text-xs mb-1">Emitir factura electrónica via Factus / DIAN</p>
              <div className="text-2xl font-black text-amber-400 mt-2">{fmtCur(grandTotal)}</div>
              {customer && <div className="text-xs text-sky-400 mt-2">Cliente: {customer.name} ({customer.taxId || "Sin NIT"})</div>}
              {!lastInvoiceId && <div className="bg-amber-600/10 border border-amber-600/30 rounded-lg p-3 mt-3 text-amber-400 text-xs font-semibold">Primero debe cobrar la cuenta para generar la factura interna. Luego podrá emitirla electrónicamente.</div>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setModal(null)} className="flex-1 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-sm font-semibold text-slate-300 hover:bg-slate-700">Cancelar</button>
              <button onClick={() => lastInvoiceId ? handleEmitFactura() : handleCobrarClick()} className="flex-1 py-2.5 bg-amber-600 rounded-lg text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-40">
                {lastInvoiceId ? (issuingInvoice ? "Enviando..." : "Emitir a DIAN") : "Ir a Cobrar"}
              </button>
            </div>
          </ModalCard>
        </Backdrop>
      )}

      {/* PROPINA */}
      {modal === "propina" && sel && (
        <Backdrop onClose={() => setModal(null)}>
          <ModalCard title={`PROPINA INCLUIDA \u2014 Mesa ${sel.tableNumber}`} onClose={() => setModal(null)}>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Monto de propina</label>
            <input value={tipInput} onChange={(e) => setTipInput(e.target.value)} type="number" step="0.01" min="0" className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-lg font-bold text-center text-white outline-none focus:border-amber-500 mb-4" autoFocus onKeyDown={(e) => { if (e.key === "Enter") handleSaveTip(); }} />
            <div className="flex gap-2">
              <button onClick={() => setModal(null)} className="flex-1 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-sm font-semibold text-slate-300 hover:bg-slate-700">Cancelar</button>
              <button onClick={handleSaveTip} disabled={savingTip} className="flex-1 py-2.5 bg-amber-600 rounded-lg text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-40">{savingTip ? "Guardando..." : "Guardar"}</button>
            </div>
          </ModalCard>
        </Backdrop>
      )}

      {/* CAMBIAR MESERO */}
      {modal === "mesero" && sel && (
        <Backdrop onClose={() => setModal(null)}>
          <ModalCard title={`CAMBIAR MESERO \u2014 Mesa ${sel.tableNumber}`} onClose={() => setModal(null)}>
            <p className="text-xs text-slate-400 mb-2">Mesero actual: <span className="text-white font-semibold">{sel.waiterName}</span></p>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Nuevo mesero</label>
            <select value={pickedWaiter} onChange={(e) => setPickedWaiter(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-amber-500 mb-4">
              <option value="">Seleccionar...</option>
              {waiters.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
            </select>
            <div className="flex gap-2">
              <button onClick={() => setModal(null)} className="flex-1 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-sm font-semibold text-slate-300 hover:bg-slate-700">Cancelar</button>
              <button onClick={handleConfirmMesero} disabled={!pickedWaiter || changingWaiter} className="flex-1 py-2.5 bg-amber-600 rounded-lg text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-40">{changingWaiter ? "Cambiando..." : "Cambiar"}</button>
            </div>
          </ModalCard>
        </Backdrop>
      )}

      {modal === "cancelFolio" && sel && (
        <Backdrop onClose={() => setModal(null)}>
          <ModalCard title={`CANCELAR FOLIO \u2014 Mesa ${sel.tableNumber}`} onClose={() => setModal(null)}>
            <div className="text-center mb-4">
              <div className="w-12 h-12 rounded-full bg-red-600/20 flex items-center justify-center mx-auto mb-3"><AlertTriangle className="w-6 h-6 text-red-400" /></div>
              <p className="text-white text-sm font-semibold">Cancelar esta cuenta completamente?</p>
              <p className="text-slate-500 text-xs mt-1">Se cancelarán todos los productos y se cerrará sin cobro.</p>
              <div className="bg-slate-800 rounded-lg p-3 mt-3 text-left">
                <div className="flex justify-between text-xs"><span className="text-slate-400">Mesa:</span><span className="text-white font-bold">{sel.tableNumber}</span></div>
                <div className="flex justify-between text-xs mt-1"><span className="text-slate-400">Mesero:</span><span className="text-white">{sel.waiterName}</span></div>
                <div className="flex justify-between text-xs mt-1"><span className="text-slate-400">Items:</span><span className="text-white">{sel.itemsCount}</span></div>
                <div className="flex justify-between text-xs mt-1"><span className="text-slate-400">Total que se pierde:</span><span className="text-red-400 font-bold">{fmtCur(total)}</span></div>
              </div>
            </div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Motivo de cancelación *</label>
            <input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} autoFocus placeholder="Ej: Mesa no consumio, error, etc..." className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-red-500 mb-3 placeholder:text-slate-600" />
            <div className="flex gap-2">
              <button onClick={() => setModal(null)} className="flex-1 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-sm font-semibold text-slate-300 hover:bg-slate-700">Volver</button>
              <button onClick={handleConfirmCancelFolio} disabled={cancellingFolio || !cancelReason.trim()} className="flex-1 py-2.5 bg-red-600 rounded-lg text-sm font-bold text-white hover:bg-red-700 disabled:opacity-40">{cancellingFolio ? "Cancelando..." : "Cancelar Folio"}</button>
            </div>
          </ModalCard>
        </Backdrop>
      )}

      {/* ================================================================
         TOOLBAR (SoftRestaurant style - 2 rows of buttons)
         ================================================================ */}
      <div className="bg-slate-900 border-b border-slate-800 px-3 py-2 flex-shrink-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-amber-500 font-black text-base tracking-wider mr-2">{companyName}</span>
          {hasActiveShift === false && <span className="bg-red-600/20 text-red-400 border border-red-600/30 rounded-full px-2.5 py-0.5 text-[10px] font-bold">SIN TURNO</span>}
          {hasActiveShift === true && <span className="bg-emerald-600/20 text-emerald-400 border border-emerald-600/30 rounded-full px-2.5 py-0.5 text-[10px] font-bold">TURNO ACTIVO</span>}
          {/* Printer status */}
          <button onClick={() => !isEscPosReady && selectPrinter()} title={isEscPosReady ? 'Impresora conectada' : 'Click para conectar impresora'} className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${isEscPosReady ? 'bg-emerald-600/20 text-emerald-400 border-emerald-600/30' : 'bg-red-600/20 text-red-400 border-red-600/30 cursor-pointer hover:bg-red-600/30'}`}>
            {isEscPosReady ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {isEscPosReady ? 'IMPRESORA' : 'SIN IMPRESORA'}
          </button>
          <span className="flex-1" />
          {selectedLine && (
            <span className="bg-amber-600/20 text-amber-400 border border-amber-600/30 rounded px-2 py-0.5 text-[10px] font-bold truncate max-w-[200px]">
              Sel: {selectedLine.productName}
            </span>
          )}
          {customer && (
            <span className="bg-sky-600/20 text-sky-400 border border-sky-600/30 rounded px-2 py-0.5 text-[10px] font-bold truncate max-w-[160px]">
              {customer.name}
            </span>
          )}
          {discountAmt > 0 && (
            <span className="bg-emerald-600/20 text-emerald-400 border border-emerald-600/30 rounded px-2 py-0.5 text-[10px] font-bold">
              Dto: -{fmtCur(discountAmt)}
            </span>
          )}
          <span className="text-slate-500 text-[10px] font-semibold">{sessions.length} cuentas</span>
        </div>

        {/* Row 1 */}
        <div className="flex gap-1 flex-wrap">
          <ToolBtn label="Abrir Cuenta" Icon={Plus} onClick={handleOpenClick} />
          <ToolBtn label="Cancelar Prod." Icon={X} onClick={handleCancelLineClick} disabled={!sel || !isCancellable} variant="danger" />
          <ToolBtn label="Cambiar Cuenta" Icon={ArrowRightLeft} onClick={handleCambiarCuentaClick} disabled={!sel} />
          <ToolBtn label="Juntar Cuentas" Icon={Merge} onClick={handleJuntarClick} disabled={!sel || sessions.length < 2} />
          <ToolBtn label="Descto. General" Icon={Percent} onClick={handleDesctoGeneralClick} disabled={!sel} />
          <ToolBtn label="Dividir Cuenta" Icon={Scissors} onClick={handleDividirClick} disabled={!sel || activeLines.length < 2} />
          <ToolBtn label="Imprimir Cuenta" Icon={Printer} onClick={handlePrint} disabled={!sel || escposPrinting} />
          <ToolBtn label="Pre-Cuenta" Icon={Receipt} onClick={() => { if (sel) printReceipt(sel, undefined, discountAmt); }} disabled={!sel || escposPrinting} />
          <ToolBtn label="Cerrar" Icon={LogOut} onClick={() => window.history.back()} />
        </div>

        {/* Row 2 */}
        <div className="flex gap-1 flex-wrap mt-1">
          <ToolBtn label="Captura" Icon={Pencil} onClick={handleCapturaClick} disabled={!sel} variant="accent" />
          <ToolBtn label="Cliente" Icon={UserCircle} onClick={handleClienteClick} disabled={!sel} />
          <ToolBtn label="Cambiar Mesero" Icon={UserCheck} onClick={handleMeseroClick} disabled={!sel} />
          <ToolBtn label="Transferir Prod." Icon={ArrowLeftRight} onClick={handleTransferirClick} disabled={!sel || !selectedLine || selectedLine?.status === "CANCELLED"} />
          <ToolBtn label="Descto. Prod." Icon={Percent} onClick={handleDesctoProdClick} disabled={!sel || !selectedLine || selectedLine?.status === "CANCELLED"} />
          <ToolBtn label="Propina Incluida" Icon={Coins} onClick={handlePropinaClick} disabled={!sel} />
          <ToolBtn label="Pagar Cuenta" Icon={DollarSign} onClick={handleCobrarClick} disabled={!sel} variant="success" />
          <ToolBtn label="Factura" Icon={FileText} onClick={handleFacturaClick} disabled={!sel} />
          <ToolBtn label="Cancelar Folio" Icon={Ban} onClick={handleCancelFolioClick} disabled={!sel} variant="danger" />        </div>
      </div>

      {/* ================================================================
         BODY
         ================================================================ */}
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
                    <div className="text-[10px] text-slate-500">{s.waiterName} &middot; {s.itemsCount} items</div>
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
            <div className="bg-slate-900/50 border-b border-slate-800 px-4 py-2 flex items-center gap-4 flex-shrink-0 text-xs flex-wrap">
              <div className="flex items-center gap-1.5"><span className="text-slate-500 font-semibold">Cuenta:</span><span className="text-amber-400 font-bold text-sm">{sel.tableNumber}</span></div>
              <div className="flex items-center gap-1.5"><span className="text-slate-500 font-semibold">Area:</span><span className="text-white">{sel.zoneName}</span></div>
              <div className="flex items-center gap-1.5"><UserCheck className="w-3 h-3 text-slate-500" /><span className="text-white font-semibold">{sel.waiterName}</span></div>
              <div className="flex items-center gap-1.5"><Clock className="w-3 h-3 text-slate-500" /><span className="text-slate-300">{fmtTime(sel.openedAt)}</span></div>
              <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${elapsedBadge(sel.elapsedMinutes)}`}>{sel.elapsedMinutes} min</span>
              <div className="flex items-center gap-1.5"><ChefHat className="w-3 h-3 text-slate-500" /><span className="text-slate-300">{sel.itemsCount} items</span></div>
              {customer && <div className="flex items-center gap-1.5"><UserCircle className="w-3 h-3 text-sky-400" /><span className="text-sky-400 font-semibold">{customer.name}</span></div>}
            </div>
          )}

          {/* Items table */}
          <div className="flex-1 overflow-auto">
            {sel ? (
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-900 sticky top-0 z-10">
                    {["#", "Cant", "Descripcion", "Precio", "Desc.", "Importe", "Estado", ""].map((h, i) => (
                      <th key={i} className={`px-3 py-2 text-amber-500/70 font-bold text-[10px] uppercase tracking-wider border-b border-slate-800 ${h === "Descripcion" ? "text-left" : "text-right"} ${i === 0 ? "w-8" : i === 7 ? "w-9" : ""}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sel.lines.length === 0 ? (
                    <tr><td colSpan={8} className="py-12 text-center text-slate-600 text-xs">Sin productos &mdash; use <span className="text-amber-500 font-semibold">Captura</span> para agregar</td></tr>
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
                        <td className="px-3 py-2.5 text-right text-slate-500">{line.originalPrice && line.originalPrice !== line.unitPrice ? fmtCur(line.originalPrice - line.unitPrice) : '-'}</td>
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
                <div className="text-4xl opacity-20">&#127869;</div>
                <div className="text-slate-500 font-semibold text-sm">Seleccione una cuenta o abra una nueva</div>
              </div>
            )}
          </div>

          {/* Footer: Totals */}
          <div className="bg-slate-900 border-t border-slate-800 px-4 py-2.5 flex items-center justify-between flex-shrink-0">
            <div className="flex gap-5 text-xs">
              <div><span className="text-slate-500 font-semibold">Subtotal: </span><span className="text-white font-bold">{fmtCur(subtotal)}</span></div>
              <div><span className="text-slate-500 font-semibold">Impuestos: </span><span className="text-white font-bold">{fmtCur(taxAmount)}</span></div>
              {discountAmt > 0 && <div><span className="text-slate-500 font-semibold">Descuento: </span><span className="text-emerald-400 font-bold">-{fmtCur(discountAmt)}</span></div>}
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
