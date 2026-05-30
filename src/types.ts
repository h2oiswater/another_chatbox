export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: string;
}

export type NodeStatus = 'yellow' | 'green';

export interface ConceptNode {
  id: string;
  title: string;
  parentID: string | null;
  messages: ChatMessage[];
  status: NodeStatus;
  feynmanMode: boolean;
  conceptToExplain: string;
  timestamp: string;
}

export interface LLMConfig {
  providerType: 'anthropic' | 'openai';
  apiKey: string;
  apiURL: string;
  selectedModel: string;
}

export interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'ERROR' | 'REQUEST' | 'RESPONSE';
  message: string;
}
