// services/webLLMService.ts
// IA LOCAL no navegador via WebLLM (WebGPU)
// Roda 100% no browser do usuário sem limite de uso, sem rate limit e sem timeout

// @ts-ignore - pacote sem tipos completos
import * as webllm from '@mlc-ai/web-llm';

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

declare global {
    interface Navigator {
        gpu?: any;
    }
}

let engine: any = null;
let currentModel: string | null = null;
let isLoading: boolean = false;
let loadProgress: number = 0;

// Modelos suportados (Llama 3.2 1B, Qwen 2.5 0.5B, SmolLM2 360M)
export const DEFAULT_MODEL = 'Llama-3.2-1B-Instruct-q4f32_1-MLC';
export const FALLBACK_MODEL = 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC';

export type ModelStatus = 'not_loaded' | 'loading' | 'ready' | 'error';

let status: ModelStatus = 'not_loaded';
let statusMessage: string = '';

export function getModelStatus(): { status: ModelStatus; message: string; progress: number; model: string | null } {
    return { status, message: statusMessage, progress: loadProgress, model: currentModel };
}

export function getLocalAIStatus() {
    return getModelStatus();
}

// Carrega o modelo (1.5GB, baixa 1x e cacheia no IndexedDB)
export async function loadModel(modelId: string = DEFAULT_MODEL): Promise<boolean> {
    if (engine && currentModel === modelId) {
        status = 'ready';
        return true;
    }
    if (isLoading) {
        return false;
    }

    isLoading = true;
    status = 'loading';
    statusMessage = `Baixando modelo de IA local ${modelId} (cache no navegador)...`;

    try {
        if (!navigator.gpu) {
            throw new Error('WebGPU não está disponível ou habilitado neste navegador.');
        }

        engine = await webllm.CreateMLCEngine(
            modelId,
            {
                initProgressCallback: (report: any) => {
                    loadProgress = Math.round((report.progress || 0) * 100);
                    statusMessage = `Carregando modelo: ${report.text || ''} (${loadProgress}%)`;
                    console.log(`[WebLLM] ${statusMessage}`);
                }
            }
        );

        currentModel = modelId;
        status = 'ready';
        statusMessage = `Modelo ${modelId} pronto para uso ilimitado!`;
        loadProgress = 100;
        isLoading = false;
        console.log(`[WebLLM] ✅ Modelo local ${modelId} carregado com sucesso!`);
        return true;
    } catch (e: any) {
        console.error('[WebLLM] Erro ao carregar modelo:', e);
        status = 'error';
        statusMessage = e?.message || 'Erro ao carregar modelo WebGPU';
        isLoading = false;

        // Tenta fallback com modelo mais leve se o primário falhar
        if (modelId !== FALLBACK_MODEL) {
            console.log('[WebLLM] Tentando modelo alternativo mais leve...');
            return loadModel(FALLBACK_MODEL);
        }
        return false;
    }
}

// Chama a IA local (ILIMITADA - sem rate limit, sem retry exponencial, sem timeout)
export async function callLocalLLM(
    messages: ChatMessage[],
    options: { temperature?: number; maxTokens?: number } = {}
): Promise<string> {
    // Auto-load do modelo se ainda não foi carregado
    if (!engine) {
        const loaded = await loadModel();
        if (!loaded || !engine) {
            throw new Error('Não foi possível carregar a IA local WebGPU');
        }
    }

    try {
        const reply = await engine.chat.completions.create({
            messages: messages as any,
            temperature: options.temperature ?? 0.7,
            max_tokens: options.maxTokens ?? 4096,
            stream: false
        });

        const content = reply?.choices?.[0]?.message?.content || '';
        console.log(`[WebLLM] ✓ Resposta gerada via IA Local (${content.length} caracteres)`);
        return content;
    } catch (e: any) {
        console.error('[WebLLM] Erro na execução local:', e);
        throw new Error(`Erro na IA local: ${e?.message || 'desconhecido'}`);
    }
}

// Verifica se WebLLM está disponível via WebGPU
export function isWebLLMAvailable(): boolean {
    return typeof navigator !== 'undefined' && Boolean(navigator.gpu);
}

// Modelos suportados especificados no briefing
export function getAvailableModels(): { id: string; name: string; size: string }[] {
    return [
        { id: 'Llama-3.2-1B-Instruct-q4f32_1-MLC', name: 'Llama 3.2 1B (Recomendado)', size: '1.5 GB' },
        { id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC', name: 'Qwen 2.5 0.5B (Ultraleve)', size: '500 MB' },
        { id: 'SmolLM2-360M-Instruct-q4f16_1-MLC', name: 'SmolLM2 360M (Mínimo)', size: '300 MB' }
    ];
}

// Descarrega o modelo para liberar VRAM se necessário
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
        console.log('[WebLLM] Modelo local descarregado');
    }
}

