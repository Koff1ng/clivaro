import { NextResponse } from 'next/server'
import { processJob } from '@/lib/jobs/queue'
import { logger } from '@/lib/logger'

/**
 * Webhook endpoint for QStash to process jobs
 * This endpoint is called by QStash when a job is ready to be processed
 */
export async function POST(request: Request) {
  try {
    // Verify QStash signature if needed (optional but recommended)
    const signature = request.headers.get('upstash-signature')
    // In production, verify signature here

    const body = await request.json()
    const { type, payload, jobId, maxAttempts } = body

    if (!type || !payload) {
      return NextResponse.json(
        { error: 'Missing required fields: type, payload' },
        { status: 400 }
      )
    }

    try {
      await processJob({ type, payload, jobId, maxAttempts })
      return NextResponse.json({ success: true, jobId })
    } catch (error: any) {
      logger.error('Job processing failed', error, { jobId, type })
      // Return 500 to trigger QStash retry
      return NextResponse.json(
        { error: 'Job processing failed', details: error?.message },
        { status: 500 }
      )
    }
  } catch (error: any) {
    logger.error('Error in job processing endpoint', error)
    return NextResponse.json(
      { error: 'Invalid request', details: error?.message },
      { status: 400 }
    )
  }
}

