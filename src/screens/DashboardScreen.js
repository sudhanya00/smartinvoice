import React from 'react';
import { motion } from 'framer-motion';
import { 
    CreditCard, 
    FileText, 
    Sparkles, 
    RefreshCw, 
    Loader2, 
    Bell, 
    Settings 
} from 'lucide-react';
import { formatCurrency, calculateProgress } from '../utils';

/**
 * Dashboard screen component
 * @param {Array} invoices - Array of invoices
 * @param {Array} budgets - Array of budgets  
 * @param {Array} goals - Array of goals
 * @param {Array} alerts - Array of alerts
 * @param {Array} insights - Array of AI insights
 * @param {boolean} isInsightsLoading - Whether insights are loading
 * @param {Function} getDashboardInsights - Function to refresh insights
 * @param {Function} setActiveScreen - Function to change screen
 */
const DashboardScreen = ({ 
    invoices, 
    budgets, 
    goals, 
    alerts, 
    insights, 
    isInsightsLoading, 
    getDashboardInsights, 
    setActiveScreen 
}) => {
    const totalSpent = invoices.reduce((sum, inv) => sum + (parseFloat(inv.totalAmount) || 0), 0);
    
    const categorySpending = invoices.reduce((acc, inv) => {
        const category = inv.category || 'Uncategorized';
        acc[category] = (acc[category] || 0) + (parseFloat(inv.totalAmount) || 0);
        return acc;
    }, {});
    
    const currency = invoices[0]?.currency || 'USD';
      return (
        <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto space-y-6 p-4 md:p-6 pb-32">
            {/* Header */}
            <div className="flex justify-between items-center">
                <h1 className="text-4xl font-bold text-black tracking-wide">Dashboard</h1>
                <div className="flex items-center space-x-4">
                    <motion.button 
                        whileHover={{ scale: 1.1 }} 
                        whileTap={{ scale: 0.9 }} 
                        onClick={() => setActiveScreen('Alerts')} 
                        className="text-black hover:text-gray-700"
                    >
                        <Bell size={24} />
                    </motion.button>
                    <motion.button 
                        whileHover={{ scale: 1.1 }} 
                        whileTap={{ scale: 0.9 }} 
                        onClick={() => setActiveScreen('Profile')} 
                        className="text-black hover:text-gray-700"
                    >
                        <Settings size={24} />
                    </motion.button>
                </div>
            </div>

            {/* Smart Insights */}
            <div className="bg-white/50 backdrop-blur-lg border border-white/20 p-5 rounded-2xl shadow-xl">
                <div className="flex justify-between items-center mb-3">
                    <h2 className="text-lg font-semibold flex items-center text-black">
                        <Sparkles size={20} className="mr-2 text-black drop-shadow-[0_0_5px_rgba(0,0,0,0.5)] animate-pulse"/>
                        Smart Insights
                    </h2>
                    <motion.button 
                        whileHover={{ scale: 1.1 }} 
                        whileTap={{ scale: 0.9 }} 
                        onClick={getDashboardInsights} 
                        disabled={isInsightsLoading} 
                        className="text-black hover:text-gray-700 disabled:opacity-50"
                    >
                        <RefreshCw size={16} className={isInsightsLoading ? 'animate-spin' : ''}/>
                    </motion.button>
                </div>
                <div className="text-sm text-gray-700 space-y-3 leading-relaxed">
                    {isInsightsLoading ? (
                        <div className="flex items-center space-x-2 text-gray-500">
                            <Loader2 className="animate-spin" size={16}/>
                            <span>Analyzing...</span>
                        </div>
                    ) : insights.length > 0 ? (
                        insights.map((insight, index) => (
                            <div key={index} className="flex items-start">
                                <span className="mr-2 mt-1 opacity-70">•</span>
                                <p>{insight}</p>
                            </div>
                        ))
                    ) : (
                        <p className="text-gray-500">Scan more invoices to unlock personalized insights!</p>
                    )}
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white/50 backdrop-blur-lg border border-white/20 p-5 rounded-2xl shadow-xl flex items-center space-x-4">
                    <div className="bg-gray-100 p-3 rounded-xl">
                        <CreditCard className="text-black" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">Total Spent</p>
                        <p className="text-2xl font-semibold text-black">
                            {formatCurrency(totalSpent, currency)}
                        </p>
                    </div>
                </div>
                
                <div className="bg-white/50 backdrop-blur-lg border border-white/20 p-5 rounded-2xl shadow-xl flex items-center space-x-4">
                    <div className="bg-gray-100 p-3 rounded-xl">
                        <FileText className="text-black" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">Invoices</p>
                        <p className="text-2xl font-semibold text-black">{invoices.length}</p>
                    </div>
                </div>
            </div>

            {/* Upcoming Reminders */}
            <div className="bg-white/50 backdrop-blur-lg border border-white/20 p-5 rounded-2xl shadow-xl">
                <h2 className="text-lg font-semibold text-black mb-4">Upcoming Reminders</h2>
                <div className="space-y-3">
                    {alerts.filter(a => !a.paid).length > 0 ? (
                        alerts.filter(a => !a.paid).map((alert) => (
                            <div key={alert.id} className="flex justify-between items-center p-3 bg-white/30 rounded-lg">
                                <div>
                                    <p className="font-semibold">{alert.name}</p>
                                    <p className="text-sm text-gray-600">
                                        {new Date(alert.dueDate.seconds * 1000).toLocaleDateString()}
                                    </p>
                                </div>
                                <p className="font-bold text-lg text-black">
                                    {formatCurrency(alert.amount, alert.currency)}
                                </p>
                            </div>
                        ))
                    ) : (
                        <p className="text-center text-sm text-gray-500 py-5">No upcoming alerts.</p>
                    )}
                </div>
            </div>

            {/* Budget Progress */}
            <div className="bg-white/50 backdrop-blur-lg border border-white/20 p-5 rounded-2xl shadow-xl">
                <h2 className="text-lg font-semibold text-black mb-4">Budget Progress</h2>
                <div className="space-y-3">
                    {budgets.length > 0 ? (
                        budgets.map((budget) => {
                            const isOverall = budget.category === 'Overall';
                            const spent = isOverall ? totalSpent : (categorySpending[budget.category] || 0);
                            const budgetAmount = budget.amount || 0;
                            const progress = calculateProgress(spent, budgetAmount);
                            const isOverBudget = spent > budgetAmount;
                            
                            return (
                                <div key={budget.id}>
                                    <div className="flex justify-between items-center mb-1 text-sm">
                                        <span className="font-medium text-gray-700">{budget.category}</span>
                                        <span className={`font-semibold ${isOverBudget ? 'text-red-500' : 'text-gray-500'}`}>
                                            {formatCurrency(spent, budget.currency)} / {formatCurrency(budgetAmount, budget.currency)}
                                        </span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div 
                                            className={`${isOverBudget ? 'bg-red-500' : 'bg-black'} h-2 rounded-full`} 
                                            style={{ width: `${progress}%` }}
                                        ></div>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <p className="text-center text-sm text-gray-500 py-5">
                            No budgets set yet. Go to the Finance tab to create one.
                        </p>
                    )}
                </div>
            </div>

            {/* Goal Progress */}
            <div className="bg-white/50 backdrop-blur-lg border border-white/20 p-5 rounded-2xl shadow-xl">
                <h2 className="text-lg font-semibold text-black mb-4">Goal Progress</h2>
                <div className="space-y-3">
                    {goals.length > 0 ? (
                        goals.map((goal) => {
                            const progress = calculateProgress(goal.savedAmount, goal.targetAmount);
                            
                            return (
                                <div key={goal.id}>
                                    <div className="flex justify-between items-center mb-1 text-sm">
                                        <span className="font-medium text-gray-700">{goal.name}</span>
                                        <span className="font-semibold text-gray-500">
                                            {formatCurrency(goal.savedAmount, goal.currency)} / {formatCurrency(goal.targetAmount, goal.currency)}
                                        </span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div 
                                            className="bg-green-500 h-2 rounded-full" 
                                            style={{ width: `${progress}%` }}
                                        ></div>
                                    </div>
                                </div>
                            );
                        })
                    ) : (                        <p className="text-center text-sm text-gray-500 py-5">
                            No goals set yet. Go to the Finance tab to create one.
                        </p>
                    )}
                </div>
            </div>
        </div>
        </div>
    );
};

export default DashboardScreen;
