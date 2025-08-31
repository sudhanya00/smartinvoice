import React, { createContext, useContext, useState, useEffect } from 'react';
import localforage from 'localforage';

// Create the offline mode context
export const OfflineContext = createContext({
    isOfflineMode: false,
    setIsOfflineMode: () => {},
    isModelReady: false,
    isModelLoading: false,
    modelProgress: 0,
    offlineStatusMessage: '',
    showOfflineIndicator: false
});

// Custom hook to access offline context
export const useOfflineMode = () => useContext(OfflineContext);

// Provider component
export const OfflineModeProvider = ({ children }) => {
    // State for offline mode toggle
    const [isOfflineMode, setIsOfflineMode] = useState(false);
    
    // State for model loading status
    const [isModelReady, setIsModelReady] = useState(false);
    const [isModelLoading, setIsModelLoading] = useState(false);
    const [modelProgress, setModelProgress] = useState(0);
    const [offlineStatusMessage, setOfflineStatusMessage] = useState('');
    const [showOfflineIndicator, setShowOfflineIndicator] = useState(false);

    // Clear local state when toggling off
    const setOfflineModeWithCleanup = (value) => {
        console.log(`Setting offline mode to: ${value}`);
        
        if (!value && isOfflineMode) {
            // Reset all associated states when turning off
            setIsModelLoading(false);
            setModelProgress(0);
            setOfflineStatusMessage('');
            setShowOfflineIndicator(false);
        }
        
        // Update the state
        setIsOfflineMode(value);
    };

    // Initialize from localStorage on mount
    useEffect(() => {
        const checkLocalStorage = async () => {
            try {
                // Check if the user previously enabled offline mode
                const savedMode = localStorage.getItem('isOfflineMode') === 'true';
                console.log('Initial load - Saved offline mode from localStorage:', savedMode);
                
                // Check if the model has been downloaded and cached
                const isModelDownloaded = await localforage.getItem('modelDownloaded');
                console.log('Initial load - Model download status:', isModelDownloaded);
                
                if (savedMode) {
                    setIsOfflineMode(true);
                    if (isModelDownloaded) {
                        // Initialize the model if it's already downloaded
                        import('../services/localModel').then(async (LocalModelService) => {
                            try {
                                const initialized = await LocalModelService.default.init();
                                if (initialized) {
                                    console.log('Model initialized successfully on app start');
                                    setIsModelReady(true);
                                    setShowOfflineIndicator(true);
                                } else {
                                    // If initialization fails, we might need to re-download
                                    console.log('Model initialization failed on app start, attempting download');
                                    setIsModelLoading(true);
                                    setOfflineStatusMessage('Preparing for offline use. Downloading local AI model...');
                                }
                            } catch (error) {
                                console.error('Model initialization failed:', error);
                                setIsOfflineMode(false);
                            }
                        });
                    } else {
                        // If offline mode was enabled but model isn't available,
                        // we need to trigger the download
                        console.log('Offline mode was enabled but model not found, triggering download');
                        setIsModelLoading(true);
                        setOfflineStatusMessage('Preparing for offline use. Downloading local AI model...');
                    }
                }
            } catch (error) {
                console.error('Error initializing offline mode:', error);
            }
        };
        
        checkLocalStorage();
    }, []);

    // Effect to handle just the localStorage persistence
    useEffect(() => {
        console.log('Persisting offline mode to localStorage:', isOfflineMode);
        localStorage.setItem('isOfflineMode', isOfflineMode.toString());
        console.log('Updated localStorage isOfflineMode:', localStorage.getItem('isOfflineMode'));
    }, [isOfflineMode]);
    
    // Effect to handle the UI indicator
    useEffect(() => {
        if (!isOfflineMode) {
            console.log('Turning offline mode off, hiding indicator');
            setShowOfflineIndicator(false);
        } else if (isOfflineMode && isModelReady) {
            console.log('Offline mode on and model ready, showing indicator');
            setShowOfflineIndicator(true);
        }
    }, [isOfflineMode, isModelReady]);
    
    // Effect to handle model download/initialization
    useEffect(() => {
        console.log('Model management effect triggered with values:', { 
            isOfflineMode, 
            isModelReady, 
            isModelLoading
        });

        // Only run the effect if offline mode is enabled and model isn't ready and not already loading
        if (isOfflineMode && !isModelReady && !isModelLoading) {
            console.log('Offline mode turned on, model not ready and not loading');
            
            // Start the model initialization/download process
            const initializeModel = async () => {
                console.log('Checking model cache...');
                const isModelDownloaded = await localforage.getItem('modelDownloaded');
                console.log('Model downloaded status:', isModelDownloaded);
                
                if (!isModelDownloaded) {            
                    console.log('Model not found in cache, starting download process');
                    // Start model download process
                    setIsModelLoading(true);
                    setOfflineStatusMessage('Preparing for offline use. Downloading local AI model...');
                    
                    // Import dynamically to avoid circular dependencies
                    import('../services/localModel').then(async (LocalModelService) => {
                        try {
                            // Start the model download with progress callback
                            setOfflineStatusMessage('Downloading AI model (approx. 15MB)...');
                            const result = await LocalModelService.default.downloadModel((progress) => {
                                if (progress === -1) {
                                    setOfflineStatusMessage('Downloading model... Please wait.');
                                } else if (progress === 0) {
                                    setOfflineStatusMessage('Starting download...');
                                    setModelProgress(0);
                                } else {
                                    setOfflineStatusMessage(`Downloading AI model: ${progress}% complete`);
                                    setModelProgress(progress);
                                }
                            });
                            
                            if (result && result.success) {
                                console.log('Model download successful, setting model ready state');
                                setIsModelReady(true);
                                setIsModelLoading(false);
                                setOfflineStatusMessage('');
                                // Indicator will be set by the UI effect
                            } else {
                                // Handle specific error types
                                if (!result || !result.error) {
                                    // Unexpected response format
                                    console.error('Model download failed with unexpected response:', result);
                                    setOfflineStatusMessage('Download failed. Please check your connection and try again.');
                                    setTimeout(() => {
                                        setIsModelLoading(false);
                                        setIsOfflineMode(false);
                                        setOfflineStatusMessage('');
                                    }, 5000);
                                } else if (result.error === 'network-offline') {
                                    console.error('Device is offline, cannot download model');
                                    setOfflineStatusMessage('Network is offline. Cannot download model. Please try again when connected.');
                                    setTimeout(() => {
                                        setIsModelLoading(false);
                                        setIsOfflineMode(false);
                                        setOfflineStatusMessage('');
                                    }, 5000);
                                } else if (result.error === 'network') {
                                    console.error('Network issues during model download:', result.details);
                                    setOfflineStatusMessage('Network issues detected. Model download failed. Please check your connection and try again.');
                                    setTimeout(() => {
                                        setIsModelLoading(false);
                                        setIsOfflineMode(false);
                                        setOfflineStatusMessage('');
                                    }, 5000);
                                } else if (result.error === 'timeout') {
                                    console.error('Model download timed out');
                                    setOfflineStatusMessage('Download timed out. Please try again on a faster connection.');
                                    setTimeout(() => {
                                        setIsModelLoading(false);
                                        setIsOfflineMode(false);
                                        setOfflineStatusMessage('');
                                    }, 5000);
                                } else {
                                    console.error('Model download failed:', result.details);
                                    setOfflineStatusMessage(`Download failed: ${result.details || 'Unknown error'}. Please try again.`);
                                    setTimeout(() => {
                                        setIsModelLoading(false);
                                        setIsOfflineMode(false);
                                        setOfflineStatusMessage('');
                                    }, 5000);
                                }
                            }
                        } catch (error) {
                            console.error('Model download failed with exception:', error);
                            
                            // Determine the type of error for better user feedback
                            let errorMessage = 'Error during model download. Please try again later.';
                            
                            if (error.name === 'AbortError' || error.message.includes('abort')) {
                                errorMessage = 'Download was interrupted. Please try again.';
                            } else if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                                errorMessage = 'Network error during download. Please check your connection and try again.';
                            } else if (error.name === 'QuotaExceededError') {
                                errorMessage = 'Storage quota exceeded. Please free up space on your device and try again.';
                            } else if (error.message.includes('cors') || error.message.includes('CORS')) {
                                errorMessage = 'Cross-origin request failed. Trying alternative source...';
                                
                                // Try the fallback URL one more time
                                try {
                                    setOfflineStatusMessage('Using alternative download source...');
                                    const fallbackResult = await LocalModelService.default.downloadModel((progress) => {
                                        if (progress > 0) {
                                            setModelProgress(progress);
                                            setOfflineStatusMessage(`Downloading from alternative source: ${progress}% complete`);
                                        }
                                    });
                                    
                                    if (fallbackResult && fallbackResult.success) {
                                        console.log('Fallback download successful');
                                        setIsModelReady(true);
                                        setIsModelLoading(false);
                                        setOfflineStatusMessage('');
                                        return; // Exit early as we succeeded with the fallback
                                    } else {
                                        errorMessage = 'Download failed from all sources. Please try again later.';
                                    }
                                } catch (fallbackError) {
                                    console.error('Fallback download also failed:', fallbackError);
                                    errorMessage = 'Download failed from all sources. Please try again later.';
                                }
                            }
                            
                            setOfflineStatusMessage(errorMessage);
                            setTimeout(() => {
                                setIsModelLoading(false);
                                setIsOfflineMode(false);
                                setOfflineStatusMessage('');
                            }, 5000);
                        }
                    });
                } else {                    
                    console.log('Model found in cache, initializing it');
                    // Model is already cached, initialize it
                    import('../services/localModel').then(async (LocalModelService) => {
                        try {
                            const initialized = await LocalModelService.default.init();
                            if (initialized) {
                                console.log('Model initialization successful');
                                setIsModelReady(true);
                                // Indicator will be set by the UI effect
                            } else {
                                console.log('Model initialization failed, disabling offline mode');
                                setOfflineStatusMessage('Failed to initialize model. Please try again.');
                                setTimeout(() => {
                                    setIsOfflineMode(false);
                                    setOfflineStatusMessage('');
                                }, 3000);
                            }
                        } catch (error) {
                            console.error('Model initialization failed:', error);
                            setOfflineStatusMessage('Error during model initialization. Please try again.');
                            setTimeout(() => {
                                setIsOfflineMode(false);
                                setOfflineStatusMessage('');
                            }, 3000);
                        }
                    });
                }
            };
            
            initializeModel();
        }
    }, [isOfflineMode, isModelReady, isModelLoading]);

    // Effect to handle service worker events
    useEffect(() => {
        // Only set up listeners if offline mode is enabled
        if (!isOfflineMode) return;
        
        const handleModelDownloadStatus = (event) => {
            console.log('Received model download status event:', event.detail);
            
            const { status, message } = event.detail;
            
            switch (status) {
                case 'started':
                    setIsModelLoading(true);
                    setModelProgress(0);
                    setOfflineStatusMessage('Preparing to download model...');
                    break;
                
                case 'downloading':
                    setIsModelLoading(true);
                    setOfflineStatusMessage('Downloading model via Service Worker...');
                    break;
                
                case 'retrying':
                    setOfflineStatusMessage('Trying alternative download source...');
                    break;
                
                case 'cached':
                    setIsModelReady(true);
                    setIsModelLoading(false);
                    setOfflineStatusMessage('');
                    break;
                
                case 'success':
                    setIsModelReady(true);
                    setIsModelLoading(false);
                    setModelProgress(100);
                    setOfflineStatusMessage('');
                    
                    // Give the user visual feedback that it completed
                    setTimeout(() => {
                        setModelProgress(0);
                    }, 1500);
                    break;
                
                case 'error':
                    setOfflineStatusMessage(`Download error: ${message}`);
                    setTimeout(() => {
                        setIsModelLoading(false);
                        setIsOfflineMode(false);
                        setOfflineStatusMessage('');
                    }, 5000);
                    break;
                
                default:
                    console.warn('Unknown model download status:', status);
            }
        };
        
        const handleServiceWorkerRegistrationFailed = (event) => {
            console.error('Service worker registration failed:', event.detail);
            
            if (isOfflineMode) {
                setOfflineStatusMessage('Offline mode requires service worker support, which failed to initialize.');
                setTimeout(() => {
                    setIsOfflineMode(false);
                    setOfflineStatusMessage('');
                }, 5000);
            }
        };
        
        // Add event listeners
        window.addEventListener('modelDownloadStatus', handleModelDownloadStatus);
        window.addEventListener('serviceWorkerRegistrationFailed', handleServiceWorkerRegistrationFailed);
        
        // Clean up event listeners on unmount
        return () => {
            window.removeEventListener('modelDownloadStatus', handleModelDownloadStatus);
            window.removeEventListener('serviceWorkerRegistrationFailed', handleServiceWorkerRegistrationFailed);
        };
    }, [isOfflineMode]);

    
    // Provide the context values to consumers
    const contextValue = {
        isOfflineMode,
        setIsOfflineMode: setOfflineModeWithCleanup,
        isModelReady,
        setIsModelReady,
        isModelLoading,
        setIsModelLoading,
        modelProgress,
        setModelProgress,
        offlineStatusMessage,
        setOfflineStatusMessage,
        showOfflineIndicator
    };
    
    return (
        <OfflineContext.Provider value={contextValue}>
            {children}
        </OfflineContext.Provider>
    );
};
