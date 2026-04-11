<![CDATA[# 🏗️ Clivaro — ERP/CRM SaaS Multi-tenant

> Sistema de gestión empresarial completo para ferreterías, tiendas de retail, restaurantes y negocios en Colombia. Facturación electrónica DIAN, POS, inventario, contabilidad, CRM, nómina y más.

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue?logo=typescript)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql)
![Prisma](https://img.shields.io/badge/Prisma-5.9-2D3748?logo=prisma)
![Vercel](https://img.shields.io/badge/Deploy-Vercel-black?logo=vercel)
![Supabase](https://img.shields.io/badge/DB-Supabase-3ECF8E?logo=supabase)

---

## 📑 Tabla de Contenidos

- [Visión General](#-visión-general)
- [Arquitectura del Sistema](#-arquitectura-del-sistema)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Stack Tecnológico](#-stack-tecnológico)
- [Módulos Funcionales](#-módulos-funcionales)
- [Referencia de APIs](#-referencia-de-apis)
- [Base de Datos](#-base-de-datos)
- [Variables de Entorno](#-variables-de-entorno)
- [Inicio Rápido](#-inicio-rápido)
- [Scripts Disponibles](#-scripts-disponibles)
- [Planes SaaS](#-planes-saas)
- [Despliegue](#-despliegue)
- [Guía para Desarrolladores](#-guía-para-desarrolladores)
- [Testing](#-testing)
- [Seguridad](#-seguridad)

---

## 🌐 Visión General

**Clivaro** es un ERP/CRM SaaS diseñado para pequeñas y medianas empresas en Colombia. Cada cliente (tenant) obtiene su propia base de datos aislada dentro de una misma instancia de PostgreSQL, habilitando personalización completa sin comprometer la seguridad de los datos.

### Módulos incluidos

| Módulo | Descripción |
|--------|-------------|
| **POS** | Punto de venta con soporte para impresoras térmicas, turnos de caja, propinas |
| **Inventario** | Multi-bodega, zonas, conteo físico, costo promedio ponderado (WAC) |
| **Ventas** | Pipeline: Cotización → Orden de Venta → Factura → Pago |
| **Compras** | Proveedores, órdenes de compra, recepción de mercancía |
| **CRM** | Clientes, leads, pipeline de oportunidades, actividades |
| **Contabilidad** | PUC colombiano, diario contable, asientos automáticos, reportes |
| **RRHH** | Empleados, nómina con deducciones legales CO (salud 4%, pensión 4%) |
| **Restaurante** | Mesas, comandas con impresión a cocina, meseros con PIN |
| **Marketing** | Campañas email (Resend/SMTP), Meta Ads, inbox, IA generativa |
| **Facturación Electrónica** | DIAN a través de Factus (CUFE, QR, XML) |
| **Pagos Online** | MercadoPago (Checkout Pro) + Wompi (Widget) |
| **IA** | Asistente Clivi 🐙 (Gemini 2.5 Flash + Groq) para marketing y chat |

---

## 🏛️ Arquitectura del Sistema

### Diagrama General

```mermaid
graph TB
    subgraph Cliente["🌐 Frontend (Next.js App Router)"]
        Pages["Páginas SSR/CSR"]
        Components["Componentes React"]
        RQ["React Query (Estado)"]
    end

    subgraph API["⚡ Backend (Next.js API Routes)"]
        MW["Middleware (request-id)"]
        Auth["requireAuth / requirePermission"]
        RL["Rate Limiter"]
        Routes["52+ API Routes"]
    end

    subgraph Services["🔧 Servicios"]
        Tenancy["lib/tenancy.ts"]
        Inventory["lib/inventory.ts"]
        Accounting["lib/accounting/*"]
        Billing["lib/electronic-billing.ts"]
        PDF["lib/pdf.ts (Puppeteer)"]
        Email["lib/email.ts (Nodemailer/Resend)"]
        AI["lib/gemini.ts (Gemini AI)"]
    end

    subgraph DB["🗄️ Base de Datos"]
        Master["Schema: public (Master)"]
        T1["Schema: tenant_empresa1"]
        T2["Schema: tenant_empresa2"]
        TN["Schema: tenant_..."]
    end

    subgraph External["🌍 Servicios Externos"]
        Supabase["Supabase (PostgreSQL)"]
        Factus["Factus (DIAN)"]
        MP["MercadoPago"]
        Wompi["Wompi"]
        Meta["Meta Ads API"]
        GeminiAPI["Google Gemini AI"]
        SMTP["SMTP / Resend"]
    end

    Pages --> RQ --> Routes
    MW --> Auth --> RL --> Routes
    Routes --> Services
    Services --> Tenancy --> DB
    Services --> External
    DB --> Supabase
```

### Multi-tenancy: Schema-per-Tenant

El sistema usa **un solo servidor PostgreSQL** con **múltiples schemas** (uno por tenant). Esto ofrece aislamiento de datos a nivel de base de datos sin la complejidad de administrar múltiples servidores.

```
PostgreSQL Instance (Supabase)
├── public (schema maestro)
│   ├── Tenant          → Registro de todos los clientes
│   ├── User            → Super admins del sistema
│   ├── Plan            → Planes SaaS (Starter, Business, Enterprise)
│   └── Subscription    → Suscripciones activas
│
├── tenant_prueba (schema aislado)
│   ├── User, Role, Permission    → Usuarios del tenant
│   ├── Product, StockLevel       → Inventario del tenant
│   ├── Invoice, Payment          → Ventas del tenant
│   ├── AccountingAccount         → Contabilidad del tenant
│   └── ... (60+ tablas)
│
├── tenant_ferroagro (schema aislado)
│   └── ... (misma estructura, datos diferentes)
│
└── tenant_N ...
```

**Archivos clave:**

| Archivo | Responsabilidad |
|---------|-----------------|
| `lib/tenant-utils.ts` | Deriva el nombre del schema: `tenant_{slug}` |
| `lib/tenancy.ts` | Crea/cachea PrismaClients por schema, valida existencia |
| `lib/initialize-tenant.ts` | Bootstraps un schema nuevo (DDL + seed de datos) |
| `lib/tenant-sql-statements.ts` | SQL embebido para crear las 60+ tablas del tenant |

**Funciones principales de `tenancy.ts`:**

| Función | Uso | Cuándo usarla |
|---------|-----|---------------|
| `getTenantPrismaClient(tenantId)` | Retorna un PrismaClient configurado para el schema del tenant | Uso interno |
| `withTenantTx(tenantId, callback)` | Ejecuta operaciones dentro de una **transacción** atómica | **Writes** (crear factura, mover stock) |
| `withTenantRead(tenantId, callback)` | Lee datos del tenant sin transacción (más rápido) | **Reads** (GET endpoints) |
| `getTenantIdFromSession(session)` | Extrae el `tenantId` del JWT | Dentro de API routes |

### Flujo de Autenticación

```mermaid
sequenceDiagram
    participant U as Usuario
    participant FE as Frontend
    participant NA as NextAuth
    participant PG as PostgreSQL

    U->>FE: Login (usuario, contraseña, slug)
    FE->>NA: POST /api/auth/credentials
    
    alt Tenant Login (slug presente)
        NA->>PG: Buscar tenant en public.Tenant
        PG-->>NA: tenant.id, tenant.active
        NA->>PG: SET search_path TO tenant_slug
        NA->>PG: SELECT User WHERE username=$1
        PG-->>NA: User + Roles + Permissions
        NA->>NA: bcrypt.compare(password, hash)
        NA-->>FE: JWT con {id, tenantId, roles, permissions}
    else Super Admin (sin slug)
        NA->>PG: SELECT public.User WHERE isSuperAdmin=true
        PG-->>NA: Super admin user
        NA-->>FE: JWT con {id, isSuperAdmin: true}
    end

    FE->>FE: Almacena JWT en cookie HttpOnly
```

**Puntos importantes:**
- La autenticación usa **`pg.Client` directo** (no Prisma) para `SET search_path` — esto evita problemas con PgBouncer en modo transacción.
- Los permisos se **embeben en el JWT** al momento del login, evitando consultas a BD en cada request.
- Dos estrategias: **Tenant Login** (usuario normal) y **Super Admin Login** (acceso global).

### Sistema de Permisos (RBAC)

**Roles predeterminados:**

| Rol | Descripción | Permisos |
|-----|-------------|----------|
| `ADMIN` | Administrador total | Todos (bypass automático) |
| `CAJERO_POS` | Cajero de punto de venta | POS, ventas, caja, devoluciones, restaurante |
| `VENDEDOR_COMERCIAL` | Asesor comercial | Ventas, clientes, CRM |
| `ALMACENISTA` | Gestión de almacén | Productos, inventario, compras |
| `CONTADOR` | Gestión financiera | Reportes, contabilidad |
| `RECURSOS_HUMANOS` | Gestión de personal | Nómina, usuarios |
| `REST_MESERO` | Mesero (restaurantes) | POS, restaurante |

**Permisos disponibles:**

```
manage_users, manage_products, manage_inventory, manage_sales,
manage_returns, void_invoices, apply_discounts, manage_purchases,
manage_crm, view_reports, manage_cash, manage_settings,
manage_accounting, manage_restaurant
```

### Rate Limiting

El sistema implementa rate limiting con fallback automático:

| Tipo | Ventana | Máximo | Uso |
|------|---------|--------|-----|
| `auth` | 15 min | 5 | Login attempts |
| `api` | 15 min | 500 | General API |
| `read` | 1 min | 180 | GET endpoints |
| `write` | 1 min | 60 | POST/PUT/DELETE |

- **Producción**: Upstash Redis (distribuido, consistente entre instancias serverless)
- **Desarrollo**: In-memory (fallback automático si no hay Redis)

### Sistema de Cache

`lib/cache.ts` implementa un cache con TTL:
- **Primario**: Upstash Redis (si `UPSTASH_REDIS_REST_URL` está configurado)
- **Fallback**: `Map<string, CacheEntry>` en memoria (con cleanup cada 5 min)
- **Claves**: `dashboard:{tenantId}`, `stats:{tenantId}`, `top-clients:{tenantId}`, etc.

### Logging Centralizado

`lib/logger.ts` provee logging estructurado con niveles:

```typescript
logger.info('Mensaje', { context })      // Solo en producción: console.info
logger.debug('Mensaje', { context })     // Solo en desarrollo
logger.warn('Mensaje', { context })      // Siempre
logger.error('Mensaje', error, context)  // Siempre (sin stack en producción)
logger.apiRequest('GET', '/api/products')
logger.apiResponse('GET', '/api/products', 200, 45)
```

---

## 📁 Estructura del Proyecto

```
Clivaro/
├── app/                          # Next.js App Router
│   ├── layout.tsx               # Layout raíz (SF Pro font, Meta Pixel, Providers)
│   ├── providers.tsx            # SessionProvider + QueryClientProvider
│   ├── globals.css              # Estilos globales + Tailwind
│   ├── page.tsx                 # Landing page
│   │
│   ├── api/                     # ⚡ API Routes (52+ endpoints)
│   │   ├── auth/                # NextAuth endpoints
│   │   ├── accounting/          # Contabilidad (PUC, vouchers, reportes)
│   │   ├── activities/          # Actividades CRM
│   │   ├── admin/               # Panel super admin (tenants CRUD)
│   │   ├── ai/                  # Chat IA (Clivi)
│   │   ├── billing/             # Facturación electrónica
│   │   ├── cash/                # Turnos de caja
│   │   ├── categories/          # Categorías de productos
│   │   ├── chat/                # Mensajes de chat
│   │   ├── contact/             # Formulario de contacto
│   │   ├── credit-notes/        # Notas crédito
│   │   ├── cron/                # Jobs programados (backup, billing)
│   │   ├── customers/           # CRUD clientes
│   │   ├── dashboard/           # KPIs y estadísticas
│   │   ├── electronic-invoicing/# Envío a DIAN vía Factus
│   │   ├── fiscal-config/       # Configuración fiscal
│   │   ├── health/              # Health check
│   │   ├── hr/                  # RRHH (empleados, nómina)
│   │   ├── inventory/           # Stock, movimientos, conteo físico
│   │   ├── invoices/            # Facturas CRUD
│   │   ├── leads/               # CRM leads
│   │   ├── marketing/           # Campañas email, Meta Ads
│   │   ├── onboarding/          # Wizard de onboarding
│   │   ├── payments/            # Pagos (MercadoPago, Wompi, webhooks)
│   │   ├── pdf/                 # Generación de PDFs
│   │   ├── plans/               # Planes SaaS
│   │   ├── pos/                 # Punto de venta
│   │   ├── products/            # Productos CRUD
│   │   ├── purchases/           # Órdenes de compra
│   │   ├── quotations/          # Cotizaciones
│   │   ├── recipes/             # Recetas (para restaurantes)
│   │   ├── reports/             # Reportes de ventas
│   │   ├── restaurant/          # Mesas, órdenes, meseros
│   │   ├── sales/               # Ventas generales
│   │   ├── sales-orders/        # Órdenes de venta
│   │   ├── settings/            # Configuración del tenant
│   │   ├── subscriptions/       # Suscripciones SaaS
│   │   ├── suppliers/           # Proveedores
│   │   ├── tax-rates/           # Tasas de impuestos
│   │   ├── tenant/              # Operaciones del tenant actual
│   │   ├── tenants/             # CRUD tenants (super admin)
│   │   ├── units/               # Unidades de medida
│   │   ├── uploads/             # Subida de archivos
│   │   ├── users/               # Usuarios CRUD
│   │   ├── warehouses/          # Bodegas y zonas
│   │   ├── webhooks/            # Webhooks entrantes
│   │   └── whatsapp/            # WhatsApp bridge
│   │
│   ├── (dashboard)/             # Layout con sidebar para app interna
│   ├── accounting/              # Páginas de contabilidad
│   ├── admin/                   # Panel de administración
│   ├── cash/                    # Gestión de caja
│   ├── crm/                     # CRM (clientes, leads)
│   ├── dashboard/               # Dashboard principal
│   ├── hr/                      # Recursos Humanos
│   ├── inventory/               # Inventario
│   ├── login/                   # Página de login
│   ├── marketing/               # Marketing y campañas
│   ├── onboarding/              # Wizard de onboarding
│   ├── pos/                     # Punto de venta
│   ├── pricing/                 # Página de precios
│   ├── products/                # Catálogo de productos
│   ├── purchases/               # Compras
│   ├── restaurant/              # Módulo restaurante
│   ├── sales/                   # Ventas
│   └── settings/                # Configuración
│
├── components/                   # 🧩 Componentes React (25 módulos)
│   ├── ui/                      # Primitivos UI (Button, Dialog, Toast, etc.)
│   ├── layout/                  # Sidebar, Header, Navigation
│   ├── guards/                  # PermissionGuard, PlanGuard
│   ├── pos/                     # Componentes del POS
│   ├── products/                # Formularios de productos
│   ├── inventory/               # Componentes de inventario
│   ├── sales/                   # Componentes de ventas
│   ├── purchases/               # Componentes de compras
│   ├── accounting/              # Componentes contables
│   ├── restaurant/              # Componentes de restaurante
│   ├── marketing/               # Componentes de marketing
│   ├── crm/                     # Componentes CRM
│   ├── admin/                   # Panel de super admin
│   ├── ai/                      # Chat IA (Clivi)
│   └── ...                      # cash, reports, settings, etc.
│
├── lib/                          # 🔧 Lógica de negocio y utilidades
│   ├── auth.ts                  # Configuración NextAuth (CredentialsProvider)
│   ├── db.ts                    # Singleton PrismaClient (schema público)
│   ├── tenancy.ts               # Multi-tenancy (TTenantPrismaClient, withTenantTx)
│   ├── tenant-utils.ts          # Derivación de nombres de schema
│   ├── tenant-sql-statements.ts # SQL para crear schemas de tenant (93KB)
│   ├── initialize-tenant.ts     # Bootstrap de tenant nuevo
│   ├── api-middleware.ts        # requireAuth, requirePermission, requireAnyPermission
│   ├── permissions.ts           # Constantes RBAC (roles, permisos)
│   ├── plan-features.ts         # Definición de planes SaaS
│   ├── plan-middleware.ts       # Guard de features por plan
│   ├── rate-limit.ts            # Rate limiter (Upstash Redis / in-memory)
│   ├── cache.ts                 # Cache con TTL (Redis / in-memory)
│   ├── logger.ts                # Logging estructurado
│   ├── inventory.ts             # WAC, updateStockLevel, checkStock
│   ├── pdf.ts                   # Generación de PDFs (Puppeteer + Chromium)
│   ├── email.ts                 # Envío de emails (SMTP / Resend)
│   ├── electronic-billing.ts   # Facturación electrónica DIAN
│   ├── mercadopago.ts           # Integración MercadoPago
│   ├── wompi.ts                 # Integración Wompi
│   ├── gemini.ts                # IA generativa (Gemini 2.5 Flash)
│   ├── utils.ts                 # Helpers (formatCurrency, formatDate, cn)
│   │
│   ├── accounting/              # 📊 Motor contable
│   │   ├── service.ts           # Inicialización PUC colombiano
│   │   ├── journal-service.ts   # Creación/aprobación de asientos
│   │   ├── ledger-service.ts    # Libro mayor
│   │   ├── report-service.ts    # Balance general, estado de resultados
│   │   ├── invoice-integration.ts  # Asiento automático al facturar
│   │   ├── inventory-integration.ts # Asiento por movimientos de stock
│   │   ├── payment-integration.ts   # Asiento al registrar pagos
│   │   ├── credit-note-integration.ts # Asiento por notas crédito
│   │   ├── payroll-integration.ts   # Asiento por nómina
│   │   └── config-service.ts    # Mapeo de cuentas contables
│   │
│   ├── factus/                  # 🧾 Cliente API de Factus (DIAN)
│   │   ├── client.ts            # OAuth2 + endpoints REST
│   │   └── types.ts             # Tipos de Factus (items, customer, invoice)
│   │
│   ├── marketing/               # 📧 Marketing
│   │   ├── meta-ads-service.ts  # Creación de campañas Meta/Facebook
│   │   ├── meta-ads-types.ts    # Tipos de Meta Ads
│   │   ├── meta-ads-errors.ts   # Manejo de errores de la API
│   │   └── email-assets.ts      # Assets para emails HTML
│   │
│   └── ai/                      # 🤖 Motor IA
│       ├── client.ts            # Cliente Groq (LLaMA)
│       ├── calculations.ts      # Cálculos de business intelligence
│       ├── cache.ts             # Cache de respuestas IA
│       └── modules/             # Módulos especializados
│
├── prisma/                       # 🗃️ Base de datos
│   ├── schema.prisma            # Schema principal (2000+ líneas, 60+ modelos)
│   ├── seed.ts                  # Seed de datos iniciales
│   ├── seed-demo.ts             # Seed con datos demo
│   ├── seed-plans.ts            # Seed de planes SaaS
│   └── ...                      # Scripts de migración y utilidades
│
├── scripts/                      # 🛠️ Scripts de mantenimiento
│   ├── deploy-production.mjs    # Script de deploy a producción
│   ├── sync-tenant-schema.ts    # Sincronización de schemas
│   ├── verify-all-tenants.ts    # Verificación de integridad
│   ├── audit-tenant-schema.ts   # Auditoría de schemas
│   └── ...                      # 50+ scripts de migración y fixes
│
├── docs/                         # 📝 Documentación adicional
│   ├── API.md                   # Referencia de APIs
│   ├── MULTI_TENANT.md          # Guía multi-tenancy
│   ├── COMPONENTS.md            # Guía de componentes
│   ├── EMAIL.md                 # Configuración de email
│   ├── OPTIMIZACION_BD.md       # Optimización de base de datos
│   └── legal/                   # Documentos legales (T&C, Política de datos)
│
├── whatsapp-bridge/              # 🟢 Microservicio WhatsApp (Node.js separado)
│
├── middleware.ts                 # Middleware Next.js (x-request-id)
├── next.config.js                # Configuración de Next.js
├── docker-compose.yml            # PostgreSQL 16 local para desarrollo
├── vercel.json                   # Cron jobs (backup 3AM, billing 6AM)
└── tailwind.config.ts            # Configuración Tailwind CSS
```

---

## 🔧 Stack Tecnológico

### Core

| Tecnología | Versión | Propósito |
|-----------|---------|-----------|
| **Next.js** | 14.1 | Framework fullstack (App Router, API Routes, SSR) |
| **React** | 18.2 | UI (componentes, hooks, estado) |
| **TypeScript** | 5.3 | Tipado estático en todo el proyecto |
| **Prisma** | 5.9 | ORM para PostgreSQL (schema-first, type-safe) |
| **PostgreSQL** | 16 | Base de datos relacional (via Supabase) |

### Frontend

| Paquete | Propósito |
|---------|-----------|
| `tailwindcss` | Framework CSS utility-first |
| `@radix-ui/*` | Primitivos UI accesibles (Dialog, Select, Tabs, etc.) |
| `lucide-react` | Íconos SVG |
| `recharts` | Gráficos y charts del dashboard |
| `framer-motion` | Animaciones fluidas |
| `react-hook-form` + `zod` | Formularios con validación |
| `@tanstack/react-query` | Estado del servidor, cache, polling |
| `react-day-picker` | Selector de fechas |
| `react-window` | Virtualización de listas largas |
| `react-to-print` | Impresión de recibos POS |
| `@hello-pangea/dnd` | Drag & drop (pipeline Kanban) |
| `class-variance-authority` | Variantes de componentes (design system) |

### Backend / Servicios

| Paquete | Propósito |
|---------|-----------|
| `next-auth` | Autenticación (CredentialsProvider, JWT, sesiones) |
| `bcryptjs` | Hash de contraseñas |
| `jose` + `jsonwebtoken` | Manejo de tokens JWT |
| `pg` | Cliente PostgreSQL directo (auth, DDL) |
| `nodemailer` | Envío de emails vía SMTP |
| `puppeteer-core` + `@sparticuz/chromium` | Generación de PDFs (serverless-compatible) |
| `sharp` | Procesamiento de imágenes |
| `xlsx` | Exportación a Excel |
| `jszip` | Generación de archivos ZIP |
| `qrcode` | Generación de códigos QR (facturas DIAN) |

### Integraciones Externas

| Servicio | Paquete | Propósito |
|----------|---------|-----------|
| **Factus** | `lib/factus/client.ts` | Facturación electrónica DIAN (OAuth2 + REST) |
| **MercadoPago** | `mercadopago` | Pagos online (Checkout Pro) |
| **Wompi** | `lib/wompi.ts` | Pagos online (Widget, webhooks) |
| **Meta/Facebook** | `facebook-nodejs-business-sdk` | Campañas de ads, anuncios |
| **Google Gemini** | `@google/generative-ai` | IA generativa (campañas, chat) |
| **Groq** | `groq-sdk` | LLM alternativo para IA |
| **Supabase** | `@supabase/supabase-js` | Storage, funciones edge |
| **Resend** | API REST | Email transaccional (fallback) |
| **Vercel** | `@vercel/analytics` + `@vercel/speed-insights` | Analytics y rendimiento |

### DevOps

| Herramienta | Propósito |
|-------------|-----------|
| `vitest` | Tests unitarios |
| `@playwright/test` | Tests E2E |
| `eslint` + `eslint-config-next` | Linting |
| `tsx` | Ejecutar scripts TypeScript |
| `supabase` CLI | Gestión de BD remota |
| Docker Compose | PostgreSQL 16 local |

---

## 📦 Módulos Funcionales

### POS (Punto de Venta)

- **Ruta**: `/pos`
- **API**: `/api/pos/products`, `/api/pos/sell`
- **Funcionalidad**: Búsqueda rápida de productos (por nombre, SKU, código de barras), selección de cantidades, cálculo automático de impuestos (IVA, ICA, retenciones), propinas, múltiples métodos de pago simultáneos, impresión de recibos (ESC/POS y térmica), descuentos por ítem.
- **Dependencias clave**: `lib/inventory.ts` (descuento de stock), `lib/accounting/invoice-integration.ts` (asiento contable automático)

### Inventario

- **Ruta**: `/inventory`
- **API**: `/api/inventory/*`
- **Valoración**: **Costo Promedio Ponderado (WAC)** — se recalcula al recibir mercancía.
- **Funcionalidad**: Multi-bodega con zonas, conteo físico (PENDING → COUNTING → APPROVED), transferencias entre bodegas, movimientos con auditoría completa (`StockMovement`), alertas de stock mínimo/máximo.
- **Archivos clave**:
  - `lib/inventory.ts` — `updateProductCost()` (WAC), `updateStockLevel()`, `checkStock()`

### Ventas (Pipeline Completo)

```
Cotización (DRAFT → SENT → ACCEPTED)
    ↓ Convertir
Orden de Venta (OPEN → INVOICED)
    ↓ Facturar
Factura (EMITIDA → PAGADA / ANULADA)
    ↓ Pago
Payment (CASH, CARD, TRANSFER, MERCADOPAGO)
    ↓ Devolución (opcional)
Return → CreditNote
```

### Contabilidad

- **Motor**: Basado en **PUC colombiano** (Plan Único de Cuentas)
- **Asientos automáticos**: Se crean al facturar, cobrar pagos, recibir mercancía, procesar nómina, emitir notas crédito
- **Regla de oro**: Todo asiento debe cumplir `Σ Débitos = Σ Créditos`
- **Reportes**: Balance General, Estado de Resultados, Libro Mayor, Información Exógena
- **Archivos clave**: `lib/accounting/journal-service.ts` (motor central)

### Facturación Electrónica (DIAN)

- **Proveedor**: Factus (API REST con OAuth2)
- **Flujo**: Factura interna → Mapeo a formato DIAN → Envío a Factus → Respuesta con CUFE + QR
- **Soporte**: IVA, INC (impoconsumo), retenciones (ReteFuente, ReteICA, ReteIVA)
- **Notas Crédito**: Generación y transmisión electrónica
- **Archivos clave**: `lib/electronic-billing.ts`, `lib/factus/client.ts`

### RRHH y Nómina

- **Cálculos automáticos**: Salud (4%), Pensión (4%), deducciones personalizadas
- **Estructura**: `PayrollPeriod` → `Payslip` → `PayslipItem`
- **Integración contable**: Asiento automático al aprobar nómina

### Restaurante

- **Mesas**: CRUD con estados (available, occupied, reserved)
- **Comandas**: Pedidos por mesa con impresión a estación (cocina/bar/caja)
- **Meseros**: Autenticación por PIN, bloqueo tras intentos fallidos
- **Propinas**: Soporte en facturación

---

## 📡 Referencia de APIs

Todas las rutas API están bajo `/api/`. Cada ruta requiere autenticación (vía JWT en cookie) a menos que se indique lo contrario.

### Autenticación y Sesión

| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| POST | `/api/auth/[...nextauth]` | Público | Login/logout (NextAuth) |
| GET | `/api/health` | Público | Health check |

### Productos e Inventario

| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| GET/POST | `/api/products` | `manage_products` | CRUD de productos |
| GET/PATCH/DELETE | `/api/products/[id]` | `manage_products` | Producto individual |
| GET/POST | `/api/categories` | `manage_products` | Categorías |
| GET/POST | `/api/units` | `manage_products` | Unidades de medida |
| GET/POST | `/api/inventory/stock` | `manage_inventory` | Niveles de stock |
| POST | `/api/inventory/movements` | `manage_inventory` | Movimientos de stock |
| GET/POST | `/api/inventory/physical` | `manage_inventory` | Conteo físico |
| GET/POST | `/api/warehouses` | `manage_inventory` | Bodegas |
| GET/POST | `/api/recipes` | `manage_products` | Recetas (restaurante) |

### Ventas y Facturación

| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| GET/POST | `/api/pos/products` | `manage_sales` | Productos para POS |
| POST | `/api/pos/sell` | `manage_sales` | Registrar venta POS |
| GET/POST | `/api/quotations` | `manage_sales` | Cotizaciones |
| GET/POST | `/api/sales-orders` | `manage_sales` | Órdenes de venta |
| GET/POST | `/api/invoices` | `manage_sales` | Facturas |
| GET/POST | `/api/credit-notes` | `manage_sales` | Notas crédito |
| GET/POST | `/api/customers` | `manage_crm` / `manage_sales` | Clientes |
| GET/POST | `/api/tax-rates` | `manage_sales` | Tasas de impuestos |

### Pagos

| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| POST | `/api/payments/mercadopago/create` | `manage_sales` | Crear preferencia MP |
| POST | `/api/payments/mercadopago/webhook` | Público | Webhook de MP |
| POST | `/api/payments/wompi/create` | `manage_sales` | Crear sesión Wompi |
| POST | `/api/payments/wompi/webhook` | Público | Webhook de Wompi |

### Compras

| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| GET/POST | `/api/suppliers` | `manage_purchases` | Proveedores |
| GET/POST | `/api/purchases/orders` | `manage_purchases` | Órdenes de compra |
| GET/POST | `/api/purchases/receipts` | `manage_purchases` | Recepción de mercancía |

### CRM y Marketing

| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| GET/POST | `/api/leads` | `manage_crm` | Leads / Oportunidades |
| GET/POST | `/api/activities` | `manage_crm` | Actividades CRM |
| GET/POST | `/api/marketing/campaigns` | `manage_crm` | Campañas email |
| POST | `/api/marketing/meta-ads` | `manage_crm` | Meta Ads |
| POST | `/api/ai/chat` | Autenticado | Chat con Clivi 🐙 |
| POST | `/api/ai/generate-campaign` | `manage_crm` | Generar campaña con IA |

### Contabilidad

| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| GET/POST | `/api/accounting/accounts` | `manage_accounting` | Catálogo de cuentas |
| GET/POST | `/api/accounting/vouchers` | `manage_accounting` | Comprobantes contables |
| GET | `/api/accounting/journal` | `manage_accounting` | Diario contable |
| GET | `/api/accounting/reports` | `manage_accounting` | Reportes financieros |

### RRHH

| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| GET/POST | `/api/hr/employees` | `manage_users` | Empleados |
| GET/POST | `/api/hr/payroll` | `manage_users` | Períodos de nómina |

### Caja

| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| GET/POST | `/api/cash/shifts` | `manage_cash` | Turnos de caja |
| POST | `/api/cash/movements` | `manage_cash` | Movimientos de efectivo |

### Restaurante

| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| GET/POST | `/api/restaurant/tables` | `manage_restaurant` | Mesas |
| GET/POST | `/api/restaurant/orders` | `manage_restaurant` | Órdenes de mesa |
| GET/POST | `/api/restaurant/waiters` | `manage_restaurant` | Meseros |

### Sistema y Admin

| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| GET/POST | `/api/users` | `manage_users` | Usuarios del tenant |
| GET/PATCH | `/api/settings` | `manage_settings` | Configuración |
| GET | `/api/settings/data/export` | `manage_settings` | Exportar datos |
| GET/POST | `/api/tenants` | Super Admin | CRUD de tenants |
| POST | `/api/tenants/[id]/init` | Super Admin | Inicializar tenant |
| GET | `/api/plans` | Autenticado | Listar planes SaaS |
| GET/POST | `/api/subscriptions` | Autenticado | Suscripciones |
| POST | `/api/electronic-invoicing/send` | `manage_sales` | Envío DIAN |
| GET/POST | `/api/fiscal-config` | `manage_settings` | Config. fiscal |

### Cron Jobs (Vercel)

| Schedule | Ruta | Descripción |
|----------|------|-------------|
| `0 3 * * *` (3 AM) | `/api/cron/backup` | Backup automático |
| `0 6 * * *` (6 AM) | `/api/cron/billing-check` | Verificación de suscripciones |

---

## 🗃️ Base de Datos

### Modelos Principales (Prisma Schema)

El proyecto tiene **60+ modelos** en `prisma/schema.prisma`. Los más importantes:

```
📌 Autenticación                         📌 Inventario
├── User (username, password, roles)     ├── Product (SKU, barcode, cost, WAC)
├── Role (ADMIN, CAJERO_POS, etc.)       ├── ProductVariant
├── Permission                           ├── Warehouse (multi-bodega)
├── UserRole                             ├── WarehouseZone
└── RolePermission                       ├── StockLevel (por bodega+zona)
                                         ├── StockMovement (auditoría)
📌 Ventas                                └── PhysicalInventory (conteo)
├── Customer (NIT, crédito)
├── Quotation → QuotationItem            📌 Compras
├── SalesOrder → SalesOrderItem          ├── Supplier
├── Invoice → InvoiceItem                ├── PurchaseOrder → PurchaseOrderItem
├── Payment (multi-método)               └── GoodsReceipt → GoodsReceiptItem
├── Return → ReturnItem
├── CreditNote → CreditNoteItem          📌 Contabilidad
├── TaxRate (IVA, ICA, retenciones)      ├── AccountingAccount (PUC)
├── InvoiceLineTax                       ├── AccountingPeriod
├── InvoiceTaxSummary                    ├── JournalEntry → JournalEntryLine
└── PaymentMethod (CASH, CARD, etc.)     └── AccountingConfig

📌 CRM/Marketing                         📌 RRHH
├── Lead (pipeline, stages)              ├── Employee
├── Activity                             ├── PayrollPeriod
├── Campaign                             ├── Payslip → PayslipItem
├── MarketingCampaign                    └── Attendance
├── ChatMessage
└── Opportunity                          📌 Restaurante
                                         ├── RestaurantTable
📌 SaaS                                  ├── TableOrder → TableOrderLine
├── Tenant (slug, active)                └── WaiterProfile (PIN auth)
├── Plan (Starter, Business, Enterprise)
├── Subscription (status, trial)
└── TenantSettings (fiscal, onboarding)
```

### Datasource

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")      // PgBouncer pool (port 6543)
  directUrl = env("DIRECT_URL")        // Conexión directa (port 5432, para migraciones)
}
```

---

## 🔑 Variables de Entorno

Crea un archivo `.env` en la raíz con las siguientes variables:

### Base de Datos (Obligatorio)

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `DATABASE_URL` | URL de PostgreSQL (pool via PgBouncer) | `postgresql://user:pass@host:6543/db?pgbouncer=true` |
| `DIRECT_URL` | URL directa (sin PgBouncer, para DDL/migraciones) | `postgresql://user:pass@host:5432/db` |

### Autenticación (Obligatorio)

| Variable | Descripción |
|----------|-------------|
| `NEXTAUTH_URL` | URL base de la app (`http://localhost:3000` en dev) |
| `NEXTAUTH_SECRET` | Secret para firmar JWTs (generar con `openssl rand -base64 32`) |

### Email (Recomendado)

| Variable | Descripción |
|----------|-------------|
| `SMTP_HOST` | Host del servidor SMTP |
| `SMTP_PORT` | Puerto (465 para SSL, 587 para TLS) |
| `SMTP_USER` | Usuario SMTP |
| `SMTP_PASSWORD` | Contraseña SMTP |
| `SMTP_FROM` | Dirección remitente |
| `RESEND_API_KEY` | API key de Resend (fallback/alternativa) |

### Pagos (Opcional)

| Variable | Descripción |
|----------|-------------|
| `MERCADOPAGO_ACCESS_TOKEN` | Token de MercadoPago |
| `MERCADOPAGO_PUBLIC_KEY` | Clave pública de MercadoPago |
| `WOMPI_PUBLIC_KEY` | Clave pública de Wompi |
| `WOMPI_PRIVATE_KEY` | Clave privada de Wompi |
| `WOMPI_EVENTS_SECRET` | Secret para validar webhooks |
| `WOMPI_INTEGRITY_SECRET` | Secret para firma de integridad |

### IA (Opcional)

| Variable | Descripción |
|----------|-------------|
| `GEMINI_API_KEY` | API key de Google Gemini |
| `GROQ_API_KEY` | API key de Groq |

### Supabase (Opcional)

| Variable | Descripción |
|----------|-------------|
| `SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_ANON_KEY` | Clave anon de Supabase |

### Cache (Opcional — producción)

| Variable | Descripción |
|----------|-------------|
| `UPSTASH_REDIS_REST_URL` | URL REST de Upstash Redis |
| `UPSTASH_REDIS_REST_TOKEN` | Token de Upstash Redis |

---

## 🚀 Inicio Rápido

### Prerrequisitos

- **Node.js** ≥ 18
- **npm** ≥ 9
- **PostgreSQL 16** (local con Docker o Supabase)
- **Git**

### 1. Clonar e instalar

```bash
git clone https://github.com/Koff1ng/clivaro.git
cd clivaro
npm install
```

### 2. Configurar base de datos

**Opción A: Docker (recomendado para desarrollo)**

```bash
docker-compose up -d              # Levanta PostgreSQL 16 en puerto 5432
```

Configura `.env`:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ferreteria"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/ferreteria"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="tu-secret-aqui"
```

**Opción B: Supabase (producción)**

Usa las URLs de tu proyecto Supabase (pool en puerto 6543, directa en 5432).

### 3. Inicializar base de datos

```bash
npx prisma generate             # Genera el Prisma Client
npx prisma db push               # Aplica el schema a la BD
npm run db:seed                   # Datos iniciales (admin, permisos)
```

### 4. Iniciar el servidor

```bash
npm run dev                       # http://localhost:3000
```

### 5. Credenciales por defecto

| Tipo | Usuario | Contraseña |
|------|---------|------------|
| **Super Admin** | `admin@local` | `Admin123!` |
| **Tenant Admin** | `admin` (con slug del tenant) | `Admin123!` |

---

## 📜 Scripts Disponibles

### Desarrollo

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Inicia servidor de desarrollo (Next.js) |
| `npm run build` | Compila para producción (`prisma generate && next build`) |
| `npm start` | Inicia servidor de producción |
| `npm run lint` | Ejecuta ESLint |

### Base de Datos

| Comando | Descripción |
|---------|-------------|
| `npm run db:generate` | Regenera Prisma Client |
| `npm run db:migrate` | Ejecuta migraciones Prisma |
| `npm run db:seed` | Inserta datos iniciales |
| `npm run db:seed-demo` | Inserta datos demo (productos, facturas) |
| `npm run db:studio` | Abre Prisma Studio (GUI para explorar BD) |
| `npm run db:sync-plans` | Sincroniza planes SaaS en la BD |
| `npm run db:sync-tenants` | Sincroniza schema de un tenant |
| `npm run db:sync-all-tenants` | Sincroniza TODOS los schemas |
| `npm run db:migrate-tenants` | Aplica migraciones a todos los tenants |

### Deploy

| Comando | Descripción |
|---------|-------------|
| `npm run deploy:production` | Script completo de deploy a producción |
| `npm run deploy:production:db` | Solo migración de BD (`prisma generate && db push`) |
| `npm run deploy:production:git` | Solo push a Git |
| `npm run deploy:supabase` | Push schema a Supabase |

### Testing

| Comando | Descripción |
|---------|-------------|
| `npm test` | Tests unitarios (Vitest) |
| `npm run test:e2e` | Tests E2E (Playwright) |
| `npm run test:e2e:ui` | Tests E2E con interfaz visual |

### Utilidades

| Comando | Descripción |
|---------|-------------|
| `npm run setup` | Setup inicial automatizado (PowerShell) |
| `npm run check-db` | Verificar conexión a base de datos |
| `npm run assets:webp` | Convertir imágenes públicas a WebP |
| `npm run generate:tenant-sql` | Generar SQL de creación de tenant |

---

## 💰 Planes SaaS

| Feature | Starter | Business | Enterprise |
|---------|---------|----------|------------|
| **Precio** | Básico | Intermedio | Premium |
| **Usuarios max** | 3 | 8 | Ilimitados |
| **Bodegas max** | 1 | 3 | Ilimitadas |
| **Facturas/mes** | 50 | Ilimitadas | Ilimitadas |
| Productos e Inventario | ✅ | ✅ | ✅ |
| POS | ✅ | ✅ | ✅ |
| Cotizaciones | ✅ | ✅ | ✅ |
| Caja | ✅ | ✅ | ✅ |
| Reportes Básicos | ✅ | ✅ | ✅ |
| CRM (Leads) | ❌ | ✅ | ✅ |
| Marketing | ❌ | ✅ | ✅ |
| Multi-bodega | ❌ | ✅ | ✅ |
| Compras | ❌ | ✅ | ✅ |
| Reportes Avanzados | ❌ | ✅ | ✅ |
| Contabilidad | ❌ | ❌ | ✅ |
| Nómina | ❌ | ❌ | ✅ |
| Restaurante | ❌ | ❌ | ✅ |
| Reportes Custom | ❌ | ❌ | ✅ |
| Soporte Dedicado | ❌ | ❌ | ✅ |

La validación de features se hace en `lib/plan-middleware.ts` y `lib/plan-features.ts`.

---

## 🚢 Despliegue

### Stack de Producción

| Componente | Servicio |
|------------|----------|
| **App** | Vercel (serverless, edge) |
| **Base de datos** | Supabase (PostgreSQL 16 + PgBouncer) |
| **Cache** | Upstash Redis (opcional pero recomendado) |
| **Email** | SMTP propio o Resend |
| **Archivos** | Supabase Storage |

### Notas de Deploy

1. **PgBouncer**: En producción, `DATABASE_URL` apunta al pool de PgBouncer (puerto 6543) con `pgbouncer=true`. Esto es **obligatorio** para evitar errores `42P05` (prepared statements) en Vercel serverless.
2. **DIRECT_URL**: Apunta a la conexión directa (puerto 5432). Solo se usa para `prisma migrate` y DDL operations.
3. **Puppeteer**: La generación de PDFs usa `@sparticuz/chromium` en Vercel (headless Chrome serverless-compatible).
4. **Cron Jobs**: Definidos en `vercel.json`:
   - `/api/cron/backup` → 3:00 AM diario
   - `/api/cron/billing-check` → 6:00 AM diario

---

## 👨‍💻 Guía para Desarrolladores

### Cómo proteger una nueva API Route

```typescript
// app/api/mi-modulo/route.ts
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantRead, withTenantTx } from '@/lib/tenancy'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic' // ← OBLIGATORIO en todas las API routes

// GET (lectura — sin transacción)
export async function GET(req: Request) {
  const session = await requirePermission(req, PERMISSIONS.MANAGE_PRODUCTS)
  if (session instanceof NextResponse) return session // 401/403

  const tenantId = session.user.tenantId
  const data = await withTenantRead(tenantId, async (prisma) => {
    return prisma.product.findMany()
  })

  return NextResponse.json(data)
}

// POST (escritura — con transacción)
export async function POST(req: Request) {
  const session = await requirePermission(req, PERMISSIONS.MANAGE_PRODUCTS)
  if (session instanceof NextResponse) return session

  const tenantId = session.user.tenantId
  const body = await req.json()

  const result = await withTenantTx(tenantId, async (tx) => {
    // Todo aquí es atómico
    const product = await tx.product.create({ data: body })
    await tx.stockLevel.create({ ... })
    return product
  })

  return NextResponse.json(result, { status: 201 })
}
```

### Reglas de Oro

1. **Siempre usa `withTenantTx` para writes** — Garantiza atomicidad y aislamiento de tenant.
2. **Siempre usa `withTenantRead` para reads** — Más eficiente que una transacción.
3. **Nunca accedas a `prisma` directamente** desde un API route de tenant — Eso lee del schema `public`.
4. **Siempre agrega `export const dynamic = 'force-dynamic'`** en cada API route — Next.js 14 puede cachear rutas estáticamente sin esto.
5. **Usa `logger` en vez de `console.log`** — El logger centralizado suprime stack traces en producción.
6. **Los permisos viven en el JWT** — No hagas queries a BD para verificar permisos; usa `session.user.permissions`.

### Cómo agregar una nueva tabla al schema del tenant

1. Agrega el modelo a `prisma/schema.prisma`
2. Ejecuta `npx prisma generate`
3. Agrega los statements `CREATE TABLE` correspondientes a `lib/tenant-sql-statements.ts`
4. Ejecuta `npm run db:sync-all-tenants` para aplicar a todos los tenants existentes

### Cómo crear un asiento contable automático

```typescript
// lib/accounting/mi-modulo-integration.ts
import { createJournalEntry } from './journal-service'

export async function crearAsientoPorMiModulo(tenantId: string, data: any, txPrisma: any) {
  await createJournalEntry(txPrisma, {
    description: 'Mi asiento automático',
    lines: [
      { accountId: 'cuenta-debito-id', debit: 1000, credit: 0 },
      { accountId: 'cuenta-credito-id', debit: 0, credit: 1000 },
    ]
  })
  // ⚠️ Σ Débitos DEBE ser = Σ Créditos
}
```

---

## 🧪 Testing

### Tests Unitarios (Vitest)

```bash
npm test                          # Ejecutar todos los tests
npm test -- --watch               # Modo watch
npm test -- --coverage            # Con cobertura
```

Configuración en `vitest.config.ts`.

### Tests E2E (Playwright)

```bash
npm run test:e2e                  # Headless
npm run test:e2e:ui               # Con interfaz visual
```

Configuración en `playwright.config.ts`.

---

## 🔒 Seguridad

| Medida | Implementación |
|--------|---------------|
| **Autenticación** | NextAuth.js con JWT firmados (HMAC SHA-256) |
| **Hashing** | bcryptjs con salt de 10 rondas |
| **Aislamiento de datos** | Schema-per-tenant en PostgreSQL |
| **RBAC** | Permisos verificados en cada request vía `requirePermission` |
| **Rate Limiting** | Por tenant + usuario + IP (Upstash Redis o in-memory) |
| **Headers de seguridad** | `X-Frame-Options: SAMEORIGIN`, DNS prefetch |
| **Logging seguro** | Sin stack traces en producción (`logger.ts`) |
| **Request tracing** | `x-request-id` en cada request API (`middleware.ts`) |
| **CORS** | Configurado por Next.js (mismo origen) |
| **SSL** | Forzado en conexiones a BD remota |
| **Compliance legal** | Ley 1581 (datos personales Colombia), campos de consentimiento |

### Variables sensibles

**NUNCA** commits el archivo `.env` al repositorio. Está incluido en `.gitignore`. Todas las variables sensibles deben configurarse en la plataforma de deploy (Vercel Environment Variables).

---

## 📝 Licencia

MIT

---

> **Clivaro** — Construido con ❤️ para negocios colombianos.
]]>
