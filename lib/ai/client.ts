import Groq from 'groq-sdk';

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

export type AIModelMode = 'fast' | 'smart';

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

const MODELS = {
    smart: 'llama-3.3-70b-versatile',
    fast: 'llama-3.1-8b-instant',
};

/**
 * Wrapper for Groq SDK with support for fast/smart models and multi-turn chat.
 */
export const aiClient = {
    /**
     * Simple one-off completion
     */
    async complete(prompt: string, mode: AIModelMode = 'fast', systemPrompt?: string) {
        const messages: ChatMessage[] = [];
        if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
        messages.push({ role: 'user', content: prompt });

        const completion = await groq.chat.completions.create({
            messages,
            model: MODELS[mode],
            temperature: 0.5,
            max_tokens: 1024,
        });

        return completion.choices[0]?.message?.content || '';
    },

    /**
     * Multi-turn chat
     */
    async chat(history: ChatMessage[], mode: AIModelMode = 'smart') {
        const completion = await groq.chat.completions.create({
            messages: history,
            model: MODELS[mode],
            temperature: 0.7,
            max_tokens: 2048,
        });

        return completion.choices[0]?.message?.content || '';
    }
};
