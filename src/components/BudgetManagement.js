import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import { BUDGET_CATEGORIES, SUPPORTED_CURRENCIES } from '../constants';
import { formatCurrency } from '../utils';
import DatabaseService from '../services/database';

/**
 * Budget management component
 * @param {string} userId - Current user ID
 * @param {Array} budgets - User's budgets
 * @param {Function} setNotification - Function to show notifications
 */
const BudgetManagement = ({ userId, budgets, setNotification }) => {
    const [category, setCategory] = useState('Food & Dining');
    const [amount, setAmount] = useState('');
    const [currency, setCurrency] = useState('USD');
    const [isSaving, setIsSaving] = useState(false);

    const handleAddBudget = async (e) => {
        e.preventDefault();
        if (!amount || isNaN(parseFloat(amount))) {
            setNotification({ text: "Please enter a valid amount.", type: 'error' });
            return;
        }
        
        setIsSaving(true);
        try {
            await DatabaseService.addBudget(userId, {
                category,
                amount: parseFloat(amount),
                currency
            });
            setNotification({ text: "Budget added successfully!", type: 'success' });
            setAmount('');
        } catch (error) {
            setNotification({ text: `Failed to add budget: ${error.message}`, type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteBudget = async (budgetId) => {
        try {
            await DatabaseService.deleteBudget(userId, budgetId);
            setNotification({ text: "Budget deleted successfully", type: 'success' });
        } catch (error) {
            setNotification({ text: "Failed to delete budget.", type: 'error' });
        }
    };

    return (
        <div className="space-y-6">
            {/* Add New Budget */}
            <div className="bg-white/50 backdrop-blur-lg border border-white/20 p-6 rounded-2xl shadow-xl">
                <h2 className="text-lg font-semibold text-black mb-4">Add New Budget</h2>
                <form onSubmit={handleAddBudget} className="space-y-4">
                    <div>
                        <label className="text-sm font-medium text-gray-600">Category</label>
                        <select 
                            value={category} 
                            onChange={e => setCategory(e.target.value)} 
                            className="w-full mt-1 p-3 bg-white/50 border border-white/20 rounded-lg"
                        >
                            {BUDGET_CATEGORIES.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2">
                            <label className="text-sm font-medium text-gray-600">Amount</label>
                            <input 
                                type="number" 
                                value={amount} 
                                onChange={e => setAmount(e.target.value)} 
                                className="w-full mt-1 p-3 bg-white/50 border border-white/20 rounded-lg" 
                                placeholder="e.g., 500" 
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
                        {isSaving ? 'Saving...' : 'Add Budget'}
                    </motion.button>
                </form>
            </div>

            {/* Your Budgets */}
            <div className="bg-white/50 backdrop-blur-lg border border-white/20 p-6 rounded-2xl shadow-xl">
                <h2 className="text-lg font-semibold text-black mb-4">Your Budgets</h2>
                <div className="space-y-3">
                    {budgets.length > 0 ? (
                        budgets.map(budget => (
                            <div key={budget.id} className="flex justify-between items-center p-3 bg-white/30 rounded-lg">
                                <div>
                                    <p className="font-semibold">{budget.category}</p>
                                    <p className="text-sm text-gray-600">
                                        {formatCurrency(budget.amount, budget.currency)}
                                    </p>
                                </div>
                                <motion.button 
                                    whileHover={{ scale: 1.1 }} 
                                    whileTap={{ scale: 0.9 }} 
                                    onClick={() => handleDeleteBudget(budget.id)} 
                                    className="p-1 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-full"
                                >
                                    <Trash2 size={16}/>
                                </motion.button>
                            </div>
                        ))
                    ) : (
                        <p className="text-center text-sm text-gray-500 py-5">No budgets set.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BudgetManagement;
