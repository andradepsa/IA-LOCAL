// types.ts — Tipos modernos e limpos

export type Language = 'en' | 'pt' | 'es' | 'fr';

export interface LanguageOption {
    code: Language;
    name: string;
    flag: string;
}

export interface AnalysisTopic {
    num: number;
    name: string;
    desc: string;
}

export type StyleGuide = 'abnt' | 'apa' | 'mla' | 'ieee';

export interface StyleGuideOption {
    key: StyleGuide;
    name: string;
    description: string;
}

export interface TopicScore {
    num: number;
    name: string;
    score: number;
    improvement: string;
}

export interface IterationAnalysis {
    iteration: number;
    scores: TopicScore[];
    averageScore: number;
    summary: string;
}

export interface PaperSource {
    title: string;
    authors: string;
    year: string;
    url: string;
    uri?: string;
    abstract?: string;
}

export interface PersonalData {
    name: string;
    affiliation: string;
    orcid: string;
}

export interface Author {
    name: string;
    affiliation: string;
    orcid: string;
}

export type ArticleStatus =
    | 'generated'
    | 'published'
    | 'failed'
    | 'compilation_failed'
    | 'upload_failed';

export interface ArticleEntry {
    id: string;
    title: string;
    doi?: string;
    link?: string;
    date: string;
    discipline?: string;
    topic?: string;
    pdfBase64?: string;
    latexCode?: string;
    status: ArticleStatus;
    errorMessage?: string;
}

export interface GeneratePaperResult {
    paper: string;
    title: string;
    sources: PaperSource[];
}

export interface ZenodoAuthor {
    name: string;
    affiliation: string;
    orcid?: string;
}

export interface ExtractedMetadata {
    title: string;
    abstract: string;
    authors: ZenodoAuthor[];
    keywords: string;
}
