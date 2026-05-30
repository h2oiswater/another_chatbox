import React, { useState, useEffect, useRef } from 'react';
import type { ConceptNode } from '../types';
import { LLMMessage } from './LLMMessage';
import { 
  GraduationCap, 
  Sidebar as SidebarIcon, 
  Lightbulb, 
  GitBranch, 
  ArrowUpCircle, 
  X, 
  ArrowLeftCircle 
} from 'lucide-react';

interface ChatViewProps {
  nodeID: string;
  nodes: ConceptNode[];
  isSending: boolean;
  apiError: string | null;
  onCloseError: () => void;
  onSendMessage: (text: string) => void;
  onToggleFeynmanMode: (id: string, enabled: boolean) => void;
  onConceptClick: (concept: string) => void;
  showRightPanel: boolean;
  onToggleRightPanel: () => void;
  onSpawnBranch: (concept: string, parentNodeID: string, sourceMsgID?: string, selectedText?: string) => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  nodeID,
  nodes,
  isSending,
  apiError,
  onCloseError,
  onSendMessage,
  onToggleFeynmanMode,
  onConceptClick,
  showRightPanel,
  onToggleRightPanel,
  onSpawnBranch
}) => {
  const [inputText, setInputText] = useState('');
  
  // Selection branch tracking
  const [selectedText, setSelectedText] = useState('');
  const [selectedMsgID, setSelectedMsgID] = useState<string | null>(null);

  // Stabilize onConceptClick to prevent re-renders of message bubbles during selection
  const onConceptClickRef = useRef(onConceptClick);
  useEffect(() => {
    onConceptClickRef.current = onConceptClick;
  }, [onConceptClick]);

  const stableOnConceptClick = React.useCallback((concept: string) => {
    onConceptClickRef.current(concept);
  }, []);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamContainerRef = useRef<HTMLDivElement>(null);

  const node = nodes.find((n) => n.id === nodeID);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [node?.messages.length, isSending]);

  // Monitor text selections in message bubbles
  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection) return;

      const text = selection.toString().trim();
      console.log('[Selection] Selected text:', JSON.stringify(text));
      if (text.length > 0 && text.length < 60 && !text.includes('\n')) {
        let anchor = selection.anchorNode;
        console.log('[Selection] Anchor node:', anchor);
        let isBubble = false;
        let msgID: string | null = null;
        let bubbleNodeID: string | null = null;

        while (anchor && anchor !== document.body) {
          console.log('[Selection] Traversing node:', anchor, 'classList:', anchor instanceof HTMLElement ? Array.from(anchor.classList) : 'not HTMLElement');
          if (anchor instanceof HTMLElement && anchor.classList.contains('message-bubble')) {
            isBubble = true;
            msgID = anchor.getAttribute('data-message-id');
            bubbleNodeID = anchor.getAttribute('data-node-id');
            console.log('[Selection] Found message bubble! msgID:', msgID, 'bubbleNodeID:', bubbleNodeID, 'current nodeID:', nodeID);
            break;
          }
          anchor = anchor.parentNode;
        }

        if (isBubble && msgID && bubbleNodeID === nodeID) {
          console.log('[Selection] Success! Setting selected text:', text);
          setSelectedText(text);
          setSelectedMsgID(msgID);
          return;
        } else {
          console.log('[Selection] Failed match criteria. isBubble:', isBubble, 'msgID:', msgID, 'bubbleNodeID:', bubbleNodeID, 'nodeID:', nodeID);
        }
      } else {
        console.log('[Selection] Failed text checks. length:', text.length, 'hasNewline:', text.includes('\n'));
      }
      
      setSelectedText('');
      setSelectedMsgID(null);
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [nodeID]);

  if (!node) {
    return (
      <div className="welcome-placeholder">
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <h2>Select a study topic to begin learning</h2>
        </div>
      </div>
    );
  }

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (text && !isSending) {
      onSendMessage(text);
      setInputText('');
    }
  };

  const handleBranchClick = () => {
    if (selectedText && selectedMsgID) {
      onSpawnBranch(selectedText, nodeID, selectedMsgID, selectedText);
      // Clear selection
      window.getSelection()?.removeAllRanges();
      setSelectedText('');
      setSelectedMsgID(null);
    }
  };

  const isMastered = node.status === 'green';

  return (
    <section className="chat-panel" style={{ width: '100%' }}>
      
      {/* Chat Header */}
      <header className="chat-header">
        <div className="chat-header-info">
          <div className="chat-header-title-row">
            <span className="chat-header-title">{node.title}</span>
            <span className={`badge ${isMastered ? 'mastered' : 'learning'}`}>
              {isMastered ? 'Mastered' : 'Learning'}
            </span>
          </div>
          <span className="chat-header-subtitle">
            {node.parentID ? 'Explaining concept in parent thread' : 'Root study session'}
          </span>
        </div>

        <div className="chat-header-actions" style={{ display: 'flex' }}>
          {!isMastered && (
            <button 
              className={`btn-secondary ${node.feynmanMode ? '' : 'master-btn'}`}
              onClick={() => onToggleFeynmanMode(node.id, !node.feynmanMode)}
            >
              {node.feynmanMode ? (
                <>
                  <ArrowLeftCircle style={{ width: '15px', height: '15px' }} />
                  <span>Exit Exam</span>
                </>
              ) : (
                <>
                  <GraduationCap style={{ width: '15px', height: '15px' }} />
                  <span>Master Concept</span>
                </>
              )}
            </button>
          )}
          <button 
            className={`btn-icon ${showRightPanel ? 'active' : ''}`}
            onClick={onToggleRightPanel}
            title={showRightPanel ? 'Hide Nested Concepts' : 'Show Nested Concepts'}
          >
            <SidebarIcon style={{ width: '18px', height: '18px' }} />
          </button>
        </div>
      </header>

      {/* Feynman Mode Active Banner */}
      {node.feynmanMode && (
        <div className="feynman-banner">
          <span className="feynman-banner-title">
            <Lightbulb style={{ width: '14px', height: '14px', color: '#f97316' }} />
            Strict Gate active recall check
          </span>
          <span className="feynman-banner-desc">
            Explain <strong>{node.conceptToExplain}</strong> in your own words below. The LLM will evaluate your explanation strictly. You must pass to master the card.
          </span>
        </div>
      )}

      {/* Message Scroll Area */}
      <div className="messages-container" ref={streamContainerRef}>
        {node.messages.map((msg) => {
          if (msg.sender === 'system') {
            return (
              <div key={msg.id} className="message-wrapper">
                <div className="message-system-summary">{msg.text}</div>
              </div>
            );
          }

          const isUser = msg.sender === 'user';
          return (
            <div key={msg.id} className="message-wrapper">
              <div className={`message-row ${isUser ? 'user' : 'assistant'}`}>
                <div 
                  className="message-bubble" 
                  data-message-id={msg.id} 
                  data-node-id={nodeID}
                >
                  <LLMMessage 
                    text={msg.text} 
                    onConceptClick={stableOnConceptClick} 
                    isUser={isUser} 
                  />
                </div>
              </div>
            </div>
          );
        })}
        
        {/* Thinking Indicator */}
        {isSending && node.messages[node.messages.length - 1]?.sender === 'user' && (
          <div className="thinking-indicator">
            <div className="spinner"></div>
            <span>AI is thinking...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Selection Branch Recommendation Helper */}
      {selectedText && (
        <div 
          className="selection-helper" 
          style={{ display: 'flex' }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <button className="btn-branch" onClick={handleBranchClick}>
            <GitBranch style={{ width: '14px', height: '14px' }} />
            Branch selection: "{selectedText}"
          </button>
        </div>
      )}

      {/* Error Banner */}
      {apiError && (
        <div className="error-banner" style={{ display: 'flex' }}>
          <span>{apiError}</span>
          <button className="btn-icon" style={{ color: 'inherit', padding: '2px' }} onClick={onCloseError}>
            <X style={{ width: '14px', height: '14px' }} />
          </button>
        </div>
      )}

      {/* Input Form Box */}
      <form className="chat-input-bar" onSubmit={handleSend} style={{ display: 'flex' }}>
        <input 
          type="text" 
          className="chat-input"
          placeholder={node.feynmanMode ? `Explain ${node.conceptToExplain} in your own words...` : "Ask a question about this concept..."}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          disabled={isSending}
          autoComplete="off"
        />
        <button 
          type="submit" 
          className="chat-send-btn" 
          disabled={isSending || !inputText.trim()}
        >
          <ArrowUpCircle style={{ width: '24px', height: '24px' }} />
        </button>
      </form>

    </section>
  );
};
