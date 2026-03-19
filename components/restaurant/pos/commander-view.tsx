"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { CommanderOrderScreen } from "./commander-order-screen";
import { Plus, RefreshCw, LogOut, Clock, ChefHat, DollarSign, Search } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════════ */

interface OpenAccount {
  id: string;
  tableId: string;
  tableName: string;
  waiterName: string;
  openedAt: string;
  elapsedMinutes: number;
  itemsCount: number;
  total: number;
  lines: { id: string; productName: string; quantity: number; unitPrice: number; status: string }[];
}

interface CommanderViewProps {
  waiterToken: string;
  waiterData: { id: string; name: string; tenantId?: string; [k: string]: any };
  onExit: () => void;
}

/* ═══════════════════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════════════════ */

function elapsedBadge(min: number) {
  if (min < 30) return "bg-emerald-600/20 text-emerald-400 border-emerald-600/30";
  if (min < 60) return "bg-amber-600/20 text-amber-400 border-amber-600/30";
  return "bg-red-600/20 text-red-400 border-red-600/30";
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function fmtCur(n: number) {
  return `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/* ═══════════════════════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════════════════════ */

export function CommanderView({ waiterToken, waiterData, onExit }: CommanderViewProps) {
  const { data: sessionData } = useSession();
  const tenantId: string = (sessionData?.user as any)?.tenantId ?? waiterData.tenantId ?? "";

  const [accounts, setAccounts] = useState<OpenAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasActiveShift, setHasActiveShift] = useState<boolean | null>(null);
  const [searchText, setSearchText] = useState("");

  const [showOpen, setShowOpen] = useState(false);
  const [tableNumber, setTableNumber] = useState("");
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [activeAccount, setActiveAccount] = useState<OpenAccount | null>(null);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-tenant-id": tenantId,
    "x-waiter-token": waiterToken,
  };

  /* ═══════════════════════════════════════════════════════════════════════════
     DATA
     ═══════════════════════════════════════════════════════════════════════════ */

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/pos/cashier/open-accounts");
      if (!res.ok) { setLoading(false); return; }
      const data = await res.json();
      setAccounts(
        (Array.isArray(data.accounts) ? data.accounts : []).map((a: any) => ({
          id: a.id,
          tableId: a.tableId ?? "",
          tableName: a.tableNumber ?? a.tableName ?? "?",
          waiterName: a.waiterName ?? "",
          openedAt: a.openedAt,
          elapsedMinutes: a.elapsedMinutes ?? 0,
          itemsCount: a.itemsCount ?? 0,
          total: a.total ?? 0,
          lines: a.lines ?? [],
        }))
      );
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  const checkShift = useCallback(async () => {
    try {
      const res = await fetch("/api/cash/shifts?active=true");
      if (!res.ok) { setHasActiveShift(false); return; }
      const data = await res.json();
      setHasActiveShift(Array.isArray(data.shifts) && data.shifts.length > 0);
    } catch { setHasActiveShift(false); }
  }, []);

  useEffect(() => {
    fetchAccounts();
    checkShift();
    const iv = setInterval(fetchAccounts, 15_000);
    return () => clearInterval(iv);
  }, [fetchAccounts, checkShift]);

  /* ═══════════════════════════════════════════════════════════════════════════
     OPEN TABLE
     ═══════════════════════════════════════════════════════════════════════════ */

  const nextTableNumber = useCallback(() => {
    const used = new Set(accounts.map((a) => a.tableName));
    for (let i = 1; i <= 999; i++) { if (!used.has(String(i))) return String(i); }
    return String(accounts.length + 1);
  }, [accounts]);

  const handleOpenClick = () => {
    if (hasActiveShift === false) {
      setOpenError("No hay turno de caja abierto. Pida al cajero que abra turno.");
      setShowOpen(true);
      return;
    }
    setOpenError(null);
    setTableNumber(nextTableNumber());
    setShowOpen(true);
    setTimeout(() => inputRef.current?.select(), 80);
  };

  const handleConfirmOpen = async () => {
    const name = tableNumber.trim();
    if (!name) return;

    const existing = accounts.find((a) => a.tableName === name);
    if (existing) { setShowOpen(false); setActiveAccount(existing); return; }

    setOpening(true);
    setOpenError(null);
    try {
      const res = await fetch("/api/restaurant/sessions", { method: "POST", headers, body: JSON.stringify({ tableName: name }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo abrir la mesa");
      setShowOpen(false);
      await fetchAccounts();
      setActiveAccount({
        id: data.id,
        tableId: data.table?.id ?? data.tableId ?? "",
        tableName: data.table?.name ?? name,
        waiterName: waiterData.name,
        openedAt: data.openedAt ?? new Date().toISOString(),
        elapsedMinutes: 0,
        itemsCount: 0,
        total: 0,
        lines: [],
      });
    } catch (err: any) { setOpenError(err.message); } finally { setOpening(false); }
  };

  const handleBackFromOrder = () => {
    setActiveAccount(null);
    fetchAccounts();
  };

  /* ═══════════════════════════════════════════════════════════════════════════
     FILTERED
     ═══════════════════════════════════════════════════════════════════════════ */

  const filtered = accounts.filter((a) => {
    if (!searchText) return true;
    const q = searchText.toLowerCase();
    return a.tableName.toLowerCase().includes(q) || a.waiterName.toLowerCase().includes(q);
  });

  /* ═══════════════════════════════════════════════════════════════════════════
     ACTIVE ORDER MODE
     ═══════════════════════════════════════════════════════════════════════════ */

  if (activeAccount) {
    return (
      <div className="h-screen flex flex-col bg-slate-950">
        <CommanderOrderScreen
          tableName={activeAccount.tableName}
          sessionId={activeAccount.id}
          waiterName={waiterData.name}
          waiterToken={waiterToken}
          tenantId={tenantId}
          onOrderSent={handleBackFromOrder}
          onBack={handleBackFromOrder}
        />
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     MAIN VIEW
     ═══════════════════════════════════════════════════════════════════════════ */

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-white font-sans overflow-hidden">

      {/* ── OPEN TABLE DIALOG ──────────────────────────────────────── */}
      {showOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowOpen(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="bg-slate-800 border-b border-slate-700 px-5 py-3 flex items-center justify-between">
              <h3 className="text-white font-bold text-sm tracking-wide">ABRIR MESA</h3>
              <button onClick={() => setShowOpen(false)} className="text-slate-400 hover:text-white text-lg font-bold">&times;</button>
            </div>
            <div className="p-5">
              {openError && (
                <div className="bg-red-600/10 border border-red-600/30 rounded-lg p-3 mb-3 text-red-400 text-xs font-semibold">{openError}</div>
              )}
              {(!openError || hasActiveShift !== false) ? (
                <>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Número de mesa</label>
                  <input ref={inputRef} value={tableNumber} onChange={(e) => setTableNumber(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleConfirmOpen(); }} placeholder="1, 2, VIP-1..." autoFocus className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-2xl font-black text-center text-amber-400 outline-none focus:border-amber-500 mb-2" />
                  <p className="text-[10px] text-slate-600 text-center mb-4">Si la mesa ya está abierta, se reanudará</p>
                  <button onClick={handleConfirmOpen} disabled={!tableNumber.trim() || opening} className="w-full py-3 bg-amber-600 rounded-xl text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed">
                    {opening ? "Abriendo..." : "ABRIR MESA"}
                  </button>
                </>
              ) : (
                <button onClick={() => setShowOpen(false)} className="w-full py-2.5 bg-red-600 rounded-lg text-sm font-bold text-white hover:bg-red-700">Entendido</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TOP BAR ────────────────────────────────────────────────── */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <span className="text-amber-500 font-black text-lg tracking-widest">COMANDERO</span>

        <button onClick={handleOpenClick} className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 rounded-xl text-xs font-bold text-white hover:bg-amber-700 border border-amber-700">
          <Plus className="w-4 h-4" /> Abrir Mesa
        </button>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Buscar..." className="bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-xs text-white outline-none focus:border-amber-500 w-40 placeholder:text-slate-600" />
        </div>

        <button onClick={fetchAccounts} className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-700">
          <RefreshCw className="w-3.5 h-3.5" /> Refrescar
        </button>

        <span className="flex-1" />

        {hasActiveShift === false && <span className="bg-red-600/20 text-red-400 border border-red-600/30 rounded-full px-2.5 py-1 text-[10px] font-bold">SIN TURNO</span>}
        {hasActiveShift === true && <span className="bg-emerald-600/20 text-emerald-400 border border-emerald-600/30 rounded-full px-2.5 py-1 text-[10px] font-bold">TURNO ACTIVO</span>}

        <span className="text-slate-500 text-xs font-semibold">{waiterData.name}</span>
      </div>

      {/* ── ACCOUNTS GRID ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-amber-500 font-bold text-sm animate-pulse">Cargando cuentas...</div>
          </div>
        ) : filtered.length === 0 && !searchText ? (
          <div className="h-full flex flex-col items-center justify-center gap-4">
            <div className="text-5xl opacity-20">🍽️</div>
            <p className="text-slate-500 font-semibold">Sin cuentas abiertas</p>
            <p className="text-slate-600 text-xs">Presione Abrir Mesa para crear una cuenta</p>
            <button onClick={handleOpenClick} className="mt-2 flex items-center gap-2 px-6 py-3 bg-amber-600 rounded-xl text-sm font-bold text-white hover:bg-amber-700">
              <Plus className="w-5 h-5" /> Abrir Mesa
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
            {/* New table card */}
            <button onClick={handleOpenClick} className="border-2 border-dashed border-slate-700 rounded-xl bg-slate-900/30 flex flex-col items-center justify-center gap-2 min-h-[170px] hover:border-amber-600/50 hover:bg-amber-600/5 group">
              <Plus className="w-8 h-8 text-slate-600 group-hover:text-amber-500" />
              <span className="text-slate-600 group-hover:text-amber-500 font-bold text-xs tracking-wide">ABRIR MESA</span>
            </button>

            {/* Account cards */}
            {filtered.map((acc) => (
              <div key={acc.id} onClick={() => setActiveAccount(acc)} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden cursor-pointer hover:border-amber-600/50 hover:shadow-lg hover:shadow-amber-600/5 flex flex-col min-h-[170px]">
                <div className="bg-slate-800 px-3 py-2.5 flex items-center justify-between">
                  <span className="font-black text-lg text-white">Mesa {acc.tableName}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${elapsedBadge(acc.elapsedMinutes)}`}>{acc.elapsedMinutes}m</span>
                </div>
                <div className="flex-1 px-3 py-2.5 flex flex-col gap-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Mesero</span>
                    <span className="text-white font-semibold">{acc.waiterName}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Abierta</span>
                    <span className="text-slate-300">{fmtTime(acc.openedAt)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Items</span>
                    <span className="text-white font-semibold">{acc.itemsCount}</span>
                  </div>
                  <div className="flex-1" />
                  <div className="flex justify-between items-center border-t border-slate-800 pt-2 mt-1">
                    <span className="text-[10px] text-slate-500 font-semibold">TOTAL</span>
                    <span className="text-base font-black text-amber-400">{fmtCur(acc.total)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── BOTTOM BAR ─────────────────────────────────────────────── */}
      <div className="bg-slate-900 border-t border-slate-800 px-4 py-2.5 flex items-center justify-between flex-shrink-0">
        <span className="text-slate-500 text-xs font-semibold">
          {accounts.length} cuenta{accounts.length !== 1 ? "s" : ""} abierta{accounts.length !== 1 ? "s" : ""}
        </span>
        <button onClick={onExit} className="flex items-center gap-1.5 px-4 py-2 bg-red-600/20 border border-red-600/30 rounded-lg text-xs font-bold text-red-400 hover:bg-red-600/30">
          <LogOut className="w-3.5 h-3.5" /> Salir
        </button>
      </div>
    </div>
  );
}
