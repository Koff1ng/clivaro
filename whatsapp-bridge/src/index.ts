import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { Server as SocketServer } from 'socket.io'
import { WhatsAppManager } from './whatsapp-manager'

const PORT = parseInt(process.env.PORT || '3001')
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000'
const API_SECRET = process.env.BRIDGE_SECRET || 'dev-secret-change-me'

const app = express()
app.use(cors({ origin: CORS_ORIGIN, credentials: true }))
app.use(express.json())

const httpServer = createServer(app)
const io = new SocketServer(httpServer, {
  cors: { origin: CORS_ORIGIN, credentials: true }
})

// Multi-tenant WhatsApp sessions
const manager = new WhatsAppManager(io)

// Auth middleware
function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = req.headers['x-bridge-secret'] as string
  if (token !== API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}

// ─── REST API ─────────────────────────────────────────────

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', sessions: manager.getSessionCount() })
})

// Get session status
app.get('/api/sessions/:tenantId', requireAuth, (req, res) => {
  const status = manager.getStatus(req.params.tenantId)
  res.json(status)
})

// Start session (triggers QR generation)
app.post('/api/sessions/:tenantId/start', requireAuth, async (req, res) => {
  try {
    await manager.startSession(req.params.tenantId)
    res.json({ status: 'starting', message: 'QR code will be emitted via WebSocket' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// Stop session
app.post('/api/sessions/:tenantId/stop', requireAuth, async (req, res) => {
  await manager.stopSession(req.params.tenantId)
  res.json({ status: 'stopped' })
})

// Send text message
app.post('/api/sessions/:tenantId/send', requireAuth, async (req, res) => {
  const { to, message } = req.body
  if (!to || !message) return res.status(400).json({ error: 'to and message required' })
  
  try {
    const result = await manager.sendMessage(req.params.tenantId, to, message)
    res.json({ success: true, messageId: result?.key?.id })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// Get recent messages for a phone
app.get('/api/sessions/:tenantId/messages/:phone', requireAuth, (req, res) => {
  const messages = manager.getMessages(req.params.tenantId, req.params.phone)
  res.json(messages)
})

// ─── WebSocket ────────────────────────────────────────────

io.use((socket, next) => {
  const secret = socket.handshake.auth?.secret
  if (secret !== API_SECRET) {
    return next(new Error('Unauthorized'))
  }
  next()
})

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id)

  socket.on('join-tenant', (tenantId: string) => {
    socket.join(`tenant:${tenantId}`)
    const status = manager.getStatus(tenantId)
    socket.emit('session-status', status)
  })

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id)
  })
})

// ─── Start ────────────────────────────────────────────────

httpServer.listen(PORT, () => {
  console.log(`🟢 WhatsApp Bridge running on port ${PORT}`)
  console.log(`   CORS: ${CORS_ORIGIN}`)
})
