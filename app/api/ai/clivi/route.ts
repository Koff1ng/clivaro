import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { CLIVI_SYSTEM_PROMPT } from '@/lib/gemini'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
const MODEL = 'gemini-2.5-flash'

export async function POST(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.VIEW_REPORTS)
  if (session instanceof NextResponse) return session

  try {
    const { message, history, pageContext } = await request.json()

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // Build context-aware prompt
    const contextInfo = pageContext ? `\nEl usuario está actualmente en: ${pageContext}` : ''

    const model = genAI.getGenerativeModel({
      model: MODEL,
      systemInstruction: CLIVI_SYSTEM_PROMPT + contextInfo,
    })

    // Build chat history
    const chatHistory = (history || []).map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }))

    const chat = model.startChat({ history: chatHistory })
    const result = await chat.sendMessage(message)
    const text = result.response.text()

    return NextResponse.json({ reply: text })
  } catch (error: any) {
    console.error('[Clivi] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Clivi tuvo un error 🐙' },
      { status: 500 }
    )
  }
}
