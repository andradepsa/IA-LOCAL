// services/geminiService.ts
// Refatorado: IA gera JSON estruturado, sistema monta LaTeX na template fixa.
// Integra CÉREBRO DA MOSCA (flyBrain) que aprende com cada paper.

import { ARTICLE_TEMPLATE } from './articleTemplate';
import { ANALYSIS_TOPICS, SEMANTIC_SCHOLAR_API_BASE_URL } from '../constants';
import { getEnrichedPrompt, registerPaper } from './learningBrain';
import { think as flyThink, learnWithReward as flyLearnWithReward, suggestHighImpactTopic, getBrainStats } from './flyBrain';
import type { Language, PaperSource, PersonalData, StyleGuide, TopicScore, GeneratePaperResult } from '../types';

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

// ============================================================================
// CHAMADA LLM via /llm-proxy (Vite plugin com z-ai-web-dev-sdk embutido)
// ============================================================================

export async function callLLM(
    model: string,
    messages: ChatMessage[],
    options: { temperature?: number; maxTokens?: number; responseFormat?: 'text' | 'json' } = {}
): Promise<string> {
    const zaiKey = localStorage.getItem('zai_api_key') || '';
    const geminiKey = localStorage.getItem('gemini_api_key') || '';
    const groqKey = localStorage.getItem('groq_api_key') || '';

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (zaiKey) headers['X-ZAI-API-Key'] = zaiKey;
    if (geminiKey) headers['X-Gemini-API-Key'] = geminiKey;
    if (groqKey) headers['X-Groq-API-Key'] = groqKey;

    try {
        const response = await fetch('/llm-proxy', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model,
                messages,
                temperature: options.temperature,
                maxTokens: options.maxTokens,
                json: options.responseFormat === 'json'
            })
        });

        if (response.ok) {
            const data = await response.json();
            if (data?.content) {
                return data.content as string;
            }
        }

        const errText = await response.text();
        console.warn(`[callLLM] /llm-proxy retornou status ${response.status}: ${errText.slice(0, 200)}`);
    } catch (fetchErr: any) {
        console.warn('[callLLM] /llm-proxy falhou ao conectar, tentando fallback via Hub:', fetchErr?.message);
    }

    // Fallback: Tenta chamar diretamente os provedores configurados no frontend (Gemini, Groq, etc.)
    try {
        const { callLLMWithHub } = await import('./llmHub');
        const hubRes = await callLLMWithHub(model, messages, {
            temperature: options.temperature,
            maxTokens: options.maxTokens,
            responseFormat: options.responseFormat
        });
        if (hubRes?.content) {
            return hubRes.content;
        }
    } catch (hubErr: any) {
        console.error('[callLLM] Falha no fallback do Hub:', hubErr?.message);
    }

    throw new Error('Nenhuma chave de IA válida encontrada ou serviço temporariamente indisponível. Por favor, configure sua chave no menu ⚙️.');
}

// ============================================================================
// UTILITÁRIOS
// ============================================================================

function extractJson<T = any>(raw: string): T {
    let text = raw.trim();
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) text = fenceMatch[1].trim();

    const firstBrace = text.indexOf('{');
    if (firstBrace > 0) text = text.slice(firstBrace);

    // Tenta parse direto
    try {
        return JSON.parse(text) as T;
    } catch {}

    // Estratégia: contar chaves abertas e fechar
    const opens = (text.match(/{/g) || []).length;
    const closes = (text.match(/}/g) || []).length;
    let repaired = text;
    for (let i = 0; i < opens - closes; i++) {
        repaired += '}';
    }
    try {
        return JSON.parse(repaired) as T;
    } catch {}

    // Corta na última vírgula e tenta fechar
    const lastComma = text.lastIndexOf(',');
    if (lastComma > 0) {
        const truncated = text.slice(0, lastComma);
        const o = (truncated.match(/{/g) || []).length;
        const c = (truncated.match(/}/g) || []).length;
        let r = truncated;
        for (let i = 0; i < o - c; i++) r += '}';
        try {
            return JSON.parse(r) as T;
        } catch {}
    }

    throw new Error('A IA não retornou um JSON válido.');
}

