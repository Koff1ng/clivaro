import { NextRequest, NextResponse } from "next/server";
import { getTenantPrismaClient } from "@/lib/tenancy";
import { ensureRestaurantMode } from "@/lib/restaurant";
import { emitRestaurantEvent } from "@/lib/events";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = req.headers.get("x-tenant-id");
    if (!tenantId) return NextResponse.json({ error: "Tenant ID missing" }, { status: 400 });

    const itemId = params.id;
    if (!itemId) return NextResponse.json({ error: "Item ID missing" }, { status: 400 });

    const body = await req.json();
    const { status } = body; // PENDING, COOKING, READY, SERVED

    if (!["PENDING", "COOKING", "READY", "SERVED"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    await ensureRestaurantMode(tenantId);

    const prisma = await getTenantPrismaClient(tenantId);
    
    const updatedItem = await prisma.tableOrderLine.update({
      where: { id: itemId },
      data: { status },
      include: {
        order: {
          include: {
            session: { include: { table: true } }
          }
        },
        product: { select: { name: true } }
      }
    });

    // Notify all listeners
    emitRestaurantEvent(tenantId, "ITEM_STATUS_UPDATED", {
      itemId: updatedItem.id,
      orderId: updatedItem.orderId,
      status: updatedItem.status,
      productName: updatedItem.product.name,
      tableName: updatedItem.order.session.table.name,
      timestamp: new Date()
    });

    // If item is READY, maybe notify waiter via a specific channel
    
    return NextResponse.json(updatedItem);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
