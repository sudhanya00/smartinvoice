import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import { SUPPORTED_CURRENCIES } from '../constants';
import { formatCurrency, calculateProgress } from '../utils';
import DatabaseService from '../services/database';

/**
 * Goal management component
 * @param {string} userId - Current user ID
 * @param {Array} goals - User's goals
 * @param {Function} setNotification - Function to show notifications
 */
const GoalManagement = ({ userId, goals, setNotification }) => {
    const [name, setName] = useState('');
    const [targetAmount, setTargetAmount] = useState('');
    const [currency, setCurrency] = useState('USD');
    const [isSaving, setIsSaving] = useState(false);

    const handleAddGoal = async (e) => {
        e.preventDefault();
        if (!name || !targetAmount || isNaN(parseFloat(targetAmount))) {
            setNotification({ text: "Please enter a valid name and target amount.", type: 'error' });
            return;
        }
        
        setIsSaving(true);
        try {
            await DatabaseService.addGoal(userId, {
                name,
                targetAmount: parseFloat(targetAmount),
                savedAmount: 0,
                currency
            });
            setNotification({ text: "Goal added successfully!", type: 'success' });
            setName('');
            setTargetAmount('');
        } catch (error) {
            setNotification({ text: `Failed to add goal: ${error.message}`, type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleDeleteGoal = async (goalId) => {
        try {
            await DatabaseService.deleteGoal(userId, goalId);
            setNotification({ text: "Goal deleted successfully", type: 'success' });
        } catch (error) {
            setNotification({ text: "Failed to delete goal.", type: 'error' });
        }
    };

    return (
        <div className="space-y-6">
            {/* Add New Goal */}
            <div className="bg-white/50 backdrop-blur-lg border border-white/20 p-6 rounded-2xl shadow-xl">
                <h2 className="text-lg font-semibold text-black mb-4">Add New Goal</h2>
                <form onSubmit={handleAddGoal} className="space-y-4">
                    <div>
                        <label className="text-sm font-medium text-gray-600">Goal Name</label>
                        <input 
                            type="text" 
                            value={name} 
                            onChange={e => setName(e.target.value)} 
                            className="w-full mt-1 p-3 bg-white/50 border border-white/20 rounded-lg" 
                            placeholder="e.g., New Car" 
                        />
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2">
                            <label className="text-sm font-medium text-gray-600">Target Amount</label>
                            <input 
                                type="number" 
                                value={targetAmount} 
                                onChange={e => setTargetAmount(e.target.value)} 
                                className="w-full mt-1 p-3 bg-white/50 border border-white/20 rounded-lg" 
                                placeholder="e.g., 20000" 
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
                    
                    <motion.button 
                        whileHover={{ scale: 1.02 }} 
                        whileTap={{ scale: 0.98 }} 
                        type="submit" 
                        disabled={isSaving} 
                        className="w-full bg-black text-white font-bold py-3 px-4 rounded-lg hover:bg-gray-800 transition-colors disabled:bg-gray-400 shadow-lg"
                    >
                        {isSaving ? 'Saving...' : 'Add Goal'}
                    </motion.button>
                </form>
            </div>
            
            {/* Your Goals */}
            <div className="bg-white/50 backdrop-blur-lg border border-white/20 p-6 rounded-2xl shadow-xl">
                <h2 className="text-lg font-semibold text-black mb-4">Your Goals</h2>
                <div className="space-y-3">
                    {goals.length > 0 ? (
                        goals.map(goal => {
                            const progress = calculateProgress(goal.savedAmount, goal.targetAmount);
                            
                            return (
                                <div key={goal.id} className="p-3 bg-white/30 rounded-lg">
                                    <div className="flex justify-between items-center mb-1 text-sm">
                                        <span className="font-semibold">{goal.name}</span>
                                        <motion.button 
                                            whileHover={{ scale: 1.1 }} 
                                            whileTap={{ scale: 0.9 }} 
                                            onClick={() => handleDeleteGoal(goal.id)} 
                                            className="p-1 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-full"
                                        >
                                            <Trash2 size={16}/>
                                        </motion.button>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                                        <div 
                                            className="bg-green-500 h-2 rounded-full" 
                                            style={{ width: `${progress}%` }}
                                        ></div>
                                    </div>
                                    <p className="text-xs text-gray-600 text-right">
                                        {formatCurrency(goal.savedAmount, goal.currency)} / {formatCurrency(goal.targetAmount, goal.currency)}
                                    </p>
                                </div>
                            );
                        })
                    ) : (
                        <p className="text-center text-sm text-gray-500 py-5">No goals set.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GoalManagement;
