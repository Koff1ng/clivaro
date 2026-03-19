"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { CommanderOrderScreen } from "./commander-order-screen";

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

function elapsedColor(min: number) {
  if (min < 30) return "#2E7D32";
  if (min < 60) return "#E65100";
  return "#C0392B";
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: true });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CommanderView({ waiterToken, waiterData, onExit }: CommanderViewProps) {
  const { data: sessionData } = useSession();
  const tenantId: string = (sessionData?.user as any)?.tenantId ?? waiterData.tenantId ?? "";

  const [accounts, setAccounts] = useState<OpenAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasActiveShift, setHasActiveShift] = useState<boolean | null>(null);

  // Open table dialog
  const [showOpen, setShowOpen] = useState(false);
  const [tableNumber, setTableNumber] = useState("");
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Active order mode
  const [activeAccount, setActiveAccount] = useState<OpenAccount | null>(null);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-tenant-id": tenantId,
    "x-waiter-token": waiterToken,
  };

  // ── Fetch open accounts ──────────────────────────────────────────────────

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/pos/cashier/open-accounts");
      if (!res.ok) { setLoading(false); return; }
      const data = await res.json();
      const arr: OpenAccount[] = (Array.isArray(data.accounts) ? data.accounts : []).map((a: any) => ({
        id: a.id,
        tableId: a.tableId ?? "",
        tableName: a.tableNumber ?? a.tableName ?? "?",
        waiterName: a.waiterName ?? "",
        openedAt: a.openedAt,
        elapsedMinutes: a.elapsedMinutes ?? 0,
        itemsCount: a.itemsCount ?? 0,
        total: a.total ?? 0,
        lines: a.lines ?? [],
      }));
      setAccounts(arr);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
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

  // ── Open table ───────────────────────────────────────────────────────────

  const nextTableNumber = useCallback(() => {
    const used = new Set(accounts.map((a) => a.tableName));
    for (let i = 1; i <= 999; i++) {
      if (!used.has(String(i))) return String(i);
    }
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

    const existingAccount = accounts.find((a) => a.tableName === name);
    if (existingAccount) {
      setShowOpen(false);
      setActiveAccount(existingAccount);
      return;
    }

    setOpening(true);
    setOpenError(null);
    try {
      const res = await fetch("/api/restaurant/sessions", {
        method: "POST",
        headers,
        body: JSON.stringify({ tableName: name }),
      });
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
    } catch (err: any) {
      setOpenError(err.message);
    } finally {
      setOpening(false);
    }
  };

  const handleBackFromOrder = () => {
    setActiveAccount(null);
    fetchAccounts();
  };

  // ── Active order mode ─────────────────────────────────────────────────────

  if (activeAccount) {
    return (
      <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
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

  // ── Main view ─────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#2C1A0E", fontFamily: "'Segoe UI', Arial, sans-serif", overflow: "hidden" }}>

      {/* ══ ABRIR MESA DIALOG ═════════════════════════════════════ */}
      {showOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowOpen(false)}>
          <div style={{ background: "#FFF8E7", border: "3px solid #A07030", borderRadius: 10, minWidth: 380, boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ background: "#C8A050", color: "#3D2B00", fontWeight: 900, fontSize: 16, padding: "10px 16px", borderRadius: "7px 7px 0 0", letterSpacing: 1, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>ABRIR MESA</span>
              <button onClick={() => setShowOpen(false)} style={{ background: "none", border: "none", color: "#3D2B00", fontSize: 20, cursor: "pointer", fontWeight: 900 }}>&times;</button>
            </div>
            <div style={{ padding: 20 }}>
              {openError ? (
                <div style={{ background: "#FFEBEE", border: "2px solid #C0392B", borderRadius: 6, padding: 16, textAlign: "center", marginBottom: 12 }}>
                  <div style={{ color: "#C0392B", fontWeight: 800, fontSize: 13 }}>{openError}</div>
                </div>
              ) : null}
              {!openError || hasActiveShift !== false ? (
                <>
                  <div style={{ fontWeight: 700, fontSize: 12, color: "#5a3c10", marginBottom: 8 }}>Numero de mesa:</div>
                  <input
                    ref={inputRef}
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleConfirmOpen(); }}
                    placeholder="Ej: 1, 2, VIP-1..."
                    autoFocus
                    style={{ width: "100%", padding: "12px 16px", border: "2px solid #C8A050", borderRadius: 8, fontSize: 24, fontWeight: 900, textAlign: "center", color: "#3D2B00", background: "#FFF8E7", boxSizing: "border-box", outline: "none" }}
                  />
                  <div style={{ fontSize: 10, color: "#8B6914", marginTop: 6, textAlign: "center" }}>
                    Si la mesa ya tiene cuenta abierta, se abrira esa cuenta
                  </div>
                  <button
                    onClick={handleConfirmOpen}
                    disabled={!tableNumber.trim() || opening}
                    style={{ marginTop: 12, width: "100%", padding: "12px", background: tableNumber.trim() && !opening ? "#E87722" : "#b8902a", color: "#fff", border: "none", borderRadius: 8, fontWeight: 900, fontSize: 14, cursor: tableNumber.trim() && !opening ? "pointer" : "not-allowed", letterSpacing: 1 }}
                  >
                    {opening ? "Abriendo..." : "ABRIR MESA"}
                  </button>
                </>
              ) : (
                <button onClick={() => setShowOpen(false)} style={{ marginTop: 8, width: "100%", padding: "10px", background: "#C0392B", color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer" }}>
                  ENTENDIDO
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TOP BAR ─────────────────────────────────────────────── */}
      <div style={{ background: "#3D2B00", borderBottom: "3px solid #E87722", display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", flexShrink: 0 }}>
        <div style={{ color: "#F5C518", fontWeight: 900, fontSize: 20, letterSpacing: 2, marginRight: 12 }}>COMANDERO</div>

        <button onClick={handleOpenClick} style={{ background: "#E87722", color: "#fff", border: "2px solid #F5A623", borderRadius: 8, padding: "8px 18px", fontWeight: 800, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 18 }}>+</span> ABRIR MESA
        </button>

        <button onClick={fetchAccounts} style={{ background: "#5a3c10", color: "#fff", border: "2px solid #7a5a2a", borderRadius: 8, padding: "8px 14px", fontWeight: 700, fontSize: 11, cursor: "pointer" }}>
          REFRESCAR
        </button>

        <div style={{ flex: 1 }} />

        {hasActiveShift === false && (
          <div style={{ background: "#C0392B", color: "#fff", padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700 }}>SIN TURNO</div>
        )}
        {hasActiveShift === true && (
          <div style={{ background: "#2E7D32", color: "#fff", padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700 }}>TURNO ACTIVO</div>
        )}

        <div style={{ color: "#ccc", fontSize: 11, fontWeight: 600, marginLeft: 8 }}>
          {waiterData.name} &middot; {accounts.length} cuentas
        </div>
      </div>

      {/* ── ACCOUNTS GRID ──────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: "auto", padding: 12, background: "#4a3010" }}>
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#F5C518", fontWeight: 700, fontSize: 16 }}>Cargando cuentas...</div>
        ) : accounts.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 16 }}>
            <div style={{ fontSize: 48, opacity: 0.4 }}>&#127869;</div>
            <div style={{ color: "#F5C518", fontWeight: 700, fontSize: 16 }}>Sin cuentas abiertas</div>
            <div style={{ color: "#A07030", fontSize: 12 }}>Presione ABRIR MESA para crear una cuenta</div>
            <button onClick={handleOpenClick} style={{ marginTop: 8, background: "#E87722", color: "#fff", border: "2px solid #F5A623", borderRadius: 10, padding: "12px 32px", fontWeight: 900, fontSize: 14, cursor: "pointer", letterSpacing: 1 }}>
              + ABRIR MESA
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
            {/* New table card */}
            <button
              onClick={handleOpenClick}
              style={{
                border: "3px dashed #8B6914", borderRadius: 10, background: "rgba(245,197,24,0.08)",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 8, padding: 20, cursor: "pointer", minHeight: 160, transition: "all 0.15s",
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = "rgba(245,197,24,0.2)"; }}
              onMouseOut={(e) => { e.currentTarget.style.background = "rgba(245,197,24,0.08)"; }}
            >
              <span style={{ fontSize: 36, color: "#F5C518", fontWeight: 900 }}>+</span>
              <span style={{ color: "#F5C518", fontWeight: 800, fontSize: 12, letterSpacing: 1 }}>ABRIR MESA</span>
            </button>

            {/* Account cards */}
            {accounts.map((acc) => (
              <div
                key={acc.id}
                onClick={() => setActiveAccount(acc)}
                style={{
                  background: "#FFF8E7", border: "2px solid #C8A050", borderRadius: 10,
                  padding: 0, cursor: "pointer", transition: "all 0.12s", overflow: "hidden",
                  display: "flex", flexDirection: "column", minHeight: 160,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                }}
                onMouseOver={(e) => { e.currentTarget.style.borderColor = "#E87722"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(232,119,34,0.3)"; }}
                onMouseOut={(e) => { e.currentTarget.style.borderColor = "#C8A050"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.15)"; }}
              >
                {/* Header */}
                <div style={{ background: "#C8A050", padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 900, fontSize: 22, color: "#3D2B00" }}>Mesa {acc.tableName}</span>
                  <div style={{ background: elapsedColor(acc.elapsedMinutes), color: "#fff", borderRadius: 12, padding: "2px 8px", fontSize: 10, fontWeight: 700 }}>
                    {acc.elapsedMinutes} min
                  </div>
                </div>

                {/* Body */}
                <div style={{ padding: "10px 12px", flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                    <span style={{ color: "#8B6914", fontWeight: 600 }}>Mesero:</span>
                    <span style={{ fontWeight: 700, color: "#3D2B00" }}>{acc.waiterName}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                    <span style={{ color: "#8B6914", fontWeight: 600 }}>Abierta:</span>
                    <span style={{ fontWeight: 600, color: "#3D2B00" }}>{fmtTime(acc.openedAt)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                    <span style={{ color: "#8B6914", fontWeight: 600 }}>Items:</span>
                    <span style={{ fontWeight: 700, color: "#3D2B00" }}>{acc.itemsCount}</span>
                  </div>
                  <div style={{ flex: 1 }} />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #E8D5B0", paddingTop: 6, marginTop: 4 }}>
                    <span style={{ fontSize: 10, color: "#8B6914", fontWeight: 700 }}>TOTAL:</span>
                    <span style={{ fontSize: 18, fontWeight: 900, color: "#C0392B" }}>${acc.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── BOTTOM BAR ─────────────────────────────────────────── */}
      <div style={{ height: 50, background: "#3D2B00", borderTop: "3px solid #E87722", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", flexShrink: 0 }}>
        <div style={{ color: "#F5C518", fontWeight: 700, fontSize: 12 }}>
          {accounts.length} cuenta{accounts.length !== 1 ? "s" : ""} abierta{accounts.length !== 1 ? "s" : ""}
        </div>
        <button onClick={onExit} style={{ background: "#C0392B", color: "#fff", border: "2px solid #922B21", borderRadius: 8, padding: "6px 20px", fontWeight: 800, fontSize: 11, cursor: "pointer", letterSpacing: 1 }}>
          SALIR
        </button>
      </div>
    </div>
  );
}
