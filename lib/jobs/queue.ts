/**
 * Job queue system using Upstash QStash (serverless-friendly)
 * Falls back to in-memory queue for development
 */

interface Job {
  id: string
  type: string
  payload: any
  attempts: number
  maxAttempts: number
  createdAt: number
  scheduledFor?: number
}

interface JobHandler {
  (payload: any): Promise<void>
}

const jobHandlers = new Map<string, JobHandler>()
const memoryQueue: Job[] = []
let processing = false

/**
 * Register a job handler
 */
export function registerJobHandler(type: string, handler: JobHandler) {
  jobHandlers.set(type, handler)
}

/**
 * Enqueue a job (uses QStash if available, otherwise memory queue)
 */
export async function enqueueJob(
  type: string,
  payload: any,
  options?: {
    delay?: number // Delay in seconds
    maxAttempts?: number
  }
): Promise<string> {
  const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const delay = options?.delay || 0
  const maxAttempts = options?.maxAttempts || 3

  // Try QStash first if available
  const qstashUrl = process.env.QSTASH_URL
  const qstashToken = process.env.QSTASH_TOKEN
  const webhookUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
    ? `https://${process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL}/api/jobs/process`
    : null

  if (qstashUrl && qstashToken && webhookUrl) {
    try {
      const scheduleUrl = delay > 0
        ? `${qstashUrl}/v2/schedules/${jobId}`
        : `${qstashUrl}/v2/publish/${encodeURIComponent(webhookUrl)}`

      const body = JSON.stringify({
        type,
        payload,
        jobId,
        maxAttempts,
      })

      const headers: Record<string, string> = {
        'Authorization': `Bearer ${qstashToken}`,
        'Content-Type': 'application/json',
      }

      if (delay > 0) {
        headers['Upstash-Delay'] = String(delay)
      }

      const res = await fetch(scheduleUrl, {
        method: 'POST',
        headers,
        body,
      })

      if (res.ok) {
        logger.info('Job enqueued via QStash', { jobId, type, delay })
        return jobId
      }
    } catch (error) {
      logger.warn('Failed to enqueue via QStash, falling back to memory', { error, type })
    }
  }

  // Fallback to memory queue
  const job: Job = {
    id: jobId,
    type,
    payload,
    attempts: 0,
    maxAttempts,
    createdAt: Date.now(),
    scheduledFor: delay > 0 ? Date.now() + delay * 1000 : undefined,
  }

  memoryQueue.push(job)
  logger.info('Job enqueued in memory', { jobId, type, delay })

  // Start processing if not already running
  if (!processing) {
    processMemoryQueue()
  }

  return jobId
}

/**
 * Process memory queue (for development/fallback)
 */
async function processMemoryQueue() {
  if (processing) return
  processing = true

  while (memoryQueue.length > 0) {
    const now = Date.now()
    const jobIndex = memoryQueue.findIndex(
      job => !job.scheduledFor || job.scheduledFor <= now
    )

    if (jobIndex === -1) {
      // No jobs ready, wait a bit
      await new Promise(resolve => setTimeout(resolve, 1000))
      continue
    }

    const job = memoryQueue.splice(jobIndex, 1)[0]
    const handler = jobHandlers.get(job.type)

    if (!handler) {
      logger.warn('No handler for job type', { jobId: job.id, type: job.type })
      continue
    }

    try {
      await handler(job.payload)
      logger.info('Job processed successfully', { jobId: job.id, type: job.type })
    } catch (error) {
      job.attempts++
      logger.error('Job processing failed', error, {
        jobId: job.id,
        type: job.type,
        attempt: job.attempts,
        maxAttempts: job.maxAttempts,
      })

      if (job.attempts < job.maxAttempts) {
        // Retry with exponential backoff
        const backoffDelay = Math.min(60, Math.pow(2, job.attempts))
        job.scheduledFor = Date.now() + backoffDelay * 1000
        memoryQueue.push(job)
      } else {
        logger.error('Job failed after max attempts', {
          jobId: job.id,
          type: job.type,
          attempts: job.attempts,
        })
      }
    }
  }

  processing = false
}

/**
 * Process job from QStash webhook
 */
export async function processJob(jobData: {
  type: string
  payload: any
  jobId: string
  maxAttempts?: number
}): Promise<void> {
  const handler = jobHandlers.get(jobData.type)

  if (!handler) {
    throw new Error(`No handler registered for job type: ${jobData.type}`)
  }

  await handler(jobData.payload)
}

// Import logger
import { logger } from '@/lib/logger'

// Pre-register common job types
registerJobHandler('generate_pdf', async (payload: { invoiceId: string; tenantId?: string; databaseUrl?: string }) => {
  const { handleGeneratePDF } = await import('./handlers/pdf-handler')
  await handleGeneratePDF(payload)
})

registerJobHandler('send_email', async (payload: { to: string; subject: string; body: string }) => {
  // This will be implemented in the actual job handler
  logger.info('Email sending job', { to: payload.to, subject: payload.subject })
})

registerJobHandler('generate_report', async (payload: { reportType: string; params: any }) => {
  // This will be implemented in the actual job handler
  logger.info('Report generation job', { reportType: payload.reportType })
})

registerJobHandler('ei_send_to_alegra', async (payload: { invoiceId: string; tenantId: string }) => {
  const { handleAlegraTransmission } = await import('./handlers/alegra-handler')
  await handleAlegraTransmission(payload)
})

