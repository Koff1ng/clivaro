import { NextRequest, NextResponse } from "next/server";
import { getTenantPrismaClient } from "@/lib/tenancy";
import { ensureRestaurantMode, hashPin } from "@/lib/restaurant";

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = req.headers.get("x-tenant-id");
    if (!tenantId) return NextResponse.json({ error: "Tenant ID missing" }, { status: 400 });

    const restaurantCheck = await ensureRestaurantMode(tenantId);
    if (restaurantCheck) return restaurantCheck;

    const body = await req.json();
    const { name, code, pin, active } = body;

    const prisma = await getTenantPrismaClient(tenantId);
    
    const data: any = {};
    if (name !== undefined) data.name = name;
    if (code !== undefined) data.code = code;
    if (pin !== undefined && pin !== "") data.pin = hashPin(pin);
    if (active !== undefined) data.active = active;

    const waiter = await prisma.waiterProfile.update({
      where: { id: params.id },
      data
    });

    return NextResponse.json({ waiter });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = req.headers.get("x-tenant-id");
    if (!tenantId) return NextResponse.json({ error: "Tenant ID missing" }, { status: 400 });

    const restaurantCheck = await ensureRestaurantMode(tenantId);
    if (restaurantCheck) return restaurantCheck;

    const prisma = await getTenantPrismaClient(tenantId);
    
    // Soft delete
    await prisma.waiterProfile.update({
      where: { id: params.id },
      data: { active: false }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
