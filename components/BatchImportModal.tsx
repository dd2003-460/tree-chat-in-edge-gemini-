
import React, { useState } from 'react';
import type { Message } from '../types';
import { ClipboardListIcon } from './icons';

interface BatchImportModalProps {
  activeNodeId: string;
  addNode: (message: Message, parentId: string) => string;
  updateNodeName: (nodeId: string, name: string) => void;
  onClose: () => void;
}

const BatchImportModal: React.FC<BatchImportModalProps> = ({ activeNodeId, addNode, updateNodeName, onClose }) => {
  const [text, setText] = useState('');
  const [separator, setSeparator] = useState('\\n---\\n');

  const handleImport = () => {
    if (!text.trim()) {
      alert('请输入要导入的文本。');
      return;
    }

    // Convert separator with escaped characters to literal characters
    const actualSeparator = separator.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
    const chunks = text.trim().split(actualSeparator).filter(c => c.trim());

    if (chunks.length === 0) {
      alert('未找到可导入的内容块。请检查你的文本和分隔符。');
      return;
    }

    let parentId = activeNodeId;
    let firstNewNodeId: string | null = null;

    chunks.forEach((chunk, index) => {
      // Simple role alternation: user, assistant, user, ...
      const role: 'user' | 'assistant' = index % 2 === 0 ? 'user' : 'assistant';
      const newNodeId = addNode({ role, content: chunk.trim() }, parentId);
      if (index === 0) {
        firstNewNodeId = newNodeId;
      }
      parentId = newNodeId; // Chain the new nodes
    });

    if (firstNewNodeId) {
      const firstChunk = chunks[0].trim();
      const nodeName = firstChunk.substring(0, 35) + (firstChunk.length > 35 ? '...' : '');
      updateNodeName(firstNewNodeId, nodeName);
    }

    onClose();
  };

  return (
    <div 
        className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
        onClick={onClose}
    >
      <div 
        className="bg-brand-surface rounded-lg shadow-xl p-6 w-full max-w-2xl border border-brand-muted"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-brand-muted mb-4">
          <h2 className="text-xl font-bold flex items-center">
            <ClipboardListIcon className="w-6 h-6 mr-2" />
            从文本批量导入
          </h2>
          <button onClick={onClose} className="text-brand-subtle hover:text-brand-text">&times;</button>
        </div>

        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
            <div>
              <label htmlFor="import-text" className="block text-sm font-medium text-brand-text mb-1">对话文本</label>
              <textarea 
                id="import-text" 
                value={text} 
                onChange={(e) => setText(e.target.value)}
                rows={10} 
                className="w-full bg-brand-muted/50 p-2 rounded-md border border-brand-muted focus:ring-brand-accent focus:border-brand-accent font-mono text-sm"
                placeholder="在此处粘贴你的对话文本..."></textarea>
            </div>
            
            <div>
                <label htmlFor="separator" className="block text-sm font-medium text-brand-text mb-1">消息分隔符</label>
                <input 
                  id="separator" 
                  type="text" 
                  value={separator} 
                  onChange={(e) => setSeparator(e.target.value)}
                  className="w-full bg-brand-muted/50 p-2 rounded-md border border-brand-muted focus:ring-brand-accent focus:border-brand-accent font-mono text-sm"
                  placeholder="例如: ---" />
                <p className="text-xs text-brand-subtle mt-1">
                  使用 <code>\\n</code> 代表换行符，<code>\\t</code> 代表制表符。将按用户、助手、用户...的顺序交替创建消息。
                </p>
            </div>
        </div>

        <div className="flex justify-end items-center mt-6 pt-4 border-t border-brand-muted space-x-2">
          <button onClick={onClose} className="px-4 py-2 rounded-md bg-brand-muted hover:bg-brand-muted/50">取消</button>
          <button onClick={handleImport} className="px-4 py-2 rounded-md bg-brand-accent text-white hover:bg-brand-accent-hover">导入分支</button>
        </div>
      </div>
    </div>
  );
};

export default BatchImportModal;
