import React from 'react';
import ReactDOM from 'react-dom/client';
import './output.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { OfflineModeProvider } from './contexts/OfflineContext';

// Register service worker for offline capabilities
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        console.log('ServiceWorker registration successful with scope:', registration.scope);
        
        // Check for service worker updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          
          newWorker.addEventListener('statechange', () => {
            // When the service worker is installed, notify the user of an update
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New content is available, notify user if needed
              const event = new CustomEvent('serviceWorkerUpdateAvailable');
              window.dispatchEvent(event);
            }
          });
        });
      })
      .catch(error => {
        console.log('ServiceWorker registration failed:', error);
      });
      
    // Handle service worker updates
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  });
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <OfflineModeProvider>
      <App />
    </OfflineModeProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
