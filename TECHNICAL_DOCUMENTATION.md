# Documentación Técnica del Sistema ERP (Clivaro)

Esta documentación está dirigida a desarrolladores que deseen mantener o expandir las funcionalidades del sistema.

## 1. Arquitectura General

El sistema está construido sobre **Next.js 14 (App Router)** utilizando **Prisma ORM** para la interacción con la base de datos PostgreSQL.

### Multi-tenancy (Arquitectura de Esquemas)
El ERP utiliza un enfoque de **un solo base de datos con múltiples esquemas**. Cada cliente (tenant) tiene su propio esquema de base de datos (ej. `tenant_uuid`).

- **Base de Datos Maestra**: Almacena la tabla `Tenant` que contiene las credenciales y el slug de cada cliente.
- **Aislamiento**: La librería `lib/tenancy.ts` se encarga de cambiar el `search_path` de PostgreSQL dinámicamente para que Prisma opere solo sobre el esquema del tenant actual.

## 2. Módulos Core

### Contabilidad (`lib/accounting/`)
- **Journal Service**: Corazón de la contabilidad. Maneja la creación, aprobación y anulación de comprobantes.
- **Integraciones**: Módulos en `lib/accounting/` (como `invoice-integration.ts`) convierten eventos de negocio (ventas, compras) en asientos contables automáticamente.
- **Regla de Oro**: Ningún asiento contable debe crearse fuera de una transacción (`withTenantTx`) para asegurar la consistencia.

### Inventario (`lib/inventory.ts`)
- **Valoración**: Se utiliza el método de **Costo Promedio Ponderado (WAC)**.
- **Stock**: Los niveles de stock se rastrean por bodega (`Warehouse`) y zona (`Zone`).
- **Movimientos**: Cada cambio en el stock genera un registro en `StockMovement` para auditoría.

### Nómina (`app/api/hr/payroll/`)
- **Motor de Cálculo**: Calcula automáticamente deducciones legales de Colombia (Salud 4%, Pensión 4%).
- **Estructura**: `PayrollPeriod` -> `Payslip` -> `PayslipItem`.

## 3. Guía de Desarrollo

### Cómo añadir una nueva funcionalidad Multi-tenant
1. Define el modelo en `prisma/schema.prisma`.
2. Ejecuta `npx prisma generate`.
3. Para operaciones de base de datos, usa siempre `withTenantRead` (lecturas) o `withTenantTx` (escrituras).
4. **IMPORTANTE**: Si añades una tabla nueva, debes regenerar los scripts de sincronización ejecutando:
   ```bash
   npm run db:sync-tenants
   ```

### Cómo crear un nuevo Asiento Contable Automático
Para integrar un nuevo módulo con contabilidad:
1. Crea una función en `lib/accounting/` que reciba el `txPrisma` (cliente de transacción).
2. Llama a `createJournalEntry` pasando dicho cliente.
3. Asegúrate de que la suma de Débitos y Créditos sea igual.

## 4. Seguridad
El sistema utiliza un middleware de permisos (`lib/api-middleware.ts`). Para proteger una ruta API:
```typescript
const session = await requirePermission(req, PERMISSIONS.YOUR_PERMISSION);
```

## 5. Mantenimiento de Base de Datos
- `npm run db:migrate-tenants`: Aplica migraciones de esquema a TODOS los clientes activos.
- `scripts/verify-all-tenants.js`: Utilidad para asegurar que todos los esquemas tienen las columnas necesarias (usar en caso de desincronización manual).
