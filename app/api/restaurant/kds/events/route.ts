import { NextRequest } from "next/server";
import { getTenantPrismaClient } from "@/lib/tenancy";
import { getRestaurantEventBus } from "@/lib/events";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const tenantId = req.headers.get("x-tenant-id");
  if (!tenantId) {
    return new Response("Tenant ID missing", { status: 400 });
  }

  const responseHeaders = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  };

  const bus = getRestaurantEventBus(tenantId);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const onEvent = (event: any) => {
        // Only stream events relevant to KDS
        if (["ORDER_SENT_TO_KITCHEN", "ORDER_STATUS_UPDATED", "ITEM_STATUS_UPDATED"].includes(event.type)) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        }
      };

      bus.on("event", onEvent);

      // Keep alive heartbeat
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": heartbeat\n\n"));
      }, 30000);

      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        bus.off("event", onEvent);
        controller.close();
      });
    },
  });

  return new Response(stream, { headers: responseHeaders });
}
