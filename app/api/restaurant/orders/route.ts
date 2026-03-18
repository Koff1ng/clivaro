import { NextRequest, NextResponse } from "next/server";
import { getTenantPrismaClient } from "@/lib/tenancy";
import { ensureRestaurantMode, getWaiterFromToken } from "@/lib/restaurant";
import { emitRestaurantEvent } from "@/lib/events";

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
    const { sessionId, items } = body; // items: [{ productId, variantId, quantity, unitPrice, notes }]

    if (!sessionId || !items || !items.length) {
      return NextResponse.json({ error: "Session ID and items are required" }, { status: 400 });
    }

    const prisma = await getTenantPrismaClient(tenantId);
    
    // Ensure session is open
    const session = await prisma.tableSession.findUnique({
      where: { id: sessionId },
      include: { table: true }
    });

    if (!session || session.status !== "OPEN") {
      return NextResponse.json({ error: "Session is not open" }, { status: 400 });
    }

    const orderTotal = items.reduce((sum: number, item: any) => sum + (item.quantity * item.unitPrice), 0);

    const order = await prisma.$transaction(async (tx) => {
      // 1. Create Order
      const newOrder = await tx.tableOrder.create({
        data: {
          tenantId,
          sessionId,
          waiterId: waiter.id,
          status: "PENDING",
          items: {
            create: items.map((item: any) => ({
              productId: item.productId,
              variantId: item.variantId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subtotal: item.quantity * item.unitPrice,
              notes: item.notes,
              modifiers: item.modifiers ? JSON.stringify(item.modifiers) : null,
              tenantId: tenantId,
              status: "PENDING" // Keep status as it's a required field for order items
            }))
          }
        },
        include: {
          items: true
        }
      });

      // 2. Update Session Total
      await tx.tableSession.update({
        where: { id: sessionId },
        data: {
          totalAmount: {
            increment: orderTotal
          }
        }
      });

      return newOrder;
    });

    // Notify KDS / Real-time
    emitRestaurantEvent(tenantId, "NEW_ORDER", {
      orderId: order.id,
      tableId: session.tableId,
      tableName: session.table.name,
      waiterName: waiter.name,
      items: order.items
    });

    return NextResponse.json(order);
  } catch (error: any) {
    console.error("Error creating order:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
