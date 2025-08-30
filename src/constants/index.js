// App constants and configuration
export const APP_ID = process.env.REACT_APP_APP_ID || 'default-app-id';

export const DEFAULT_CATEGORIES = [
    'Food & Dining',
    'Transportation', 
    'Shopping',
    'Utilities',
    'Healthcare',
    'Entertainment',
    'Other'
];

export const BUDGET_CATEGORIES = [
    'Overall',
    'Food & Dining',
    'Transportation',
    'Shopping', 
    'Utilities',
    'Healthcare',
    'Entertainment',
    'Other'
];

export const SUPPORTED_CURRENCIES = [
    'USD', 'EUR', 'GBP', 'INR', 'JPY', 'CAD', 'AUD'
];

export const CURRENCY_SYMBOLS = {
    'USD': '$',
    'EUR': '€', 
    'GBP': '£',
    'INR': '₹',
    'JPY': '¥',
    'CAD': '$',
    'AUD': '$'
};

export const FIREBASE_CONFIG_STRING = process.env.REACT_APP_FIREBASE_CONFIG;
export const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY;
