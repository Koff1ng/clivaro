# Ferretería - Sistema de Gestión

Sistema completo de gestión para ferretería: CRM + Ventas + Compras + Inventario + POS + Reportes.

## 🚀 Inicio Rápido

```bash
# Instalar dependencias
npm install

# Configurar base de datos (SQLite local)
npm run db:migrate
npm run db:seed

# Iniciar servidor
npm run dev
```

Accede a: **http://localhost:3000**

## 🔐 Credenciales

- **Admin**: `admin@local` / `Admin123!`
- **Cajero**: `cashier@local` / `Cashier123!`

## 📦 Stack Tecnológico

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Next.js API Routes + Prisma ORM
- **Base de Datos**: SQLite (desarrollo) / PostgreSQL (producción)
- **Autenticación**: NextAuth.js
- **Estado**: React Query
- **Validación**: Zod

## ✨ Características

- ✅ Autenticación y RBAC (5 roles, 8 permisos)
- ✅ Catálogo de productos con variantes
- ✅ Control de inventario por almacén
- ✅ CRM (clientes, leads, actividades)
- ✅ Ventas (cotizaciones → órdenes → facturas)
- ✅ Compras (proveedores, órdenes, recepciones)
- ✅ POS optimizado para ventas rápidas
- ✅ Dashboard con KPIs y reportes
- ✅ Cálculo automático de costo promedio móvil

## 📁 Estructura

```
├── app/              # Next.js App Router
│   ├── api/         # API Routes
│   ├── dashboard/   # Dashboard
│   ├── products/    # Productos
│   ├── inventory/   # Inventario
│   ├── crm/         # CRM
│   ├── sales/       # Ventas
│   ├── purchases/   # Compras
│   ├── pos/         # Punto de Venta
│   └── cash/        # Caja
├── components/       # Componentes React
├── lib/             # Utilidades
└── prisma/          # Schema y migraciones
```

## 🛠️ Scripts

```bash
npm run dev          # Desarrollo
npm run build        # Producción
npm run db:migrate   # Migraciones
npm run db:seed      # Datos iniciales
npm run db:studio    # Prisma Studio
npm test             # Tests unitarios
npm run test:e2e     # Tests E2E
```

## 🔄 Migrar a PostgreSQL

Para producción, cambia en `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Y actualiza los tipos `Float` a `Decimal @db.Decimal(10, 2)` donde corresponda.

## 📝 Notas

- Base de datos SQLite en: `prisma/dev.db`
- Variables de entorno en: `.env`
- El sistema está listo para producción con PostgreSQL

## 📄 Licencia

MIT
