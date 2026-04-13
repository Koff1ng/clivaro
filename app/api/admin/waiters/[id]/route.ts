import { NextRequest, NextResponse } from "next/server";
import { getTenantIdFromSession, getTenantPrismaClient } from "@/lib/tenancy";
import { requirePermission } from "@/lib/api-middleware";
import { PERMISSIONS } from "@/lib/permissions";
import { ensureRestaurantMode, hashPin } from "@/lib/restaurant";

export const dynamic = 'force-dynamic';
import { safeErrorMessage } from '@/lib/safe-error'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requirePermission(req as any, PERMISSIONS.MANAGE_RESTAURANT);
  if (session instanceof NextResponse) return session;

  const tenantId = getTenantIdFromSession(session);
  const restaurantCheck = await ensureRestaurantMode(tenantId);
  if (restaurantCheck) return restaurantCheck;

  try {
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
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requirePermission(req as any, PERMISSIONS.MANAGE_RESTAURANT);
  if (session instanceof NextResponse) return session;

  const tenantId = getTenantIdFromSession(session);
  const restaurantCheck = await ensureRestaurantMode(tenantId);
  if (restaurantCheck) return restaurantCheck;

  try {
    const prisma = await getTenantPrismaClient(tenantId);
    
    // Soft delete
    await prisma.waiterProfile.update({
      where: { id: params.id },
      data: { active: false }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}
