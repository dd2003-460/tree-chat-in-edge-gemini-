
import React, { useState, useEffect, useCallback } from 'react';
import { getOllamaModels } from '../services/ollamaService';
import { RefreshIcon, SettingsIcon, LinkIcon, CopyIcon } from './icons';
import type { AppSettings } from '../types';

interface SettingsModalProps {
  currentSettings: AppSettings;
  onSave: (settings: AppSettings) => void;
  onClose: () => void;
}

const tampermonkeyScript = `// ==UserScript==
// @name         通用 AI 分支对话导入器
// @namespace    http://tampermonkey.net/
// @version      0.4
// @description  从任何 AI 聊天网站导入对话到 AI 分支对话应用。需要为每个网站进行配置。
// @author       AI
// @match        https://chat.openai.com/*
// @match        https://claude.ai/*
// @match        https://gemini.google.com/*
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    // ########## 配置 ##########
    // 重要提示：请确保此 URL 指向你正在运行的 AI 分支对话实例。
    const APP_URL = 'http://localhost:5173'; // 如果你的应用部署在其他地方，请修改此 URL
    const STORAGE_KEY = 'ai-fork-chat-import';
    const FORK_BUTTON_CLASS = 'ai-fork-chat-button';

    // 为不同网站定义选择器和抓取逻辑
    const SITE_CONFIGS = {
        'chat.openai.com': {
            // 单个对话回合的选择器 (包含用户和 AI 的消息)
            turnSelector: '[data-testid^="conversation-turn-"]',
            // 从一个对话回合元素中提取角色和内容的函数
            scraper: (turnElement) => {
                const messageEl = turnElement.querySelector('[data-message-author-role]');
                if (!messageEl) return null;
                const role = messageEl.getAttribute('data-message-author-role');
                const contentContainer = messageEl.querySelector('div.prose');
                if (!role || !contentContainer) return null;
                const content = contentContainer.textContent || '';
                if (role === 'user' || role === 'assistant') {
                    return { role, content: content.trim() };
                }
                return null;
            },
            // 用于注入“导入分支”按钮的目标元素的选择器
            buttonInjectionTarget: (turnElement) => turnElement.querySelector('div.text-gray-400'),
        },
        'claude.ai': {
            // 示例配置，你需要通过检查页面元素来找到正确的选择器
            turnSelector: 'div[data-testid="conversation-turn"]', // ❗️需要验证
            scraper: (turnElement) => {
                const author = turnElement.querySelector('div[data-testid="author-attribution"]')?.textContent;
                const content = turnElement.querySelector('div[data-testid="message-content"]')?.textContent || '';
                const role = author === 'You' ? 'user' : 'assistant';
                return { role, content: content.trim() };
            },
            buttonInjectionTarget: (turnElement) => turnElement.querySelector('div[data-testid="message-actions"]'), // ❗️需要验证
        },
        'gemini.google.com': {
            // 示例配置，你需要通过检查页面元素来找到正确的选择器
            turnSelector: 'div.message', // ❗️需要验证
            scraper: (turnElement) => {
                const isUser = !!turnElement.closest('.user-query');
                const role = isUser ? 'user' : 'assistant';
                const content = turnElement.querySelector('.output-content')?.textContent || '';
                return { role, content: content.trim() };
            },
            buttonInjectionTarget: (turnElement) => turnElement.querySelector('.message-actions'), // ❗️需要验证
        }
        // 在这里为其他网站添加配置
    };
    // ########## 结束配置 ##########

    GM_addStyle(\`
        .\${FORK_BUTTON_CLASS} {
            background-color: #3b82f6 !important;
            color: white !important;
            padding: 2px 8px !important;
            border: none !important;
            border-radius: 4px !important;
            font-size: 12px !important;
            cursor: pointer !important;
            opacity: 0;
            transition: opacity 0.2s;
            z-index: 1000;
            margin-left: 8px;
        }
        /* 当鼠标悬停在对话回合上时显示按钮 */
        *:hover > .\${FORK_BUTTON_CLASS} {
            opacity: 1;
        }
    \`);
    
    function getCurrentConfig() {
        const hostname = window.location.hostname;
        for (const key in SITE_CONFIGS) {
            if (hostname.includes(key)) {
                return SITE_CONFIGS[key];
            }
        }
        return null;
    }

    function createWelcomeMessage() {
        return { role: 'assistant', content: "你好！这段对话已成功导入。你可以继续对话，或从任意消息创建分支以探索不同的对话路径。" };
    }

    function createRootNode() {
        return { id: 'root', message: createWelcomeMessage(), parentId: null, childrenIds: [], isCollapsed: false };
    }

    function scrapeAndFork(targetElement, config) {
        const allTurns = Array.from(document.querySelectorAll(config.turnSelector));
        const targetIndex = allTurns.findIndex(turn => turn.contains(targetElement));
        const historyTurns = allTurns.slice(0, targetIndex + 1);

        if (historyTurns.length === 0) {
            console.warn('AI 分支对话：未找到任何可导入的消息。');
            alert('导入失败：未找到任何消息。请检查脚本中的选择器配置。');
            return;
        }

        const tree = { 'root': createRootNode() };
        let currentParentId = 'root';

        for (const turn of historyTurns) {
            const message = config.scraper(turn);
            if (!message || !message.content) continue;

            const newNodeId = \`node-\${Date.now()}-\${Math.random().toString(36).substring(2, 9)}\`;
            const newNode = {
                id: newNodeId, message, parentId: currentParentId, childrenIds: [], isCollapsed: false,
            };

            tree[newNodeId] = newNode;
            const parentNode = tree[currentParentId];
            if (parentNode) {
                parentNode.childrenIds.push(newNodeId);
                tree[currentParentId] = { ...parentNode, isCollapsed: false };
            }
            currentParentId = newNodeId;
        }

        if (Object.keys(tree).length <= 1) {
            alert('导入失败：无法从页面中提取任何有效对话。请检查脚本中的 scraper 函数配置。');
            return;
        }

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(tree));
            window.open(APP_URL, '_blank');
        } catch (error) {
            console.error('AI 分支对话：保存对话树到 localStorage 失败', error);
            alert('创建分支对话失败。详情请查看控制台。');
        }
    }

    function addForkButtons() {
        const config = getCurrentConfig();
        if (!config) return;

        const turns = document.querySelectorAll(config.turnSelector);
        turns.forEach(turn => {
            if (turn.querySelector(\`.\${FORK_BUTTON_CLASS}\`)) return;

            const buttonContainer = config.buttonInjectionTarget(turn);
            if (buttonContainer) {
                const button = document.createElement('button');
                button.innerText = '导入分支';
                button.className = FORK_BUTTON_CLASS;
                button.onclick = (e) => {
                    e.stopPropagation();
                    scrapeAndFork(turn, config);
                };
                buttonContainer.appendChild(button);
            }
        });
    }

    const observer = new MutationObserver(() => addForkButtons());
    observer.observe(document.body, { childList: true, subtree: true });
    addForkButtons(); // Initial run
})();
`;

