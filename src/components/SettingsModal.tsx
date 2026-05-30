import React, { useState, useEffect, useRef } from 'react';
import type { LLMConfig } from '../types';
import { logger } from '../utils/logger';
import { Trash2, Copy, Settings } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: LLMConfig;
  onSave: (providerType: 'anthropic' | 'openai', apiKey: string, apiURL: string, selectedModel: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, config, onSave }) => {
  const [activeTab, setActiveTab] = useState<'api' | 'logs'>('api');
  
  // Settings Form State
  const [providerType, setProviderType] = useState<'anthropic' | 'openai'>(config.providerType);
  const [apiKey, setApiKey] = useState(config.apiKey);
  const [apiURL, setApiURL] = useState(config.apiURL);
  const [selectedModel, setSelectedModel] = useState(config.selectedModel);

  // Logs state
  const [logsText, setLogsText] = useState(logger.getFormattedLogs());
  const logsConsoleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setProviderType(config.providerType);
      setApiKey(config.apiKey);
      setApiURL(config.apiURL);
      setSelectedModel(config.selectedModel);
      setLogsText(logger.getFormattedLogs());
    }
  }, [isOpen, config]);

  // Subscribe to logger updates
  useEffect(() => {
    const unsubscribe = logger.subscribe(() => {
      setLogsText(logger.getFormattedLogs());
    });
    return unsubscribe;
  }, []);

  // Scroll logs to bottom when logs updates
  useEffect(() => {
    if (activeTab === 'logs' && logsConsoleRef.current) {
      logsConsoleRef.current.scrollTop = logsConsoleRef.current.scrollHeight;
    }
  }, [logsText, activeTab]);

  if (!isOpen) return null;

  const handleProviderChange = (provider: 'anthropic' | 'openai') => {
    setProviderType(provider);
    if (provider === 'anthropic') {
      if (apiURL.includes('openai.com') || !apiURL) {
        setApiURL('https://api.anthropic.com');
      }
      if (selectedModel.includes('gpt') || !selectedModel) {
        setSelectedModel('claude-3-5-sonnet-20241022');
      }
    } else {
      if (apiURL.includes('anthropic.com') || !apiURL) {
        setApiURL('https://api.openai.com');
      }
      if (selectedModel.includes('claude') || !selectedModel) {
        setSelectedModel('gpt-4o');
      }
    }
  };

  const handleApplyPreset = (model: string, url: string) => {
    setSelectedModel(model);
    setApiURL(url);
  };

  const handleSave = () => {
    onSave(providerType, apiKey.trim(), apiURL.trim(), selectedModel.trim());
    onClose();
  };

  const handleClearLogs = () => {
    logger.clear();
    setLogsText('');
  };

  const handleCopyLogs = () => {
    navigator.clipboard.writeText(logsText);
    alert('Logs copied to clipboard!');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container settings-modal" onClick={(e) => e.stopPropagation()}>
        
        <div className="settings-header">
          <Settings style={{ width: '32px', height: '32px' }} />
          <div>
            <h2>Settings & Diagnostics</h2>
            <p>Configure LLM connections and inspect API stream consoles</p>
          </div>
        </div>

        <div className="settings-tab-buttons">
          <button 
            className={`settings-tab-btn ${activeTab === 'api' ? 'active' : ''}`}
            onClick={() => setActiveTab('api')}
          >
            API Settings
          </button>
          <button 
            className={`settings-tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
            onClick={() => setActiveTab('logs')}
          >
            API Console Logs
          </button>
        </div>

        <div className="settings-content">
          {activeTab === 'api' ? (
            <div className="settings-form">
              <div className="form-group">
                <label>LLM Provider</label>
                <div className="segmented-picker">
                  <button 
                    className={`segmented-btn ${providerType === 'anthropic' ? 'active' : ''}`}
                    onClick={() => handleProviderChange('anthropic')}
                  >
                    Anthropic Claude
                  </button>
                  <button 
                    className={`segmented-btn ${providerType === 'openai' ? 'active' : ''}`}
                    onClick={() => handleProviderChange('openai')}
                  >
                    OpenAI Compatible
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>API Base URL</label>
                <input 
                  type="text" 
                  value={apiURL}
                  onChange={(e) => setApiURL(e.target.value)}
                  placeholder={providerType === 'anthropic' ? 'https://api.anthropic.com' : 'https://api.openai.com'}
                />
                <p className="help-text">
                  Enter custom proxies or gateways if your environment restricts direct CORS API access (e.g. OpenRouter).
                </p>
              </div>

              <div className="form-group">
                <label>API Key</label>
                <input 
                  type="password" 
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                />
              </div>

              <div className="form-group">
                <label>Model Name</label>
                <input 
                  type="text" 
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  placeholder="model-name"
                />
                <div className="model-suggestions">
                  {providerType === 'anthropic' ? (
                    <>
                      <button 
                        className="btn-pill"
                        onClick={() => handleApplyPreset('claude-3-5-sonnet-20241022', 'https://api.anthropic.com')}
                      >
                        Claude 3.5 Sonnet
                      </button>
                      <button 
                        className="btn-pill"
                        onClick={() => handleApplyPreset('claude-3-haiku-20240307', 'https://api.anthropic.com')}
                      >
                        Claude 3 Haiku
                      </button>
                    </>
                  ) : (
                    <>
                      <button 
                        className="btn-pill"
                        onClick={() => handleApplyPreset('gpt-4o', 'https://api.openai.com')}
                      >
                        GPT-4o
                      </button>
                      <button 
                        className="btn-pill"
                        onClick={() => handleApplyPreset('gpt-4o-mini', 'https://api.openai.com')}
                      >
                        GPT-4o Mini
                      </button>
                      <button 
                        className="btn-pill"
                        onClick={() => handleApplyPreset('meta-llama/llama-3.1-70b-instruct', 'https://openrouter.ai/api')}
                      >
                        Llama 3.1 (OpenRouter)
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="logs-panel">
              <div 
                className="logs-console" 
                ref={logsConsoleRef}
              >
                {logsText || 'No requests logged yet.'}
              </div>
              <div className="logs-actions">
                <button className="btn-secondary" onClick={handleCopyLogs}>
                  <Copy style={{ width: '14px', height: '14px', marginRight: '6px' }} />
                  Copy Logs
                </button>
                <button className="btn-secondary" onClick={handleClearLogs}>
                  <Trash2 style={{ width: '14px', height: '14px', marginRight: '6px' }} />
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="settings-footer">
          <button className="btn-primary" style={{ width: '100px' }} onClick={handleSave}>Done</button>
        </div>

      </div>
    </div>
  );
};
