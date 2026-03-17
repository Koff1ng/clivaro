import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const sendQuotationEmail = async (quoteId: string) => {
  const { data, error } = await supabase.functions.invoke('send-quote-email', {
    body: { quoteId },
  })

  if (error) {
    throw new Error(error.message || 'Error al invocar la función de envío')
  }

  return data
}
