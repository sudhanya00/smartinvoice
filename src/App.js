import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, WifiOff } from 'lucide-react';

// Hooks
import { useAuth } from './hooks/useAuth';
import { useAppData } from './hooks/useAppData';
import { useOfflineMode } from './contexts/OfflineContext';

// Components
import AnimatedBackground from './components/AnimatedBackground';
import Notification from './components/Notification';
import BottomNavBar from './components/BottomNavBar';

// Screens
import LoginScreen from './screens/LoginScreen';
import DashboardScreen from './screens/DashboardScreen';
import ScanScreen from './screens/ScanScreen';
import InvoicesScreen from './screens/InvoicesScreen';
import ChatScreen from './screens/ChatScreen';
import FinanceScreen from './screens/FinanceScreen';
import AlertsScreen from './screens/AlertsScreen';
import ProfileScreen from './screens/ProfileScreen';

/**
 * Main App Component
 */
const App = () => {
    const { user, loading } = useAuth();
    const [activeScreen, setActiveScreen] = useState('Dashboard');
    const [notification, setNotification] = useState(null);    // Get offline mode status with all the necessary properties
    const { 
        showOfflineIndicator, 
        isOfflineMode, 
        isModelReady,
        isModelLoading,
        setIsOfflineMode
    } = useOfflineMode();
      // Debug logging for offline mode state
    useEffect(() => {
        console.log('App component - Offline mode state:', { 
            isOfflineMode, 
            isModelReady,
            isModelLoading,
            showOfflineIndicator 
        });
    }, [isOfflineMode, isModelReady, isModelLoading, showOfflineIndicator]);
    
    // Listen for network status changes
    useEffect(() => {
        const handleOnline = () => {
            console.log('Network is online');
            if (isOfflineMode) {
                setNotification({ 
                    text: 'You are online. Offline mode is still active.', 
                    type: 'info',
                    duration: 3000 
                });
            }
        };
        
        const handleOffline = () => {
            console.log('Network is offline');
            
            // Auto-enable offline mode if model is ready
            if (!isOfflineMode && isModelReady) {
                console.log('Auto-enabling offline mode due to network disconnection');
                setIsOfflineMode(true);
                setNotification({ 
                    text: 'Network disconnected. Switched to offline processing automatically.', 
                    type: 'warning',
                    duration: 5000
                });
            } else if (!isModelReady) {
                setNotification({ 
                    text: 'You are offline. Some features may be unavailable until connection is restored.', 
                    type: 'warning',
                    duration: 5000
                });
            } else {
                setNotification({ 
                    text: 'Network disconnected. Using local processing for AI tasks.', 
                    type: 'warning',
                    duration: 3000
                });
            }
        };
        
        // Check initial network status
        if (!navigator.onLine && !isOfflineMode && isModelReady) {
            console.log('Initial state: offline - activating offline mode');
            setIsOfflineMode(true);
        }
        
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [isOfflineMode, isModelReady, setIsOfflineMode]);
    
    // Always call hooks - get data for authenticated user or pass null
    const {
        invoices,
        budgets,
        goals,
        alerts,
        insights,
        isInsightsLoading,
        getDashboardInsights
    } = useAppData(user);

    if (loading) {
        return (
            <div className="w-screen h-screen flex justify-center items-center bg-gray-100">
                <Loader2 className="animate-spin text-black" size={48} />
            </div>
        );
    }

    if (!user) {
        return <LoginScreen />;
    }    const renderScreen = () => {
        const screenProps = {
            user,
            userId: user.uid,
            setActiveScreen,
            setNotification,
            invoices,
            budgets,
            goals,
            alerts,
            insights,
            isInsightsLoading,
            getDashboardInsights
        };

        const screens = {
            Dashboard: <DashboardScreen {...screenProps} />,
            Scan: <ScanScreen {...screenProps} />,
            Invoices: <InvoicesScreen {...screenProps} />,
            Chat: <ChatScreen {...screenProps} />,
            Finance: <FinanceScreen {...screenProps} />,
            Alerts: <AlertsScreen {...screenProps} />,
            Profile: <ProfileScreen {...screenProps} />
        };

        return (
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeScreen}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                    className="h-full"
                >
                    {screens[activeScreen]}
                </motion.div>
            </AnimatePresence>
        );    };

    return (
        <div 
            className="bg-gray-100 text-gray-900 font-sans h-screen flex flex-col antialiased" 
            style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}
        >
            <AnimatedBackground />
            {showOfflineIndicator && (
                <div className="fixed top-4 right-4 z-50 flex items-center bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs">
                    <WifiOff size={12} className="mr-1" />
                    Offline Mode
                </div>
            )}
            <Notification 
                notification={notification}
                onDismiss={() => setNotification(null)} 
            />
            <main className="flex-1 overflow-hidden">
                {renderScreen()}
            </main>
            <BottomNavBar 
                activeScreen={activeScreen} 
                setActiveScreen={setActiveScreen} 
            />
        </div>
    );
};

export default App;