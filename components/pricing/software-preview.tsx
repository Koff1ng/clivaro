'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  LayoutDashboard,
  Package,
  Warehouse,
  Users,
  FileText,
  ShoppingCart,
  Wallet,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  BarChart3,
  PieChart,
  Building2,
  ShoppingBag,
  PackageCheck,
  Target,
  Mail,
  UserCog,
  FileCheck,
  Receipt,
  Search,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Eye
} from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { cn } from '@/lib/utils'

type Section =
  | 'dashboard'
  | 'products'
  | 'inventory'
  | 'customers'
  | 'quotes'
  | 'invoices'
  | 'pos'
  | 'cash'
  | 'suppliers'
  | 'purchases'
  | 'receipts'
  | 'leads'
  | 'campaigns'
  | 'users'

const menuItems = [
  { id: 'dashboard' as Section, label: 'Dashboard', icon: LayoutDashboard },
  { id: 'products' as Section, label: 'Productos', icon: Package },
  { id: 'inventory' as Section, label: 'Inventario', icon: Warehouse },
  { id: 'customers' as Section, label: 'Clientes', icon: Users },
  { id: 'leads' as Section, label: 'Oportunidades', icon: Target },
  { id: 'campaigns' as Section, label: 'Campañas', icon: Mail },
  { id: 'quotes' as Section, label: 'Cotizaciones', icon: FileCheck },
  { id: 'invoices' as Section, label: 'Facturas', icon: Receipt },
  { id: 'suppliers' as Section, label: 'Proveedores', icon: Building2 },
  { id: 'purchases' as Section, label: 'Órdenes Compra', icon: ShoppingBag },
  { id: 'receipts' as Section, label: 'Recepciones', icon: PackageCheck },
  { id: 'pos' as Section, label: 'Punto de Venta', icon: ShoppingCart },
  { id: 'cash' as Section, label: 'Caja', icon: Wallet },
  { id: 'users' as Section, label: 'Usuarios', icon: UserCog },
]

