// services/learningBrain.ts
// CÉREBRO QUE APRENDE — inspirado no CEREBROS
// Memória evolutiva: lembra quais prompts/tópicos geraram papers melhores
// e ajusta futuras gerações baseado no histórico.

interface PaperMemory {
    id: string;
    title: string;
    discipline: string;
    topic: string;
    model: string;
    score: number; // 0-10, qualidade estimada
    published: boolean;
    date: string;
    promptSnippet: string; // primeiros 200 chars do prompt usado
    successfulPhrases: string[]; // frases que apareceram em papers bons
}

interface BrainStats {
    totalPapers: number;
    publishedPapers: number;
    averageScore: number;
    bestDiscipline: string;
    bestModel: string;
    successfulPhrases: string[];
    failedTopics: string[];
}

const MEMORY_KEY = 'brain_memory_v1';
const STATS_KEY = 'brain_stats_v1';

// Carrega memória
function loadMemory(): PaperMemory[] {
    try {
        const stored = localStorage.getItem(MEMORY_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

// Salva memória
function saveMemory(memory: PaperMemory[]): void {
    try {
        // Manter apenas os últimos 100 papers na memória
        const trimmed = memory.slice(-100);
        localStorage.setItem(MEMORY_KEY, JSON.stringify(trimmed));
    } catch (e) {
        console.warn('Erro ao salvar memória:', e);
    }
}

// Carrega stats
function loadStats(): BrainStats {
    try {
        const stored = localStorage.getItem(STATS_KEY);
        if (stored) return JSON.parse(stored);
    } catch {}
    return {
        totalPapers: 0,
        publishedPapers: 0,
        averageScore: 0,
        bestDiscipline: '',
        bestModel: '',
        successfulPhrases: [],
        failedTopics: []
    };
}

// Salva stats
function saveStats(stats: BrainStats): void {
    try {
        localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    } catch (e) {
        console.warn('Erro ao salvar stats:', e);
    }
}

// Registra um paper na memória
export function registerPaper(paper: {
    title: string;
    discipline: string;
    topic: string;
    model: string;
    published: boolean;
    score?: number;
}): void {
    const memory = loadMemory();
    const stats = loadStats();

    const entry: PaperMemory = {
        id: crypto.randomUUID(),
        title: paper.title,
        discipline: paper.discipline,
        topic: paper.topic,
        model: paper.model,
        score: paper.score || (paper.published ? 7 : 3),
        published: paper.published,
        date: new Date().toISOString(),
        promptSnippet: `${paper.discipline}: ${paper.topic}`.slice(0, 200),
        successfulPhrases: paper.published ? extractPhrases(paper.title) : []
    };

    memory.push(entry);
    saveMemory(memory);

    // Atualiza stats
    stats.totalPapers = memory.length;
    stats.publishedPapers = memory.filter(p => p.published).length;
    stats.averageScore = memory.reduce((s, p) => s + p.score, 0) / memory.length;

    // Melhor disciplina (mais publicada)
    const discCount: Record<string, number> = {};
    memory.filter(p => p.published).forEach(p => {
        discCount[p.discipline] = (discCount[p.discipline] || 0) + 1;
    });
    stats.bestDiscipline = Object.entries(discCount)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || '';

    // Melhor modelo (mais publicado)
    const modelCount: Record<string, number> = {};
    memory.filter(p => p.published).forEach(p => {
        modelCount[p.model] = (modelCount[p.model] || 0) + 1;
    });
    stats.bestModel = Object.entries(modelCount)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || '';

    // Frases bem-sucedidas (top 20)
    const allPhrases = memory
        .filter(p => p.published && p.score >= 7)
        .flatMap(p => p.successfulPhrases);
    stats.successfulPhrases = [...new Set(allPhrases)].slice(0, 20);

    // Tópicos que falharam
    stats.failedTopics = memory
        .filter(p => !p.published)
        .map(p => p.topic)
        .slice(-10);

    saveStats(stats);

    console.log(`[CÉREBRO] Paper registrado. Total: ${stats.totalPapers}, Publicados: ${stats.publishedPapers}`);
}

// Extrai frases-chave de um título (para aprender padrões)
function extractPhrases(title: string): string[] {
    const words = title.split(/\s+/).filter(w => w.length > 4);
    return words.slice(0, 5);
}

// Gera um prompt enriquecido com o que o cérebro aprendeu
export function getEnrichedPrompt(discipline: string, topic: string): string {
    const stats = loadStats();
    const memory = loadMemory();

    let enrichment = '';

    // Se já temos papers bons nesta disciplina, usar como referência
    const goodPapersInDiscipline = memory.filter(
        p => p.discipline === discipline && p.published && p.score >= 7
    );

    if (goodPapersInDiscipline.length > 0) {
        const best = goodPapersInDiscipline[goodPapersInDiscipline.length - 1];
        enrichment += `\n\nREFERENCE: A successful paper in ${discipline} was titled "${best.title}". Follow a similar academic tone and structure.`;
    }

    // Adicionar frases bem-sucedidas
    if (stats.successfulPhrases.length > 0) {
        enrichment += `\n\nACADEMIC VOCABULARY (use similar terms): ${stats.successfulPhrases.slice(0, 10).join(', ')}`;
    }

    // Evitar tópicos que falharam
    if (stats.failedTopics.length > 0) {
        enrichment += `\n\nAVOID: ${stats.failedTopics.slice(0, 3).join('; ')}`;
    }

    return enrichment;
}

// Retorna stats do cérebro (para exibição na UI)
export function getBrainStats(): BrainStats {
    return loadStats();
}

// Retorna os últimos N papers da memória
export function getRecentPapers(n: number = 10): PaperMemory[] {
    const memory = loadMemory();
    return memory.slice(-n).reverse();
}

// Reseta a memória (útil para testes)
export function resetBrain(): void {
    localStorage.removeItem(MEMORY_KEY);
    localStorage.removeItem(STATS_KEY);
    console.log('[CÉREBRO] Memória resetada.');
}

// Escolhe o melhor modelo baseado no histórico
export function getBestModel(): string {
    const stats = loadStats();
    if (stats.bestModel) {
        console.log(`[CÉREBRO] Modelo recomendado: ${stats.bestModel}`);
        return stats.bestModel;
    }
    return 'glm-5.3'; // padrão
}

// Verifica se um tópico já falhou antes
export function hasTopicFailedBefore(topic: string): boolean {
    const stats = loadStats();
    return stats.failedTopics.some(t => t.includes(topic) || topic.includes(t));
}
