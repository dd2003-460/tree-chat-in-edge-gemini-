import React, { useEffect, useState } from 'react';
import ChatPanel from './components/ChatPanel';
import TreePanel from './components/TreePanel';
import SettingsModal from './components/SettingsModal';
import BatchImportModal from './components/BatchImportModal';
import BatchBranchModal from './components/BatchBranchModal';
import { useConversationTree } from './hooks/useConversationTree';
import { getOllamaModels } from './services/ollamaService';
import type { AppSettings, Message } from './types';

const App: React.FC = () => {
  const { tree, activeNodeId, setActiveNodeId, addNode, appendMessage, resetTree, getConversationHistory, deleteNode, updateNodeName, toggleNodeCollapse, loadTree } = useConversationTree();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isBatchImportOpen, setIsBatchImportOpen] = useState(false);
  const [batchBranchPayload, setBatchBranchPayload] = useState<{ text: string; nodeId: string } | null>(null);
  
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const savedSettings = localStorage.getItem('ai-fork-chat-settings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        // Ensure all keys are present, providing defaults for missing ones
        return {
          model: 'llama3',
          ollamaApiUrl: 'http://localhost:11434',
          systemPrompt: '',
          temperature: 0.8,
          maxOutputTokens: 1024,
          historyLength: 10,
          ...parsed,
        };
      }
    } catch (error) {
      console.error("Failed to load settings from local storage", error);
    }
    return {
      model: 'llama3',
      ollamaApiUrl: 'http://localhost:11434',
      systemPrompt: '',
      temperature: 0.8,
      maxOutputTokens: 1024,
      historyLength: 10,
    };
  });

  useEffect(() => {
    try {
        localStorage.setItem('ai-fork-chat-settings', JSON.stringify(settings));
    } catch (error) {
        console.error("Failed to save settings to local storage", error);
    }
  }, [settings]);
  
  useEffect(() => {
    const validateModel = async () => {
      try {
        const availableModels = await getOllamaModels(settings.ollamaApiUrl);
        if (availableModels.length > 0 && !availableModels.includes(settings.model)) {
          console.warn(`当前选择的模型 "${settings.model}" 不可用。自动切换到第一个可用模型: "${availableModels[0]}"`);
          setSettings(s => ({ ...s, model: availableModels[0] }));
        } else if (availableModels.length === 0 && settings.model) {
            console.warn("未找到可用模型，但已配置了一个模型。请检查 Ollama 连接。")
        }
      } catch (error) {
        console.error("无法获取模型列表以进行验证。", error);
      }
    };
    validateModel();
  }, [settings.ollamaApiUrl]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        const chatInput = document.getElementById('chat-input');
        if (chatInput) {
          chatInput.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleOpenBatchBranch = (selection: { text: string; nodeId: string }) => {
    setBatchBranchPayload(selection);
  };

  const handleCreateBatchBranches = (chunks: string[], parentNodeId: string) => {
    if (chunks.length === 0) return;

    let firstNewNodeId: string | null = null;
    chunks.forEach((chunk, index) => {
      const userMessage: Message = { role: 'user', content: chunk };
      const newNodeId = addNode(userMessage, parentNodeId);
      if (index === 0) {
        firstNewNodeId = newNodeId;
      }
    });

    if (firstNewNodeId) {
       const firstChunk = chunks[0].trim();
       const nodeName = firstChunk.substring(0, 35) + (firstChunk.length > 35 ? '...' : '');
       updateNodeName(firstNewNodeId, nodeName);
       setActiveNodeId(firstNewNodeId);
    }
    
    setBatchBranchPayload(null);
  };


  return (
    <>
      <div className="flex h-screen w-screen font-sans text-brand-text bg-brand-bg">
        <main className="flex-1 min-w-0">
          <ChatPanel 
              tree={tree}
              activeNodeId={activeNodeId}
              addNode={addNode}
              appendMessage={appendMessage}
              setActiveNodeId={setActiveNodeId}
              updateNodeName={updateNodeName}
              getConversationHistory={getConversationHistory}
              settings={settings}
              onOpenBatchBranch={handleOpenBatchBranch}
          />
        </main>
        <aside className="w-80 md:w-96 flex-shrink-0 hidden sm:block">
          <TreePanel 
              tree={tree}
              activeNodeId={activeNodeId}
              onNodeSelect={setActiveNodeId}
              onResetTree={resetTree}
              onDeleteNode={deleteNode}
              onRenameNode={updateNodeName}
              onToggleNodeCollapse={toggleNodeCollapse}
              onLoadTree={loadTree}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onOpenBatchImport={() => setIsBatchImportOpen(true)}
          />
        </aside>
      </div>
      {isSettingsOpen && (
        <SettingsModal 
          currentSettings={settings}
          onSave={(newSettings) => {
            setSettings(newSettings);
            setIsSettingsOpen(false);
          }}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}
      {isBatchImportOpen && (
        <BatchImportModal
          activeNodeId={activeNodeId}
          addNode={addNode}
          updateNodeName={updateNodeName}
          onClose={() => setIsBatchImportOpen(false)}
        />
      )}
      {batchBranchPayload && (
        <BatchBranchModal
            selection={batchBranchPayload}
            onClose={() => setBatchBranchPayload(null)}
            onBatchCreate={handleCreateBatchBranches}
        />
      )}
    </>
  );
};

export default App;