export function SoftwarePreview() {
  const [activeSection, setActiveSection] = useState<Section>('dashboard')

  const getSectionUrl = (section: Section) => {
    const urls: Record<Section, string> = {
      dashboard: 'clivaro.app/dashboard',
      products: 'clivaro.app/products',
      inventory: 'clivaro.app/inventory',
      customers: 'clivaro.app/crm/customers',
      quotes: 'clivaro.app/sales/quotes',
      invoices: 'clivaro.app/sales/invoices',
      pos: 'clivaro.app/pos',
      cash: 'clivaro.app/cash/shifts',
      suppliers: 'clivaro.app/purchases/suppliers',
      purchases: 'clivaro.app/purchases/orders',
      receipts: 'clivaro.app/purchases/receipts',
      leads: 'clivaro.app/crm/leads',
      campaigns: 'clivaro.app/marketing/campaigns',
      users: 'clivaro.app/admin/users',
    }
    return urls[section]
  }

  return (
    <div className="relative bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 py-16">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Vista Previa del Software</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Explora todas las funcionalidades de Clivaro. Haz clic en cualquier sección del menú para verla en acción.
          </p>
        </div>

        {/* Preview Container */}
        <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700">
          {/* Browser Bar */}
          <div className="bg-gray-100 dark:bg-gray-900 px-4 py-2 flex items-center gap-2 border-b border-gray-200 dark:border-gray-700">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
            </div>
            <div className="flex-1 bg-white dark:bg-gray-800 rounded px-3 py-1 text-xs text-gray-500 dark:text-gray-400 text-center">
              {getSectionUrl(activeSection)}
            </div>
          </div>

          <div className="flex h-[700px]">
            {/* Sidebar */}
            <div className="w-64 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col">
              {/* Logo */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <Logo size="md" showByline={false} />
              </div>

              {/* Navigation */}
              <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                {menuItems.map((item) => {
                  const Icon = item.icon
                  const isActive = activeSection === item.id
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveSection(item.id)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                        isActive
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 shadow-sm'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{item.label}</span>
                    </button>
                  )
                })}
              </nav>

              {/* User Info */}
              <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white text-sm font-semibold">
                    A
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Administrator</span>
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 bg-white dark:bg-gray-800 p-6 overflow-y-auto">
              {activeSection === 'dashboard' && <DashboardPreview />}
              {activeSection === 'products' && <ProductsPreview />}
              {activeSection === 'inventory' && <InventoryPreview />}
              {activeSection === 'customers' && <CustomersPreview />}
              {activeSection === 'quotes' && <QuotesPreview />}
              {activeSection === 'invoices' && <InvoicesPreview />}
              {activeSection === 'pos' && <POSPreview />}
              {activeSection === 'cash' && <CashPreview />}
              {activeSection === 'suppliers' && <SuppliersPreview />}
              {activeSection === 'purchases' && <PurchasesPreview />}
              {activeSection === 'receipts' && <ReceiptsPreview />}
              {activeSection === 'leads' && <LeadsPreview />}
              {activeSection === 'campaigns' && <CampaignsPreview />}
              {activeSection === 'users' && <UsersPreview />}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Preview Components
function DashboardPreview() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400">Resumen general del negocio</p>
      </div>
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ventas Hoy</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$ 190.400</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ventas del Mes</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$ 823.480</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Productos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">10</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stock Bajo</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2</div>
          </CardContent>
        </Card>
      </div>
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Ventas por Día del Mes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-end justify-between gap-1">
              {[0, 0, 0, 0, 0, 0, 0, 95, 0, 0, 0, 45, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0].map((value, index) => (
                <div
                  key={index}
                  className="flex-1 bg-blue-600 rounded-t transition-all duration-500 hover:bg-blue-700"
                  style={{ height: `${value}%`, minHeight: value > 0 ? '4px' : '2px' }}
                />
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Ventas por Método de Pago</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center">
              <div className="relative w-48 h-48">
                <svg viewBox="0 0 100 100" className="transform -rotate-90">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#3b82f6" strokeWidth="20" strokeDasharray={`${73 * 2.513} 251.3`} />
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#f59e0b" strokeWidth="20" strokeDasharray={`${21 * 2.513} 251.3`} strokeDashoffset={`-${73 * 2.513}`} />
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#10b981" strokeWidth="20" strokeDasharray={`${6 * 2.513} 251.3`} strokeDashoffset={`-${94 * 2.513}`} />
                </svg>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-blue-600"></div>
                  <span className="text-sm">Efectivo: 73%</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-amber-500"></div>
                  <span className="text-sm">Transferencia: 21%</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-green-500"></div>
                  <span className="text-sm">Tarjeta: 6%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function ProductsPreview() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Productos</h1>
          <p className="text-gray-600 dark:text-gray-400">Gestiona tu catálogo de productos</p>
        </div>
        <Button className="bg-gradient-to-r from-blue-600 to-indigo-600">
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Producto
        </Button>
      </div>
      <div className="flex gap-4">
        <div className="flex-1">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar productos..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg"
            />
          </div>
        </div>
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Nombre</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">SKU</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Precio</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Stock</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5].map((i) => (
                  <tr key={i} className="border-b hover:bg-gray-50 dark:hover:bg-gray-900">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
                        <div>
                          <div className="font-medium">Producto {i}</div>
                          <div className="text-sm text-gray-500">Categoría {i}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">SKU-{i}000</td>
                    <td className="px-4 py-3 font-semibold">$ {(i * 50000).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <Badge variant={i === 1 ? 'destructive' : 'default'}>
                        {i * 25} unidades
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function InventoryPreview() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Inventario</h1>
        <p className="text-gray-600 dark:text-gray-400">Control total de tu stock</p>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Stock Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">125 unidades</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Productos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">10</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Stock Bajo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">2</div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Productos en Stock</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  <div>
                    <div className="font-medium">Producto {i}</div>
                    <div className="text-sm text-gray-500">SKU-{i}000</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{i * 25} unidades</div>
                  <div className={`text-sm ${i === 1 ? 'text-red-600' : 'text-green-600'}`}>
                    {i === 1 ? 'Stock Bajo' : 'En Stock'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function CustomersPreview() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Clientes</h1>
          <p className="text-gray-600 dark:text-gray-400">Gestiona tu base de clientes</p>
        </div>
        <Button className="bg-gradient-to-r from-blue-600 to-indigo-600">
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Cliente
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Cliente</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Email</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Teléfono</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Compras</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {['Juan Pérez', 'María García', 'Carlos López'].map((name, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50 dark:hover:bg-gray-900">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white">
                          {name[0]}
                        </div>
                        <div className="font-medium">{name}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">{name.toLowerCase().replace(' ', '.')}@email.com</td>
                    <td className="px-4 py-3 text-sm">+57 300 {i}00 000{i}</td>
                    <td className="px-4 py-3">
                      <Badge>{i + 3} compras</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function QuotesPreview() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cotizaciones</h1>
          <p className="text-gray-600 dark:text-gray-400">Gestiona tus cotizaciones</p>
        </div>
        <Button className="bg-gradient-to-r from-blue-600 to-indigo-600">
          <Plus className="h-4 w-4 mr-2" />
          Nueva Cotización
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Número</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Cliente</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Total</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Estado</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3].map((i) => (
                  <tr key={i} className="border-b hover:bg-gray-50 dark:hover:bg-gray-900">
                    <td className="px-4 py-3 font-medium">QT-00000{i}</td>
                    <td className="px-4 py-3">Cliente {i}</td>
                    <td className="px-4 py-3 font-semibold">$ {(i * 150000).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <Badge variant={i === 1 ? 'default' : 'secondary'}>
                        {i === 1 ? 'Enviada' : 'Pendiente'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function InvoicesPreview() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Facturas</h1>
          <p className="text-gray-600 dark:text-gray-400">Gestiona tus facturas</p>
        </div>
        <Button className="bg-gradient-to-r from-blue-600 to-indigo-600">
          <Plus className="h-4 w-4 mr-2" />
          Nueva Factura
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Número</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Cliente</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Total</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Estado</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3].map((i) => (
                  <tr key={i} className="border-b hover:bg-gray-50 dark:hover:bg-gray-900">
                    <td className="px-4 py-3 font-medium">INV-00000{i}</td>
                    <td className="px-4 py-3">Cliente {i}</td>
                    <td className="px-4 py-3 font-semibold">$ {(i * 200000).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <Badge variant="default" className="bg-green-600">
                        Pagada
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function POSPreview() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Punto de Venta</h1>
        <p className="text-gray-600 dark:text-gray-400">Ventas rápidas y eficientes</p>
      </div>
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-4">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar productos..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg"
            />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Productos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="p-4 border rounded-lg hover:border-blue-500 transition-colors cursor-pointer">
                    <div className="w-full h-24 bg-gray-100 dark:bg-gray-700 rounded mb-2"></div>
                    <div className="text-sm font-medium">Producto {i}</div>
                    <div className="text-xs text-gray-500">$ {(i * 10000).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Carrito</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-900 rounded">
                  <span className="text-sm">Producto 1 x2</span>
                  <span className="font-semibold">$ 20.000</span>
                </div>
                <div className="border-t pt-3">
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span>$ 20.000</span>
                  </div>
                </div>
                <Button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600">
                  Procesar Venta
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function CashPreview() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Caja</h1>
        <p className="text-gray-600 dark:text-gray-400">Gestión de turnos y movimientos de caja</p>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Efectivo en Caja</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$ 500.000</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Ventas del Día</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$ 190.400</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Estado</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className="bg-green-600">Turno Abierto</Badge>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Movimientos Recientes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex justify-between items-center p-3 border rounded-lg">
                <div>
                  <div className="font-medium">Venta #{i}</div>
                  <div className="text-sm text-gray-500">Hace {i} horas</div>
                </div>
                <div className="font-semibold text-green-600">+$ {(i * 50000).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function SuppliersPreview() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Proveedores</h1>
          <p className="text-gray-600 dark:text-gray-400">Gestiona tus proveedores</p>
        </div>
        <Button className="bg-gradient-to-r from-blue-600 to-indigo-600">
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Proveedor
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Proveedor</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Contacto</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Órdenes</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3].map((i) => (
                  <tr key={i} className="border-b hover:bg-gray-50 dark:hover:bg-gray-900">
                    <td className="px-4 py-3 font-medium">Proveedor {i}</td>
                    <td className="px-4 py-3 text-sm">contacto{i}@proveedor.com</td>
                    <td className="px-4 py-3">
                      <Badge>{i + 2} órdenes</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function PurchasesPreview() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Órdenes de Compra</h1>
          <p className="text-gray-600 dark:text-gray-400">Gestiona tus órdenes de compra</p>
        </div>
        <Button className="bg-gradient-to-r from-blue-600 to-indigo-600">
          <Plus className="h-4 w-4 mr-2" />
          Nueva Orden
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Número</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Proveedor</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Total</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Estado</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3].map((i) => (
                  <tr key={i} className="border-b hover:bg-gray-50 dark:hover:bg-gray-900">
                    <td className="px-4 py-3 font-medium">OC-00000{i}</td>
                    <td className="px-4 py-3">Proveedor {i}</td>
                    <td className="px-4 py-3 font-semibold">$ {(i * 300000).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <Badge variant={i === 1 ? 'default' : 'secondary'}>
                        {i === 1 ? 'Recibida' : 'Pendiente'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ReceiptsPreview() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Recepciones</h1>
          <p className="text-gray-600 dark:text-gray-400">Gestiona las recepciones de mercancía</p>
        </div>
        <Button className="bg-gradient-to-r from-blue-600 to-indigo-600">
          <Plus className="h-4 w-4 mr-2" />
          Nueva Recepción
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Número</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Orden</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Fecha</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3].map((i) => (
                  <tr key={i} className="border-b hover:bg-gray-50 dark:hover:bg-gray-900">
                    <td className="px-4 py-3 font-medium">REC-00000{i}</td>
                    <td className="px-4 py-3">OC-00000{i}</td>
                    <td className="px-4 py-3 text-sm">01/0{i}/2026</td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function LeadsPreview() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Oportunidades</h1>
          <p className="text-gray-600 dark:text-gray-400">Gestiona tus oportunidades de venta</p>
        </div>
        <Button className="bg-gradient-to-r from-blue-600 to-indigo-600">
          <Plus className="h-4 w-4 mr-2" />
          Nueva Oportunidad
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Oportunidad</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Cliente</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Valor</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Estado</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3].map((i) => (
                  <tr key={i} className="border-b hover:bg-gray-50 dark:hover:bg-gray-900">
                    <td className="px-4 py-3 font-medium">Oportunidad {i}</td>
                    <td className="px-4 py-3">Cliente {i}</td>
                    <td className="px-4 py-3 font-semibold">$ {(i * 250000).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <Badge variant={i === 1 ? 'default' : 'secondary'}>
                        {i === 1 ? 'Calificada' : 'Nueva'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function CampaignsPreview() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Campañas</h1>
          <p className="text-gray-600 dark:text-gray-400">Gestiona tus campañas de marketing</p>
        </div>
        <Button className="bg-gradient-to-r from-blue-600 to-indigo-600">
          <Plus className="h-4 w-4 mr-2" />
          Nueva Campaña
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="cursor-pointer hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="h-32 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg mb-4 flex items-center justify-center text-white font-bold">
                Campaña {i}
              </div>
              <div className="font-semibold mb-2">Campaña Promocional {i}</div>
              <div className="text-sm text-gray-500 mb-4">Enviada a {i * 50} clientes</div>
              <Badge variant="default">Activa</Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function UsersPreview() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Usuarios</h1>
          <p className="text-gray-600 dark:text-gray-400">Gestiona los usuarios del sistema</p>
        </div>
        <Button className="bg-gradient-to-r from-blue-600 to-indigo-600">
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Usuario
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Usuario</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Rol</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Estado</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {['Administrator', 'Vendedor', 'Cajero'].map((role, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50 dark:hover:bg-gray-900">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white">
                          {role[0]}
                        </div>
                        <div>
                          <div className="font-medium">Usuario {i + 1}</div>
                          <div className="text-sm text-gray-500">usuario{i + 1}@clivaro.com</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge>{role}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="default" className="bg-green-600">Activo</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
