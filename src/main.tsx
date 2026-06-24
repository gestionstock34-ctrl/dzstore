/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { DzStoreDB } from './lib/db';

// Delay mounting the React virtual DOM until our async IndexedDB cache is fully instantiated
DzStoreDB.initialize()
  .then(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );

    // Dynamic service worker registration for offline PWA installation
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then((reg) => {
            console.log('[PWA SW] Registered scope:', reg.scope);
          })
          .catch((err) => {
            console.warn('[PWA SW] Registration failed:', err);
          });
      });
    }
  })
  .catch((err) => {
    console.error('[PWA Startup] Database initialization failed. Booting app with fallback memory cache.', err);
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
