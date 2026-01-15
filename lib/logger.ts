/**
 * Structured logging utility
 * Provides consistent logging across the application
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  [key: string]: any
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development'
  private isProduction = process.env.NODE_ENV === 'production'

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString()
    const contextStr = context ? ` ${JSON.stringify(context)}` : ''
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`
  }

  private log(level: LogLevel, message: string, context?: LogContext) {
    const formattedMessage = this.formatMessage(level, message, context)

    switch (level) {
      case 'debug':
        if (this.isDevelopment) {
          console.debug(formattedMessage, context || '')
        }
        break
      case 'info':
        console.info(formattedMessage, context || '')
        break
      case 'warn':
        console.warn(formattedMessage, context || '')
        break
      case 'error':
        console.error(formattedMessage, context || '')
        // In production, errors are logged to console
        // Can be extended to send to error tracking service if needed
        break
    }
  }

  debug(message: string, context?: LogContext) {
    this.log('debug', message, context)
  }

  info(message: string, context?: LogContext) {
    this.log('info', message, context)
  }

  warn(message: string, context?: LogContext) {
    this.log('warn', message, context)
  }

  error(message: string, error?: Error | unknown, context?: LogContext) {
    const errorContext: LogContext = {
      ...context,
      ...(error instanceof Error
        ? {
            errorName: error.name,
            errorMessage: error.message,
            errorStack: error.stack,
          }
        : { error: String(error) }),
    }
    this.log('error', message, errorContext)
  }

  // API-specific logging
  apiRequest(method: string, path: string, context?: LogContext) {
    this.info(`API ${method} ${path}`, { type: 'api_request', method, path, ...context })
  }

  apiResponse(method: string, path: string, status: number, duration?: number, context?: LogContext) {
    this.info(`API ${method} ${path} ${status}`, {
      type: 'api_response',
      method,
      path,
      status,
      duration,
      ...context,
    })
  }

  apiError(method: string, path: string, error: Error | unknown, context?: LogContext) {
    this.error(`API ${method} ${path} failed`, error, {
      type: 'api_error',
      method,
      path,
      ...context,
    })
  }

  // Database-specific logging
  dbQuery(query: string, duration?: number, context?: LogContext) {
    this.debug(`DB Query: ${query}`, { type: 'db_query', query, duration, ...context })
  }

  dbError(query: string, error: Error | unknown, context?: LogContext) {
    this.error(`DB Query failed: ${query}`, error, {
      type: 'db_error',
      query,
      ...context,
    })
  }

  // User action logging
  userAction(action: string, userId?: string, context?: LogContext) {
    this.info(`User action: ${action}`, {
      type: 'user_action',
      action,
      userId,
      ...context,
    })
  }
}

export const logger = new Logger()

