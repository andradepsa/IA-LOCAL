// services/localPaperGenerator.ts
// Gerador de papers usando IA LOCAL (WebLLM) — sem depender de APIs externas

import { ARTICLE_TEMPLATE } from './articleTemplate';
import { ANALYSIS_TOPICS } from '../constants';
import { callLocalLLM, loadModel, getModelStatus, isWebLLMAvailable } from './webLLMService';
import type { Language, PaperSource, PersonalData, GeneratePaperResult } from '../types';

interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

// Sanitização (mesma do geminiService)
function sanitizeLatexContent(text: string): string {
    if (!text) return '';
    return text
        .replace(/^```[\s\S]*?\n/, '')
        .replace(/\n```$/, '')
        .replace(/\u2014/g, '---')
        .replace(/\u2013/g, '--')
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/\u2026/g, '...')
        .replace(/\u00A0/g, ' ')
        .replace(/\\cite\w*\{[^}]*\}/g, '[ref]')
        .replace(/\\ref\{[^}]*\}/g, '[ref]')
        .replace(/\\label\{[^}]*\}/g, '')
        .replace(/\\bibitem(?:\[[^\]]*\])?\{[^}]*\}/g, '')
        .replace(/\\nocite\{[^}]*\}/g, '')
        .replace(/\\begin\{thebibliography\}[\s\S]*?\\end\{thebibliography\}/g, '')
        .replace(/\\bibliographystyle\{[^}]*\}/g, '')
        .replace(/\\bibliography\{[^}]*\}/g, '')
        .replace(/(?<!\\)&/g, '\\&')
        .replace(/(?<!\\)%/g, '\\%')
        .replace(/(?<!\\)#/g, '\\#')
        .replace(/(?<!\\)_/g, '\\_')
        .trim();
}

function extractJson<T = any>(raw: string): T {
    let text = raw.trim();
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) text = fenceMatch[1].trim();

    const firstBrace = text.indexOf('{');
    if (firstBrace > 0) text = text.slice(firstBrace);

    try {
        return JSON.parse(text) as T;
    } catch {}

    // Recupera truncamento
    const opens = (text.match(/{/g) || []).length;
    const closes = (text.match(/}/g) || []).length;
    let repaired = text;
    for (let i = 0; i < opens - closes; i++) {
        repaired += '}';
    }
    try {
        return JSON.parse(repaired) as T;
    } catch {}

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

    throw new Error('IA local não retornou JSON válido');
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

// Gera paper usando IA local (WebLLM)
export async function generatePaperWithLocalAI(
    topic: string,
    language: Language,
    pageCount: number,
    authors: PersonalData[],
    discipline: string
): Promise<GeneratePaperResult> {
    // Verifica se WebLLM está disponível
    if (!isWebLLMAvailable()) {
        throw new Error('WebGPU não disponível. Use um navegador moderno (Chrome 113+).');
    }

    // Carrega modelo se necessário
    const status = getModelStatus();
    if (status.status !== 'ready') {
        const loaded = await loadModel();
        if (!loaded) {
            throw new Error('Não foi possível carregar a IA local');
        }
    }

    const langName = getLanguageName(language);
    const { latex: authorLatex, pdfAuthors } = buildAuthorBlock(authors);

    // Gera título
    const titleMessages: ChatMessage[] = [
        {
            role: 'system',
            content: 'You are an academic editor. Generate ONE scientific paper title. Return only the title.'
        },
        {
            role: 'user',
            content: `Discipline: ${discipline}\nTopic: ${topic}\nLanguage: ${langName}\n\nGenerate a title (10-20 words).`
        }
    ];
    const titleRaw = await callLocalLLM(titleMessages, { temperature: 0.8, maxTokens: 100 });
    const title = titleRaw.trim().replace(/^["']|["']$/g, '').replace(/\n/g, ' ');

    // Gera conteúdo estruturado (JSON)
    const contentMessages: ChatMessage[] = [
        {
            role: 'system',
            content: `Generate paper content as JSON. Schema:
{
  "abstract": "100 words",
  "keywords": "5 keywords",
  "introduction": "300 words",
  "literature": "300 words",
  "methodology": "300 words",
  "results": "300 words",
  "discussion": "300 words",
  "conclusion": "200 words",
  "references": ["Author (Year). Title.", "..."]
}

Language: ${langName}. Keep sections SHORT. Return valid JSON only.`
        },
        {
            role: 'user',
            content: `Title: ${title}\nDiscipline: ${discipline}\nTopic: ${topic}\n\nReturn the JSON.`
        }
    ];

    const contentRaw = await callLocalLLM(contentMessages, { temperature: 0.7, maxTokens: 4000 });
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
    }>(contentRaw);

    // Monta o LaTeX
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
        .replace(/__REFERENCES__/g, safeRefs || '\\noindent No references. \\par');

    return { paper, title, sources: [] };
}

// Status do WebLLM
export function getLocalAIStatus() {
    return {
        available: isWebLLMAvailable(),
        ...getModelStatus()
    };
}
