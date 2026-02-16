
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

import { ErrorBoundary } from './components/ErrorBoundary';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

try {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
} catch (e) {
  console.error("CRITICAL MOUNT ERROR:", e);
  rootElement.innerHTML = `
    <div style="padding: 2rem; color: #ef4444; text-align: center;">
      <h1>Critical Error</h1>
      <p>The application failed to start.</p>
      <pre style="background: #fef2f2; padding: 1rem; border-radius: 0.5rem; overflow: auto;">${e instanceof Error ? e.message : String(e)}</pre>
      <button onclick="localStorage.clear();window.location.reload()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: #ef4444; color: white; border: none; border-radius: 0.5rem; cursor: pointer;">
        Emergency Reset
      </button>
    </div>
  `;
}
