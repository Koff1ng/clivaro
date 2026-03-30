import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  BaileysEventMap,
  proto,
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import { Server as SocketServer } from 'socket.io'
import * as QRCode from 'qrcode'
import * as path from 'path'
import * as fs from 'fs'
import pino from 'pino'

const logger = pino({ level: 'warn' })

interface SessionState {
  socket: WASocket | null
  status: 'disconnected' | 'connecting' | 'qr' | 'connected'
  qr: string | null // base64 QR image
  phone: string | null
  name: string | null
  messages: Map<string, any[]> // phone -> messages[]
}

export class WhatsAppManager {
  private sessions = new Map<string, SessionState>()
  private io: SocketServer

  constructor(io: SocketServer) {
    this.io = io
  }

  getSessionCount(): number {
    return this.sessions.size
  }

  getStatus(tenantId: string) {
    const session = this.sessions.get(tenantId)
    if (!session) return { status: 'disconnected', qr: null, phone: null, name: null }
    return {
      status: session.status,
      qr: session.qr,
      phone: session.phone,
      name: session.name,
    }
  }

  getMessages(tenantId: string, phone: string): any[] {
    const session = this.sessions.get(tenantId)
    if (!session) return []
    // Normalize phone (remove @s.whatsapp.net)
    const normalized = phone.replace(/[^0-9]/g, '')
    return session.messages.get(normalized) || []
  }

  async sendMessage(tenantId: string, to: string, message: string) {
    const session = this.sessions.get(tenantId)
    if (!session?.socket) throw new Error('Session not connected')
    
    // Normalize phone number
    const jid = to.replace(/[^0-9]/g, '') + '@s.whatsapp.net'
    const result = await session.socket.sendMessage(jid, { text: message })

    // Store outgoing message
    const phone = to.replace(/[^0-9]/g, '')
    if (!session.messages.has(phone)) session.messages.set(phone, [])
    session.messages.get(phone)!.push({
      id: result?.key?.id || Date.now().toString(),
      from: session.phone,
      to: phone,
      content: message,
      direction: 'OUTBOUND',
      timestamp: Date.now(),
      status: 'sent',
    })

    // Emit to frontend
    this.io.to(`tenant:${tenantId}`).emit('message-sent', {
      to: phone,
      content: message,
      messageId: result?.key?.id,
    })

    return result
  }

  async startSession(tenantId: string) {
    // Stop existing if any
    await this.stopSession(tenantId)

    const authDir = path.join(process.cwd(), 'auth-sessions', tenantId)
    if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true })

    const { state, saveCreds } = await useMultiFileAuthState(authDir)

    const session: SessionState = {
      socket: null,
      status: 'connecting',
      qr: null,
      phone: null,
      name: null,
      messages: new Map(),
    }
    this.sessions.set(tenantId, session)
    this.emitStatus(tenantId)

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: logger as any,
      browser: ['Clivaro CRM', 'Chrome', '22.0'],
    })

    session.socket = sock

    // QR code event
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update

      if (qr) {
        try {
          const qrBase64 = await QRCode.toDataURL(qr, { width: 256, margin: 2 })
          session.status = 'qr'
          session.qr = qrBase64
          this.emitStatus(tenantId)
        } catch (err) {
          console.error('QR generation error:', err)
        }
      }

      if (connection === 'open') {
        session.status = 'connected'
        session.qr = null
        session.phone = sock.user?.id?.split(':')[0] || null
        session.name = sock.user?.name || null
        console.log(`✅ [${tenantId}] Connected as ${session.phone} (${session.name})`)
        this.emitStatus(tenantId)
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut
        console.log(`❌ [${tenantId}] Disconnected (code: ${statusCode})`)
        
        session.status = 'disconnected'
        session.qr = null
        this.emitStatus(tenantId)

        if (shouldReconnect) {
          console.log(`🔄 [${tenantId}] Reconnecting...`)
          setTimeout(() => this.startSession(tenantId), 3000)
        } else {
          // Logged out: clean auth
          try { fs.rmSync(authDir, { recursive: true }) } catch {}
          this.sessions.delete(tenantId)
        }
      }
    })

    sock.ev.on('creds.update', saveCreds)

    // Incoming messages
    sock.ev.on('messages.upsert', ({ messages: msgs, type }) => {
      if (type !== 'notify') return

      for (const msg of msgs) {
        if (!msg.message || msg.key.fromMe) continue

        const phone = msg.key.remoteJid?.replace('@s.whatsapp.net', '') || ''
        if (!phone || phone.includes('@g.us')) continue // Skip groups

        const content = msg.message?.conversation 
          || msg.message?.extendedTextMessage?.text 
          || '[media]'

        const messageData = {
          id: msg.key.id,
          from: phone,
          to: session.phone,
          content,
          direction: 'INBOUND',
          timestamp: (msg.messageTimestamp as number) * 1000 || Date.now(),
          status: 'received',
          pushName: msg.pushName || phone,
        }

        // Store message
        if (!session.messages.has(phone)) session.messages.set(phone, [])
        session.messages.get(phone)!.push(messageData)

        // Emit to frontend in real-time
        this.io.to(`tenant:${tenantId}`).emit('message-received', messageData)

        console.log(`📩 [${tenantId}] ${msg.pushName || phone}: ${content.substring(0, 50)}`)
      }
    })
  }

  async stopSession(tenantId: string) {
    const session = this.sessions.get(tenantId)
    if (session?.socket) {
      try { session.socket.end(undefined) } catch {}
      session.socket = null
    }
    if (session) {
      session.status = 'disconnected'
      session.qr = null
      this.emitStatus(tenantId)
    }
  }

  private emitStatus(tenantId: string) {
    const status = this.getStatus(tenantId)
    this.io.to(`tenant:${tenantId}`).emit('session-status', status)
  }
}
