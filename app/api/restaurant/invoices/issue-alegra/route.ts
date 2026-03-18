import { NextRequest, NextResponse } from "next/server";
import { getTenantPrismaClient } from "@/lib/tenancy";
import { getAlegraService } from "@/lib/alegra";
import { ensureRestaurantMode } from "@/lib/restaurant";

export async function POST(req: NextRequest) {
  try {
    const tenantId = req.headers.get("x-tenant-id");
    if (!tenantId) return NextResponse.json({ error: "Tenant ID missing" }, { status: 400 });

    await ensureRestaurantMode(tenantId);

    const body = await req.json();
    const { sessionId, customerId, paymentMethod } = body;

    if (!sessionId) return NextResponse.json({ error: "Session ID required" }, { status: 400 });

    const prisma = await getTenantPrismaClient(tenantId);
    
    // 1. Get Session data
    const session = await prisma.tableSession.findUnique({
      where: { id: sessionId },
      include: {
        table: true,
        orders: {
          where: { status: "SENT" }, // Only invoce sent orders? or all?
          include: {
            items: {
              include: {
                product: true,
                variant: true
              }
            }
          }
        }
      }
    });

    if (!session || session.status !== "OPEN") {
      return NextResponse.json({ error: "Active session not found" }, { status: 404 });
    }

    // 2. Prepare Alegra Data (Sample structure)
    const alegraItems = session.orders.flatMap(order => 
      order.items.map(item => ({
        id: 1, // Placeholder: need Alegra Item ID mapping
        name: item.product.name,
        price: item.unitPrice,
        quantity: item.quantity,
        tax: [] // Need tax mapping
      }))
    );

    const alegraService = await getAlegraService(tenantId);
    
    // 3. Sync Contact if exists
    let alegraContactId = null;
    if (customerId) {
        const customer = await prisma.customer.findUnique({ where: { id: customerId }});
        if (customer) {
            const contact = await alegraService.createContact({
                name: customer.name,
                identification: (customer as any).identification || "", // Use identification field
                email: customer.email || "",
                phone: customer.phone || ""
            });
            alegraContactId = contact.id;
        }
    }

    // 4. Create Invoice in Alegra
    const alegraInvoice = await alegraService.createInvoice({
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date().toISOString().split('T')[0],
      client: alegraContactId || 1, 
      items: alegraItems,
      paymentMethod: paymentMethod || "cash"
    });

    // 5. Create/Update local Invoice with Alegra details
    const localInvoice = await prisma.invoice.create({
      data: {
        number: `INV-${alegraInvoice.number}`,
        customerId: customerId || "GENERIC",
        status: "EMITIDA",
        total: session.totalAmount + (session as any).tipAmount || 0,
        tipAmount: (session as any).tipAmount || 0,
        alegraId: String(alegraInvoice.id),
        alegraNumber: String(alegraInvoice.number),
        alegraStatus: "ISSUED",
        alegraUrl: (alegraInvoice as any).pdfUrl || null,
      }
    });

    return NextResponse.json({
      success: true,
      invoiceId: localInvoice.id,
      alegraId: String(alegraInvoice.id),
      number: String(alegraInvoice.number)
    });

  } catch (error: any) {
    console.error("Alegra issuance error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
