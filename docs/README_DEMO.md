# 🎯 Datos Demo para Presentación

## 📋 Descripción

Este script crea datos demo completos y realistas en la base de datos del super admin para poder mostrar todas las funcionalidades de la aplicación a empresas potenciales.

## 🚀 Ejecutar Seed Demo

```bash
npm run db:seed-demo
```

## 📊 Datos que se Crean

### ✅ Productos (22 productos)
- Herramientas (martillos, destornilladores, alicates, llaves, taladros)
- Fijaciones (clavos, tornillos, tuercas)
- Plomería (tubos PVC, codos, válvulas)
- Pinturas (pintura blanca, brochas, rodillos)
- Eléctricos (cables, lámparas LED, tomacorrientes, breakers)
- Materiales de construcción (cemento, arena, ladrillos)

### ✅ Clientes (10 clientes)
- Clientes particulares (5)
- Empresas (3)
- Inmobiliarias (1)
- Constructoras (1)

### ✅ Proveedores (4 proveedores)
- Distribuidora Mayorista S.A.
- Ferretería Industrial Ltda.
- Materiales de Construcción Pro
- Eléctricos y Plomería S.A.S.

### ✅ Almacenes (2 almacenes)
- Almacén Principal
- Almacén Sucursal Centro

### ✅ Inventario
- Niveles de stock para todos los productos
- Stock inicial variado (50-250 unidades)
- Movimientos de stock iniciales

### ✅ CRM - Leads (5 oportunidades)
- Diferentes etapas (NEW, QUALIFIED, PROPOSAL, NEGOTIATION, WON)
- Valores variados ($45,000 - $1,200,000)
- Probabilidades realistas
- Fechas de cierre esperadas
- Historial de cambios de etapa

### ✅ Actividades (4 actividades)
- Llamadas
- Reuniones
- Emails
- Tareas

### ✅ Cotizaciones (5 cotizaciones)
- Diferentes estados (DRAFT, SENT, ACCEPTED, EXPIRED)
- Vinculadas a leads
- Múltiples items por cotización
- Descuentos aplicados
- Fechas de validez

### ✅ Órdenes de Compra (4 órdenes)
- Diferentes estados (DRAFT, SENT, CONFIRMED, RECEIVED)
- Múltiples items
- Fechas esperadas de entrega

### ✅ Recepciones de Mercancía (2 recepciones)
- Vinculadas a órdenes de compra
- Actualización automática de stock
- Movimientos de inventario

### ✅ Facturas (8 facturas)
- Diferentes estados (ISSUED, PAID, PARTIAL)
- Múltiples items
- Pagos asociados (para facturas pagadas)
- Actualización de stock (ventas)

### ✅ Caja
- Turno de caja abierto
- Movimientos de entrada y salida
- Saldo inicial y esperado

## ⚠️ Importante

Este script **elimina todos los datos existentes** antes de crear los datos demo. Si quieres mantener datos existentes, comenta las líneas de `deleteMany()` al inicio del script.

## 🔄 Restaurar Datos Originales

Si quieres volver a los datos básicos:

```bash
npm run db:seed
```

## 📝 Notas

- Los datos son completamente ficticios pero realistas
- Los precios están en pesos colombianos (COP)
- Las fechas se generan dinámicamente
- Los stocks se generan aleatoriamente pero de forma realista
- Las relaciones entre entidades están correctamente establecidas

## 🎯 Uso para Presentaciones

1. Ejecuta el seed demo antes de la presentación
2. Los datos mostrarán todas las funcionalidades:
   - Dashboard con estadísticas reales
   - Inventario con productos y stock
   - CRM con leads en diferentes etapas
   - Ventas con cotizaciones y facturas
   - Compras con órdenes y recepciones
   - Caja con turno abierto

## 🔐 Credenciales

Las credenciales de acceso siguen siendo las mismas:
- **Admin**: `admin@local` / `Admin123!`
- **Cajero**: `cashier@local` / `Cashier123!`

