import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';

// Hooks
import { useAuth } from './hooks/useAuth';
import { useAppData } from './hooks/useAppData';

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

    if (loading) {
        return (
            <div className="w-screen h-screen flex justify-center items-center bg-gray-100">
                <Loader2 className="animate-spin text-black" size={48} />
            </div>
        );
    }

    return user ? <MainApp user={user} /> : <LoginScreen />;
};

/**
 * Main Application after Login
 */
const MainApp = ({ user }) => {
    const [activeScreen, setActiveScreen] = useState('Dashboard');
    const [notification, setNotification] = useState(null);
    
    const {
        invoices,
        budgets,
        goals,
        alerts,
        insights,
        isInsightsLoading,
        getDashboardInsights
    } = useAppData(user);

    const renderScreen = () => {
        const screenProps = {
            userId: user.uid,
            setActiveScreen,
            setNotification
        };

        const screens = {
            'Dashboard': (
                <DashboardScreen
                    invoices={invoices}
                    budgets={budgets}
                    goals={goals}
                    alerts={alerts}
                    insights={insights}
                    isInsightsLoading={isInsightsLoading}
                    getDashboardInsights={getDashboardInsights}
                    {...screenProps}
                />
            ),
            'Scan': (
                <ScanScreen {...screenProps} />
            ),
            'Invoices': (
                <InvoicesScreen
                    invoices={invoices}
                    {...screenProps}
                />
            ),
            'Chat': (
                <ChatScreen
                    invoices={invoices}
                    budgets={budgets}
                    goals={goals}
                    {...screenProps}
                />
            ),
            'Finance': (
                <FinanceScreen
                    budgets={budgets}
                    goals={goals}
                    {...screenProps}
                />
            ),
            'Alerts': (
                <AlertsScreen
                    alerts={alerts}
                    {...screenProps}
                />
            ),
            'Profile': (
                <ProfileScreen user={user} />
            )
        };

        return (
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeScreen}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.3 }}
                    className="h-full"
                >
                    {screens[activeScreen]}
                </motion.div>
            </AnimatePresence>
        );
    };

    return (
        <div 
            className="bg-gray-100 text-gray-900 font-sans h-screen flex flex-col antialiased" 
            style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}
        >
            <AnimatedBackground />
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
