"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils";

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function fmtCur(n: number) {
  return `$${n.toFixed(2)}`;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  root: {
    display: "flex",
    height: "100vh",
    background: "#C8A050",
    fontFamily: "'Segoe UI', Arial, sans-serif",
    fontSize: 12,
    overflow: "hidden",
    color: "#1a0a00",
  } as React.CSSProperties,

  // ── Left panel ──
  leftPanel: {
    width: 210,
    background: "#E8D5B0",
    borderRight: "2px solid #A07030",
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
  } as React.CSSProperties,

  leftHeader: {
    background: "#C8A050",
    color: "#3D2B00",
    fontWeight: 900,
    fontSize: 14,
    padding: "6px 10px",
    borderBottom: "2px solid #A07030",
    letterSpacing: 1,
    textAlign: "center",
  } as React.CSSProperties,

  leftSection: {
    padding: "6px 8px",
    borderBottom: "1px solid #C8A050",
    background: "#F0E0B0",
  } as React.CSSProperties,

  labelSm: {
    fontSize: 11,
    fontWeight: 700,
    color: "#5a3c10",
    marginBottom: 2,
  } as React.CSSProperties,

  inputSm: {
    width: "100%",
    padding: "3px 6px",
    border: "1px solid #A07030",
    borderRadius: 3,
    background: "#fff",
    fontSize: 11,
    color: "#1a0a00",
    boxSizing: "border-box",
  } as React.CSSProperties,

  accountTable: {
    flex: 1,
    overflow: "auto",
  } as React.CSSProperties,

  accountTableHead: {
    background: "#C8A050",
    position: "sticky",
    top: 0,
  } as React.CSSProperties,

  th: {
    padding: "4px 6px",
    fontWeight: 800,
    fontSize: 10,
    color: "#3D2B00",
    borderRight: "1px solid #A07030",
    whiteSpace: "nowrap",
    textAlign: "left",
  } as React.CSSProperties,

  // ── Main content ──
  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  } as React.CSSProperties,

  // ── Action bar ──
  actionBar: {
    background: "#D4A030",
    borderBottom: "2px solid #A07030",
    padding: "4px 6px",
    display: "flex",
    gap: 3,
    flexWrap: "wrap",
    flexShrink: 0,
  } as React.CSSProperties,

  actionBtn: (disabled?: boolean, primary?: boolean) => ({
    background: disabled
      ? "#b8902a"
      : primary
      ? "#E87722"
      : "linear-gradient(180deg, #F5D060 0%, #D4A030 100%)",
    color: disabled ? "#8B6914" : "#3D2B00",
    border: `1px solid ${disabled ? "#9a7525" : "#9a7525"}`,
    borderRadius: 4,
    padding: "4px 8px",
    cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 700,
    fontSize: 10,
    letterSpacing: 0.3,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: 1,
    minWidth: 72,
    boxShadow: disabled ? "none" : "0 1px 0 #fff4 inset",
    opacity: disabled ? 0.6 : 1,
    transition: "opacity 0.1s",
  } as React.CSSProperties),

  // ── Detail form ──
  detailForm: {
    background: "#FFF8E7",
    borderBottom: "1px solid #C8A050",
    padding: "6px 10px",
    flexShrink: 0,
  } as React.CSSProperties,

  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "3px 16px",
  } as React.CSSProperties,

  formRow: {
    display: "flex",
    alignItems: "center",
    gap: 4,
  } as React.CSSProperties,

  formLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: "#5a3c10",
    whiteSpace: "nowrap",
    minWidth: 80,
  } as React.CSSProperties,

  formValue: {
    padding: "2px 6px",
    border: "1px solid #C8A050",
    borderRadius: 2,
    background: "#fff",
    fontSize: 11,
    color: "#1a0a00",
    flex: 1,
    minWidth: 0,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  } as React.CSSProperties,

  formValueHL: {
    padding: "2px 6px",
    border: "1px solid #C8A050",
    borderRadius: 2,
    background: "#FFF3CD",
    fontSize: 11,
    fontWeight: 700,
    color: "#1a0a00",
    flex: 1,
    minWidth: 0,
  } as React.CSSProperties,

  // ── Items table ──
  itemsWrapper: {
    flex: 1,
    overflow: "auto",
    background: "#fff",
    borderBottom: "1px solid #C8A050",
  } as React.CSSProperties,

  itemsTable: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: 11,
  } as React.CSSProperties,

  itemsTh: {
    background: "#C8A050",
    padding: "4px 8px",
    fontWeight: 800,
    color: "#3D2B00",
    borderRight: "1px solid #A07030",
    position: "sticky" as const,
    top: 0,
    whiteSpace: "nowrap",
    textAlign: "left" as const,
  } as React.CSSProperties,

  // ── Bottom ──
  bottom: {
    display: "flex",
    background: "#E8D5B0",
    borderTop: "2px solid #A07030",
    flexShrink: 0,
    height: 180,
  } as React.CSSProperties,

  bottomLeft: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    borderRight: "2px solid #A07030",
    padding: "4px 6px",
    gap: 4,
  } as React.CSSProperties,

  observRow: {
    display: "flex",
    gap: 4,
    alignItems: "flex-start",
  } as React.CSSProperties,

  observLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "#5a3c10",
    whiteSpace: "nowrap",
    paddingTop: 3,
  } as React.CSSProperties,

  observInput: {
    flex: 1,
    padding: "3px 6px",
    border: "1px solid #A07030",
    borderRadius: 3,
    background: "#fff",
    fontSize: 11,
    resize: "none",
    height: 36,
  } as React.CSSProperties,

  bottomBtnRow: {
    display: "flex",
    gap: 3,
  } as React.CSSProperties,

  bottomBtn: {
    background: "linear-gradient(180deg, #F5D060 0%, #D4A030 100%)",
    color: "#3D2B00",
    border: "1px solid #9a7525",
    borderRadius: 4,
    padding: "4px 8px",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 10,
    letterSpacing: 0.2,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: 1,
    minWidth: 68,
    boxShadow: "0 1px 0 #fff4 inset",
  } as React.CSSProperties,

  bottomRight: {
    width: 240,
    background: "#FFF8E7",
    padding: "8px 12px",
    display: "flex",
    flexDirection: "column",
    gap: 2,
    justifyContent: "center",
  } as React.CSSProperties,

  totalRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid #E0C880",
    paddingBottom: 2,
  } as React.CSSProperties,

  totalLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "#5a3c10",
  } as React.CSSProperties,

  totalValue: {
    fontSize: 11,
    fontWeight: 700,
    color: "#1a0a00",
  } as React.CSSProperties,

  totalFinalRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
    paddingTop: 4,
    borderTop: "2px solid #A07030",
  } as React.CSSProperties,

  totalFinalLabel: {
    fontSize: 16,
    fontWeight: 900,
    color: "#3D2B00",
    letterSpacing: 1,
  } as React.CSSProperties,

  totalFinalValue: {
    fontSize: 18,
    fontWeight: 900,
    color: "#C0392B",
  } as React.CSSProperties,
};

