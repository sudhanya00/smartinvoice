import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Reusable confirmation modal component
 * @param {boolean} isOpen - Whether the modal is open
 * @param {Function} onClose - Callback to close the modal
 * @param {Function} onConfirm - Callback when user confirms
 * @param {string} title - Modal title
 * @param {string} message - Modal message
 */
const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message }) => (
    <AnimatePresence>
        {isOpen && (
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50" 
                onClick={onClose}
            >
                <motion.div 
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="bg-white/80 backdrop-blur-lg border border-white/20 rounded-2xl shadow-xl p-6 w-full max-w-sm m-4" 
                    onClick={e => e.stopPropagation()}
                >
                    <h3 className="text-lg font-bold text-gray-900">{title}</h3>
                    <p className="text-sm text-gray-700 mt-2">{message}</p>
                    <div className="mt-6 flex justify-end space-x-3">
                        <motion.button 
                            whileHover={{ scale: 1.05 }} 
                            whileTap={{ scale: 0.95 }} 
                            onClick={onClose} 
                            className="px-4 py-2 rounded-lg bg-gray-200/50 text-gray-800 font-semibold hover:bg-gray-300/70"
                        >
                            Cancel
                        </motion.button>
                        <motion.button 
                            whileHover={{ scale: 1.05 }} 
                            whileTap={{ scale: 0.95 }} 
                            onClick={onConfirm} 
                            className="px-4 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700"
                        >
                            Confirm
                        </motion.button>
                    </div>
                </motion.div>
            </motion.div>
        )}
    </AnimatePresence>
);

export default ConfirmationModal;
