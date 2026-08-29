import React, { useState, useEffect, useRef } from 'react';
import { generateCompletePaper, analyzePaper, fixLatexPaper, checkLlmProxyHealth } from './services/geminiService';
import { getBrainStats as getFlyBrainStats, learnWithScore } from './services/flyBrain';
import { loadModel as loadLocalAI, getLocalAIStatus, isWebLLMAvailable } from './services/webLLMService';
import { evaluatePaper, improvePaper, type EvaluationResult } from './services/qualityEvaluator';
import type { Language, IterationAnalysis, PaperSource, StyleGuide, ArticleEntry, PersonalData } from './types';
import { LANGUAGES, AVAILABLE_MODELS, ANALYSIS_TOPICS, ALL_TOPICS_BY_DISCIPLINE, getAllDisciplines, getRandomTopic, STYLE_GUIDES, TOTAL_ITERATIONS, DISCIPLINE_AUTHORS_FULL, FIXED_AUTHOR_1 } from './constants';
import ApiKeyModal, { type ApiKeys } from './components/ApiKeyModal';
import PersonalDataModal from './components/PersonalDataModal';
import ResultsDisplay from './components/ResultsDisplay';
import SourceDisplay from './components/SourceDisplay';
import QualityPanel, { type QualityStatus, type QualityHistoryItem } from './components/QualityPanel';

