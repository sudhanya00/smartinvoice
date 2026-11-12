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

/**
 * Convert an image file to base64 JPEG, scaled down so its longest side is
 * at most maxDimension. Phone photos are several megabytes; a receipt stays
 * readable at this size and the request stays small enough for the server
 * function. Falls back to the original bytes if the image can't be decoded.
 * @param {File} file - Image file from an input or the camera
 * @param {number} maxDimension - Longest side in pixels
 * @param {number} quality - JPEG quality from 0 to 1
 * @returns {Promise<string>} Base64 data without the data-URL prefix
 */
export const fileToJpegBase64 = (file, maxDimension = 1600, quality = 0.85) => {
    const readOriginal = () => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result.split(',')[1]);
        reader.onerror = () => reject(new Error('Could not read image.'));
        reader.readAsDataURL(file);
    });

    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => {
            URL.revokeObjectURL(url);
            try {
                const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(image.width * scale));
                canvas.height = Math.max(1, Math.round(image.height * scale));
                canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', quality).split(',')[1]);
            } catch (e) {
                readOriginal().then(resolve, reject);
            }
        };
        image.onerror = () => {
            URL.revokeObjectURL(url);
            readOriginal().then(resolve, reject);
        };
        image.src = url;
    });
};
