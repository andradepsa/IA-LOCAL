import type { LanguageOption, StyleGuideOption } from '../types';

export const LANGUAGES: LanguageOption[] = [
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'pt', name: 'Português', flag: '🇧🇷' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
];

export const AVAILABLE_MODELS: { name: string; description: string }[] = [
    { name: 'glm-5.3', description: 'Z.ai GLM-5.3 — modelo mais novo e capaz' },
    { name: 'glm-5.3-flash', description: 'Z.ai GLM-5.3 Flash — rápido e econômico' },
    { name: 'glm-5.2', description: 'Z.ai GLM-5.2 — modelo estável' },
    { name: 'glm-4.6', description: 'Z.ai GLM-4.6 — equilibrado' },
];

export const STYLE_GUIDES: StyleGuideOption[] = [
    { key: 'abnt', name: 'ABNT', description: 'Associação Brasileira de Normas Técnicas' },
    { key: 'apa', name: 'APA', description: 'American Psychological Association 7th Ed.' },
    { key: 'mla', name: 'MLA', description: 'Modern Language Association 9th Ed.' },
    { key: 'ieee', name: 'IEEE', description: 'Institute of Electrical and Electronics Engineers' },
];

export const FIX_OPTIONS: { key: string; label: string; description: string }[] = [
    { key: 'escape_chars', label: 'Fix Character Escaping', description: 'Fix special LaTeX characters.' },
    { key: 'citation_mismatch', label: 'Fix Citation Mismatches', description: 'Fix \\cite{} without \\bibitem.' },
    { key: 'preamble_check', label: 'Verify Preamble', description: 'Check preamble packages.' }
];
