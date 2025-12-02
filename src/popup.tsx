import React from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';

const Popup = () => {
  const openApp = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('index.html') });
  };

  return (
    <div style={{ width: '200px', padding: '16px', textAlign: 'center' }}>
      <button onClick={openApp} style={{ width: '100%', padding: '10px', fontSize: '14px' }}>
        Open PDF Library
      </button>
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<Popup />);
}
