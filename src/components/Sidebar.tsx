import React from 'react';
import type { ConceptNode } from '../types';
import { Layers, PlusCircle, MessageSquare, Trash2, Settings as SettingsIcon, AlertTriangle } from 'lucide-react';

interface SidebarProps {
  nodes: ConceptNode[];
  selectedRootNodeID: string | null;
  onSelectRoot: (id: string) => void;
  onDeleteNode: (id: string) => void;
  onNewTopicTrigger: () => void;
  onSettingsTrigger: () => void;
  selectedModel: string;
  apiKeyMissing: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  nodes,
  selectedRootNodeID,
  onSelectRoot,
  onDeleteNode,
  onNewTopicTrigger,
  onSettingsTrigger,
  selectedModel,
  apiKeyMissing
}) => {
  const rootNodes = nodes
    .filter((n) => !n.parentID)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const formatTime = (isoString: string) => {
    const time = new Date(isoString);
    return (
      time.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
      ' ' +
      time.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
    );
  };

  const handleDelete = (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete the study topic "${title}"? This will delete all branched concepts recursively.`)) {
      onDeleteNode(id);
    }
  };

  return (
    <aside className="sidebar" style={{ width: '100%' }}>
      <div className="sidebar-header">
        <Layers style={{ width: '22px', height: '22px', marginRight: '2px', color: '#3b82f6' }} />
        <h1>ConceptNest</h1>
      </div>

      <div className="sidebar-divider"></div>

      <div className="new-topic-container">
        <button className="btn-primary" onClick={onNewTopicTrigger}>
          <PlusCircle style={{ width: '16px', height: '16px' }} />
          New Study Topic
        </button>
      </div>

      <div className="topic-list">
        {rootNodes.length === 0 ? (
          <div className="no-concepts-placeholder">
            <span style={{ fontSize: '0.8rem' }}>No study topics yet.</span>
          </div>
        ) : (
          rootNodes.map((node) => {
            const isActive = selectedRootNodeID === node.id;
            return (
              <div
                key={node.id}
                className={`topic-item ${isActive ? 'active' : ''}`}
                onClick={() => onSelectRoot(node.id)}
              >
                <MessageSquare className="bubble-icon" style={{ width: '16px', height: '16px' }} />
                <div className="topic-details">
                  <div className="topic-title">{node.title}</div>
                  <div className="topic-time">{formatTime(node.timestamp)}</div>
                </div>
                <button
                  className="topic-delete-btn"
                  title="Delete Topic"
                  onClick={(e) => handleDelete(e, node.id, node.title)}
                >
                  <Trash2 style={{ width: '14px', height: '14px' }} />
                </button>
              </div>
            );
          })
        )}
      </div>

      <div className="sidebar-footer">
        <button className="btn-link" onClick={onSettingsTrigger}>
          <SettingsIcon style={{ width: '16px', height: '16px' }} />
          Settings
        </button>
        {apiKeyMissing ? (
          <span className="footer-model-badge" style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '3px' }}>
            <AlertTriangle style={{ width: '12px', height: '12px' }} />
            Missing Key
          </span>
        ) : (
          <span className="footer-model-badge" title={selectedModel}>
            {selectedModel}
          </span>
        )}
      </div>
    </aside>
  );
};
