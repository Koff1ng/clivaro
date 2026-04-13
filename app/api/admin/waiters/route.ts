import { NextRequest, NextResponse } from "next/server";
import { getTenantIdFromSession, getTenantPrismaClient } from "@/lib/tenancy";
import { requirePermission } from "@/lib/api-middleware";
import { PERMISSIONS } from "@/lib/permissions";
import { ensureRestaurantMode, hashPin } from "@/lib/restaurant";

export const dynamic = 'force-dynamic';
import { safeErrorMessage } from '@/lib/safe-error'

export async function GET(req: NextRequest) {
  const session = await requirePermission(req as any, PERMISSIONS.MANAGE_RESTAURANT);
  if (session instanceof NextResponse) return session;

  const tenantId = getTenantIdFromSession(session);
  const restaurantCheck = await ensureRestaurantMode(tenantId);
  if (restaurantCheck) return restaurantCheck;

  try {
    const prisma = await getTenantPrismaClient(tenantId);
    const waiters = await prisma.waiterProfile.findMany({
      orderBy: { name: 'asc' }
    });

    return NextResponse.json({ waiters });
  } catch (error: any) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await requirePermission(req as any, PERMISSIONS.MANAGE_RESTAURANT);
  if (session instanceof NextResponse) return session;

  const tenantId = getTenantIdFromSession(session);
  const restaurantCheck = await ensureRestaurantMode(tenantId);
  if (restaurantCheck) return restaurantCheck;

  try {
    const body = await req.json();
    const { name, code, pin } = body;

    if (!name || !code || !pin) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
    }

    const prisma = await getTenantPrismaClient(tenantId);
    
    const waiter = await prisma.waiterProfile.create({
      data: {
        tenantId,
        name,
        code,
        pin: hashPin(pin),
        active: true
      }
    });

    return NextResponse.json({ waiter });
  } catch (error: any) {
    if (error.code === 'P2002') {
      const field = error.meta?.target || '';
      if (field.includes('pin')) {
        return NextResponse.json({ error: "Este PIN ya está asignado a otro mesero" }, { status: 400 });
      }
      return NextResponse.json({ error: "El código de mesero ya existe" }, { status: 400 });
    }
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}
