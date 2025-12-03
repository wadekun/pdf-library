import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Book, History, FileClock } from 'lucide-react';
import { getProgressStore } from './lib/storage';
import { ReadingProgress } from './types';
import '../index.css';

const Popup = () => {
  const [lastRead, setLastRead] = useState<[string, ReadingProgress] | null>(null);

  useEffect(() => {
    const findLastRead = async () => {
      const progressStore = await getProgressStore();
      const historyItems = Object.entries(progressStore)
        .sort(([, a], [, b]) => b.lastRead - a.lastRead);
      
      if (historyItems.length > 0) {
        setLastRead(historyItems[0]);
      }
    };
    findLastRead();
  }, []);

  const openPage = (url: string) => {
    chrome.tabs.create({ url: chrome.runtime.getURL(url) });
    window.close();
  };

  const ActionButton = ({ icon, label, onClick, disabled = false }: { icon: React.ReactNode, label: string, onClick: () => void, disabled?: boolean }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-3 text-left p-3 rounded-lg transition-colors 
                 ${disabled 
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                    : 'text-gray-700 hover:bg-indigo-50 hover:text-indigo-700'}`}
    >
      {icon}
      <div className="flex flex-col">
        <span className="font-medium">{label}</span>
        {label === "Continue Reading" && lastRead && (
            <span className="text-xs text-gray-500 truncate" title={lastRead[0]}>{lastRead[0]}</span>
        )}
      </div>
    </button>
  );

  return (
    <div className="w-64 p-2 bg-white font-sans">
      <div className="space-y-1">
        <ActionButton 
          icon={<Book size={18} />}
          label="My Library"
          onClick={() => openPage('index.html?view=library')}
        />
        <ActionButton 
          icon={<History size={18} />}
          label="Reading History"
          onClick={() => openPage('index.html?view=history')}
        />
        <ActionButton 
          icon={<FileClock size={18} />}
          label="Continue Reading"
          onClick={() => openPage('index.html?action=open_last_read')}
          disabled={!lastRead}
        />
      </div>
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<Popup />);
}
