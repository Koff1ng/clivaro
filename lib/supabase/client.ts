import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente browser / server para Supabase (Edge Functions, Realtime, etc.).
 *
 * Variables en Vercel (prefijo NEXT_PUBLIC_ = expuestas al cliente):
 * - NEXT_PUBLIC_SUPABASE_URL
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY
 *
 * Nota: el login de la app es NextAuth + Prisma (multi-tenant); estas vars no reemplazan ese flujo.
 */

let browserClient: SupabaseClient | null = null

export function isSupabasePublicConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  return !!(url && key)
}

/**
 * Cliente singleton. Lanza si faltan URL o anon key (útil para fallar con mensaje claro).
 */
export function getSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

  if (!url || !key) {
    throw new Error(
      'Supabase no está configurado. Defina NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY (p. ej. en Vercel → Environment Variables).'
    )
  }

  if (!browserClient) {
    browserClient = createClient(url, key)
  }

  return browserClient
}

export const sendQuotationEmail = async (quoteId: string) => {
  if (!isSupabasePublicConfigured()) {
    throw new Error(
      'No se puede enviar por Supabase: configure NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    )
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase.functions.invoke('send-quote-email', {
    body: { quoteId },
  })

  if (error) {
    throw new Error(error.message || 'Error al invocar la función de envío')
  }

  return data
}