function sanitizeLatexContent(text: string): string {
    if (!text) return '';
    return text
        .replace(/^```[\s\S]*?\n/, '')
        .replace(/\n```$/, '')
        // Unicode → ASCII
        .replace(/\u2014/g, '---')
        .replace(/\u2013/g, '--')
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/\u2026/g, '...')
        .replace(/\u00A0/g, ' ')
        // Remove comandos que quebram compilação
        .replace(/\\cite\w*\{[^}]*\}/g, '[ref]')
        .replace(/\\ref\{[^}]*\}/g, '[ref]')
        .replace(/\\label\{[^}]*\}/g, '')
        .replace(/\\bibitem(?:\[[^\]]*\])?\{[^}]*\}/g, '')
        .replace(/\\nocite\{[^}]*\}/g, '')
        .replace(/\\begin\{thebibliography\}[\s\S]*?\\end\{thebibliography\}/g, '')
        .replace(/\\bibliographystyle\{[^}]*\}/g, '')
        .replace(/\\bibliography\{[^}]*\}/g, '')
        // Escapa caracteres especiais
        .replace(/(?<!\\)&/g, '\\&')
        .replace(/(?<!\\)%/g, '\\%')
        .replace(/(?<!\\)#/g, '\\#')
        .replace(/(?<!\\)_/g, '\\_')
        .trim();
}

function getLanguageName(lang: Language): string {
    const map: Record<Language, string> = {
        en: 'English',
        pt: 'Portuguese (Brazil)',
        es: 'Spanish',
        fr: 'French'
    };
    return map[lang];
}

function buildAuthorBlock(authors: PersonalData[]): { latex: string; pdfAuthors: string } {
    if (!authors || authors.length === 0) {
        return { latex: 'Anonymous', pdfAuthors: 'Anonymous' };
    }
    const latex = authors.map(a => `\\textbf{${a.name}} \\\\ ${a.affiliation} \\\\ \\texttt{${a.orcid}}`).join(' \\and ');
    const pdfAuthors = authors.map(a => a.name).join(', ');
    return { latex, pdfAuthors };
}

// ============================================================================
// BUSCA DE FONTES (Semantic Scholar via /semantic-proxy)
// ============================================================================

async function searchSemanticScholar(query: string, limit = 8): Promise<PaperSource[]> {
    try {
        const targetUrl = `${SEMANTIC_SCHOLAR_API_BASE_URL}/paper/search?query=${encodeURIComponent(query)}&limit=${limit}&fields=title,authors,year,abstract,url,externalIds`;
        const proxiedUrl = `/semantic-proxy?target=${encodeURIComponent(targetUrl)}`;
        const response = await fetch(proxiedUrl);
        if (!response.ok) return [];
        const data = await response.json();
        if (!data?.data) return [];
        return data.data.map((p: any) => {
            const u = p.url || (p.externalIds?.DOI ? `https://doi.org/${p.externalIds.DOI}` : '');
            return {
                title: p.title || 'Untitled',
                authors: (p.authors || []).map((a: any) => a.name).join(', '),
                year: String(p.year || 'n.d.'),
                url: u,
                uri: u,
                abstract: p.abstract || ''
            } as PaperSource;
        });
    } catch (err) {
        console.warn('Semantic Scholar falhou:', err);
        return [];
    }
}

// ============================================================================
// GERAÇÃO DE TÍTULO
// ============================================================================

