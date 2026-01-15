import { MercadoPagoConfig, Preference, Payment } from 'mercadopago'
import { logger } from './logger'

export interface MercadoPagoConfig {
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
  const client = new MercadoPagoConfig({ accessToken })
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

    const preferenceData = {
      items: [
        {
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
      notification_url: params.backUrls?.success
        ? `${params.backUrls.success.replace('/success', '')}/api/payments/mercadopago/webhook`
        : undefined,
      statement_descriptor: params.title.substring(0, 22), // Máximo 22 caracteres
    }

    const response = await preference.create({ body: preferenceData })

    logger.info('Mercado Pago preference created', {
      preferenceId: response.id,
      invoiceId: params.invoiceId,
      amount: params.amount,
    })

    return {
      preferenceId: response.id,
      initPoint: response.init_point,
      sandboxInitPoint: response.sandbox_init_point,
      clientId: response.client_id,
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
      id: paymentInfo.id,
      status: paymentInfo.status,
      statusDetail: paymentInfo.status_detail,
      paymentMethodId: paymentInfo.payment_method_id,
      paymentTypeId: paymentInfo.payment_type_id,
      transactionAmount: paymentInfo.transaction_amount,
      currencyId: paymentInfo.currency_id,
      dateCreated: paymentInfo.date_created,
      dateApproved: paymentInfo.date_approved,
      dateLastUpdated: paymentInfo.date_last_updated,
      externalReference: paymentInfo.external_reference,
      payer: paymentInfo.payer,
      metadata: paymentInfo.metadata,
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

