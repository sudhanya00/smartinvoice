import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle, X } from 'lucide-react';

/**
 * Notification component for displaying success/error messages
 * @param {Object} notification - Notification object with text and type
 * @param {Function} onDismiss - Callback to dismiss notification
 */
const Notification = ({ notification, onDismiss }) => {
    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => onDismiss(), 5000);
            return () => clearTimeout(timer);
        }
    }, [notification, onDismiss]);

    if (!notification) return null;
    
    const isError = notification.type === 'error';
    const bgColor = isError ? 'bg-red-500' : 'bg-green-500';
    const Icon = isError ? AlertCircle : CheckCircle;
    
    return (
        <AnimatePresence>
            <motion.div 
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className={`fixed top-5 right-5 ${bgColor} text-white p-4 rounded-lg shadow-xl flex items-center z-50`}
            >
                <Icon className="mr-3" />
                <span>{notification.text}</span>
                <button onClick={onDismiss} className="ml-4 font-bold">
                    <X size={20} />
                </button>
            </motion.div>
        </AnimatePresence>
    );
};

export default Notification;
