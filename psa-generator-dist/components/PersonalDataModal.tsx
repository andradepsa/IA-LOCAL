import React from 'react';
import type { PersonalData } from '../types';
import { FIXED_AUTHOR_1, DISCIPLINE_AUTHORS_FULL } from '../constants';

interface PersonalDataModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: PersonalData[]) => void;
    initialData: PersonalData[];
    discipline: string;
}

const PersonalDataModal: React.FC<PersonalDataModalProps> = ({ isOpen, onClose, onSave, initialData, discipline }) => {
    if (!isOpen) return null;

    const author2 = DISCIPLINE_AUTHORS_FULL[discipline] || DISCIPLINE_AUTHORS_FULL['Artificial Intelligence'];

    return (
        <div className="modal-overlay">
            <div className="modal">
                <div className="modal-header">
                    <h2>👤 Dados dos Autores</h2>
                    <button onClick={onClose} className="modal-close">✕</button>
                </div>

                <div className="author-section">
                    <h3>Autor 1 (Fixo — Revista)</h3>
                    <div className="form-group">
                        <label>Nome:</label>
                        <input type="text" value={FIXED_AUTHOR_1.name} readOnly className="text-input read-only" />
                    </div>
                    <div className="form-group">
                        <label>Afiliação:</label>
                        <input type="text" value={FIXED_AUTHOR_1.affiliation} readOnly className="text-input read-only" />
                    </div>
                    <div className="form-group">
                        <label>ORCID:</label>
                        <input type="text" value={FIXED_AUTHOR_1.orcid} readOnly className="text-input read-only" />
                    </div>
                </div>

                <div className="author-section">
                    <h3>Autor 2 (Disciplina: {discipline})</h3>
                    <div className="form-group">
                        <label>Nome:</label>
                        <input type="text" value={author2.name} readOnly className="text-input read-only" />
                    </div>
                    <div className="form-group">
                        <label>Afiliação:</label>
                        <input type="text" value={author2.affiliation} readOnly className="text-input read-only" />
                    </div>
                    <div className="form-group">
                        <label>ORCID:</label>
                        <input type="text" value={author2.orcid} readOnly className="text-input read-only" />
                    </div>
                </div>

                <div className="modal-actions">
                    <button onClick={onClose} className="btn btn-primary">Fechar</button>
                </div>
            </div>
        </div>
    );
};

export default PersonalDataModal;
