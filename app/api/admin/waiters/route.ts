import { NextRequest, NextResponse } from "next/server";
import { getTenantPrismaClient } from "@/lib/tenancy";
import { ensureRestaurantMode, hashPin } from "@/lib/restaurant";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const tenantId = req.headers.get("x-tenant-id");
    if (!tenantId) return NextResponse.json({ error: "Tenant ID missing" }, { status: 400 });

    const restaurantCheck = await ensureRestaurantMode(tenantId);
    if (restaurantCheck) return restaurantCheck;

    const prisma = await getTenantPrismaClient(tenantId);
    const waiters = await prisma.waiterProfile.findMany({
      orderBy: { name: 'asc' }
    });

    return NextResponse.json({ waiters });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenantId = req.headers.get("x-tenant-id");
    if (!tenantId) return NextResponse.json({ error: "Tenant ID missing" }, { status: 400 });

    const restaurantCheck = await ensureRestaurantMode(tenantId);
    if (restaurantCheck) return restaurantCheck;

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
      return NextResponse.json({ error: "El código de mesero ya existe" }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
