import { CURRENCY_SYMBOLS } from '../constants';

/**
 * Get currency symbol for a given currency code
 * @param {string} currencyCode - 3-letter currency code (e.g., 'USD')
 * @returns {string} Currency symbol
 */
export const getCurrencySymbol = (currencyCode) => {
    return CURRENCY_SYMBOLS[currencyCode] || '$';
};

/**
 * Format amount with currency symbol
 * @param {number} amount - The amount to format
 * @param {string} currency - The currency code
 * @returns {string} Formatted amount with currency symbol
 */
export const formatCurrency = (amount, currency = 'USD') => {
    const symbol = getCurrencySymbol(currency);
    const formattedAmount = (parseFloat(amount) || 0).toFixed(2);
    return `${symbol}${formattedAmount}`;
};

/**
 * Format date to readable string
 * @param {Date|string|number} date - Date to format
 * @returns {string} Formatted date string
 */
export const formatDate = (date) => {
    if (!date) return '';
    
    let dateObj;
    if (date.seconds) {
        // Firestore timestamp
        dateObj = new Date(date.seconds * 1000);
    } else {
        dateObj = new Date(date);
    }
    
    return dateObj.toLocaleDateString();
};

/**
 * Calculate percentage with min/max bounds
 * @param {number} current - Current value
 * @param {number} target - Target value
 * @returns {number} Percentage (0-100)
 */
export const calculateProgress = (current, target) => {
    if (target <= 0) return 0;
    return Math.min((current / target) * 100, 100);
};

/**
 * Truncate text to specified length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
export const truncateText = (text, maxLength = 50) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
};

/**
 * Debounce function calls
 * @param {Function} func - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
export const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(null, args), delay);
    };
};
