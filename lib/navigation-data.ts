
import {
    NavArrowRight,
    Box,
    Archive,
    Group,
    KanbanBoard,
    Mail,
    Page,
    Cart as CartIcon,
    Bag,
    Shop,
    Wallet as WalletIcon,
    UserSquare,
    Settings as SettingsIcon,
    ShieldCheck,
    PasteClipboard,
    Truck,
    StatsUpSquare,
    Calculator,
    Cash,
} from 'iconoir-react'

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
            { href: '/dashboard', label: 'Dashboard', icon: NavArrowRight, permission: ['view_reports', 'manage_sales'], planFeature: 'viewReports' },
            { href: '/dashboard/reports', label: 'Reportes', icon: StatsUpSquare, permission: 'view_reports', planFeature: 'viewReports' },
        ]
    },
    {
        title: 'Marketing',
        key: 'marketing',
        items: [
            { href: '/crm/customers', label: 'Clientes', icon: Group, permission: ['manage_crm', 'manage_sales'], planFeature: 'manageSales' },
            { href: '/crm/leads', label: 'Oportunidades', icon: KanbanBoard, permission: 'manage_crm', planFeature: 'leads' },
            { href: '/marketing/campaigns', label: 'Campañas', icon: Mail, permission: 'manage_crm', planFeature: 'marketing' },
        ]
    },
    {
        title: 'POS',
        key: 'pos',
        items: [
            { href: '/pos', label: 'Punto de Venta', icon: CartIcon, permission: 'manage_sales', planFeature: 'pos' },
            { href: '/cash/shifts', label: 'Caja', icon: WalletIcon, permission: ['manage_cash', 'manage_sales'], planFeature: 'manageCash' },
            { href: '/sales/quotes', label: 'Cotizaciones', icon: PasteClipboard, permission: 'manage_sales', planFeature: 'quotations' },
            { href: '/sales/orders', label: 'Órdenes', icon: PasteClipboard, permission: 'manage_sales', planFeature: 'manageSales' },
            { href: '/sales/invoices', label: 'Facturas', icon: Page, permission: 'manage_sales', planFeature: 'invoices' },
            { href: '/credit-notes', label: 'Notas Crédito', icon: PasteClipboard, permission: 'manage_sales', planFeature: 'invoices' },
            { href: '/dashboard/electronic-invoicing', label: 'Fact. Electrónica', icon: ShieldCheck, permission: 'manage_sales', planFeature: 'invoices' },
        ]
    },
    {
        title: 'Inventario',
        key: 'inventory',
        items: [
            { href: '/products', label: 'Items', icon: Box, permission: 'manage_products', planFeature: 'manageProducts' },
            { href: '/inventory', label: 'Inventario', icon: Archive, permission: 'manage_inventory', planFeature: 'manageInventory' },
            { href: '/purchases/suppliers', label: 'Proveedores', icon: Shop, permission: 'manage_purchases', planFeature: 'managePurchases' },
            { href: '/purchases/orders', label: 'Órdenes Compra', icon: Bag, permission: 'manage_purchases', planFeature: 'managePurchases' },
            { href: '/purchases/receipts', label: 'Recepciones', icon: Truck, permission: 'manage_purchases', planFeature: 'managePurchases' },
        ]
    },
    {
        title: 'Contabilidad',
        key: 'accounting',
        items: [
            { href: '/accounting/accounts', label: 'Catálogo de cuentas', icon: Page, permission: 'manage_accounting', planFeature: 'manageAccounting' },
            { href: '/accounting/vouchers', label: 'Comprobante contable', icon: PasteClipboard, permission: 'manage_accounting', planFeature: 'manageAccounting' },
            { href: '/accounting/reports', label: 'Centro de Reportes', icon: StatsUpSquare, permission: 'manage_accounting', planFeature: 'manageAccounting' },
            { href: '/accounting/reports/exogenous', label: 'Información exógena', icon: ShieldCheck, permission: 'manage_accounting', planFeature: 'manageAccounting' },
            { href: '/accounting/fiscal-conciliator', label: 'Conciliador fiscal', icon: Calculator, permission: 'manage_accounting', planFeature: 'manageAccounting' },
            { href: '/accounting/addons', label: 'Complementos contables', icon: Box, permission: 'manage_accounting', planFeature: 'manageAccounting' },
        ]
    },
    {
        title: 'Recursos Humanos',
        key: 'hr',
        items: [
            { href: '/hr/employees', label: 'Empleados', icon: Group, permission: 'manage_users', planFeature: 'managePayroll' },
            { href: '/hr/payroll', label: 'Nómina', icon: WalletIcon, permission: 'manage_users', planFeature: 'managePayroll' },
        ]
    },
    {
        title: 'Sistema',
        key: 'system',
        items: [
            { href: '/admin/users', label: 'Usuarios', icon: UserSquare, permission: 'manage_users', planFeature: 'manageUsers' },
        ]
    }
]
