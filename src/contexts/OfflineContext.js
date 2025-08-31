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
                            const success = await LocalModelService.default.downloadModel((progress) => {
                                setModelProgress(progress);
                            });
                            
                            if (success) {
                                console.log('Model download successful, setting model ready state');
                                setIsModelReady(true);
                                setIsModelLoading(false);
                                setOfflineStatusMessage('');
                                // Indicator will be set by the UI effect
                            } else {
                                throw new Error('Failed to download model');
                            }
                        } catch (error) {
                            console.error('Model download failed:', error);
                            setIsModelLoading(false);
                            setIsOfflineMode(false);
                            setOfflineStatusMessage('');
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
                                setIsOfflineMode(false);
                            }
                        } catch (error) {
                            console.error('Model initialization failed:', error);
                            setIsOfflineMode(false);
                        }
                    });
                }
            };
            
            initializeModel();
        }
    }, [isOfflineMode, isModelReady, isModelLoading]);

    
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
