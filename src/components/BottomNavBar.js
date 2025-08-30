import React from 'react';
import { motion } from 'framer-motion';
import { LineChart, FileText, MessageCircle, DollarSign, Plus } from 'lucide-react';

/**
 * Bottom navigation bar component
 * @param {string} activeScreen - Currently active screen name
 * @param {Function} setActiveScreen - Function to change active screen
 */
const BottomNavBar = ({ activeScreen, setActiveScreen }) => {
    const navItems = [ 
        { name: 'Dashboard', icon: LineChart }, 
        { name: 'Invoices', icon: FileText }, 
        { name: 'Chat', icon: MessageCircle }, 
        { name: 'Finance', icon: DollarSign }
    ];

    const leftItems = navItems.slice(0, 2);
    const rightItems = navItems.slice(2, 4);

    return (
        <motion.div 
            initial={{ y: 100 }} 
            animate={{ y: 0 }} 
            transition={{ type: "spring", stiffness: 500, damping: 50 }} 
            className="fixed bottom-0 left-0 right-0 bg-white/30 backdrop-blur-lg border-t border-white/20 shadow-2xl shadow-black/30 pb-[env(safe-area-inset-bottom)] z-30"
        >
            <div className="flex justify-around items-center max-w-lg mx-auto h-20">
                {leftItems.map((item) => {
                    const isActive = activeScreen === item.name;
                    return (
                        <div key={item.name} className="w-20 relative flex justify-center items-center h-full">
                             <motion.button 
                                whileHover={{ scale: 1.1 }} 
                                whileTap={{ scale: 0.9 }} 
                                onClick={() => setActiveScreen(item.name)} 
                                className={`relative z-10 flex flex-col items-center justify-center w-full h-full transition-colors duration-200 ${isActive ? 'text-black' : 'text-gray-500 hover:text-black'}`}
                            >
                                <item.icon size={24} className="drop-shadow-sm"/>
                            </motion.button>
                            {isActive && (
                                <motion.div 
                                    layoutId="active-pill" 
                                    className="absolute bottom-2 w-2 h-2 bg-black rounded-full z-0"
                                />
                            )}
                        </div>
                    );
                })}

                <div className="w-20 flex justify-center">
                    <motion.button 
                        whileHover={{ scale: 1.1 }} 
                        whileTap={{ scale: 0.9 }} 
                        onClick={() => setActiveScreen('Scan')} 
                        className="-mt-12 bg-black text-white rounded-full w-20 h-20 flex items-center justify-center shadow-xl shadow-black/30 ring-4 ring-white/20"
                    >
                        <Plus size={32} />
                    </motion.button>
                </div>

                {rightItems.map((item) => {
                    const isActive = activeScreen === item.name;
                    return (
                        <div key={item.name} className="w-20 relative flex justify-center items-center h-full">
                             <motion.button 
                                whileHover={{ scale: 1.1 }} 
                                whileTap={{ scale: 0.9 }} 
                                onClick={() => setActiveScreen(item.name)} 
                                className={`relative z-10 flex flex-col items-center justify-center w-full h-full transition-colors duration-200 ${isActive ? 'text-black' : 'text-gray-500 hover:text-black'}`}
                            >
                                <item.icon size={24} className="drop-shadow-sm"/>
                            </motion.button>
                            {isActive && (
                                <motion.div 
                                    layoutId="active-pill" 
                                    className="absolute bottom-2 w-2 h-2 bg-black rounded-full z-0"
                                />
                            )}
                        </div>
                    );
                })}
            </div>
        </motion.div>
    );
};

export default BottomNavBar;
