import React, { useState } from 'react';
import BudgetManagement from '../components/BudgetManagement';
import GoalManagement from '../components/GoalManagement';

/**
 * Finance screen component with budget and goal management
 * @param {string} userId - Current user ID
 * @param {Array} budgets - User's budgets
 * @param {Array} goals - User's goals
 * @param {Function} setNotification - Function to show notifications
 */
const FinanceScreen = ({ userId, budgets, goals, setNotification }) => {
    const [activeTab, setActiveTab] = useState('Budgets');
      return (
        <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto space-y-6 p-4 md:p-6 pb-32">
            <h1 className="text-4xl font-bold text-black tracking-wide">Finance</h1>
            
            {/* Tab Navigation */}
            <div className="flex space-x-1 bg-white/50 backdrop-blur-lg border border-white/20 p-1 rounded-xl">
                <button 
                    onClick={() => setActiveTab('Budgets')} 
                    className={`w-full p-2 rounded-lg font-semibold ${
                        activeTab === 'Budgets' 
                            ? 'bg-black text-white' 
                            : 'hover:bg-gray-200/50'
                    }`}
                >
                    Budgets
                </button>
                <button 
                    onClick={() => setActiveTab('Goals')} 
                    className={`w-full p-2 rounded-lg font-semibold ${
                        activeTab === 'Goals' 
                            ? 'bg-black text-white' 
                            : 'hover:bg-gray-200/50'
                    }`}
                >
                    Goals
                </button>
            </div>
            
            {/* Tab Content */}
            {activeTab === 'Budgets' ? (
                <BudgetManagement 
                    userId={userId} 
                    budgets={budgets} 
                    setNotification={setNotification} 
                />
            ) : (                <GoalManagement 
                    userId={userId} 
                    goals={goals} 
                    setNotification={setNotification} 
                />
            )}
            </div>
        </div>
    );
};

export default FinanceScreen;
