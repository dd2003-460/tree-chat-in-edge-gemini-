export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface TreeNode {
  id: string;
  messages: Message[]; // A node now contains a sequence of messages
  parentId: string | null;
  childrenIds: string[];
  name?: string; // Optional custom name for the node
  isCollapsed?: boolean; // For collapsing/expanding in the tree view
}

export type Tree = Record<string, TreeNode>;

export interface AppSettings {
  model: string;
  ollamaApiUrl: string;
  systemPrompt: string;
  temperature: number;
  maxOutputTokens: number; // Corresponds to num_predict in Ollama
  historyLength: number; // Number of past messages to include in context
}

export interface GenerationStats {
  tps: number; // tokens per second
  eval_count: number;
  total_duration: number; // in nanoseconds
}
