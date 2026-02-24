'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import { Loader2, Plus, Search, Edit2, Trash2, Users } from 'lucide-react'
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

const initialEmployee = {
    documentType: 'CC',
    documentNumber: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    jobTitle: '',
    department: '',
    hireDate: new Date().toISOString().split('T')[0],
    baseSalary: '',
    salaryType: 'FIJO',
    bankName: '',
    bankAccountType: 'AHORROS',
    bankAccountNumber: '',
    isActive: true,
}

export default function EmployeesPage() {
    const { toast } = useToast()
    const [loading, setLoading] = useState(true)
    const [employees, setEmployees] = useState<any[]>([])
    const [search, setSearch] = useState('')

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    const [currentEmployee, setCurrentEmployee] = useState<any>(initialEmployee)
    const [saveLoading, setSaveLoading] = useState(false)

    const fetchEmployees = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/hr/employees')
            if (res.ok) {
                const data = await res.json()
                setEmployees(data)
            } else {
                toast('Error al cargar empleados', 'error')
            }
        } catch (error) {
            console.error(error)
            toast('Error de conexión', 'error')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchEmployees()
    }, [])

    const handleOpenNew = () => {
        setCurrentEmployee(initialEmployee)
        setIsEditing(false)
        setIsModalOpen(true)
    }

    const handleEdit = (employee: any) => {
        setCurrentEmployee({
            ...employee,
            hireDate: new Date(employee.hireDate).toISOString().split('T')[0],
        })
        setIsEditing(true)
        setIsModalOpen(true)
    }

    const handleSave = async () => {
        setSaveLoading(true)
        try {
            const isNew = !isEditing
            const url = isNew ? '/api/hr/employees' : `/api/hr/employees/${currentEmployee.id}`
            const method = isNew ? 'POST' : 'PUT'

            // Clean payload
            const payload = {
                ...currentEmployee,
                baseSalary: currentEmployee.baseSalary.toString()
            };

            const res = await fetch(url, {
                method,
                body: JSON.stringify(payload),
                headers: { 'Content-Type': 'application/json' },
            })

            const responseData = await res.json()

            if (res.ok) {
                toast(isNew ? 'Empleado creado exitosamente' : 'Empleado actualizado exitosamente', 'success')
                setIsModalOpen(false)
                fetchEmployees()
            } else {
                toast(responseData.error || 'Error al guardar empleado', 'error')
            }
        } catch (e) {
            toast('Error de conexión', 'error')
        } finally {
            setSaveLoading(false)
        }
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0
        }).format(amount)
    }

    const filteredEmployees = employees.filter((emp) =>
        (emp.firstName + ' ' + emp.lastName).toLowerCase().includes(search.toLowerCase()) ||
        emp.documentNumber.includes(search) ||
        (emp.jobTitle && emp.jobTitle.toLowerCase().includes(search.toLowerCase()))
    )

    return (
        <MainLayout>
            <div className="space-y-6">
                <PageHeader
                    title="Directorio de Empleados"
                    description="Gestiona la información del personal y sus contratos."
                    actions={
                        <Button onClick={handleOpenNew}>
                            <Plus className="mr-2 h-4 w-4" /> Nuevo Empleado
                        </Button>
                    }
                />

                <div className="space-y-4">
                    <div className="flex gap-2">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por nombre, documento o cargo..."
                                className="pl-8"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Empleado</TableHead>
                                    <TableHead>Documento</TableHead>
                                    <TableHead>Cargo / Depto</TableHead>
                                    <TableHead className="text-right">Salario Base</TableHead>
                                    <TableHead className="text-center">Estado</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-10">
                                            <div className="flex justify-center items-center">
                                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
                                                <span>Cargando directorio...</span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : filteredEmployees.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-10">
                                            <div className="flex flex-col items-center text-muted-foreground">
                                                <Users className="h-10 w-10 mb-2 opacity-20" />
                                                <p>No se encontraron empleados</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredEmployees.map((emp) => (
                                        <TableRow key={emp.id} className={!emp.isActive ? 'bg-slate-50 opacity-70' : ''}>
                                            <TableCell>
                                                <div className="font-medium">{emp.firstName} {emp.lastName}</div>
                                                <div className="text-xs text-muted-foreground">{emp.email || emp.phone || 'Sin contacto'}</div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-xs text-muted-foreground">{emp.documentType}</div>
                                                <div>{emp.documentNumber}</div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium">{emp.jobTitle}</div>
                                                <div className="text-xs text-muted-foreground">{emp.department || 'General'}</div>
                                            </TableCell>
                                            <TableCell className="text-right font-medium text-slate-700">
                                                {formatCurrency(emp.baseSalary)}
                                                <div className="text-xs text-muted-foreground font-normal">
                                                    {emp.salaryType}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {emp.isActive ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                                        Activo
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                                                        Inactivo
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="sm" onClick={() => handleEdit(emp)}>
                                                    <Edit2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>{isEditing ? 'Editar Empleado' : 'Nuevo Empleado'}</DialogTitle>
                        </DialogHeader>
                        <div className="grid grid-cols-2 gap-4 py-4">

                            <div className="col-span-2 space-y-2">
                                <h4 className="font-semibold text-sm border-b pb-1">Información Personal</h4>
                            </div>

                            <div className="space-y-2">
                                <Label>Tipo Documento *</Label>
                                <Select
                                    value={currentEmployee.documentType}
                                    onValueChange={(val) => setCurrentEmployee({ ...currentEmployee, documentType: val })}
                                >
                                    <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="CC">Cédula de Ciudadanía</SelectItem>
                                        <SelectItem value="CE">Cédula de Extranjería</SelectItem>
                                        <SelectItem value="PASAPORTE">Pasaporte</SelectItem>
                                        <SelectItem value="NIT">NIT</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Número Documento *</Label>
                                <Input
                                    value={currentEmployee.documentNumber}
                                    onChange={(e) => setCurrentEmployee({ ...currentEmployee, documentNumber: e.target.value })}
                                    placeholder="Ej: 10203040"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Nombres *</Label>
                                <Input
                                    value={currentEmployee.firstName}
                                    onChange={(e) => setCurrentEmployee({ ...currentEmployee, firstName: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Apellidos *</Label>
                                <Input
                                    value={currentEmployee.lastName}
                                    onChange={(e) => setCurrentEmployee({ ...currentEmployee, lastName: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Email</Label>
                                <Input
                                    type="email"
                                    value={currentEmployee.email || ''}
                                    onChange={(e) => setCurrentEmployee({ ...currentEmployee, email: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Teléfono</Label>
                                <Input
                                    value={currentEmployee.phone || ''}
                                    onChange={(e) => setCurrentEmployee({ ...currentEmployee, phone: e.target.value })}
                                />
                            </div>

                            <div className="col-span-2 space-y-2 mt-4">
                                <h4 className="font-semibold text-sm border-b pb-1">Información Contractual</h4>
                            </div>

                            <div className="space-y-2">
                                <Label>Cargo *</Label>
                                <Input
                                    value={currentEmployee.jobTitle}
                                    onChange={(e) => setCurrentEmployee({ ...currentEmployee, jobTitle: e.target.value })}
                                    placeholder="Ej: Vendedor"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Departamento</Label>
                                <Input
                                    value={currentEmployee.department || ''}
                                    onChange={(e) => setCurrentEmployee({ ...currentEmployee, department: e.target.value })}
                                    placeholder="Ej: Ventas"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Fecha de Ingreso *</Label>
                                <Input
                                    type="date"
                                    value={currentEmployee.hireDate}
                                    onChange={(e) => setCurrentEmployee({ ...currentEmployee, hireDate: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Salario Base (COP) *</Label>
                                <Input
                                    type="number"
                                    value={currentEmployee.baseSalary}
                                    onChange={(e) => setCurrentEmployee({ ...currentEmployee, baseSalary: e.target.value })}
                                    placeholder="Ej: 1300000"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Tipo de Salario</Label>
                                <Select
                                    value={currentEmployee.salaryType}
                                    onValueChange={(val) => setCurrentEmployee({ ...currentEmployee, salaryType: val })}
                                >
                                    <SelectTrigger><SelectValue placeholder="Tipo Salario" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="FIJO">Fijo</SelectItem>
                                        <SelectItem value="VARIABLE">Variable</SelectItem>
                                        <SelectItem value="INTEGRAL">Integral</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex items-center space-x-2 pt-8">
                                <Checkbox
                                    id="isActive"
                                    checked={currentEmployee.isActive}
                                    onCheckedChange={(checked) => setCurrentEmployee({ ...currentEmployee, isActive: !!checked })}
                                />
                                <Label htmlFor="isActive" className="cursor-pointer">Empleado Activo</Label>
                            </div>

                            <div className="col-span-2 space-y-2 mt-4">
                                <h4 className="font-semibold text-sm border-b pb-1">Información Bancaria</h4>
                            </div>

                            <div className="space-y-2">
                                <Label>Banco</Label>
                                <Input
                                    value={currentEmployee.bankName || ''}
                                    onChange={(e) => setCurrentEmployee({ ...currentEmployee, bankName: e.target.value })}
                                    placeholder="Ej: Bancolombia"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Tipo de Cuenta</Label>
                                <Select
                                    value={currentEmployee.bankAccountType || ''}
                                    onValueChange={(val) => setCurrentEmployee({ ...currentEmployee, bankAccountType: val })}
                                >
                                    <SelectTrigger><SelectValue placeholder="Tipo Cuenta" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="AHORROS">Ahorros</SelectItem>
                                        <SelectItem value="CORRIENTE">Corriente</SelectItem>
                                        <SelectItem value="NEQUI">Nequi</SelectItem>
                                        <SelectItem value="DAVIPLATA">Daviplata</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="col-span-2 space-y-2">
                                <Label>Número de Cuenta</Label>
                                <Input
                                    value={currentEmployee.bankAccountNumber || ''}
                                    onChange={(e) => setCurrentEmployee({ ...currentEmployee, bankAccountNumber: e.target.value })}
                                />
                            </div>

                        </div>
                        <DialogFooter className="mt-4">
                            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                            <Button onClick={handleSave} disabled={saveLoading || !currentEmployee.documentNumber || !currentEmployee.firstName || !currentEmployee.baseSalary}>
                                {saveLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Guardar Empleado
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </MainLayout>
    )
}
