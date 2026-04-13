import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { withTenantRead, getTenantIdFromSession } from '@/lib/tenancy';
import { dashboardAI } from '@/lib/ai/modules/dashboard';
import { inventoryAI } from '@/lib/ai/modules/inventory';
import { crmAI } from '@/lib/ai/modules/crm';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic'
import { safeErrorMessage } from '@/lib/safe-error'

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const tenantId = getTenantIdFromSession(session);
    const { module, action, payload } = await req.json();

    try {
        const result = await withTenantRead(tenantId, async (prisma) => {
            switch (module) {
                case 'dashboard':
                    if (action === 'getDailyInsight') return await dashboardAI.getDailyInsight(tenantId, payload);
                    break;
                case 'inventory':
                    if (action === 'analyzeStock') return await inventoryAI.analyzeStockStatus(payload);
                    break;
                case 'crm':
                    if (action === 'analyzeLeads') return await crmAI.analyzeLeadsAndCustomers(payload);
                    break;
                default:
                    throw new Error('Invalid module');
            }
        });

        return NextResponse.json({ result });
    } catch (error: any) {
        logger.error(`[AI_API_ERROR] ${module}:${action}`, error);
        return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
    }
}
