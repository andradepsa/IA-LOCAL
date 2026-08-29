/**
 * Cloudflare Pages Function — /llm-proxy
 *
 * Endpoint que recebe chamadas do frontend e as repassa para a API da Z.ai
 * (OpenAI-compatible) usando a API key do usuário (configurada no ⚙️ do app).
 *
 * O frontend envia:
 *   POST /llm-proxy
 *   { "model": "glm-4.6", "messages": [...], "temperature": 0.7, "maxTokens": 8000, "json": false }
 *
 * O proxy retorna:
 *   { "content": "...", "model": "glm-4.6" }
 *
 * Alternativamente, se a variável de ambiente ZAI_API_KEY estiver configurada
 * no Cloudflare Pages (Settings → Environment variables), o proxy usa essa key
 * e o usuário não precisa configurar nada no frontend.
 */

const DEFAULT_BASE_URL = 'https://api.z.ai/api/paas/v4';

function mapModel(requested) {
    const m = (requested || '').toLowerCase();
    if (m.includes('glm-5.3-flash') || m.includes('glm-5-3-flash')) return 'glm-5.3-flash';
    if (m.includes('glm-5.3') || m.includes('glm-5-3')) return 'glm-5.3';
    if (m.includes('glm-5.2-flash')) return 'glm-5.2-flash';
    if (m.includes('glm-5.2')) return 'glm-5.2';
    if (m.includes('glm-5-flash')) return 'glm-5-flash';
    if (m.includes('glm-5')) return 'glm-5';
    if (m.includes('glm-4.5v') || m.includes('glm-4-5v')) return 'glm-4.5v';
    if (m.includes('glm-4.5-air') || m.includes('air')) return 'glm-4.5-air';
    if (m.includes('glm-4.5')) return 'glm-4.5';
    if (m.includes('glm-4.6')) return 'glm-4.6';
    if (m.includes('flash')) return 'glm-5.3-flash';
    return 'glm-5.3';
}

export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const body = await request.json();
        const { messages, temperature, maxTokens, model, json } = body;

        if (!Array.isArray(messages) || messages.length === 0) {
            return new Response(JSON.stringify({ error: 'messages array is required.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Prioridade 1: env.ZAI_API_KEY (configurada no Cloudflare Pages dashboard)
        // Prioridade 2: header X-ZAI-API-Key (enviado pelo frontend com a key do usuário)
        const apiKey = env.ZAI_API_KEY || request.headers.get('X-ZAI-API-Key') || '';
        const baseUrl = env.ZAI_BASE_URL || DEFAULT_BASE_URL;

        if (!apiKey) {
            return new Response(JSON.stringify({
                error: 'Nenhuma API key configurada. Defina ZAI_API_KEY nas variáveis de ambiente do Cloudflare Pages, ou cole sua key no modal ⚙️ do app.'
            }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const realModel = mapModel(model || 'glm-5.3');

        const completionParams = {
            model: realModel,
            messages,
            temperature: typeof temperature === 'number' ? temperature : 0.7,
            max_tokens: typeof maxTokens === 'number' ? maxTokens : 8192,
            stream: false
        };
        if (json === true) {
            completionParams.response_format = { type: 'json_object' };
        }

        // Retry com backoff exponencial para rate limit (429)
        let lastError = null;
        let completion = null;

        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify(completionParams)
                });

                if (!response.ok) {
                    const errText = await response.text();
                    const is429 = response.status === 429 || errText.includes('Too many requests');
                    if (!is429 || attempt === 3) {
                        return new Response(JSON.stringify({
                            error: `API error (${response.status}): ${errText.slice(0, 500)}`
                        }), {
                            status: response.status,
                            headers: { 'Content-Type': 'application/json' }
                        });
                    }
                    // 429 → espera e tenta de novo
                    const waitMs = 5000 * Math.pow(2, attempt - 1);
                    console.log(`[llm-proxy] 429, aguardando ${waitMs}ms (tentativa ${attempt}/3)...`);
                    await new Promise(r => setTimeout(r, waitMs));
                    continue;
                }

                completion = await response.json();
                break;
            } catch (e) {
                lastError = e;
                if (attempt === 3) break;
                await new Promise(r => setTimeout(r, 2000 * attempt));
            }
        }

        if (!completion) {
            return new Response(JSON.stringify({
                error: `LLM request failed: ${lastError?.message || 'unknown error'}`
            }), {
                status: 502,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const content = completion?.choices?.[0]?.message?.content || '';
        return new Response(JSON.stringify({ content, model: realModel }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('llm-proxy error:', error);
        return new Response(JSON.stringify({
            error: `Proxy error: ${error?.message || String(error)}`
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// CORS preflight
export async function onRequestOptions() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-ZAI-API-Key'
        }
    });
}
