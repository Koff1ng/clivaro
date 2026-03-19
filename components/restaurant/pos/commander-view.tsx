"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { POSScreen } from "@/components/pos/pos-screen";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Zone {
  id: string;
  name: string;
}

interface RestaurantTable {
  id: string;
  name: string;
  status: "AVAILABLE" | "OCCUPIED" | "RESERVED" | "CLEANING";
  zoneId: string;
  capacity?: number;
}

interface CommanderViewProps {
  waiterToken: string;
  waiterData: { id: string; name: string; tenantId?: string; pin?: string; [k: string]: any };
  onExit: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COLS = 6;
const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: "Disponible",
  OCCUPIED: "Ocupada",
  RESERVED: "Reservada",
  CLEANING: "Limpieza",
};

// ─── Color helpers ────────────────────────────────────────────────────────────

function cellBg(status: string, selected: boolean) {
  if (selected) return "#E87722";
  switch (status) {
    case "AVAILABLE": return "#F5C518";
    case "OCCUPIED":  return "#D9780A";
    case "RESERVED":  return "#5B8EE6";
    case "CLEANING":  return "#E05A5A";
    default:          return "#F5C518";
  }
}

function cellText(status: string, selected: boolean) {
  if (selected || status === "OCCUPIED" || status === "RESERVED" || status === "CLEANING") return "#fff";
  return "#3D2B00";
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CommanderView({ waiterToken, waiterData, onExit }: CommanderViewProps) {
  const { data: session } = useSession();
  const tenantId: string = (session?.user as any)?.tenantId ?? waiterData.tenantId ?? "";

  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
  const [openOrderTable, setOpenOrderTable] = useState<RestaurantTable | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // ── Shift check state ───────────────────────────────────────────────────
  const [hasActiveShift, setHasActiveShift] = useState<boolean | null>(null);

  // ── ABRIR MESA dialog state ─────────────────────────────────────────────
  const [showOpenDialog, setShowOpenDialog] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchTables = useCallback(async () => {
    if (!tenantId) return;
    try {
      const headers: Record<string, string> = {
        "x-tenant-id": tenantId,
        "x-waiter-token": waiterToken,
      };
      const url = selectedZoneId
        ? `/api/restaurant/tables?zoneId=${selectedZoneId}`
        : "/api/restaurant/tables";
      const res = await fetch(url, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error cargando mesas");
      const arr: RestaurantTable[] = Array.isArray(data) ? data : [];
      setTables(arr);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [tenantId, waiterToken, selectedZoneId]);

  const fetchZones = useCallback(async () => {
    if (!tenantId) return;
    try {
      const res = await fetch("/api/restaurant/zones", {
        headers: {
          "x-tenant-id": tenantId,
          "x-waiter-token": waiterToken,
        },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) setZones(data.map((z: any) => ({ id: z.id, name: z.name })));
    } catch {
      // zones panel will just show nothing
    }
  }, [tenantId, waiterToken]);

  const checkActiveShift = useCallback(async () => {
    try {
      const res = await fetch("/api/cash/shifts?active=true");
      if (!res.ok) {
        setHasActiveShift(false);
        return;
      }
      const data = await res.json();
      const shifts = Array.isArray(data.shifts) ? data.shifts : [];
      setHasActiveShift(shifts.length > 0);
    } catch {
      setHasActiveShift(false);
    }
  }, []);

  useEffect(() => {
    fetchTables();
    fetchZones();
    checkActiveShift();
  }, [fetchTables, fetchZones, checkActiveShift]);

  useEffect(() => {
    intervalRef.current = setInterval(fetchTables, 15_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchTables]);

  // ── Computed grid ──────────────────────────────────────────────────────────

  const visibleTables = selectedZoneId
    ? tables.filter((t) => t.zoneId === selectedZoneId)
    : tables;

  const availableTables = tables.filter((t) => t.status === "AVAILABLE");

  const ROWS_PER_PAGE = 4;
  const CELLS_PER_PAGE = COLS * ROWS_PER_PAGE;
  const totalPages = Math.max(1, Math.ceil(visibleTables.length / CELLS_PER_PAGE));
  const pagedTables = visibleTables.slice(page * CELLS_PER_PAGE, (page + 1) * CELLS_PER_PAGE);

  const grid: (RestaurantTable | null)[] = [
    ...pagedTables,
    ...Array(Math.max(0, CELLS_PER_PAGE - pagedTables.length)).fill(null),
  ];

  // ── Actions ────────────────────────────────────────────────────────────────

  function handleCellClick(table: RestaurantTable | null) {
    if (!table) return;
    setSelectedTable((prev) => (prev?.id === table.id ? null : table));
  }

  function handleOpenTableClick() {
    if (hasActiveShift === false) {
      setDialogError("No hay un turno de caja abierto. Pida al cajero que abra turno antes de atender mesas.");
      setShowOpenDialog(true);
      return;
    }
    if (selectedTable) {
      setOpenOrderTable(selectedTable);
    } else {
      setDialogError(null);
      setShowOpenDialog(true);
    }
  }

  function handleDialogTableSelect(table: RestaurantTable) {
    setShowOpenDialog(false);
    setSelectedTable(table);
    setOpenOrderTable(table);
  }

  function handleBackFromOrder() {
    setOpenOrderTable(null);
    setSelectedTable(null);
    fetchTables();
  }

  // ── If in order mode, show POS ─────────────────────────────────────────────

  if (openOrderTable) {
    return (
      <div className="h-screen bg-background">
        <div
          style={{
            height: 48,
            background: "#3D2B00",
            display: "flex",
            alignItems: "center",
            padding: "0 16px",
            gap: 12,
          }}
        >
          <button
            onClick={handleBackFromOrder}
            style={{
              background: "#E87722",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: "6px 16px",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              letterSpacing: 1,
            }}
          >
            &#8592; MESAS
          </button>
          <span style={{ color: "#F5C518", fontWeight: 700, fontSize: 15 }}>
            Mesa {openOrderTable.name} &middot; {waiterData.name}
          </span>
        </div>
        <div style={{ height: "calc(100vh - 48px)" }}>
          <POSScreen
            mode="commander"
            waiterData={waiterData}
            waiterToken={waiterToken}
            preselectedTable={openOrderTable}
            onOrderSent={handleBackFromOrder}
          />
        </div>
      </div>
    );
  }

  // ── Table grid view ────────────────────────────────────────────────────────

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "#2C1A0E",
        fontFamily: "'Segoe UI', Arial, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* ══ ABRIR MESA DIALOG ══════════════════════════════════════ */}
      {showOpenDialog && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          onClick={() => setShowOpenDialog(false)}
        >
          <div
            style={{
              background: "#FFF8E7", border: "3px solid #A07030", borderRadius: 10,
              padding: 0, minWidth: 460, maxWidth: 600, maxHeight: "75vh",
              display: "flex", flexDirection: "column",
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                background: "#C8A050", color: "#3D2B00", fontWeight: 900, fontSize: 16,
                padding: "10px 16px", borderRadius: "7px 7px 0 0", letterSpacing: 1,
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}
            >
              <span>ABRIR MESA</span>
              <button
                onClick={() => setShowOpenDialog(false)}
                style={{
                  background: "none", border: "none", color: "#3D2B00", fontSize: 20,
                  cursor: "pointer", fontWeight: 900, lineHeight: 1,
                }}
              >
                &times;
              </button>
            </div>

            <div style={{ padding: 16, overflowY: "auto" }}>
              {dialogError ? (
                <div
                  style={{
                    background: "#FFEBEE", border: "2px solid #C0392B", borderRadius: 6,
                    padding: "16px 20px", textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: 28, marginBottom: 8 }}>&#9888;&#65039;</div>
                  <div style={{ color: "#C0392B", fontWeight: 800, fontSize: 14, marginBottom: 4 }}>
                    Sin turno de caja activo
                  </div>
                  <div style={{ color: "#5a3c10", fontSize: 12 }}>{dialogError}</div>
                  <button
                    onClick={() => setShowOpenDialog(false)}
                    style={{
                      marginTop: 12, padding: "8px 24px", background: "#C0392B", color: "#fff",
                      border: "none", borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: "pointer",
                    }}
                  >
                    ENTENDIDO
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ fontWeight: 700, fontSize: 12, color: "#5a3c10", marginBottom: 8 }}>
                    Seleccione una mesa disponible ({availableTables.length}):
                  </div>
                  {availableTables.length === 0 ? (
                    <div style={{ padding: 20, textAlign: "center", color: "#8B6914", fontSize: 12 }}>
                      No hay mesas disponibles en este momento
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
                        gap: 8, maxHeight: 280, overflowY: "auto",
                      }}
                    >
                      {availableTables.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => handleDialogTableSelect(t)}
                          style={{
                            padding: "16px 8px", background: "#F5C518", color: "#3D2B00",
                            border: "2px solid #C8A050", borderRadius: 8,
                            fontWeight: 900, fontSize: 18, cursor: "pointer",
                            display: "flex", flexDirection: "column", alignItems: "center",
                            transition: "all 0.12s",
                          }}
                          onMouseOver={(e) => { e.currentTarget.style.background = "#E87722"; e.currentTarget.style.color = "#fff"; }}
                          onMouseOut={(e) => { e.currentTarget.style.background = "#F5C518"; e.currentTarget.style.color = "#3D2B00"; }}
                        >
                          {t.name}
                          <span style={{ fontSize: 9, fontWeight: 600, marginTop: 3, opacity: 0.7 }}>
                            DISPONIBLE
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TOP ACTION BAR ─────────────────────────────────────── */}
      <div
        style={{
          background: "#3D2B00",
          borderBottom: "3px solid #E87722",
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "8px 10px",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            color: "#F5C518",
            fontWeight: 900,
            fontSize: 20,
            letterSpacing: 2,
            marginRight: 16,
            whiteSpace: "nowrap",
          }}
        >
          COMANDERO
        </div>

        {[
          { label: "ABRIR MESA", icon: "\uD83E\uDE91", action: handleOpenTableClick, primary: true, disabled: false },
          { label: "RESERVACION", icon: "\uD83D\uDCCB", action: () => {}, primary: false, disabled: false },
          { label: "MI VENTA", icon: "\uD83E\uDDFE", action: () => {}, primary: false, disabled: false },
          { label: "VER PRECIOS", icon: "\uD83D\uDCB0", action: () => {}, primary: false, disabled: false },
          { label: "MONEDERO", icon: "\uD83D\uDCB3", action: () => {}, primary: false, disabled: false },
        ].map((btn) => (
          <button
            key={btn.label}
            onClick={btn.action}
            disabled={btn.disabled}
            style={{
              background: btn.primary
                ? btn.disabled ? "#7a5a2a" : "#E87722"
                : "#5a3c10",
              color: btn.disabled ? "#888" : "#fff",
              border: `2px solid ${btn.primary ? (btn.disabled ? "#5a3c10" : "#F5A623") : "#7a5a2a"}`,
              borderRadius: 8,
              padding: "8px 14px",
              cursor: btn.disabled ? "not-allowed" : "pointer",
              fontWeight: 800,
              fontSize: 11,
              letterSpacing: 0.5,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              minWidth: 80,
              transition: "all 0.15s",
            }}
          >
            <span style={{ fontSize: 20 }}>{btn.icon}</span>
            {btn.label}
          </button>
        ))}

        <div style={{ flex: 1 }} />

        {/* Shift status indicator */}
        {hasActiveShift === false && (
          <div
            style={{
              background: "#C0392B", color: "#fff", padding: "4px 10px",
              borderRadius: 6, fontSize: 10, fontWeight: 700, marginRight: 8,
              display: "flex", alignItems: "center", gap: 4,
            }}
          >
            <span>&#9888;&#65039;</span> SIN TURNO DE CAJA
          </div>
        )}
        {hasActiveShift === true && (
          <div
            style={{
              background: "#2E7D32", color: "#fff", padding: "4px 10px",
              borderRadius: 6, fontSize: 10, fontWeight: 700, marginRight: 8,
              display: "flex", alignItems: "center", gap: 4,
            }}
          >
            <span>&#9989;</span> TURNO ACTIVO
          </div>
        )}

        <div style={{ display: "flex", gap: 12, alignItems: "center", marginRight: 8 }}>
          {[
            { color: "#F5C518", label: "Disponible" },
            { color: "#D9780A", label: "Ocupada" },
            { color: "#5B8EE6", label: "Reservada" },
          ].map((s) => (
            <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: s.color }} />
              <span style={{ color: "#ccc", fontSize: 10, fontWeight: 600 }}>{s.label}</span>
            </div>
          ))}
        </div>

        {loading && (
          <span style={{ color: "#F5C518", fontSize: 11, fontWeight: 600 }}>Actualizando...</span>
        )}
      </div>

      {/* ── BODY: TABLE GRID + SIDEBAR ─────────────────────────── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ── TABLE GRID ─────────────────────────────────────────── */}
        <div
          style={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: `repeat(${COLS}, 1fr)`,
            gridTemplateRows: `repeat(${ROWS_PER_PAGE}, 1fr)`,
            gap: 3,
            padding: 8,
            background: "#4a3010",
          }}
        >
          {grid.map((table, idx) => {
            const isSelected = !!table && selectedTable?.id === table.id;
            return (
              <div
                key={table ? table.id : `empty-${idx}`}
                onClick={() => {
                  if (!table) return;
                  if (table.status === "AVAILABLE") {
                    setSelectedTable((prev) => (prev?.id === table.id ? null : table));
                  } else {
                    setSelectedTable(table);
                  }
                }}
                onDoubleClick={() => {
                  if (table && table.status === "AVAILABLE") {
                    if (hasActiveShift === false) {
                      handleOpenTableClick();
                      return;
                    }
                    setOpenOrderTable(table);
                  }
                }}
                style={{
                  background: table ? cellBg(table.status, isSelected) : "#3D2B00",
                  border: isSelected
                    ? "3px solid #fff"
                    : table
                    ? "2px solid rgba(0,0,0,0.2)"
                    : "1px solid #5a3c10",
                  borderRadius: 6,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: table ? "pointer" : "default",
                  transition: "all 0.12s",
                  boxShadow: isSelected ? "0 0 0 3px #E87722, inset 0 0 20px rgba(255,255,255,0.1)" : "none",
                  position: "relative",
                  userSelect: "none",
                }}
              >
                {table && (
                  <>
                    <span
                      style={{
                        fontSize: 32,
                        fontWeight: 900,
                        color: cellText(table.status, isSelected),
                        lineHeight: 1,
                        textShadow: "0 1px 2px rgba(0,0,0,0.3)",
                      }}
                    >
                      {table.name}
                    </span>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: cellText(table.status, isSelected),
                        opacity: 0.75,
                        marginTop: 4,
                        letterSpacing: 1,
                        textTransform: "uppercase",
                      }}
                    >
                      {STATUS_LABELS[table.status] ?? table.status}
                    </span>
                    {table.status === "OCCUPIED" && (
                      <div
                        style={{
                          position: "absolute",
                          top: 6,
                          right: 6,
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: "#ff4444",
                          boxShadow: "0 0 6px #ff4444",
                          animation: "pulse 1.5s infinite",
                        }}
                      />
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* ── RIGHT SIDEBAR ─────────────────────────────────────── */}
        <div
          style={{
            width: 180,
            background: "#E8D5B0",
            borderLeft: "3px solid #C8A050",
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              background: "#C8A050",
              padding: "12px 8px",
              textAlign: "center",
              borderBottom: "2px solid #A07030",
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, color: "#3D2B00", letterSpacing: 1 }}>
              MESERO
            </div>
            <div
              style={{
                fontSize: 36,
                fontWeight: 900,
                color: "#3D2B00",
                lineHeight: 1,
                marginTop: 2,
              }}
            >
              {waiterData.number ?? "1"}
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "#3D2B00",
                marginTop: 2,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              {(waiterData.name ?? "").toUpperCase()}
            </div>
          </div>

          <div
            style={{
              background: "#D4B870",
              padding: "8px 6px 4px",
              borderBottom: "2px solid #A07030",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: "#3D2B00",
                textAlign: "center",
                letterSpacing: 2,
                marginBottom: 6,
              }}
            >
              AREAS
            </div>
            <button
              onClick={() => { setSelectedZoneId(null); setPage(0); }}
              style={{
                width: "100%",
                padding: "8px 4px",
                marginBottom: 4,
                background: selectedZoneId === null ? "#8B6914" : "#C8A050",
                color: selectedZoneId === null ? "#fff" : "#3D2B00",
                border: `2px solid ${selectedZoneId === null ? "#5a3c10" : "#A07030"}`,
                borderRadius: 6,
                fontWeight: 800,
                fontSize: 11,
                cursor: "pointer",
                letterSpacing: 0.5,
              }}
            >
              TODAS LAS<br />AREAS
            </button>

            {zones.map((zone) => (
              <button
                key={zone.id}
                onClick={() => { setSelectedZoneId(zone.id); setPage(0); }}
                style={{
                  width: "100%",
                  padding: "8px 4px",
                  marginBottom: 4,
                  background: selectedZoneId === zone.id ? "#8B6914" : "#C8A050",
                  color: selectedZoneId === zone.id ? "#fff" : "#3D2B00",
                  border: `2px solid ${selectedZoneId === zone.id ? "#5a3c10" : "#A07030"}`,
                  borderRadius: 6,
                  fontWeight: 800,
                  fontSize: 11,
                  cursor: "pointer",
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                }}
              >
                {zone.name}
              </button>
            ))}
          </div>

          <div style={{ flex: 1 }} />

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 8,
              padding: "10px 8px",
              borderTop: "2px solid #A07030",
            }}
          >
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              style={{
                width: 48,
                height: 48,
                borderRadius: 8,
                background: page === 0 ? "#C8A050" : "#8B6914",
                color: page === 0 ? "#A07030" : "#fff",
                border: "2px solid #A07030",
                fontSize: 22,
                fontWeight: 900,
                cursor: page === 0 ? "not-allowed" : "pointer",
              }}
            >
              &#8592;
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              style={{
                width: 48,
                height: 48,
                borderRadius: 8,
                background: page >= totalPages - 1 ? "#C8A050" : "#8B6914",
                color: page >= totalPages - 1 ? "#A07030" : "#fff",
                border: "2px solid #A07030",
                fontSize: 22,
                fontWeight: 900,
                cursor: page >= totalPages - 1 ? "not-allowed" : "pointer",
              }}
            >
              &#8594;
            </button>
          </div>

          <button
            onClick={onExit}
            style={{
              margin: "0 8px 10px",
              padding: "12px 8px",
              background: "#C0392B",
              color: "#fff",
              border: "2px solid #922B21",
              borderRadius: 8,
              fontWeight: 800,
              fontSize: 12,
              cursor: "pointer",
              letterSpacing: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span style={{ fontSize: 20 }}>{"\uD83D\uDEAA"}</span>
            ABANDONAR
          </button>
        </div>
      </div>

      {/* ── BOTTOM BAR ─────────────────────────────────────────── */}
      <div
        style={{
          height: 60,
          background: "#3D2B00",
          borderTop: "3px solid #E87722",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          flexShrink: 0,
        }}
      >
        <div style={{ color: "#F5C518", fontWeight: 700, fontSize: 13 }}>
          {selectedTable
            ? `Mesa seleccionada: ${selectedTable.name} \u2014 ${STATUS_LABELS[selectedTable.status] ?? selectedTable.status}`
            : `${visibleTables.length} mesas \u00B7 P\u00E1gina ${page + 1} / ${totalPages}`}
        </div>

        {error && (
          <span style={{ color: "#ff7070", fontSize: 12, fontWeight: 600 }}>
            {error}
          </span>
        )}

        <button
          onClick={handleOpenTableClick}
          style={{
            background: "#E87722",
            color: "#fff",
            border: "2px solid #F5A623",
            borderRadius: 8,
            padding: "10px 32px",
            fontWeight: 900,
            fontSize: 15,
            letterSpacing: 2,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            transition: "all 0.15s",
          }}
        >
          {selectedTable ? `ABRIR MESA ${selectedTable.name}` : "ABRIR MESA"} &#8594;
        </button>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.4); }
        }
      `}</style>
    </div>
  );
}
