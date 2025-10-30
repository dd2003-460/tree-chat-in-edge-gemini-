import React from 'react';
import type { Message } from '../types';
import { UserIcon, BotIcon } from './icons';

interface ChatMessageProps {
  nodeId: string;
  message: Message;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ nodeId, message }) => {
  const isUser = message.role === 'user';
  
  const renderContent = (content: string) => {
    const parts = content.split(/(\`\`\`[\s\S]*?\`\`\`)/g);
    return parts.map((part, index) => {
      if (part.startsWith('```')) {
        const code = part.replace(/```/g, '').trim();
        return (
          <pre key={index} className="bg-black/50 p-4 rounded-md my-2 overflow-x-auto">
            <code className="text-sm font-mono">{code}</code>
          </pre>
        );
      }
      return part.split('\n').map((line, i) => <React.Fragment key={`${index}-${i}`}>{line}<br/></React.Fragment>);
    });
  };

  return (
    <div data-node-id={nodeId} className="group flex items-start space-x-4 p-4 my-2 hover:bg-brand-surface/50 rounded-lg">
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isUser ? 'bg-brand-accent' : 'bg-brand-muted'}`}>
        {isUser ? <UserIcon className="w-5 h-5 text-white" /> : <BotIcon className="w-5 h-5 text-brand-text" />}
      </div>
      <div className="flex-grow">
        <p className="font-bold text-brand-text">{isUser ? '你' : '助手'}</p>
        <div className="text-brand-text/90 whitespace-pre-wrap">
          {renderContent(message.content)}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
