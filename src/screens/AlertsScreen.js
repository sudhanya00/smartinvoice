import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Trash2, ArrowLeft } from 'lucide-react';
import { SUPPORTED_CURRENCIES } from '../constants';
import { formatCurrency, formatDate } from '../utils';
import DatabaseService from '../services/database';

/**
 * Alerts screen component for managing financial reminders
 * @param {string} userId - Current user ID
 * @param {Array} alerts - User's alerts
 * @param {Function} setNotification - Function to show notifications
 * @param {Function} setActiveScreen - Function to change active screen
 */
const AlertsScreen = ({ userId, alerts, setNotification, setActiveScreen }) => {
    const [name, setName] = useState('');
    const [amount, setAmount] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [currency, setCurrency] = useState('USD');
    const [isRecurring, setIsRecurring] = useState(false);

    const handleAddAlert = async (e) => {
        e.preventDefault();
        if (!name || !amount || isNaN(parseFloat(amount)) || !dueDate) {
            setNotification({ text: "Please fill all fields correctly.", type: 'error' });
            return;
        }
        
        setIsSaving(true);
        try {
            await DatabaseService.addAlert(userId, {
                name,
                amount: parseFloat(amount),
                dueDate,
                currency,
                isRecurring
            });
            setNotification({ text: "Alert added successfully!", type: 'success' });
            setName('');
            setAmount('');
            setDueDate('');
        } catch (error) {
            setNotification({ text: `Failed to add alert: ${error.message}`, type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteAlert = async (alertId) => {
        try {
            await DatabaseService.deleteAlert(userId, alertId);
            setNotification({ text: "Alert deleted successfully", type: 'success' });
        } catch (error) {
            setNotification({ text: "Failed to delete alert.", type: 'error' });
        }
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
                    <h1 className="text-4xl font-bold text-black tracking-wide">Alerts & Reminders</h1>
                </div>
            </div>
            
            {/* Add New Alert */}
            <div className="bg-white/50 backdrop-blur-lg border border-white/20 p-6 rounded-2xl shadow-xl">
                <h2 className="text-lg font-semibold text-black mb-4">Add New Alert</h2>
                <form onSubmit={handleAddAlert} className="space-y-4">
                    <div>
                        <label className="text-sm font-medium text-gray-600">Alert Name</label>
                        <input 
                            type="text" 
                            value={name} 
                            onChange={e => setName(e.target.value)} 
                            className="w-full mt-1 p-3 bg-white/50 border border-white/20 rounded-lg" 
                            placeholder="e.g., Rent" 
                        />
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2">
                            <label className="text-sm font-medium text-gray-600">Amount</label>
                            <input 
                                type="number" 
                                value={amount} 
                                onChange={e => setAmount(e.target.value)} 
                                className="w-full mt-1 p-3 bg-white/50 border border-white/20 rounded-lg" 
                                placeholder="e.g., 1200" 
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-600">Currency</label>
                            <select 
                                value={currency} 
                                onChange={e => setCurrency(e.target.value)} 
                                className="w-full mt-1 p-3 bg-white/50 border border-white/20 rounded-lg"
                            >
                                {SUPPORTED_CURRENCIES.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    
                    <div>
                        <label className="text-sm font-medium text-gray-600">Due Date</label>
                        <input 
                            type="date" 
                            value={dueDate} 
                            onChange={e => setDueDate(e.target.value)} 
                            className="w-full mt-1 p-3 bg-white/50 border border-white/20 rounded-lg" 
                        />
                    </div>
                    
                    <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-600">Recurring</label>
                        <div 
                            onClick={() => setIsRecurring(!isRecurring)} 
                            className={`w-12 h-6 rounded-full p-1 flex items-center cursor-pointer ${
                                isRecurring ? 'bg-black' : 'bg-gray-300'
                            }`}
                        >
                            <motion.div 
                                layout 
                                className="w-4 h-4 bg-white rounded-full" 
                            />
                        </div>
                    </div>
                    
                    <motion.button 
                        whileHover={{ scale: 1.02 }} 
                        whileTap={{ scale: 0.98 }} 
                        type="submit" 
                        disabled={isSaving} 
                        className="w-full bg-black text-white font-bold py-3 px-4 rounded-lg hover:bg-gray-800 transition-colors disabled:bg-gray-400 shadow-lg"
                    >
                        {isSaving ? 'Saving...' : 'Add Alert'}
                    </motion.button>
                </form>
            </div>
            
            {/* Your Alerts */}
            <div className="bg-white/50 backdrop-blur-lg border border-white/20 p-6 rounded-2xl shadow-xl">
                <h2 className="text-lg font-semibold text-black mb-4">Your Alerts</h2>
                <div className="space-y-3">
                    {alerts.length > 0 ? (
                        alerts.map(alert => (
                            <div key={alert.id} className="flex justify-between items-center p-3 bg-white/30 rounded-lg">
                                <div>
                                    <p className="font-semibold">{alert.name}</p>
                                    <p className="text-sm text-gray-600">
                                        {formatDate(alert.dueDate)}
                                    </p>
                                    {alert.isRecurring && (
                                        <p className="text-xs text-blue-600">Recurring</p>
                                    )}
                                </div>
                                <div className="flex items-center space-x-4">
                                    <p className="font-bold text-lg text-black">
                                        {formatCurrency(alert.amount, alert.currency)}
                                    </p>
                                    <motion.button 
                                        whileHover={{ scale: 1.1 }} 
                                        whileTap={{ scale: 0.9 }} 
                                        onClick={() => handleDeleteAlert(alert.id)} 
                                        className="p-1 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-full"
                                    >
                                        <Trash2 size={16}/>
                                    </motion.button>
                                </div>
                            </div>
                        ))                    ) : (
                        <p className="text-center text-sm text-gray-500 py-5">No alerts set.</p>
                    )}
                </div>
            </div>
        </div>
        </div>
    );
};

export default AlertsScreen;
