import { NextRequest, NextResponse } from "next/server";
import { getTenantPrismaClient } from "@/lib/tenancy";
import { ensureRestaurantMode } from "@/lib/restaurant";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const tenantId = req.headers.get("x-tenant-id");
    if (!tenantId) return NextResponse.json({ error: "Tenant ID missing" }, { status: 400 });

    const restaurantCheck = await ensureRestaurantMode(tenantId);
    if (restaurantCheck) return restaurantCheck;

    const prisma = await getTenantPrismaClient(tenantId);

    const openSessions = await prisma.tableSession.findMany({
      where: { status: "OPEN" },
      include: {
        table: true,
        waiter: { select: { name: true } },
        orders: {
          include: {
            items: { include: { product: { select: { name: true } } } }
          }
        }
      },
      orderBy: { openedAt: "desc" }
    });

    return NextResponse.json(openSessions);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
