import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatView } from './components/ChatView';
import { ChildNodesList } from './components/ChildNodesList';
import { NestedModal } from './components/NestedModal';
import { SettingsModal } from './components/SettingsModal';
import { NewTopicModal } from './components/Dialogs';
import type { ConceptNode, ChatMessage } from './types';
import { logger } from './utils/logger';
import { getStreamingReply } from './utils/api';

// Welcome seed message
const WELCOME_INTRO_TEXT = `Welcome to **ConceptNest**! I'm here to help you study and learn complex ideas without losing your flow.

Here's how this app works:
1. **Ask questions** about any topic in this middle panel.
2. When I reply with a complex term you don't fully understand (for example, [Neural Networks] or [Vector Embeddings]), you can **select and copy** that phrase, and click **"+ Create Branch"** in the right panel to spawn a nested thread.
3. Alternatively, you can **select a word directly in this message**, and the branch helper will appear at the bottom!
4. The child node will appear in the right sidebar in **Yellow** (meaning it's not yet mastered).
5. Click on the child card in the right sidebar. It will scale up as a nested modal where you can talk to it privately.
6. When you feel you understand it, click **"Master Concept"** (the Feynman Technique!). You will be prompted to explain the concept in your own words.
7. If your explanation satisfies the strict evaluator, the card turns **Green** (Mastered), and the summary is automatically fed back to my parent context!

What topic would you like to explore today?`;

