
import {
    LayoutDashboard,
    BarChart3,
    Users,
    Target,
    Megaphone,
    ShoppingCart,
    Banknote,
    FileText,
    MessageCircle,
    Inbox,
    ClipboardList,
    Receipt,
    FileMinus,
    ShieldCheck,
    UtensilsCrossed,
    Package,
    Boxes,
    Store,
    ShoppingBag,
    Truck,
    BookOpen,
    FileDigit,
    PieChart,
    FileSpreadsheet,
    Scale,
    Puzzle,
    UserCircle,
    Coins,
    Settings2,
} from 'lucide-react'

export type MenuItem = {
    href: string
    label: string
    icon: any
    permission?: string | string[]
    planFeature?: string
}

export type MenuGroup = {
    title: string
    key: string
    items: MenuItem[]
}

export const menuGroups: MenuGroup[] = [
    {
        title: 'General',
        key: 'general',
        items: [
            { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: ['view_reports', 'manage_sales'], planFeature: 'viewReports' },
            { href: '/dashboard/reports', label: 'Reportes', icon: BarChart3, permission: 'view_reports', planFeature: 'viewReports' },
        ]
    },
    {
        title: 'Marketing',
        key: 'marketing',
        items: [
            { href: '/marketing/leads', label: 'Oportunidades', icon: Target, permission: 'manage_crm', planFeature: 'marketing' },
            { href: '/marketing/campaigns', label: 'Campañas', icon: Megaphone, permission: 'manage_crm', planFeature: 'marketing' },
            { href: '/marketing/meta-ads', label: 'Meta Ads', icon: Megaphone, permission: 'manage_crm', planFeature: 'marketing' },
            { href: '/marketing/inbox', label: 'Inbox', icon: Inbox, permission: 'manage_crm', planFeature: 'marketing' },
        ]
    },
    {
        title: 'POS',
        key: 'pos',
        items: [
            { href: '/pos', label: 'Punto de Venta', icon: ShoppingCart, permission: 'manage_sales', planFeature: 'pos' },
            { href: '/crm/customers', label: 'Clientes', icon: Users, permission: ['manage_crm', 'manage_sales'], planFeature: 'manageSales' },
            { href: '/cash/shifts', label: 'Caja', icon: Banknote, permission: ['manage_cash', 'manage_sales'], planFeature: 'manageCash' },
            { href: '/sales/quotes', label: 'Cotizaciones', icon: FileText, permission: 'manage_sales', planFeature: 'quotations' },
            { href: '/sales/orders', label: 'Órdenes', icon: ClipboardList, permission: 'manage_sales', planFeature: 'manageSales' },
            { href: '/sales/invoices', label: 'Facturas', icon: Receipt, permission: 'manage_sales', planFeature: 'invoices' },
            { href: '/credit-notes', label: 'Notas Crédito', icon: FileMinus, permission: 'manage_sales', planFeature: 'invoices' },
            { href: '/pos/commander', label: 'Comandero', icon: UtensilsCrossed, permission: 'manage_sales' },
        ]
    },
    {
        title: 'Inventario',
        key: 'inventory',
        items: [
            { href: '/products', label: 'Items', icon: Package, permission: 'manage_products', planFeature: 'manageProducts' },
            { href: '/inventory', label: 'Inventario', icon: Boxes, permission: 'manage_inventory', planFeature: 'manageInventory' },
            { href: '/purchases/suppliers', label: 'Proveedores', icon: Store, permission: 'manage_purchases', planFeature: 'managePurchases' },
            { href: '/purchases/orders', label: 'Órdenes Compra', icon: ShoppingBag, permission: 'manage_purchases', planFeature: 'managePurchases' },
            { href: '/purchases/receipts', label: 'Recepciones', icon: Truck, permission: 'manage_purchases', planFeature: 'managePurchases' },
        ]
    },
    {
        title: 'Contabilidad',
        key: 'accounting',
        items: [
            { href: '/accounting/accounts', label: 'Catálogo de cuentas', icon: BookOpen, permission: 'manage_accounting', planFeature: 'manageAccounting' },
            { href: '/accounting/vouchers', label: 'Comprobante contable', icon: FileDigit, permission: 'manage_accounting', planFeature: 'manageAccounting' },
            { href: '/accounting/reports', label: 'Centro de Reportes', icon: PieChart, permission: 'manage_accounting', planFeature: 'manageAccounting' },
            { href: '/accounting/reports/exogenous', label: 'Información exógena', icon: FileSpreadsheet, permission: 'manage_accounting', planFeature: 'manageAccounting' },
            { href: '/accounting/fiscal-conciliator', label: 'Conciliador fiscal', icon: Scale, permission: 'manage_accounting', planFeature: 'manageAccounting' },
            { href: '/accounting/addons', label: 'Complementos contables', icon: Puzzle, permission: 'manage_accounting', planFeature: 'manageAccounting' },
        ]
    },
    {
        title: 'Recursos Humanos',
        key: 'hr',
        items: [
            { href: '/hr/employees', label: 'Empleados', icon: UserCircle, permission: 'manage_users', planFeature: 'managePayroll' },
            { href: '/hr/payroll', label: 'Nómina', icon: Coins, permission: 'manage_users', planFeature: 'managePayroll' },
        ]
    },
    {
        title: 'Sistema',
        key: 'system',
        items: [
            { href: '/admin/users', label: 'Usuarios', icon: Settings2, permission: 'manage_users', planFeature: 'manageUsers' },
        ]
    }
]