export async function generatePaperTitle(
    discipline: string,
    topic: string,
    language: Language,
    model: string
): Promise<string> {
    const langName = getLanguageName(language);
    const messages: ChatMessage[] = [
        {
            role: 'system',
            content: `You are an expert academic editor. Generate ONE high-impact scientific paper title. Respond ONLY with the title text, no quotes, no markdown.`
        },
        {
            role: 'user',
            content: `Discipline: ${discipline}\nTopic: ${topic}\nLanguage: ${langName}\n\nGenerate a compelling, specific, academically rigorous title (10-20 words). Return ONLY the title.`
        }
    ];
    const raw = await callLLM(model, messages, { temperature: 0.8, maxTokens: 200 });
    return raw.trim().replace(/^["']|["']$/g, '').replace(/\n/g, ' ');
}

// ============================================================================
// GERAÇÃO DO ARTIGO — IA retorna JSON, sistema monta LaTeX
// ============================================================================

export async function generateInitialPaper(
    topic: string,
    language: Language,
    pageCount: number,
    model: string,
    authors: PersonalData[],
    discipline: string
): Promise<{ paper: string; title: string; sources: PaperSource[] }> {
    const langName = getLanguageName(language);
    const { latex: authorLatex, pdfAuthors } = buildAuthorBlock(authors);

    const sources = await searchSemanticScholar(`${discipline} ${topic}`, 10);
    const title = await generatePaperTitle(discipline, topic, language, model);

    const sourcesBlock = sources.length > 0
        ? sources.map((s, i) => `${i + 1}. ${s.authors} (${s.year}). ${s.title}. ${s.url}`).join('\n')
        : 'No external sources found. Generate plausible academic references.';

    const messages: ChatMessage[] = [
        {
            role: 'system',
            content: `You are a senior academic writer. Generate the CONTENT of a scientific paper as a JSON object. Do NOT write LaTeX code — only plain text content.

REQUIRED JSON SCHEMA (keep sections CONCISE to avoid truncation):
{
  "abstract": "150-200 words",
  "keywords": "5-8 comma-separated keywords",
  "introduction": "400-600 words",
  "literature": "400-600 words",
  "methodology": "400-600 words",
  "results": "400-600 words",
  "discussion": "400-600 words",
  "conclusion": "200-300 words",
  "references": ["Author1, A. (Year). Title. Journal.", "..."]
}

CRITICAL RULES:
1. Language: write in ${langName}.
2. KEEP SECTIONS CONCISE — do not exceed word limits.
3. Output MUST be valid JSON. No markdown, no commentary.
4. Content is PLAIN TEXT. You may use \\textbf{}, \\emph{}, \\begin{equation}...\\end{equation}, but NO \\section, \\begin{document}, \\documentclass.
5. For references, use "Author, A., \\& Author, B. (Year). Title." format.
6. Use --- for em-dashes, -- for en-dashes (NOT Unicode).
7. Use straight quotes " ' (NOT smart quotes).
8. Generate 8-12 references.
9. ALWAYS close the JSON with }.`
        },
        {
            role: 'user',
            content: `Generate content for a scientific paper.

Title: ${title}
Discipline: ${discipline}
Topic: ${topic}
Language: ${langName}
Target pages: ${pageCount}

Real academic sources:
${sourcesBlock}

Return the JSON object now.`
        }
    ];

    const raw = await callLLM(model, messages, { temperature: 0.7, maxTokens: 8000, responseFormat: 'json' });
    const content = extractJson<{
        abstract: string;
        keywords: string;
        introduction: string;
        literature: string;
        methodology: string;
        results: string;
        discussion: string;
        conclusion: string;
        references: string[];
    }>(raw);

    // Sanitiza e monta o LaTeX final
    const refs = Array.isArray(content.references) ? content.references : [];
    const safeRefs = refs
        .map(r => sanitizeLatexContent(String(r)))
        .filter(r => r.length > 0)
        .map(r => `\\noindent ${r} \\par`)
        .join('\n\n');

    const paper = ARTICLE_TEMPLATE
        .replace(/__TITLE__/g, sanitizeLatexContent(title))
        .replace(/__AUTHOR_NAMES__/g, pdfAuthors)
        .replace(/__AUTHOR_LATEX__/g, authorLatex)
        .replace(/__ABSTRACT__/g, sanitizeLatexContent(content.abstract || ''))
        .replace(/__KEYWORDS__/g, sanitizeLatexContent(content.keywords || ''))
        .replace(/__CONTENT_INTRODUCTION__/g, sanitizeLatexContent(content.introduction || ''))
        .replace(/__CONTENT_LITERATURE__/g, sanitizeLatexContent(content.literature || ''))
        .replace(/__CONTENT_METHODOLOGY__/g, sanitizeLatexContent(content.methodology || ''))
        .replace(/__CONTENT_RESULTS__/g, sanitizeLatexContent(content.results || ''))
        .replace(/__CONTENT_DISCUSSION__/g, sanitizeLatexContent(content.discussion || ''))
        .replace(/__CONTENT_CONCLUSION__/g, sanitizeLatexContent(content.conclusion || ''))
        .replace(/__REFERENCES__/g, safeRefs || '\\noindent No references available. \\par');

    return { paper, title, sources };
}

export async function generateCompletePaper(
    topic: string,
    language: Language,
    pageCount: number,
    model: string,
    authors: PersonalData[],
    discipline: string
): Promise<GeneratePaperResult> {
    // === CÉREBRO DA MOSCA PENSA ANTES DE GERAR ===
    const thought = flyThink(topic, discipline);
    console.log(`[FLY-BRAIN] 🧠 Pensando... modelo: ${thought.recommendedModel} (confiança: ${thought.confidence.toFixed(2)})`);

    const modelsToTry = [
        thought.recommendedModel,
        ...['glm-5.3', 'glm-5.3-flash', 'glm-5.2'].filter(m => m !== thought.recommendedModel)
    ];
    let lastError: Error | null = null;

    for (const tryModel of modelsToTry) {
        try {
            const result = await generateInitialPaper(topic, language, pageCount, tryModel, authors, discipline);
            console.log(`[VOTAÇÃO] ✓ Paper gerado com ${tryModel}`);

            // === CÉREBRO APRENDE COM RECOMPENSA RICA ===
            // Recompensa baseada em: publicação + qualidade + novidade + impacto humano
            const learning = flyLearnWithReward(true, tryModel, result.paper, topic, discipline);
            console.log(`[FLY-BRAIN] 🧠 Recompensa: ${(learning.reward * 100).toFixed(0)}% | Impacto: ${(learning.impact * 100).toFixed(0)}% | Novidade: ${(learning.novelty * 100).toFixed(0)}% | Dopamina: ${(learning.dopamine * 100).toFixed(0)}%`);

            registerPaper({
                title: result.title,
                discipline,
                topic,
                model: tryModel,
                published: true,
                score: learning.reward * 10
            });

            return result;
        } catch (e: any) {
            console.log(`[VOTAÇÃO] ✗ ${tryModel} falhou: ${e.message.slice(0, 100)}`);
            lastError = e;
            await new Promise(r => setTimeout(r, 5000));
        }
    }

    // === CÉREBRO APRENDE COM FALHA (recompensa baixa) ===
    flyLearnWithReward(false, modelsToTry[0], '', topic, discipline);
    console.log('[VOTAÇÃO] Todos falharam. Gerando paper de emergência.');
    return generateEmergencyPaper(topic, language, authors, discipline, lastError?.message || 'unknown');
}

// Função para sugerir tópico de alto impacto (pode ser usada pelo App)
export function suggestTopic(discipline: string): string {
    return suggestHighImpactTopic(discipline);
}

// ============================================================================
// PAPER DE EMERGÊNCIA — quando todas as IAs falham
// Gera um paper básico mas válido, sem depender da IA
// ============================================================================

function generateEmergencyPaper(
    topic: string,
    language: Language,
    authors: PersonalData[],
    discipline: string,
    errorMessage: string
): GeneratePaperResult {
    const { latex: authorLatex, pdfAuthors } = buildAuthorBlock(authors);
    const title = `${discipline}: A Study on ${topic.slice(0, 50)}`;
    const sources: PaperSource[] = [];

    const abstract = `This paper presents a study on ${topic} within the field of ${discipline}. ` +
        `We examine the fundamental concepts, methodologies, and current state of research. ` +
        `The study provides an overview of the topic and identifies areas for future investigation. ` +
        `Note: This paper was generated as an emergency fallback due to AI service unavailability (${errorMessage.slice(0, 50)}).`;

    const introduction = `Introduction to ${topic} in the context of ${discipline}. ` +
        `This section provides background information and establishes the research context. ` +
        `The topic of ${topic} is significant because it relates to fundamental principles ` +
        `in ${discipline} that have broad applications and implications.`;

    const literature = `The literature on ${topic} spans multiple decades of research in ${discipline}. ` +
        `Previous studies have examined various aspects of this topic, contributing to our ` +
        `understanding of the underlying principles and their applications. ` +
        `This review synthesizes key findings from the existing literature.`;

    const methodology = `The methodology employed in this study follows standard practices ` +
        `in ${discipline} research. We conducted a systematic analysis of ${topic}, ` +
        `employing both qualitative and quantitative approaches to ensure comprehensive coverage.`;

    const results = `The results of our analysis of ${topic} reveal several important findings. ` +
        `These results contribute to the broader understanding of ${discipline} and provide ` +
        `insights that may guide future research directions.`;

    const discussion = `The findings presented in this study have significant implications ` +
        `for the field of ${discipline}. The discussion examines the broader context of ${topic} ` +
        `and relates our findings to existing theoretical frameworks.`;

    const conclusion = `In conclusion, this study has examined ${topic} within ${discipline}, ` +
        `providing insights and identifying areas for future research. ` +
        `The findings contribute to the ongoing scholarly discourse in this field.`;

    const references = [
        `Smith, J. (2023). Advanced Topics in ${discipline}. Journal of Academic Research, 15(3), 245-260.`,
        `Brown, A., \\& Davis, C. (2022). ${topic}: A Comprehensive Review. Academic Press.`,
        `Wilson, E. (2024). Recent Developments in ${discipline}. Science Today, 42(1), 78-92.`,
        `Taylor, R. (2023). Methodological Approaches in ${discipline} Studies. Research Methods Quarterly, 8(2), 112-128.`,
        `Anderson, K. (2022). Theoretical Foundations of ${topic}. In Handbook of ${discipline} (pp. 45-67).`,
        `Martinez, L. (2024). Empirical Studies on ${topic}. Journal of ${discipline} Research, 19(4), 301-315.`,
        `Thompson, S. (2023). Future Directions in ${discipline}. Annual Review, 11, 156-170.`
    ];

    const safeRefs = references
        .map(r => sanitizeLatexContent(r))
        .map(r => `\\noindent ${r} \\par`)
        .join('\n\n');

    const paper = ARTICLE_TEMPLATE
        .replace(/__TITLE__/g, sanitizeLatexContent(title))
        .replace(/__AUTHOR_NAMES__/g, pdfAuthors)
        .replace(/__AUTHOR_LATEX__/g, authorLatex)
        .replace(/__ABSTRACT__/g, sanitizeLatexContent(abstract))
        .replace(/__KEYWORDS__/g, sanitizeLatexContent(`${discipline}, ${topic}, research, study`))
        .replace(/__CONTENT_INTRODUCTION__/g, sanitizeLatexContent(introduction))
        .replace(/__CONTENT_LITERATURE__/g, sanitizeLatexContent(literature))
        .replace(/__CONTENT_METHODOLOGY__/g, sanitizeLatexContent(methodology))
        .replace(/__CONTENT_RESULTS__/g, sanitizeLatexContent(results))
        .replace(/__CONTENT_DISCUSSION__/g, sanitizeLatexContent(discussion))
        .replace(/__CONTENT_CONCLUSION__/g, sanitizeLatexContent(conclusion))
        .replace(/__REFERENCES__/g, safeRefs);

    return { paper, title, sources };
}

// ============================================================================
// ANÁLISE DO ARTIGO (10 critérios)
// ============================================================================

export async function analyzePaper(
    latexCode: string,
    model: string
): Promise<{ scores: TopicScore[]; averageScore: number; summary: string }> {
    const topicsList = ANALYSIS_TOPICS.map(t => `${t.num}. ${t.name} — ${t.desc}`).join('\n');

    const messages: ChatMessage[] = [
        {
            role: 'system',
            content: `You are a strict academic peer reviewer. Return ONLY a JSON object, no markdown.

JSON SCHEMA:
{
  "scores": [
    { "num": 0, "name": "SCIENTIFIC ACCURACY", "score": 8.5, "improvement": "specific feedback" },
    ...one entry per criterion...
  ],
  "averageScore": 8.2,
  "summary": "Overall assessment in 2-3 sentences."
}

Scale: 0.0 to 10.0. Be rigorous.`
        },
        {
            role: 'user',
            content: `Evaluate this paper against ALL ${ANALYSIS_TOPICS.length} criteria:

CRITERIA:
${topicsList}

PAPER:
${latexCode}

Return the JSON object.`
        }
    ];

    const raw = await callLLM(model, messages, { temperature: 0.3, maxTokens: 3000, responseFormat: 'json' });
    const parsed = extractJson<{ scores: TopicScore[]; averageScore: number; summary: string }>(raw);

    if (!parsed.scores || !Array.isArray(parsed.scores)) {
        throw new Error('Análise retornou estrutura inválida.');
    }
    const avg = parsed.averageScore && !isNaN(parsed.averageScore)
        ? parsed.averageScore
        : parsed.scores.reduce((s, x) => s + (x.score || 0), 0) / parsed.scores.length;

    return { scores: parsed.scores, averageScore: avg, summary: parsed.summary || '' };
}

// ============================================================================
// MELHORIA DO ARTIGO
// ============================================================================

export async function improvePaper(
    latexCode: string,
    critiques: TopicScore[],
    model: string
): Promise<string> {
    const critiqueText = critiques
        .map(c => `[${c.num}] ${c.name} (score ${c.score}): ${c.improvement}`)
        .join('\n');

    const messages: ChatMessage[] = [
        {
            role: 'system',
            content: `You are a meticulous academic editor. Apply ONLY the improvements listed below. Return ONLY the full updated LaTeX document, no markdown.`
        },
        {
            role: 'user',
            content: `Apply these improvements:

${critiqueText}

CURRENT LATEX:
${latexCode}

Return the improved LaTeX document.`
        }
    ];

    const raw = await callLLM(model, messages, { temperature: 0.5, maxTokens: 12000 });
    // Extrai LaTeX
    let text = raw.trim();
    const fenceMatch = text.match(/```(?:latex|tex)?\s*([\s\S]*?)```/);
    if (fenceMatch) text = fenceMatch[1].trim();
    const docStart = text.indexOf('\\documentclass');
    if (docStart > 0) text = text.slice(docStart);
    const docEnd = text.lastIndexOf('\\end{document}');
    if (docEnd > 0) text = text.slice(0, docEnd + '\\end{document}'.length);
    return text.trim();
}

// ============================================================================
// CORREÇÃO DE ERROS DE COMPILAÇÃO
// ============================================================================

export async function fixLatexPaper(
    latexCode: string,
    errorLog: string,
    model: string
): Promise<string> {
    const messages: ChatMessage[] = [
        {
            role: 'system',
            content: `You are a LaTeX expert. Fix the syntax errors based on the compilation log. Return ONLY the corrected LaTeX document, no markdown.`
        },
        {
            role: 'user',
            content: `LaTeX code with errors:

${latexCode}

COMPILATION ERROR LOG:
${errorLog.slice(0, 4000)}

Return the fixed LaTeX document.`
        }
    ];

    const raw = await callLLM(model, messages, { temperature: 0.2, maxTokens: 12000 });
    let text = raw.trim();
    const fenceMatch = text.match(/```(?:latex|tex)?\s*([\s\S]*?)```/);
    if (fenceMatch) text = fenceMatch[1].trim();
    const docStart = text.indexOf('\\documentclass');
    if (docStart > 0) text = text.slice(docStart);
    const docEnd = text.lastIndexOf('\\end{document}');
    if (docEnd > 0) text = text.slice(0, docEnd + '\\end{document}'.length);
    return text.trim();
}

// ============================================================================
// REFORMATAÇÃO COM GUIA DE ESTILO
// ============================================================================

export async function reformatPaperWithStyleGuide(
    latexCode: string,
    styleGuide: StyleGuide,
    model: string
): Promise<string> {
    const guides: Record<StyleGuide, string> = {
        abnt: 'ABNT NBR 6023. Format: AUTHOR, Year. Title. Publisher.',
        apa: 'APA 7th Ed. Format: Author, A. A. (Year). Title. Publisher. DOI.',
        mla: 'MLA 9th Ed. Format: Author. Title. Publisher, Year.',
        ieee: 'IEEE. Format: [1] A. Author, "Title," Publisher, Year.'
    };

    const messages: ChatMessage[] = [
        {
            role: 'system',
            content: `You are a citation style expert. Reformat ONLY the references section. Return ONLY the full updated LaTeX document, no markdown.`
        },
        {
            role: 'user',
            content: `Reformat references using ${styleGuide.toUpperCase()} style.

STYLE: ${guides[styleGuide]}

LATEX:
${latexCode}

Return the reformatted document.`
        }
    ];

    const raw = await callLLM(model, messages, { temperature: 0.3, maxTokens: 12000 });
    let text = raw.trim();
    const fenceMatch = text.match(/```(?:latex|tex)?\s*([\s\S]*?)```/);
    if (fenceMatch) text = fenceMatch[1].trim();
    const docStart = text.indexOf('\\documentclass');
    if (docStart > 0) text = text.slice(docStart);
    const docEnd = text.lastIndexOf('\\end{document}');
    if (docEnd > 0) text = text.slice(0, docEnd + '\\end{document}'.length);
    return text.trim();
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

export async function checkLlmProxyHealth(): Promise<{ ok: boolean; message: string }> {
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
        if (r.ok) {
            const d = await r.json();
            if (d?.content) return { ok: true, message: 'IA embutida conectada' };
        }
        return { ok: false, message: `HTTP ${r.status}` };
    } catch (e: any) {
        return { ok: false, message: e?.message || String(e) };
    }
}
