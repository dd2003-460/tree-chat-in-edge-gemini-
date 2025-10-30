import React, { useState, useRef, useEffect } from 'react';
import type { Tree } from '../types';
import { ChevronDownIcon, ChevronRightIcon, EditIcon, PlusIcon, TrashIcon } from './icons';

interface TreeNodeProps {
  nodeId: string;
  tree: Tree;
  activeNodeId: string;
  onNodeSelect: (nodeId: string) => void;
  onNodeDelete: (nodeId: string) => void;
  onNodeRename: (nodeId: string, newName: string) => void;
  onNodeToggleCollapse: (nodeId: string) => void;
  isLast: boolean;
  level: number;
}

const TreeNodeComponent: React.FC<TreeNodeProps> = ({ 
    nodeId, tree, activeNodeId, onNodeSelect, onNodeDelete, onNodeRename, onNodeToggleCollapse, isLast, level 
}) => {
  const node = tree[nodeId];
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(node?.name || '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);
  
  useEffect(() => {
    if (node) {
        setEditText(node.name || '');
    }
  }, [node?.name]);


  if (!node) return null;

  const isActive = nodeId === activeNodeId;
  const hasChildren = node.childrenIds.length > 0;
  
  const firstMessageContent = node.messages[0]?.content || '';
  const summary = node.name || firstMessageContent.substring(0, 35) + (firstMessageContent.length > 35 ? '...' : '');

  const handleRename = () => {
    if (editText.trim() !== (node.name || '')) {
      onNodeRename(nodeId, editText.trim());
    }
    setIsEditing(false);
  };
  
  const handleDelete = () => {
    if (window.confirm('确定要删除此消息吗？')) {
        onNodeDelete(nodeId);
    }
  };

  return (
    <li className="relative group">
      <div className="flex items-center space-x-2">
        {level > 0 && (
          <div className="absolute -left-4 h-full">
            <span className={`absolute top-0 w-px bg-brand-muted ${isLast ? 'h-1/2' : 'h-full'}`}></span>
            <span className="absolute top-1/2 h-px w-4 -translate-y-px bg-brand-muted"></span>
          </div>
        )}
        
        <div className="flex items-center flex-grow p-1 my-1 rounded-md cursor-pointer transition-colors duration-200"
            onClick={() => onNodeSelect(node.id)}
            >
            {hasChildren ? (
                <button onClick={(e) => { e.stopPropagation(); onNodeToggleCollapse(nodeId); }} className="p-1 hover:bg-brand-muted rounded-full">
                    {node.isCollapsed ? <ChevronRightIcon className="w-4 h-4 text-brand-subtle" /> : <ChevronDownIcon className="w-4 h-4 text-brand-subtle" />}
                </button>
            ) : <div className="w-6 h-6"></div>}

            <div className={`flex-grow ml-1 p-1 rounded ${isActive ? 'bg-brand-accent text-white' : 'hover:bg-brand-surface'}`}>
                {isEditing ? (
                    <input
                        ref={inputRef}
                        type="text"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onBlur={handleRename}
                        onKeyDown={(e) => { if(e.key === 'Enter') handleRename(); if(e.key === 'Escape') setIsEditing(false); }}
                        className="w-full bg-brand-muted text-sm p-1 rounded"
                        onClick={(e) => e.stopPropagation()}
                    />
                ) : (
                    <p className="text-sm font-medium truncate" onDoubleClick={() => setIsEditing(true)}>{summary}</p>
                )}
            </div>
        </div>

        <div className="opacity-0 group-hover:opacity-100 flex items-center transition-opacity pr-2">
            <button title="重命名" onClick={() => setIsEditing(true)} className="p-1 hover:bg-brand-muted rounded-full"><EditIcon className="w-4 h-4 text-brand-subtle"/></button>
            <button title="继续对话" onClick={() => onNodeSelect(nodeId)} className="p-1 hover:bg-brand-muted rounded-full"><PlusIcon className="w-4 h-4 text-brand-subtle"/></button>
            {!hasChildren && nodeId !== 'root' && <button title="删除" onClick={handleDelete} className="p-1 hover:bg-brand-muted rounded-full"><TrashIcon className="w-4 h-4 text-red-500/70 hover:text-red-500"/></button>}
        </div>
      </div>
      {hasChildren && !node.isCollapsed && (
        <ul className="pl-8 relative">
          <div className="absolute -left-4 top-0 h-full w-px bg-brand-muted"></div>
          {node.childrenIds.map((childId, index) => (
            <TreeNodeComponent
              key={childId}
              nodeId={childId}
              tree={tree}
              activeNodeId={activeNodeId}
              onNodeSelect={onNodeSelect}
              onNodeDelete={onNodeDelete}
              onNodeRename={onNodeRename}
              onNodeToggleCollapse={onNodeToggleCollapse}
              isLast={index === node.childrenIds.length - 1}
              level={level + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
};

export default TreeNodeComponent;
