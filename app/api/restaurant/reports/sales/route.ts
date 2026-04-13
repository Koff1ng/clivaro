import { NextRequest, NextResponse } from "next/server";
import { getTenantPrismaClient } from "@/lib/tenancy";
import { ensureRestaurantMode } from "@/lib/restaurant";

export const dynamic = 'force-dynamic';
import { safeErrorMessage } from '@/lib/safe-error'

export async function GET(req: NextRequest) {
  try {
    const tenantId = req.headers.get("x-tenant-id");
    if (!tenantId) return NextResponse.json({ error: "Tenant ID missing" }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate") ? new Date(searchParams.get("startDate")!) : new Date(new Date().setHours(0,0,0,0));
    const endDate = searchParams.get("endDate") ? new Date(searchParams.get("endDate")!) : new Date();

    await ensureRestaurantMode(tenantId);
    const prisma = await getTenantPrismaClient(tenantId);

    // 1. Total Sales and Tips from Closed Sessions
    const sessions = await prisma.tableSession.findMany({
      where: {
        tenantId,
        status: "CLOSED",
        closedAt: { gte: startDate, lte: endDate }
      },
      include: {
        waiter: { select: { name: true } }
      }
    });

    const totalSales = sessions.reduce((acc, s) => acc + s.totalAmount, 0);
    const totalTips = sessions.reduce((acc, s) => acc + s.tipAmount, 0);

    // 2. Sales per Waiter (Tips tracking)
    const waiterStats = sessions.reduce((acc: any, s) => {
      const waiterName = s.waiter.name;
      if (!acc[waiterName]) acc[waiterName] = { sales: 0, tips: 0 };
      acc[waiterName].sales += s.totalAmount;
      acc[waiterName].tips += s.tipAmount;
      return acc;
    }, {});

    return NextResponse.json({
      period: { startDate, endDate },
      summary: { totalSales, totalTips, sessionCount: sessions.length },
      waiterStats
    });

  } catch (error: any) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 400 });
  }
}
