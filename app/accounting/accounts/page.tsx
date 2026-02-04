'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from '@/components/ui/toast'
import { Loader2, Plus, Search } from 'lucide-react'

export default function AccountsPage() {
    const [loading, setLoading] = useState(true)
    const [initLoading, setInitLoading] = useState(false)
    const [accounts, setAccounts] = useState<any[]>([])
    const [search, setSearch] = useState('')

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
                        <div className="flex gap-2">
                            <div className="relative flex-1 max-w-sm">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar por código o nombre..."
                                    className="pl-8"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="rounded-md border bg-white">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[150px]">Código</TableHead>
                                        <TableHead>Nombre</TableHead>
                                        <TableHead className="w-[100px]">Tipo</TableHead>
                                        <TableHead className="w-[100px]">Nivel</TableHead>
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
                                                <TableCell>{acc.level}</TableCell>
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
            </div>
        </MainLayout>
    )
}
