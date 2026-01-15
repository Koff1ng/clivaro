# Roadmap — Retail General (Colombia) — Foco Mostrador

Este documento define un roadmap práctico para convertir la app en una solución **muy completa** para retail en Colombia con foco en operación de **mostrador/POS**.

## Objetivo del producto

- **Vender rápido sin errores** (flujo de caja/POS impecable).
- **Inventario y trazabilidad confiables** (movimientos auditables, multi-almacén).
- **Escalar a multi-sucursal** y control por roles/permisos.
- **Colombia**: preparar el camino para **Facturación Electrónica DIAN** (sin frenar la venta).

## Definición de “Listo para vender” (DoD)

- El POS soporta ventas rápidas con atajos, búsqueda veloz y pago multi-medio.
- Caja con apertura/cierre y arqueo, con auditoría por turno/cajero.
- Inventario siempre cuadra: cada cambio de stock genera movimiento auditable.
- Permisos claros: descuento/anulación/devolución restringidos.
- Impresión térmica estable y consistente (preview + tirilla 80mm).

---

## Fase 1 (2–4 semanas) — Operación de mostrador impecable

### POS (rápido y sin fricción)
- **Búsqueda ultrarrápida** por código, código de barras y nombre (con debounce y límite).
- **Atajos de teclado**: buscar, agregar, aumentar/disminuir, eliminar, cobrar, parkear.
- **Foco automático** en input de búsqueda y navegación por teclado completa.
- **Hold/Parquear ventas** (“tickets”) y reanudar (para filas de mostrador).
- **Notas en la venta** + referencia (ej. “para obra X”).

### Pagos (operación real)
- **Múltiples medios por venta**: efectivo/tarjeta/transferencia.
- **Cambio automático** y validación de montos.
- **Redondeo configurable** (opcional).

### Devoluciones / Anulaciones (con control)
- **Devolución parcial** y total.
- **Motivo obligatorio** + **registro** (auditoría).
- Permisos por rol para: **descuentos**, **anulación**, **devolución**.

### Caja (turnos)
- Apertura/cierre.
- Arqueo y diferencias.
- Entradas/salidas (retiros, gastos) con motivo.
- Reporte por turno/cajero.

### Impresión térmica (80mm)
- Tirilla consistente + **vista previa**.
- Datos completos: empresa, NIT, cliente, items, totales, impuestos.
- Compatibilidad con impresoras comunes (Chrome/Edge).

---

## Fase 2 (1–2 meses) — Escalado, control y rentabilidad

### Multi-sucursal / Multi-almacén
- Sucursal/almacén por defecto (simple) y luego:
  - **Transferencias entre almacenes**
  - Permisos por sucursal/almacén
  - Reportes por sucursal

### Inventario avanzado
- Ajustes con aprobación (opcional).
- Conteos cíclicos (parciales) para minimizar pérdidas.
- Kardex/Movimientos con filtros por fecha/usuario/almacén/motivo.

### Costos y margen
- Costo promedio (y/o FIFO en fase posterior).
- **Margen** en POS y reportes de rentabilidad diaria/semanal.

### Compras pro
- Recepción parcial.
- Cuentas por pagar (CxP) básico.
- Reorden por mínimos/máximos.

---

## Fase 3 (3–6 meses) — Diferenciadores (nivel empresa)

### Offline-first para POS (alto impacto en Colombia)
- Vender sin internet (cola local).
- Sincronización con reconciliación al volver.
- Resolución de conflictos y auditoría.

### Integraciones
- Lectores de código de barras.
- Balanzas (si aplica).
- Pasarelas de pago
- WhatsApp/Email para comprobantes.
- Webhooks e integración con e-commerce (Woo/Shopify) si el mercado lo exige.

### DIAN (facturación electrónica) sin frenar venta
- Cola de envío, reintentos, estados por documento.
- Bitácora completa (quién, cuándo, respuesta DIAN).
- Notas crédito/débito.
- “Reenviar a DIAN” y diagnóstico guiado.

---

## Sugerencia de planes (si aplica)

- **Starter**: POS + inventario básico + caja básica (una sucursal).
- **Business**: multi-medio de pago, devoluciones controladas, reportes avanzados, compras pro, CRM/marketing (según estrategia).
- **Enterprise**: multi-sucursal, offline POS, integraciones, DIAN avanzada, auditoría y observabilidad completa.

---

## KPIs de éxito

- Tiempo promedio de venta (desde escaneo hasta cobro).
- % ventas con correcciones (anulaciones/devoluciones).
- Diferencias de caja por turno.
- Exactitud de inventario (ajustes vs ventas/recepciones).
- Disponibilidad (uptime) y latencia en POS.


