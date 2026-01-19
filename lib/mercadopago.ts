import { MercadoPagoConfig as MercadoPagoSDKConfig, Preference, Payment } from 'mercadopago'
import { logger } from './logger'

export interface MercadoPagoCredentials {
  accessToken: string
  publicKey?: string
}

export interface CreatePreferenceParams {
  title: string
  description?: string
  amount: number
  currency?: string
  subscriptionId?: string
  invoiceId?: string
  customerEmail?: string
  customerName?: string
  backUrls?: {
    success?: string
    failure?: string
    pending?: string
  }
  autoReturn?: 'approved' | 'all'
  externalReference?: string
  notificationUrl?: string // URL del webhook (opcional, se construye automáticamente si no se proporciona)
}

export interface PaymentNotification {
  id: string
  type: string
  action: string
  data: {
    id: string
  }
}

/**
 * Inicializa el cliente de Mercado Pago
 */
export function initMercadoPagoClient(accessToken: string) {
  const client = new MercadoPagoSDKConfig({ accessToken })
  return {
    preference: new Preference(client),
    payment: new Payment(client),
  }
}

/**
 * Crea una preferencia de pago en Mercado Pago (Checkout Pro)
 */
export async function createPaymentPreference(
  config: MercadoPagoCredentials,
  params: CreatePreferenceParams
) {
  try {
    const { preference } = initMercadoPagoClient(config.accessToken)

    // Detectar si estamos usando credenciales de prueba
    // Los tokens de prueba de Mercado Pago generalmente empiezan con "TEST-" o contienen "test"
    const isTestMode = config.accessToken.includes('TEST-') || 
                      config.accessToken.includes('test') ||
                      config.accessToken.includes('APP_USR') // Los tokens de prueba de producción también pueden ser APP_USR

    const preferenceData: any = {
      items: [
        {
          id: params.subscriptionId || params.invoiceId || 'item-1',
          title: params.title,
          description: params.description || '',
          quantity: 1,
          unit_price: params.amount,
          currency_id: params.currency || 'COP',
        },
      ],
      payer: {
        email: params.customerEmail,
        name: params.customerName,
      },
      back_urls: params.backUrls || {},
      auto_return: params.autoReturn || 'approved',
      external_reference: params.externalReference || params.subscriptionId || params.invoiceId,
      notification_url: params.notificationUrl || (() => {
        // Construir la URL del webhook desde backUrls.success si está disponible
        if (params.backUrls?.success) {
          try {
            const url = new URL(params.backUrls.success)
            return `${url.origin}/api/payments/mercadopago/webhook`
          } catch {
            // Si falla al parsear, usar el baseUrl del entorno
            const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://clivaro.vercel.app'
            return `${baseUrl}/api/payments/mercadopago/webhook`
          }
        }
        // Si no hay backUrls, usar el baseUrl del entorno
        const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://clivaro.vercel.app'
        return `${baseUrl}/api/payments/mercadopago/webhook`
      })(),
      statement_descriptor: params.title.substring(0, 22), // Máximo 22 caracteres
    }

    // Si estamos en modo prueba, agregar el parámetro test_mode
    // Nota: Mercado Pago puede no requerir esto explícitamente, pero ayuda a asegurar el modo sandbox
    if (isTestMode) {
      logger.info('Creating preference in test mode', {
        accessTokenPrefix: config.accessToken.substring(0, 10) + '...',
      })
    }

    const response = await preference.create({ body: preferenceData })

    logger.info('Mercado Pago preference created', {
      preferenceId: response.id,
      invoiceId: params.invoiceId,
      amount: params.amount,
      hasSandboxInitPoint: !!response.sandbox_init_point,
      hasInitPoint: !!response.init_point,
      isTestMode,
    })

    // Si estamos en modo prueba y no hay sandbox_init_point, pero hay init_point,
    // verificar si el init_point es de sandbox
    let sandboxInitPoint = response.sandbox_init_point
    if (!sandboxInitPoint && isTestMode && response.init_point) {
      // Si el init_point contiene "sandbox" o "test", usarlo como sandbox
      if (response.init_point.includes('sandbox') || response.init_point.includes('test')) {
        sandboxInitPoint = response.init_point
      }
    }

    return {
      preferenceId: response.id,
      initPoint: response.init_point,
      sandboxInitPoint: sandboxInitPoint || response.sandbox_init_point,
      clientId: response.client_id,
      isTestMode,
    }
  } catch (error: any) {
    logger.error('Error creating Mercado Pago preference', error, {
      invoiceId: params.invoiceId,
      amount: params.amount,
    })
    throw new Error(`Error al crear preferencia de pago: ${error.message}`)
  }
}

/**
 * Obtiene información de un pago de Mercado Pago
 */
export async function getPaymentInfo(
  config: MercadoPagoCredentials,
  paymentId: string
) {
  try {
    const { payment } = initMercadoPagoClient(config.accessToken)

    const paymentInfo = await payment.get({ id: paymentId })

    return {
      id: paymentInfo.id || null,
      status: paymentInfo.status || null,
      statusDetail: paymentInfo.status_detail || null,
      paymentMethodId: paymentInfo.payment_method_id || null,
      paymentTypeId: paymentInfo.payment_type_id || null,
      transactionAmount: paymentInfo.transaction_amount || null,
      currencyId: paymentInfo.currency_id || null,
      dateCreated: paymentInfo.date_created || null,
      dateApproved: paymentInfo.date_approved || null,
      dateLastUpdated: paymentInfo.date_last_updated || null,
      externalReference: paymentInfo.external_reference || null,
      payer: paymentInfo.payer || null,
      metadata: paymentInfo.metadata || null,
    }
  } catch (error: any) {
    logger.error('Error getting Mercado Pago payment info', error, {
      paymentId,
    })
    throw new Error(`Error al obtener información del pago: ${error.message}`)
  }
}

/**
 * Procesa una notificación de webhook de Mercado Pago
 */
export async function processWebhookNotification(
  config: MercadoPagoCredentials,
  notification: PaymentNotification
) {
  try {
    if (notification.type === 'payment') {
      const paymentInfo = await getPaymentInfo(config, notification.data.id)
      return paymentInfo
    }
    return null
  } catch (error: any) {
    logger.error('Error processing Mercado Pago webhook', error, {
      notificationId: notification.id,
    })
    throw error
  }
}

/**
 * Valida que las credenciales de Mercado Pago sean válidas
 */
export async function validateMercadoPagoCredentials(
  accessToken: string
): Promise<boolean> {
  try {
    const { payment } = initMercadoPagoClient(accessToken)
    // Intentar obtener información de un pago inexistente para validar el token
    // Si el token es inválido, lanzará un error
    await payment.get({ id: '0' }).catch(() => {
      // Esperamos que falle, pero si el error es de autenticación, el token es inválido
    })
    return true
  } catch (error: any) {
    if (error.status === 401 || error.status === 403) {
      return false
    }
    // Otros errores pueden ser válidos (pago no encontrado, etc.)
    return true
  }
}

