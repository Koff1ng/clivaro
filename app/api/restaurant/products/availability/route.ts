import { NextRequest, NextResponse } from "next/server";
import { getTenantPrismaClient } from "@/lib/tenancy";
import { ensureRestaurantMode } from "@/lib/restaurant";

export const dynamic = 'force-dynamic'
import { safeErrorMessage } from '@/lib/safe-error'

export async function POST(req: NextRequest) {
  try {
    const tenantId = req.headers.get("x-tenant-id");
    if (!tenantId) return NextResponse.json({ error: "Tenant ID missing" }, { status: 400 });

    const body = await req.json();
    const { productId, variantId, available } = body;

    await ensureRestaurantMode(tenantId);
    const prisma = await getTenantPrismaClient(tenantId);

    if (variantId) {
       await prisma.productVariant.update({
         where: { id: variantId },
         data: { active: available } // Assuming 'active' controls availability
       });
    } else {
       await prisma.product.update({
         where: { id: productId },
         data: { active: available }
       });
    }

    return NextResponse.json({ success: true, available });
  } catch (error: any) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 400 });
  }
}
