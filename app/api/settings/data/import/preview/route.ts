import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        const user = session?.user as any
        if (!user?.id || !user?.tenantId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const formData = await req.formData()
        const file = formData.get('file') as File
        const entityType = formData.get('entityType') as string

        if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        let data: any[] = []

        // Parse File
        if (file.name.endsWith('.json')) {
            const text = buffer.toString('utf-8')
            data = JSON.parse(text)
            if (!Array.isArray(data)) {
                // Handle case where JSON is { clients: [...], products: [...] }
                if (data[entityType] && Array.isArray(data[entityType])) {
                    data = data[entityType]
                } else {
                    return NextResponse.json({ error: 'Invalid JSON format. Expected array or object with entity key.' }, { status: 400 })
                }
            }
        } else {
            const wb = XLSX.read(buffer, { type: 'buffer' })
            const sheetName = wb.SheetNames[0]
            const ws = wb.Sheets[sheetName]
            data = XLSX.utils.sheet_to_json(ws)
        }

        if (data.length === 0) {
            return NextResponse.json({ error: 'File is empty' }, { status: 400 })
        }

        // Get Headers from first row
        const headers = Object.keys(data[0])

        // Simple Validation based on Entity Type
        const requiredFields: Record<string, string[]> = {
            'clients': ['name'], // Minimal requirement
            'products': ['name', 'price'],
        }

        const missingFields = requiredFields[entityType]?.filter(field => !headers.includes(field)) || []

        return NextResponse.json({
            preview: data.slice(0, 5),
            totalRows: data.length,
            headers,
            missingFields,
            isValid: missingFields.length === 0
        })

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
