'use client'

import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { AccountSelect } from '@/components/accounting/account-select'
import { Settings, CheckCircle, AlertCircle, Save, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/toast'

type ConfigData = {
    cashAccountId?: string
    bankAccountId?: string
    accountsReceivableId?: string
    accountsPayableId?: string
    inventoryAccountId?: string
    salesRevenueId?: string
    vatGeneratedId?: string
    vatDeductibleId?: string
    costOfSalesId?: string
}

export default function AccountingConfigPage() {
    const { toast } = useToast()
    const [accounts, setAccounts] = useState<any[]>([])
    const [config, setConfig] = useState<ConfigData>({})
    const [validation, setValidation] = useState<{ isValid: boolean; missingAccounts: string[] }>({
        isValid: false,
        missingAccounts: []
    })
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        setLoading(true)
        try {
            // Load accounts
            const accountsRes = await fetch('/api/accounting/accounts')
            if (!accountsRes.ok) throw new Error('Failed to load accounts')
            const accountsData = await accountsRes.json()
            setAccounts(flattenAccounts(accountsData))

            // Load config
            const configRes = await fetch('/api/accounting/config')
            if (!configRes.ok) throw new Error('Failed to load config')
            const configData = await configRes.json()

            setConfig(configData.config || {})
            setValidation(configData.validation)
        } catch (error) {
            console.error('Error loading data:', error)
            toast('Error al cargar configuración', 'error')
        } finally {
            setLoading(false)
        }
    }

    function flattenAccounts(tree: any[]): any[] {
        const flat: any[] = []
        function traverse(nodes: any[]) {
            nodes.forEach((node: any) => {
                flat.push(node)
                if (node.children) traverse(node.children)
            })
        }
        traverse(tree)
        return flat
    }

    async function handleSave() {
        setSaving(true)
        try {
            const res = await fetch('/api/accounting/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            })

            if (!res.ok) throw new Error('Failed to save config')

            const data = await res.json()
            setValidation(data.validation)

            toast('Configuración guardada correctamente', 'success')
        } catch (error) {
            console.error('Error saving config:', error)
            toast('Error al guardar configuración', 'error')
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
        )
    }

    return (
        <div className="container mx-auto px-4 py-6">
            <PageHeader
                title="Configuración Contable"
                description="Configure las cuentas por defecto para asientos automáticos"
                icon={<Settings className="h-6 w-6" />}
            />

            {/* Validation Status */}
            <div
                className={`rounded-lg p-4 mb-6 flex items-start gap-3 ${validation.isValid
                        ? 'bg-green-50 border border-green-200'
                        : 'bg-yellow-50 border border-yellow-200'
                    }`}
            >
                {validation.isValid ? (
                    <>
                        <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                        <div>
                            <p className="font-semibold text-green-900">Configuración Completa</p>
                            <p className="text-sm text-green-700">
                                Los asientos contables se generarán automáticamente desde facturas y pagos
                            </p>
                        </div>
                    </>
                ) : (
                    <>
                        <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                        <div>
                            <p className="font-semibold text-yellow-900">Configuración Incompleta</p>
                            <p className="text-sm text-yellow-700">
                                Faltan las siguientes cuentas: {validation.missingAccounts.join(', ')}
                            </p>
                        </div>
                    </>
                )}
            </div>

            {/* Configuration Form */}
            <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-6">Cuentas Contables</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Balance Accounts */}
                    <div>
                        <h4 className="font-medium text-gray-700 mb-4">Cuentas de Balance</h4>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Caja <span className="text-red-500">*</span>
                                </label>
                                <AccountSelect
                                    value={config.cashAccountId || ''}
                                    onChange={(val) => setConfig({ ...config, cashAccountId: val })}
                                    accounts={accounts}
                                    placeholder="Ej: 110505 - Caja General"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">Bancos</label>
                                <AccountSelect
                                    value={config.bankAccountId || ''}
                                    onChange={(val) => setConfig({ ...config, bankAccountId: val })}
                                    accounts={accounts}
                                    placeholder="Ej: 1110 - Bancos"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Clientes (Cuentas por Cobrar) <span className="text-red-500">*</span>
                                </label>
                                <AccountSelect
                                    value={config.accountsReceivableId || ''}
                                    onChange={(val) => setConfig({ ...config, accountsReceivableId: val })}
                                    accounts={accounts}
                                    placeholder="Ej: 1305 - Clientes"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">Proveedores (Cuentas por Pagar)</label>
                                <AccountSelect
                                    value={config.accountsPayableId || ''}
                                    onChange={(val) => setConfig({ ...config, accountsPayableId: val })}
                                    accounts={accounts}
                                    placeholder="Ej: 2205 - Proveedores"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Inventarios <span className="text-red-500">*</span>
                                </label>
                                <AccountSelect
                                    value={config.inventoryAccountId || ''}
                                    onChange={(val) => setConfig({ ...config, inventoryAccountId: val })}
                                    accounts={accounts}
                                    placeholder="Ej: 1435 - Mercancías"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Income, Tax, and Cost Accounts */}
                    <div>
                        <h4 className="font-medium text-gray-700 mb-4">Ingresos, IVA y Costos</h4>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Ingresos por Ventas <span className="text-red-500">*</span>
                                </label>
                                <AccountSelect
                                    value={config.salesRevenueId || ''}
                                    onChange={(val) => setConfig({ ...config, salesRevenueId: val })}
                                    accounts={accounts}
                                    placeholder="Ej: 4135 - Comercio al por mayor y menor"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    IVA Generado <span className="text-red-500">*</span>
                                </label>
                                <AccountSelect
                                    value={config.vatGeneratedId || ''}
                                    onChange={(val) => setConfig({ ...config, vatGeneratedId: val })}
                                    accounts={accounts}
                                    placeholder="Ej: 2408 - IVA por Pagar"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">IVA Descontable</label>
                                <AccountSelect
                                    value={config.vatDeductibleId || ''}
                                    onChange={(val) => setConfig({ ...config, vatDeductibleId: val })}
                                    accounts={accounts}
                                    placeholder="Ej: 240805 - IVA Descontable"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Costo de Ventas <span className="text-red-500">*</span>
                                </label>
                                <AccountSelect
                                    value={config.costOfSalesId || ''}
                                    onChange={(val) => setConfig({ ...config, costOfSalesId: val })}
                                    accounts={accounts}
                                    placeholder="Ej: 6135 - Comercio al por mayor y menor"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Save Button */}
                <div className="mt-8 pt-6 border-t flex justify-between items-center">
                    <p className="text-sm text-gray-600">
                        <span className="text-red-500">*</span> Campos obligatorios para automatización completa
                    </p>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Guardando...
                            </>
                        ) : (
                            <>
                                <Save className="mr-2 h-4 w-4" />
                                Guardar Configuración
                            </>
                        )}
                    </Button>
                </div>
            </div>

            {/* Info Box */}
            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">¿Cómo funciona la automatización?</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Cuando creas una factura, se genera automáticamente el comprobante de ventas</li>
                    <li>• Cuando registras un pago, se crea el comprobante de recaudo</li>
                    <li>• El costo de ventas se registra automáticamente según el costo de inventario</li>
                    <li>• Todos los asientos usan las cuentas configuradas aquí</li>
                </ul>
            </div>
        </div>
    )
}
