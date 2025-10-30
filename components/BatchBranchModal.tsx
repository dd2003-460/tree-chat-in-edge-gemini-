import React, { useState } from 'react';
import { SplitIcon } from './icons';

interface BatchBranchModalProps {
  selection: {
    text: string;
    nodeId: string;
  };
  onClose: () => void;
  onBatchCreate: (chunks: string[], parentNodeId: string) => void;
}

const BatchBranchModal: React.FC<BatchBranchModalProps> = ({ selection, onClose, onBatchCreate }) => {
  const [text, setText] = useState(selection.text);
  const [separator, setSeparator] = useState('\\n');

  const handleCreate = () => {
    if (!text.trim()) {
      alert('请输入要分割的文本。');
      return;
    }

    // Convert separator with escaped characters to literal characters
    const actualSeparator = separator.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
    const chunks = text.trim().split(actualSeparator).map(c => c.trim()).filter(Boolean);

    if (chunks.length === 0) {
      alert('未找到可创建分支的内容块。请检查你的文本和分隔符。');
      return;
    }

    onBatchCreate(chunks, selection.nodeId);
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
            <SplitIcon className="w-6 h-6 mr-2" />
            从选定内容批量创建分支
          </h2>
          <button onClick={onClose} className="text-brand-subtle hover:text-brand-text">&times;</button>
        </div>

        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
            <div>
              <label htmlFor="import-text" className="block text-sm font-medium text-brand-text mb-1">要分割的文本</label>
              <textarea 
                id="import-text" 
                value={text} 
                onChange={(e) => setText(e.target.value)}
                rows={10} 
                className="w-full bg-brand-muted/50 p-2 rounded-md border border-brand-muted focus:ring-brand-accent focus:border-brand-accent font-mono text-sm"
                placeholder="在此处粘贴你的对话文本..."></textarea>
            </div>
            
            <div>
                <label htmlFor="separator" className="block text-sm font-medium text-brand-text mb-1">分隔符</label>
                <input 
                  id="separator" 
                  type="text" 
                  value={separator} 
                  onChange={(e) => setSeparator(e.target.value)}
                  className="w-full bg-brand-muted/50 p-2 rounded-md border border-brand-muted focus:ring-brand-accent focus:border-brand-accent font-mono text-sm"
                   />
                <p className="text-xs text-brand-subtle mt-1">
                  使用 <code>\\n</code> 代表换行符，<code>\\t</code> 代表制表符。将为每个分割后的文本块创建一个新的用户消息分支。
                </p>
            </div>
        </div>

        <div className="flex justify-end items-center mt-6 pt-4 border-t border-brand-muted space-x-2">
          <button onClick={onClose} className="px-4 py-2 rounded-md bg-brand-muted hover:bg-brand-muted/50">取消</button>
          <button onClick={handleCreate} className="px-4 py-2 rounded-md bg-brand-accent text-white hover:bg-brand-accent-hover">创建分支</button>
        </div>
      </div>
    </div>
  );
};

export default BatchBranchModal;