// ─── Main Component ────────────────────────────────────────────────────────────

export const CashierBillingConsole: React.FC = () => {
  const [sessions, setSessions] = useState<OpenSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<OpenSession | null>(null);
  const [searchText, setSearchText] = useState("");
  const [billing, setBilling] = useState(false);
  const [observations, setObservations] = useState("");
  const { toast } = useToast();

  // ── Data ──────────────────────────────────────────────────────────────────

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/pos/cashier/open-accounts");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudieron cargar las cuentas");
      const arr: OpenSession[] = Array.isArray(data.accounts) ? data.accounts : [];
      setSessions(arr);
      // Auto-select first if none selected
      setSelectedSession((prev) => {
        if (prev) {
          const refreshed = arr.find((s) => s.id === prev.id);
          return refreshed ?? (arr[0] ?? null);
        }
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
    const iv = setInterval(fetchSessions, 20_000);
    return () => clearInterval(iv);
  }, [fetchSessions]);

  // ── Actions ───────────────────────────────────────────────────────────────

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
      toast(`Mesa ${selectedSession.tableNumber} cerrada y facturada`, "success");
      setObservations("");
      await fetchSessions();
    } catch (err: any) {
      toast(err.message || "Error al facturar", "error");
    } finally {
      setBilling(false);
    }
  };

  const handlePrintAccount = () => {
    if (!selectedSession) return;
    toast("Imprimiendo cuenta...", "info");
  };

  // ── Filtered list ─────────────────────────────────────────────────────────

  const filtered = sessions.filter((s) => {
    if (!searchText) return true;
    const q = searchText.toLowerCase();
    return (
      s.tableNumber.toLowerCase().includes(q) ||
      s.waiterName.toLowerCase().includes(q) ||
      s.zoneName.toLowerCase().includes(q)
    );
  });

  // ── Totals for selected ───────────────────────────────────────────────────

  const sel = selectedSession;
  const subtotal = sel?.subtotal ?? 0;
  const taxAmount = sel?.taxAmount ?? 0;
  const tipAmount = sel?.tipAmount ?? 0;
  const total = subtotal + tipAmount;

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div
        style={{
          height: "100vh",
          background: "#C8A050",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#3D2B00",
          fontWeight: 700,
          fontSize: 16,
          letterSpacing: 2,
        }}
      >
        Cargando cuentas...
      </div>
    );
  }

  return (
    <div style={S.root}>
      {/* ══ LEFT PANEL ══════════════════════════════════════════ */}
      <div style={S.leftPanel}>
        <div style={S.leftHeader}>COMEDOR</div>

        {/* Area activa */}
        <div style={S.leftSection}>
          <div style={S.labelSm}>Area activa</div>
          <select
            style={{ ...S.inputSm, cursor: "pointer" }}
            defaultValue="TODAS"
          >
            <option value="TODAS">(TODAS)</option>
          </select>
        </div>

        {/* Search + count */}
        <div style={{ ...S.leftSection, display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={S.labelSm}>Buscar cuenta:</span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "#5a3c10",
                background: "#F5C518",
                borderRadius: 3,
                padding: "1px 6px",
              }}
            >
              Cuentas: {filtered.length}
            </span>
          </div>
          <input
            style={S.inputSm}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Mesa o mesero..."
          />
        </div>

        {/* Account list */}
        <div style={S.accountTable}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead style={S.accountTableHead as any}>
              <tr>
                <th style={S.th}>Cuenta</th>
                <th style={{ ...S.th, textAlign: "center" }}>Imp.</th>
                <th style={S.th}>Mesero</th>
                <th style={{ ...S.th, textAlign: "right" }}>Items</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    style={{
                      padding: "16px 8px",
                      textAlign: "center",
                      color: "#8B6914",
                      fontSize: 10,
                    }}
                  >
                    Sin cuentas abiertas
                  </td>
                </tr>
              ) : (
                filtered.map((s, i) => {
                  const isSelected = sel?.id === s.id;
                  return (
                    <tr
                      key={s.id}
                      onClick={() => setSelectedSession(s)}
                      style={{
                        background: isSelected ? "#1565C0" : i % 2 === 0 ? "#FFF8E7" : "#F0E0B0",
                        cursor: "pointer",
                        userSelect: "none",
                      }}
                    >
                      <td
                        style={{
                          padding: "4px 6px",
                          fontWeight: isSelected ? 800 : 600,
                          color: isSelected ? "#fff" : "#1a0a00",
                          borderBottom: "1px solid #D4B870",
                        }}
                      >
                        {s.tableNumber}
                      </td>
                      <td
                        style={{
                          padding: "4px 4px",
                          textAlign: "center",
                          color: isSelected ? "#fff" : "#5a3c10",
                          borderBottom: "1px solid #D4B870",
                        }}
                      >
                        <input
                          type="checkbox"
                          readOnly
                          checked={false}
                          style={{ margin: 0 }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td
                        style={{
                          padding: "4px 6px",
                          color: isSelected ? "#fff" : "#1a0a00",
                          borderBottom: "1px solid #D4B870",
                          fontSize: 10,
                        }}
                      >
                        {s.waiterCode ?? s.waiterName.slice(0, 8)}
                      </td>
                      <td
                        style={{
                          padding: "4px 6px",
                          textAlign: "right",
                          color: isSelected ? "#fff" : "#1a0a00",
                          borderBottom: "1px solid #D4B870",
                          fontWeight: 700,
                        }}
                      >
                        {s.itemsCount}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom left mini buttons */}
        <div
          style={{
            padding: "6px 8px",
            display: "flex",
            gap: 4,
            borderTop: "2px solid #A07030",
            background: "#D4B870",
          }}
        >
          {["🍽️ RESERVA", "👤 COMIS."].map((label) => (
            <button key={label} style={{ ...S.bottomBtn, flex: 1, fontSize: 9, minWidth: 0 }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ══ MAIN CONTENT ════════════════════════════════════════ */}
      <div style={S.main}>

        {/* ── Action bar row 1 ─── */}
        <div style={S.actionBar}>
          {[
            { label: "ABRIR\nCUENTA",     icon: "📂", act: () => {},          dis: false },
            { label: "CANCELAR\nPROD.",   icon: "❌", act: () => {},          dis: !sel },
            { label: "CAMBIAR\nCUENTA",   icon: "🔄", act: () => {},          dis: !sel },
            { label: "JUNTAR\nCUENTAS",   icon: "🔗", act: () => {},          dis: !sel },
            { label: "DESCTO.\nGENERAL",  icon: "🏷️", act: () => {},          dis: !sel },
            { label: "DIVIDIR\nCUENTA",   icon: "✂️", act: () => {},          dis: !sel },
            { label: "IMPRIMIR\nCUENTA",  icon: "🖨️", act: handlePrintAccount, dis: !sel },
            { label: "CERRAR",            icon: "🚪", act: () => window.history.back(), dis: false, primary: true },
          ].map((btn) => (
            <button
              key={btn.label}
              onClick={btn.act}
              disabled={btn.dis}
              style={S.actionBtn(btn.dis, btn.primary)}
            >
              <span style={{ fontSize: 16 }}>{btn.icon}</span>
              {btn.label.split("\n").map((l, i) => <span key={i}>{l}</span>)}
            </button>
          ))}
        </div>

        {/* ── Action bar row 2 ─── */}
        <div style={{ ...S.actionBar, paddingTop: 2 }}>
          {[
            { label: "CAPTURA",           icon: "📝", dis: !sel },
            { label: "CLIENTE",           icon: "👥", dis: !sel },
            { label: "CAMBIAR\nMESERO",   icon: "🔀", dis: !sel },
            { label: "TRANSFER.\nPROD.",  icon: "↔️", dis: !sel },
            { label: "DESCTO.\nPROD.",    icon: "💲", dis: !sel },
            { label: "PROPINA\nINCLUIDAS",icon: "💰", dis: !sel },
            { label: "PAGAR\nCUENTA",     icon: "✅", dis: !sel, primary: true, act: handleBill },
            { label: "ACREDITAR\nCUENTA", icon: "📋", dis: !sel },
          ].map((btn: any) => (
            <button
              key={btn.label}
              onClick={btn.act ?? (() => {})}
              disabled={btn.dis || billing}
              style={S.actionBtn(btn.dis || billing, btn.primary)}
            >
              <span style={{ fontSize: 16 }}>{btn.icon}</span>
              {btn.label.split("\n").map((l: string, i: number) => <span key={i}>{l}</span>)}
            </button>
          ))}
        </div>

        {/* ── Detail form ─── */}
        <div style={S.detailForm}>
          <div style={S.formGrid}>
            {/* Left column */}
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <div style={S.formRow}>
                <span style={S.formLabel}>CUENTA:</span>
                <span style={S.formValueHL}>{sel?.tableNumber ?? "—"}</span>
                <span style={{ ...S.formLabel, minWidth: 40 }}>AREA:</span>
                <span style={{ ...S.formValue, maxWidth: 30, textAlign: "center" }}>
                  {sel?.zoneId ? sel.zoneId.slice(0, 3) : "—"}
                </span>
                <span style={{ ...S.formValue, flex: 2, fontWeight: 700 }}>
                  {sel?.zoneName ?? ""}
                </span>
              </div>
              <div style={S.formRow}>
                <span style={S.formLabel}>MESA:</span>
                <span style={S.formValue}>{sel?.tableNumber ?? "—"}</span>
                <span style={{ ...S.formLabel, minWidth: 50 }}>MESERO:</span>
                <span style={{ ...S.formValue, maxWidth: 30, textAlign: "center" }}>1</span>
                <span style={{ ...S.formValue, flex: 2, fontWeight: 700 }}>
                  {sel?.waiterName ?? ""}
                </span>
              </div>
              <div style={S.formRow}>
                <span style={S.formLabel}>PERSONAS:</span>
                <span style={{ ...S.formValue, maxWidth: 40 }}>—</span>
                <span style={{ ...S.formLabel, minWidth: 50 }}>RESERVA</span>
                <span style={{ ...S.formValue, flex: 2 }} />
              </div>
              <div style={S.formRow}>
                <span style={S.formLabel}>COMISIONISTA:</span>
                <span style={S.formValue} />
              </div>
              <div style={S.formRow}>
                <span style={S.formLabel}>CLIENTE:</span>
                <span style={S.formValue} />
              </div>
            </div>

            {/* Right column */}
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <div style={S.formRow}>
                <span style={S.formLabel}>FOLIO:</span>
                <span style={S.formValue}>0</span>
              </div>
              <div style={S.formRow}>
                <span style={S.formLabel}>ORDEN:</span>
                <span style={S.formValueHL}>{sel?.itemsCount ?? 0}</span>
              </div>
              <div style={S.formRow}>
                <span style={S.formLabel}>APERTURA:</span>
                <span style={{ ...S.formValue, flex: 2, fontWeight: 600, fontSize: 10 }}>
                  {sel ? fmtTime(sel.openedAt) : "—"}
                </span>
              </div>
              <div style={S.formRow}>
                <span style={S.formLabel}>CIERRE:</span>
                <span style={{ ...S.formValue, flex: 2 }}>
                  {sel?.status === "CLOSED" ? "Cerrada" : "// :: AM"}
                </span>
              </div>
              <div style={{ ...S.formRow, justifyContent: "flex-end" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#5a3c10", cursor: "pointer" }}>
                  <input type="checkbox" readOnly checked={false} />
                  Impreso
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* ── Items table ─── */}
        <div style={S.itemsWrapper}>
          {sel ? (
            <table style={S.itemsTable}>
              <thead>
                <tr>
                  {["MOV.", "CANT.", "CLAVE", "DESCRIPCION", "DESC.", "PRECIO", "IMPORTE", "ESTADO"].map(
                    (h) => (
                      <th key={h} style={{ ...S.itemsTh, textAlign: h === "DESCRIPCION" ? "left" : "right" }}>
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {sel.lines.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      style={{ padding: "20px", textAlign: "center", color: "#8B6914", fontSize: 12 }}
                    >
                      Sin productos en esta cuenta
                    </td>
                  </tr>
                ) : (
                  sel.lines.map((line, idx) => (
                    <tr
                      key={line.id}
                      style={{
                        background: idx === 0 ? "#BBDEFB" : idx % 2 === 0 ? "#FFF8E7" : "#fff",
                        borderBottom: "1px solid #E8D5B0",
                        cursor: "pointer",
                      }}
                    >
                      <td
                        style={{
                          padding: "4px 8px",
                          textAlign: "right",
                          fontWeight: 700,
                          color: idx === 0 ? "#0D47A1" : "#1a0a00",
                          borderRight: "1px solid #E8D5B0",
                        }}
                      >
                        {idx + 1}
                      </td>
                      <td
                        style={{
                          padding: "4px 8px",
                          textAlign: "right",
                          borderRight: "1px solid #E8D5B0",
                          color: idx === 0 ? "#0D47A1" : "#1a0a00",
                        }}
                      >
                        {line.quantity.toFixed(3)}
                      </td>
                      <td
                        style={{
                          padding: "4px 8px",
                          textAlign: "right",
                          fontFamily: "monospace",
                          borderRight: "1px solid #E8D5B0",
                          color: idx === 0 ? "#0D47A1" : "#1a0a00",
                        }}
                      >
                        {line.productId?.slice(-4) ?? "----"}
                      </td>
                      <td
                        style={{
                          padding: "4px 8px",
                          fontWeight: idx === 0 ? 700 : 400,
                          borderRight: "1px solid #E8D5B0",
                          color: idx === 0 ? "#0D47A1" : "#1a0a00",
                          whiteSpace: "nowrap",
                          maxWidth: 220,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {line.productName}
                        {line.notes ? (
                          <span style={{ marginLeft: 6, fontSize: 9, color: "#C0392B", fontStyle: "italic" }}>
                            [{line.notes}]
                          </span>
                        ) : null}
                      </td>
                      <td
                        style={{
                          padding: "4px 8px",
                          textAlign: "right",
                          borderRight: "1px solid #E8D5B0",
                          color: idx === 0 ? "#0D47A1" : "#5a3c10",
                        }}
                      >
                        0.00
                      </td>
                      <td
                        style={{
                          padding: "4px 8px",
                          textAlign: "right",
                          borderRight: "1px solid #E8D5B0",
                          fontWeight: 600,
                          color: idx === 0 ? "#0D47A1" : "#1a0a00",
                        }}
                      >
                        {fmtCur(line.unitPrice)}
                      </td>
                      <td
                        style={{
                          padding: "4px 8px",
                          textAlign: "right",
                          borderRight: "1px solid #E8D5B0",
                          fontWeight: 700,
                          color: idx === 0 ? "#0D47A1" : "#1a0a00",
                        }}
                      >
                        {fmtCur(line.quantity * line.unitPrice)}
                      </td>
                      <td
                        style={{
                          padding: "4px 8px",
                          textAlign: "center",
                          fontSize: 9,
                          fontWeight: 700,
                          color:
                            line.status === "SERVED"
                              ? "#2E7D32"
                              : line.status === "COOKING"
                              ? "#E65100"
                              : "#1565C0",
                        }}
                      >
                        {line.status}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <div
              style={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#8B6914",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              Seleccione una cuenta del panel izquierdo
            </div>
          )}
        </div>

        {/* ── Bottom section ─── */}
        <div style={S.bottom}>
          {/* Left: observations + buttons */}
          <div style={S.bottomLeft}>
            <div style={S.observRow}>
              <span style={S.observLabel}>OBSERV:</span>
              <textarea
                style={S.observInput}
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Observaciones..."
              />
            </div>

            <div style={S.bottomBtnRow}>
              {[
                { label: "CARGO A\nCUENTA",   icon: "💳", dis: !sel },
                { label: "OBSERVA-\nCIONES",  icon: "📝", dis: false },
                { label: "TARJETA\nDSCTO.",   icon: "🏷️", dis: !sel },
                { label: "PERSONAS",          icon: "👥", dis: !sel },
                { label: "F12\nFACT. RAPIDA", icon: "⚡", dis: !sel, primary: !sel ? false : true, act: handleBill },
                { label: "ENVIAR\nMENSAJE",   icon: "✉️", dis: !sel },
                { label: "REIMPRIMIR\nCUENTA",icon: "🖨️", dis: !sel, act: handlePrintAccount },
              ].map((btn: any) => (
                <button
                  key={btn.label}
                  disabled={btn.dis || billing}
                  onClick={btn.act ?? (() => {})}
                  style={{ ...S.bottomBtn, minWidth: 62, fontSize: 9, opacity: btn.dis ? 0.5 : 1 }}
                >
                  <span style={{ fontSize: 14 }}>{btn.icon}</span>
                  {btn.label.split("\n").map((l: string, i: number) => <span key={i}>{l}</span>)}
                </button>
              ))}
            </div>

            <div style={S.bottomBtnRow}>
              {[
                { label: "CONSULTA\nCTAS.",    icon: "🔍" },
                { label: "CAMBIAR\nDE AREA",   icon: "🔀" },
                { label: "PAGO CON\nPUNTOS",   icon: "⭐" },
                { label: "RESUMEN\nCUENTA",    icon: "📊" },
                { label: "REIMPRIMIR\nPRODU.", icon: "🔁" },
                { label: "CANCELAR\nFOLIO",    icon: "🗑️", dis: !sel },
                { label: "Ctrl+B\nBILLAR",     icon: "🎱" },
              ].map((btn: any) => (
                <button
                  key={btn.label}
                  disabled={btn.dis}
                  style={{ ...S.bottomBtn, minWidth: 62, fontSize: 9, opacity: btn.dis ? 0.5 : 1 }}
                >
                  <span style={{ fontSize: 14 }}>{btn.icon}</span>
                  {btn.label.split("\n").map((l: string, i: number) => <span key={i}>{l}</span>)}
                </button>
              ))}
            </div>
          </div>

          {/* Right: totals */}
          <div style={S.bottomRight}>
            <div style={S.totalRow}>
              <span style={S.totalLabel}>SUBTOTAL:</span>
              <span style={S.totalValue}>{fmtCur(subtotal)}</span>
            </div>
            <div style={S.totalRow}>
              <span style={S.totalLabel}>-MONEDERO:</span>
              <span style={S.totalValue}>$0.00</span>
            </div>
            <div style={S.totalRow}>
              <span style={S.totalLabel}>-DESCUENTO: 0.0000%</span>
              <span style={S.totalValue}>$0.00</span>
            </div>
            <div style={S.totalRow}>
              <span style={S.totalLabel}>IMPUESTOS:</span>
              <span style={S.totalValue}>{fmtCur(taxAmount)}</span>
            </div>
            <div style={S.totalRow}>
              <span style={S.totalLabel}>PROPINA:</span>
              <span style={{ ...S.totalValue, color: "#C0392B" }}>{fmtCur(tipAmount)}</span>
            </div>
            <div style={S.totalRow}>
              <span style={S.totalLabel}>CARGO:</span>
              <span style={S.totalValue}>$0.00</span>
            </div>
            <div style={S.totalFinalRow}>
              <span style={S.totalFinalLabel}>TOTAL:</span>
              <span style={S.totalFinalValue}>{fmtCur(total)}</span>
            </div>

            {/* Bill button */}
            <button
              onClick={handleBill}
              disabled={!sel || billing}
              style={{
                marginTop: 8,
                width: "100%",
                padding: "8px 12px",
                background: sel && !billing ? "#E87722" : "#b8902a",
                color: sel && !billing ? "#fff" : "#8B6914",
                border: "2px solid #9a7525",
                borderRadius: 5,
                fontWeight: 900,
                fontSize: 13,
                letterSpacing: 1,
                cursor: sel && !billing ? "pointer" : "not-allowed",
              }}
            >
              {billing ? "Procesando..." : "BILLAR / COBRAR"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
