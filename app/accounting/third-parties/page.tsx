
'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import { Loader2, Plus, Search, Users, ShieldCheck, Building, User } from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogTrigger
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function ThirdPartiesPage() {
    const { toast } = useToast()
    const [loading, setLoading] = useState(true)
    const [thirdParties, setThirdParties] = useState<any[]>([])
    const [search, setSearch] = useState('')
    const [filterType, setFilterType] = useState('ALL')

    // New Third Party State
    const [isCreating, setIsCreating] = useState(false)
    const [createLoading, setCreateLoading] = useState(false)
    const [formData, setFormData] = useState({
        name: '',
        type: 'OTHER',
        documentType: 'NIT',
        documentNumber: '',
        email: '',
        phone: '',
        address: ''
    })

    const fetchThirdParties = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/accounting/third-parties')
            if (res.ok) {
                const data = await res.json()
                setThirdParties(data)
            }
        } catch (error) {
            console.error(error)
            toast('Error cargando terceros', 'error')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchThirdParties()
    }, [])

    const handleCreate = async () => {
        if (!formData.name || !formData.documentNumber) {
            toast('Nombre y Documento son obligatorios', 'error')
            return
        }
        setCreateLoading(true)
        try {
            const res = await fetch('/api/accounting/third-parties', {
                method: 'POST',
                body: JSON.stringify(formData),
                headers: { 'Content-Type': 'application/json' }
            })
            if (res.ok) {
                toast('Tercero creado correctamente', 'success')
                setIsCreating(false)
                setFormData({ name: '', type: 'OTHER', documentType: 'NIT', documentNumber: '', email: '', phone: '', address: '' })
                fetchThirdParties()
            } else {
                toast('Error al crear tercero', 'error')
            }
        } catch (e) {
            toast('Error de conexión', 'error')
        } finally {
            setCreateLoading(false)
        }
    }

    const filtered = thirdParties.filter(tp => {
        const matchesSearch = tp.name.toLowerCase().includes(search.toLowerCase()) ||
            tp.taxId?.includes(search)
        const matchesType = filterType === 'ALL' || tp.type === filterType
        return matchesSearch && matchesType
    })

    const getTypeBadge = (type: string) => {
        switch (type) {
            case 'CUSTOMER': return <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">CLIENTE</span>
            case 'SUPPLIER': return <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">PROVEEDOR</span>
            case 'DIAN': return <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">DIAN / FISCAL</span>
            case 'BANK': return <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">BANCO</span>
            default: return <span className="text-[10px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full font-medium">OTRO</span>
        }
    }

    return (
        <MainLayout>
            <div className="space-y-6">
                <div className="flex justify-between items-start">
                    <PageHeader
                        title="Gestión de Terceros"
                        description="Administra Clientes, Proveedores y Entidades Fiscales en un solo lugar."
                    />
                    <Dialog open={isCreating} onOpenChange={setIsCreating}>
                        <DialogTrigger asChild>
                            <Button className="bg-primary hover:bg-primary/90">
                                <Plus className="mr-2 h-4 w-4" /> Nuevo Tercero Contable
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle>Crear Nuevo Tercero (Contable)</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Tipo Documento</Label>
                                        <Select value={formData.documentType} onValueChange={v => setFormData({ ...formData, documentType: v })}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="NIT">NIT</SelectItem>
                                                <SelectItem value="CC">Cédula Ciudadanía</SelectItem>
                                                <SelectItem value="CE">Cédula Extranjería</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Número</Label>
                                        <Input value={formData.documentNumber} onChange={e => setFormData({ ...formData, documentNumber: e.target.value })} placeholder="Ej: 900.123.456-1" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Nombre / Razón Social</Label>
                                    <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Nombre completo" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Categoría Contable</Label>
                                    <Select value={formData.type} onValueChange={v => setFormData({ ...formData, type: v })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="DIAN">DIAN / Entidad Fiscal</SelectItem>
                                            <SelectItem value="BANK">Banco / Entidad Financiera</SelectItem>
                                            <SelectItem value="PARTNER">Socio / Accionista</SelectItem>
                                            <SelectItem value="OTHER">Otro Tercero</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Teléfono</Label>
                                        <Input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Email</Label>
                                        <Input value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                                    </div>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsCreating(false)}>Cancelar</Button>
                                <Button onClick={handleCreate} disabled={createLoading}>
                                    {createLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Crear Tercero
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 items-center">
                    <div className="relative flex-1 w-full sm:max-w-sm">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por nombre o NIT..."
                            className="pl-8"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant={filterType === 'ALL' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setFilterType('ALL')}
                        >Todos</Button>
                        <Button
                            variant={filterType === 'CUSTOMER' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setFilterType('CUSTOMER')}
                        >Clientes</Button>
                        <Button
                            variant={filterType === 'SUPPLIER' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setFilterType('SUPPLIER')}
                        >Prov.</Button>
                        <Button
                            variant={['DIAN', 'BANK', 'OTHER'].includes(filterType) ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setFilterType('DIAN')}
                        >Contables</Button>
                    </div>
                </div>

                <div className="rounded-md border bg-white overflow-hidden">
                    <Table>
                        <TableHeader className="bg-slate-50">
                            <TableRow>
                                <TableHead className="w-[120px]">Documento</TableHead>
                                <TableHead>Nombre / Razón Social</TableHead>
                                <TableHead className="w-[150px]">Tipo</TableHead>
                                <TableHead className="w-[150px]">Contacto</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-12">
                                        <div className="flex flex-col items-center gap-2">
                                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                            <p className="text-sm text-muted-foreground">Cargando base de datos unificada...</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : filtered.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                                        No se encontraron terceros con los filtros aplicados.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filtered.map((tp, idx) => (
                                    <TableRow key={tp.id || idx}>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-muted-foreground font-bold">{tp.idType}</span>
                                                <span className="font-mono text-xs">{tp.taxId || 'S/N'}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-medium">{tp.name}</TableCell>
                                        <TableCell>{getTypeBadge(tp.type)}</TableCell>
                                        <TableCell>
                                            <div className="text-xs text-muted-foreground">
                                                {tp.phone && <div>{tp.phone}</div>}
                                                {tp.email && <div className="truncate max-w-[140px]">{tp.email}</div>}
                                                {!tp.phone && !tp.email && <span>-</span>}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </MainLayout>
    )
}
