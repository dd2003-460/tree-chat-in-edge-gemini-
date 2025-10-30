
import React from 'react';
import type { Tree } from '../types';
import TreeNodeComponent from './TreeNodeComponent';
import { TrashIcon, SaveIcon, LoadIcon, SettingsIcon, ClipboardListIcon } from './icons';

interface TreePanelProps {
  tree: Tree;
  activeNodeId: string;
  onNodeSelect: (nodeId: string) => void;
  onResetTree: () => void;
  onDeleteNode: (nodeId: string) => void;
  onRenameNode: (nodeId: string, newName: string) => void;
  onToggleNodeCollapse: (nodeId: string) => void;
  onLoadTree: (tree: Tree) => void;
  onOpenSettings: () => void;
  onOpenBatchImport: () => void;
}

const TreePanel: React.FC<TreePanelProps> = ({ 
    tree, activeNodeId, onNodeSelect, onResetTree, onDeleteNode, onRenameNode, onToggleNodeCollapse, onLoadTree, onOpenSettings, onOpenBatchImport
}) => {

  const handleExport = () => {
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(tree, null, 2))}`;
    const link = document.createElement("a");
    link.href = jsonString;
    link.download = `aiforkchat-conversation-${new Date().toISOString()}.json`;
    link.click();
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const newTree = JSON.parse(event.target?.result as string);
                    onLoadTree(newTree);
                } catch (err) {
                    alert('解析 JSON 文件时出错。');
                    console.error(err);
                }
            };
            reader.readAsText(file);
        }
    };
    input.click();
  };

  return (
    <div className="h-full bg-brand-surface/50 border-l border-brand-muted flex flex-col p-4 overflow-y-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-brand-text">对话树</h2>
        <div className="flex items-center space-x-1">
            <button onClick={onOpenSettings} className="p-2 rounded-full hover:bg-brand-muted/50 text-brand-subtle hover:text-brand-text transition-colors" title="设置"><SettingsIcon className="w-5 h-5" /></button>
            <button onClick={onOpenBatchImport} className="p-2 rounded-full hover:bg-brand-muted/50 text-brand-subtle hover:text-brand-text transition-colors" title="批量导入"><ClipboardListIcon className="w-5 h-5" /></button>
            <button onClick={handleImport} className="p-2 rounded-full hover:bg-brand-muted/50 text-brand-subtle hover:text-brand-text transition-colors" title="导入对话树"><LoadIcon className="w-5 h-5" /></button>
            <button onClick={handleExport} className="p-2 rounded-full hover:bg-brand-muted/50 text-brand-subtle hover:text-brand-text transition-colors" title="导出对话树"><SaveIcon className="w-5 h-5" /></button>
            <button onClick={onResetTree} className="p-2 rounded-full hover:bg-brand-muted/50 text-brand-subtle hover:text-red-400 transition-colors" title="重置对话"><TrashIcon className="w-5 h-5" /></button>
        </div>
      </div>
      <div className="flex-grow">
        {tree.root ? (
          <ul className="space-y-0">
             <TreeNodeComponent
                nodeId="root"
                tree={tree}
                activeNodeId={activeNodeId}
                onNodeSelect={onNodeSelect}
                onNodeDelete={onDeleteNode}
                onNodeRename={onRenameNode}
                onNodeToggleCollapse={onToggleNodeCollapse}
                isLast={true}
                level={0}
              />
          </ul>
        ) : (
          <p className="text-brand-subtle">还没有开始对话。</p>
        )}
      </div>
    </div>
  );
};

export default TreePanel;