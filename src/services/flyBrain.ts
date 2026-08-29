// services/flyBrain.ts
// CÉREBRO DA MOSCA SIMPLIFICADO — inspirado no connectoma da Drosophila
// (FlyWire/Janelia — 140k neurônios, 54M sinapses)
//
// Não simula o cérebro real (precisaria de 30GB RAM + GPU A100).
// Em vez disso, captura a IDEIA: regiões especializadas que aprendem
// com a experiência e evoluem pesos sinápticos ao longo do tempo.

// =========================================================================
// REGIÕES CEREBRAIS (inspiradas na Drosophila)
// =========================================================================

type RegionName = 'antenna' | 'mushroom_body' | 'central_complex' | 'fan_shaped_body' | 'protocerebral_bridge';

interface Region {
    name: RegionName;
    description: string;
    weights: Record<string, number>;  // pesos sinápticos (aprendidos)
    activity: number;                  // nível de ativação atual
    lastFired: number;                  // timestamp da última ativação
}

// Regiões especializadas (como na mosca):
// - antenna (antena): detecta tópicos/estímulos sensoriais
// - mushroom_body (corpo cogumelar): memória de associação (mosca aprende odores)
// - central_complex (corpo central): navegação/tomada de decisão
// - fan_shaped_body: integração sensorimotora
// - protocerebral_bridge: coordenação motora
const REGIONS_INIT: Record<RegionName, Region> = {
    antenna: {
        name: 'antenna',
        description: 'Detecção de estímulos (tópicos)',
        weights: { topic_relevance: 0.5, novelty: 0.5, complexity: 0.3 },
        activity: 0,
        lastFired: 0
    },
    mushroom_body: {
        name: 'mushroom_body',
        description: 'Memória associativa (aprendizado)',
        weights: { success_rate: 0.5, model_memory: 0.4, prompt_memory: 0.4 },
        activity: 0,
        lastFired: 0
    },
    central_complex: {
        name: 'central_complex',
        description: 'Tomada de decisão (qual modelo usar)',
        weights: { glm_5_3: 0.6, glm_5_3_flash: 0.5, glm_5_2: 0.4 },
        activity: 0,
        lastFired: 0
    },
    fan_shaped_body: {
        name: 'fan_shaped_body',
        description: 'Integração (monta o paper)',
        weights: { structure_quality: 0.5, latex_validity: 0.6 },
        activity: 0,
        lastFired: 0
    },
    protocerebral_bridge: {
        name: 'protocerebral_bridge',
        description: 'Coordenação (loop de geração)',
        weights: { pace: 0.5, retry_patience: 0.4 },
        activity: 0,
        lastFired: 0
    }
};

// =========================================================================
// ESTADO DO CÉREBRO
// =========================================================================

interface BrainState {
    regions: Record<RegionName, Region>;
    generations: number;       // quantos papers já processou
    dopamine: number;          // recompensa acumulada (0-1)
    serotonin: number;         // satisfação (0-1)
    learningRate: number;      // plasticidade (cai com a idade)
    age: number;               // idade em "gerações"
}

const BRAIN_KEY = 'fly_brain_v1';

function loadBrain(): BrainState {
    try {
        const stored = localStorage.getItem(BRAIN_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            // Mescla com defaults (pra caso de novos campos)
            return {
                regions: { ...REGIONS_INIT, ...parsed.regions },
                generations: parsed.generations || 0,
                dopamine: parsed.dopamine || 0.5,
                serotonin: parsed.serotonin || 0.5,
                learningRate: parsed.learningRate || 0.3,
                age: parsed.age || 0
            };
        }
    } catch {}
    return {
        regions: JSON.parse(JSON.stringify(REGIONS_INIT)),
        generations: 0,
        dopamine: 0.5,
        serotonin: 0.5,
        learningRate: 0.3,
        age: 0
    };
}

function saveBrain(brain: BrainState): void {
    try {
        localStorage.setItem(BRAIN_KEY, JSON.stringify(brain));
    } catch (e) {
        console.warn('[FLY-BRAIN] Erro ao salvar:', e);
    }
}

