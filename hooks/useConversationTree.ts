import { useState, useEffect, useCallback } from 'react';
import type { Tree, TreeNode, Message } from '../types';

const STORAGE_KEY = 'ai-fork-chat-tree';
const IMPORT_KEY = 'ai-fork-chat-import';

const createWelcomeMessage = (): Message => ({
  role: 'assistant',
  content: "你好！我是你的 AI 助手。输入一条消息开始我们的对话吧。你可以从任何一条消息创建分支，探索不同的对话路径。"
});

const createRootNode = (): TreeNode => ({
  id: 'root',
  messages: [createWelcomeMessage()],
  parentId: null,
  childrenIds: [],
  isCollapsed: false,
});

// This function now handles migrating the old data structure (node.message) 
// to the new one (node.messages) for backward compatibility.
const sanitizeTree = (tree: Tree): Tree => {
    const newTree = { ...tree };
    for (const key in newTree) {
        const node = newTree[key] as any; // Use any to check for old property
        if (!('isCollapsed' in node)) {
            node.isCollapsed = false;
        }
        if (node.message && !node.messages) {
            node.messages = [node.message];
            delete node.message;
        }
        if (!node.messages) {
            node.messages = [];
        }
    }
    return newTree;
};


export const useConversationTree = () => {
  const [tree, setTree] = useState<Tree>(() => {
    try {
      const savedTree = localStorage.getItem(STORAGE_KEY);
      if (savedTree) {
        const parsed = JSON.parse(savedTree);
        if (Object.keys(parsed).length > 0) {
          return sanitizeTree(parsed);
        }
      }
    } catch (error) {
      console.error("Failed to load or parse tree from local storage", error);
    }
    return { 'root': createRootNode() };
  });

  const [activeNodeId, setActiveNodeId] = useState<string>('root');
  
  useEffect(() => {
    // This effect handles importing a tree from the Tampermonkey script
    try {
        const importedTreeJson = localStorage.getItem(IMPORT_KEY);
        if (importedTreeJson) {
            const importedTree = JSON.parse(importedTreeJson);
            // Basic validation
            if (importedTree && importedTree.root) {
                console.log("正在从其他标签页导入对话...");
                const sanitized = sanitizeTree(importedTree);
                setTree(sanitized);
                
                let lastNodeId = 'root';
                let currentNode = sanitized.root;
                while (currentNode && currentNode.childrenIds.length > 0) {
                    lastNodeId = currentNode.childrenIds[currentNode.childrenIds.length - 1];
                    currentNode = sanitized[lastNodeId];
                }
                setActiveNodeId(lastNodeId);
            }
            localStorage.removeItem(IMPORT_KEY);
        }
    } catch (error) {
        console.error("Failed to import tree from local storage", error);
        localStorage.removeItem(IMPORT_KEY);
    }
  }, []);


  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tree));
    } catch (error) {
      console.error("Failed to save tree to local storage", error);
    }
  }, [tree]);

  // This function is now for creating a new branch (a new TreeNode)
  const addNode = useCallback((startMessage: Message, parentId: string): string => {
    const newNodeId = `node-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const newNode: TreeNode = {
      id: newNodeId,
      messages: [startMessage],
      parentId,
      childrenIds: [],
      isCollapsed: false,
    };

    setTree(prevTree => {
      const newTree = { ...prevTree };
      newTree[newNodeId] = newNode;
      
      const parentNode = newTree[parentId];
      if (parentNode) {
        newTree[parentId] = {
          ...parentNode,
          childrenIds: [...parentNode.childrenIds, newNodeId],
          isCollapsed: false,
        };
      }
      return newTree;
    });

    setActiveNodeId(newNodeId);
    return newNodeId;
  }, []);

  // New function to append a message to an existing node's conversation
  const appendMessage = useCallback((nodeId: string, message: Message) => {
    setTree(prevTree => {
        const newTree = { ...prevTree };
        const node = newTree[nodeId];
        if (node) {
            newTree[nodeId] = {
                ...node,
                messages: [...node.messages, message],
            };
        }
        return newTree;
    });
  }, []);


  const resetTree = useCallback(() => {
    const root = createRootNode();
    setTree({ 'root': root });
    setActiveNodeId('root');
    localStorage.removeItem(STORAGE_KEY);
  }, []);
  
  const loadTree = useCallback((newTree: Tree) => {
    if (newTree && newTree.root) {
        setTree(sanitizeTree(newTree));
        setActiveNodeId('root');
    } else {
        alert('无效的树文件。一个有效的树必须包含一个 "root" 节点。');
    }
  }, []);

  const deleteNode = useCallback((nodeId: string) => {
    setTree(prevTree => {
        const nodeToDelete = prevTree[nodeId];
        if (!nodeToDelete) return prevTree;

        if (nodeToDelete.childrenIds.length > 0) {
            alert('无法删除带有子节点的消息。请先删除其所有分支。');
            return prevTree;
        }

        const newTree = { ...prevTree };
        delete newTree[nodeId];

        if (nodeToDelete.parentId) {
          const parent = newTree[nodeToDelete.parentId];
          if (parent) {
              parent.childrenIds = parent.childrenIds.filter(id => id !== nodeId);
          }
        }
        
        if (activeNodeId === nodeId) {
            setActiveNodeId(nodeToDelete.parentId || 'root');
        }

        return newTree;
    });
  }, [activeNodeId]);

  const updateNodeName = useCallback((nodeId: string, name: string) => {
    setTree(prevTree => {
        const newTree = { ...prevTree };
        const node = newTree[nodeId];
        if (node) {
            newTree[nodeId] = { ...node, name };
        }
        return newTree;
    });
  }, []);

  const toggleNodeCollapse = useCallback((nodeId: string) => {
    setTree(prevTree => {
        const newTree = { ...prevTree };
        const node = newTree[nodeId];
        if (node) {
            newTree[nodeId] = { ...node, isCollapsed: !node.isCollapsed };
        }
        return newTree;
    });
  }, []);


  const getConversationHistory = useCallback((leafNodeId: string): Message[] => {
    const history: Message[] = [];
    let currentNodeId: string | null = leafNodeId;
    
    while (currentNodeId) {
      const node = tree[currentNodeId];
      if (node) {
        // Add messages in reverse order from the node, then unshift the whole block
        history.unshift(...node.messages);
        currentNodeId = node.parentId;
      } else {
        currentNodeId = null;
      }
    }
    
    // The root node's first message is a welcome message, so we exclude it.
    return history.slice(1);
  }, [tree]);

  return { tree, activeNodeId, setActiveNodeId, addNode, appendMessage, resetTree, deleteNode, updateNodeName, toggleNodeCollapse, loadTree, getConversationHistory };
};
