import { NextRequest, NextResponse } from "next/server";
import { getTenantPrismaClient } from "@/lib/tenancy";
import { ensureRestaurantMode } from "@/lib/restaurant";
import { emitRestaurantEvent } from "@/lib/events";
import { getAlegraService } from "@/lib/alegra";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = req.headers.get("x-tenant-id");
    if (!tenantId) return NextResponse.json({ error: "Tenant ID missing" }, { status: 400 });

    const sessionId = params.id;
    const restaurantCheck = await ensureRestaurantMode(tenantId);
    if (restaurantCheck) return restaurantCheck;

    const prisma = await getTenantPrismaClient(tenantId);
    
    // 1. Fetch entire session
    const session = await prisma.tableSession.findUnique({
      where: { id: sessionId },
      include: {
        table: true,
        orders: {
          include: { items: { include: { product: true } } }
        }
      }
    });

    if (!session || session.status !== "OPEN") {
      return NextResponse.json({ error: "Session not found or already closed" }, { status: 404 });
    }

    // 2. Check for pending orders/items
    const hasPending = session.orders.some(o => 
      o.status === "PENDING" || o.items.some(i => i.status !== "SERVED" && i.status !== "CANCELLED")
    );

    // Note: In some restaurants they allow closing even if not served, 
    // but usually we want at least status SENT/COOKING. 
    // For now, let's just warn or allow with a flag.

    // 3. Close transactionally
    const result = await prisma.$transaction(async (tx) => {
      // a. Close session
      const closedSession = await tx.tableSession.update({
        where: { id: sessionId },
        data: {
          status: "CLOSED",
          closedAt: new Date()
        }
      });

      // b. Free table
      await tx.restaurantTable.update({
        where: { id: session.tableId },
        data: { status: "AVAILABLE" }
      });

      // c. Create local Invoice (simplified version)
      const invoice = await tx.invoice.create({
        data: {
          number: `RES-${Date.now()}`,
          // Get or use a default customer ID. In a real system we'd look for "Consumidor Final"
          customerId: session.customerId || (await tx.customer.findFirst({ where: { active: true } }))?.id || "N/A", 
          status: "EMITIDA",
          total: session.totalAmount + session.tipAmount,
          tipAmount: session.tipAmount,
        }
      });

      return { closedSession, invoice };
    });

    // 4. Emit events
    emitRestaurantEvent(tenantId, "TABLE_UPDATED", {
      tableId: session.tableId,
      status: "AVAILABLE"
    });

    emitRestaurantEvent(tenantId, "SESSION_CLOSED", {
      sessionId: session.id,
      totalAmount: session.totalAmount
    });

    // 5. Trigger Alegra Issuance in background or separate step?
    // Usually better separate to handle retries, but we'll return the result here for now.

    return NextResponse.json(result);

  } catch (error: any) {
    console.error("Session close error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
