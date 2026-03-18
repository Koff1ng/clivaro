import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { Resend } from "https://esm.sh/resend@3"

const resend = new Resend(Deno.env.get('RESEND_API_KEY'))

serve(async (req) => {
  try {
    const { quoteId, html, pdfBase64, filename } = await req.json()
    
    // 1. Initialize Supabase Client with Auth header
    const authHeader = req.headers.get('Authorization')!
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // 2. Resolve User & Tenant (Strictly from Auth)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) throw new Error("Unauthorized")

    // Fetch tenant mapping
    const { data: tenantMapping, error: tenantError } = await supabase
      .from('tenant_users')
      .select('tenant_id')
      .single()

    if (tenantError || !tenantMapping) throw new Error("Tenant context missing")
    const tenantId = tenantMapping.tenant_id

    // 3. Fetch Quote Data (Security: Filtered by tenantId)
    const { data: quote, error: quoteError } = await supabase
      .from('Quotation')
      .select(`
        *,
        customer:Customer(*),
        tenant:Tenant(*)
      `)
      .eq('id', quoteId)
      .eq('tenantId', tenantId)
      .single()

    if (quoteError || !quote) throw new Error("Quotation not found or unauthorized")

    // 4. Branding & Template
    const tenantName = quote.tenant?.name || "Clivaro"
    const recipientEmail = quote.customer?.email
    if (!recipientEmail) throw new Error("Customer has no email")

    const finalHtml = html || `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h1 style="color: #3b82f6;">${tenantName}</h1>
        <p>Hola <strong>${quote.customer?.name}</strong>,</p>
        <p>Adjuntamos la cotización <strong>${quote.number}</strong> solicitada.</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p>Total: <strong>${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(quote.total)}</strong></p>
        <br />
        <p>Saludos,<br />El equipo de ${tenantName}</p>
      </div>
    `

    // 5. Prepare attachments (PDF from base64 if provided)
    const attachments = []
    if (pdfBase64) {
      attachments.push({
        filename: filename || `Cotizacion-${quote.number}.pdf`,
        content: pdfBase64, // Resend SDK handles base64 strings as content
      })
    }

    // 6. Send via Resend
    const { data: emailInfo, error: emailError } = await resend.emails.send({
      from: `${tenantName} <notificaciones@clivaro.com>`,
      to: [recipientEmail],
      subject: `Cotización ${quote.number} - ${tenantName}`,
      html: finalHtml,
      attachments: attachments.length > 0 ? attachments : undefined,
    })

    if (emailError) throw emailError

    // 7. Log activity in public database (using service role or RLS)
    await supabase.from('quote_email_logs').insert({
      tenant_id: tenantId,
      quote_id: quoteId,
      recipient_email: recipientEmail,
      status: 'sent',
      sent_by: user.id
    })

    return new Response(JSON.stringify({ success: true, messageId: emailInfo?.id }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    })

  } catch (error: any) {
    console.error("EDGE_FUNCTION_ERROR:", error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    })
  }
})