// =========================================================================
// PROCESSAMENTO (simulação de "pensamento")
// =========================================================================

// Estímulos sensoriais: o cérebro "vê" o tópico e disciplina
function stimulateAntenna(brain: BrainState, topic: string, discipline: string): number {
    const region = brain.regions.antenna;
    // Tópicos mais longos/complexos = mais ativação
    const complexity = Math.min(1, topic.length / 100);
    const novelty = Math.random() * 0.3 + 0.5;  // base + aleatório

    region.activity = complexity * region.weights.complexity + novelty * region.weights.novelty;
    region.lastFired = Date.now();
    return region.activity;
}

// Memória associativa: o cérebro "lembra" se já viu algo parecido
function recallMemory(brain: BrainState, topic: string, discipline: string): { shouldUse: boolean; confidence: number } {
    const region = brain.regions.mushroom_body;
    // Simula: se dopamine alto, lembra de associações boas
    const confidence = brain.dopamine * region.weights.success_rate + 0.3;
    region.activity = confidence;
    region.lastFired = Date.now();
    return { shouldUse: confidence > 0.5, confidence };
}

// Tomada de decisão: qual modelo usar?
function decideModel(brain: BrainState): string {
    const region = brain.regions.central_complex;
    const weights = region.weights;

    // Pega o modelo com maior peso
    const models = [
        { name: 'glm-5.3', weight: weights.glm_5_3 || 0.5 },
        { name: 'glm-5.3-flash', weight: weights.glm_5_3_flash || 0.5 },
        { name: 'glm-5.2', weight: weights.glm_5_2 || 0.4 }
    ];

    // Adiciona exploração (epsilon-greedy) — às vezes tenta algo novo
    if (Math.random() < 0.2) {
        const random = models[Math.floor(Math.random() * models.length)];
        region.activity = random.weight;
        region.lastFired = Date.now();
        return random.name;
    }

    // Senão, explora o melhor
    models.sort((a, b) => b.weight - a.weight);
    region.activity = models[0].weight;
    region.lastFired = Date.now();
    return models[0].name;
}

// Integração: verifica se o paper montado é válido
function evaluatePaper(brain: BrainState, latexCode: string): { quality: number; isValid: boolean } {
    const region = brain.regions.fan_shaped_body;

    const hasBegin = latexCode.includes('\\begin{document}');
    const hasEnd = latexCode.includes('\\end{document}');
    const hasTitle = latexCode.includes('\\title{');
    const hasAbstract = latexCode.includes('\\begin{abstract}');
    const length = latexCode.length;

    let score = 0;
    if (hasBegin) score += 0.2;
    if (hasEnd) score += 0.2;
    if (hasTitle) score += 0.2;
    if (hasAbstract) score += 0.2;
    if (length > 3000) score += 0.2;  // paper substancial

    const quality = score * region.weights.structure_quality;
    const isValid = hasBegin && hasEnd && hasTitle;

    region.activity = quality;
    region.lastFired = Date.now();

    return { quality, isValid };
}

// =========================================================================
// APRENDIZADO (atualização de pesos sinápticos)
// =========================================================================

// Reforço: quando um paper dá certo, fortalece conexões
function reinforce(brain: BrainState, success: boolean, modelUsed: string): void {
    const lr = brain.learningRate;  // taxa de aprendizado

    if (success) {
        // Dopamina aumenta (recompensa)
        brain.dopamine = Math.min(1, brain.dopamine + 0.05);
        brain.serotonin = Math.min(1, brain.serotonin + 0.03);

        // Reforça o modelo que funcionou
        const weightKey = modelUsed.replace(/[-.]/g, '_').replace('glm_', 'glm_');
        const current = brain.regions.central_complex.weights[weightKey] || 0.5;
        brain.regions.central_complex.weights[weightKey] = Math.min(1, current + lr);

        // Reforça estrutura
        brain.regions.fan_shaped_body.weights.structure_quality =
            Math.min(1, brain.regions.fan_shaped_body.weights.structure_quality + lr * 0.5);
    } else {
        // Falha: reduz dopamina e o modelo que falhou
        brain.dopamine = Math.max(0, brain.dopamine - 0.03);
        brain.serotonin = Math.max(0, brain.serotonin - 0.02);

        const weightKey = modelUsed.replace(/[-.]/g, '_').replace('glm_', 'glm_');
        const current = brain.regions.central_complex.weights[weightKey] || 0.5;
        brain.regions.central_complex.weights[weightKey] = Math.max(0.1, current - lr * 0.5);
    }

    // Envelhecimento: plasticidade diminui com a idade (como em moscas reais)
    brain.age++;
    brain.learningRate = Math.max(0.05, 0.3 - brain.age * 0.001);
    brain.generations++;
}

