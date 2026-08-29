import React from 'react';
import type { IterationAnalysis } from '../types';

interface ResultsDisplayProps {
    analysisResults: IterationAnalysis[];
    totalIterations: number;
}

const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ analysisResults, totalIterations }) => {
    if (analysisResults.length === 0) return null;

    const getScoreLabel = (score: number) => {
        if (score >= 9) return '🏆 Excelente';
        if (score >= 7) return '✅ Bom';
        if (score >= 5) return '⚠️ Aceitável';
        return '❌ Ruim';
    };

    const getScoreColor = (score: number) => {
        if (score >= 9) return '#10b981';
        if (score >= 7) return '#3b82f6';
        if (score >= 5) return '#f59e0b';
        return '#ef4444';
    };

    return (
        <div className="results-display">
            <h4>Resultados da Análise</h4>
            {analysisResults.map(iter => (
                <div key={iter.iteration} className="iteration-result">
                    <h5>Iteração {iter.iteration} de {totalIterations} — Média: {iter.averageScore.toFixed(1)}</h5>
                    <div className="scores-grid">
                        {iter.scores.map((s, i) => (
                            <div key={i} className="score-item">
                                <div className="score-header">
                                    <span className="score-name">{s.name}</span>
                                    <span className="score-value" style={{ color: getScoreColor(s.score) }}>
                                        {s.score.toFixed(1)} {getScoreLabel(s.score)}
                                    </span>
                                </div>
                                <p className="score-improvement">{s.improvement}</p>
                            </div>
                        ))}
                    </div>
                    {iter.summary && <p className="iteration-summary">{iter.summary}</p>}
                </div>
            ))}
        </div>
    );
};

export default ResultsDisplay;
