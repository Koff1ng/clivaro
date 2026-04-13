import { NextRequest, NextResponse } from "next/server";
import { logger } from '@/lib/logger'
import { getTenantPrismaClient } from "@/lib/tenancy";
import { emitRestaurantEvent } from "@/lib/events";

export const dynamic = 'force-dynamic'
import { safeErrorMessage } from '@/lib/safe-error'

export async function POST(req: NextRequest) {
  try {
    // 1. Basic validation (Alegra typically sends a secret or common header)
    // For now, we'll process the body. In production, add HMAC validation.
    const body = await req.json();
    const { event, data, tenantId: bodyTenantId } = body;

    // We expect the webhook to include the tenantId or we derive it from the URL/Query
    const tenantId = req.nextUrl.searchParams.get("tenantId") || bodyTenantId;

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant ID not found in webhook" }, { status: 400 });
    }

    const prisma = await getTenantPrismaClient(tenantId);

    switch (event) {
      case "invoice.issued":
      case "invoice.updated":
        if (data.id) {
          await prisma.invoice.updateMany({
            where: { alegraId: String(data.id) },
            data: {
              alegraStatus: String(data.status || "ISSUED").toUpperCase(),
              alegraNumber: String(data.number)
            }
          });
        }
        break;

      case "invoice.voided":
        if (data.id) {
          await prisma.invoice.updateMany({
            where: { alegraId: String(data.id) },
            data: {
              alegraStatus: "VOID",
              status: "ANULADA"
            }
          });
        }
        break;

      default:
        logger.info(`Unhandled Alegra event: ${event}`);
    }

    // Optional: Notify UI via SSE if there's an active session watching this invoice
    emitRestaurantEvent(tenantId, "ALEGRA_WEBHOOK_RECEIVED", { event, id: data.id });

    return NextResponse.json({ received: true });

  } catch (error: any) {
    logger.error("Alegra Webhook Error:", error);
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}
