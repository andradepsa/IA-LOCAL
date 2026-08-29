// services/llmHub.ts
// HUB de IA — rotação entre múltiplos providers para maximizar capacidade
// Suporta: Z.ai (embutido via /llm-proxy), Google Gemini, Groq

export interface LlmProvider {
    name: string;
    available: boolean;
    lastError?: string;
    lastSuccess?: number;
}

let providersState: LlmProvider[] = [
    { name: 'zai', available: true },
    { name: 'gemini', available: true },
    { name: 'groq', available: true }
];

export function getProvidersState(): LlmProvider[] {
    return providersState;
}

export function markProviderFailed(name: string, error: string) {
    const p = providersState.find(x => x.name === name);
    if (p) {
        p.available = false;
        p.lastError = error;
    }
}

export function markProviderSuccess(name: string) {
    const p = providersState.find(x => x.name === name);
    if (p) {
        p.available = true;
        p.lastSuccess = Date.now();
        p.lastError = undefined;
    }
}

// Modelos por provider
const PROVIDER_MODELS: Record<string, string[]> = {
    zai: ['glm-5.3', 'glm-5.3-flash', 'glm-5.2'],
    gemini: ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.0-flash'],
    groq: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768']
};

const PROVIDER_BASE_URLS: Record<string, string> = {
    gemini: 'https://generativelanguage.googleapis.com/v1beta/openai',
    groq: 'https://api.groq.com/openai/v1'
};

interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

interface CallOptions {
    temperature?: number;
    maxTokens?: number;
    responseFormat?: 'text' | 'json';
}

// Tenta chamar cada provider disponível, na ordem: zai → gemini → groq
export async function callLLMWithHub(
    model: string,
    messages: ChatMessage[],
    options: CallOptions = {}
): Promise<{ content: string; provider: string; model: string }> {
    const errors: string[] = [];

    // Provider 1: Z.ai (via /llm-proxy — embutido no sandbox)
    const zaiProvider = providersState.find(p => p.name === 'zai');
    if (zaiProvider?.available) {
        try {
            const r = await fetch('/llm-proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model,
                    messages,
                    temperature: options.temperature,
                    maxTokens: options.maxTokens,
                    json: options.responseFormat === 'json'
                })
            });
            if (r.ok) {
                const d = await r.json();
                if (d?.content) {
                    markProviderSuccess('zai');
                    return { content: d.content, provider: 'zai', model: d.model || model };
                }
            }
            const errText = await r.text();
            throw new Error(`Z.ai HTTP ${r.status}: ${errText.slice(0, 200)}`);
        } catch (e: any) {
            errors.push(`Z.ai: ${e.message}`);
            markProviderFailed('zai', e.message);
        }
    }

    // Provider 2: Google Gemini
    const geminiProvider = providersState.find(p => p.name === 'gemini');
    const geminiKey = localStorage.getItem('gemini_api_key');
    if (geminiProvider?.available && geminiKey) {
        try {
            const geminiModel = PROVIDER_MODELS.gemini[0];
            const body: any = {
                model: geminiModel,
                messages,
                temperature: options.temperature ?? 0.7,
                max_tokens: options.maxTokens ?? 8000,
                stream: false
            };
            if (options.responseFormat === 'json') {
                body.response_format = { type: 'json_object' };
            }
            const r = await fetch(`${PROVIDER_BASE_URLS.gemini}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${geminiKey}`
                },
                body: JSON.stringify(body)
            });
            if (r.ok) {
                const d = await r.json();
                const content = d?.choices?.[0]?.message?.content;
                if (content) {
                    markProviderSuccess('gemini');
                    return { content, provider: 'gemini', model: geminiModel };
                }
            }
            const errText = await r.text();
            throw new Error(`Gemini HTTP ${r.status}: ${errText.slice(0, 200)}`);
        } catch (e: any) {
            errors.push(`Gemini: ${e.message}`);
            markProviderFailed('gemini', e.message);
        }
    }

    // Provider 3: Groq
    const groqProvider = providersState.find(p => p.name === 'groq');
    const groqKey = localStorage.getItem('groq_api_key');
    if (groqProvider?.available && groqKey) {
        try {
            const groqModel = PROVIDER_MODELS.groq[0];
            const body: any = {
                model: groqModel,
                messages,
                temperature: options.temperature ?? 0.7,
                max_tokens: options.maxTokens ?? 8000,
                stream: false
            };
            if (options.responseFormat === 'json') {
                body.response_format = { type: 'json_object' };
            }
            const r = await fetch(`${PROVIDER_BASE_URLS.groq}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${groqKey}`
                },
                body: JSON.stringify(body)
            });
            if (r.ok) {
                const d = await r.json();
                const content = d?.choices?.[0]?.message?.content;
                if (content) {
                    markProviderSuccess('groq');
                    return { content, provider: 'groq', model: groqModel };
                }
            }
            const errText = await r.text();
            throw new Error(`Groq HTTP ${r.status}: ${errText.slice(0, 200)}`);
        } catch (e: any) {
            errors.push(`Groq: ${e.message}`);
            markProviderFailed('groq', e.message);
        }
    }

    // Todos falharam — reseta disponibilidade pra próxima tentativa
    providersState.forEach(p => { p.available = true; });
    throw new Error(`Todos os providers falharam:\n${errors.join('\n')}`);
}

// Health check do HUB
export async function checkHubHealth(): Promise<{ ok: boolean; providers: LlmProvider[] }> {
    const zaiOk = await checkZai();
    const geminiKey = localStorage.getItem('gemini_api_key');
    const groqKey = localStorage.getItem('groq_api_key');

    return {
        ok: zaiOk || !!geminiKey || !!groqKey,
        providers: [
            { name: 'zai', available: zaiOk },
            { name: 'gemini', available: !!geminiKey },
            { name: 'groq', available: !!groqKey }
        ]
    };
}

async function checkZai(): Promise<boolean> {
    try {
        const r = await fetch('/llm-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'glm-5.3',
                messages: [{ role: 'user', content: 'OK' }],
                maxTokens: 5
            })
        });
        return r.ok;
    } catch {
        return false;
    }
}
