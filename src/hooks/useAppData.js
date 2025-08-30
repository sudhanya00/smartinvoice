import { useState, useEffect, useRef, useCallback } from 'react';
import DatabaseService from '../services/database';
import GeminiService from '../services/gemini';

/**
 * Custom hook for managing application state and data
 * @param {Object} user - Current user object
 * @returns {Object} Application state and handlers
 */
export const useAppData = (user) => {
    const [invoices, setInvoices] = useState([]);
    const [budgets, setBudgets] = useState([]);
    const [goals, setGoals] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [insights, setInsights] = useState([]);
    const [isInsightsLoading, setIsInsightsLoading] = useState(false);
    const prevInvoiceCount = useRef(0);

    // Generate dashboard insights
    const getDashboardInsights = useCallback(async (currentInvoices = invoices) => {
        if (currentInvoices.length < 1) {
            setInsights([]);
            return;
        }
        
        setIsInsightsLoading(true);
        const newInsights = await GeminiService.generateInsights(currentInvoices);
        setInsights(newInsights);
        setIsInsightsLoading(false);
    }, [invoices]);

    // Subscribe to data changes
    useEffect(() => {
        if (!user?.uid) return;

        const unsubscribeInvoices = DatabaseService.subscribeToInvoices(user.uid, (newInvoices) => {
            // Generate insights when new invoices are added
            if (newInvoices.length > prevInvoiceCount.current) {
                getDashboardInsights(newInvoices);
            }
            setInvoices(newInvoices);
            prevInvoiceCount.current = newInvoices.length;
        });

        const unsubscribeBudgets = DatabaseService.subscribeToBudgets(user.uid, setBudgets);
        const unsubscribeGoals = DatabaseService.subscribeToGoals(user.uid, setGoals);
        const unsubscribeAlerts = DatabaseService.subscribeToAlerts(user.uid, setAlerts);

        return () => {
            unsubscribeInvoices();
            unsubscribeBudgets();
            unsubscribeGoals();
            unsubscribeAlerts();
        };
    }, [user?.uid, getDashboardInsights]);

    return {
        invoices,
        budgets,
        goals,
        alerts,
        insights,
        isInsightsLoading,
        getDashboardInsights
    };
};
