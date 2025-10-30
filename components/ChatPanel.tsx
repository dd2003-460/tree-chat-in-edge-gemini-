import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { Message, Tree, TreeNode, AppSettings, GenerationStats } from '../types';
import { streamChat } from '../services/ollamaService';
import ChatMessage from './ChatMessage';
import { SendIcon, BranchIcon, StopIcon, SplitIcon } from './icons';

interface ChatPanelProps {
  tree: Tree;
  activeNodeId: string;
  addNode: (message: Message, parentId: string) => string;
  appendMessage: (nodeId: string, message: Message) => void;
  setActiveNodeId: (nodeId: string) => void;
  updateNodeName: (nodeId: string, name: string) => void;
  getConversationHistory: (leafNodeId: string) => Message[];
  settings: AppSettings;
  onOpenBatchBranch: (selection: { text: string; nodeId: string }) => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ 
    tree, activeNodeId, addNode, appendMessage, setActiveNodeId, updateNodeName, getConversationHistory, settings, onOpenBatchBranch
}) => {
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<Message | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generationStats, setGenerationStats] = useState<GenerationStats | null>(null);
  const [selectionPopup, setSelectionPopup] = useState<{ top: number, left: number, text: string, nodeId: string } | null>(null);
  
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Memoize the conversation path to prevent unnecessary re-renders and effects
  const conversationPath = useMemo(() => {
    const path: TreeNode[] = [];
    let currentId: string | null = activeNodeId;
    while(currentId) {
        const node = tree[currentId];
        if (node) {
            path.unshift(node);
            currentId = node.parentId;
        } else {
            currentId = null;
        }
    }
    return path;
  }, [activeNodeId, tree]);


  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [conversationPath, streamingMessage]);

  const triggerAIResponse = useCallback(async (historyForApi: Message[], targetNodeId: string) => {
    let fullResponse = '';
    
    let finalHistory = [...historyForApi];
    if (settings.historyLength > 0 && finalHistory.length > settings.historyLength) {
        finalHistory = finalHistory.slice(-settings.historyLength);
    }
    if (settings.systemPrompt) {
        finalHistory.unshift({ role: 'system', content: settings.systemPrompt });
    }
    const options = {
        temperature: settings.temperature,
        num_predict: settings.maxOutputTokens > 0 ? settings.maxOutputTokens : -1,
    };

    abortControllerRef.current = new AbortController();
    setIsStreaming(true);
    setStreamingMessage({ role: 'assistant', content: '' });
    setGenerationStats(null);
    setError(null);

    try {
        for await (const chunk of streamChat(finalHistory, settings.model, settings.ollamaApiUrl, options, abortControllerRef.current.signal)) {
            if (typeof chunk === 'string') {
              fullResponse += chunk;
              setStreamingMessage({ role: 'assistant', content: fullResponse });
            } else if (chunk.type === 'stats' && chunk.data.eval_count > 0) {
              const tps = chunk.data.eval_count / (chunk.data.eval_duration / 1e9);
              setGenerationStats({
                  tps,
                  eval_count: chunk.data.eval_count,
                  total_duration: chunk.data.total_duration
              });
            }
        }
    } catch (err: any) {
        if (err.name === 'AbortError') {
            console.log('Stream aborted by user.');
        } else {
            console.error("Chat stream error:", err);
            let userFriendlyError = `与 Ollama 通信时出错: ${err.message}`;
            const errorMessage = (err.message || '').toLowerCase();
            if (errorMessage.includes('404') || errorMessage.includes('model not found')) {
                userFriendlyError = `模型 "${settings.model}" 未找到。\n请检查模型名称是否正确，在设置中选择一个可用的模型，或者通过 \`ollama pull ${settings.model}\` 来拉取它。`;
            } else if (errorMessage.includes('failed to fetch')) {
                userFriendlyError = `无法连接到 Ollama API at "${settings.ollamaApiUrl}"。\n请检查 URL 是否正确，并确认 Ollama 服务器正在运行。`;
            }
            setError(userFriendlyError);
        }
    } finally {
        setIsStreaming(false);
        setStreamingMessage(null);
        abortControllerRef.current = null;
        if (fullResponse.trim()) {
          appendMessage(targetNodeId, { role: 'assistant', content: fullResponse });
        } else if (!error && !fullResponse.trim()) {
            setError('AI 返回了空响应。');
        }
    }
  }, [appendMessage, settings]);


  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming || !settings.model) {
        if (!settings.model) setError("未选择任何模型。请进入设置选择一个模型。");
        return;
    };

    const userMessage: Message = { role: 'user', content: input };
    appendMessage(activeNodeId, userMessage);
    setInput('');
    
    // getConversationHistory now includes the message we just appended
    const historyForApi = getConversationHistory(activeNodeId);
    triggerAIResponse(historyForApi, activeNodeId);

  }, [input, isStreaming, appendMessage, activeNodeId, getConversationHistory, settings, triggerAIResponse]);
  
  const handleStopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
    }
  }, []);

  const handleBranchFromSelection = useCallback(() => {
    if (!selectionPopup || isStreaming) return;
    
    const { text, nodeId } = selectionPopup;
    const userMessage: Message = { role: 'user', content: text };
    
    const newNodeId = addNode(userMessage, nodeId); // Creates a new branch
    setActiveNodeId(newNodeId); // Activate the new branch
    
    const nodeName = text.substring(0, 35) + (text.length > 35 ? '...' : '');
    updateNodeName(newNodeId, nodeName);
    
    const historyForApi = getConversationHistory(newNodeId);
    triggerAIResponse(historyForApi, newNodeId); // AI will respond in the new node
    setSelectionPopup(null);

  }, [selectionPopup, isStreaming, addNode, setActiveNodeId, updateNodeName, getConversationHistory, triggerAIResponse]);
  
  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (isStreaming || !selection || selection.isCollapsed || !panelRef.current) {
        setSelectionPopup(null);
        return;
    }

    const selectedText = selection.toString().trim();
    if (selectedText.length < 3) {
        setSelectionPopup(null);
        return;
    }
    
    let parentNode: Node | null = selection.anchorNode;
    let messageNodeId: string | undefined = undefined;
    
    while(parentNode) {
        if (parentNode instanceof HTMLElement && parentNode.dataset.nodeId) {
            messageNodeId = parentNode.dataset.nodeId;
            break;
        }
        parentNode = parentNode.parentNode;
    }

    if (messageNodeId) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const panelRect = panelRef.current.getBoundingClientRect();
        
        setSelectionPopup({
            text: selectedText,
            nodeId: messageNodeId,
            top: rect.top - panelRect.top + (rect.height / 2),
            left: rect.right - panelRect.left + 10,
        });
    } else {
        setSelectionPopup(null);
    }
  };
  
  const handleOpenBatchBranch = () => {
    if (selectionPopup) {
        onOpenBatchBranch(selectionPopup);
        setSelectionPopup(null);
    }
  }

  return (
    <div ref={panelRef} className="h-full flex flex-col bg-brand-bg relative">
      <div ref={chatContainerRef} className="flex-grow overflow-y-auto p-4 md:p-8" onMouseUp={handleMouseUp} onScroll={() => setSelectionPopup(null)}>
        {conversationPath.map(node => (
            <React.Fragment key={node.id}>
                {node.messages.map((message, index) => (
                    <ChatMessage key={`${node.id}-${index}`} nodeId={node.id} message={message} />
                ))}
            </React.Fragment>
        ))}
        {streamingMessage && (
           <div className="group flex items-start space-x-4 p-4 my-2 rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-brand-muted">
                    <div className="w-2 h-2 bg-brand-accent rounded-full animate-pulse"></div>
                </div>
                <div className="flex-grow">
                    <p className="font-bold text-brand-text">助手</p>
                    <div className="text-brand-text/90 whitespace-pre-wrap">
                        {streamingMessage.content}
                    </div>
                </div>
            </div>
        )}
      </div>

       {selectionPopup && (
        <div
            className="absolute z-10 bg-brand-surface p-1 rounded-md shadow-lg flex items-center space-x-1 border border-brand-muted"
            style={{ 
                top: `${selectionPopup.top}px`, 
                left: `${selectionPopup.left}px`,
                transform: 'translateY(-50%)',
            }}
        >
            <button
                onClick={handleBranchFromSelection}
                className="text-white px-2 py-1 text-sm rounded-md flex items-center space-x-1 hover:bg-brand-accent"
                title="创建分支"
            >
                <BranchIcon className="w-4 h-4" />
            </button>
            <div className="w-px h-4 bg-brand-muted"></div>
            <button
                onClick={handleOpenBatchBranch}
                className="text-white px-2 py-1 text-sm rounded-md flex items-center space-x-1 hover:bg-brand-accent"
                title="批量创建分支"
            >
                <SplitIcon className="w-4 h-4" />
            </button>
        </div>
      )}

      <div className="p-4 md:p-8 border-t border-brand-muted">
        {error && <p className="text-red-400 text-sm mb-2 text-center whitespace-pre-wrap">{error}</p>}
        <div className="bg-brand-surface p-2 rounded-lg">
            <form onSubmit={handleSubmit} className="flex items-center space-x-4">
            <textarea
                id="chat-input"
                value={input}
                onChange={(e) => { setInput(e.target.value); if (error) setError(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e as unknown as React.FormEvent); }}}
                placeholder="输入你的消息..."
                className="flex-grow bg-transparent focus:outline-none resize-none text-brand-text placeholder-brand-subtle p-2"
                rows={1}
                disabled={isStreaming}
            />
            {isStreaming ? (
                <button 
                    type="button" 
                    onClick={handleStopGeneration}
                    className="bg-red-600 p-2 rounded-full text-white hover:bg-red-700 transition-colors flex-shrink-0"
                    title="停止生成"
                >
                    <StopIcon className="w-5 h-5" />
                </button>
            ) : (
                <button 
                    type="submit" 
                    disabled={!input.trim() || !settings.model}
                    className="bg-brand-accent p-2 rounded-full text-white hover:bg-brand-accent-hover disabled:bg-brand-muted disabled:cursor-not-allowed transition-colors flex-shrink-0"
                    title="发送消息"
                >
                    <SendIcon className="w-5 h-5" />
                </button>
            )}
            </form>
            <p className="text-xs text-brand-subtle text-right mt-1 pr-2">
              模型: {settings.model || '未选择'}
              {generationStats && ` | ${generationStats.tps.toFixed(1)} t/s`}
            </p>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;