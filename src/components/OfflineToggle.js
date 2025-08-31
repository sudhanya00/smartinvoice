import React from "react";
import { motion } from "framer-motion";
import { WifiOff, Download, Loader2, AlertCircle } from "lucide-react";
import { useOfflineMode } from "../contexts/OfflineContext";

/**
 * Toggle component for enabling/disabling offline mode
 */
const OfflineToggle = () => {
    const {
        isOfflineMode,
        setIsOfflineMode,
        isModelReady,
        isModelLoading,
        modelProgress,
        offlineStatusMessage
    } = useOfflineMode();    
    
    const handleToggleChange = () => {
        console.log("Toggle clicked. Current state:", { isOfflineMode, isModelReady, isModelLoading });
        
        // Log the setter function to ensure it is defined
        console.log("setIsOfflineMode function exists:", !!setIsOfflineMode);
        
        // Add a try-catch to catch any potential errors
        try {
            const newValue = !isOfflineMode;
            console.log("Setting offline mode to:", newValue);
            setIsOfflineMode(newValue);
            
            // Explicitly log the value after setting
            setTimeout(() => {
                console.log("Value after toggle attempt in component state:", {
                    isOfflineMode,
                    isModelReady,
                    isModelLoading
                });
                console.log("localStorage value:", localStorage.getItem("isOfflineMode"));
            }, 100);
        } catch (error) {
            console.error("Error toggling offline mode:", error);
        }
    };

    // Debug render to check values
    console.log("OfflineToggle rendering with values:", {
        isOfflineMode,
        isModelReady,
        isModelLoading,
        modelProgress
    });

    // Determine if we're in an error state
    const isErrorState = offlineStatusMessage && offlineStatusMessage.toLowerCase().includes('error') || 
                         offlineStatusMessage && offlineStatusMessage.toLowerCase().includes('failed') ||
                         offlineStatusMessage && offlineStatusMessage.toLowerCase().includes('cannot');

    return (
        <div className="bg-white/50 backdrop-blur-lg border border-white/20 p-5 rounded-2xl shadow-xl">
            <h2 className="text-lg font-semibold text-black mb-4">AI Processing Mode</h2>
            
            <div className="flex items-center justify-between">
                <span className="text-gray-700">Offline AI Processing</span>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        className="sr-only"
                        checked={isOfflineMode}
                        onChange={handleToggleChange}
                        disabled={isModelLoading}
                    />
                    <motion.div
                        className={`w-11 h-6 rounded-full transition-colors ${
                            isOfflineMode ? "bg-green-500" : "bg-gray-300"
                        } flex items-center p-1`}
                        animate={{ backgroundColor: isOfflineMode ? "rgb(34 197 94)" : "rgb(209 213 219)" }}
                    >
                        <motion.div
                            className="w-4 h-4 bg-white rounded-full shadow-md"
                            animate={{ x: isOfflineMode ? 20 : 0 }}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        />
                    </motion.div>
                </label>
            </div>
            
            {isModelLoading && (
                <div className="mt-4">
                    <div className="flex items-center text-sm mb-2">
                        {isErrorState ? (
                            <AlertCircle size={16} className="text-red-500 mr-2" />
                        ) : modelProgress >= 100 ? (
                            <motion.div 
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ duration: 0.3 }}
                            >
                                <svg className="text-green-500 mr-2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                                </svg>
                            </motion.div>
                        ) : (
                            <Download size={16} className="text-blue-500 mr-2" />
                        )}
                        <span className={`${isErrorState ? 'text-red-500' : modelProgress >= 100 ? 'text-green-600' : 'text-gray-600'}`}>
                            {offlineStatusMessage || (modelProgress >= 100 ? "Download complete!" : "Preparing offline mode...")}
                        </span>
                    </div>
                    
                    {isErrorState && offlineStatusMessage && offlineStatusMessage.toLowerCase().includes('cors') && (
                        <div className="mt-2 text-xs bg-amber-50 p-2 rounded border border-amber-200">
                            <p className="font-medium text-amber-700">CORS issue detected</p>
                            <p className="text-amber-600 mt-1">
                                The app is automatically trying alternative download sources. Please wait...
                            </p>
                        </div>
                    )}
                    
                    {!isErrorState && modelProgress > 0 && (
                        <>
                            <motion.div 
                                className="w-full bg-gray-200 rounded-full h-2.5 mt-1 overflow-hidden"
                                initial={{ opacity: 0.6 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.2 }}
                            >
                                <motion.div
                                    className={`${modelProgress >= 100 ? 'bg-green-500' : 'bg-blue-500'} h-2.5 rounded-full`}
                                    style={{ width: `${modelProgress}%` }}
                                    initial={{ width: '0%' }}
                                    animate={{ width: `${modelProgress}%` }}
                                    transition={{ 
                                        type: 'spring',
                                        stiffness: 50,
                                        damping: 20
                                    }}
                                />
                            </motion.div>
                            
                            <div className="flex justify-between text-xs text-gray-500 mt-1">
                                <span>{modelProgress}% complete</span>
                                <span>~15MB total size</span>
                            </div>
                            
                            {modelProgress < 100 && modelProgress > 5 && (
                                <p className="text-xs text-gray-500 mt-2">
                                    Estimated time remaining: {Math.ceil((100 - modelProgress) / 10)} seconds
                                </p>
                            )}
                        </>
                    )}
                    
                    {!isErrorState && modelProgress === -1 && (
                        <div className="flex items-center mt-2">
                            <Loader2 className="animate-spin mr-2 text-blue-500" size={16} />
                            <span className="text-xs text-gray-500">Download in progress...</span>
                        </div>
                    )}
                    
                    {!isErrorState && modelProgress === 0 && (
                        <div className="flex items-center mt-2 flex-col">
                            <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                                <motion.div 
                                    className="h-full bg-blue-500"
                                    animate={{
                                        width: ['0%', '30%', '50%', '70%', '90%', '30%'],
                                    }}
                                    transition={{
                                        duration: 2,
                                        repeat: Infinity,
                                        ease: "linear"
                                    }}
                                />
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                                If download seems stuck, it will automatically try alternative sources.
                            </p>
                        </div>
                    )}
                </div>
            )}
            
            {isOfflineMode && isModelReady && (
                <div className="mt-4 text-sm flex items-start">
                    <WifiOff size={16} className="text-green-600 mr-2 mt-0.5" />
                    <div>
                        <p className="text-green-600 font-medium">Offline mode active</p>
                        <p className="text-gray-600 mt-1">
                            Text-based AI tasks are processed on your device. 
                            Image tasks remain online.
                        </p>
                        <p className="text-xs text-gray-500 mt-2">
                            Note: Local processing may be slower than cloud processing
                        </p>
                    </div>
                </div>
            )}
            
            {!isOfflineMode && !isModelLoading && (
                <div className="mt-4 text-sm text-gray-600">
                    <p>
                        Enable to process text AI tasks on your device and reduce API calls. 
                        Requires a one-time model download (~10-15MB).
                    </p>
                    <p className="mt-2 text-xs text-gray-500">
                        Offline mode helps reduce Gemini API costs and works without internet connectivity.
                    </p>
                </div>
            )}
        </div>
    );
};

export default OfflineToggle;
