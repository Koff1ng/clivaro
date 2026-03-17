import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { Resend } from "https://esm.sh/resend@3"

const resend = new Resend(Deno.env.get('RESEND_API_KEY'))

serve(async (req) => {
  const { quoteId } = await req.json()
  
  // 1. Initializar Supabase Client with Auth header
  const authHeader = req.headers.get('Authorization')!
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  )

  try {
    // 2. Resolve User & Tenant (Strictly from Auth, not request)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) throw new Error("Unauthorized")

    // Fetch tenant mapping (Security: Query filtered by RLS as configured in migrations)
    const { data: tenantMapping, error: tenantError } = await supabase
      .from('tenant_users')
      .select('tenant_id')
      .single()

    if (tenantError || !tenantMapping) throw new Error("Tenant context missing")
    const tenantId = tenantMapping.tenant_id

    // 3. Fetch Quote Data (Security: Filtered by tenantId)
    const { data: quote, error: quoteError } = await supabase
      .from('Quotation') // Mapping to existing Prisma table name
      .select(`
        *,
        customer:Customer(*),
        items:QuotationItem(*, product:Product(*)),
        tenant:Tenant(*)
      `)
      .eq('id', quoteId)
      .eq('tenantId', tenantId)
      .single()

    if (quoteError || !quote) throw new Error("Quotation not found or unauthorized")

    // 4. Branding & Template
    const tenantName = quote.tenant?.name || "Clivaro"
    const companyEmail = quote.tenant?.email || "noreply@clivaro.com"
    
    const htmlEmail = `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto;">
        <h1 style="color: #3b82f6;">${tenantName}</h1>
        <p>Hola <strong>${quote.customer?.name}</strong>,</p>
        <p>Adjuntamos la cotización <strong>${quote.number}</strong> solicitada.</p>
        <hr />
        <p>Resumen: <strong>${quote.total} COP</strong></p>
        <p>Válida hasta: ${new Date(quote.validUntil).toLocaleDateString()}</p>
        <br />
        <p>Saludos,<br />El equipo de ${tenantName}</p>
      </div>
    `

    // 5. Send via Resend
    const { data: emailInfo, error: emailError } = await resend.emails.send({
      from: `${tenantName} <notificaciones@clivaro.com>`, // Use validated domain
      to: [quote.customer?.email],
      subject: `Cotización ${quote.number} - ${tenantName}`,
      html: htmlEmail,
      // Note: PDF attachment logic would involve fetching from Storage here
      // attachments: [{ filename: `${quote.number}.pdf`, content: pdfBuffer }]
    })

    if (emailError) throw emailError

    // 6. Log activity
    await supabase.from('quote_email_logs').insert({
      tenant_id: tenantId,
      quote_id: quoteId,
      recipient_email: quote.customer?.email,
      status: 'sent',
      sent_by: user.id
    })

    return new Response(JSON.stringify({ success: true, messageId: emailInfo?.id }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    })

  } catch (error: any) {
    console.error(error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    })
  }
})
