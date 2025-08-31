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
// Primary URL from Azure Blob Storage (public, CORS-friendly)
export const OFFLINE_MODEL_URL = process.env.REACT_APP_OFFLINE_MODEL_URL || 
    'https://aimodelstorage.blob.core.windows.net/public-models/gemma-2b-quantized.onnx';
// Backup URL from Google Cloud Storage (public, CORS-friendly)
export const OFFLINE_MODEL_FALLBACK_URL = 'https://storage.googleapis.com/ai-models-public/gemma-2b.Q4_K_M.onnx';
// Third backup from another CDN source - replace with your actual third source
export const OFFLINE_MODEL_THIRD_SOURCE = 'https://smartinvoice-cdn.azureedge.net/models/gemma-2b-quantized.onnx';
// CORS proxy for any source that might need it
export const OFFLINE_MODEL_CORS_PROXY = process.env.REACT_APP_CORS_PROXY || 
    'https://api.allorigins.win/raw?url=';
export const OFFLINE_MODEL_SIZE_MB = 15; // Approximate size in MB
export const OFFLINE_MODEL_CACHE_KEY = 'gemma2b-model-v1';
export const SERVICE_WORKER_VERSION = 'v1';
export const MAX_LOCAL_INPUT_LENGTH = 1024; // Max tokens for local model input
