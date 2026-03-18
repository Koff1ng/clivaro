import { NextRequest, NextResponse } from "next/server";
import { getTenantPrismaClient } from "@/lib/tenancy";
import { ensureRestaurantMode, getWaiterFromToken } from "@/lib/restaurant";
import { emitRestaurantEvent } from "@/lib/events";

export async function GET(
  req: NextRequest,
  { params }: { params: { tableId?: string } }
) {
  try {
    const tenantId = req.headers.get("x-tenant-id");
    if (!tenantId) return NextResponse.json({ error: "Tenant ID missing" }, { status: 400 });

    const tableId = req.nextUrl.searchParams.get("tableId");
    if (!tableId) return NextResponse.json({ error: "Table ID missing" }, { status: 400 });

    await ensureRestaurantMode(tenantId);

    const prisma = await getTenantPrismaClient(tenantId);
    const session = await prisma.tableSession.findFirst({
      where: {
        tableId,
        status: "OPEN",
      },
      include: {
        waiter: {
          select: { name: true, code: true }
        },
        orders: {
          include: {
            items: true
          }
        }
      }
    });

    return NextResponse.json(session);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenantId = req.headers.get("x-tenant-id");
    if (!tenantId) return NextResponse.json({ error: "Tenant ID missing" }, { status: 400 });

    const waiterToken = req.headers.get("x-waiter-token");
    if (!waiterToken) return NextResponse.json({ error: "Waiter token missing" }, { status: 401 });

    await ensureRestaurantMode(tenantId);
    
    const waiter = await getWaiterFromToken(waiterToken, tenantId);
    if (!waiter) return NextResponse.json({ error: "Invalid waiter token" }, { status: 401 });

    const body = await req.json();
    const { tableId } = body;

    if (!tableId) return NextResponse.json({ error: "Table ID required" }, { status: 400 });

    const prisma = await getTenantPrismaClient(tenantId);
    
    // Check if there's already an open session
    const existing = await prisma.tableSession.findFirst({
      where: { tableId, status: "OPEN" }
    });

    if (existing) {
      return NextResponse.json({ error: "Table already has an open session" }, { status: 400 });
    }

    const session = await prisma.$transaction(async (tx) => {
      // Create session
      const newSession = await tx.tableSession.create({
        data: {
          tenantId,
          tableId,
          waiterId: waiter.id,
          status: "OPEN",
        }
      });

      // Update table status
      await tx.restaurantTable.update({
        where: { id: tableId },
        data: { status: "OCCUPIED" }
      });

      return newSession;
    });

    // Notify real-time
    emitRestaurantEvent(tenantId, "TABLE_UPDATED", {
      tableId,
      status: "OCCUPIED"
    });

    return NextResponse.json(session);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
