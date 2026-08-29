import React from 'react';
import type { PaperSource } from '../types';

interface SourceDisplayProps {
    sources: PaperSource[];
}

const SourceDisplay: React.FC<SourceDisplayProps> = ({ sources }) => {
    if (sources.length === 0) return null;

    return (
        <div className="source-display">
            <h4>📚 Fontes Utilizadas ({sources.length})</h4>
            <ul className="source-list">
                {sources.map((source, index) => (
                    <li key={index} className="source-item">
                        <a href={source.uri || source.url} target="_blank" rel="noopener noreferrer" className="source-link" title={source.title}>
                            {source.title || source.uri || source.url}
                        </a>
                        <span className="source-meta">{source.authors} ({source.year})</span>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default SourceDisplay;
