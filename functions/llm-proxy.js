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

        // Prioridade 1: env.ZAI_API_KEY / env.GEMINI_API_KEY / env.GROQ_API_KEY
        // Prioridade 2: headers do frontend (X-ZAI-API-Key, X-Gemini-API-Key, X-Groq-API-Key)
        const zaiApiKey = env.ZAI_API_KEY || request.headers.get('X-ZAI-API-Key') || '';
        const geminiApiKey = env.GEMINI_API_KEY || request.headers.get('X-Gemini-API-Key') || '';
        const groqApiKey = env.GROQ_API_KEY || request.headers.get('X-Groq-API-Key') || '';

        // Se o modelo ou chave for Gemini:
        if (geminiApiKey || (model && model.toLowerCase().includes('gemini'))) {
            try {
                const geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
                const geminiRes = await fetch(geminiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${geminiApiKey}`
                    },
                    body: JSON.stringify({
                        model: 'gemini-2.5-flash',
                        messages,
                        temperature: typeof temperature === 'number' ? temperature : 0.7,
                        max_tokens: typeof maxTokens === 'number' ? maxTokens : 8192,
                        response_format: json ? { type: 'json_object' } : undefined
                    })
                });

                if (geminiRes.ok) {
                    const geminiData = await geminiRes.json();
                    const content = geminiData?.choices?.[0]?.message?.content || '';
                    if (content) {
                        return new Response(JSON.stringify({ content, model: 'gemini-2.5-flash' }), {
                            status: 200,
                            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
                        });
                    }
                }
            } catch (gErr) {
                console.warn('Gemini attempt failed in Cloudflare function:', gErr);
            }
        }

        // Se o modelo ou chave for Groq:
        if (groqApiKey || (model && model.toLowerCase().includes('llama'))) {
            try {
                const groqUrl = 'https://api.groq.com/openai/v1/chat/completions';
                const groqRes = await fetch(groqUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${groqApiKey}`
                    },
                    body: JSON.stringify({
                        model: 'llama-3.3-70b-versatile',
                        messages,
                        temperature: typeof temperature === 'number' ? temperature : 0.7,
                        max_tokens: typeof maxTokens === 'number' ? maxTokens : 8192,
                        response_format: json ? { type: 'json_object' } : undefined
                    })
                });

                if (groqRes.ok) {
                    const groqData = await groqRes.json();
                    const content = groqData?.choices?.[0]?.message?.content || '';
                    if (content) {
                        return new Response(JSON.stringify({ content, model: 'llama-3.3-70b-versatile' }), {
                            status: 200,
                            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
                        });
                    }
                }
            } catch (grErr) {
                console.warn('Groq attempt failed in Cloudflare function:', grErr);
            }
        }

        const apiKey = zaiApiKey;
        const baseUrl = env.ZAI_BASE_URL || DEFAULT_BASE_URL;

        if (!apiKey) {
            return new Response(JSON.stringify({
                error: 'Nenhuma API key de IA configurada. Cole sua Z.ai, Gemini ou Groq API Key no menu de configurações ⚙️ do app.'
            }), {
                status: 401,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
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
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-ZAI-API-Key, X-Gemini-API-Key, X-Groq-API-Key'
        }
    });
}
