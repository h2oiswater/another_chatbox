import React from 'react';
import type { ConceptNode } from '../types';
import { Brain, CheckCircle2, SquareDashed, Trash2 } from 'lucide-react';

interface ChildNodesListProps {
  parentID: string;
  nodes: ConceptNode[];
  onSelectNode: (id: string) => void;
  onDeleteNode: (id: string) => void;
}

export const ChildNodesList: React.FC<ChildNodesListProps> = ({
  parentID,
  nodes,
  onSelectNode,
  onDeleteNode
}) => {
  const children = nodes
    .filter((n) => n.parentID === parentID)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const handleDelete = (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete the concept "${title}" and its child threads recursively?`)) {
      onDeleteNode(id);
    }
  };

  return (
    <div className="right-panel" style={{ width: '100%' }}>
      <div className="nested-concepts-header">Nested Concepts</div>
      <div className="nested-concepts-list">
        {children.length === 0 ? (
          <div className="no-concepts-placeholder">
            <SquareDashed style={{ width: '32px', height: '32px', strokeWidth: '1.5', opacity: 0.2 }} />
            <div className="no-concepts-placeholder-title">No nested concepts here yet.</div>
            <div className="no-concepts-placeholder-desc">
              Highlight/select a word in the chat bubbles, and click the "+" helper button that appears at the bottom to spawn a child node.
            </div>
          </div>
        ) : (
          children.map((child) => {
            const isMastered = child.status === 'green';
            const count = child.messages.length;
            const msgLabel = `${count} message${count === 1 ? '' : 's'}`;

            return (
              <div
                key={child.id}
                className={`concept-card ${isMastered ? 'mastered' : 'learning'}`}
                title={`Click to open nested workspace for "${child.title}"`}
                onClick={() => onSelectNode(child.id)}
              >
                <div className="concept-card-content">
                  <div className="concept-card-title-row">
                    {isMastered ? (
                      <CheckCircle2 className="concept-card-icon mastered" style={{ width: '14px', height: '14px', color: '#10b981' }} />
                    ) : (
                      <Brain className="concept-card-icon learning" style={{ width: '14px', height: '14px', color: '#f59e0b' }} />
                    )}
                    <span className="concept-card-title">{child.title}</span>
                  </div>
                  <span className="concept-card-meta">{msgLabel}</span>
                </div>
                <button
                  className="concept-card-delete"
                  title="Delete Concept"
                  onClick={(e) => handleDelete(e, child.id, child.title)}
                >
                  <Trash2 style={{ width: '13px', height: '13px' }} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
