/**
 * Cliente GraphQL para YABI API
 * ==============================
 * Centraliza todas las llamadas a la API de YABI.
 * Usa credenciales GLOBALES desde variables de entorno.
 * 
 * Variables de entorno requeridas:
 * - YABI_API_URL: URL del endpoint GraphQL (ej: https://api.yabi.co/)
 * - YABI_API_TOKEN: Bearer token de autenticación
 * - YABI_ENVIRONMENT: 'staging' | 'production' (default: staging)
 * 
 * @module lib/yabi/client
 */

import { logger } from '@/lib/logger'
import type { YabiGraphQLResponse, YabiConfig } from './types'

// =============================================
// CONFIGURACIÓN
// =============================================

/**
 * Obtiene la configuración de YABI desde variables de entorno.
 * Las credenciales son GLOBALES — no varían por tenant.
 * 
 * @throws Error si las variables no están configuradas
 */
export function getYabiConfig(): YabiConfig {
  const apiUrl = process.env.YABI_API_URL
  const apiToken = process.env.YABI_API_TOKEN
  const environment = (process.env.YABI_ENVIRONMENT || 'staging') as 'staging' | 'production'

  if (!apiUrl || !apiToken) {
    throw new Error(
      'Credenciales YABI no configuradas. ' +
      'Configura YABI_API_URL y YABI_API_TOKEN en las variables de entorno.'
    )
  }

  return { apiUrl, apiToken, environment }
}

/**
 * Verifica si YABI está configurado (sin lanzar error).
 * Útil para mostrar/ocultar botones de transmisión en el frontend.
 */
export function isYabiConfigured(): boolean {
  return !!(process.env.YABI_API_URL && process.env.YABI_API_TOKEN)
}

// =============================================
// CLIENTE GRAPHQL
// =============================================

/**
 * Ejecuta una query o mutation GraphQL contra la API de YABI.
 * 
 * @param query - Query o mutation GraphQL
 * @param variables - Variables de la operación
 * @returns Respuesta tipada de YABI
 * 
 * @example
 * ```ts
 * const result = await yabiGraphQL<{ info: { organization: string } }>(
 *   'query { info() { info { organization version } } }'
 * )
 * ```
 */
export async function yabiGraphQL<T = any>(
  query: string,
  variables?: Record<string, any>,
): Promise<YabiGraphQLResponse<T>> {
  const config = getYabiConfig()

  const startTime = Date.now()

  try {
    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiToken}`,
      },
      body: JSON.stringify({
        query,
        variables: variables || {},
      }),
    })

    const elapsed = Date.now() - startTime

    if (!response.ok) {
      const errorText = await response.text()
      logger.error(`[YABI] HTTP ${response.status} en ${elapsed}ms`, {
        status: response.status,
        body: errorText.substring(0, 500), // Limitar log
      })

      return {
        errors: [{
          message: `Error HTTP ${response.status}: ${response.statusText}`,
          type: 'HTTP_ERROR',
        }],
      }
    }

    const data = await response.json() as YabiGraphQLResponse<T>

    // Log de errores GraphQL
    if (data.errors && data.errors.length > 0) {
      logger.warn(`[YABI] GraphQL errors en ${elapsed}ms`, {
        errors: data.errors.map(e => ({
          id: e.id,
          type: e.type,
          message: e.message,
        })),
      })
    } else {
      logger.info(`[YABI] Query exitosa en ${elapsed}ms`)
    }

    return data
  } catch (error: any) {
    const elapsed = Date.now() - startTime
    logger.error(`[YABI] Error de red en ${elapsed}ms`, {
      message: error.message,
      code: error.code,
    })

    return {
      errors: [{
        message: `Error de conexión con YABI: ${error.message}`,
        type: 'NETWORK_ERROR',
      }],
    }
  }
}

// =============================================
// QUERIES UTILITARIAS
// =============================================

/**
 * Verifica la conexión con YABI y retorna info de la organización.
 * Útil como health check y para validar credenciales.
 */
export async function yabiHealthCheck(): Promise<{
  ok: boolean
  organization?: string
  version?: string
  error?: string
}> {
  try {
    const result = await yabiGraphQL<{
      info: {
        info: {
          organization: string
          description: string
          version: string
        }
      }
    }>('query { info() { info { organization description version } } }')

    if (result.errors && result.errors.length > 0) {
      return {
        ok: false,
        error: result.errors[0].message,
      }
    }

    const info = result.data?.info?.info
    return {
      ok: true,
      organization: info?.organization,
      version: info?.version,
    }
  } catch (error: any) {
    return {
      ok: false,
      error: error.message,
    }
  }
}

/**
 * Consulta el estado del plan activo y los créditos disponibles.
 * Permite verificar si hay créditos de nómina electrónica disponibles.
 * 
 * @param organizationUid - UID de la organización en YABI
 */
export async function yabiCheckAccountStatement(organizationUid: string) {
  const query = `
    query AccountStatement($id: UID!) {
      accountStatement(id: $id) {
        accountStatementId
        availableCredits
        totalCredits
        planName
        planSpecificationEmission {
          payroll
        }
        validityDateEnd
        validityDateStart
      }
    }
  `

  return yabiGraphQL(query, { id: organizationUid })
}