export const App: React.FC = () => {
  // ── Global States ──────────────────────────────────────────────────────────
  const [nodes, setNodes] = useState<ConceptNode[]>([]);
  const [selectedRootNodeID, setSelectedRootNodeID] = useState<string | null>(null);
  const [modalStack, setModalStack] = useState<string[]>([]);
  
  // Configurations
  const [providerType, setProviderType] = useState<'anthropic' | 'openai'>('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [apiURL, setApiURL] = useState('https://api.anthropic.com');
  const [selectedModel, setSelectedModel] = useState('claude-3-5-sonnet-20241022');
  
  // App UI states
  const [isSending, setIsSending] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Resize Panel states
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const [rightPanelWidth, setRightPanelWidth] = useState(260);
  const [showRightPanel, setShowRightPanel] = useState(true);

  // Dialog & Modal Toggles
  const [showSettings, setShowSettings] = useState(false);
  const [showNewTopic, setShowNewTopic] = useState(false);
  // Spawning variables are now managed inline during direct spawning

  // Resizer dragging references
  const isDraggingSidebar = useRef(false);
  const isDraggingRight = useRef(false);

  // ── Initial State Loading ──────────────────────────────────────────────────
  useEffect(() => {
    // 1. Load API Configurations
    const storedProvider = localStorage.getItem('llm_provider_type') as 'anthropic' | 'openai' || 'anthropic';
    const storedKey = localStorage.getItem('llm_api_key') || '';
    const storedURL = localStorage.getItem('llm_api_url') || (storedProvider === 'anthropic' ? 'https://api.anthropic.com' : 'https://api.openai.com');
    const storedModel = localStorage.getItem('llm_selected_model') || (storedProvider === 'anthropic' ? 'claude-3-5-sonnet-20241022' : 'gpt-4o');

    setProviderType(storedProvider);
    setApiKey(storedKey);
    setApiURL(storedURL);
    setSelectedModel(storedModel);

    // 2. Load Nodes
    const data = localStorage.getItem('concept_nodes_data');
    if (data) {
      try {
        const loadedNodes: ConceptNode[] = JSON.parse(data);
        setNodes(loadedNodes);
        
        if (loadedNodes.length > 0) {
          // Select most recent root node
          const roots = loadedNodes.filter(n => !n.parentID)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          if (roots.length > 0) {
            setSelectedRootNodeID(roots[0].id);
          }
        } else {
          seedWelcomeData();
        }
      } catch (e: any) {
        logger.log('ERROR', `Failed to load nodes: ${e.message}`);
        seedWelcomeData();
      }
    } else {
      seedWelcomeData();
    }

    // Prompt settings if key is missing on load
    if (!storedKey) {
      setShowSettings(true);
    }
  }, []);

  // ── Persistence triggers ──────────────────────────────────────────────────
  const saveNodesToDisk = (updatedNodes: ConceptNode[]) => {
    try {
      localStorage.setItem('concept_nodes_data', JSON.stringify(updatedNodes));
    } catch (e: any) {
      logger.log('ERROR', `Failed to save nodes: ${e.message}`);
    }
  };

  const seedWelcomeData = () => {
    const id = crypto.randomUUID();
    const welcomeNode: ConceptNode = {
      id: id,
      title: 'Welcome to ConceptNest! 🪹',
      parentID: null,
      messages: [
        {
          id: crypto.randomUUID(),
          sender: 'assistant',
          text: WELCOME_INTRO_TEXT,
          timestamp: new Date().toISOString()
        }
      ],
      status: 'yellow',
      feynmanMode: false,
      conceptToExplain: 'ConceptNest',
      timestamp: new Date().toISOString()
    };
    
    const initialNodes = [welcomeNode];
    setNodes(initialNodes);
    setSelectedRootNodeID(id);
    saveNodesToDisk(initialNodes);
  };

  // ── API Configuration Actions ──────────────────────────────────────────────
  const handleSaveConfig = (
    newProvider: 'anthropic' | 'openai',
    newKey: string,
    newURL: string,
    newModel: string
  ) => {
    setProviderType(newProvider);
    setApiKey(newKey);
    setApiURL(newURL);
    setSelectedModel(newModel);

    localStorage.setItem('llm_provider_type', newProvider);
    localStorage.setItem('llm_api_key', newKey);
    localStorage.setItem('llm_api_url', newURL);
    localStorage.setItem('llm_selected_model', newModel);

    logger.log('INFO', `API Configuration updated. Provider: ${newProvider}, Model: ${newModel}`);
  };

  // ── Node Actions ───────────────────────────────────────────────────────────
  
  const handleNewRootNode = (title: string) => {
    const id = crypto.randomUUID();
    const newNode: ConceptNode = {
      id: id,
      title: title,
      parentID: null,
      messages: [],
      status: 'yellow',
      feynmanMode: false,
      conceptToExplain: title,
      timestamp: new Date().toISOString()
    };

    const updated = [...nodes, newNode];
    setNodes(updated);
    setSelectedRootNodeID(id);
    setModalStack([]); // Clear modal stack when switching roots
    saveNodesToDisk(updated);

    // Run background LLM greeting
    triggerLLMReply(id, updated, `Introduce the topic of '${title}' in a clean, high-level way. End by asking what specific aspect they want to look at first.`);
  };

  const spawnConceptDirectly = (
    concept: string,
    parentID: string,
    sourceMsgID?: string | null,
    selectedText?: string | null
  ) => {
    const cleanConcept = concept.trim();
    if (!cleanConcept || !parentID) return;

    // Check if duplicate child node already exists to prevent duplicate cards
    const existing = nodes.find(n => n.parentID === parentID && n.conceptToExplain.toLowerCase() === cleanConcept.toLowerCase());
    if (existing) {
      // Direct jump to it
      if (!modalStack.includes(existing.id)) {
        setModalStack([...modalStack, existing.id]);
      } else {
        const idx = modalStack.indexOf(existing.id);
        setModalStack(modalStack.slice(0, idx + 1));
      }
      return;
    }

    const id = crypto.randomUUID();
    
    // Setup child node
    const childNode: ConceptNode = {
      id: id,
      title: cleanConcept,
      parentID: parentID,
      messages: [
        {
          id: crypto.randomUUID(),
          sender: 'user',
          text: `Explain the concept of '${cleanConcept}' simply with a clear analogy.`,
          timestamp: new Date().toISOString()
        }
      ],
      status: 'yellow',
      feynmanMode: false,
      conceptToExplain: cleanConcept,
      timestamp: new Date().toISOString()
    };

    // If spawned from text selection on a specific message bubble, inject brackets
    let updatedNodes = [...nodes];
    if (sourceMsgID && selectedText) {
      const parentNodeIndex = updatedNodes.findIndex(n => n.id === parentID);
      if (parentNodeIndex !== -1) {
        const msgIndex = updatedNodes[parentNodeIndex].messages.findIndex(m => m.id === sourceMsgID);
        if (msgIndex !== -1) {
          const originalText = updatedNodes[parentNodeIndex].messages[msgIndex].text;
          // Wrap only the first occurrence of selection if not already wrapped
          if (originalText.includes(selectedText) && !originalText.includes(`[${selectedText}]`)) {
            updatedNodes[parentNodeIndex].messages[msgIndex].text = originalText.replace(selectedText, `[${selectedText}]`);
          }
        }
      }
    }

    updatedNodes.push(childNode);
    setNodes(updatedNodes);
    setModalStack([...modalStack, id]);
    saveNodesToDisk(updatedNodes);

    // Call LLM reply trigger
    triggerLLMReply(id, updatedNodes);
  };

  const handleDeleteNode = (id: string) => {
    const idsToDelete = new Set<string>([id]);
    const checkQueue = [id];

    while (checkQueue.length > 0) {
      const current = checkQueue.shift()!;
      const children = nodes.filter(n => n.parentID === current).map(n => n.id);
      for (const childID of children) {
        if (!idsToDelete.has(childID)) {
          idsToDelete.add(childID);
          checkQueue.push(childID);
        }
      }
    }

    const updated = nodes.filter(n => !idsToDelete.has(n.id));
    setNodes(updated);

    // Clean up active selections
    if (selectedRootNodeID && idsToDelete.has(selectedRootNodeID)) {
      const roots = updated.filter(n => !n.parentID)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setSelectedRootNodeID(roots.length > 0 ? roots[0].id : null);
    }

    // Trim modal stack
    setModalStack(modalStack.filter(mID => !idsToDelete.has(mID)));
    saveNodesToDisk(updated);
  };

  const handleToggleFeynmanMode = (id: string, enabled: boolean) => {
    const updated = nodes.map(node => {
      if (node.id === id) {
        const messages = [...node.messages];
        if (enabled) {
          messages.push({
            id: crypto.randomUUID(),
            sender: 'assistant',
            text: `Explain '${node.conceptToExplain}' in your own words to master this card. I will review your accuracy, simplicity, and identify any gaps.`,
            timestamp: new Date().toISOString()
          });
        }
        return {
          ...node,
          feynmanMode: enabled,
          messages
        };
      }
      return node;
    });

    setNodes(updated);
    saveNodesToDisk(updated);
  };

  // ── Messaging & Streaming Actions ──────────────────────────────────────────
  
  const handleSendMessage = (nodeID: string, text: string) => {
    const targetNodeIndex = nodes.findIndex(n => n.id === nodeID);
    if (targetNodeIndex === -1) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      sender: 'user',
      text: text,
      timestamp: new Date().toISOString()
    };

    const updatedNodes = nodes.map((node, index) => {
      if (index === targetNodeIndex) {
        return {
          ...node,
          messages: [...node.messages, userMessage]
        };
      }
      return node;
    });

    setNodes(updatedNodes);
    setIsSending(true);
    setApiError(null);
    saveNodesToDisk(updatedNodes);

    triggerLLMReply(nodeID, updatedNodes);
  };

  const triggerLLMReply = async (
    nodeID: string,
    currentNodesList: ConceptNode[],
    initialPrompt: string | null = null
  ) => {
    const targetNode = currentNodesList.find(n => n.id === nodeID);
    if (!targetNode) return;

    const chatHistory = [...targetNode.messages];
    if (initialPrompt) {
      chatHistory.unshift({
        id: crypto.randomUUID(),
        sender: 'user',
        text: initialPrompt,
        timestamp: new Date().toISOString()
      });
    }

    const newMsgID = crypto.randomUUID();
    const emptyAssistantMessage: ChatMessage = {
      id: newMsgID,
      sender: 'assistant',
      text: '',
      timestamp: new Date().toISOString()
    };

    // Append empty message first
    const withEmptyMsg = currentNodesList.map(n => {
      if (n.id === nodeID) {
        return {
          ...n,
          messages: [...n.messages, emptyAssistantMessage]
        };
      }
      return n;
    });

    setNodes(withEmptyMsg);
    setIsSending(true);
    setApiError(null);

    try {
      const isFeynman = targetNode.feynmanMode;
      const historyPayload = chatHistory.map(m => ({
        sender: m.sender,
        text: m.text
      }));

      let accumulated = '';
      await getStreamingReply({
        providerType,
        apiKey,
        apiURL,
        model: selectedModel,
        history: historyPayload,
        concept: targetNode.conceptToExplain,
        isFeynmanMode: isFeynman,
        onChunk: (chunk) => {
          accumulated += chunk;
          
          // Live update message text in state
          setNodes(prevNodes => prevNodes.map(n => {
            if (n.id === nodeID) {
              return {
                ...n,
                messages: n.messages.map(m => {
                  if (m.id === newMsgID) {
                    return { ...m, text: accumulated };
                  }
                  return m;
                })
              };
            }
            return n;
          }));
        }
      });

      // Stream completed successfully. Perform post-processing.
      setNodes(prevNodes => {
        let nodeStatusToUpdate: 'green' | 'yellow' | null = null;
        let turnOffFeynman = false;
        let injectParentSummary: { parentID: string; summary: string } | null = null;

        const processedNodes = prevNodes.map(n => {
          if (n.id === nodeID) {
            let finalReply = accumulated;

            if (isFeynman) {
              if (accumulated.startsWith('EVALUATION: PASSED')) {
                nodeStatusToUpdate = 'green';
                turnOffFeynman = true;

                if (n.parentID) {
                  const cleanExplanation = accumulated.replace(/^EVALUATION: PASSED\n?/, '');
                  injectParentSummary = {
                    parentID: n.parentID,
                    summary: `System Update: The user has successfully mastered the concept of '${n.conceptToExplain}' with explanation: ${cleanExplanation}`
                  };
                }

                finalReply = accumulated.replace(/^EVALUATION: PASSED\n?/, '');
              } else if (accumulated.startsWith('EVALUATION: FAILED')) {
                finalReply = accumulated.replace(/^EVALUATION: FAILED\n?/, '');
              }
            }

            return {
              ...n,
              status: nodeStatusToUpdate || n.status,
              feynmanMode: turnOffFeynman ? false : n.feynmanMode,
              messages: n.messages.map(m => {
                if (m.id === newMsgID) {
                  return { ...m, text: finalReply };
                }
                return m;
              })
            };
          }
          return n;
        });

        // Inject summary to parent if required
        let finalNodesList = processedNodes;
        if (injectParentSummary) {
          finalNodesList = processedNodes.map(n => {
            if (n.id === injectParentSummary!.parentID) {
              const systemMsg: ChatMessage = {
                id: crypto.randomUUID(),
                sender: 'system',
                text: injectParentSummary!.summary,
                timestamp: new Date().toISOString()
              };
              return {
                ...n,
                messages: [...n.messages, systemMsg]
              };
            }
            return n;
          });
        }

        saveNodesToDisk(finalNodesList);
        return finalNodesList;
      });

      setIsSending(false);

    } catch (err: any) {
      logger.log('ERROR', `Streaming failed: ${err.message}`);
      setApiError(err.message);
      setIsSending(false);

      // Clean up empty message from tree
      setNodes(prev => prev.map(n => {
        if (n.id === nodeID) {
          return {
            ...n,
            messages: n.messages.filter(m => !(m.id === newMsgID && m.text === ''))
          };
        }
        return n;
      }));
    }
  };

  // ── Drag dividers coordinate listeners ─────────────────────────────────────
  
  const handleSidebarDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingSidebar.current = true;
    document.addEventListener('mousemove', handleSidebarDragMove);
    document.addEventListener('mouseup', handleSidebarDragEnd);
  };

  const handleSidebarDragMove = (e: MouseEvent) => {
    if (!isDraggingSidebar.current) return;
    const newWidth = e.clientX;
    if (newWidth > 180 && newWidth < 380) {
      setSidebarWidth(newWidth);
    }
  };

  const handleSidebarDragEnd = () => {
    isDraggingSidebar.current = false;
    document.removeEventListener('mousemove', handleSidebarDragMove);
    document.removeEventListener('mouseup', handleSidebarDragEnd);
  };

  const handleRightDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRight.current = true;
    document.addEventListener('mousemove', handleRightDragMove);
    document.addEventListener('mouseup', handleRightDragEnd);
  };

  const handleRightDragMove = (e: MouseEvent) => {
    if (!isDraggingRight.current) return;
    const newWidth = window.innerWidth - e.clientX;
    if (newWidth > 200 && newWidth < 440) {
      setRightPanelWidth(newWidth);
    }
  };

  const handleRightDragEnd = () => {
    isDraggingRight.current = false;
    document.removeEventListener('mousemove', handleRightDragMove);
    document.removeEventListener('mouseup', handleRightDragEnd);
  };

  // ── Concept Navigation Clicks ──────────────────────────────────────────────
  const handleConceptClick = (concept: string, parentNodeID: string) => {
    spawnConceptDirectly(concept, parentNodeID);
  };

  const handleTriggerSelectionBranch = (
    concept: string,
    parentNodeID: string,
    sourceMsgID?: string,
    selectedText?: string
  ) => {
    spawnConceptDirectly(concept, parentNodeID, sourceMsgID, selectedText);
  };

  // ── Shared Subcomponents Renderers ─────────────────────────────────────────

  const renderActiveChat = (nodeID: string, showPanelToggle: boolean, onToggle: () => void) => {
    return (
      <ChatView
        nodeID={nodeID}
        nodes={nodes}
        isSending={isSending}
        apiError={apiError}
        onCloseError={() => setApiError(null)}
        onSendMessage={(text) => handleSendMessage(nodeID, text)}
        onToggleFeynmanMode={handleToggleFeynmanMode}
        onConceptClick={(concept) => handleConceptClick(concept, nodeID)}
        showRightPanel={showPanelToggle}
        onToggleRightPanel={onToggle}
        onSpawnBranch={handleTriggerSelectionBranch}
      />
    );
  };

  const renderActiveChildList = (nodeID: string) => {
    return (
      <ChildNodesList
        parentID={nodeID}
        nodes={nodes}
        onSelectNode={(id) => setModalStack([...modalStack, id])}
        onDeleteNode={handleDeleteNode}
      />
    );
  };

  // ── Primary Render ─────────────────────────────────────────────────────────
  return (
    <div id="app-root">
      
      {/* Sidebar Panel */}
      <div style={{ width: `${sidebarWidth}px`, flexShrink: 0, height: '100%' }}>
        <Sidebar
          nodes={nodes}
          selectedRootNodeID={selectedRootNodeID}
          onSelectRoot={(id) => {
            setSelectedRootNodeID(id);
            setModalStack([]); // Reset stack
          }}
          onDeleteNode={handleDeleteNode}
          onNewTopicTrigger={() => setShowNewTopic(true)}
          onSettingsTrigger={() => setShowSettings(true)}
          selectedModel={selectedModel}
          apiKeyMissing={!apiKey}
        />
      </div>

      {/* Sidebar resizer handle */}
      <div 
        className={`divider-handle ${isDraggingSidebar.current ? 'dragging' : ''}`}
        onMouseDown={handleSidebarDragStart}
      ></div>

      {/* Workspace panel content */}
      <main className="main-content">
        
        {/* Main Chat Stream */}
        {selectedRootNodeID ? (
          renderActiveChat(selectedRootNodeID, showRightPanel, () => setShowRightPanel(!showRightPanel))
        ) : (
          <div className="welcome-placeholder">
            <div style={{ padding: '20px', textAlign: 'center' }}>
              <h2>Welcome to ConceptNest</h2>
              <p>Select a study topic from the sidebar or click "New Study Topic" to start learning.</p>
            </div>
          </div>
        )}

        {/* Right resizer divider */}
        {showRightPanel && selectedRootNodeID && (
          <div 
            className={`divider-handle ${isDraggingRight.current ? 'dragging' : ''}`}
            onMouseDown={handleRightDragStart}
          ></div>
        )}

        {/* Right panel child card list */}
        {showRightPanel && selectedRootNodeID && (
          <div style={{ width: `${rightPanelWidth}px`, flexShrink: 0, height: '100%' }}>
            {renderActiveChildList(selectedRootNodeID)}
          </div>
        )}

      </main>

      {/* ── Modals & Dialogs overlays ────────────────────────────────────── */}

      {/* 1. Settings & Diagnostics Modal */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        config={{ providerType, apiKey, apiURL, selectedModel }}
        onSave={handleSaveConfig}
      />

      {/* 2. New Topic Modal */}
      <NewTopicModal
        isOpen={showNewTopic}
        onClose={() => setShowNewTopic(false)}
        onConfirm={handleNewRootNode}
      />

      {/* Spawn branch dialog has been replaced by direct spawning flow */}

      {/* 4. Recursive Workspaces (Nested Modals Stack) */}
      <NestedModal
        isOpen={modalStack.length > 0}
        modalStack={modalStack}
        nodes={nodes}
        onPop={() => setModalStack(modalStack.slice(0, -1))}
        onCloseAll={() => setModalStack([])}
        onJumpTo={(id) => {
          const idx = modalStack.indexOf(id);
          if (idx !== -1) setModalStack(modalStack.slice(0, idx + 1));
        }}
        renderChatView={renderActiveChat}
        renderChildList={renderActiveChildList}
      />

    </div>
  );
};
