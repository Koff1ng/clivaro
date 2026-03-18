import { NextRequest, NextResponse } from "next/server";
import { getTenantPrismaClient } from "@/lib/tenancy";
import { ensureRestaurantMode } from "@/lib/restaurant";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = req.headers.get("x-tenant-id");
    if (!tenantId) return NextResponse.json({ error: "Tenant ID missing" }, { status: 400 });

    const sessionId = params.id;
    const body = await req.json();
    const { tipAmount } = body;

    if (typeof tipAmount !== "number" || tipAmount < 0) {
      return NextResponse.json({ error: "Invalid tip amount" }, { status: 400 });
    }

    await ensureRestaurantMode(tenantId);

    const prisma = await getTenantPrismaClient(tenantId);
    
    const session = await prisma.tableSession.update({
      where: { id: sessionId },
      data: {
        tipAmount: tipAmount
      }
    });

    // Since I need to add 'tipAmount' to the schema, I'll do it in the next step.
    // For now, I'll use a transaction to update a hypothetical 'tip' field if I added it.

    return NextResponse.json({ success: true, tipAmount });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