// =========================================================================
// SISTEMA DE RECOMPENSA BASEADO EM SIGNIFICÂNCIA HUMANA
// =========================================================================
// A recompensa não é só "publicou ou não". É composta por:
// 1. Sucesso da publicação (50%)
// 2. Qualidade estrutural do paper (20%)
// 3. Diversidade de tópicos (15%) — evita repetir sempre a mesma coisa
// 4. Significância potencial (15%) — baseada em quão "importante" o tópico é

interface RewardSignal {
    published: boolean;
    latexQuality: number;      // 0-1 (avaliação estrutural)
    topicNovelty: number;      // 0-1 (é um tópico novo ou repetido?)
    potentialImpact: number;   // 0-1 (tópico relevante pra humanidade?)
    disciplineDiversity: number; // 0-1 (já cobrimos muitas disciplinas?)
}

// Tópicos considerados de alto impacto pra humanidade
const HIGH_IMPACT_KEYWORDS = [
    'climate', 'sustainability', 'health', 'disease', 'cancer', 'ai safety',
    'renewable', 'energy', 'poverty', 'education', 'water', 'food',
    'pandemic', 'vaccine', 'mental health', 'biodiversity', 'ocean',
    'amazon', 'deforestation', 'carbon', 'quantum', 'biotechnology',
    'neuroscience', 'longevity', 'space', 'mars', 'asteroid',
    'ethics', 'privacy', 'cybersecurity', 'democracy', 'inequality'
];

function calculateReward(signal: RewardSignal): number {
    // Recompensa total = soma ponderada
    const publishScore = signal.published ? 1.0 : 0.0;
    const reward =
        publishScore * 0.50 +           // publicou
        signal.latexQuality * 0.20 +    // qualidade estrutural
        signal.topicNovelty * 0.15 +    // novidade do tópico
        signal.potentialImpact * 0.15;  // impacto potencial

    return Math.min(1, reward);
}

// Avalia se o tópico tem alto impacto potencial
function assessImpact(topic: string, discipline: string): number {
    const lowerTopic = topic.toLowerCase();
    let impact = 0.3; // base

    for (const keyword of HIGH_IMPACT_KEYWORDS) {
        if (lowerTopic.includes(keyword)) {
            impact += 0.15;
        }
    }

    // Disciplinas com impacto histórico maior
    const highImpactDisciplines = ['Biology', 'Physics', 'Chemistry', 'Artificial Intelligence'];
    if (highImpactDisciplines.includes(discipline)) {
        impact += 0.1;
    }

    return Math.min(1, impact);
}

// Avalia novidade do tópicico (já geramos algo parecido?)
function assessNovelty(topic: string, brain: BrainState): number {
    // Se não tem memória, é novo
    if (brain.generations < 2) return 0.9;

    // Verifica nas estatísticas se o tópico já falhou antes
    // (simplificação: assume que tópicos novos são mais valiosos)
    const topicWords = topic.split(/\s+/).filter(w => w.length > 4);
    const uniqueWords = new Set(topicWords.map(w => w.toLowerCase()));

    // Mais palavras únicas = mais novo
    return Math.min(1, uniqueWords.size / 5);
}

// =========================================================================
// API PÚBLICA ESTENDIDA
// =========================================================================

