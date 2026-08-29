// services/webLLMService.ts
// IA LOCAL no navegador via WebLLM (WebGPU)
// Substitui a dependência da Z.ai — roda 100% no browser do usuário

// @ts-ignore - pacote sem tipos completos
import * as webllm from '@mlc-ai/web-llm';

// Tipo local (não depende de geminiService)
interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

// Declare navigator.gpu (WebGPU API)
declare global {
    interface Navigator {
        gpu?: any;
    }
}

let engine: any = null;
let currentModel: string | null = null;
let isLoading: boolean = false;
let loadProgress: number = 0;

// Modelo pequeno que cabe no browser (1.5GB, baixa 1x e cacheia)
const DEFAULT_MODEL = 'Llama-3.2-1B-Instruct-q4f32_1-MLC';
const FALLBACK_MODEL = 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC';

// Estado do carregamento
export type ModelStatus = 'not_loaded' | 'loading' | 'ready' | 'error';

let status: ModelStatus = 'not_loaded';
let statusMessage: string = '';

export function getModelStatus(): { status: ModelStatus; message: string; progress: number } {
    return { status, message: statusMessage, progress: loadProgress };
}

// Alias pra compatibilidade com App.tsx
export function getLocalAIStatus() {
    return getModelStatus();
}

// Carrega o modelo (baixa 1x, cacheia no IndexedDB)
export async function loadModel(modelId: string = DEFAULT_MODEL): Promise<boolean> {
    if (engine && currentModel === modelId) {
        return true;
    }
    if (isLoading) {
        return false;
    }

    isLoading = true;
    status = 'loading';
    statusMessage = 'Baixando modelo de IA local (1.5GB, só 1x)...';

    try {
        // Verifica WebGPU
        if (!navigator.gpu) {
            throw new Error('WebGPU não disponível neste navegador');
        }

        // Cria engine
        engine = await webllm.CreateMLCEngine(
            modelId,
            {
                initProgressCallback: (report: any) => {
                    loadProgress = Math.round(report.progress * 100);
                    statusMessage = `Carregando: ${report.text || ''} (${loadProgress}%)`;
                    console.log(`[WebLLM] ${statusMessage}`);
                }
            }
        );

        currentModel = modelId;
        status = 'ready';
        statusMessage = 'Modelo pronto!';
        loadProgress = 100;
        isLoading = false;
        console.log(`[WebLLM] ✅ Modelo ${modelId} carregado!`);
        return true;
    } catch (e: any) {
        console.error('[WebLLM] Erro ao carregar modelo:', e);
        status = 'error';
        statusMessage = e?.message || 'Erro ao carregar modelo';
        isLoading = false;

        // Tenta fallback com modelo menor
        if (modelId !== FALLBACK_MODEL) {
            console.log('[WebLLM] Tentando modelo menor...');
            return loadModel(FALLBACK_MODEL);
        }
        return false;
    }
}

// Chama a IA local
export async function callLocalLLM(
    messages: ChatMessage[],
    options: { temperature?: number; maxTokens?: number } = {}
): Promise<string> {
    if (!engine) {
        const loaded = await loadModel();
        if (!loaded) {
            throw new Error('Não foi possível carregar a IA local');
        }
    }

    try {
        const reply = await engine.chat.completions.create({
            messages: messages as any,
            temperature: options.temperature ?? 0.7,
            max_tokens: options.maxTokens ?? 2000,
            stream: false
        });

        const content = reply?.choices?.[0]?.message?.content || '';
        console.log(`[WebLLM] ✓ Resposta gerada (${content.length} chars)`);
        return content;
    } catch (e: any) {
        console.error('[WebLLM] Erro na inferência:', e);
        throw new Error(`Erro na IA local: ${e?.message || 'desconhecido'}`);
    }
}

// Verifica se WebLLM está disponível
export function isWebLLMAvailable(): boolean {
    return typeof navigator !== 'undefined' && !!navigator.gpu;
}

// Lista modelos disponíveis
export function getAvailableModels(): { id: string; name: string; size: string }[] {
    return [
        { id: 'Llama-3.2-1B-Instruct-q4f32_1-MLC', name: 'Llama 3.2 1B', size: '1.5 GB' },
        { id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC', name: 'Qwen 2.5 0.5B', size: '500 MB' },
        { id: 'SmolLM2-360M-Instruct-q4f16_1-MLC', name: 'SmolLM2 360M', size: '300 MB' },
        { id: 'gemma-2b-it-q4f16_1-MLC', name: 'Gemma 2B', size: '2.5 GB' }
    ];
}

// Descarrega o modelo (libera memória)
export async function unloadModel(): Promise<void> {
    if (engine) {
        try {
            await engine.unload();
        } catch {}
        engine = null;
        currentModel = null;
        status = 'not_loaded';
        statusMessage = '';
        loadProgress = 0;
        console.log('[WebLLM] Modelo descarregado');
    }
}
