import React from 'react';
import ReactDOM from 'react-dom/client';
import './output.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { OfflineModeProvider } from './contexts/OfflineContext';

// Register service worker for offline capabilities
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js', { updateViaCache: 'none' })
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
        
        // Set up communication with the service worker
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data && event.data.type === 'MODEL_DOWNLOAD_STATUS') {
            // Forward service worker model download events to the app
            const modelEvent = new CustomEvent('modelDownloadStatus', { 
              detail: event.data 
            });
            window.dispatchEvent(modelEvent);
            
            console.log('Received model download status from SW:', event.data);
            
            // Show notification if download failed or succeeded
            if (event.data.status === 'error') {
              // We'll let OfflineContext handle the error messaging
              console.error('Model download failed:', event.data.message);
            } else if (event.data.status === 'success') {
              console.log('Model download successful');
              
              // Let the service worker know we got the message
              if (navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({
                  action: 'modelDownloadAcknowledged',
                  success: true
                });
              }
            }
          }
        });
      })
      .catch(error => {
        console.error('ServiceWorker registration failed:', error);
        
        // Create an event to notify the app that service worker registration failed
        const event = new CustomEvent('serviceWorkerRegistrationFailed', {
          detail: { error: error.toString() }
        });
        window.dispatchEvent(event);
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