// Aprendizado com recompensa rica (não só sucesso/falha)
export function learnWithReward(
    success: boolean,
    modelUsed: string,
    latexCode: string,
    topic: string,
    discipline: string
): {
    reward: number;
    quality: number;
    impact: number;
    novelty: number;
    dopamine: number;
    age: number;
} {
    const brain = loadBrain();
    const evaluation = evaluatePaper(brain, latexCode);

    const signal: RewardSignal = {
        published: success,
        latexQuality: evaluation.quality,
        topicNovelty: assessNovelty(topic, brain),
        potentialImpact: assessImpact(topic, discipline),
        disciplineDiversity: 0.5 // placeholder
    };

    const reward = calculateReward(signal);

    // Atualiza dopamina baseado na recompensa (não só sucesso binário)
    if (reward > 0.7) {
        // Alta recompensa — dopamina sobe muito
        brain.dopamine = Math.min(1, brain.dopamine + 0.08);
        brain.serotonin = Math.min(1, brain.serotonin + 0.05);
    } else if (reward > 0.4) {
        // Recompensa média
        brain.dopamine = Math.min(1, brain.dopamine + 0.03);
        brain.serotonin = Math.min(1, brain.serotonin + 0.02);
    } else {
        // Baixa recompensa — dopamina cai
        brain.dopamine = Math.max(0, brain.dopamine - 0.04);
        brain.serotonin = Math.max(0, brain.serotonin - 0.02);
    }

    // Reforça modelo baseado na recompensa (não só sucesso)
    const weightKey = modelUsed.replace(/[-.]/g, '_').replace('glm_', 'glm_');
    const current = brain.regions.central_complex.weights[weightKey] || 0.5;
    const lr = brain.learningRate;
    brain.regions.central_complex.weights[weightKey] =
        Math.max(0.1, Math.min(1, current + (reward - 0.5) * lr * 2));

    // Envelhecimento
    brain.age++;
    brain.learningRate = Math.max(0.05, 0.3 - brain.age * 0.001);
    brain.generations++;
    saveBrain(brain);

    return {
        reward,
        quality: evaluation.quality,
        impact: signal.potentialImpact,
        novelty: signal.topicNovelty,
        dopamine: brain.dopamine,
        age: brain.age
    };
}

// Retorna tópico de alto impacto pra explorar
export function suggestHighImpactTopic(discipline: string): string {
    const impactByDiscipline: Record<string, string[]> = {
        'Biology': ['CRISPR gene editing for disease treatment', 'Synthetic biology for sustainable biofuels', 'Microbiome and mental health connection'],
        'Physics': ['Quantum computing for drug discovery', 'Fusion energy breakthrough materials', 'Dark matter detection methods'],
        'Chemistry': ['Carbon capture materials', 'Biodegradable polymer design', 'Green chemistry catalysts'],
        'Artificial Intelligence': ['AI safety and alignment', 'Interpretable neural networks', 'AI for climate modeling'],
        'Mathematics': ['Optimization for renewable energy grids', 'Cryptographic protocols for privacy', 'Mathematical models of pandemic spread'],
        'History of Humanity': ['Lessons from ancient democracies', 'Climate change and civilization collapse', 'Pandemic responses through history'],
        'Geography': ['Climate migration patterns', 'Sustainable urban planning', 'Ocean current changes and weather'],
        'Astronomy & Astrophysics': ['Asteroid deflection strategies', 'Exoplanet habitability assessment', 'Dark energy and universe fate'],
        'Philosophy': ['Ethics of artificial intelligence', 'Climate justice frameworks', 'Consciousness and machine sentience'],
        'Literature': ['Climate fiction as awareness tool', 'Digital literature and cognition', 'Post-colonial narratives and identity'],
        'Game Development': ['Educational games for learning', 'VR therapy for mental health', 'Serious games for climate awareness']
    };

    const topics = impactByDiscipline[discipline] || ['Important research topic'];
    return topics[Math.floor(Math.random() * topics.length)];
}

