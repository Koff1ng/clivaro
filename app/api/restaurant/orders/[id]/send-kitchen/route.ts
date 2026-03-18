import { NextRequest, NextResponse } from "next/server";
import { getTenantPrismaClient } from "@/lib/tenancy";
import { ensureRestaurantMode, getWaiterFromToken } from "@/lib/restaurant";
import { emitRestaurantEvent } from "@/lib/events";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = req.headers.get("x-tenant-id");
    if (!tenantId) return NextResponse.json({ error: "Tenant ID missing" }, { status: 400 });

    const orderId = params.id;
    if (!orderId) return NextResponse.json({ error: "Order ID missing" }, { status: 400 });

    await ensureRestaurantMode(tenantId);

    const prisma = await getTenantPrismaClient(tenantId);
    
    const order = await prisma.tableOrder.findUnique({
      where: { id: orderId },
      include: {
        session: {
          include: { table: true }
        },
        items: {
          include: {
            product: { select: { name: true } }
          }
        }
      }
    });

    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (order.status !== "PENDING") {
      return NextResponse.json({ error: `Order is already ${order.status}` }, { status: 400 });
    }

    const updatedOrder = await prisma.tableOrder.update({
      where: { id: orderId },
      data: { status: "SENT" },
      include: {
        items: {
          include: {
            product: { select: { name: true } }
          }
        }
      }
    });

    // Notify KDS
    emitRestaurantEvent(tenantId, "ORDER_SENT_TO_KITCHEN", {
      orderId: updatedOrder.id,
      tableName: order.session.table.name,
      items: updatedOrder.items.map(item => ({
        id: item.id,
        name: item.product.name,
        quantity: item.quantity,
        notes: item.notes
      })),
      timestamp: new Date()
    });

    return NextResponse.json(updatedOrder);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
