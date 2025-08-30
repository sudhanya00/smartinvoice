import React from 'react';
import { motion } from 'framer-motion';
import { signOut } from 'firebase/auth';
import { LogOut, ArrowLeft } from 'lucide-react';
import { auth } from '../services/firebase';

/**
 * Profile screen component
 * @param {Object} user - Current user object
 * @param {Function} setActiveScreen - Function to change active screen
 */
const ProfileScreen = ({ user, setActiveScreen }) => {
    const handleLogout = () => {
        signOut(auth);
    };    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto space-y-6 p-4 md:p-6 pb-32">
            {/* Header with back button */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setActiveScreen('Dashboard')}
                        className="text-black hover:text-gray-700 p-2 rounded-full hover:bg-white/20"
                    >
                        <ArrowLeft size={24} />
                    </motion.button>
                    <h1 className="text-4xl font-bold text-black tracking-wide">Profile</h1>
                </div>
            </div>
            
            <div className="bg-white/50 backdrop-blur-lg border border-white/20 p-5 rounded-2xl shadow-xl">
                <h2 className="text-lg font-semibold text-black mb-4">Account</h2>
                <p className="text-sm text-gray-600">Email</p>
                <p className="font-semibold text-gray-800 mb-4">{user.email}</p>
                
                <motion.button 
                    whileHover={{ scale: 1.02 }} 
                    whileTap={{ scale: 0.98 }} 
                    onClick={handleLogout} 
                    className="w-full text-left p-3 flex items-center bg-white/50 rounded-lg text-red-500 font-semibold hover:bg-red-100/50"
                >                    <LogOut size={16} className="mr-2"/> 
                    Sign Out
                </motion.button>
            </div>
        </div>
        </div>
    );
};

export default ProfileScreen;