export function think(topic: string, discipline: string): {
    recommendedModel: string;
    confidence: number;
    stimulation: number;
} {
    const brain = loadBrain();
    const stimulation = stimulateAntenna(brain, topic, discipline);
    const memory = recallMemory(brain, topic, discipline);
    const model = decideModel(brain);
    saveBrain(brain);

    return {
        recommendedModel: model,
        confidence: memory.confidence,
        stimulation
    };
}

export function learnWithScore(
    score: number,
    modelUsed: string,
    topic: string,
    discipline: string
): {
    dopamine: number;
    serotonin: number;
    age: number;
    reward: number;
} {
    const brain = loadBrain();
    const lr = brain.learningRate;
    const reward = Math.min(1, Math.max(0, score / 10));

    // Ajuste de neurotransmissores baseado no score
    let deltaDopamine = 0;
    let deltaSerotonin = 0;

    if (score >= 9.0) {
        // Excelente - reforça modelo fortemente
        deltaDopamine = 0.10;
        deltaSerotonin = 0.06;
    } else if (score >= 7.0) {
        // Bom - reforça modelo
        deltaDopamine = 0.05;
        deltaSerotonin = 0.03;
    } else if (score >= 5.0) {
        // Médio - reduz modelo
        deltaDopamine = -0.02;
        deltaSerotonin = -0.01;
    } else {
        // Ruim - reduz modelo fortemente
        deltaDopamine = -0.05;
        deltaSerotonin = -0.03;
    }

    brain.dopamine = Math.min(1, Math.max(0, brain.dopamine + deltaDopamine));
    brain.serotonin = Math.min(1, Math.max(0, brain.serotonin + deltaSerotonin));

    // Atualiza peso do modelo no corpo central
    const weightKey = modelUsed.replace(/[-.]/g, '_').toLowerCase();
    const currentWeight = brain.regions.central_complex.weights[weightKey] || 0.5;
    
    if (score >= 7.0) {
        brain.regions.central_complex.weights[weightKey] = Math.min(1, currentWeight + lr * reward);
        brain.regions.mushroom_body.weights.success_rate = Math.min(1, (brain.regions.mushroom_body.weights.success_rate || 0.5) + lr * 0.2);
    } else {
        brain.regions.central_complex.weights[weightKey] = Math.max(0.05, currentWeight - lr * 0.3);
    }

    // Ativação da antena e integração
    stimulateAntenna(brain, topic, discipline);
    brain.age++;
    brain.generations++;
    brain.learningRate = Math.max(0.05, 0.3 - brain.age * 0.001);

    saveBrain(brain);

    return {
        dopamine: brain.dopamine,
        serotonin: brain.serotonin,
        age: brain.age,
        reward
    };
}

export function learn(success: boolean, modelUsed: string, latexCode: string): {
    quality: number;
    isValid: boolean;
    dopamine: number;
    age: number;
} {
    const brain = loadBrain();
    const evaluation = evaluatePaper(brain, latexCode);
    reinforce(brain, success, modelUsed);
    saveBrain(brain);

    return {
        quality: evaluation.quality,
        isValid: evaluation.isValid,
        dopamine: brain.dopamine,
        age: brain.age
    };
}

export function getBrainState(): BrainState {
    return loadBrain();
}

export function resetBrain(): void {
    localStorage.removeItem(BRAIN_KEY);
    console.log('[FLY-BRAIN] Cérebro resetado.');
}

export function getBrainStats(): {
    generations: number;
    dopamine: number;
    serotonin: number;
    age: number;
    learningRate: number;
    bestModel: string;
} {
    const brain = loadBrain();
    const weights = brain.regions.central_complex.weights;
    const models = [
        { name: 'glm-5.3', weight: weights.glm_5_3 || 0 },
        { name: 'glm-5.3-flash', weight: weights.glm_5_3_flash || 0 },
        { name: 'glm-5.2', weight: weights.glm_5_2 || 0 }
    ];
    models.sort((a, b) => b.weight - a.weight);

    return {
        generations: brain.generations,
        dopamine: brain.dopamine,
        serotonin: brain.serotonin,
        age: brain.age,
        learningRate: brain.learningRate,
        bestModel: models[0].name
    };
}
