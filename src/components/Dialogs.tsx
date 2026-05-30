import React, { useState, useEffect, useRef } from 'react';

interface NewTopicModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (title: string) => void;
}

export const NewTopicModal: React.FC<NewTopicModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const [title, setTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    const trimmed = title.trim();
    if (trimmed) {
      onConfirm(trimmed);
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && title.trim()) {
      handleConfirm();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container dialog-modal" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-title">Start New Study Topic</div>
        <div className="dialog-body">
          <div className="form-group">
            <input
              ref={inputRef}
              type="text"
              placeholder="Enter topic (e.g. Deep Learning)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="off"
            />
          </div>
        </div>
        <div className="dialog-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button 
            className="btn-primary" 
            onClick={handleConfirm}
            style={{ width: '100px' }}
            disabled={!title.trim()}
          >
            Start
          </button>
        </div>
      </div>
    </div>
  );
};

interface SpawnBranchModalProps {
  isOpen: boolean;
  concept: string;
  onClose: () => void;
  onConfirm: (customPrompt: string) => void;
}

export const SpawnBranchModal: React.FC<SpawnBranchModalProps> = ({ isOpen, concept, onClose, onConfirm }) => {
  const [prompt, setPrompt] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPrompt(`Explain ${concept} simply with a clear analogy.`);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [isOpen, concept]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(prompt.trim());
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleConfirm();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container dialog-modal branch" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-title">Create Card for: "{concept}"</div>
        <div className="dialog-body">
          <div className="form-group">
            <label>Initial Prompt / Question</label>
            <textarea
              ref={textareaRef}
              placeholder="Explain this term simply..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
        </div>
        <div className="dialog-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button 
            className="btn-primary" 
            onClick={handleConfirm}
            style={{ width: '100px' }}
            disabled={!prompt.trim()}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );

};