const SettingsModal: React.FC<SettingsModalProps> = ({ currentSettings, onSave, onClose }) => {
  const [models, setModels] = useState<string[]>([]);
  const [settings, setSettings] = useState<AppSettings>(currentSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showScript, setShowScript] = useState(false);
  const [copyButtonText, setCopyButtonText] = useState('复制');

  const fetchModels = useCallback(async (url: string) => {
    setIsLoading(true);
    setError(null);
    setModels([]);
    try {
      const availableModels = await getOllamaModels(url);
      setModels(availableModels);
      if (availableModels.length === 0) {
        setError('连接成功，但未找到任何模型。请拉取一个模型（例如 `ollama pull llama3`）。');
      } else {
        setSettings(current => {
            if (availableModels.includes(current.model)) {
                return current;
            }
            return {...current, model: availableModels[0] || '' };
        });
      }
    } catch (e) {
      setError(`连接到 ${url} 上的 Ollama 失败。请确保它正在运行并且可以访问。`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModels(currentSettings.ollamaApiUrl);
  }, [fetchModels, currentSettings.ollamaApiUrl]);

  const handleSave = () => {
    onSave(settings);
  };
  
  const handleCopyScript = () => {
    navigator.clipboard.writeText(tampermonkeyScript).then(() => {
        setCopyButtonText('已复制！');
        setTimeout(() => setCopyButtonText('复制'), 2000);
    }, (err) => {
        console.error('Could not copy script: ', err);
        setCopyButtonText('复制失败！');
    });
  };

  const handleSettingsChange = (field: keyof AppSettings, value: string | number) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div 
        className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
        onClick={onClose}
    >
      <div 
        className="bg-brand-surface rounded-lg shadow-xl p-6 w-full max-w-lg border border-brand-muted"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-brand-muted mb-4">
          <h2 className="text-xl font-bold flex items-center">
            <SettingsIcon className="w-6 h-6 mr-2" />
            设置
          </h2>
          <button onClick={onClose} className="text-brand-subtle hover:text-brand-text">&times;</button>
        </div>

        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
            <div>
                <label htmlFor="ollama-url" className="block text-sm font-medium text-brand-text mb-1">Ollama API URL</label>
                <div className="flex items-center space-x-2">
                    <input id="ollama-url" type="text" value={settings.ollamaApiUrl} onChange={(e) => handleSettingsChange('ollamaApiUrl', e.target.value)}
                        className="w-full bg-brand-muted/50 p-2 rounded-md border border-brand-muted focus:ring-brand-accent focus:border-brand-accent"
                        placeholder="http://localhost:11434" />
                    <button onClick={() => fetchModels(settings.ollamaApiUrl)} className="p-2 bg-brand-muted rounded-md hover:bg-brand-muted/50" disabled={isLoading}>
                        <RefreshIcon className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>
            
            <div>
                <label htmlFor="model-select" className="block text-sm font-medium text-brand-text mb-1">选择模型</label>
                <select id="model-select" value={settings.model} onChange={(e) => handleSettingsChange('model', e.target.value)} disabled={isLoading || models.length === 0}
                    className="w-full bg-brand-muted/50 p-2 rounded-md border border-brand-muted focus:ring-brand-accent focus:border-brand-accent disabled:opacity-50">
                    {isLoading && <option>加载中...</option>}
                    {!isLoading && models.length === 0 && <option>无可用模型</option>}
                    {models.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
            </div>

            <div>
              <label htmlFor="system-prompt" className="block text-sm font-medium text-brand-text mb-1">系统提示</label>
              <textarea id="system-prompt" value={settings.systemPrompt} onChange={(e) => handleSettingsChange('systemPrompt', e.target.value)}
                rows={3} className="w-full bg-brand-muted/50 p-2 rounded-md border border-brand-muted focus:ring-brand-accent focus:border-brand-accent"
                placeholder="例如：你是一个乐于助人的 AI 助手。"></textarea>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label htmlFor="temperature" className="block text-sm font-medium text-brand-text mb-1">温度: {settings.temperature.toFixed(2)}</label>
                    <input id="temperature" type="range" min="0" max="1.5" step="0.01" value={settings.temperature} onChange={(e) => handleSettingsChange('temperature', parseFloat(e.target.value))}
                     className="w-full h-2 bg-brand-muted rounded-lg appearance-none cursor-pointer" />
                </div>
                <div>
                    <label htmlFor="max-tokens" className="block text-sm font-medium text-brand-text mb-1">最大输出长度</label>
                    <input id="max-tokens" type="number" value={settings.maxOutputTokens} onChange={(e) => handleSettingsChange('maxOutputTokens', parseInt(e.target.value, 10) || 0)}
                     className="w-full bg-brand-muted/50 p-2 rounded-md border border-brand-muted" />
                </div>
            </div>

             <div>
                <label htmlFor="history-length" className="block text-sm font-medium text-brand-text mb-1">上下文消息数量 (0 为无限制)</label>
                <input id="history-length" type="number" value={settings.historyLength} onChange={(e) => handleSettingsChange('historyLength', parseInt(e.target.value, 10) || 0)}
                     className="w-full bg-brand-muted/50 p-2 rounded-md border border-brand-muted" />
            </div>


            <div>
                <button onClick={() => setShowScript(!showScript)} className="text-sm text-brand-accent hover:underline">
                    {showScript ? '隐藏' : '显示'} Tampermonkey 脚本
                </button>
                {showScript && (
                    <div className="mt-2 p-3 bg-black/20 rounded-md">
                        <p className="text-xs text-brand-subtle mb-2">
                            安装 <a href="https://www.tampermonkey.net/" target="_blank" rel="noopener noreferrer" className="underline">Tampermonkey</a> 浏览器扩展，然后创建一个新脚本并粘贴以下代码。
                        </p>
                        <div className="relative">
                            <textarea readOnly value={tampermonkeyScript} className="w-full h-40 bg-black/30 p-2 rounded font-mono text-xs border border-brand-muted"></textarea>
                            <button onClick={handleCopyScript} className="absolute top-2 right-2 bg-brand-muted p-1 rounded text-xs hover:bg-brand-accent">
                                <CopyIcon className="w-4 h-4 mr-1 inline-block" /> {copyButtonText}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>

        <div className="flex justify-end items-center mt-6 pt-4 border-t border-brand-muted space-x-2">
          <button onClick={onClose} className="px-4 py-2 rounded-md bg-brand-muted hover:bg-brand-muted/50">取消</button>
          <button onClick={handleSave} disabled={!settings.model} className="px-4 py-2 rounded-md bg-brand-accent text-white hover:bg-brand-accent-hover disabled:bg-brand-muted disabled:cursor-not-allowed">保存设置</button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
