// Polyfill React Fast Refresh globals for extension context
if (typeof window !== 'undefined' && !(window as any).$RefreshSig$) {
  (window as any).$RefreshSig$ = () => () => {};
  (window as any).$RefreshReg$ = () => {};
  (window as any).$RefreshInterceptModule$ = () => () => {};
}

import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import '@/assets/main.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