const App: React.FC = () => {
    // Estado de configurações
    const [language, setLanguage] = useState<Language>('en');
    const [generationModel, setGenerationModel] = useState('glm-5.3');
    const [pageCount] = useState(10);
    const [selectedDiscipline, setSelectedDiscipline] = useState<string>('Artificial Intelligence');
    const [numberOfArticles, setNumberOfArticles] = useState(1);

    // Estado de modais
    const [isApiModalOpen, setIsApiModalOpen] = useState(false);
    const [isPersonalDataModalOpen, setIsPersonalDataModalOpen] = useState(false);

    // Estado de geração
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationProgress, setGenerationProgress] = useState(0);
    const [generationStatus, setGenerationStatus] = useState('');
    const [generatedTitle, setGeneratedTitle] = useState('');
    const [analysisResults, setAnalysisResults] = useState<IterationAnalysis[]>([]);
    const [paperSources, setPaperSources] = useState<PaperSource[]>([]);
    const [finalLatexCode, setFinalLatexCode] = useState('');
    const [latexCode, setLatexCode] = useState('');
    const isGenerationCancelled = useRef(false);

    // Estado de Controle de Qualidade
    const [qualityScore, setQualityScore] = useState<number | null>(null);
    const [qualityAttempt, setQualityAttempt] = useState<number>(1);
    const [qualityStatus, setQualityStatus] = useState<QualityStatus>('idle');
    const [qualityStatusDetail, setQualityStatusDetail] = useState<string>('');
    const [lastEvaluation, setLastEvaluation] = useState<EvaluationResult | null>(null);
    const [approvedCount, setApprovedCount] = useState<number>(0);
    const [rejectedCount, setRejectedCount] = useState<number>(0);
    const [inProgressCount, setInProgressCount] = useState<number>(0);
    const [qualityHistory, setQualityHistory] = useState<QualityHistoryItem[]>(() => {
        try {
            const stored = localStorage.getItem('quality_history_log');
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    });

    // Salva histórico de qualidade
    useEffect(() => {
        localStorage.setItem('quality_history_log', JSON.stringify(qualityHistory));
    }, [qualityHistory]);

    // Estado de compilação
    const [isCompiling, setIsCompiling] = useState(false);
    const [compilationStatus, setCompilationStatus] = useState<React.ReactNode>(null);
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState('');
    const [compiledPdfFile, setCompiledPdfFile] = useState<File | null>(null);
    const [selectedStyle, setSelectedStyle] = useState<StyleGuide>('abnt');

    // Estado de upload
    const [useSandbox, setUseSandbox] = useState(() => localStorage.getItem('use_zenodo_sandbox') === 'true');
    const [zenodoToken, setZenodoToken] = useState(() => localStorage.getItem('zenodo_api_key') || '');
    const [isUploading, setIsUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<React.ReactNode>(null);

    // Estado de automação
    const [isContinuousMode, setIsContinuousMode] = useState(() => localStorage.getItem('isContinuousMode') === 'true');
    const [isSchedulerEnabled, setIsSchedulerEnabled] = useState(() => localStorage.getItem('isSchedulerEnabled') === 'true');
    const schedulerTimeoutRef = useRef<number | null>(null);

    // Estado de artigos publicados
    const [articleEntries, setArticleEntries] = useState<ArticleEntry[]>(() => {
        try {
            const stored = localStorage.getItem('article_entries_log');
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    });

    // Estado de autores
    const [authors, setAuthors] = useState<PersonalData[]>(() => {
        const fixed = {
            name: FIXED_AUTHOR_1.name,
            affiliation: FIXED_AUTHOR_1.affiliation,
            orcid: FIXED_AUTHOR_1.orcid
        };
        const a2 = DISCIPLINE_AUTHORS_FULL['Artificial Intelligence'];
        return [fixed, { name: a2.name, affiliation: a2.affiliation, orcid: a2.orcid }];
    });

    // Estado de saúde do proxy
    const [proxyHealth, setProxyHealth] = useState<'checking' | 'ok' | 'fail'>('checking');
    // Estado do cérebro da mosca
    const [brainStats, setBrainStats] = useState(() => getFlyBrainStats());
    // Estado da IA local (WebLLM)
    const [localAIStatus, setLocalAIStatus] = useState(() => getLocalAIStatus());
    const [isLoadingLocalAI, setIsLoadingLocalAI] = useState(false);

    // Auto-carrega IA local se WebGPU estiver disponível
    useEffect(() => {
        if (isWebLLMAvailable() && localAIStatus.status === 'not_loaded') {
            loadLocalAI().then(() => {
                setLocalAIStatus(getLocalAIStatus());
            }).catch(err => {
                console.warn('Auto-load WebLLM warning:', err);
            });
        }
    }, []);

    // Atualiza stats do cérebro a cada 5s
    useEffect(() => {
        const interval = setInterval(() => {
            setBrainStats(getFlyBrainStats());
            setLocalAIStatus(getLocalAIStatus());
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    // Carrega IA local manual
    const handleLoadLocalAI = async () => {
        setIsLoadingLocalAI(true);
        try {
            await loadLocalAI();
            setLocalAIStatus(getLocalAIStatus());
        } catch (e: any) {
            console.error('Erro ao carregar IA local:', e);
        }
        setIsLoadingLocalAI(false);
    };

    // Effects
    useEffect(() => {
        checkLlmProxyHealth().then(r => setProxyHealth(r.ok ? 'ok' : 'fail'));
    }, []);

    useEffect(() => {
        if (zenodoToken) {
            localStorage.setItem('zenodo_api_key', zenodoToken);
        }
    }, [zenodoToken]);

    useEffect(() => {
        localStorage.setItem('use_zenodo_sandbox', useSandbox ? 'true' : 'false');
    }, [useSandbox]);

    useEffect(() => {
        localStorage.setItem('isContinuousMode', isContinuousMode ? 'true' : 'false');
    }, [isContinuousMode]);

    useEffect(() => {
        localStorage.setItem('isSchedulerEnabled', isSchedulerEnabled ? 'true' : 'false');
    }, [isSchedulerEnabled]);

    useEffect(() => {
        localStorage.setItem('article_entries_log', JSON.stringify(articleEntries));
    }, [articleEntries]);

    useEffect(() => {
        localStorage.setItem('all_authors_data', JSON.stringify(authors));
    }, [authors]);

    // Atualiza autores quando disciplina muda
    useEffect(() => {
        const fixed = {
            name: FIXED_AUTHOR_1.name,
            affiliation: FIXED_AUTHOR_1.affiliation,
            orcid: FIXED_AUTHOR_1.orcid
        };
        const a2 = DISCIPLINE_AUTHORS_FULL[selectedDiscipline] || DISCIPLINE_AUTHORS_FULL['Artificial Intelligence'];
        setAuthors([fixed, { name: a2.name, affiliation: a2.affiliation, orcid: a2.orcid }]);
    }, [selectedDiscipline]);

    // Scheduler — loop 24/7
    useEffect(() => {
        if (!isSchedulerEnabled || isGenerating) {
            if (schedulerTimeoutRef.current) {
                clearTimeout(schedulerTimeoutRef.current);
                schedulerTimeoutRef.current = null;
            }
            return;
        }

        const scheduleNextRun = () => {
            if (schedulerTimeoutRef.current) clearTimeout(schedulerTimeoutRef.current);
            const delay = 60 * 1000; // 60 segundos
            schedulerTimeoutRef.current = window.setTimeout(() => {
                if (!isGenerating) handleFullAutomation(1);
                scheduleNextRun();
            }, delay);
        };

        scheduleNextRun();

        return () => {
            if (schedulerTimeoutRef.current) {
                clearTimeout(schedulerTimeoutRef.current);
                schedulerTimeoutRef.current = null;
            }
        };
    }, [isSchedulerEnabled, isGenerating]);

    // Progress simulation
    const progressIntervalRef = useRef<number | null>(null);
    const startProgressSimulation = (from: number, to: number, durationSec: number) => {
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        const steps = (durationSec * 1000) / 500;
        const increment = (to - from) / steps;
        let current = from;
        progressIntervalRef.current = window.setInterval(() => {
            current += increment;
            if (current >= to) {
                current = to;
                if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
            }
            setGenerationProgress(Math.round(current));
        }, 500);
    };
    const stopProgressSimulation = () => {
        if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
        }
    };

    // Compilação robusta
    const robustCompile = async (codeToCompile: string, onStatusUpdate: (m: string) => void) => {
        const MAX_ATTEMPTS = 3;
        let lastError: Error | null = null;
        let currentCode = codeToCompile;

        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                onStatusUpdate(`Compilando (Tentativa ${attempt}/${MAX_ATTEMPTS})...`);
                const response = await fetch('/compile-latex', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ latex: currentCode }),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || `HTTP ${response.status}`);
                }

                const base64Pdf = await response.text();
                const pdfBytes = Uint8Array.from(atob(base64Pdf), c => c.charCodeAt(0));
                const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
                const pdfFile = new File([pdfBlob], 'paper.pdf', { type: 'application/pdf' });
                const pdfUrl = URL.createObjectURL(pdfBlob);

                return { pdfFile, pdfUrl, finalCode: currentCode };
            } catch (error: any) {
                lastError = error;
                if (attempt < MAX_ATTEMPTS) {
                    onStatusUpdate(`Compilação falhou. Corrigindo com IA (tentativa ${attempt + 1})...`);
                    try {
                        const analysisModel = generationModel;
                        currentCode = await fixLatexPaper(currentCode, error.message, analysisModel);
                    } catch (fixErr) {
                        console.error('AI fix failed:', fixErr);
                    }
                }
            }
        }
        throw new Error(`Compilação falhou após ${MAX_ATTEMPTS} tentativas. Último erro: ${lastError?.message}`);
    };

    // Extrai metadados do LaTeX
    const extractMetadata = (latex: string, forZenodo: boolean = false) => {
        const titleMatch = latex.match(/\\title\{([^}]+)\}/);
        const abstractMatch = latex.match(/\\begin\{abstract\}([\s\S]*?)\\end\{abstract\}/);
        const keywordsMatch = latex.match(/\\textbf\{Keywords:\}\s*([^\\]+)/);
        const authorMatches = [...latex.matchAll(/\\textbf\{([^}]+)\}\s*\\\\\s*([^\\]+)\s*\\\\\s*\\texttt\{([^}]+)\}/g)];

        const title = titleMatch ? titleMatch[1].trim() : 'Untitled';
        const abstract = abstractMatch ? abstractMatch[1].trim() : '';
        const keywords = keywordsMatch ? keywordsMatch[1].trim() : '';
        const authorList = authorMatches.map(m => ({
            name: m[1].trim(),
            affiliation: m[2].trim(),
            orcid: m[3].trim()
        }));

        return { title, abstract, authors: authorList, keywords };
    };

    // Upload para Zenodo
    const uploadToZenodo = async (pdfFile: File, metadata: any, token: string) => {
        const baseUrl = useSandbox ? 'https://sandbox.zenodo.org/api' : 'https://zenodo.org/api';
        const proxied = (url: string) => `/zenodo-proxy?target=${encodeURIComponent(url)}`;

        // 1. Criar depósito
        const createResponse = await fetch(proxied(`${baseUrl}/deposit/depositions`), {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        if (!createResponse.ok) throw new Error(`Erro ${createResponse.status} ao criar depósito.`);
        const deposit = await createResponse.json();
        const bucketUrl = deposit.links.bucket;

        // 2. Upload do PDF
        const uploadResponse = await fetch(proxied(`${bucketUrl}/paper.pdf`), {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/octet-stream' },
            body: pdfFile
        });
        if (!uploadResponse.ok) throw new Error('Falha no upload do PDF.');

        // 3. Atualizar metadados
        const metadataPayload = {
            metadata: {
                title: metadata.title,
                upload_type: 'publication',
                publication_type: 'article',
                description: metadata.abstract || 'Scientific paper generated by AI',
                creators: metadata.authors.map((a: any) => ({
                    name: a.name,
                    affiliation: a.affiliation,
                    orcid: a.orcid
                })),
                keywords: metadata.keywords ? metadata.keywords.split(',').map((k: string) => k.trim()) : []
            }
        };

        const metadataResponse = await fetch(proxied(`${baseUrl}/deposit/depositions/${deposit.id}`), {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(metadataPayload)
        });
        if (!metadataResponse.ok) throw new Error('Falha ao atualizar metadados.');

        // 4. Publicar
        const publishResponse = await fetch(proxied(`${baseUrl}/deposit/depositions/${deposit.id}/actions/publish`), {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!publishResponse.ok) throw new Error('Falha ao publicar.');

        const published = await publishResponse.json();
        return {
            doi: published.doi,
            link: useSandbox ? `https://sandbox.zenodo.org/records/${deposit.id}` : `https://zenodo.org/records/${deposit.id}`
        };
    };

    // Função principal de automação com CONTROLE DE QUALIDADE E AVALIAÇÃO EM TEMPO REAL
    const handleFullAutomation = async (batchSizeOverride?: number) => {
        const articlesToProcess = batchSizeOverride ?? (isContinuousMode ? 1 : numberOfArticles);

        const storedToken = zenodoToken || localStorage.getItem('zenodo_api_key') || '';
        if (!storedToken) {
            setIsApiModalOpen(true);
            setGenerationStatus('⚠️ Token do Zenodo não configurado! Insira e salve seu token na janela de configurações que foi aberta.');
            return;
        }
        setZenodoToken(storedToken);

        setIsGenerating(true);
        isGenerationCancelled.current = false;
        setArticleEntries([]);
        setAnalysisResults([]);
        setPaperSources([]);

        for (let i = 1; i <= articlesToProcess; i++) {
            if (isGenerationCancelled.current) break;

            const articleEntryId = crypto.randomUUID();
            let temporaryTitle = `Artigo ${i}`;
            let currentPaper = '';
            let currentDiscipline = '';
            let randomTopic = '';

            try {
                setInProgressCount(prev => prev + 1);
                setGenerationProgress(0);
                setAnalysisResults([]);
                setPaperSources([]);
                setGeneratedTitle('');
                setFinalLatexCode('');
                setQualityScore(null);
                setQualityAttempt(1);
                setQualityStatus('generating');
                setQualityStatusDetail('Iniciando geração de conteúdo científico...');

                // === ROTAÇÃO DE DISCIPLINAS ===
                const allDisciplines = getAllDisciplines();
                const disciplineIndex = (i - 1) % allDisciplines.length;
                currentDiscipline = allDisciplines[disciplineIndex];
                setSelectedDiscipline(currentDiscipline);

                // Atualiza autores
                const fixed = {
                    name: FIXED_AUTHOR_1.name,
                    affiliation: FIXED_AUTHOR_1.affiliation,
                    orcid: FIXED_AUTHOR_1.orcid
                };
                const a2 = DISCIPLINE_AUTHORS_FULL[currentDiscipline];
                const currentAuthors = [
                    fixed,
                    { name: a2.name, affiliation: a2.affiliation, orcid: a2.orcid }
                ];
                setAuthors(currentAuthors);
                await new Promise(r => setTimeout(r, 100));

                setGenerationStatus(`Artigo ${i}/${articlesToProcess}: Gerando (Modelo: ${generationModel}, Disciplina: ${currentDiscipline})...`);
                startProgressSimulation(0, 60, 35);

                randomTopic = getRandomTopic(currentDiscipline);
                const { paper: completePaper, title: generatedPaperTitle, sources } = await generateCompletePaper(
                    randomTopic, language, pageCount, generationModel, currentAuthors, currentDiscipline
                );

                temporaryTitle = generatedPaperTitle;
                setGeneratedTitle(temporaryTitle);
                currentPaper = completePaper;
                setPaperSources(sources);
                setFinalLatexCode(completePaper);
                stopProgressSimulation();

                if (isGenerationCancelled.current) continue;

                // ============================================================
                // CONTROLE DE QUALIDADE (Score 0-10 & Refinamento em até 3x)
                // ============================================================
                setQualityStatus('evaluating');
                setGenerationStatus(`Artigo ${i}/${articlesToProcess}: Avaliando qualidade científica (10 critérios)...`);
                setQualityStatusDetail('Comitê de IA avaliando rigor, metodologia e originalidade...');
                setGenerationProgress(65);

                let evalResult = await evaluatePaper(currentPaper, generationModel);
                setQualityScore(evalResult.score);
                setLastEvaluation(evalResult);
                let currentAttempt = 1;

                // Loop de melhoria se score < 7 (até 3 tentativas)
                while (evalResult.score < 7.0 && currentAttempt < 3 && !isGenerationCancelled.current) {
                    currentAttempt++;
                    setQualityAttempt(currentAttempt);
                    setQualityStatus('improving');
                    setGenerationStatus(`Artigo ${i}/${articlesToProcess}: Score ${evalResult.score.toFixed(1)} < 7.0. Aprimorando paper (tentativa ${currentAttempt}/3)...`);
                    setQualityStatusDetail(`Aplicando ${evalResult.improvements.length} melhorias identificadas pelo avaliador...`);
                    
                    // Melhora o paper
                    currentPaper = await improvePaper(currentPaper, evalResult.improvements, generationModel);
                    setFinalLatexCode(currentPaper);

                    // Reavalia
                    setQualityStatus('evaluating');
                    setQualityStatusDetail(`Reavaliando paper aprimorado (tentativa ${currentAttempt}/3)...`);
                    evalResult = await evaluatePaper(currentPaper, generationModel);
                    setQualityScore(evalResult.score);
                    setLastEvaluation(evalResult);
                }

                // Alimenta o Cérebro da Mosca (flyBrain) com a recompensa real
                const brainReward = learnWithScore(evalResult.score, generationModel, randomTopic, currentDiscipline);
                setBrainStats(getFlyBrainStats());
                console.log(`[FlyBrain] Aprendizado com score ${evalResult.score}:`, brainReward);

                // Registra histórico de qualidade
                const historyEntry: QualityHistoryItem = {
                    id: articleEntryId,
                    topic: randomTopic,
                    discipline: currentDiscipline,
                    score: evalResult.score,
                    timestamp: Date.now(),
                    attempts: currentAttempt,
                    status: evalResult.score >= 7.0 ? 'approved' : 'rejected'
                };
                setQualityHistory(prev => [...prev, historyEntry]);

                // DECISÃO DE PUBLICAÇÃO: Somente publica se Score >= 7.0
                if (evalResult.score < 7.0) {
                    setQualityStatus('rejected');
                    setRejectedCount(prev => prev + 1);
                    setInProgressCount(prev => Math.max(0, prev - 1));
                    setGenerationStatus(`❌ Artigo ${i} descartado: Score final ${evalResult.score.toFixed(1)} < 7.0 após 3 tentativas.`);
                    
                    setArticleEntries(prev => [...prev, {
                        id: articleEntryId,
                        title: temporaryTitle,
                        date: new Date().toISOString(),
                        status: 'compilation_failed',
                        latexCode: currentPaper,
                        errorMessage: `Descartado pelo Controle de Qualidade (Score ${evalResult.score.toFixed(1)}/10)`,
                        discipline: currentDiscipline,
                        topic: randomTopic
                    }]);

                    // Pula para o próximo paper
                    continue;
                }

                // APROVADO! Score >= 7.0
                setQualityStatus('approved');
                setApprovedCount(prev => prev + 1);
                setInProgressCount(prev => Math.max(0, prev - 1));
                setQualityStatusDetail(`Aprovado com Score ${evalResult.score.toFixed(1)}/10! Prosseguindo para compilação e publicação.`);

                // Compilar PDF
                setGenerationStatus(`Artigo ${i}/${articlesToProcess}: Aprovado (Score ${evalResult.score.toFixed(1)})! Compilando PDF...`);
                startProgressSimulation(75, 90, 10);
                const compilationUpdater = (message: string) => setGenerationStatus(`Artigo ${i}/${articlesToProcess}: ${message}`);
                const { pdfFile, finalCode } = await robustCompile(currentPaper, compilationUpdater);
                currentPaper = finalCode;
                setFinalLatexCode(finalCode);
                stopProgressSimulation();

                if (isGenerationCancelled.current) continue;

                // Upload para Zenodo
                setGenerationStatus(`Artigo ${i}/${articlesToProcess}: Publicando no Zenodo...`);
                startProgressSimulation(90, 99, 8);
                const metadataForUpload = extractMetadata(currentPaper, true);
                const keywordsForUpload = currentPaper.match(/\\textbf\{Keywords:\}\s*([^\\]+)/)?.[1] || '';

                let publishedResult: { doi: string; link: string } | null = null;
                for (let attempt = 1; attempt <= 5; attempt++) {
                    if (isGenerationCancelled.current) break;
                    try {
                        const result = await uploadToZenodo(pdfFile, { ...metadataForUpload, keywords: keywordsForUpload }, storedToken);
                        publishedResult = result;
                        break;
                    } catch (error: any) {
                        if (attempt === 5) throw error;
                        await new Promise(r => setTimeout(r, 3000 * attempt));
                    }
                }

                if (publishedResult) {
                    setArticleEntries(prev => [...prev, {
                        id: articleEntryId,
                        title: metadataForUpload.title,
                        date: new Date().toISOString(),
                        status: 'published',
                        doi: publishedResult.doi,
                        link: publishedResult.link,
                        discipline: currentDiscipline,
                        topic: randomTopic
                    }]);
                    setGenerationStatus(`✅ Artigo ${i} publicado com sucesso! Score: ${evalResult.score.toFixed(1)}/10 | DOI: ${publishedResult.doi}`);
                }
                stopProgressSimulation();
                setGenerationProgress(100);

            } catch (error: any) {
                stopProgressSimulation();
                setInProgressCount(prev => Math.max(0, prev - 1));
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.error(`Error processing article ${i}:`, error);

                const status = errorMessage.includes('compilação') ? 'compilation_failed' : 'upload_failed';
                setArticleEntries(prev => [...prev, {
                    id: articleEntryId,
                    title: temporaryTitle,
                    date: new Date().toISOString(),
                    status: status,
                    latexCode: currentPaper,
                    errorMessage: errorMessage,
                    discipline: currentDiscipline,
                    topic: randomTopic
                }]);
                setGenerationStatus(`❌ Artigo ${i} falhou: ${errorMessage.slice(0, 100)}`);
            }

            if (isContinuousMode && !isGenerationCancelled.current) {
                setGenerationStatus(`✅ Ciclo concluído. Preparando próximo paper...`);
                await new Promise(r => setTimeout(r, 10000));
            }
        }

        setIsGenerating(false);
        if (!isContinuousMode) {
            setGenerationProgress(100);
            setGenerationStatus(`✅ Processo concluído!`);
        }
    };

    const handleCancel = () => {
        isGenerationCancelled.current = true;
        setIsGenerating(false);
        setQualityStatus('idle');
        setInProgressCount(0);
        stopProgressSimulation();
        setGenerationStatus('⛔ Automação cancelada.');
    };

    const handleCompile = async () => {
        if (!latexCode) return;
        setIsCompiling(true);
        setCompilationStatus(<div className="status-info">⏳ Compilando...</div>);
        try {
            const statusUpdater = (message: string) => setCompilationStatus(<div className="status-info">⏳ {message}</div>);
            const { pdfFile, pdfUrl, finalCode } = await robustCompile(latexCode, statusUpdater);
            setPdfPreviewUrl(pdfUrl);
            setCompiledPdfFile(pdfFile);
            if (finalCode !== latexCode) setLatexCode(finalCode);
            setCompilationStatus(<div className="status-success">✅ PDF compilado!</div>);
        } catch (error: any) {
            setCompilationStatus(<div className="status-error">❌ Erro: {error.message}</div>);
        } finally {
            setIsCompiling(false);
        }
    };

    const handlePublish = async () => {
        if (!compiledPdfFile) {
            setUploadStatus(<div className="status-error">❌ Compile o PDF primeiro.</div>);
            return;
        }
        const activeToken = zenodoToken || localStorage.getItem('zenodo_api_key') || '';
        if (!activeToken) {
            setIsApiModalOpen(true);
            setUploadStatus(<div className="status-error">❌ Configure o token Zenodo na janela de configurações aberta.</div>);
            return;
        }
        setIsUploading(true);
        setUploadStatus(<div className="status-info">🚀 Publicando no Zenodo ({useSandbox ? 'Sandbox/Teste' : 'Produção Oficial'})...</div>);
        try {
            const metadata = extractMetadata(latexCode, true);
            const keywords = latexCode.match(/\\textbf\{Keywords:\}\s*([^\\]+)/)?.[1] || '';
            const result = await uploadToZenodo(compiledPdfFile, { ...metadata, keywords }, activeToken);
            setUploadStatus(<div className="status-success">✅ Publicado com sucesso! DOI: <a href={result.link} target="_blank" rel="noopener noreferrer">{result.doi}</a></div>);
        } catch (error: any) {
            setUploadStatus(<div className="status-error">❌ {error.message}</div>);
        } finally {
            setIsUploading(false);
        }
    };

    const handleSaveApiKeys = (keys: ApiKeys) => {
        if (keys.zai) localStorage.setItem('zai_api_key', keys.zai);
        else localStorage.removeItem('zai_api_key');

        if (keys.gemini) localStorage.setItem('gemini_api_key', keys.gemini);
        else localStorage.removeItem('gemini_api_key');

        if (keys.groq) localStorage.setItem('groq_api_key', keys.groq);
        else localStorage.removeItem('groq_api_key');

        if (keys.zenodo) {
            localStorage.setItem('zenodo_api_key', keys.zenodo);
            setZenodoToken(keys.zenodo);
        } else {
            localStorage.removeItem('zenodo_api_key');
            setZenodoToken('');
        }

        if (typeof keys.useSandbox === 'boolean') {
            localStorage.setItem('use_zenodo_sandbox', keys.useSandbox ? 'true' : 'false');
            setUseSandbox(keys.useSandbox);
        }

        setIsApiModalOpen(false);
    };

    const handleSavePersonalData = (data: PersonalData[]) => {
        setAuthors(data);
        setIsPersonalDataModalOpen(false);
    };

    const publishedPapers = articleEntries.filter(e => e.status === 'published');

    return (
        <div className="container">
            <ApiKeyModal isOpen={isApiModalOpen} onClose={() => setIsApiModalOpen(false)} onSave={handleSaveApiKeys} />
            <PersonalDataModal
                isOpen={isPersonalDataModalOpen}
                onClose={() => setIsPersonalDataModalOpen(false)}
                onSave={handleSavePersonalData}
                initialData={authors}
                discipline={selectedDiscipline}
            />

            <header className="main-header">
                <div className="header-top">
                    <div>
                        <h1>🎓 Gerador de Artigos Científicos</h1>
                        <p>IA Local (WebGPU) + Controle de Qualidade → LaTeX → PDF → Zenodo</p>
                    </div>
                    <div className="header-buttons" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <button 
                            onClick={() => setIsApiModalOpen(true)} 
                            className="btn btn-secondary" 
                            style={{ 
                                padding: '6px 14px', 
                                fontSize: '13px',
                                background: zenodoToken ? '#f0fdf4' : '#fff7ed',
                                border: `1px solid ${zenodoToken ? '#86efac' : '#fdba74'}`,
                                color: zenodoToken ? '#166534' : '#c2410c'
                            }}
                            title="Gerenciar Tokens e Zenodo"
                        >
                            {zenodoToken ? `☁️ Zenodo: Conectado (${useSandbox ? 'Sandbox' : 'Produção'})` : '⚠️ Zenodo: Inserir Token'}
                        </button>
                        <button onClick={() => setIsPersonalDataModalOpen(true)} title="Dados dos Autores" className="icon-btn">👤</button>
                        <button onClick={() => setIsApiModalOpen(true)} title="Configurações de API & Chaves" className="icon-btn">⚙️</button>
                    </div>
                </div>
                <div className={`health-banner ${proxyHealth}`}>
                    {proxyHealth === 'ok' && '✅ IA Local prioritária (WebGPU) + Fallback GLM-5.3 conectado'}
                    {proxyHealth === 'fail' && '⚠️ Modo autônomo local ativo via WebGPU'}
                    {proxyHealth === 'checking' && '⏳ Verificando conexão...'}
                </div>

                {/* Painel da IA Local (WebLLM) */}
                <div className="local-ai-panel">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                        <h3 style={{ margin: 0 }}>🤖 IA Local Ilimitada (WebGPU / WebLLM)</h3>
                        <span style={{ fontSize: '11px', color: '#166534', background: '#dcfce7', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                            Sem Rate Limit • 100% no Navegador
                        </span>
                    </div>
                    {!isWebLLMAvailable() ? (
                        <p className="warning">⚠️ WebGPU não detectado neste dispositivo. O sistema utilizará fallback automático via proxy.</p>
                    ) : (
                        <div style={{ marginTop: '8px' }}>
                            <div className="ai-status">
                                Status: <strong>{localAIStatus.status === 'ready' ? 'Pronta para uso' : localAIStatus.status}</strong>
                                {localAIStatus.message && <span> — {localAIStatus.message}</span>}
                                {localAIStatus.progress > 0 && localAIStatus.progress < 100 && (
                                    <span> ({localAIStatus.progress}%)</span>
                                )}
                            </div>
                            {localAIStatus.status !== 'ready' && (
                                <button
                                    onClick={handleLoadLocalAI}
                                    disabled={isLoadingLocalAI}
                                    className="btn btn-primary"
                                    style={{ marginTop: '8px' }}
                                >
                                    {isLoadingLocalAI ? '⏳ Baixando modelo no navegador...' : '📥 Carregar IA Local (Llama 3.2 1B)'}
                                </button>
                            )}
                            {localAIStatus.status === 'ready' && (
                                <p className="success" style={{ marginTop: '6px' }}>
                                    ✅ IA local ativa no navegador! Chamadas ilimitadas e sem travas de API.
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* Painel do Cérebro da Mosca */}
                <div className="brain-panel">
                    <h3>🧠 Cérebro que Aprende (Drosophila) — Recompensa por Score</h3>
                    <div className="brain-stats">
                        <div className="brain-stat">
                            <span className="brain-label">Gerações</span>
                            <span className="brain-value">{brainStats.generations}</span>
                        </div>
                        <div className="brain-stat">
                            <span className="brain-label">🧠 Dopamina</span>
                            <span className="brain-value">{(brainStats.dopamine * 100).toFixed(0)}%</span>
                        </div>
                        <div className="brain-stat">
                            <span className="brain-label">😊 Serotonina</span>
                            <span className="brain-value">{(brainStats.serotonin * 100).toFixed(0)}%</span>
                        </div>
                        <div className="brain-stat">
                            <span className="brain-label">📅 Idade</span>
                            <span className="brain-value">{brainStats.age}</span>
                        </div>
                        <div className="brain-stat">
                            <span className="brain-label">📚 Plasticidade</span>
                            <span className="brain-value">{(brainStats.learningRate * 100).toFixed(0)}%</span>
                        </div>
                        <div className="brain-stat">
                            <span className="brain-label">🏆 Melhor modelo</span>
                            <span className="brain-value">{brainStats.bestModel}</span>
                        </div>
                    </div>
                </div>
            </header>

            {/* PAINEL DE CONTROLE DE QUALIDADE (QualityPanel) */}
            <QualityPanel
                currentScore={qualityScore}
                attempt={qualityAttempt}
                maxAttempts={3}
                status={qualityStatus}
                statusDetail={qualityStatusDetail}
                lastEvaluation={lastEvaluation}
                history={qualityHistory}
                approvedCount={approvedCount}
                rejectedCount={rejectedCount}
                inProgressCount={inProgressCount}
            />

            <section className="card">
                <h2>📝 Configuração & Execução</h2>
                <div className="config-grid">
                    <div>
                        <label>Idioma:</label>
                        <div className="lang-buttons">
                            {LANGUAGES.map(l => (
                                <button key={l.code} onClick={() => setLanguage(l.code)} className={language === l.code ? 'lang-btn active' : 'lang-btn'}>{l.flag} {l.name}</button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label>Modelo IA:</label>
                        <select value={generationModel} onChange={e => setGenerationModel(e.target.value)} className="select-input">
                            {AVAILABLE_MODELS.map(m => <option key={m.name} value={m.name}>{m.name} — {m.description}</option>)}
                        </select>
                    </div>
                    <div>
                        <label>Disciplina:</label>
                        <select value={selectedDiscipline} onChange={e => setSelectedDiscipline(e.target.value)} className="select-input">
                            {getAllDisciplines().map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>
                    <div>
                        <label>Quantidade de Papers:</label>
                        <input type="number" min={1} max={100} value={numberOfArticles} onChange={e => setNumberOfArticles(parseInt(e.target.value) || 1)} className="number-input" disabled={isContinuousMode} />
                    </div>
                </div>

                <div className="toggles">
                    <label className="toggle">
                        <input type="checkbox" checked={isContinuousMode} onChange={e => setIsContinuousMode(e.target.checked)} disabled={isGenerating} />
                        <span>🔄 Modo Contínuo (loop 24/7 autônomo)</span>
                    </label>
                    <label className="toggle">
                        <input type="checkbox" checked={isSchedulerEnabled} onChange={e => setIsSchedulerEnabled(e.target.checked)} disabled={isGenerating} />
                        <span>⏰ Agendador Cron (1 paper a cada intervalo)</span>
                    </label>
                </div>

                <div className="action-buttons">
                    {!isGenerating ? (
                        <button onClick={() => handleFullAutomation()} className="btn btn-primary">
                            🚀 {isContinuousMode ? 'Iniciar Automação Contínua com Qualidade' : `Gerar e Qualificar ${numberOfArticles} Artigo(s)`}
                        </button>
                    ) : (
                        <button onClick={handleCancel} className="btn btn-danger">⛔ Cancelar Execução</button>
                    )}
                </div>
            </section>

            {(isGenerating || generationProgress > 0) && (
                <section className="card">
                    <h2>📊 Progresso do Pipeline</h2>
                    <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${generationProgress}%` }}>{generationProgress}%</div>
                    </div>
                    <p className="status-text">{generationStatus}</p>
                    {generatedTitle && <p className="generated-title">📄 {generatedTitle}</p>}
                    {paperSources.length > 0 && <SourceDisplay sources={paperSources} />}
                    {analysisResults.length > 0 && <ResultsDisplay analysisResults={analysisResults} totalIterations={TOTAL_ITERATIONS} />}
                </section>
            )}

            {finalLatexCode && (
                <section className="card">
                    <h2>📝 LaTeX do Artigo Científico</h2>
                    <textarea value={finalLatexCode} onChange={e => setLatexCode(e.target.value)} className="latex-editor" rows={20} />
                    <div className="action-buttons">
                        <button onClick={handleCompile} disabled={isCompiling} className="btn btn-secondary">📋 Compilar PDF</button>
                        {compiledPdfFile && <button onClick={handlePublish} disabled={isUploading} className="btn btn-success">☁️ Publicar no Zenodo</button>}
                    </div>
                    {compilationStatus}
                    {uploadStatus}
                    {pdfPreviewUrl && <iframe src={pdfPreviewUrl} className="pdf-preview" title="PDF Preview" />}
                </section>
            )}

            {publishedPapers.length > 0 && (
                <section className="card">
                    <h2>📚 Artigos Publicados no Zenodo ({publishedPapers.length})</h2>
                    <div className="papers-list">
                        {publishedPapers.map(p => (
                            <div key={p.id} className="paper-item">
                                <h3>{p.title}</h3>
                                <p>📚 {p.discipline} | 📅 {new Date(p.date).toLocaleString()}</p>
                                <p>DOI: <a href={p.link} target="_blank" rel="noopener noreferrer">{p.doi}</a></p>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
};

export default App;

