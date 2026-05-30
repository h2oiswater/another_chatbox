import React, { useState, useEffect, useRef } from 'react';
import type { ConceptNode } from '../types';
import { ChevronLeft, ChevronRight, XCircle } from 'lucide-react';

interface NestedModalProps {
  isOpen: boolean;
  modalStack: string[];
  nodes: ConceptNode[];
  onPop: () => void;
  onCloseAll: () => void;
  onJumpTo: (id: string) => void;
  renderChatView: (nodeID: string, showRightPanel: boolean, onToggleRightPanel: () => void) => React.ReactNode;
  renderChildList: (nodeID: string) => React.ReactNode;
}

export const NestedModal: React.FC<NestedModalProps> = ({
  isOpen,
  modalStack,
  nodes,
  onPop,
  onCloseAll,
  onJumpTo,
  renderChatView,
  renderChildList
}) => {
  const [rightPanelWidth, setRightPanelWidth] = useState(260);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const isDragging = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setShowRightPanel(true);
    }
  }, [isOpen, modalStack.length]);

  if (!isOpen || modalStack.length === 0) return null;

  const activeNodeID = modalStack[modalStack.length - 1];
  const activeNode = nodes.find((n) => n.id === activeNodeID);

  if (!activeNode) return null;

  // Compute breadcrumbs path
  const path: ConceptNode[] = [];
  let currentID: string | null = activeNodeID;
  while (currentID) {
    const node = nodes.find((n) => n.id === currentID);
    if (node) {
      path.unshift(node);
      currentID = node.parentID;
    } else {
      break;
    }
  }

  // Handle Drag Resizing
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging.current) return;
    const newWidth = window.innerWidth - e.clientX;
    // Set bounds
    if (newWidth > 180 && newWidth < 420) {
      setRightPanelWidth(newWidth);
    }
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container nested-workspace-modal">
        
        {/* Navigation Bar / Breadcrumbs */}
        <div className="modal-nav-bar">
          <div className="modal-nav-left">
            <button className="btn-secondary" style={{ padding: '4px 10px' }} onClick={onPop}>
              <ChevronLeft style={{ width: '16px', height: '16px', marginRight: '2px' }} />
              Back
            </button>
            <div className="sidebar-divider" style={{ height: '16px', width: '1px', backgroundColor: 'var(--border-color)', margin: '0 8px' }}></div>
            
            <div className="breadcrumbs-container">
              {path.map((node, index) => {
                const isActive = node.id === activeNodeID;
                return (
                  <React.Fragment key={node.id}>
                    {index > 0 && (
                      <span className="breadcrumb-separator">
                        <ChevronRight style={{ width: '12px', height: '12px', color: 'var(--text-muted)' }} />
                      </span>
                    )}
                    <span
                      className={`breadcrumb-item ${isActive ? 'active' : ''}`}
                      onClick={() => !isActive && onJumpTo(node.id)}
                    >
                      {node.title}
                    </span>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
          
          <button className="btn-icon" onClick={onCloseAll} title="Close Workspace (Esc)">
            <XCircle style={{ width: '22px', height: '22px', color: 'var(--text-secondary)' }} />
          </button>
        </div>

        {/* Nested Content Workspace Split */}
        <div className="main-content">
          
          {/* Chat Panel */}
          {renderChatView(activeNodeID, showRightPanel, () => setShowRightPanel(!showRightPanel))}

          {/* Drag divider */}
          {showRightPanel && (
            <div 
              className={`divider-handle ${isDragging.current ? 'dragging' : ''}`} 
              onMouseDown={handleMouseDown}
            ></div>
          )}

          {/* Right Child Nodes List */}
          {showRightPanel && (
            <div style={{ width: `${rightPanelWidth}px`, flexShrink: 0, height: '100%' }}>
              {renderChildList(activeNodeID)}
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
