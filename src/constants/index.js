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

// Offline Mode constants
export const OFFLINE_MODEL_URL = process.env.REACT_APP_OFFLINE_MODEL_URL || 
    'https://huggingface.co/TheBloke/gemma-2b-GGUF/resolve/main/gemma-2b.Q4_K_M.onnx';
export const OFFLINE_MODEL_SIZE_MB = 15; // Approximate size in MB
export const OFFLINE_MODEL_CACHE_KEY = 'gemma2b-model-v1';
export const SERVICE_WORKER_VERSION = 'v1';
export const MAX_LOCAL_INPUT_LENGTH = 1024; // Max tokens for local model input
