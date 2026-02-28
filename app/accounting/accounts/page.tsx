'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import { Loader2, Plus, Search, Edit2, Check, X } from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'

export default function AccountsPage() {
    const { toast } = useToast()
    const [loading, setLoading] = useState(true)
    const [initLoading, setInitLoading] = useState(false)
    const [accounts, setAccounts] = useState<any[]>([])
    const [search, setSearch] = useState('')

    // Editing State
    const [isEditing, setIsEditing] = useState(false)
    const [currentAccount, setCurrentAccount] = useState<any>(null)
    const [editLoading, setEditLoading] = useState(false)

    // Creation State
    const [isCreating, setIsCreating] = useState(false)
    const [newAccount, setNewAccount] = useState({
        code: '',
        name: '',
        type: 'ASSET',
        nature: 'DEBIT',
        level: 1,
        requiresThirdParty: false,
        requiresCostCenter: false
    })
    const [createLoading, setCreateLoading] = useState(false)

    const handleEdit = (account: any) => {
        setCurrentAccount({ ...account })
        setIsEditing(true)
    }

    const handleSave = async () => {
        setEditLoading(true)
        try {
            const res = await fetch('/api/accounting/accounts', {
                method: 'PATCH',
                body: JSON.stringify(currentAccount),
                headers: { 'Content-Type': 'application/json' }
            })
            if (res.ok) {
                toast('Cuenta actualizada', 'success')
                setIsEditing(false)
                fetchAccounts()
            } else {
                toast('Error actualizando cuenta', 'error')
            }
        } catch (e) {
            toast('Error de conexión', 'error')
        } finally {
            setEditLoading(false)
        }
    }

    const handleCreate = async () => {
        if (!newAccount.code || !newAccount.name) {
            toast('Código y Nombre son obligatorios', 'error')
            return
        }
        setCreateLoading(true)
        try {
            const res = await fetch('/api/accounting/accounts', {
                method: 'POST',
                body: JSON.stringify({ action: 'create_single', data: newAccount }),
                headers: { 'Content-Type': 'application/json' }
            })
            if (res.ok) {
                toast('Cuenta creada correctamente', 'success')
                setIsCreating(false)
                setNewAccount({
                    code: '', name: '', type: 'ASSET', nature: 'DEBIT', level: 1, requiresThirdParty: false, requiresCostCenter: false
                })
                fetchAccounts()
            } else {
                const data = await res.json()
                toast(data.error || 'Error creando cuenta', 'error')
            }
        } catch (e) {
            toast('Error de conexión', 'error')
        } finally {
            setCreateLoading(false)
        }
    }

    const fetchAccounts = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/accounting/accounts')
            if (res.ok) {
                const data = await res.json()
                setAccounts(data)
            }
        } catch (error) {
            console.error(error)
            toast('Error cargando cuentas', 'error')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchAccounts()
    }, [])

    const handleInitialize = async () => {
        setInitLoading(true)
        try {
            const res = await fetch('/api/accounting/accounts', {
                method: 'POST',
                body: JSON.stringify({ action: 'initialize' }),
                headers: { 'Content-Type': 'application/json' }
            })
            if (res.ok) {
                toast('PUC Inicializado correctamente', 'success')
                fetchAccounts()
            } else {
                toast('Error inicializando PUC', 'error')
            }
        } catch (e) {
            toast('Error de conexión', 'error')
        } finally {
            setInitLoading(false)
        }
    }

    const filteredAccounts = accounts.filter(acc =>
        acc.code.includes(search) ||
        acc.name.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <MainLayout>
            <div className="space-y-6">
                <PageHeader
                    title="Catálogo de Cuentas (PUC)"
                    description="Gestiona el Plan Único de Cuentas."
                />

                {!loading && accounts.length === 0 ? (
                    <Card>
                        <CardContent className="pt-6 text-center space-y-4">
                            <p className="text-muted-foreground">No hay cuentas configuradas.</p>
                            <Button onClick={handleInitialize} disabled={initLoading}>
                                {initLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Cargar PUC Colombia (Básico)
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        <div className="flex gap-2 justify-between items-center">
                            <div className="relative flex-1 max-w-sm">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar por código o nombre..."
                                    className="pl-8"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                />
                            </div>
                            <Button onClick={() => setIsCreating(true)}>
                                <Plus className="mr-2 h-4 w-4" /> Nueva Cuenta Manual
                            </Button>
                        </div>

                        <div className="rounded-md border bg-white">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[150px]">Código</TableHead>
                                        <TableHead>Nombre</TableHead>
                                        <TableHead className="w-[100px]">Tipo</TableHead>
                                        <TableHead className="w-[80px]">Nat.</TableHead>
                                        <TableHead className="w-[80px]">Tercero</TableHead>
                                        <TableHead className="w-[80px]">C.Costo</TableHead>
                                        <TableHead className="w-[100px]">Nivel</TableHead>
                                        <TableHead className="w-[100px]">Exógena (F/C)</TableHead>
                                        <TableHead className="w-[50px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-8">Cargando...</TableCell>
                                        </TableRow>
                                    ) : filteredAccounts.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-8">No se encontraron cuentas</TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredAccounts.map(acc => (
                                            <TableRow key={acc.id} className={acc.level === 1 ? 'font-bold bg-muted/50' : acc.level === 2 ? 'font-semibold' : ''}>
                                                <TableCell>{acc.code}</TableCell>
                                                <TableCell style={{ paddingLeft: `${(acc.level - 1) * 20}px` }}>{acc.name}</TableCell>
                                                <TableCell><span className="text-xs px-2 py-1 rounded bg-slate-100">{acc.type}</span></TableCell>
                                                <TableCell className="text-xs">{acc.nature === 'DEBIT' ? 'D' : 'C'}</TableCell>
                                                <TableCell className="text-center">{acc.requiresThirdParty ? '✅' : '-'}</TableCell>
                                                <TableCell className="text-center">{acc.requiresCostCenter ? '✅' : '-'}</TableCell>
                                                <TableCell>{acc.level}</TableCell>
                                                <TableCell className="text-xs text-muted-foreground">
                                                    {acc.exogenousFormat || acc.exogenousConcept ? `${acc.exogenousFormat || '-'}/${acc.exogenousConcept || '-'}` : '-'}
                                                </TableCell>
                                                <TableCell>
                                                    <Button variant="ghost" size="sm" onClick={() => handleEdit(acc)}>
                                                        <Edit2 className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                        <div className="text-xs text-muted-foreground text-center">
                            Mostrando {filteredAccounts.length} cuentas
                        </div>
                    </div>
                )}

                <Dialog open={isEditing} onOpenChange={setIsEditing}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Editar Cuenta: {currentAccount?.code}</DialogTitle>
                        </DialogHeader>
                        {currentAccount && (
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label>Nombre de la Cuenta</Label>
                                    <Input
                                        value={currentAccount.name}
                                        onChange={e => setCurrentAccount({ ...currentAccount, name: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Naturaleza</Label>
                                    <Select
                                        value={currentAccount.nature}
                                        onValueChange={val => setCurrentAccount({ ...currentAccount, nature: val })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccionar naturaleza" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="DEBIT">DÉBITO</SelectItem>
                                            <SelectItem value="CREDIT">CRÉDITO</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex items-center space-x-2 pt-2">
                                    <Checkbox
                                        id="requiresThirdParty"
                                        checked={currentAccount.requiresThirdParty}
                                        onCheckedChange={checked => setCurrentAccount({ ...currentAccount, requiresThirdParty: !!checked })}
                                    />
                                    <Label htmlFor="requiresThirdParty">Requiere Tercero</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="requiresCostCenter"
                                        checked={currentAccount.requiresCostCenter}
                                        onCheckedChange={checked => setCurrentAccount({ ...currentAccount, requiresCostCenter: !!checked })}
                                    />
                                    <Label htmlFor="requiresCostCenter">Requiere Centro de Costo</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="active"
                                        checked={currentAccount.active}
                                        onCheckedChange={checked => setCurrentAccount({ ...currentAccount, active: !!checked })}
                                    />
                                    <Label htmlFor="active">Cuenta Activa</Label>
                                </div>

                                <div className="grid grid-cols-2 gap-4 pb-2 border-t pt-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold text-blue-600">Formato Exógena</Label>
                                        <Input
                                            placeholder="Ej: 1001"
                                            value={currentAccount.exogenousFormat || ''}
                                            onChange={e => setCurrentAccount({ ...currentAccount, exogenousFormat: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold text-blue-600">Concepto Exógena</Label>
                                        <Input
                                            placeholder="Ej: 5001"
                                            value={currentAccount.exogenousConcept || ''}
                                            onChange={e => setCurrentAccount({ ...currentAccount, exogenousConcept: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsEditing(false)}>Cancelar</Button>
                            <Button onClick={handleSave} disabled={editLoading}>
                                {editLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Guardar Cambios
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog open={isCreating} onOpenChange={setIsCreating}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Nueva Cuenta Manual</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Código</Label>
                                <Input
                                    placeholder="Ej: 11050501"
                                    value={newAccount.code}
                                    onChange={e => setNewAccount({ ...newAccount, code: e.target.value, level: e.target.value.length === 1 ? 1 : e.target.value.length === 2 ? 2 : e.target.value.length === 4 ? 3 : 4 })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Nombre de la Cuenta</Label>
                                <Input
                                    placeholder="Ej: Caja Menor Administrativa"
                                    value={newAccount.name}
                                    onChange={e => setNewAccount({ ...newAccount, name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Clasificación NIIF (Tipo)</Label>
                                <Select
                                    value={newAccount.type}
                                    onValueChange={val => setNewAccount({ ...newAccount, type: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar tipo de cuenta" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ASSET">ACTIVO (1)</SelectItem>
                                        <SelectItem value="LIABILITY">PASIVO (2)</SelectItem>
                                        <SelectItem value="EQUITY">PATRIMONIO (3)</SelectItem>
                                        <SelectItem value="INCOME">INGRESOS (4)</SelectItem>
                                        <SelectItem value="EXPENSE">GASTOS (5)</SelectItem>
                                        <SelectItem value="COST_SALES">COSTO DE VENTAS (6)</SelectItem>
                                        <SelectItem value="COST_PRODUCTION">COSTO PRODUCCIÓN (7)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Naturaleza Contable</Label>
                                <Select
                                    value={newAccount.nature}
                                    onValueChange={val => setNewAccount({ ...newAccount, nature: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar naturaleza" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="DEBIT">DÉBITO</SelectItem>
                                        <SelectItem value="CREDIT">CRÉDITO</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-center space-x-2 pt-2">
                                <Checkbox
                                    id="newRequiresThirdParty"
                                    checked={newAccount.requiresThirdParty}
                                    onCheckedChange={checked => setNewAccount({ ...newAccount, requiresThirdParty: !!checked })}
                                />
                                <Label htmlFor="newRequiresThirdParty">Exigir código Tercero al asentar pagos</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="newRequiresCostCenter"
                                    checked={newAccount.requiresCostCenter}
                                    onCheckedChange={checked => setNewAccount({ ...newAccount, requiresCostCenter: !!checked })}
                                />
                                <Label htmlFor="newRequiresCostCenter">Exigir Centro de Costo de Departamento</Label>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsCreating(false)} disabled={createLoading}>
                                Cancelar
                            </Button>
                            <Button onClick={handleCreate} disabled={createLoading}>
                                {createLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Crear Cuenta
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </MainLayout>
    )
}
