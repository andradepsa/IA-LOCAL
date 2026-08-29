// functions/hf-proxy.js
// Proxy para HuggingFace — resolve o problema de CORS no redirect
// Quando o WebLLM tenta baixar o modelo, o HF faz redirect 307 que perde os headers CORS.
// Este proxy busca o arquivo no HF e retorna com CORS correto.

export async function onRequest(context) {
    const { request } = context;
    const url = new URL(request.url);

    // Pega o caminho após /hf-proxy
    // Ex: /hf-proxy/mlc-ai/Llama-3.2-1B-Instruct-q4f32_1-MLC/resolve/main/mlc-chat-config.json
    const hfPath = url.pathname.replace(/^\/hf-proxy\/?/, '');

    if (!hfPath) {
        return new Response(JSON.stringify({ error: 'Missing HuggingFace path' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const hfUrl = `https://huggingface.co/${hfPath}`;

    try {
        // Busca no HuggingFace seguindo redirects
        const response = await fetch(hfUrl, {
            method: request.method,
            headers: {
                'User-Agent': 'WebLLM-Proxy/1.0',
                'Accept': '*/*'
            },
            redirect: 'follow'
        });

        if (!response.ok) {
            return new Response(JSON.stringify({
                error: `HuggingFace returned ${response.status}`,
                url: hfUrl
            }), {
                status: response.status,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }

        // Retorna o conteúdo com CORS headers
        const headers = new Headers(response.headers);
        headers.set('Access-Control-Allow-Origin', '*');
        headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        headers.set('Access-Control-Allow-Headers', '*');
        headers.set('Access-Control-Expose-Headers', '*');

        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers
        });
    } catch (error) {
        return new Response(JSON.stringify({
            error: `Proxy error: ${error.message}`,
            url: hfUrl
        }), {
            status: 502,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
}

// CORS preflight
export async function onRequestOptions() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Access-Control-Allow-Headers': '*',
            'Access-Control-Max-Age': '86400'
        }
    });
}
